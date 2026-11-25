import { getOriginalReader } from "@/src/server/originals/runtime";

const status = { invalid_query: 400, unavailable: 503, edition_unavailable: 404, not_found: 404, invalid_data: 502 } as const;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const verses = (params.get("verses") ?? "").split(",").filter(Boolean);
  const reader = await getOriginalReader();
  const result = await reader.read({ book: params.get("book") ?? "", chapter: params.get("chapter") ?? "", verses });
  return Response.json(result, { status: result.ok ? 200 : status[result.reason], headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
