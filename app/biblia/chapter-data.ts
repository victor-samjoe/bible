// Capítulo provisório fixo no código.
//
// Texto: Bíblia Livre (BLIVRE), Copyright (c) Diego Santos, Mario Sérgio e Marco
// Teles, fevereiro de 2018, licença Creative Commons Atribuição 4.0 Brasil.
// Nenhum versículo foi adicionado, alterado ou traduzido aqui: este arquivo apenas
// move para dados o mesmo trecho que já estava escrito em `app/biblia/page.tsx`.
//
// Tarefa C4 substitui esta constante por consulta ao corpus importado
// (`src/server/bible/**`, tarefa C3). Até lá, o leitor exibe somente este capítulo
// e não deve afirmar navegação por livro/capítulo.

export type ChapterBlock =
  | { readonly kind: "heading"; readonly text: string }
  | { readonly kind: "verse"; readonly number: number; readonly text: string };

export type ProvisionalChapter = {
  readonly translation: string;
  readonly book: string;
  readonly chapter: number;
  readonly section: string;
  readonly blocks: readonly ChapterBlock[];
};

export const provisionalChapter: ProvisionalChapter = {
  translation: "BLIVRE",
  book: "Gálatas",
  chapter: 1,
  section: "NOVA ALIANÇA · CARTAS DE PAULO",
  blocks: [
    {
      kind: "verse",
      number: 1,
      text: "Paulo, apóstolo (não da parte dos seres humanos, nem por meio de homem algum, mas sim por Jesus Cristo, e por Deus Pai, que o ressuscitou dos mortos),",
    },
    {
      kind: "verse",
      number: 2,
      text: "e todos os irmãos que estão comigo, para as igrejas da Galácia.",
    },
    {
      kind: "verse",
      number: 3,
      text: "Graça seja convosco, e também a paz de Deus Pai, e do nosso Senhor Jesus Cristo,",
    },
    {
      kind: "verse",
      number: 4,
      text: "que deu a si mesmo pelos nossos pecados, para nos tirar da presente era maligna, conforme a vontade do nosso Deus e Pai,",
    },
    {
      kind: "verse",
      number: 5,
      text: "ao qual seja a glória para todo o sempre, Amém!",
    },
    { kind: "heading", text: "Não há outro evangelho" },
    {
      kind: "verse",
      number: 6,
      text: "Admiro-me de que tão rapidamente desviastes daquele que vos chamou na graça de Cristo, em troca de outro evangelho.",
    },
    {
      kind: "verse",
      number: 7,
      text: "Não que haja outro evangelho, porém há alguns que vos inquietam, e querem perverter o Evangelho de Cristo.",
    },
    {
      kind: "verse",
      number: 8,
      text: "Porém, ainda que nós mesmos, ou um anjo do céu vos anuncie outro evangelho além do que já vos anunciamos, maldito seja.",
    },
    {
      kind: "verse",
      number: 9,
      text: "Como já havíamos dito, volto também agora a dizer: se alguém vos anunciar outro evangelho além do que já recebestes, maldito seja.",
    },
    {
      kind: "verse",
      number: 10,
      text: "Pois agora estou buscando a aprovação das pessoas, ou a de Deus? Ou procuro agradar a pessoas? Pois, se ainda tentasse agradar a pessoas, eu não seria servo de Cristo.",
    },
  ],
};

export const chapterReference = `${provisionalChapter.book} ${provisionalChapter.chapter}`;

export const verseNumbers: readonly number[] = provisionalChapter.blocks
  .filter((block): block is Extract<ChapterBlock, { kind: "verse" }> => block.kind === "verse")
  .map((block) => block.number);

export function verseReference(verse: number): string {
  return `${chapterReference}:${verse}`;
}
