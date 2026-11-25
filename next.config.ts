import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Falhar o build em erro real em vez de publicar codigo quebrado.
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  // Permite prévias locais paralelas sem dois processos disputarem o mesmo
  // cache `.next`. Sem a variável, produção e o fluxo normal não mudam.
  distDir: process.env.SAMJOE_NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;

// Expoe os bindings do Worker (HYPERDRIVE, R2, Durable Object) durante `next dev`.
// Precisa ficar restrito a desenvolvimento: durante o build ele sobe o runtime
// local e exige uma connection string local para o Hyperdrive, quebrando
// `opennextjs-cloudflare build`.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
