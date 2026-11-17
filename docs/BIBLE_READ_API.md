# Contrato de leitura BLIVRE (tarefa C3)

Camada de servidor para listar livros, capítulos e versículos **publicados** da
tradução BLIVRE. Nenhuma rota consome isto ainda: ligar ao leitor é a tarefa C4,
depois de o operador confirmar 66 livros / 1189 capítulos / 31102 versículos no banco.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `src/server/contracts/bible.ts` | tipos, interface do repositório, schemas Zod e projeções puras |
| `src/server/bible/reader.ts` | serviço `createBibleReader(translationId, repository)` |
| `src/server/bible/repository.ts` | implementação Drizzle, somente consultas |
| `src/server/bible/blivre.ts` | UUID da tradução fixado em `drizzle/0001_seed_blivre.sql` |
| `src/server/bible/runtime.ts` | `getBlivreReader()`, único ponto que toca banco |
| `src/server/bible/index.ts` | superfície pública sem runtime de infraestrutura |
| `tests/server/bible.test.ts` | 14 testes com fixtures sintéticas, sem banco |

## Operações

```ts
const reader = await getBlivreReader();        // ou createBibleReader(id, repo) em teste
await reader.listBooks();                      // { ok, translation, books }
await reader.listChapters("genesis");          // { ok, translation, book, chapters }
await reader.readChapter("genesis", 1);        // { ok, translation, book, chapter, verses }
```

Referência de livro aceita slug **ou** código, normalizada para minúsculas e
restrita a `^[a-z0-9-]+$` (máx. 32). Número de capítulo é inteiro de 1 a 150 e
aceita texto vindo de URL. Ordenação é canônica: livros por `order_no`, capítulos e
versículos por número — ordenada pelo contrato, não pela confiança na consulta.

## Falhas fechadas

| `reason` | Quando |
| --- | --- |
| `unavailable` | banco não configurado (`getDatabaseAsync()` devolve `null`) ou exceção do repositório |
| `invalid_reference` | slug/código fora do formato, capítulo fora de 1–150 |
| `translation_unavailable` | tradução ausente, com status diferente de `approved` ou sem atribuição |
| `not_found` | livro ou capítulo inexistente, ou tradução aprovada sem livros importados |
| `not_published` | capítulo existe, mas nenhum versículo com `published = true` |

Garantias verificadas por teste:

- exceção do repositório nunca vira mensagem: o resultado é só `{ ok: false, reason }`,
  sem host, usuário, senha ou connection string;
- tradução sem `status = "approved"` ou sem atribuição não serve texto algum, e o
  serviço nem consulta versículos nesse caso;
- `published = false` é filtrado duas vezes — na consulta e no contrato;
- linha de outra tradução, de outro livro ou de outro capítulo é descartada;
- UUID inválido, conteúdo vazio e duplicado são descartados;
- o resultado expõe apenas `id`, `number` e `content` do versículo: `published`,
  `translation_id` e `chapter_id` não atravessam a fronteira.

## Limites

Somente leitura: nenhuma escrita, migration ou DDL. O módulo não conhece HTTP,
React ou Cloudflare. `getBlivreReader()` é a única função que lê configuração de
banco, e sem configuração o leitor responde `unavailable` a tudo em vez de lançar.
