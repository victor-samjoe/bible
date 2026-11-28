import Link from "next/link";
import { and, asc, eq, or } from "drizzle-orm";
import { lexemeOccurrences, originalEditions, originalTokens, originalVerses } from "@/drizzle/schema";
import { getDatabaseAsync } from "@/src/server/db/client";
import { getBlivreReader } from "@/src/server/bible/runtime";
import { createDrizzleLexiconRepository } from "@/src/server/lexicon/repository";
import type { BdbEntryView } from "@/src/domain/lexicon/word-analysis-view";
import type { BdbSense } from "@/src/domain/lexicon/records";
import { strongLexemeKey } from "@/src/domain/lexicon/records";
import styles from "./palavra.module.css";
import { BackLink } from "./back-link";
import { hasPilotEntry, pilotContextualTranslation, pilotDefinition, pilotSenseNote, pilotWord } from "./piloto";
import { Pronunciation } from "./pronunciation";
import { readableSenseNote } from "../biblia/lexicon-panel-text";
import { occurrenceMatchesSurface, contextualExcerpt } from "@/src/domain/lexicon/occurrence-display";
import { hebrewVariantWarning } from "@/src/domain/transliteration/hebrew-variants";
import { OccurrenceForm } from "./occurrence-form";
import { draftSense, hasDraftEntry } from "./draft-translations";
import { senseOriginal } from "@/src/domain/word-study/senses";
import { WordUsesIndex } from "./word-uses-index";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estudo de palavra | Bíblia Bereana" };

type Search = Promise<{ idioma?: string | string[]; strong?: string | string[]; origem?: string | string[] }>;

function Definitions({ definitions, strong, bdbId, original = false }: { readonly definitions: readonly string[]; readonly strong: string; readonly bdbId: string; readonly original?: boolean }) {
  return <>{definitions.map((text, index) => {
    const translation = pilotDefinition(strong, bdbId, text);
    return <span key={index}>{index > 0 ? "; " : ""}{translation && !original ? <span lang="pt-BR">{translation}</span> : <span lang="en">{text}</span>}</span>;
  })}</>;
}

function SenseList({ senses, strong, bdbId, original = false, parentPath = "" }: { readonly senses: readonly BdbSense[]; readonly strong: string; readonly bdbId: string; readonly original?: boolean; readonly parentPath?: string }) {
  if (!senses.length) return null;
  return <ul className={styles.senses}>{senses.map((sense, index) => {
    const note = readableSenseNote(sense.note);
    const path = parentPath ? `${parentPath}.${index + 1}` : String(index + 1);
    const draft = original ? null : draftSense(strong, bdbId, path, senseOriginal(sense));
    return <li key={index}>
      {sense.stem ? <span className={styles.stem}>{sense.stem}</span> : null}
      {sense.number || sense.definitions.length || (note && !sense.children.length) ? <div className={styles.senseLine}>
        {sense.number ? <span className={styles.senseNumber}>{sense.number.replace(/\.$/u, "")}</span> : null}
        <span>{draft ? <span lang="pt-BR">{draft}</span> : <Definitions definitions={sense.definitions} strong={strong} bdbId={bdbId} original={original} />}
          {!draft && !original && pilotSenseNote(strong, bdbId, note) ? <span lang="pt-BR"> {pilotSenseNote(strong, bdbId, note)}</span>
            : !draft && !sense.definitions.length && !sense.children.length && note ? <span lang="en">{note}</span> : null}
        </span>
      </div> : null}
      <SenseList senses={sense.children} strong={strong} bdbId={bdbId} original={original} parentPath={path} />
    </li>;
  })}</ul>;
}

export default async function WordStudy({ searchParams }: { readonly searchParams: Search }) {
  const params = await searchParams;
  const origin = typeof params.origem === "string" ? /^([a-z0-9-]+)\.([1-9]\d*)$/u.exec(params.origem) : null;
  const language = params.idioma;
  const strong = typeof params.strong === "string" ? params.strong.toUpperCase() : "";
  const valid = (language === "hbo" && /^H\d{1,5}[A-Z]?$/u.test(strong)) ||
    (language === "grc" && /^G\d{1,5}[A-Z]?$/u.test(strong));
  let rows: { canonicalRef: string; surface: string; lemma: string; wordPosition: number | null }[] = [];
  let entries: readonly BdbEntryView[] = [];
  let attribution: string | null = null;
  let lexicalSources: { sourceId: string; name: string; attribution: string }[] = [];
  let definitionsUnavailable = false;
  let unavailable = false;
  if (valid) {
    try {
      const database = await getDatabaseAsync();
      if (!database) unavailable = true;
      else {
        const key = strongLexemeKey(language === "hbo" ? "hbo" : "grc", strong);
        const repo = createDrizzleLexiconRepository(database);
        const [occurrences, definitions, sources] = await Promise.allSettled([
          database.select({ canonicalRef: lexemeOccurrences.canonicalRef,
            surface: lexemeOccurrences.surface, lemma: lexemeOccurrences.lemma, wordPosition: lexemeOccurrences.wordPosition })
            .from(lexemeOccurrences).where(eq(lexemeOccurrences.lexemeKey, key))
            .orderBy(asc(lexemeOccurrences.canonicalRef), asc(lexemeOccurrences.wordPosition)).limit(101),
          repo.listBdbEntries([key]), repo.listSources(language === "hbo"
            ? ["oshb-bdb", "macula-hebrew", "oshb-hebrewlexicon"]
            : ["macula-greek", "stepbible-tbesg"]),
        ]);
        if (occurrences.status === "fulfilled") rows = occurrences.value;
        else unavailable = true;
        if (definitions.status === "fulfilled") entries = definitions.value.get(key) ?? [];
        else definitionsUnavailable = true;
        if (sources.status === "fulfilled") {
          attribution = sources.value.get("oshb-bdb")?.attribution ?? null;
          lexicalSources = [...sources.value.values()].filter((source) => source.sourceId !== "oshb-bdb");
        }
      }
    } catch { unavailable = true; }
  }
  const shown = [...rows].sort((left, right) =>
    left.canonicalRef.localeCompare(right.canonicalRef, "en", { numeric: true }),
  ).slice(0, 100);
  const byVerse = new Map<string, typeof shown>();
  for (const row of shown) {
    const forms = byVerse.get(row.canonicalRef) ?? [];
    forms.push(row);
    byVerse.set(row.canonicalRef, forms);
  }
  const portuguese = new Map<number, string>();
  const originals = new Map<string, { surface: string; code: string; version: string }>();
  if (shown.some((row) => /^GEN 1:\d+$/u.test(row.canonicalRef))) {
    await Promise.allSettled([ (async () => {
      const chapter = await (await getBlivreReader()).readChapter("genesis", 1);
      if (chapter.ok) for (const verse of chapter.verses) {
        // Never display USFM markers as if they were Bible text.
        if (!verse.content.includes("\\")) portuguese.set(verse.number, verse.content);
      }
    })(), (async () => {
      if (language !== "hbo") return;
      const database = await getDatabaseAsync();
      if (!database) return;
      const pairs = shown.flatMap((row) => {
        const match = /^GEN 1:(\d+)$/u.exec(row.canonicalRef);
        return match && row.wordPosition !== null && row.wordPosition > 0
          ? [and(eq(originalVerses.verse, Number(match[1])), eq(originalTokens.position, row.wordPosition))] : [];
      });
      if (!pairs.length) return;
      // Uma consulta limitada às posições exibidas, sem consulta por palavra.
      const tokens = await database.select({ verse: originalVerses.verse, position: originalTokens.position,
        surface: originalTokens.normalized, code: originalEditions.code, version: originalEditions.version })
        .from(originalTokens).innerJoin(originalVerses, eq(originalTokens.verseId, originalVerses.id))
        .innerJoin(originalEditions, eq(originalVerses.editionId, originalEditions.id))
        .where(and(eq(originalVerses.canonBook, "Gen"), eq(originalVerses.chapter, 1), or(...pairs),
          eq(originalEditions.language, "hbo"), eq(originalEditions.status, "approved"), eq(originalEditions.code, "MORPHHB")));
      for (const token of tokens) originals.set(`${token.verse}:${token.position}`, token);
    })() ]);
  }
  const rtl = language === "hbo";
  const pilot = pilotWord(language, strong);
  const hasTranslatedEntry = entries.some((entry) => hasPilotEntry(strong, entry.bdbId) || hasDraftEntry(strong, entry.bdbId));
  return (
    <main className={styles.page}>
      <BackLink href={origin ? `/biblia/${origin[1]}/${origin[2]}` : "/biblia"} scope={origin ? `${origin[1]}.${origin[2]}` : null} className={styles.back} />
      <header className={styles.header}>
        <p className={styles.eyebrow}>ESTUDO DE PALAVRA</p>
        <h1>{shown[0]?.lemma ? <span lang={rtl ? "he" : "grc"} dir={rtl ? "rtl" : "ltr"}>{shown[0].lemma}</span> : "Palavra original"}</h1>
        {valid ? <p>{rtl ? "Hebraico" : "Grego"} · Strong {strong}</p> : <p>Selecione uma palavra no painel de originais para começar.</p>}
        {pilot ? <div className={styles.pronunciation}>
          <p><b>Transliteração do lema</b> {pilot.transliteration}</p>
          <p><b>Como pronunciar</b> {pilot.pronunciation} <small>(aproximação)</small></p>
          <Pronunciation word="קָרָא" />
        </div> : null}
      </header>
      {valid ? <section className={styles.card}>
        <h2>Significados</h2>
        {definitionsUnavailable ? <p>Não foi possível consultar os significados agora.</p>
          : entries.length ? <>
            <p>{hasTranslatedEntry ? "Tradução experimental em português, ainda não revisada. Alguns trechos permanecem em inglês." : "Definições originais em inglês; tradução para português ainda não revisada."}</p>
            {entries.length > 1 ? <p>Este código reúne mais de um verbete. Confira cada sentido no contexto do versículo.</p> : null}
            {entries.map((entry) => <details key={entry.bdbId}>
              <summary><span lang="he" dir="rtl">{entry.lemma}</span> · {entry.senseCount} acepções</summary>
              {entry.definitions.length ? <p><Definitions definitions={entry.definitions} strong={strong} bdbId={entry.bdbId} /></p> : null}
              <SenseList senses={entry.senses} strong={strong} bdbId={entry.bdbId} />
              {hasPilotEntry(strong, entry.bdbId) || hasDraftEntry(strong, entry.bdbId) ? <details className={styles.originalSource}>
                <summary>Ver definições em inglês</summary>
                {entry.definitions.length ? <p lang="en">{entry.definitions.join("; ")}</p> : null}
                <SenseList senses={entry.senses} strong={strong} bdbId={entry.bdbId} original />
              </details> : null}
            </details>)}
          </> : <p>Ainda não há verbete disponível para esta palavra.</p>}
        <details className={styles.source}><summary>Sobre as fontes</summary>
          {entries.length ? attribution ? <p>{attribution}</p> : <p>Fonte: Brown-Driver-Briggs, edição digital Open Scriptures.</p> : null}
          {lexicalSources.map((source) => <p key={source.sourceId}><strong>{source.name}:</strong> {source.attribution}</p>)}
          {pilot ? <p>Transliteração e guia de pronúncia: Open Scriptures Hebrew Lexicon, verbete Strong H7121. O áudio, quando disponível, usa uma voz do navegador e é aproximado.</p> : null}
          {!entries.length && !lexicalSources.length && !pilot ? <p>As informações de fonte estão temporariamente indisponíveis.</p> : null}
        </details>
      </section> : null}
      <section className={styles.card}>
        <h2>Onde aparece</h2>
        <p>Estas são as ocorrências disponíveis no índice de estudo. O acervo ainda é parcial; a lista não representa todas as ocorrências na Bíblia.</p>
        <p>Transliterações automáticas da forma no texto, sujeitas a revisão. Trechos da Bíblia Livre aparecem quando há correspondência identificada.</p>
        {unavailable ? <p role="status">Não foi possível consultar o índice agora. Tente novamente mais tarde.</p>
          : valid && shown.length === 0 ? <p>Esta palavra ainda não tem ocorrências disponíveis neste índice.</p>
          : shown.length > 0 ? <>
            <ol className={styles.list}>{[...byVerse].map(([reference, forms]) => {
              const match = /^GEN 1:(\d+)$/u.exec(reference);
              const verse = match ? Number(match[1]) : null;
              const verseText = verse === null ? undefined : portuguese.get(verse);
              return <li key={reference}>
                {match ? <Link href="/biblia/genesis/1">Gênesis 1:{match[1]}</Link> : <span>{reference}</span>}
                {forms.length > 1 ? <small>{forms.length} ocorrências</small> : null}
                <div className={styles.occurrences}>{forms.map((row, index) => {
                  const original = verse !== null && row.wordPosition !== null ? originals.get(`${verse}:${row.wordPosition}`) : undefined;
                  const verified = original && occurrenceMatchesSurface(row.surface, original.surface) && verse !== null && row.wordPosition !== null &&
                    !hebrewVariantWarning(original.code, original.version, `Gen 1:${verse}`, row.wordPosition);
                  const pilotExcerpt = verse !== null && row.wordPosition !== null
                    ? pilotContextualTranslation("genesis", 1, verse, row.wordPosition, "Bíblia Livre", [strong]) : null;
                  const excerpt = verified && verseText && verse !== null && row.wordPosition !== null
                    ? contextualExcerpt(verse, row.wordPosition, strong, verseText) ??
                      (pilotExcerpt && verseText.toLocaleLowerCase("pt-BR").includes(pilotExcerpt) ? pilotExcerpt : null) : null;
                  return <OccurrenceForm key={`${row.wordPosition ?? "sem-posicao"}-${index}`}
                    surface={verified ? original.surface : row.surface} rtl={rtl} verified={Boolean(verified)} excerpt={excerpt} />;
                })}</div>
                {match && portuguese.has(Number(match[1])) ? <p className={styles.context}>
                  <b>Bíblia Livre:</b> {portuguese.get(Number(match[1]))}
                </p> : null}
              </li>;
            })}</ol>
            {rows.length > 100 ? <p>Mostrando até 100 ocorrências disponíveis.</p> : null}
          </> : null}
        {valid && typeof language === "string" ? <WordUsesIndex key={`${language}:${strong}`} language={language} strong={strong} /> : null}
      </section>
    </main>
  );
}
