# 02 — Auditoria Supabase

## Resultado

O Supabase é usado como **Postgres canônico e Auth**, não como Data API, Storage, Realtime ou Edge Functions. Isso reduz diretamente o egress de API/Storage do Supabase, mas desloca todo tráfego do corpus para a conexão Worker → Postgres e torna cache de resposta uma responsabilidade do app/Cloudflare.

## PostgreSQL

### Consultas e índices

| Operação | Evidência | Avaliação |
|---|---|---|
| Capítulo | `repository.ts:94-106` projeta só `id, number, content`, filtra capítulo/publicado e ordena | Boa projeção e índice `(chapter_id,number)` existente. Três round trips precedem a leitura (`findTranslation`, `findBook`, `findChapter`), mais o select de versos. |
| Navegação | `repository.ts:31-44,85-92` | Retorna 66 livros e 66 contagens; pequeno, mas é repetido em cada página dinâmica. |
| Busca | `search-repository.ts:84-101` | `ILIKE '%termo%'` + `count(*)`; potencial full scan duas vezes por busca. Pagina resultado, não pagina o trabalho de contagem. |
| Pessoais | `reading/personal.ts:129-202` | Projeções explícitas, `user_id` e teto 4.000; três consultas de carga. Não há N+1. |
| Sincronização | `reading/personal.ts:205-258` | Transação substitui todos os destaques/notas do capítulo: deletes + inserts, eficiente para lote pequeno, amplifica escrita se o usuário editar muito. |
| Léxico | `lexicon/repository.ts:35-64` | Uma consulta por capítulo/língua em paralelo e transfere JSON shard completo; risco de payload e de N consultas para seleção multi-capítulo. |

Não foi encontrado `select('*')` nas rotas de leitura, nem RPC. Há um `select()` sem projeção em `src/server/bkf/repository.ts:52`, mas é backoffice e não há rota pública que o use nesta auditoria. Não há evidência de polling ou N+1 de versos.

### Riscos e recomendações

* **P1 — busca sem índice textual.** Evidência e reconhecimento explícito no comentário de `src/server/bible/search-repository.ts:7-15`. Medir primeiro `p95`, scans e CPU; se necessário, criar `tsvector` (melhor para português) ou `pg_trgm` para substring. Não aplicar nesta etapa.
* **P1 — quatro consultas por capítulo e catálogo em cada render dinâmica.** `app/biblia/[book]/[chapter]/page.tsx:37-46`. Fundir resolução em uma query/RPC interna ou, preferivelmente, cachear o conteúdo público versionado na borda. Economia depende de navegação, mas corta consultas e bytes repetidos.
* **P2 — carga integral de marcas.** `MAX_MARKS=4000`, `src/server/reading/personal.ts:29,156-184`. Em usuário no limite, notas de até 10.000 caracteres podem formar payload grande. Trocar, quando necessário, por escopo de capítulo/paginação e cache local persistente criptograficamente não sensível.
* **P2 — conexão por requisição.** `new Pool({maxUses:1})` em `src/server/db/client.ts:9-13`; o estado de produção diz direct connection sem Hyperdrive. Sob concorrência, cada Worker pode abrir conexão transitória, risco de exaurir slots e TLS/latência. Avaliar Supavisor transaction pooler ou Hyperdrive antes de aumentar tráfego, com benchmark.

## Auth

O fluxo OTP/cadastro chama `/otp`; verificação `/verify`; a sessão chama `/user`; refresh chama `/token`; logout chama `/logout` (`src/server/auth/gotrue.ts:124-191`). `getAccountSession` é memoizado por renderização (`runtime.ts:257`), mas páginas autenticadas podem fazer validação remota e consulta de perfil, além de carregamento pessoal. Não existe listener browser, `supabase-js`, auto-refresh client nem duplicação por render React comprovada.

O limitador OTP é por isolate e memória, não global (`src/server/auth/rate-limit.ts:7-15`): é proteção insuficiente contra abuso distribuído, embora o teto do Auth contenha custo. P0 para lançamento: rate limiting distribuído/Turnstile no início de OTP, sem logar e-mails em claro.

Auth pode permanecer no Supabase mesmo se o corpus público for distribuído fora do Postgres: cookies continuam no Worker e dados privados continuam por Postgres. Essa separação é a alternativa de menor risco.

## RLS

RLS e políticas por dono existem nas migrations, mas a conexão privilegiada do Worker ignora RLS (`src/server/reading/personal.ts:18-25`). O código impõe `eq(userId)` e `getViewer`; não há exposição atual pelo browser. P1: usar papel de aplicação de mínimo privilégio, revisar todas as consultas privadas e testar isolamento com duas contas antes de novas features. Não é recomendação de expor diretamente o Data API.

## Storage, Realtime e Edge Functions

Nenhum SDK/endpoint/bucket Storage, assinatura URL, Realtime subscription, Edge Function ou cron foi encontrado no código ou `wrangler.jsonc`. Logo não há egress de Storage Supabase comprovado nem custo de conexão Realtime atual. `storage_locator` nos registros BKF é metadado, não prova de upload/download em runtime.

## Medições seguras pendentes

No Dashboard Supabase: Usage → egress/database size; Reports/Query Performance para consultas lentas; Database → Metrics para CPU, memória/conexões; Logs para erros. Para planos, primeiro use Query Performance; só em staging rode `EXPLAIN (ANALYZE, BUFFERS)` com parâmetros representativos. A documentação exige proteção antes de expor `explain()` em produção: [Supabase query plans](https://supabase.com/docs/guides/api/query-plans).
