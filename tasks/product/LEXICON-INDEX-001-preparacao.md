# LEXICON-INDEX-001 — índice lexical (fila C30)

**Data:** 19/11/2026
**Escopo executado:** coleta reproduzível, índice integral, migration aditiva, importação em
Postgres descartável e leitura progressiva pelo painel.
**Escopo deliberadamente fora:** aplicar a migration/importar em produção, **publicar** tradução
sem revisão editorial e alinhar automaticamente uma tradução portuguesa.

Traduzir **entrou** no escopo em 19/11, por decisão registrada do proprietário: a tradução é
gerada como `machine_draft`, com método declarado, e continua inexibível ao público até ser
aprovada. CC BY 4.0 permite obra derivada; o que o projeto proíbe não é traduzir, é publicar sem
conferir.

---

## 1. Estado exato

| Item | Estado |
| --- | --- |
| Registro versionado das fontes | **feito** — `src/domain/lexicon/source-registry.ts` |
| Contrato de manifesto de coleta | **feito** — gerado por `scripts/fetch-lexicon-sources.ts` |
| Coletor com falha fechada por hash | **feito e executado** contra quatro fontes autorizadas |
| Verificador offline | **feito e executado** — hashes e parsers conferidos |
| Parsers MACULA / TBESG / HebrewStrong / LexicalIndex | **feitos**, testados contra fixtures |
| Parser `BrownDriverBriggs.xml` | **feito** — hierárquico, `src/importers/lexicon/oshb-bdb.ts` |
| Acepções do BDB | **11.845 verbetes, 8.989 acepções** em até 5 níveis, no índice e no banco |
| Ponte lema → Strong → BDB | **feita** — 9.288 pares gravados, de 10.212 ligações do índice |
| Domínios `sdbh` e `lexdomain` | **importados** — 244.727 e 244.714 ocorrências; eram descartados |
| Modelo normalizado com proveniência por campo | **feito** — `src/domain/lexicon/records.ts` |
| Proibição do `Meaning` do TBESH | **feita** em código, registro, testes e documentação |
| Fluxo editorial pt-BR | **feito** como contrato — `src/domain/lexicon/translation-workflow.ts` |
| Programa de tradução por livro | **feito** — `scripts/translate-lexicon.ts`, retomável e não regressivo |
| Tradução gerada | **537 glossas** em `machine_draft` (Gênesis 1 e João 1), método declarado |
| Tradução publicada | **nenhuma** — só `approved` chega ao leitor, e nada foi aprovado |
| Cobertura da tradução | 99,1% de Gênesis 1, 99,6% de João 1, **39,5%** das palavras da Bíblia |
| Fixtures Gênesis 1:1 e João 1:1 | **feitas** — `tests/fixtures/lexicons/` |
| Coleta de fontes lexicais | **concluída** para MACULA Hebrew/Greek, OS HebrewLexicon, BDB e TBESG |
| SHA-256 real | **congelado** no registro versionado, por ativo e commit |
| Migration | **criadas**: `0008_lexical_index.sql` e `0010_bdb_senses.sql`; validadas só em Postgres descartável |
| Índice integral | **gerado**: 19.521 verbetes, 11.845 árvores do BDB, 10.167 pontes e 607.217 ocorrências, fora do Git |
| Mudança no leitor | **feita de modo progressivo**: consulta `/api/biblia/lexico`; a prova revisada de Gênesis 1:1 permanece como prioridade |
| Acepções do BDB no painel | **feitas** — árvore com recuo por nível, aviso de texto em inglês sem tradução |
| Estados de revisão na tela | **feitos** — `editorial_reviewed`, `approved`, `unreviewed_draft`, `source_text`, com rótulo |
| Crédito de fontes por palavra | **feito** — só as fontes usadas, com campos, licença e atribuição da tabela |

## 2. Decisões tomadas, com o motivo

1. **Pinos e hashes são obrigatórios.** As quatro fontes do MVP foram fixadas por commit e
   SHA-256 real; `assetUrl()` continua recusando qualquer fonte sem pino resolvido.
2. **Parsers guiados pelo cabeçalho real, não por índice de coluna.** As fontes mudam nomes e
   ordem de colunas entre revisões; índice fixo importaria a coluna errada — possivelmente de
   licença diferente — sem aviso.
3. **Três respostas para cada campo, não duas:** lido, ignorado (e relatado) ou **proibido** (e a
   leitura para). Campo proibido tratado como omissão é como o `Meaning` do TBESH entraria.
4. **Verbete e ocorrência separados.** Verbete uma vez por lema; ocorrência guarda só o que é
   dela e aponta pela chave `idioma:Strong`. É o que a tarefa pede e o que a prova manual não faz.
5. **Proveniência por campo.** Transliteração de uma fonte e definição de outra no mesmo verbete é
   caso normal; uma única linha de crédito por registro seria imprecisa.
6. **`machine_draft → approved` não existe no fluxo de tradução.** Pular a revisão é o único
   caminho para um texto de máquina chegar ao leitor como verbete conferido.
7. **BDB fica sem parser nesta frente.** É árvore de sentidos aninhados; achatá-la perderia a
   hierarquia. Declarado como `pending_parser` para aparecer no verificador.
8. **A migration 0008 é aditiva.** Ela separa fonte, proveniência, verbete, ocorrência e tradução
   editorial; foi aplicada e carregada somente no Postgres descartável `c30pg`.

## 3. Comandos

```bash
node --experimental-strip-types scripts/fetch-lexicon-sources.ts            # plano, não baixa
node --experimental-strip-types scripts/verify-lexicon-sources.ts           # verificação offline
node --experimental-strip-types scripts/build-lexicon-index.ts              # índice, sem gravar
node --experimental-strip-types scripts/build-lexicon-index.ts --emit       # grava em dir ignorado

npx vitest run tests/domain/lexicon-registry.test.ts
npx vitest run tests/domain/lexicon-translation-workflow.test.ts
npx vitest run tests/domain/lexicon-translation-store.test.ts
npx vitest run tests/domain/lexicon-word-analysis-view.test.ts
npx vitest run tests/importers/lexicon-sources.test.ts
npx vitest run tests/importers/lexicon-bdb.test.ts
npx vitest run tests/server/lexicon-reader.test.ts
npx vitest run tests/server/lexicon-reader-bdb.test.ts
npm run typecheck
```

O índice integral precisa de mais memória do que o padrão do Node, porque são 607 mil ocorrências:

```bash
node --max-old-space-size=6144 --experimental-strip-types scripts/build-lexicon-index.ts --emit
```

Tradução editorial, livro a livro. O recorte por capítulo serve para fechar uma prova pequena;
sem `--scope`, o laço pega o próximo livro pendente na ordem Gênesis → João → cânone:

```bash
node --experimental-strip-types scripts/translate-lexicon.ts --status
node --experimental-strip-types scripts/translate-lexicon.ts --scope="GEN 1:" --emit-batch
# preencher a coluna ptBR do lote em data/generated/lexicons/batches/
node --experimental-strip-types scripts/translate-lexicon.ts --ingest=<arquivo.tsv>
```

Validação da migration e da importação em Postgres descartável, **nunca em produção**:

```bash
docker run -d --name c30pg -e POSTGRES_PASSWORD=c30 -e POSTGRES_DB=c30 -p 55432:5432 postgres:16-alpine
# aplicar 0000–0010 (0000_initial.sql tem BOM UTF-8; remover antes de aplicar)
DATABASE_URL="postgresql://postgres:c30@127.0.0.1:55432/c30" \
  node --max-old-space-size=6144 --experimental-strip-types scripts/import-lexicon-index.ts
docker rm -f c30pg
```

Coleta real, só depois de aprovação registrada:

```bash
node --experimental-strip-types scripts/fetch-lexicon-sources.ts \
  --collect --source=<id> --resolve-pin=<commit de 40 hex>
```

## 4. Portões de aprovação que continuam abertos

1. Aplicar a `0009` e importar os shards **em produção**, somente com ordem operacional explícita.
   A `0008` não vai para produção: é para curadoria e uso offline.
2. ~~Rotular `machine_draft` no painel~~ — **feito** em 24/11, com rótulo por estado de revisão e
   o método de geração ao lado. Provado com a pré-visualização ligada e desligada.
3. Revisar e aprovar as 537 traduções pt-BR já geradas; rascunho nunca é publicado. O armazém
   protege o que foi revisado: reprocessar o livro não apaga trabalho humano.
4. Decidir como traduzir o resto. À mão não sai: restam 60.146 glossas distintas e 27 mil campos
   de verbete. Os 100 lemas mais frequentes cobrem 58% do texto e os 1.000 cobrem 85%, então há
   caminho incremental — mas 100% exige motor de tradução automática chamado pelo programa, com
   chave de API e **custo aprovado**, que não existe hoje. O formato de lote já está pronto para
   receber esse motor sem mudar nada no armazém.
5. Implementar o alinhamento editorial por versão portuguesa; não usar posição como atalho.
6. Expor as acepções do BDB no painel. O dado está no índice e no banco, mas não chega à tela:
   `src/server/lexicon/` e o painel são da frente concorrente.
7. Dar `testTimeout` próprio a `tests/importers/blivre.test.ts`: ele lê o corpus local inteiro e
   estoura os 5000 ms padrão do vitest sob carga paralela. Passa sozinho; falha intermitente no
   conjunto cheio.
8. Acrescentar `data/**`, `.deploy-*/**`, `.next-review/**` e `.claude/**` ao `ignores` do
   `eslint.config.mjs`, para o portão de lint voltar a ser utilizável.

## 5. Pendências conhecidas desta entrega

- `npm run typecheck` limpo e a suíte inteira passa: **401 testes em 41 arquivos**. `npx eslint`
  limpo em todos os arquivos desta frente.
- A migration a validar localmente agora vai até a **0010**; em produção, ver o portão 1.
- **Antes de ligar `LEXICON_PREVIEW_DRAFTS`:** `app/biblia/original-panel.tsx` rotula
  `source_gloss` como "sentido na fonte (inglês)" mas **não rotula `machine_draft`**, então um
  rascunho apareceria indistinguível de tradução aprovada. O `kind` próprio devolvido por
  `publishableText` existe exatamente para forçar esse rótulo; sem ele, a garantia não se cumpre.
- `npm run lint` do projeto inteiro está vermelho, mas nenhum erro vem de `src/`: são
  `.deploy-live/`, `.deploy-auth/`, `.next-review/`, `.claude/worktrees/` e `data/sources/`, que o
  `eslint.config.mjs` não ignora. Config, não código.
- Em produção, a migration a aplicar é a **0009 (shards)**, não a 0008: as 607 mil ocorrências
  relacionais ocupam ~290 MB com índices e não cabem no plano do Supabase.
- A verificação integral passou: 469.476 ocorrências hebraicas, 137.741 gregas, 8.674 verbetes
  hebraicos e 10.847 verbetes gregos. As anomalias conhecidas são classificadas como notas da
  própria fonte, sem dado inventado.
- `stepbible-tflsj` está no registro sem ativos declarados: a decisão de usá-la não foi tomada.

Detalhamento completo em `docs/LEXICON_PIPELINE.md`.

**Para validação por outro agente:** `tasks/product/LEXICON-INDEX-001-validacao-gpt.md` — resultado
desta entrega com as decisões de desenho a contestar, os defeitos encontrados, as limitações não
corrigidas e as seis perguntas que aguardam resposta.
