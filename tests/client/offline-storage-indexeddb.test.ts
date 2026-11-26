import { beforeEach, describe, expect, it } from "vitest";

import {
  INSTALL_LEASE_MS,
  openOfflineStore,
  withInstallLease,
  type InstallationRecord,
} from "../../src/client/offline/storage";
import { OFFLINE_PACKAGE_SCHEMA, type OfflineManifest } from "../../src/domain/offline/package";

/**
 * As guardas de limpeza e poda contra **IndexedDB de verdade**.
 *
 * Por que este arquivo existe separado: o duplo em memória de
 * `offline-install.test.ts` repete as mesmas condições na mesma ordem, mas não
 * repete o que o IndexedDB cobra — transação que se encerra sozinha quando a
 * fila de microtarefas esvazia, `abort` como caminho de falha do
 * compare-and-set, e faixa de chaves em `delete`. Essas três coisas são
 * exatamente onde as guardas vivem, e um duplo não as exercita.
 *
 * **Por que ele pula.** Não há `jsdom` nem `fake-indexeddb` instalados, e
 * instalar dependência é decisão registrada em
 * `tasks/product/CLAUDE1_DECISOES_PENDENTES.md` §6. Então o arquivo fica pronto
 * e se anuncia pulado em vez de dar a impressão de cobertura que não existe.
 * Com `fake-indexeddb/auto` no `setupFiles`, ou rodando em navegador, roda sem
 * mudar uma linha.
 */

const temIndexedDB = typeof indexedDB !== "undefined";

function manifestoFalso(version: string): OfflineManifest {
  // Só os campos que o registro de instalação precisa para ser relido; o
  // esquema completo é exercitado nos testes do domínio.
  return {
    schema: OFFLINE_PACKAGE_SCHEMA,
    version,
    edition: {
      identifier: "porbr2018",
      name: "Bíblia Livre (BLIVRE)",
      abbreviation: "BLIVRE",
      language: "pt-BR",
      canon: "66 livros",
      license: "CC BY 4.0 BR",
      licenseUrl: "https://example.test/licenca",
      attribution: "Atribuição de teste",
      sourceUrl: "https://example.test/fonte",
      archiveSha256: "f".repeat(64),
      sourceSignedAt: "2026-10-30 05:50",
      redistribution: "Permitida com atribuição",
    },
    totals: { books: 1, chapters: 1, verses: 1, bytes: 10 },
    files: [],
  } as unknown as OfflineManifest;
}

function instalacao(version: string): InstallationRecord {
  return {
    schema: OFFLINE_PACKAGE_SCHEMA,
    version,
    manifest: manifestoFalso(version),
    installedAt: 1_700_000_000_000,
    chapters: 1,
  };
}

async function apagarBanco(): Promise<void> {
  await new Promise<void>((resolve) => {
    const pedido = indexedDB.deleteDatabase("samjoe-offline");
    pedido.onsuccess = () => resolve();
    pedido.onerror = () => resolve();
    pedido.onblocked = () => resolve();
  });
}

const V1 = "1".repeat(64);
const V2 = "2".repeat(64);

describe.skipIf(!temIndexedDB)("armazenamento offline contra IndexedDB real", () => {
  beforeEach(async () => {
    await apagarBanco();
  });

  async function comPreferenciaAtiva() {
    const store = await openOfflineStore();
    const primeira = await store.updatePreference(null, {
      enabled: true,
      decidedAt: 1,
      lastCheckedAt: null,
      lastKnownVersion: null,
      lastEtag: null,
    });
    if (!primeira.ok) throw new Error("primeira preferência recusada");
    return { store, preference: primeira.preference };
  }

  it("o compare-and-set da preferência recusa quem perdeu a corrida", async () => {
    const { store, preference } = await comPreferenciaAtiva();
    try {
      const outra = await store.updatePreference(preference.revision, {
        ...preference,
        lastEtag: '"w/outra"',
      });
      expect(outra.ok).toBe(true);

      // A aba atrasada tenta gravar com a revisão velha.
      const atrasada = await store.updatePreference(preference.revision, {
        ...preference,
        enabled: false,
      });
      expect(atrasada.ok).toBe(false);
      const lida = await store.readPreference();
      expect(lida?.enabled).toBe(true);
    } finally {
      store.close();
    }
  });

  it("promoção devolve consent_revoked quando a pessoa desativou", async () => {
    const { store, preference } = await comPreferenciaAtiva();
    try {
      const recusa = await store.updatePreference(preference.revision, {
        ...preference,
        enabled: false,
      });
      if (!recusa.ok) throw new Error("recusa não gravou");

      const promovido = await store.promoteIfConsented(instalacao(V1), recusa.preference.revision);
      expect(promovido).toEqual({ ok: false, reason: "consent_revoked" });
      expect(await store.readInstallation()).toBeNull();
    } finally {
      store.close();
    }
  });

  it("promoção devolve preference_changed quando só a revisão mudou", async () => {
    // O defeito que apagava pacote instalado por gravação de ETag.
    const { store, preference } = await comPreferenciaAtiva();
    try {
      const etag = await store.updatePreference(preference.revision, {
        ...preference,
        lastEtag: '"w/outra"',
      });
      expect(etag.ok).toBe(true);

      const promovido = await store.promoteIfConsented(instalacao(V1), preference.revision);
      expect(promovido).toEqual({ ok: false, reason: "preference_changed" });
      expect((await store.readPreference())?.enabled).toBe(true);
    } finally {
      store.close();
    }
  });

  it("remoção condicionada não apaga quando a recusa não é a decisão atual", async () => {
    const { store, preference } = await comPreferenciaAtiva();
    try {
      await store.stageBook(V1, "GEN", [["No princípio."]]);
      const promovido = await store.promoteIfConsented(instalacao(V1), preference.revision);
      expect(promovido.ok).toBe(true);

      // A preferência segue ativa: nenhuma recusa foi gravada.
      expect(await store.removeIfStillDisabled(preference.revision)).toEqual({
        ok: false,
        reason: "preference_changed",
      });
      expect((await store.readInstallation())?.version).toBe(V1);
      expect(await store.readChapter(V1, "GEN", 1)).not.toBeNull();
    } finally {
      store.close();
    }
  });

  it("remoção condicionada apaga quando a recusa é a decisão atual", async () => {
    const { store, preference } = await comPreferenciaAtiva();
    try {
      await store.stageBook(V1, "GEN", [["No princípio."]]);
      await store.promoteIfConsented(instalacao(V1), preference.revision);

      const recusa = await store.updatePreference(preference.revision, {
        ...preference,
        enabled: false,
      });
      if (!recusa.ok) throw new Error("recusa não gravou");

      expect(await store.removeIfStillDisabled(recusa.preference.revision)).toEqual({ ok: true });
      expect(await store.readInstallation()).toBeNull();
      expect(await store.readChapter(V1, "GEN", 1)).toBeNull();
      // A recusa sobrevive à remoção.
      expect((await store.readPreference())?.enabled).toBe(false);
    } finally {
      store.close();
    }
  });

  it("descarte de versão apaga a faixa de chaves certa e poupa a ativa", async () => {
    const { store, preference } = await comPreferenciaAtiva();
    try {
      await store.stageBook(V1, "GEN", [["No princípio."]]);
      await store.promoteIfConsented(instalacao(V1), preference.revision);
      await store.stageBook(V2, "GEN", [["No princípio, revisado."]]);

      const descartado = await store.discardStagedVersion(V2);
      expect(descartado.ok).toBe(true);
      expect(await store.readChapter(V2, "GEN", 1)).toBeNull();
      // E a ativa continua inteira — é a faixa de chaves que separa as duas.
      expect(await store.readChapter(V1, "GEN", 1)).not.toBeNull();
      expect((await store.readInstallation())?.version).toBe(V1);
    } finally {
      store.close();
    }
  });

  it("descarte recusa apagar a versão ativa", async () => {
    const { store, preference } = await comPreferenciaAtiva();
    try {
      await store.stageBook(V1, "GEN", [["No princípio."]]);
      await store.promoteIfConsented(instalacao(V1), preference.revision);

      expect(await store.discardStagedVersion(V1)).toEqual({
        ok: false,
        reason: "active_installation",
      });
      expect(await store.readChapter(V1, "GEN", 1)).not.toBeNull();
    } finally {
      store.close();
    }
  });

  it("a poda recusa trabalhar quando a versão a manter não é a instalada", async () => {
    const { store, preference } = await comPreferenciaAtiva();
    try {
      await store.stageBook(V1, "GEN", [["No princípio."]]);
      await store.promoteIfConsented(instalacao(V1), preference.revision);

      expect(await store.pruneOtherVersions(V2)).toBe(0);
      expect(await store.readChapter(V1, "GEN", 1)).not.toBeNull();
    } finally {
      store.close();
    }
  });

  it("a poda preserva marcas mesmo após vencer o arrendamento", async () => {
    const { store, preference } = await comPreferenciaAtiva();
    try {
      await store.stageBook(V1, "GEN", [["No princípio."]]);
      await store.promoteIfConsented(instalacao(V1), preference.revision);
      await store.stageBook(V2, "GEN", [["No princípio, revisado."]]);

      // Marca recém-gravada: instalador concorrente vivo.
      expect(await store.pruneOtherVersions(V1, Date.now())).toBe(0);
      expect(await store.readChapter(V2, "GEN", 1)).not.toBeNull();

      // O instalador ainda pode estar ativo depois do arrendamento vencer.
      const removidos = await store.pruneOtherVersions(V1, Date.now() + INSTALL_LEASE_MS + 1);
      expect(removidos).toBe(0);
      expect(await store.readChapter(V2, "GEN", 1)).not.toBeNull();
      expect(await store.readChapter(V1, "GEN", 1)).not.toBeNull();
    } finally {
      store.close();
    }
  });

  it("duas conexões disputam o arrendamento, e só uma entra", async () => {
    // Duas conexões ao mesmo banco é o mais perto de duas abas que um teste
    // alcança sem navegador.
    const abaA = await openOfflineStore();
    const abaB = await openOfflineStore();
    try {
      let rodouB = false;
      const resultadoA = await withInstallLease(
        abaA,
        async () => {
          const ocupada = await withInstallLease(
            abaB,
            async () => {
              rodouB = true;
              return "entrou";
            },
            () => "ocupado",
          );
          expect(ocupada).toBe("ocupado");
          return "feito";
        },
        () => "ocupado",
      );

      expect(resultadoA).toBe("feito");
      expect(rodouB).toBe(false);
      // Soltou ao sair: a próxima tentativa entra.
      expect(await withInstallLease(abaB, async () => "entrou", () => "ocupado")).toBe("entrou");
    } finally {
      abaA.close();
      abaB.close();
    }
  });
});
