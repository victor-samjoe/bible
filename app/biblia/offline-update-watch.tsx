"use client";

import { useEffect } from "react";

import { checkForUpdate, installPackage, installedManifestEtag, shouldCheckForUpdate } from "../../src/client/offline/install";
import { createOfflineSource, dedupe, sha256Hex } from "../../src/client/offline/source";
import { openOfflineStore, withInstallLease } from "../../src/client/offline/storage";
import { offlineFailure } from "../../src/domain/offline/package";

/**
 * Verificação automática de versão do pacote offline.
 *
 * Não renderiza nada, como o `ReadingPointer`: fica no layout de /biblia para
 * rodar quando a Bíblia é aberta com conexão — que é uma das duas ocasiões que
 * o proprietário pediu. No login, a página de conta também o monta com o
 * gatilho correspondente, depois da autenticação bem-sucedida.
 *
 * Regras que importam aqui:
 *
 * - **só para quem ativou o download.** Sem preferência ativa, o componente sai
 *   sem abrir banco nem requisição; quem nunca pediu offline não paga nada.
 * - **uma verificação por vez e não a cada capítulo.** `dedupe` resolve a
 *   mesma aba, o layout persiste entre capítulos e `withInstallLease` protege
 *   instalação e remoção simultâneas, em qualquer navegador com IndexedDB.
 * - **remoção feita noutra aba vence.** Cada gravação da preferência leva a
 *   revisão que foi lida, e a promoção é condicionada à mesma revisão. Quem
 *   remove durante uma atualização não vê o pacote voltar.
 * - **versão igual não baixa nada.** É a razão de a versão ser derivada do
 *   conteúdo.
 * - **economia de dados ligada não baixa sozinho.** Fica para o botão na
 *   página de controles, onde a pessoa vê o tamanho e decide. Não é bloqueio:
 *   é não gastar dados móveis sem pedir.
 */
export function OfflineUpdateWatch({ trigger = "bible_opened" }: { trigger?: "bible_opened" | "login" }) {
  useEffect(() => {
    if (typeof indexedDB === "undefined") return;

    let cancelled = false;

    const run = dedupe(async () => {
      const store = await openOfflineStore();
      try {
        const preference = await store.readPreference();
        if (!preference?.enabled) return;

        const installed = await store.readInstallation();
        const check = await checkForUpdate(createOfflineSource(), installed, preference.lastEtag);
        if (cancelled) return;

        // Um ETag de versão ainda não instalada não pode representar o pacote
        // atual: após falha, um 304 esconderia a atualização pendente.
        //
        // A gravação é condicionada à revisão lida no início. Se outra aba
        // removeu o pacote nesse intervalo, esta gravação é recusada em vez de
        // ressuscitar `enabled: true` — era exatamente o defeito apontado na
        // revisão de 25/11.
        const marcada = await store.updatePreference(preference.revision, {
          ...preference,
          lastCheckedAt: Date.now(),
          lastEtag: installedManifestEtag(check),
        });
        if (!marcada.ok) return;
        if (!check.ok || check.state !== "available") return;

        const hint = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
        if (hint?.saveData === true) return;

        const atual = marcada.preference;
        const outcome = await withInstallLease(
          store,
          () =>
            installPackage(check.manifest, createOfflineSource(), store, sha256Hex, {
              preference: atual,
              now: () => Date.now(),
              installed,
              expectedRevision: atual.revision,
            }),
          () => offlineFailure("locked"),
        );

        if (!outcome.ok && (outcome.reason === "consent_revoked" || outcome.reason === "preference_changed")) {
          // Uma outra aba pode estar instalando a mesma versão. Preservamos
          // staging para retomada; somente uma recusa ainda vigente autoriza
          // limpeza, conferida atomicamente contra a revisão da preferência.
          const current = await store.readPreference();
          if (current?.enabled === false) await store.removeIfStillDisabled(current.revision);
          return;
        }

        if (outcome.ok) {
          await store.updatePreference(atual.revision, {
            ...atual,
            lastCheckedAt: Date.now(),
            lastKnownVersion: outcome.installation.version,
            lastEtag: check.etag,
          });
        }
      } finally {
        store.close();
      }
    });

    const maybeRun = async (trigger: "bible_opened" | "login" | "reconnected") => {
      if (typeof indexedDB === "undefined") return;
      try {
        const store = await openOfflineStore();
        let allowed = false;
        try {
          allowed = shouldCheckForUpdate(await store.readPreference(), trigger, Date.now());
        } finally {
          store.close();
        }
        if (allowed && !cancelled) await run();
      } catch {
        // Armazenamento indisponível (janela privada, dados de site
        // bloqueados): a leitura online não depende disto.
      }
    };

    void maybeRun(trigger);

    const onReconnect = () => void maybeRun("reconnected");
    window.addEventListener("online", onReconnect);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onReconnect);
    };
  }, [trigger]);

  return null;
}
