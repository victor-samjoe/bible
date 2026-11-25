/**
 * Passagem que atravessa capítulo (KNOWLEDGE-GRAPH-001, fila A2, item 4).
 *
 * O caso é Gênesis 1:31–2:3: o sétimo dia não cabe no capítulo 1, e a divisão
 * em capítulos é medieval, não original. Perícope que atravessa capítulo é
 * comum, então a pergunta é se o modelo a representa.
 *
 * O relatório anterior afirmou, na §9.3, que ela "não é representável". Isso
 * era verdade sobre **uma** âncora e enganoso sobre o modelo: evidência,
 * afirmação e posição guardam `anchors` como lista, de modo que a perícope é
 * representável hoje, como duas partes — e, com a política de sobreposição do
 * item 1, é alcançada ao consultar qualquer versículo de qualquer das partes.
 * É o que este arquivo prova.
 *
 * O que **não** está resolvido, e por que não foi inventado aqui:
 *
 * - `PassageConnection` tem `from` e `to` como âncora única, então conexão que
 *   parte de uma perícope entre capítulos não é representável. Mudar isso é
 *   mudança de contrato público.
 * - Nada declara que as partes formam **uma** extensão. Uma lista de duas
 *   âncoras é indistinguível de um registro sobre dois versículos sem relação.
 * - Contiguidade é **indecidível** com os dados do repositório: saber que 2:1
 *   vem logo depois de 1:31 exige a contagem de versículos por capítulo, que
 *   `anchors.ts` não tem e que depende da aprovação de versificação (C29).
 *   Inventar essa tabela seria inventar versificação.
 */

import { describe, expect, it } from "vitest";
import { projectPassageTree, parseKnowledgeGraphQuery, type PassageBundleRows } from "../../src/server/knowledge-graph";
import { compareAnchors, type PassageAnchor } from "../../src/domain/knowledge-graph/anchors";
import {
  artifact,
  edition,
  emptyBundle,
  GEN_1_1,
  philologyClaim,
  philologyEvidence,
  witness,
  work,
} from "../domain/knowledge-graph-fixtures";

/** Gênesis 1:31 — a primeira parte da perícope do sétimo dia. */
const GEN_1_31 = { ...GEN_1_1, chapter: 1, verseStart: 31, verseEnd: 31 } as const;
/** Gênesis 2:1–3 — a segunda parte, no capítulo seguinte. */
const GEN_2_1_3 = { ...GEN_1_1, chapter: 2, verseStart: 1, verseEnd: 3 } as const;
/** Um versículo de dentro da segunda parte. */
const GEN_2_2 = { ...GEN_1_1, chapter: 2, verseStart: 2, verseEnd: 2 } as const;
/** Fora da perícope, no mesmo capítulo da segunda parte. */
const GEN_2_7 = { ...GEN_1_1, chapter: 2, verseStart: 7, verseEnd: 7 } as const;

function parsed(input: unknown) {
  const result = parseKnowledgeGraphQuery(input);
  if (!result) throw new Error("consulta inválida na fixture");
  return result;
}

/** A perícope como duas partes, que é o que o modelo admite hoje. */
const pericopeEvidence = {
  ...philologyEvidence,
  id: "ev-pericope-001",
  anchors: [GEN_1_31, GEN_2_1_3],
} as const;

const pericopeClaim = {
  ...philologyClaim,
  id: "claim-pericope-001",
  anchors: [GEN_1_31, GEN_2_1_3],
  evidenceLinks: [{ evidenceId: pericopeEvidence.id, role: "apoia", rationale: "A evidência cobre a perícope." }],
} as const;

function bundle(): PassageBundleRows {
  return {
    ...emptyBundle(),
    works: [work],
    editions: [edition],
    artifacts: [artifact],
    witnesses: [witness],
    evidence: [pericopeEvidence],
    claims: [pericopeClaim],
  };
}

function treeAt(anchor: PassageAnchor) {
  return projectPassageTree(parsed({ anchor }), bundle());
}

function filologiaOf(tree: ReturnType<typeof treeAt>) {
  return tree.branches.find((branch) => branch.branch === "filologia")!;
}

describe("KNOWLEDGE-GRAPH-001 — perícope entre capítulos", () => {
  it("é representável como duas partes, sem mudar o tipo da âncora", () => {
    const section = filologiaOf(treeAt(GEN_1_31));
    expect(section.evidence).toHaveLength(1);
    expect(section.claims).toHaveLength(1);
  });

  it("é alcançada pelo primeiro capítulo e pelo segundo", () => {
    for (const anchor of [GEN_1_31, GEN_2_1_3, GEN_2_2]) {
      const section = filologiaOf(treeAt(anchor));
      expect(section.evidence.map((card) => card.id)).toContain(pericopeEvidence.id);
      expect(section.claims.map((card) => card.id)).toContain(pericopeClaim.id);
    }
  });

  it("declara as duas partes na escala, não só a do capítulo consultado", () => {
    // Mostrar apenas "GEN 1:31" numa consulta a 2:2 esconderia metade da
    // extensão e sugeriria que o registro fala só do capítulo 1.
    const card = filologiaOf(treeAt(GEN_2_2)).evidence[0]!;
    expect(card.scope.keys).toEqual([
      "protestante/blivre-pt/GEN 1:31",
      "protestante/blivre-pt/GEN 2:1-3",
    ]);
    expect(card.scope.reference).toBe("GEN 1:31; GEN 2:1-3");
    expect(card.scope.broaderThanQuery).toBe(true);
    // E diz qual parte a consulta tocou, sem esconder a outra.
    expect(card.scope.matched).toEqual(["protestante/blivre-pt/GEN 2:1-3"]);
  });

  it("não é alcançada por versículo fora dela, mesmo no capítulo vizinho", () => {
    const tree = treeAt(GEN_2_7);
    expect(filologiaOf(tree).empty).toBe(true);
    expect(tree.withheld.map((record) => record.reason)).toContain("fora_da_passagem");
  });

  it("ordena as partes na sequência do cânon, e não pela ordem de cadastro", () => {
    // A ordenação é o que permite montar um rótulo de extensão depois, quando
    // houver decisão sobre contiguidade.
    const shuffled = [GEN_2_1_3, GEN_1_31];
    const ordered = [...shuffled].sort(compareAnchors);
    expect(ordered[0]).toEqual(GEN_1_31);
    expect(ordered[1]).toEqual(GEN_2_1_3);
  });

  it("não inventa contiguidade: duas partes distantes seguem sendo duas partes", () => {
    // Sem a contagem de versículos por capítulo, nada aqui pode afirmar que as
    // partes se tocam. Então o modelo não afirma: ele enumera.
    const distant = {
      ...philologyEvidence,
      id: "ev-distante-001",
      anchors: [GEN_1_31, { ...GEN_1_1, chapter: 9, verseStart: 1, verseEnd: 1 }],
    };
    const tree = projectPassageTree(parsed({ anchor: GEN_1_31 }), { ...bundle(), evidence: [distant], claims: [] });
    const card = filologiaOf(tree).evidence[0]!;
    // A extensão é enumerada, com as duas partes visíveis, e `matched` diz que
    // só uma foi tocada. Enumerar não é afirmar contiguidade: quem lê vê duas
    // referências separadas por `;`, não um intervalo de 1:31 a 9:1.
    expect(card.scope.keys).toEqual([
      "protestante/blivre-pt/GEN 1:31",
      "protestante/blivre-pt/GEN 9:1",
    ]);
    expect(card.scope.matched).toEqual(["protestante/blivre-pt/GEN 1:31"]);
    expect(card.scope.reference).toBe("GEN 1:31; GEN 9:1");
  });
});
