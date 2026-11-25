# Claude 1 — relatório da sequência noturna (C30)

**Data:** 25/11/2026
**Base:** `tasks/product/TAREFAS_CLAUDES_GENESIS1.md`, seções "Próxima tarefa do Claude 1" e
"Sequência para o Claude 1 — execução noturna".
**Estado:** as quatro tarefas da sequência foram executadas, mais os dois itens que faltavam da
tarefa anterior. **Nada foi commitado, publicado, nem escrito em produção.**

---

## 0. O que só existe localmente, e o que está em banco

| Coisa | Onde está |
| --- | --- |
| Artefato do shard `hbo/GEN/1` | **só local**, `data/generated/lexicons/shard-hbo-GEN-1.ndjson`, fora do Git |
| Recorte de Gênesis 1 | **só local**, `data/generated/lexicons/genesis1-*.ndjson`, fora do Git |
| Shard atualizado, de 11 campos | **só no banco descartável** `c30gen1`, que já foi destruído |
| Código e testes | **na árvore de trabalho**, sem commit |
| Produção | **intocada** — nenhuma migration, nenhuma escrita, nenhum deploy |

Produção continua com o shard de **dez** campos. Nada do que está aqui chega ao leitor sem que
alguém publique o código e importe o artefato, nessa ordem.

---

## 1. Tarefa anterior — os dois itens que faltavam

Faltavam o teste ponta a ponta de Gênesis 1:1 e 1:2 e o teste de ausência de BDB. Ambos feitos.

`tests/scripts/lexicon-shard-genesis1-e2e.test.ts` — **7 testes**, pelo caminho real
(Postgres → `createDrizzleLexiconRepository` → `createLexiconReader`), sem dublê. Roda **só** com
`C30_SHARD_E2E_DATABASE_URL` apontando para um banco local carregado; sem a variável o arquivo é
pulado, e isso é deliberado: amarrar a suíte comum a um container faria o portão de testes depender
do Docker estar de pé.

O que ele prova: Gênesis 1:1 com a nota revisada e as acepções **4, 8, 12, 0, 7, 0, 22**;
homógrafos preservados (`בָּרָא` alcança dois verbetes); 1:2 com rascunho rotulado e `הָיָה` em
**32 acepções, profundidade 5**; rascunho ausente da resposta inteira com a pré-visualização
desligada; capítulo sem shard devolvendo `not_found` sem erro; e o **shard antigo de dez campos**,
com o qual forma, lema, morfologia e tradução continuam de pé e só a árvore do BDB falta.

### Correção de alcance que merece registro

A avaliação dizia que "os verbetes já importados não serão alcançados". É verdade **só para as
acepções do BDB**. Com dez campos, `row[10]` vem `undefined` e a chave vazia é filtrada antes do
banco — mas a tradução editorial é buscada pelo **texto da glossa**, não pela chave de lema, e
continua aparecendo. Verificado na API, não deduzido do código: com o shard legado, Gênesis 1:1
devolve `editorial_reviewed` em português e `verbetesBDB=0`, e o crédito já omite `oshb-bdb`.

Publicar o código novo contra o shard antigo é, portanto, **seguro e incompleto**, não quebrado.

---

## 2. Sequência, tarefa por tarefa

### Tarefa 1 — endurecer o recorte e a preparação

**`scripts/build-lexicon-genesis1-slice.mjs`**, reescrito mantendo nome, caminho, saídas e formato
de stdout. Achados corrigidos:

- usava `process.cwd()`; rodar de outro diretório apontava para caminho inexistente em silêncio.
  Agora resolve de `import.meta.dirname`, como os outros scripts;
- lia o arquivo de traduções inteiro com `readFileSync`; agora é streaming, porque esse arquivo
  cresce conforme a tradução do corpus avança;
- `JSON.parse` sem contexto; agora o erro diz **o número da linha**;
- o alvo `GEN 1` aparecia em dois lugares; agora é uma constante só;
- **não validava nada.** Agora valida, e falha fechada, antes de escrever: recorte vazio; chave de
  lema sem verbete; ponte do BDB para verbete ausente; ponte partindo de lema fora do recorte;
  tradução de sujeito inalcançável. Depois de escrever, relê o arquivo e confere que nenhuma
  ocorrência fora do recorte entrou e que a contagem bate;
- emite `indexSha256` e `translationSha256`, para reprodutibilidade conferível sem diff manual.

**A regra que exigiu cuidado:** 16 das 109 chaves de Gênesis 1 **não têm verbete**, e isso é
correto — são Strong aumentado (`hbo:H871a`), e o léxico indexa por `H871`. Cair para a forma sem
sufixo colaria o verbete de **outra** palavra. A validação distingue os dois casos em vez de exigir
verbete para toda chave; exigir seria transformar um acerto em erro.

Execução real, duas vezes: saída **byte a byte idêntica** à da versão anterior —
`indexSha256 2835eb56…`, `translationSha256 27790519…`. O endurecimento acrescentou validação sem
mudar o resultado.

**`scripts/import-lexicon-index.ts`:**

- o guarda existente exige arquivos pré-filtrados junto de `--scope`, mas **confiava** que o
  arquivo correspondesse ao recorte. Agora o arquivo é **conferido** antes de qualquer escrita.
  Com o índice completo e `--scope="GEN 1:"`, falha: `606527 ocorrência(s) fora do recorte`, e nada
  é gravado. Antes, carregaria o corpus inteiro;
- um byte **NUL cru** era usado como separador de chave de deduplicação, o que fazia `grep` e
  `file` tratarem o arquivo como binário — buscas no repositório **pulavam ele em silêncio**.
  Trocado por `\u0000`: mesmo valor em execução, arquivo volta a ser texto;
- `main()` rodava no nível do módulo; importá-lo num teste dispararia uma importação de verdade.
  Guardado.

**Testes:** `tests/scripts/lexicon-genesis1-slice.test.ts`, **18 testes** com entradas pequenas.
Entre eles: `GEN 12:1` recusado por `GEN 1:` (um recorte por prefixo de texto levaria o capítulo 12
inteiro), e um teste que **fixa a duplicação** do formato de sujeito de glossa entre o `.mjs` e
`glossSubjectKey()` do domínio — se divergirem, a tradução deixa de ser encontrada em silêncio.

### Tarefa 2 — consulta lexical com dados parciais

**Defeito comprovado e corrigido em `src/server/lexicon/reader.ts`:** as três consultas acessórias
estavam num `Promise.all` com um único `catch`, então **uma falha descartava as duas que deram
certo**. Uma queda na consulta de acepções apagava da tela a tradução revisada que já estava em
mãos. Agora é `Promise.allSettled` e cada uma degrada por si.

**Testes:** 5 novos em `tests/server/lexicon-reader-bdb.test.ts` (16 no arquivo). Cobrem falha em
cada uma das três consultas isoladamente, capítulo com shard e sem ponte do BDB, e a ausência de
qualquer mensagem interna na resposta.

Cobertos também pelo e2e da seção 1: shard antigo e atualizado, fontes faltantes, palavras com mais
de um verbete, e capítulo inexistente.

### Tarefa 3 — experiência do painel lexical

Conferido no navegador de verdade, contra o banco descartável. Oito achados, todos corrigidos:

1. **Palavras coladas.** Os botões de palavra eram adjacentes sem espaço algum: copiar o versículo
   dava `Eaterraestavadesordenada`, e o leitor de tela lê o parágrafo emendado. Agora há espaço
   literal entre eles — nas três linhas (português, hebraico, transliteração). Confirmado depois:
   `E a terra estava desordenada…`.
2. **Seleção invisível para leitor de tela.** Os botões são alternadores e não tinham
   `aria-pressed`; a seleção só existia como cor. Agora têm.
3. **Dois controles idênticos.** O botão da transliteração e o da palavra acima selecionam a mesma
   coisa e soavam iguais. O da transliteração ganhou nome acessível próprio.
4. **`summary` sem foco visível.** Nem a árvore do BDB nem a Morfologia tinham anel de foco, e
   `.senseTree summary` ainda esconde o marcador nativo — quem navega por teclado não via onde
   estava. Regra de `:focus-visible` acrescentada para os dois.
5. **Rótulos sem acento.** `traducao aprovada` e `rascunho nao revisado` apareciam assim na tela.
6. **`acepção(ões)`** — saída de máquina na tela do leitor. Agora `1 acepção` / `32 acepções`.
7. **Mensagem desonesta.** Quando a consulta lexical estava em voo ou havia falhado, o painel dizia
   "a nota semântica ainda aguarda revisão editorial" — afirmação sobre estado editorial que
   ninguém verificou. Agora são três mensagens distintas, e a de falha diz que forma e morfologia
   **não dependem** do índice, para o leitor não concluir que o texto original caiu.
8. **Lixo de pontuação nas acepções.** A tela mostrava `a Fall out, happen ,` e
   `come to pass , , ,`.

Sobre o item 8, a **causa de raiz** está no parser, e fica registrada para quem for corrigir: no
XML do BDB as definições são `<def>` separadas por vírgulas soltas; `src/importers/lexicon/oshb-bdb.ts`
recolhe as `<def>` em `definitions` e **o texto restante em `note`** — e esse restante inclui as
vírgulas separadoras. Corrigi apenas a **exibição** (`readableSenseNote`), porque a correção de
raiz exige reconstruir o índice, o que esta sequência proíbe. **O dado gravado continua sujo.**

Os textos visíveis migraram para `app/biblia/lexicon-panel-text.ts`, um módulo sem JSX. Motivo: o
`tsconfig` do Next usa `jsx: "preserve"` e o vitest não parseia `.tsx` com isso; mudar a config do
vitest afetaria toda a suíte. A alternativa era deixar texto de tela sem teste nenhum.

**Testes:** `tests/server/lexicon-panel-presentation.test.ts`, **13 testes**.

**Verificação no navegador** (`next dev` contra o banco descartável, Gênesis 1:2, palavra `הָיְתָ֥ה`):
árvore abre por teclado, 11 listas, **profundidade 5**; selo `RASCUNHO NÃO REVISADO` com o método
ao lado; `Brown-Driver-Briggs · 32 acepções`; créditos com campos e licença por fonte; e o texto
limpo — `a Fall out, happen` / `2 come about, come to pass esp. & very oft.`.

**Viewport de telefone:** com a folha reduzida a **360 px**, zero transbordo em qualquer `li`, `p`
ou `section` da árvore, e nenhuma rolagem horizontal na página.

**Observação, não corrigida:** o painel lexical inteiro está atrás da consulta de originais — se
`/api/biblia/original` falha, nada do BDB renderiza, mesmo com `/api/biblia/lexico` respondendo.
Isso me parece **certo** (a análise é *sobre* as palavras do original), mas é decisão de produto e
fica anotada em vez de alterada.

### Tarefa 4 — este relatório

---

## 3. Artefato e impacto de espaço

| | Valor |
| --- | --- |
| Artefato | `data/generated/lexicons/shard-hbo-GEN-1.ndjson`, 71.197 bytes, **só local** |
| `sha256` do payload | `84652bc8b32426349ad54dfa06bd7862ef8a5ed430d39528089368e69a4b5782` |
| Shard publicado hoje (dez campos) | `a5dd15b011921bcb8e1cbf13cdd9bda4f970ed1644d0b60598e2666cacddd071` |
| Tamanho do payload | **62.699 → 71.093 bytes**, delta **+8.394 (+13,4%)** |
| Linhas / versos | 690 / 31, iguais antes e depois |
| Comparação | **zero divergências**: os dez campos idênticos, 11º preenchido em todas as linhas |
| Idempotência | duas importações seguidas: mesmo `sha256`, contagem de shards segue 1 |

**Verificação cruzada:** o payload construído do recorte limitado (1,3 MB) tem o **mesmo sha256** do
que o gerador completo produziu do índice de 564 MB. Dois caminhos independentes.

Sobre a cota: o delta de 8,4 KB é **texto**, e é o teto — o jsonb vai para o TOAST, que comprime.
Em um capítulo isso é desprezível diante dos 296 MB de 500 MB. **O número que importa para a cota
não é este**, e sim o dos 1.189 shards, que não está nesta entrega e **não deve ser inferido daqui
por regra de três**: Gênesis 1 é capítulo longo e a compressão varia com o conteúdo.

Não medi o tamanho em disco antes e depois no mesmo banco — só o estado final (tabela com 1 shard:
216 kB). Se o revisor quiser o delta real em disco, é `pg_total_relation_size` nos dois momentos.

---

## 4. Comandos executados

```bash
# recorte endurecido, duas vezes (determinismo)
node scripts/build-lexicon-genesis1-slice.mjs

# artefato do shard, sem banco
node --experimental-strip-types scripts/update-lexicon-shard-genesis1.ts

# banco descartável
docker run -d --name c30gen1 -e POSTGRES_PASSWORD=c30 -e POSTGRES_DB=c30 -p 55434:5432 postgres:16-alpine
# aplicar 0000–0010 (0000_initial.sql tem BOM UTF-8; remover antes)

export DATABASE_URL="postgresql://postgres:c30@127.0.0.1:55434/c30"
export LEXICON_INDEX_PATH=".../genesis1-index.ndjson"
export LEXICON_TRANSLATIONS_PATH=".../genesis1-translations.ndjson"
node --experimental-strip-types scripts/import-lexicon-index.ts --scope="GEN 1:"

# comparação linha a linha contra o shard publicado, e importação do alvo único
node --experimental-strip-types scripts/update-lexicon-shard-genesis1.ts
node --experimental-strip-types scripts/import-lexicon-chapter-shards.ts \
  --input=data/generated/lexicons/shard-hbo-GEN-1.ndjson --only=hbo:GEN:1

# ponta a ponta
C30_SHARD_E2E_DATABASE_URL="$DATABASE_URL" npx vitest run tests/scripts/

npm run typecheck
npx vitest run
npm run build
docker rm -f c30gen1
```

Para a verificação no navegador o banco recebeu também o texto da BLIVRE
(`scripts/import-blivre.ts`) e o corpus em língua original
(`scripts/import-original-corpus.ts --apply`), sem os quais a página do leitor devolve 404 e o
painel não existe. Foi preciso criar à mão um schema `auth` mínimo com `auth.users`, `auth.uid()` e
um perfil de revisor — o Postgres puro não tem o schema do Supabase, e sem ele as migrations
`0003` e `0006` e o importador de corpus falham. Tudo no banco descartável, que já foi destruído.

---

## 5. Resultados e limites dos testes

| Portão | Resultado |
| --- | --- |
| `npm run typecheck` | **limpo** |
| `npx vitest run` | **493 testes passando, 7 pulados, 48 arquivos** |
| `npx eslint` nos arquivos alterados | **limpo** |
| `npm run build` | **passou**, 26 rotas |
| Banco descartável | criado, carregado, usado e **removido** |

Os 7 pulados são o arquivo ponta a ponta, que exige `C30_SHARD_E2E_DATABASE_URL`. Com a variável:
**41 testes em 3 arquivos** em `tests/scripts/`.

**Limites honestos:**

- não há jsdom nem testing-library no projeto, e instalar exigiria chamada externa, que esta
  sequência não faz. Por isso não há teste de DOM: `aria-pressed`, foco por teclado, abertura da
  árvore e largura de 360 px foram conferidos **no navegador**, não por teste automatizado. Se
  alguém regredir esses atributos, nenhum teste vai acusar;
- a validação do recorte foi exercitada com entradas pequenas e com os dados reais de Gênesis 1;
  não foi exercitada contra um índice deliberadamente corrompido em larga escala;
- a comparação do shard rodou contra um shard legado **fabricado localmente** truncando o
  artefato para dez campos. Para comparar com o payload **real** de produção sem dar acesso ao
  banco a esta sessão, o script aceita `--before=<arquivo>` com o despejo do payload.

---

## 6. Concorrência

Durante a execução, a outra frente editava `tests/server/knowledge-graph.test.ts`: por volta das
04:18 o `typecheck` acusava `TS2345` naquele arquivo e uma rodada de `tests/server/` falhou; às
04:20 a mesma rodada passou e às 04:27 o `typecheck` estava limpo. **Não toquei no arquivo** — era
deles e estava em edição. Registro como evidência, não como defeito pendente.

---

## 7. Dependências para publicar

1. Publicar o código **não** depende do shard: com o shard de dez campos tudo funciona, menos as
   acepções do BDB. Verificado.
2. Importar o artefato **depende** de o código novo estar publicado ou não — tanto faz, nos dois
   sentidos: o shard de onze campos é lido sem problema pelo código antigo, que ignora o campo
   extra. As duas publicações são independentes.
3. A migration `0009` já existe em produção; o artefato é `UPDATE` de uma linha, não DDL.
4. A pré-visualização de rascunho (`LEXICON_PREVIEW_DRAFTS`) **continua desligada**, e preparar
   dados não autoriza ligá-la.
5. Nada aqui aprova tradução nenhuma: as 537 glossas seguem `machine_draft`.

Relatório da tarefa do shard, com mais detalhe sobre a regra de aceitação:
`tasks/product/LEXICON-SHARD-GEN1-atualizacao.md`.
