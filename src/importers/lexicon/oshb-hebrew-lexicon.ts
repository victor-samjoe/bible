/**
 * Parser do Open Scriptures HebrewLexicon (LEXICON-INDEX-001).
 *
 * Cobre dois arquivos do repositório:
 *
 * - `HebrewStrong.xml`: verbete por código Strong, com lema, transliteração,
 *   classe, derivação (`source`), definição (`meaning`) e usos (`usage`);
 * - `LexicalIndex.xml`: ponte entre o lema aumentado do MorphHB, o código BDB
 *   e o Strong — é o que permite ligar as ocorrências já importadas do MorphHB
 *   ao verbete, sem adivinhar por semelhança de grafia.
 *
 * `BrownDriverBriggs.xml` **não** é lido aqui. O BDB é uma árvore de sentidos
 * aninhados; achatá-la perderia a hierarquia que é o valor da obra. Está
 * declarado no registro com `readerStatus: "pending_parser"` para que a falta
 * apareça no verificador em vez de passar por omissão.
 *
 * Como o resto dos parsers deste repositório, não usa biblioteca de XML: o
 * formato é regular e as expressões abaixo recusam o que não reconhecem, em vez
 * de tentar consertar.
 *
 * Função pura: recebe o XML como string.
 */

import {
  LexiconRegistryError,
  type LexiconSource,
  fieldDecision,
  pinLabel,
} from "../../domain/lexicon/source-registry.ts";
import {
  type FieldProvenance,
  type LexiconParseResult,
  type NormalizedLexemeEntry,
  type ParseIssue,
  type ProvenancedValue,
  strongLexemeKey,
} from "../../domain/lexicon/records.ts";

export type OshbReadContext = {
  readonly source: LexiconSource;
  readonly assetPath: string;
  readonly assetSha256: string;
};

const ENTRY_BLOCK = /<entry\b([^>]*)>([\s\S]*?)<\/entry>/gu;
const SELF_CLOSING_ENTRY = /<entry\b[^>]*\/>/gu;

/**
 * `<entry .../>` sem conteúdo faria `ENTRY_BLOCK` engolir todos os verbetes até
 * o próximo `</entry>`, juntando dois verbetes em um. Removê-los antes de
 * casar os blocos evita o engano; eles são contados à parte.
 */
function splitEntries(xml: string): { readonly body: string; readonly selfClosing: number } {
  const selfClosing = xml.match(SELF_CLOSING_ENTRY)?.length ?? 0;
  return { body: selfClosing === 0 ? xml : xml.replace(SELF_CLOSING_ENTRY, ""), selfClosing };
}

function attribute(raw: string, name: string): string | null {
  const match = new RegExp(`\\b${name.replace(":", "\\:")}="([^"]*)"`, "u").exec(raw);
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gu, "&");
}

/** Texto de um elemento, sem a marcação interna (`<def>`, `<w>` etc.). */
function elementText(body: string, tag: string): string | null {
  const inner = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "u").exec(body)?.[1];
  if (inner === undefined) return null;
  const text = decodeEntities(inner.replace(/<[^>]+>/gu, "")).replace(/\s+/gu, " ").trim();
  return text.length > 0 ? text : null;
}

function elementAttributes(body: string, tag: string): string | null {
  const match = new RegExp(`<${tag}\\b([^>]*)>`, "u").exec(body);
  return match?.[1] ?? null;
}

function provenance(context: OshbReadContext, sourceField: string): FieldProvenance {
  return {
    sourceId: context.source.id,
    assetPath: context.assetPath,
    pin: pinLabel(context.source.pin),
    assetSha256: context.assetSha256,
    licenseDeclared: context.source.license.declared,
    attribution: context.source.attribution,
    sourceField,
  };
}

/**
 * Só devolve valor se o campo estiver declarado em `selectedFields`. Campo não
 * declarado some sem virar registro; campo proibido interrompe a leitura.
 */
function declared(
  context: OshbReadContext,
  sourceField: string,
  value: string | null,
  ignored: Set<string>,
): ProvenancedValue | null {
  if (value === null) return null;
  const decision = fieldDecision(context.source, sourceField);
  if (!decision.allowed) {
    if (decision.prohibited) {
      throw new LexiconRegistryError(
        `campo proibido presente em ${context.source.id}: '${sourceField}'. ${decision.reason}`,
      );
    }
    ignored.add(sourceField);
    return null;
  }
  return { value: value.normalize("NFC"), provenance: provenance(context, sourceField) };
}

export function parseHebrewStrongXml(
  xml: string,
  context: OshbReadContext,
): LexiconParseResult {
  const { source } = context;
  if (!source.importable) {
    throw new LexiconRegistryError(`${source.id} não é importável; leitura recusada`);
  }
  if (source.language !== "hbo") {
    throw new LexiconRegistryError(`${source.id} precisa declarar idioma hbo`);
  }

  const entries: NormalizedLexemeEntry[] = [];
  const issues: ParseIssue[] = [];
  const ignored = new Set<string>();
  const seen = new Set<string>();

  const { body: scanned, selfClosing } = splitEntries(xml);
  if (selfClosing > 0) {
    issues.push({ at: "lexicon", reason: `${selfClosing} verbete(s) vazio(s) <entry/> ignorado(s)` });
  }

  for (const block of scanned.matchAll(ENTRY_BLOCK)) {
    const attrs = block[1] ?? "";
    const body = block[2] ?? "";
    const rawId = attribute(attrs, "id");
    const at = rawId ? `entry ${rawId}` : "entry sem id";
    if (!rawId) {
      issues.push({ at, reason: "verbete sem atributo id" });
      continue;
    }
    if (!/^H0*\d+[a-z]?$/u.test(rawId)) {
      issues.push({ at, reason: `id fora do formato Strong hebraico: '${rawId}'` });
      continue;
    }
    const key = strongLexemeKey("hbo", rawId);
    if (seen.has(key)) {
      issues.push({ at, reason: "verbete repetido" });
      continue;
    }

    const lemma = declared(context, "w", elementText(body, "w"), ignored);
    if (!lemma) {
      issues.push({ at, reason: "verbete sem lema <w>" });
      continue;
    }
    seen.add(key);

    const wAttrs = elementAttributes(body, "w") ?? "";
    const meaning = declared(context, "meaning", elementText(body, "meaning"), ignored);
    const usage = declared(context, "usage", elementText(body, "usage"), ignored);

    entries.push({
      key,
      // Exibível, sem zero à esquerda, igual ao que `strongLexemeKey` gera.
      strongId: key.slice(key.indexOf(":") + 1),
      language: "hbo",
      lemma,
      transliteration: declared(context, "w@xlit", attribute(wAttrs, "xlit"), ignored),
      partOfSpeech: declared(context, "w@pos", attribute(wAttrs, "pos"), ignored),
      glosses: usage ? [usage] : [],
      definitions: meaning ? [meaning] : [],
      etymology: declared(context, "source", elementText(body, "source"), ignored),
      translations: [],
    });
  }

  return {
    sourceId: source.id,
    entries: [...entries].sort((left, right) => left.key.localeCompare(right.key)),
    occurrences: [],
    ignoredFields: [...ignored].sort(),
    issues,
  };
}

export type LexicalIndexLink = {
  /** Lema aumentado, como o MorphHB publica. */
  readonly augmentedLemma: string;
  readonly strongId: string | null;
  readonly bdbId: string | null;
};

/**
 * Lê `LexicalIndex.xml`. É catálogo de correspondência, não verbete: não
 * produz definição nem glossa, só a ponte entre identificadores. Entrada sem
 * Strong é mantida com `strongId: null` — a ausência é informação, e inventar
 * um Strong plausível é exatamente o erro que este arquivo existe para evitar.
 */
export function parseLexicalIndexXml(xml: string): {
  readonly links: readonly LexicalIndexLink[];
  readonly issues: readonly ParseIssue[];
} {
  const links: LexicalIndexLink[] = [];
  const issues: ParseIssue[] = [];
  const seen = new Set<string>();

  const { body: scanned, selfClosing } = splitEntries(xml);
  if (selfClosing > 0) {
    issues.push({ at: "index", reason: `${selfClosing} entrada(s) vazia(s) <entry/> ignorada(s)` });
  }
  const blocks = [...scanned.matchAll(ENTRY_BLOCK)].map((match) => match[2] ?? "");

  for (const body of blocks) {
    const lemma = elementText(body, "w");
    if (!lemma) {
      issues.push({ at: "entry", reason: "entrada de índice sem lema <w>" });
      continue;
    }
    const xref = elementAttributes(body, "xref");
    const strongRaw = xref ? attribute(xref, "strong") : null;
    const bdbId = xref ? attribute(xref, "bdb") : null;
    const strongId = strongRaw ? `H${strongRaw.replace(/^H/u, "").replace(/^0+/u, "")}` : null;
    const normalized = lemma.normalize("NFC");
    const key = `${normalized}\u001f${strongId ?? ""}\u001f${bdbId ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ augmentedLemma: normalized, strongId, bdbId });
  }

  return {
    links: [...links].sort(
      (left, right) =>
        left.augmentedLemma.localeCompare(right.augmentedLemma) ||
        (left.strongId ?? "").localeCompare(right.strongId ?? ""),
    ),
    issues,
  };
}
