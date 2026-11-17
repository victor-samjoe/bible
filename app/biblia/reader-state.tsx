"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Estado do leitor que vive SOMENTE nesta sessão do navegador (sessionStorage).
// Nada aqui é conta, nuvem ou banco: a tarefa C5 liga notas, destaques e progresso
// às tabelas com RLS depois que o Auth Supabase existir de fato. Até então a
// interface precisa dizer "local nesta sessão" e não prometer sincronização.
//
// Desde o C4 o leitor navega por qualquer livro e capítulo, então cada marca é
// guardada com a chave `<livro>.<capítulo>.<versículo>`. Sem isso, uma nota de
// Gênesis 1:5 reapareceria em João 1:5.

export type ReaderTheme = "dark" | "light";
export type FontFamily = "serif" | "sans";
export type FontSize = "pequeno" | "medio" | "grande";
export type Spacing = "compacto" | "padrao" | "amplo";
export type ToolsTab = "leitura" | "versoes" | "versiculo";

export type ReaderPreferences = {
  fontFamily: FontFamily;
  fontSize: FontSize;
  spacing: Spacing;
};

export const defaultPreferences: ReaderPreferences = {
  fontFamily: "serif",
  fontSize: "medio",
  spacing: "padrao",
};

const fontFamilyValue: Record<FontFamily, string> = {
  serif: "Georgia, \"Times New Roman\", serif",
  sans: "Arial, Helvetica, sans-serif",
};

const fontSizeValue: Record<FontSize, string> = {
  pequeno: "1.08rem",
  medio: "1.33rem",
  grande: "1.58rem",
};

const spacingValue: Record<Spacing, string> = {
  compacto: "1.5",
  padrao: "1.78",
  amplo: "2",
};

const SESSION_KEY = "reader-session-v2";
const THEME_KEY = "reader-theme";
const MARK_KEY = /^[a-z0-9-]{1,64}\.\d{1,3}\.\d{1,3}$/;
const MAX_MARKS = 4000;
const MAX_NOTES = 500;
const MAX_NOTE_LENGTH = 10000;

type Marks = {
  highlights: ReadonlySet<string>;
  read: ReadonlySet<string>;
  notes: Readonly<Record<string, string>>;
};

type PersistedState = {
  preferences: ReaderPreferences;
  highlights: string[];
  read: string[];
  notes: Record<string, string>;
};

type ReaderContextValue = {
  theme: ReaderTheme;
  toggleTheme: () => void;
  preferences: ReaderPreferences;
  setPreference: <K extends keyof ReaderPreferences>(key: K, value: ReaderPreferences[K]) => void;
  toolsOpen: boolean;
  openTools: (tab?: ToolsTab) => void;
  closeTools: () => void;
  tab: ToolsTab;
  setTab: (tab: ToolsTab) => void;
  selectedVerse: number | null;
  selectVerse: (verse: number) => void;
  /** Marcas do capítulo aberto, por número de versículo. */
  highlights: ReadonlySet<number>;
  toggleHighlight: (verse: number) => void;
  read: ReadonlySet<number>;
  toggleRead: (verse: number) => void;
  notes: Readonly<Record<number, string>>;
  saveNote: (verse: number, body: string) => void;
  removeNote: (verse: number) => void;
  totalVerses: number;
  reference: string;
  notice: string;
  setNotice: (notice: string) => void;
};

const ReaderContext = createContext<ReaderContextValue | null>(null);

function isFontFamily(value: unknown): value is FontFamily {
  return value === "serif" || value === "sans";
}

function isFontSize(value: unknown): value is FontSize {
  return value === "pequeno" || value === "medio" || value === "grande";
}

function isSpacing(value: unknown): value is Spacing {
  return value === "compacto" || value === "padrao" || value === "amplo";
}

function markKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && MARK_KEY.test(item))
    .slice(0, MAX_MARKS);
}

function readSession(): PersistedState | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const source = parsed as Record<string, unknown>;
    const storedPreferences = (source.preferences ?? {}) as Record<string, unknown>;
    const storedNotes = (source.notes ?? {}) as Record<string, unknown>;
    const notes: Record<string, string> = {};
    for (const [key, value] of Object.entries(storedNotes)) {
      if (typeof value === "string" && MARK_KEY.test(key) && Object.keys(notes).length < MAX_NOTES) {
        notes[key] = value.slice(0, MAX_NOTE_LENGTH);
      }
    }
    return {
      preferences: {
        fontFamily: isFontFamily(storedPreferences.fontFamily)
          ? storedPreferences.fontFamily
          : defaultPreferences.fontFamily,
        fontSize: isFontSize(storedPreferences.fontSize)
          ? storedPreferences.fontSize
          : defaultPreferences.fontSize,
        spacing: isSpacing(storedPreferences.spacing)
          ? storedPreferences.spacing
          : defaultPreferences.spacing,
      },
      highlights: markKeys(source.highlights),
      read: markKeys(source.read),
      notes,
    };
  } catch {
    // Armazenamento bloqueado ou conteúdo inválido: segue com os padrões.
    return null;
  }
}

export function ReaderProvider({
  children,
  scope,
  reference,
  verseNumbers,
}: {
  children: ReactNode;
  /** `<slug do livro>.<capítulo>`, usado como prefixo das marcas. */
  scope: string;
  /** Referência canônica já formatada, para o painel e os avisos. */
  reference: string;
  verseNumbers: readonly number[];
}) {
  const [theme, setTheme] = useState<ReaderTheme>("dark");
  const [preferences, setPreferences] = useState<ReaderPreferences>(defaultPreferences);
  const [marks, setMarks] = useState<Marks>(() => ({
    highlights: new Set<string>(),
    read: new Set<string>(),
    notes: {},
  }));
  const [toolsOpen, setToolsOpen] = useState(false);
  const [tab, setTab] = useState<ToolsTab>("leitura");
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const loaded = useRef(false);

  // Escape fecha o painel de ferramentas, como no seletor de livro/capítulo.
  useEffect(() => {
    if (!toolsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setToolsOpen(false);
        setNotice("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toolsOpen]);

  // Trocar de capítulo fecha o painel e limpa a seleção: o versículo 7 de um
  // capítulo não é o versículo 7 do próximo.
  useEffect(() => {
    setSelectedVerse(null);
    setToolsOpen(false);
    setNotice("");
  }, [scope]);

  // Carrega o estado da sessão depois da hidratação: o servidor não conhece o
  // sessionStorage, então a primeira renderização usa os padrões.
  useEffect(() => {
    let storedTheme: ReaderTheme = "dark";
    try {
      storedTheme = window.sessionStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    } catch {
      storedTheme = "dark";
    }
    setTheme(storedTheme);
    const stored = readSession();
    if (stored) {
      setPreferences(stored.preferences);
      setMarks({
        highlights: new Set(stored.highlights),
        read: new Set(stored.read),
        notes: stored.notes,
      });
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.readerTheme = theme;
  }, [theme]);

  useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty("--reader-fontFamily", fontFamilyValue[preferences.fontFamily]);
    style.setProperty("--reader-fontSize", fontSizeValue[preferences.fontSize]);
    style.setProperty("--reader-lineHeight", spacingValue[preferences.spacing]);
  }, [preferences]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      const payload: PersistedState = {
        preferences,
        highlights: [...marks.highlights],
        read: [...marks.read],
        notes: { ...marks.notes },
      };
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Sessão sem armazenamento disponível: o estado continua apenas em memória.
    }
  }, [preferences, marks]);

  const keyOf = useCallback((verse: number) => `${scope}.${verse}`, [scope]);

  const scopedNumbers = useCallback(
    (keys: ReadonlySet<string>) => {
      const prefix = `${scope}.`;
      const numbers = new Set<number>();
      for (const key of keys) {
        if (!key.startsWith(prefix)) continue;
        const verse = Number(key.slice(prefix.length));
        if (Number.isSafeInteger(verse)) numbers.add(verse);
      }
      return numbers;
    },
    [scope],
  );

  const highlights = useMemo(
    () => scopedNumbers(marks.highlights),
    [marks.highlights, scopedNumbers],
  );
  const read = useMemo(() => scopedNumbers(marks.read), [marks.read, scopedNumbers]);
  const notes = useMemo(() => {
    const prefix = `${scope}.`;
    const result: Record<number, string> = {};
    for (const [key, value] of Object.entries(marks.notes)) {
      if (!key.startsWith(prefix)) continue;
      const verse = Number(key.slice(prefix.length));
      if (Number.isSafeInteger(verse)) result[verse] = value;
    }
    return result;
  }, [marks.notes, scope]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: ReaderTheme = current === "dark" ? "light" : "dark";
      try {
        window.sessionStorage.setItem(THEME_KEY, next);
      } catch {
        // Ignora: o tema continua aplicado nesta navegação.
      }
      return next;
    });
  }, []);

  const setPreference = useCallback(
    <K extends keyof ReaderPreferences>(key: K, value: ReaderPreferences[K]) => {
      setPreferences((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const openTools = useCallback((nextTab?: ToolsTab) => {
    if (nextTab) setTab(nextTab);
    setToolsOpen(true);
  }, []);

  const closeTools = useCallback(() => {
    setToolsOpen(false);
    setNotice("");
  }, []);

  const selectVerse = useCallback((verse: number) => {
    setSelectedVerse(verse);
    setNotice("");
    setTab("versiculo");
    setToolsOpen(true);
  }, []);

  const toggleIn = useCallback(
    (field: "highlights" | "read", verse: number) => {
      const key = keyOf(verse);
      setMarks((current) => {
        const next = new Set(current[field]);
        if (next.has(key)) next.delete(key);
        else if (next.size < MAX_MARKS) next.add(key);
        return { ...current, [field]: next };
      });
    },
    [keyOf],
  );

  const toggleHighlight = useCallback((verse: number) => toggleIn("highlights", verse), [toggleIn]);
  const toggleRead = useCallback((verse: number) => toggleIn("read", verse), [toggleIn]);

  const saveNote = useCallback(
    (verse: number, body: string) => {
      const key = keyOf(verse);
      const trimmed = body.trim();
      setMarks((current) => {
        const notes = { ...current.notes };
        if (trimmed.length === 0) delete notes[key];
        else if (notes[key] !== undefined || Object.keys(notes).length < MAX_NOTES) {
          notes[key] = trimmed.slice(0, MAX_NOTE_LENGTH);
        }
        return { ...current, notes };
      });
    },
    [keyOf],
  );

  const removeNote = useCallback(
    (verse: number) => {
      const key = keyOf(verse);
      setMarks((current) => {
        const notes = { ...current.notes };
        delete notes[key];
        return { ...current, notes };
      });
    },
    [keyOf],
  );

  const value = useMemo<ReaderContextValue>(
    () => ({
      theme,
      toggleTheme,
      preferences,
      setPreference,
      toolsOpen,
      openTools,
      closeTools,
      tab,
      setTab,
      selectedVerse,
      selectVerse,
      highlights,
      toggleHighlight,
      read,
      toggleRead,
      notes,
      saveNote,
      removeNote,
      totalVerses: verseNumbers.length,
      reference,
      notice,
      setNotice,
    }),
    [
      theme,
      toggleTheme,
      preferences,
      setPreference,
      toolsOpen,
      openTools,
      closeTools,
      tab,
      selectedVerse,
      selectVerse,
      highlights,
      toggleHighlight,
      read,
      toggleRead,
      notes,
      saveNote,
      removeNote,
      verseNumbers,
      reference,
      notice,
    ],
  );

  return <ReaderContext.Provider value={value}><div data-reader-theme={theme}>{children}</div></ReaderContext.Provider>;
}

export function useReader(): ReaderContextValue {
  const context = useContext(ReaderContext);
  if (!context) {
    throw new Error("useReader precisa estar dentro de ReaderProvider.");
  }
  return context;
}
