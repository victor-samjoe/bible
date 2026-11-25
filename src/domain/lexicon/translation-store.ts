/**
 * Armazém das traduções editoriais (LEXICON-INDEX-001, fila C30).
 *
 * O trabalho de tradução anda por livro e ao longo de várias execuções, então
 * o armazém precisa de três propriedades, nesta ordem de importância:
 *
 * 1. **Retomável.** Cada execução carrega o que já existe e só pede o que
 *    falta. Traduzir 19.521 verbetes não acontece de uma vez.
 * 2. **Idempotente.** Ingerir o mesmo lote duas vezes não duplica registro nem
 *    muda o que já estava lá. A chave é `lexemeKey + campo`, não a ordem.
 * 3. **Não regressivo.** Um rascunho novo **nunca** sobrescreve um texto já
 *    revisado ou aprovado. Reprocessar um livro inteiro depois da revisão não
 *    pode apagar o trabalho humano — e essa é a falha mais fácil de cometer
 *    num pipeline que roda sozinho.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco, sem chamada a modelo.
 */

import {
  TranslationWorkflowError,
  assertTranslationIsCoherent,
  type EditorialTranslation,
} from "./translation-workflow.ts";

/** Campos do verbete que esta frente traduz. */
/**
 * Campos que esta frente traduz.
 *
 * `occurrence.gloss` é o primeiro de propósito: é a glossa curta e contextual
 * que o MACULA publica por ocorrência ("in", "beginning", "he.created") e que o
 * leitor mostra ao clicar numa palavra. A glossa do verbete de Strong, por
 * contraste, é a lista de usos da KJV ("court, daughter, door, + dungeon..."),
 * material pobre para quem só quer saber o que a palavra diz ali.
 */
export const TRANSLATABLE_TARGETS = [
  "occurrence.gloss",
  "entry.gloss",
  "entry.definition",
] as const;

/**
 * Sujeito de uma tradução de glossa de ocorrência.
 *
 * A glossa não pertence a um lema, e sim ao texto dela mesma: "in" vira "em"
 * onde quer que apareça. Traduzir por **texto distinto** em vez de por
 * ocorrência troca 607 mil traduções por 60 mil, e mantém a mesma palavra
 * traduzida igual em todo o texto, em vez de depender de qual lote a pegou.
 */
export function glossSubjectKey(language: "hbo" | "grc", glossText: string): string {
  return `gloss:${language}:${glossText.trim().normalize("NFC")}`;
}

/** Verdadeiro para sujeito de glossa, falso para chave de lema. */
export function isGlossSubject(subject: string): boolean {
  return subject.startsWith("gloss:");
}

export type TranslatableTarget = (typeof TRANSLATABLE_TARGETS)[number];

export type TranslationKey = string;

/**
 * Chave do registro. Um verbete tem no máximo uma tradução por campo; é o que
 * torna a ingestão idempotente sem precisar comparar texto.
 */
export function translationKey(lexemeKey: string, target: string): TranslationKey {
  return `${lexemeKey}\u0000${target}`;
}

export type TranslationStore = ReadonlyMap<TranslationKey, EditorialTranslation>;

/** Pedido de tradução: o que falta traduzir, com o original junto. */
export type TranslationRequest = {
  readonly lexemeKey: string;
  readonly target: TranslatableTarget;
  readonly sourceText: string;
  readonly sourceLanguage: "en" | "grc" | "hbo";
  /** Lema original, só para dar contexto a quem traduz. Não é traduzido. */
  readonly lemma: string;
  /** Primeiro livro em que o lema aparece, na ordem de trabalho. */
  readonly book: string;
};

export type IngestOutcome = {
  readonly store: TranslationStore;
  readonly added: number;
  /** Já existia com o mesmo texto: nada a fazer. */
  readonly unchanged: number;
  /** Rascunho recusado porque havia revisão humana no lugar. */
  readonly protected: readonly string[];
  readonly rejected: readonly { readonly key: string; readonly reason: string }[];
};

function isProtected(existing: EditorialTranslation): boolean {
  return existing.status === "human_reviewed" || existing.status === "approved";
}

/**
 * Funde rascunhos novos no armazém. Devolve um armazém novo — nada é mutado —
 * junto da contagem do que entrou, do que já estava igual e do que foi
 * recusado, para o relatório da execução ser verificável.
 */
export function ingestDrafts(
  store: TranslationStore,
  drafts: readonly EditorialTranslation[],
): IngestOutcome {
  const next = new Map(store);
  const guarded: string[] = [];
  const rejected: { key: string; reason: string }[] = [];
  let added = 0;
  let unchanged = 0;

  for (const draft of drafts) {
    const key = translationKey(keyOf(draft), draft.target);
    try {
      assertTranslationIsCoherent(draft);
      if (draft.text.trim().length === 0) {
        throw new TranslationWorkflowError("tradução vazia");
      }
    } catch (error) {
      rejected.push({
        key,
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const existing = next.get(key);
    if (existing && isProtected(existing)) {
      // O humano já passou por aqui. O rascunho perde, sempre.
      guarded.push(key);
      continue;
    }
    if (existing && existing.text === draft.text && existing.status === draft.status) {
      unchanged += 1;
      continue;
    }
    next.set(key, draft);
    added += 1;
  }

  return { store: next, added, unchanged, protected: guarded, rejected };
}

/**
 * `EditorialTranslation` não carrega o lema a que pertence — a proveniência é
 * do texto-fonte. O armazém precisa dessa chave, então ela viaja no registro
 * serializado e é lida de volta aqui.
 */
export type StoredTranslation = EditorialTranslation & { readonly lexemeKey: string };

function keyOf(translation: EditorialTranslation): string {
  const candidate = (translation as Partial<StoredTranslation>).lexemeKey;
  if (typeof candidate === "string" && candidate.length > 0) return candidate;
  throw new TranslationWorkflowError("registro de tradução sem lexemeKey");
}

/** Serialização determinística: uma linha JSON por registro, ordenada. */
export function serializeStore(store: TranslationStore): string {
  return [...store.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => `${JSON.stringify(value)}\n`)
    .join("");
}

export function parseStore(content: string): TranslationStore {
  const store = new Map<TranslationKey, EditorialTranslation>();
  for (const line of content.split(/\r?\n/u)) {
    if (line.trim().length === 0) continue;
    const record = JSON.parse(line) as StoredTranslation;
    store.set(translationKey(record.lexemeKey, record.target), record);
  }
  return store;
}

export type StoreProgress = {
  readonly total: number;
  readonly machineDraft: number;
  readonly humanReviewed: number;
  readonly approved: number;
};

export function storeProgress(store: TranslationStore): StoreProgress {
  let machineDraft = 0;
  let humanReviewed = 0;
  let approved = 0;
  for (const value of store.values()) {
    if (value.status === "machine_draft") machineDraft += 1;
    else if (value.status === "human_reviewed") humanReviewed += 1;
    else approved += 1;
  }
  return { total: store.size, machineDraft, humanReviewed, approved };
}
