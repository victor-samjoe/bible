# 01 — Arquitetura atual

Data da auditoria: 19/11/2026. Escopo: análise estática do repositório, arquivos de infraestrutura e pesquisa em documentação oficial. Não foram lidos segredos, acionados painéis, feitas consultas no banco, deploys ou testes de carga.

## Estado de evidência

**Comprovado no código** é marcado por arquivo:linha. **Declarado pela operação** vem de `AGENTS.md` (produção no Worker Cloudflare, Postgres Supabase em `sa-east-1`, sem Hyperdrive). **Estimativa** é modelagem sem telemetria. Há conflito histórico: `docs/CLOUDFLARE_INFRA.md` descreve Hyperdrive/R2 como plano, mas `wrangler.jsonc` não tem esses bindings e o `AGENTS.md` registra que Hyperdrive não é usado; para esta auditoria prevalece a configuração e o estado operacional mais recentes.

## Mapa

```text
PWA / navegador / futuro shell Capacitor
  ├─ assets Next -> Cloudflare CDN (/_next/static: immutable)
  ├─ páginas e API -> Worker `samjoe-estudos` (Next 15 + OpenNext)
  │   ├─ pg + Drizzle -> Supabase PostgreSQL (direct connection)
  │   │   ├─ corpus BLIVRE / originais / léxico
  │   │   └─ perfis e dados pessoais de leitura
  │   └─ fetch HTTPS -> Supabase Auth (GoTrue)
  │       └─ SMTP Supabase -> Amazon SES (fluxo de e-mail, fora do dado do app)
  └─ sessionStorage -> estado temporário de leitor não autenticado
```

## Componentes e responsabilidades

| Camada | Implementação comprovada | Observação |
|---|---|---|
| Web/híbrido | Next.js 15, React 19, TypeScript; PWA; configuração Capacitor | `package.json:20-29`, `app/manifest.ts`, `mobile/capacitor.config.json:1-4` |
| Hospedagem | Cloudflare Worker via `@opennextjs/cloudflare` | `wrangler.jsonc:3-25`; domínio configurado no arquivo |
| Backend | Server Components, Route Handlers e Server Actions | `app/api/**/route.ts`, `app/_actions/*.ts` |
| Dados | PostgreSQL Supabase, `pg` + Drizzle; nenhum `@supabase/supabase-js` | `src/server/db/client.ts:1-14`, `package.json` |
| Auth | Supabase Auth/GoTrue por REST manual, cookies HttpOnly | `src/server/auth/gotrue.ts:1-25`, `src/server/auth/runtime.ts` |
| E-mail | Supabase Auth com SMTP SES, declarado no `AGENTS.md` | Não foi inspecionada configuração remota |
| Cache | CDN para assets; React `cache()` apenas por renderização/requisição; `sessionStorage` | `public/_headers:1-2`, `app/biblia/[book]/[chapter]/page.tsx:37-46` |
| Storage/R2 | Não há binding R2, SDK Storage ou bucket usado pelo código | `wrangler.jsonc:31-33`; `rg` do repositório |
| Realtime/Edge Functions | Não encontrado | Sem dependência ou subscription Supabase; nenhum binding/function declarado |
| Jobs/cron/filas | Não encontrado em runtime | Scripts de importação são operacionais, não jobs publicados |
| LLM | Não há SDK, chamada a provedor nem embeddings no runtime | Busca atual é `ILIKE`, não semântica |

## Rotas e fluxos relevantes

* Leitura: página dinâmica busca capítulo e, em paralelo, catálogo/contagens; capítulo é deduplicado só dentro da mesma renderização. `app/biblia/[book]/[chapter]/page.tsx:29-46,120-137`.
* Busca: `GET /api/biblia/busca` recebe paginação/limite, consulta Postgres e devolve `no-store`. `app/api/biblia/busca/route.ts:14-42`.
* Originais e léxico: painel dispara dois `fetch` quando a seleção muda; ambos `no-store`. `app/biblia/original-panel.tsx:86-103`, `app/api/biblia/{original,lexico}/route.ts`.
* Login: OTP/magic link, refresh, `getUser` e logout chamam GoTrue por HTTPS sem cache. `src/server/auth/gotrue.ts:102-191`.
* Dados privados: Server Action resolve a identidade a partir do cookie, valida e grava sem receber `userId`. `app/_actions/reading.ts:1-29`, `src/server/reading/runtime.ts:39-101`.

## Banco e relações

O schema contém aproximadamente 52 tabelas declaradas. Núcleos: corpus (`translations → books → chapters → verses`), conta (`profiles`, leitura pessoal), editorial/estudos, billing, BKF, originais e léxico. As FKs e constraints estão nas migrations `drizzle/0000_initial.sql`, `0003`, `0004`, `0005`, `0006`, `0008`, `0009`; o inventário tipado está em `drizzle/schema.ts:10-766`.

Índices corretos para leitura de capítulo já existem em `drizzle/0002_blivre_query_indexes.sql:3-5`; dados pessoais têm índices por proprietário em `0003:24,35,45`; corpus original/léxico possui índices seletivos em `0005` e `0008`. A busca textual é deliberadamente uma varredura por `ILIKE` em 31.102 versículos (`src/server/bible/search-repository.ts:7-15`), portanto é aceitável só enquanto a frequência e a CPU permanecerem baixas.

## Segurança e privacidade

RLS está presente em `profiles`, pedidos de exclusão e tabelas pessoais (`0003:47-58`, `0006:34-125`). Porém o Worker conecta como papel com bypass de RLS, e a própria implementação reconhece que o isolamento efetivo depende dos filtros `user_id` no repositório (`src/server/reading/personal.ts:18-25`). Isto é seguro no fluxo atual, mas aumenta a criticidade de revisão de cada nova consulta privada. Dados pessoais e conteúdo premium não devem receber cache público.

## O que não foi possível comprovar

Não há acesso autorizado aos dashboards Supabase/Cloudflare nesta etapa; portanto não se conhecem tamanho real, `pg_stat_statements`, conexões, CPU, egress, cache hit, logs nem volume de objetos. Também não há prova estática de que todos os imports já foram aplicados, embora o estado operacional informado diga sete migrations aplicadas.
