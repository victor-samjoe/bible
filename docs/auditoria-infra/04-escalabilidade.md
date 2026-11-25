# 04 — Escalabilidade e plano de testes

## Leitura correta dos cenários

DAU não é MAU, usuários cadastrados nem simultâneos. A tabela abaixo usa os modelos de egress do relatório 03 e **não declara capacidade garantida**. RPS de pico depende de sessão/duração e de cache. Sem métricas, estimar capacidade de conexão seria ficção.

| DAU | Requests/dia leve/moderado/intenso* | Requests/mês | egress moderado | banco/storage incremental** | risco principal |
|---:|---:|---:|---:|---|---|
|100|450 / 1.300 / 3.900|13,5k–117k|0,79 GB|baixo / ~50 MB mês|cache ainda não crítico, abuse OTP|
|500|2.250 / 6.500 / 19.500|67,5k–585k|3,93 GB|~0,25 GB/mês|franquia e busca|
|1k|4.500 / 13k / 39k|135k–1,17M|7,86 GB|~0,5 GB/mês|egress Free e conexões|
|5k|22,5k / 65k / 195k|675k–5,85M|39,3 GB|~2,5 GB/mês|cache/CPU/banco|
|10k|45k / 130k / 390k|1,35M–11,7M|78,6 GB|~5 GB/mês|mesmo; plano pago|
|50k|225k / 650k / 1,95M|6,75M–58,5M|393 GB|~25 GB/mês|arquitetura de conteúdo|

\*Modelo de requests: 4,5 / 13 / 39 por usuário/dia, incluindo navegação, API e ações; estimativa. **Crescimento supõe 5% dos DAU criando 10 KB/dia de dados pessoais + índices/overhead, não conteúdo editorial; Storage Supabase é zero no código atual.

Picos de 50/100/300/500/1.000 simultâneos devem ser testados, não prometidos. Se cada pessoa gerar uma navegação a cada 15 s, são 3,3/6,7/20/33/67 RPS. Cache hit de 90% reduziria as chegadas ao Postgres a 0,33/0,67/2/3,3/6,7 RPS, mas não reduz os requests ao Worker. A conexão direta por requisição torna especialmente arriscados os picos sem pool.

## Gargalos prováveis, em ordem

1. Egress de corpus público sem cache.
2. Limite de 500 MB/CPU compartilhada no Nano Free e busca `ILIKE` (limites oficiais: [Supabase pricing](https://supabase.com/pricing)).
3. Conexões transitórias Worker → direct Postgres (`src/server/db/client.ts:9-13`).
4. Carga integral de marcas e shards lexicais em usuários intensos.
5. Storage/LLM só se forem introduzidos; não são gargalo atual comprovado.

## Plano reproduzível (não executado)

Preparar staging isolado, dados sintéticos e uma conta de teste. Nunca usar produção sem autorização.

| Caso | Mix | VUs / duração | Critério inicial |
|---|---|---|---|
| navegação pública | 70% capítulo, 20% catálogo/progresso, 10% busca | ramp 10→50→100, 10 min por patamar | p95 <800 ms cache hit, <1,5 s miss; erro <1% |
| busca | queries curtas, comuns e sem resultado; offsets | 10→50 VUs, 15 min | p95 <1,5 s, sem CPU sustentada >70% |
| autenticado | ler, carregar marcas, editar após debounce | 10→50 VUs, 15 min | p95 <1,5 s, zero vazamento entre contas |
| pico | mix anterior, 50/100/300/500/1.000 | 5 min cada após sucesso anterior | conexões abaixo do limite; erro <2% |

Usar k6: tags por endpoint e `Trend` de duração/bytes, checks de status e corpo; exportar `http_req_duration` p50/p95/p99, `http_req_failed`, RPS, bytes recebidos/enviados. No Supabase observar CPU, memória, conexões, DB egress e Query Performance; no Cloudflare observar requests, Worker CPU, subrequests, cache hit e erros. Ajustar os limites após baseline do staging, nunca a partir desta planilha.

## LLM/RAG futuro

Postgres permite pgvector, FTS e RLS, mas nada disso está instalado/modelado. Para RAG: separar documentos licenciados, chunks imutáveis, embeddings versionados, metadados de fonte/licença e índice vetorial; guardar histórico por `user_id`, quotas de token/requisição, orçamento diário e logs redigidos. Execute extração/embedding em fila assíncrona, não na requisição Worker. Provedor LLM deve ficar atrás de serviço próprio com allowlist, timeout, rate limit e controle de custo. O preço de tokens é independente de banco/egress e é impossível projetá-lo antes de modelo, contexto, taxa de uso e política de retenção.

O modelo atual de licença/proveniência ajuda RAG auditável (`drizzle/0005_original_languages.sql`, BKF), mas o uso de conta privilegiada e falta de fila/cache impedem introdução direta sem desenho adicional.
