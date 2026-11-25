"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { OriginalSelectionResult } from "@/src/server/contracts/originals";
import {
  alignmentFor,
  originalGroupAt,
  tokenizeDisplayText,
  translationGroupAt,
} from "@/src/domain/passage-alignment";
import { wordAnalysisFor } from "@/src/domain/word-analysis";
import styles from "./selection-bar.module.css";
import {
  acceptionCount,
  lexiconFallbackMessage,
  readableSenseNote,
  readableSourceGloss,
  reviewLabel,
  type LexiconQueryState,
  type ReviewState,
} from "./lexicon-panel-text";

const failureMessage: Record<Exclude<OriginalSelectionResult, { ok: true }>["reason"], string> = {
  invalid_query: "A seleção não pôde ser consultada.",
  unavailable: "A consulta aos textos originais está temporariamente indisponível.",
  edition_unavailable: "A edição original deste testamento ainda não está disponível.",
  not_found: "A edição aprovada ainda não contém esta referência.",
  invalid_data: "A fonte respondeu com dados que não passaram pela validação.",
};

type SelectedVerse = { readonly number: number; readonly content: string };

/** Estado da consulta lexical, traduzido para o que o painel precisa saber. */
function lexiconQueryState(lexicon: LexiconSelectionResult | null): LexiconQueryState {
  if (lexicon === null) return "loading";
  return lexicon.ok ? "answered" : "failed";
}

type LexiconWord = Extract<LexiconSelectionResult, { ok: true }> ["verses"][number]["words"][number];

function transliterationFor(word: LexiconWord | null): string | null {
  const forms = word?.morphemes
    .map((morpheme) => morpheme.transliteration)
    .filter((form): form is string => Boolean(form));
  return forms && forms.length > 0 ? forms.join("-") : null;
}

/** Acepcao do BDB. A arvore e recursiva e o recuo por nivel e parte do dado. */
type BdbSense = {
  readonly number: string | null;
  readonly stem: string | null;
  readonly definitions: readonly string[];
  readonly note: string | null;
  readonly children: readonly BdbSense[];
};

type BdbEntry = {
  readonly bdbId: string;
  readonly lemma: string;
  readonly partOfSpeech: string | null;
  readonly isRoot: boolean;
  readonly definitions: readonly string[];
  readonly senseCount: number;
  readonly maxDepth: number;
  readonly senses: readonly BdbSense[];
};

type SourceCredit = {
  readonly sourceId: string;
  readonly name: string;
  readonly licenseDeclared: string;
  readonly attribution: string;
  readonly fields: readonly string[];
};

type LexiconMorpheme = {
  readonly surface: string;
  readonly lemma: string;
  readonly strongId: string | null;
  readonly morphology: string | null;
  readonly partOfSpeech: string | null;
  readonly semanticDomain: string | null;
  readonly transliteration: string | null;
  readonly meaning: string | null;
  readonly meaningSource: "reviewed_note" | "approved_translation" | "machine_draft" | "source_gloss" | null;
  readonly reviewState: ReviewState | null;
  readonly bdb: readonly BdbEntry[];
};

function ReviewBadge({ state }: { state: ReviewState | null }) {
  if (!state) return null;
  return (
    <span className={styles.reviewBadge} data-state={state}>
      {reviewLabel[state]}
    </span>
  );
}

/** Uma acepcao e seus filhos. A recursao espelha a da obra. */
function SenseList({ senses }: { senses: readonly BdbSense[] }) {
  if (senses.length === 0) return null;
  return (
    <ol>
      {senses.map((sense, index) => {
        const note = readableSenseNote(sense.note);
        return (
          <li key={`${sense.number ?? sense.stem ?? "-"}-${index}`}>
            {/* O espaço depois do número e do radical é literal, não margem:
                sem ele a acepção é copiada e lida como "aFall out". */}
            {sense.number ? <span className={styles.senseNumber}>{sense.number}{" "}</span> : null}
            {sense.stem ? <span className={styles.senseStem}>{sense.stem}{" "}</span> : null}
            {sense.definitions.length > 0 ? <span lang="en">{sense.definitions.join(", ")}</span> : null}
            {note ? <span className={styles.senseNote} lang="en"> {note}</span> : null}
            <SenseList senses={sense.children} />
          </li>
        );
      })}
    </ol>
  );
}

type LexiconSelectionResult =
  | {
      readonly ok: true;
      readonly bookSlug: string;
      readonly chapter: number;
      readonly previewingDrafts: boolean;
      readonly verses: readonly {
        readonly verse: number;
        readonly words: readonly {
          readonly position: number;
          readonly meaning: string | null;
          readonly meaningSource: LexiconMorpheme["meaningSource"];
          readonly reviewState: ReviewState | null;
          readonly draftMethod: string | null;
          readonly morphemes: readonly LexiconMorpheme[];
          readonly sources: readonly SourceCredit[];
        }[];
      }[];
    }
  | { readonly ok: false; readonly reason: "invalid_query" | "unavailable" | "not_found" };

export function OriginalPanel({ bookSlug, chapter, selectionVerses, translationName }: {
  bookSlug: string;
  chapter: number;
  selectionVerses: readonly SelectedVerse[];
  translationName: string;
}) {
  const [result, setResult] = useState<OriginalSelectionResult | null>(null);
  const [lexicon, setLexicon] = useState<LexiconSelectionResult | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [analysisSelection, setAnalysisSelection] = useState<{ verse: number; positions: readonly number[] } | null>(null);
  const verseNumbers = useMemo(() => selectionVerses.map((verse) => verse.number), [selectionVerses]);

  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setLexicon(null);
    setActive(null);
    setAnalysisSelection(null);
    const query = new URLSearchParams({ book: bookSlug, chapter: String(chapter), verses: verseNumbers.join(",") });
    void fetch(`/api/biblia/original?${query}`, { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async (response) => await response.json() as OriginalSelectionResult)
      .then((payload) => setResult(payload))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResult({ ok: false, reason: "unavailable" });
      });
    // A consulta lexical é complementar: não pode impedir a exibição do texto
    // original caso o índice ainda não esteja instalado naquele ambiente.
    void fetch(`/api/biblia/lexico?${query}`, { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async (response) => await response.json() as LexiconSelectionResult)
      .then((payload) => setLexicon(payload))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setLexicon({ ok: false, reason: "unavailable" });
      });
    return () => controller.abort();
  }, [bookSlug, chapter, verseNumbers]);

  if (result === null) return <p className={styles.local} role="status">Consultando a edição aprovada…</p>;
  if (!result.ok) return <div className={styles.originalEmpty} role="status"><p>{failureMessage[result.reason]}</p></div>;

  const rtl = result.edition.language === "hbo";
  return (
    <div className={styles.originalResult}>
      <p className={styles.originalLanguage} aria-label={`${result.edition.attribution}. ${result.edition.licenseDeclared}`}>
        <a href={result.edition.sourceUrl} target="_blank" rel="noreferrer">
          {rtl ? "Hebraico bíblico" : "Grego koiné"} · {result.edition.code}
        </a>
        <span>{result.edition.licenseDeclared}</span>
      </p>

      {result.verses.map((verse) => {
        const translated = selectionVerses.find((item) => item.number === verse.number);
        const words = tokenizeDisplayText(translated?.content ?? "");
        const groups = alignmentFor(bookSlug, chapter, verse.number);
        const lexicalVerse = lexicon?.ok ? lexicon.verses.find((item) => item.verse === verse.number) : null;
        const activeKey = (groupId: string) => `${verse.number}:${groupId}`;
        const selectWord = (key: string, positions: readonly number[]) => {
          setActive((current) => {
            const next = current === key ? null : key;
            setAnalysisSelection(next ? { verse: verse.number, positions } : null);
            return next;
          });
        };
        const selectedAnalyses = analysisSelection?.verse === verse.number
          ? analysisSelection.positions.map((position) => ({
              position,
              token: verse.tokens.find((token) => token.position === position),
              analysis: wordAnalysisFor(bookSlug, chapter, verse.number, position),
              lexical: lexicalVerse?.words.find((word) => word.position === position) ?? null,
            })).filter((item) => item.token)
          : [];
        return (
          <section key={verse.id} className={styles.comparisonBlock}>
            <div className={styles.versionRow}>
              <b>{translationName}</b>
              <span>{chapter}:{verse.number}</span>
              <p lang="pt-BR">
                {words.map((word, index) => {
                  const group = translationGroupAt(words, index, groups);
                  const key = group ? activeKey(group.id) : `${verse.number}:pt:${index}`;
                  return (
                    // O espaço entre os botões é literal, não margem de CSS:
                    // sem ele o versículo é copiado como "Eaterraestava" e o
                    // leitor de tela lê o parágrafo emendado numa palavra só.
                    //
                    // `aria-pressed` porque o botão é alternador: sem ele, a
                    // seleção só existe como cor, e quem usa leitor de tela não
                    // sabe qual palavra está aberta.
                    <Fragment key={`${word.display}-${index}`}>
                      {index > 0 ? " " : null}
                      <button type="button" className={styles.wordToken}
                        data-active={active === key ? "true" : undefined}
                        aria-pressed={active === key}
                        onClick={() => selectWord(key, group?.originalPositions ?? [])}>
                        {word.display}
                      </button>
                    </Fragment>
                  );
                })}
              </p>
            </div>

            <div className={styles.versionRow}>
              <b>{rtl ? "Hebraico · MorphHB" : "Grego · SBLGNT"}</b>
              <span>{verse.canonicalRef}</span>
              <p lang={rtl ? "he" : "grc"} dir={rtl ? "rtl" : "ltr"} className={styles.originalWords}>
                {verse.tokens.map((token, index) => {
                  const group = originalGroupAt(token.position, groups);
                  const key = group ? activeKey(group.id) : `${verse.number}:original:${token.position}`;
                  return (
                    <Fragment key={token.id}>
                      {index > 0 ? " " : null}
                      <button type="button" className={styles.wordToken}
                        data-active={active === key ? "true" : undefined}
                        aria-pressed={active === key}
                        onClick={() => selectWord(key, [token.position])}>
                        {token.normalized}
                      </button>
                    </Fragment>
                  );
                })}
              </p>
              {lexicalVerse ? (
                <p className={styles.transliterationLine} dir={rtl ? "rtl" : "ltr"} aria-label="Transliteração em alfabeto latino">
                  {verse.tokens.map((token, index) => {
                    const group = originalGroupAt(token.position, groups);
                    const key = group ? activeKey(group.id) : `${verse.number}:original:${token.position}`;
                    const form = transliterationFor(lexicalVerse.words.find((word) => word.position === token.position) ?? null);
                    // O nome acessível distingue este botão do botão da mesma
                    // palavra na linha de cima, que seleciona a mesma coisa:
                    // sem ele, o leitor de tela anuncia dois controles
                    // aparentemente idênticos.
                    return form ? (
                      <Fragment key={`${token.id}-transliteration`}>
                      {index > 0 ? " " : null}
                      <button type="button" className={styles.wordToken}
                        data-active={active === key ? "true" : undefined}
                        aria-pressed={active === key}
                        aria-label={`${form}, transliteração de ${token.normalized}`}
                        onClick={() => selectWord(key, group?.originalPositions ?? [token.position])}>
                        {form}
                      </button>
                      </Fragment>
                    ) : null;
                  })}
                </p>
              ) : null}
              {verse.tokens.some((token) => token.morphemes.length > 0) ? (
                <details className={styles.morphology}>
                  <summary>Morfologia</summary>
                  <ul>
                    {verse.tokens.flatMap((token) => token.morphemes.map((morpheme) => (
                      <li key={`${token.id}-${morpheme.position}`}>
                        <span lang="he" dir="rtl">{morpheme.surface}</span>
                        {morpheme.lemma ? ` · lema ${morpheme.lemma}` : ""} · {morpheme.morphologyCode}
                      </li>
                    )))}
                  </ul>
                </details>
              ) : null}
            </div>
            {selectedAnalyses.length > 0 ? (
              <aside className={styles.wordAnalysis} aria-live="polite" aria-label="Análise da palavra">
                {selectedAnalyses.map(({ position, token, analysis, lexical }) => (
                  <article key={position}>
                    <header>
                      <strong lang={rtl ? "he" : "grc"} dir={rtl ? "rtl" : "ltr"}>{token?.normalized}</strong>
                      {analysis ? <span>{analysis.transliteration}</span> : lexical?.morphemes.map((item) => item.transliteration).filter(Boolean).join(" · ") || null}
                    </header>
                    {analysis ? (
                      <>
                        <p className={styles.contextualMeaning}>{analysis.contextualTranslation}</p>
                        <dl>
                          <div><dt>Lema</dt><dd><span lang="he" dir="rtl">{analysis.lemma}</span> · {analysis.lemmaId}</dd></div>
                          <div><dt>Gramática</dt><dd>{analysis.grammar}</dd></div>
                          <div><dt>Campo semântico</dt><dd>{analysis.semanticRange.join(" · ")}</dd></div>
                          <div><dt>Neste texto</dt><dd>{analysis.contextualNote}</dd></div>
                        </dl>
                      </>
                    ) : lexical ? (
                      <>
                        {lexical.meaning ? (
                          <p className={styles.contextualMeaning}>
                            <span lang={lexical.meaningSource === "source_gloss" ? "en" : "pt-BR"}>
                              {lexical.meaningSource === "source_gloss"
                                ? readableSourceGloss(lexical.meaning)
                                : lexical.meaning}
                            </span>
                            <ReviewBadge state={lexical.reviewState} />
                            {lexical.meaningSource === "machine_draft" && lexical.draftMethod ? (
                              <span className={styles.analysisPending}>{lexical.draftMethod}</span>
                            ) : null}
                          </p>
                        ) : null}
                        <dl>
                          {lexical.morphemes.map((morpheme, index) => (
                            <div key={`${morpheme.lemma}-${index}`}>
                              <dt>{morpheme.surface}</dt>
                              <dd>
                                <span lang={rtl ? "he" : "grc"} dir={rtl ? "rtl" : "ltr"}>{morpheme.lemma}</span>
                                {morpheme.strongId ? ` · ${morpheme.strongId}` : ""}
                                {morpheme.morphology ? ` · ${morpheme.morphology}` : ""}
                                {morpheme.semanticDomain ? ` · domínio ${morpheme.semanticDomain}` : ""}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        {!lexical.meaning ? <p className={styles.analysisPending}>A forma e a morfologia estão disponíveis; a glossa contextual ainda não foi publicada pela fonte.</p> : null}

                        {lexical.morphemes.some((morpheme) => morpheme.bdb.length > 0) ? (
                          <details className={styles.senseTree}>
                            <summary>
                              Brown-Driver-Briggs
                              {" · "}
                              {acceptionCount(
                                lexical.morphemes.reduce(
                                  (total, morpheme) =>
                                    total + morpheme.bdb.reduce((sum, entry) => sum + entry.senseCount, 0),
                                  0,
                                ),
                              )}
                            </summary>
                            {lexical.morphemes.flatMap((morpheme) =>
                              morpheme.bdb.map((entry) => (
                                <section key={`${morpheme.surface}-${entry.bdbId}`}>
                                  <p className={styles.bdbEntryHead}>
                                    <span lang="he" dir="rtl">{entry.lemma}</span>
                                    {entry.partOfSpeech ? ` · ${entry.partOfSpeech}` : ""}
                                    {entry.isRoot ? " · raiz" : ""}
                                    {` · ${acceptionCount(entry.senseCount)}`}
                                    <ReviewBadge state="source_text" />
                                  </p>
                                  {entry.definitions.length > 0 ? (
                                    <p lang="en">{entry.definitions.join(", ")}</p>
                                  ) : null}
                                  <SenseList senses={entry.senses} />
                                </section>
                              )),
                            )}
                            <p className={styles.analysisPending}>
                              Texto em inglês, como a obra o publica. A tradução para português
                              destas acepções ainda não foi feita nem revisada.
                            </p>
                          </details>
                        ) : null}

                        {lexical.sources.length > 0 ? (
                          <div className={styles.sourceCredits}>
                            <ul>
                              {lexical.sources.map((source) => (
                                <li key={source.sourceId}>
                                  <b>{source.name}</b>
                                  {` — ${source.fields.join(", ")} · ${source.licenseDeclared}`}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className={styles.analysisPending}>{lexiconFallbackMessage(lexiconQueryState(lexicon))}</p>
                    )}
                  </article>
                ))}
              </aside>
            ) : null}
            {groups.length > 0 ? <p className={styles.alignmentHint}>Toque numa palavra para ver a correspondência editorial.</p> : null}
          </section>
        );
      })}
    </div>
  );
}
