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

/** Para rotas dinamicas e route handlers. */
export const getDatabase = cache((): Database | null => {
  const { env } = getCloudflareContext();
  const connectionString = resolveConnectionString(env as unknown as Record<string, unknown>);
  return connectionString ? buildDatabase(connectionString) : null;
});

/** Para rotas SSG/ISR, onde o contexto so existe em modo assincrono. */
export const getDatabaseAsync = cache(async (): Promise<Database | null> => {
  const { env } = await getCloudflareContext({ async: true });
  const connectionString = resolveConnectionString(env as unknown as Record<string, unknown>);
  return connectionString ? buildDatabase(connectionString) : null;
});
