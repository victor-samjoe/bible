import { z } from "zod";
import { sourceVerseForOriginal } from "../../domain/original-versification";

/**
 * Contrato público da consulta de idiomas originais.
 *
 * A rota nunca entrega um corpus inteiro: uma consulta aceita no máximo 25
 * versículos de um único capítulo. Texto, morfologia e léxico continuam sendo
 * ativos separados; por isso uma edição grega sem morfologia não ganha dados
 * inferidos e uma edição hebraica só expõe os morfemas realmente armazenados.
 */

export type OriginalLanguage = "hbo" | "grc";

export type OriginalEdition = {
  readonly id: string;
  readonly code: string;
  readonly language: OriginalLanguage;
  readonly version: string;
  readonly sourceUrl: string;
  readonly licenseDeclared: string;
  readonly attribution: string;
};

export type OriginalMorpheme = {
  readonly position: number;
  readonly surface: string;
  readonly lemma: string | null;
  readonly morphologyCode: string;
};

export type OriginalToken = {
  readonly id: string;
  readonly position: number;
  readonly surface: string;
  readonly normalized: string;
  readonly morphemes: readonly OriginalMorpheme[];
};

export type OriginalVerse = {
  readonly id: string;
  readonly number: number;
  readonly canonicalRef: string;
  readonly text: string;
  readonly tokens: readonly OriginalToken[];
};

export type OriginalFailureReason =
  | "unavailable"
  | "invalid_query"
  | "edition_unavailable"
  | "not_found"
  | "invalid_data";

export type OriginalSelectionResult =
  | {
      readonly ok: true;
      readonly edition: OriginalEdition;
      readonly bookSlug: string;
      readonly chapter: number;
      readonly verses: readonly OriginalVerse[];
    }
  | { readonly ok: false; readonly reason: OriginalFailureReason };

export interface OriginalRepository {
  findApprovedEdition(language: OriginalLanguage): Promise<unknown>;
  listVerses(input: {
    editionId: string;
    canonBook: string;
    chapter: number;
    verses: readonly number[];
  }): Promise<unknown>;
  listTokens(verseIds: readonly string[]): Promise<unknown>;
  listMorphemes(tokenIds: readonly string[], editionId: string): Promise<unknown>;
}

const bookMap = {
  genesis: ["Gen", "hbo"], exodo: ["Exod", "hbo"], levitico: ["Lev", "hbo"],
  numeros: ["Num", "hbo"], deuteronomio: ["Deut", "hbo"], josue: ["Josh", "hbo"],
  juizes: ["Judg", "hbo"], rute: ["Ruth", "hbo"], "1-samuel": ["1Sam", "hbo"],
  "2-samuel": ["2Sam", "hbo"], "1-reis": ["1Kgs", "hbo"], "2-reis": ["2Kgs", "hbo"],
  "1-cronicas": ["1Chr", "hbo"], "2-cronicas": ["2Chr", "hbo"], esdras: ["Ezra", "hbo"],
  neemias: ["Neh", "hbo"], ester: ["Esth", "hbo"], jo: ["Job", "hbo"],
  salmos: ["Ps", "hbo"], proverbios: ["Prov", "hbo"], eclesiastes: ["Eccl", "hbo"],
  cantares: ["Song", "hbo"], isaias: ["Isa", "hbo"], jeremias: ["Jer", "hbo"],
  lamentacoes: ["Lam", "hbo"], ezequiel: ["Ezek", "hbo"], daniel: ["Dan", "hbo"],
  oseias: ["Hos", "hbo"], joel: ["Joel", "hbo"], amos: ["Amos", "hbo"],
  obadias: ["Obad", "hbo"], jonas: ["Jonah", "hbo"], miqueias: ["Mic", "hbo"],
  naum: ["Nah", "hbo"], habacuque: ["Hab", "hbo"], sofonias: ["Zeph", "hbo"],
  ageu: ["Hag", "hbo"], zacarias: ["Zech", "hbo"], malaquias: ["Mal", "hbo"],
  mateus: ["Mt", "grc"], marcos: ["Mk", "grc"], lucas: ["Lk", "grc"],
  joao: ["Jn", "grc"], atos: ["Ac", "grc"], romanos: ["Ro", "grc"],
  "1-corintios": ["1Co", "grc"], "2-corintios": ["2Co", "grc"], galatas: ["Ga", "grc"],
  efesios: ["Eph", "grc"], filipenses: ["Php", "grc"], colossenses: ["Col", "grc"],
  "1-tessalonicenses": ["1Th", "grc"], "2-tessalonicenses": ["2Th", "grc"],
  "1-timoteo": ["1Ti", "grc"], "2-timoteo": ["2Ti", "grc"], tito: ["Tit", "grc"],
  filemom: ["Phm", "grc"], hebreus: ["Heb", "grc"], tiago: ["Jas", "grc"],
  "1-pedro": ["1Pe", "grc"], "2-pedro": ["2Pe", "grc"], "1-joao": ["1Jn", "grc"],
  "2-joao": ["2Jn", "grc"], "3-joao": ["3Jn", "grc"], judas: ["Jud", "grc"],
  apocalipse: ["Re", "grc"],
} as const satisfies Record<string, readonly [string, OriginalLanguage]>;

const querySchema = z.object({
  book: z.string().trim().toLowerCase().min(1).max(64),
  chapter: z.coerce.number().int().min(1).max(150),
  verses: z.array(z.coerce.number().int().min(1).max(176)).min(1).max(25),
}).strict();

export type OriginalQuery = {
  readonly book: keyof typeof bookMap;
  readonly canonBook: string;
  readonly language: OriginalLanguage;
  readonly chapter: number;
  readonly verses: readonly number[];
  /** Referências da edição-fonte; podem divergir da numeração do leitor. */
  readonly sourceReferences: readonly { readonly chapter: number; readonly verse: number }[];
};

export function parseOriginalQuery(input: unknown): OriginalQuery | null {
  const parsed = querySchema.safeParse(input);
  if (!parsed.success || !(parsed.data.book in bookMap)) return null;
  const verses = [...new Set(parsed.data.verses)].sort((a, b) => a - b);
  const [canonBook, language] = bookMap[parsed.data.book as keyof typeof bookMap];
  const book = parsed.data.book as keyof typeof bookMap;
  return {
    book,
    canonBook,
    language,
    chapter: parsed.data.chapter,
    verses,
    sourceReferences: verses.map((verse) => sourceVerseForOriginal(book, parsed.data.chapter, verse)),
  };
}

const editionSchema = z.object({
  id: z.uuid(), code: z.string().trim().min(1).max(80), language: z.enum(["hbo", "grc"]),
  version: z.string().trim().min(1).max(200), sourceUrl: z.url(),
  licenseDeclared: z.string().trim().min(1).max(200), attribution: z.string().trim().min(1),
  status: z.literal("approved"), approvedBy: z.uuid(), approvedAt: z.coerce.date(),
});

const verseRowSchema = z.object({
  id: z.uuid(), editionId: z.uuid(), canonBook: z.string().trim().min(1),
  chapter: z.number().int().positive(), verse: z.number().int().positive(),
  canonicalRef: z.string().trim().min(1), text: z.string().trim().min(1),
});

const tokenRowSchema = z.object({
  id: z.uuid(), verseId: z.uuid(), position: z.number().int().positive(),
  surface: z.string().trim().min(1), normalized: z.string().trim().min(1),
});

const morphemeRowSchema = z.object({
  tokenId: z.uuid(), position: z.number().int().positive(), surface: z.string(),
  lemma: z.string().trim().min(1).nullable(), morphologyCode: z.string().trim().min(1),
});

export function projectOriginalEdition(row: unknown): OriginalEdition | null {
  const parsed = editionSchema.safeParse(row);
  if (!parsed.success) return null;
  const { id, code, language, version, sourceUrl, licenseDeclared, attribution } = parsed.data;
  return { id, code, language, version, sourceUrl, licenseDeclared, attribution };
}

export function projectOriginalVerses(input: {
  rows: unknown; tokenRows: unknown; morphemeRows: unknown; editionId: string;
  canonBook: string; chapter: number; requested: readonly number[];
  displayVerse?: (sourceChapter: number, sourceVerse: number) => number;
}): readonly OriginalVerse[] {
  if (!Array.isArray(input.rows) || !Array.isArray(input.tokenRows) || !Array.isArray(input.morphemeRows)) return [];
  const requested = new Set(input.requested);
  const morphemes = new Map<string, OriginalMorpheme[]>();
  for (const row of input.morphemeRows) {
    const parsed = morphemeRowSchema.safeParse(row);
    if (!parsed.success) continue;
    const item = parsed.data;
    const list = morphemes.get(item.tokenId) ?? [];
    list.push({ position: item.position, surface: item.surface, lemma: item.lemma, morphologyCode: item.morphologyCode });
    morphemes.set(item.tokenId, list);
  }
  const tokens = new Map<string, OriginalToken[]>();
  for (const row of input.tokenRows) {
    const parsed = tokenRowSchema.safeParse(row);
    if (!parsed.success) continue;
    const item = parsed.data;
    const list = tokens.get(item.verseId) ?? [];
    list.push({ id: item.id, position: item.position, surface: item.surface, normalized: item.normalized,
      morphemes: (morphemes.get(item.id) ?? []).sort((a, b) => a.position - b.position) });
    tokens.set(item.verseId, list);
  }
  const seen = new Set<number>();
  const result: OriginalVerse[] = [];
  for (const row of input.rows) {
    const parsed = verseRowSchema.safeParse(row);
    if (!parsed.success) continue;
    const item = parsed.data;
    const displayVerse = input.displayVerse?.(item.chapter, item.verse) ?? item.verse;
    if (item.editionId !== input.editionId || item.canonBook !== input.canonBook || !requested.has(displayVerse) || seen.has(displayVerse)) continue;
    seen.add(displayVerse);
    result.push({ id: item.id, number: displayVerse, canonicalRef: item.canonicalRef, text: item.text,
      tokens: (tokens.get(item.id) ?? []).sort((a, b) => a.position - b.position) });
  }
  return result.sort((a, b) => a.number - b.number);
}
