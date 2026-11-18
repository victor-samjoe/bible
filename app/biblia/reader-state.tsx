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
import {
  chapterScopeSchema,
  isHighlightColor,
  isMarkInScope,
  markAnchor,
  selectionLabel as buildSelectionLabel,
  toggleVerseIn,
  verseMarkKey,
  verseMarkKeySchema,
  type HighlightColor,
} from "@/src/domain/reader-marks";

// Estado do leitor que vive SOMENTE nesta sessão do navegador (sessionStorage).
// Nada aqui é conta, nuvem ou banco: a tarefa C5 liga notas, destaques e progresso
// às tabelas com RLS depois que o Auth Supabase existir de fato. Até então a
// interface precisa dizer "local nesta sessão" e não prometer sincronização.
//
// Modelo da tarefa C13:
// - seleção múltipla de versículos, que não persiste (é intenção, não marca);
// - destaque com cor, por versículo;
// - nota pertencente à seleção que a originou;
// - "lido" é estado do capítulo inteiro, não do versículo.

export type ReaderTheme = "dark" | "light";
export type FontFamily = "serif" | "sans" | "literaria" | "humana" | "monospace";
export type FontSize = "muito-pequeno" | "menor" | "pequeno" | "medio" | "grande";
export type Spacing = "continuo" | "compacto" | "padrao" | "amplo";
export type ParagraphSpacing = "junto" | "padrao" | "separado";
/** Painéis abertos pela barra de seleção. As configurações têm painel próprio. */
export type ActionPanel = "nota" | "versoes" | "original";

export type ReaderPreferences = {
  fontFamily: FontFamily;
  fontSize: FontSize;
  spacing: Spacing;
  paragraphSpacing: ParagraphSpacing;
};

export const defaultPreferences: ReaderPreferences = {
  fontFamily: "serif",
  fontSize: "medio",
  spacing: "padrao",
  paragraphSpacing: "padrao",
};

const fontFamilyValue: Record<FontFamily, string> = {
  serif: "Georgia, \"Times New Roman\", serif",
  sans: "Arial, Helvetica, sans-serif",
  literaria: "\"Palatino Linotype\", Palatino, serif",
  humana: "Verdana, Geneva, sans-serif",
  monospace: "ui-monospace, SFMono-Regular, Consolas, monospace",
};

const fontSizeValue: Record<FontSize, string> = {
  "muito-pequeno": "0.84rem",
  menor: "0.98rem",
  pequeno: "1.14rem",
  medio: "1.33rem",
  grande: "1.58rem",
};

const spacingValue: Record<Spacing, string> = {
  continuo: "1.38",
  compacto: "1.5",
  padrao: "1.78",
  amplo: "2",
};
const paragraphSpacingValue: Record<ParagraphSpacing, string> = { junto: "0.5rem", padrao: "1.05rem", separado: "1.7rem" };

const SESSION_KEY = "reader-session-v3";
const THEME_KEY = "reader-theme";
const MAX_MARKS = 4000;
const MAX_NOTES = 500;
const MAX_NOTE_LENGTH = 10000;

type Marks = {
  /** chave `livro.capítulo.versículo` -> cor */
  highlights: Readonly<Record<string, HighlightColor>>;
  /** chave `livro.capítulo.lista` -> texto */
  notes: Readonly<Record<string, string>>;
  /** escopos `livro.capítulo` marcados como lidos */
  readChapters: ReadonlySet<string>;
};

type PersistedState = {
  preferences: ReaderPreferences;
  highlights: Record<string, HighlightColor>;
  notes: Record<string, string>;
  readChapters: string[];
};

export type ChapterNote = {
  readonly key: string;
  readonly anchor: number;
  readonly verses: string;
  readonly text: string;
};

type ReaderContextValue = {
  theme: ReaderTheme;
  toggleTheme: () => void;
  setTheme: (theme: ReaderTheme) => void;
  preferences: ReaderPreferences;
  setPreference: <K extends keyof ReaderPreferences>(key: K, value: ReaderPreferences[K]) => void;

  /** Painel de configurações de leitura (menu de três pontos). */
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  /** Painel aberto por uma ação da barra de seleção. */
  panel: ActionPanel | null;
  openPanel: (panel: ActionPanel) => void;
  closePanel: () => void;

  selection: ReadonlySet<number>;
  toggleVerse: (verse: number) => void;
  clearSelection: () => void;
  selectionLabel: string;
  /** Texto dos versículos selecionados, pronto para copiar/compartilhar. */
  selectionText: string;

  highlightOf: (verse: number) => HighlightColor | undefined;
  applyHighlight: (color: HighlightColor) => void;
  removeHighlight: () => void;
  highlightCount: number;

  /** Nota da seleção atual, se já existir uma com exatamente esses versículos. */
  selectionNote: string;
  saveNote: (text: string) => void;
  removeNote: () => void;
  chapterNotes: readonly ChapterNote[];

  isChapterRead: boolean;
  isReadScope: (scope: string) => boolean;
  toggleChapterRead: () => void;

  reference: string;
  totalVerses: number;
  notice: string;
  setNotice: (notice: string) => void;
};

const ReaderContext = createContext<ReaderContextValue | null>(null);

function isFontFamily(value: unknown): value is FontFamily {
  return value === "serif" || value === "sans" || value === "literaria" || value === "humana" || value === "monospace";
}

function isFontSize(value: unknown): value is FontSize {
  return value === "muito-pequeno" || value === "menor" || value === "pequeno" || value === "medio" || value === "grande";
}

function isSpacing(value: unknown): value is Spacing {
  return value === "continuo" || value === "compacto" || value === "padrao" || value === "amplo";
}
function isParagraphSpacing(value: unknown): value is ParagraphSpacing { return value === "junto" || value === "padrao" || value === "separado"; }

function readSession(): PersistedState | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const source = parsed as Record<string, unknown>;
    const storedPreferences = (source.preferences ?? {}) as Record<string, unknown>;

    const highlights: Record<string, HighlightColor> = {};
    for (const [key, value] of Object.entries(
      (source.highlights ?? {}) as Record<string, unknown>,
    )) {
      if (Object.keys(highlights).length >= MAX_MARKS) break;
      if (verseMarkKeySchema.test(key) && isHighlightColor(value)) highlights[key] = value;
    }

    const notes: Record<string, string> = {};
    for (const [key, value] of Object.entries((source.notes ?? {}) as Record<string, unknown>)) {
      if (Object.keys(notes).length >= MAX_NOTES) break;
      if (verseMarkKeySchema.test(key) && typeof value === "string" && value.trim().length > 0) {
        notes[key] = value.slice(0, MAX_NOTE_LENGTH);
      }
    }

    const readChapters = Array.isArray(source.readChapters)
      ? source.readChapters
          .filter(
            (item): item is string => typeof item === "string" && chapterScopeSchema.test(item),
          )
          .slice(0, MAX_MARKS)
      : [];

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
        paragraphSpacing: isParagraphSpacing(storedPreferences.paragraphSpacing) ? storedPreferences.paragraphSpacing : defaultPreferences.paragraphSpacing,
      },
      highlights,
      notes,
      readChapters,
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
  verseTexts,
}: {
  children: ReactNode;
  /** `<slug do livro>.<capítulo>`, prefixo de todas as marcas deste capítulo. */
  scope: string;
  /** Referência canônica já formatada, para rótulos e avisos. */
  reference: string;
  verseNumbers: readonly number[];
  verseTexts: readonly { number: number; content: string }[];
}) {
  const [theme, setThemeState] = useState<ReaderTheme>("dark");
  const [preferences, setPreferences] = useState<ReaderPreferences>(defaultPreferences);
  const [marks, setMarks] = useState<Marks>(() => ({
    highlights: {},
    notes: {},
    readChapters: new Set<string>(),
  }));
  const [selection, setSelection] = useState<ReadonlySet<number>>(() => new Set<number>());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panel, setPanel] = useState<ActionPanel | null>(null);
  const [notice, setNotice] = useState("");
  const loaded = useRef(false);

  // Trocar de capítulo zera a seleção e fecha painéis: a seleção é intenção sobre
  // o texto que está na tela, não uma marca guardada.
  useEffect(() => {
    setSelection(new Set<number>());
    setPanel(null);
    setSettingsOpen(false);
    setNotice("");
  }, [scope]);

  useEffect(() => {
    if (!settingsOpen && panel === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSettingsOpen(false);
      setPanel(null);
      setNotice("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, panel]);

  // Carrega o estado da sessão depois da hidratação: o servidor não conhece o
  // sessionStorage, então a primeira renderização usa os padrões.
  useEffect(() => {
    let storedTheme: ReaderTheme = "dark";
    try {
      storedTheme = window.sessionStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    } catch {
      storedTheme = "dark";
    }
    setThemeState(storedTheme);
    const stored = readSession();
    if (stored) {
      setPreferences(stored.preferences);
      setMarks({
        highlights: stored.highlights,
        notes: stored.notes,
        readChapters: new Set(stored.readChapters),
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
    style.setProperty("--reader-paragraphSpacing", paragraphSpacingValue[preferences.paragraphSpacing]);
  }, [preferences]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      const payload: PersistedState = {
        preferences,
        highlights: { ...marks.highlights },
        notes: { ...marks.notes },
        readChapters: [...marks.readChapters],
      };
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Sessão sem armazenamento disponível: o estado continua apenas em memória.
    }
  }, [preferences, marks]);

  const setTheme = useCallback((next: ReaderTheme) => {
    setThemeState(next);
    try {
      window.sessionStorage.setItem(THEME_KEY, next);
    } catch {
      // Ignora: o tema continua aplicado nesta navegação.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const setPreference = useCallback(
    <K extends keyof ReaderPreferences>(key: K, value: ReaderPreferences[K]) => {
      setPreferences((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const toggleVerse = useCallback((verse: number) => {
    setNotice("");
    setSelection((current) => toggleVerseIn(current, verse));
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(new Set<number>());
    setPanel(null);
    setNotice("");
  }, []);

  const highlightOf = useCallback(
    (verse: number): HighlightColor | undefined => {
      const key = verseMarkKey(scope, [verse]);
      return key ? marks.highlights[key] : undefined;
    },
    [marks.highlights, scope],
  );

  const applyHighlight = useCallback(
    (color: HighlightColor) => {
      if (selection.size === 0) return;
      setMarks((current) => {
        const highlights = { ...current.highlights };
        for (const verse of selection) {
          const key = verseMarkKey(scope, [verse]);
          if (!key) continue;
          if (highlights[key] === undefined && Object.keys(highlights).length >= MAX_MARKS) break;
          highlights[key] = color;
        }
        return { ...current, highlights };
      });
    },
    [scope, selection],
  );

  const removeHighlight = useCallback(() => {
    if (selection.size === 0) return;
    setMarks((current) => {
      const highlights = { ...current.highlights };
      for (const verse of selection) {
        const key = verseMarkKey(scope, [verse]);
        if (key) delete highlights[key];
      }
      return { ...current, highlights };
    });
  }, [scope, selection]);

  const selectionKey = useMemo(() => verseMarkKey(scope, selection), [scope, selection]);

  const selectionText = useMemo(
    () => verseTexts
      .filter((verse) => selection.has(verse.number))
      .map((verse) => `${verse.number}. ${verse.content}`)
      .join(" "),
    [selection, verseTexts],
  );

  const selectionNote = selectionKey ? (marks.notes[selectionKey] ?? "") : "";

  const saveNote = useCallback(
    (text: string) => {
      if (!selectionKey) return;
      const trimmed = text.trim();
      setMarks((current) => {
        const notes = { ...current.notes };
        if (trimmed.length === 0) delete notes[selectionKey];
        else if (notes[selectionKey] !== undefined || Object.keys(notes).length < MAX_NOTES) {
          notes[selectionKey] = trimmed.slice(0, MAX_NOTE_LENGTH);
        }
        return { ...current, notes };
      });
    },
    [selectionKey],
  );

  const removeNote = useCallback(() => {
    if (!selectionKey) return;
    setMarks((current) => {
      const notes = { ...current.notes };
      delete notes[selectionKey];
      return { ...current, notes };
    });
  }, [selectionKey]);

  const chapterNotes = useMemo<readonly ChapterNote[]>(() => {
    const result: ChapterNote[] = [];
    for (const [key, text] of Object.entries(marks.notes)) {
      if (!isMarkInScope(key, scope)) continue;
      const anchor = markAnchor(key);
      if (anchor === null) continue;
      result.push({ key, anchor, verses: key.slice(key.lastIndexOf(".") + 1), text });
    }
    return result.sort((left, right) => left.anchor - right.anchor);
  }, [marks.notes, scope]);

  const highlightCount = useMemo(
    () => Object.keys(marks.highlights).filter((key) => isMarkInScope(key, scope)).length,
    [marks.highlights, scope],
  );

  const isChapterRead = marks.readChapters.has(scope);
  const isReadScope = useCallback((candidate: string) => marks.readChapters.has(candidate), [marks.readChapters]);

  const toggleChapterRead = useCallback(() => {
    setMarks((current) => {
      const readChapters = new Set(current.readChapters);
      if (readChapters.has(scope)) readChapters.delete(scope);
      else if (readChapters.size < MAX_MARKS) readChapters.add(scope);
      return { ...current, readChapters };
    });
  }, [scope]);

  const openSettings = useCallback(() => {
    setNotice("");
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setNotice("");
  }, []);

  const openPanel = useCallback((next: ActionPanel) => {
    setNotice("");
    setPanel(next);
  }, []);

  const closePanel = useCallback(() => {
    setPanel(null);
    setNotice("");
  }, []);

  const value = useMemo<ReaderContextValue>(
    () => ({
      theme,
      toggleTheme,
      setTheme,
      preferences,
      setPreference,
      settingsOpen,
      openSettings,
      closeSettings,
      panel,
      openPanel,
      closePanel,
      selection,
      toggleVerse,
      clearSelection,
      selectionLabel: buildSelectionLabel(reference, selection),
      selectionText,
      highlightOf,
      applyHighlight,
      removeHighlight,
      highlightCount,
      selectionNote,
      saveNote,
      removeNote,
      chapterNotes,
      isChapterRead,
      isReadScope,
      toggleChapterRead,
      reference,
      totalVerses: verseNumbers.length,
      notice,
      setNotice,
    }),
    [
      theme,
      toggleTheme,
      setTheme,
      preferences,
      setPreference,
      settingsOpen,
      openSettings,
      closeSettings,
      panel,
      openPanel,
      closePanel,
      selection,
      toggleVerse,
      clearSelection,
      selectionText,
      reference,
      highlightOf,
      applyHighlight,
      removeHighlight,
      highlightCount,
      selectionNote,
      saveNote,
      removeNote,
      chapterNotes,
      isChapterRead,
      isReadScope,
      toggleChapterRead,
      verseNumbers,
      verseTexts,
      notice,
    ],
  );

  return (
    <ReaderContext.Provider value={value}>
      <div data-reader-theme={theme}>{children}</div>
    </ReaderContext.Provider>
  );
}

export function useReader(): ReaderContextValue {
  const context = useContext(ReaderContext);
  if (!context) {
    throw new Error("useReader precisa estar dentro de ReaderProvider.");
  }
  return context;
}
