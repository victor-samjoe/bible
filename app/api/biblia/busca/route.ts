import { getBlivreSearch } from "@/src/server/bible/runtime";
import type { SearchFailureReason } from "@/src/server/bible";

/**
 * Busca no corpus BLIVRE (tarefa C9). Somente leitura.
 *
 * GET /api/biblia/busca?q=<texto ou referência>&book=<slug>&limit=&offset=
 *
 * - não aceita parâmetro de tradução: a busca é sempre na tradução aprovada, para
 *   que este endpoint não possa ser apontado a texto sem licença;
 * - devolve apenas versículo publicado, com limite e paginação sempre aplicados;
 * - falha fechada: erro de banco vira 503 com um código, sem mensagem interna.
 */
export const dynamic = "force-dynamic";

const status: Record<SearchFailureReason, number> = {
  invalid_query: 400,
  unavailable: 503,
  translation_unavailable: 503,
  invalid_data: 502,
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const search = await getBlivreSearch();

  const result = await search.search({
    q: params.get("q") ?? "",
    ...(params.get("book") ? { book: params.get("book") as string } : {}),
    ...(params.get("limit") ? { limit: params.get("limit") as string } : {}),
    ...(params.get("offset") ? { offset: params.get("offset") as string } : {}),
  });

  return Response.json(result, {
    status: result.ok ? 200 : status[result.reason],
    headers: {
      // Resultado depende do corpus publicado no banco; nada de cache intermediário.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
