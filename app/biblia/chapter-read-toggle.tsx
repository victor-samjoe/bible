"use client";

import { useReader } from "./reader-state";

// "Lido" deixou de ser marca de versículo e passou a ser estado do capítulo
// (tarefa C13). Fica no cabeçalho, como ação única, separada das ações de seleção
// e das configurações de leitura.
export function ChapterReadToggle() {
  const { isChapterRead, toggleChapterRead, reference } = useReader();

  return (
    <button
      type="button"
      onClick={toggleChapterRead}
      aria-pressed={isChapterRead}
      title={
        isChapterRead
          ? `${reference} está marcado como lido nesta sessão`
          : `Marcar ${reference} como lido nesta sessão`
      }
      aria-label={
        isChapterRead
          ? `Desmarcar ${reference} como lido`
          : `Marcar ${reference} como lido`
      }
      data-read={isChapterRead ? "true" : undefined}
    >
      {isChapterRead ? "✓" : "○"}
    </button>
  );
}
