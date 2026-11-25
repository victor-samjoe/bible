/**
 * O que o leitor mostra ao clicar numa palavra (LEXICON-INDEX-001, fila C30).
 *
 * Esta função substitui a prova manual de `src/domain/word-analysis.ts` — mas
 * **não a descarta**. A regra de precedência é a única defensável:
 *
 *   1. nota editorial revisada, quando existe para aquela posição;
 *   2. tradução aprovada da glossa;
 *   3. rascunho de tradução, **só em pré-visualização** e rotulado;
 *   4. a glossa original em inglês, marcada como original;
 *   5. nada, quando a fonte não publica glossa.
 *
 * Trocar a nota revisada de Gênesis 1:1 por um rascunho de máquina seria
 * rebaixar o produto: aquelas sete notas passaram por revisão humana e dizem
 * mais do que uma glossa de uma palavra. O índice entra para cobrir os outros
 * 31.101 versículos, não para apagar os que já estavam prontos.
 *
 * A outra coisa que esta camada resolve é a diferença de granularidade. O
 * leitor mostra **palavras**; o MACULA Hebrew publica **morfemas**, e são 11
 * morfemas para as 7 palavras de Gênesis 1:1. Agrupar por `wordPosition`
 * devolve, para a palavra clicada, a lista de morfemas que a compõem.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco.
 */

import { publishableText, type EditorialTranslation } from "./translation-workflow.ts";
import type { BdbSense } from "./records.ts";
import { type WordAnalysis } from "../word-analysis.ts";

/** Linha de ocorrência como o banco a devolve, já achatada. */
export type OccurrenceRow = {
  readonly sourceWordId: string;
  /**
   * Idioma da ocorrência. Explícito, e não deduzido do prefixo de `lexemeKey`:
   * cortar a chave por string funcionaria hoje e quebraria no dia em que o
   * formato dela mudasse, sem nenhum teste reclamando.
   */
  readonly language: "hbo" | "grc";
  readonly canonicalRef: string;
  readonly wordPosition: number | null;
  readonly surface: string;
  readonly lexemeKey: string;
  readonly lemma: string;
  readonly morphology: string | null;
  readonly partOfSpeech: string | null;
  readonly semanticDomain: string | null;
  readonly gloss: string | null;
  /** Verbete do lema, quando o dicionário o define. */
  readonly entryTransliteration: string | null;
  readonly entryStrongId: string | null;
  /** Tradução da glossa, quando existe em qualquer estado. */
  readonly translation: EditorialTranslation | null;
  /**
   * Verbetes do BDB alcançados por este morfema, via ponte
   * lema → Strong → id da obra.
   *
   * É uma lista, e não um único verbete, porque um Strong pode alcançar mais de
   * um: `בָּרָא` chega a `b.cw.aa` e `b.cx.aa`, que são homógrafos distintos. A
   * ambiguidade é do dado, e escolher um seria a interface mentindo sobre o que
   * a obra diz.
   */
  readonly bdb: readonly BdbEntryView[];
};

/** Verbete do BDB como o painel o exibe. */
export type BdbEntryView = {
  readonly bdbId: string;
  readonly lemma: string;
  readonly partOfSpeech: string | null;
  readonly isRoot: boolean;
  /** Definições do topo do verbete, antes de qualquer acepção. */
  readonly definitions: readonly string[];
  readonly senseCount: number;
  readonly maxDepth: number;
  readonly senses: readonly BdbSense[];
};

export type MeaningSource = "reviewed_note" | "approved_translation" | "machine_draft" | "source_gloss";

/**
 * Estado de revisão de um texto exibido, para a interface poder rotulá-lo.
 *
 * Existe separado de `MeaningSource` porque a procedência e o estado respondem
 * perguntas diferentes: "de onde veio" e "alguém conferiu". A definição do BDB,
 * por exemplo, vem de obra publicada e revisada por lexicógrafos, mas **não**
 * tem tradução para português conferida — é `source_text`, não `approved`.
 */
export type ReviewState =
  /** Nota editorial do produto, revisada por humano. */
  | "editorial_reviewed"
  /** Tradução para pt-BR aprovada no fluxo editorial. */
  | "approved"
  /** Rascunho de máquina; só aparece em pré-visualização, sempre rotulado. */
  | "unreviewed_draft"
  /** Texto da fonte, em inglês, sem tradução para pt-BR. */
  | "source_text";

export function reviewStateOf(source: MeaningSource | null): ReviewState | null {
  if (source === null) return null;
  if (source === "reviewed_note") return "editorial_reviewed";
  if (source === "approved_translation") return "approved";
  if (source === "machine_draft") return "unreviewed_draft";
  return "source_text";
}

/**
 * Crédito de uma fonte efetivamente usada para montar o que está na tela.
 *
 * A licença exige atribuição de quem foi usado, e só. Listar as oito fontes do
 * registro em toda palavra creditaria obra que não entrou naquela análise, o
 * que é impreciso na direção oposta.
 */
export type SourceCredit = {
  readonly sourceId: string;
  readonly name: string;
  readonly licenseDeclared: string;
  readonly attribution: string;
  /** Quais campos daquela palavra vieram desta fonte. */
  readonly fields: readonly string[];
};

export type MorphemeView = {
  readonly surface: string;
  readonly lemma: string;
  readonly strongId: string | null;
  readonly morphology: string | null;
  readonly partOfSpeech: string | null;
  readonly transliteration: string | null;
  readonly semanticDomain: string | null;
  /** Significado exibível e de onde ele veio. */
  readonly meaning: string | null;
  readonly meaningSource: MeaningSource | null;
  /** Acepções do BDB alcançadas por este morfema. */
  readonly bdb: readonly BdbEntryView[];
  /**
   * Preenchido apenas quando `meaningSource` é `machine_draft`. A interface é
   * obrigada a rotular o texto com isto; se o campo existe, o aviso existe.
   */
  readonly draftMethod: string | null;
};

export type WordView = {
  readonly position: number;
  /** Morfemas que compõem esta palavra, na ordem da fonte. */
  readonly morphemes: readonly MorphemeView[];
  /** Nota editorial revisada, quando há uma para esta posição. */
  readonly reviewedNote: WordAnalysis | null;
};

export type ViewOptions = {
  /** Liga a exibição de rascunho não revisado. Padrão: desligado. */
  readonly allowMachineDraft?: boolean;
};

function meaningOf(
  row: OccurrenceRow,
  options: ViewOptions,
): { readonly meaning: string | null; readonly source: MeaningSource | null; readonly draftMethod: string | null } {
  const shown = publishableText(row.translation, row.gloss, options);
  if (shown.kind === "translation") {
    return { meaning: shown.text, source: "approved_translation", draftMethod: null };
  }
  if (shown.kind === "machine_draft") {
    return { meaning: shown.text, source: "machine_draft", draftMethod: shown.draftMethod };
  }
  if (shown.kind === "source_fallback") {
    return { meaning: shown.text, source: "source_gloss", draftMethod: null };
  }
  return { meaning: null, source: null, draftMethod: null };
}

/**
 * Agrupa as ocorrências de um versículo por palavra.
 *
 * Ocorrência sem `wordPosition` é descartada em vez de receber uma posição
 * inventada: sem a posição não há como dizer a que palavra do leitor ela
 * pertence, e chutar faria o painel mostrar o morfema errado.
 */
export function buildWordViews(
  rows: readonly OccurrenceRow[],
  reviewedFor: (position: number) => WordAnalysis | null,
  options: ViewOptions = {},
): readonly WordView[] {
  const byPosition = new Map<number, MorphemeView[]>();
  for (const row of rows) {
    if (row.wordPosition === null) continue;
    const { meaning, source, draftMethod } = meaningOf(row, options);
    const bucket = byPosition.get(row.wordPosition) ?? [];
    bucket.push({
      surface: row.surface,
      lemma: row.lemma,
      strongId: row.entryStrongId,
      morphology: row.morphology,
      partOfSpeech: row.partOfSpeech,
      transliteration: row.entryTransliteration,
      semanticDomain: row.semanticDomain,
      meaning,
      meaningSource: source,
      bdb: row.bdb,
      draftMethod,
    });
    byPosition.set(row.wordPosition, bucket);
  }

  return [...byPosition.entries()]
    .sort(([left], [right]) => left - right)
    .map(([position, morphemes]) => {
      const reviewed = reviewedFor(position);
      return {
        position,
        morphemes,
        reviewedNote: reviewed,
      };
    });
}

/**
 * Significado a exibir para a palavra inteira, não para cada morfema.
 *
 * A nota revisada vence, quando existe. Sem ela, os significados dos morfemas
 * são unidos na ordem da fonte — é assim que "em" + "princípio" vira "em
 * princípio" para a primeira palavra de Gênesis 1:1. Morfema sem significado é
 * omitido da junção, em vez de virar um espaço em branco.
 */
export function wordMeaning(view: WordView): {
  readonly text: string | null;
  readonly source: MeaningSource | null;
  readonly draftMethod: string | null;
} {
  if (view.reviewedNote) {
    return {
      text: view.reviewedNote.contextualTranslation,
      source: "reviewed_note",
      draftMethod: null,
    };
  }
  const parts = view.morphemes.filter((morpheme) => morpheme.meaning !== null);
  if (parts.length === 0) return { text: null, source: null, draftMethod: null };
  // A procedência exibida é a mais fraca entre as partes: se um pedaço do
  // significado é rascunho, a palavra inteira precisa ser rotulada como tal.
  const weakest: MeaningSource = parts.some((part) => part.meaningSource === "source_gloss")
    ? "source_gloss"
    : parts.some((part) => part.meaningSource === "machine_draft")
      ? "machine_draft"
      : "approved_translation";
  return {
    text: parts.map((part) => part.meaning).join(" "),
    source: weakest,
    draftMethod: parts.find((part) => part.draftMethod !== null)?.draftMethod ?? null,
  };
}
