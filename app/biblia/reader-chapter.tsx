"use client";

import { useRef, type ReactNode } from "react";
import { useReader } from "./reader-state";
import { ChapterContext } from "./chapter-context";

export type ChapterVerse = {
  readonly id: string;
  readonly number: number;
  readonly content: string;
};

// Renderiza o capítulo vindo do corpus BLIVRE no banco e trata cada versículo como
// alvo de seleção (tarefa C13): o toque marca e desmarca, sem abrir painel nem
// modal. As ações ficam na barra que aparece só quando há seleção.
//
// Nenhum texto é gerado aqui: `verses` vem do contrato de leitura, que só entrega
// versículo publicado de tradução aprovada.

export function ReaderChapter({
  bookName,
  chapterNumber,
  translationName,
  verses,
  navigation,
}: {
  bookName: string;
  chapterNumber: number;
  translationName: string;
  verses: readonly ChapterVerse[];
  navigation?: ReactNode;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const {
    selection,
    toggleVerse,
    highlightOf,
    chapterNotes,
    isChapterRead,
    highlightCount,
    totalVerses,
  } = useReader();

  const noteAnchors = new Map(chapterNotes.map((note) => [note.anchor, note]));

  return (
    <article className="scripture" aria-labelledby="chapter-title" onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null; }} onTouchEnd={(event) => { const start = touchStart.current; const touch = event.changedTouches[0]; touchStart.current = null; if (!start || !touch || Math.abs(touch.clientY - start.y) >= 55) return; if (touch.clientX - start.x > 80) window.dispatchEvent(new Event("reader-open-menu")); if (start.x - touch.clientX > 80) window.dispatchEvent(new Event("reader-open-tools")); }}>
      <button
        type="button"
        className="scriptureMeta translationLink"
        onClick={() => window.dispatchEvent(new Event("reader-open-versions"))}
        aria-label={`Mudar versão, atual ${translationName}`}
      >
        {translationName.toUpperCase()}
      </button>
      <h1 id="chapter-title" style={{ textAlign: "center" }}>
        {bookName} <span>{chapterNumber}</span>
      </h1>
      <ChapterContext bookName={bookName} />
      {navigation}
      <div className="chapterRule" />
      {verses.map((verse) => {
        const selected = selection.has(verse.number);
        const color = highlightOf(verse.number);
        const note = noteAnchors.get(verse.number);
        return (
          <p key={verse.id} className="verseLine">
            <button
              type="button"
              className="verseButton"
              aria-pressed={selected}
              data-selected={selected ? "true" : undefined}
              data-highlight={color}
              onClick={(event) => toggleVerse(verse.number, event.shiftKey)}
            >
              <sup>{verse.number}</sup>
              {verse.content}
              {note ? (
                <span
                  className="verseMark"
                  title={`Nota local em ${bookName} ${chapterNumber}:${note.verses}`}
                  aria-hidden="true"
                >
                  ✎
                </span>
              ) : null}
            </button>
          </p>
        );
      })}
      <p className="readerProgress" role="status">
        {isChapterRead ? "Capítulo marcado como lido nesta sessão." : "Capítulo ainda não marcado como lido."}{" "}
        {totalVerses} versículos · destaques: {highlightCount} · notas: {chapterNotes.length}. Tudo
        local nesta sessão, sem conta e sem sincronização.
      </p>
    </article>
  );
}
