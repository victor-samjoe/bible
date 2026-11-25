# Atualização do shard `hbo/GEN/1` — dez para onze campos

**De:** Claude 1 — 24/11/2026
**Estado:** artefato pronto e provado em banco local descartável. **Nada foi escrito em produção.**
**Interrompido por limite de uso** antes da consulta ponta a ponta da API; ver seção 7.

---

## 1. Correção de alcance no achado do agente principal

O achado está certo no essencial: o shard publicado tem **dez** campos e o leitor novo precisa do
11º (`lexemeKey`). Mas a consequência é mais estreita do que "os verbetes não serão alcançados".

Com dez campos, `row[10]` vem `undefined`, a chave fica `""` e
`repository.ts:183` a filtra antes de ir ao banco. O que isso afeta, exatamente:

| Campo na tela | Com o shard de dez campos |
| --- | --- |
| Forma, lema, morfologia, classe, domínio, glossa | **aparece** — vem dos campos 0–9 |
| Tradução editorial pt-BR | **aparece** — a junção é por texto da glossa (`gloss:hbo:in`), não por `lexemeKey` |
| Árvore de acepções do BDB | **ausente** — é a única coisa que depende do 11º campo |
| Crédito de fontes | aparece, **sem** a linha do `oshb-bdb` (só se credita o que entrou) |

Ou seja: publicar o código novo contra o shard antigo é **seguro, não quebrado** — degrada para
"sem acepções", sem erro e sem texto inventado. Isso muda a urgência, não a necessidade.

## 2. O que foi feito

`scripts/update-lexicon-shard-genesis1.ts` (novo). O alvo `hbo/GEN/1` é **fixo no código, não
argumento** — não há como apontá-lo para outro shard por engano. Ele monta o candidato a partir do
recorte limitado `genesis1-index.ndjson` (1,3 MB), não do índice de 564 MB.

`scripts/import-lexicon-chapter-shards.ts` ganhou `--input=<arquivo>` e `--only=<l:LIVRO:cap>`. O
`--only` **falha** diante de linha fora do alvo, em vez de ignorá-la: arquivo errado não atualiza
shard que ninguém pediu.

### Verificação cruzada que vale mais que um teste

O payload construído do recorte limitado tem o **mesmo sha256** do que o gerador completo produziu
do índice de 564 MB: `84652bc8b32426349ad54dfa06bd7862ef8a5ed430d39528089368e69a4b5782`. Dois
caminhos independentes, byte a byte iguais.

### Regra de aceitação

Comparação por `sourceWordId` — identificador de ocorrência da fonte, não posição no array, que
mudaria de significado se a ordenação mudasse. Falha em: ausência, sobra, duplicidade, divergência
em qualquer dos dez campos (dizendo **qual** campo e o valor antes/depois), morfema que trocou de
verso, 11º campo vazio, linha mais curta que o formato. `strongId` e transliteração vêm do verbete
**pela chave**; há teste com verbete de grafia parecida e chave diferente para provar que não é a
grafia que decide.

## 3. Prova em Postgres descartável (`c30shard`, porta 55433)

| Passo | Resultado |
| --- | --- |
| Migrations | 0000–0010 aplicadas, **menos 0003 e 0006**, que exigem o schema `auth` do Supabase; as 8 tabelas do léxico existem |
| Recorte relacional de Gênesis 1 | 93 verbetes, 690 ocorrências, 184 traduções, **110 árvores do BDB, 112 pontes**, 0 ponte sem Strong, 0 par repetido |
| Shard legado publicado (simulado) | `a5dd15b011921bcb…`, **62.699 bytes**, 690 linhas, 31 versos, largura **10** confirmada no banco |
| Comparação contra o banco | **zero divergências**: os dez campos idênticos, 11º preenchido em todas as 690 linhas |
| Guarda do `--only` | recusou `chapter-shards.ndjson`: `arquivo contém o shard grc:1CO:1, fora do alvo`; **nada gravado** |
| Importação do atualizado | 1 shard; `source_sha256` = `84652bc8…`; largura **11** confirmada no banco |
| Idempotência | segunda importação: mesmo sha256, contagem de shards segue **1** |

## 4. Impacto de espaço

- Payload em texto: **62.699 → 71.093 bytes**, delta **+8.394 bytes (+13,4%)**. É o **teto**: o
  jsonb vai para o TOAST, que comprime.
- Com um shard só na tabela: total 144 kB, dos quais 120 kB de TOAST.
- Contra a cota: a frase do agente principal é 296 MB de 500 MB nominais. **+8,4 KB de texto em um
  capítulo é desprezível.** O número que importa para a cota não é este — é o dos 1.189 shards, que
  **não** está nesta entrega e não deve ser inferido daqui por regra de três, porque Gênesis 1 é um
  capítulo longo e a compressão varia com o conteúdo.
- **Não medi o tamanho em disco antes da atualização**, só o estado final. Se o revisor quiser o
  delta real em disco, é `pg_total_relation_size` antes e depois, no mesmo banco.

## 5. Comandos exatos para revisão

```bash
node --experimental-strip-types scripts/build-lexicon-genesis1-slice.mjs   # recorte, se preciso
node --experimental-strip-types scripts/update-lexicon-shard-genesis1.ts   # sem banco: só o artefato

# com o shard publicado à mão, para a comparação linha a linha:
DATABASE_URL="postgresql://…" node --experimental-strip-types scripts/update-lexicon-shard-genesis1.ts
#   ou, sem dar acesso ao banco, com um despejo do payload:
node --experimental-strip-types scripts/update-lexicon-shard-genesis1.ts --before=<arquivo.json>

DATABASE_URL="postgresql://…" node --experimental-strip-types \
  scripts/import-lexicon-chapter-shards.ts \
  --input=data/generated/lexicons/shard-hbo-GEN-1.ndjson --only=hbo:GEN:1

npx vitest run tests/scripts/lexicon-shard-genesis1-update.test.ts   # 16 testes
```

O `--before=<arquivo>` existe para que **você** possa fazer a comparação contra o payload real de
produção sem que esta sessão tenha acesso ao banco de produção.

## 6. Artefato

`data/generated/lexicons/shard-hbo-GEN-1.ndjson` — uma linha, 71.197 bytes,
`sha256` do payload `84652bc8b32426349ad54dfa06bd7862ef8a5ed430d39528089368e69a4b5782`.
Fora do Git (`data/` é ignorado). **Só existe localmente.**

## 7. O que falta, e o que eu não fiz

> **Atualização de 25/11:** os três primeiros itens abaixo foram concluídos. A consulta ponta a
> ponta de Gênesis 1:1 e 1:2 foi executada contra a API e virou teste automatizado
> (`tests/scripts/lexicon-shard-genesis1-e2e.test.ts`, 7 testes, inclusive o caso do shard antigo
> e o de capítulo sem dado). Os itens 1 a 4 da sequência noturna foram executados. Relatório:
> `tasks/product/CLAUDE1_RELATORIO_SEQUENCIA_NOITE.md`.
- **Correção de passagem:** `scripts/import-lexicon-index.ts` tinha um byte NUL cru como separador
  de chave de deduplicação, o que fazia `grep` e `file` tratarem o arquivo como binário — buscas no
  repositório pulavam ele **em silêncio**. Trocado por `\u0000`; mesmo valor em execução, arquivo
  volta a ser texto.
- Container `c30shard` removido. Nada foi commitado, publicado ou escrito em produção.
