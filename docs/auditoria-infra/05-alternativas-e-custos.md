# 05 — Alternativas e custos

Preços verificados em fontes oficiais em 19/11/2026; USD convertido apenas para orientação a **R$5,00/USD**, não cotação. Impostos/câmbio não inclusos.

| Critério | A Supabase Free otimizado | B Supabase Pro | C Neon + Workers | D D1 + Workers + R2 | E Híbrida recomendada |
|---|---|---|---|---|---|
| Custo inicial | US$0 | a partir de US$25/mês | Free possível; limites variam | Workers Free possível | US$0 enquanto cabe franquias |
| Crescimento | limite rígido 5+5 GB e 500 MB | US$25 + compute; 250+250 GB | compute/egress/serviços | linhas lidas/escritas, R2 ops | Pro só quando necessário; conteúdo em CDN/R2 |
| Escalabilidade | baixa sem cache | boa após otimização | boa Postgres serverless | boa leitura, modelo SQLite | alta para leitura pública |
| Complexidade | baixa | baixa | média: migrar Auth/RLS | alta: reescrever SQL/relacional | média incremental |
| Segurança | Auth/RLS existentes | idem | Auth precisa substituição/integração | Auth/RLS precisam ser refeitos | preserva Auth/dados privados |
| Controle egress | baixo sem edge cache | cobrança clara | confirmar contrato vigente | sem egress D1/R2 | alto para corpus público |
| LLM | pgvector/Postgres | idem | Postgres adequado | vetores/relacional menos natural | Postgres privado + R2 documentos |
| Migração/risco | nenhum | nenhum | médio/alto | alto | baixo/médio |

## Valores e limites externos

* Supabase Free: 500 MB DB, 5 GB egress não cacheado, 5 GB cacheado, 1 GB Storage, 50k MAU; pausa após inatividade. Pro: a partir de US$25/mês, 250 GB de cada egress, 8 GB DB; excedente egress US$0,09/GB não cacheado e US$0,03/GB cacheado. Fontes: [pricing](https://supabase.com/pricing), [egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [compute](https://supabase.com/docs/guides/platform/compute-and-disk). A página de compute lista Micro em ~US$10/mês; validar na fatura como o crédito do plano se aplica.
* Cloudflare Workers Paid custa mínimo US$5/mês; Workers não cobra egress. D1 Free: 5M linhas lidas/dia, 100k escritas/dia e 5 GB; R2: 10 GB-mês, 1M Class A, 10M Class B e egress gratuito. Fontes: [Workers](https://developers.cloudflare.com/workers/platform/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/).
* Neon Free anunciado: 1 GB Postgres/projeto, 100 CU-h/projeto/mês, 5 GB object storage e Auth gerenciado; confirmar disponibilidade/região e limites de rede antes de decisão. Fonte: [Neon free update](https://neon.com/blog/neon-free-plan-1-gb-per-project). Não foi possível confirmar nesta auditoria uma tabela oficial atual de excedentes Neon aplicável ao projeto; não há preço inventado aqui.

## Projeção financeira

Com a arquitetura atual, Free custa US$0/R$0 **somente** enquanto tudo cabe. No modelo moderado sem cache, 1k DAU passa 5 GB; Free não oferece excedente faturável normal, logo há risco de restrição/upgrade, não "conta pequena". Em Pro, os cenários moderados até 10k DAU cabem nos 250 GB: custo base estimado US$25–35 (R$125–175), dependendo de compute/crédito. Em 50k DAU moderados (393 GB), excedente aproximado = 143 GB × US$0,09 = US$12,87, além da base/compute, se todo o tráfego for não cacheado. Com 90% cache antes do banco, 50k moderados chegam a ~39 GB de egress Supabase e o componente de egress cai a zero dentro de 250 GB.

Custo por 1.000 DAU não é função linear: no Free é US$0 até o teto e depois indisponibilidade; em Pro, se 1k DAU for o único volume, US$25–35/1k DAU/mês. O custo de LLM, e-mail adicional, domínio, lojas, observabilidade comercial, backup além da franquia e manutenção não está definido por uso no repositório e deve ser orçado separadamente.

## Decisão

Não migrar agora. A melhor relação custo/risco é **E**: manter Supabase Auth/Postgres para identidade e estado privado e publicar corpus público versionado na CDN/Assets ou R2, com cache Cloudflare; só migrar dados públicos após prova de volume. D1 é atraente para conteúdo quase estático, mas migrar todo o domínio perde Postgres/RLS e aumenta risco. Neon é alternativa viável se a franquia/compute real se mostrar melhor, mas envolve Auth, migração, conexão e operação que não resolvem por si o desperdício de bytes.
