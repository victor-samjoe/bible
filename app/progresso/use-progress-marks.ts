"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { resetProgressAction, setChapterReadAction } from "./actions";
import { clearLocalChapterReads, readLocalProgress, writeLocalChapterRead, type LocalProgress } from "./local-progress";

/**
 * Estado das marcas de leitura para a página de progresso, nas duas situações
 * que existem hoje:
 *
 * - **sem conta**: a verdade é o registro local do navegador, que morre com a
 *   aba. A página precisa dizer isso, e diz;
 * - **com conta**: a verdade é a conta. O registro local continua existindo
 *   como cache do leitor, então é corrigido junto — senão o leitor traria de
 *   volta um capítulo que a pessoa acabou de desmarcar
 *   (ver `./local-progress.ts`).
 *
 * Quando a sessão existe mas o banco não respondeu, nada é gravado em lugar
 * nenhum: gravar só no navegador faria a pessoa acreditar que guardou na conta.
 */

export type AccountProgressStatus = "anonymous" | "unavailable" | "ready";

export type ProgressStorage = "account" | "local" | "none";

const reasonMessages: Readonly<Record<string, string>> = {
  unauthenticated: "Sua sessão expirou. Entre de novo para corrigir marcações na conta.",
  unavailable: "Não foi possível falar com a conta agora. Nada foi alterado.",
  invalid_scope: "Capítulo não reconhecido. Nada foi alterado.",
  not_found: "Esse capítulo não existe no texto disponível. Nada foi alterado.",
  not_confirmed: "Confirmação incorreta. Nada foi apagado.",
};

export type ProgressMarks = {
  /** Escopos `livro.capítulo` considerados lidos no estado atual. */
  readonly scopes: ReadonlySet<string>;
  /** O registro local já foi lido? Antes disso a página não afirma contagem local. */
  readonly hydrated: boolean;
  readonly storage: ProgressStorage;
  readonly localAvailable: boolean;
  readonly localCount: number;
  readonly accountCount: number;
  readonly pendingScope: string | null;
  readonly busy: boolean;
  readonly notice: string | null;
  readonly dismissNotice: () => void;
  readonly toggleChapter: (scope: string, read: boolean) => Promise<void>;
  readonly resetAll: (confirmation: string) => Promise<boolean>;
};

export function useProgressMarks(input: {
  readonly accountStatus: AccountProgressStatus;
  readonly accountScopes: readonly string[];
}): ProgressMarks {
  const signedIn = input.accountStatus !== "anonymous";
  const [accountScopes, setAccountScopes] = useState<readonly string[]>(input.accountScopes);
  const [local, setLocal] = useState<LocalProgress>({ available: true, scopes: [] });
  const [hydrated, setHydrated] = useState(false);
  const [pendingScope, setPendingScope] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // O registro local só existe no navegador: é lido depois da hidratação, para
  // o HTML do servidor e o primeiro render do cliente não divergirem.
  useEffect(() => {
    setLocal(readLocalProgress());
    setHydrated(true);
  }, []);

  useEffect(() => {
    setAccountScopes(input.accountScopes);
  }, [input.accountScopes]);

  const scopes = useMemo(
    () => new Set<string>([...accountScopes, ...local.scopes]),
    [accountScopes, local.scopes],
  );

  const toggleChapter = useCallback(
    async (scope: string, read: boolean) => {
      setNotice(null);
      if (!signedIn) {
        const next = writeLocalChapterRead(scope, read);
        setLocal(next);
        if (!next.available) setNotice("O armazenamento deste navegador está indisponível. Nada foi guardado.");
        return;
      }
      setPendingScope(scope);
      try {
        const result = await setChapterReadAction(scope, read);
        if (!result.ok) {
          setNotice(reasonMessages[result.reason] ?? reasonMessages.unavailable ?? null);
          return;
        }
        setAccountScopes((current) => {
          const next = new Set(current);
          if (read) next.add(scope);
          else next.delete(scope);
          return [...next];
        });
        // O cache do leitor precisa concordar com a conta.
        const nextLocal = writeLocalChapterRead(scope, read);
        setLocal(nextLocal);
        if (!nextLocal.available) {
          setNotice("A conta foi atualizada, mas não foi possível atualizar o registro deste navegador.");
        }
      } catch {
        setNotice(reasonMessages.unavailable ?? null);
      } finally {
        setPendingScope(null);
      }
    },
    [signedIn],
  );

  const resetAll = useCallback(
    async (confirmation: string): Promise<boolean> => {
      setNotice(null);
      setResetting(true);
      try {
        if (signedIn) {
          const result = await resetProgressAction(confirmation);
          if (!result.ok) {
            setNotice(reasonMessages[result.reason] ?? reasonMessages.unavailable ?? null);
            return false;
          }
          setAccountScopes([]);
          const nextLocal = clearLocalChapterReads();
          setLocal(nextLocal);
          if (!nextLocal.available) {
            setNotice("A conta foi atualizada, mas não foi possível limpar o registro deste navegador.");
            return true;
          }
          setNotice(
            result.cleared === 0
              ? "Não havia capítulo marcado na conta."
              : `${result.cleared} ${result.cleared === 1 ? "capítulo" : "capítulos"} desmarcados na conta.`,
          );
          return true;
        }
        const next = clearLocalChapterReads();
        setLocal(next);
        if (!next.available) {
          setNotice("O armazenamento deste navegador está indisponível. Nada foi apagado.");
          return false;
        }
        setNotice("Marcações deste navegador apagadas.");
        return true;
      } catch {
        setNotice(reasonMessages.unavailable ?? null);
        return false;
      } finally {
        setResetting(false);
      }
    },
    [signedIn],
  );

  const storage: ProgressStorage =
    input.accountStatus === "ready" ? "account" : local.available ? "local" : "none";

  return {
    scopes,
    hydrated,
    storage,
    localAvailable: local.available,
    localCount: local.scopes.length,
    accountCount: accountScopes.length,
    pendingScope,
    busy: pendingScope !== null || resetting,
    notice,
    dismissNotice: () => setNotice(null),
    toggleChapter,
    resetAll,
  };
}
