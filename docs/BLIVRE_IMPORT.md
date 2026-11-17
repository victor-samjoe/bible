# Importação BLIVRE

Pré-requisito: aplicar `0000_initial.sql`, `0001_seed_blivre.sql` e `0002_blivre_query_indexes.sql` em ambiente autorizado. O seed 0001 aprova a licença/atribuição antes de qualquer verso ser marcado como publicado.

Execute localmente, com uma conexão Postgres direta configurada apenas no ambiente:

```text
DATABASE_URL=... node --experimental-strip-types scripts/import-blivre.ts
```

O carregador usa os UUIDs estáveis do corpus, faz upsert por tradução/livro, capítulo e versículo, e confirma ao fim as contagens `66`, `1189` e `31102`. Não loga credenciais. Não execute contra outro projeto sem conferir a licença e o `translation_id` BLIVRE.

