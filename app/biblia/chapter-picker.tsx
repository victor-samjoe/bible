"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./chapter-picker.module.css";
import { chapterPath, chapterRange, type NavigationBook } from "@/src/domain/bible-navigation";

// Seletor de livro e capítulo do cabeçalho. Os dois botões existiam sem ação;
// a tarefa C4 os liga à navegação real por URL.
//
// Só aparece o que vem do corpus: a lista de livros e a contagem de capítulos
// chegam do contrato de leitura, então não há como navegar para capítulo que não
// existe no banco.

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
  const [open, setOpen] = useState<"livro" | "capitulo" | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Navegar fecha o painel: a rota muda e o capítulo aberto passa a ser outro.
  useEffect(() => {
    setOpen(null);
  }, [currentBook.slug, currentChapter]);

  return (
    <>
      <div className="readerPick">
        <button
          type="button"
          aria-label={`Selecionar livro, atual ${currentBook.name}`}
          aria-expanded={open === "livro"}
          onClick={() => setOpen(open === "livro" ? null : "livro")}
        >
          {currentBook.name}
        </button>
        <button
          type="button"
          aria-label={`Selecionar capítulo, atual ${currentChapter}`}
          aria-expanded={open === "capitulo"}
          onClick={() => setOpen(open === "capitulo" ? null : "capitulo")}
        >
          {currentChapter}
        </button>
        <span className="readerTranslation">{translationCode}</span>
      </div>

      {open && (
        <div className={styles.backdrop} role="presentation" onClick={() => setOpen(null)}>
          <section
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label={open === "livro" ? "Escolher livro" : "Escolher capítulo"}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2>{open === "livro" ? "Livros" : `${currentBook.name}: capítulos`}</h2>
              <button type="button" onClick={() => setOpen(null)} aria-label="Fechar seletor">
                ×
              </button>
            </header>

            {open === "livro" ? (
              <ul className={styles.books}>
                {books.map((book) => (
                  <li key={book.slug}>
                    <Link
                      href={chapterPath(book.slug, 1)}
                      aria-current={book.slug === currentBook.slug ? "page" : undefined}
                      className={book.slug === currentBook.slug ? styles.current : undefined}
                    >
                      <b>{book.orderNo}</b>
                      {book.name}
                    </Link>
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
