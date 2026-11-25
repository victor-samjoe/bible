# LEXICON-INDEX-001 (C30) — resultado para validação

**De:** sessão Claude Code CLI — 24/11/2026, 21:56
**Para:** agente GPT/Codex que retomar a frente
**Pedido:** **validar e devolver**, não re-executar. O que preciso de volta está na seção 7.

---

## 0. Antes de qualquer coisa, três avisos operacionais

1. **Nada está commitado.** Todo o trabalho desta frente está na árvore de trabalho, em `main`
   (HEAD = `98056d1`). O que você vai validar é a árvore, não um commit. Não commitei porque não
   houve ordem para isso e porque a árvore é **compartilhada**: há outra frente (grafo de versos /
   `ALIGNMENT-PIPELINE-001`) mexendo nos mesmos diretórios no mesmo período.
2. **O `.git` é de outro usuário Windows.** `E:/SamJoE Bible/.git` pertence a
   `Victor_e_Eloa/CodexSandboxOffline`; rodando como `Victor`, qualquer comando git falha com
   `dubious ownership`. Contornei por chamada, sem gravar config global:
   `git -c safe.directory="E:/SamJoE Bible" status`. Decida você se quer a exceção permanente — eu
   não alterei config do usuário.
3. **Nenhuma migration foi aplicada em produção e nenhum `.env*` foi tocado.** Toda validação de
   banco foi em Postgres descartável em container, destruído no fim. A regra da fila continua
   valendo: `0009` em produção **só com ordem operacional explícita**, e a `0008` não vai para
   produção nunca (é curadoria/offline).

---

## 1. O que está entregue, e como conferir cada afirmação

Marquei a procedência de cada número: **(re-verificado hoje)** = rodei agora; **(execução
registrada)** = saída da execução anterior, anotada em `docs/IMPLEMENTATION_LOG.md`, não
re-derivada neste momento.

| Afirmação | Como conferir |
| --- | --- |
| Typecheck limpo; **416 testes em 43 arquivos** passando **(re-verificado hoje, 21:56)** | `npm run typecheck` e `npx vitest run` |
| Parser hierárquico do BDB: **11.845 verbetes, 8.989 acepções, até 5 níveis** **(execução registrada)** | `npx vitest run tests/importers/lexicon-bdb.test.ts` (12 testes) e `scripts/verify-lexicon-sources.ts` |
| Índice integral: **607.217 ocorrências, 19.521 verbetes** **(execução registrada)** | `node --max-old-space-size=6144 --experimental-strip-types scripts/build-lexicon-index.ts` |
| **537 glossas** pt-BR em `machine_draft` (Gênesis 1 e João 1); **nenhuma** `approved` **(execução registrada)** | `node --experimental-strip-types scripts/translate-lexicon.ts --status` |
| **1.189 shards** de capítulo reconstruídos com `lexemeKey` como 11º campo **(execução registrada)** | `scripts/build-lexicon-chapter-shards.ts` e o campo `[10]` em `src/server/lexicon/repository.ts:57` |
| Painel mostra árvore de acepções, estado de revisão e crédito de fontes | `npx vitest run tests/server/lexicon-reader-bdb.test.ts` (11 testes) + seção 6 |
| Com `LEXICON_PREVIEW_DRAFTS` desligado, rascunho não aparece em lugar nenhum da resposta | teste `"em produção não expõe rascunho nem o método que o gerou"`, e seção 6 |

Arquivos centrais, para você saber onde olhar sem varrer o repo:

```
src/domain/lexicon/word-analysis-view.ts    251 linhas   precedência do significado + ReviewState
src/server/lexicon/reader.ts                271          contrato da leitura + creditsFor()
src/server/lexicon/repository.ts            245          as quatro consultas
src/server/lexicon/runtime.ts                23          o flag, lido só no servidor
src/importers/lexicon/oshb-bdb.ts           352          parser recursivo do BDB
app/biblia/original-panel.tsx               389          árvore <details>, rótulos, créditos
app/api/biblia/lexico/route.ts               18          endpoint GET
drizzle/0008_lexical_index.sql              232          curadoria/offline
drizzle/0010_bdb_senses.sql                 105          acepções + domínios sdbh/lexdomain
scripts/translate-lexicon.ts                475          laço de tradução por livro, retomável
scripts/import-lexicon-index.ts             563          importação transacional e idempotente
tests/server/lexicon-reader-bdb.test.ts     286          11 testes desta entrega
```

---

## 2. Decisões de desenho que quero **contestadas**

Aqui é onde sua validação vale mais do que repetir comandos. Em cada item digo a alternativa que
recusei e por quê; se discordar, discorde com o motivo.

**2.1 Três consultas em vez de embutir tudo no shard.**
Estrutura (forma, lema, morfologia, domínio, glossa) vem do shard por capítulo; **tradução e
acepções vêm das tabelas, ao vivo**. A alternativa — assar tradução e acepções no payload do
capítulo — tem uma consulta só e seria errada: o shard é instantâneo com `source_sha256` próprio, e
estado de revisão muda por decisão humana. Aprovar um verbete deixaria 1.189 shards obsoletos sem
nada no hash indicando isso. Custo aceito: duas consultas extras por leitura, por chave.

**2.2 `lexemeKey` como 11º campo do shard, em vez de casar por grafia do lema.**
Ligar ocorrência a verbete por semelhança de grafia seria adivinhar — é exatamente o que o
`LexicalIndex.xml` existe para evitar. Custo: os 1.189 shards tiveram de ser reconstruídos.

**2.3 `ReviewState` separado de `MeaningSource`.**
São perguntas diferentes: "de onde veio" e "alguém conferiu". O caso que força a separação: a
definição do BDB vem de obra publicada e revisada por lexicógrafos, mas **sem tradução para
português conferida** — logo é `source_text`, não `approved`. Quatro estados:
`editorial_reviewed` > `approved` > `unreviewed_draft` > `source_text`.

**2.4 Regra da parte mais fraca.**
Se um morfema da palavra não tem tradução, a **palavra inteira** cai para a glossa da fonte; se um
está em rascunho, a palavra inteira é rotulada rascunho. Motivo: o leitor vê um texto só, não duas
procedências. Isso faz a cobertura exibida ser menor que a cobertura do armazém — é intencional, e é
o tipo de coisa que você pode achar excessivamente conservador.

**2.5 Crédito fechado, mapeamento campo → fonte fixo em código.**
`SOURCE_IDS` é lista fechada e o mapa campo → fonte é fixo (`reader.ts:56`), porque é propriedade do
desenho do pipeline, não do dado. Mas o **texto de licença e atribuição é buscado da tabela de
fontes**: fonte sem linha registrada não é creditada com texto escrito em código (há teste para
isso). A alternativa — proveniência por campo no shard — repetiria o mesmo bloco de crédito em 607
mil linhas.

**2.6 Pré-visualização decidida no servidor, nunca por query string.**
`LEXICON_PREVIEW_DRAFTS` é lido em `runtime.ts`. Se fosse parâmetro de URL, qualquer visitante veria
texto não revisado trocando a URL e o aviso de revisão pendente deixaria de significar algo.

**2.7 Recusei o laço de consultas na internet** que havia sido levantado como caminho para
traduções mais contextualizadas. Motivo: material de licença desconhecida entrando em obra
derivada, sem pino nem hash — quebra a disciplina de proveniência que sustenta o resto da frente.
Redirecionei para o BDB, que já estava em disco, sob CC BY 4.0, com commit pinado e SHA-256
congelado. **Esta é a decisão que mais quero que você confirme ou derrube.**

---

## 3. Defeitos reais que encontrei no caminho (re-confira estes)

1. **As traduções nunca chegavam à tela.** Quando a leitura passou a usar shards, o repositório
   ficou com `translation: null` fixo e `lexemeKey: ""`. Consequência: `meaningSource` só podia
   valer `source_gloss`, então o rótulo de rascunho no painel era **código morto** e nenhuma das 537
   glossas era alcançável. O comentário de cabeçalho ainda descrevia dois `LEFT JOIN` que o código
   não fazia mais. Corrigido com as quatro consultas + `lexemeKey` no shard.
2. **Erro meu, de fato:** afirmei "seis níveis" de acepção no BDB. A profundidade real é **cinco** —
   meu contador não reiniciava por verbete e dois `<sense/>` autofecháveis inflavam a conta.
   Corrigido em `records.ts`, `source-registry.ts` e `oshb-bdb.ts`.
3. **Erro meu, de fato:** dois pontos de chamada de `lexiconIndexLines` divergiram, então o sha256
   relatado do índice não era o do arquivo escrito. Unificado em `allLines()`; confirmei o digest
   por fora, em Python.
4. **Dois dos meus testes nasceram errados e o código estava certo.** Eu os escrevi contra Gênesis
   1:1, que **tem** nota editorial revisada, e ela vence qualquer tradução por projeto. Passaram a
   usar 1:2. Vale conferir se eu não "consertei" o teste no lugar de um bug real — na minha leitura
   não, mas é exatamente o erro que um validador deve procurar.
5. `ON CONFLICT DO UPDATE command cannot affect row a second time` na importação: havia 3 pares
   `(lexeme_key, bdb_id)` duplicados. Deduplico e **relato a contagem**, em vez de silenciar.

---

## 4. Limitações conhecidas, não corrigidas de propósito

- **Sem concordância de gênero no rascunho.** A tradução é por morfema: "and the earth" sai como
  "e o terra" em Gênesis 1:2. É defeito real, visível só na pré-visualização. Não corrigi caso a
  caso porque seria maquiar o sintoma; a correção certa é revisão humana ou alinhamento com a
  BLIVRE. **Se você discordar, este é um bom lugar para discordar.**
- **Nada está `approved`.** As 537 traduções seguem `machine_draft`; o público não vê nenhuma.
- **O resto da Bíblia não tem como ser traduzido à mão:** restam 60.146 glossas distintas e ~27 mil
  campos de verbete. Os 100 lemas mais frequentes cobrem 58% do texto e os 1.000 cobrem 85%, então
  há caminho incremental — 100% exige motor de tradução automática com chave de API e **custo
  aprovado**, que não existe. O formato de lote já aceita esse motor sem mudar o armazém.
- `tests/importers/blivre.test.ts` precisa de `testTimeout` próprio: lê o corpus local inteiro e
  estoura os 5000 ms padrão do vitest sob carga paralela. Não é meu arquivo e não o toquei.
- `npm run lint` do projeto inteiro está vermelho, **mas nenhum erro vem de `src/`**: é
  `.deploy-*/`, `.next-review/`, `.claude/worktrees/` e `data/sources/` fora do `ignores` do
  `eslint.config.mjs`. Config, não código.
- `stepbible-tflsj` está no registro sem ativos declarados — a decisão de usá-la não foi tomada.

---

## 5. Prova de ponta a ponta já feita

Postgres descartável em container, migrations `0000`–`0010` aplicadas, índice relacional e os 1.189
shards importados, `next dev` apontado para ele:

- `GET /api/biblia/lexico?book=genesis&chapter=1&verses=1` → português da nota editorial revisada
  (que vence a máquina, por projeto), acepções do BDB por palavra **4, 8, 12, 0, 7, 0, 22**, e
  crédito de `macula-hebrew`, `oshb-bdb` e `oshb-hebrewlexicon`.
- Gênesis 1:2 (sem nota revisada) → `unreviewed_draft` com o método declarado; `הָיָה` com suas 32
  acepções em 5 níveis.
- **Mesma consulta com `LEXICON_PREVIEW_DRAFTS` desligado** → só `source_text`, nenhum
  `draftMethod`, e o texto do rascunho ausente de toda a resposta.

---

## 6. Comandos para você reproduzir

```bash
npm run typecheck
npx vitest run
npx vitest run tests/server/lexicon-reader-bdb.test.ts      # 11 testes desta entrega
npx vitest run tests/importers/lexicon-bdb.test.ts          # 12 testes do parser do BDB
npx vitest run tests/domain/lexicon-word-analysis-view.test.ts
node --experimental-strip-types scripts/verify-lexicon-sources.ts
node --experimental-strip-types scripts/translate-lexicon.ts --status
```

Banco descartável — **nunca em produção**:

```bash
docker run -d --name c30pg -e POSTGRES_PASSWORD=c30 -e POSTGRES_DB=c30 -p 55432:5432 postgres:16-alpine
# aplicar 0000–0010 (0000_initial.sql tem BOM UTF-8; remover antes)
DATABASE_URL="postgresql://postgres:c30@127.0.0.1:55432/c30" \
  node --max-old-space-size=6144 --experimental-strip-types scripts/import-lexicon-index.ts
docker rm -f c30pg
```

---

## 7. O que preciso de volta

1. **A recusa do laço de consultas na internet (2.7) procede?** É a decisão de maior consequência
   da entrega: ela limita a qualidade da tradução em troca de proveniência rastreável.
2. **A regra da parte mais fraca (2.4) é conservadora demais?** Ela reduz o que o leitor vê abaixo
   do que o armazém tem.
3. **"e o terra" (seção 4): deixar para revisão humana, ou gerar no nível da palavra em vez do
   morfema?** Mudar a granularidade é mexer no armazém, não no painel — por isso não decidi sozinho.
4. **Os dois testes que eu movi de 1:1 para 1:2 (3.4) escondem algum bug?** Peço olhar adversarial.
5. **A separação das três consultas (2.1) aguenta produção**, com os shards e o Worker na
   Cloudflare, ou duas idas extras ao Postgres por leitura são caras demais ali?
6. Confirmação de que você **não encontra** caminho pelo qual `machine_draft` chegue ao leitor com
   `LEXICON_PREVIEW_DRAFTS` desligado. Tenho teste, mas quero um segundo par de olhos.

Não precisa de validação (são portões do proprietário, não técnicos): aplicar `0009` em produção,
aprovar as 537 traduções e aprovar custo de motor de tradução.

Detalhamento completo em `docs/IMPLEMENTATION_LOG.md` (entrada de 24/11) e
`docs/LEXICON_PIPELINE.md`. Estado da tarefa em `tasks/product/LEXICON-INDEX-001-preparacao.md`.
