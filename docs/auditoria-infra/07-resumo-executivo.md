# 07 — Resumo executivo

## Decisão recomendada

**Manter Supabase Free para o MVP, mas não lançar com a expectativa de que ele sustentará milhares de usuários ativos/dia sem cache.** A arquitetura recomendada é híbrida incremental: Supabase permanece em Auth e dados privados; corpus bíblico público, versionado e licenciado deve ser servido da borda Cloudflare/R2/Assets com cache verificável. Não há justificativa técnica ou financeira para migrar agora para Neon ou D1.

## Respostas diretas

1. **Free é suficiente?** Sim para MVP controlado e baixo tráfego, desde que se instale observabilidade e cache público antes de escala; não é suficiente por hipótese para 1.000 DAU moderados sem cache (modelo: 7,86 GB/mês vs 5 GB não cacheados).
2. **Principal risco de egress?** Capítulos, catálogo e painéis públicos sendo lidos do Postgres por páginas `force-dynamic`, sem cache cross-request (`app/biblia/[book]/[chapter]/page.tsx:29-46`).
3. **Há transferência desnecessária?** Sim: catálogo/contagens por render, prefetch vizinho, `no-store` em busca/original/léxico e carga completa de marcas. Não há `select('*')` público nem N+1 de versos comprovado.
4. **Maiores otimizações?** CDN/ETag/versionamento do conteúdo público; observabilidade; pooling; busca indexada somente se medidas pedirem.
5. **Primeiro gargalo provável?** Egress/CPU de leitura pública sem cache; depois conexões diretas e busca `ILIKE`.
6. **Até onde cresce?** Sem medição não há capacidade prometível. Financeiramente, no modelo, 500 DAU moderados ficam em 3,93 GB/mês; 1k excedem Free. Com 90% hit real de edge, 10k moderados projetam ~7,86 GB chegando ao Supabase.
7. **Custo por cenário?** Free é US$0 até a franquia; Pro inicia em US$25/mês mais compute (estimativa R$125+). Consulte `05-alternativas-e-custos.md` para pressupostos e excedentes.
8. **Pro é necessário?** Não no primeiro dia; torna-se justificável com projeção sustentada acima de franquias, necessidade de backups/uptime ou CPU/conexões após otimização.
9. **Neon/D1 ajudam?** Neon troca operação/Auth e não elimina bytes sem cache. D1/R2 reduz egress para conteúdo distribuído, mas migrar todo Postgres/RLS é desproporcional. Usar R2/edge seletivamente entrega quase todo benefício.
10. **Arquitetura indicada?** E híbrida: Worker + CDN/R2 para conteúdo público imutável; Supabase Auth/Postgres para dados privados e editorial canônico.

## Cinco maiores problemas

| Problema | Evidência | Impacto | Recomendação |
|---|---|---|---|
| Público sem cache | `force-dynamic`, `page.tsx:29-46` | egress/DB cresce quase linearmente com leitura | P1: conteúdo versionado no edge |
| Medição ausente | nenhum painel/metric no repo | não é possível atribuir ou alertar | P0: baseline + alertas |
| Conexão por invocação | `db/client.ts:9-13`; sem Hyperdrive operacional | picos podem exaurir slots | P1: benchmark pooler/Hyperdrive |
| Abuso OTP | limitador local por isolate | custo/abuso distribuído | P0: rate limit compartilhado/Turnstile |
| Busca full scan | `search-repository.ts:7-15` | CPU/latência sob uso intenso | P1: medir, depois FTS/trigram |

Fatos, hipóteses, limites de acesso e plano de medição estão detalhados nos seis relatórios irmãos. Nenhum código, banco, configuração, migration, deploy ou teste de carga foi alterado/executado.
