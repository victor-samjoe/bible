export type WordAnalysis = {
  readonly transliteration: string;
  readonly contextualTranslation: string;
  readonly lemma: string;
  readonly lemmaId: string;
  readonly grammar: string;
  readonly semanticRange: readonly string[];
  readonly contextualNote: string;
};

/**
 * Notas lexicais editoriais revisadas. O corpus MorphHB fornece forma, lema e
 * morfologia; tradução e semântica ficam separadas para nunca parecerem uma
 * inferência automática do texto-base.
 */
const reviewed: Readonly<Record<string, WordAnalysis>> = {
  "genesis.1.1.1": {
    transliteration: "bereshit",
    contextualTranslation: "no princípio",
    lemma: "רֵאשִׁית",
    lemmaId: "H7225",
    grammar: "preposição בְּ + substantivo feminino singular em estado construto",
    semanticRange: ["princípio", "começo", "primeira parte", "primazia"],
    contextualNote: "Aqui introduz o início da ação criadora narrada no versículo.",
  },
  "genesis.1.1.2": {
    transliteration: "bara",
    contextualTranslation: "criou",
    lemma: "בָּרָא",
    lemmaId: "H1254",
    grammar: "verbo Qal perfeito, terceira pessoa masculina singular",
    semanticRange: ["criar", "formar", "produzir"],
    contextualNote: "O verbo está no singular e tem Deus como sujeito.",
  },
  "genesis.1.1.3": {
    transliteration: "elohim",
    contextualTranslation: "Deus",
    lemma: "אֱלֹהִים",
    lemmaId: "H430",
    grammar: "substantivo masculino plural na forma; sujeito de verbo singular",
    semanticRange: ["Deus", "deuses", "seres divinos"],
    contextualNote: "Neste contexto, a concordância verbal singular determina a referência ao Deus de Israel.",
  },
  "genesis.1.1.4": {
    transliteration: "et",
    contextualTranslation: "não traduzido diretamente",
    lemma: "אֵת",
    lemmaId: "H853",
    grammar: "partícula marcadora de objeto direto definido",
    semanticRange: ["marcador gramatical"],
    contextualNote: "Sinaliza que ‘os céus’ são o primeiro objeto direto do verbo; normalmente não recebe palavra própria em português.",
  },
  "genesis.1.1.5": {
    transliteration: "hashamayim",
    contextualTranslation: "os céus",
    lemma: "שָׁמַיִם",
    lemmaId: "H8064",
    grammar: "artigo definido הַ + substantivo masculino plural absoluto",
    semanticRange: ["céus", "firmamento", "região celeste"],
    contextualNote: "Forma com artigo definido; integra a expressão abrangente ‘os céus e a terra’.",
  },
  "genesis.1.1.6": {
    transliteration: "ve'et",
    contextualTranslation: "e [marcador de objeto]",
    lemma: "וְ + אֵת",
    lemmaId: "H853",
    grammar: "conjunção וְ + partícula de objeto direto definido",
    semanticRange: ["e", "marcador gramatical"],
    contextualNote: "Liga o segundo objeto ao primeiro; a partícula אֵת em si não costuma ser traduzida.",
  },
  "genesis.1.1.7": {
    transliteration: "ha'aretz",
    contextualTranslation: "a terra",
    lemma: "אֶרֶץ",
    lemmaId: "H776",
    grammar: "artigo definido הָ + substantivo singular absoluto",
    semanticRange: ["terra", "território", "solo", "país"],
    contextualNote: "Em paralelo com ‘os céus’, designa a totalidade do mundo criado.",
  },
};

export function wordAnalysisFor(bookSlug: string, chapter: number, verse: number, position: number): WordAnalysis | null {
  return reviewed[`${bookSlug}.${chapter}.${verse}.${position}`] ?? null;
}
