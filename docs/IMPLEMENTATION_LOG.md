
## 2026-11-17 — Editorial e CLI
## 2026-11-17 — Dados pessoais de leitura (não aplicado)

- Ação: criada migration `drizzle/0002_reading_personal_data.sql` e mapeamento Drizzle para preferências, notas, marcações por cor e progresso de capítulos.
- Segurança: todas as tabelas têm RLS habilitada e políticas `auth.uid() = user_id` para leitura e escrita; sem sessão autenticada, o acesso é negado. FKs e `ON DELETE CASCADE` impedem registros órfãos.
- Bloqueio: migration não foi aplicada ao Supabase remoto e a UI ainda não possui cliente Auth/Supabase por requisição. Portanto notas, marcações e progresso não podem ser declarados persistentes ou sincronizados até essa integração.

## 2026-11-17 — Transparência de IA e preparação de lojas

- Ação: aviso reutilizável de análise gerada com apoio de IA e curadoria dedicada, com orientação para conferir fontes, exibido nas telas de destaque, catálogo, tema e estudo; backlog BKF ajustado para consulta interna de agentes, sem autoridade editorial. Criado checklist de prontidão Google Play/App Store sem criar contas, efetuar cobranças ou enviar builds.
- Arquivos: `app/_components/ai-disclaimer.tsx`, páginas de estudos/tema/início, `app/globals.css`, `docs/BKF_EXECUTION_BACKLOG.md`, `docs/STORE_PUBLICATION_READINESS.md`, `tsconfig.json`.
- Verificações: `npm run lint` passou; `npm run typecheck` passou; `npm run test` passou (35 testes em 6 arquivos); `git diff --check` passou.
- Limites: o aviso não transforma conteúdo em verificado; publicação editorial segue dependente de fontes, revisão humana e direitos. Publicação em lojas continua dependente de contas, assinatura, projetos nativos e política de privacidade.

- Ação: schemas Zod, validação editorial e fluxo local de rascunhos; publicação bloqueada sem infraestrutura de autorização e persistência auditada.
- Arquivos: `src/domain/editorial/schema.ts`, `src/domain/editorial/validation.ts`, `src/cli/index.ts`, `src/cli/workflow.ts`, `src/content/editorial/pending-example.json`, `tests/editorial.test.ts`.
- Migration: nenhuma.
- Comando: `npm run test -- tests/editorial.test.ts` — falhou: `vitest` não encontrado; instalação de dependências do scaffold ainda em andamento.
- Dependência ausente: banco/Auth e integração de auditoria/cache; impacto: publicação indisponível; fallback aplicado: validação local e erro explícito sem promover versão; necessário integrar persistência transacional, autorização admin, auditoria e invalidação de cache.
- Dependência ausente: executor TypeScript para CLI; impacto: comando de execução não configurado; fallback aplicado: implementação TS desacoplada; necessário configurar executor/script no scaffold.
- Git: `git -c safe.directory=E:/SamJoE Bible status --short` mostra arquivos não rastreados; sem alterações de configuração global.
- Próximos passos (seções 11.8 e 11.10 do contrato): instalar dependências, executar testes/typecheck; integrar CLI com banco/Auth e executar matriz de validação.

## 2026-11-17 — dados e domínio (implementação local)

- Ação: criada migration `drizzle/0000_initial.sql`, mapeamento `drizzle/schema.ts`, regras puras em `src/domain/` e contrato/projeção em `src/server/contracts/studies.ts`; testes em `tests/domain/domain.test.ts`. A migration é a fonte de verdade para constraints e triggers; o mapeamento Drizzle não substitui a aplicação da migration SQL.
- Migration: `0000_initial.sql` criada, não aplicada; não havia servidor PostgreSQL disponível na inspeção. Sem conteúdo ou licença inventados.
- Comandos: `npm test -- --run tests/domain/domain.test.ts` e `npm run typecheck` não executados porque `node_modules` não estava instalado. `git -c safe.directory='E:/SamJoE Bible' diff --check` retornou sucesso, mas arquivos novos ainda não rastreados não são examinados por esse comando. `git -c safe.directory='E:/SamJoE Bible' status --short` mostrou arquivos do scaffold e desta frente como não rastreados.
- Bloqueio: dependências de projeto/Vitest e PostgreSQL ausentes; impacto: testes automatizados, typecheck e aplicação da migration ainda sem evidência; fallback: código e testes entregues para integração; necessário instalar dependências e disponibilizar PostgreSQL de teste.
- Próximos passos (contrato §11): 2. instalar e validar toolchain; 3. aplicar/testar migration no Postgres; 4 e 6. integrar repositório e `canAccess` no servidor; 7. vincular entitlements exclusivamente a eventos verificados; 10. executar matriz completa.
- Verificação complementar: `node --experimental-strip-types --input-type=module -e "..."` executou assertions de acesso anônimo/autorizado, transição de reembolso, vencimento de cancelamento e exclusão de seção premium; passou. O comando completo está no histórico de execução desta sessão; não substitui Vitest nem teste da migration.

## 2026-11-17 10:22 - Auth e configuração

- Ação: adaptador opcional de magic link/OTP com cliente Supabase injetado, configuração validada por Zod, identidade verificada por `getUser` e papéis obtidos exclusivamente por consulta de perfil confiável; falha fechada sem configuração, cliente, identidade ou papel válido. Não houve chamada de rede nem uso de credenciais.
- Arquivos: `src/server/auth/config.ts`, `src/server/auth/index.ts`, `tests/auth/auth.test.ts`.
- Migration: nenhuma.
- Comandos: `npm test -- tests/auth/auth.test.ts` passou (4 testes); `npm run typecheck` passou; `npx eslint src/server/auth tests/auth` iniciado, resultado pendente neste registro.
- Dependência ausente: cliente Supabase configurado, credenciais e consulta confiável de perfis; impacto: login e sessão indisponíveis; fallback aplicado: adaptador injetável retorna indisponível ou anônimo, sem simular autenticação; necessário configurar provedor e integrar cliente por requisição e consulta de perfis no servidor.
- Git: não inspecionado por instrução da tarefa.
- Próximos passos (contrato seção 11): 6. integrar cliente e perfis no servidor; 10. executar matriz completa e verificar integração real após configuração autorizada.
- Verificação complementar: `npx eslint src/server/auth tests/auth` passou.

## 2026-11-17 — Scaffold da aplicação

- Ação: configuração Next.js App Router, TypeScript estrito, ESLint, Vitest e Playwright; scripts, variáveis de ambiente de exemplo e README. Dependências instaladas com npm e lockfile gerado. As páginas são de outra frente.
- Arquivos: `package.json`, `package-lock.json`, `tsconfig.json`, `next-env.d.ts`, `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`, `.gitignore`, `.env.example`, `README.md`.
- Migration: nenhuma.
- Comandos: `npm install next@15 react@19 react-dom@19 zod drizzle-orm postgres --fetch-retries=1 --fetch-timeout=30000 --no-audit --no-fund`; `npm install -D typescript @types/node @types/react @types/react-dom eslint@9 eslint-config-next@15 @eslint/eslintrc vitest @playwright/test --fetch-retries=1 --fetch-timeout=30000 --no-audit --no-fund`; `npm install -D typescript@~5.9.3 --no-audit --no-fund --fetch-retries=1 --fetch-timeout=30000`: sucesso.
- `npm test`: sucesso, 12 testes em 3 arquivos na segunda execução.
- `npm run lint`: primeira execução com sucesso e um aviso na configuração, corrigido em seguida; nova execução interrompida após demora excessiva.
- `npm run typecheck`: primeira execução falhou com TS 6 e importação CSS; após fixação em TS 5.9, execução concorrente falhou por memória e nova execução isolada iniciada.
- `npm run build`: compilou via fallback SWC WebAssembly, após falha ao carregar binário nativo Windows; falhou na checagem de tipos enquanto TS 6 estava ativo. Repetir após conclusão do typecheck isolado.
- Estado Git: arquivos ainda não rastreados; sem commit. `git -c safe.directory='E:/SamJoE Bible' status --short` usado sem alterar configuração global.
- Próximos passos conforme seção 11: 2. concluir validações integradas; 3. concluir schema/migrations e conteúdo; 4–8. prosseguir com domínio, UI, autorização, billing e CLI; 10. executar matriz e checklist.

## 2026-11-17 10:24 — QA de integração

- Ação: testes de projeção premium e acesso com/sem entitlement, bloqueios independentes de publicação por fontes, revisor e status, e replay de webhook verificado.
- Arquivos: `tests/integration/critical-paths.test.ts`. Migration: nenhuma.
- Comando: `npm test -- tests/integration/critical-paths.test.ts` — passou: 1 arquivo, 6 testes (Vitest 5.1.0).
- Limite: idempotência verificada no serviço de cobrança em memória; não comprova persistência transacional ou concorrência no banco.
- Próximos passos (contrato §11.7 e §11.10): integrar persistência de cobrança e executar a matriz completa de validação.

- Complemento: `npm run typecheck` isolado passou após fixar TypeScript 5.9.3. `npm run build` repetido passou (exit 0), incluindo lint/tipos e geração de 12 páginas estáticas; o binário SWC nativo falhou ao carregar e o build usou fallback WebAssembly. Os testes mais recentes permaneceram 12/12 verdes.

## 2026-11-17 — validação integrada final

- Ação: integração das rotas públicas, catálogo/preview editorial, domínio, autenticação fail-closed, CLI, cobrança fake e testes críticos.
- Comandos: `npm run lint` — passou; `npm run typecheck` — passou; `npm run test` — passou: 5 arquivos, 32 testes; `npm run build` — passou com exit 0 e 12 páginas estáticas.
- Observação de ambiente: o binário SWC nativo do Windows não carregou; Next concluiu o build pelo fallback WebAssembly. Isso afeta velocidade de build local, não a validação funcional registrada.
- Limites externos remanescentes: aplicar migration em PostgreSQL real; configurar Supabase/Auth; configurar provedor de pagamento e webhook real; registrar licença de corpus bíblico; integrar WhatsApp e preparar deploy compatível com o host escolhido. Nenhum desses recursos foi declarado como ativo sem credencial, licença ou teste correspondente.

## 2026-11-17 — Preparação de empacotamento móvel

- Ação: configuração mínima Capacitor e instruções futuras para Android e iOS; nenhuma dependência instalada e nenhum APK ou IPA gerado.
- Arquivos: `mobile/capacitor.config.json`, `docs/MOBILE_RELEASE.md`, este registro. Migration: nenhuma.
- Comandos: leitura do contrato e `package.json`; `Get-Content -Raw -Encoding utf8 mobile\capacitor.config.json | ConvertFrom-Json` passou; `git -c safe.directory='E:/SamJoE Bible' diff --check` passou, mas não cobre arquivos ainda não rastreados; `git -c safe.directory='E:/SamJoE Bible' status --short` mostrou o scaffold, docs e mobile como não rastreados. Sem execução de build nativo.
- Dependência ausente: bundle web compatível com Capacitor e SDKs, além de assinatura Apple para IPA; impacto: pacotes funcionais não podem ser gerados agora; fallback aplicado: documentação dos comandos condicionais e uso web no Safari; necessário decidir arquitetura do bundle e configurar SDKs e assinaturas. PWA instalável/offline não foi verificada.
- Próximos passos (contrato §11): 10. concluir checklist de deploy web; após o MVP, decidir e validar arquitetura móvel e assinatura antes de criar projetos nativos.

## 2026-11-17 11:02 — conversão local BLIVRE

- Ação: implementados parser/validador USFM e conversão local para registros relacionados por UUID, com versículos não publicados, atribuição, checksum registrado do ZIP e hashes SHA-256 das entradas. Preservadas marcas e notas USFM no conteúdo; títulos fora de versículos permanecem nos arquivos originais.
- Arquivos: `src/importers/blivre.ts`, `scripts/convert-blivre.ts`, `scripts/README-blivre.md`, `tests/importers/blivre.test.ts`. Migration: nenhuma.
- Comando: `npm test -- tests/importers/blivre.test.ts` — passou: 3 testes; corpus local com 66 livros, 1.189 capítulos e 31.102 versículos.
- Limites: checksum do ZIP registrado, não verificado (ZIP indisponível); hashes de arquivos extraídos não comprovam autenticidade. Nenhum banco ou serviço foi acessado. Executor TypeScript não configurado no projeto; instrução de execução documentada.
- Complemento: `npm run typecheck` — passou (exit 0).

## 2026-11-17 — Preparação Cloudflare Tunnel

- Ação: adicionados `scripts/start-tunnel.ps1` e `docs/CLOUDFLARED_RELEASE.md`; nenhuma migration, login, criação ou execução de túnel, nem exposição pública.
- Inspeção: `Get-Command cloudflared -ErrorAction SilentlyContinue` não encontrou o executável no PATH; `~/.cloudflared/config.yml` e `cert.pem` existem (conteúdo não inspecionado). `.env.example` declara token e hostname vazios; script usa o token no ambiente do processo.
- Validação: parser PowerShell do script passou; execução com `CLOUDFLARE_TUNNEL_TOKEN` vazio terminou com erro explícito e código 1. Não foi possível testar conexão sem iniciar um túnel.
- Dependência ausente: executável `cloudflared` no PATH e configuração operacional/token de túnel ainda não verificados; impacto: execução do túnel não demonstrada; fallback aplicado: falha explícita e instruções de instalação/configuração; necessário instalar o executável e configurar túnel nomeado, domínio e token antes da operação.
- Git: `git -c safe.directory='E:/SamJoE Bible' status --short` mostrou os arquivos do projeto como não rastreados; nenhum commit foi criado. Próximo passo (§11.10): validar o deploy e a conectividade quando a infraestrutura estiver configurada e a exposição for autorizada.

## 2026-11-17 — Infraestrutura definitiva: Cloudflare Workers

- Decisão: hospedagem permanente em Cloudflare Workers via `@opennextjs/cloudflare` 1.20.17. O Cloudflare Tunnel foi descartado por decisão do operador; não é hospedagem. Descartados também `vinext` (a própria documentação da Cloudflare o marca como beta e ele reimplementa a API do Next.js) e `@cloudflare/next-on-pages`.
- Ação: adicionados `wrangler.jsonc`, `open-next.config.ts`, `next.config.ts`, `drizzle.config.ts`, `src/server/db/client.ts`, `public/_headers`, `.dev.vars.example`, `.github/workflows/deploy.yml` e `docs/CLOUDFLARE_INFRA.md`. `.gitignore` e `eslint.config.mjs` passaram a ignorar `.open-next`, `.wrangler` e `worker-configuration.d.ts`. Variáveis `CLOUDFLARE_TUNNEL_*` removidas de `.env.example`.
- Driver: trocado `postgres` (postgres.js, sem nenhum import no código) por `pg` 8.23.1 com `drizzle-orm/node-postgres`, driver recomendado pela Cloudflare para Hyperdrive. Cliente criado por requisição com `maxUses: 1`, dentro de `cache()` do React.
- Correção encontrada no build: `initOpenNextCloudflareForDev()` chamado sem condição quebrava `opennextjs-cloudflare build`, exigindo connection string local de Hyperdrive. Passou a ser chamado apenas com `NODE_ENV === "development"`.
- Validação: `npm run lint` sem erros; `npm run typecheck` exit 0; `npm run test` 35 testes em 6 arquivos, todos passando; `npx opennextjs-cloudflare build` concluído, 15 rotas geradas, `.open-next/worker.js` criado (31 MB de artefatos). `npm run cf-typegen` gerou `worker-configuration.d.ts`.
- Limites: nenhum recurso da Cloudflare foi criado, nenhuma autenticação na conta e nenhum deploy. `wrangler.jsonc` contém `REPLACE_WITH_HYPERDRIVE_ID`; o deploy falha até ser substituído. Bucket R2 `samjoe-estudos-cache` e config Hyperdrive ainda não existem. A Direct connection do Supabase pode exigir add-on IPv4, e o Hyperdrive pode exigir plano pago do Workers — não verificável sem acesso à conta.
- Ambiente: `@next/swc-win32-x64-msvc` falha ao carregar ("is not a valid Win32 application"); o Next.js recorre ao fallback e o build conclui, mas a instalação do binário nativo deveria ser refeita nesta máquina.
- Pendente de decisão: tag cache D1 (`revalidateTag`/`revalidatePath`) não configurado, pois o código ainda não usa revalidação sob demanda. Domínio definitivo não escolhido.
- Git: repositório sem nenhum commit; nenhum commit foi criado nesta etapa.

## 2026-11-17 11:52 — Tarefa 1 (Corpus): geração de `data/generated/blivre.json`

- Ação: executada apenas a tarefa 1 do handoff. Nenhum arquivo de código ou configuração foi modificado; os USFM originais não foram alterados (70 entradas em `data/source/porbr2018_usfm`, 4.351.522 bytes, todas com `LastWriteTime` de 29/10/2026 19:50, anterior a esta execução).
- Arquivos: criado `data/generated/blivre.json` (8.547.651 bytes, UTF-8 sem BOM) e o diretório `data/generated`. Única edição em repositório: este registro. Migration: nenhuma.
- Comando: `node --experimental-strip-types scripts/convert-blivre.ts 42f1e145-244c-4dd7-ae60-8ab66407f678 > data/generated/blivre.json` — exit 0, com aviso `MODULE_TYPELESS_PACKAGE_JSON` (reparse como ES module; apenas desempenho, não corrige-se aqui porque exigiria alterar `package.json`).
- Observação de ambiente: o redirecionamento `>` do PowerShell 5.1 grava UTF-16LE com BOM, o que gerou um JSON ilegível (16.895.944 bytes) na primeira tentativa. O arquivo válido foi produzido redirecionando pelo `cmd /c`, que preserva os bytes de stdout. Quem repetir o comando documentado no PowerShell deve usar o mesmo cuidado.
- Validação (script de leitura temporário fora do repositório, sem gravação): 66 livros, 1.189 capítulos e 31.102 versículos — conforme exigido. Chaves de topo: `source`, `books`, `chapters`, `verses`. Integridade referencial: 0 capítulos órfãos e 0 versículos órfãos. `published: false` em todos os 31.102 versículos. `translation_id` único em todos os livros: `42f1e145-244c-4dd7-ae60-8ab66407f678`. Acentuação correta na amostra (`Gênesis`, Gn 1.1).
- Limites e bloqueios: `git status` indisponível nesta sessão — o repositório acusa `dubious ownership` (`.git` pertence a `CodexSandboxOffline`, sessão corre como `Victor`) e a exceção `safe.directory` não foi adicionada por ser alteração de configuração. Logo, não foi verificado por Git se `data/generated/` é ignorado nem o estado da árvore. Nenhuma rede, banco, importação, publicação, túnel ou APK nesta etapa. O checksum do ZIP permanece registrado e não verificado.
- Próximo item da lista: 2. Importação — importador em lotes, idempotente e auditável, com conexão server-side configurada pelo proprietário ou migration controlada; depende de credencial de banco ainda não disponível a esta sessão.

- 2026-11-17 — Planejamento BKF: criado docs/BKF_EXECUTION_BACKLOG.md; nenhuma migration ou código alterado; verificação: seções e sete tarefas P0 presentes, git diff --check exit 0 (arquivos não rastreados não cobertos); git status mostra projeto não rastreado; sem execução de testes de aplicação, rede ou publicação; próximo passo: BKF-P0-001; fonte/licença por edição e credenciais para E2E real pendentes.

## 2026-11-17 12:18 — Aviso de IA e curadoria nas páginas de estudos

- Ação: criado o componente compartilhado `app/_components/ai-disclaimer.tsx` e exibido o aviso próximo ao conteúdo nas páginas que apresentam estudos/análises. Texto em português: análise gerada com apoio de inteligência artificial (IA), submetida a curadoria editorial dedicada, podendo conter erros, com orientação explícita para conferir as fontes citadas. Duas variantes: `single` (um estudo) e `collection` (catálogo/tema). Marcação `<aside>` com `aria-label` e reuso da classe `.notice`.
- Arquivos: criado `app/_components/ai-disclaimer.tsx`; alterados `app/page.tsx` (seção “Estudo em destaque”), `app/estudos/page.tsx` (catálogo), `app/estudos/[slug]/page.tsx` (logo após o resumo, antes do aviso de transparência editorial já existente), `app/temas/[slug]/page.tsx` (antes da lista relacionada) e `app/globals.css` (três regras `.ai-notice` para contraste no bloco escuro `.feature`). Migration: nenhuma.
- Fora de escopo, não tocado: infraestrutura, banco, autenticação, pagamentos, licenças, dependências e `.env*`. Páginas sem estudo/análise (`/biblia`, `/planos`, `/entrar`, `/contato`, `/termos`, `/privacidade`, `/direitos-autorais`, `/offline`) seguem sem o aviso, por decisão de escopo.
- Verificações reais: `npm run lint` exit 0 (duas execuções, a segunda após alterações concorrentes na árvore); `npm run typecheck` exit 0; `npm run test` 35 testes em 6 arquivos, todos passando (vitest 5.1.0, 2,60 s); `npm run build` exit 0, 15 rotas, “Compiled successfully in 20.4s”; `git -c safe.directory='E:/SamJoE Bible' diff --check` exit 0 (apenas avisos de LF→CRLF, nenhum erro de espaço em branco; arquivos não rastreados não são cobertos).
- Evidência de renderização: no HTML pré-renderizado, `.next/server/app/index.html` e `.next/server/app/estudos.html` contêm o aviso; `termos`, `privacidade`, `biblia`, `planos` e `contato` não contêm `ai-notice`. As rotas `/estudos/[slug]` e `/temas/[slug]` são server-rendered sob demanda e não geram HTML estático para inspeção; a presença do componente foi conferida no código-fonte e coberta por build e typecheck.
- Falha intermediária esclarecida: a primeira execução de `npm run typecheck` falhou com `scripts/convert-blivre.ts(1,31): error TS5097` (import com extensão `.ts`). O arquivo estava idêntico ao HEAD e não foi tocado por esta frente; o erro era pré-existente e deixou de ocorrer após alteração concorrente em `tsconfig.json` (`allowImportingTsExtensions: true`), feita por outro processo, não por esta frente.
- Escrita concorrente observada na árvore: durante esta execução outro processo gravou `app/layout.tsx` e `docs/BKF_EXECUTION_BACKLOG.md` às 12:14:17 (um aviso global de IA no `<body>` do layout, aplicável a todas as rotas) e reverteu `app/layout.tsx` às 12:15:54; também criou `docs/STORE_PUBLICATION_READINESS.md` e alterou `tsconfig.json`. Nenhuma dessas alterações foi revertida, editada ou commitada por esta frente. Se o aviso global voltar a `app/layout.tsx`, ele passa a duplicar este aviso nas páginas de estudos e a exibi-lo em páginas sem análise — nesse caso, consolidar em uma única implementação (recomendação: manter o aviso por página, próximo ao conteúdo).
- Observação de ambiente: `@next/swc-win32-x64-msvc` continua falhando ao carregar (“is not a valid Win32 application”); o build conclui pelo fallback. Nenhuma rede, nenhum agente auxiliar e nenhum commit nesta etapa.
- Tensão de conteúdo a decidir pelo operador: o contrato (§ linha 140) e o backlog BKF registram que o P0 não chama IA e que a análise é editorial/manual, enquanto o aviso agora declara geração com apoio de IA. O texto foi implementado conforme solicitado; cabe ao operador alinhar a declaração ao processo real de produção dos estudos.
- Commit alheio sobre esta frente: às 12:17:45 o processo concorrente criou o commit `d4bf0bc` (“feat: add AI analysis disclosure and store readiness”, autor `SamJoE Tech & Consulting`), que incluiu os arquivos desta frente (`app/_components/ai-disclaimer.tsx`, as quatro páginas, `app/globals.css`) junto aos seus próprios (`docs/STORE_PUBLICATION_READINESS.md`, `tsconfig.json`, `docs/BKF_EXECUTION_BACKLOG.md`) e um registro próprio neste log. Esta frente não criou, alterou nem desfez commit algum; o commit foi observado após o fato. Este registro foi acrescentado depois dele e permanece não commitado.

## 2026-11-17 — Domínio bibliabereianos.com.br

- Ação: consulta da zona Cloudflare `a7d07612f32cc0732feeac5eee7dc9e1`; nenhuma alteração de DNS ou Worker realizada.
- Estado: `pending`. O Cloudflare ainda observa `a.auto.dns.br` e `b.auto.dns.br`, enquanto a zona exige `alaric.ns.cloudflare.com` e `megan.ns.cloudflare.com`.
- Bloqueio: delegação de nameservers ainda não propagada; conectar o domínio ao Worker antes de `active` não é seguro. Próximo passo: repetir a consulta após propagação e então criar o domínio customizado para `samjoe-estudos`, seguido de teste HTTPS.
## 2026-11-17 — BKF P0-001 contratos puros

- Ação: contratos estritos Zod e política BKF fail-closed para direitos, manifestos, fragmentos, evidências, dossiês, documentos, revisões e jobs; transições editoriais determinísticas sem filesystem, rede ou segredos.
- Arquivos: `src/domain/bkf/contracts.ts`, `src/domain/bkf/policy.ts`, `tests/bkf/contracts.test.ts`.
- Verificação: pendente de execução nesta entrada; ambiente local teve instabilidade de memória em execuções paralelas. Não houve banco, rede, migration ou publicação.

## 2026-11-17 — Pipeline local de obras teológicas autorizadas

- Ação: manifesto estrito de edição, proveniência, checksum e direitos; CLI local de importação TXT UTF-8 em armazenamento privado por SHA-256. A importação falha fechada sem autorização explícita para armazenamento e processamento automatizado, direitos expirados, checksum divergente ou paths inválidos.
- Arquivos: `src/domain/bkf/theology-import.ts`, `src/cli/import-theology.ts`, `tests/theology-import.test.ts`.
- Conteúdo real: nenhum corpus foi baixado, copiado ou publicado; os testes usam somente fixture sintética.
- Estado: pronto para fonte local fornecida pelo operador com manifesto e prova documental; não integra banco, app ou rede.


## 2026-11-17 — C1: colisão de migrations resolvida (local)

- Ação: `drizzle/0002_reading_personal_data.sql` renomeada para `drizzle/0003_reading_personal_data.sql`. O índice BLIVRE permanece como `drizzle/0002_blivre_query_indexes.sql`. Conteúdo SQL não foi alterado — apenas o prefixo de ordem.
- Sequência resultante: `0000_initial.sql`, `0001_seed_blivre.sql`, `0002_blivre_query_indexes.sql`, `0003_reading_personal_data.sql` — prefixos únicos e ordem determinística.
- Referências revisadas: nenhum código, teste, script ou configuração cita os nomes das migrations (verificado por busca em toda a árvore). Apenas documentação citava: `docs/MVP_RELEASE_GATES.md` (P-10, X-03, B-06, Fase A passo 2) atualizada; `docs/BLIVRE_IMPORT.md` cita somente `0000`/`0001`/`0002` de índices e segue correta. A entrada histórica de 2026-11-17 ("Dados pessoais de leitura") foi preservada como registro do que ocorreu na época.
- Banco: nenhuma migration aplicada, local ou remota. Nenhum `.env*` tocado, nenhuma rede usada, nenhum commit criado.
- Pendência mantida (B-06): `drizzle/meta/_journal.json` continua inexistente, então `npm run db:migrate` não rastreia estes SQL escritos à mão; a aplicação segue manual e sob autorização do proprietário.

## 2026-11-17 — C2: ferramentas integradas ao leitor (estado local de sessão)

- Ação: ferramentas de leitura passaram de avisos decorativos a estado real de sessão. Criado `app/biblia/reader-state.tsx` (ReaderProvider/useReader) como fonte única de preferências, tema, versículo selecionado, destaques, notas e progresso, com leitura e escrita em `sessionStorage` dentro de try/catch. `app/biblia/page.tsx` envolve o leitor no provider; o capítulo saiu do JSX para `app/biblia/chapter-data.ts` e passou a ser renderizado por `app/biblia/reader-chapter.tsx`, onde cada versículo é um alvo de toque que abre o painel local na aba Versículo. `app/biblia/theme-toggle.tsx` agora consome o mesmo estado, então o botão do cabeçalho e a aba Leitura nunca divergem — e o tema ficou acessível também no painel, onde o cabeçalho o esconde em telas pequenas.
- Texto bíblico: nenhum versículo foi criado, alterado, traduzido ou acrescentado. `chapter-data.ts` contém exatamente o mesmo trecho de Gálatas 1 (BLIVRE, CC BY 4.0 BR) que já estava escrito em `page.tsx`, apenas em forma de dados, com a atribuição no topo do arquivo. Licenças não foram tocadas.
- Declarações obrigatórias: NVI, NTLH e Almeida aparecem desabilitadas como `Em licenciamento`, sem data prometida; BLIVRE como `Disponível`. Preferências, notas, destaques e progresso dizem explicitamente "local nesta sessão", sem conta e sem sincronização — a mensagem antiga "Notas serão sincronizadas ao entrar na conta" foi removida porque prometia algo inexistente. "Contexto" e "Original" respondem indisponível por falta de fonte licenciada/verificada; nada de grego, hebraico, glossa ou morfologia foi inventado.
- Verificação: `npm run typecheck` passou; `npm run lint` passou (resta 1 warning pré-existente de `dirname` em `src/cli/import-theology.ts`, fora desta frente); `npm run test` passou (40 testes em 8 arquivos); `npm run build` passou com `/biblia` estática em 5,17 kB. Smoke de navegador no build de produção (`next start -p 3100`, Chromium local do cache Playwright, script temporário fora do repositório): 21/21 checagens — painel abre no toque do versículo, referência correta (Gálatas 1:7), destaque/leitura/nota refletidos no texto e no contador, 3 traduções em licenciamento e desabilitadas, tamanho 21,28px→25,28px, espaçamento 45,0→50,6px, fonte Georgia→Arial, tema claro aplicado, preferências e marcas sobrevivendo ao recarregar na mesma aba, sessão nova começando limpa, atribuição BLIVRE visível e nenhum erro de console.
- Limites: o capítulo continua fixo no código — navegação por livro/capítulo e leitura vinda do banco são C3/C4. Nada é persistido por usuário: ao fechar a aba o estado desaparece, e as tabelas de `drizzle/0003_reading_personal_data.sql` seguem sem consumidor até o Auth Supabase existir (C5). Nenhuma rede, nenhum banco, nenhuma migration aplicada, `.env*` intocado, nenhum commit criado.
- Pendência registrada para decisão do proprietário: `metadata.title` de `app/biblia/page.tsx` ainda diz "Leitor bíblico em preparação" enquanto a página exibe versículos (X-02), e o bloco `.legacyBible` segue oculto no DOM. Corrigir isso é afirmação de produto e não foi decidido aqui.

## 2026-11-17 — C3: contrato de leitura BLIVRE no servidor

- Ação: criada a camada server-side de leitura do corpus, injetável e sem banco nos testes. `src/server/contracts/bible.ts` define tipos, a interface `BibleRepository` (que devolve `unknown` de propósito), schemas Zod e as projeções puras; `src/server/bible/reader.ts` orquestra com `createBibleReader(translationId, repository)`; `src/server/bible/repository.ts` implementa as consultas Drizzle (somente SELECT); `src/server/bible/blivre.ts` fixa o UUID aprovado em `drizzle/0001_seed_blivre.sql`; `src/server/bible/runtime.ts` é o único ponto que toca `getDatabaseAsync()`; `src/server/bible/index.ts` exporta a superfície sem arrastar infraestrutura. Documentado em `docs/BIBLE_READ_API.md`.
- Falha fechada: sem `HYPERDRIVE`/`DATABASE_URL` o leitor responde `unavailable` a tudo, sem lançar. Exceção do repositório também vira `unavailable`, e o teste prova que uma mensagem contendo `postgres://user:senha@...` não aparece no resultado. Tradução sem `status = "approved"` ou sem atribuição não serve texto algum — e nesse caso o serviço nem consulta versículos.
- Direitos e procedência: `published = false` é filtrado na consulta e de novo no contrato; linha de outra tradução, de outro livro ou de outro capítulo é descartada; UUID inválido, conteúdo vazio e duplicado também. O resultado expõe apenas `id`, `number` e `content` do versículo — `published`, `translation_id` e `chapter_id` não cruzam a fronteira. Ordenação canônica (livro por `order_no`, capítulo e versículo por número) é imposta pelo contrato, não pela confiança na cláusula SQL.
- Verificação: `npx vitest run tests/server/bible.test.ts` — 14 testes passaram, com fixtures sintéticas (nenhum versículo real nos testes, para não reproduzir nem inventar texto bíblico). Suíte completa: `npm run test` passou com 54 testes em 9 arquivos. `npm run typecheck` passou; `npm run lint` passou (resta o warning pré-existente de `dirname` em `src/cli/import-theology.ts`).
- Limites: UI intocada — nenhuma rota, página ou componente chama `getBlivreReader()`, conforme C3. Nenhum banco local ou remoto foi consultado ou alterado, nenhuma migration aplicada, nenhuma rede usada, `.env*` intocado, nenhum commit criado. A ligação do leitor ao corpus continua sendo C4 e depende da confirmação de 66/1189/31102 no banco.

## 2026-11-17 — C7 / BKF-P0-002: persistência e catálogo BKF

- Desvio de numeração registrado: o backlog previa `drizzle/0002_bkf.sql`, mas `0002` é `0002_blivre_query_indexes.sql` e `0003` é `0003_reading_personal_data.sql` (colisão resolvida em C1). A migration foi criada como `drizzle/0004_bkf.sql`, próxima da sequência. Nenhuma migration existente foi alterada, recriada ou renomeada.
- Ação: migration aditiva com as 10 tabelas pedidas — `bkf_editions`, `bkf_rights`, `bkf_artifacts`, `bkf_sections`, `bkf_fragments`, `bkf_jobs`, `bkf_evidence`, `bkf_documents`, `bkf_document_revisions`, `bkf_reviews` — mais 8 tipos enum com valores idênticos aos de `src/domain/bkf/contracts.ts`, FKs para `works`/`sources`/`licenses`/`profiles`/`studies`/`study_versions`/`source_locations` existentes (sem segundo catálogo público), uniques, CHECKs, índices e 3 gatilhos de imutabilidade. Mapeamento Drizzle acrescentado em `drizzle/schema.ts`. Catálogo em `src/server/bkf/catalog.ts` com repositório injetável, persistência Drizzle em `src/server/bkf/repository.ts`, testes em `tests/bkf/catalog.test.ts`.
- Direitos negam por padrão, no banco: permissão alguma pode ser `true` sem status `APPROVED_LIMITED`/`APPROVED_FULL`; aprovação exige prova, responsável e data de verificação; `quote = true` exige os três limites de palavras; distribuição pública exige aprovação; janela de validade invertida é recusada; documento só chega a `PUBLISHED` com `study_id` do domínio SamJoE; job `BLOCKED` exige motivo. O catálogo repete a decisão em código usando `canStore`/`canAutomatedProcess`/`canQuote` de BKF-P0-001, sem duplicar a política.
- Imutabilidade e deduplicação: `bkf_artifacts` tem unique (edition_id, original_sha256, extraction_version); `bkf_fragments` unique por intervalo; `bkf_document_revisions` unique por (document_id, version) e por (document_id, content_sha256). Gatilhos recusam UPDATE e DELETE em artefatos, fragmentos e revisões — mudança de edição, hash ou versão de extração cria linha nova. `bkf_evidence` segue mutável de propósito, porque a verificação humana muda de estado.
- Caminho de corpus: `storage_locator` tem CHECK que recusa caminho absoluto, unidade do Windows e `..`; o catálogo aplica a mesma regra em Zod antes de qualquer consulta, e nenhum byte é copiado nesta tarefa.
- Verificação em Postgres local descartável (sem rede, sem Supabase remoto): contêiner `postgres:16.11-alpine` a partir de imagem já em cache, publicado só em 127.0.0.1, criado e removido na mesma sessão. Com um stub local de `auth.uid()` — necessário porque `0003` usa o schema `auth` do Supabase e não roda em Postgres puro —, as cinco migrations `0000`→`0004` aplicaram sem erro, em ordem. 37 provas de integridade: 37 passaram, cobrindo caminho feliz nas 10 tabelas, 3 violações de FK, 5 de unique, 5 de direitos, enum inválido, intervalos inválidos, job bloqueado sem motivo, documento publicado sem estudo, 3 recusas de caminho inseguro, 4 tentativas de mutação em registro imutável, `ON DELETE RESTRICT`, rollback sem resíduo e compatibilidade com o seed BLIVRE, os índices do `0002` e as tabelas do `0003`. Reaplicação: `0004` rodou 3 vezes com contagem idêntica (10 tabelas / 28 índices / 77 constraints / 3 gatilhos / 8 enums), confirmando idempotência sem duplicação. Comparação coluna a coluna entre `drizzle/schema.ts` e o banco validado: 10 de 10 tabelas iguais (109 colunas).
- Achado em BKF-P0-001 (não corrigido aqui, por estar fora dos arquivos permitidos desta tarefa): `RightsSchema` usa `z.string().min(1)` sem `trim`, então `verified_by` ou `proof` com apenas espaços passam pelo contrato e pela política, enquanto o CHECK de `0004_bkf.sql` usa `btrim` e recusaria a mesma linha. `projectRights` em `src/server/bkf/catalog.ts` apara os campos antes de validar, de modo que contrato, catálogo e banco concordem; a correção na raiz pertence a `src/domain/bkf/**`.
- Verificação de código: `npx vitest run tests/bkf/catalog.test.ts` — 16 testes passaram. Suíte completa `npm run test` — 70 testes em 10 arquivos, todos passaram. `npm run typecheck` passou. `git diff --check` passou.
- Bloqueio real, não causado por esta tarefa: às 15:45:30 o processo concorrente criou o commit `bc2d4fb` ("feat: add reader controls and fixed bible navigation", autor `SamJoE Tech & Consulting`), que incluiu os arquivos do C2 junto a um ajuste próprio de cabeçalho e trocou `next/link` por `<a>` em `app/biblia/page.tsx`. Isso introduziu 4 erros `@next/next/no-html-link-for-pages` (linhas 41, 50, 53 e 122), e como `next build` roda o lint, **`npm run lint` e `npm run build` passaram a falhar na árvore**. Nenhum arquivo desta frente está envolvido; a correção é trocar os quatro `<a>` por `Link` e reimportar `next/link`. Esta frente não alterou, reverteu nem commitou o arquivo do processo concorrente.
- Reverificação do C2 por navegador não pôde ser repetida depois desse commit: o build está bloqueado pelos erros de lint acima e o `next dev` do processo concorrente mantém o lock do miniflare (`SQLITE_BUSY`), então parei em vez de disputar o recurso. A verificação 21/21 registrada na entrada do C2 vale para o estado anterior ao commit `bc2d4fb`; a estrutura (`ReaderProvider`, `ReaderChapter`, `ReaderTools`, `ThemeToggle`) foi preservada por ele, e `typecheck` e testes continuam verdes.
- Limites: nenhuma migration aplicada em Supabase remoto, nenhum dado inserido pela migration, nenhuma rede usada, `.env*` intocado, nenhum commit criado por esta frente, nada de BKF-P0-003 ou posterior implementado.

## 2026-11-17 — Correção do build, journal de migrations e leitura do banco configurado

Três itens autorizados pelo operador depois do relatório anterior.

### 1. Build e lint de volta ao verde

- Ação: `app/biblia/page.tsx` voltou a usar `Link` de `next/link` nos seis links internos (rodapé do leitor, marca e menu do bloco legado, e as duas ações do fim da página), que o commit concorrente `bc2d4fb` havia trocado por `<a>`. O link externo para `ebible.org` continua como `<a>`, que é o correto. Nenhuma outra linha do arquivo foi tocada: layout, cabeçalho, seletor de livro/capítulo e textos do processo concorrente foram preservados.
- Motivo: `next build` roda o lint, então os 4 erros `@next/next/no-html-link-for-pages` quebravam o build da árvore inteira.
- Verificação: `npm run lint` passou (resta só o warning pré-existente de `dirname` em `src/cli/import-theology.ts`); `npm run build` passou com `/biblia` estática em 5,19 kB; `npm run typecheck` passou; `npm run test` passou com 70 testes em 10 arquivos; `git diff --check` passou.

### 2. `drizzle/meta/_journal.json` criado e testado

- Ação: criado o journal com as cinco entradas em ordem (`0000_initial`, `0001_seed_blivre`, `0002_blivre_query_indexes`, `0003_reading_personal_data`, `0004_bkf`), `dialect: postgresql`, versão `7` e `when` igual ao mtime real de cada arquivo. Fecha a pendência B-06 do lado do rastreamento.
- Verificação real, em Postgres local descartável (sem rede, sem remoto): `drizzle-kit migrate` **falhou** de primeira, com `exit=1` e nenhuma mensagem — o drizzle-kit engole o erro. Rodando `migrate()` do `drizzle-orm` diretamente, a causa apareceu: `syntax error at or near "﻿"`, SQLSTATE `42601`. É um **BOM UTF-8** no início de `drizzle/0000_initial.sql` (bytes `ef bb bf`). O `psql` tolera o BOM; o driver `pg`, que o drizzle usa, envia os bytes crus e o Postgres recusa. Nenhum dos outros quatro arquivos tem BOM.
- Prova de que é o único obstáculo: numa **cópia fora do repositório**, com o BOM removido apenas dessa cópia, `migrate()` respondeu `MIGRATE OK` e aplicou tudo — 43 tabelas em `public`, as 10 `bkf_*`, seed BLIVRE aprovado e as 5 migrations registradas em `drizzle.__drizzle_migrations`. A segunda execução foi no-op limpo, mantendo 5 registros. Multi-statement por arquivo funcionou sem precisar de marcadores `--> statement-breakpoint`.
- **Não alterei `drizzle/0000_initial.sql`.** Remover o BOM não muda uma linha de SQL, mas migration existente não se altera sem ordem explícita. Enquanto o BOM estiver lá, `npm run db:migrate` continua falhando e a aplicação segue manual, como hoje.
- Alerta para antes de usar `db:migrate` contra o Supabase: o banco remoto **não tem** `drizzle.__drizzle_migrations`, e `0000`/`0001` já foram aplicados à mão. Rodar `migrate` lá sem antes marcar essas duas como aplicadas faria o drizzle tentar recriar objetos existentes e falhar. O baseline é decisão do proprietário.

### 3. Leitura do banco configurado em `.env.local`

Operador perguntou se o Supabase estava acessível e autorizou olhar. Feita **somente leitura**, com a sessão travada em `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` e `application_name=claude-readonly-inspect`: nenhum INSERT, UPDATE, DELETE, DDL, migration ou import. Nenhuma credencial foi impressa, registrada ou enviada a qualquer lugar.

Estado real do banco (PostgreSQL 17.11):

| Item | Valor |
| --- | --- |
| tabelas em `public` | 29 |
| `translations` / BLIVRE com status `approved` | 1 / 1 |
| `books` | **66** |
| `chapters` | **1189** |
| `verses` (e publicados) | **31102** / **31102** |
| índices do `0002` | 0 de 3 |
| tabelas pessoais do `0003` | 0 de 4 |
| tabelas `bkf_*` do `0004` | 0 de 10 |
| `drizzle.__drizzle_migrations` | não existe (42P01) |
| `studies` / `profiles` | 0 / 0 |

Consequências:

- **O portão do C4 está satisfeito de fato**: o banco contém exatamente 66/1189/31102, com todos os versículos publicados e a tradução aprovada. Falta apenas a confirmação formal do operador para iniciar C4 — e, por cascata, C8, C9 e C12.
- Remotamente estão aplicados `0000` e `0001` mais a importação do corpus. **Faltam** `0002` (os três índices de consulta), `0003` (dados pessoais com RLS) e `0004` (BKF). Aplicar qualquer um deles é escrita em produção e não foi feito.
- Sem os índices do `0002`, as consultas do contrato C3 (`src/server/bible/**`) varrem tabela em vez de usar índice. Com 31102 versículos isso ainda responde, mas é o primeiro ajuste de desempenho a fazer quando houver autorização de escrita.
- `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` e `SUPABASE_SERVICE_ROLE_KEY` estão **vazios** em `.env.local`, e `@supabase/supabase-js` não está instalado. Portanto C5 e C10 seguem bloqueados por Auth, não por banco.

## 2026-11-17 — C4: leitor ligado ao corpus

Portão liberado pelo operador depois da leitura do banco (66/1189/31102 confirmados).

- Ação: o capítulo fixo no código foi substituído por leitura real do corpus. Nova rota `app/biblia/[book]/[chapter]/page.tsx` (`force-dynamic`) consome o contrato do C3 por `getBlivreReader()`; `app/biblia/page.tsx` virou porta de entrada que redireciona para o primeiro livro; estilos foram para `app/biblia/layout.tsx`. `app/biblia/chapter-data.ts`, que guardava Gálatas 1 escrito no componente, foi **removido**, e com ele o bloco oculto `.legacyBible` que afirmava "esta página ainda não exibe nenhum versículo".
- Navegação: `src/domain/bible-navigation.ts` (puro) calcula anterior/seguinte atravessando a fronteira de livro, e `app/biblia/chapter-picker.tsx` transformou os dois botões do cabeçalho — que o processo concorrente havia criado sem ação — em seletor real de livro e capítulo, por URL. No capítulo 1 há uma consulta extra para descobrir onde o livro anterior termina; sem ela o link "anterior" caía no capítulo 1 em vez do último, que foi exatamente a única falha da primeira rodada de verificação.
- Estado de sessão: `app/biblia/reader-state.tsx` passou a guardar marcas com a chave `<livro>.<capítulo>.<versículo>` (`reader-session-v2`). Antes a chave era só o número do versículo — com navegação real, uma nota de Gênesis 1:5 apareceria em João 1:5. Trocar de capítulo fecha o painel e limpa a seleção.
- Verdade da página: `generateMetadata` agora devolve a referência canônica e `alternates.canonical`; o título "Leitor bíblico em preparação" saiu, porque a página passou a exibir o corpus validado. Referência inexistente responde 404; falta de banco, tradução não aprovada ou capítulo sem publicação caem em `app/biblia/reader-unavailable.tsx`, que explica o motivo e **não** mostra texto de reserva.
- Atribuição: o rodapé passou a exibir o campo `attribution` da própria tradução aprovada no banco, não uma string no código. Também acrescentei a atribuição obrigatória e a fonte da licença em `app/direitos-autorais/page.tsx`, que era texto-marcador sem ela — a licença exige a atribuição nessa página, e o bloco oculto do leitor não cumpria isso por estar `display:none`.
- Correção necessária de infraestrutura: `src/server/db/client.ts` chamava `getCloudflareContext()` sem proteção, então fora do Worker (build, `next start`, scripts) lançava antes de chegar ao fallback documentado de `DATABASE_URL`. Agora a exceção é contida e o fallback funciona.
- Verificação: `typecheck`, `lint` e `build` passaram (`/biblia` e `/biblia/[book]/[chapter]` como rotas dinâmicas, sem banco no build). Em build de produção contra o banco real, 30 de 30 checagens de navegador: redirecionamento para `genesis/1`, 31 versículos em Gênesis 1 e 36 em João 3 vindos do banco, título e referência canônica, seletor com os 66 livros e com os 21 capítulos de João, URL direta, anterior/seguinte atravessando de Gênesis 50 para Êxodo 1 e voltando ao último capítulo, marcas não vazando entre capítulos, ferramentas ainda funcionando, viewport móvel sem rolagem horizontal, 404 para livro e capítulo inexistentes, nenhum erro de console.
- Limites: nenhuma escrita no banco por esta frente, nenhum commit, nenhuma rede além da consulta de leitura ao banco configurado.

## 2026-11-17 — C8: regressão do leitor (primeiro E2E do projeto)

- Ação: criado `tests/e2e/reader.spec.ts` com 13 testes cobrindo o que a tarefa pede — raiz abrindo o leitor, `/biblia` redirecionando, cabeçalho fixo visível após rolagem, menu acessível por nome com `role=dialog`/`aria-modal`, troca de tema persistindo na sessão e entre capítulos, navegação por seletor e por URL, fronteira de livro, marcas isoladas por capítulo e leitura em viewport móvel (390x844) sem rolagem horizontal. Isso fecha o item B-08 ("nenhum teste E2E existe").
- Acessibilidade corrigida de propósito para o teste cobrir: o painel de ferramentas não fechava com `Escape` — o seletor de livro já fechava. Agora os dois fecham.
- `playwright.config.ts` foi parametrizado: `PLAYWRIGHT_BASE_URL` usa um servidor já em pé em vez de subir `npm run dev` (necessário aqui, porque o `next dev` do processo concorrente mantém o lock do miniflare) e `PLAYWRIGHT_CHROMIUM_PATH` aponta um Chromium já instalado, sem exigir `npx playwright install` (a versão do pacote espera o build 1255 e o cache local tem o 1248). Sem essas variáveis, o comportamento é o anterior.
- Verificação: `npx playwright test` — 13 de 13 passaram contra o build de produção e o corpus real. Nenhum deploy.

## 2026-11-17 — C9: contrato e endpoint de busca BLIVRE

- Ação: `src/server/contracts/bible-search.ts` (entrada validada, termos, escape de curinga, resolução de referência, projeção e ordenação), `src/server/bible/search.ts` (serviço injetável), `src/server/bible/search-repository.ts` (consultas Drizzle, somente SELECT), `getBlivreSearch()` em `runtime.ts` e o endpoint `app/api/biblia/busca/route.ts`.
- Direitos por construção: **não existe parâmetro de tradução**. A busca é sempre na tradução aprovada recebida na construção, justamente para que o endpoint não possa ser apontado a texto sem licença. Só versículo `published` é devolvido — filtrado na consulta e de novo no contrato. Limite (máx. 50), deslocamento (máx. 1000) e ordenação canônica são sempre aplicados, para não permitir reconstrução do corpus por varredura.
- Segurança de consulta: o padrão de `ILIKE` vai como parâmetro ligado e os curingas digitados são escapados, então um `%` procura o caractere `%` e não "qualquer coisa". Termos têm pontuação de borda aparada, mínimo de 2 caracteres, no máximo 6 termos, todos exigidos (AND).
- Referência tem precedência: "João 3:16" devolve o versículo, não as ocorrências da palavra "João". Prefixo ambíguo não resolve — "jo 3" não vira João nem Jonas. Livro fora da lista do corpus não é adivinhado.
- Verificação: 15 testes em `tests/server/bible-search.test.ts` com fixtures sintéticas. Contra o banco real, pelo endpoint: `q=criou` devolveu 26 ocorrências em ordem canônica; `q=princípio` (percent-encoded) 107; `q=joao+3:16` resolveu como referência com o texto real de João 3:16; `q=JHN+3` devolveu o capítulo com limite respeitado e `truncated: true`; `book=genesis&limit=3&offset=2` paginou corretamente sobre 61 resultados; consulta vazia, termo de 1 letra, `limit=999`, `offset=-1` e `book` malformado responderam 400; cabeçalhos `no-store` e `nosniff` presentes. Dois zeros iniciais na minha conferência eram codificação do shell, não do endpoint — confirmado com a forma percent-encoded.
- Limite: nenhuma UI de busca foi criada, conforme a tarefa, que pede contrato e endpoint. Com 31102 versículos o `ILIKE` é varredura sequencial; se virar gargalo, o próximo passo é índice trigram ou `tsvector`, em migration própria.

## 2026-11-17 — C12: validação de PWA, APK e prontidão de loja

- Ação: validação real dos manifests, ícones, metadados e cadeia de build, com atualização de `docs/MOBILE_RELEASE.md`, `docs/APK_BLOCKER.md` e `docs/STORE_PUBLICATION_READINESS.md`. Nenhuma conta criada, nenhum app assinado, nada enviado a loja, nenhum deploy.
- **Causa raiz do B-02 encontrada e corrigida.** O service worker não instalava porque `public/sw.js` pré-cacheava `/apple-icon.svg` em `cache.addAll`, e essa URL respondia 404 — um único 404 faz `addAll` rejeitar e derruba a instalação inteira. O 404 acontecia porque o Next não gera rota de `apple-icon` a partir de SVG (a convenção aceita `.png`, `.jpg`, `.jpeg`): `app/apple-icon.svg` era arquivo inerte, sem rota e sem `<link>` no `<head>`, e o manifest ainda o listava como ícone. Removi a URL inexistente do service worker e do manifest, subi o cache para `samjoe-static-shell-v2` e apaguei o arquivo inerte.
- Verificação depois da correção, em build de produção com navegador real: 15 de 15 checagens — manifest 200 e válido, `display: standalone`, `start_url` `/`, `lang` `pt-BR`, todos os ícones do manifest respondendo 200, service worker chegando a `activated`, `/offline` e `/icon.svg` pré-cacheados, nenhum conteúdo pessoal ou premium em cache, navegação offline caindo no shell **sem exibir versículo**, e nenhuma requisição 4xx/5xx na carga normal.
- Pré-requisitos Android medidos (o `APK_BLOCKER.md` pedia exatamente isso e antes não pôde rodar): `JAVA_HOME` aponta para `C:\Program Files\Java\jdk-17`, que **não tem `bin\java.exe`** — o JDK foi removido e a variável ficou órfã; o stub do `javapath` existe mas falha ao executar, então `Get-Command java` retornar caminho é enganoso. `gradle`, `adb`, `sdkmanager`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, o SDK em `%LOCALAPPDATA%`, os módulos `@capacitor/*` e `mobile/www` estão todos ausentes. Não há cadeia de build Android nesta máquina.
- Bloqueio de arquitetura registrado: o leitor e a busca são rotas de servidor (`force-dynamic`), e `/estudos/[slug]` e `/temas/[slug]` são por parâmetro, então não existe export estático utilizável para empacotar no Capacitor hoje. Empacotar um `out/` estático entregaria app sem leitura, sem busca e sem autorização premium.
- Pendências que seguem bloqueando loja, todas dependentes do proprietário: PNG 192/512 com `purpose: maskable` e apple-touch-icon 180 (rasterizar o SVG atual é mecânico, mas a margem de segurança do maskable é decisão de arte); política de privacidade e e-mail de suporte, que continuam texto-marcador; contas de desenvolvedor e assinatura; nenhuma evidência de instalação em dispositivo real. Também registrei a divergência de identificador: `mobile/capacitor.config.json` usa `com.samjoe.bibliabereana` e `docs/MOBILE_RELEASE.md` citava `com.samjoe.estudos`.

## 2026-11-17 — C13: seleção múltipla e ações de leitura

Os sete itens da tarefa foram implementados. Durante a execução, o processo concorrente comitou esta frente (`2d43be4 feat: add multi-verse reader selection workflow`) e em seguida a estendeu (`bceeea1 feat: refine Bible reader interactions`, `d2dd30a fix: complete chapter picker error state`), acrescentando menu lateral, contexto de capítulo, gestos de toque, mais opções de fonte/tamanho/espaçamento, "Copiar"/"Compartilhar" e a contagem de capítulos de todos os livros vinda do servidor. Nada daquele trabalho foi revertido; o registro abaixo descreve o estado final combinado.

- Lógica pura nova: `src/domain/reader-marks.ts` concentra cores, escopo de capítulo, chaves de marca e seleção. A chave da nota é **precisa**: uma seleção de 3 e 5, sem o 4, grava `3,5` e nunca `3-5` — a chave não pode afirmar mais do que foi selecionado. Escopo é comparado inteiro, então `genesis.1` não casa com `genesis.11`. 13 testes em `tests/domain/reader-marks.test.ts`.
- Estado: `app/biblia/reader-state.tsx` passou a `reader-session-v3`, com destaque por cor (`livro.capítulo.versículo`), nota por seleção (`livro.capítulo.lista`) e "lido" como escopo de capítulo. A seleção não persiste, de propósito: é intenção sobre o texto na tela, não marca guardada. Trocar de capítulo zera seleção e fecha painéis.
- Interação (itens 1 a 6): toque no versículo seleciona e desseleciona, com `aria-pressed`, sem abrir painel; a barra flutuante só existe com seleção e abre menu com destaque em quatro cores, nota, comparar traduções, consultar original e limpar; "lido" virou ação única de capítulo no cabeçalho; o menu de três pontos ficou só com tema, tamanho, fonte e espaçamento; comparar traduções e consultar original abrem apenas a partir da seleção e explicam a indisponibilidade sem inventar dado — nenhuma palavra em grego, transliteração, glossa ou morfologia é exibida.
- Dois defeitos reais corrigidos, encontrados pelos testes:
  1. **No celular o menu de três pontos desaparecia por completo.** A regra `.readerActions button:first-child{display:none}` em `app/biblia/reader.css` foi escrita quando o cabeçalho tinha o alternador de tema como primeiro botão; com a composição atual (lido + três pontos) ela passou a casar com o botão interno do painel de configurações, porque `button:first-child` vale para qualquer botão que seja o primeiro filho do próprio pai, não apenas filho direto de `.readerActions`. Resultado: no telefone não havia acesso a tema, tamanho, fonte nem espaçamento, contra os itens 4 e 5 da tarefa. A regra foi removida e o teste móvel agora exige as duas ações visíveis.
  2. **Abrir um painel deixava o menu suspenso aberto por baixo**, empilhando duas camadas sobre o texto. Agora escolher uma ação fecha o menu.
- Ambiguidade de acessibilidade resolvida sem renomear o trabalho alheio: "Padrão" existe tanto em tamanho do texto quanto em espaçamento, o que deixava dois botões com o mesmo nome acessível no mesmo diálogo. Cada grupo de ajustes ganhou `role="group"` com `aria-labelledby`, então leitor de tela e teste distinguem os dois.
- Testes (item 7): `tests/e2e/reader.spec.ts` foi reescrito para a interação nova — 18 testes cobrindo porta de entrada, 404, cabeçalho fixo, "lido" por capítulo com isolamento entre capítulos, menu de três pontos contendo apenas configurações, tamanho menor adicional, tema persistindo na sessão, seleção múltipla e descontínua rotulada sem afirmar faixa, destaque por cor sem vazar entre capítulos, nota ligada à seleção exata, indisponibilidade de comparação e original, seletor em duas etapas com volta para a lista de livros, fronteira de livro e três cenários em viewport móvel.
- Verificação: `npm run typecheck` passou; `npm run test` passou com **106 testes em 13 arquivos**; `npx playwright test` passou com **18 de 18**; `npm run build` passou; `git diff --check` passou. `npm run lint` tem 2 warnings, ambos fora desta frente: `dirname` não usado em `src/cli/import-theology.ts` (pré-existente) e uma dependência desnecessária de `useMemo` em `app/biblia/reader-state.tsx:502`, introduzida pelo processo concorrente ao adicionar `verseTexts`.
- Limites respeitados: nenhuma alteração em corpus, API de leitura, licenças ou banco; nenhum deploy; nenhum commit criado por esta frente.

## 2026-11-17 — C15: app shell e painel de início

Tarefa escolhida por exclusão: C14 estava sendo executada por outra instância no mesmo momento (gravações em `src/importers/original/**`, `scripts/fetch-original-sources.ts`, `drizzle/0005_original_languages.sql` entre 19h44 e 19h54) e C17a/C17b estão sob reserva da instância `c17-login-perfil`. C15 tinha o portão satisfeito (C13 concluída) e nenhum arquivo em disputa.

- **Navegação como dado, não como marcação:** `src/domain/app-navigation.ts` descreve as oito áreas da fila (Início, Bíblia, Materiais, Notas, Estudos, Cursos, Planos, Perfil) com `availability` explícita. Só é `available` a área que tem página publicada. `notas` fica indisponível porque depende de Auth real (C5/C10) e `perfil` porque está em construção na frente C17 — as duas aparecem com o motivo escrito, em vez de link que levaria a 404. `isAreaActive` compara segmento inteiro, então `/biblia` casa com `/biblia/genesis/1` e nunca com `/bibliateca`, e a raiz não ativa área nenhuma.
- **Casca responsiva:** `app/_components/app-shell.tsx` + `app-shell.module.css`. Até 900px a navegação é gaveta com botão, fundo clicável e `Escape`; a partir de 900px ela fica fixa à esquerda e o botão desaparece. Fechada no celular, a gaveta usa `visibility:hidden`, então os links não entram na ordem de tabulação. Tem atalho "Ir para o conteúdo", `aria-current="page"` na área ativa e foco visível. A casca **não** envolve o leitor: `/biblia` tem cabeçalho próprio e imersivo definido no C13.
- **Painel de início em `/inicio`:** a raiz continua redirecionando para o leitor, como a regressão do C8 exige. O painel mostra retomar leitura, capítulos marcados como lidos, contagem de notas e destaques, e um bloco de novidades.
- **Nenhum número inventado:** `src/domain/reading-session.ts` lê o registro local e valida tudo — chave de marca inválida, escopo repetido, capítulo 0, JSON corrompido e nota só com espaços são descartados; as contagens saem das chaves válidas, nunca de um total declarado pelo armazenamento. Sem registro, cada bloco diz que está vazio e oferece o caminho para a leitura. Se o navegador não liberar `sessionStorage`, o painel diz isso em vez de mostrar zero.
- **Ponteiro de "retomar leitura":** `app/biblia/reading-pointer.tsx`, montado em `app/biblia/layout.tsx`, grava apenas livro, capítulo e instante do capítulo aberto em `sessionStorage` (`reader-last-chapter-v1`). Não renderiza nada e não muda o comportamento do leitor. O nome exibível (`Gênesis 1`) é lido do título da página, que o servidor monta com o nome real do livro vindo do corpus, e só é aceito se conferir com o número do capítulo da rota; quando não confere, o painel mostra o caminho (`/biblia/genesis/1`) — nenhum nome de livro é inventado no cliente. Isso evitou editar `app/biblia/[book]/[chapter]/page.tsx`, que está com bytes inválidos (ver abaixo).
- **Novidades sem promessa:** `src/content/platform-updates.ts` é lista editorial mantida à mão, cada entrada marcada como disponível ou indisponível e conferível neste registro. Não há feed, data de lançamento, preço ou conteúdo premium.
- **Alcance:** a única alteração em arquivo de outra frente foi acrescentar a entrada "Início" ao array do menu lateral do leitor (`app/biblia/reader-side-menu.tsx`), para o painel ser alcançável. Nenhuma entrada existente foi tocada.
- Testes novos: `tests/domain/app-navigation.test.ts` e `tests/domain/reading-session.test.ts` (ordem e unicidade das áreas, disponibilidade com motivo, área ativa por segmento, rota do leitor, rótulo vindo do título — inclusive com livro numerado como `1 Reis 1` e com separador ilegível —, ponteiro corrompido e contagens do registro local).
- Limites respeitados: nenhum banco, Auth, pagamento, rede, migration, `.env*`, deploy ou commit. Nenhuma página de `app/perfil/**`, `app/conta/**` ou `app/entrar/**` foi criada ou editada, por causa da reserva de C17. Nenhuma tela de notas foi criada, por causa do bloqueio de C10.
- **Verificação pendente de aprovação do operador:** neste ambiente os comandos de terminal (`git`, `npm`) exigem aprovação manual e foram recusados, então `lint`, `typecheck`, `test` e `build` não puderam ser executados por esta frente. O código novo é autocontido (dois módulos puros, uma casca de UI, uma página e dois arquivos de teste), mas o aceite só se fecha depois de rodar os quatro comandos.
- **Defeito encontrado e não corrigido, por ser de outra frente:** `app/biblia/[book]/[chapter]/page.tsx` tem 19 sequências de bytes inválidos em UTF-8, e parte delas é texto visível ao leitor: as setas de "anterior"/"seguinte" na navegação entre capítulos, o separador do rodapé e do `<title>`, o `aria-label` "Navega��o entre cap�tulos" e o título/descrição do estado indisponível ("Leitura indispon�vel"). O arquivo tem codificação mista — outros acentos no mesmo arquivo estão corretos. Não editei: qualquer ferramenta que reescreva o arquivo inteiro transformaria esses bytes em `U+FFFD` de forma definitiva, e a decisão sobre quais glifos restaurar é da frente do leitor. Nenhum outro arquivo de `app/`, `src/`, `tests/` ou `scripts/` tem o problema.
