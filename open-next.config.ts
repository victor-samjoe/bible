import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Sem cache incremental ou bindings de banco até a integração Supabase estar
// concluída; evita que conteúdo autenticado/premium seja persistido na borda.
export default defineCloudflareConfig({});
