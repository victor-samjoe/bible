/**
 * Vocabulário das preferências de leitura. Funções puras: nenhum acesso a
 * React, banco, rede ou `window`.
 *
 * Este módulo existe porque as preferências atravessam três fronteiras — o
 * leitor no navegador, o Server Action e o banco — e as três precisam julgar o
 * mesmo valor com a mesma régua. Enquanto os validadores viviam dentro de
 * `app/biblia/reader-state.tsx`, que é `"use client"`, o servidor não podia
 * usá-los sem arrastar React para dentro dele, e a tentação era reescrever a
 * validação do lado de lá — duas réguas que divergem na primeira opção nova.
 *
 * O que o leitor manda **nunca** é confiável: é JSON que veio de um navegador.
 * Toda entrada passa por `sanitizeReaderPreferences`, que devolve um valor
 * válido em vez de lançar, porque preferência inválida é motivo para usar o
 * padrão, não para derrubar a página de quem está lendo.
 */

export type ReaderTheme = "dark" | "light";
export type FontFamily = "serif" | "sans" | "literaria" | "humana" | "monospace";
export type FontSize = "muito-pequeno" | "menor" | "pequeno" | "medio" | "grande";
export type Spacing = "continuo" | "compacto" | "padrao" | "amplo";
export type ParagraphSpacing = "junto" | "padrao" | "separado";

export type ReaderPreferences = {
  fontFamily: FontFamily;
  fontSize: FontSize;
  spacing: Spacing;
  paragraphSpacing: ParagraphSpacing;
};

export const readerThemes: readonly ReaderTheme[] = ["dark", "light"];
export const fontFamilies: readonly FontFamily[] = ["serif", "sans", "literaria", "humana", "monospace"];
export const fontSizes: readonly FontSize[] = ["muito-pequeno", "menor", "pequeno", "medio", "grande"];
export const spacings: readonly Spacing[] = ["continuo", "compacto", "padrao", "amplo"];
export const paragraphSpacings: readonly ParagraphSpacing[] = ["junto", "padrao", "separado"];

export const defaultPreferences: ReaderPreferences = {
  fontFamily: "serif",
  fontSize: "medio",
  spacing: "padrao",
  paragraphSpacing: "padrao",
};

export const defaultTheme: ReaderTheme = "dark";

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

export function isReaderTheme(value: unknown): value is ReaderTheme {
  return isOneOf(readerThemes, value);
}

export function isFontFamily(value: unknown): value is FontFamily {
  return isOneOf(fontFamilies, value);
}

export function isFontSize(value: unknown): value is FontSize {
  return isOneOf(fontSizes, value);
}

export function isSpacing(value: unknown): value is Spacing {
  return isOneOf(spacings, value);
}

export function isParagraphSpacing(value: unknown): value is ParagraphSpacing {
  return isOneOf(paragraphSpacings, value);
}

/** Campo inválido ou ausente vira o padrão; nunca lança. */
export function sanitizeReaderPreferences(value: unknown): ReaderPreferences {
  const source = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return {
    fontFamily: isFontFamily(source.fontFamily) ? source.fontFamily : defaultPreferences.fontFamily,
    fontSize: isFontSize(source.fontSize) ? source.fontSize : defaultPreferences.fontSize,
    spacing: isSpacing(source.spacing) ? source.spacing : defaultPreferences.spacing,
    paragraphSpacing: isParagraphSpacing(source.paragraphSpacing)
      ? source.paragraphSpacing
      : defaultPreferences.paragraphSpacing,
  };
}

export function sanitizeReaderTheme(value: unknown): ReaderTheme {
  return isReaderTheme(value) ? value : defaultTheme;
}
