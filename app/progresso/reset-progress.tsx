"use client";

import { useId, useState } from "react";
import { RESET_CONFIRMATION, isResetConfirmed } from "@/src/domain/reading-progress";
import type { ProgressStorage } from "./use-progress-marks";
import styles from "./progresso.module.css";

/**
 * Reinício total das marcas de leitura.
 *
 * Confirmação forte, e não um "tem certeza?": a ação some atrás de um
 * `<details>` fechado, exige digitar a palavra exata e só então libera o botão.
 * O servidor confere a mesma palavra (`src/server/reading/progress-runtime.ts`),
 * porque confirmação que vive só na tela não é tranca.
 *
 * O texto diz exatamente o que será apagado e o que não será: destaques, notas e
 * preferências não pertencem a esta ação.
 */
export function ResetProgress({
  storage,
  total,
  busy,
  onReset,
}: {
  readonly storage: ProgressStorage;
  readonly total: number;
  readonly busy: boolean;
  readonly onReset: (confirmation: string) => Promise<boolean>;
}) {
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const confirmed = isResetConfirmed(typed);
  const where = storage === "account" ? "da sua conta e deste navegador" : "deste navegador";

  if (storage === "none") return null;

  return (
    <details className={styles.reset}>
      <summary>Reiniciar marcações de leitura</summary>
      <div className={styles.resetBody}>
        <p>
          Isto desmarca <strong>{total}</strong> {total === 1 ? "capítulo" : "capítulos"} {where}. Seus
          destaques, notas e preferências de leitura não são tocados.
        </p>
        <p className={styles.warn}>Não há como desfazer.</p>
        <label htmlFor={inputId}>
          Para confirmar, digite <code>{RESET_CONFIRMATION}</code>
        </label>
        <input
          id={inputId}
          className={styles.resetInput}
          type="text"
          value={typed}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setTyped(event.target.value)}
        />
        <button
          type="button"
          className={styles.resetButton}
          disabled={!confirmed || busy}
          onClick={async () => {
            const done = await onReset(typed);
            if (done) setTyped("");
          }}
        >
          {busy ? "Apagando…" : `Desmarcar tudo ${where}`}
        </button>
      </div>
    </details>
  );
}
