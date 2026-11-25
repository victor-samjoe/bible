/**
 * Testes da camada de leitura da árvore (KNOWLEDGE-GRAPH-001, fila A2).
 *
 * O que se prova aqui é a fronteira: os contratos sabem **dizer** que um
 * registro está em rascunho; esta camada é a que não o serve. Sem este conjunto,
 * o estado de revisão seria um campo que todos gravam e ninguém consulta.
 *
 * O repositório é em memória de propósito. Não há migration autorizada para
 * estas tabelas, e a camada é pura: a porta injetada basta para provar recusa,
 * cobertura declarada e falha fechada.
 */

import { describe, expect, it } from "vitest";
import type { PassageAnchor } from "../../src/domain/knowledge-graph/anchors";
import {
  createKnowledgeGraphReader,
  parseKnowledgeGraphQuery,
  projectPassageTree,
  treeIsEmpty,
  type KnowledgeGraphRepository,
  type PassageBundleRows,
} from "../../src/server/knowledge-graph";
import {
  artifact,
  clearedRights,
  connection,
  draftReview,
  edition,
  emptyBundle,
  fullBundle,
  GEN_1_1,
  GEN_1_1_5,
  GEN_1_3,
  GEN_1_6,
  JHN_1_1,
  MIC_5_2_PT,
  philologyClaim,
  philologyEvidence,
  witness,
  witnessEvidence,
  work,
} from "../domain/knowledge-graph-fixtures";

function repositoryOf(rows: PassageBundleRows): KnowledgeGraphRepository {
  return { loadPassage: async () => rows };
}

function parsed(input: unknown) {
  const result = parseKnowledgeGraphQuery(input);
  if (!result) throw new Error("consulta inválida na fixture");
  return result;
}

describe("KNOWLEDGE-GRAPH-001 — consulta", () => {
  it("aceita âncora tipada e chave citável, e recusa o resto", () => {
    expect(parseKnowledgeGraphQuery({ anchor: GEN_1_1 })?.anchor.book).toBe("GEN");
    expect(parseKnowledgeGraphQuery({ anchorKey: "protestante/blivre-pt/GEN 1:1" })?.anchor.chapter).toBe(1);
    expect(parseKnowledgeGraphQuery({ anchorKey: "GEN 1:1" })).toBeNull();
    expect(parseKnowledgeGraphQuery({ anchor: { ...GEN_1_1, versification: "wlc-mt" } })).toBeNull();
    expect(parseKnowledgeGraphQuery({})).toBeNull();
    expect(parseKnowledgeGraphQuery(null)).toBeNull();
    expect(parseKnowledgeGraphQuery("GEN 1:1")).toBeNull();
  });

  it("trata filtro de ramos vazio como todos, e ramo inexistente como recusa", () => {
    expect(parseKnowledgeGraphQuery({ anchor: GEN_1_1 })?.branches).toEqual([]);
    expect(parseKnowledgeGraphQuery({ anchor: GEN_1_1, branches: ["filologia", "filologia"] })?.branches)
      .toEqual(["filologia"]);
    expect(parseKnowledgeGraphQuery({ anchor: GEN_1_1, branches: ["inventado"] })).toBeNull();
    expect(parseKnowledgeGraphQuery({ anchor: GEN_1_1, branches: "filologia" })).toBeNull();
  });
});

describe("KNOWLEDGE-GRAPH-001 — leitor falha fechada", () => {
  it("declara-se indisponível sem repositório", async () => {
    const reader = createKnowledgeGraphReader(null);
    expect(reader.available).toBe(false);
    expect(await reader.read({ anchor: GEN_1_1 })).toEqual({ ok: false, reason: "unavailable" });
  });

  it("recusa consulta malformada antes de tocar o repositório", async () => {
    let touched = false;
    const reader = createKnowledgeGraphReader({
      loadPassage: async () => {
        touched = true;
        return emptyBundle();
      },
    });
    expect(await reader.read({ anchorKey: "GEN 1:1" })).toEqual({ ok: false, reason: "invalid_query" });
    expect(touched).toBe(false);
  });

  it("devolve indisponível quando a porta falha, sem deixar a exceção subir", async () => {
    const reader = createKnowledgeGraphReader({
      loadPassage: async () => {
        throw new Error("falha simulada da porta");
      },
    });
    expect(await reader.read({ anchor: GEN_1_1 })).toEqual({ ok: false, reason: "unavailable" });
  });

  it("sobrevive a linhas ausentes ou de tipo errado", async () => {
    const reader = createKnowledgeGraphReader({
      loadPassage: async () => ({ evidence: "não é lista" } as unknown as PassageBundleRows),
    });
    const result = await reader.read({ anchor: GEN_1_1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_published");
  });

  it("distingue acervo sem cobertura de falha de infraestrutura", async () => {
    const reader = createKnowledgeGraphReader(repositoryOf(emptyBundle()));
    const result = await reader.read({ anchor: GEN_1_1 });
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "not_published") throw new Error("esperava not_published");
    // A árvore acompanha a recusa: o vazio é explicado, não apenas afirmado.
    expect(result.tree.coverage.publishedBranches).toEqual([]);
    expect(result.tree.coverage.emptyBranches).toHaveLength(10);
    expect(result.tree.reference).toBe("GEN 1:1");
  });
});

describe("KNOWLEDGE-GRAPH-001 — árvore publicada", () => {
  it("serve o conjunto completo e declara a cobertura", async () => {
    const reader = createKnowledgeGraphReader(repositoryOf(fullBundle()));
    const result = await reader.read({ anchor: GEN_1_1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tree = result.tree;

    expect(tree.anchorKey).toBe("protestante/blivre-pt/GEN 1:1");
    expect(tree.withheld).toEqual([]);
    expect(tree.coverage.publishedBranches).toEqual([
      "texto-testemunhos",
      "filologia",
      "literario",
      "arqueologia",
      "historia-interpretacao",
    ]);
    // Os ramos sem material continuam na resposta, declarados vazios: a lacuna
    // é informação, não algo a esconder.
    expect(tree.coverage.emptyBranches).toEqual(["critica-textual", "historico-social", "teologia", "cosmovisao", "recepcao"]);
    expect(tree.branches).toHaveLength(10);
    expect(tree.coverage.evidenceCount).toBe(5);
    expect(tree.coverage.claimCount).toBe(3);
  });

  it("monta a citação e a atribuição a partir dos registros, não de texto digitado", async () => {
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1, branches: ["filologia"] }), fullBundle());
    const card = tree.branches[0]?.evidence[0];
    expect(card).toBeDefined();
    expect(card?.citation).toBe("Autor de fixture, Obra de fixture para teste (Edição de fixture, 1900, 1900), s.v. fixture");
    expect(card?.locator).toBe("s.v. fixture");
    expect(card?.attribution).toBe(clearedRights.attribution);
    expect(card?.rightsStatus).toBe("dominio_publico");
    expect(card?.witnessSiglum).toBeNull();
  });

  it("identifica o testemunho atestado no ramo que o exige", () => {
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1, branches: ["texto-testemunhos"] }), fullBundle());
    expect(tree.branches[0]?.evidence[0]?.witnessSiglum).toBe("Fx");
  });

  it("rotula afirmação interpretativa como interpretação, e dado como dado", () => {
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), fullBundle());
    const sections = new Map(tree.branches.map((section) => [section.branch, section]));
    expect(sections.get("filologia")?.claims[0]?.interpretive).toBe(false);
    const interpretation = sections.get("historia-interpretacao")?.claims[0];
    expect(interpretation?.interpretive).toBe(true);
    expect(interpretation?.tradition).toBe("Tradição de fixture");
    expect(interpretation?.divergences).toHaveLength(1);
    expect(sections.get("historia-interpretacao")?.positions).toHaveLength(1);
  });

  it("expõe a conexão com relação tipada e direção", () => {
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), fullBundle());
    expect(tree.connections).toHaveLength(1);
    expect(tree.connections[0]).toMatchObject({
      id: connection.id,
      relation: "alude",
      direction: "unidirecional",
      toReference: "JHN 1:1",
      branch: "literario",
    });
  });

  it("restringe a resposta aos ramos pedidos", () => {
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1, branches: ["filologia", "teologia"] }), fullBundle());
    expect(tree.branches.map((section) => section.branch)).toEqual(["filologia", "teologia"]);
    expect(tree.coverage.publishedBranches).toEqual(["filologia"]);
    expect(tree.coverage.emptyBranches).toEqual(["teologia"]);
  });
});

describe("KNOWLEDGE-GRAPH-001 — o que a camada se recusa a servir", () => {
  it("não serve rascunho, e diz por quê", () => {
    const rows = fullBundle();
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...rows,
      evidence: rows.evidence.map((record) => ({ ...record, review: draftReview })),
      claims: rows.claims.map((record) => ({ ...record, review: draftReview })),
      positions: rows.positions.map((record) => ({ ...record, review: draftReview })),
      connections: rows.connections.map((record) => ({ ...record, review: draftReview })),
    });
    expect(treeIsEmpty(tree)).toBe(true);
    const evidenceWithheld = tree.withheld.filter((record) => record.kind === "evidence");
    expect(evidenceWithheld).toHaveLength(5);
    expect(evidenceWithheld.every((record) => record.reason === "nao_publicado")).toBe(true);
    expect(evidenceWithheld[0]?.details.join(" ")).toContain("rascunho");
  });

  it("não serve evidência cujos direitos não estão liberados", () => {
    const rows = fullBundle();
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...rows,
      editions: [{ ...edition, rights: { ...clearedRights, verifiedBy: null, verifiedAt: null } }],
    });
    expect(treeIsEmpty(tree)).toBe(true);
    const reasons = new Set(tree.withheld.filter((record) => record.kind === "evidence").map((record) => record.reason));
    // A validação cruzada já recusa o registro; o motivo precisa aparecer.
    expect(tree.withheld.map((record) => record.details.join(" ")).join(" "))
      .toContain("Registre quem conferiu os direitos");
    expect(reasons.size).toBe(1);
  });

  it("não alarga a árvore quando a porta devolve passagens vizinhas", () => {
    const rows = fullBundle();
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...rows,
      evidence: [...rows.evidence, { ...philologyEvidence, id: "ev-vizinho-001", anchors: [JHN_1_1] }],
      claims: [...rows.claims, { ...rows.claims[0], id: "claim-vizinho-001", anchors: [MIC_5_2_PT] }],
    });
    expect(tree.coverage.evidenceCount).toBe(5);
    const stray = tree.withheld.filter((record) => record.reason === "fora_da_passagem");
    expect(stray.map((record) => record.id).sort()).toEqual(["claim-vizinho-001", "ev-vizinho-001"]);
  });

  it("descarta registro inválido sem derrubar a passagem inteira", () => {
    const rows = fullBundle();
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...rows,
      // Evidência de testemunho sem testemunho identificado: o ramo exige um.
      evidence: rows.evidence.map((record) => (record.id === witnessEvidence.id ? { ...record, witnessId: null } : record)),
    });
    expect(tree.coverage.publishedBranches).toContain("filologia");
    expect(tree.coverage.emptyBranches).toContain("texto-testemunhos");
    const refused = tree.withheld.find((record) => record.id === witnessEvidence.id);
    expect(refused?.reason).toBe("invalido");
    expect(refused?.details.join(" ")).toContain("exige identificar o testemunho");
  });

  it("não deixa o relatório de recusa vazar o conteúdo recusado", () => {
    const rows = fullBundle();
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...rows,
      evidence: rows.evidence.map((record) => ({ ...record, review: draftReview })),
    });
    // Recusar e depois imprimir a citação no diagnóstico anularia a recusa.
    const serialized = JSON.stringify(tree.withheld);
    expect(serialized).not.toContain(witnessEvidence.content.quotation);
    expect(serialized).not.toContain("Resumo editorial de fixture");
    expect(serialized).toContain(witnessEvidence.id);
  });

  it("recusa afirmação publicada apoiada em evidência retida", () => {
    const rows = fullBundle();
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...rows,
      evidence: rows.evidence.map((record) =>
        record.id === philologyEvidence.id ? { ...record, review: draftReview } : record,
      ),
    });
    expect(tree.coverage.emptyBranches).toContain("filologia");
    const claimWithheld = tree.withheld.find((record) => record.kind === "claim");
    expect(claimWithheld?.reason).toBe("invalido");
    expect(claimWithheld?.details.join(" ")).toContain("não está registrada");
  });

  it("descarta proveniência inválida e o que depende dela", () => {
    const rows = fullBundle();
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), { ...rows, editions: [{ ...edition, rights: null }] });
    expect(treeIsEmpty(tree)).toBe(true);
    expect(tree.withheld.some((record) => record.kind === "edition" && record.reason === "invalido")).toBe(true);
  });
});

describe("KNOWLEDGE-GRAPH-001 — escala declarada no cartão", () => {
  /** Material de intervalo, alcançado por consulta a um versículo dele. */
  const rangeEvidence = { ...philologyEvidence, id: "ev-escala-001", anchors: [GEN_1_1_5] };
  const rangeClaim = {
    ...philologyClaim,
    id: "claim-escala-001",
    anchors: [GEN_1_1_5],
    evidenceLinks: [{ evidenceId: rangeEvidence.id, role: "apoia", rationale: "O verbete cobre o intervalo." }],
  };

  function treeAt(anchor: PassageAnchor) {
    return projectPassageTree(parsed({ anchor }), {
      ...emptyBundle(),
      works: [work],
      editions: [edition],
      artifacts: [artifact],
      witnesses: [witness],
      evidence: [rangeEvidence],
      claims: [rangeClaim],
    });
  }

  it("serve o registro de intervalo e declara que ele cobre mais que o versículo", () => {
    const tree = treeAt(GEN_1_3);
    const section = tree.branches.find((branch) => branch.branch === "filologia")!;
    expect(section.evidence).toHaveLength(1);
    expect(section.claims).toHaveLength(1);
    // A inclusão é por sobreposição; a honestidade é este campo.
    expect(section.evidence[0]!.scope.broaderThanQuery).toBe(true);
    expect(section.evidence[0]!.scope.keys).toEqual(["protestante/blivre-pt/GEN 1:1-5"]);
    expect(section.evidence[0]!.scope.reference).toContain("1:1-5");
    expect(section.claims[0]!.scope.broaderThanQuery).toBe(true);
    // E nada foi retido: não há recusa a explicar nesta consulta.
    expect(tree.withheld).toEqual([]);
  });

  it("não declara escala maior quando a consulta contém o registro", () => {
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1_5 }), {
      ...emptyBundle(),
      works: [work],
      editions: [edition],
      artifacts: [artifact],
      witnesses: [witness],
      evidence: [rangeEvidence],
      claims: [rangeClaim],
    });
    const section = tree.branches.find((branch) => branch.branch === "filologia")!;
    expect(section.evidence[0]!.scope.broaderThanQuery).toBe(false);
    expect(section.claims[0]!.scope.broaderThanQuery).toBe(false);
  });

  it("não serve o registro de intervalo fora dele, e diz por quê", () => {
    const tree = treeAt(GEN_1_6);
    const section = tree.branches.find((branch) => branch.branch === "filologia")!;
    expect(section.empty).toBe(true);
    expect(tree.withheld.map((record) => record.reason)).toContain("fora_da_passagem");
  });

  it("não acusa de inválida a afirmação cuja evidência é de intervalo", () => {
    // A regressão que a avaliação externa encontrou: a afirmação boa era
    // recusada como `invalido`, com "evidência não está registrada", porque o
    // índice havia sido montado por igualdade de chave.
    const tree = treeAt(GEN_1_3);
    const accusations = tree.withheld.filter((record) => record.kind === "claim");
    expect(accusations).toEqual([]);
    expect(JSON.stringify(tree.withheld)).not.toContain("não está registrada");
  });
});
