/**
 * Textos visíveis do painel lexical.
 *
 * Vivem fora de `original-panel.tsx` por um motivo prático: o `tsconfig` do
 * Next usa `jsx: "preserve"`, então o vitest não consegue parsear um `.tsx`, e
 * um texto que o leitor vê sem teste é um texto que ninguém confere. Aqui eles
 * são funções puras, testadas em `tests/server/lexicon-panel-presentation.test.ts`.
 */

export type ReviewState = "editorial_reviewed" | "approved" | "unreviewed_draft" | "source_text";

/**
 * Rótulo do estado de revisão. Rascunho **sempre** aparece rotulado: é o que
 * impede tradução automática de passar por verbete conferido.
 */
export const reviewLabel: Record<ReviewState, string> = {
  editorial_reviewed: "revisado",
  approved: "tradução aprovada",
  unreviewed_draft: "rascunho não revisado",
  source_text: "texto da fonte",
};

/**
 * `1 acepção`, `4 acepções`. Plural de verdade; `acepção(ões)` é saída de
 * máquina e estava aparecendo na tela do leitor.
 */
export function acceptionCount(total: number): string {
  return `${total} ${total === 1 ? "acepção" : "acepções"}`;
}

/** Estado da consulta lexical, do ponto de vista do painel. */
export type LexiconQueryState = "loading" | "failed" | "answered";

/**
 * Mensagem quando a palavra selecionada não tem análise lexical.
 *
 * Os três casos são diferentes e **não** podem usar o mesmo texto: enquanto a
 * consulta está em voo, ou quando ela falhou, dizer que a nota "aguarda revisão
 * editorial" é afirmar um estado editorial que ninguém verificou. Só o terceiro
 * caso — índice respondeu, palavra sem nota — é de fato pendência de revisão.
 */
export function lexiconFallbackMessage(state: LexiconQueryState): string {
  switch (state) {
    case "loading":
      return "Consultando o índice lexical…";
    case "failed":
      // Dito explicitamente para o leitor não concluir que o texto original
      // também caiu: ele vem da edição aprovada, por outra consulta.
      return "A consulta ao índice lexical não respondeu. A forma e a morfologia acima vêm da edição aprovada e não dependem dela.";
    case "answered":
      return "A forma e a morfologia estão disponíveis; a nota semântica ainda aguarda revisão editorial.";
  }
}

/**
 * Limpa a nota de uma acepção do BDB.
 *
 * **Causa, para quem for corrigir na raiz:** no XML do BDB as definições são
 * `<def>` separadas por vírgulas que ficam como texto solto entre elas. O
 * parser (`src/importers/lexicon/oshb-bdb.ts`) recolhe as `<def>` em
 * `definitions` e o texto restante em `note` — e esse restante inclui as
 * vírgulas separadoras. Resultado na tela: `occur, take place, come about,
 * come to pass , , ,`.
 *
 * Aqui a nota é apenas **exibida** limpa; o dado gravado continua sujo. A
 * correção de raiz é no parser e exige reconstruir o índice, o que esta frente
 * não faz. Nota feita só de separadores não carrega informação e some.
 */
export function readableSenseNote(note: string | null): string | null {
  if (note === null) return null;
  const trimmed = note.trim();
  if (trimmed.length === 0) return null;
  if (/^[\s,;:.·&]+$/u.test(trimmed)) return null;
  const withoutTrailing = trimmed.replace(/[\s,;:·&]+$/u, "");
  return withoutTrailing.length > 0 ? withoutTrailing : null;
}

/**
 * A fonte usa pontos para ligar unidades de uma glossa (`the.people`). Eles
 * servem ao dataset, não à leitura humana; na interface viram palavras normais,
 * preservando a indicação de que o conteúdo ainda é da fonte.
 */
export function readableSourceGloss(value: string): string {
  return value
    .replace(/[._]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
