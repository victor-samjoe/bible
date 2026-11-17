"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./chapter-picker.module.css";
import { chapterPath, chapterRange, type NavigationBook } from "@/src/domain/bible-navigation";

// Seletor de livro e capítulo do cabeçalho (tarefas C4 e C13).
//
// Escolher um livro troca imediatamente para seus capítulos. As contagens são
// recebidas junto da página, então não há uma navegação nem espera de banco entre
// esses dois toques.

export function ChapterPicker({
  books,
  currentBook,
  currentChapter,
  totalChapters,
  chapterCounts,
  translationCode,
}: {
  books: readonly NavigationBook[];
  currentBook: NavigationBook;
  currentChapter: number;
  totalChapters: number;
  chapterCounts: Readonly<Record<string, number>>;
  translationCode: string;
}) {
  const [open, setOpen] = useState<"livro" | "capitulo" | null>(null);
  const [selectedBook, setSelectedBook] = useState<NavigationBook>(currentBook);

  useEffect(() => {
    setSelectedBook(currentBook);
  }, [currentBook]);

  const close = useCallback(() => {
    setOpen(null);
  }, []);

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
                  <h2>{selectedBook.name}: capítulos</h2>
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
                    <button
                      type="button"
                      className={book.slug === currentBook.slug ? styles.current : undefined}
                      aria-current={book.slug === currentBook.slug ? "page" : undefined}
                      onClick={() => { setSelectedBook(book); setOpen("capitulo"); }}
                    >
                      <b>{book.orderNo}</b>
                      {book.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className={styles.chapters}>
                {chapterRange(chapterCounts[selectedBook.slug] ?? (selectedBook.slug === currentBook.slug ? totalChapters : 0)).map((number) => (
                  <li key={number}>
                    <Link
                      href={chapterPath(selectedBook.slug, number)}
                      aria-current={selectedBook.slug === currentBook.slug && number === currentChapter ? "page" : undefined}
                      className={selectedBook.slug === currentBook.slug && number === currentChapter ? styles.current : undefined}
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
