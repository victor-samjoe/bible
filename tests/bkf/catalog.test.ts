import { describe, expect, it, vi } from "vitest";
import {
  createBkfCatalog,
  projectRights,
  type BkfCatalogRepository,
} from "../../src/server/bkf/catalog";

// Fixtures sintéticas: nenhuma obra protegida, nenhum texto real.
const EDITION = "bbbbbbbb-0000-4000-8000-000000000001";
const RIGHTS = "bbbbbbbb-0000-4000-8000-000000000002";
const ARTIFACT = "bbbbbbbb-0000-4000-8000-000000000003";
const SHA = "a".repeat(64);
const NOW = new Date("2026-11-17T12:00:00.000Z");

const approvedRightsRow = {
  id: RIGHTS,
  editionId: EDITION,
  status: "APPROVED_LIMITED",
  store: true,
  automatedProcessing: true,
  quote: true,
  publicDistribution: false,
  proof: "Contrato interno de teste",
  verifiedBy: "Operador de teste",
  verifiedAt: new Date("2026-11-01T00:00:00.000Z"),
  validFrom: new Date("2026-11-01T00:00:00.000Z"),
  validUntil: new Date("2027-11-01T00:00:00.000Z"),
  territory: "BR",
  attribution: "Atribuição de teste",
  wordsPerQuote: 50,
  wordsPerWork: 500,
  wordsPerDocument: 200,
};

const validInput = {
  editionId: EDITION,
  kind: "ORIGINAL" as const,
  originalSha256: SHA,
  extractionVersion: "extract-1",
  storageLocator: "bkf/editions/teste/original.txt",
  byteSize: 1024,
};

function repository(overrides: Partial<BkfCatalogRepository> = {}): BkfCatalogRepository {
  return {
    findEdition: vi.fn().mockResolvedValue({ id: EDITION, title: "Edição sintética" }),
    findCurrentRights: vi.fn().mockResolvedValue(approvedRightsRow),
    findArtifact: vi.fn().mockResolvedValue(null),
    insertArtifact: vi.fn().mockImplementation(async (record) => ({ id: ARTIFACT, ...record })),
    ...overrides,
  };
}

const catalog = (overrides: Partial<BkfCatalogRepository> = {}) =>
  createBkfCatalog(repository(overrides), () => NOW);

describe("catálogo BKF: indisponibilidade e entrada inválida", () => {
  it("responde unavailable sem repositório", async () => {
    const withoutRepository = createBkfCatalog(null, () => NOW);
    expect(withoutRepository.available).toBe(false);
    expect(await withoutRepository.registerArtifact(validInput)).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await withoutRepository.inspectRights(EDITION)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("recusa hash, versão, tipo e campo desconhecido antes de consultar direitos", async () => {
    const repo = repository();
    const subject = createBkfCatalog(repo, () => NOW);
    const invalid = [
      { ...validInput, originalSha256: "nao-e-hash" },
      { ...validInput, originalSha256: "a".repeat(63) },
      { ...validInput, editionId: "sem-uuid" },
      { ...validInput, extractionVersion: "   " },
      { ...validInput, kind: "ORIGINAIS" },
      { ...validInput, byteSize: -1 },
      { ...validInput, extra: "campo desconhecido" },
    ];
    for (const input of invalid) {
      expect(await subject.registerArtifact(input as never)).toEqual({
        ok: false,
        reason: "invalid_input",
      });
    }
    expect(repo.findCurrentRights).not.toHaveBeenCalled();
    expect(repo.insertArtifact).not.toHaveBeenCalled();
  });

  it("recusa caminho de armazenamento fora da raiz privada", async () => {
    const repo = repository();
    const subject = createBkfCatalog(repo, () => NOW);
    for (const storageLocator of [
      "../etc/passwd",
      "/etc/passwd",
      "C:\\Windows\\x.txt",
      "bkf\\editions\\x.txt",
      "bkf/../../segredo.txt",
      "bkf/editions/x.txt?query=1",
      "",
      "a".repeat(513),
    ]) {
      expect(await subject.registerArtifact({ ...validInput, storageLocator })).toEqual({
        ok: false,
        reason: "invalid_input",
      });
    }
    expect(repo.insertArtifact).not.toHaveBeenCalled();
  });

  it("converte exceção do repositório em unavailable sem repassar a mensagem", async () => {
    const subject = catalog({
      findEdition: vi.fn().mockRejectedValue(new Error("postgres://user:senha@db.interno/app")),
    });
    const result = await subject.registerArtifact(validInput);
    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("senha");
  });
});

describe("catálogo BKF: direitos negam por padrão", () => {
  it("recusa edição inexistente", async () => {
    const repo = repository({ findEdition: vi.fn().mockResolvedValue(null) });
    const subject = createBkfCatalog(repo, () => NOW);
    expect(await subject.registerArtifact(validInput)).toEqual({
      ok: false,
      reason: "edition_not_found",
    });
    expect(repo.findCurrentRights).not.toHaveBeenCalled();
  });

  it("recusa edição sem registro de direitos", async () => {
    const subject = catalog({ findCurrentRights: vi.fn().mockResolvedValue(null) });
    expect(await subject.registerArtifact(validInput)).toEqual({
      ok: false,
      reason: "rights_missing",
    });
  });

  it("recusa direitos sem prova, sem responsável, sem data ou de outra edição", async () => {
    const rows = [
      { ...approvedRightsRow, proof: "" },
      { ...approvedRightsRow, verifiedBy: "   " },
      { ...approvedRightsRow, verifiedAt: null },
      { ...approvedRightsRow, validFrom: null },
      { ...approvedRightsRow, editionId: "cccccccc-0000-4000-8000-00000000ffff" },
      { ...approvedRightsRow, attribution: "" },
      { ...approvedRightsRow, status: "APROVADO" },
    ];
    for (const row of rows) {
      const subject = catalog({ findCurrentRights: vi.fn().mockResolvedValue(row) });
      expect(await subject.registerArtifact(validInput)).toEqual({
        ok: false,
        reason: "rights_denied",
      });
    }
  });

  it("recusa status não aprovado, licença expirada, ainda não vigente e permissão ausente", async () => {
    const rows = [
      { ...approvedRightsRow, status: "UNKNOWN", store: false, automatedProcessing: false, quote: false },
      { ...approvedRightsRow, status: "RESTRICTED", store: false, automatedProcessing: false, quote: false },
      { ...approvedRightsRow, status: "BLOCKED", store: false, automatedProcessing: false, quote: false },
      { ...approvedRightsRow, validUntil: new Date("2026-11-16T00:00:00.000Z") },
      { ...approvedRightsRow, validFrom: new Date("2026-12-01T00:00:00.000Z") },
      { ...approvedRightsRow, store: false },
      { ...approvedRightsRow, automatedProcessing: false },
    ];
    for (const row of rows) {
      const repo = repository({ findCurrentRights: vi.fn().mockResolvedValue(row) });
      const subject = createBkfCatalog(repo, () => NOW);
      expect(await subject.registerArtifact(validInput)).toEqual({
        ok: false,
        reason: "rights_denied",
      });
      expect(repo.insertArtifact).not.toHaveBeenCalled();
    }
  });

  it("relata permissões vigentes sem gravar nada", async () => {
    const repo = repository();
    const subject = createBkfCatalog(repo, () => NOW);
    expect(await subject.inspectRights(EDITION)).toEqual({
      ok: true,
      status: "APPROVED_LIMITED",
      store: true,
      automatedProcessing: true,
      quote: true,
      attribution: "Atribuição de teste",
    });
    expect(repo.insertArtifact).not.toHaveBeenCalled();
    expect(await subject.inspectRights("sem-uuid")).toEqual({ ok: false, reason: "invalid_input" });
  });

  it("nega citação quando faltam limites de palavras, mesmo com direito de armazenar", async () => {
    const subject = catalog({
      findCurrentRights: vi.fn().mockResolvedValue({
        ...approvedRightsRow,
        quote: false,
        wordsPerQuote: null,
        wordsPerWork: null,
        wordsPerDocument: null,
      }),
    });
    const decision = await subject.inspectRights(EDITION);
    expect(decision).toMatchObject({ ok: true, store: true, quote: false });
  });
});

describe("catálogo BKF: deduplicação por edição, hash e versão", () => {
  it("registra uma vez e normaliza o hash para minúsculas", async () => {
    const repo = repository();
    const subject = createBkfCatalog(repo, () => NOW);
    const result = await subject.registerArtifact({
      ...validInput,
      originalSha256: SHA.toUpperCase(),
    });
    expect(result).toEqual({
      ok: true,
      status: "created",
      artifact: {
        id: ARTIFACT,
        editionId: EDITION,
        kind: "ORIGINAL",
        originalSha256: SHA,
        extractionVersion: "extract-1",
        storageLocator: "bkf/editions/teste/original.txt",
      },
    });
    expect(repo.findArtifact).toHaveBeenCalledWith({
      editionId: EDITION,
      originalSha256: SHA,
      extractionVersion: "extract-1",
    });
    expect(repo.insertArtifact).toHaveBeenCalledTimes(1);
    expect(vi.mocked(repo.insertArtifact).mock.calls[0]?.[0]).toMatchObject({
      originalSha256: SHA,
      byteSize: 1024,
    });
  });

  it("reaproveita o artefato existente sem inserir de novo", async () => {
    const repo = repository({
      findArtifact: vi.fn().mockResolvedValue({
        id: ARTIFACT,
        editionId: EDITION,
        kind: "ORIGINAL",
        originalSha256: SHA,
        extractionVersion: "extract-1",
        storageLocator: "bkf/editions/teste/original.txt",
      }),
    });
    const subject = createBkfCatalog(repo, () => NOW);
    const result = await subject.registerArtifact(validInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("reused");
    expect(result.artifact.id).toBe(ARTIFACT);
    expect(repo.insertArtifact).not.toHaveBeenCalled();
  });

  it("trata nova versão de extração como registro novo", async () => {
    const repo = repository();
    const subject = createBkfCatalog(repo, () => NOW);
    await subject.registerArtifact(validInput);
    await subject.registerArtifact({ ...validInput, extractionVersion: "extract-2" });
    expect(repo.insertArtifact).toHaveBeenCalledTimes(2);
    expect(vi.mocked(repo.findArtifact).mock.calls.map((call) => call[0].extractionVersion)).toEqual(
      ["extract-1", "extract-2"],
    );
  });

  it("recusa linha inserida fora do formato esperado", async () => {
    const subject = catalog({
      insertArtifact: vi.fn().mockResolvedValue({ id: "sem-uuid", editionId: EDITION }),
    });
    expect(await subject.registerArtifact(validInput)).toEqual({
      ok: false,
      reason: "invalid_data",
    });
  });
});

describe("catálogo BKF: projeção de direitos", () => {
  it("aceita linha completa e rejeita linha incompleta ou fora do contrato", () => {
    expect(projectRights(approvedRightsRow)).toMatchObject({
      id: RIGHTS,
      edition_id: EDITION,
      status: "APPROVED_LIMITED",
      permissions: { store: true, automated_processing: true, quote: true, public_distribution: false },
      word_limits: { per_quote: 50, per_work: 500, per_document: 200 },
    });
    for (const row of [null, undefined, "APPROVED_FULL", 42, {}, { id: RIGHTS }]) {
      expect(projectRights(row)).toBeNull();
    }
  });

  it("aceita data em texto ISO e recusa data inválida", () => {
    const asText = {
      ...approvedRightsRow,
      verifiedAt: "2026-11-01T00:00:00.000Z",
      validFrom: "2026-11-01T00:00:00.000Z",
      validUntil: "2027-11-01T00:00:00.000Z",
    };
    expect(projectRights(asText)?.valid_from).toBe("2026-11-01T00:00:00.000Z");
    expect(projectRights({ ...approvedRightsRow, validFrom: "data qualquer" })).toBeNull();
    expect(projectRights({ ...approvedRightsRow, verifiedAt: new Date("x") })).toBeNull();
  });
});
