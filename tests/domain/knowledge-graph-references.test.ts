/**
 * Referências, testemunhos e revisão (KNOWLEDGE-GRAPH-001, fila A2, item 3).
 *
 * Três coisas se provam aqui.
 *
 * **A cadeia do testemunho.** Ninguém lê um manuscrito do século V: lê uma
 * edição que o transcreve. O registro tem de nomear o testemunho quando o ramo
 * o exige, o testemunho tem de estar cadastrado, e a edição por onde sua leitura
 * é conhecida também — sem ela o intermediário desaparece e a afirmação passa a
 * parecer leitura direta do objeto.
 *
 * **A retratação.** Estado retratado não é rascunho: houve publicação e ela foi
 * desfeita. O que dependia dela não pode continuar publicado.
 *
 * **A duplicação de `connectionsFrom`.** A avaliação externa observou que a
 * função monta a chave da âncora à mão, em vez de chamar `anchorKey`, e pediu
 * equivalência provada antes de unificar. É o que o último grupo faz.
 */

import { describe, expect, it } from "vitest";
import { anchorKey } from "../../src/domain/knowledge-graph/anchors";
import { connectionsFrom, validatePassageConnection } from "../../src/domain/knowledge-graph/connections";
import {
  indexEvidence,
  validateClaim,
  validateInterpretationPosition,
} from "../../src/domain/knowledge-graph/claims";
import { indexProvenance, validateEvidence } from "../../src/domain/knowledge-graph/evidence";
import {
  SourceArtifactSchema,
  SourceEditionSchema,
} from "../../src/domain/knowledge-graph/provenance";
import {
  PassageConnectionSchema,
} from "../../src/domain/knowledge-graph/connections";
import { TextualWitnessSchema } from "../../src/domain/knowledge-graph/witnesses";
import {
  artifact,
  connection,
  edition,
  GEN_1_1,
  GEN_1_1_5,
  GEN_1_3,
  GEN_1_6,
  interpretationEvidence,
  JHN_1_1,
  literaryEvidence,
  philologyClaim,
  philologyEvidence,
  position,
  publishedReview,
  witness,
  witnessEvidence,
} from "./knowledge-graph-fixtures";

function provenanceOf(
  editions: readonly unknown[] = [edition],
  artifacts: readonly unknown[] = [artifact],
  witnesses: readonly unknown[] = [witness],
) {
  return indexProvenance(
    editions.map((row) => SourceEditionSchema.parse(row)),
    artifacts.map((row) => SourceArtifactSchema.parse(row)),
    witnesses.map((row) => TextualWitnessSchema.parse(row)),
  );
}

const provenance = provenanceOf();

function fragmentOf(record: unknown, index = provenance) {
  const result = validateEvidence(record, index);
  if (!result.ok) throw new Error(`Fixture inválida: ${result.errors.join("; ")}`);
  return result.evidence;
}

function indexOf(records: readonly unknown[], index = provenance) {
  return indexEvidence(records.map((record) => fragmentOf(record, index)));
}

function errorsOf(result: { ok: boolean; errors?: readonly string[] }): string {
  return (result.errors ?? []).join(" | ");
}

/* ------------------------------------------------------- cadeia do testemunho */

describe("KNOWLEDGE-GRAPH-001 — cadeia do testemunho", () => {
  it("exige o testemunho no ramo que o declara obrigatório", () => {
    const result = validateEvidence({ ...witnessEvidence, witnessId: null }, provenance);
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("testemunho atestado");
  });

  it("recusa testemunho que não está no índice", () => {
    const result = validateEvidence({ ...witnessEvidence, witnessId: "wit-inexistente" }, provenance);
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("não está registrado");
  });

  it("recusa quando a edição que publica a leitura não está registrada", () => {
    // O caso que importa: o testemunho existe, mas o intermediário por onde sua
    // leitura é conhecida não. Sem ele, o registro sugere acesso direto ao
    // manuscrito.
    const orphan = { ...witness, publishedInEditionId: "ed-ausente-001" };
    const index = indexProvenance(
      [SourceEditionSchema.parse(edition)],
      [SourceArtifactSchema.parse(artifact)],
      [TextualWitnessSchema.parse(orphan)],
    );
    const result = validateEvidence(witnessEvidence, index);
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("não está registrada");
  });

  it("avisa, sem recusar, quando o ramo não documenta testemunho", () => {
    const result = validateEvidence({ ...philologyEvidence, witnessId: witness.id }, provenance);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.join(" | ")).toContain("não documenta testemunho");
    }
  });
});

/* ------------------------------------------------------------- retratação */

describe("KNOWLEDGE-GRAPH-001 — dependência de material retratado", () => {
  const retractedReview = {
    state: "retratado",
    author: "Equipe editorial",
    reviewer: { name: "Revisora responsável", human: true, affiliation: null },
    reviewedAt: "2026-11-24",
    note: "Retratada para teste de dependência.",
  } as const;

  const retracted = { ...philologyEvidence, id: "ev-retratada-001", review: retractedReview } as const;

  it("não deixa afirmação publicada depender de evidência retratada", () => {
    const result = validateClaim(
      {
        ...philologyClaim,
        evidenceLinks: [{ evidenceId: retracted.id, role: "apoia", rationale: "Apoio retratado." }],
      },
      { evidence: indexOf([retracted]), provenance },
    );
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("retratado");
  });

  it("não deixa posição publicada depender de interpretação retratada", () => {
    const retractedInterpretation = {
      ...interpretationEvidence,
      id: "ev-retratada-002",
      review: retractedReview,
    };
    const result = validateInterpretationPosition(
      { ...position, evidenceId: retractedInterpretation.id, claimId: null },
      { evidence: indexOf([retractedInterpretation]), provenance },
    );
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("retratado");
  });

  it("não deixa conexão publicada depender de evidência retratada", () => {
    const retractedLiterary = { ...literaryEvidence, id: "ev-retratada-003", review: retractedReview };
    const result = validatePassageConnection(
      { ...connection, evidenceId: retractedLiterary.id },
      indexOf([retractedLiterary]),
    );
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("retratado");
  });

  it("aceita a mesma dependência enquanto a afirmação é rascunho", () => {
    // A retratação impede publicar, não impede registrar o histórico.
    const result = validateClaim(
      {
        ...philologyClaim,
        review: { state: "rascunho", author: "Equipe editorial", reviewer: null, reviewedAt: null, note: null },
        evidenceLinks: [{ evidenceId: retracted.id, role: "apoia", rationale: "Apoio retratado." }],
      },
      { evidence: indexOf([retracted]), provenance },
    );
    expect(result.ok).toBe(true);
  });
});

/* ------------------------------------------------- connectionsFrom e anchorKey */

describe("KNOWLEDGE-GRAPH-001 — seleção de conexões por âncora", () => {
  const parse = (record: unknown) => PassageConnectionSchema.parse(record);

  const fromVerse = parse({ ...connection, id: "conn-ref-001", from: GEN_1_1, to: JHN_1_1 });
  const fromRange = parse({ ...connection, id: "conn-ref-002", from: GEN_1_1_5, to: JHN_1_1 });
  const bidirectional = parse({
    ...connection,
    id: "conn-ref-003",
    from: JHN_1_1,
    to: GEN_1_1,
    direction: "bidirecional",
    review: publishedReview,
  });
  const elsewhere = parse({ ...connection, id: "conn-ref-004", from: GEN_1_6, to: JHN_1_1 });

  const all = [fromVerse, fromRange, bidirectional, elsewhere];

  it("monta a mesma chave que `anchorKey`, que é o que a unificação pressupõe", () => {
    // A equivalência que a avaliação externa pediu antes de remover a
    // duplicação: a chave montada à mão coincidia com a canônica.
    for (const anchor of [GEN_1_1, GEN_1_1_5, GEN_1_3, GEN_1_6, JHN_1_1]) {
      const handBuilt = `${anchor.canon}/${anchor.versification}/${anchor.book} ${anchor.chapter}:${
        anchor.verseStart === anchor.verseEnd ? anchor.verseStart : `${anchor.verseStart}-${anchor.verseEnd}`
      }`;
      expect(anchorKey(anchor)).toBe(handBuilt);
    }
  });

  it("preserva o contrato de direção: `to` só conta em conexão bidirecional", () => {
    const selected = connectionsFrom(all, GEN_1_1).map((item) => item.id);
    expect(selected).toContain(fromVerse.id);
    // `bidirectional` chega a Gênesis 1:1 pela ponta `to`, e é bidirecional.
    expect(selected).toContain(bidirectional.id);
    // Unidirecional cuja ponta `to` é a consultada não entra.
    const oneWayInbound = parse({ ...connection, id: "conn-ref-005", from: JHN_1_1, to: GEN_1_1 });
    expect(connectionsFrom([oneWayInbound], GEN_1_1)).toEqual([]);
  });

  it("alcança a conexão de intervalo a partir de um versículo dele", () => {
    const selected = connectionsFrom(all, GEN_1_3).map((item) => item.id);
    expect(selected).toContain(fromRange.id);
    expect(selected).not.toContain(elsewhere.id);
  });

  it("não alcança conexão de outra passagem", () => {
    const selected = connectionsFrom(all, { ...GEN_1_1, chapter: 9 }).map((item) => item.id);
    expect(selected).toEqual([]);
  });
});
