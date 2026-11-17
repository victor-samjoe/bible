# Infraestrutura definitiva — Cloudflare

Hospedagem permanente da aplicação web em **Cloudflare Workers**, com o adapter
`@opennextjs/cloudflare`. Não há túnel: a aplicação roda na borda da Cloudflare,
sem depender de nenhuma máquina do operador ligada.

Esta é a decisão de infraestrutura; substitui a preparação de Cloudflare Tunnel
registrada em 2026-11-17.

## Decisões e por quê

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Hospedagem | Cloudflare Workers via `@opennextjs/cloudflare` | Roda Next.js real, inclusive rotas de servidor e auth. Alinhado ao §12 do SPEC (Pages/Workers ou Vercel). |
| Assets estáticos | Workers Assets (`.open-next/assets`) | Servidos pela CDN, sem custo de invocação. |
| Banco | Supabase Postgres | Banco canônico já definido no SPEC; Supabase Pro já contratado. |
| Pool de conexões | Cloudflare Hyperdrive | Workers abrem conexão por invocação; sem pool o Postgres esgota conexões. |
| Driver | `pg` (node-postgres) + `drizzle-orm/node-postgres` | Driver recomendado pela Cloudflare para Hyperdrive, com melhor compatibilidade de cache de prepared statements. |
| Cache ISR/SSG | R2 (`NEXT_INC_CACHE_R2_BUCKET`) | Recomendação do OpenNext; KV é eventualmente consistente. |
| Fila de revalidação | Durable Object (`NEXT_CACHE_DO_QUEUE`) | Deduplica revalidação por tempo. |
| CI/CD | GitHub Actions (`.github/workflows/deploy.yml`) | lint + typecheck + test + build antes de qualquer deploy. |

### O que foi deliberadamente deixado de fora

- **`vinext`**: a Cloudflare hoje o apresenta como caminho padrão, mas a própria
  documentação o marca como **beta** e ele *reimplementa* a API do Next.js em
  vez de executá-la. Para uma aplicação com autenticação de servidor e
  entitlement premium, o risco não se justifica agora. Reavaliar quando sair do beta.
- **`@cloudflare/next-on-pages`**: caminho antigo via Pages; a documentação do
  OpenNext orienta removê-lo em migrações.
- **Export estático + Pages**: quebraria autorização premium no servidor.
- **Tag cache D1** (`revalidateTag` / `revalidatePath`): só é necessário com
  revalidação sob demanda, que o código ainda não usa. Quando for preciso, criar
  um D1, adicionar o binding `NEXT_TAG_CACHE_D1`, criar a tabela `revalidations`
  e habilitar `tagCache: d1NextTagCache` em `open-next.config.ts`.

## Arquivos de infraestrutura

| Arquivo | Função |
| --- | --- |
| `wrangler.jsonc` | Worker, bindings, flags de compatibilidade |
| `open-next.config.ts` | Overrides de cache do adapter |
| `next.config.ts` | `initOpenNextCloudflareForDev()` para expor bindings em `next dev` |
| `public/_headers` | `Cache-Control` imutável para `/_next/static/*` |
| `src/server/db/client.ts` | Cliente Drizzle por requisição, via binding Hyperdrive |
| `drizzle.config.ts` | Migrations via Direct connection (fora do Worker) |
| `.github/workflows/deploy.yml` | Verificação e deploy |

## Provisionamento — executar uma vez

Pré-requisito: `npm ci` concluído na raiz.

### 1. Autenticar

```powershell
npx wrangler login
npx wrangler whoami
```

### 2. Bucket R2 para o cache incremental

O nome precisa bater com `bucket_name` em `wrangler.jsonc`.

```powershell
npx wrangler r2 bucket create samjoe-estudos-cache
```

### 3. Hyperdrive para o Postgres do Supabase

No Supabase: **Project Settings → Database → Connection string → Direct
connection**. Use a *Direct connection*, não as strings do pooler (Supavisor):
o Hyperdrive já faz o pooling, e a documentação da Cloudflare orienta
explicitamente a não empilhar os dois.

Recomendado: criar um papel dedicado no SQL Editor do Supabase, em vez de usar
`postgres`, e conceder apenas os privilégios necessários ao schema da aplicação.

```powershell
npx wrangler hyperdrive create samjoe-estudos-db --connection-string="postgres://USUARIO:SENHA@HOST:PORTA/postgres"
```

O comando testa as credenciais antes de criar. Copie o `id` retornado para
`wrangler.jsonc`, no lugar de `REPLACE_WITH_HYPERDRIVE_ID`. **O deploy falha
enquanto esse placeholder existir.**

Depois:

```powershell
npm run cf-typegen
```

> Verificar no painel: a Direct connection do Supabase pode exigir o add-on de
> IPv4 em alguns projetos, e o Hyperdrive pode exigir plano pago do Workers. Se
> o `hyperdrive create` falhar na validação de credenciais, é aqui que o problema
> está — não no código.

### 4. Migrations

Rodam de fora do Worker, com `DATABASE_URL` apontando para a Direct connection:

```powershell
npm run db:migrate
```

### 5. Segredos de produção

Nunca em `.env`; o `.env.local` não é lido pelo Worker.

```powershell
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put BILLING_API_KEY
npx wrangler secret put BILLING_WEBHOOK_SECRET
```

Valores não sensíveis e públicos podem ir em `vars` no `wrangler.jsonc`.

### 6. Primeiro deploy

```powershell
npm run preview   # executa localmente no runtime do Workers
npm run deploy    # publica
```

### 7. Domínio

Adicionar o domínio à Cloudflare (nameservers apontados) e, em
**Workers & Pages → samjoe-estudos → Settings → Domains & Routes**, associar o
hostname definitivo. O `*.workers.dev` serve para teste, não como endereço do
produto. Um domínio próprio (zone) também é pré-requisito para purge de cache
sob demanda.

### 8. CI/CD

Em **Settings → Secrets and variables → Actions**, definir:

- `CLOUDFLARE_API_TOKEN` — token com permissão de editar Workers
- `CLOUDFLARE_ACCOUNT_ID`

A partir daí, `push` em `main` publica após lint, typecheck, testes e build.

## Operação

```powershell
npm run dev                  # desenvolvimento (bindings disponíveis)
npm run preview              # runtime real do Workers, local
npm run deploy               # build + publicação
npx wrangler tail            # logs em tempo real
npx wrangler deployments list
npx wrangler rollback        # volta ao deploy anterior
```

`observability` está habilitado no `wrangler.jsonc`, então os logs ficam
disponíveis no painel sem configuração extra.

## Aplicativo móvel

A aplicação já é PWA (`app/manifest.ts`, `public/sw.js`, `app/offline`). Com o
deploy em HTTPS num domínio próprio, ela se torna instalável em Android e iOS
pelo navegador, sem loja.

O empacotamento nativo com Capacitor (`mobile/`) permanece bloqueado por uma
razão de arquitetura, não de infraestrutura: o Capacitor espera um bundle
estático, e a autorização premium depende de execução no servidor. O caminho
compatível é um shell nativo que carregue a aplicação publicada, decidido
separadamente. Ver `docs/MOBILE_RELEASE.md` e `docs/APK_BLOCKER.md`.

## Estado

Configuração escrita e dependências instaladas. Nenhum recurso da Cloudflare foi
criado e nenhum deploy foi feito: isso exige autenticação na conta, o que não
ocorreu aqui. Os passos 1 a 8 acima ainda não foram executados.
