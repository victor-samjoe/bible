import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getBlivreReader } from "@/src/server/bible/runtime";
import { chapterPath } from "@/src/domain/bible-navigation";
import { ReaderUnavailable } from "./reader-unavailable";

// /biblia e a porta de entrada: manda para o primeiro livro do corpus, em vez de
// manter um capitulo fixo no codigo. A navegacao real vive em
// /biblia/[book]/[chapter] (tarefa C4).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bíblia Livre (BLIVRE) | Bíblia Bereana",
  description:
    "Leitura da Bíblia Livre (BLIVRE), licenciada em Creative Commons Atribuição 4.0 Brasil.",
};

export default async function BiblePage() {
  const reader = await getBlivreReader();
  const books = await reader.listBooks();

  // redirect() lanca por design: fica fora de qualquer try/catch.
  if (books.ok) {
    const first = books.books[0];
    if (first) redirect(chapterPath(first.slug, 1));
  }

  return <ReaderUnavailable reason={books.ok ? "not_found" : books.reason} />;
}
