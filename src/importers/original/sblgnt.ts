/**
 * Parser do texto do SBL Greek New Testament (tarefa C14).
 *
 * Função pura: recebe o conteúdo de um arquivo oficial por livro e devolve
 * versículos e tokens. Não acessa filesystem, rede nem banco.
 *
 * Formato do artefato oficial (`https://www.sblgnt.com/download/<NN-Bk>.txt`):
 * a primeira linha é o título do livro em grego e cada linha seguinte é
 * `Bk C:V<TAB>texto`.
 *
 * Limites deliberados:
 * - **somente texto.** Morfologia do NT exige fonte e licença próprias e não
 *   está aprovada; este parser não produz lema nem morfologia;
 * - os arquivos `-APP` (aparato crítico) são ativo separado e não entram aqui;
 * - nenhuma glossa, tradução ou transliteração é gerada.
 */

export type GreekToken = {
  readonly position: number;
  readonly surface: string;
  /** Superfície sem pontuação de borda. Não é lema nem normalização lexical. */
  readonly normalized: string;
};

export type GreekVerse = {
  readonly canonBook: string;
  readonly chapter: number;
  readonly verse: number;
  readonly canonicalRef: string;
  readonly text: string;
  readonly tokens: readonly GreekToken[];
};

export type SblgntBook = {
  readonly bookCode: string;
  readonly title: string;
  readonly verses: readonly GreekVerse[];
};

export type ParseIssue = { readonly line: number; readonly reason: string; readonly raw: string };

export type SblgntParseResult = {
  readonly book: SblgntBook;
  /** Linhas recusadas. Nada é adivinhado: o que não casa com o formato é relatado. */
  readonly issues: readonly ParseIssue[];
};

const VERSE_LINE = /^([1-3]?\s?[A-Za-z]+)\s+(\d{1,3}):(\d{1,3})\t(.+)$/u;

/** Pontuação grega e latina usada no SBLGNT, removida apenas nas bordas do token. */
const EDGE_PUNCTUATION = /^[\s.,;:!?·—–\-"'“”‘’()\[\]⟦⟧]+|[\s.,;:!?·—–\-"'“”‘’()\[\]⟦⟧]+$/gu;

export function normalizeGreekToken(surface: string): string {
  return surface.replace(EDGE_PUNCTUATION, "");
}

export function tokenizeGreekVerse(text: string): readonly GreekToken[] {
  const tokens: GreekToken[] = [];
  let position = 0;
  for (const raw of text.split(/\s+/)) {
    const surface = raw.trim();
    if (surface.length === 0) continue;
    const normalized = normalizeGreekToken(surface);
    if (normalized.length === 0) continue;
    position += 1;
    tokens.push({ position, surface, normalized });
  }
  return tokens;
}

/**
 * Converte um arquivo de livro. `bookCode` é o código canônico adotado pela
 * plataforma; a sigla do arquivo é conferida contra ele e divergência é relatada
 * em vez de corrigida silenciosamente.
 */
export function parseSblgntBook(content: string, bookCode: string): SblgntParseResult {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const verses: GreekVerse[] = [];
  const issues: ParseIssue[] = [];
  const seen = new Set<string>();
  let title = "";

  lines.forEach((raw, index) => {
    const line = raw.replace(/﻿/g, "");
    if (line.trim().length === 0) return;
    const match = VERSE_LINE.exec(line);
    if (!match) {
      // A primeira linha não-vazia sem referência é o título do livro.
      if (title.length === 0 && !line.includes("\t")) {
        title = line.trim();
        return;
      }
      issues.push({ line: index + 1, reason: "formato não reconhecido", raw: line.slice(0, 120) });
      return;
    }
    const [, sigla, rawChapter, rawVerse, text] = match;
    const chapter = Number(rawChapter);
    const verse = Number(rawVerse);
    const body = (text ?? "").trim();
    if (body.length === 0) {
      issues.push({ line: index + 1, reason: "versículo vazio", raw: line.slice(0, 120) });
      return;
    }
    if ((sigla ?? "").replace(/\s+/g, "").toLowerCase() !== bookCode.replace(/\s+/g, "").toLowerCase()) {
      issues.push({
        line: index + 1,
        reason: `sigla ${String(sigla).trim()} diverge do livro ${bookCode}`,
        raw: line.slice(0, 120),
      });
      return;
    }
    const canonicalRef = `${bookCode} ${chapter}:${verse}`;
    if (seen.has(canonicalRef)) {
      issues.push({ line: index + 1, reason: "referência repetida", raw: canonicalRef });
      return;
    }
    seen.add(canonicalRef);
    verses.push({
      canonBook: bookCode,
      chapter,
      verse,
      canonicalRef,
      text: body,
      tokens: tokenizeGreekVerse(body),
    });
  });

  verses.sort((left, right) => left.chapter - right.chapter || left.verse - right.verse);
  return { book: { bookCode, title, verses }, issues };
}

export function countTokens(book: SblgntBook): number {
  return book.verses.reduce((total, verse) => total + verse.tokens.length, 0);
}
