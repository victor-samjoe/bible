import { defineConfig } from "drizzle-kit";

// Migrations rodam fora do Worker e usam a Direct connection do Supabase.
// Hyperdrive serve ao runtime, nao ao drizzle-kit.
export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
