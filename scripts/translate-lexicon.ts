import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join } from "node:path";
import {
  TRANSLATION_BOOK_ORDER,
  bookName,
  bookOfRef,
  type BookCode,
} from "../src/domain/lexicon/canon.ts";
import {
  TRANSLATABLE_TARGETS,
  glossSubjectKey,
  ingestDrafts,
  isGlossSubject,
  parseStore,
  serializeStore,
  storeProgress,
  translationKey,
  type StoredTranslation,
  type TranslationStore,
} from "../src/domain/lexicon/translation-store.ts";
import type { FieldProvenance } from "../src/domain/lexicon/records.ts";

/**
 * Tradução editorial do léxico, livro a livro (LEXICON-INDEX-001, fila C30).
 *
 * O trabalho é grande — 60.674 glossas distintas e 19.521 verbetes — e não cabe
 * numa execução. Por isso este programa é um **laço retomável**: cada passada
 * pega o próximo recorte que ainda tem texto sem tradução, emite um lote com o
 * original, e a ingestão do lote preenchido grava os rascunhos. Rodar de novo
 * continua de onde parou; rodar duas vezes no mesmo recorte não duplica nada.
 *
 * A ordem começa por Gênesis e João, que são os capítulos usados para validar
 * o leitor (ver `TRANSLATION_BOOK_ORDER`), e segue o cânone depois.
 *
 * **Nada que sai daqui é publicável.** Todo registro nasce `machine_draft`,
 * com o método declarado, e `translation-workflow.ts` continua exigindo revisão
 * humana antes de qualquer exibição pública; o leitor só mostra rascunho em
 * pré-visualização, rotulado.
 *
 * O lote é TSV porque precisa ser preenchível por três coisas diferentes sem
 * mudar o programa: esta sessão, uma pessoa, ou um serviço de tradução
 * automática no futuro. Trocar o preenchedor não muda o formato nem o armazém.
 *
 * Uso:
 *   node --experimental-strip-types scripts/translate-lexicon.ts --status
 *   node --experimental-strip-types scripts/translate-lexicon.ts --book=GEN --emit-batch
 *   node --experimental-strip-types scripts/translate-lexicon.ts --scope="GEN 1:" --emit-batch
 *   node --experimental-strip-types scripts/translate-lexicon.ts --ingest=<arquivo.tsv>
 */

const ROOT = join(import.meta.dirname, "..");
const GENERATED = join(ROOT, "data", "generated", "lexicons");
const INDEX = join(GENERATED, "lexicon-index.ndjson");
const STORE = join(GENERATED, "translations.ndjson");
const BATCHES = join(GENERATED, "batches");

const DRAFT_METHOD = "rascunho de máquina (Claude Opus 5, sessão Claude Code), 2026-11-19";

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined =>
  argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3);
const has = (name: string): boolean => argv.includes(`--${name}`);

type Provenanced = { readonly value: string; readonly provenance: FieldProvenance };

type IndexEntry = {
  readonly key: string;
  readonly language: "hbo" | "grc";
  readonly lemma: Provenanced;
  readonly glosses: readonly Provenanced[];
  readonly definitions: readonly Provenanced[];
};

/** Uma glossa distinta, com onde apareceu primeiro e quantas vezes ocorre. */
type GlossFact = {
  readonly subject: string;
  readonly language: "hbo" | "grc";
  readonly text: string;
  readonly firstBook: BookCode;
  readonly count: number;
  readonly sampleRef: string;
  readonly sampleLemma: string;
  readonly provenance: FieldProvenance;
};

type Loaded = {
  readonly entries: ReadonlyMap<string, IndexEntry>;
  readonly glosses: ReadonlyMap<string, GlossFact>;
  /** Primeiro livro, na ordem de trabalho, em que cada lema aparece. */
  readonly lemmaFirstBook: ReadonlyMap<string, BookCode>;
  readonly lemmasByBook: ReadonlyMap<BookCode, ReadonlySet<string>>;
  /** Sujeitos de glossa que aparecem em cada recorte pedido por `--scope`. */
  readonly scopedGlossSubjects: ReadonlySet<string> | null;
};

function selectedTargets(): readonly (typeof TRANSLATABLE_TARGETS)[number][] {
  const requested = flag("fields");
  if (!requested) return ["occurrence.gloss"];
  if (requested === "all") return TRANSLATABLE_TARGETS;
  const wanted = requested.split(",").map((item) => item.trim());
  const selected = TRANSLATABLE_TARGETS.filter(
    (target) => wanted.includes(target) || wanted.includes(target.split(".")[1] ?? ""),
  );
  if (selected.length === 0) {
    throw new Error("--fields inválido: use occurrence.gloss, entry.gloss, entry.definition ou all");
  }
  return selected;
}

/**
 * O índice tem 607 mil linhas e não cabe em memória como texto único; é lido em
 * fluxo. Guardamos só o que o trabalho de tradução precisa.
 */
async function loadIndex(scope: string | undefined): Promise<Loaded> {
  if (!existsSync(INDEX)) {
    throw new Error(
      `índice não encontrado em ${INDEX}. Rode antes: scripts/build-lexicon-index.ts --emit`,
    );
  }
  const entries = new Map<string, IndexEntry>();
  const lemmasByBook = new Map<BookCode, Set<string>>();
  const lemmaFirstBook = new Map<string, BookCode>();
  const glosses = new Map<string, GlossFact>();
  const scoped = scope ? new Set<string>() : null;
  const rank = new Map<BookCode, number>(TRANSLATION_BOOK_ORDER.map((code, i) => [code, i]));
  const rankOf = (code: BookCode): number => rank.get(code) ?? Number.MAX_SAFE_INTEGER;

  const reader = createInterface({
    input: createReadStream(INDEX, "utf8"),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  for await (const line of reader) {
    if (line.length === 0) continue;
    const record = JSON.parse(line) as { type: string };
    if (record.type === "entry") {
      const entry = record as unknown as IndexEntry;
      entries.set(entry.key, entry);
      continue;
    }
    const occurrence = record as unknown as {
      lexemeKey: string;
      canonicalRef: string;
      language: "hbo" | "grc";
      lemma: string;
      gloss: string | null;
      provenance: FieldProvenance;
    };
    const book = bookOfRef(occurrence.canonicalRef);
    if (!book) continue;

    let bucket = lemmasByBook.get(book);
    if (!bucket) {
      bucket = new Set<string>();
      lemmasByBook.set(book, bucket);
    }
    bucket.add(occurrence.lexemeKey);
    const currentLemmaBook = lemmaFirstBook.get(occurrence.lexemeKey);
    if (!currentLemmaBook || rankOf(book) < rankOf(currentLemmaBook)) {
      lemmaFirstBook.set(occurrence.lexemeKey, book);
    }

    const gloss = occurrence.gloss?.trim() ?? "";
    if (gloss.length === 0) continue;
    const subject = glossSubjectKey(occurrence.language, gloss);
    if (scoped && occurrence.canonicalRef.startsWith(scope ?? "")) scoped.add(subject);
    const existing = glosses.get(subject);
    if (!existing) {
      glosses.set(subject, {
        subject,
        language: occurrence.language,
        text: gloss,
        firstBook: book,
        count: 1,
        sampleRef: occurrence.canonicalRef,
        sampleLemma: occurrence.lemma,
        provenance: occurrence.provenance,
      });
      continue;
    }
    glosses.set(subject, {
      ...existing,
      count: existing.count + 1,
      firstBook: rankOf(book) < rankOf(existing.firstBook) ? book : existing.firstBook,
    });
  }
  return { entries, glosses, lemmaFirstBook, lemmasByBook, scopedGlossSubjects: scoped };
}

async function loadStore(): Promise<TranslationStore> {
  if (!existsSync(STORE)) return new Map();
  return parseStore(await readFile(STORE, "utf8"));
}

type Request = {
  readonly subject: string;
  readonly target: string;
  readonly context: string;
  readonly sourceText: string;
  readonly weight: number;
};

/**
 * O que falta traduzir num recorte.
 *
 * Com `--scope`, o recorte é um prefixo de referência (`GEN 1:`) e só as
 * glossas que aparecem ali entram. Sem ele, o recorte é o livro, e cada glossa
 * é reivindicada **apenas** pelo primeiro livro em que aparece: uma glossa
 * traduzida em Gênesis não volta na fila de Êxodo.
 *
 * A ordem é por frequência decrescente, para que o esforço gasto primeiro seja
 * o que cobre mais texto.
 */
function pendingFor(
  book: BookCode | null,
  loaded: Loaded,
  store: TranslationStore,
): Request[] {
  const targets = selectedTargets();
  const requests: Request[] = [];

  if (targets.includes("occurrence.gloss")) {
    for (const fact of loaded.glosses.values()) {
      if (loaded.scopedGlossSubjects) {
        if (!loaded.scopedGlossSubjects.has(fact.subject)) continue;
      } else if (book && fact.firstBook !== book) {
        continue;
      }
      if (store.has(translationKey(fact.subject, "occurrence.gloss"))) continue;
      requests.push({
        subject: fact.subject,
        target: "occurrence.gloss",
        context: `${fact.sampleLemma} · ${fact.sampleRef} · ${fact.count}×`,
        sourceText: fact.text,
        weight: fact.count,
      });
    }
  }

  for (const target of targets) {
    if (target === "occurrence.gloss") continue;
    const lexemes = book ? (loaded.lemmasByBook.get(book) ?? new Set<string>()) : new Set<string>();
    for (const lexemeKey of [...lexemes].sort()) {
      if (loaded.lemmaFirstBook.get(lexemeKey) !== book) continue;
      const entry = loaded.entries.get(lexemeKey);
      if (!entry) continue;
      if (store.has(translationKey(lexemeKey, target))) continue;
      const source = target === "entry.gloss" ? entry.glosses[0] : entry.definitions[0];
      if (!source || source.value.trim().length === 0) continue;
      requests.push({
        subject: lexemeKey,
        target,
        context: entry.lemma.value,
        sourceText: source.value,
        weight: 0,
      });
    }
  }

  return requests.sort(
    (left, right) => right.weight - left.weight || left.subject.localeCompare(right.subject),
  );
}

function escapeCell(value: string): string {
  return value.replace(/[\t\r\n]+/gu, " ").trim();
}

async function emitBatch(label: string, requests: readonly Request[]): Promise<string> {
  await mkdir(BATCHES, { recursive: true });
  const safe = label.replace(/[^A-Za-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  const path = join(BATCHES, `pending-${safe}.tsv`);
  const header = "subject\ttarget\tcontexto\tsourceText\tptBR";
  const rows = requests.map(
    (request) =>
      `${request.subject}\t${request.target}\t${escapeCell(request.context)}\t` +
      `${escapeCell(request.sourceText)}\t`,
  );
  await writeFile(path, `${[header, ...rows].join("\n")}\n`, "utf8");
  return path;
}

type BatchRow = {
  readonly subject: string;
  readonly target: string;
  readonly ptBR: string;
};

function parseBatch(content: string): BatchRow[] {
  const lines = content.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  const header = (lines.shift() ?? "").split("\t");
  const iSubject = header.indexOf("subject");
  const iTarget = header.indexOf("target");
  const iPt = header.indexOf("ptBR");
  if (iSubject < 0 || iTarget < 0 || iPt < 0) {
    throw new Error("lote sem as colunas subject, target e ptBR");
  }
  return lines.map((line) => {
    const cells = line.split("\t");
    return {
      subject: cells[iSubject]?.trim() ?? "",
      target: cells[iTarget]?.trim() ?? "",
      ptBR: cells[iPt]?.trim() ?? "",
    };
  });
}

/**
 * Recupera o texto-fonte e a proveniência a partir do índice, e **não** do
 * lote. O lote pode ter sido editado à mão; o original e o crédito de licença
 * vêm sempre da fonte, para que nenhuma edição de planilha possa reescrever a
 * atribuição.
 */
function sourceFor(
  row: BatchRow,
  loaded: Loaded,
): { readonly text: string; readonly provenance: FieldProvenance; readonly language: "en" } {
  if (isGlossSubject(row.subject)) {
    const fact = loaded.glosses.get(row.subject);
    if (!fact) throw new Error(`lote cita glossa inexistente no índice: ${row.subject}`);
    return { text: fact.text, provenance: fact.provenance, language: "en" };
  }
  const entry = loaded.entries.get(row.subject);
  if (!entry) throw new Error(`lote cita verbete inexistente no índice: ${row.subject}`);
  const source = row.target === "entry.gloss" ? entry.glosses[0] : entry.definitions[0];
  if (!source) throw new Error(`verbete ${row.subject} não tem o campo ${row.target}`);
  return { text: source.value, provenance: source.provenance, language: "en" };
}

async function ingest(path: string, loaded: Loaded, store: TranslationStore): Promise<void> {
  const rows = parseBatch(await readFile(path, "utf8"));
  const drafts: StoredTranslation[] = [];
  let blank = 0;

  for (const row of rows) {
    if (row.ptBR.length === 0) {
      blank += 1;
      continue;
    }
    const source = sourceFor(row, loaded);
    drafts.push({
      lexemeKey: row.subject,
      target: row.target,
      sourceText: source.text,
      sourceLanguage: source.language,
      targetLanguage: "pt-BR",
      text: row.ptBR,
      status: "machine_draft",
      reviewedBy: null,
      reviewedAt: null,
      provenance: source.provenance,
      draftMethod: DRAFT_METHOD,
    });
  }

  const outcome = ingestDrafts(store, drafts);
  await mkdir(GENERATED, { recursive: true });
  await writeFile(STORE, serializeStore(outcome.store), "utf8");

  console.log(`lote: ${rows.length} linha(s), ${blank} sem tradução preenchida`);
  console.log(`gravados: ${outcome.added} novo(s), ${outcome.unchanged} inalterado(s)`);
  if (outcome.protected.length > 0) {
    console.log(
      `preservados por já terem revisão humana: ${outcome.protected.length} ` +
        "(rascunho não sobrescreve texto revisado)",
    );
  }
  for (const rejection of outcome.rejected.slice(0, 10)) {
    console.log(`  recusado ${rejection.key}: ${rejection.reason}`);
  }
  if (outcome.rejected.length > 0) console.log(`  total recusado: ${outcome.rejected.length}`);
  const progress = storeProgress(outcome.store);
  console.log(
    `armazém: ${progress.total} registro(s) — ${progress.machineDraft} rascunho, ` +
      `${progress.humanReviewed} revisado, ${progress.approved} aprovado`,
  );
}

function reportStatus(loaded: Loaded, store: TranslationStore): void {
  const progress = storeProgress(store);
  console.log(
    `armazém: ${progress.total} registro(s) — ${progress.machineDraft} rascunho, ` +
      `${progress.humanReviewed} revisado, ${progress.approved} aprovado`,
  );
  console.log(`glossas distintas no índice: ${loaded.glosses.size}\n`);

  let shown = 0;
  let pendingBooks = 0;
  let pendingTotal = 0;
  let coveredOccurrences = 0;
  let totalOccurrences = 0;
  for (const fact of loaded.glosses.values()) {
    totalOccurrences += fact.count;
    if (store.has(translationKey(fact.subject, "occurrence.gloss"))) {
      coveredOccurrences += fact.count;
    }
  }

  for (const book of TRANSLATION_BOOK_ORDER) {
    const pending = pendingFor(book, loaded, store);
    if (pending.length === 0) continue;
    pendingBooks += 1;
    pendingTotal += pending.length;
    if (shown < 12) {
      shown += 1;
      console.log(
        `  ${book} ${bookName(book).padEnd(22)} ${String(pending.length).padStart(6)} texto(s) a traduzir`,
      );
    }
  }
  const pct = totalOccurrences === 0 ? 0 : (100 * coveredOccurrences) / totalOccurrences;
  console.log(
    `\n${pendingBooks} livro(s) com pendência, ${pendingTotal} texto(s) no total.`,
  );
  console.log(
    `cobertura do texto bíblico pelas glossas já traduzidas: ${pct.toFixed(1)}% ` +
      `(${coveredOccurrences} de ${totalOccurrences} palavras)`,
  );
}

async function main(): Promise<void> {
  const scope = flag("scope");
  const loaded = await loadIndex(scope);
  const store = await loadStore();

  const ingestPath = flag("ingest");
  if (ingestPath) {
    await ingest(ingestPath, loaded, store);
    return;
  }

  if (has("status")) {
    reportStatus(loaded, store);
    return;
  }

  if (scope) {
    const pending = pendingFor(null, loaded, store);
    console.log(`recorte "${scope}": ${pending.length} texto(s) a traduzir`);
    if (pending.length === 0) return;
    if (!has("emit-batch")) {
      console.log("Use --emit-batch para gravar o lote.");
      return;
    }
    const path = await emitBatch(scope, pending);
    console.log(`lote gravado: ${path}`);
    console.log("Preencha a coluna ptBR e rode com --ingest=<arquivo>.");
    return;
  }

  const requested = flag("book") as BookCode | undefined;
  const book =
    requested ?? TRANSLATION_BOOK_ORDER.find((code) => pendingFor(code, loaded, store).length > 0);
  if (!book) {
    console.log("Nada pendente: todos os livros têm tradução para os campos previstos.");
    return;
  }

  const pending = pendingFor(book, loaded, store);
  console.log(`${book} — ${bookName(book)}: ${pending.length} texto(s) a traduzir`);
  if (pending.length === 0) return;
  if (!has("emit-batch")) {
    console.log("Use --emit-batch para gravar o lote, ou --status para o panorama.");
    return;
  }
  const path = await emitBatch(book, pending);
  console.log(`lote gravado: ${path}`);
  console.log("Preencha a coluna ptBR e rode com --ingest=<arquivo>.");
}

main().catch((error: unknown) => {
  console.error("FALHA:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
