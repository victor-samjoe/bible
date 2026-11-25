# 03 — Diagnóstico de egress

## Limite confirmado e definição

Em 19/11/2026, o Supabase Free inclui **5 GB de egress não cacheado e 5 GB cacheado**, com quotas separadas; egress é uma quota unificada por organização entre serviços. A documentação define cacheado como hit de CDN (tipicamente Smart CDN/Storage), não cache local no navegador nem memoização React. [Pricing Supabase](https://supabase.com/pricing), [gestão de egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress). Não se deve confundir isso com 500 MB de banco, número de requests, CPU ou usuários.

No desenho atual, o conteúdo vem de Postgres via Worker; não há Smart CDN Supabase no caminho. Portanto, todo byte que eventualmente sair do Supabase para o Worker deve ser tratado como **não cacheado**, salvo medição que prove classificação diferente. O cache Cloudflare pode reduzir requisições ao Worker/Postgres, mas não transforma retroativamente bytes de banco em "cached egress Supabase".

## Fluxos encontrados

| Funcionalidade | Origem | Frequência estimada | Payload estimado* | Cache atual | Risco |
|---|---|---:|---:|---|---|
| capítulo BLIVRE | página `app/biblia/[book]/[chapter]/page.tsx:37-46` | 1 por troca de capítulo | 8–25 KB compressível | não: página dinâmica | Alto, principal volume |
| catálogo/contagens | mesmo arquivo:44-46 | 1 por página de capítulo | 8–20 KB | não | Médio; repetido |
| busca | `api/biblia/busca/route.ts:14-42` | por pesquisa/página | 2–20 KB | `no-store` | Médio; CPU + bytes |
| original e léxico | `original-panel.tsx:86-103` | 2 por mudança de seleção | 5–150 KB, depende do shard | `no-store` | Alto quando habilitado |
| leitura pessoal | `reading/runtime.ts:39-62` | entrada/capítulo autenticado | 1 KB a dezenas de MB no teto | sem cache cross-request | Alto para heavy user |
| Auth | `auth/gotrue.ts:124-191` | login/refresh/visita autenticada | <10 KB típico | `no-store` corretamente | Baixo em bytes; segurança/abuso |
| Storage/Realtime/Functions | — | 0 comprovado | 0 | — | Nenhum uso atual |

\*Estimativas conservadoras de resposta JSON antes de compressão; precisam ser substituídas por `Content-Length`/logs. Egress mensal: `Σ(chamadas_i × bytes_transferidos_i)`, não tamanho do banco. Some overhead TLS/headers e respostas de erro; aplique taxa de hit somente depois de observada.

## Cenário de egress modelado

Hipóteses transparentes por DAU/dia: leve = 3 capítulos + 1 catálogo de 12 KB + 0,5 busca de 8 KB => **72 KB/dia**; moderado = 10 capítulos + catálogo 12 KB + 2 buscas 10 KB + 1 painel 30 KB => **262 KB/dia**; intenso = 25 capítulos + 25 KB extras de catálogo/prefetch + 8 buscas 15 KB + 4 painéis 75 KB + pessoais 40 KB => **1,11 MB/dia**. Mês de 30 dias; 1 GB decimal. Isto é modelo, não telemetria.

| DAU | Leve GB/mês | Moderado GB/mês | Intenso GB/mês | Leitura contra Free 5 GB não cacheados |
|---:|---:|---:|---:|---|
| 100 | 0,22 | 0,79 | 3,33 | intenso ainda próximo do limite |
| 500 | 1,08 | 3,93 | 16,65 | moderado cabe; intenso não |
| 1.000 | 2,16 | 7,86 | 33,30 | moderado excede |
| 5.000 | 10,80 | 39,30 | 166,50 | excede sem cache |
| 10.000 | 21,60 | 78,60 | 333,00 | excede sem cache |
| 50.000 | 108,00 | 393,00 | 1.665,00 | excede muito |

Com **90% de hit real na borda antes do banco** para conteúdo público imutável, só 10% desse volume chega ao Supabase: 1.000 DAU moderados cai de 7,86 para 0,79 GB/mês. Isto demonstra por que o cache é prioritário, mas não deve ser assumido até medir `CF-Cache-Status`, requests ao Worker e egress Supabase.

## Achados

1. **P1: capítulos públicos dinâmicos e não cacheados.** `dynamic = force-dynamic` em `app/biblia/[book]/[chapter]/page.tsx:29`; há apenas cache React intrarender. Versionar conteúdo publicado e dar `Cache-Control: public, s-maxage, stale-while-revalidate` em rota pública sem cookie, ou materializar JSON versionado em R2/Assets. Não cachear a página que contém dados pessoais.
2. **P1: endpoints de busca/original/léxico usam `no-store`.** `api/biblia/busca/route.ts:37-38`, `original/route.ts:10`, `lexico/route.ts:16`. Busca pode ter TTL curto com chave normalizada; corpus publicado/original pode ter ETag/versionamento. Validar licenças e não incluir identidade.
3. **P2: prefetch de capítulo vizinho.** `chapter-quick-navigation.tsx:14-16`; útil para UX, mas aumenta páginas/bytes se a pessoa não avançar. Fazer prefetch em hover/idle/Wi-Fi ou após instrumentar taxa de consumo.
4. **P2: shard léxico inteiro por capítulo.** `src/server/lexicon/repository.ts:35-64`; medir p95 de `payload`; considerar fragmento por verso, compressão/JSON pré-gerado e cache por versão.
5. **P2: notas completas em toda carga.** `src/server/reading/personal.ts:156-184`; paginar/por capítulo acima de limiar e não transferir corpo de nota fora da tela.

## Como medir sem risco

1. Registrar no Worker somente rota, status, duração, bytes de resposta e `CF-Cache-Status`; nunca URL completa, cookie, e-mail, texto bíblico pesquisado ou notas.
2. No Dashboard Supabase, comparar Usage → Database Egress e Shared Pooler Egress por período; a nomenclatura é documentada em [Manage egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress).
3. Coletar `Content-Length`/compression no navegador e amostra de respostas por rota. Medir cold/hit e autenticação separadamente.
4. Consolidar diariamente `egress acumulado / dias do ciclo` e projetar para o fim do ciclo; alertar 50/70/85/95% de 5 GB.
