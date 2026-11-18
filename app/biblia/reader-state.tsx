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
  defaultPreferences as readerDefaults,
  sanitizeReaderPreferences,
  type FontFamily,
  type FontSize,
  type ParagraphSpacing,
  type ReaderPreferences,
  type ReaderTheme,
  type Spacing,
} from "@/src/domain/reader-preferences";
import { saveChapterMarksAction, savePreferencesAction } from "@/app/_actions/reading";
import {
  chapterMarksPayload,
  mergeMarks,
  scopesToUpload,
  type MarkSnapshot,
} from "@/src/domain/reading-sync";
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

// Estado do leitor. Tem duas moradas, e a diferença é visível na interface:
//
// - **sem conta**: `sessionStorage`, que morre quando a aba fecha. A interface
//   diz isso com todas as letras e não promete sincronização;
// - **com conta**: as tabelas pessoais, por Server Action. O `sessionStorage`
//   continua sendo escrito como cache local, mas a verdade passa a ser o banco.
//
// Ao entrar, as duas verdades parciais são conciliadas por
// `src/domain/reading-sync.ts`: a conta ganha no conflito e o que só existia
// no navegador sobe. É assim que o trabalho feito antes de entrar não se perde.
//
// Modelo da tarefa C13:
// - seleção múltipla de versículos, que não persiste (é intenção, não marca);
// - destaque com cor, por versículo;
// - nota pertencente à seleção que a originou;
// - "lido" é estado do capítulo inteiro, não do versículo.

/** Painéis abertos pela barra de seleção. As configurações têm painel próprio. */
export type ActionPanel = "nota" | "versoes" | "original";

// O vocabulário das preferências mora em `src/domain/reader-preferences.ts`,
// porque o Server Action precisa julgar o mesmo valor com a mesma régua. Aqui
// ficam só as traduções para CSS, que são apresentação.
export type {
  FontFamily,
  FontSize,
  ParagraphSpacing,
  ReaderPreferences,
  ReaderTheme,
  Spacing,
} from "@/src/domain/reader-preferences";
export { defaultPreferences } from "@/src/domain/reader-preferences";

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
// "Junto" é leitura corrida: não há bloco visual entre um versículo e outro.
const paragraphSpacingValue: Record<ParagraphSpacing, string> = { junto: "0", padrao: "1.05rem", separado: "1.7rem" };

/** Estado da conta, carregado no servidor e passado por prop. */
export type AccountReading = {
  readonly theme: ReaderTheme | null;
  readonly preferences: ReaderPreferences | null;
  readonly marks: MarkSnapshot;
};

/** Espera entre a última alteração e a gravação, para não escrever por tecla. */
const SYNC_DELAY_MS = 900;
/** Capítulos que sobem de uma vez no primeiro acesso autenticado. */
const MAX_UPLOAD_ON_LOGIN = 25;

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
  toggleVerse: (verse: number, extendRange?: boolean) => void;
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
  /**
   * Onde este estado está sendo guardado. A interface precisa dizer a verdade:
   * `"session"` some ao fechar a aba, `"account"` acompanha a pessoa.
   */
  storage: "session" | "account";
};

const ReaderContext = createContext<ReaderContextValue | null>(null);

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
      preferences: sanitizeReaderPreferences(storedPreferences),
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
  account = null,
}: {
  children: ReactNode;
  /** `<slug do livro>.<capítulo>`, prefixo de todas as marcas deste capítulo. */
  scope: string;
  /** Referência canônica já formatada, para rótulos e avisos. */
  reference: string;
  verseNumbers: readonly number[];
  verseTexts: readonly { number: number; content: string }[];
  /** `null` quando não há sessão: o leitor fica só no `sessionStorage`. */
  account?: AccountReading | null;
}) {
  const [theme, setThemeState] = useState<ReaderTheme>("dark");
  const [preferences, setPreferences] = useState<ReaderPreferences>(readerDefaults);
  const [marks, setMarks] = useState<Marks>(() => ({
    highlights: {},
    notes: {},
    readChapters: new Set<string>(),
  }));
  const [selection, setSelection] = useState<ReadonlySet<number>>(() => new Set<number>());
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panel, setPanel] = useState<ActionPanel | null>(null);
  const [notice, setNotice] = useState("");
  const loaded = useRef(false);
  /** Última carga já gravada neste capítulo, para não reescrever o igual. */
  const lastSynced = useRef<string | null>(null);
  const signedIn = account !== null;

  // Trocar de capítulo zera a seleção e fecha painéis: a seleção é intenção sobre
  // o texto que está na tela, não uma marca guardada.
  useEffect(() => {
    setSelection(new Set<number>());
    setSelectionAnchor(null);
    setPanel(null);
    setSettingsOpen(false);
    setNotice("");
    lastSynced.current = null;
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

  // Carrega o estado depois da hidratação: o servidor não conhece o
  // sessionStorage, então a primeira renderização usa os padrões. Com conta, o
  // que veio do banco entra aqui já conciliado com o que havia no navegador.
  useEffect(() => {
    let storedTheme: ReaderTheme = "dark";
    try {
      storedTheme = window.sessionStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    } catch {
      storedTheme = "dark";
    }
    const stored = readSession();
    const local: MarkSnapshot = {
      highlights: stored?.highlights ?? {},
      notes: stored?.notes ?? {},
      readChapters: stored?.readChapters ?? [],
    };

    if (account === null) {
      setThemeState(storedTheme);
      if (stored) {
        setPreferences(stored.preferences);
        setMarks({
          highlights: local.highlights,
          notes: local.notes,
          readChapters: new Set(local.readChapters),
        });
      }
      loaded.current = true;
      return;
    }

    const merged = mergeMarks(account.marks, local);
    setThemeState(account.theme ?? storedTheme);
    setPreferences(account.preferences ?? stored?.preferences ?? readerDefaults);
    setMarks({
      highlights: merged.highlights,
      notes: merged.notes,
      readChapters: new Set(merged.readChapters),
    });

    // Sobe o que só existia neste navegador. Em sequência, e não em paralelo:
    // são gravações do mesmo usuário no mesmo banco, e disparar vinte de uma
    // vez só serve para competir por conexão.
    const pending = scopesToUpload(account.marks, local, MAX_UPLOAD_ON_LOGIN);
    if (pending.length > 0) {
      void (async () => {
        for (const pendingScope of pending) {
          try {
            await saveChapterMarksAction(chapterMarksPayload(pendingScope, merged));
          } catch {
            // Sem rede ou sessão expirada: o estado segue em memória e a
            // próxima alteração tenta de novo.
            break;
          }
        }
      })();
    }
    // O capítulo aberto já está conciliado: marcar como gravado evita uma
    // escrita idêntica logo depois da montagem.
    lastSynced.current = JSON.stringify(chapterMarksPayload(scope, merged));
    loaded.current = true;
    // `account` vem do servidor a cada navegação; conciliar uma vez por
    // montagem é o comportamento desejado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Grava as marcas do capítulo aberto na conta. Agrupa alterações: marcar
  // cinco versículos em sequência é uma gravação, não cinco.
  useEffect(() => {
    if (!signedIn || !loaded.current) return;
    const payload = chapterMarksPayload(scope, {
      highlights: marks.highlights,
      notes: marks.notes,
      readChapters: [...marks.readChapters],
    });
    const serialized = JSON.stringify(payload);
    if (serialized === lastSynced.current) return;
    const timer = window.setTimeout(() => {
      void saveChapterMarksAction(payload)
        .then((saved) => {
          if (saved) lastSynced.current = serialized;
        })
        .catch(() => undefined);
    }, SYNC_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [marks, scope, signedIn]);

  useEffect(() => {
    if (!signedIn || !loaded.current) return;
    const timer = window.setTimeout(() => {
      void savePreferencesAction(theme, preferences).catch(() => undefined);
    }, SYNC_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [preferences, theme, signedIn]);

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

  const toggleVerse = useCallback((verse: number, extendRange = false) => {
    setNotice("");
    if (extendRange && selectionAnchor !== null) {
      const start = Math.min(selectionAnchor, verse);
      const end = Math.max(selectionAnchor, verse);
      setSelection((current) => new Set([
        ...current,
        ...verseNumbers.filter((number) => number >= start && number <= end),
      ]));
      return;
    }
    setSelectionAnchor(verse);
    setSelection((current) => toggleVerseIn(current, verse));
  }, [selectionAnchor, verseNumbers]);

  const clearSelection = useCallback(() => {
    setSelection(new Set<number>());
    setSelectionAnchor(null);
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
      storage: signedIn ? "account" : "session",
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
      signedIn,
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
