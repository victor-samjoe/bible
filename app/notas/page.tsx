import { NotesLibrary } from "./notes-library";
import { getBlivreReader } from "@/src/server/bible/runtime";
import { getAccountSession } from "@/src/server/auth/runtime";
import { loadAccountReading } from "@/src/server/reading/runtime";

export const metadata = {
  title: "Notas | Bíblia Bereana",
  description: "Notas pessoais feitas durante a leitura bíblica.",
};

export const dynamic = "force-dynamic";

/**
 * Biblioteca pessoal. As notas autenticadas vêm da mesma fonte do leitor; as
 * notas da sessão atual continuam disponíveis para quem ainda não entrou.
 */
export default async function NotesPage() {
  const [session, accountReading, reader] = await Promise.all([
    getAccountSession(),
    loadAccountReading(),
    getBlivreReader(),
  ]);
  const books = await reader.listBooks();
  const bookNames = books.ok
    ? Object.fromEntries(books.books.map((book) => [book.slug, book.name]))
    : {};

  return (
    <NotesLibrary
      accountNotes={accountReading?.marks.notes ?? {}}
      bookNames={bookNames}
      signedIn={session.state === "authenticated"}
    />
  );
}
