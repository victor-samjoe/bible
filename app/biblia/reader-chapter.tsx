"use client";

import { provisionalChapter } from "./chapter-data";
import { useReader } from "./reader-state";

// Renderiza o capítulo provisório e liga cada versículo às ferramentas locais.
// Não existe navegação por livro/capítulo aqui: isso é a tarefa C4, depois que a
// API BLIVRE (C3) e o corpus importado estiverem disponíveis.

export function ReaderChapter() {
  const { selectedVerse, selectVerse, highlights, read, notes, totalVerses } = useReader();

  return (
    <article className="scripture" aria-labelledby="chapter-title">
      <p className="scriptureMeta">{provisionalChapter.section}</p>
      <h1 id="chapter-title">
        {provisionalChapter.book} <span>{provisionalChapter.chapter}</span>
      </h1>
      <div className="chapterRule" />
      {provisionalChapter.blocks.map((block) =>
        block.kind === "heading" ? (
          <h2 key={`h-${block.text}`}>{block.text}</h2>
        ) : (
          <p key={`v-${block.number}`} className="verseLine">
            <button
              type="button"
              className="verseButton"
              data-selected={selectedVerse === block.number ? "true" : undefined}
              data-highlighted={highlights.has(block.number) ? "true" : undefined}
              data-read={read.has(block.number) ? "true" : undefined}
              onClick={() => selectVerse(block.number)}
            >
              <sup>{block.number}</sup>
              {block.text}
              {notes[block.number] ? (
                <span className="verseMark" title="Nota local nesta sessão" aria-hidden="true">
                  ✎
                </span>
              ) : null}
              {read.has(block.number) ? (
                <span className="verseMark" title="Lido nesta sessão" aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </button>
          </p>
        ),
      )}
      <p className="readerProgress" role="status">
        Lidos nesta sessão: {read.size} de {totalVerses} versículos deste capítulo · destaques:{" "}
        {highlights.size} · notas: {Object.keys(notes).length}. Tudo local nesta sessão, sem conta e
        sem sincronização.
      </p>
    </article>
  );
}
