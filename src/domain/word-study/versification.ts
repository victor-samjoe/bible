/**
 * Mapa de versificação, explícito e versionado (fila Claude 3, item 3).
 *
 * O item 3 exige: "Versículos com numeração divergente exigem mapa versionado
 * explícito." Hoje o repositório tem `src/domain/original-versification.ts`,
 * que é um `if` para Miqueias 5 — sem versão, sem procedência, e indexado pelo
 * slug do livro em português (achado §3.4 do item 1). Este módulo substitui
 * aquilo **para esta frente**, sem tocar no arquivo antigo, que continua
 * servindo o leitor atual.
 *
 * Duas regras de honestidade que o tipo faz valer:
 *
 * 1. **Regra sem procedência não existe.** Cada regra declara de onde a
 *    afirmação vem. Uma tabela de correspondência inventada de memória é pior
 *    que nenhuma: ela desloca a consulta em silêncio e o leitor vê a análise do
 *    versículo vizinho sem aviso.
 * 2. **Divergência conhecida e não mapeada é declarada.** O mapa carrega uma
 *    lista de livros onde se sabe que as tradições divergem e para os quais
 *    **ainda não há regra conferida**. Consulta que toca esses livros volta
 *    marcada `unverified`, em vez de voltar como se a numeração coincidisse.
 *    É a diferença entre "conferimos e bate" e "não conferimos".
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco, sem relógio.
 */

import { type CanonicalRef } from "./reference.ts";

export const VERSIFICATION_MAP_VERSION = "2026-11-26.1";

/**
 * Tradições em jogo. `reader-pt-br` é a numeração que o leitor mostra, que vem
 * da BLIVRE; `wlc-morphhb` é a impressa no texto hebraico que o índice usa como
 * âncora. O grego do SBLGNT não divergiu em nenhum caso conferido, e por isso
 * não tem regra — a ausência aqui é afirmação de que não se conferiu divergência
 * alguma, não de que ela não exista.
 */
export type VersificationTradition = "reader-pt-br" | "wlc-morphhb" | "sblgnt";

/**
 * Deslocamento declarativo, e não função, para que a regra possa ser lida,
 * auditada e serializada sem executar código.
 *
 * `readerVerseTo: null` significa "até o fim do capítulo".
 * `sourceChapter: null` significa "mesmo capítulo do leitor".
 */
export type VerseShift = {
  readonly readerVerseFrom: number;
  readonly readerVerseTo: number | null;
  readonly sourceChapter: number | null;
  /** Somado ao versículo do leitor para chegar ao da fonte. */
  readonly verseOffset: number;
};

export type VersificationRule = {
  /** Código USFM do livro, como o índice o publica. */
  readonly book: string;
  /** Capítulo na numeração do leitor. */
  readonly readerChapter: number;
  readonly from: VersificationTradition;
  readonly to: VersificationTradition;
  readonly shifts: readonly VerseShift[];
  /** O que a regra afirma, em português, para o relatório. */
  readonly describe: string;
  /** De onde a afirmação vem. Obrigatório. */
  readonly provenance: string;
};

/**
 * Livro onde se sabe que as tradições divergem e para o qual **não** existe
 * regra conferida. Serve para a consulta avisar, em vez de supor coincidência.
 */
export type DeclaredDivergence = {
  readonly book: string;
  /** `null` quando a divergência não está localizada num capítulo só. */
  readonly readerChapter: number | null;
  readonly describe: string;
  /** Como confirmar antes de escrever a regra. */
  readonly howToConfirm: string;
};

export type VersificationMap = {
  readonly version: string;
  readonly rules: readonly VersificationRule[];
  readonly declaredDivergences: readonly DeclaredDivergence[];
  /**
   * `false` enquanto a tabela não tiver sido conferida livro a livro contra o
   * manifesto da edição. É o campo que impede o mapa de se apresentar como
   * completo enquanto não for.
   */
  readonly exhaustive: boolean;
};

/**
 * A única regra conferida hoje.
 *
 * Miqueias 5 é o caso que o repositório já tratava, e a regra abaixo reproduz
 * exatamente o comportamento de `sourceVerseForOriginal` — portanto não
 * introduz afirmação nova, só lhe dá versão e procedência. Qualquer regra
 * adicional precisa de conferência contra o texto da edição antes de entrar.
 */
const MICAH_5: VersificationRule = {
  book: "MIC",
  readerChapter: 5,
  from: "reader-pt-br",
  to: "wlc-morphhb",
  shifts: [
    // Miqueias 5:1 do leitor é 4:14 na numeração hebraica.
    { readerVerseFrom: 1, readerVerseTo: 1, sourceChapter: 4, verseOffset: 13 },
    // A partir do versículo 2, o hebraico fica uma unidade atrás.
    { readerVerseFrom: 2, readerVerseTo: null, sourceChapter: 5, verseOffset: -1 },
  ],
  describe:
    "Miqueias 5 do leitor começa no que a tradição hebraica enumera como 4:14; do versículo 2 " +
    "em diante a numeração hebraica fica uma unidade atrás da portuguesa.",
  provenance:
    "Comportamento já implementado em src/domain/original-versification.ts e documentado no " +
    "comentário daquele módulo; reproduzido aqui sem alteração, apenas com versão e procedência.",
};

/**
 * Divergências que o item 1 (§3.4) levantou e que **não** estão mapeadas.
 *
 * A lista é indicativa e vem de conhecimento geral de versificação, não de
 * conferência contra os bytes da edição — que não estão neste checkout. É
 * exatamente por isso que elas entram como divergência declarada e não como
 * regra: o efeito é a consulta avisar que não conferiu, nunca deslocar a
 * referência por suposição.
 */
const DECLARED: readonly DeclaredDivergence[] = [
  {
    book: "PSA",
    readerChapter: null,
    describe:
      "A tradição hebraica conta o título do salmo como versículo, de modo que a numeração " +
      "pode ficar uma ou duas unidades adiante da portuguesa nos salmos com título.",
    howToConfirm:
      "Comparar, salmo a salmo, a contagem de versículos do OSIS do MorphHB com a da BLIVRE; " +
      "a diferença por salmo é o deslocamento, e só vale escrever a regra onde ela for estável.",
  },
  {
    book: "JOL",
    readerChapter: null,
    describe:
      "A divisão de capítulos difere: o que a tradição portuguesa traz em 3 capítulos a hebraica " +
      "traz em 4.",
    howToConfirm: "Conferir a contagem de capítulos do livro nas duas edições.",
  },
  {
    book: "MAL",
    readerChapter: null,
    describe: "Mesma classe de divergência de Joel: número de capítulos difere entre as tradições.",
    howToConfirm: "Conferir a contagem de capítulos do livro nas duas edições.",
  },
  {
    book: "1SA",
    readerChapter: 21,
    describe:
      "A fronteira entre 20 e 21 cai em lugar diferente: o que o português traz como 20:42 a " +
      "tradição hebraica pode trazer como 21:1.",
    howToConfirm: "Conferir o último versículo de 1Samuel 20 e o primeiro de 21 nas duas edições.",
  },
  {
    book: "2SA",
    readerChapter: 19,
    describe: "A fronteira entre 18 e 19 difere entre as tradições.",
    howToConfirm: "Conferir o último versículo de 2Samuel 18 e o primeiro de 19 nas duas edições.",
  },
  {
    book: "ECC",
    readerChapter: 5,
    describe: "A fronteira entre 4 e 5 difere entre as tradições.",
    howToConfirm: "Conferir o último versículo de Eclesiastes 4 e o primeiro de 5 nas duas edições.",
  },
];

export const WORD_STUDY_VERSIFICATION: VersificationMap = {
  version: VERSIFICATION_MAP_VERSION,
  rules: [MICAH_5],
  declaredDivergences: DECLARED,
  // Uma regra conferida e seis divergências declaradas não é tabela completa, e
  // dizer o contrário seria a desonestidade que este módulo existe para evitar.
  exhaustive: false,
};

export class VersificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VersificationError";
  }
}

/**
 * Valida o mapa. Regra sem procedência, sem deslocamento ou com faixa invertida
 * é erro de construção, não dado a tolerar.
 */
export function assertVersificationMapIsCoherent(map: VersificationMap): void {
  for (const rule of map.rules) {
    const label = `${rule.book} ${rule.readerChapter}`;
    if (rule.provenance.trim().length === 0) {
      throw new VersificationError(`regra ${label} sem procedência declarada`);
    }
    if (rule.shifts.length === 0) {
      throw new VersificationError(`regra ${label} sem deslocamento`);
    }
    for (const shift of rule.shifts) {
      if (shift.readerVerseFrom < 1) {
        throw new VersificationError(`regra ${label} com versículo inicial inválido`);
      }
      if (shift.readerVerseTo !== null && shift.readerVerseTo < shift.readerVerseFrom) {
        throw new VersificationError(`regra ${label} com faixa invertida`);
      }
    }
  }
  const seen = new Set<string>();
  for (const rule of map.rules) {
    const key = `${rule.book}:${rule.readerChapter}:${rule.from}:${rule.to}`;
    if (seen.has(key)) {
      throw new VersificationError(`duas regras para ${key}`);
    }
    seen.add(key);
  }
}

/**
 * Como a referência da fonte se relaciona com a numeração do leitor.
 *
 * - `identical`: nenhuma regra se aplica e o livro não tem divergência
 *   declarada — ou seja, há razão positiva para acreditar que coincide;
 * - `mapped`: uma regra conferida se aplicou, e `readerRef` diz o resultado;
 * - `unverified`: o livro tem divergência declarada e **não** há regra. A
 *   referência é devolvida como a fonte a publica, sem deslocamento, e o
 *   chamador é obrigado a avisar.
 */
export type VersificationState = "identical" | "mapped" | "unverified";

export type ReaderVerse = {
  readonly chapter: number;
  readonly verse: number;
};

function shiftFor(rule: VersificationRule, verse: number): VerseShift | null {
  for (const shift of rule.shifts) {
    const withinStart = verse >= shift.readerVerseFrom;
    const withinEnd = shift.readerVerseTo === null || verse <= shift.readerVerseTo;
    if (withinStart && withinEnd) return shift;
  }
  return null;
}

/**
 * Numeração do leitor → referência da fonte. É esta direção que a consulta usa
 * quando o usuário pede "os usos no versículo que estou lendo".
 */
export function sourceRefForReader(
  map: VersificationMap,
  book: string,
  readerChapter: number,
  readerVerse: number,
): { readonly chapter: number; readonly verse: number; readonly state: VersificationState } {
  const rule = map.rules.find(
    (item) => item.book === book && item.readerChapter === readerChapter,
  );
  if (rule) {
    const shift = shiftFor(rule, readerVerse);
    if (shift) {
      return {
        chapter: shift.sourceChapter ?? readerChapter,
        verse: readerVerse + shift.verseOffset,
        state: "mapped",
      };
    }
  }
  const divergence = map.declaredDivergences.find(
    (item) =>
      item.book === book && (item.readerChapter === null || item.readerChapter === readerChapter),
  );
  return {
    chapter: readerChapter,
    verse: readerVerse,
    state: divergence ? "unverified" : "identical",
  };
}

/**
 * Referência da fonte → numeração do leitor. É esta direção que a consulta usa
 * ao devolver a lista de usos, para que o número exibido seja o que o leitor
 * conhece.
 *
 * Só inverte regra conferida. Sem regra, devolve a mesma numeração e o estado
 * diz se isso é confiança (`identical`) ou falta de conferência (`unverified`).
 */
export function readerRefForSource(
  map: VersificationMap,
  ref: CanonicalRef,
): { readonly reader: ReaderVerse; readonly state: VersificationState } {
  for (const rule of map.rules) {
    if (rule.book !== ref.book) continue;
    for (const shift of rule.shifts) {
      const sourceChapter = shift.sourceChapter ?? rule.readerChapter;
      if (sourceChapter !== ref.chapter) continue;
      const readerVerse = ref.verse - shift.verseOffset;
      if (readerVerse < shift.readerVerseFrom) continue;
      if (shift.readerVerseTo !== null && readerVerse > shift.readerVerseTo) continue;
      return {
        reader: { chapter: rule.readerChapter, verse: readerVerse },
        state: "mapped",
      };
    }
  }
  // Nesta direção o capítulo do leitor ainda é desconhecido, então a
  // divergência é procurada só pelo livro. É a escolha conservadora: avisa em
  // todo o livro em vez de supor que o capítulo em mãos é um dos que coincidem.
  const divergence = map.declaredDivergences.find((item) => item.book === ref.book);
  return {
    reader: { chapter: ref.chapter, verse: ref.verse },
    state: divergence ? "unverified" : "identical",
  };
}

/** Aviso legível para a consulta anexar ao resultado. */
export function divergenceWarning(map: VersificationMap, book: string): string | null {
  const divergence = map.declaredDivergences.find((item) => item.book === book);
  if (!divergence) return null;
  return (
    `${book}: numeração não conferida entre a edição da fonte e a do leitor. ${divergence.describe} ` +
    "As referências abaixo são as da fonte, sem deslocamento."
  );
}
