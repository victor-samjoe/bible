# Gates de lançamento do MVP — auditoria de prontidão

**Data da auditoria:** 2026-11-17
**Escopo:** auditoria somente de leitura. Nenhum arquivo de aplicação, banco, migration, infraestrutura, dependência, `.env*` ou licença foi alterado. Sem rede, sem agentes, sem commit.
**Autoridade:** `docs/MVP_EXECUTION_CONTRACT_2026-11-19.md` (§§ citadas abaixo) e `docs/CLAUDE_EXECUTION_HANDOFF.md`.
**Regra de registro:** somente evidência local verificada nesta sessão. Onde não houve execução ou artefato, o item está marcado como não comprovado — não como pronto.

## 0. Estado do repositório na auditoria

| Item | Valor observado |
| --- | --- |
| Branch | `main` |
| HEAD | `1707b0f` — "feat: add focused bible reader and translation licensing playbook" |
| Commits totais | 4 |
| Árvore de trabalho | suja: `app/biblia/page.tsx`, `docs/IMPLEMENTATION_LOG.md`, `drizzle/schema.ts` modificados; 9 arquivos não rastreados (reader-tools, 2 migrations `0002`, 2 scripts, 3 docs) |
| `git diff --check` | exit 0 (arquivos não rastreados não são cobertos) |
| Node | v22.20.0 |

**Atenção operacional:** todo comando `git` neste diretório falha com `detected dubious ownership` — o `.git` pertence a `Victor_e_Eloa/CodexSandboxOffline` e o usuário atual é `Victor_e_Eloa/Victor`. Nesta auditoria o acesso foi feito com `git -c safe.directory=...` por comando, sem gravar configuração. Enquanto isso não for resolvido pelo proprietário, commit, push e CI local ficam bloqueados por ambiente, não por código.

### Comandos executados nesta sessão e resultado real

| Comando | Resultado |
| --- | --- |
| `npm run lint` | **exit 0** |
| `npm run typecheck` | **exit 0** |
| `npm run test` | **exit 0** — 35 testes, 6 arquivos, vitest 5.1.0, 5,14 s |
| `npm run build` | **exit 0** — "Compiled successfully in 26.9s", 15 rotas |
| `node --experimental-strip-types scripts/validate-blivre-corpus.ts` | **exit 0** — `{"valid":true,"books":66,"chapters":1189,"verses":31102}` |
| `npm run test:e2e` | **não executado** — não existe `tests/e2e` (ver B-08) |

Avisos de build registrados, não corrigidos: `autoprefixer: start value has mixed support` em `app/biblia/reader-tools.module.css`; e, conforme `docs/IMPLEMENTATION_LOG.md`, `@next/swc-win32-x64-msvc` falha ao carregar e o build conclui por fallback.

---

## 1. Funcionalidades prontas

Itens com artefato ou execução verificada nesta sessão.

| # | Item | Evidência local |
| --- | --- | --- |
| P-01 | Pipeline de verificação verde (lint, typecheck, teste, build) | tabela da §0; `package.json` script `check` |
| P-02 | Build de produção gera 15 rotas, 13 estáticas e 2 dinâmicas | saída de `npm run build` |
| P-03 | Corpus BLIVRE convertido e validado | `data/generated/blivre.json` (8.547.651 bytes); 66 arquivos USFM em `data/source/porbr2018_usfm/`; validador retorna 66/1189/31102 |
| P-04 | Licença do corpus documentada e atribuição exibida | `docs/licenses/biblia-livre-blivre.md`; atribuição CC BY 4.0 BR no rodapé do leitor e na seção "Atribuição obrigatória" de `app/biblia/page.tsx` |
| P-05 | Regra de acesso pura implementada e testada | `src/domain/access.ts` (`canAccess` exige `status === "published"`, entitlement ativo, janela de datas); `tests/domain/domain.test.ts` |
| P-06 | Gate de papel implementado e testado | `hasRole` em `src/server/auth/index.ts`; `tests/auth/auth.test.ts` |
| P-07 | Contrato de billing + provedor fake + webhook idempotente (camada de serviço) | `src/server/billing/{types,fake-provider,webhook-service,redact,schema}.ts`; `tests/billing-provider.test.ts`, `tests/integration/critical-paths.test.ts` |
| P-08 | Validação editorial e CLI de publicação (camada de domínio) | `src/domain/editorial/{schema,validation}.ts`, `src/cli/workflow.ts`; `tests/editorial.test.ts` |
| P-09 | Parser/importador BLIVRE testado | `src/importers/blivre.ts`; `tests/importers/blivre.test.ts` |
| P-10 | Migrations autoradas | `drizzle/0000_initial.sql`, `0001_seed_blivre.sql`, `0002_blivre_query_indexes.sql`, `0003_reading_personal_data.sql` (sequência única 0000-0003; ver B-06 sobre o journal ausente) |
| P-11 | Aviso de análise com apoio de IA nas páginas de estudo | `app/_components/ai-disclaimer.tsx` referenciado em `app/page.tsx`, `app/estudos/page.tsx`, `app/estudos/[slug]/page.tsx`, `app/temas/[slug]/page.tsx` |
| P-12 | Manifesto PWA servido como rota | `/manifest.webmanifest` presente na saída do build; `<link rel="manifest">` no `<head>` de `.next/server/app/index.html` |
| P-13 | Segredos fora do versionamento | `.gitignore` cobre `.env*` com exceção de `.env.example`; `.env.example` não contém valores |
| P-14 | Nenhum vazamento de conteúdo premium | não existe conteúdo premium no repositório; `app/estudos/[slug]/page.tsx` renderiza apenas CTA no ramo premium. Pronto por ausência de conteúdo, **não** por autorização aplicada (ver B-03) |
| P-15 | Workflow de CI presente | `.github/workflows/deploy.yml` (nunca executado aqui) |

---

## 2. Funcionalidades parciais

Itens que existem no repositório mas não cumprem o critério do contrato.

| # | Item | O que existe | O que falta |
| --- | --- | --- | --- |
| X-01 | Leitor bíblico `/biblia` | capítulo de Gálatas 1 renderizado com tipografia própria, seletor visual, rodapé de atribuição | o texto está **fixo no componente** (`app/biblia/page.tsx`), não vem do banco; não há navegação livro/capítulo; não existe `/biblia/[book]/[chapter]` (contrato §8) |
| X-02 | Mensagem de estado do leitor | bloco "O leitor está em preparação", com pendências e atribuição | o bloco está **oculto**: `.legacyBible{display:none}` em `app/biblia/reader.css`. O `metadata.title` ainda é "Leitor bíblico em preparação" enquanto a página exibe versículos — texto e comportamento se contradizem (contrato §2.1: não alegar o que não é verdadeiro) |
| X-03 | Ferramentas de leitura | painel com abas Leitura/Versões/Versículo integrado ao leitor (tarefa C2). Estado real de sessão em `app/biblia/reader-state.tsx`: fonte, tamanho, espaçamento e tema aplicam-se de imediato; tocar em um versículo abre o painel local; destaque, nota e marca de leitura mudam o texto e o contador de progresso; tudo sobrevive a recarregar a mesma aba (`sessionStorage`) e é declarado "local nesta sessão". NVI/NTLH/Almeida permanecem desabilitadas como `Em licenciamento`; contexto e originais respondem indisponível, sem prometer data. Verificado em build de produção com 21 checagens de navegador | não há persistência por usuário: `drizzle/0003_reading_personal_data.sql` cria `reading_preferences`/`verse_notes`/progresso que nenhum código consome ainda, e o estado desaparece ao fechar a aba. Ligar às tabelas com RLS depende de Auth Supabase real (tarefa C5, X-05) |
| X-04 | Catálogo e páginas de estudo | `/estudos`, `/estudos/[slug]`, `/temas/[slug]` renderizam | conteúdo **fixo no componente**, dois slugs hardcoded; não consulta banco; **não chama `canAccess`**; o estudo gratuito é introdutório e se declara demonstração; o estudo premium completo não existe (contrato §2.2 exige 1 gratuito + 1 premium completos e revisados) |
| X-05 | Autenticação | `createAuth`, `requestOtp`, `getViewer`, `hasRole` implementados e testados com cliente injetado | `@supabase/supabase-js` **não está em `package.json` nem em `node_modules`**; não há `/auth/callback`; `/entrar` é aviso estático sem formulário; nenhuma rota chama `createAuth` |
| X-06 | Pagamento e assinatura | contrato de provedor, provedor fake, serviço de webhook idempotente, redação de log | não há `/checkout/[plan]`, não há endpoint de webhook, não há `/minha-conta` nem `/minha-assinatura`; `/planos` mostra "Em breve" sem preço comprável (correto como fallback, §9) |
| X-07 | PWA instalável | manifesto, `public/sw.js`, registro em `app/pwa-registration.tsx`, página `/offline` | a instalação do service worker **falha** (ver B-02); sem ícones PNG 192/512 nem `maskable`; nenhuma evidência de instalação ou de funcionamento offline em dispositivo |
| X-08 | Páginas legais | `/privacidade`, `/termos`, `/direitos-autorais`, `/contato` existem e constroem | são textos-marcador (370–714 bytes cada). `/privacidade` declara que "será completada com controlador, canais de atendimento, suboperadores, retenção e direitos LGPD"; `/contato` diz "Canal de suporte em definição" e **não publica e-mail de suporte** |
| X-09 | Preparação Capacitor | `mobile/capacitor.config.json` | sem `mobile/www`, sem projeto nativo, sem `@capacitor/*` instalado (ver B-09) |
| X-10 | Infraestrutura Cloudflare | `wrangler.jsonc`, `open-next.config.ts`, `docs/CLOUDFLARE_INFRA.md` | nenhum deploy realizado (ver B-01); `wrangler.jsonc` **não tem binding `HYPERDRIVE`**, logo `getDatabase()` devolve `null` em produção (ver B-07) |

---

## 3. Bloqueios reais

Numerados por severidade para o resultado de 19/11 e para loja/PWA.

### B-01 — Não existe origem HTTPS publicada (bloqueia o iPhone inteiro)

`docs/CLOUDFLARE_INFRA.md:171` registra que nenhum deploy foi feito e que os passos 1–8 não foram executados. `docs/IMPLEMENTATION_LOG.md` registra o domínio `bibliabereianos.com.br` em estado `pending`: a Cloudflare ainda observa `a.auto.dns.br`/`b.auto.dns.br` enquanto a zona exige `alaric.ns.cloudflare.com`/`megan.ns.cloudflare.com`.
**Impacto:** sem URL HTTPS não há PWA instalável no iPhone, não há política de privacidade pública para as lojas e não há acesso de revisão.
**Dependência:** propagação da delegação de nameservers e autenticação na conta Cloudflare pelo proprietário.

### B-02 — O service worker nunca instala: `/apple-icon.svg` retorna 404

`public/sw.js:2` pré-cacheia `["/offline", "/icon.svg", "/apple-icon.svg"]` com `cache.addAll`, que **rejeita inteiro** se qualquer recurso falhar. O build **não gera** `/apple-icon.svg`: a saída de rotas lista `/icon.svg` e não lista `apple-icon`; `find .next -iname "*apple-icon*"` não retorna nada. A convenção de metadados do Next aceita `icon.svg`, mas `apple-icon` apenas em formatos raster — `app/apple-icon.svg` é ignorado silenciosamente.
**Consequências encadeadas, todas verificadas no build:**
1. `install` falha → SW não ativa → o fallback `/offline` **nunca** funciona e a PWA não tem camada offline.
2. `/manifest.webmanifest` publica o ícone inexistente `/apple-icon.svg` (confirmado em `.next/server/app/manifest.webmanifest.body`).
3. O `<head>` não tem `apple-touch-icon` (apenas `<link rel="icon" href="/icon.svg?...">`), então o ícone na tela de início do iPhone cai para captura da página.

**Este é o bloqueio técnico mais barato de corrigir e o que invalida o critério de aceite da PWA.** Correção fora do escopo desta auditoria.

### B-03 — Nenhuma superfície HTTP de servidor existe

`find app -name "route.*"` não retorna nada e `grep -rln "use server" app src` não retorna nada. Não há webhook, checkout, callback de auth, nem `/admin/*`. Nenhuma página chama `getDatabase`, `canAccess` ou `createAuth` (`grep` confirmado).
**Impacto:** contrato §5 (autorização no servidor), §8 (rotas mínimas) e §10 (webhook duplicado, pagamento recusado, usuário A × usuário B) não podem ser demonstrados em nível de aplicação — apenas em teste unitário com mocks. A camada de domínio está correta e é código morto para o usuário final.

### B-04 — Rotas obrigatórias do contrato §8 ausentes

`/biblia/[book]/[chapter]`, `/checkout/[plan]`, `/auth/callback`, `/minha-conta`, `/minha-assinatura`, `/admin/*`. Nenhuma consta das 15 rotas do build.
**Impacto direto no resultado §1 do contrato:** os itens 5 (criar conta), 6 (checkout + acesso só após webhook) e 7 (gerenciamento/cancelamento de assinatura) não são entregáveis em 19/11.

### B-05 — Texto bíblico exibido sem importação ter ocorrido

`docs/CLAUDE_EXECUTION_HANDOFF.md` item 3 determina trocar o estado "em preparação" **apenas depois de dados realmente importados e testados**. O estado foi trocado (X-01/X-02) com versículos fixos no componente. `scripts/import-blivre.ts` não foi executado nesta sessão: não há `DATABASE_URL` disponível aqui e a importação exige conexão autorizada pelo proprietário.
**Observação de direitos:** o texto exibido é BLIVRE (CC BY 4.0 BR) com atribuição presente, portanto **não há violação de licença aparente**. O problema é de procedência e veracidade: o conteúdo não é rastreável ao corpus validado nem ao `translation_id` aprovado, e a própria página afirma não exibir versículos.

### B-06 — Migrations sem journal (colisão de prefixo resolvida)

A colisão de prefixo foi resolvida (tarefa C1 de `docs/CLAUDE_MVP_EXECUTION_QUEUE.md`): `drizzle/0002_blivre_query_indexes.sql` permanece como `0002` e a migration de dados pessoais passou a `drizzle/0003_reading_personal_data.sql`. A sequência local agora é única: `0000`-`0003`.
**Pendência:** continua não existindo `drizzle/meta/_journal.json`, logo `npm run db:migrate` (drizzle-kit) ainda não aplica nem rastreia esses SQL escritos à mão — a ordem está definida pelos nomes, mas a aplicação permanece manual e sem registro. Nenhuma migration foi aplicada a banco local ou remoto nesta tarefa.

### B-07 — Worker sem acesso a banco

`src/server/db/client.ts` resolve a conexão por `env.HYPERDRIVE.connectionString` e, como alternativa, `process.env.DATABASE_URL`. `wrangler.jsonc` não declara binding `HYPERDRIVE` (o bloco está apenas comentado) e `.env.local` não é lido pelo Worker.
**Impacto:** em produção `getDatabase()` retorna `null`. Hoje isso é inócuo porque nenhuma página consulta o banco (B-03), mas bloqueia qualquer rota dinâmica real.

### B-08 — Nenhum teste E2E existe

`playwright.config.ts` aponta `testDir: "./tests/e2e"` e esse diretório **não existe**; não há nenhum `*.spec.*` em `tests/`. O fluxo mínimo exigido pelo contrato §10 (estudo gratuito → preview premium → login → checkout → webhook → acesso premium) não tem cobertura.

### B-09 — Android: toolchain e projeto nativo ausentes

Verificado nesta sessão: `gradle` **ausente**, `adb` **ausente**, `sdkmanager` **ausente**, `ANDROID_HOME` **ausente**, `ANDROID_SDK_ROOT` **ausente**, `%LOCALAPPDATA%\Android\Sdk` **ausente**, `node_modules/@capacitor/core` e `@capacitor/cli` **ausentes**, `mobile/www` e `mobile/android` **ausentes**.
Presentes: `java` e `javac` no PATH, `JAVA_HOME=C:\Program Files\Java\jdk-17`. (A versão exata do runtime não foi capturada: `java -version` não retornou saída legível neste shell. Isto corrige parcialmente `docs/APK_BLOCKER.md`, que não conseguiu verificar nada por falha do executor: JDK existe, o SDK Android é que falta.)
**Bloqueio adicional de arquitetura:** `npm run build` produz `.next`, não um `out/` estático. As rotas `/estudos/[slug]` e `/temas/[slug]` são `ƒ` (server-rendered on demand), logo não há bundle estático completo para `mobile/www` sem decisão de produto sobre o que fica no app.

### B-10 — Metadados de loja incompletos e identificador divergente

- `mobile/capacitor.config.json` usa `appId: "com.samjoe.bibliabereana"` e `appName: "Bíblia Bereana"`; `docs/STORE_PUBLICATION_READINESS.md` ainda afirma `com.samjoe.estudos` e `SamJoE Estudos`. **O identificador precisa ser decidido antes de publicar — ele não pode ser trocado depois.**
- `docs/STORE_PUBLICATION_READINESS.md` registra a política de privacidade como "não existe página pública"; na verdade `/privacidade` existe, porém como texto-marcador (X-08). O documento está desatualizado em ambos os pontos.
- Sem e-mail de suporte publicado (`/contato`), sem inventário de dados aprovado, sem ícones/screenshots, sem classificação etária.

### B-11 — Tensão editorial não resolvida pelo proprietário

Já registrada em `docs/IMPLEMENTATION_LOG.md` e aqui mantida como bloqueio de conteúdo: o aviso exibido declara "análise gerada com apoio de inteligência artificial", enquanto o contrato §6 e o backlog P0 determinam processo editorial manual sem chamada de modelo. Uma das duas afirmações é falsa perante o usuário. Decisão cabe ao proprietário.

### B-12 — Ambiente de build frágil

`@next/swc-win32-x64-msvc` "is not a valid Win32 application" e o build conclui por fallback (`docs/IMPLEMENTATION_LOG.md`). O build é verde, mas não é o caminho binário esperado; deve ser reproduzido em CI limpo antes de se declarar build de lançamento.

---

## 4. Passos de publicação

Ordem obrigatória. Nenhum passo posterior pode ser declarado concluído sem a evidência do anterior.

### Fase A — Web (pré-requisito de tudo)

1. Resolver a propriedade do `.git` (B-01/§0) para liberar commit, push e CI.
2. Corrigir B-02 (ícone/service worker). B-06 teve a colisão de prefixo resolvida na tarefa C1 (`0000`-`0003`); resta criar/manter `drizzle/meta/_journal.json` ou assumir aplicação manual registrada.
3. Executar `npm run check` em árvore limpa e em CI (`.github/workflows/deploy.yml`), registrando os quatro exits.
4. Aplicar `0000`, `0001` e o `0002` de índices em ambiente autorizado; executar `scripts/import-blivre.ts` com `DATABASE_URL` fornecido pelo proprietário; confirmar 66/1189/31102 no banco.
5. Ligar o leitor ao banco e criar `/biblia/[book]/[chapter]`, substituindo o texto fixo (B-05) ou restaurando o aviso de preparação (X-02). Não manter os dois estados contraditórios.
6. Confirmar delegação de nameservers em `active`; `npm run deploy`; criar o domínio customizado para `samjoe-estudos`; testar HTTPS.
7. Publicar política de privacidade, termos, direitos autorais e **e-mail de suporte** reais (X-08).

### Fase B — PWA iPhone

8. Com a origem HTTPS no ar, validar manifesto, ícones e instalação pelo Safari (Compartilhar → Adicionar à Tela de Início). Não existe IPA nesta rota e um APK não roda em iPhone.
9. Validar o comportamento offline somente após o SW instalar de fato.

### Fase C — Android APK/AAB

10. Instalar Android Studio, Android SDK e configurar `ANDROID_HOME`; confirmar JDK compatível com Capacitor 8.
11. Decidir e implementar o bundle web de `mobile/www`, preservando autorização premium no servidor. Não copiar `.next` para `www`; não embutir segredos nem conteúdo premium.
12. Instalar `@capacitor/*@8`, `npx cap add android`, `npx cap sync android`.
13. `.\gradlew.bat assembleDebug` → APK de debug em `mobile/android/app/build/outputs/apk/debug/app-debug.apk`, **somente para teste**.
14. Para a loja: chave de assinatura de release sob guarda corporativa, `versionCode`/`versionName`, **AAB assinado** — o Play não aceita o APK de depuração.

### Fase D — Lojas

15. Cumprir os sete gates de `docs/STORE_PUBLICATION_READINESS.md`, após reconciliar o identificador (B-10). Android: teste interno antes de produção. iOS nativo: macOS + Xcode + conta Apple, TestFlight antes do App Review — nada disso existe neste ambiente.

---

## 5. Testes e validações necessários

Nenhum dos itens abaixo está satisfeito hoje, exceto onde indicado.

### 5.1 Já cobertos por teste local (verificado)

- `canAccess`: status, entitlement, janela de datas — `tests/domain/domain.test.ts`.
- `hasRole` e OTP com cliente injetado — `tests/auth/auth.test.ts`.
- Webhook idempotente e máquina de assinatura, em nível de serviço — `tests/billing-provider.test.ts`, `tests/integration/critical-paths.test.ts`.
- Validação editorial e recusa de `publish` inválido — `tests/editorial.test.ts`.
- Parser BLIVRE — `tests/importers/blivre.test.ts`.
- Integridade do corpus convertido — `scripts/validate-blivre-corpus.ts`, 66/1189/31102.

### 5.2 Faltantes e obrigatórios antes de declarar o MVP pronto

| Validação | Por que falta hoje |
| --- | --- |
| E2E mínimo do contrato §10 | não existe `tests/e2e` (B-08) |
| Estudo premium inacessível por URL direta e por endpoint | não há endpoint nem conteúdo premium (B-03, X-04) |
| Usuário A não acessa dados do usuário B | não há auth em rota (X-05) |
| Webhook duplicado em nível HTTP | não há endpoint (B-03) |
| Pagamento recusado não concede entitlement; cancelamento remove na data | coberto em serviço, não em fluxo real; sem credenciais sandbox |
| Sanitização de conteúdo editorial contra XSS | conteúdo é JSX literal hoje; precisa de teste quando vier do banco/USFM |
| Instalação da PWA e fallback offline | SW não instala (B-02) |
| Importação real 66/1189/31102 no banco | sem `DATABASE_URL` nesta sessão (B-05) |
| RLS fail-closed de `reading_preferences`/`verse_notes` | migration não aplicada; tabelas sem consumidor (X-03) |
| Build reproduzível em CI limpo | fallback de SWC local (B-12) |
| Teste em dispositivo físico Android e iPhone | sem build nativo e sem origem HTTPS |

---

## 6. Critérios de aceite

### 6.1 iPhone — PWA

Aceite exige **todos** os itens, cada um com evidência registrada em `docs/IMPLEMENTATION_LOG.md`:

1. Origem HTTPS própria respondendo em domínio verificado (hoje: **não**, B-01).
2. `/manifest.webmanifest` com `name`, `short_name`, `start_url`, `display: standalone` e **todos os ícones resolvendo 200** (hoje: **não**, B-02 — `/apple-icon.svg` retorna 404).
3. `<link rel="apple-touch-icon">` presente em formato raster, com ícone próprio na tela de início (hoje: **não** — ausente do `<head>`).
4. Service worker instalando e ativando sem erro, comprovado no console do dispositivo (hoje: **não**, B-02).
5. Fallback `/offline` exibido em navegação sem rede (hoje: **não comprovado**).
6. Nenhuma resposta autenticada, de API ou de conteúdo premium em cache — regra explícita do handoff (hoje: o `sw.js` só trata navegação e três assets estáticos, o que **está conforme**; precisa reconfirmação após qualquer mudança).
7. Leitura utilizável em tela de iPhone, com o leitor servindo texto do corpus importado e atribuição BLIVRE visível (hoje: **parcial**, X-01).
8. Política de privacidade, termos, direitos autorais e e-mail de suporte acessíveis pelo app (hoje: **não**, X-08).
9. Nenhuma afirmação falsa na interface: estado do leitor, persistência de notas/marcações e origem da análise coerentes com o comportamento real (hoje: **não**, X-02, X-03, B-11).

Observação obrigatória: esta rota **não** gera IPA e **não** é publicação em App Store. Um APK não se instala em iPhone.

### 6.2 Android — APK

**APK de debug (teste interno apenas):**

1. Android SDK, `ANDROID_HOME` e JDK compatível verificados por comando (hoje: **não**, B-09).
2. Bundle web definido e gerado em `mobile/www`, sem segredos e sem conteúdo premium embutido, com decisão registrada sobre as rotas server-rendered (hoje: **não**, B-09).
3. `@capacitor/*@8` instalado e `npx cap add android` + `cap sync android` concluídos (hoje: **não**).
4. `assembleDebug` concluído e **caminho do artefato registrado** — `mobile/android/app/build/outputs/apk/debug/app-debug.apk` (hoje: **não**; nunca afirmar APK gerado sem caminho e teste).
5. Instalado e aberto em dispositivo físico, com leitura, navegação e links legais funcionando (hoje: **não**).
6. `appId` final confirmado e idêntico em `capacitor.config.json` e na documentação de loja (hoje: **não**, B-10 — divergência `com.samjoe.bibliabereana` × `com.samjoe.estudos`).

**Adicional para Google Play (além de todo o item acima):**

7. **AAB assinado de release** — o APK de depuração não é aceito.
8. Chave de assinatura de release sob guarda corporativa, nunca versionada; `versionCode`/`versionName` definidos.
9. Política de privacidade pública em HTTPS e formulário Data safety preenchido com inventário aprovado.
10. Se houver criação de conta: fluxo público de exclusão de conta e dados.
11. Os sete gates de `docs/STORE_PUBLICATION_READINESS.md` registrados pelo responsável SamJoE.

---

## 7. Veredito

**O MVP não está pronto para a condição §13 do contrato.** Build, lint, typecheck e 35 testes estão verdes, o corpus BLIVRE está convertido e validado localmente, e a camada de domínio (acesso, billing, editorial) está implementada e testada. Porém:

- **não houve deploy algum**, logo não existe PWA instalável no iPhone;
- **não existe nenhuma rota de servidor**, logo login, checkout, webhook e administração não são entregáveis;
- **o leitor exibe versículos fixos no código** enquanto afirma não exibir versículos;
- **o service worker não instala**, por um ícone 404;
- **não há toolchain Android nem bundle web**, logo não há APK.

Itens 5, 6 e 7 do resultado obrigatório (§1) não são alcançáveis em 19/11 sem credenciais de Supabase e provedor de pagamento, além da implementação das rotas de servidor. Os itens 1–4 e 8 são alcançáveis, desde que a contradição do leitor e o bloqueio B-02 sejam resolvidos.

Esta auditoria não alterou aplicação, banco, migrations, infraestrutura, dependências, `.env*` ou licenças, não acessou a rede, não invocou agentes e não criou commit.
