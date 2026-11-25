import type { ProgressBook, ProgressChapterCount } from "@/src/domain/reading-progress";
import { getBlivreReader } from "@/src/server/bible/runtime";
import { loadAccountProgress } from "@/src/server/reading/progress-runtime";
import { ProgressOverview } from "./progress-overview";

export const metadata = {
  title: "Leituras realizadas | Bíblia Bereana",
  description: "Progresso de leitura por testamento, livro e capítulo.",
};

export const dynamic = "force-dynamic";

/**
 * Página "Leituras realizadas" (`READING-PROGRESS-001`).
 *
 * O servidor entrega três coisas, e só elas: a lista real de livros, a contagem
 * real de capítulos por livro e os capítulos marcados **da sessão atual**. O
 * progresso da conta vem de `loadAccountProgress()`, que resolve a identidade
 * pelo cookie — nenhuma consulta desta página aceita usuário por parâmetro, e
 * por isso não existe caminho pelo qual ela devolva dado de outra pessoa.
 *
 * Banco indisponível não é erro de página: o leitor responde `unavailable`, a
 * lista chega vazia e a interface explica que não há totais.
 */
export default async function ProgressPage() {
  const [accountProgress, reader] = await Promise.all([loadAccountProgress(), getBlivreReader()]);
  const [listing, counts] = await Promise.all([reader.listBooks(), reader.listChapterCounts()]);

  const books: readonly ProgressBook[] = listing.ok
    ? listing.books.map((book) => ({
        id: book.id,
        code: book.code,
        slug: book.slug,
        name: book.name,
        orderNo: book.orderNo,
      }))
    : [];

  const chapterCounts: readonly ProgressChapterCount[] = counts.ok ? counts.counts : [];

  return (
    <ProgressOverview
      books={books}
      chapterCounts={chapterCounts}
      corpusAvailable={listing.ok && books.length > 0}
      accountStatus={accountProgress.status}
      accountScopes={accountProgress.status === "ready" ? accountProgress.scopes : []}
    />
  );
}
