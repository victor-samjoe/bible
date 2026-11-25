/**
 * Fixtures da árvore de conhecimento (KNOWLEDGE-GRAPH-001, fila A2).
 *
 * Um conjunto coerente e **publicável**: obra, edição com direitos conferidos,
 * ativo com hash, testemunho ligado à edição que informa sua leitura, evidência
 * em quatro ramos, afirmações, posição interpretativa e conexão. Os testes
 * partem daqui e estragam **um** campo por vez, que é a única forma de provar
 * que a recusa veio da regra em exame e não de outra ausência qualquer.
 *
 * Não é corpus: nenhum texto bíblico, aparato ou tradução real entra aqui. As
 * citações são curtas, inventadas para o teste e marcadas como tal.
 */

/* ------------------------------------------------------------------- âncoras */

export const GEN_1_1 = {
  canon: "protestante",
  versification: "blivre-pt",
  book: "GEN",
  chapter: 1,
  verseStart: 1,
  verseEnd: 1,
} as const;

export const JHN_1_1 = {
  canon: "protestante",
  versification: "blivre-pt",
  book: "JHN",
  chapter: 1,
  verseStart: 1,
  verseEnd: 1,
} as const;

/**
 * Âncoras de intervalo, para a semântica de abrangência.
 *
 * `GEN_1_1_5` cobre cinco versículos; `GEN_1_3` é um deles. O par existe porque
 * a pergunta "o que vale para a passagem?" não tem a mesma resposta que "o que
 * vale para este versículo?", e o acervo guarda material nas duas escalas.
 */
export const GEN_1_1_5 = {
  canon: "protestante",
  versification: "blivre-pt",
  book: "GEN",
  chapter: 1,
  verseStart: 1,
  verseEnd: 5,
} as const;

export const GEN_1_3 = {
  canon: "protestante",
  versification: "blivre-pt",
  book: "GEN",
  chapter: 1,
  verseStart: 3,
  verseEnd: 3,
} as const;

export const GEN_1_6 = {
  canon: "protestante",
  versification: "blivre-pt",
  book: "GEN",
  chapter: 1,
  verseStart: 6,
  verseEnd: 6,
} as const;

/** Miqueias 5:2 em português é 5:1 na numeração hebraica. */
export const MIC_5_2_PT = {
  canon: "protestante",
  versification: "blivre-pt",
  book: "MIC",
  chapter: 5,
  verseStart: 2,
  verseEnd: 2,
} as const;

export const MIC_5_1_MT = {
  canon: "tanak",
  versification: "wlc-mt",
  book: "MIC",
  chapter: 5,
  verseStart: 1,
  verseEnd: 1,
} as const;

/* -------------------------------------------------------------- revisão */

export const draftReview = {
  state: "rascunho",
  author: "Equipe editorial",
  reviewer: null,
  reviewedAt: null,
  note: null,
} as const;

export const publishedReview = {
  state: "publicado",
  author: "Equipe editorial",
  reviewer: { name: "Revisora responsável", human: true, affiliation: null },
  reviewedAt: "2026-11-24",
  note: null,
} as const;

/* ---------------------------------------------------------------- direitos */

export const clearedRights = {
  status: "dominio_publico",
  attribution: "Fixture de teste — domínio público",
  permissions: { store: true, process: true, display: true, quote: true },
  quoteLimitChars: 500,
  licenseUrl: "https://example.org/licenca",
  verifiedBy: "Equipe editorial",
  verifiedAt: "2026-11-24",
  note: null,
} as const;

/* ----------------------------------------------------------- proveniência */

export const work = {
  id: "work-fixture-001",
  title: "Obra de fixture para teste",
  authorship: [{ name: "Autor de fixture", role: "autor", note: null }],
  tier: "primaria",
  originalLanguage: "lat",
  dateExpression: "fim do séc. IV",
  dateEarliest: 380,
  dateLatest: 400,
  tradition: "Tradição de fixture",
  note: null,
} as const;

export const edition = {
  id: "ed-fixture-001",
  workId: work.id,
  label: "Edição de fixture, 1900",
  language: "lat",
  responsibility: [],
  year: 1900,
  availability: { kind: "digital", identifier: "https://example.org/edicao", accessedAt: "2026-11-24" },
  rights: clearedRights,
  note: null,
} as const;

export const artifact = {
  id: "art-fixture-001",
  editionId: edition.id,
  localPath: "data/fixtures/knowledge-graph/edicao.txt",
  sha256: "0".repeat(64),
  byteLength: 1024,
  mediaType: "text/plain",
  retrievedFrom: "https://example.org/edicao.txt",
  retrievedAt: "2026-11-24",
  note: null,
} as const;

export const witness = {
  id: "wit-fixture-001",
  siglum: "Fx",
  label: "Testemunho de fixture",
  kind: "manuscrito",
  language: "lat",
  script: "uncial",
  dateExpression: "séc. V",
  dateEarliest: 400,
  dateLatest: 499,
  holding: { institution: "Acervo de fixture", shelfmark: "Fx. 1", city: null },
  publishedInEditionId: edition.id,
  note: null,
} as const;

/* ---------------------------------------------------------------- evidência */

/** Ramo sem obrigações extras: serve de base para quase todos os testes. */
export const philologyEvidence = {
  id: "ev-filologia-001",
  branch: "filologia",
  anchors: [GEN_1_1],
  editionId: edition.id,
  artifactId: null,
  witnessId: null,
  locator: { kind: "verbete", headword: "fixture", sense: null },
  language: "hbo",
  tier: "primaria",
  content: { kind: "resumo_editorial", summary: "Resumo editorial de fixture.", summarizedBy: "Equipe editorial" },
  origin: "entrada_do_operador",
  collectedBy: "Equipe editorial",
  collectedAt: "2026-11-24",
  confidence: "alta",
  knownDisputes: [],
  materialProvenance: null,
  review: publishedReview,
  note: null,
} as const;

/** Ramo que exige testemunho identificado. */
export const witnessEvidence = {
  ...philologyEvidence,
  id: "ev-testemunho-001",
  branch: "texto-testemunhos",
  witnessId: witness.id,
  locator: { kind: "aparato", entry: "ad 1,1 a", apparatus: "Aparato de fixture" },
  language: "lat",
  content: { kind: "citacao", quotation: "Citação curta de fixture." },
} as const;

/** Ramo que exige localizar a interpretação dentro da obra. */
export const interpretationEvidence = {
  ...philologyEvidence,
  id: "ev-interpretacao-001",
  branch: "historia-interpretacao",
  locator: { kind: "pagina", page: "42", pageEnd: null, volume: null },
  language: "lat",
  content: { kind: "citacao", quotation: "Tese de fixture, localizada na página." },
} as const;

export const literaryEvidence = {
  ...philologyEvidence,
  id: "ev-literario-001",
  branch: "literario",
  locator: { kind: "secao", path: "II.3", heading: null },
  language: "pt-BR",
  content: { kind: "resumo_editorial", summary: "Observação literária de fixture.", summarizedBy: "Equipe editorial" },
} as const;

/** Ramo que exige cadeia de proveniência do objeto material. */
export const archaeologyEvidence = {
  ...philologyEvidence,
  id: "ev-arqueologia-001",
  branch: "arqueologia",
  locator: { kind: "numero_catalogo", catalogNumber: "FX-001", collection: "Acervo de fixture" },
  language: "pt-BR",
  content: { kind: "resumo_editorial", summary: "Relato material de fixture.", summarizedBy: "Equipe editorial" },
  materialProvenance: {
    chain: "Escavação de fixture → acervo de fixture",
    excavation: "Campanha de fixture",
    custodyDisputes: [],
    legalStatus: null,
  },
} as const;

export const allEvidence = [
  philologyEvidence,
  witnessEvidence,
  interpretationEvidence,
  literaryEvidence,
  archaeologyEvidence,
] as const;

/* -------------------------------------------------------------- afirmações */

export const philologyClaim = {
  id: "claim-filologia-001",
  branch: "filologia",
  claimType: "dado_filologico",
  anchors: [GEN_1_1],
  statement: "Dado filológico de fixture, apoiado em verbete localizado.",
  tradition: null,
  confidence: "alta",
  confidenceBasis: null,
  evidenceLinks: [{ evidenceId: philologyEvidence.id, role: "apoia", rationale: "O verbete sustenta o dado." }],
  divergences: [],
  review: publishedReview,
  note: null,
} as const;

export const interpretationClaim = {
  id: "claim-interpretacao-001",
  branch: "historia-interpretacao",
  claimType: "posicao_interpretativa",
  anchors: [GEN_1_1],
  statement: "Posição interpretativa de fixture, localizada na obra.",
  tradition: "Tradição de fixture",
  confidence: "media",
  confidenceBasis: null,
  evidenceLinks: [{ evidenceId: interpretationEvidence.id, role: "interpreta", rationale: "A página registra a tese." }],
  divergences: [{ summary: "Outra leitura de fixture é defendida em parte da bibliografia.", evidenceId: null, heldBy: null }],
  review: publishedReview,
  note: null,
} as const;

export const archaeologyClaim = {
  id: "claim-arqueologia-001",
  branch: "arqueologia",
  claimType: "evidencia_material",
  anchors: [GEN_1_1],
  statement: "Reconstrução material de fixture.",
  tradition: null,
  confidence: "baixa",
  confidenceBasis: "Objeto único, datação discutida na bibliografia de fixture.",
  evidenceLinks: [{ evidenceId: archaeologyEvidence.id, role: "contextualiza", rationale: "O objeto contextualiza a passagem." }],
  divergences: [],
  review: publishedReview,
  note: null,
} as const;

export const allClaims = [philologyClaim, interpretationClaim, archaeologyClaim] as const;

export const position = {
  id: "position-fixture-001",
  anchors: [GEN_1_1],
  workId: work.id,
  editionId: edition.id,
  authorName: "Autor de fixture",
  tradition: "Tradição de fixture",
  period: "séc. IV",
  thesis: "Tese de fixture localizada na página 42.",
  evidenceId: interpretationEvidence.id,
  claimId: interpretationClaim.id,
  confidence: "media",
  review: publishedReview,
  note: null,
} as const;

export const connection = {
  id: "conn-fixture-001",
  from: GEN_1_1,
  to: JHN_1_1,
  relation: "alude",
  branch: "literario",
  direction: "unidirecional",
  evidenceId: literaryEvidence.id,
  rationale: "A alusão é registrada pela evidência literária de fixture.",
  confidence: "media",
  review: publishedReview,
  note: null,
} as const;

/* ---------------------------------------------- ponte de versificação */

export const micBridge = {
  id: "bridge-mic-5-fixture",
  from: MIC_5_2_PT,
  to: MIC_5_1_MT,
  relation: "deslocado",
  documentation: {
    reference: "Mapa de versificação de fixture, Miqueias 4–5",
    documentedBy: "Equipe editorial",
    documentedAt: "2026-11-24",
    sourceEditionId: edition.id,
  },
  note: null,
} as const;

/* --------------------------------------------------------------- pacotes */

/** Pacote completo e publicável, como a porta do servidor o devolveria. */
export function fullBundle() {
  return {
    works: [work],
    editions: [edition],
    artifacts: [artifact],
    witnesses: [witness],
    evidence: [...allEvidence],
    claims: [...allClaims],
    positions: [position],
    connections: [connection],
  };
}

export function emptyBundle() {
  return { works: [], editions: [], artifacts: [], witnesses: [], evidence: [], claims: [], positions: [], connections: [] };
}
