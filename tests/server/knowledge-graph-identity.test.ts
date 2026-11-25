/**
 * Identidade de fonte e testemunho (KNOWLEDGE-GRAPH-001, fila A2, item 3).
 *
 * Todo índice da frente é montado com `new Map(lista.map(...))`, e nessa
 * construção **o último vence em silêncio**. Se duas edições chegam com o mesmo
 * identificador — importação repetida, junção malfeita, duas linhas de um banco
 * sem restrição de unicidade —, a que vier depois substitui a anterior sem
 * aviso. Entre uma edição em domínio público e outra que exige permissão, a
 * ordem das linhas passa a decidir se o conteúdo é exibido.
 *
 * Isso não é ruído de implementação: é troca de identidade de fonte. Uma
 * citação pode acabar atribuída à edição errada, com a licença errada, e a
 * árvore não teria como notar.
 *
 * A política provada aqui é **falhar fechado**: identificador repetido derruba
 * todos os registros que o disputam, e a recusa é declarada. Na dúvida sobre
 * qual é a fonte, não se serve nenhuma — servir a errada é pior que não servir.
 */

import { describe, expect, it } from "vitest";
import {
  createKnowledgeGraphReader,
  projectPassageTree,
  parseKnowledgeGraphQuery,
  type PassageBundleRows,
} from "../../src/server/knowledge-graph";
import {
  artifact,
  clearedRights,
  edition,
  emptyBundle,
  GEN_1_1,
  philologyClaim,
  philologyEvidence,
  witness,
  witnessEvidence,
  work,
} from "../domain/knowledge-graph-fixtures";

function parsed(input: unknown) {
  const result = parseKnowledgeGraphQuery(input);
  if (!result) throw new Error("consulta inválida na fixture");
  return result;
}

function baseBundle(): PassageBundleRows {
  return {
    ...emptyBundle(),
    works: [work],
    editions: [edition],
    artifacts: [artifact],
    witnesses: [witness],
    evidence: [philologyEvidence],
    claims: [philologyClaim],
  };
}

/** Mesma edição, licença oposta: a diferença que a troca silenciosa esconderia. */
const impostorEdition = {
  ...edition,
  label: "Edição impostora, 1900",
  rights: {
    ...clearedRights,
    status: "permissao_necessaria",
    permissions: { store: false, process: false, display: false, quote: false },
    verifiedBy: null,
    verifiedAt: null,
  },
} as const;

describe("KNOWLEDGE-GRAPH-001 — identificador disputado", () => {
  it("recusa a edição quando dois registros disputam o mesmo identificador", () => {
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...baseBundle(),
      editions: [edition, impostorEdition],
    });
    const disputed = tree.withheld.filter((record) => record.kind === "edition");
    expect(disputed.length).toBeGreaterThan(0);
    expect(disputed[0]!.id).toBe(edition.id);
    expect(disputed[0]!.details.join(" ")).toContain("duplicado");
  });

  it("não serve conteúdo que dependa de identidade disputada", () => {
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...baseBundle(),
      editions: [edition, impostorEdition],
    });
    // A evidência existe e está publicada, mas a edição dela ficou indefinida.
    const filologia = tree.branches.find((branch) => branch.branch === "filologia")!;
    expect(filologia.evidence).toEqual([]);
    expect(filologia.empty).toBe(true);
  });

  it("não deixa a ordem das linhas decidir a licença", () => {
    const direct = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...baseBundle(),
      editions: [edition, impostorEdition],
    });
    const reversed = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...baseBundle(),
      editions: [impostorEdition, edition],
    });
    // A prova do "falha fechado": inverter a ordem não muda o resultado.
    const evidenceOf = (tree: typeof direct) =>
      tree.branches.flatMap((branch) => branch.evidence.map((card) => card.id));
    expect(evidenceOf(direct)).toEqual(evidenceOf(reversed));
    expect(evidenceOf(direct)).toEqual([]);
  });

  it("recusa testemunho de identidade disputada", () => {
    const impostorWitness = { ...witness, siglum: "Zz", label: "Testemunho impostor" } as const;
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...baseBundle(),
      witnesses: [witness, impostorWitness],
      evidence: [witnessEvidence],
    });
    const disputed = tree.withheld.filter((record) => record.kind === "witness");
    expect(disputed.length).toBeGreaterThan(0);
    expect(disputed[0]!.details.join(" ")).toContain("duplicado");
    // E a evidência que o atesta não é servida com o testemunho errado.
    const textual = tree.branches.find((branch) => branch.branch === "texto-testemunhos")!;
    expect(textual.evidence).toEqual([]);
  });

  it("recusa evidência de identidade disputada sem escolher uma delas", () => {
    const impostorEvidence = {
      ...philologyEvidence,
      locator: { kind: "verbete", headword: "impostor", sense: null },
    } as const;
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), {
      ...baseBundle(),
      evidence: [philologyEvidence, impostorEvidence],
    });
    const disputed = tree.withheld.filter(
      (record) => record.kind === "evidence" && record.details.join(" ").includes("duplicado"),
    );
    expect(disputed.length).toBeGreaterThan(0);
    const filologia = tree.branches.find((branch) => branch.branch === "filologia")!;
    expect(filologia.evidence).toEqual([]);
  });

  it("mantém a árvore intacta quando não há disputa", () => {
    const tree = projectPassageTree(parsed({ anchor: GEN_1_1 }), baseBundle());
    const filologia = tree.branches.find((branch) => branch.branch === "filologia")!;
    expect(filologia.evidence).toHaveLength(1);
    expect(tree.withheld.filter((record) => record.details.join(" ").includes("duplicado"))).toEqual([]);
  });

  it("o leitor recusa a passagem quando a disputa esvazia o acervo", async () => {
    const reader = createKnowledgeGraphReader({
      loadPassage: async () => ({ ...baseBundle(), editions: [edition, impostorEdition] }),
    });
    const result = await reader.read({ anchor: GEN_1_1 });
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "not_published") {
      // A lacuna é explicada, não escondida.
      expect(result.tree.withheld.some((record) => record.details.join(" ").includes("duplicado"))).toBe(true);
    } else {
      throw new Error("esperava recusa por não publicado, com a árvore anexada");
    }
  });
});
