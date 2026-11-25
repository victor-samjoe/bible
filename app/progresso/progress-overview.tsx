"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  buildReadingProgress,
  formatProgressPercent,
  progressRatio,
  type ProgressBook,
  type ProgressChapterCount,
} from "@/src/domain/reading-progress";
import { ProgressNotice } from "./progress-notice";
import { ResetProgress } from "./reset-progress";
import { useProgressMarks, type AccountProgressStatus } from "./use-progress-marks";
import styles from "./progresso.module.css";

/**
 * Visão geral do progresso: testamento, livro e capítulo
 * (`READING-PROGRESS-001`).
 *
 * Tudo que aparece como número é derivado de duas fontes reais: os livros e as
 * contagens de capítulo que o corpus devolveu, e as marcas que existem na conta
 * ou no registro local. Não há meta, sequência, média nem estimativa — nada
 * aqui multiplica, projeta ou arredonda para cima.
 *
 * Sem corpus (banco indisponível) a página **não** inventa totais: mostra as
 * marcas que conhece como lista de capítulos e diz que o catálogo não respondeu.
 */

export function ProgressOverview({
  books,
  chapterCounts,
  corpusAvailable,
  accountStatus,
  accountScopes,
}: {
  readonly books: readonly ProgressBook[];
  readonly chapterCounts: readonly ProgressChapterCount[];
  readonly corpusAvailable: boolean;
  readonly accountStatus: AccountProgressStatus;
  readonly accountScopes: readonly string[];
}) {
  const marks = useProgressMarks({ accountStatus, accountScopes });
  const signedIn = accountStatus !== "anonymous";

  const overview = useMemo(
    () => buildReadingProgress({ books, chapterCounts, readScopes: marks.scopes }),
    [books, chapterCounts, marks.scopes],
  );

  const totalsKnown = corpusAvailable && !overview.unknownTotal && overview.totalChapters > 0;
  const percent = totalsKnown ? formatProgressPercent(overview.readChapters, overview.totalChapters) : null;
  // Visitante: antes de ler o armazenamento não há número honesto a mostrar.
  const counting = !signedIn && !marks.hydrated;

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>LEITURA</p>
        <h1>Leituras realizadas.</h1>
        <p>Capítulos que você marcou como lidos, por testamento, livro e capítulo.</p>
      </header>

      <section
        className={styles.origin}
        aria-label="De onde vêm estas marcações"
        data-storage={marks.storage}
      >
        {marks.storage === "account" ? (
          <p>
            <strong>Conta e sessão deste navegador.</strong> A lista reúne as marcações das duas
            fontes; uma marcação que aparece aqui pode existir apenas nesta sessão. Alterações são
            enviadas à conta e ao registro local.
          </p>
        ) : null}
        {marks.storage === "local" ? (
          <p>
            <strong>Estado local.</strong> Estas marcações ficam somente nesta sessão, neste
            navegador, e desaparecem quando você fecha a aba. Este registro local não é
            sincronizado automaticamente.{" "}
            {signedIn ? null : <Link href="/entrar">Entrar para guardar na conta</Link>}
          </p>
        ) : null}
        {marks.storage === "none" ? (
          <p>
            <strong>Sem armazenamento.</strong> Este navegador não deixou guardar nada nesta
            sessão, então não há marcação local para mostrar nem para corrigir.
          </p>
        ) : null}
        {accountStatus === "unavailable" ? (
          <p className={styles.warn}>
            Você está na conta, mas o progresso guardado não respondeu agora. O que aparece abaixo é
            apenas o registro deste navegador, e marcar ou desmarcar vai falhar até a conta voltar.
          </p>
        ) : null}
        {!corpusAvailable ? (
          <p className={styles.warn}>
            O catálogo de livros e capítulos não respondeu, então esta página não mostra totais nem
            percentuais — só as marcações que já conhece.
          </p>
        ) : null}
      </section>

      <ProgressNotice notice={marks.notice} onDismiss={marks.dismissNotice} />

      {corpusAvailable ? (
        <section className={styles.summary} aria-labelledby="resumo-title">
          <h2 id="resumo-title">Resumo</h2>
          {counting ? (
            <p className={styles.muted}>Verificando este navegador…</p>
          ) : (
            <>
              <p className={styles.bigNumber}>
                {overview.readChapters}
                {totalsKnown ? <span className={styles.ofTotal}> de {overview.totalChapters}</span> : null}
                <span className={styles.unit}> {overview.readChapters === 1 ? "capítulo" : "capítulos"}</span>
                {percent ? <span className={styles.percent}> · {percent}</span> : null}
              </p>
              {totalsKnown ? <ProgressBar read={overview.readChapters} total={overview.totalChapters} /> : null}
              <p className={styles.muted}>
                {overview.booksStarted} {overview.booksStarted === 1 ? "livro iniciado" : "livros iniciados"} ·{" "}
                {overview.booksComplete} {overview.booksComplete === 1 ? "livro completo" : "livros completos"}
              </p>
            </>
          )}
        </section>
      ) : null}

      {overview.testaments.map((testament) => (
        <section className={styles.testament} key={testament.group} aria-labelledby={`t-${testament.group}`}>
          <div className={styles.testamentHead}>
            <h2 id={`t-${testament.group}`}>{testament.label}</h2>
            {counting ? null : (
              <p className={styles.muted}>
                {testament.readChapters}
                {testament.unknownTotal ? "" : ` de ${testament.totalChapters}`} capítulos
                {testament.unknownTotal
                  ? null
                  : (() => {
                      const label = formatProgressPercent(testament.readChapters, testament.totalChapters);
                      return label ? ` · ${label}` : null;
                    })()}
              </p>
            )}
          </div>

          <ul className={styles.books}>
            {testament.books.map((book) => {
              const label = book.unknownTotal
                ? null
                : formatProgressPercent(book.readChapters, book.totalChapters);
              return (
                <li className={styles.book} key={book.slug} data-complete={book.complete ? "true" : undefined}>
                  <Link className={styles.bookName} href={book.progressPath}>
                    {book.name}
                  </Link>
                  <span className={styles.bookCounts}>
                    {counting ? (
                      "—"
                    ) : book.unknownTotal ? (
                      <span title="O corpus não informou quantos capítulos este livro tem">
                        {book.readChapters} lidos · total desconhecido
                      </span>
                    ) : (
                      <>
                        {book.readChapters}/{book.totalChapters}
                        {label ? <span className={styles.bookPercent}> · {label}</span> : null}
                      </>
                    )}
                  </span>
                  {!counting && !book.unknownTotal ? (
                    <ProgressBar read={book.readChapters} total={book.totalChapters} compact />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {!corpusAvailable && marks.scopes.size > 0 ? (
        <section className={styles.testament} aria-labelledby="locais-title">
          <div className={styles.testamentHead}>
            <h2 id="locais-title">Capítulos marcados</h2>
            <p className={styles.muted}>
              {marks.scopes.size} {marks.scopes.size === 1 ? "capítulo" : "capítulos"}, sem total do
              corpus para comparar.
            </p>
          </div>
          <ul className={styles.books}>
            {[...marks.scopes].sort().map((scope) => {
              const separator = scope.lastIndexOf(".");
              const slug = scope.slice(0, separator);
              const chapter = scope.slice(separator + 1);
              return (
                <li className={styles.book} key={scope}>
                  <Link className={styles.bookName} href={`/biblia/${slug}/${chapter}`}>
                    {slug} {chapter}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {overview.unmatchedCount > 0 ? (
        <section className={styles.orphans} aria-labelledby="orfas-title">
          <h2 id="orfas-title">Marcações sem capítulo correspondente</h2>
          <p>
            {overview.unmatchedCount}{" "}
            {overview.unmatchedCount === 1 ? "marcação não corresponde" : "marcações não correspondem"} a
            um capítulo do texto disponível, então não entram em nenhuma contagem acima.
          </p>
          <ul>
            {overview.unmatched.map((record) => (
              <li key={record.scope}>
                <code>{record.scope}</code>
                <button
                  type="button"
                  className={styles.orphanButton}
                  onClick={() => void marks.toggleChapter(record.scope, false)}
                  disabled={marks.busy}
                >
                  Remover marcação
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {counting || marks.scopes.size === 0 ? null : (
        <ResetProgress
          storage={marks.storage}
          total={marks.scopes.size}
          busy={marks.busy}
          onReset={marks.resetAll}
        />
      )}

      <p className={styles.footerLinks}>
        <Link href="/biblia">Abrir a Bíblia</Link>
        {signedIn ? (
          <>
            {" · "}
            <Link href="/conta">Sua conta</Link>
          </>
        ) : null}
      </p>
    </main>
  );
}

/**
 * Barra derivada da razão real. É decorativa: o texto ao lado já diz
 * "lidos de total", e repetir isso para leitor de tela só atrapalharia.
 */
function ProgressBar({
  read,
  total,
  compact = false,
}: {
  readonly read: number;
  readonly total: number;
  readonly compact?: boolean;
}) {
  const ratio = progressRatio(read, total);
  if (ratio === null) return null;
  return (
    <div className={compact ? styles.barCompact : styles.bar} aria-hidden="true">
      <span style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  );
}
