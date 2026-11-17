# Contrato de execução — MVP SamJoE até 19/11/2026

**Status:** decisão operacional fechada  
**Autoridade:** este documento operacionaliza `SamJoE_Plataforma_Teologica_SPEC_MVP_v1.md`. Em caso de conflito, prevalecem segurança, direitos autorais, privacidade e proteção de acesso premium.  
**Regra para qualquer executor posterior:** executar as decisões abaixo; não substituir tecnologias, conteúdo, preços, fontes, integrações ou critérios de aceite por preferências próprias. Quando uma dependência externa não existir, aplicar o fallback explicitamente indicado e registrar o bloqueio em `docs/IMPLEMENTATION_LOG.md`.

## 1. Resultado obrigatório em 19/11

Entregar um MVP web publicável no qual uma pessoa possa:

1. Abrir uma landing page e entender a proposta.
2. Ler conteúdo gratuito útil sem conta e sem pop-up automático.
3. Abrir um estudo editorial gratuito completo.
4. Abrir um estudo premium e receber somente um preview autorizado se não possuir direito de acesso.
5. Criar conta por magic link/OTP, se as credenciais do provedor estiverem disponíveis.
6. Ver plano, iniciar checkout sandbox e ter acesso concedido somente após evento de pagamento validado, se as credenciais do provedor estiverem disponíveis.
7. Encontrar termos, privacidade, direitos autorais, contato e gerenciamento/cancelamento de assinatura.
8. Navegar por estudos ligados a passagens e temas.

Não é meta até 19/11: IA pública, RAG, busca semântica, cursos, aplicativo nativo, fóruns, certificados, importação de Bíblia completa sem licença validada ou cobrança real sem configuração e teste do provedor.

## 2. Premissas fechadas

### 2.1 Produto e linguagem

- Idioma: `pt-BR`.
- Nome exibido: configurável por `PUBLIC_APP_NAME`; fallback `SamJoE Estudos`.
- Produto é um leitor e acervo editorial; não alegar que é uma autoridade teológica, seminário, curso certificado ou substituto de igreja/profissional.
- Interface: mobile-first, sóbria, própria e acessível. Não copiar identidade/interface de Logos ou Bíblia Raízes.
- Toda oferta deve mostrar preço total, periodicidade, renovação e caminho de cancelamento. Não usar urgência falsa, culpa religiosa, contadores ou modais automáticos durante leitura.

### 2.2 Conteúdo e direitos

- Não exibir texto bíblico integral até existir licença documental que permita uso comercial e exibição digital para a tradução escolhida.
- **Fallback obrigatório de lançamento:** rotas de Bíblia exibem catálogo/navegação e um aviso editorial; a demonstração real ocorre em estudos com referências bíblicas e somente trechos cuja utilização esteja autorizada/documentada.
- Não importar, copiar ou publicar ARA, NAA, NVI, ACF ou outra tradução por mera suposição de domínio público.
- Nenhuma citação de autor histórico pode ser inventada. Cada citação/paráfrase precisa de obra, edição/tradução, localização e URL/identificador verificável quando disponível.
- Conteúdo inicial mínimo: 1 estudo gratuito completo e 1 estudo premium completo, ambos revisados; o catálogo pode conter apenas esses dois itens até que outros passem por revisão.
- Estudos iniciais sugeridos: gratuito sobre contexto de Romanos 9; premium sobre interpretações de Romanos 9 e eleição. Se fontes verificadas não estiverem disponíveis, publicar um único estudo gratuito claramente limitado; não fabricar comparação.

### 2.3 Segurança e privacidade

- Segredos somente em variáveis de ambiente; nunca em código, fixtures, logs ou bundle web.
- Conteúdo premium não pode ser entregue inteiro a visitante anônimo nem a usuário sem entitlement, inclusive em endpoints, payloads de listagem, pré-carregamento, metadados e sitemap.
- Toda decisão de acesso ocorre no servidor por `canAccess(user, feature, resource)`.
- Não armazenar inferência de religião, denominação ou perfil religioso a partir de leituras/pesquisas.
- Logs mascaram tokens, e-mails completos, telefones, conteúdo sensível e dados de cartão.
- Webhooks devem verificar assinatura, registrar evento de forma idempotente e consultar o provedor no servidor antes de ativar acesso.

## 3. Stack e organização de projeto

Como o repositório está vazio além da especificação, usar a base abaixo, sem trocar por outro framework durante este MVP:

- **Web/API:** Next.js (App Router) + TypeScript estrito.
- **Banco/Auth:** Supabase Postgres + Supabase Auth (magic link/OTP), se credenciais existirem.
- **ORM e migrations:** Drizzle ORM + SQL versionado. Se a integração com Supabase atrasar, manter Drizzle e usar Postgres local/documentado; não trocar o contrato do domínio.
- **Validação:** Zod.
- **Estilos:** CSS/Tailwind somente se a instalação inicial estiver estável; preferir a solução que permita entregar UI acessível sem ampliar escopo.
- **Testes:** Vitest para unidade/integração e Playwright para fluxo crítico quando o ambiente permitir.
- **Deploy:** Vercel para web ou Cloudflare Pages/Workers se uma configuração existente for encontrada. Sem configuração/credenciais, entregar build reproduzível e checklist; não alegar deploy realizado.
- **Pagamentos:** adaptador `BillingProvider`; primeiro adaptador Mercado Pago somente se credenciais sandbox existirem. Sem elas, implementar contrato, telas e testes por fake provider; manter checkout marcado como indisponível e não cobrar.
- **Mensageria:** interface `MessagingProvider`; integração WhatsApp fica desativada por padrão até receber credenciais, número e política aprovada.

Estrutura mínima:

```text
app/                    rotas e páginas públicas/protegidas
src/domain/             regras puras: editorial, entitlement, billing
src/server/             repositórios, serviços e autorização
src/content/            estudos MDX/fixtures aprovados e metadados
src/cli/                CLI editorial
drizzle/                schema e migrations
tests/                  unitários, integração e E2E
docs/                   ADRs, operação, licenças e este contrato
```

## 4. Modelo de dados obrigatório

Usar UUIDs internos, `created_at`, `updated_at` e, onde aplicável, `created_by`/`updated_by`. Não confiar em slug como identificador de autorização.

### 4.1 Bíblia e licenças

- `licenses`: titular, URL da prova, permissões, restrições, vigência, `verified_at`, responsável e observações.
- `translations`: nome, idioma, cânon, `license_id`, status (`pending|approved|rejected`), atribuição obrigatória.
- `books`, `chapters`, `verses`: preparados para futura importação e ligados à tradução. Nenhuma verse é marcada `published` sem tradução com licença `approved`.

### 4.2 Editorial e fontes

- `studies`: `slug`, título, resumo, tipo, nível, status (`draft|in_review|approved|published|archived`), acesso (`free|premium`), versão publicada, revisor, datas.
- `study_versions`: conteúdo versionado, changelog, autor, revisor, status e data. Publicar é promover versão aprovada; nunca sobrescrever histórico.
- `study_sections`: seção, ordem, conteúdo e visibilidade (`free|premium`). A API pública só consulta seções livres; o HTML premium não entra no payload de preview.
- `sources`: obra/documento, autor, editora, edição, ano, URL/identificador, licença e confiabilidade editorial.
- `source_locations`: fonte, capítulo/página/seção/URL e trecho permitido.
- `source_claims`: estudo/versão, afirmação ou âncora, `source_location_id`, tipo (`quote|paraphrase|editorial_synthesis`), nota de verificação.

### 4.3 Grafo editorial determinístico

- `topics`: slug, nome, descrição, status.
- `authors`, `works`, `traditions`, `debates`.
- Tabelas de junção: `study_passages`, `study_topics`, `study_authors`, `work_authors`, `work_topics`, `debate_topics`, `debate_traditions`.
- Toda junção possui `relation_type`, `confidence`, `editorial_note` e referência à versão que a criou.

### 4.4 Identidade, pagamento e acesso

- `profiles`: extensão do usuário Auth, dados mínimos e papel (`reader|editor|admin`).
- `plans`: chave, versão, preço, moeda, periodicidade, recursos, status e texto de renovação.
- `subscriptions`: usuário, plano/versionamento, status (`pending|active|grace|past_due|canceled|expired|refunded`), provedor e IDs externos.
- `payment_events`: ID externo único, tipo, assinatura, payload minimizado, recebido/em-processado e resultado. Índice único por `(provider, external_event_id)`.
- `entitlements`: usuário, recurso/feature, origem, início/fim, estado. É derivado do estado de assinatura, mas persiste auditoria.
- `audit_logs`: ator, ação, recurso, resultado e metadados minimizados.

## 5. API e autorização

Endpoints/ações de servidor devem cumprir:

- Rotas públicas retornam apenas estudos `published` e blocos permitidos ao visitante.
- Rota de estudo premium sem entitlement retorna metadados, preview explicitamente marcado e CTA; jamais a seção premium completa.
- Administração exige papel `editor` para rascunho/revisão e `admin` para publicação, planos e configuração.
- Checkout recebe apenas uma chave de plano permitida; preço, moeda e periodicidade são resolvidos no servidor.
- Retorno do navegador após checkout não concede acesso. Só webhook verificado mais consulta server-side do pagamento altera assinatura/entitlement.
- Operações críticas usam idempotency key e auditoria.

## 6. CLI editorial: contrato de operação

A CLI é interna. Ela gera dossiês e rascunhos a partir de demanda real, mas não publica conteúdo automaticamente.

Comandos obrigatórios:

```bash
samjoe study:new --topic "Romanos 9 e eleição" --passage "Rm 9:1-33" --type doctrinal-comparison
samjoe study:research <draft-id>
samjoe study:draft <draft-id>
samjoe study:validate <draft-id>
samjoe study:submit <draft-id>
samjoe study:publish <draft-id>
```

Contratos por comando:

1. `study:new`: cria `studies` em `draft`, versão inicial, perguntas editoriais, passagens e tema. Não chama IA.
2. `study:research`: grava um dossiê estruturado de fontes e lacunas. Só usa fontes previamente cadastradas/autorizadas ou fontes apresentadas pelo operador; não inventa bibliografia.
3. `study:draft`: produz seções estruturadas e referências a `source_claims`. Deve reutilizar o dossiê e IDs, sem regenerar pesquisa inteira.
4. `study:validate`: bloqueia avanço se faltarem fonte, localização, licença, aviso de síntese, campos editoriais ou relação de passagem/tema. Gera relatório legível e código de saída não zero em caso de falha.
5. `study:submit`: muda para `in_review`; exige autor identificado.
6. `study:publish`: só permite `approved`, revisor diferente do autor quando houver equipe, fontes válidas e pelo menos uma seção publicável. Registra versão, auditoria e invalida caches.

Formato persistido do dossiê: JSON validado por schema, versionado por `draft-id`, com `question`, `scope`, `passages`, `topics`, `sources`, `claims`, `open_questions`, `rights_status`, `editorial_risks` e `token_budget_used`.

O MCP é uma interface para a futura IA/CLI consultar dados; não é banco nem mecanismo de autorização. Ferramentas MCP permitidas inicialmente:

```text
search_studies(topic, passage, access_level)
get_study(slug, viewer_context)
find_sources(topic_or_claim)
get_passage_context(reference)
compare_traditions(debate_id)
```

Cada ferramenta deve aplicar a mesma autorização do backend e devolver IDs, metadados, trechos autorizados e citações. Nunca expor SQL, segredos, dados pessoais ou material premium fora da permissão do solicitante.

## 7. Conteúdo de demonstração e cruzamentos

Criar relações explícitas, não embeddings, para o primeiro catálogo:

```text
Tema: eleição
Passagem: Romanos 9:1–33
Estudo gratuito: contexto literário e histórico de Romanos 9
Estudo premium: leituras de tradições cristãs sobre Romanos 9
Debate: eleição, responsabilidade humana e misericórdia
```

O comparativo premium deve separar claramente: fato textual/histórico, resumo editorial, posição confessional e divergência interna. Se uma tradição/autoria não puder ser sustentada por fonte verificável, ela não integra a versão publicada.

## 8. Rotas mínimas

- `/`: proposta, exemplo real, CTA e planos.
- `/biblia`: catálogo preparado para leitura e aviso de disponibilidade/licença quando ainda não houver corpus aprovado.
- `/biblia/[book]/[chapter]`: somente funciona com tradução aprovada; caso contrário, resposta informativa sem texto não licenciado.
- `/estudos`: catálogo de estudos publicados.
- `/estudos/[slug]`: renderização free/premium protegida.
- `/temas/[slug]`: estudos, passagens, autores e debates relacionados.
- `/planos`, `/checkout/[plan]`, `/entrar`, `/auth/callback`, `/minha-conta`, `/minha-assinatura`.
- `/privacidade`, `/termos`, `/direitos-autorais`, `/contato`.
- `/admin/*`: proibido de indexação e protegido por papel.

## 9. Feature flags e fallbacks

Todas as dependências externas são desligadas por padrão e declaradas em ambiente:

```text
PUBLIC_APP_NAME
DATABASE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
BILLING_PROVIDER
MERCADO_PAGO_ACCESS_TOKEN
MERCADO_PAGO_WEBHOOK_SECRET
WHATSAPP_ENABLED
WHATSAPP_PROVIDER_*
BIBLE_TRANSLATION_ENABLED
```

- Sem banco/Auth: permitir build e demonstração local com fixtures não sensíveis; marcar login, compra e publicação como indisponíveis.
- Sem Mercado Pago: não exibir preço como comprável; exibir lista de espera/"em breve" ou ambiente de teste claramente identificado.
- Sem corpus licenciado: não mostrar versículos integrais.
- Sem WhatsApp: CTA de contato por e-mail/formulário; não simular envio.
- Sem IA/MCP: CLI deve aceitar fontes/dossiê manual e operar sem chamada de modelo.

## 10. Testes e critérios de aceite

Obrigatórios antes de declarar o MVP pronto:

- Parser de referência bíblica e resolução de tema/passagem.
- Máquina de estados de assinatura e `canAccess`.
- Estudo premium nunca aparece integralmente para visitante/free, inclusive via URL direta e endpoint.
- Usuário A não acessa assinatura/dados do usuário B.
- Webhook duplicado não duplica eventos, assinaturas ou entitlements.
- Pagamento recusado não concede entitlement; cancelamento/expiração o remove conforme data efetiva.
- CLI recusa `publish` quando fontes/revisor/status não atendem às regras.
- Sanitização de conteúdo editorial contra XSS.
- Fluxo E2E mínimo: estudo gratuito → preview premium → login → checkout sandbox (ou fake provider explicitamente marcado) → webhook → acesso premium.
- `lint`, typecheck, testes e build verdes; `git diff --check` sem erros.

## 11. Sequência fixa de execução

1. Criar repositório da aplicação, README, `.env.example`, ADR-001 e este contrato referenciado no README.
2. Configurar TypeScript, lint, testes, build e CI local.
3. Implementar schema/migrations/seeds com os dois estudos e fontes documentadas.
4. Implementar domínio editorial, relações por tema/passagem e renderização pública protegida.
5. Implementar landing, catálogo, páginas de estudo, tema, legais e responsividade.
6. Implementar Auth, papéis e `canAccess` no servidor.
7. Implementar planos, billing provider, webhook idempotente, entitlements e página de assinatura.
8. Implementar CLI editorial e validação de publicação.
9. Implementar adaptadores MCP internos somente após o domínio e autorização estarem testados.
10. Executar a matriz de testes, registrar evidências e produzir checklist de deploy.

Não antecipar o item 9; MCP não deve atrasar a entrega de leitura, editorial, segurança e cobrança.

## 12. Registro de bloqueios e handoff

Manter `docs/IMPLEMENTATION_LOG.md` com: data/hora, ação, arquivos, migration, comandos/testes e resultado. Para qualquer bloqueio, escrever exatamente: dependência ausente, impacto, fallback aplicado e a credencial/decisão necessária — sem alterar este contrato por conta própria.

Ao encerrar uma sessão, o executor deve deixar:

- estado do git;
- comandos exatos de validação executados;
- resultado de cada um;
- próximos passos numerados segundo a seção 11;
- bloqueios externos sem segredos.

## 13. Condição de pronto para 19/11

Só marcar como pronto se houver evidência registrada de build limpa, testes críticos verdes, conteúdo gratuito real, preview premium protegido, modelo de relações tema/passagem/fonte funcional, CLI que bloqueia publicação inválida e documentação clara dos recursos externos configurados ou explicitamente indisponíveis.

Não afirmar que pagamento, login, WhatsApp, deploy ou texto bíblico completo funcionam sem teste correspondente e credenciais/licenças válidas.
