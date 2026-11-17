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
import { ReaderProvider } from "../../reader-state";
import { ReaderChapter } from "../../reader-chapter";
import { ReaderTools } from "../../reader-tools";
import { ThemeToggle } from "../../theme-toggle";
import { ChapterPicker } from "../../chapter-picker";
import { ReaderUnavailable } from "../../reader-unavailable";

// Leitor ligado ao corpus (tarefa C4). O capítulo vem do banco pelo contrato de
// leitura (`src/server/bible/**`), que só entrega versículo publicado de tradução
// aprovada. Nenhum texto bíblico existe neste arquivo.
//
// Dinâmica por requisição: não há geração estática de 1189 capítulos nem
// dependência de banco no momento do build.
export const dynamic = "force-dynamic";

type RouteParams = { book: string; chapter: string };

/**
 * Carregamento único por requisição. `cache` da React faz `generateMetadata` e o
 * componente compartilharem o mesmo resultado, em vez de consultar duas vezes.
 */
const loadChapter = cache(async (book: string, chapter: string) => {
  const reader = await getBlivreReader();
  const chapterResult = await reader.readChapter(book, chapter);
  if (!chapterResult.ok) return { chapter: chapterResult, books: null, totalChapters: 0 };
  const [booksResult, chaptersResult] = await Promise.all([
    reader.listBooks(),
    reader.listChapters(book),
  ]);
  const books = booksResult.ok ? booksResult.books : null;

  // No capítulo 1, o link de "anterior" precisa saber onde o livro anterior
  // termina. Essa consulta extra só acontece nesse caso, e sem ela o link
  // apontaria para o capítulo 1 do livro anterior em vez do último.
  let chaptersInPreviousBook = 0;
  if (chapterResult.chapter.number === 1 && books) {
    const previousBook = previousBookOf(books, chapterResult.book.slug);
    if (previousBook) {
      const previousChapters = await reader.listChapters(previousBook.slug);
      chaptersInPreviousBook = previousChapters.ok ? previousChapters.chapters.length : 0;
    }
  }

  return {
    chapter: chapterResult,
    books,
    totalChapters: chaptersResult.ok ? chaptersResult.chapters.length : 0,
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
    // Referência inexistente ou malformada é 404; falta de banco, tradução não
    // aprovada ou capítulo sem publicação são estados explicados ao leitor.
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
      scope={`${currentBook.slug}.${currentChapter.number}`}
      reference={reference}
      verseNumbers={verses.map((verse) => verse.number)}
    >
      <main className="readerShell">
        <header className="readerTop">
          <div className="readerMenu">
            <ReaderTools />
          </div>
          <ChapterPicker
            books={books}
            currentBook={currentBook}
            currentChapter={currentChapter.number}
            totalChapters={totalChapters}
            translationCode="BLIVRE"
          />
          <div className="readerActions" aria-label="Ferramentas de leitura">
            <ThemeToggle />
          </div>
        </header>

        <ReaderChapter
          bookName={currentBook.name}
          chapterNumber={currentChapter.number}
          translationName={translation.name}
          verses={verses}
        />

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
