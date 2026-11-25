/**
 * Testemunho textual e leitura atestada (KNOWLEDGE-GRAPH-001, fila A2).
 * Serve aos ramos `texto-testemunhos` e `critica-textual`.
 *
 * Um testemunho é o objeto que **atesta** um texto: manuscrito, papiro,
 * lecionário, versão antiga, citação em autor patrístico ou a própria edição
 * crítica. Ele não é a mesma coisa que a obra nem que a edição — e o campo que
 * guarda essa diferença é `publishedInEditionId`.
 *
 * Essa exigência é a parte importante deste arquivo. Nós não lemos o Códice
 * Vaticano; lemos uma edição ou um aparato que informa o que ele traz. Registrar
 * a leitura como se viesse do manuscrito apagaria o intermediário que pode estar
 * errado, desatualizado ou discordante de outra edição. Toda leitura aponta para
 * a evidência publicada que a documenta, com localização — e é por isso que
 * `evidenceId` também é obrigatório.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco.
 */

import { z } from "zod";
import { anchorKey, PassageAnchorSchema, type PassageAnchor } from "./anchors";
import { branchDefinition, type BranchId } from "./branches";
import {
  confidenceGrade,
  isoDate,
  issuesOf,
  languageTag,
  optionalText,
  requiredText,
  stableId,
} from "./primitives";
import type { SourceEdition } from "./provenance";

export const WITNESS_KINDS = [
  "manuscrito",
  "papiro",
  "fragmento",
  "lecionario",
  "versao_antiga",
  "citacao_patristica",
  "edicao_critica",
  "edicao_impressa",
  "inscricao",
] as const;

export type WitnessKind = (typeof WITNESS_KINDS)[number];

export const TextualWitnessSchema = z
  .strictObject({
    id: stableId,
    /** Sigla como a crítica textual a usa: "B", "4QGen-b", "LXX", "Vg". */
    siglum: requiredText,
    label: requiredText,
    kind: z.enum(WITNESS_KINDS),
    language: languageTag,
    /** Escrita, quando distingue testemunhos: "uncial", "quadrada", "minúscula". */
    script: optionalText,
    dateExpression: requiredText,
    dateEarliest: z.number().int().min(-4000).max(2200).nullable().default(null),
    dateLatest: z.number().int().min(-4000).max(2200).nullable().default(null),
    /** Acervo e cota do exemplar, quando existe objeto físico identificado. */
    holding: z
      .strictObject({ institution: requiredText, shelfmark: requiredText, city: optionalText })
      .nullable()
      .default(null),
    /**
     * Edição por onde a leitura deste testemunho é conhecida. Obrigatório: sem
     * ela, a afirmação sobre o manuscrito não tem como ser conferida.
     */
    publishedInEditionId: stableId,
    note: optionalText,
  })
  .check((ctx) => {
    const witness = ctx.value;
    if (witness.dateEarliest !== null && witness.dateLatest !== null && witness.dateEarliest > witness.dateLatest) {
      ctx.issues.push({ code: "custom", input: witness, path: ["dateLatest"], message: "O ano final não pode ser anterior ao inicial" });
    }
    const physical: readonly WitnessKind[] = ["manuscrito", "papiro", "fragmento", "lecionario", "inscricao"];
    if (physical.includes(witness.kind) && witness.holding === null) {
      ctx.issues.push({ code: "custom", input: witness, path: ["holding"], message: `Testemunho do tipo ${witness.kind} exige acervo e cota` });
    }
  });

export type TextualWitness = z.infer<typeof TextualWitnessSchema>;

export const READING_TYPES = ["leitura_base", "variante", "omissao", "adicao", "transposicao", "ilegivel"] as const;
export type ReadingType = (typeof READING_TYPES)[number];

/**
 * Leitura que um testemunho atesta em uma passagem.
 *
 * `omissao` e `ilegivel` não têm texto — e o contrato exige `null` em vez de
 * string vazia, porque "" pode ser uma transcrição esquecida, enquanto `null`
 * é uma afirmação: aqui não há texto a transcrever.
 */
export const WitnessReadingSchema = z
  .strictObject({
    id: stableId,
    witnessId: stableId,
    anchor: PassageAnchorSchema,
    readingType: z.enum(READING_TYPES),
    /** Transcrição no idioma do testemunho; `null` em omissão e ilegibilidade. */
    readingText: z.string().trim().min(1).nullable(),
    language: languageTag,
    /** Evidência publicada que documenta a leitura, com edição e localização. */
    evidenceId: stableId,
    confidence: confidenceGrade,
    /** Divergências entre edições sobre o que o testemunho traz. */
    knownDisputes: z.array(requiredText).default([]),
    collatedBy: requiredText,
    collatedAt: isoDate,
    note: optionalText,
  })
  .check((ctx) => {
    const reading = ctx.value;
    const textless: readonly ReadingType[] = ["omissao", "ilegivel"];
    if (textless.includes(reading.readingType)) {
      if (reading.readingText !== null) {
        ctx.issues.push({ code: "custom", input: reading, path: ["readingText"], message: `Leitura do tipo ${reading.readingType} não pode trazer texto` });
      }
      return;
    }
    if (reading.readingText === null) {
      ctx.issues.push({ code: "custom", input: reading, path: ["readingText"], message: `Leitura do tipo ${reading.readingType} exige a transcrição` });
    }
  });

export type WitnessReading = z.infer<typeof WitnessReadingSchema>;

/**
 * Ramos que podem sustentar afirmação sobre testemunho. Declarado aqui a partir
 * da obrigação do ramo, e não por lista repetida: se amanhã outro ramo passar a
 * exigir testemunho, esta função acompanha sem edição.
 */
export function branchAdmitsWitness(branch: BranchId): boolean {
  return branchDefinition(branch).obligations.requiresWitness;
}

/**
 * Forma mínima da evidência de que uma leitura depende. Estrutural de propósito:
 * `EvidenceFragment` satisfaz este tipo, e declará-lo assim mantém este módulo
 * folha — `evidence.ts` importa daqui para exigir testemunho, e um import de
 * volta fecharia o ciclo.
 */
export type AttestingEvidence = {
  readonly id: string;
  readonly branch: BranchId;
  readonly anchors: readonly PassageAnchor[];
};

export type WitnessIndex = ReadonlyMap<string, TextualWitness>;

export function indexWitnesses(witnesses: readonly TextualWitness[]): WitnessIndex {
  return new Map(witnesses.map((witness) => [witness.id, witness]));
}

/**
 * Valida o testemunho e, com o índice de edições, a ligação que o torna
 * conferível. Sem o índice a conferência é de forma: `publishedInEditionId`
 * pode apontar para uma edição que ninguém cadastrou, e aí a cadeia
 * "manuscrito → edição que informa a leitura" se rompe exatamente onde ela
 * serve para algo.
 */
export function validateTextualWitness(
  input: unknown,
  editions?: ReadonlyMap<string, SourceEdition>,
): readonly string[] {
  const parsed = TextualWitnessSchema.safeParse(input);
  if (!parsed.success) return issuesOf(parsed.error, "witness");
  if (editions === undefined) return [];
  const witness = parsed.data;
  return editions.has(witness.publishedInEditionId)
    ? []
    : [`witness.publishedInEditionId: edição ${witness.publishedInEditionId} não está registrada`];
}

export type WitnessReadingContext = {
  readonly witnesses?: WitnessIndex;
  readonly evidence?: ReadonlyMap<string, AttestingEvidence>;
};

/**
 * Valida a leitura e as duas pontas que a sustentam: o testemunho que atesta e
 * a evidência publicada que documenta a leitura, na passagem da leitura.
 *
 * A última conferência é a que importa. Uma leitura cuja evidência está ancorada
 * em outro versículo é uma colação que ninguém pode refazer: o aparato citado
 * não fala da passagem que o registro afirma.
 */
export function validateWitnessReading(input: unknown, context: WitnessReadingContext = {}): readonly string[] {
  const parsed = WitnessReadingSchema.safeParse(input);
  if (!parsed.success) return issuesOf(parsed.error, "reading");
  const reading = parsed.data;
  const errors: string[] = [];

  if (context.witnesses !== undefined && !context.witnesses.has(reading.witnessId)) {
    errors.push(`reading.witnessId: testemunho ${reading.witnessId} não está registrado`);
  }

  if (context.evidence !== undefined) {
    const fragment = context.evidence.get(reading.evidenceId);
    if (fragment === undefined) {
      errors.push(`reading.evidenceId: evidência ${reading.evidenceId} não está registrada`);
    } else {
      if (!branchAdmitsWitness(fragment.branch)) {
        errors.push(
          `reading.evidenceId: a evidência ${fragment.id} está no ramo ${fragment.branch}, que não documenta testemunho textual`,
        );
      }
      const key = anchorKey(reading.anchor);
      if (!fragment.anchors.some((anchor) => anchorKey(anchor) === key)) {
        errors.push(`reading.evidenceId: a evidência ${fragment.id} não está ancorada em ${key}`);
      }
    }
  }

  return errors;
}

/** Rótulo de aparato: sigla + tipo, como aparece numa lista de variantes. */
export function readingLabel(witness: TextualWitness, reading: WitnessReading): string {
  const type = reading.readingType === "leitura_base" ? "leitura" : reading.readingType;
  return `${witness.siglum} (${type})`;
}
