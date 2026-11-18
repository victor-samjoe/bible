import { parseMarkKey } from "./reader-marks";

/** Uma anotação pronta para a biblioteca pessoal, derivada de uma marca válida. */
export type ReadingNote = {
  readonly key: string;
  readonly bookSlug: string;
  readonly chapter: number;
  readonly verses: string;
  readonly reference: string;
  readonly path: string;
  readonly text: string;
};

/**
 * Transforma as chaves internas do leitor em uma lista segura para a página de
 * Notas. Chave ou texto inválido nunca vira item visível.
 */
export function buildReadingNotes(
  source: Readonly<Record<string, string>>,
  bookNames: Readonly<Record<string, string>>,
): readonly ReadingNote[] {
  const notes: ReadingNote[] = [];

  for (const [key, rawText] of Object.entries(source)) {
    const parsed = parseMarkKey(key);
    const text = rawText.trim();
    if (parsed === null || text.length === 0) continue;

    const separator = parsed.scope.lastIndexOf(".");
    const bookSlug = parsed.scope.slice(0, separator);
    const chapter = Number(parsed.scope.slice(separator + 1));
    const verses = key.slice(key.lastIndexOf(".") + 1);
    const bookName = bookNames[bookSlug] ?? humanizeBookSlug(bookSlug);
    notes.push({
      key,
      bookSlug,
      chapter,
      verses,
      reference: `${bookName} ${chapter}:${verses}`,
      path: `/biblia/${bookSlug}/${chapter}`,
      text,
    });
  }

  return notes.sort((left, right) =>
    left.bookSlug.localeCompare(right.bookSlug, "pt-BR") || left.chapter - right.chapter || left.verses.localeCompare(right.verses, "pt-BR"),
  );
}

function humanizeBookSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
