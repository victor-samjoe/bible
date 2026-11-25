# 06 — Roadmap de otimização

| Prioridade | Problema/evidência | Solução proposta | Benefício | Esforço / risco | Economia potencial |
|---|---|---|---|---|---|
| P0 | OTP rate limit por isolate (`auth/rate-limit.ts:7-15`) | Rate limiter compartilhado + Turnstile antes de enviar OTP; métricas redigidas | reduz abuso/custo SES/Auth | médio / UX | não quantificável sem ataque |
| P0 | Ausência de telemetria de egress/cache comprovada | dashboard, alertas e logs mínimos por rota/bytes, sem PII | torna decisões e orçamento verificáveis | baixo / baixo | evita surpresa, não bytes diretamente |
| P1 | corpus público dinâmico (`page.tsx:29`) | separar resposta pública versionada; CDN/Cache-Control/ETag; invalidar por versão | reduz DB/egress/latência | médio / risco de invalidação | 70–95% de leituras públicas, hipótese |
| P1 | conexão direta por invocação (`db/client.ts:9-13`) | benchmark de pooler/Hyperdrive e papel mínimo; escolher um, não empilhar poolers | evita saturação/conexões | médio / credenciais | indireta |
| P1 | `ILIKE` + count por busca | medir; depois FTS/trigram e limite/rate limit | CPU/latência estáveis | médio / migration futura | bytes pouco; CPU relevante |
| P2 | endpoints públicos `no-store` | TTL/ETag para busca normalizada, originais e léxico; excluir dados privados | reduz chamadas repetidas | médio / coerência/licenças | 30–90%, medir |
| P2 | shard e carga integral de marcas | medir payload; fragmentar shard/por-verso e paginar marcas | reduz p95/egress heavy | médio / UX | variável |
| P2 | prefetch indiscriminado de vizinho | condicionar a idle/hover e medir consumo | reduz tráfego não usado | baixo / UX | até 1 página por navegação abortada |
| P3 | RAG futuro | esquema de chunks/embeddings/quotas/fila somente após produto | evita dívida/contas LLM | alto / escopo | não aplicável |

## Sequência de entrega

1. **Semana 0 (P0):** configurar observabilidade e uma planilha de baseline; confirmar tamanho, egress e conexões reais. Definir budgets/alertas 50/70/85/95%. Implementar defesa global de OTP antes de divulgação.
2. **Semana 1 (P1):** provar que o corpus pode ser separado de estado pessoal; criar staging e medir cache. Publicar somente dados aprovados/licenciados, com versão de corpus e rollback. Não cachear HTML/authed state.
3. **Semana 2 (P1):** teste k6 de staging e Query Performance; otimizar busca se os dados pedirem. Avaliar pooler/Hyperdrive com teste de picos, nunca por suposição.
4. **Crescimento (P2):** cache de busca/léxico, payload e sincronização seletiva. Upgrade Pro apenas quando projeção ultrapassar limites ou exigência de disponibilidade/backups justificar.

## Guardrails

* Invalidação sempre por versão/chave de corpus, não purge global frequente.
* Cache key pública não pode conter cookie, sessão, notas, entitlement ou query PII.
* Testar autorização de duas contas após cada alteração de dados privados.
* Estabelecer limite de resposta e paginação antes de adicionar PDFs, mídia ou LLM.
