"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./chapter-picker.module.css";
import { chapterPath, chapterRange, type NavigationBook } from "@/src/domain/bible-navigation";

// Seletor de livro e capítulo do cabeçalho (tarefas C4 e C13).
//
// Fluxo da C13: escolher um livro **não** fecha o menu — ele troca na hora para a
// lista de capítulos daquele livro, e só a escolha do capítulo termina a
// navegação. A etapa viaja na URL (`?selecionar=capitulo`), porque a contagem de
// capítulos de cada livro vem do servidor: o cliente não inventa quantos
// capítulos um livro tem, e nada na API ou no corpus precisou mudar para isso.

const STEP_PARAM = "selecionar";

export function ChapterPicker({
  books,
  currentBook,
  currentChapter,
  totalChapters,
  translationCode,
}: {
  books: readonly NavigationBook[];
  currentBook: NavigationBook;
  currentChapter: number;
  totalChapters: number;
  translationCode: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState<"livro" | "capitulo" | null>(null);

  // Voltando de uma escolha de livro, o menu reabre direto nos capítulos dele.
  useEffect(() => {
    if (searchParams.get(STEP_PARAM) === "capitulo") setOpen("capitulo");
  }, [searchParams, currentBook.slug]);

  // Fechar também limpa o passo da URL, para que recarregar não reabra o menu.
  const close = useCallback(() => {
    setOpen(null);
    if (searchParams.get(STEP_PARAM) !== null) router.replace(pathname);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, open]);

  return (
    <>
      <div className="readerPick">
        <button
          type="button"
          aria-label={`Selecionar livro, atual ${currentBook.name}`}
          aria-expanded={open === "livro"}
          onClick={() => (open === "livro" ? close() : setOpen("livro"))}
        >
          {currentBook.name}
        </button>
        <button
          type="button"
          aria-label={`Selecionar capítulo, atual ${currentChapter}`}
          aria-expanded={open === "capitulo"}
          onClick={() => (open === "capitulo" ? close() : setOpen("capitulo"))}
        >
          {currentChapter}
        </button>
        <span className="readerTranslation">{translationCode}</span>
      </div>

      {open && (
        <div className={styles.backdrop} role="presentation" onClick={close}>
          <section
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label={open === "livro" ? "Escolher livro" : "Escolher capítulo"}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              {open === "capitulo" ? (
                <div className={styles.step}>
                  <button
                    type="button"
                    className={styles.back}
                    onClick={() => setOpen("livro")}
                    aria-label="Voltar para a lista de livros"
                  >
                    ←
                  </button>
                  <h2>{currentBook.name}: capítulos</h2>
                </div>
              ) : (
                <h2>Livros</h2>
              )}
              <button type="button" onClick={close} aria-label="Fechar seletor">
                ×
              </button>
            </header>

            {open === "livro" ? (
              <ul className={styles.books}>
                {books.map((book) => (
                  <li key={book.slug}>
                    {book.slug === currentBook.slug ? (
                      // Livro atual: já temos a contagem de capítulos, então a
                      // troca para a lista é imediata, sem passar pela rota.
                      <button
                        type="button"
                        className={styles.current}
                        aria-current="page"
                        onClick={() => setOpen("capitulo")}
                      >
                        <b>{book.orderNo}</b>
                        {book.name}
                      </button>
                    ) : (
                      <Link href={`${chapterPath(book.slug, 1)}?${STEP_PARAM}=capitulo`}>
                        <b>{book.orderNo}</b>
                        {book.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className={styles.chapters}>
                {chapterRange(totalChapters).map((number) => (
                  <li key={number}>
                    <Link
                      href={chapterPath(currentBook.slug, number)}
                      aria-current={number === currentChapter ? "page" : undefined}
                      className={number === currentChapter ? styles.current : undefined}
                      onClick={() => setOpen(null)}
                    >
                      {number}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
