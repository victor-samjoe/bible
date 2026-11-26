import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  checkForUpdate,
  installPackage,
  installedManifestEtag,
  shouldCheckForUpdate,
  type BookFetch,
  type ManifestFetch,
  type OfflineSource,
} from "../../src/client/offline/install";
import { dedupe } from "../../src/client/offline/source";
import {
  INSTALL_LEASE_MS,
  type InstallationRecord,
  type OfflineStore,
  type PreferenceRecord,
} from "../../src/client/offline/storage";
import {
  OFFLINE_PACKAGE_SCHEMA,
  canonicalJson,
  planUpdate,
  sizeInBytes,
  type OfflineFileEntry,
  type OfflineManifest,
} from "../../src/domain/offline/package";

const digest = async (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const digestSync = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

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

type Fixture = {
  manifest: OfflineManifest;
  texts: Map<string, string>;
};

function fixture(version = "a".repeat(64), text = "No princípio."): Fixture {
  const books = [
    { code: "GEN", name: "Gênesis", slug: "genesis", chapters: [[text, "E a terra."]] },
    { code: "EXO", name: "Êxodo", slug: "exodo", chapters: [["Estes são os nomes."], ["E foi um homem."]] },
  ];

  const texts = new Map<string, string>();
  const files: OfflineFileEntry[] = books.map((book, index) => {
    const payload = canonicalJson({
      schema: OFFLINE_PACKAGE_SCHEMA,
      version,
      book: book.code,
      name: book.name,
      attribution: edition.attribution,
      chapters: book.chapters,
    });
    const path = `/biblia-offline/${version}/${book.code}.json`;
    texts.set(path, payload);
    return {
      book: book.code,
      name: book.name,
      slug: book.slug,
      order: index + 1,
      path,
      chapters: book.chapters.length,
      verses: book.chapters.reduce((total, chapter) => total + chapter.length, 0),
      bytes: sizeInBytes(payload),
      sha256: digestSync(payload),
      contentSha256: digestSync(canonicalJson({ book: book.code, chapters: book.chapters })),
    };
  });

  return {
    texts,
    manifest: {
      schema: OFFLINE_PACKAGE_SCHEMA,
      version,
      edition,
      totals: {
        books: files.length,
        chapters: files.reduce((total, file) => total + file.chapters, 0),
        verses: files.reduce((total, file) => total + file.verses, 0),
        bytes: files.reduce((total, file) => total + file.bytes, 0),
      },
      files,
    },
  };
}

/** Fonte de rede controlável: cada caso descreve exatamente o que chega. */
function sourceFrom(
  fixtureData: Fixture,
  behaviour: {
    manifest?: ManifestFetch;
    book?: (entry: OfflineFileEntry, attempt: number) => BookFetch | undefined;
  } = {},
): OfflineSource & { attempts: Map<string, number>; etagsEnviados: (string | null)[] } {
  const attempts = new Map<string, number>();
  const etagsEnviados: (string | null)[] = [];
  return {
    attempts,
    etagsEnviados,
    async fetchManifest(etag) {
      etagsEnviados.push(etag);
      return (
        behaviour.manifest ?? {
          status: "fresh",
          parsed: JSON.parse(canonicalJson(fixtureData.manifest)) as unknown,
          etag: '"v1"',
        }
      );
    },
    async fetchBook(entry) {
      const attempt = (attempts.get(entry.book) ?? 0) + 1;
      attempts.set(entry.book, attempt);
      const override = behaviour.book?.(entry, attempt);
      if (override) return override;
      const text = fixtureData.texts.get(entry.path);
      if (!text) return { status: "unreachable" };
      return { status: "fetched", text, bytes: sizeInBytes(text) };
    },
  };
}

/** Armazenamento em memória, com os mesmos invariantes do IndexedDB real. */
function storeFrom(
  options: { preference?: PreferenceRecord | null; failWith?: Error; now?: () => number } = {},
) {
  const agora = options.now ?? (() => 1_000);
  const chapters = new Map<string, readonly string[]>();
  const staging = new Map<string, { chapters: number; stagedAt: number }>();
  const copies: string[] = [];
  let installation: InstallationRecord | null = null;
  let preference: PreferenceRecord | null =
    options.preference ?? {
      enabled: true,
      decidedAt: 1,
      lastCheckedAt: null,
      lastKnownVersion: null,
      lastEtag: null,
      revision: 0,
    };
  let promotions = 0;
  let lease: { owner: string; expiresAt: number } | null = null;

  const store: OfflineStore = {
    async readInstallation() {
      return installation;
    },
    async readPreference() {
      return preference;
    },
    async updatePreference(expectedRevision, next) {
      const atual = preference === null ? null : preference.revision;
      if (atual !== expectedRevision) return { ok: false, current: preference };
      preference = { ...next, revision: (atual ?? -1) + 1 };
      return { ok: true, preference };
    },
    async readChapter(version, book, chapter) {
      const verses = chapters.get(`${version}:${book}:${chapter}`);
      return verses ? { key: `${version}:${book}:${chapter}`, book, chapter, verses } : null;
    },
    async stageBook(version, book, bookChapters) {
      if (options.failWith) throw options.failWith;
      bookChapters.forEach((verses, index) => {
        chapters.set(`${version}:${book}:${index + 1}`, verses);
      });
      staging.set(`${version}:${book}`, { chapters: bookChapters.length, stagedAt: agora() });
    },
    async copyBook(fromVersion, toVersion, book, bookChapters) {
      let copied = 0;
      for (let chapter = 1; chapter <= bookChapters; chapter += 1) {
        const verses = chapters.get(`${fromVersion}:${book}:${chapter}`);
        if (!verses) break;
        chapters.set(`${toVersion}:${book}:${chapter}`, verses);
        copied += 1;
      }
      if (copied !== bookChapters) throw new Error(`${book}: ${copied} de ${bookChapters} capítulos`);
      staging.set(`${toVersion}:${book}`, { chapters: bookChapters, stagedAt: agora() });
      copies.push(book);
    },
    async stagedBooks(version) {
      const found = new Set<string>();
      for (const key of staging.keys()) {
        if (key.startsWith(`${version}:`)) found.add(key.slice(version.length + 1));
      }
      return found;
    },
    async promoteIfConsented(next, expectedRevision) {
      // Mesmas condições do IndexedDB real, na mesma ordem e com os mesmos dois
      // motivos: o teste não valeria nada se aqui fosse mais permissivo — nem
      // se confundisse revogação com mudança de metadados, que é justamente o
      // defeito que estes testes passaram a cobrir.
      if (preference?.enabled !== true) return { ok: false, reason: "consent_revoked" };
      if ((preference?.revision ?? null) !== expectedRevision) {
        return { ok: false, reason: "preference_changed" };
      }
      promotions += 1;
      installation = next;
      // Só as marcas desta versão, como no real: um instalador concorrente de
      // outra versão não perde a retomada.
      for (const key of [...staging.keys()]) {
        if (key.startsWith(`${next.version}:`)) staging.delete(key);
      }
      return { ok: true };
    },
    async acquireInstallLease(owner, now) {
      if (lease !== null && lease.owner !== owner && lease.expiresAt > now) return false;
      lease = { owner, expiresAt: now + INSTALL_LEASE_MS };
      return true;
    },
    async releaseInstallLease(owner) {
      if (lease?.owner === owner) lease = null;
    },
    async pruneOtherVersions(keep) {
      // As três guardas do real: só poda se `keep` for a instalação ativa,
      // nunca toca na ativa, e poupa qualquer versão com marca de `staging`.
      if (installation?.version !== keep) return 0;
      const emObra = new Set<string>();
      for (const key of staging.keys()) {
        const versao = key.slice(0, key.indexOf(":"));
        if (versao === keep) continue;
        emObra.add(versao);
      }
      let removed = 0;
      for (const key of [...chapters.keys()]) {
        const versao = key.slice(0, key.indexOf(":"));
        if (versao === keep || emObra.has(versao)) continue;
        chapters.delete(key);
        removed += 1;
      }
      return removed;
    },
    async discardStagedVersion(version) {
      if (installation?.version === version) return { ok: false, reason: "active_installation" };
      let removed = 0;
      for (const key of [...chapters.keys()]) {
        if (key.startsWith(`${version}:`)) {
          chapters.delete(key);
          removed += 1;
        }
      }
      for (const key of [...staging.keys()]) {
        if (key.startsWith(`${version}:`)) staging.delete(key);
      }
      return { ok: true, removed };
    },
    async removeIfStillDisabled(expectedRevision) {
      if (preference?.enabled !== false || preference.revision !== expectedRevision) {
        return { ok: false, reason: "preference_changed" };
      }
      chapters.clear();
      staging.clear();
      installation = null;
      return { ok: true };
    },
    close() {},
  };

  return {
    store,
    chapters,
    staging,
    copies,
    get installation() {
      return installation;
    },
    get promotions() {
      return promotions;
    },
    set installation(value: InstallationRecord | null) {
      installation = value;
    },
    get preference() {
      return preference;
    },
    set preference(value: PreferenceRecord | null) {
      preference = value;
    },
    get lease() {
      return lease;
    },
  };
}

const alwaysNow = () => 1_700_000_000_000;

describe("instalação do pacote", () => {
  it("instala os dois livros, promove uma vez e serve o capítulo", async () => {
    const data = fixture();
    const held = storeFrom();
    const result = await installPackage(data.manifest, sourceFrom(data), held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });

    expect(result.ok).toBe(true);
    expect(held.promotions).toBe(1);
    expect(held.installation?.version).toBe(data.manifest.version);
    const chapter = await held.store.readChapter(data.manifest.version, "GEN", 1);
    expect(chapter?.verses).toEqual(["No princípio.", "E a terra."]);
  });

  it("não começa sem consentimento registrado", async () => {
    const data = fixture();
    const held = storeFrom({ preference: { enabled: false, decidedAt: 1, lastCheckedAt: null, lastKnownVersion: null, lastEtag: null, revision: 0 } });
    const source = sourceFrom(data);
    const result = await installPackage(data.manifest, source, held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });

    expect(result).toEqual({ ok: false, reason: "consent_absent" });
    // Nem uma requisição: recusa antes de gastar dados de quem não pediu.
    expect(source.attempts.size).toBe(0);
    expect(held.promotions).toBe(0);
  });

  it("preserva o pacote anterior quando a rede cai no meio", async () => {
    const antigo = fixture("b".repeat(64), "Texto da versão anterior.");
    const held = storeFrom();
    await installPackage(antigo.manifest, sourceFrom(antigo), held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });

    const novo = fixture("c".repeat(64), "Texto revisado.");
    const result = await installPackage(
      novo.manifest,
      sourceFrom(novo, { book: (entry) => (entry.book === "EXO" ? { status: "unreachable" } : undefined) }),
      held.store,
      digest,
      { preference: await held.store.readPreference(), now: alwaysNow },
    );

    expect(result).toEqual({ ok: false, reason: "source_unreachable" });
    // O ponteiro não se moveu: o leitor continua servindo o texto anterior.
    expect(held.installation?.version).toBe(antigo.manifest.version);
    const chapter = await held.store.readChapter(antigo.manifest.version, "GEN", 1);
    expect(chapter?.verses[0]).toBe("Texto da versão anterior.");
  });

  it("retoma de onde parou, sem rebaixar o que já foi verificado", async () => {
    const data = fixture();
    const held = storeFrom();
    const primeira = sourceFrom(data, {
      book: (entry) => (entry.book === "EXO" ? { status: "unreachable" } : undefined),
    });
    await installPackage(data.manifest, primeira, held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });
    expect(primeira.attempts.get("GEN")).toBe(1);

    const segunda = sourceFrom(data);
    const result = await installPackage(data.manifest, segunda, held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.resumedBooks).toBe(1);
    // Gênesis não foi baixado de novo.
    expect(segunda.attempts.has("GEN")).toBe(false);
    expect(segunda.attempts.get("EXO")).toBe(1);
  });

  it("recusa arquivo corrompido depois de uma segunda tentativa e não grava nada", async () => {
    const data = fixture();
    const held = storeFrom();
    const source = sourceFrom(data, {
      book: (entry) =>
        entry.book === "GEN" ? { status: "fetched", text: "conteúdo adulterado", bytes: entry.bytes } : undefined,
    });

    const result = await installPackage(data.manifest, source, held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });

    expect(result).toEqual({ ok: false, reason: "hash_mismatch" });
    expect(source.attempts.get("GEN")).toBe(2);
    expect(held.chapters.size).toBe(0);
    expect(held.promotions).toBe(0);
  });

  it("aceita na segunda tentativa quando a primeira resposta veio truncada", async () => {
    const data = fixture();
    const held = storeFrom();
    const source = sourceFrom(data, {
      book: (entry, attempt) =>
        entry.book === "GEN" && attempt === 1
          ? { status: "fetched", text: "{\"schema\":\"samjoe", bytes: 17 }
          : undefined,
    });

    const result = await installPackage(data.manifest, source, held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });

    expect(result.ok).toBe(true);
    expect(source.attempts.get("GEN")).toBe(2);
  });

  it("distingue falta de espaço de falha de rede", async () => {
    const data = fixture();
    const erro = new Error("Quota exceeded");
    erro.name = "QuotaExceededError";
    const held = storeFrom({ failWith: erro });

    const result = await installPackage(data.manifest, sourceFrom(data), held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });

    expect(result).toEqual({ ok: false, reason: "storage_full" });
    expect(held.promotions).toBe(0);
  });

  it("para quando a instalação é cancelada e não promove", async () => {
    const data = fixture();
    const held = storeFrom();
    const signal = { aborted: true };

    const result = await installPackage(data.manifest, sourceFrom(data), held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
      signal,
    });

    expect(result).toEqual({ ok: false, reason: "aborted" });
    expect(held.promotions).toBe(0);
  });

  it("limpa a versão anterior somente depois da troca", async () => {
    const antigo = fixture("d".repeat(64), "Antes.");
    const held = storeFrom();
    await installPackage(antigo.manifest, sourceFrom(antigo), held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });
    const antesDaTroca = held.chapters.size;

    const novo = fixture("e".repeat(64), "Depois.");
    const result = await installPackage(novo.manifest, sourceFrom(novo), held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.prunedChapters).toBe(antesDaTroca);
    expect(await held.store.readChapter(antigo.manifest.version, "GEN", 1)).toBeNull();
    expect((await held.store.readChapter(novo.manifest.version, "GEN", 1))?.verses[0]).toBe("Depois.");
  });

  it("informa progresso em livros e bytes", async () => {
    const data = fixture();
    const held = storeFrom();
    const passos: string[] = [];
    await installPackage(data.manifest, sourceFrom(data), held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
      onProgress: (p) => passos.push(`${p.booksDone}/${p.booksTotal} ${p.bytesDone}/${p.bytesTotal}`),
    });

    expect(passos[0]).toBe(`0/2 0/${data.manifest.totals.bytes}`);
    expect(passos.at(-1)).toBe(`2/2 ${data.manifest.totals.bytes}/${data.manifest.totals.bytes}`);
  });
});

describe("atualização reaproveitando o que já está salvo", () => {
  /** Igual ao `fixture`, mas muda o texto de um livro só. */
  function fixtureComExodoRevisado(version: string): Fixture {
    const base = fixture(version);
    const alvo = base.manifest.files.find((entry) => entry.book === "EXO");
    if (!alvo) throw new Error("fixture sem Êxodo");
    const chapters = [["Estes são os nomes, revisado."], ["E foi um homem."]];
    const payload = canonicalJson({
      schema: OFFLINE_PACKAGE_SCHEMA,
      version,
      book: "EXO",
      name: "Êxodo",
      attribution: edition.attribution,
      chapters,
    });
    base.texts.set(alvo.path, payload);
    const files = base.manifest.files.map((entry) =>
      entry.book === "EXO"
        ? {
            ...entry,
            bytes: sizeInBytes(payload),
            sha256: digestSync(payload),
            contentSha256: digestSync(canonicalJson({ book: "EXO", chapters })),
          }
        : entry,
    );
    return {
      texts: base.texts,
      manifest: {
        ...base.manifest,
        totals: { ...base.manifest.totals, bytes: files.reduce((total, f) => total + f.bytes, 0) },
        files,
      },
    };
  }

  it("baixa somente o livro que mudou e copia o resto do aparelho", async () => {
    const antigo = fixture("1".repeat(64));
    const held = storeFrom();
    await installPackage(antigo.manifest, sourceFrom(antigo), held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });

    const novo = fixtureComExodoRevisado("2".repeat(64));
    const source = sourceFrom(novo);
    const result = await installPackage(novo.manifest, source, held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
      installed: held.installation,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reusedBooks).toBe(1);
      expect(result.downloadedBytes).toBe(
        novo.manifest.files.find((entry) => entry.book === "EXO")?.bytes,
      );
    }
    // Gênesis não trafegou; Êxodo sim.
    expect(source.attempts.has("GEN")).toBe(false);
    expect(source.attempts.get("EXO")).toBe(1);
    expect(held.copies).toEqual(["GEN"]);

    // E o texto dos dois livros está correto na versão nova.
    expect((await held.store.readChapter(novo.manifest.version, "GEN", 1))?.verses[0]).toBe("No princípio.");
    expect((await held.store.readChapter(novo.manifest.version, "EXO", 1))?.verses[0]).toBe(
      "Estes são os nomes, revisado.",
    );
  });

  it("sem instalação anterior, baixa tudo", async () => {
    const data = fixture("3".repeat(64));
    const held = storeFrom();
    const source = sourceFrom(data);
    const result = await installPackage(data.manifest, source, held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
      installed: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reusedBooks).toBe(0);
      expect(result.downloadedBytes).toBe(data.manifest.totals.bytes);
    }
    expect(held.copies).toEqual([]);
  });

  it("baixa o livro quando a cópia local falha, em vez de instalar incompleto", async () => {
    const antigo = fixture("4".repeat(64));
    const held = storeFrom();
    await installPackage(antigo.manifest, sourceFrom(antigo), held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });
    // Simula instalação anterior corrompida: falta um capítulo de Gênesis.
    held.chapters.delete(`${antigo.manifest.version}:GEN:1`);

    const novo = fixtureComExodoRevisado("5".repeat(64));
    const source = sourceFrom(novo);
    const result = await installPackage(novo.manifest, source, held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
      installed: held.installation,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reusedBooks).toBe(0);
    expect(source.attempts.get("GEN")).toBe(1);
  });
});

describe("plano de atualização", () => {
  it("compara por hash de conteúdo, não por nome nem posição", () => {
    const antigo = fixture("6".repeat(64));
    const novo = fixture("7".repeat(64));
    // Mesmo texto, versão diferente: tudo reaproveitável.
    const plano = planUpdate(novo.manifest, antigo.manifest);
    expect(plano.reusable.map((entry) => entry.book)).toEqual(["GEN", "EXO"]);
    expect(plano.toDownload).toEqual([]);
  });

  it("sem instalação anterior, nada é reaproveitável", () => {
    const novo = fixture("8".repeat(64));
    const plano = planUpdate(novo.manifest, null);
    expect(plano.reusable).toEqual([]);
    expect(plano.toDownload).toHaveLength(2);
  });

  it("não reaproveita quando as quantidades não coincidem", () => {
    const antigo = fixture("9".repeat(64));
    const novo = fixture("a".repeat(64));
    const adulterado = {
      ...antigo.manifest,
      files: antigo.manifest.files.map((entry) =>
        entry.book === "GEN" ? { ...entry, chapters: entry.chapters + 1 } : entry,
      ),
    };
    const plano = planUpdate(novo.manifest, adulterado);
    expect(plano.reusable.map((entry) => entry.book)).toEqual(["EXO"]);
    expect(plano.toDownload.map((entry) => entry.book)).toEqual(["GEN"]);
  });
});

describe("verificação de versão", () => {
  it("reconhece pacote já atual", async () => {
    const data = fixture();
    const held = storeFrom();
    await installPackage(data.manifest, sourceFrom(data), held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });

    const result = await checkForUpdate(sourceFrom(data), held.installation, null);
    expect(result).toEqual({ ok: true, state: "current", version: data.manifest.version, etag: '"v1"' });
  });

  it("trata 304 como 'não mudou', sem baixar o manifesto de novo", async () => {
    const data = fixture();
    const held = storeFrom();
    await installPackage(data.manifest, sourceFrom(data), held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });

    const result = await checkForUpdate(
      sourceFrom(data, { manifest: { status: "unchanged", etag: '"v1"' } }),
      held.installation,
      '"v1"',
    );
    // O 304 devolve o mesmo ETag, que é guardado para a verificação seguinte.
    expect(result).toEqual({ ok: true, state: "unchanged", version: data.manifest.version, etag: '"v1"' });
  });

  it("anuncia versão nova sem instalar nada por conta própria", async () => {
    const antigo = fixture("f".repeat(64));
    const held = storeFrom();
    await installPackage(antigo.manifest, sourceFrom(antigo), held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });

    const novo = fixture("0".repeat(64), "Texto revisado.");
    const result = await checkForUpdate(sourceFrom(novo), held.installation, null);

    expect(result.ok && result.state).toBe("available");
    // A verificação não troca o pacote: quem decide baixar é a pessoa.
    expect(held.installation?.version).toBe(antigo.manifest.version);
  });

  it("manda o ETag guardado, que é o que permite o 304", async () => {
    const data = fixture();
    const source = sourceFrom(data);
    const held = storeFrom();
    await installPackage(data.manifest, sourceFrom(data), held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
    });
    await checkForUpdate(source, held.installation, '"abc"');
    expect(source.etagsEnviados).toEqual(['"abc"']);
  });

  it("servidor fora do ar não vira pacote inválido", async () => {
    const data = fixture();
    const result = await checkForUpdate(
      sourceFrom(data, { manifest: { status: "unreachable" } }),
      null,
      null,
    );
    expect(result).toEqual({ ok: false, reason: "source_unreachable" });
  });

  it("recusa manifesto adulterado em vez de instalar", async () => {
    const data = fixture();
    const result = await checkForUpdate(
      sourceFrom(data, {
        manifest: {
          status: "fresh",
          parsed: { ...data.manifest, totals: { ...data.manifest.totals, verses: 99 } },
          etag: null,
        },
      }),
      null,
      null,
    );
    expect(result).toEqual({ ok: false, reason: "manifest_invalid" });
  });
});

describe("quando verificar atualização", () => {
  const habilitado = (lastCheckedAt: number | null): PreferenceRecord => ({
    enabled: true,
    decidedAt: 0,
    revision: 0,
    lastCheckedAt,
    lastKnownVersion: null,
    lastEtag: null,
  });

  it("não verifica para quem não ativou o download", () => {
    const recusou: PreferenceRecord = { enabled: false, decidedAt: 0, lastCheckedAt: null, lastKnownVersion: null, lastEtag: null, revision: 0 };
    expect(shouldCheckForUpdate(recusou, "login", 10)).toBe(false);
    expect(shouldCheckForUpdate(recusou, "bible_opened", 10)).toBe(false);
    expect(shouldCheckForUpdate(recusou, "reconnected", 10)).toBe(false);
    expect(shouldCheckForUpdate(null, "login", 10)).toBe(false);
  });

  it("verifica no login e na primeira abertura", () => {
    expect(shouldCheckForUpdate(habilitado(null), "login", 10)).toBe(true);
    expect(shouldCheckForUpdate(habilitado(null), "bible_opened", 10)).toBe(true);
  });

  it("verifica novamente quando a Bíblia é aberta", () => {
    const agora = 1_000_000_000;
    expect(shouldCheckForUpdate(habilitado(agora), "bible_opened", agora + 1000)).toBe(true);
  });

  it("verifica em cada login mesmo que a última consulta seja recente", () => {
    expect(shouldCheckForUpdate(habilitado(1_000), "login", 1_001)).toBe(true);
  });

  it("reavalia ao reconectar, ignorando o intervalo", () => {
    const agora = 1_000_000_000;
    expect(shouldCheckForUpdate(habilitado(agora), "reconnected", agora + 1000)).toBe(true);
  });
});

describe("validador do manifesto instalado", () => {
  it("busca o manifesto completo depois de remover o pacote, mesmo com ETag antigo", async () => {
    const source = sourceFrom(fixture());
    const result = await checkForUpdate(source, null, '"antigo"');
    expect(source.etagsEnviados).toEqual([null]);
    expect(result.ok && result.state).toBe("available");
  });

  it("não guarda o ETag de uma atualização ainda não instalada", () => {
    const next = fixture("b".repeat(64));
    expect(installedManifestEtag({ ok: true, state: "available", manifest: next.manifest, installedVersion: "a".repeat(64), etag: '"nova"' })).toBeNull();
    expect(installedManifestEtag({ ok: true, state: "current", version: next.manifest.version, etag: '"atual"' })).toBe('"atual"');
    expect(installedManifestEtag({ ok: false, reason: "source_unreachable" })).toBeNull();
  });
});

describe("deduplicação de verificações simultâneas", () => {
  it("três chamadas em voo viram uma", async () => {
    let chamadas = 0;
    let liberar = () => {};
    const bloqueada = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const verificar = dedupe(async () => {
      chamadas += 1;
      await bloqueada;
      return chamadas;
    });

    const todas = Promise.all([verificar(), verificar(), verificar()]);
    liberar();
    await todas;
    expect(chamadas).toBe(1);

    // Terminada a primeira, uma nova chamada volta a consultar.
    await verificar();
    expect(chamadas).toBe(2);
  });
});

/**
 * Corrida entre abas: remoção contra atualização.
 *
 * Cenário apontado na revisão de 25/11 e não coberto até aqui. O atualizador
 * lia a preferência, ia à rede e depois gravava a cópia velha; quem removia o
 * pacote na outra aba nesse intervalo via `enabled: true` voltar e o pacote
 * ser reinstalado.
 */
describe("remoção durante atualização, em duas abas", () => {
  const removendoNaOutraAba = (held: ReturnType<typeof storeFrom>) => {
    // O que a página de controles faz, na ordem corrigida: preferência
    // primeiro, com revisão nova, e só então apagar.
    const atual = held.preference;
    held.preference = {
      enabled: false,
      decidedAt: 2,
      lastCheckedAt: atual?.lastCheckedAt ?? null,
      lastKnownVersion: atual?.lastKnownVersion ?? null,
      lastEtag: atual?.lastEtag ?? null,
      revision: (atual?.revision ?? 0) + 1,
    };
  };

  it("não promove quando a pessoa remove durante o download", async () => {
    const data = fixture();
    const held = storeFrom();
    const preference = await held.store.readPreference();

    const source = sourceFrom(data, {
      book: (entry) => {
        // A remoção acontece enquanto o último livro está sendo baixado.
        if (entry.book === data.manifest.files[data.manifest.files.length - 1]?.book) {
          removendoNaOutraAba(held);
        }
        return undefined;
      },
    });

    const result = await installPackage(data.manifest, source, held.store, digest, {
      preference,
      now: alwaysNow,
      expectedRevision: preference?.revision ?? null,
    });

    expect(result).toEqual({ ok: false, reason: "consent_revoked" });
    expect(held.promotions).toBe(0);
    expect(held.installation).toBeNull();
    // E a remoção continua valendo: nada ressuscitou `enabled`.
    expect(held.preference?.enabled).toBe(false);
  });

  it("ETag gravado noutra aba não promove, e tem motivo próprio", async () => {
    // Caso mais sutil: a outra aba só guardou um ETag. A revisão mudou, então
    // esta instalação está trabalhando sobre uma decisão que já não é a atual
    // e para em vez de promover por conta própria.
    //
    // O motivo **não** pode ser `consent_revoked`. Era, e o verificador
    // respondia a esse motivo apagando o banco — então uma gravação de ETag
    // noutra aba apagava o pacote instalado. É o defeito da revisão de 19:29.
    const data = fixture();
    const held = storeFrom();
    const preference = await held.store.readPreference();

    const source = sourceFrom(data, {
      book: () => {
        const atual = held.preference;
        if (atual) held.preference = { ...atual, lastEtag: '"outro"', revision: atual.revision + 1 };
        return undefined;
      },
    });

    const result = await installPackage(data.manifest, source, held.store, digest, {
      preference,
      now: alwaysNow,
      expectedRevision: preference?.revision ?? null,
    });

    expect(result).toEqual({ ok: false, reason: "preference_changed" });
    expect(held.promotions).toBe(0);
    // E ninguém revogou nada: o consentimento continua de pé.
    expect(held.preference?.enabled).toBe(true);
  });

  it("a gravação da aba que perdeu a corrida é recusada, não aplicada", async () => {
    const held = storeFrom();
    const lida = await held.store.readPreference();
    if (!lida) throw new Error("fixture sem preferência");

    removendoNaOutraAba(held);

    // O atualizador tenta gravar com a revisão que leu antes da remoção.
    const resultado = await held.store.updatePreference(lida.revision, {
      ...lida,
      lastCheckedAt: 99,
    });

    expect(resultado.ok).toBe(false);
    expect(held.preference?.enabled).toBe(false);
    expect(held.preference?.lastCheckedAt).not.toBe(99);
  });

  it("a decisão da pessoa, com a revisão correta, é aplicada", async () => {
    const held = storeFrom();
    const lida = await held.store.readPreference();
    if (!lida) throw new Error("fixture sem preferência");

    const resultado = await held.store.updatePreference(lida.revision, { ...lida, enabled: false });
    expect(resultado.ok).toBe(true);
    expect(held.preference?.enabled).toBe(false);
    expect(held.preference?.revision).toBe(lida.revision + 1);
  });

  it("cancelar durante o último livro não ativa o pacote", async () => {
    // A conferência dentro do laço é no começo de cada livro; sem a conferência
    // extra antes da troca, quem cancelasse no 66º livro via o pacote ativado.
    const data = fixture();
    const held = storeFrom();
    const signal = { aborted: false };
    const ultimo = data.manifest.files[data.manifest.files.length - 1]?.book;

    const source = sourceFrom(data, {
      book: (entry) => {
        if (entry.book === ultimo) signal.aborted = true;
        return undefined;
      },
    });

    const result = await installPackage(data.manifest, source, held.store, digest, {
      preference: await held.store.readPreference(),
      now: alwaysNow,
      signal,
    });

    expect(result).toEqual({ ok: false, reason: "aborted" });
    expect(held.promotions).toBe(0);
    expect(held.installation).toBeNull();
  });
});

describe("arrendamento de instalação", () => {
  it("a segunda aba não entra enquanto a primeira detém o arrendamento", async () => {
    const held = storeFrom();
    expect(await held.store.acquireInstallLease("aba-1", 1_000)).toBe(true);
    expect(await held.store.acquireInstallLease("aba-2", 1_000)).toBe(false);
  });

  it("renovar o próprio arrendamento é permitido", async () => {
    const held = storeFrom();
    expect(await held.store.acquireInstallLease("aba-1", 1_000)).toBe(true);
    expect(await held.store.acquireInstallLease("aba-1", 2_000)).toBe(true);
  });

  it("arrendamento abandonado vence e outra aba assume", async () => {
    // Uma aba fechada no meio da instalação não tem `finally`. Sem prazo, o
    // download ficaria bloqueado para sempre.
    const held = storeFrom();
    expect(await held.store.acquireInstallLease("aba-1", 1_000)).toBe(true);
    expect(await held.store.acquireInstallLease("aba-2", 1_000 + 600_001)).toBe(true);
  });

  it("soltar o arrendamento de outra aba não funciona", async () => {
    const held = storeFrom();
    await held.store.acquireInstallLease("aba-1", 1_000);
    await held.store.releaseInstallLease("aba-2");
    expect(held.lease).not.toBeNull();
    await held.store.releaseInstallLease("aba-1");
    expect(held.lease).toBeNull();
  });

  it("remover não espera o arrendamento: a remoção nunca fica bloqueada", async () => {
    // Decisão de desenho: a remoção não pede o arrendamento. Quem pede para
    // remover não deve esperar um download de outra aba terminar — a revisão da
    // preferência é o que faz a promoção alheia falhar.
    const held = storeFrom();
    await held.store.acquireInstallLease("outra-aba", 1_000);
    const lida = await held.store.readPreference();
    if (!lida) throw new Error("fixture sem preferência");

    const resultado = await held.store.updatePreference(lida.revision, { ...lida, enabled: false });
    if (!resultado.ok) throw new Error("gravação da recusa recusada");
    expect(await held.store.removeIfStillDisabled(resultado.preference.revision)).toEqual({ ok: true });

    expect(resultado.ok).toBe(true);
    expect(held.installation).toBeNull();
  });
});

describe("limpeza: só o que é comprovadamente órfão", () => {
  const V1 = "1".repeat(64);
  const V2 = "2".repeat(64);
  const V3 = "3".repeat(64);

  /** Instala a versão 1 pelo caminho real, até a promoção. */
  async function comPacoteInstalado(options: { now?: () => number } = {}) {
    const data = fixture(V1);
    const held = storeFrom(options);
    const preference = await held.store.readPreference();
    const resultado = await installPackage(data.manifest, sourceFrom(data), held.store, digest, {
      preference,
      now: alwaysNow,
      expectedRevision: preference?.revision ?? null,
    });
    if (!resultado.ok) throw new Error(`fixture não instalou: ${resultado.reason}`);
    return { held, data };
  }

  it("mudança de ETag durante a atualização não apaga o pacote anterior", async () => {
    // O cenário exato da revisão. Antes: a promoção da v2 falhava com
    // `consent_revoked` porque a revisão havia mudado, o verificador chamava
    // `removeEverything()` e a pessoa perdia a v1 — que estava íntegra e que
    // ela não pediu para remover.
    const { held } = await comPacoteInstalado();
    const capitulosV1 = [...held.chapters.keys()].filter((k) => k.startsWith(`${V1}:`)).length;
    expect(capitulosV1).toBeGreaterThan(0);

    const dadosV2 = fixture(V2, "No princípio, revisado.");
    const preference = await held.store.readPreference();
    const resultado = await installPackage(dadosV2.manifest, sourceFrom(dadosV2), held.store, digest, {
      preference,
      now: alwaysNow,
      expectedRevision: preference?.revision ?? null,
      installed: held.installation,
      // Outra aba guarda um ETag no meio do download: sobe a revisão sem
      // desativar nada.
      onProgress: () => {
        const atual = held.preference;
        if (atual && atual.lastEtag === null) {
          held.preference = { ...atual, lastEtag: "w/outra-aba", revision: atual.revision + 1 };
        }
      },
    });

    expect(resultado).toEqual({ ok: false, reason: "preference_changed" });

    // É o que o verificador faz com esse motivo, no lugar de `removeEverything`.
    const limpeza = await held.store.discardStagedVersion(V2);
    expect(limpeza.ok).toBe(true);

    // O que precisa continuar de pé:
    expect(held.installation?.version).toBe(V1);
    expect([...held.chapters.keys()].filter((k) => k.startsWith(`${V1}:`))).toHaveLength(capitulosV1);
    expect([...held.chapters.keys()].filter((k) => k.startsWith(`${V2}:`))).toHaveLength(0);
    expect(held.preference?.enabled).toBe(true);
  });

  it("a limpeza recusa apagar a versão que outra aba acabou de promover", async () => {
    // Remoção real, e no intervalo entre a falha da promoção e a limpeza a
    // outra aba reativa e instala **a mesma versão**. O resíduo deixou de ser
    // resíduo: é o pacote da pessoa.
    const { held } = await comPacoteInstalado();
    held.chapters.set(`${V2}:GEN:1`, ["No princípio."]);
    held.installation = {
      schema: OFFLINE_PACKAGE_SCHEMA,
      version: V2,
      manifest: fixture(V2).manifest,
      installedAt: 1,
      chapters: 1,
    };

    expect(await held.store.discardStagedVersion(V2)).toEqual({
      ok: false,
      reason: "active_installation",
    });
    expect(held.chapters.get(`${V2}:GEN:1`)).toEqual(["No princípio."]);
    expect(held.installation?.version).toBe(V2);
  });

  it("remover não apaga nada se a recusa não ficou gravada", async () => {
    // As três tentativas de CAS falharam: `enabled: false` não está no banco.
    // Apagar aqui era dizer "removido" com o download ainda ativado — na
    // próxima verificação o pacote voltaria inteiro.
    const { held } = await comPacoteInstalado();
    const lida = await held.store.readPreference();
    if (!lida) throw new Error("fixture sem preferência");

    expect(await held.store.removeIfStillDisabled(lida.revision)).toEqual({
      ok: false,
      reason: "preference_changed",
    });
    expect(held.installation?.version).toBe(V1);
    expect([...held.chapters.keys()].length).toBeGreaterThan(0);
  });

  it("reativação entre a gravação da recusa e a limpeza impede a limpeza", async () => {
    const { held } = await comPacoteInstalado();
    const lida = await held.store.readPreference();
    if (!lida) throw new Error("fixture sem preferência");

    const recusa = await held.store.updatePreference(lida.revision, { ...lida, enabled: false });
    if (!recusa.ok) throw new Error("recusa não gravou");

    // Outra aba reativa antes de esta chegar à limpeza.
    const reativada = await held.store.updatePreference(recusa.preference.revision, {
      ...recusa.preference,
      enabled: true,
    });
    expect(reativada.ok).toBe(true);

    expect(await held.store.removeIfStillDisabled(recusa.preference.revision)).toEqual({
      ok: false,
      reason: "preference_changed",
    });
    expect(held.installation?.version).toBe(V1);
  });

  it("a remoção acontece quando a recusa é a decisão mais recente", async () => {
    const { held } = await comPacoteInstalado();
    const lida = await held.store.readPreference();
    if (!lida) throw new Error("fixture sem preferência");

    const recusa = await held.store.updatePreference(lida.revision, { ...lida, enabled: false });
    if (!recusa.ok) throw new Error("recusa não gravou");

    expect(await held.store.removeIfStillDisabled(recusa.preference.revision)).toEqual({ ok: true });
    expect(held.installation).toBeNull();
    expect([...held.chapters.keys()]).toHaveLength(0);
    expect([...held.staging.keys()]).toHaveLength(0);
    // A recusa sobrevive à remoção, senão o app voltaria a oferecer sozinho.
    expect(held.preference?.enabled).toBe(false);
  });

  it("a poda poupa a versão de um instalador concorrente", async () => {
    // Marca recente de `staging` em outra versão = instalador vivo. Apagar os
    // capítulos dele o faria baixar tudo de novo, e podia misturar versões.
    const agora = 10_000_000;
    const { held } = await comPacoteInstalado({ now: () => agora });
    held.chapters.set(`${V3}:GEN:1`, ["No princípio."]);
    held.staging.set(`${V3}:GEN`, { chapters: 1, stagedAt: agora - 1_000 });

    const removidos = await held.store.pruneOtherVersions(V1, agora);
    expect(removidos).toBe(0);
    expect(held.chapters.get(`${V3}:GEN:1`)).toBeDefined();
    expect(held.staging.get(`${V3}:GEN`)).toBeDefined();
  });

  it("a poda preserva marcas antigas de uma instalação possivelmente ativa", async () => {
    // O arrendamento pode vencer enquanto o download ainda está em curso.
    const agora = 10_000_000;
    const { held } = await comPacoteInstalado({ now: () => agora });
    held.chapters.set(`${V3}:GEN:1`, ["No princípio."]);
    held.staging.set(`${V3}:GEN`, { chapters: 1, stagedAt: agora - INSTALL_LEASE_MS - 1 });

    expect(await held.store.pruneOtherVersions(V1, agora)).toBe(0);
    expect(held.chapters.get(`${V3}:GEN:1`)).toBeDefined();
    expect(held.staging.get(`${V3}:GEN`)).toBeDefined();
    // E a instalação ativa continua inteira.
    expect([...held.chapters.keys()].some((k) => k.startsWith(`${V1}:`))).toBe(true);
    expect(held.installation?.version).toBe(V1);
  });

  it("a poda recusa trabalhar se a versão a manter não é a instalada", async () => {
    // Poda "mantendo" uma versão que não está ativa apagaria o pacote em uso.
    const { held } = await comPacoteInstalado();
    const antes = [...held.chapters.keys()].length;
    expect(await held.store.pruneOtherVersions(V2)).toBe(0);
    expect([...held.chapters.keys()].length).toBe(antes);
    expect(held.installation?.version).toBe(V1);
  });

  it("promover não apaga as marcas de retomada de outra versão", async () => {
    const agora = 10_000_000;
    const held = storeFrom({ now: () => agora });
    held.staging.set(`${V3}:GEN`, { chapters: 1, stagedAt: agora });
    const data = fixture(V1);
    const preference = await held.store.readPreference();
    const resultado = await installPackage(data.manifest, sourceFrom(data), held.store, digest, {
      preference,
      now: alwaysNow,
      expectedRevision: preference?.revision ?? null,
    });
    expect(resultado.ok).toBe(true);
    expect(held.staging.get(`${V3}:GEN`)).toBeDefined();
    expect([...held.staging.keys()].some((k) => k.startsWith(`${V1}:`))).toBe(false);
  });
});

describe("arrendamento vencido: dois instaladores de versões diferentes", () => {
  const V2 = "2".repeat(64);
  const V3 = "3".repeat(64);

  it("o ponteiro acaba numa versão inteira, nunca numa mistura", async () => {
    // Cenário aceito pelo prazo do arrendamento: uma instalação que passa de
    // dez minutos pode ganhar uma concorrente. O compromisso registrado é
    // "pior caso, trabalho repetido — nunca texto misturado". Este teste é o
    // que torna a afirmação verificável em vez de confiança no desenho.
    const agora = 10_000_000;
    const held = storeFrom({ now: () => agora });

    expect(await held.store.acquireInstallLease("aba-A", agora)).toBe(true);
    // Dez minutos depois, a aba A não terminou e a B assume.
    expect(await held.store.acquireInstallLease("aba-B", agora + INSTALL_LEASE_MS + 1)).toBe(true);

    const dadosA = fixture(V2, "No princípio.");
    const dadosB = fixture(V3, "No princípio, revisado.");
    const preference = await held.store.readPreference();

    const resultadoA = await installPackage(dadosA.manifest, sourceFrom(dadosA), held.store, digest, {
      preference,
      now: alwaysNow,
      expectedRevision: preference?.revision ?? null,
    });
    const resultadoB = await installPackage(dadosB.manifest, sourceFrom(dadosB), held.store, digest, {
      preference,
      now: alwaysNow,
      expectedRevision: preference?.revision ?? null,
    });

    // As duas promovem: nenhuma mexeu na preferência, então a condição do CAS
    // vale para as duas. Quem chega por último é o ponteiro.
    expect(resultadoA.ok).toBe(true);
    expect(resultadoB.ok).toBe(true);
    expect(held.installation?.version).toBe(V3);

    // O que importa: a versão apontada está **inteira** e é só dela o texto
    // servido. Gênesis 1 da v3 não pode vir com o texto da v2.
    const genesis = await held.store.readChapter(V3, "GEN", 1);
    expect(genesis?.verses[0]).toBe("No princípio, revisado.");
    for (const entry of dadosB.manifest.files) {
      const livro = await held.store.readChapter(V3, entry.book, 1);
      expect(livro).not.toBeNull();
    }
  });

  it("a poda da instaladora que perdeu não apaga o pacote da que venceu", async () => {
    // A perdedora chama `pruneOtherVersions(suaVersão)` depois de a outra já
    // ter trocado o ponteiro. Sem a guarda, isso apagaria exatamente os
    // capítulos da versão ativa — o pior resultado possível desta corrida.
    const agora = 10_000_000;
    const held = storeFrom({ now: () => agora });
    const dadosA = fixture(V2);
    const dadosB = fixture(V3, "No princípio, revisado.");
    const preference = await held.store.readPreference();

    await installPackage(dadosA.manifest, sourceFrom(dadosA), held.store, digest, {
      preference,
      now: alwaysNow,
      expectedRevision: preference?.revision ?? null,
    });
    await installPackage(dadosB.manifest, sourceFrom(dadosB), held.store, digest, {
      preference,
      now: alwaysNow,
      expectedRevision: preference?.revision ?? null,
    });
    expect(held.installation?.version).toBe(V3);

    expect(await held.store.pruneOtherVersions(V2, agora)).toBe(0);
    expect(await held.store.readChapter(V3, "GEN", 1)).not.toBeNull();
  });
});
