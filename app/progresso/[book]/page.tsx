import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBlivreReader } from "@/src/server/bible/runtime";
import { loadAccountProgress } from "@/src/server/reading/progress-runtime";
import { BookChapters } from "./book-chapters";

export const dynamic = "force-dynamic";

type RouteParams = { book: string };

/**
 * Capítulos de um livro, com a marca de cada um (`READING-PROGRESS-001`).
 *
 * Os capítulos vêm de `listChapters`, isto é, dos números que existem no corpus
 * — não de `1..n` presumido. Livro que o corpus não tem devolve 404 de verdade,
 * em vez de uma grade vazia que pareceria "nada lido".
 */
const loadBook = cache(async (book: string) => {
  const blivre = await getBlivreReader();
  return blivre.listChapters(book);
});

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { book } = await params;
  const listing = await loadBook(book);
  if (!listing.ok) return { title: "Livro não encontrado | Bíblia Bereana" };
  return {
    title: `Progresso em ${listing.book.name} | Bíblia Bereana`,
    description: `Capítulos lidos em ${listing.book.name}.`,
  };
}

export default async function BookProgressPage({ params }: { params: Promise<RouteParams> }) {
  const { book } = await params;
  const [listing, accountProgress] = await Promise.all([loadBook(book), loadAccountProgress()]);
  if (!listing.ok) notFound();

  return (
    <BookChapters
      book={{ slug: listing.book.slug, name: listing.book.name, code: listing.book.code }}
      chapterNumbers={listing.chapters.map((chapter) => chapter.number)}
      accountStatus={accountProgress.status}
      accountScopes={accountProgress.status === "ready" ? accountProgress.scopes : []}
    />
  );
}
