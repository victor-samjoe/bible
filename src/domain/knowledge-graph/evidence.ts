/**
 * Fragmento de evidência (KNOWLEDGE-GRAPH-001, fila A2).
 * Implementa `docs/VERSE_KNOWLEDGE_GRAPH.md` §4.
 *
 * Evidência é a única coisa que a árvore aceita como apoio de uma afirmação, e
 * ela tem dois campos sem os quais o registro é recusado:
 *
 * - **`editionId`** — a fonte. Não a obra, não o autor: a edição concreta, que
 *   é onde moram licença, idioma e paginação.
 * - **`locator`** — a localização reproduzível. Página, seção, parágrafo,
 *   fólio, linha, entrada de aparato, verbete ou número de catálogo.
 *
 * Os dois juntos são o que torna a afirmação conferível por outra pessoa. Uma
 * evidência com fonte e sem localização passa a impressão de rigor e não permite
 * conferência nenhuma: "está em Agostinho" não é verificável em tempo humano.
 * Uma com localização e sem fonte é pior ainda — aponta para a página 42 de
 * nada.
 *
 * Terceira exigência, por ramo: nos ramos que vivem de testemunho —
 * `texto-testemunhos` e `critica-textual` — o fragmento precisa dizer **qual**
 * testemunho atesta o que ele afirma. `witnessId` existe para isso. Sem ele,
 * "o grego traz X" não identifica manuscrito, edição nem aparato, e a afirmação
 * fica tão pouco conferível quanto uma sem localização.
 *
 * Quarta recusa, igualmente estrutural: **síntese de agente não é evidência**.
 * Ela tem lugar próprio no modelo (`research_runs`), e ali é rotulada como
 * síntese. Deixá-la entrar aqui fecharia o circuito em que uma resposta gerada
 * vira fonte do catálogo e depois é citada como se fosse testemunho.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco, sem relógio.
 */

import { z } from "zod";
import {
  PassageAnchorSchema,
  anchorIsPublishable,
  anchorKey,
  anchorsOverlap,
  type PassageAnchor,
} from "./anchors";
import { branchDefinition, branchId, type BranchId } from "./branches";
import {
  confidenceGrade,
  isoDate,
  issuesOf,
  languageTag,
  optionalText,
  requiredText,
  sourceTier,
  stableId,
} from "./primitives";
import {
  LocatorSchema,
  quotationWithinLimit,
  rightsPublicationErrors,
  type Locator,
  type SourceArtifact,
  type SourceEdition,
} from "./provenance";
import { ReviewRecordSchema, isPublished } from "./review";
import type { TextualWitness } from "./witnesses";

/**
 * Como o fragmento entrou no acervo. `sintese_de_agente` está na lista de
 * propósito: o valor precisa ser **recusável com motivo**, e não rejeitado por
 * um erro genérico de enum que não explica nada a quem está cadastrando.
 */
export const EVIDENCE_ORIGINS = [
  "transcricao_manual",
  "importacao_aprovada",
  "entrada_do_operador",
  "sintese_de_agente",
] as const;

export type EvidenceOrigin = (typeof EVIDENCE_ORIGINS)[number];

const REFUSED_ORIGINS: ReadonlyMap<EvidenceOrigin, string> = new Map([
  [
    "sintese_de_agente",
    "Síntese de agente não é evidência: registre a execução em research_runs e cite as fontes que ela usou",
  ],
]);

/**
 * Conteúdo do fragmento. Exatamente uma forma por registro, porque exibir um
 * resumo editorial como se fosse citação literal é desinformação, ainda que o
 * resumo esteja correto.
 */
export const EvidenceContentSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("citacao"),
    quotation: requiredText,
  }),
  z.strictObject({
    kind: z.literal("resumo_editorial"),
    summary: requiredText,
    summarizedBy: requiredText,
  }),
  z.strictObject({
    kind: z.literal("dado_estruturado"),
    /** Campos importados, ex. lema, morfologia, datação. Chave e valor obrigatórios. */
    fields: z.record(z.string().trim().min(1), requiredText).refine((value) => Object.keys(value).length > 0, {
      message: "Informe ao menos um campo",
    }),
    describedBy: requiredText,
  }),
]);

export type EvidenceContent = z.infer<typeof EvidenceContentSchema>;

/** Cadeia de custódia do objeto material, exigida no ramo de arqueologia. */
export const MaterialProvenanceSchema = z.strictObject({
  chain: requiredText,
  excavation: optionalText,
  custodyDisputes: z.array(requiredText).default([]),
  legalStatus: optionalText,
});

export const EvidenceFragmentSchema = z.strictObject({
  id: stableId,
  branch: branchId,
  /** Passagens que o fragmento ilumina. Pelo menos uma. */
  anchors: z.array(PassageAnchorSchema).min(1),
  /** A fonte: edição concreta, registrada em `source_editions`. */
  editionId: stableId,
  /** Ativo armazenado por nós, quando houver. `null` quando lemos sem guardar. */
  artifactId: stableId.nullable().default(null),
  /**
   * Testemunho que o fragmento atesta. Obrigatório nos ramos que declaram
   * `requiresWitness`; `null` nos demais, onde não há objeto textual a nomear.
   */
  witnessId: stableId.nullable().default(null),
  /** A localização reproduzível. Obrigatória, sem exceção. */
  locator: LocatorSchema,
  language: languageTag,
  tier: sourceTier,
  content: EvidenceContentSchema,
  origin: z.enum(EVIDENCE_ORIGINS),
  collectedBy: requiredText,
  collectedAt: isoDate,
  confidence: confidenceGrade,
  /** Divergências conhecidas sobre o que a fonte diz ou sobre seu valor. */
  knownDisputes: z.array(requiredText).default([]),
  materialProvenance: MaterialProvenanceSchema.nullable().default(null),
  review: ReviewRecordSchema,
  note: optionalText,
});

export type EvidenceFragment = z.infer<typeof EvidenceFragmentSchema>;

/** Índice de proveniência para validação cruzada, sem banco. */
export type ProvenanceIndex = {
  readonly editions: ReadonlyMap<string, SourceEdition>;
  readonly artifacts: ReadonlyMap<string, SourceArtifact>;
  readonly witnesses: ReadonlyMap<string, TextualWitness>;
};

export function indexProvenance(
  editions: readonly SourceEdition[],
  artifacts: readonly SourceArtifact[],
  witnesses: readonly TextualWitness[] = [],
): ProvenanceIndex {
  return {
    editions: new Map(editions.map((edition) => [edition.id, edition])),
    artifacts: new Map(artifacts.map((artifact) => [artifact.id, artifact])),
    witnesses: new Map(witnesses.map((witness) => [witness.id, witness])),
  };
}

/** Localizações que situam a afirmação dentro de uma obra. */
const WORK_LOCALIZING: readonly Locator["kind"][] = ["pagina", "secao", "paragrafo", "folio", "linha"];

export function localizesInsideWork(locator: Locator): boolean {
  return WORK_LOCALIZING.includes(locator.kind);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Ausências que merecem mensagem própria. O schema também recusaria, mas com
 * "Invalid input", que não diz a quem cadastra o que exatamente falta — e são
 * justamente estes dois campos que a frente existe para exigir.
 */
function missingCoreFields(input: unknown): readonly string[] {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return ["evidence: informe um registro de evidência"];
  }
  const record = input as Record<string, unknown>;
  const errors: string[] = [];
  if (!isNonEmptyString(record.editionId)) {
    errors.push("evidence.editionId: toda evidência precisa apontar para a edição que a publica");
  }
  if (record.locator === undefined || record.locator === null) {
    errors.push("evidence.locator: toda evidência precisa de localização reproduzível (página, seção, parágrafo, fólio, linha, aparato, verbete ou catálogo)");
  }
  return errors;
}

export type EvidenceValidation =
  | { readonly ok: true; readonly evidence: EvidenceFragment; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Valida o fragmento e, quando o índice é fornecido, as ligações com edição e
 * ativo. Sem índice, a validação é de forma; com índice, é de integridade.
 */
export function validateEvidence(input: unknown, index?: ProvenanceIndex): EvidenceValidation {
  const core = missingCoreFields(input);
  const parsed = EvidenceFragmentSchema.safeParse(input);
  if (!parsed.success) {
    // Evita dizer duas vezes a mesma coisa: o campo já explicado acima não
    // volta com a mensagem genérica do schema.
    const covered = new Set(core.map((message) => message.split(":")[0]));
    const schemaErrors = issuesOf(parsed.error, "evidence").filter((message) => !covered.has(message.split(":")[0] ?? ""));
    return { ok: false, errors: [...core, ...schemaErrors] };
  }
  const evidence = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  const refusal = REFUSED_ORIGINS.get(evidence.origin);
  if (refusal !== undefined) errors.push(`evidence.origin: ${refusal}`);

  const obligations = branchDefinition(evidence.branch).obligations;
  if (obligations.requiresProvenanceChain && evidence.materialProvenance === null) {
    errors.push(`evidence.materialProvenance: o ramo ${evidence.branch} exige cadeia de proveniência do objeto`);
  }
  if (obligations.requiresWorkLocalization && !localizesInsideWork(evidence.locator)) {
    errors.push(
      `evidence.locator: o ramo ${evidence.branch} exige localizar a interpretação dentro da obra (página, seção, parágrafo, fólio ou linha), não apenas a referência bíblica`,
    );
  }
  if (obligations.requiresWitness && evidence.witnessId === null) {
    errors.push(
      `evidence.witnessId: o ramo ${evidence.branch} exige identificar o testemunho atestado (manuscrito, versão antiga, citação ou edição crítica)`,
    );
  }
  if (!obligations.requiresWitness && evidence.witnessId !== null) {
    warnings.push(
      `O ramo ${evidence.branch} não documenta testemunho textual; ${evidence.witnessId} fica registrado sem efeito na validação do ramo`,
    );
  }

  if (index !== undefined) {
    const edition = index.editions.get(evidence.editionId);
    if (edition === undefined) {
      errors.push(`evidence.editionId: edição ${evidence.editionId} não está registrada`);
    } else {
      if (evidence.content.kind === "citacao") {
        if (!edition.rights.permissions.quote) {
          errors.push(`evidence.content: a licença de ${edition.id} não permite citação literal; use resumo editorial`);
        } else if (!quotationWithinLimit(edition.rights, evidence.content.quotation)) {
          errors.push(`evidence.content: citação acima do limite de ${edition.rights.quoteLimitChars} caracteres declarado para ${edition.id}`);
        }
      }
      if (!edition.rights.permissions.process) {
        warnings.push(`A licença de ${edition.id} não declara permissão de processamento; indexação depende de revisão de direitos`);
      }
      if (isPublished(evidence.review.state)) {
        for (const rightsError of rightsPublicationErrors(edition.rights)) {
          errors.push(`evidence.review: ${rightsError} (${edition.id})`);
        }
      }
    }
    if (evidence.artifactId !== null) {
      const artifact = index.artifacts.get(evidence.artifactId);
      if (artifact === undefined) {
        errors.push(`evidence.artifactId: ativo ${evidence.artifactId} não está registrado`);
      } else if (artifact.editionId !== evidence.editionId) {
        errors.push(`evidence.artifactId: o ativo ${artifact.id} pertence à edição ${artifact.editionId}, não a ${evidence.editionId}`);
      } else if (edition !== undefined && !edition.rights.permissions.store) {
        errors.push(`evidence.artifactId: a licença de ${edition.id} não permite armazenar o ativo`);
      }
    }
    if (evidence.witnessId !== null) {
      const witness = index.witnesses.get(evidence.witnessId);
      if (witness === undefined) {
        errors.push(`evidence.witnessId: testemunho ${evidence.witnessId} não está registrado`);
      } else if (!index.editions.has(witness.publishedInEditionId)) {
        // A leitura do manuscrito chega por uma edição. Se essa edição não está
        // cadastrada, o intermediário desapareceu do registro e a afirmação
        // passa a parecer leitura direta do objeto.
        errors.push(
          `evidence.witnessId: a edição ${witness.publishedInEditionId}, por onde a leitura de ${witness.id} é conhecida, não está registrada`,
        );
      }
    }
  }

  if (isPublished(evidence.review.state)) {
    for (const anchor of evidence.anchors) {
      if (!anchorIsPublishable(anchor)) {
        errors.push(`evidence.anchors: ${anchorKey(anchor)} usa cânon ou versificação pendente de aprovação e não pode ser publicada`);
      }
    }
  }

  return errors.length === 0 ? { ok: true, evidence, warnings } : { ok: false, errors };
}

/** Erros que impedem servir este fragmento como conhecimento publicado. */
export function evidencePublicationErrors(evidence: EvidenceFragment, index: ProvenanceIndex): readonly string[] {
  const errors: string[] = [];
  if (!isPublished(evidence.review.state)) errors.push(`Evidência ${evidence.id} está em ${evidence.review.state}`);
  const edition = index.editions.get(evidence.editionId);
  if (edition === undefined) {
    errors.push(`Evidência ${evidence.id}: edição ${evidence.editionId} não registrada`);
    return errors;
  }
  for (const rightsError of rightsPublicationErrors(edition.rights)) {
    errors.push(`Evidência ${evidence.id}: ${rightsError}`);
  }
  if (evidence.witnessId !== null) {
    const witness = index.witnesses.get(evidence.witnessId);
    if (witness === undefined) {
      errors.push(`Evidência ${evidence.id}: testemunho ${evidence.witnessId} não registrado`);
    } else {
      const witnessEdition = index.editions.get(witness.publishedInEditionId);
      if (witnessEdition === undefined) {
        errors.push(`Evidência ${evidence.id}: edição ${witness.publishedInEditionId} do testemunho ${witness.id} não registrada`);
      } else {
        for (const rightsError of rightsPublicationErrors(witnessEdition.rights)) {
          errors.push(`Evidência ${evidence.id}: ${rightsError} (testemunho ${witness.id})`);
        }
      }
    }
  }
  return errors;
}

/**
 * `true` quando o fragmento toca a passagem consultada.
 *
 * A comparação é por **sobreposição**, não por igualdade de chave. Material
 * ancorado em Gênesis 1:1–5 é alcançado ao consultar 1:3, porque é disso que
 * ele trata; igualdade de chave tornaria a âncora de intervalo inalcançável,
 * já que ninguém consulta "1:1–5" — consulta um versículo.
 *
 * Pertencer não é equivaler: quem exibe o fragmento precisa mostrar a âncora
 * dele, para que evidência sobre cinco versículos não seja lida como prova
 * sobre um. A projeção faz isso pelo campo `scope` de cada cartão.
 *
 * `anchorsOverlap` já recusa cânon ou versificação distintos, de modo que
 * número igual continua não sendo passagem igual.
 */
export function evidenceAnchoredAt(evidence: EvidenceFragment, anchor: PassageAnchor): boolean {
  return evidence.anchors.some((candidate) => anchorsOverlap(candidate, anchor));
}

export function evidenceBranches(fragments: readonly EvidenceFragment[]): readonly BranchId[] {
  return [...new Set(fragments.map((fragment) => fragment.branch))].sort();
}
