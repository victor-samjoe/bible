/**
 * Testes dos contratos da árvore de conhecimento (KNOWLEDGE-GRAPH-001, fila A2).
 *
 * Organizados pelos quatro critérios de aceite da fila, porque é por eles que a
 * frente é conferida: relações tipadas, proveniência e localização obrigatórias,
 * estados de revisão explícitos e recusa de evidência sem fonte ou localização.
 *
 * Cada teste parte de um registro **válido** das fixtures e estraga um campo.
 * Afirmar `ok === false` sobre um registro já quebrado por outro motivo provaria
 * apenas que a validação roda.
 */

import { describe, expect, it } from "vitest";
import {
  anchorKey,
  anchorsEquivalent,
  mapAnchor,
  parseAnchorKey,
  parseAnchorRecord,
  VersificationBridgeSchema,
  type VersificationBridge,
} from "../../src/domain/knowledge-graph/anchors";
import { BRANCHES, claimTypeAllowedIn, relationAllowedIn } from "../../src/domain/knowledge-graph/branches";
import {
  indexEvidence,
  validateClaim,
  validateInterpretationPosition,
} from "../../src/domain/knowledge-graph/claims";
import { validatePassageConnection } from "../../src/domain/knowledge-graph/connections";
import { indexProvenance, validateEvidence } from "../../src/domain/knowledge-graph/evidence";
import {
  quotationWithinLimit,
  rightsPublicationErrors,
  RightsSchema,
  SourceArtifactSchema,
  SourceEditionSchema,
  validateSourceEdition,
} from "../../src/domain/knowledge-graph/provenance";
import {
  allowedTransitions,
  applyTransition,
  canTransition,
  ReviewRecordSchema,
} from "../../src/domain/knowledge-graph/review";
import {
  indexWitnesses,
  TextualWitnessSchema,
  validateTextualWitness,
  validateWitnessReading,
} from "../../src/domain/knowledge-graph/witnesses";
import {
  archaeologyEvidence,
  artifact,
  clearedRights,
  connection,
  draftReview,
  edition,
  GEN_1_1,
  interpretationClaim,
  interpretationEvidence,
  JHN_1_1,
  literaryEvidence,
  MIC_5_1_MT,
  MIC_5_2_PT,
  micBridge,
  philologyClaim,
  philologyEvidence,
  position,
  publishedReview,
  witness,
  witnessEvidence,
} from "./knowledge-graph-fixtures";

/**
 * Índice de proveniência montado a partir de registros **já validados**. As
 * fixtures são `as const` para servirem de entrada `unknown` às validações; o
 * índice, porém, é o lugar onde só entra o que passou pelos contratos — e é
 * assim que a camada de leitura o monta.
 */
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

/** Índice com as evidências já conferidas pelos próprios contratos. */
function evidenceIndexOf(...records: readonly unknown[]) {
  const fragments = records.map((record) => {
    const result = validateEvidence(record, provenance);
    if (!result.ok) throw new Error(`Fixture inválida: ${result.errors.join("; ")}`);
    return result.evidence;
  });
  return indexEvidence(fragments);
}

function errorsOf(result: { ok: boolean; errors?: readonly string[] }): string {
  return (result.errors ?? []).join(" | ");
}

describe("KNOWLEDGE-GRAPH-001 — fixtures publicáveis", () => {
  it("aceita o conjunto completo, para que as recusas adiante signifiquem algo", () => {
    for (const record of [philologyEvidence, witnessEvidence, interpretationEvidence, literaryEvidence, archaeologyEvidence]) {
      const result = validateEvidence(record, provenance);
      expect(errorsOf(result)).toBe("");
      expect(result.ok).toBe(true);
    }
    const evidence = evidenceIndexOf(philologyEvidence, interpretationEvidence, literaryEvidence);
    expect(validateClaim(philologyClaim, { evidence, provenance }).ok).toBe(true);
    expect(validateClaim(interpretationClaim, { evidence, provenance }).ok).toBe(true);
    expect(validateInterpretationPosition(position, { evidence, provenance }).ok).toBe(true);
    expect(validatePassageConnection(connection, evidence).ok).toBe(true);
    expect(validateSourceEdition(edition)).toEqual([]);
    expect(validateTextualWitness(witness, provenance.editions)).toEqual([]);
  });
});

/* ====================================================== âncora canônica ==== */

describe("KNOWLEDGE-GRAPH-001 — âncora canônica", () => {
  it("ancora a passagem por cânon e versificação, não por rótulo de tradução", () => {
    const parsed = parseAnchorRecord(GEN_1_1);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(anchorKey(parsed.anchor)).toBe("protestante/blivre-pt/GEN 1:1");
  });

  it("recusa cânon e sistema de versificação incompatíveis", () => {
    // `wlc-mt` numera o Tanak; declarar cânon protestante com ele grava duas
    // numerações diferentes sob a mesma identidade.
    expect(parseAnchorRecord({ ...GEN_1_1, versification: "wlc-mt" }).ok).toBe(false);
    // `sblgnt` cobre só o Novo Testamento.
    expect(parseAnchorRecord({ ...GEN_1_1, versification: "sblgnt" }).ok).toBe(false);
    // Livro fora do cânon declarado.
    expect(parseAnchorRecord({ ...GEN_1_1, canon: "tanak", versification: "wlc-mt", book: "JHN" }).ok).toBe(false);
  });

  it("recusa intervalo invertido e recupera a chave citável", () => {
    expect(parseAnchorRecord({ ...GEN_1_1, verseStart: 5, verseEnd: 2 }).ok).toBe(false);
    const roundTrip = parseAnchorKey("protestante/blivre-pt/GEN 1:1-3");
    expect(roundTrip.ok).toBe(true);
    if (roundTrip.ok) expect(anchorKey(roundTrip.anchor)).toBe("protestante/blivre-pt/GEN 1:1-3");
    expect(parseAnchorKey("GEN 1:1").ok).toBe(false);
  });

  it("não atravessa sistemas de versificação sem ponte documentada", () => {
    const anchor = parseAnchorRecord(MIC_5_2_PT);
    expect(anchor.ok).toBe(true);
    if (!anchor.ok) return;

    const withoutBridge = mapAnchor(anchor.anchor, "wlc-mt", []);
    expect(withoutBridge.ok).toBe(false);
    if (!withoutBridge.ok) {
      expect(withoutBridge.reason).toBe("sem_ponte");
      expect(withoutBridge.message).toContain("igualdade de número não é equivalência");
    }

    const bridge: VersificationBridge = VersificationBridgeSchema.parse(micBridge);
    const mapped = mapAnchor(anchor.anchor, "wlc-mt", [bridge]);
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.anchors.map(anchorKey)).toEqual(["tanak/wlc-mt/MIC 5:1"]);
      expect(mapped.relation).toBe("deslocado");
      expect(mapped.bridgeIds).toEqual([micBridge.id]);
    }

    const left = parseAnchorRecord(MIC_5_2_PT);
    const right = parseAnchorRecord(MIC_5_1_MT);
    expect(left.ok && right.ok).toBe(true);
    if (left.ok && right.ok) {
      expect(anchorsEquivalent(left.anchor, right.anchor, [bridge])).toBe(true);
      expect(anchorsEquivalent(left.anchor, right.anchor, [])).toBe(false);
    }
  });

  it("recusa ponte sem documentação, entre o mesmo sistema ou com destino contraditório", () => {
    expect(VersificationBridgeSchema.safeParse({ ...micBridge, documentation: undefined }).success).toBe(false);
    expect(VersificationBridgeSchema.safeParse({ ...micBridge, to: MIC_5_2_PT }).success).toBe(false);
    // `ausente` afirma que a passagem não existe no outro sistema: apontar para
    // uma passagem contradiz a própria relação.
    expect(VersificationBridgeSchema.safeParse({ ...micBridge, relation: "ausente" }).success).toBe(false);
    expect(VersificationBridgeSchema.safeParse({ ...micBridge, relation: "ausente", to: null }).success).toBe(true);
    expect(VersificationBridgeSchema.safeParse({ ...micBridge, relation: "deslocado", to: null }).success).toBe(false);
  });

  it("registra ausência como resposta, e não como vizinho mais próximo", () => {
    const anchor = parseAnchorRecord(MIC_5_2_PT);
    if (!anchor.ok) throw new Error("fixture inválida");
    const absent = VersificationBridgeSchema.parse({ ...micBridge, relation: "ausente", to: null });
    const mapped = mapAnchor(anchor.anchor, "wlc-mt", [absent]);
    expect(mapped.ok).toBe(false);
    if (!mapped.ok) expect(mapped.reason).toBe("ausente");
  });
});

/* ============================================ proveniência e localização ==== */

describe("KNOWLEDGE-GRAPH-001 — proveniência e localização obrigatórias", () => {
  it("recusa evidência sem a edição que a publica", () => {
    const result = validateEvidence({ ...philologyEvidence, editionId: " " });
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("precisa apontar para a edição");
  });

  it("recusa evidência sem localização reproduzível", () => {
    for (const locator of [null, undefined, {}, { kind: "passim" }, { kind: "pagina", page: "  " }]) {
      const result = validateEvidence({ ...philologyEvidence, locator });
      expect(result.ok).toBe(false);
    }
    expect(errorsOf(validateEvidence({ ...philologyEvidence, locator: null }))).toContain("localização reproduzível");
  });

  it("recusa evidência cuja edição ou ativo não estão registrados", () => {
    expect(errorsOf(validateEvidence({ ...philologyEvidence, editionId: "ed-inexistente-001" }, provenance)))
      .toContain("não está registrada");
    expect(errorsOf(validateEvidence({ ...philologyEvidence, artifactId: "art-inexistente-001" }, provenance)))
      .toContain("não está registrado");
    // Ativo de outra edição: o hash conferido não prova nada sobre esta fonte.
    const foreign = provenanceOf([edition], [{ ...artifact, id: "art-outro-001", editionId: "ed-outra-001" }], [witness]);
    expect(errorsOf(validateEvidence({ ...philologyEvidence, artifactId: "art-outro-001" }, foreign)))
      .toContain("pertence à edição");
  });

  it("exige cadeia de proveniência no ramo de arqueologia", () => {
    const result = validateEvidence({ ...archaeologyEvidence, materialProvenance: null }, provenance);
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("cadeia de proveniência");
  });

  it("exige localização dentro da obra na história da interpretação", () => {
    // Referência bíblica localiza a passagem, não a tese dentro da obra: é a
    // "lista de nomes" que a tabela de ramos proíbe.
    const result = validateEvidence(
      { ...interpretationEvidence, locator: { kind: "referencia_canonica", reference: "GEN 1:1" } },
      provenance,
    );
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("dentro da obra");
  });

  it("exige testemunho identificado nos ramos que vivem de testemunho", () => {
    const branches = BRANCHES.filter((branch) => branch.obligations.requiresWitness).map((branch) => branch.id);
    expect(branches).toEqual(["texto-testemunhos", "critica-textual"]);

    for (const branch of branches) {
      const result = validateEvidence({ ...witnessEvidence, branch, witnessId: null }, provenance);
      expect(result.ok).toBe(false);
      expect(errorsOf(result)).toContain("exige identificar o testemunho");
    }
  });

  it("recusa testemunho não registrado e testemunho sem a edição que informa sua leitura", () => {
    expect(errorsOf(validateEvidence({ ...witnessEvidence, witnessId: "wit-inexistente-001" }, provenance)))
      .toContain("não está registrado");

    // Não lemos o manuscrito: lemos uma edição que informa o que ele traz. Sem
    // essa edição no registro, o intermediário desaparece.
    const orphan = provenanceOf([edition], [artifact], [{ ...witness, publishedInEditionId: "ed-inexistente-001" }]);
    expect(errorsOf(validateEvidence(witnessEvidence, orphan))).toContain("não está registrada");
    expect(validateTextualWitness({ ...witness, publishedInEditionId: "ed-inexistente-001" }, provenance.editions))
      .toHaveLength(1);
  });

  it("exige acervo e cota para testemunho com objeto físico", () => {
    expect(validateTextualWitness({ ...witness, holding: null })).toHaveLength(1);
    // Edição crítica não é objeto físico identificado por cota.
    expect(validateTextualWitness({ ...witness, kind: "edicao_critica", holding: null })).toEqual([]);
  });

  it("recusa leitura de testemunho que a evidência citada não documenta", () => {
    const reading = {
      id: "read-fixture-001",
      witnessId: witness.id,
      anchor: GEN_1_1,
      readingType: "variante",
      readingText: "Leitura de fixture.",
      language: "lat",
      evidenceId: witnessEvidence.id,
      confidence: "media",
      knownDisputes: [],
      collatedBy: "Equipe editorial",
      collatedAt: "2026-11-24",
      note: null,
    } as const;
    const witnesses = indexWitnesses([witness]);
    const context = { witnesses, evidence: evidenceIndexOf(witnessEvidence, philologyEvidence) };

    expect(validateWitnessReading(reading, context)).toEqual([]);
    expect(validateWitnessReading({ ...reading, witnessId: "wit-inexistente-001" }, context).join(" "))
      .toContain("não está registrado");
    expect(validateWitnessReading({ ...reading, evidenceId: "ev-inexistente-001" }, context).join(" "))
      .toContain("não está registrada");
    // Evidência de filologia não documenta testemunho textual.
    expect(validateWitnessReading({ ...reading, evidenceId: philologyEvidence.id }, context).join(" "))
      .toContain("não documenta testemunho textual");
    // Evidência ancorada em outro versículo: a colação não pode ser refeita.
    expect(validateWitnessReading({ ...reading, anchor: JHN_1_1 }, context).join(" "))
      .toContain("não está ancorada");
  });

  it("distingue omissão de transcrição esquecida", () => {
    const base = {
      id: "read-fixture-002",
      witnessId: witness.id,
      anchor: GEN_1_1,
      readingType: "omissao",
      readingText: null,
      language: "lat",
      evidenceId: witnessEvidence.id,
      confidence: "media",
      knownDisputes: [],
      collatedBy: "Equipe editorial",
      collatedAt: "2026-11-24",
      note: null,
    } as const;
    expect(validateWitnessReading(base)).toEqual([]);
    expect(validateWitnessReading({ ...base, readingText: "texto" })).toHaveLength(1);
    expect(validateWitnessReading({ ...base, readingType: "variante", readingText: null })).toHaveLength(1);
    expect(validateWitnessReading({ ...base, readingType: "variante", readingText: "  " })).toHaveLength(1);
  });

  it("recusa síntese de agente como evidência, com motivo nomeado", () => {
    const result = validateEvidence({ ...philologyEvidence, origin: "sintese_de_agente" }, provenance);
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("não é evidência");
    expect(errorsOf(result)).toContain("research_runs");
  });
});

/* ============================================================= direitos ==== */

describe("KNOWLEDGE-GRAPH-001 — direitos da fonte", () => {
  it("não deixa estado de direitos indefinido conceder permissão", () => {
    for (const status of ["permissao_necessaria", "desconhecido"]) {
      expect(RightsSchema.safeParse({ ...clearedRights, status }).success).toBe(false);
    }
    expect(rightsPublicationErrors(RightsSchema.parse(clearedRights))).toEqual([]);
  });

  it("recusa citação literal sem permissão e acima do limite declarado", () => {
    const quoteless = {
      ...edition,
      rights: { ...clearedRights, permissions: { ...clearedRights.permissions, quote: false } },
    };
    const index = provenanceOf([quoteless]);
    expect(errorsOf(validateEvidence(witnessEvidence, index))).toContain("não permite citação literal");

    const tight = { ...edition, rights: { ...clearedRights, quoteLimitChars: 5 } };
    const tightIndex = provenanceOf([tight]);
    expect(errorsOf(validateEvidence(witnessEvidence, tightIndex))).toContain("acima do limite");
    expect(quotationWithinLimit(RightsSchema.parse({ ...clearedRights, quoteLimitChars: 5 }), "texto longo")).toBe(false);
  });

  it("não publica evidência apoiada em edição com direitos não liberados", () => {
    const unverified = { ...edition, rights: { ...clearedRights, verifiedBy: null, verifiedAt: null } };
    const index = provenanceOf([unverified]);
    const result = validateEvidence(philologyEvidence, index);
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("Registre quem conferiu os direitos");
  });

  it("não armazena ativo que a licença não permite guardar", () => {
    const noStore = { ...edition, rights: { ...clearedRights, permissions: { ...clearedRights.permissions, store: false } } };
    const index = provenanceOf([noStore]);
    expect(errorsOf(validateEvidence({ ...philologyEvidence, artifactId: artifact.id }, index)))
      .toContain("não permite armazenar");
  });
});

/* ===================================================== relações tipadas ==== */

describe("KNOWLEDGE-GRAPH-001 — relações tipadas", () => {
  it("recusa tipo de afirmação que não pertence ao ramo", () => {
    // Doutrina entrando como dado de língua é o deslize que a ontologia existe
    // para impedir.
    expect(claimTypeAllowedIn("filologia", "afirmacao_teologica")).toBe(false);
    const result = validateClaim(
      { ...philologyClaim, claimType: "afirmacao_teologica", tradition: "Tradição de fixture" },
      { evidence: evidenceIndexOf(philologyEvidence), provenance },
    );
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("não pertence ao ramo");
  });

  it("recusa relação que o ramo não usa", () => {
    expect(relationAllowedIn("filologia", "recebe")).toBe(false);
    const result = validateClaim(
      { ...philologyClaim, evidenceLinks: [{ evidenceId: philologyEvidence.id, role: "recebe", rationale: "Motivo." }] },
      { evidence: evidenceIndexOf(philologyEvidence), provenance },
    );
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("não é usada no ramo");
  });

  it("recusa relação fora da lista fechada", () => {
    const result = validateClaim({
      ...philologyClaim,
      evidenceLinks: [{ evidenceId: philologyEvidence.id, role: "relacionado_a", rationale: "Motivo." }],
    });
    expect(result.ok).toBe(false);
  });

  it("exige evidência de apoio, não só de contestação", () => {
    const result = validateClaim(
      { ...philologyClaim, evidenceLinks: [{ evidenceId: philologyEvidence.id, role: "contesta", rationale: "Oposição." }] },
      { evidence: evidenceIndexOf(philologyEvidence), provenance },
    );
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("ao menos uma evidência de apoio");
  });

  it("recusa a mesma evidência ligada duas vezes e evidência não registrada", () => {
    const duplicated = validateClaim({
      ...philologyClaim,
      evidenceLinks: [
        { evidenceId: philologyEvidence.id, role: "apoia", rationale: "Primeira." },
        { evidenceId: philologyEvidence.id, role: "cita", rationale: "Segunda." },
      ],
    }, { evidence: evidenceIndexOf(philologyEvidence), provenance });
    expect(duplicated.ok).toBe(false);
    expect(errorsOf(duplicated)).toContain("ligada mais de uma vez");

    const missing = validateClaim(
      { ...philologyClaim, evidenceLinks: [{ evidenceId: "ev-inexistente-001", role: "apoia", rationale: "Motivo." }] },
      { evidence: evidenceIndexOf(philologyEvidence), provenance },
    );
    expect(missing.ok).toBe(false);
    expect(errorsOf(missing)).toContain("não está registrada");
  });

  it("exige tradição declarada em afirmação interpretativa", () => {
    const result = validateClaim(
      { ...interpretationClaim, tradition: null },
      { evidence: evidenceIndexOf(interpretationEvidence), provenance },
    );
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("tradição");
    expect(errorsOf(result)).toContain("nenhuma leitura é neutra por omissão");
  });

  it("exige justificar o grau de confiança em ramo de reconstrução", () => {
    const result = validateClaim(
      { ...claimOf(), confidenceBasis: null },
      { evidence: evidenceIndexOf(archaeologyEvidence), provenance },
    );
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("exige justificar o grau de confiança");
  });

  it("avisa quando a evidência não está ancorada na passagem da afirmação", () => {
    const result = validateClaim(
      { ...philologyClaim, anchors: [JHN_1_1] },
      { evidence: evidenceIndexOf(philologyEvidence), provenance },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join(" ")).toContain("não está ancorada");
  });

  it("exige conexão entre passagens diferentes, com relação do ramo e evidência ancorada", () => {
    const evidence = evidenceIndexOf(literaryEvidence);
    expect(errorsOf(validatePassageConnection({ ...connection, to: GEN_1_1 }, evidence)))
      .toContain("passagens diferentes");
    expect(errorsOf(validatePassageConnection({ ...connection, relation: "traduz" }, evidence)))
      .toContain("não é usada no ramo");
    expect(errorsOf(validatePassageConnection({ ...connection, evidenceId: "ev-inexistente-001" }, evidence)))
      .toContain("não está registrada");
    // Evidência de outra passagem não registra esta conexão.
    const foreign = evidenceIndexOf({ ...literaryEvidence, anchors: [MIC_5_2_PT] });
    expect(errorsOf(validatePassageConnection(connection, foreign)))
      .toContain("não está ancorada em nenhuma das duas passagens");
  });

  it("recusa posição interpretativa cuja evidência está em outra edição ou passagem", () => {
    const evidence = evidenceIndexOf(interpretationEvidence);
    expect(errorsOf(validateInterpretationPosition({ ...position, editionId: "ed-outra-001" }, { evidence, provenance })))
      .toContain("está na edição");
    expect(errorsOf(validateInterpretationPosition({ ...position, anchors: [JHN_1_1] }, { evidence, provenance })))
      .toContain("não está ancorada na passagem");
  });

  it("recusa posição interpretativa cuja evidência não localiza a obra", () => {
    const evidence = evidenceIndexOf({
      ...interpretationEvidence,
      branch: "literario",
      locator: { kind: "referencia_canonica", reference: "GEN 1:1" },
    });
    const result = validateInterpretationPosition(position, { evidence, provenance });
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("não localiza a interpretação dentro da obra");
  });

  it("avisa quando a posição é validada sem índice de evidência", () => {
    const result = validateInterpretationPosition(position);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join(" ")).toContain("sem índice de evidência");
  });
});

/** Afirmação de arqueologia, construída à parte para o teste de confiança. */
function claimOf() {
  return {
    id: "claim-arqueologia-002",
    branch: "arqueologia",
    claimType: "reconstrucao_historica",
    anchors: [GEN_1_1],
    statement: "Reconstrução de fixture.",
    tradition: null,
    confidence: "baixa",
    confidenceBasis: "Justificativa de fixture.",
    evidenceLinks: [{ evidenceId: archaeologyEvidence.id, role: "contextualiza", rationale: "Motivo." }],
    divergences: [],
    review: draftReview,
    note: null,
  } as const;
}

/* ====================================================== estados de revisão == */

describe("KNOWLEDGE-GRAPH-001 — estados de revisão explícitos", () => {
  it("não permite rascunho virar publicado sem passar por revisão", () => {
    expect(canTransition("rascunho", "publicado")).toBe(false);
    expect(canTransition("rascunho", "revisado")).toBe(false);
    expect(allowedTransitions("rascunho")).toEqual(["em_revisao"]);
    expect(allowedTransitions("revisado")).toContain("publicado");
    // Retratação é estado, não exclusão: o histórico do estudo continua válido.
    expect(allowedTransitions("publicado")).toContain("retratado");
  });

  it("exige revisor humano, diferente do autor, com data", () => {
    const base = { state: "revisado", author: "Equipe editorial", note: null };
    expect(ReviewRecordSchema.safeParse({ ...base, reviewer: null, reviewedAt: "2026-11-24" }).success).toBe(false);
    expect(ReviewRecordSchema.safeParse({
      ...base,
      reviewer: { name: "Processo automático", human: false, affiliation: null },
      reviewedAt: "2026-11-24",
    }).success).toBe(false);
    expect(ReviewRecordSchema.safeParse({
      ...base,
      reviewer: { name: "equipe editorial", human: true, affiliation: null },
      reviewedAt: "2026-11-24",
    }).success).toBe(false);
    expect(ReviewRecordSchema.safeParse({
      ...base,
      reviewer: { name: "Revisora responsável", human: true, affiliation: null },
      reviewedAt: null,
    }).success).toBe(false);
    expect(ReviewRecordSchema.safeParse(publishedReview).success).toBe(true);
  });

  it("exige motivo registrado em rejeição e retratação", () => {
    for (const state of ["rejeitado", "retratado"]) {
      expect(ReviewRecordSchema.safeParse({ ...draftReview, state, note: null }).success).toBe(false);
      expect(ReviewRecordSchema.safeParse({ ...draftReview, state, note: "Motivo registrado." }).success).toBe(true);
    }
  });

  it("aplica transição válida e recusa a inválida", () => {
    const review = ReviewRecordSchema.parse(draftReview);
    const invalid = applyTransition(review, "publicado");
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.errors.join(" ")).toContain("não é permitida");

    const inReview = applyTransition(review, "em_revisao");
    expect(inReview.ok).toBe(true);
    if (!inReview.ok) return;
    const reviewed = applyTransition(inReview.review, "revisado", {
      reviewer: { name: "Revisora responsável", human: true, affiliation: null },
      reviewedAt: "2026-11-24",
    });
    expect(reviewed.ok).toBe(true);
    if (!reviewed.ok) return;
    expect(applyTransition(reviewed.review, "publicado").ok).toBe(true);

    // A mesma transição sem revisor continua recusada, agora pelo contrato.
    const unreviewed = applyTransition(inReview.review, "revisado");
    expect(unreviewed.ok).toBe(false);
  });

  it("não publica registro apoiado em evidência não publicada", () => {
    const evidence = evidenceIndexOf({ ...philologyEvidence, review: draftReview });
    const claim = validateClaim(philologyClaim, { evidence, provenance });
    expect(claim.ok).toBe(false);
    expect(errorsOf(claim)).toContain("não pode depender da evidência");

    const connectionEvidence = evidenceIndexOf({ ...literaryEvidence, review: draftReview });
    expect(errorsOf(validatePassageConnection(connection, connectionEvidence)))
      .toContain("não pode depender da evidência");

    const positionEvidence = evidenceIndexOf({ ...interpretationEvidence, review: draftReview });
    expect(errorsOf(validateInterpretationPosition(position, { evidence: positionEvidence, provenance })))
      .toContain("não pode depender da evidência");
  });

  it("não publica registro ancorado em cânon ou versificação pendente de aprovação", () => {
    const pending = {
      canon: "catolico-romano",
      versification: "vulgata-clementina",
      book: "GEN",
      chapter: 1,
      verseStart: 1,
      verseEnd: 1,
    } as const;
    // A âncora é válida: o cânon existe e o livro pertence a ele.
    expect(parseAnchorRecord(pending).ok).toBe(true);
    // Publicar é que não pode, enquanto edição, licença e mapa não forem aprovados.
    const result = validateEvidence({ ...philologyEvidence, anchors: [pending] }, provenance);
    expect(result.ok).toBe(false);
    expect(errorsOf(result)).toContain("pendente de aprovação");
    // Em rascunho a mesma âncora é aceita: preparar a Vulgata é permitido.
    expect(validateEvidence({ ...philologyEvidence, anchors: [pending], review: draftReview }, provenance).ok).toBe(true);
  });
});
