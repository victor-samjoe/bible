import { cache, Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getBlivreReader } from "@/src/server/bible/runtime";
import {
  canonicalReference,
  chapterNeighbours,
  chapterPath,
  previousBookOf,
} from "@/src/domain/bible-navigation";
import { chapterScope } from "@/src/domain/reader-marks";
import { loadAccountReading } from "@/src/server/reading/runtime";
import { ReaderProvider } from "../../reader-state";
import { ReaderChapter } from "../../reader-chapter";
import { ReaderTools } from "../../reader-tools";
import { ChapterPicker } from "../../chapter-picker";
import { SelectionBar } from "../../selection-bar";
import { ReaderUnavailable } from "../../reader-unavailable";
import { ReaderSideMenu } from "../../reader-side-menu";
import { ChapterQuickNavigation } from "../../chapter-quick-navigation";

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
  return reader.readChapter(book, chapter);
});

// Dados do seletor não podem atrasar o texto. Esta promessa é compartilhada
// pelos dois Suspense abaixo e roda em paralelo com o capítulo principal.
const loadNavigation = cache(async () => {
  const reader = await getBlivreReader();
  const [booksResult, countsResult] = await Promise.all([reader.listBooks(), reader.listChapterCounts()]);
  if (!booksResult.ok) return null;
  const books = booksResult.books;
  const countsByBookId = countsResult.ok
    ? new Map(countsResult.counts.map((entry) => [entry.bookId, entry.count]))
    : new Map<string, number>();
  const chapterCounts = Object.fromEntries(
    books.map((entry) => [entry.slug, countsByBookId.get(entry.id) ?? 0]),
  );
  return { books, chapterCounts };
});

function PickerFallback({ name, chapter }: { name: string; chapter: number }) {
  // O fallback ocupa a faixa central enquanto a lista de livros chega. Ele não
  // pode capturar o toque dos controles laterais nesse intervalo.
  return <div className="readerPick" aria-busy="true" style={{ pointerEvents: "none" }}><span>{name}</span><b>{chapter}</b></div>;
}

async function DeferredChapterPicker({ currentBook, currentChapter }: { currentBook: { id: string; slug: string; name: string; code: string; orderNo: number }; currentChapter: number }) {
  const navigation = await loadNavigation();
  if (!navigation) return <PickerFallback name={currentBook.name} chapter={currentChapter} />;
  return <ChapterPicker books={navigation.books} currentBook={currentBook} currentChapter={currentChapter} totalChapters={Math.max(navigation.chapterCounts[currentBook.slug] ?? 0, currentChapter)} chapterCounts={navigation.chapterCounts} />;
}

async function DeferredChapterNavigation({ currentBookSlug, currentChapter }: { currentBookSlug: string; currentChapter: number }) {
  const navigation = await loadNavigation();
  if (!navigation) return null;
  const currentBook = navigation.books.find((book) => book.slug === currentBookSlug);
  if (!currentBook) return null;
  let chaptersInPreviousBook = 0;
  if (currentChapter === 1) {
    const previousBook = previousBookOf(navigation.books, currentBook.slug);
    if (previousBook) {
      chaptersInPreviousBook = navigation.chapterCounts[previousBook.slug] ?? 0;
    }
  }
  const { previous, next } = chapterNeighbours({
    books: navigation.books,
    currentBookSlug,
    currentChapter,
    chaptersInBook: Math.max(navigation.chapterCounts[currentBook.slug] ?? 0, currentChapter),
    chaptersInPreviousBook,
  });
  return <ChapterQuickNavigation
    previous={previous ? { href: chapterPath(previous.book.slug, previous.chapter), label: canonicalReference(previous.book.name, previous.chapter) } : null}
    next={next ? { href: chapterPath(next.book.slug, next.chapter), label: canonicalReference(next.book.name, next.chapter) } : null}
  />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { book, chapter } = await params;
  const loaded = await loadChapter(book, chapter);
  if (!loaded.ok) {
    return {
      title: "Leitura indisponível | Bíblia Bereana",
      description:
        "Nenhum versículo é exibido quando a fonte não pode ser verificada no corpus publicado.",
      robots: { index: false },
    };
  }
  const reference = canonicalReference(loaded.book.name, loaded.chapter.number);
  return {
    title: `${reference} | Bíblia Bereana`,
    description: `${reference} para leitura e estudo na Bíblia Bereana.`,
    alternates: { canonical: chapterPath(loaded.book.slug, loaded.chapter.number) },
  };
}

export default async function ChapterPage({ params }: { params: Promise<RouteParams> }) {
  const { book, chapter } = await params;
  const loaded = await loadChapter(book, chapter);

  if (!loaded.ok) {
    // Refer�ncia inexistente ou malformada � 404; falta de banco, tradu��o n�o
    // aprovada ou cap�tulo sem publica��o s�o estados explicados ao leitor.
    if (loaded.reason === "not_found" || loaded.reason === "invalid_reference") {
      notFound();
    }
    return <ReaderUnavailable reason={loaded.reason} />;
  }

  const { translation, book: currentBook, chapter: currentChapter, verses } = loaded;
  const reference = canonicalReference(currentBook.name, currentChapter.number);

  // Estado pessoal de quem está lendo. `null` para visitante sem sessão, e
  // também quando o banco não responde: nos dois casos o leitor funciona e
  // guarda apenas no navegador, dizendo isso na tela.
  const account = await loadAccountReading();

  return (
    <ReaderProvider
      scope={chapterScope(currentBook.slug, currentChapter.number)}
      reference={reference}
      verseNumbers={verses.map((verse) => verse.number)}
      verseTexts={verses.map((verse) => ({ number: verse.number, content: verse.content }))}
      translationName={translation.name.includes("Livre") ? "Bíblia Livre" : translation.name}
      account={account}
    >
      <main className="readerShell">
        <header className="readerTop">
          <div className="readerMenu" style={{ position: "relative", zIndex: 2 }}>
            <ReaderSideMenu />
          </div>
          <Suspense fallback={<PickerFallback name={currentBook.name} chapter={currentChapter.number} />}>
            <DeferredChapterPicker currentBook={currentBook} currentChapter={currentChapter.number} />
          </Suspense>
          <div className="readerActions" aria-label="Ações do capítulo" style={{ position: "relative", zIndex: 2 }}>
            <ReaderTools />
          </div>
        </header>

        <ReaderChapter
          bookName={currentBook.name}
          chapterNumber={currentChapter.number}
          translationName={translation.name.includes("Livre") ? "Bíblia Livre" : translation.name}
          verses={verses}
          navigation={<Suspense fallback={null}><DeferredChapterNavigation currentBookSlug={currentBook.slug} currentChapter={currentChapter.number} /></Suspense>}
        />

        {/* Barra de ações: aparece apenas quando há versículo selecionado. */}
        <SelectionBar />

        <footer className="readerFooter">
          <Link href="/estudos">Contexto e estudos</Link>
          <span>
            {reference} · Bíblia Livre
          </span>
          <Link href="/direitos-autorais">Direitos</Link>
        </footer>
      </main>
    </ReaderProvider>
  );
}
