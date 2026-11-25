/**
 * Ontologia dos ramos e das relações (KNOWLEDGE-GRAPH-001, fila A2).
 * Transcreve em contrato a tabela de `docs/VERSE_KNOWLEDGE_GRAPH.md` §2.
 *
 * Os ramos são **perspectivas, não silos**: a mesma evidência pode sustentar
 * afirmações em mais de um ramo. O que o contrato impede é a confusão de
 * categoria que a própria tabela nomeia — doutrina apresentada como análise
 * gramatical, reconstrução especulativa sem grau de confiança, lista de nomes
 * sem localizar a interpretação na obra, uso posterior tratado como sentido
 * original.
 *
 * Por isso cada ramo declara três coisas verificáveis por código:
 *
 * - `claimTypes`: que **tipo de afirmação** pode nascer nele. Uma afirmação
 *   teológica não entra como `dado_filologico`, e é esse deslize que faz
 *   doutrina parecer dado de língua.
 * - `relations`: que relações tipadas fazem sentido ali.
 * - `obligations`: o que o ramo exige **além** de fonte e localização —
 *   testemunho identificado, tradição declarada, grau de confiança explícito,
 *   cadeia de proveniência do objeto.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco.
 */

import { z } from "zod";

export const BRANCH_IDS = [
  "texto-testemunhos",
  "filologia",
  "critica-textual",
  "literario",
  "historico-social",
  "arqueologia",
  "historia-interpretacao",
  "teologia",
  "cosmovisao",
  "recepcao",
] as const;

export type BranchId = (typeof BRANCH_IDS)[number];
export const branchId = z.enum(BRANCH_IDS);

/**
 * Relações tipadas. A lista é fechada: relação em texto livre volta a permitir
 * que "relacionado a" signifique qualquer coisa, e era disso que a árvore
 * precisava escapar.
 */
export const RELATION_IDS = [
  "traduz",
  "cita",
  "interpreta",
  "apoia",
  "contesta",
  "contextualiza",
  "alude",
  "recebe",
  "aplica",
] as const;

export type RelationId = (typeof RELATION_IDS)[number];
export const relationId = z.enum(RELATION_IDS);

/**
 * Tipos de afirmação. A separação entre observação, dado filológico,
 * reconstrução, interpretação, doutrina e uso posterior é o eixo inteiro do
 * produto: é o que permite mostrar lado a lado sem fingir que têm o mesmo peso
 * epistêmico.
 */
export const CLAIM_TYPES = [
  "observacao",
  "dado_filologico",
  "leitura_variante",
  "analise_literaria",
  "reconstrucao_historica",
  "evidencia_material",
  "posicao_interpretativa",
  "afirmacao_teologica",
  "descricao_cosmovisao",
  "uso_posterior",
  "aplicacao",
] as const;

export type ClaimType = (typeof CLAIM_TYPES)[number];
export const claimType = z.enum(CLAIM_TYPES);

export type BranchObligations = {
  /** Exige testemunho textual identificado (manuscrito, edição, versão, citação). */
  readonly requiresWitness: boolean;
  /** Exige tradição/escola declarada, para não apresentar uma leitura como neutra. */
  readonly requiresTradition: boolean;
  /** Exige grau de confiança explícito, porque a afirmação é reconstrução. */
  readonly requiresConfidenceGrade: boolean;
  /** Exige cadeia de proveniência do objeto material. */
  readonly requiresProvenanceChain: boolean;
  /** Exige localização da interpretação dentro da obra citada. */
  readonly requiresWorkLocalization: boolean;
};

export type BranchDefinition = {
  readonly id: BranchId;
  readonly label: string;
  readonly question: string;
  /** O que pode entrar no ramo. */
  readonly admits: readonly string[];
  /** O que não pode ser confundido com ele. */
  readonly notToBeConfusedWith: readonly string[];
  readonly claimTypes: readonly ClaimType[];
  readonly relations: readonly RelationId[];
  readonly obligations: BranchObligations;
};

const NO_OBLIGATIONS: BranchObligations = {
  requiresWitness: false,
  requiresTradition: false,
  requiresConfidenceGrade: false,
  requiresProvenanceChain: false,
  requiresWorkLocalization: false,
};

export const BRANCHES: readonly BranchDefinition[] = [
  {
    id: "texto-testemunhos",
    label: "Texto e testemunhos",
    question: "O que cada edição ou testemunho traz?",
    admits: ["hebraico", "grego", "Vulgata latina", "traduções históricas", "variantes com edição e aparato"],
    notToBeConfusedWith: ["tradução moderna, glossa ou paráfrase sem identificação"],
    claimTypes: ["observacao", "leitura_variante"],
    relations: ["traduz", "cita", "contesta"],
    obligations: { ...NO_OBLIGATIONS, requiresWitness: true },
  },
  {
    id: "filologia",
    label: "Filologia",
    question: "Como a língua funciona aqui?",
    admits: ["token", "lema", "morfologia", "sintaxe", "semântica", "tradução possível, sempre com fonte"],
    notToBeConfusedWith: ["definição produzida por IA apresentada como léxico"],
    claimTypes: ["dado_filologico", "observacao"],
    relations: ["traduz", "cita", "apoia", "contesta"],
    obligations: NO_OBLIGATIONS,
  },
  {
    id: "critica-textual",
    label: "Crítica textual",
    question: "Que variantes existem e por quê?",
    admits: ["manuscrito", "família", "leitura", "aparato", "datação", "decisão editorial"],
    notToBeConfusedWith: ["dizer que o original dizia algo sem evidência disponível"],
    claimTypes: ["leitura_variante", "observacao"],
    relations: ["cita", "apoia", "contesta"],
    obligations: { ...NO_OBLIGATIONS, requiresWitness: true, requiresConfidenceGrade: true },
  },
  {
    id: "literario",
    label: "Análise literária",
    question: "Como o texto comunica?",
    admits: ["gênero", "estrutura", "discurso", "paralelismo", "narrativa", "intertextualidade"],
    notToBeConfusedWith: ["contexto histórico ou doutrina disfarçados de análise gramatical"],
    claimTypes: ["analise_literaria", "observacao"],
    relations: ["cita", "alude", "apoia", "contesta", "contextualiza"],
    obligations: NO_OBLIGATIONS,
  },
  {
    id: "historico-social",
    label: "Contexto histórico-social",
    question: "Em que mundo o texto foi produzido e recebido?",
    admits: ["cronologia", "geografia", "instituições", "práticas", "economia", "relações sociais"],
    notToBeConfusedWith: ["reconstrução especulativa sem grau de confiança"],
    claimTypes: ["reconstrucao_historica", "observacao"],
    relations: ["contextualiza", "cita", "apoia", "contesta"],
    obligations: { ...NO_OBLIGATIONS, requiresConfidenceGrade: true },
  },
  {
    id: "arqueologia",
    label: "Arqueologia e cultura material",
    question: "Que evidência material se relaciona?",
    admits: ["sítio", "objeto", "inscrição", "datação", "relatório", "proveniência", "disputa acadêmica"],
    notToBeConfusedWith: ["artefato sem cadeia de proveniência", "alegação apologética automática"],
    claimTypes: ["evidencia_material", "reconstrucao_historica", "observacao"],
    relations: ["contextualiza", "apoia", "contesta", "cita"],
    obligations: { ...NO_OBLIGATIONS, requiresConfidenceGrade: true, requiresProvenanceChain: true },
  },
  {
    id: "historia-interpretacao",
    label: "História da interpretação",
    question: "Quem interpretou e como?",
    admits: ["autor", "obra", "data", "tradição", "trecho citado", "tese interpretativa", "fonte primária ou secundária"],
    notToBeConfusedWith: ["lista de nomes sem localizar a interpretação na obra"],
    claimTypes: ["posicao_interpretativa", "observacao"],
    relations: ["interpreta", "cita", "contesta", "apoia"],
    obligations: { ...NO_OBLIGATIONS, requiresTradition: true, requiresWorkLocalization: true },
  },
  {
    id: "teologia",
    label: "Teologia",
    question: "Que afirmações doutrinárias foram construídas?",
    admits: ["tema", "tradição", "confissão", "convergências", "divergências", "desenvolvimento histórico"],
    notToBeConfusedWith: ["apresentar uma tradição como leitura neutra ou única"],
    claimTypes: ["afirmacao_teologica", "observacao"],
    relations: ["interpreta", "apoia", "contesta", "cita"],
    obligations: { ...NO_OBLIGATIONS, requiresTradition: true },
  },
  {
    id: "cosmovisao",
    label: "Cosmovisão",
    question: "Que pressupostos sobre realidade, pessoa e conhecimento aparecem?",
    admits: ["criação", "humanidade", "poder", "ética", "natureza", "transcendência", "comunidade"],
    notToBeConfusedWith: ["estereótipo cultural", "aplicação contemporânea sem mediação histórica"],
    claimTypes: ["descricao_cosmovisao", "observacao"],
    relations: ["contextualiza", "interpreta", "cita", "contesta"],
    obligations: { ...NO_OBLIGATIONS, requiresTradition: true, requiresConfidenceGrade: true },
  },
  {
    id: "recepcao",
    label: "Recepção e aplicação",
    question: "Como o texto foi usado depois?",
    admits: ["liturgia", "arte", "política", "pastoral", "ética", "aplicação contemporânea identificada"],
    notToBeConfusedWith: ["tratar uso posterior como sentido original do texto"],
    claimTypes: ["uso_posterior", "aplicacao", "observacao"],
    relations: ["recebe", "aplica", "cita", "alude"],
    obligations: NO_OBLIGATIONS,
  },
];

const BRANCH_BY_ID: ReadonlyMap<BranchId, BranchDefinition> = new Map(BRANCHES.map((branch) => [branch.id, branch]));

export function branchDefinition(id: BranchId): BranchDefinition {
  const found = BRANCH_BY_ID.get(id);
  if (!found) throw new Error(`Ramo desconhecido: ${id}`);
  return found;
}

export function claimTypeAllowedIn(branch: BranchId, type: ClaimType): boolean {
  return branchDefinition(branch).claimTypes.includes(type);
}

export function relationAllowedIn(branch: BranchId, relation: RelationId): boolean {
  return branchDefinition(branch).relations.includes(relation);
}

/** Ramos em que a afirmação declarada é reconstrução, e não leitura direta. */
export function requiresConfidenceGrade(branch: BranchId): boolean {
  return branchDefinition(branch).obligations.requiresConfidenceGrade;
}

/**
 * Tipos de afirmação que não podem ser apresentados como dado. Usado pela
 * camada de leitura para rotular, e pela validação para exigir tradição.
 */
export const INTERPRETIVE_CLAIM_TYPES: readonly ClaimType[] = [
  "posicao_interpretativa",
  "afirmacao_teologica",
  "descricao_cosmovisao",
  "aplicacao",
];

export function isInterpretive(type: ClaimType): boolean {
  return INTERPRETIVE_CLAIM_TYPES.includes(type);
}
