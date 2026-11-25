
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

## 2026-11-17 — Finalização de C14 e C15

Passagem de fechamento sobre as duas frentes que estavam em andamento na árvore.
Não toquei em C13, C16, C17, `app/entrar/**`, `app/perfil/**`, `app/materiais/**`,
`app/cursos/**`, `src/content/catalog-fixtures.ts` nem `src/domain/catalog.ts`.
Nenhuma tarefa bloqueada (C5, C6, C10, C11) foi iniciada.

### Limite de ambiente, declarado antes dos resultados

Nesta sessão **`npm`, `npx`, `node` e `git` foram recusados pela camada de
permissão** (`git` também acusa `dubious ownership`, porque `.git` pertence à
conta `CodexSandboxOffline`, e a exceção `safe.directory` exigiria alterar
configuração global, o que também foi recusado). Portanto:

- **não executei** `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`, `npx playwright test` nem
  `node --experimental-strip-types scripts/verify-original-corpus.ts`;
- **não inspecionei a árvore por Git**: o levantamento do que estava modificado
  foi feito por data de modificação de arquivo (`find -newermt`), não por
  `git status`;
- o que verifiquei de fato foi **checksum real** (`sha256sum`, permitido) e
  revisão estática de código, tipos, nomes exportados e chaves de CSS module.

Isso vale para as duas frentes: o aceite formal de C14 e C15 só fecha quando os
quatro comandos e o script de verificação rodarem. A pendência registrada na
entrada anterior do C15 **continua aberta** por esse motivo.

### C14 — corpora originais

**O portão de licença/arquivo oficial foi satisfeito, então não houve bloqueio a
registrar.** A coleta já estava feita por outra instância, em
`data/sources/originals/`, e reconferi os bytes localmente, sem rede:

- **32 de 32 arquivos conferem o SHA-256 do manifesto**: `hebwlc_usfm.zip`,
  `morphhb-v.2.2.tar.gz`, as 3 evidências de licença e os 27 arquivos de texto
  do SBLGNT. Nenhuma divergência.
- **Licença verificável nos arquivos locais**, não por memória nem por rede:
  `oshb-morphhb/LICENSE.md` declara base WLC em domínio público, CC BY 4.0 e a
  frase de atribuição exigida; `sblgnt/LICENCA.html` contém o texto da
  "Creative Commons Attribution 4.0 International Public License";
  `wlc-ebible/EVIDENCIA-LICENCA.html` declara `Public Domain`.
- Versão fixada: MorphHB tem tag (`v.2.2`) e commit
  (`6a5db284c715c18b239422e57bb89684e6a19f00`) reais. WLC (eBible) e SBLGNT
  (sblgnt.com) **não têm release nem tag**: são arquivos correntes, e o único
  pino é o SHA-256. Registrei isso como limitação, em vez de chamar de "versão".
- As três fontes seguem `collected_pending_human_approval`. **Nada de hebraico,
  grego, lema ou morfologia aparece em qualquer tela**, e nenhuma edição está
  aprovada. O corpus está fora de `public/`, e `.gitignore` o mantém fora do Git.

**Lacuna fechada — proveniência não estava versionada.** `.gitignore` ignora
`data/sources/originals/` inteiro, inclusive os `MANIFEST.json`. Ou seja, o
registro de URL oficial, licença, atribuição, versão/commit e checksum que a
tarefa exige vivia só em arquivo ignorado, e se perderia. Passei esse registro
para `docs/ORIGINAL_LANGUAGE_SOURCES.md`, que é versionado: tabela de
proveniência com data de coleta, versão fixada e licença de cada fonte, os cinco
checksums principais, a limitação de "sem tag" acima e a explicação de qual
digitalização do WLC está em uso. A coluna "Situação" da tabela de candidatos
deixou de dizer "ainda requer pin de arquivo e checksum", que já não era verdade.

**Defeito real encontrado e corrigido** em `scripts/verify-original-corpus.ts`:
o script varria `wlc/*.xml` e contava os 40 arquivos como livros, mas um deles é
`VerseMap.xml` — o catálogo de diferenças de versificação entre WLC e KJV que a
própria fonte distribui no mesmo diretório. O relatório afirmaria **40 livros
hebraicos onde o corpus tem 39**. `VerseMap.xml` não produzia versículo falso
(seus `<verse wlc=… kjv=…/>` não têm `osisID`, então o parser os ignora), mas o
arquivo entrava na contagem e nada avisava que ele rendeu zero. Agora é excluído
explicitamente e, nos dois corpora, **arquivo de livro que não rende versículo
nenhum é falha** (`livros sem texto`) em vez de passar batido.

**Endurecimento em `src/importers/original/morphhb.ts`:** o parser do hebraico
lia `osisID` e usava o `bookCode` recebido como `canonBook` sem conferir o livro
declarado no próprio `osisID`. Um versículo de outro livro seria gravado com uma
referência que a fonte não afirma. O parser do grego já relatava divergência de
sigla; o do hebraico agora relata `livro X diverge do arquivo Y` e descarta a
linha, em vez de reetiquetar em silêncio. Teste novo em
`tests/importers/original-languages.test.ts`.

**O que não fiz em C14, de propósito:** não existe parser do USFM do eBible, e
não criei um. O texto hebraico vem do OSIS do MorphHB; o pacote do eBible fica
como evidência independente de domínio público do texto-base. São duas
digitalizações do mesmo códice, e misturá-las sob o mesmo rótulo daria texto de
procedência ambígua. A decisão está escrita no script e agora também no doc. Não
rodei `scripts/fetch-original-sources.ts` (usa rede) e não apliquei
`drizzle/0005_original_languages.sql` em banco algum, local ou remoto.

### C15 — app shell e dashboard

Concluí só UI local e fixtures honestas; nada de banco, Auth ou pagamento.

**Defeito real corrigido — link que dava 404.** `app/biblia/reader-side-menu.tsx`
tinha a lista de áreas escrita à mão, com `{ href: "/notas", label: "Minhas
notas" }`. **`app/notas` não existe**, então essa entrada do menu do leitor levava
a 404 — exatamente o que `src/domain/app-navigation.ts` existe para evitar, e que
a entrada anterior deste registro já havia apontado como pendência. O menu passou
a derivar de `appAreas`, a mesma lista da casca: área disponível vira `Link`, área
sem página publicada vira texto com o motivo. Uma fonte de verdade, não duas.
Acrescentei a classe `.off` em `reader-side-menu.module.css` (claro e escuro).

**Afirmação vencida corrigida:** `perfil` estava marcada `unavailable` com o
motivo "área pessoal em construção", mas `app/perfil/page.tsx` **passou a existir**
(frente C17b, 20:03). Pela própria regra de C15 — só é `available` a área com
página publicada — a área virou disponível, com descrição que não promete nada:
"identidade e segurança exigem autenticação, que ainda não existe". A página em si
continua dizendo que cada recurso exige autenticação; não simulei sessão nem
editei `app/perfil/**`. Isso também atende o aceite de C17b, que pede a área
alcançável pelo app shell quando o link existir. `notas` segue indisponível, com
motivo, porque continua sem página. `tests/domain/app-navigation.test.ts` foi
atualizado para a realidade nova (perfil disponível e ativo em `/perfil`; notas
indisponível e nunca ativa).

Conferi estaticamente o resto do C15: todas as classes usadas em
`app-shell.tsx` e `dashboard.tsx` existem nos respectivos CSS modules (17 e 15
nomes), `@/*` resolve para a raiz pelo `tsconfig.json`, as chaves que
`src/domain/reading-session.ts` lê (`reader-session-v3`, `highlights`, `notes`,
`readChapters`) batem com `app/biblia/reader-state.tsx`, e os regex reusados de
`reader-marks.ts` não têm flag `g` — então `.test()` compartilhado não carrega
estado entre chamadas. `src/content/platform-updates.ts` continua factual depois
do C14: a entrada que diz que o painel de originais segue sem grego ou hebraico
aprovado permanece verdadeira, porque coletar não é aprovar.

### Arquivos alterados nesta passagem

`src/domain/app-navigation.ts`, `app/biblia/reader-side-menu.tsx`,
`app/biblia/reader-side-menu.module.css`, `tests/domain/app-navigation.test.ts`,
`src/importers/original/morphhb.ts`, `tests/importers/original-languages.test.ts`,
`scripts/verify-original-corpus.ts`, `docs/ORIGINAL_LANGUAGE_SOURCES.md` e este
registro.

### Pendências que continuam, e de quem são

1. **Rodar `lint`, `typecheck`, `test`, `build` e o script de verificação do
   corpus.** Recusados nesta sessão; é o que falta para fechar o aceite de C14 e
   C15. O script deve imprimir 27 livros gregos e **39** hebraicos.
2. **Aprovação humana das três edições originais** (C6 depende disso). Coleta e
   checksum estão feitos; aprovar é decisão do operador, com revisão de direitos,
   integridade e amostra, e fica registrada em `docs/ORIGINAL_LANGUAGE_SOURCES.md`.
3. **`drizzle/0005_original_languages.sql` não foi aplicada** em nenhum banco, e
   não foi validada em Postgres local nesta sessão (sem `node`/`docker`).
4. **Mojibake em `app/biblia/[book]/[chapter]/page.tsx` continua** — conferido
   agora: linha 90 (`"Leitura indispon�vel | B�blia Bereana"`) e linha 165
   (`aria-label="Navega��o entre cap�tulos"`). É texto visível ao usuário, é da
   frente do leitor e não foi causado por C14 nem por C15, então não editei.
5. **Casca não envolve `/materiais`, `/estudos`, `/cursos` e `/planos`**, que usam
   o tema claro de `app/globals.css`. Envolvê-las exige reestilizar páginas da
   frente C16, fora do alcance desta passagem.

Nada commitado. Nenhuma rede. `.env*` intocado. Nenhuma migration aplicada.
Nenhum deploy.

### Adendo de validação e publicação — 17/11/2026

Após essa passagem, o responsável pela integração executou as validações no mesmo
workspace: `npm run build` terminou com sucesso (inclui lint e checagem de
tipos), e `npx vitest run tests/importers/original-languages.test.ts
tests/domain/app-navigation.test.ts` passou com 23 testes. Permanecem apenas os
warnings pré-existentes de `useMemo` em `reader-state.tsx` e de `dirname` não
usado em `src/cli/import-theology.ts`.

`node --experimental-strip-types scripts/verify-original-corpus.ts` confirmou:
SBLGNT 27 livros / 7.927 versículos / 137.542 tokens; MorphHB 39 livros /
23.213 versículos / 306.785 tokens / 471.674 morfemas; nenhum checksum
divergente, linha recusada, problema ou livro sem texto. As edições continuam
`collected_pending_human_approval` e não foram expostas no aplicativo.

Os commits `b354a2f` e `9344934` registraram C14--C17 localmente; o Worker
`samjoe-estudos` foi publicado depois da validação. Nenhuma migration foi
aplicada e nenhum corpus privado foi enviado ao Git ou ao bundle público.

## 2026-11-18 — Frente A do plano de conta: autenticação, cadastro e acesso reais

Executada por uma sessão headless do Claude CLI neste mesmo workspace
(`session_id 5dfb9cff-9e79-476c-a54c-7ce9eb01d9bb`; registro integral em
`.claude/auth-cli.log`), encerrada às 11:09 de 18/11/2026. Esta entrada foi
escrita depois, por ordem do operador: a sessão executora não registrou aqui
porque a instrução dela limitava a documentação à seção de infraestrutura do
`docs/ACCOUNT_AND_ORIGINALS_EXECUTION_PLAN.md`.

Isto encerra o que o C17 deixava como esqueleto. As telas de conta deixaram de
ser marcadores inertes e passaram a falar com o Supabase Auth de verdade,
falhando fechada enquanto as chaves não existirem: sem configuração, cada tela
declara a indisponibilidade em vez de simular sessão.

### Servidor — `src/server/auth/`

| Arquivo | Papel |
| --- | --- |
| `config.ts` (estendido) | Validação de ambiente; aceita `PUBLIC_SITE_URL` (`https`, ou `http` apenas em localhost) e decide se o cookie pode ser `Secure` |
| `client.ts` (novo) | Contrato do cliente; tipos de verificação restritos a `email`/`magiclink`/`signup` |
| `gotrue.ts` (novo) | Cliente HTTP do Supabase Auth escrito à mão sobre `fetch`, **sem instalar dependência**, porque `package.json` não podia ser tocado. Cobre OTP, verify, refresh, user e logout `scope=global`, com prazo por chamada e nenhuma mensagem do provedor atravessando para a interface |
| `session.ts` (novo) | Formato e validação do cookie `samjoe_session` (`httpOnly`, `SameSite=Lax`, `Secure`, 7 dias de inatividade) |
| `rate-limit.ts` (novo) | Limite em janela fixa, puro, com chave em hash |
| `profiles.ts` (novo) | Papel lido de `profiles` — nunca de cookie ou metadado —, criação de perfil no primeiro acesso e registro de pedido de exclusão |
| `runtime.ts` (novo) | Única fiação entre ambiente, cookie, provedor e banco. Máquina de estados `unconfigured → anonymous → degraded → authenticated` |
| `index.ts` (estendido) | `createAuth` com verify por código, verify por link, refresh, `signOut` e `getIdentity`; mais `authorize`, `toViewer` e `looksLikeEmail` |

### Interface e ações

`/entrar` e `/criar-conta` com formulário real de dois passos
(`app/_components/access-form.tsx` e seu CSS module), `/auth/callback` para o
link do e-mail, `/conta` com sessão, dados mínimos, sair e solicitar exclusão,
e `/perfil` e `/acessos` refletindo a sessão real. Server Actions em
`app/_actions/account-access.ts`. Contrato puro em
`src/domain/account-access.ts`; navegação ajustada em
`src/domain/app-navigation.ts`.

### Banco

`drizzle/0006_account_access.sql`, **não aplicada em nenhum banco**: RLS em
`profiles`, gatilho de criação de perfil em `auth.users`, gatilho que recusa
mudança de `role` pelo papel de aplicação, e tabela
`account_deletion_requests` com RLS e índice parcial único. `drizzle/schema.ts`
e `drizzle/meta/_journal.json` acompanham.

### Decisões de segurança

Registradas por extenso no plano; em resumo: o cookie **não é assinado por
nós**, porque não há segredo próprio configurado e inventar um seria pior — a
integridade vem do provedor, e toda decisão de autorização chama
`GET /auth/v1/user`, sem decodificar o JWT localmente. `/auth/callback` ignora
`next` de propósito, para não abrir redirecionamento, e todos os erros caem em
`/entrar?erro=link` sem distinguir "não existe" de "expirou". O modo
entrar/cadastrar é argumento vinculado da Server Action, não campo de
formulário, então um POST forjado não cria conta pela tela de entrar. Papel
fora do enum é ausência de papel, nunca `reader`; banco fora do ar vira
`degraded`, que explica e não concede nada. A exclusão registra o pedido e
revoga a sessão globalmente, mas não apaga no clique, porque a política de
retenção não foi aprovada.

### Verificações

Relatadas pela sessão executora: `npx tsc --noEmit` limpo, `npx eslint` limpo
nos arquivos alterados, `npx vitest run` com 188 testes em 23 arquivos
(6 arquivos novos de auth/domínio, 41 testes na frente), `npx next build` com
sucesso e rotas de conta dinâmicas, e smoke test com `next start` em que
`/entrar`, `/criar-conta`, `/conta`, `/perfil` e `/acessos` respondem 200 no
estado honesto de indisponibilidade — as chaves estão vazias — e
`/auth/callback` devolve 303 para `/entrar`.

Reconferidas em 18/11/2026, entre 11:11 e 11:17, por outra sessão e sem alterar
código: `npx tsc --noEmit` limpo; `npx eslint` nos diretórios desta frente
limpo; `npx vitest run` com **188 testes em 23 arquivos, todos passando**;
e `npx next build` com sucesso, exit 0. O build foi feito com
`SAMJOE_NEXT_DIST_DIR=.next-verify` para não disputar o cache `.next` com os
dois servidores de desenvolvimento ativos no momento (portas 3008 e 3011); o
diretório temporário foi removido depois da conferência. `/entrar`,
`/criar-conta`, `/conta`, `/perfil`, `/acessos` e `/auth/callback` saem
dinâmicas, como relatado. Os únicos avisos são os pré-existentes e alheios a
esta frente: `useMemo` em `reader-state.tsx`, `<img>` em página do BKR e
`dirname` não usado em `src/cli/import-theology.ts`. O smoke test com
`next start` não foi repetido.

### Pendências que continuam, e de quem são

1. **Infraestrutura do proprietário**, detalhada na seção "Dados de
   infraestrutura que faltam" do plano: `SUPABASE_PUBLISHABLE_KEY`,
   `PUBLIC_SITE_URL`, Site URL e redirecionamentos no painel Supabase, template
   de e-mail com `token_hash`, conexão Postgres no Worker (`wrangler.jsonc`
   ainda não declara `HYPERDRIVE`), armazenamento compartilhado para o limite
   de tentativas, política de retenção publicada e `SUPABASE_SECRET_KEY`.
   Enquanto faltarem, a frente fica `unconfigured` ou `degraded` por desenho.
2. **`drizzle/0003_reading_personal_data.sql` e `drizzle/0006_account_access.sql`
   não aplicadas**, e só devem ser aplicadas depois de ler o baseline remoto.
3. **Nada commitado.** A frente inteira está na árvore de trabalho sobre
   `39f960b`.
4. **`next.config.ts` e `tsconfig.json` aparecem modificados sem terem sido
   editados por esta frente**: o `distDir` via `SAMJOE_NEXT_DIST_DIR` e a
   entrada `.next-bkr/types` vêm do trabalho paralelo do BKR (`app/bkr/`,
   `.next-bkr/`), e a reformatação do `tsconfig.json` é o próprio Next
   reescrevendo o arquivo no build. Não foram revertidos para não atropelar a
   outra frente. `package.json` e `package-lock.json` já estavam modificados
   antes, com `@next/swc-win32-x64-msvc` como única diferença, e também não
   foram tocados.
5. **Os dois worktrees `.claude/worktrees/auth-readiness` e
   `auth-readiness-v2`** ficaram no commit `12622c7`, com árvore limpa: são
   sobra de tentativa anterior e podem ser removidos quando o operador quiser.

Nenhuma migration aplicada. Nenhum deploy. `.env*` intocado. Nenhum segredo
exposto.

## 2026-11-18 — Produção ligada ao Supabase (frente A)

Ordem do operador, com três decisões explícitas: aplicar as migrations pendentes
pelo `drizzle-kit`, definir os secrets do Worker e publicar a frente de conta.

### Banco

`npm run db:migrate` aplicou `0005_original_languages.sql` e
`0006_account_access.sql` no projeto `samjoe-bible-mvp` (sa-east-1, Postgres 17).
O ledger `drizzle.__drizzle_migrations` saiu de 5 para **7 registros**; antes
disso o remoto estava em `0004`. Conferido objeto por objeto depois: `profiles`
com RLS ligado e policy `profiles_read_own`, `account_deletion_requests` criada
com as duas policies, gatilho `auth_user_creates_profile` em `auth.users` e
gatilho `profiles_protect_role` presentes. A `0005` criou apenas as quatro
tabelas vazias dos originais (`original_editions`, `original_verses`,
`original_tokens`, `original_morphemes`): nenhum corpus importado, nada exposto
no app, e as edições seguem `collected_pending_human_approval`.

Antes de aplicar: `auth.users` = 0 e `profiles` = 0, então não houve backfill
nem risco a dado de usuário. O gatilho de criação de perfil só dispara em
inserção nova.

### Worker

`SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` enviados por `wrangler secret put`;
`DATABASE_URL` já estava. `PUBLIC_SITE_URL` foi declarada como **var** em
`wrangler.jsonc`, não como secret: é o endereço público do app e fica revisável
no repositório.

Commit `667b431` com a frente de conta (33 arquivos) e deploy por
`npm run deploy`. Versão publicada: `a6423a92-f971-4d0b-8293-88296d957e1b`.
O trabalho paralelo do BKR ficou fora do commit, intocado.

### Verificação em produção

- `/entrar`, `/criar-conta`, `/conta`, `/perfil` e `/acessos`: HTTP 200.
- `/entrar` serve o formulário real ("E-mail", "Receber código de acesso") e
  **não** mostra mais o marcador do C17 nem o aviso de ambiente não
  configurado — prova de que o Worker lê as chaves.
- `/auth/callback` sem token: 303 para `/entrar?erro=link`.
- `/conta` sem sessão: estado honesto com caminho para entrar.
- **O Worker alcança o Postgres**: `/api/biblia/busca?q=luz` devolveu 319
  ocorrências do banco e `/biblia/genesis/1` renderizou o capítulo. Isso
  **descarta a necessidade do binding `HYPERDRIVE`** para esta aplicação: a
  direct connection do Supabase responde de dentro do Worker. A linha
  correspondente do plano fica obsoleta.

Não testado: uma ida e volta real de código por e-mail, que depende de endereço
real e consome o limite de envio.

### O que continua faltando, e por quê

1. **Painel de Auth do Supabase**, três campos que impedem o login de funcionar:
   `site_url` ainda é `http://localhost:3000`; `uri_allow_list` está **vazia**,
   o que faz o provedor recusar o `redirect_to` do app; e `mailer_otp_length` é
   **8**, enquanto a interface promete seis dígitos em
   `src/domain/account-access.ts`. O código digitado funcionaria de qualquer
   tamanho — o app não valida comprimento, só repassa ao provedor —, mas o texto
   da tela estaria mentindo.
2. **Templates de e-mail** usam `{{ .ConfirmationURL }}`, que não entrega
   `token_hash` ao nosso `/auth/callback`; o atalho por link termina em
   `/entrar?erro=link`. Precisam virar
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink` e
   `&type=signup`.
3. Tentativa de corrigir 1 e 2 pela Management API devolveu **HTTP 400**, apesar
   de todos os campos baterem com o schema publicado (`mailer_otp_length` aceita
   6–10). O projeto está no plano **free**, que é a suspeita. A segunda chamada,
   para ler o corpo do erro e isolar o campo, foi recusada pelo controle de
   permissões desta sessão. Fica para o painel ou para uma autorização explícita.
4. **`rate_limit_email_sent` = 2 por hora**, teto do serviço de e-mail embutido.
   Serve para testar, não para abrir ao público: exige SMTP próprio.
5. Limite de tentativas continua por isolate, em memória, e a política de
   retenção continua não aprovada — os dois já estavam registrados no plano.

## 2026-11-18 — Estrutura de entrega de e-mail e descoberta de 2FA

Ordem do operador: encaixar a Bíblia na arquitetura de envio que a SamJoE desenhou no sistema
jurídico e abrir uma tarefa de descoberta para token de 2FA por WhatsApp e SMS. Nada executado em
AWS, DNS, provedor ou painel nesta passagem: a entrega é documental.

### Levantamento que precedeu

Antes de escrever, foi medido o que existe. Em `E:\Sistema Juridico`: `src/lib/auth-email.ts`
registra, em comentário datado de 19/09/2026, que o projeto Supabase de produção está com
`smtp_user = "email-delivery-disabled"` e que nenhum e-mail de Auth sai em nenhum ambiente;
`src/lib/email/send-email.ts` é adaptador de webhook que retorna `disabled` por padrão;
`tasks/auth/AUTH-003-smtp-confirmacao-email.md` está `todo` desde 27/08/2026; e os seis bloqueadores
do `RUNBOOK_CONTA_AWS_E_AMAZON_SES.md` seguem desmarcados. Na Cloudflare: uma conta, quatro Workers,
nenhum jurídico, `samjoe.com.br` em Google Workspace e `bibliabereianos.com.br` com um único
registro DNS. Email Routing `unconfigured` nas duas zonas.

Conclusão: **não existe credencial de e-mail a reaproveitar**. O que se reaproveita é a arquitetura.

### Arquivos criados

- `docs/EMAIL_DELIVERY_ARCHITECTURE.md`: a Bíblia entra na AWS Organization da proponente como
  conta-membro `sj-email-biblia-prod`, ao lado de `sj-email-expatritax-prod`. Especifica os quatro
  endereços de e-mail necessários, a tabela completa de DNS para o subdomínio de envio
  `auth.bibliabereianos.com.br` (SPF, três CNAME de DKIM, MX e TXT de MAIL FROM, DMARC em `p=none`),
  os campos de SMTP do painel do Supabase, o custo por uso e os bloqueadores separados por dono.
- `tasks/auth/AUTH-E01-ses-smtp.md`: tarefa de execução no mesmo template do AUTH-003 do jurídico.
- `tasks/auth/AUTH-2FA-01-descoberta-tokens-whatsapp-sms.md`: descoberta, não implementação.
- `docs/PRODUCT_MVP_BACKLOG.md`: P3-01 e P3-03 passam a apontar para as tarefas.

### Decisões registradas nos documentos

- **Subdomínio exclusivo de autenticação** (`auth.bibliabereianos.com.br`), com DKIM próprio, para
  que a reputação de envio da Bíblia fique isolada da do jurídico. O ápice não recebe MX.
- **Credencial SMTP somente no Dashboard do Supabase**, regra herdada do runbook, nunca em `.env*`.
- **DMARC começa em `p=none`** e endurece depois de ler relatório; pular para `reject` derruba o
  login.
- **Google Workspace como SMTP transacional fica documentado como não recomendado**: o remetente
  teria de ser caixa humana e um código marcado como spam contamina a reputação corporativa.
- **A descoberta de 2FA compara TOTP antes de SMS e WhatsApp**, porque TOTP não tem custo por
  mensagem nem dependência de operadora.
- **O gateway não oficial de WhatsApp que o `samjoe-sales-engine` já usa (Evolution API) não pode
  ser assumido como caminho**: a tarefa exige resposta citando os termos da Meta sobre OTP, porque
  banimento do número levaria embora também o canal comercial.

### Pendência que não depende de nada disso

Os três campos do painel de Auth seguem errados e continuam sendo o que impede o login hoje:
`site_url` em `http://localhost:3000`, `uri_allow_list` vazia e `mailer_otp_length` em 8 contra os
seis dígitos que a interface promete. O `HTTP 400` da Management API em 18/11 provavelmente vem da
restrição de template no plano free; um PATCH sem os campos de template isola a causa e aguarda
autorização.

Nada aplicado em AWS. Nenhum registro DNS escrito. Nenhum provedor contratado. Nenhuma mensagem
enviada. `.env*` intocado.

## 2026-11-18 — SES da Bíblia: pedido de produção e teste controlado

Com autorização explícita do proprietário, foi usada a sessão local AWS do perfil
`samjoe-project`, na única região permitida para SES (`us-east-2`). Nenhuma credencial foi
copiada, exibida ou registrada.

### Estado confirmado antes da ação

- A identidade `auth.bibliabereianos.com.br` já estava verificada para envio, com Easy DKIM e
  MAIL FROM `SUCCESS`.
- A conta estava no sandbox: cota de 200 mensagens por dia, 1 por segundo e sem acesso de
  produção.

### Ações executadas

- Foi submetido o pedido de acesso de produção como e-mail `TRANSACTIONAL`, para
  `https://bibliabereianos.com.br`, com uma descrição limitada a códigos de acesso e magic links
  disparados pela própria pessoa usuária. A revisão retornou `PENDING`.
- Foram criados destinatários de teste no SES; os endereços em si não são registrados neste
  repositório. Um destinatário foi confirmado pelo respectivo titular.
- Foi enviada uma única mensagem técnica direta, do domínio autenticado para esse destinatário
  confirmado. O SES aceitou a mensagem e o titular confirmou o recebimento, incluindo a entrega
  ponta a ponta.

### Limites preservados e próximo passo

- O SMTP do Supabase **não** foi configurado: enquanto o SES estiver em sandbox, isso limitaria o
  login a destinatários verificados e afetaria visitantes reais.
- Não houve alteração de `.env*`, segredo, DNS, migration ou código de autenticação.
- Aguardar a decisão da AWS. Depois de `ProductionAccessEnabled = true`, gerar a credencial SMTP
  no IAM, configurá-la exclusivamente no Dashboard do Supabase, ajustar o limite de envio e testar
  o fluxo real de código/magic link.

## 2026-11-18 — Revisão compacta das áreas de conta e catálogos

Por solicitação do proprietário, as páginas fora do leitor foram simplificadas para reduzir blocos
grandes, texto promocional e informação repetida, preservando os fluxos de autenticação.

- `app/compact-pages.css` aplica uma camada compacta e responsiva às páginas de catálogo, planos,
  conta, perfil e acesso, sem atingir o leitor bíblico.
- `/entrar` e `/criar-conta` passaram a ter títulos e explicações diretas; o formulário e o fluxo
  OTP não foram alterados.
- `/perfil` substituiu quatro cartões desabilitados por uma lista curta de recursos em evolução.
- `/conta` removeu o painel de recursos em preparação e a chamada redundante de planos.
- `/acessos` e `/cursos` agora mostram somente o resumo necessário, sem listas longas de itens ainda
  indisponíveis.

Verificação: lint das páginas alteradas, `tsc --noEmit` e build de produção em diretório isolado
concluíram. Permanecem apenas avisos preexistentes do leitor, BKR e utilitário de importação. Não
houve commit, deploy, alteração de segredo, banco ou provedor.

## 2026-11-18 — Envio de e-mail próprio: SES ligado ao Supabase Auth

O pedido de saída do sandbox do SES foi concedido (caso `179502721300942`, plano Essentials, 50.000
mensagens por dia, 14 por segundo). Isso removeu a razão pela qual o SMTP vinha sendo deixado de
fora: em sandbox, apontar o Supabase para o SES melhoraria o teste do operador e quebraria o login
de qualquer visitante real, porque só endereços verificados um a um recebem.

Com a liberação, a frente foi concluída. Foi criada a única chave de acesso do usuário IAM
`ses-smtp-biblia` — que tem política inline permitindo apenas `SendEmail` e `SendRawEmail` pela
identidade `auth.bibliabereianos.com.br` —, dela foi derivada a senha SMTP pelo algoritmo SigV4 do
SES, e a configuração foi gravada no projeto `samjoe-bible-mvp` pela Management API:
`email-smtp.us-east-2.amazonaws.com` na porta 587 com STARTTLS, remetente
`Biblia Bereana <nao-responda@auth.bibliabereianos.com.br>`, frequência mínima de 60 segundos por
endereço e limite de envio elevado de 2 para 100 mensagens por hora — número bem abaixo da cota do
SES, escolhido para segurar custo em caso de abuso.

A senha não foi escrita em nenhum arquivo do repositório, log ou documento. A cópia local da
credencial, usada só para derivar a senha, foi apagada ao fim. Rotacionar significa criar a nova
chave, gravar no Supabase, confirmar envio e só então apagar a antiga.

**Verificação, em três etapas e nesta ordem.** Primeiro uma conexão ao endpoint SMTP com STARTTLS
na 587 e `AUTH` aceito, que prova a credencial exatamente como o Supabase vai usá-la. Depois uma
mensagem real aceita para `success@simulator.amazonses.com`, o simulador do próprio SES, que
exercita identidade, MAIL FROM e política do IAM sem entregar nada à caixa de ninguém. Por fim a
leitura de volta da configuração, confirmando cada campo gravado.

**O `HTTP 400` dos templates era mesmo o remetente embutido.** A hipótese registrada em 18/11
ficou confirmada: com SMTP próprio configurado, o mesmo PATCH que antes era recusado passou com
200. Confirmação e magic link foram reescritos em português, mostram o código de seis dígitos em
destaque — que é o caminho principal da interface — e oferecem o atalho em
`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=...`, restrito aos tipos que
`src/server/auth/client.ts` aceita (`email`, `magiclink`, `signup`); `recovery`, `invite` e
`email_change` continuam fora de propósito.

Duas coisas continuam abertas, e nenhuma delas depende de código. O DMARC segue sem `rua=`, então
ninguém recebe relatório de autenticação e não há como endurecer a política para `quarantine` com
base em evidência — falta o proprietário escolher a caixa. E o teste humano de entrega numa caixa
real, com conferência de pasta de spam, não foi feito: o simulador prova que o SES aceita, não que
o Gmail entrega na caixa de entrada.

Fica registrado o risco que não foi resolvido aqui: `src/server/auth/rate-limit.ts` é por isolate e
em memória, portanto não é um limite global. O teto de 100 por hora no Supabase contém o custo de
um bot, mas limite compartilhado ou CAPTCHA continua necessário antes de divulgar o site.

## 2026-11-18 — Leitura pessoal guardada na conta

O leitor guardava preferências, destaques, notas e capítulos lidos em
`sessionStorage`, que morre quando a aba fecha. Com o login funcionando, isso
deixou de ser uma limitação honesta e virou perda de dado: quem escrevia uma
nota e fechava o navegador perdia a nota. As tabelas pessoais existiam desde a
migration `0003`, vazias, esperando o Auth que agora existe.

**A migration 0007 alinha o banco ao leitor.** A `0003` foi escrita antes do
leitor ficar pronto e as duas descrições divergiram em três pontos. As
preferências eram número — `font_size smallint`, `line_height numeric` — e o
leitor não oferece número, oferece escolhas nomeadas; guardar 18 e 1.70
obrigaria a inventar uma conversão que não é fiel ao que a pessoa escolheu. O
enum de fonte tinha três opções e nenhuma das duas que o leitor realmente usa.
Espaçamento de parágrafo não existia. E a nota, que no leitor pertence à
seleção que a originou e pode ser `3-5,9`, só cabia em um versículo: `verse_id`
passa a ser a âncora e `verse_list` guarda a seleção exata, no mesmo formato
compactado que `src/domain/reader-marks.ts` produz, com CHECK no banco e UNIQUE
por seleção.

As colunas novas são `text` com CHECK em vez de enum, de propósito: é
vocabulário de interface, que muda quando o leitor ganha uma opção, e enum
exigiria `ALTER TYPE` e migration a cada ajuste de produto.

**O isolamento entre pessoas é garantido no servidor, não pelo RLS.** As
políticas de `0003` comparam `auth.uid()` com `user_id`, o que só vale para
quem fala com o banco carregando um JWT. O app não faz isso: conecta como
`postgres`, que tem `rolbypassrls`, então toda política é ignorada nas
consultas dele — medido, não suposto. Por isso nenhuma consulta de dado pessoal
existe sem filtro por `userId`, o `userId` vem sempre de `getViewer()` e nenhum
Server Action aceita identidade como argumento. O RLS continua valendo como
segunda tranca para o dia em que algo falar com o banco pela chave anônima.

**Conciliação ao entrar.** Quem leu sem conta e depois entrou tem duas verdades
parciais. `src/domain/reading-sync.ts` une as duas: a conta vence no conflito,
porque é o que sobreviveu a fechar o navegador e porque a alternativa seria uma
aba antiga sobrescrever anotação feita em outro aparelho; e o que só existia no
navegador sobe, em até 25 capítulos por vez, para não virar uma rajada de
gravações. O resto sobe quando a pessoa abrir aquele capítulo.

**As frases da interface passaram a depender de onde o estado está.** O leitor
dizia "local nesta sessão, sem conta e sem sincronização" em seis lugares. Isso
era verdade e virou mentira no instante em que a conta passou a guardar. O
contexto expõe `storage: "session" | "account"` e cada frase segue o que for
verdade para quem está lendo. Prometer sincronização que não existe e esconder
a que existe são o mesmo erro em direções opostas.

Verificação: 207 testes (eram 189), `tsc --noEmit` e lint limpos. O caminho de
escrita foi exercitado contra o banco de produção dentro de uma transação
revertida — preferências com os valores que só o leitor tem, nota de seleção
com buraco (`genesis.1.3-5,9`) gravada e lida de volta inteira, `verse_list`
malformada recusada pelo CHECK e seleção repetida recusada pelo UNIQUE; depois
do `rollback`, zero linhas. Migration aplicada (ledger 7 → 8) e deploy
publicado na versão `da763a34-47bf-438c-a10d-ada7a35fe60c`.

Fica por fazer, e não foi entregue: `/inicio` ainda lê apenas o
`sessionStorage` e continua dizendo que nada é sincronizado. É consumidor dos
mesmos dados e precisa do mesmo tratamento.

## 2026-11-19 — Preparação do pipeline lexical (C30 / LEXICON-INDEX-001)

O leitor mostra análise de palavra para sete palavras, de um versículo, porque
elas estão escritas à mão em `src/domain/word-analysis.ts`. Isso sempre foi
rotulado como prova temporária. Esta frente **não a substituiu**: construiu a
tubulação que vai substituí-la e parou exatamente onde começa a decisão humana.

**O que existe agora.** Um registro versionado das fontes
(`src/domain/lexicon/source-registry.ts`) que declara, por fonte, a URL, o
pino, a licença, a atribuição, o tipo de ativo, os campos que podem ser lidos e
os campos proibidos. Coletor, verificador e montador de índice em `scripts/`.
Parsers determinísticos para MACULA (ocorrência), STEPBible TBESG (verbete
grego) e Open Scriptures HebrewLexicon (verbete hebraico e índice de
correspondência). Fixtures offline de Gênesis 1:1 e João 1:1 e três arquivos de
teste.

**O que não existe, e é o ponto mais importante deste registro.** Nenhuma fonte
lexical foi baixada. Nenhum commit foi conferido. Nenhum SHA-256 real existe.
Por isso todos os pinos estão `unresolved` e todos os `expectedSha256` estão
`null` — não por esquecimento, mas porque escrever um número plausível faria o
verificador comparar bytes reais contra ficção. A consequência é deliberada:
`assetUrl()` recusa montar URL sem commit resolvido e o coletor recusa coletar.

**A unidade é o lema.** O verbete é importado uma vez e reutilizado em todas as
ocorrências; a ocorrência guarda forma, morfologia, referência e sentido
anotado, e aponta para o verbete pela chave `idioma:Strong`. Nas fixtures, 24
ocorrências de dois versículos se resolvem em 14 lemas, e as três ocorrências
de `λόγος` em João 1:1 compartilham um único verbete. É a diferença entre
indexar e repetir.

**Proveniência por campo, não por registro.** Um verbete pode ter a
transliteração de uma fonte e a definição de outra; uma linha única de crédito
seria imprecisa justamente onde a licença exige precisão. Cada valor carrega
fonte, arquivo, pino, SHA-256 do arquivo, licença, atribuição e o nome exato da
coluna lida.

**O `Meaning` do TBESH está proibido por nome.** O cabeçalho da própria fonte
diz que aquela coluna deriva do Abridged BDB do Online Bible e pede permissão
antes do reuso. O CC BY do pacote não resolve: quem licencia o pacote não é o
titular daquele texto. Então a fonte está no registro com `importable: false` e
`license.family: "permission-required"`, a coluna está em `prohibitedFields`
com o motivo completo, e o leitor de tabelas **interrompe a leitura** se ela
aparecer, em vez de ignorá-la. Campo proibido tratado como omissão é como ele
entraria sem ninguém notar. A definição hebraica vem do Open Scriptures
HebrewLexicon, que não arrasta essa pendência. CC BY e CC BY-SA também não
convivem: `assertNoLicenseMixing()` recusa o conjunto misto.

**Os parsers são guiados pelo cabeçalho real do arquivo.** MACULA e STEPBible
mudam nome e ordem de coluna entre revisões; índice fixo importaria a coluna
errada no dia em que a fonte inserisse outra no meio. Coluna não declarada é
ignorada e relatada; coluna exigida ausente para a leitura. Isso importa porque
os nomes de coluna no registro vieram da documentação pública e **não foram
conferidos contra bytes reais** — se algum estiver errado, a primeira execução
falha fechada dizendo qual, em vez de gravar dado trocado.

**Tradução para português: contrato, nenhuma tradução.** Três estados —
`machine_draft`, `human_reviewed`, `approved` — e a transição
`machine_draft → approved` simplesmente não existe. Sem tradução aprovada, o
leitor mostra a glossa original, nunca o rascunho. O campo `translations` dos
verbetes é tipado como `readonly never[]`, e o montador de índice falha se
alguma aparecer.

**Nenhuma migration foi escrita.** A `lexicon_entries` da `0005` tem definição,
glossa, licença e atribuição, mas não tem estado de tradução nem proveniência
por campo. O desenho certo depende dos campos que a coleta real confirmar;
escrever agora seria adivinhar duas vezes.

Verificação: **não houve execução**. `npm run lint`, `npm run typecheck` e
`vitest` foram negados pelo ambiente desta sessão, assim como qualquer acesso
de rede. O código foi revisado por leitura e os testes foram escritos, mas não
há prova de execução — quem retomar deve rodar os três arquivos de teste antes
de confiar neles. Nada foi commitado, nenhuma migration aplicada, `.env*`
intocado, leitor intocado.

Desenho completo e portões abertos em `docs/LEXICON_PIPELINE.md`; estado item a
item em `tasks/product/LEXICON-INDEX-001-preparacao.md`.


## 2026-11-19 — Coleta real, tradução editorial e importação (C30 / LEXICON-INDEX-001)

Continuação da entrada anterior, por sessão Claude Code distinta. A entrada de 09:22 registrava
que nada havia sido executado; esta registra a execução e, principalmente, **cinco coisas que só
apareceram quando os bytes reais chegaram** e que invalidavam parte do que estava documentado.

### O que a coleta real desmentiu

**O TSV do MACULA Hebrew é Git LFS.** O `raw.githubusercontent.com` devolve um ponteiro de 133
bytes (`version https://git-lfs.github.com/spec/v1`); o arquivo tem 84 MB. Congelar o SHA-256 do
ponteiro produziria um pino que confere para sempre e nunca aponta para o conteúdo — pior que não
ter pino, porque dá confiança falsa. O ativo passou a ter `lfs: true`, a URL vem de
`media.githubusercontent.com`, e o coletor recusa corpo com cara de ponteiro
(`looksLikeLfsPointer`). O hash coletado é igual ao `oid` declarado no ponteiro, o que confirma de
forma independente que vieram os 84 MB e não os 133 bytes.

**Quatro dos nove caminhos declarados não existiam.** `TSV/macula-hebrew.tsv` é
`WLC/tsv/macula-hebrew.tsv`; o `LICENSE` do Open Scriptures HebrewLexicon não existe — a
declaração CC BY 4.0 está no `readme.md`, linhas 53-55, e é ele que guardamos como prova. Era
exatamente o que `pathConfirmed: false` existia para sinalizar.

**Cinco nomes de coluna estavam errados**, porque tinham sido escritos a partir da documentação
pública e não dos bytes. O MACULA Hebrew não tem coluna `strong` (é `strongnumberx`) nem `domain`
(são `lexdomain`, `contextualdomain` e `coredomain`; importamos o `coredomain`). O lado grego não
tem `pos` (é `class`) e não publica `sensenumber`. O TBESG não tem `Lemma` nem `Morphology` (são
`Greek` e `Morph`), e a coluna de definição não tem rótulo curto: chama-se literalmente
`Abbott-Smith lexicon (AS), with gaps occationally filled from edited versions of  Middle LSJ`,
com o erro de grafia da fonte. Como `strong` e `Lemma` eram obrigatórias, a leitura teria falhado
fechada — comportamento correto, mas pelo motivo errado.

**O MACULA Hebrew é morfêmico, e o leitor é indexado por palavra.** `GEN 1:1!1` aparece duas
vezes, uma para a preposição בְּ e outra para o substantivo רֵאשִׁית. São **11 morfemas para as 7
palavras** que o leitor mostra. A referência canônica descartava o sufixo `!N`, então a posição da
palavra estava sendo perdida; `NormalizedOccurrence.wordPosition` foi acrescentado, porque sem ele
não há como devolver "os morfemas da palavra 3".

**28% das ocorrências ficam sem verbete, e está certo.** São 169.984 linhas cujo `strongnumberx`
tem sufixo de letra (`0871a`, `1886a`, `2050b`): prefixos, artigos, conjunções e sufixos
pronominais que o dicionário de Strong **não define**. `HebrewStrong.xml` tem 8.674 entradas e
nenhuma com sufixo. E `H871`, sem sufixo, é אֲתָרִים, um topônimo sem relação nenhuma com a
preposição que o MACULA marca como `0871a` — ligar os dois seria um erro silencioso e grave.

A integridade da ligação foi medida no conjunto inteiro, e não por amostra: **287.682** ocorrências
sem sufixo batem com o lema do verbete de Strong, **zero** apontam para Strong inexistente, e as
**11.818** divergências são variantes de citação da mesma palavra (פָּנֶה/פנים, חַיִּים/חי,
בְּכֹר/בכור). O mecanismo preferiu deixar órfão a ligar errado, que era o desenho pretendido.

Também: os 6.435 "problemas" de leitura do hebraico são **todos** o artigo definido absorvido pela
preposição (בַּ = בְּ + הַ), que a fonte publica com `text` vazio e transliteração "–". Não são
linhas quebradas. Passaram a ter categoria própria para o verificador não contá-los como defeito.

### Três defeitos no próprio código da frente anterior

1. `entries.push(...result.entries)` estourava a pilha: `push` com spread passa cada item como
   argumento, e são centenas de milhares.
2. `JSON.stringify` do índice inteiro terminava em `Invalid string length` — 19.521 verbetes e
   607.217 ocorrências com proveniência por campo passam do comprimento máximo de string do V8.
   A saída passou a ser NDJSON emitida por gerador, com digest alimentado linha a linha.
3. O `LexicalIndex.xml` recebia o parser do `HebrewStrong.xml`, porque o despacho olhava só
   `asset.format === "xml"`: 10.221 problemas relatados contra o arquivo real. Com o parser certo,
   são 10.212 pontes lema→Strong/BDB e zero problemas.

E uma regressão introduzida e corrigida na mesma sessão: a busca de cabeçalho por colunas exigidas
— necessária porque o TBESG abre com 87 linhas de prosa **sem** prefixo de comentário — fazia uma
coluna **proibida** passar despercebida quando as exigidas não batiam. A proibição por licença
passou a ter precedência sobre a procura (`prohibitedColumns`), com teste que falha se isso voltar.

### Tradução editorial

`scripts/translate-lexicon.ts` percorre o cânone **por livro**, começando por Gênesis e João, é
retomável, idempotente e **não regressivo**: rascunho novo nunca sobrescreve texto revisado. Um
lema traduzido em Gênesis não volta à fila de Êxodo. O lote é TSV para que o preenchedor possa
mudar — esta sessão, uma pessoa, ou um serviço automático — sem tocar no programa nem no armazém.

A decisão de produto que importa: a glossa traduzida é a **do MACULA, por ocorrência** ("in",
"beginning", "he.created"), e não a do verbete de Strong, que é a lista de usos da KJV
("court, daughter, door, + dungeon, family..."). A primeira é o que o leitor precisa ao clicar numa
palavra; a segunda, traduzida, daria uma lista arcaica. O campo `gloss` do MACULA estava na lista
de ignorados e passou a ser importado, sob a mesma licença CC BY 4.0 já coletada.

A tradução é por **texto distinto**, não por ocorrência: 60.674 registros em vez de 607.217, e a
mesma palavra sai igual em todo o corpus em vez de depender de qual lote a pegou.

Foram traduzidas **537 glossas** (184 de Gênesis 1 e 353 de João 1), todas `machine_draft` com
método declarado. Cobrem **99,1% de Gênesis 1 e 99,6% de João 1** — o resto não tem glossa na fonte
— e, por concentrarem as palavras mais frequentes, **39,5% de todas as palavras da Bíblia**
(237.443 de 601.031). Os 100 lemas mais frequentes cobrem 58%; os 1.000, 85%.

Nenhuma tradução é publicável. `publishableText` ganhou `allowMachineDraft`, desligado por padrão,
e devolve o rascunho num `kind` **próprio** — nunca como `translation` — justamente para que a
interface seja obrigada a tratá-lo à parte e rotulá-lo.

### Migration e importação

`drizzle/0008_lexical_index.sql`, aditiva. Tabelas novas em vez de preencher a `lexicon_entries`
da 0005, porque aquela amarra cada definição a uma `original_edition`, e o verbete desta frente é
independente da edição e indexado por Strong; forçá-lo no formato antigo exigiria inventar uma
edição artificial por fonte lexical.

Aplicada **duas vezes** em Postgres descartável (`postgres:16-alpine`), sobre 0000–0007:
idempotente. As constraints foram provadas com **dez sondagens adversariais**, e o banco recusou:
fonte aprovada para coleta sem aprovador nomeado; pino que não é commit de 40 hex; campo com valor
e sem proveniência; tradução aprovada sem revisor; `machine_draft → approved`; e
`approved → machine_draft`. Aceitou as transições legítimas.

Importação: **19.521 verbetes, 607.217 ocorrências, 537 traduções**, com **10** linhas de
proveniência internadas em vez do bloco de crédito repetido 600 mil vezes. Reexecutada sobre os
mesmos bytes, não duplicou nada. E uma prova que saiu de graça: a sondagem havia deixado
`gloss:hbo:in` em `human_reviewed`, e a reimportação **se recusou a sobrescrevê-la** — a garantia
de não regressão funcionando em dados reais, não em teste.

### Precedência no leitor

`src/domain/lexicon/word-analysis-view.ts` resolve o que mostrar, nesta ordem: nota editorial
revisada → tradução aprovada → rascunho (só em pré-visualização, rotulado) → glossa original em
inglês, marcada como tal → nada. As sete notas revisadas de Gênesis 1:1 **vencem** a tradução de
máquina, com teste: trocá-las por um rascunho rebaixaria o produto. O índice entra para cobrir os
outros 31.101 versículos, não para apagar o que já estava pronto.

Quando parte do significado de uma palavra é rascunho, a palavra inteira é rotulada como rascunho:
o leitor vê um texto só, não duas procedências.

### Verificação

`npm run typecheck` limpo. `npx vitest run`: **297 testes em 34 arquivos**, todos passando.
`npx eslint` limpo em todos os arquivos desta frente. Nada commitado, nenhuma migration remota,
`.env*` intocado.

O `npm run lint` do projeto inteiro continua vermelho (3.400 erros), mas **nenhum** vem de `src/`:
a origem são `.deploy-live/`, `.deploy-auth/`, `.next-review/`, `.claude/worktrees/` e
`data/sources/`, que o `eslint.config.mjs` não ignora. É config, não código, e torna o portão de
lint inutilizável localmente.

### Pendência que precisa de atenção antes de ligar a pré-visualização

`app/biblia/original-panel.tsx` rotula `source_gloss` como "sentido na fonte (inglês)", mas **não
rotula `machine_draft`**: um rascunho seria renderizado como texto simples, indistinguível de uma
tradução aprovada. Hoje é latente, porque `LEXICON_PREVIEW_DRAFTS` é decidido no servidor e está
desligado — mas todo o desenho de `publishableText` existe para forçar esse rótulo, e sem ele a
garantia não se cumpre. **Corrigir antes de ligar a pré-visualização.**

### Frente concorrente

Durante esta sessão, outro agente trabalhou na mesma frente e tomou um rumo complementar:
`drizzle/0009_lexicon_chapter_shards.sql` guarda um payload compacto por livro/capítulo em `jsonb`,
porque as 607 mil ocorrências relacionais ocupam ~290 MB com índices e não cabem no plano do
Supabase. Ele consome o `lexicon-index.ndjson` produzido aqui e reescreveu
`src/server/lexicon/repository.ts` para ler dos shards, mantendo o contrato de visão. **Em
produção, a migration a aplicar é a 0009; a 0008 fica para curadoria e uso offline.**

## 2026-11-24 — Acepções do BDB e domínios semânticos do MACULA (C30 / LEXICON-INDEX-001)

Continuação da entrada de 19/11, mesma sessão retomada. A pergunta que motivou esta frente foi
"podemos criar um laço de consultas na internet para trazer traduções mais contextualizadas e
formas diversas de interpretação?". A resposta registrada é **não** para a internet, e **sim** para
o material que já estava em disco sem ser lido.

### Por que não buscar tradução na internet

Importar texto de licença desconhecida esvaziaria todo o aparato que esta frente construiu —
proveniência por campo, pino por commit, atribuição por ativo — e o precedente já está no
repositório: a coluna `Meaning` do TBESH está **bloqueada** por pendência de permissão, mesmo
vindo num pacote CC BY. Agrava o fato de que quase todo recurso lexical hebraico/grego **em
português** é protegido (dicionários Strong em português, concordâncias baseadas em Almeida,
léxicos comerciais), enquanto o material livre em inglês é abundante. É por isso que o pipeline
coleta em inglês e traduz: traduzir obra CC BY é derivada permitida; copiar obra alheia não é.

A internet tem um uso legítimo e pontual nesta frente: conferir uma escolha difícil durante a
revisão editorial. Não coleta em massa.

### O que estava em disco e não era lido

**`BrownDriverBriggs.xml`**, coletado em 19/11 e marcado `pending_parser`: 11.845 verbetes e
**8.989 acepções** aninhadas em até **cinco níveis**. `אָב` traz nove acepções de primeiro nível
("pai de um indivíduo", "de Deus como pai do seu povo", "chefe de casa", "ancestral", "originador
ou patrono de uma classe"…). `הָיָה` traz **32 acepções em cinco níveis**, organizadas por tronco
verbal: Qal → I/II/III → 1/2 → a/b → (1)/(2).

**`sdbh` e `lexdomain` do MACULA**: 244.727 e 244.714 ocorrências preenchidas, contra 160.923 do
`coredomain` que já era importado. O `sdbh` **nomeia** a acepção que a palavra assume naquele
versículo; o `coredomain` dá apenas a categoria estável do lema. Estavam os dois na lista de
campos ignorados.

### Decisão de modelagem: o BDB é fonte própria

O BDB saiu de `oshb-hebrewlexicon` e virou a fonte `oshb-bdb` no registro. Não é arrumação: o BDB
e o dicionário de Strong são obras distintas que só dividem repositório, com autoria, atribuição e
granularidade diferentes, e o princípio deste registro é separar ativos com licença e crédito
próprios. A atribuição agora credita separadamente a obra (domínio público) e a edição digital
(CC BY 4.0). Em fonte separada, os nomes dos elementos também ficam exatamente como estão no
arquivo — `def`, `sense@n`, `stem` — em vez de disputarem espaço com `meaning` e `usage` do
HebrewStrong.

A coleta foi refeita pelo pipeline, não por cópia manual: o coletor baixou os 2.911.253 bytes e
conferiu o SHA-256 contra o que já estava congelado no registro, que é a prova de falha fechada
funcionando num redownload real.

### A hierarquia é o dado, não a decoração

A sessão anterior deixou o BDB sem parser para não achatá-lo, e estava certa. Um sentido de
terceiro nível sob Hiphil não significa o mesmo que um de primeiro nível; lido como lista plana, o
verbete viraria um amontoado de sinônimos sem regência, que é pior que não ter o BDB.

Expressão regular não resolve `<sense>` dentro de `<sense>`: casaria no primeiro `</sense>` e
devolveria meio sentido, com o resto do ramo caindo no nível errado. O corte é por contagem de
abertura e fechamento (`sliceSenses`), e ramo que não fecha é relatado, não remendado. Os dois
`<sense/>` auto-fechados do arquivo têm tratamento explícito.

Três coisas que uma lista plana perderia e que o parser preserva: a numeração **como a obra a
publica** (que mistura "1", "a", "I" e "(1)" de propósito, para marcar o nível), o tronco verbal
que agrupa um ramo, e o caminho até cada folha. Há teste que falha se a definição de um nível
vazar para o de cima: `Qal` só agrupa, e se a leitura varresse o ramo em busca de `<def>`, o tronco
herdaria as 32 acepções de `הָיָה`.

**Correção de fato:** a entrada de 19/11 e os comentários diziam "até seis níveis". A profundidade
real é **cinco**. A medição original usava um contador global que não zerava entre verbetes e era
inflado pelos dois `<sense/>` auto-fechados. Corrigido no registro, no parser e no modelo.

### A ponte, que é o que torna o BDB alcançável

A ocorrência traz o Strong, não o id do BDB. Sem ligação, as 8.989 acepções seriam um dicionário
que ninguém atinge. `LexicalIndex.xml` já era lido e dá exatamente essa tradução: das 10.212
ligações, **10.167** alcançam verbete e **9.288** pares distintos chegaram ao banco. Ficaram de
fora, contadas e não descartadas em silêncio, 876 ligações sem Strong — sem Strong não há
ocorrência que as alcance — e 3 pares repetidos, que são duas grafias do mesmo lema apontando para
o mesmo verbete pelo mesmo Strong (הֵן/הֵנָּה, רִישׁ/רֵישׁ, כְּלַל/שַׁכְלֵל).

As fixtures do BDB e do `LexicalIndex` foram refeitas a partir de recortes reais. A anterior tinha
um id de BDB **inventado** (`a.cjq.ab` para רֵאשִׁית, cujo id real é `t.ad.ag`), o que impedia
testar a ponte de verdade. Agora o teste fecha lema → Strong → verbete com identificadores reais.

### Um defeito próprio, encontrado pela verificação

O montador de índice tinha **duas** chamadas a `lexiconIndexLines` — uma para o digest e outra
para a gravação — e elas divergiram: o digest já contava as pontes do BDB e o arquivo gravado
ainda não. O resultado era um arquivo cujo SHA-256 impresso não era o dele. As duas chamadas foram
unificadas num único ponto, e o digest do arquivo em disco foi conferido por fora, em Python:
`c4b1101a3939e281329144f6ab33c08b2ef82cd323a9461e1eb23a15d1a4e220`.

### Banco

`drizzle/0010_bdb_senses.sql`, aditiva, sobre 0000–0009. Acrescenta `sdbh_sense` e
`lexical_domain` a `lexeme_occurrences`, cria `lexeme_bdb_entries` e `lexeme_bdb_links`.

A árvore vai como `jsonb`, uma linha por verbete, e não como tabela de adjacência: ela é sempre
lida inteira (o painel mostra as acepções da palavra clicada, não uma folha isolada), a ordem dos
irmãos é parte do dado e uma tabela exigiria coluna de ordenação redundante, e são 11.845 linhas —
o argumento de volume que levou os capítulos para `jsonb` na 0009 não se aplica aqui, onde a
escolha é de forma.

Aplicada duas vezes em Postgres descartável: idempotente. Constraints provadas por sondagem, e o
banco recusou id de BDB fora do formato, árvore preenchida com contagem zero, `senses` recebendo
objeto em vez de lista, e ponte para verbete inexistente. Um ajuste saiu da própria sondagem: o
guarda de tipo passou para dentro de cada CHECK, porque o Postgres não garante ordem de avaliação
e sem ele o erro era "cannot get array length of a non-array" em vez da constraint nomeada.

Importação: **11.845 verbetes com árvore, 8.989 acepções, 9.288 pontes, 244.727 ocorrências com
`sdbh_sense`**. Reexecutada sobre os mesmos bytes, não duplicou nada.

### O que o leitor passa a poder mostrar

Consulta de Gênesis 1:1 contra o banco, por palavra: forma, glossa em inglês, tradução em
português, código SDBH, domínio lexical e o verbete do BDB com a contagem de acepções —
`אֱלֹהִים` com 12, `אֶרֶץ` com 22, `בָּרָא` com 8, `שָׁמַיִם` com 7, `רֵאשִׁית` com 4.

Um detalhe que o desenho preservou de propósito: `בָּרָא` alcança **dois** verbetes do BDB
(`b.cw.aa` e `b.cx.aa`), porque o Strong 1254 cobre dois homógrafos. A ponte mantém a ambiguidade
em vez de escolher um — escolher seria a interface mentindo sobre o que a obra diz.

### Verificação

`npm run typecheck` limpo. `npx vitest run`: **401 testes em 41 arquivos**, incluindo 12 novos do
BDB. `npx eslint` limpo nos arquivos desta frente.

`tests/importers/blivre.test.ts` falhou **uma vez** no conjunto cheio, com 5034 ms contra o limite
padrão de 5000 do vitest, e passa sozinho e em duas rodadas completas seguidas. É flake de tempo
sob carga paralela, não regressão, e o arquivo é de 17/11 — mas vai incomodar em CI e merece
`testTimeout` próprio.

### O que ainda não foi feito

A árvore de acepções está no índice e no banco, mas **não chega à tela**: `src/server/lexicon/` e o
painel são território da frente concorrente, e a divisão combinada foi eu não tocar neles. Expor as
acepções no painel é o passo seguinte, de quem estiver com o painel na mão.

## 2026-11-24 — BDB no painel de originais, com fontes e estados de revisão (C30)

Tarefa "Claude 1": conectar as acepções do BDB ao painel de originais de Gênesis 1, exibindo as
fontes usadas e o estado de revisão de cada texto. O painel havia sido ligado ao
`/api/biblia/lexico` pela frente concorrente; esta entrada cobre o que faltava.

### Dois defeitos encontrados no caminho de dados

**As traduções nunca chegavam à tela.** O `repository.ts` passou a ler shards por capítulo, e
nessa troca gravava `translation: null` fixo e `lexemeKey: ""`. Consequência: `meaningSource` só
podia valer `source_gloss`, então o rótulo "tradução automática, aguardando revisão" que havia
sido acrescentado ao painel era **código morto** — nenhuma das 537 glossas em português era
alcançável, e a chave que liga ao BDB estava perdida.

O comentário de cabeçalho do mesmo arquivo descrevia a consulta relacional com dois `LEFT JOIN`
que o código não fazia mais. Corrigido junto.

**Shard imutável não pode guardar estado mutável.** A correção óbvia seria embutir tradução e
acepções no payload do capítulo, e seria errada: o shard é instantâneo com `source_sha256`
próprio, e o estado de revisão muda por decisão humana. Assar revisão dentro dele o deixaria
obsoleto no instante em que alguém aprovasse um verbete, sem nada no hash indicando isso. Por isso
são três consultas, e a separação está documentada no repositório: estrutura vem do shard;
tradução e acepções vêm das tabelas, ao vivo.

### O que foi acrescentado

`lexemeKey` entrou como 11º campo da linha compacta do shard, e os 1.189 shards foram
reconstruídos. Ligar ocorrência a verbete por semelhança de grafia do lema seria adivinhar — é
exactamente o que o `LexicalIndex.xml` existe para evitar.

`OccurrenceRow` ganhou `language` **explícito**. Dava para deduzir do prefixo de `lexemeKey`
("hbo:H7225"), mas cortar a chave por string funcionaria hoje e quebraria no dia em que o formato
dela mudasse, sem nenhum teste reclamando.

O repositório ganhou três consultas por chave: `listTranslations` (por sujeito
`gloss:<idioma>:<texto>`), `listBdbEntries` (pela ponte `lexeme_bdb_links`) e `listSources`.

### Estado de revisão é coisa distinta de procedência

`ReviewState` existe separado de `MeaningSource` porque as duas respondem perguntas diferentes:
"de onde veio" e "alguém conferiu". A definição do BDB vem de obra publicada e revisada por
lexicógrafos, mas **não** tem tradução para português conferida — é `source_text`, não `approved`.

Quatro estados, cada um com rótulo próprio na interface: `editorial_reviewed`, `approved`,
`unreviewed_draft` e `source_text`. O rascunho **sempre** aparece rotulado, com o método de
geração ao lado; é o que impede tradução automática de passar por verbete conferido.

### Fontes: creditar o que foi usado, e só

O crédito lista apenas as fontes de que aquela palavra realmente saiu, dizendo quais campos vieram
de cada uma. Listar as oito fontes do registro em toda palavra creditaria obra que não entrou na
análise, o que é impreciso na direção oposta à que a licença pede.

O mapeamento campo → fonte é fixo porque é propriedade do desenho do pipeline: forma, lema,
morfologia, domínio e glossa contextual vêm do MACULA; transliteração e Strong vêm do léxico de
verbete do idioma; acepções vêm do BDB. Já o texto de licença e atribuição exibido é **buscado da
tabela de fontes**, e fonte sem linha registrada não é creditada com texto escrito no código.

### Interface

O painel ganhou a árvore de acepções num `<details>`, com recuo por nível — o recuo é o dado, não
decoração: um sentido de terceiro nível sob Hiphil não significa o mesmo que um de primeiro.
Quando um morfema alcança mais de um verbete, os dois aparecem: `בָּרָא` chega a dois homógrafos, e
escolher um seria a interface mentindo sobre o que a obra diz.

Há aviso explícito de que o texto das acepções está em inglês e sem tradução revisada. Estilos com
variante para tema escuro.

### Prova de ponta a ponta

Banco descartável com 0000–0010, índice relacional e os 1.189 shards importados, `next dev`
apontado para ele.

`GET /api/biblia/lexico?book=genesis&chapter=1&verses=1` devolve, por palavra de Gênesis 1:1: o
português da nota editorial revisada (que vence a tradução de máquina, por projeto), as acepções
do BDB — 4, 8, 12, 0, 7, 0 e 22 — e o crédito de `macula-hebrew`, `oshb-bdb` e
`oshb-hebrewlexicon`.

Em Gênesis 1:2, que não tem nota revisada, o estado é `unreviewed_draft` com o método declarado, e
`הָיָה` traz suas 32 acepções em cinco níveis.

**Com `LEXICON_PREVIEW_DRAFTS` desligado**, a mesma consulta devolve só `source_text`, nenhum
`draftMethod`, e o texto do rascunho não aparece em lugar nenhum da resposta. A garantia é a razão
de `publishableText` devolver o rascunho num `kind` próprio.

### Verificação

`npm run typecheck` limpo. `npx vitest run`: **416 testes em 43 arquivos**. `npx eslint` limpo nos
arquivos tocados. A página `/biblia/genesis/1` compila e responde 200, sem aviso originado de
`original-panel.tsx` ou `selection-bar.module.css`.

Onze testes novos em `tests/server/lexicon-reader-bdb.test.ts`, incluindo: a preposição com Strong
aumentado não recebe o verbete do vizinho; falha na consulta de acepções não derruba forma, lema e
morfologia; e uma palavra cuja metade vem da fonte em inglês é rotulada inteira como texto da
fonte, porque o leitor vê um texto só, não duas procedências.

Dois dos meus testes nasceram errados e o código estava certo: eu os escrevi contra Gênesis 1:1,
que **tem** nota editorial revisada, e ela vence qualquer tradução. Passaram a usar 1:2.

### Limitação honesta do rascunho

A tradução é por morfema, então não há concordância de gênero entre eles: "and the earth" sai como
"e o terra" em Gênesis 1:2. É defeito real do rascunho, visível na pré-visualização, e é
exatamente o tipo de coisa que a revisão humana existe para pegar. Não corrigi caso a caso porque
seria maquiar o sintoma: a correção certa é a revisão, ou alinhamento com a BLIVRE.
