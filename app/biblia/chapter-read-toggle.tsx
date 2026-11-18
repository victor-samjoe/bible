"use client";

import { useReader } from "./reader-state";

// "Lido" deixou de ser marca de versículo e passou a ser estado do capítulo
// (tarefa C13). Fica no cabeçalho, como ação única, separada das ações de seleção
// e das configurações de leitura.
export function ChapterReadToggle() {
  const { isChapterRead, toggleChapterRead, reference, storage } = useReader();
  const where = storage === "account" ? "na sua conta" : "nesta sessão";

  return (
    <button
      type="button"
      onClick={toggleChapterRead}
      aria-pressed={isChapterRead}
      title={
        isChapterRead
          ? `${reference} está marcado como lido ${where}`
          : `Marcar ${reference} como lido ${where}`
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
