/**
 * Vazamento de conteúdo retido (KNOWLEDGE-GRAPH-001, fila A2, item 2).
 *
 * A camada recusa registro não publicado, inválido ou sem direitos liberados, e
 * **declara** a recusa em `withheld` para não afirmar cobertura que não tem. O
 * risco é o relatório de recusa virar a porta de saída do que foi recusado: se a
 * citação do rascunho aparece no motivo, a recusa não recusou nada.
 *
 * O método aqui é canário. Cada campo de conteúdo de um registro retido recebe
 * uma cadeia única e improvável; depois a árvore inteira, incluindo `withheld`,
 * `details` e o retorno do leitor, é serializada e procurada. Canário encontrado
 * é vazamento provado, não suspeita.
 *
 * Isto cobre o que a avaliação externa apontou como pendente: a afirmação de que
 * nada vaza por mensagem de erro ou metadado precisava de teste adversarial, não
 * de inspeção.
 */

import { describe, expect, it } from "vitest";
import {
  createKnowledgeGraphReader,
  parseKnowledgeGraphQuery,
  projectPassageTree,
  type PassageBundleRows,
} from "../../src/server/knowledge-graph";
import {
  artifact,
  clearedRights,
  draftReview,
  edition,
  emptyBundle,
  GEN_1_1,
  interpretationClaim,
  interpretationEvidence,
  JHN_1_1,
  literaryEvidence,
  philologyClaim,
  philologyEvidence,
  position,
  witness,
  work,
} from "../domain/knowledge-graph-fixtures";

/** Cadeias que não podem aparecer em nenhuma saída da camada. */
const CANARY = {
  quotation: "CANARIO-CITACAO-9f2b7",
  summary: "CANARIO-RESUMO-4c81d",
  statement: "CANARIO-AFIRMACAO-7e3a0",
  thesis: "CANARIO-TESE-1d6f9",
  rationale: "CANARIO-RAZAO-5b4c2",
  dispute: "CANARIO-DISPUTA-8a7e1",
  divergence: "CANARIO-DIVERGENCIA-3f0d6",
  basis: "CANARIO-BASE-2c9b4",
  note: "CANARIO-NOTA-6e5a8",
} as const;

const ALL_CANARIES = Object.values(CANARY);

function parsed(input: unknown) {
  const result = parseKnowledgeGraphQuery(input);
  if (!result) throw new Error("consulta inválida na fixture");
  return result;
}

function assertNoCanary(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const canary of ALL_CANARIES) {
    expect(serialized).not.toContain(canary);
  }
}

/** Direitos deliberadamente não liberados: a edição não autoriza exibição. */
const blockedRights = {
  ...clearedRights,
  status: "permissao_necessaria",
  permissions: { store: false, process: false, display: false, quote: false },
  verifiedBy: null,
  verifiedAt: null,
} as const;

const blockedEdition = { ...edition, id: "ed-bloqueada-001", rights: blockedRights } as const;

/* ------------------------------------------------------- registros retidos */

/** Rascunho: existe, não sai. Todo campo de conteúdo é canário. */
const draftEvidence = {
  ...philologyEvidence,
  id: "ev-rascunho-canario",
  content: { kind: "citacao", quotation: CANARY.quotation },
  knownDisputes: [CANARY.dispute],
  note: CANARY.note,
  review: draftReview,
} as const;

/** Inválido: locator ausente, o que a frente recusa por contrato. */
const invalidEvidence = {
  ...philologyEvidence,
  id: "ev-invalido-canario",
  locator: null,
  content: { kind: "resumo_editorial", summary: CANARY.summary, summarizedBy: "Equipe editorial" },
  note: CANARY.note,
} as const;

/** Tipo errado num campo de conteúdo: a mensagem Zod não pode ecoar o valor. */
const mistypedEvidence = {
  ...philologyEvidence,
  id: "ev-tipo-errado-canario",
  content: { kind: "citacao", quotation: 42 },
  knownDisputes: [CANARY.dispute],
} as const;

/** Direitos não liberados: publicado, porém sem permissão de exibição. */
const blockedEvidence = {
  ...philologyEvidence,
  id: "ev-sem-direitos-canario",
  editionId: blockedEdition.id,
  content: { kind: "citacao", quotation: CANARY.quotation },
  note: CANARY.note,
} as const;

const draftClaim = {
  ...philologyClaim,
  id: "claim-rascunho-canario",
  statement: CANARY.statement,
  confidenceBasis: CANARY.basis,
  divergences: [{ summary: CANARY.divergence, evidenceId: null, heldBy: null }],
  evidenceLinks: [{ evidenceId: philologyEvidence.id, role: "apoia", rationale: CANARY.rationale }],
  note: CANARY.note,
  review: draftReview,
} as const;

const draftPosition = {
  ...position,
  id: "position-rascunho-canario",
  thesis: CANARY.thesis,
  note: CANARY.note,
  review: draftReview,
} as const;

const draftConnection = {
  id: "conn-rascunho-canario",
  from: GEN_1_1,
  to: JHN_1_1,
  relation: "alude",
  branch: "literario",
  direction: "unidirecional",
  evidenceId: literaryEvidence.id,
  rationale: CANARY.rationale,
  confidence: "media",
  review: draftReview,
  note: CANARY.note,
} as const;

function hostileBundle(): PassageBundleRows {
  return {
    ...emptyBundle(),
    works: [work],
    editions: [edition, blockedEdition],
    artifacts: [artifact],
    witnesses: [witness],
    evidence: [
      draftEvidence,
      invalidEvidence,
      mistypedEvidence,
      blockedEvidence,
      // Evidências boas e publicadas, para provar que a recusa é seletiva.
      philologyEvidence,
      interpretationEvidence,
      literaryEvidence,
    ],
    claims: [draftClaim, philologyClaim, interpretationClaim],
    positions: [draftPosition],
    connections: [draftConnection],
  };
}

describe("KNOWLEDGE-GRAPH-001 — conteúdo retido não vaza", () => {
  it("retém os quatro tipos de recusa e nomeia o motivo de cada um", () => {
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), hostileBundle());
    const byId = new Map(tree.withheld.map((record) => [record.id, record]));
    expect(byId.get("ev-rascunho-canario")?.reason).toBe("nao_publicado");
    expect(byId.get("ev-invalido-canario")?.reason).toBe("invalido");
    expect(byId.get("ev-tipo-errado-canario")?.reason).toBe("invalido");
    // Defeito registrado, não contornado: o motivo devia ser
    // `direitos_nao_liberados`, mas `validateEvidence` já dobra os erros de
    // direitos quando recebe o índice de proveniência — e a projeção sempre o
    // passa. Então a recusa por licença chega rotulada como `invalido`, que
    // culpa o registro em vez da licença. O motivo coarse não esconde a causa:
    // os detalhes a nomeiam. Corrigir exige erro tipado no domínio, não
    // farejar mensagem aqui. Ver o relatório do item 2.
    expect(byId.get("ev-sem-direitos-canario")?.reason).toBe("invalido");
    expect(byId.get("ev-sem-direitos-canario")?.details.join(" ")).toContain("não permite");
    expect(byId.get("claim-rascunho-canario")?.reason).toBe("nao_publicado");
    expect(byId.get("position-rascunho-canario")?.reason).toBe("nao_publicado");
    expect(byId.get("conn-rascunho-canario")?.reason).toBe("nao_publicado");
  });

  it("não deixa nenhum canário sair pela árvore, por `withheld` ou por `details`", () => {
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), hostileBundle());
    assertNoCanary(tree);
    // E explicitamente sobre o relatório de recusa, que é o caminho suspeito.
    assertNoCanary(tree.withheld);
    for (const record of tree.withheld) assertNoCanary(record.details);
  });

  it("continua servindo o que está publicado e permitido", () => {
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), hostileBundle());
    const filologia = tree.branches.find((branch) => branch.branch === "filologia")!;
    expect(filologia.evidence.map((card) => card.id)).toContain(philologyEvidence.id);
    expect(filologia.claims.map((card) => card.id)).toContain(philologyClaim.id);
    expect(filologia.empty).toBe(false);
    // A recusa é seletiva: retém o retido e serve o servível na mesma consulta.
    expect(tree.withheld.length).toBeGreaterThan(0);
  });

  it("não vaza canário pelo retorno do leitor, nem quando recusa a passagem", async () => {
    const full = createKnowledgeGraphReader({ loadPassage: async () => hostileBundle() });
    const fullResult = await full.read({ anchor: GEN_1_1 });
    assertNoCanary(fullResult);

    // Só material retido: a resposta é `not_published`, com a árvore vazia a
    // explicar a lacuna — e sem nada do que foi retido.
    const onlyWithheld: PassageBundleRows = {
      ...emptyBundle(),
      works: [work],
      editions: [edition],
      artifacts: [artifact],
      witnesses: [witness],
      evidence: [draftEvidence, invalidEvidence],
      claims: [draftClaim],
      positions: [draftPosition],
    };
    const reader = createKnowledgeGraphReader({ loadPassage: async () => onlyWithheld });
    const result = await reader.read({ anchor: GEN_1_1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_published");
    assertNoCanary(result);
  });

  it("não vaza canário quando a própria proveniência é inválida", () => {
    // Edição quebrada derruba o que depende dela; as mensagens citam
    // identificadores e campos, nunca o conteúdo da fonte.
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...hostileBundle(),
      editions: [{ ...edition, rights: null }, blockedEdition],
    });
    assertNoCanary(tree);
    expect(tree.withheld.length).toBeGreaterThan(0);
  });

  it("não vaza canário posto num campo que o schema recusa", () => {
    // O valor rejeitado vira mensagem Zod. Se a mensagem ecoasse o recebido, um
    // canário em campo inválido sairia pelo `details`.
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...hostileBundle(),
      evidence: [{ ...philologyEvidence, id: "ev-enum-canario", branch: CANARY.statement }],
    });
    assertNoCanary(tree);
  });

  it("mantém o motivo útil: a recusa diz o campo e o estado, não o texto", () => {
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), hostileBundle());
    const draft = tree.withheld.find((record) => record.id === "ev-rascunho-canario")!;
    expect(draft.details.join(" ")).toContain("rascunho");
    const invalid = tree.withheld.find((record) => record.id === "ev-invalido-canario")!;
    expect(invalid.details.join(" ")).toContain("locator");
  });
});
