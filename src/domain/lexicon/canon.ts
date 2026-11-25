/**
 * Ordem canônica dos 66 livros, em código USFM (LEXICON-INDEX-001, fila C30).
 *
 * Os códigos aqui são exatamente os que aparecem na referência publicada pelo
 * MACULA (`GEN 1:1`, `JHN 1:1`) e foram conferidos contra o índice montado em
 * 19/11/2026: os 66 presentes no corpus batem um a um com esta lista, sem
 * sobra nem falta.
 *
 * A ordem importa porque o trabalho de tradução anda **por livro**, e andar por
 * livro só é previsível se a sequência for fixa. `TRANSLATION_BOOK_ORDER`
 * coloca Gênesis e João na frente, por decisão registrada: são os dois
 * capítulos que servem de prova de leitura no produto.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco.
 */

export type BookCode = string;

export type CanonBook = {
  readonly code: BookCode;
  /** Slug do livro nas rotas do leitor, igual ao `bookMap` de originals. */
  readonly slug: string;
  readonly name: string;
  readonly testament: "ot" | "nt";
};

export const CANON: readonly CanonBook[] = [
  { code: "GEN", slug: "genesis", name: "Gênesis", testament: "ot" },
  { code: "EXO", slug: "exodo", name: "Êxodo", testament: "ot" },
  { code: "LEV", slug: "levitico", name: "Levítico", testament: "ot" },
  { code: "NUM", slug: "numeros", name: "Números", testament: "ot" },
  { code: "DEU", slug: "deuteronomio", name: "Deuteronômio", testament: "ot" },
  { code: "JOS", slug: "josue", name: "Josué", testament: "ot" },
  { code: "JDG", slug: "juizes", name: "Juízes", testament: "ot" },
  { code: "RUT", slug: "rute", name: "Rute", testament: "ot" },
  { code: "1SA", slug: "1-samuel", name: "1 Samuel", testament: "ot" },
  { code: "2SA", slug: "2-samuel", name: "2 Samuel", testament: "ot" },
  { code: "1KI", slug: "1-reis", name: "1 Reis", testament: "ot" },
  { code: "2KI", slug: "2-reis", name: "2 Reis", testament: "ot" },
  { code: "1CH", slug: "1-cronicas", name: "1 Crônicas", testament: "ot" },
  { code: "2CH", slug: "2-cronicas", name: "2 Crônicas", testament: "ot" },
  { code: "EZR", slug: "esdras", name: "Esdras", testament: "ot" },
  { code: "NEH", slug: "neemias", name: "Neemias", testament: "ot" },
  { code: "EST", slug: "ester", name: "Ester", testament: "ot" },
  { code: "JOB", slug: "jo", name: "Jó", testament: "ot" },
  { code: "PSA", slug: "salmos", name: "Salmos", testament: "ot" },
  { code: "PRO", slug: "proverbios", name: "Provérbios", testament: "ot" },
  { code: "ECC", slug: "eclesiastes", name: "Eclesiastes", testament: "ot" },
  { code: "SNG", slug: "cantares", name: "Cântico dos Cânticos", testament: "ot" },
  { code: "ISA", slug: "isaias", name: "Isaías", testament: "ot" },
  { code: "JER", slug: "jeremias", name: "Jeremias", testament: "ot" },
  { code: "LAM", slug: "lamentacoes", name: "Lamentações", testament: "ot" },
  { code: "EZK", slug: "ezequiel", name: "Ezequiel", testament: "ot" },
  { code: "DAN", slug: "daniel", name: "Daniel", testament: "ot" },
  { code: "HOS", slug: "oseias", name: "Oseias", testament: "ot" },
  { code: "JOL", slug: "joel", name: "Joel", testament: "ot" },
  { code: "AMO", slug: "amos", name: "Amós", testament: "ot" },
  { code: "OBA", slug: "obadias", name: "Obadias", testament: "ot" },
  { code: "JON", slug: "jonas", name: "Jonas", testament: "ot" },
  { code: "MIC", slug: "miqueias", name: "Miqueias", testament: "ot" },
  { code: "NAM", slug: "naum", name: "Naum", testament: "ot" },
  { code: "HAB", slug: "habacuque", name: "Habacuque", testament: "ot" },
  { code: "ZEP", slug: "sofonias", name: "Sofonias", testament: "ot" },
  { code: "HAG", slug: "ageu", name: "Ageu", testament: "ot" },
  { code: "ZEC", slug: "zacarias", name: "Zacarias", testament: "ot" },
  { code: "MAL", slug: "malaquias", name: "Malaquias", testament: "ot" },
  { code: "MAT", slug: "mateus", name: "Mateus", testament: "nt" },
  { code: "MRK", slug: "marcos", name: "Marcos", testament: "nt" },
  { code: "LUK", slug: "lucas", name: "Lucas", testament: "nt" },
  { code: "JHN", slug: "joao", name: "João", testament: "nt" },
  { code: "ACT", slug: "atos", name: "Atos", testament: "nt" },
  { code: "ROM", slug: "romanos", name: "Romanos", testament: "nt" },
  { code: "1CO", slug: "1-corintios", name: "1 Coríntios", testament: "nt" },
  { code: "2CO", slug: "2-corintios", name: "2 Coríntios", testament: "nt" },
  { code: "GAL", slug: "galatas", name: "Gálatas", testament: "nt" },
  { code: "EPH", slug: "efesios", name: "Efésios", testament: "nt" },
  { code: "PHP", slug: "filipenses", name: "Filipenses", testament: "nt" },
  { code: "COL", slug: "colossenses", name: "Colossenses", testament: "nt" },
  { code: "1TH", slug: "1-tessalonicenses", name: "1 Tessalonicenses", testament: "nt" },
  { code: "2TH", slug: "2-tessalonicenses", name: "2 Tessalonicenses", testament: "nt" },
  { code: "1TI", slug: "1-timoteo", name: "1 Timóteo", testament: "nt" },
  { code: "2TI", slug: "2-timoteo", name: "2 Timóteo", testament: "nt" },
  { code: "TIT", slug: "tito", name: "Tito", testament: "nt" },
  { code: "PHM", slug: "filemom", name: "Filemom", testament: "nt" },
  { code: "HEB", slug: "hebreus", name: "Hebreus", testament: "nt" },
  { code: "JAS", slug: "tiago", name: "Tiago", testament: "nt" },
  { code: "1PE", slug: "1-pedro", name: "1 Pedro", testament: "nt" },
  { code: "2PE", slug: "2-pedro", name: "2 Pedro", testament: "nt" },
  { code: "1JN", slug: "1-joao", name: "1 João", testament: "nt" },
  { code: "2JN", slug: "2-joao", name: "2 João", testament: "nt" },
  { code: "3JN", slug: "3-joao", name: "3 João", testament: "nt" },
  { code: "JUD", slug: "judas", name: "Judas", testament: "nt" },
  { code: "REV", slug: "apocalipse", name: "Apocalipse", testament: "nt" },
];

const BY_CODE: ReadonlyMap<BookCode, CanonBook> = new Map(
  CANON.map((book) => [book.code, book]),
);

export function canonBook(code: BookCode): CanonBook | null {
  return BY_CODE.get(code) ?? null;
}

export function bookName(code: BookCode): string {
  return BY_CODE.get(code)?.name ?? code;
}

/**
 * Livros que começam primeiro. Gênesis e João saem da ordem canônica e vão
 * para a frente porque são os dois capítulos usados para validar o leitor:
 * traduzir o resto antes deles adiaria a única prova que o produto tem hoje.
 */
export const TRANSLATION_PRIORITY: readonly BookCode[] = ["GEN", "JHN"];

/** Ordem em que o trabalho de tradução percorre o cânone. */
export const TRANSLATION_BOOK_ORDER: readonly BookCode[] = [
  ...TRANSLATION_PRIORITY,
  ...CANON.map((book) => book.code).filter((code) => !TRANSLATION_PRIORITY.includes(code)),
];

/** Extrai o código do livro de uma referência canônica como `GEN 1:1`. */
const BY_SLUG: ReadonlyMap<string, CanonBook> = new Map(CANON.map((book) => [book.slug, book]));

/**
 * Código USFM a partir do slug do leitor. O leitor fala "genesis" e "joao"; o
 * MACULA publica "GEN" e "JHN". Sem esta ponte, a consulta lexical procuraria
 * uma referência que o índice não tem e devolveria vazio em silêncio.
 */
export function bookCodeOfSlug(slug: string): BookCode | null {
  return BY_SLUG.get(slug.trim().toLowerCase())?.code ?? null;
}

export function bookOfRef(canonicalRef: string): BookCode | null {
  const code = canonicalRef.split(" ")[0]?.trim() ?? "";
  return BY_CODE.has(code) ? code : null;
}
