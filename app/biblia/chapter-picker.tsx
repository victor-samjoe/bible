"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "./chapter-picker.module.css";
import { chapterPath, chapterRange, type NavigationBook } from "@/src/domain/bible-navigation";
import { chapterScope } from "@/src/domain/reader-marks";
import { useReader } from "./reader-state";

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
}: {
  books: readonly NavigationBook[];
  currentBook: NavigationBook;
  currentChapter: number;
  totalChapters: number;
  chapterCounts: Readonly<Record<string, number>>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { isReadScope } = useReader();
  const [open, setOpen] = useState<"livro" | "capitulo" | null>(null);
  const [selectedBook, setSelectedBook] = useState<NavigationBook>(currentBook);
  const [query, setQuery] = useState("");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [destination, setDestination] = useState<string | null>(null);

  const filteredBooks = useMemo(() => {
    const normalized = query.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
    if (!normalized) return books;
    return books.filter((book) => `${book.name} ${book.slug}`.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes(normalized));
  }, [books, query]);

  useEffect(() => {
    setSelectedBook(currentBook);
  }, [currentBook]);

  const close = useCallback(() => {
    setOpen(null);
    setQuery("");
  }, []);

  const navigateToChapter = useCallback((bookSlug: string, number: number) => {
    const path = chapterPath(bookSlug, number);
    setDestination(`${selectedBook.name} ${number}`);
    setOpen(null);
    startTransition(() => router.push(path));
  }, [router, selectedBook.name]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, open]);

  useEffect(() => {
    const openVersions = () => setVersionsOpen(true);
    window.addEventListener("reader-open-versions", openVersions);
    return () => window.removeEventListener("reader-open-versions", openVersions);
  }, []);

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
                <div><h2>Livros</h2><p>Escolha um livro ou filtre pelo nome.</p></div>
              )}
              <button type="button" onClick={close} aria-label="Fechar seletor">
                ×
              </button>
            </header>

            {open === "livro" ? (
              <>
                <label className={styles.filter}>
                  <span>Filtrar livros</span>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: João, Salmos, Gênesis" />
                </label>
                <ul className={styles.books} aria-label="Livros disponíveis">
                {filteredBooks.map((book) => (
                  <li key={book.slug}>
                    <button
                      type="button"
                      className={book.slug === currentBook.slug ? styles.current : undefined}
                      aria-current={book.slug === currentBook.slug ? "page" : undefined}
                      onClick={() => { setSelectedBook(book); setOpen("capitulo"); }}
                    >
                      {book.name}
                    </button>
                  </li>
                ))}
                {filteredBooks.length === 0 ? <li className={styles.empty}>Nenhum livro encontrado para “{query}”.</li> : null}
                </ul>
              </>
            ) : (
              <ul className={styles.chapters}>
                {chapterRange(chapterCounts[selectedBook.slug] ?? (selectedBook.slug === currentBook.slug ? totalChapters : 0)).map((number) => (
                  <li key={number}>
                    <button
                      type="button"
                      aria-current={selectedBook.slug === currentBook.slug && number === currentChapter ? "page" : undefined}
                      className={selectedBook.slug === currentBook.slug && number === currentChapter ? styles.current : undefined}
                      onClick={() => navigateToChapter(selectedBook.slug, number)}
                    >
                      {isReadScope(chapterScope(selectedBook.slug, number)) ? <span className={styles.readFlag} aria-label="Capítulo lido">⚑</span> : null}
                      {number}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {destination && isPending ? <div className={styles.loading} role="status" aria-live="polite"><span /><strong>Abrindo {destination}</strong><p>Carregando o capítulo selecionado…</p></div> : null}

      {versionsOpen ? (
        <div className={styles.backdrop} role="presentation" onClick={() => setVersionsOpen(false)}>
          <section className={styles.sheet} role="dialog" aria-modal="true" aria-label="Escolher versão" onClick={(event) => event.stopPropagation()}>
            <header><div><h2>Versões</h2><p>A versão muda por este nome, nunca por uma ação de seleção.</p></div><button type="button" onClick={() => setVersionsOpen(false)} aria-label="Fechar versões">×</button></header>
            <div className={styles.versions}>
              <button type="button" className={styles.current} aria-pressed="true">BLIVRE <span>Bíblia Livre · disponível</span></button>
              {['NVI', 'NTLH', 'Almeida'].map((version) => <button type="button" key={version} disabled>{version} <span>Em licenciamento</span></button>)}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
