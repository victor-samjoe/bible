"use client";

import Link from "next/link";
import { useMemo } from "react";
import { buildBookChapterProgress, formatProgressPercent } from "@/src/domain/reading-progress";
import { ProgressNotice } from "../progress-notice";
import { useProgressMarks, type AccountProgressStatus } from "../use-progress-marks";
import styles from "../progresso.module.css";

/**
 * Grade de capítulos de um livro, com duas ações por capítulo e nenhuma
 * ambiguidade entre elas:
 *
 * - o número é link para o capítulo no leitor — é por isso que esta página
 *   existe, e não só para contar;
 * - o botão ao lado corrige a marcação **daquele** capítulo, sem tocar em
 *   destaque, nota ou nos outros capítulos.
 *
 * O botão é `aria-pressed`, e não uma caixa de seleção, porque não há formulário
 * para enviar: cada toque é a alteração inteira.
 */
export function BookChapters({
  book,
  chapterNumbers,
  accountStatus,
  accountScopes,
}: {
  readonly book: { readonly slug: string; readonly name: string; readonly code: string };
  readonly chapterNumbers: readonly number[];
  readonly accountStatus: AccountProgressStatus;
  readonly accountScopes: readonly string[];
}) {
  const marks = useProgressMarks({ accountStatus, accountScopes });
  const signedIn = accountStatus !== "anonymous";
  const counting = !signedIn && !marks.hydrated;

  const progress = useMemo(
    () => buildBookChapterProgress({ book, chapterNumbers, readScopes: marks.scopes }),
    [book, chapterNumbers, marks.scopes],
  );

  const percent = formatProgressPercent(progress.readChapters, progress.totalChapters);

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>{progress.groupLabel.toUpperCase()}</p>
        <h1>{progress.name}</h1>
        <p>
          {counting
            ? `${progress.totalChapters} capítulos. Verificando este navegador…`
            : `${progress.readChapters} de ${progress.totalChapters} capítulos marcados como lidos${
                percent ? ` · ${percent}` : ""
              }.`}
        </p>
      </header>

      {marks.storage !== "account" || accountStatus === "unavailable" ? (
      <section className={styles.origin} aria-label="De onde vêm estas marcações" data-storage={marks.storage}>
        {marks.storage === "local" ? (
          <p>
            <strong>Estado local.</strong> Marcar aqui vale somente nesta sessão deste navegador e
            desaparece quando você fecha a aba.{" "}
            {signedIn ? null : <Link href="/entrar">Entrar para guardar na conta</Link>}
          </p>
        ) : null}
        {marks.storage === "none" ? (
          <p>
            <strong>Sem armazenamento.</strong> Este navegador não deixou guardar nada nesta sessão,
            então a marcação não vai persistir.
          </p>
        ) : null}
        {accountStatus === "unavailable" ? (
          <p className={styles.warn}>
            Você está na conta, mas o progresso guardado não respondeu agora. Marcar ou desmarcar vai
            falhar até a conta voltar.
          </p>
        ) : null}
      </section>
      ) : null}

      <ProgressNotice notice={marks.notice} onDismiss={marks.dismissNotice} />

      <ol className={styles.chapters} aria-label={`Capítulos de ${progress.name}`}>
        {progress.chapters.map((chapter) => (
          <li className={styles.chapter} key={chapter.number} data-read={chapter.read ? "true" : undefined}>
            <Link
              className={styles.chapterLink}
              href={chapter.readerPath}
              aria-label={`Abrir ${progress.name} ${chapter.number}`}
            >
              {chapter.number}
            </Link>
            <button
              type="button"
              className={styles.chapterToggle}
              aria-pressed={chapter.read}
              aria-label={
                chapter.read
                  ? `Desmarcar ${progress.name} ${chapter.number} como lido`
                  : `Marcar ${progress.name} ${chapter.number} como lido`
              }
              disabled={marks.busy || marks.storage === "none"}
              onClick={() => void marks.toggleChapter(chapter.scope, !chapter.read)}
            >
              {marks.pendingScope === chapter.scope ? "…" : chapter.read ? "✓" : "○"}
            </button>
          </li>
        ))}
      </ol>

      <p className={styles.footerLinks}>
        <Link href="/progresso">Todos os livros</Link>
        {" · "}
        <Link href={`/biblia/${progress.slug}/1`}>Ler {progress.name}</Link>
      </p>
    </main>
  );
}
