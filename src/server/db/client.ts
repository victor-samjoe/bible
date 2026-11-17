import { cache } from "react";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "@/drizzle/schema";

export type Database = ReturnType<typeof buildDatabase>;

function buildDatabase(connectionString: string) {
  // Um cliente por requisicao: o Worker nao mantem pool entre invocacoes.
  const pool = new Pool({ connectionString, maxUses: 1 });
  return drizzle(pool, { schema });
}

/**
 * Connection string do Hyperdrive no Worker; DATABASE_URL fora dele
 * (migrations, testes, scripts locais). Retorna null quando nada
 * esta configurado, para o chamador degradar sem lancar excecao.
 */
function resolveConnectionString(env: Record<string, unknown> | undefined): string | null {
  const hyperdrive = env?.HYPERDRIVE as { connectionString?: string } | undefined;
  const fromBinding = hyperdrive?.connectionString?.trim();
  if (fromBinding) return fromBinding;
  const fromEnvironment = process.env.DATABASE_URL?.trim();
  return fromEnvironment ? fromEnvironment : null;
}

/**
 * Fora do Worker (next build, next start, scripts, testes) nao existe contexto
 * Cloudflare e getCloudflareContext lanca. Isso nao e erro: e o caso em que a
 * connection string vem de DATABASE_URL. Engolir a excecao aqui mantem o
 * fallback documentado acima funcionando em vez de derrubar a rota.
 */
function cloudflareEnv(): Record<string, unknown> | undefined {
  try {
    const { env } = getCloudflareContext();
    return env as unknown as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

async function cloudflareEnvAsync(): Promise<Record<string, unknown> | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as unknown as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** Para rotas dinamicas e route handlers. */
export const getDatabase = cache((): Database | null => {
  const connectionString = resolveConnectionString(cloudflareEnv());
  return connectionString ? buildDatabase(connectionString) : null;
});

/** Para rotas SSG/ISR, onde o contexto so existe em modo assincrono. */
export const getDatabaseAsync = cache(async (): Promise<Database | null> => {
  const connectionString = resolveConnectionString(await cloudflareEnvAsync());
  return connectionString ? buildDatabase(connectionString) : null;
});
