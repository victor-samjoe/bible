/**
 * Parser do Brown-Driver-Briggs (LEXICON-INDEX-001, fila C30).
 *
 * O BDB é a fonte mais rica de acepções distintas de todo o conjunto coletado:
 * 11.845 verbetes, 8.989 sentidos, aninhados até cinco níveis. `אָב` sozinho traz
 * nove sentidos numerados — "pai de um indivíduo", "de Deus como pai do seu
 * povo", "chefe de casa", "ancestral", "originador ou patrono de uma classe",
 * e assim por diante.
 *
 * **A hierarquia é o dado, não a decoração.** A sessão anterior deixou este
 * arquivo como `pending_parser` justamente para não achatá-lo, e tinha razão:
 * em `רוּם`, os sentidos de primeiro nível são troncos verbais (Qal, Pō‛lēl,
 * Hiphil), cada um com sentidos numerados dentro, e esses com subsentidos `a`,
 * `b`, `(1)`, `(2)` — cinco níveis no caso de הָיָה, que sai com 32 sentidos.
 * Um sentido de terceiro nível sob Hiphil não quer dizer o
 * mesmo que um de primeiro nível. Lido como lista plana, o verbete viraria um
 * amontoado de sinônimos sem regência, que é pior que não ter o BDB.
 *
 * Por isso a leitura é recursiva e preserva três coisas que uma lista perderia:
 * a numeração **como a obra a publica** (que mistura "1", "a" e "(1)" de
 * propósito, para marcar o nível), o tronco verbal que agrupa um ramo, e o
 * caminho até cada folha.
 *
 * Como o resto dos parsers deste repositório, não usa biblioteca de XML. Aqui
 * isso exige cuidado extra: `<sense>` dentro de `<sense>` não se resolve com
 * expressão regular, então o aninhamento é cortado contando as tags de abertura
 * e fechamento (`sliceSenses`), e o que não fecha é relatado em vez de
 * adivinhado.
 *
 * Função pura: recebe o XML como string.
 */

import {
  LexiconRegistryError,
  fieldDecision,
  pinLabel,
  type LexiconSource,
} from "../../domain/lexicon/source-registry.ts";
import type {
  BdbSense,
  NormalizedBdbEntry,
  ParseIssue,
  ProvenancedValue,
  FieldProvenance,
} from "../../domain/lexicon/records.ts";

export type BdbReadContext = {
  readonly source: LexiconSource;
  readonly assetPath: string;
  readonly assetSha256: string;
};

export type BdbParseResult = {
  readonly sourceId: string;
  readonly entries: readonly NormalizedBdbEntry[];
  readonly ignoredFields: readonly string[];
  readonly issues: readonly ParseIssue[];
};

const ENTRY_OPEN = /<entry\b([^>]*)>/u;
const SELF_CLOSING_ENTRY = /<entry\b[^>]*\/>/gu;

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gu, "&");
}

function attribute(raw: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`, "u").exec(raw);
  const value = match?.[1]?.trim();
  return value !== undefined && value.length > 0 ? value : null;
}

/** Texto limpo: sem marcação, sem entidade e sem espaço duplicado. */
function plain(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/gu, ""))
    .replace(/\s+/gu, " ")
    .trim();
}

function provenance(context: BdbReadContext, sourceField: string): FieldProvenance {
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
  context: BdbReadContext,
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

function allowed(context: BdbReadContext, sourceField: string, ignored: Set<string>): boolean {
  const decision = fieldDecision(context.source, sourceField);
  if (decision.allowed) return true;
  if (decision.prohibited) {
    throw new LexiconRegistryError(
      `campo proibido presente em ${context.source.id}: '${sourceField}'. ${decision.reason}`,
    );
  }
  ignored.add(sourceField);
  return false;
}

type Slice = { readonly attrs: string; readonly inner: string; readonly end: number };

/**
 * Corta os `<sense>` **deste** nível, contando abertura e fechamento.
 *
 * Expressão regular não resolve aninhamento: `<sense>…<sense>…</sense>…</sense>`
 * casaria no primeiro `</sense>` e devolveria meio sentido, com o resto do ramo
 * caindo no nível errado. Aqui o corte é por contagem, e um ramo que não fecha
 * é devolvido como `null` para ser relatado, não remendado.
 */
function sliceSenses(body: string): { readonly slices: readonly Slice[]; readonly unterminated: number } {
  const slices: Slice[] = [];
  let unterminated = 0;
  let cursor = 0;

  while (cursor < body.length) {
    const open = /<sense\b([^>]*?)(\/?)>/u.exec(body.slice(cursor));
    if (!open) break;
    const openAt = cursor + open.index;
    const attrs = open[1] ?? "";
    // `<sense/>` vazio: nível sem conteúdo, registrado e seguido adiante.
    if (open[2] === "/") {
      slices.push({ attrs, inner: "", end: openAt + open[0].length });
      cursor = openAt + open[0].length;
      continue;
    }

    let depth = 1;
    let scan = openAt + open[0].length;
    const innerStart = scan;
    let closedAt = -1;
    while (scan < body.length) {
      const next = /<(\/?)sense\b[^>]*?(\/?)>/u.exec(body.slice(scan));
      if (!next) break;
      const at = scan + next.index;
      const isClose = next[1] === "/";
      const isSelfClosing = next[2] === "/";
      scan = at + next[0].length;
      if (isSelfClosing) continue;
      depth += isClose ? -1 : 1;
      if (depth === 0) {
        closedAt = at;
        break;
      }
    }
    if (closedAt < 0) {
      unterminated += 1;
      break;
    }
    slices.push({ attrs, inner: body.slice(innerStart, closedAt), end: scan });
    cursor = scan;
  }
  return { slices, unterminated };
}

/** Remove os ramos `<sense>` do corpo, deixando só o texto deste nível. */
function withoutSenses(body: string, slices: readonly Slice[]): string {
  if (slices.length === 0) return body;
  // Reconstrói pelos buracos: cortar por índice evita reprocessar o aninhado.
  let out = "";
  let cursor = 0;
  for (const slice of slices) {
    const openIndex = body.indexOf("<sense", cursor);
    if (openIndex < 0) break;
    out += body.slice(cursor, openIndex);
    cursor = slice.end;
  }
  return out + body.slice(cursor);
}

/** Definições (`<def>`) declaradas apenas neste nível, fora dos ramos. */
function levelDefinitions(level: string): readonly string[] {
  return [...level.matchAll(/<def\b[^>]*>([\s\S]*?)<\/def>/gu)]
    .map((match) => plain(match[1] ?? ""))
    .filter((value) => value.length > 0);
}

function readSenses(
  body: string,
  context: BdbReadContext,
  ignored: Set<string>,
  issues: ParseIssue[],
  at: string,
): readonly BdbSense[] {
  const { slices, unterminated } = sliceSenses(body);
  if (unterminated > 0) {
    issues.push({ at, reason: `${unterminated} <sense> sem fechamento; ramo descartado` });
  }
  const useNumber = allowed(context, "sense@n", ignored);
  const useStem = allowed(context, "stem", ignored);
  const useDefinition = allowed(context, "def", ignored);

  return slices.map((slice) => {
    const children = readSenses(slice.inner, context, ignored, issues, at);
    const own = withoutSenses(slice.inner, sliceSenses(slice.inner).slices);
    const stem = /<stem\b[^>]*>([\s\S]*?)<\/stem>/u.exec(own)?.[1];
    // A prosa do nível é o que resta depois de tirar definição e tronco: é o
    // "esp. of" e o "fig. of" que qualificam o sentido sem serem definição.
    const note = plain(own.replace(/<def\b[\s\S]*?<\/def>/gu, "").replace(/<stem\b[\s\S]*?<\/stem>/gu, ""));
    return {
      number: useNumber ? attribute(slice.attrs, "n") : null,
      stem: useStem && stem !== undefined ? plain(stem) || null : null,
      definitions: useDefinition ? levelDefinitions(own) : [],
      note: note.length > 0 ? note : null,
      children,
    };
  });
}

/**
 * Corta os verbetes contando `<entry>`. O arquivo os aninha em `<part>` e
 * `<section>`, que são organização editorial da obra impressa e não entram no
 * registro: o que identifica o verbete é o `id`, que já carrega a seção.
 */
function entryBlocks(xml: string): { readonly blocks: readonly Slice[]; readonly selfClosing: number } {
  const selfClosing = xml.match(SELF_CLOSING_ENTRY)?.length ?? 0;
  const body = selfClosing === 0 ? xml : xml.replace(SELF_CLOSING_ENTRY, "");
  const blocks: Slice[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    const open = ENTRY_OPEN.exec(body.slice(cursor));
    if (!open) break;
    const openAt = cursor + open.index;
    const innerStart = openAt + open[0].length;
    const closeAt = body.indexOf("</entry>", innerStart);
    if (closeAt < 0) break;
    blocks.push({ attrs: open[1] ?? "", inner: body.slice(innerStart, closeAt), end: closeAt + 8 });
    cursor = closeAt + 8;
  }
  return { blocks, selfClosing };
}

export function parseBrownDriverBriggsXml(
  xml: string,
  context: BdbReadContext,
): BdbParseResult {
  const { source } = context;
  if (!source.importable) {
    throw new LexiconRegistryError(
      `${source.id} está marcada como não importável no registro; leitura recusada`,
    );
  }
  if (source.language !== "hbo") {
    throw new LexiconRegistryError(`${source.id} precisa declarar idioma hbo`);
  }

  const ignored = new Set<string>();
  const issues: ParseIssue[] = [];
  const entries: NormalizedBdbEntry[] = [];
  const seen = new Set<string>();

  const { blocks, selfClosing } = entryBlocks(xml);
  if (selfClosing > 0) {
    issues.push({ at: "lexicon", reason: `${selfClosing} <entry/> vazio(s) ignorado(s)` });
  }
  if (blocks.length === 0) {
    throw new LexiconRegistryError("nenhum <entry> reconhecido: o arquivo não é o BDB declarado");
  }

  for (const block of blocks) {
    const bdbId = declared(context, "entry@id", attribute(block.attrs, "id"), ignored);
    if (!bdbId) {
      issues.push({ at: "entry", reason: "verbete sem atributo id" });
      continue;
    }
    const at = `entry ${bdbId.value}`;
    if (seen.has(bdbId.value)) {
      issues.push({ at, reason: "verbete repetido" });
      continue;
    }

    const senses = readSenses(block.inner, context, ignored, issues, at);
    // Só o que está fora de qualquer ramo é do topo do verbete; sem isto, a
    // definição do primeiro sentido apareceria duplicada como se fosse geral.
    const top = withoutSenses(block.inner, sliceSenses(block.inner).slices);

    const lemma = declared(
      context,
      "w",
      /<w\b[^>]*>([\s\S]*?)<\/w>/u.exec(top)?.[1] ?? null,
      ignored,
    );
    if (!lemma) {
      issues.push({ at, reason: "verbete sem lema <w>" });
      continue;
    }

    const partOfSpeech = declared(
      context,
      "pos",
      /<pos\b[^>]*>([\s\S]*?)<\/pos>/u.exec(top)?.[1] ?? null,
      ignored,
    );
    const definitions = allowed(context, "def", ignored)
      ? levelDefinitions(top).map((value) => ({
          value: value.normalize("NFC"),
          provenance: provenance(context, "def"),
        }))
      : [];
    const entryType = declared(context, "entry@type", attribute(block.attrs, "type"), ignored);

    seen.add(bdbId.value);
    entries.push({
      bdbId: bdbId.value,
      lemma,
      partOfSpeech,
      definitions,
      isRoot: entryType?.value === "root",
      senses,
    });
  }

  return {
    sourceId: source.id,
    entries,
    ignoredFields: [...ignored].sort(),
    issues,
  };
}
