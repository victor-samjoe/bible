import ketivIndex from "../../../data/generated/transliteration/morphhb-ketiv.json";

const ketivReferences = new Set(ketivIndex.references);
const qereReferences = new Set(ketivIndex.qereReferences);

/** Falha fechado se a edição não corresponde ao índice de variantes auditado. */
export function hebrewVariantWarning(editionCode: string, version: string, reference: string, position: number): string | null {
  if (editionCode !== ketivIndex.edition || !version.includes(ketivIndex.sourceCommit)) {
    return "Edição hebraica ainda não conferida para variantes ketiv/qere.";
  }
  const key = `${reference}!${position}`;
  if (ketivReferences.has(key)) return "Esta forma está marcada como ketiv; a transliteração aguarda revisão da leitura qere.";
  if (qereReferences.has(key)) return "Esta é uma leitura qere alternativa; a apresentação da variante aguarda revisão.";
  return null;
}
