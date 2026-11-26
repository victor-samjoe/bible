"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  checkForUpdate,
  installPackage,
  installedManifestEtag,
  type InstallProgress,
} from "../../src/client/offline/install";
import { createOfflineSource, sha256Hex } from "../../src/client/offline/source";
import { openOfflineStore, withInstallLease, type InstallationRecord, type OfflineStore, type PreferenceRecord } from "../../src/client/offline/storage";
import {
  describeDownloadSize,
  offlineFailure,
  type OfflineFailureReason,
  type OfflineManifest,
} from "../../src/domain/offline/package";
import {
  dataWarning,
  describeInstallation,
  estimateStorageBytes,
  offlineFailureMessage,
  progressSentence,
  sizeSentence,
  sourceVersionSentence,
} from "./offline-text";
import styles from "./offline-controls.module.css";

/**
 * Controles de download da Bíblia para leitura offline.
 *
 * Regras de produto que este componente existe para cumprir:
 *
 * - **nada é baixado sem consentimento**: o primeiro download só começa pelo
 *   botão, e a recusa fica registrada no aparelho;
 * - **a recusa e a remoção sobrevivem a outro login**, porque a preferência
 *   mora no navegador, não na conta — uma conta diferente no mesmo aparelho não
 *   herda nem revoga a decisão de quem usou antes;
 * - **o tamanho é dito antes**, separando o que atravessa a rede do que ocupa
 *   espaço, e o segundo número aparece como estimativa medida, não promessa;
 * - **o aviso de dados móveis é aviso**, não bloqueio: a dica do navegador
 *   sobre o tipo de conexão erra, e bloquear por ela impediria quem está no
 *   Wi-Fi de baixar.
 */

type Phase =
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | { readonly kind: "installing"; readonly progress: InstallProgress }
  | { readonly kind: "failed"; readonly reason: OfflineFailureReason };

type ConnectionHint = { readonly saveData?: boolean; readonly effectiveType?: string };

function connectionHint(): ConnectionHint | null {
  const candidate = (navigator as Navigator & { connection?: ConnectionHint }).connection;
  if (!candidate) return null;
  return { saveData: candidate.saveData, effectiveType: candidate.effectiveType };
}

export function OfflineControls() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [installation, setInstallation] = useState<InstallationRecord | null>(null);
  const [preference, setPreference] = useState<PreferenceRecord | null>(null);
  /**
   * Último manifesto que o servidor devolveu, independentemente de haver
   * atualização. Guardar só "o que está disponível" foi um erro: depois de
   * remover o pacote, a tela ficava sem tamanho e **sem botão de baixar**, e a
   * pessoa que removeu por engano precisava clicar em "Verificar atualização"
   * para poder reinstalar.
   */
  const [published, setPublished] = useState<OfflineManifest | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [occupied, setOccupied] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const storeRef = useRef<OfflineStore | null>(null);
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const sourceRef = useRef(createOfflineSource());

  const measure = useCallback(async () => {
    if (!navigator.storage?.estimate) return;
    try {
      const estimate = await navigator.storage.estimate();
      setOccupied(estimate.usage ?? null);
    } catch {
      setOccupied(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const [current, saved] = await Promise.all([store.readInstallation(), store.readPreference()]);
    setInstallation(current);
    setPreference(saved);
    return { current, saved };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof indexedDB === "undefined" || !crypto?.subtle) {
        setUnsupported(true);
        setPhase({ kind: "ready" });
        return;
      }
      try {
        const store = await openOfflineStore();
        if (cancelled) {
          store.close();
          return;
        }
        storeRef.current = store;
        const state = await refresh();
        await measure();

        // A consulta do manifesto acontece aqui mesmo para quem ainda não
        // decidiu: é o que permite mostrar o tamanho real antes de pedir o
        // consentimento, em vez de um número escrito à mão no código.
        const check = await checkForUpdate(
          sourceRef.current,
          state?.current ?? null,
          state?.saved?.lastEtag ?? null,
        );
        if (cancelled) return;
        if (check.ok && check.state === "available") setPublished(check.manifest);
        setPhase({ kind: "ready" });
      } catch {
        if (!cancelled) {
          setUnsupported(true);
          setPhase({ kind: "ready" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [measure, refresh]);

  /**
   * Grava a decisão da pessoa, e **ela ganha a corrida**.
   *
   * A gravação é condicionada à revisão conhecida; se outra aba escreveu nesse
   * intervalo — tipicamente o verificador de versão guardando um ETag —, relê e
   * tenta de novo com a revisão nova. Quem clicou é autoridade; o registro de
   * bookkeeping é que deve perder. Três tentativas porque a disputa real é
   * entre duas abas, não entre muitas.
   */
  const savePreference = useCallback(
    async (enabled: boolean) => {
      const store = storeRef.current;
      if (!store) return null;
      let conhecida = preference;
      for (let tentativa = 0; tentativa < 3; tentativa += 1) {
        const next = {
          enabled,
          decidedAt: Date.now(),
          lastCheckedAt: conhecida?.lastCheckedAt ?? null,
          lastKnownVersion: conhecida?.lastKnownVersion ?? null,
          lastEtag: conhecida?.lastEtag ?? null,
        };
        const result = await store.updatePreference(conhecida?.revision ?? null, next);
        if (result.ok) {
          setPreference(result.preference);
          return result.preference;
        }
        conhecida = result.current;
      }
      return null;
    },
    [preference],
  );

  const download = useCallback(
    async (manifest: OfflineManifest) => {
      const store = storeRef.current;
      if (!store) return;
      setNotice(null);
      const consent = preference?.enabled ? preference : await savePreference(true);
      if (!consent) return;

      abortRef.current = { aborted: false };
      setPhase({
        kind: "installing",
        progress: { booksDone: 0, booksTotal: manifest.files.length, bytesDone: 0, bytesTotal: manifest.totals.bytes },
      });

      const outcome = await withInstallLease(
        store,
        () =>
          installPackage(manifest, sourceRef.current, store, sha256Hex, {
            preference: consent,
            now: () => Date.now(),
            expectedRevision: consent.revision,
            // Atualização reaproveita do aparelho os livros cujo texto não
            // mudou; sem isto, uma correção num livro custaria o pacote todo.
            installed: installation,
            onProgress: (progress) => setPhase({ kind: "installing", progress }),
            signal: abortRef.current,
          }),
        () => offlineFailure("locked"),
      );

      if (outcome.ok) {
        await store.updatePreference(consent.revision, {
          ...consent,
          lastCheckedAt: Date.now(),
          lastKnownVersion: manifest.version,
        });
        await refresh();
        await measure();
        setPublished(manifest);
        setPhase({ kind: "ready" });
        setNotice(
          outcome.reusedBooks > 0
            ? `Bíblia atualizada. ${outcome.reusedBooks} livros foram aproveitados do que já estava salvo; ${describeDownloadSize(outcome.downloadedBytes)} baixados.`
            : outcome.resumedBooks > 0
              ? `Download concluído, retomando ${outcome.resumedBooks} livros já baixados antes.`
              : "Bíblia salva neste aparelho.",
        );
        return;
      }

      if (outcome.reason === "consent_revoked" || outcome.reason === "preference_changed") {
        // Outra aba pode instalar a mesma versão. Só uma recusa ainda vigente
        // autoriza limpar; mudanças de metadados preservam dados de retomada.
        const current = await store.readPreference();
        if (current?.enabled === false) await store.removeIfStillDisabled(current.revision);
      }

      await refresh();
      await measure();
      setPhase({ kind: "failed", reason: outcome.reason });
    },
    [installation, measure, preference, refresh, savePreference],
  );

  const check = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    setNotice(null);
    const current = await store.readInstallation();
    const result = await checkForUpdate(sourceRef.current, current, preference?.lastEtag ?? null);
    if (!result.ok) {
      setPhase({ kind: "failed", reason: result.reason });
      return;
    }
    if (preference) {
      // Guarda o ETag: a próxima verificação sem mudança vira um 304 de
      // algumas centenas de bytes em vez dos ~24 KB do manifesto.
      const gravada = await store.updatePreference(preference.revision, {
        ...preference,
        lastCheckedAt: Date.now(),
        lastEtag: installedManifestEtag(result),
      });
      // Perder a corrida aqui não é erro: outra aba escreveu algo mais recente,
      // e guardar ETag é conveniência de banda, não decisão da pessoa.
      setPreference(gravada.ok ? gravada.preference : (gravada.current ?? preference));
    }
    if (result.state === "available") {
      setPublished(result.manifest);
      setNotice(current ? "Há uma versão nova do pacote." : null);
      return;
    }
    setNotice("O pacote instalado já é a versão publicada.");
  }, [preference]);

  const remove = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    abortRef.current.aborted = true;
    setNotice(null);
    // Guarda o manifesto antes de apagar: é o que permite oferecer "Baixar"
    // outra vez na mesma tela, sem nova consulta, a quem removeu por engano.
    if (installation) setPublished(installation.manifest);

    // Ordem invertida de propósito: a preferência primeiro.
    //
    // `enabled: false` com revisão nova faz qualquer promoção em voo noutra aba
    // falhar — `promoteIfConsented` exige as duas coisas na mesma transação.
    // Apagar primeiro deixaria a janela em que a outra aba promove logo depois
    // e o pacote reaparece sozinho, que é o defeito apontado na revisão.
    const decidida = await savePreference(false);
    if (!decidida) {
      // As três tentativas de CAS falharam: a recusa **não** está gravada.
      // Apagar aqui era o segundo defeito da revisão — o pacote ia embora, a
      // tela dizia "removido" e o download continuava ativado, pronto para
      // reinstalar tudo na próxima verificação.
      await refresh();
      setPhase({ kind: "failed", reason: "preference_changed" });
      return;
    }

    const apagado = await store.removeIfStillDisabled(decidida.revision);
    await refresh();
    await measure();
    if (!apagado.ok) {
      // Entre a gravação e a limpeza outra aba reativou — e possivelmente já
      // instalou. Nada foi apagado: a instalação que está no aparelho agora é
      // a dela, não a que esta aba viu quando a pessoa clicou.
      setPhase({ kind: "failed", reason: apagado.reason });
      return;
    }
    setPhase({ kind: "ready" });
    setNotice("Pacote removido deste aparelho. O download continua desativado até você ativar de novo.");
  }, [installation, measure, refresh, savePreference]);

  if (phase.kind === "loading") {
    return (
      <section className={styles.root} aria-busy="true">
        <h2>Bíblia offline</h2>
        <p className={styles.muted}>Verificando o que está salvo neste aparelho…</p>
      </section>
    );
  }

  if (unsupported) {
    return (
      <section className={styles.root}>
        <h2>Bíblia offline</h2>
        <p className={styles.muted}>
          Este navegador não oferece o armazenamento necessário — é o que acontece em janela privada
          ou com dados de site bloqueados. A leitura online continua funcionando normalmente.
        </p>
      </section>
    );
  }

  const manifest = published ?? installation?.manifest ?? null;
  // Há o que baixar quando não há pacote, ou quando o publicado é outro.
  const pending = manifest !== null && manifest.version !== installation?.version;
  const warning = dataWarning(connectionHint());
  const installing = phase.kind === "installing";

  return (
    <section className={styles.root}>
      <h2>Bíblia offline</h2>

      {installation ? (
        <p className={styles.state}>
          <strong>Salva neste aparelho.</strong>{" "}
          {describeInstallation(installation.version, installation.installedAt, installation.chapters)}
        </p>
      ) : (
        <p className={styles.state}>
          <strong>Não está salva neste aparelho.</strong> Sem o download, a leitura exige conexão.
        </p>
      )}

      {manifest ? (
        <p className={styles.muted}>
          {sizeSentence(manifest.totals.bytes, estimateStorageBytes(manifest.totals.bytes))}
        </p>
      ) : (
        <p className={styles.muted}>
          Não foi possível consultar o tamanho do pacote agora. Tente verificar novamente quando
          houver conexão.
        </p>
      )}

      {occupied !== null && installation ? (
        <p className={styles.muted}>
          Armazenamento usado por este site neste aparelho, medido agora:{" "}
          {describeDownloadSize(occupied)}.
        </p>
      ) : null}

      {warning ? <p className={styles.warning}>{warning}</p> : null}

      {installing ? (
        <div className={styles.progress}>
          <p aria-live="polite">
            Baixando ·{" "}
            {progressSentence(
              phase.progress.booksDone,
              phase.progress.booksTotal,
              phase.progress.bytesDone,
              phase.progress.bytesTotal,
            )}
          </p>
          <div
            className={styles.bar}
            role="progressbar"
            aria-label="Progresso do download da Bíblia"
            aria-valuemin={0}
            aria-valuemax={phase.progress.bytesTotal}
            aria-valuenow={phase.progress.bytesDone}
          >
            <span
              style={{
                width: `${phase.progress.bytesTotal > 0 ? (phase.progress.bytesDone / phase.progress.bytesTotal) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {phase.kind === "failed" ? (
        <p className={styles.failure} role="alert">
          {offlineFailureMessage(phase.reason)}
        </p>
      ) : null}

      {notice ? <p className={styles.notice}>{notice}</p> : null}

      <div className={styles.actions}>
        {installing ? (
          <button
            type="button"
            onClick={() => {
              abortRef.current.aborted = true;
            }}
          >
            Interromper
          </button>
        ) : (
          <>
            {manifest && pending ? (
              <button type="button" className={styles.primary} onClick={() => download(manifest)}>
                {installation ? "Atualizar pacote" : "Baixar a Bíblia"}
              </button>
            ) : null}
            <button type="button" onClick={check}>
              Verificar atualização
            </button>
            {installation || preference?.enabled ? (
              <button type="button" onClick={remove}>
                Remover do aparelho
              </button>
            ) : null}
          </>
        )}
      </div>

      <p className={styles.fine}>
        O pacote traz somente o texto desta tradução. Idiomas originais, léxico, notas pessoais,
        marcações e progresso de leitura não ficam offline e continuam exigindo conexão.{" "}
        <Link href="/direitos-autorais">Fonte e licença</Link>.
      </p>
      {manifest ? (
        <p className={styles.fine}>
          {manifest.edition.attribution} {sourceVersionSentence(manifest.edition.sourceSignedAt)}
        </p>
      ) : null}
    </section>
  );
}
