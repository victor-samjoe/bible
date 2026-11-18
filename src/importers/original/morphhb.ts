/**
 * Parser do Open Scriptures Hebrew Bible / MorphHB (tarefa C14).
 *
 * Função pura sobre o OSIS XML oficial: devolve versículos, tokens e morfemas,
 * mantendo **separados** os três ativos que a licença trata como independentes:
 *
 * - texto hebraico (base WLC, domínio público);
 * - segmentação, lema e código morfológico (OSHB, CC BY 4.0);
 * - definição/glossa lexical — **não produzida aqui**, porque exige fonte
 *   lexical própria e aprovada. O campo não existe no resultado, de propósito.
 *
 * O arquivo traz morfemas separados por `/` em `lemma`, `morph` e na superfície.
 * O parser preserva essa divisão em vez de concatenar, e nunca inventa um
 * morfema que não esteja no arquivo.
 *
 * Não acessa filesystem, rede nem banco; recebe o XML como string.
 */

export type HebrewMorpheme = {
  readonly position: number;
  readonly surface: string;
  /** Lema como publicado pela fonte (pode conter sufixo de homógrafo, ex. "1254 a"). */
  readonly lemma: string;
  /** Código morfológico da fonte, sem reinterpretação. */
  readonly morphologyCode: string;
};

export type HebrewToken = {
  readonly position: number;
  /** Superfície completa da palavra, com os morfemas unidos como no arquivo. */
  readonly surface: string;
  /** Superfície sem os separadores de morfema, para exibição contínua. */
  readonly normalized: string;
  /** Identificador estável da fonte (atributo `id` do `<w>`), quando presente. */
  readonly sourceTokenId: string | null;
  readonly morphemes: readonly HebrewMorpheme[];
};

export type HebrewVerse = {
  readonly canonBook: string;
  readonly chapter: number;
  readonly verse: number;
  readonly canonicalRef: string;
  /** Texto contínuo, reconstruído a partir dos tokens, sem separadores. */
  readonly text: string;
  readonly tokens: readonly HebrewToken[];
};

export type MorphhbParseIssue = {
  readonly osisId: string;
  readonly reason: string;
};

export type MorphhbParseResult = {
  readonly bookCode: string;
  readonly verses: readonly HebrewVerse[];
  readonly issues: readonly MorphhbParseIssue[];
};

const VERSE_BLOCK = /<verse\s+osisID="([^"]+)"\s*>([\s\S]*?)<\/verse>/gu;
const WORD = /<w\b([^>]*)>([\s\S]*?)<\/w>/gu;
const ATTRIBUTE = (name: string) => new RegExp(`${name}="([^"]*)"`, "u");

function attribute(raw: string, name: string): string | null {
  const match = ATTRIBUTE(name).exec(raw);
  return match && match[1] !== undefined ? match[1] : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Remove marcação interna (ex. `<seg>`) preservando o texto. */
function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/gu, "")).trim();
}

/**
 * Divide morfemas. A fonte usa `/` em superfície, lema e morfologia; o prefixo
 * `H` do código morfológico indica o idioma e é mantido apenas no primeiro
 * segmento, como no arquivo.
 */
function buildMorphemes(surface: string, lemma: string, morph: string): HebrewMorpheme[] {
  const surfaces = surface.split("/");
  const lemmas = lemma.split("/");
  const morphs = morph.replace(/^H/u, "").split("/");
  const total = Math.max(surfaces.length, lemmas.length, morphs.length);
  const morphemes: HebrewMorpheme[] = [];
  for (let index = 0; index < total; index += 1) {
    const piece = surfaces[index] ?? "";
    if (piece.trim().length === 0 && index >= surfaces.length) break;
    morphemes.push({
      position: index + 1,
      surface: piece,
      lemma: (lemmas[index] ?? "").trim(),
      morphologyCode: (morphs[index] ?? "").trim(),
    });
  }
  return morphemes;
}

export function parseMorphhbBook(xml: string, bookCode: string): MorphhbParseResult {
  const verses: HebrewVerse[] = [];
  const issues: MorphhbParseIssue[] = [];
  const seen = new Set<string>();

  for (const block of xml.matchAll(VERSE_BLOCK)) {
    const osisId = block[1] ?? "";
    const body = block[2] ?? "";
    const parts = osisId.split(".");
    const chapter = Number(parts[1]);
    const verse = Number(parts[2]);
    if (parts.length !== 3 || !Number.isSafeInteger(chapter) || !Number.isSafeInteger(verse)) {
      issues.push({ osisId, reason: "osisID fora do formato Livro.Capítulo.Versículo" });
      continue;
    }
    // O livro declarado no arquivo manda. Sem esta conferência, um versículo de
    // outro livro seria gravado com o `bookCode` recebido — ou seja, com uma
    // referência que a fonte não afirma. Relatar, nunca corrigir em silêncio.
    if (parts[0] !== bookCode) {
      issues.push({ osisId, reason: `livro ${String(parts[0])} diverge do arquivo ${bookCode}` });
      continue;
    }
    if (seen.has(osisId)) {
      issues.push({ osisId, reason: "versículo repetido" });
      continue;
    }
    seen.add(osisId);

    const tokens: HebrewToken[] = [];
    let position = 0;
    for (const word of body.matchAll(WORD)) {
      const attributes = word[1] ?? "";
      const surface = stripTags(word[2] ?? "");
      if (surface.length === 0) continue;
      const lemma = attribute(attributes, "lemma") ?? "";
      const morph = attribute(attributes, "morph") ?? "";
      position += 1;
      tokens.push({
        position,
        surface,
        normalized: surface.replace(/\//gu, ""),
        sourceTokenId: attribute(attributes, "id"),
        morphemes: buildMorphemes(surface, lemma, morph),
      });
    }
    if (tokens.length === 0) {
      issues.push({ osisId, reason: "versículo sem palavras" });
      continue;
    }

    verses.push({
      canonBook: bookCode,
      chapter,
      verse,
      canonicalRef: `${bookCode} ${chapter}:${verse}`,
      text: tokens.map((token) => token.normalized).join(" "),
      tokens,
    });
  }

  verses.sort((left, right) => left.chapter - right.chapter || left.verse - right.verse);
  return { bookCode, verses, issues };
}

export function countHebrewTokens(result: MorphhbParseResult): number {
  return result.verses.reduce((total, verse) => total + verse.tokens.length, 0);
}

export function countHebrewMorphemes(result: MorphhbParseResult): number {
  return result.verses.reduce(
    (total, verse) =>
      total + verse.tokens.reduce((sum, token) => sum + token.morphemes.length, 0),
    0,
  );
}
