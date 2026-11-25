import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { lexemeOccurrences } from "@/drizzle/schema";
import { getDatabaseAsync } from "@/src/server/db/client";
import { getBlivreReader } from "@/src/server/bible/runtime";
import { createDrizzleLexiconRepository } from "@/src/server/lexicon/repository";
import type { BdbEntryView } from "@/src/domain/lexicon/word-analysis-view";
import type { BdbSense } from "@/src/domain/lexicon/records";
import styles from "./palavra.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Estudo de palavra | Bíblia Bereana" };

type Search = Promise<{ idioma?: string | string[]; strong?: string | string[] }>;

function SenseList({ senses }: { readonly senses: readonly BdbSense[] }) {
  if (!senses.length) return null;
  return <ol>{senses.map((sense, index) => <li key={index}>
    {sense.number ? `${sense.number}. ` : ""}{sense.stem ? `${sense.stem}: ` : ""}
    <span lang="en">{sense.definitions.join("; ")}</span>
    <SenseList senses={sense.children} />
  </li>)}</ol>;
}

export default async function WordStudy({ searchParams }: { readonly searchParams: Search }) {
  const params = await searchParams;
  const language = params.idioma;
  const strong = typeof params.strong === "string" ? params.strong.toUpperCase() : "";
  const valid = (language === "hbo" && /^H\d{1,5}[A-Z]?$/u.test(strong)) ||
    (language === "grc" && /^G\d{1,5}[A-Z]?$/u.test(strong));
  let rows: { canonicalRef: string; surface: string; lemma: string }[] = [];
  let entries: readonly BdbEntryView[] = [];
  let attribution: string | null = null;
  let definitionsUnavailable = false;
  let unavailable = false;
  if (valid) {
    try {
      const database = await getDatabaseAsync();
      if (!database) unavailable = true;
      else {
        const key = `${language}:${strong}`;
        const repo = createDrizzleLexiconRepository(database);
        const [occurrences, definitions, sources] = await Promise.allSettled([
          database.select({ canonicalRef: lexemeOccurrences.canonicalRef,
            surface: lexemeOccurrences.surface, lemma: lexemeOccurrences.lemma })
            .from(lexemeOccurrences).where(eq(lexemeOccurrences.lexemeKey, key))
            .orderBy(asc(lexemeOccurrences.canonicalRef), asc(lexemeOccurrences.wordPosition)).limit(101),
          repo.listBdbEntries([key]), repo.listSources(["oshb-bdb"]),
        ]);
        if (occurrences.status === "fulfilled") rows = occurrences.value;
        else unavailable = true;
        if (definitions.status === "fulfilled") entries = definitions.value.get(key) ?? [];
        else definitionsUnavailable = true;
        if (sources.status === "fulfilled") attribution = sources.value.get("oshb-bdb")?.attribution ?? null;
      }
    } catch { unavailable = true; }
  }
  const shown = [...rows].sort((left, right) =>
    left.canonicalRef.localeCompare(right.canonicalRef, "en", { numeric: true }),
  ).slice(0, 100);
  const byVerse = new Map<string, string[]>();
  for (const row of shown) {
    const forms = byVerse.get(row.canonicalRef) ?? [];
    forms.push(row.surface);
    byVerse.set(row.canonicalRef, forms);
  }
  const portuguese = new Map<number, string>();
  if (shown.some((row) => /^GEN 1:\d+$/u.test(row.canonicalRef))) {
    try {
      const chapter = await (await getBlivreReader()).readChapter("genesis", 1);
      if (chapter.ok) for (const verse of chapter.verses) {
        // Never display USFM markers as if they were Bible text.
        if (!verse.content.includes("\\")) portuguese.set(verse.number, verse.content);
      }
    } catch { /* The original occurrences remain available without context. */ }
  }
  const rtl = language === "hbo";
  return (
    <main className={styles.page}>
      <Link href="/biblia" className={styles.back}>← Voltar à Bíblia</Link>
      <header className={styles.header}>
        <p className={styles.eyebrow}>ESTUDO DE PALAVRA</p>
        <h1>{shown[0]?.lemma ? <span lang={rtl ? "he" : "grc"} dir={rtl ? "rtl" : "ltr"}>{shown[0].lemma}</span> : "Palavra original"}</h1>
        {valid ? <p>{rtl ? "Hebraico" : "Grego"} · Strong {strong}</p> : <p>Selecione uma palavra no painel de originais para começar.</p>}
      </header>
      {valid ? <section className={styles.card}>
        <h2>Significados</h2>
        {definitionsUnavailable ? <p>Não foi possível consultar os significados agora.</p>
          : entries.length ? <>
            <p>Definições originais em inglês; tradução para português ainda não revisada.</p>
            {entries.map((entry) => <details key={entry.bdbId}>
              <summary><span lang="he" dir="rtl">{entry.lemma}</span> · {entry.senseCount} acepções</summary>
              {entry.definitions.length ? <p lang="en">{entry.definitions.join("; ")}</p> : null}
              <SenseList senses={entry.senses} />
            </details>)}
            {attribution ? <p>{attribution}</p> : <p>Fonte: Brown-Driver-Briggs, edição digital Open Scriptures.</p>}
          </> : <p>Ainda não há verbete disponível para esta palavra.</p>}
      </section> : null}
      <section className={styles.card}>
        <h2>Onde aparece</h2>
        <p>Estas são as ocorrências disponíveis no índice de estudo. O acervo ainda é parcial; a lista não representa todas as ocorrências na Bíblia.</p>
        {unavailable ? <p role="status">Não foi possível consultar o índice agora. Tente novamente mais tarde.</p>
          : valid && shown.length === 0 ? <p>Esta palavra ainda não tem ocorrências disponíveis neste índice.</p>
          : shown.length > 0 ? <>
            <ol className={styles.list}>{[...byVerse].map(([reference, forms]) => {
              const match = /^GEN 1:(\d+)$/u.exec(reference);
              return <li key={reference}>
                {match ? <Link href="/biblia/genesis/1">Gênesis 1:{match[1]}</Link> : <span>{reference}</span>}
                <span lang={rtl ? "he" : "grc"} dir={rtl ? "rtl" : "ltr"}>{forms.join(" · ")}</span>
                {forms.length > 1 ? <small>{forms.length} ocorrências</small> : null}
                {match && portuguese.has(Number(match[1])) ? <p className={styles.context}>
                  <b>Bíblia Livre:</b> {portuguese.get(Number(match[1]))}
                </p> : null}
              </li>;
            })}</ol>
            {rows.length > 100 ? <p>Mostrando até 100 ocorrências disponíveis.</p> : null}
          </> : null}
      </section>
    </main>
  );
}
