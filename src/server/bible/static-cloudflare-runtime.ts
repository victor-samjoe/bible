import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createStaticCloudflareReader } from "./static-cloudflare";

/** Preparação para o Worker; ainda não substitui o leitor em produção. */
export async function getStaticCloudflareBibleReader() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const assets = (env as unknown as { ASSETS?: { fetch: (request: Request) => Promise<Response> } }).ASSETS;
    if (!assets || typeof assets.fetch !== "function") return null;
    return createStaticCloudflareReader((path) => assets.fetch(new Request(`https://assets.internal${path}`)));
  } catch { return null; }
}
