"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  READING_POINTER_KEY,
  chapterLabelFromTitle,
  parseReaderPath,
} from "@/src/domain/reading-session";

// Ponteiro de "última leitura" (tarefa C15). Guarda somente livro, capítulo e
// instante do capítulo aberto, em `sessionStorage`, para o painel de início
// oferecer "retomar leitura" sem consultar banco e sem conta.
//
// O rótulo exibível (`Gênesis 1`) é lido do título da página, que o servidor
// monta com o nome real do livro vindo do corpus. Quando o título ainda não
// trocou ou não confere com o capítulo da rota, o rótulo fica nulo e o painel
// mostra a referência do caminho — nenhum nome de livro é inventado aqui.
//
// Não renderiza nada e não altera o comportamento do leitor.

const LABEL_RETRY_MS = 400;

export function ReadingPointer() {
  const pathname = usePathname() ?? "";

  useEffect(() => {
    const record = parseReaderPath(pathname);
    if (!record) return;

    const write = (label: string | null) => {
      try {
        window.sessionStorage.setItem(
          READING_POINTER_KEY,
          JSON.stringify({
            book: record.book,
            chapter: record.chapter,
            label,
            at: new Date().toISOString(),
          }),
        );
      } catch {
        // Sessão sem armazenamento disponível: o painel apenas não oferece
        // "retomar". Nada é perdido, porque nada aqui é dado de conta.
      }
      return label;
    };

    const immediate = write(chapterLabelFromTitle(document.title, record.chapter));
    if (immediate !== null) return;

    // Navegação no cliente troca o título depois do efeito; uma segunda tentativa
    // resolve sem ficar observando o documento.
    const timer = window.setTimeout(() => {
      const label = chapterLabelFromTitle(document.title, record.chapter);
      if (label !== null) write(label);
    }, LABEL_RETRY_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
