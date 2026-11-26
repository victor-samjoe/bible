import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  OFFLINE_FILE_BYTES_LIMIT,
  OFFLINE_PACKAGE_SCHEMA,
  assertContiguousNumbering,
  assertPublicPayload,
  canonicalJson,
  derivePackageVersion,
  describeDownloadSize,
  sizeInBytes,
  verifyBookFile,
  verifyManifest,
  type OfflineFileEntry,
  type OfflineManifest,
} from "../../src/domain/offline/package";

const digest = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

const edition = {
  identifier: "porbr2018" as const,
  name: "Bíblia Livre (BLIVRE)",
  abbreviation: "BLIVRE",
  language: "pt-BR" as const,
  canon: "66 livros",
  license: "Creative Commons Atribuição 4.0 Brasil (CC BY 4.0 BR)",
  licenseUrl: "https://ebible.org/study/content/texts/porbr2018/about.html",
  attribution: "Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE).",
  sourceUrl: "https://ebible.org/Scriptures/porbr2018_usfm.zip",
  archiveSha256: "7ca6742fc1a32ca657a9872047c919097bb9af1384dc318c9cc58ab1cfa5bbf9",
  sourceSignedAt: "2026-10-30 05:50",
  redistribution: "Redistribuição permitida pela licença, preservada a atribuição.",
};

/** Pacote mínimo de dois livros, construído como o construtor real constrói. */
function buildFixture() {
  const books = [
    { code: "GEN", name: "Gênesis", slug: "genesis", chapters: [["No princípio.", "E a terra."], ["Assim foram."]] },
    { code: "EXO", name: "Êxodo", slug: "exodo", chapters: [["Estes são os nomes."]] },
  ];

  const version = digest(canonicalJson({ fixture: books.map((book) => book.code) }));

  const files: { entry: OfflineFileEntry; text: string }[] = books.map((book, index) => {
    const payload = {
      schema: OFFLINE_PACKAGE_SCHEMA,
      version,
      book: book.code,
      name: book.name,
      attribution: edition.attribution,
      chapters: book.chapters,
    };
    const text = canonicalJson(payload);
    return {
      text,
      entry: {
        book: book.code,
        name: book.name,
        slug: book.slug,
        order: index + 1,
        path: `/biblia-offline/${version}/${book.code}.json`,
        chapters: book.chapters.length,
        verses: book.chapters.reduce((total, chapter) => total + chapter.length, 0),
        bytes: sizeInBytes(text),
        sha256: digest(text),
        contentSha256: digest(canonicalJson({ book: book.code, chapters: book.chapters })),
      },
    };
  });

  const manifest: OfflineManifest = {
    schema: OFFLINE_PACKAGE_SCHEMA,
    version,
    edition,
    totals: {
      books: files.length,
      chapters: files.reduce((total, file) => total + file.entry.chapters, 0),
      verses: files.reduce((total, file) => total + file.entry.verses, 0),
      bytes: files.reduce((total, file) => total + file.entry.bytes, 0),
    },
    files: files.map((file) => file.entry),
  };

  return { manifest, files, version };
}

describe("manifesto do pacote offline", () => {
  it("aceita o manifesto que o construtor produz", () => {
    const { manifest } = buildFixture();
    const result = verifyManifest(JSON.parse(canonicalJson(manifest)));
    expect(result.ok).toBe(true);
  });

  it("recusa esquema desconhecido com motivo próprio, não como inválido", () => {
    // A diferença importa: esquema novo significa "atualize o app", e não
    // "o arquivo está corrompido".
    const { manifest } = buildFixture();
    const result = verifyManifest({ ...manifest, schema: "samjoe.offline.bible/2" });
    expect(result).toEqual({ ok: false, reason: "manifest_schema_unsupported" });
  });

  it("recusa totais que não somam os arquivos", () => {
    const { manifest } = buildFixture();
    const mexido = { ...manifest, totals: { ...manifest.totals, verses: manifest.totals.verses + 1 } };
    expect(verifyManifest(mexido)).toEqual({ ok: false, reason: "manifest_invalid" });
  });

  it("recusa caminho fora da versão declarada", () => {
    // Sem isso, um manifesto poderia apontar para arquivo de outra versão — ou
    // para fora do pacote — mantendo hashes coerentes entre si.
    const { manifest } = buildFixture();
    const files = manifest.files.map((file, index) =>
      index === 0 ? { ...file, path: "/biblia-offline/outra-versao/GEN.json" } : file,
    );
    expect(verifyManifest({ ...manifest, files })).toEqual({ ok: false, reason: "manifest_invalid" });
  });

  it("recusa travessia de diretório no caminho", () => {
    const { manifest } = buildFixture();
    const files = manifest.files.map((file, index) =>
      index === 0
        ? { ...file, path: `/biblia-offline/${manifest.version}/../../etc/GEN.json` }
        : file,
    );
    expect(verifyManifest({ ...manifest, files })).toEqual({ ok: false, reason: "manifest_invalid" });
  });

  it("recusa livro repetido", () => {
    const { manifest } = buildFixture();
    const files = [manifest.files[0], { ...manifest.files[0], order: 2 }];
    const totals = {
      books: 2,
      chapters: manifest.files[0].chapters * 2,
      verses: manifest.files[0].verses * 2,
      bytes: manifest.files[0].bytes * 2,
    };
    expect(verifyManifest({ ...manifest, files, totals })).toEqual({
      ok: false,
      reason: "manifest_invalid",
    });
  });

  it("recusa arquivo acima do teto de tamanho", () => {
    const { manifest } = buildFixture();
    const files = manifest.files.map((file, index) =>
      index === 0 ? { ...file, bytes: OFFLINE_FILE_BYTES_LIMIT + 1 } : file,
    );
    const totals = {
      ...manifest.totals,
      bytes: files.reduce((total, file) => total + file.bytes, 0),
    };
    expect(verifyManifest({ ...manifest, files, totals })).toEqual({
      ok: false,
      reason: "size_over_budget",
    });
  });

  it("recusa número de arquivos diferente do total de livros", () => {
    const { manifest } = buildFixture();
    expect(verifyManifest({ ...manifest, totals: { ...manifest.totals, books: 3 } })).toEqual({
      ok: false,
      reason: "manifest_invalid",
    });
  });

  it("recusa campo desconhecido no manifesto", () => {
    // `strict` fecha a porta para um campo que o app ignoraria e um atacante
    // usaria para carregar carga útil junto do metadado.
    const { manifest } = buildFixture();
    expect(verifyManifest({ ...manifest, extra: "x" })).toEqual({
      ok: false,
      reason: "manifest_invalid",
    });
  });
});

describe("arquivo de livro", () => {
  it("aceita o arquivo íntegro", () => {
    const { manifest, files } = buildFixture();
    const file = files[0];
    const result = verifyBookFile(
      file.entry,
      manifest.version,
      file.entry.bytes,
      file.entry.sha256,
      JSON.parse(file.text),
    );
    expect(result.ok).toBe(true);
  });

  it("recusa hash divergente", () => {
    const { manifest, files } = buildFixture();
    const file = files[0];
    expect(
      verifyBookFile(file.entry, manifest.version, file.entry.bytes, digest("outro"), JSON.parse(file.text)),
    ).toEqual({ ok: false, reason: "hash_mismatch" });
  });

  it("recusa tamanho divergente antes de olhar o hash", () => {
    const { manifest, files } = buildFixture();
    const file = files[0];
    expect(
      verifyBookFile(file.entry, manifest.version, file.entry.bytes - 1, file.entry.sha256, JSON.parse(file.text)),
    ).toEqual({ ok: false, reason: "size_mismatch" });
  });

  it("recusa arquivo legítimo de outro livro", () => {
    // Caso real de cache intermediário ou caminho trocado: o arquivo é válido,
    // o hash é de um arquivo válido, só não é o arquivo pedido.
    const { manifest, files } = buildFixture();
    const outro = files[1];
    expect(
      verifyBookFile(
        files[0].entry,
        manifest.version,
        outro.entry.bytes,
        outro.entry.sha256,
        JSON.parse(outro.text),
      ),
    ).toEqual({ ok: false, reason: "size_mismatch" });
  });

  it("recusa arquivo de outro livro quando tamanho e hash coincidem com a entrada", () => {
    // Caso em que só a conferência de livro pega: a entrada do manifesto diz
    // GEN, mas o arquivo íntegro que chegou é o de Êxodo.
    const { manifest, files } = buildFixture();
    const outro = files[1];
    expect(
      verifyBookFile(
        { ...outro.entry, book: "GEN" },
        manifest.version,
        outro.entry.bytes,
        outro.entry.sha256,
        JSON.parse(outro.text),
      ),
    ).toEqual({ ok: false, reason: "file_unexpected_book" });
  });

  it("recusa arquivo de outra versão do pacote", () => {
    const { manifest, files } = buildFixture();
    const file = files[0];
    const parsed = { ...(JSON.parse(file.text) as object), version: digest("versao-antiga") };
    const text = canonicalJson(parsed);
    expect(
      verifyBookFile(
        { ...file.entry, bytes: sizeInBytes(text), sha256: digest(text) },
        manifest.version,
        sizeInBytes(text),
        digest(text),
        parsed,
      ),
    ).toEqual({ ok: false, reason: "file_version_mismatch" });
  });

  it("recusa contagem de capítulos diferente da declarada", () => {
    const { manifest, files } = buildFixture();
    const file = files[0];
    const parsed = JSON.parse(file.text) as { chapters: string[][] };
    parsed.chapters = [parsed.chapters[0]];
    const text = canonicalJson(parsed);
    expect(
      verifyBookFile(
        { ...file.entry, bytes: sizeInBytes(text), sha256: digest(text) },
        manifest.version,
        sizeInBytes(text),
        digest(text),
        parsed,
      ),
    ).toEqual({ ok: false, reason: "file_invalid" });
  });

  it("recusa versículo vazio", () => {
    const { manifest, files } = buildFixture();
    const file = files[0];
    const parsed = JSON.parse(file.text) as { chapters: string[][] };
    parsed.chapters[0][1] = "";
    const text = canonicalJson(parsed);
    expect(
      verifyBookFile(
        { ...file.entry, bytes: sizeInBytes(text), sha256: digest(text) },
        manifest.version,
        sizeInBytes(text),
        digest(text),
        parsed,
      ),
    ).toEqual({ ok: false, reason: "file_invalid" });
  });
});

describe("versão derivada do conteúdo", () => {
  it("é a mesma para o mesmo conteúdo e muda com o conteúdo", async () => {
    const { manifest } = buildFixture();
    const body = { ...manifest, version: undefined } as unknown as Omit<OfflineManifest, "version">;
    delete (body as { version?: string }).version;
    const primeira = await derivePackageVersion(body, async (text) => digest(text));
    const segunda = await derivePackageVersion(body, async (text) => digest(text));
    expect(primeira).toBe(segunda);

    const alterado = {
      ...body,
      files: body.files.map((file, index) =>
        index === 0 ? { ...file, sha256: digest("texto revisado") } : file,
      ),
    };
    expect(await derivePackageVersion(alterado, async (text) => digest(text))).not.toBe(primeira);
  });
});

describe("numeração contígua", () => {
  it("aceita 1..n em todos os capítulos", () => {
    expect(() =>
      assertContiguousNumbering("GEN", [
        { number: 1, verses: [{ number: 1 }, { number: 2 }] },
        { number: 2, verses: [{ number: 1 }] },
      ]),
    ).not.toThrow();
  });

  it("falha, em vez de renumerar em silêncio, quando há lacuna", () => {
    // O formato guarda versículo por posição. Acomodar a lacuna mostraria o
    // versículo 3 sob o número 2.
    expect(() =>
      assertContiguousNumbering("GEN", [{ number: 1, verses: [{ number: 1 }, { number: 3 }] }]),
    ).toThrow(/numeração não contígua/u);
  });

  it("falha com capítulo fora de sequência", () => {
    expect(() =>
      assertContiguousNumbering("GEN", [{ number: 2, verses: [{ number: 1 }] }]),
    ).toThrow(/fora de sequência/u);
  });
});

describe("guarda de conteúdo público", () => {
  it("não acusa prosa bíblica", () => {
    // Regressão: a primeira versão da guarda procurava a palavra `secret` e
    // recusou o pacote inteiro por causa de 1Cr 18:16. Em JavaScript `\b` é
    // ASCII, então a letra acentuada de "secretário" conta como fronteira.
    expect(() => assertPublicPayload("1CH.json", "e Sausa, secretário;")).not.toThrow();
    expect(() => assertPublicPayload("EZR.json", "e Sinsai secretário, e os demais")).not.toThrow();
    expect(() => assertPublicPayload("PSA.json", "Minha senha é o Senhor")).not.toThrow();
  });

  it("recusa UUID, token, URL de banco e chave privada", () => {
    expect(() => assertPublicPayload("x", "id 9a809518-da7a-4d11-ba5b-400a9c62b840")).toThrow(/suspeito/u);
    expect(() => assertPublicPayload("x", "token: abc123")).toThrow(/suspeito/u);
    expect(() => assertPublicPayload("x", "postgresql://user@host/db")).toThrow(/suspeito/u);
    expect(() => assertPublicPayload("x", "-----BEGIN RSA PRIVATE KEY-----")).toThrow(/suspeito/u);
    expect(() =>
      assertPublicPayload("x", "Authorization: Bearer abcdefghijklmnopqrstuvwx"),
    ).toThrow(/suspeito/u);
    expect(() =>
      assertPublicPayload("x", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0"),
    ).toThrow(/suspeito/u);
  });
});

describe("tamanho mostrado a quem decide baixar", () => {
  it("usa vírgula decimal e unidade legível", () => {
    expect(describeDownloadSize(4165893)).toBe("4,0 MB");
    expect(describeDownloadSize(241877)).toBe("236 KB");
    expect(describeDownloadSize(900)).toBe("900 B");
  });
});
