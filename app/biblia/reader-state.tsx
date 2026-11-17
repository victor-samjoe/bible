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
import { verseNumbers } from "./chapter-data";

// Estado do leitor que vive SOMENTE nesta sessão do navegador (sessionStorage).
// Nada aqui é conta, nuvem ou banco: a tarefa C5 liga notas, destaques e progresso
// às tabelas com RLS depois que o Auth Supabase existir de fato. Até então a
// interface precisa dizer "local nesta sessão" e não prometer sincronização.

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

const SESSION_KEY = "reader-session-v1";
const THEME_KEY = "reader-theme";

type PersistedState = {
  preferences: ReaderPreferences;
  highlights: number[];
  read: number[];
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
  highlights: ReadonlySet<number>;
  toggleHighlight: (verse: number) => void;
  read: ReadonlySet<number>;
  toggleRead: (verse: number) => void;
  notes: Readonly<Record<number, string>>;
  saveNote: (verse: number, body: string) => void;
  removeNote: (verse: number) => void;
  totalVerses: number;
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

function knownVerses(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is number => typeof item === "number" && verseNumbers.includes(item),
  );
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
      if (typeof value === "string" && verseNumbers.includes(Number(key))) {
        notes[key] = value;
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
      highlights: knownVerses(source.highlights),
      read: knownVerses(source.read),
      notes,
    };
  } catch {
    // Armazenamento bloqueado ou conteúdo inválido: segue com os padrões.
    return null;
  }
}

export function ReaderProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ReaderTheme>("dark");
  const [preferences, setPreferences] = useState<ReaderPreferences>(defaultPreferences);
  const [highlights, setHighlights] = useState<ReadonlySet<number>>(() => new Set<number>());
  const [read, setRead] = useState<ReadonlySet<number>>(() => new Set<number>());
  const [notes, setNotes] = useState<Readonly<Record<number, string>>>({});
  const [toolsOpen, setToolsOpen] = useState(false);
  const [tab, setTab] = useState<ToolsTab>("leitura");
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const loaded = useRef(false);

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
      setHighlights(new Set(stored.highlights));
      setRead(new Set(stored.read));
      setNotes(
        Object.fromEntries(
          Object.entries(stored.notes).map(([key, value]) => [Number(key), value]),
        ),
      );
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
        highlights: [...highlights],
        read: [...read],
        notes: Object.fromEntries(Object.entries(notes)),
      };
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Sessão sem armazenamento disponível: o estado continua apenas em memória.
    }
  }, [preferences, highlights, read, notes]);

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

  const toggleHighlight = useCallback((verse: number) => {
    setHighlights((current) => {
      const next = new Set(current);
      if (next.has(verse)) next.delete(verse);
      else next.add(verse);
      return next;
    });
  }, []);

  const toggleRead = useCallback((verse: number) => {
    setRead((current) => {
      const next = new Set(current);
      if (next.has(verse)) next.delete(verse);
      else next.add(verse);
      return next;
    });
  }, []);

  const saveNote = useCallback((verse: number, body: string) => {
    const trimmed = body.trim();
    setNotes((current) => {
      const next = { ...current };
      if (trimmed.length === 0) delete next[verse];
      else next[verse] = trimmed.slice(0, 10000);
      return next;
    });
  }, []);

  const removeNote = useCallback((verse: number) => {
    setNotes((current) => {
      const next = { ...current };
      delete next[verse];
      return next;
    });
  }, []);

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
      notice,
    ],
  );

  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}

export function useReader(): ReaderContextValue {
  const context = useContext(ReaderContext);
  if (!context) {
    throw new Error("useReader precisa estar dentro de ReaderProvider.");
  }
  return context;
}
