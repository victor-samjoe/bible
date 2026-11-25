/**
 * Semântica de abrangência entre âncoras (KNOWLEDGE-GRAPH-001, fila A2, item 1).
 *
 * Reproduz a divergência apontada na avaliação externa (§9.5 de
 * `tasks/product/knowledge-graph-001-validacao.md`): a projeção filtrava
 * afirmações e posições por **sobreposição** e evidências por **igualdade de
 * chave**, de modo que material ancorado em Gênesis 1:1–5 não era alcançado ao
 * consultar Gênesis 1:3 — e, pior, a afirmação que dependia dele era acusada de
 * inválida, com a mensagem "evidência não está registrada", quando a evidência
 * existia e estava publicada.
 *
 * A política adotada e provada aqui:
 *
 * 1. **Sobreposição decide pertinência.** Material ancorado em um intervalo é
 *    alcançado por consulta a qualquer versículo desse intervalo. Esconder
 *    tornaria a âncora de intervalo inútil: ninguém consulta "1:1–5", consulta
 *    um versículo.
 * 2. **A escala fica visível.** Pertencer não é equivaler. O cartão carrega a
 *    própria âncora, para que evidência sobre 1:1–5 não seja lida como prova
 *    sobre o versículo 3 isoladamente.
 * 3. **Sistema diferente nunca se sobrepõe.** Cânon ou versificação distintos
 *    exigem ponte documentada; número igual não é passagem igual.
 */

import { describe, expect, it } from "vitest";
import {
  anchorContains,
  anchorKey,
  anchorsOverlap,
} from "../../src/domain/knowledge-graph/anchors";
import {
  indexEvidence,
  validateClaim,
  validateInterpretationPosition,
} from "../../src/domain/knowledge-graph/claims";
import { validatePassageConnection } from "../../src/domain/knowledge-graph/connections";
import {
  evidenceAnchoredAt,
  indexProvenance,
  validateEvidence,
} from "../../src/domain/knowledge-graph/evidence";
import {
  SourceArtifactSchema,
  SourceEditionSchema,
} from "../../src/domain/knowledge-graph/provenance";
import { TextualWitnessSchema } from "../../src/domain/knowledge-graph/witnesses";
import {
  artifact,
  connection,
  edition,
  GEN_1_1,
  GEN_1_1_5,
  GEN_1_3,
  GEN_1_6,
  interpretationClaim,
  interpretationEvidence,
  JHN_1_1,
  literaryEvidence,
  MIC_5_1_MT,
  philologyClaim,
  philologyEvidence,
  position,
  witness,
} from "./knowledge-graph-fixtures";

const provenance = indexProvenance(
  [SourceEditionSchema.parse(edition)],
  [SourceArtifactSchema.parse(artifact)],
  [TextualWitnessSchema.parse(witness)],
);

function fragmentOf(record: unknown) {
  const result = validateEvidence(record, provenance);
  if (!result.ok) throw new Error(`Fixture inválida: ${result.errors.join("; ")}`);
  return result.evidence;
}

function indexOf(...records: readonly unknown[]) {
  return indexEvidence(records.map((record) => fragmentOf(record)));
}

function errorsOf(result: { ok: boolean; errors?: readonly string[] }): string {
  return (result.errors ?? []).join(" | ");
}

/** Avisos do ramo bem-sucedido; falha se a validação recusou o registro. */
function warningsOf(result: { readonly ok: true; readonly warnings: readonly string[] } | { readonly ok: false; readonly errors: readonly string[] }): string {
  if (!result.ok) throw new Error(`Esperava validação aceita, veio: ${result.errors.join("; ")}`);
  return result.warnings.join(" | ");
}

/** Evidência de filologia cobrindo os cinco primeiros versículos. */
const rangeEvidence = { ...philologyEvidence, id: "ev-intervalo-001", anchors: [GEN_1_1_5] } as const;

/** Interpretação localizada na obra, cobrindo o mesmo intervalo. */
const rangeInterpretation = { ...interpretationEvidence, id: "ev-intervalo-002", anchors: [GEN_1_1_5] } as const;

/** Evidência literária cobrindo o intervalo, para a conexão. */
const rangeLiterary = { ...literaryEvidence, id: "ev-intervalo-003", anchors: [GEN_1_1_5] } as const;

/* ------------------------------------------------------------ predicados base */

describe("KNOWLEDGE-GRAPH-001 — predicados de abrangência", () => {
  it("separa sobreposição de continência, que não são a mesma pergunta", () => {
    // O versículo está dentro do intervalo: sobrepõe e está contido.
    expect(anchorsOverlap(GEN_1_1_5, GEN_1_3)).toBe(true);
    expect(anchorContains(GEN_1_1_5, GEN_1_3)).toBe(true);
    // O inverso não: o intervalo não cabe no versículo.
    expect(anchorContains(GEN_1_3, GEN_1_1_5)).toBe(false);
    expect(anchorsOverlap(GEN_1_3, GEN_1_1_5)).toBe(true);
  });

  it("inclui as extremidades e exclui o versículo seguinte", () => {
    expect(anchorsOverlap(GEN_1_1_5, GEN_1_1)).toBe(true);
    expect(anchorsOverlap(GEN_1_1_5, { ...GEN_1_1, verseStart: 5, verseEnd: 5 })).toBe(true);
    expect(anchorsOverlap(GEN_1_1_5, GEN_1_6)).toBe(false);
  });

  it("nunca sobrepõe entre livros, capítulos ou sistemas diferentes", () => {
    expect(anchorsOverlap(GEN_1_1_5, { ...GEN_1_3, book: "EXO" })).toBe(false);
    expect(anchorsOverlap(GEN_1_1_5, { ...GEN_1_3, chapter: 2 })).toBe(false);
    // Miqueias 5:1 hebraico tem número que existe em português, e não é a mesma
    // passagem. Sem ponte documentada, não há sobreposição a declarar.
    expect(anchorsOverlap({ ...GEN_1_1_5, book: "MIC", chapter: 5 }, MIC_5_1_MT)).toBe(false);
  });

  it("alcança o fragmento de intervalo a partir de um versículo dele", () => {
    const fragment = fragmentOf(rangeEvidence);
    // A regressão: isto era `false`, porque a comparação era de chave exata.
    expect(evidenceAnchoredAt(fragment, GEN_1_3)).toBe(true);
    expect(evidenceAnchoredAt(fragment, GEN_1_1)).toBe(true);
    expect(evidenceAnchoredAt(fragment, GEN_1_6)).toBe(false);
    expect(anchorKey(fragment.anchors[0]!)).toBe("protestante/blivre-pt/GEN 1:1-5");
  });
});

/* ------------------------------------------------- dependências no domínio */

describe("KNOWLEDGE-GRAPH-001 — dependências entre escalas", () => {
  it("aceita afirmação de versículo apoiada em evidência de intervalo", () => {
    const claim = {
      ...philologyClaim,
      id: "claim-intervalo-001",
      anchors: [GEN_1_3],
      evidenceLinks: [{ evidenceId: rangeEvidence.id, role: "apoia", rationale: "O verbete cobre o intervalo." }],
    };
    const result = validateClaim(claim, { evidence: indexOf(rangeEvidence), provenance });
    expect(result.ok).toBe(true);
    // E sem aviso de desancoragem: a evidência cobre a passagem da afirmação.
    expect(warningsOf(result)).not.toContain("não está ancorada");
  });

  it("ainda avisa quando a evidência é de passagem de fato paralela", () => {
    const claim = {
      ...philologyClaim,
      id: "claim-intervalo-002",
      anchors: [GEN_1_6],
      evidenceLinks: [{ evidenceId: rangeEvidence.id, role: "apoia", rationale: "Paralelo declarado." }],
    };
    const result = validateClaim(claim, { evidence: indexOf(rangeEvidence), provenance });
    expect(result.ok).toBe(true);
    expect(warningsOf(result)).toContain("não está ancorada");
  });

  it("aceita posição de versículo apoiada em interpretação de intervalo", () => {
    // Antes isto era **erro**: "a evidência não está ancorada na passagem desta
    // posição". Recusava dado legítimo por política de comparação, não por
    // defeito do registro.
    const result = validateInterpretationPosition(
      { ...position, id: "position-intervalo-001", anchors: [GEN_1_3], evidenceId: rangeInterpretation.id, claimId: null },
      { evidence: indexOf(rangeInterpretation), provenance },
    );
    expect(result.ok).toBe(true);
    expect(errorsOf(result)).not.toContain("não está ancorada");
  });

  it("recusa posição cuja evidência não toca a passagem", () => {
    const result = validateInterpretationPosition(
      { ...position, id: "position-intervalo-002", anchors: [GEN_1_6], evidenceId: rangeInterpretation.id, claimId: null },
      { evidence: indexOf(rangeInterpretation), provenance },
    );
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("não está ancorada");
  });

  it("aceita conexão cuja evidência cobre o intervalo de partida", () => {
    const result = validatePassageConnection(
      { ...connection, id: "conn-intervalo-001", from: GEN_1_3, evidenceId: rangeLiterary.id },
      indexOf(rangeLiterary),
    );
    expect(result.ok).toBe(true);
    expect(errorsOf(result)).not.toContain("não está ancorada");
  });

  it("recusa conexão cuja evidência não toca nenhuma das duas pontas", () => {
    const result = validatePassageConnection(
      { ...connection, id: "conn-intervalo-002", from: GEN_1_6, to: JHN_1_1, evidenceId: rangeLiterary.id },
      indexOf(rangeLiterary),
    );
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("não está ancorada");
  });

  it("não cruza sistema de versificação sem ponte, nem na dependência", () => {
    const result = validateInterpretationPosition(
      { ...position, id: "position-intervalo-003", anchors: [MIC_5_1_MT], evidenceId: rangeInterpretation.id, claimId: null },
      { evidence: indexOf(rangeInterpretation), provenance },
    );
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("não está ancorada");
  });

  it("mantém a afirmação de intervalo apoiada em evidência do mesmo intervalo", () => {
    // Guarda contra correção que troque a direção da comparação: o caso simples
    // de escalas iguais tem de continuar valendo.
    const result = validateClaim(
      {
        ...interpretationClaim,
        id: "claim-intervalo-003",
        anchors: [GEN_1_1_5],
        evidenceLinks: [{ evidenceId: rangeInterpretation.id, role: "interpreta", rationale: "Mesma escala." }],
      },
      { evidence: indexOf(rangeInterpretation), provenance },
    );
    expect(result.ok).toBe(true);
  });
});
