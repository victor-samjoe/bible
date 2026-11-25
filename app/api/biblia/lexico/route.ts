import { getLexiconReader } from "@/src/server/lexicon/runtime";

const status = { invalid_query: 400, unavailable: 503, not_found: 404 } as const;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const verses = (params.get("verses") ?? "").split(",").filter(Boolean);
  const reader = await getLexiconReader();
  const result = await reader.read({
    book: params.get("book") ?? "",
    chapter: params.get("chapter") ?? "",
    verses,
  });
  return Response.json(result, {
    status: result.ok ? 200 : status[result.reason],
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
