"use client";

import styles from "./progresso.module.css";

/**
 * Única região viva da página: leitor de tela anuncia sucesso e falha no mesmo
 * lugar, e o texto diz sempre o que aconteceu com os dados — inclusive "nada foi
 * alterado", que é informação, não silêncio.
 */
export function ProgressNotice({
  notice,
  onDismiss,
}: {
  readonly notice: string | null;
  readonly onDismiss: () => void;
}) {
  return (
    <div className={styles.notice} role="status" aria-live="polite">
      {notice ? (
        <p>
          <span>{notice}</span>
          <button type="button" onClick={onDismiss} aria-label="Fechar aviso">
            ×
          </button>
        </p>
      ) : null}
    </div>
  );
}
