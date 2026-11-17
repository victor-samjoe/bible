"use client";

import { useReader } from "./reader-state";

export type ChapterVerse = {
  readonly id: string;
  readonly number: number;
  readonly content: string;
};

// Renderiza o capítulo vindo do corpus BLIVRE no banco (tarefa C4) e liga cada
// versículo às ferramentas locais. Nenhum texto é gerado aqui: `verses` vem do
// contrato de leitura, que só entrega versículo publicado de tradução aprovada.

export function ReaderChapter({
  bookName,
  chapterNumber,
  translationName,
  verses,
}: {
  bookName: string;
  chapterNumber: number;
  translationName: string;
  verses: readonly ChapterVerse[];
}) {
  const { selectedVerse, selectVerse, highlights, read, notes, totalVerses } = useReader();

  return (
    <article className="scripture" aria-labelledby="chapter-title">
      <p className="scriptureMeta">{translationName.toUpperCase()}</p>
      <h1 id="chapter-title">
        {bookName} <span>{chapterNumber}</span>
      </h1>
      <div className="chapterRule" />
      {verses.map((verse) => (
        <p key={verse.id} className="verseLine">
          <button
            type="button"
            className="verseButton"
            data-selected={selectedVerse === verse.number ? "true" : undefined}
            data-highlighted={highlights.has(verse.number) ? "true" : undefined}
            data-read={read.has(verse.number) ? "true" : undefined}
            onClick={() => selectVerse(verse.number)}
          >
            <sup>{verse.number}</sup>
            {verse.content}
            {notes[verse.number] ? (
              <span className="verseMark" title="Nota local nesta sessão" aria-hidden="true">
                ✎
              </span>
            ) : null}
            {read.has(verse.number) ? (
              <span className="verseMark" title="Lido nesta sessão" aria-hidden="true">
                ✓
              </span>
            ) : null}
          </button>
        </p>
      ))}
      <p className="readerProgress" role="status">
        Lidos nesta sessão: {read.size} de {totalVerses} versículos deste capítulo · destaques:{" "}
        {highlights.size} · notas: {Object.keys(notes).length}. Tudo local nesta sessão, sem conta e
        sem sincronização.
      </p>
    </article>
  );
}
