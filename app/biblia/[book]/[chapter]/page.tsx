import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getBlivreReader } from "@/src/server/bible/runtime";
import {
  canonicalReference,
  chapterNeighbours,
  chapterPath,
  previousBookOf,
  type NavigationBook,
} from "@/src/domain/bible-navigation";
import { chapterScope } from "@/src/domain/reader-marks";
import { ReaderProvider } from "../../reader-state";
import { ReaderChapter } from "../../reader-chapter";
import { ReaderTools } from "../../reader-tools";
import { ChapterPicker } from "../../chapter-picker";
import { ChapterReadToggle } from "../../chapter-read-toggle";
import { SelectionBar } from "../../selection-bar";
import { ReaderUnavailable } from "../../reader-unavailable";
import { ReaderSideMenu } from "../../reader-side-menu";

// Leitor ligado ao corpus (tarefa C4). O cap�tulo vem do banco pelo contrato de
// leitura (`src/server/bible/**`), que s� entrega vers�culo publicado de tradu��o
// aprovada. Nenhum texto b�blico existe neste arquivo.
//
// Din�mica por requisi��o: n�o h� gera��o est�tica de 1189 cap�tulos nem
// depend�ncia de banco no momento do build.
export const dynamic = "force-dynamic";

type RouteParams = { book: string; chapter: string };

/**
 * Carregamento �nico por requisi��o. `cache` da React faz `generateMetadata` e o
 * componente compartilharem o mesmo resultado, em vez de consultar duas vezes.
 */
const loadChapter = cache(async (book: string, chapter: string) => {
  const reader = await getBlivreReader();
  const chapterResult = await reader.readChapter(book, chapter);
  if (!chapterResult.ok) {
    return {
      chapter: chapterResult,
      books: null,
      totalChapters: 0,
      chapterCounts: {},
      chaptersInPreviousBook: 0,
    };
  }
  const booksResult = await reader.listBooks();
  const books = booksResult.ok ? booksResult.books : null;
  const chapterListings = books
    ? await Promise.all(
        books.map(async (entry) => {
          const result = await reader.listChapters(entry.slug);
          return [entry.slug, result.ok ? result.chapters.length : 0] as const;
        }),
      )
    : [];
  const chapterCounts = Object.fromEntries(chapterListings);

  // No cap�tulo 1, o link de "anterior" precisa saber onde o livro anterior
  // termina. Essa consulta extra s� acontece nesse caso, e sem ela o link
  // apontaria para o cap�tulo 1 do livro anterior em vez do �ltimo.
  let chaptersInPreviousBook = 0;
  if (chapterResult.chapter.number === 1 && books) {
    const previousBook = previousBookOf(books, chapterResult.book.slug);
    if (previousBook) {
      chaptersInPreviousBook = chapterCounts[previousBook.slug] ?? 0;
    }
  }

  return {
    chapter: chapterResult,
    books,
    totalChapters: chapterCounts[chapterResult.book.slug] ?? 0,
    chapterCounts,
    chaptersInPreviousBook,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { book, chapter } = await params;
  const loaded = await loadChapter(book, chapter);
  if (!loaded.chapter.ok) {
    return {
      title: "Leitura indisponível | Bíblia Bereana",
      description:
        "Nenhum versículo é exibido quando a fonte não pode ser verificada no corpus publicado.",
      robots: { index: false },
    };
  }
  const reference = canonicalReference(loaded.chapter.book.name, loaded.chapter.chapter.number);
  return {
    title: `${reference} · Bíblia Livre (BLIVRE) | Bíblia Bereana`,
    description: `${reference} na tradução Bíblia Livre (BLIVRE), licenciada em Creative Commons Atribuição 4.0 Brasil.`,
    alternates: { canonical: chapterPath(loaded.chapter.book.slug, loaded.chapter.chapter.number) },
  };
}

export default async function ChapterPage({ params }: { params: Promise<RouteParams> }) {
  const { book, chapter } = await params;
  const loaded = await loadChapter(book, chapter);

  if (!loaded.chapter.ok) {
    // Refer�ncia inexistente ou malformada � 404; falta de banco, tradu��o n�o
    // aprovada ou cap�tulo sem publica��o s�o estados explicados ao leitor.
    if (loaded.chapter.reason === "not_found" || loaded.chapter.reason === "invalid_reference") {
      notFound();
    }
    return <ReaderUnavailable reason={loaded.chapter.reason} />;
  }

  const { translation, book: currentBook, chapter: currentChapter, verses } = loaded.chapter;
  const reference = canonicalReference(currentBook.name, currentChapter.number);
  const books: readonly NavigationBook[] = loaded.books ?? [currentBook];
  const totalChapters = Math.max(loaded.totalChapters, currentChapter.number);
  const { previous, next } = chapterNeighbours({
    books,
    currentBookSlug: currentBook.slug,
    currentChapter: currentChapter.number,
    chaptersInBook: totalChapters,
    chaptersInPreviousBook: loaded.chaptersInPreviousBook,
  });

  return (
    <ReaderProvider
      scope={chapterScope(currentBook.slug, currentChapter.number)}
      reference={reference}
      verseNumbers={verses.map((verse) => verse.number)}
      verseTexts={verses.map((verse) => ({ number: verse.number, content: verse.content }))}
    >
      <main className="readerShell">
        <header className="readerTop">
          <div className="readerMenu">
            <ReaderSideMenu />
          </div>
          <ChapterPicker
            books={books}
            currentBook={currentBook}
            currentChapter={currentChapter.number}
            totalChapters={totalChapters}
            chapterCounts={loaded.chapterCounts}
            translationCode="BLIVRE"
          />
          <div className="readerActions" aria-label="Ações do capítulo">
            <nav aria-label="Navegação rápida entre capítulos" style={{ display: "flex", gap: 4 }}>
              {previous ? <Link href={chapterPath(previous.book.slug, previous.chapter)} rel="prev" aria-label={`Capítulo anterior: ${canonicalReference(previous.book.name, previous.chapter)}`} title="Capítulo anterior" style={{ display: "grid", placeItems: "center", width: 30, height: 30, color: "inherit", textDecoration: "none", opacity: 0.72, fontSize: "1rem" }}>←</Link> : null}
              {next ? <Link href={chapterPath(next.book.slug, next.chapter)} rel="next" aria-label={`Próximo capítulo: ${canonicalReference(next.book.name, next.chapter)}`} title="Próximo capítulo" style={{ display: "grid", placeItems: "center", width: 30, height: 30, color: "inherit", textDecoration: "none", opacity: 0.72, fontSize: "1rem" }}>→</Link> : null}
            </nav>
            <ChapterReadToggle />
            <ReaderTools />
          </div>
        </header>

        <ReaderChapter
          bookName={currentBook.name}
          chapterNumber={currentChapter.number}
          translationName={translation.name.includes("Livre") ? "Bíblia Livre" : translation.name}
          verses={verses}
        />

        {/* Barra de ações: aparece apenas quando há versículo selecionado. */}
        <SelectionBar />

        <nav className="chapterNav" aria-label="Navegação entre capítulos">
          {previous ? (
            <Link href={chapterPath(previous.book.slug, previous.chapter)} rel="prev">
              <span aria-hidden="true">←</span>{" "}
              {canonicalReference(previous.book.name, previous.chapter)}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={chapterPath(next.book.slug, next.chapter)} rel="next">
              {canonicalReference(next.book.name, next.chapter)} <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <footer className="readerFooter">
          <Link href="/estudos">Contexto e estudos</Link>
          <span>
            {reference} · {translation.attribution}
          </span>
          <Link href="/direitos-autorais">Direitos</Link>
        </footer>
      </main>
    </ReaderProvider>
  );
}
