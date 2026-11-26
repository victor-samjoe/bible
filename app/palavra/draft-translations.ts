import first from "../../data/word-study/gen1-lote-001.translations.json";
import second from "../../data/word-study/gen1-lote-002.translations.json";

type Draft = { readonly bdbId: string; readonly senses: readonly { readonly path: string; readonly original: string; readonly pt: string }[] };
const entries: Readonly<Record<string, Draft>> = { ...first.entries, ...second.entries };
const normalize = (text: string) => text.normalize("NFC").replace(/\s+/gu, " ").trim();

/** Só usa rascunho se verbete, caminho e texto original ainda coincidirem. */
export function draftSense(strong: string, bdbId: string, path: string, original: string): string | null {
  const entry = entries[`hbo:${strong}`];
  if (!entry || entry.bdbId !== bdbId) return null;
  const sense = entry.senses.find((item) => item.path === path);
  return sense && normalize(sense.original) === normalize(original) ? sense.pt : null;
}

export function hasDraftEntry(strong: string, bdbId: string): boolean {
  return entries[`hbo:${strong}`]?.bdbId === bdbId;
}
