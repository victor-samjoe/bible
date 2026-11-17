import { getDatabaseAsync } from "../db/client";
import { BLIVRE_TRANSLATION_ID } from "./blivre";
import { createDrizzleBibleRepository } from "./repository";
import { createBibleReader, type BibleReader } from "./reader";
import { createBibleSearch, type BibleSearch } from "./search";
import { createDrizzleBibleSearchRepository } from "./search-repository";

/**
 * Fiação do leitor com o banco. Único ponto que toca infraestrutura.
 *
 * Sem `HYPERDRIVE` no Worker e sem `DATABASE_URL` fora dele, `getDatabaseAsync`
 * devolve `null` e o leitor retornado responde `unavailable` a tudo — nada de
 * exceção vazando para a página e nada de segredo em mensagem de erro.
 *
 * Hoje nenhuma rota chama esta função: a tarefa C4 liga o leitor ao corpus depois
 * da confirmação de 66/1189/31102 no banco.
 */
export async function getBlivreReader(): Promise<BibleReader> {
  const database = await getDatabaseAsync();
  return createBibleReader(
    BLIVRE_TRANSLATION_ID,
    database ? createDrizzleBibleRepository(database) : null,
  );
}

/**
 * Busca no corpus (tarefa C9). Mesma fiação e mesma falha fechada do leitor: sem
 * banco configurado, responde `unavailable` em vez de lançar.
 */
export async function getBlivreSearch(): Promise<BibleSearch> {
  const database = await getDatabaseAsync();
  return createBibleSearch(
    BLIVRE_TRANSLATION_ID,
    database ? createDrizzleBibleSearchRepository(database) : null,
  );
}
