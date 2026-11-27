/**
 * Fixtures declaradas do estudo de palavras (fila Claude 3, item 4).
 *
 * **Leia esta distinção antes de usar qualquer coisa daqui.** O arquivo tem dois
 * tipos de dado, e confundi-los seria o erro que a fila proíbe:
 *
 * 1. `REAL_*` — valores **transcritos dos recortes reais** das fontes, em
 *    `tests/fixtures/lexicons/`. São o que a fonte literalmente publica para
 *    Gênesis 1:1 e João 1:1, conferidos linha a linha contra o arquivo. Servem
 *    para comparar o resultado da consulta com a fonte, sem intermediário.
 * 2. `SYNTHETIC_*` — corpo **inventado para exercitar estrutura**: ordem
 *    canônica entre livros, capítulos de dois dígitos, homógrafos convivendo,
 *    morfemas na mesma posição. Os Strong e as referências são plausíveis, mas
 *    **não são afirmação lexicográfica** e nada aqui pode virar conteúdo de
 *    produto. É andaime de teste, e está rotulado como tal.
 *
 * Nenhuma tradução é inventada em nenhum dos dois: o índice não guarda tradução,
 * e inventar glossa para teste criaria exatamente o dado que o produto não pode
 * exibir.
 */

import {
  identityOfStrong,
  parseStrong,
  type WordStudyLanguage,
} from "../../src/domain/word-study/identity.ts";
import { type OccurrenceInput } from "../../src/domain/word-study/inverted-index.ts";
import { parseRef } from "../../src/domain/word-study/reference.ts";

export function refOf(raw: string) {
  const parsed = parseRef(raw);
  if ("problem" in parsed) throw new Error(`fixture com referência inválida: ${raw}`);
  return parsed.ref;
}

export function identityOf(language: WordStudyLanguage, strong: string) {
  const parsed = parseStrong(language, strong);
  if ("problem" in parsed) throw new Error(`fixture com Strong inválido: ${strong}`);
  return identityOfStrong(parsed.strong);
}

export function occurrenceOf(
  language: WordStudyLanguage,
  strong: string,
  rawRef: string,
  position: number | null,
  sourceWordId: string,
): OccurrenceInput {
  return {
    identity: identityOf(language, strong),
    ref: refOf(rawRef),
    position,
    sourceWordId,
  };
}

// ---------------------------------------------------------------------------
// 1. REAL — transcrito de tests/fixtures/lexicons/macula-hebrew-gen1-1.sample.tsv
//    (commit 47db250bd55d0d8577f2a94fba114ef16c35b23c, CC BY 4.0, Clear Bible).
//    As 11 linhas morfêmicas de Gênesis 1:1, na ordem do arquivo.
// ---------------------------------------------------------------------------

export type RealRow = {
  readonly sourceWordId: string;
  readonly ref: string;
  readonly position: number;
  readonly surface: string;
  readonly strongnumberx: string;
  /** Chave que o índice deve produzir para esta linha. */
  readonly expectedKey: string;
};

export const REAL_GENESIS_1_1: readonly RealRow[] = [
  { sourceWordId: "o010010010011", ref: "GEN 1:1", position: 1, surface: "בְּ", strongnumberx: "0871a", expectedKey: "hbo:H871a" },
  { sourceWordId: "o010010010012", ref: "GEN 1:1", position: 1, surface: "רֵאשִׁ֖ית", strongnumberx: "7225", expectedKey: "hbo:H7225" },
  { sourceWordId: "o010010010021", ref: "GEN 1:1", position: 2, surface: "בָּרָ֣א", strongnumberx: "1254", expectedKey: "hbo:H1254" },
  { sourceWordId: "o010010010031", ref: "GEN 1:1", position: 3, surface: "אֱלֹהִ֑ים", strongnumberx: "0430", expectedKey: "hbo:H430" },
  { sourceWordId: "o010010010041", ref: "GEN 1:1", position: 4, surface: "אֵ֥ת", strongnumberx: "0853", expectedKey: "hbo:H853" },
  { sourceWordId: "o010010010051", ref: "GEN 1:1", position: 5, surface: "הַ", strongnumberx: "1886a", expectedKey: "hbo:H1886a" },
  { sourceWordId: "o010010010052", ref: "GEN 1:1", position: 5, surface: "שָּׁמַ֖יִם", strongnumberx: "8064", expectedKey: "hbo:H8064" },
  { sourceWordId: "o010010010061", ref: "GEN 1:1", position: 6, surface: "וְ", strongnumberx: "2050b", expectedKey: "hbo:H2050b" },
  { sourceWordId: "o010010010062", ref: "GEN 1:1", position: 6, surface: "אֵ֥ת", strongnumberx: "0853", expectedKey: "hbo:H853" },
  { sourceWordId: "o010010010071", ref: "GEN 1:1", position: 7, surface: "הָ", strongnumberx: "1886a", expectedKey: "hbo:H1886a" },
  { sourceWordId: "o010010010072", ref: "GEN 1:1", position: 7, surface: "אָֽרֶץ", strongnumberx: "0776", expectedKey: "hbo:H776" },
];

// ---------------------------------------------------------------------------
// 2. REAL — transcrito de macula-greek-jhn1-1.sample.tsv
//    (commit 8423afe47b9e8f24b7772e808af45c7159a6fe7e, CC BY 4.0, Clear Bible).
//    Só as linhas de εἰμί/ἦν e λόγος, que são as que provam a cisão forma/lema.
// ---------------------------------------------------------------------------

export const REAL_JOHN_1_1_SELECTED: readonly RealRow[] = [
  { sourceWordId: "n43001001003", ref: "JHN 1:1", position: 3, surface: "ἦν", strongnumberx: "2258", expectedKey: "grc:G2258" },
  { sourceWordId: "n43001001005", ref: "JHN 1:1", position: 5, surface: "λόγος", strongnumberx: "3056", expectedKey: "grc:G3056" },
  { sourceWordId: "n43001001009", ref: "JHN 1:1", position: 9, surface: "ἦν", strongnumberx: "2258", expectedKey: "grc:G2258" },
  { sourceWordId: "n43001001015", ref: "JHN 1:1", position: 15, surface: "ἦν", strongnumberx: "2258", expectedKey: "grc:G2258" },
  { sourceWordId: "n43001001017", ref: "JHN 1:1", position: 17, surface: "λόγος", strongnumberx: "3056", expectedKey: "grc:G3056" },
];

// ---------------------------------------------------------------------------
// 3. SINTÉTICO — andaime estrutural. NÃO é dado lexicográfico.
//
//    Desenhado para que uma ordenação por texto, em qualquer ponto do caminho,
//    quebre um teste:
//      · livros fora de ordem na entrada, inclusive Atos antes de Gênesis;
//      · capítulos 1, 2 e 10 e versículos 1, 2, 9, 10, 11 no mesmo livro;
//      · homógrafos H1254, H1254a e H1254b convivendo;
//      · dois morfemas na mesma posição do mesmo versículo;
//      · uma ocorrência sem posição publicada;
//      · livro com versificação não conferida (PSA) e livro com regra (MIC).
// ---------------------------------------------------------------------------

export const SYNTHETIC_MULTIBOOK: readonly OccurrenceInput[] = [
  // Entrada deliberadamente desordenada.
  occurrenceOf("hbo", "853", "ACT 1:1", 1, "s01"),
  occurrenceOf("hbo", "853", "GEN 1:10", 1, "s02"),
  occurrenceOf("hbo", "853", "GEN 1:2", 1, "s03"),
  occurrenceOf("hbo", "853", "GEN 1:2", 3, "s04"),
  occurrenceOf("hbo", "853", "GEN 10:1", 1, "s05"),
  occurrenceOf("hbo", "853", "GEN 2:1", 1, "s06"),
  occurrenceOf("hbo", "853", "GEN 1:1", 4, "s07"),
  occurrenceOf("hbo", "853", "GEN 1:1", 6, "s08"),
  occurrenceOf("hbo", "853", "GEN 1:9", 1, "s09"),
  occurrenceOf("hbo", "853", "GEN 1:11", 1, "s10"),
  occurrenceOf("hbo", "853", "PSA 3:1", 1, "s11"),
  occurrenceOf("hbo", "853", "MIC 4:14", 1, "s12"),
  occurrenceOf("hbo", "853", "REV 22:21", null, "s13"),

  // Homógrafos: três identidades distintas que compartilham o número.
  occurrenceOf("hbo", "1254", "GEN 1:1", 2, "s20"),
  occurrenceOf("hbo", "1254a", "GEN 1:21", 2, "s21"),
  occurrenceOf("hbo", "1254b", "1SA 2:29", 9, "s22"),

  // Morfemas na mesma posição: prefixo e radical da mesma palavra.
  occurrenceOf("hbo", "871a", "EXO 1:1", 1, "s30"),
  occurrenceOf("hbo", "7225", "EXO 1:1", 1, "s31"),

  // Chaves que são prefixo uma da outra, para o filtro textual do serviço.
  occurrenceOf("hbo", "85", "LEV 1:1", 1, "s40"),
  occurrenceOf("hbo", "8", "LEV 1:2", 1, "s41"),

  // Grego, para que o índice tenha os dois idiomas.
  occurrenceOf("grc", "2258", "JHN 1:1", 3, "s50"),
  occurrenceOf("grc", "3056", "JHN 1:1", 5, "s51"),
];

/** Ordem canônica esperada das referências de `hbo:H853` no sintético. */
export const SYNTHETIC_H853_CANONICAL_ORDER: readonly string[] = [
  "GEN 1:1",
  "GEN 1:2",
  "GEN 1:9",
  "GEN 1:10",
  "GEN 1:11",
  "GEN 2:1",
  "GEN 10:1",
  "PSA 3:1",
  "MIC 4:14",
  "ACT 1:1",
  "REV 22:21",
];
