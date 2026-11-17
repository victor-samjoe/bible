# Fila de execução — Claude CLI

**Regra geral:** executar uma tarefa por vez, na ordem. Não decidir escopo, licenças, produto, arquitetura ou publicação. Não usar rede, não aplicar migration remota, não fazer deploy, não modificar `.env*`, não expor segredos, não fazer commit sem ordem explícita. Preservar alterações paralelas e parar em conflito.

## Tarefa C1 — resolver migrations locais

- Objetivo: resolver a colisão entre `drizzle/0002_blivre_query_indexes.sql` e `drizzle/0002_reading_personal_data.sql`.
- Ação: manter o índice BLIVRE como `0002`; renumerar somente a migration de dados pessoais para `0003_reading_personal_data.sql`; revisar referências locais se existirem.
- Não aplicar banco remoto.
- Aceite: uma sequência única `0000`–`0003`, SQL aditivo, `git diff --check` e typecheck quando o ambiente permitir.

## Tarefa C2 — integrar ferramentas ao leitor

- Objetivo: integrar `app/biblia/reader-tools.tsx`, seus CSS e preferências ao leitor em `app/biblia/page.tsx`.
- Manter o texto principal como protagonista e menu secundário.
- Declarações obrigatórias: NVI, NTLH e Almeida aparecem como `Em licenciamento`; notas, destaques e progresso devem dizer `local nesta sessão` até Auth/persistência real.
- Não criar texto bíblico adicional, não alterar licenças, não ligar dados falsos.
- Aceite: controles de fonte/tamanho/espaçamento/tema funcionam client-side; ações de versículo abrem painel local; typecheck/lint quando possível.

## Tarefa C3 — API de leitura BLIVRE

- Objetivo: criar contrato server-side mínimo para obter livros, capítulos e versículos publicados da tradução BLIVRE.
- Arquivos permitidos: `src/server/bible/**`, `src/server/contracts/**`, testes correspondentes e documentação.
- Entrada deve ser injetável/testável; falhar fechada sem configuração de banco; nunca enviar segredos ao cliente.
- Não alterar UI nem aplicar banco remoto.
- Aceite: consultas validadas por livro/capítulo, ordenação canônica, somente versículos `published`, testes com fixtures.

## Tarefa C4 — leitor conectado ao corpus

- Só iniciar após C3 e após o operador confirmar que o banco contém `66/1189/31102` BLIVRE.
- Objetivo: substituir o capítulo fixo pelo leitor de qualquer livro/capítulo via URL e seletor.
- Manter atribuição BLIVRE visível e não prometer versões bloqueadas.
- Não implementar notas persistentes nesta tarefa.
- Aceite: navegação por livro/capítulo, referência canônica, URL compartilhável, estados de erro/vazio e layout mobile.

## Tarefa C5 — persistência pessoal autenticada

- Só iniciar quando Auth Supabase estiver integrado de fato.
- Objetivo: conectar notas, destaques, progresso e preferências às tabelas pessoais com RLS já definidas.
- Não usar identidade do cliente como autorização; autenticar no servidor; sem acesso anônimo a registros pessoais.
- Aceite: criar/editar/remover apenas os próprios dados; testes de RLS/isolamento; fallback local claro quando deslogado.

## Tarefa C6 — contexto e originais

- Só iniciar depois de fontes WLC/OSHB/SBLGNT terem sido aprovadas e importadas com checksum/licença.
- Objetivo: painel de contexto por livro e consulta de palavra/trecho para dados lexicais verificáveis.
- Não inventar grego/hebraico, glossas ou morfologia; cada resposta deve trazer fonte/edição/atribuição.
- Aceite: dados vêm de fonte versionada, UI diferencia texto original de interpretação e entradas sem fonte retornam indisponível.

## Tarefa C7 — BKF próximo passo

- Objetivo: executar somente BKF-P0-002 após revisar `docs/BKF_EXECUTION_BACKLOG.md` e C1.
- Não aplicar Supabase remoto nem implementar P0-003+.
- Aceite: migration BKF aditiva, schema coerente, testes/registro real em `docs/IMPLEMENTATION_LOG.md`.

## Tarefas posteriores

- **C8 — QA mobile:** testar raiz → leitor, cabeçalho fixo, menu acessível, temas e viewport móvel após C2/C4.
- **C9 — Busca bíblica:** endpoint server-side lexical BLIVRE com referência, limites e ordenação após C3/C4.
- **C10 — Biblioteca pessoal:** telas de notas, cores e leitura concluída somente após C5/Auth real.
- **C11 — Catálogo histórico:** integrar pipeline e catálogo somente após BKF-P0-002 e aprovação humana por edição; não baixar nem decidir direitos.
- **C12 — Preparação de release:** revisar PWA/APK, manifests, ícones, privacidade e checklist de lojas após C4/C8; sem publicar em lojas.

## C13 — Seleção múltipla e ações de leitura

Substituir o toque que abre painel por seleção múltipla no texto. Livro escolhido deve abrir capítulos imediatamente. Uma barra discreta só aparece com seleção e oferece destaque por cores, nota, comparação, original e limpar; versões/originais respeitam licença e indisponibilidade. “Lido” passa a ser estado de capítulo. Três pontos ficam exclusivamente para tema, fonte, tamanho (inclusive menor) e espaçamento. Estado segue local por capítulo até Auth real; atualizar testes e não fazer deploy/commit.

## C14 — Corpora originais

Importar WLC (hebraico), OSHB/MorphHB (morfologia hebraica) e SBLGNT (grego) apenas a partir de fontes oficiais verificáveis. Registrar licença, atribuição, versão/commit, URL e checksum antes de baixar. Separar texto, morfologia e futuros léxicos; não inventar glossas. Criar contratos, migrations, importadores idempotentes e testes locais; corpus privado, sem app, Supabase remoto, deploy ou commit.

## C15 — App shell e dashboard

Depois de C13, criar menu lateral responsivo e dashboard de continuidade: retomar leitura, leituras concluídas, novidades e acesso às áreas Bíblia, Materiais, Notas, Estudos, Cursos, Planos e Perfil. Sem dados inventados, Auth, banco ou deploy.

## C16 — Conteúdo e cursos

Criar catálogos UI/contratos para materiais, estudos/análises e cursos por tema (módulos, lições, leituras e progresso), usando fixtures claramente marcadas. Sem conteúdo premium, fontes inventadas, banco ou checkout.

## C17 — Conta e segurança

Criar telas/contratos de login, cadastro, recuperação, perfil e 2FA com integração pendente. Sem simular Auth, guardar senhas, e-mail ou deploy.

## C18 — Cobrança neutra

Criar contratos e testes para planos, assinaturas, webhooks e entitlements; falha fechada e reutilização de `canAccess`. Sem provedor, credenciais, checkout ou cobrança real.

## C19 — BKF localhost

Criar painel HTML interno que roda somente em localhost para organizar o acervo: pastas privadas, materiais, autor/obra/edição, direitos, hashes, ingestão, análises, revisões e bloqueios. Sem deploy, login externo, banco remoto, MCP, download ou publicação. Somente fixtures e arquivos locais autorizados; documentação de execução e testes básicos obrigatórios.


---

# Relatório de execução — Claude CLI, 17/11/2026

Resposta à fila acima. O detalhe de cada frente está em `docs/IMPLEMENTATION_LOG.md`, em quatro entradas: C1, C2, C3 e C7/BKF-P0-002.

## Situação por tarefa

| Tarefa | Situação | Observação |
| --- | --- | --- |
| C1 — migrations locais | **concluída** | sequência única `0000`–`0003`; nenhum código citava os nomes |
| C2 — ferramentas do leitor | **concluída e verificada** | 21/21 checagens de navegador, no estado anterior ao commit `bc2d4fb` |
| C3 — API BLIVRE | **concluída** | 14 testes; UI intocada, como pedido |
| C4 — leitor com corpus | **bloqueada** | depende de o operador confirmar 66/1189/31102 no banco |
| C5 — dados pessoais | **bloqueada** | depende de Auth Supabase real; `@supabase/supabase-js` não está instalado |
| C6 — contexto e originais | **bloqueada** | depende de WLC/OSHB/SBLGNT aprovados e importados com checksum/licença |
| C7 — BKF-P0-002 | **concluída e validada em Postgres local** | 37/37 provas; migration idempotente |

Nada foi commitado por esta frente. Nenhuma migration aplicada em Supabase remoto. Nenhuma rede usada. `.env*` intocado.

## C1 — colisão de migrations

`drizzle/0002_reading_personal_data.sql` passou a `drizzle/0003_reading_personal_data.sql`; o índice BLIVRE segue como `0002`. O SQL não foi alterado, apenas o prefixo de ordem. Busca em toda a árvore: nenhum código, teste, script ou configuração cita nomes de migration — apenas documentação, atualizada em `docs/MVP_RELEASE_GATES.md` (P-10, X-03, B-06 e Fase A passo 2).

Pendência que continua: não existe `drizzle/meta/_journal.json`, então `npm run db:migrate` ainda não aplica nem rastreia esses SQL escritos à mão. A ordem agora é determinística, mas a aplicação segue manual. Criar o journal é decisão do proprietário.

## C2 — ferramentas do leitor

As ferramentas existiam como enfeite: os botões apenas exibiam avisos, as preferências iam direto para `document.documentElement.style` e eram perdidas ao recarregar, e uma das mensagens prometia sincronizar notas ao entrar na conta — conta que não existe.

Agora há estado real de sessão em `app/biblia/reader-state.tsx`, provider único de preferências, tema, versículo selecionado, destaques, notas e progresso, gravando em `sessionStorage` dentro de try/catch. O capítulo saiu do JSX para `app/biblia/chapter-data.ts` e é renderizado por `app/biblia/reader-chapter.tsx`, onde cada versículo é alvo de toque que abre o painel local na aba Versículo. `theme-toggle.tsx` passou a consumir o mesmo estado, e o tema entrou também no painel, porque o cabeçalho o esconde em tela pequena.

Texto bíblico: nenhum versículo criado, alterado, traduzido ou acrescentado. `chapter-data.ts` contém exatamente o mesmo trecho de Gálatas 1 (BLIVRE, CC BY 4.0 BR) que já estava escrito em `page.tsx`, com a atribuição no topo do arquivo. Licenças não foram tocadas.

Declarações obrigatórias cumpridas: NVI, NTLH e Almeida aparecem desabilitadas como `Em licenciamento`, sem data prometida; notas, destaques, progresso e preferências dizem "local nesta sessão"; Contexto e Original respondem indisponível por falta de fonte licenciada e verificada, sem inventar grego, hebraico, glossa ou morfologia.

Verificação em build de produção, com o Chromium já presente no cache do Playwright e script temporário fora do repositório: 21 de 21 checagens. Painel abre ao tocar no versículo, referência correta (Gálatas 1:7), destaque/leitura/nota refletidos no texto e no contador, três traduções em licenciamento e desabilitadas, tamanho de 21,28px para 25,28px, espaçamento de 45,0 para 50,6px, fonte Georgia para Arial, tema claro aplicado, preferências e marcas sobrevivendo ao recarregar na mesma aba, sessão nova começando limpa, atribuição BLIVRE visível e nenhum erro de console.

## C3 — API de leitura BLIVRE

Arquivos: `src/server/contracts/bible.ts` (tipos, interface de repositório, schemas Zod e projeções puras), `src/server/bible/reader.ts` (serviço injetável), `src/server/bible/repository.ts` (consultas Drizzle, somente SELECT), `blivre.ts`, `runtime.ts` (único ponto que toca banco), `index.ts`, `tests/server/bible.test.ts` e `docs/BIBLE_READ_API.md`.

Falha fechada: sem `HYPERDRIVE` nem `DATABASE_URL`, o leitor responde `unavailable` a tudo, sem lançar. Exceção do repositório também vira `unavailable`, e há teste provando que uma mensagem contendo `postgres://user:senha@...` não aparece no resultado. Tradução sem `status = approved` ou sem atribuição não serve texto algum, e nesse caso o serviço nem consulta versículos. `published = false` é filtrado na consulta e de novo no contrato. Linha de outra tradução, de outro livro ou de outro capítulo é descartada. O resultado expõe apenas `id`, `number` e `content` do versículo. A ordenação canônica é imposta pelo contrato, não pela confiança na cláusula SQL.

Nenhuma rota, página ou componente chama `getBlivreReader()`: a UI segue intocada, como C3 determina.

## C7 — BKF-P0-002

Desvio de numeração registrado: o backlog previa `drizzle/0002_bkf.sql`, mas `0002` e `0003` estão ocupados depois do C1. A migration foi criada como `drizzle/0004_bkf.sql`.

Entregue: as 10 tabelas pedidas (`bkf_editions`, `bkf_rights`, `bkf_artifacts`, `bkf_sections`, `bkf_fragments`, `bkf_jobs`, `bkf_evidence`, `bkf_documents`, `bkf_document_revisions`, `bkf_reviews`), 8 tipos enum com valores idênticos aos de `src/domain/bkf/contracts.ts`, FKs para `works`, `sources`, `licenses`, `profiles`, `studies`, `study_versions` e `source_locations` existentes (sem criar segundo catálogo público), chaves únicas, CHECKs, índices e 3 gatilhos de imutabilidade. Mais o mapeamento em `drizzle/schema.ts`, o catálogo em `src/server/bkf/catalog.ts`, a persistência em `src/server/bkf/repository.ts` e os testes em `tests/bkf/catalog.test.ts`.

Direitos negam por padrão dentro do banco: nenhuma permissão pode ser verdadeira sem status `APPROVED_LIMITED` ou `APPROVED_FULL`; aprovação exige prova, responsável e data de verificação; citação exige os três limites de palavras; distribuição pública exige aprovação; janela de validade invertida é recusada; documento só chega a `PUBLISHED` com `study_id` do domínio SamJoE; job `BLOCKED` exige motivo registrado. O catálogo repete a decisão em código reutilizando `canStore`, `canAutomatedProcess` e `canQuote` de BKF-P0-001, sem duplicar a política.

Imutabilidade e deduplicação: unique de (edition_id, original_sha256, extraction_version) em `bkf_artifacts`, unique por intervalo em `bkf_fragments`, unique por (document_id, version) e por (document_id, content_sha256) em `bkf_document_revisions`. Gatilhos recusam UPDATE e DELETE em artefatos, fragmentos e revisões. `bkf_evidence` segue mutável de propósito, porque a verificação humana muda de estado.

Validação em Postgres local descartável, sem rede e sem Supabase remoto: contêiner a partir de imagem já em cache, publicado apenas em 127.0.0.1, criado e removido na mesma sessão. As cinco migrations aplicaram em ordem; 37 de 37 provas de integridade passaram, cobrindo caminho feliz nas 10 tabelas, violações de FK, de unique e de CHECK de direitos, enum inválido, intervalos inválidos, caminho de armazenamento inseguro, tentativa de mutação em registro imutável, `ON DELETE RESTRICT`, rollback sem resíduo e compatibilidade com o seed BLIVRE, com os índices do `0002` e com as tabelas do `0003`. A migration `0004` rodou três vezes com contagem idêntica de objetos (10 tabelas, 28 índices, 77 constraints, 3 gatilhos, 8 enums), confirmando idempotência. `drizzle/schema.ts` bate coluna a coluna com o banco validado: 10 de 10 tabelas, 109 colunas.

## Três pontos para o GPT decidir ou encaminhar

1. **Build quebrado por commit concorrente, não por esta frente.** Às 15:45:30 o processo concorrente criou `bc2d4fb` ("feat: add reader controls and fixed bible navigation", autor `SamJoE Tech & Consulting`), que levou os arquivos do C2 junto com um ajuste próprio de cabeçalho e trocou `next/link` por `<a>` em `app/biblia/page.tsx`. Como `next build` roda o lint, `npm run lint` e `npm run build` passaram a falhar com 4 erros `@next/next/no-html-link-for-pages`, nas linhas 41, 50, 53 e 122. Correção: trocar os quatro `<a>` por `Link` e reimportar `next/link`. Esta frente não alterou, reverteu nem commitou aquele arquivo, seguindo a regra de preservar alterações paralelas e parar em conflito.

2. **Achado em BKF-P0-001.** `RightsSchema` usa `z.string().min(1)` sem `trim`, então `verified_by` ou `proof` com apenas espaços passam pelo contrato e pela política, enquanto o CHECK de `0004_bkf.sql`, que usa `btrim`, recusaria a mesma linha. `projectRights` em `src/server/bkf/catalog.ts` apara os campos antes de validar, para que contrato, catálogo e banco concordem. A correção na raiz pertence a `src/domain/bkf/**`, fora dos arquivos permitidos do C7.

3. **A migration `0003` não roda em Postgres puro.** Ela usa `auth.uid()`, do schema `auth` do Supabase. Na validação local foi necessário criar um stub de `auth.uid()` apenas no banco descartável. Não é defeito, é dependência de Supabase — mas significa que validar `0003` fora do Supabase exige esse stub, e vale registrar antes de qualquer aplicação.

Observação pendente de decisão de produto: o `metadata.title` de `app/biblia/page.tsx` continua dizendo "Leitor bíblico em preparação" enquanto a página exibe versículos, e o bloco `.legacyBible` segue oculto no DOM (X-02 da auditoria). Corrigir isso é afirmação de produto e não foi decidido por esta frente.

## Estado verificado da árvore ao fim

- `npm run typecheck` passou.
- `npm run test` passou: 70 testes em 10 arquivos.
- `git diff --check` passou.
- `npm run lint` e `npm run build` falham pelos 4 erros do item 1, em arquivo de outra frente.
- A reverificação do C2 por navegador não pôde ser repetida depois de `bc2d4fb`: o build está bloqueado e o `next dev` concorrente mantém o lock do miniflare (`SQLITE_BUSY`). O 21/21 vale para o estado anterior àquele commit; a estrutura (`ReaderProvider`, `ReaderChapter`, `ReaderTools`, `ThemeToggle`) foi preservada por ele, e typecheck e testes continuam verdes.

## Próximo passo sugerido

C4 é a próxima da fila, mas exige que o operador confirme 66 livros, 1189 capítulos e 31102 versículos no banco. A API do C3 já está pronta para ser consumida. Antes disso, convém corrigir o item 1 para devolver `lint` e `build` ao verde.

---

# Adendo ao relatório — 17/11/2026, depois de C8–C12 entrarem na fila

## Leitura das tarefas novas

C8 a C12 foram lidas. Todas estavam bloqueadas no momento em que entraram:

- **C8** (QA mobile) exige C2 e **C4**;
- **C9** (busca bíblica) exige C3 e **C4**;
- **C10** (biblioteca pessoal) exige **C5**, logo Auth real;
- **C11** (catálogo histórico) exige BKF-P0-002, que o C7 entregou, **mais aprovação de uma edição por arquivo pelo operador**;
- **C12** (preparação de release) exige **C4 e C8**.

Ou seja, quatro das cinco dependiam do mesmo portão: o C4.

## O portão do C4 está satisfeito

Com autorização do operador, foi feita leitura — **somente leitura** — do banco apontado por `DATABASE_URL` em `.env.local`, com a sessão travada em transação read only. Nenhuma escrita, migration ou importação.

O banco (PostgreSQL 17.11) contém: `books` = **66**, `chapters` = **1189**, `verses` = **31102**, todos os 31102 publicados, e a tradução BLIVRE com status `approved`. O corpus local também foi validado em separado: `data/generated/blivre.json` responde `{"valid":true,"books":66,"chapters":1189,"verses":31102}`.

Portanto o requisito "após o operador confirmar que o banco contém 66/1189/31102" tem evidência objetiva. Falta a confirmação formal para iniciar o C4 — e, em cascata, C8, C9 e C12.

## O que está aplicado no banco remoto, e o que não está

Aplicados: `0000_initial` e `0001_seed_blivre`, mais a importação do corpus. **Não aplicados:** `0002_blivre_query_indexes` (os 3 índices), `0003_reading_personal_data` (dados pessoais com RLS) e `0004_bkf` (as 10 tabelas BKF). Não existe `drizzle.__drizzle_migrations` no remoto: as migrations foram aplicadas à mão.

Dois efeitos práticos:

1. Sem os índices do `0002`, as consultas do contrato C3 varrem tabela. Com 31102 versículos ainda responde, mas é o primeiro ajuste de desempenho quando houver autorização de escrita em produção.
2. Antes de usar `npm run db:migrate` contra o Supabase, é preciso marcar `0000` e `0001` como já aplicadas (baseline). Sem isso, o drizzle tentaria recriar objetos existentes e falharia. Essa decisão é do proprietário.

## Itens fechados neste ciclo

- **Build e lint de volta ao verde.** `app/biblia/page.tsx` voltou a usar `Link` de `next/link` nos seis links internos que o commit `bc2d4fb` trocou por `<a>`; o link externo do eBible.org segue como `<a>`. Layout, cabeçalho e seletor do processo concorrente foram preservados. `lint`, `typecheck`, `build` e os 70 testes passam.
- **`drizzle/meta/_journal.json` criado e testado.** As cinco migrations em ordem, com `when` igual ao mtime real de cada arquivo. Testado em Postgres local descartável: `migrate` aplica as cinco, registra em `drizzle.__drizzle_migrations` e a segunda execução é no-op.
  **Porém:** `npm run db:migrate` ainda falha, por um **BOM UTF-8** no início de `drizzle/0000_initial.sql` (`syntax error at or near`, SQLSTATE 42601). O `psql` tolera o BOM, o driver `pg` que o drizzle usa não. Provado numa cópia fora do repositório: removido só o BOM, o migrate responde `MIGRATE OK` e aplica tudo. **Não alterei a migration existente** — remover o BOM não muda uma linha de SQL, mas é alteração de migration e depende de ordem explícita.

## Bloqueios que continuam, e de quem dependem

| Item | Depende de |
| --- | --- |
| C5 e C10 | `SUPABASE_ANON_KEY` e as outras chaves estão **vazias** em `.env.local`, e `@supabase/supabase-js` não está instalado. É Auth, não banco. |
| C6 | WLC/OSHB/SBLGNT aprovados e importados com checksum e licença. |
| C11 | o operador aprovar uma edição por arquivo, com prova documental de direitos. |
| `db:migrate` | decisão sobre o BOM do `0000` e sobre o baseline do remoto. |
| índices do `0002` no remoto | autorização de escrita em produção. |

---

# Adendo 2 ao relatório — C4, C8, C9 e C12 executadas

Autorizações do operador neste ciclo: confirmar as contagens e iniciar o C4;
remover o BOM do `0000_initial.sql`; aplicar `0002`, `0003` e `0004` no Supabase.

## Situação atualizada

| Tarefa | Situação |
| --- | --- |
| C1 | concluída |
| C2 | concluída e verificada |
| C3 | concluída |
| **C4** | **concluída e verificada contra o corpus real (30/30 no navegador)** |
| C5 | **bloqueada**: chaves do Supabase vazias em `.env.local` e `@supabase/supabase-js` não instalado |
| C6 | **bloqueada**: WLC/OSHB/SBLGNT não aprovados nem importados |
| C7 | concluída e validada em Postgres local |
| **C8** | **concluída**: 13 testes E2E, primeiro do projeto; fecha B-08 |
| **C9** | **concluída**: contrato, endpoint e 15 testes; verificada contra o banco |
| C10 | **bloqueada**: depende de C5 |
| C11 | **bloqueada**: depende de o operador aprovar uma edição por arquivo |
| **C12** | **concluída**: PWA validada (15/15), B-02 corrigido, documentação atualizada |

## Banco de produção

Aplicados `0002` (3 índices), `0003` (4 tabelas pessoais, RLS habilitada e 4
políticas) e `0004` (10 tabelas BKF, 3 gatilhos de imutabilidade), com preflight
antes e verificação depois. Corpus intacto: 66/1189/31102. O journal remoto foi
baselineado com as 5 migrations, e `db:migrate` contra produção agora é **no-op
limpo** — B-06 fechado de ponta a ponta. O BOM do `0000_initial.sql` saiu (3 bytes,
nenhuma linha de SQL alterada), que era o que impedia o `db:migrate` de rodar.

## O que mudou no leitor (C4)

Capítulo fixo removido do código, inclusive o arquivo que guardava Gálatas 1 e o
bloco oculto que afirmava não exibir versículos. O leitor lê qualquer livro e
capítulo do corpus por `/biblia/[book]/[chapter]`, com seletor de livro e de
capítulo (os botões que existiam sem ação agora navegam), anterior/seguinte
atravessando a fronteira de livro, URL compartilhável, 404 para referência
inexistente e painel honesto de indisponibilidade quando o banco não responde —
sem texto de reserva. A atribuição no rodapé vem do campo `attribution` da própria
tradução aprovada no banco, e a atribuição obrigatória foi acrescentada em
`/direitos-autorais`, que era texto-marcador sem ela.

Marcas de sessão passaram a ser por capítulo (`livro.capítulo.versículo`): antes a
chave era só o número do versículo, e com navegação real uma nota de Gênesis 1:5
apareceria em João 1:5.

## Correções de bugs reais encontradas pelo caminho

1. `src/server/db/client.ts` lançava fora do Worker, antes de chegar ao fallback
   documentado de `DATABASE_URL`. Contido.
2. O link "anterior" no capítulo 1 caía no capítulo 1 do livro anterior em vez do
   último. Corrigido com uma consulta extra, só nesse caso.
3. **B-02**: o service worker nunca instalava porque pré-cacheava
   `/apple-icon.svg`, que respondia 404 — o Next não gera rota de `apple-icon` a
   partir de SVG. Um único 404 derruba `cache.addAll` e a instalação inteira.
   Corrigido e verificado: agora chega a `activated`.
4. O painel de ferramentas não fechava com `Escape`. Corrigido.

## Estado verificado da árvore

- `npm run typecheck` passou.
- `npm run lint` passou (resta 1 warning pré-existente de `dirname` em
  `src/cli/import-theology.ts`).
- `npm run test` passou: **93 testes em 12 arquivos**.
- `npx playwright test` passou: **13 testes E2E**.
- `npm run build` passou.
- `git diff --check` passou.
- Nenhum commit criado por esta frente.

Observação de ambiente: o `build` falhou duas vezes por falta de memória, com
vários `next start` meus e do processo concorrente abertos ao mesmo tempo.
Encerrei apenas os meus (portas 3100–3107) e o build voltou a passar. Se o build
falhar com `out of memory`, é esse o caminho: fechar servidores de desenvolvimento
abertos.

## O que ainda depende de você

1. **C5 e C10** — preencher `SUPABASE_ANON_KEY` (e as demais) em `.env.local` e
   instalar `@supabase/supabase-js`. Sem Auth real, as duas ficam paradas.
2. **C11** — aprovar uma edição por arquivo, com prova documental de direitos.
3. **C6** — aprovar e importar WLC/OSHB/SBLGNT com checksum e licença.
4. **Ícones de loja** — PNG 192/512 `maskable` e apple-touch-icon 180. Rasterizar
   o `icon.svg` atual é mecânico; a margem do maskable é decisão de arte.
5. **Política de privacidade e e-mail de suporte** — requisito das duas lojas,
   ambos ainda texto-marcador.
6. **Identificador do app** — `com.samjoe.bibliabereana` (config) versus
   `com.samjoe.estudos` (documentação). É permanente na loja; decidir uma vez.
7. **`RightsSchema` de BKF-P0-001** — aceita `verified_by`/`proof` só com espaços;
   endurecido no catálogo, mas a correção na raiz é em `src/domain/bkf/**`.
