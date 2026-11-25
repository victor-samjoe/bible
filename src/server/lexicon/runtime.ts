import { getDatabaseAsync } from "../db/client";
import { createLexiconReader } from "./reader";
import { createDrizzleLexiconRepository } from "./repository";

/**
 * A pré-visualização de rascunho é decidida **no servidor**, por
 * `LEXICON_PREVIEW_DRAFTS`. Não é parâmetro de consulta: se fosse, qualquer
 * visitante veria texto não revisado trocando a URL, e o aviso de revisão
 * pendente deixaria de valer para quem importa.
 */
function previewDrafts(env: Record<string, unknown> | undefined): boolean {
  const fromBinding = env?.LEXICON_PREVIEW_DRAFTS;
  const value = typeof fromBinding === "string" ? fromBinding : process.env.LEXICON_PREVIEW_DRAFTS;
  return value?.trim().toLowerCase() === "true";
}

export async function getLexiconReader() {
  const database = await getDatabaseAsync();
  return createLexiconReader(
    database ? createDrizzleLexiconRepository(database) : null,
    { previewDrafts: previewDrafts(undefined) },
  );
}
