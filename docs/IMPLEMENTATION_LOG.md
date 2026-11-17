
## 2026-11-17 — Editorial e CLI
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
