# SAMJOE — PLATAFORMA DE ESTUDOS BÍBLICOS E FORMAÇÃO TEOLÓGICA
## Especificação de produto e engenharia (PRD + SRS + plano de execução)

**Versão:** 1.0 — 17/11/2026  
**Status:** especificação inicial para implementação pelo agente local  
**Meta de entrega:** MVP funcional até sexta-feira, **20/11/2026**  
**Marca pública:** nome provisório; não fixar o nome definitivo no código  
**Operadora tecnológica:** SamJoE Tech  
**Idioma inicial:** português brasileiro (pt-BR)  
**Mercado inicial:** Brasil, adultos  
**Canal principal de produto:** web responsiva/PWA  
**Canal de aquisição e conversão assistida:** WhatsApp comercial existente + Instagram + landing pages; anúncios em apps/jogos somente após qualificação de tráfego  
**Modelo:** freemium + assinatura semanal, mensal e anual + expansão futura para cursos livres e parcerias com professores.

> **Princípio de execução:** entregar uma experiência de valor real que permita *ler → descobrir → aprofundar → experimentar → pagar → acessar*, sem depender de intervenção manual. Não criar um concorrente completo do Logos até sexta. Não vender recursos ainda inexistentes como se já estivessem disponíveis.

---

# 1. RESUMO EXECUTIVO E CONTEXTO

## 1.1 Origem da tese

O fundador observou que aplicativos de nicho podem obter retorno comercial rapidamente, mas também identificou uma fricção importante: o aplicativo Bíblia Raízes, na experiência testada, bloqueou praticamente toda a navegação antes do pagamento. A hipótese da SamJoE é diferente: oferecer utilidade verdadeira gratuitamente, despertar curiosidade durante a leitura e converter os usuários interessados em aprofundamento teológico.

O Logos é uma referência de profundidade, mas a experiência deve ser muito mais intuitiva, acolhedora para iniciantes e sem telas ou pop-ups agressivos. O objetivo não é criar um simples chat religioso: trata-se de uma biblioteca viva de textos, fontes e trilhas formativas que cresce continuamente e disponibiliza IA como *mediadora* de pesquisa, não como autoridade teológica absoluta.

O fundador já tem experiência com JavaScript/HTML/CSS, Apps Script, Python, automações, Cloudflare Workers/Pages (Hono), D1, Supabase Pro, Vercel Pro, n8n, Evolution API e infraestrutura de WhatsApp. A SamJoE Assistente está sendo desenhada como núcleo reutilizável, configurável por nicho, com memória contextual, ferramentas MCP e franquia de uso percentual. O componente de WhatsApp comercial está relativamente adiantado e deve ser reutilizado, sem criar um novo canal de comunicação do zero.

A meta declarada é começar a monetizar em aproximadamente 30 dias; **isso é hipótese comercial, não previsão garantida**. O primeiro objetivo verificável é vender o produto real e medir conversão, CAC, custo de atendimento e retenção.

## 1.2 Proposta de valor

> “Leia a Bíblia de forma simples. Quando surgir uma dúvida, aprofunde com contexto histórico, exegese, fontes verificáveis e diferentes interpretações — sem precisar aprender a usar um software acadêmico complicado.”

Complementos futuros: história da Igreja, concílios, patrística, Reforma, teologia bíblica e sistemática, acervo histórico, videoaulas, cursos livres e certificados com professores parceiros.

## 1.3 Diferencial de posicionamento

1. Leitura limpa, fluida, rápida e gratuita.
2. Convites discretos, contextuais e **não intrusivos** para aprofundamento.
3. Comparação doutrinária honesta, sem ocultar escolas divergentes.
4. Fontes primárias e secundárias com rastreabilidade precisa.
5. Uso de IA baseado em corpus curado e referenciado, não alucinação livre.
6. Produto técnico reaproveitável no ecossistema SamJoE: motor universal de identidade, planos, conteúdo, pagamentos, ferramentas e contexto.
7. Crescimento editorial composto: estudos revisados adicionados continuamente, cada um interligado a passagens, autores e temas.
8. WhatsApp como canal de venda, suporte e lembretes consentidos; a pesquisa avançada ocorre na web.

## 1.4 Objetivos e não objetivos

**Objetivos do MVP**: primeira experiência pública de leitura; 5–10 estudos de demonstração bem revisados; ligações entre versículos, estudos e autores; conta de usuário; recursos premium protegidos; pagamento e ativação automática; landing page; handoff para WhatsApp; telemetria; infraestrutura mínima segura.

**Não objetivos do MVP**: catálogo bíblico multilíngue completo, plataforma universitária, certificados, marketplace de professores, debates históricos em tempo real com múltiplos agentes, novos apps para Android/iOS, biblioteca com centenas de obras, comunidade com fórum, aplicativo de WhatsApp como leitor principal, personalização irrestrita por IA.

---

# 2. PERSONAS, JTBD E POSICIONAMENTO

| Persona | Necessidade | Ganho gratuito | Motivação premium |
|---|---|---|---|
| Leitor iniciante | Ler e compreender trechos difíceis | Bíblia, contexto introdutório, plano de leitura | Explicações profundas acessíveis |
| Membro de igreja/discipulando | Entender doutrinas sem respostas dogmáticas superficiais | Busca, notas, artigos | Comparação de tradições e autores |
| Professor de EBD/líder | Preparar estudo responsável e rápido | Referências e leitura | Exegese estruturada, citações e exportação |
| Estudante de teologia | Pesquisar textos, debates e história | Conteúdo aberto | Biblioteca indexada, ferramentas avançadas |
| Pastor/pregador | Elaborar sermões com precisão | Leitura e notas | Comparação exegética e pesquisa rastreável |

**JTBD principal:** “Quando eu encontro uma passagem, tema ou afirmação controversa, quero compreender o contexto e comparar fontes confiáveis sem abandonar minha leitura nem perder horas navegando em ferramentas complexas.”

**Identidade editorial:** plataforma cristã de pesquisa e formação com transparência de tradições, sem alegar neutralidade absoluta ou equivalência entre evidências desiguais. Tradições e autores devem ser identificados; divergências devem ser apresentadas com contexto, documentos e distinção entre fato histórico, interpretação acadêmica e posição confessional.

---

# 3. ESCOPO — RELEASES E PRIORIDADES

## 3.1 P0 — obrigatório para lançamento pago

- Landing page pública funcional com proposta, exemplo real, planos, termos e política de privacidade.
- Web app mobile-first com leitura bíblica em tradução cujo uso comercial esteja documentalmente autorizado.
- Navegação por livro, capítulo e versículo, busca inicial por referência e URL compartilhável.
- Intervenções editoriais discretas: blocos opcionais “Contexto”, “Exegese”, “História” e “Doutrinas” quando existirem conteúdos revisados para aquela passagem.
- Um conjunto de **5 a 10 estudos** de alta qualidade, publicados e associados a passagens/temas (não inventar conteúdo placeholder para usuários reais).
- Ao menos **1 comparação doutrinária premium** e **1 análise exegética premium** completas e revisadas para demonstrar o diferencial.
- Cadastro/login por link mágico ou OTP, autenticação robusta e sessão segura.
- Plano gratuito e pelo menos **um plano pago** funcionando de ponta a ponta; frequência semanal/mensal/anual ativada conforme suporte operacional testado no provedor, não por promessa no front-end.
- Checkout externo seguro, webhook verificado, idempotência e concessão de acesso somente após status de pagamento confirmado consultado no provedor.
- Página “Minha assinatura”: plano, situação, período, cancelamento/gerenciamento e contato de suporte.
- Integração com WhatsApp existente para captação, convite, links rastreáveis e envio da confirmação de acesso conforme políticas.
- Administração editorial mínima para cadastrar/revisar/publicar conteúdo (pode começar com Markdown/MDX versionado e importador, desde que a publicação seja operável).
- Métricas mínimas: page_view, study_opened, premium_preview, checkout_started, payment_approved, subscription_activated, subscription_canceled.
- Logs de erros, monitoramento básico e rotina de backup/restauração.

## 3.2 P1 — 7 a 30 dias

- IA contextual com RAG e fontes; franquia percentual e hard limits.
- Busca semântica por temas e conceitos além de referência bíblica.
- Anotações, marcações, favoritos e progresso de leitura sincronizados.
- Painel editorial completo com revisão e workflow de publicação.
- Comparação entre múltiplos autores e escolas, com documentação precisa.
- PWA instalável, cache de leitura e melhorias de offline.
- Funil de WhatsApp com segmentação e sequência consentida.
- Sistema editorial assistido por IA para preparar rascunhos de estudos que exigem revisão humana.
- A/B test de landing, paywall discreto e conversão.

## 3.3 P2 — 1 a 6 meses

- Cursos livres com professores parceiros, aulas, avaliações, certificação verificável e contratos de licenciamento.
- Linha do tempo dos concílios, história da Igreja, atlas e relações históricas.
- Estudo do hebraico/grego interlinear e análise morfológica, após validação de corpora/licenças.
- Editor de sermões e exportações.
- Comunidade moderada, grupos e trilhas colaborativas.
- Assinaturas familiares/institucionais.
- Expansão de nichos usando o mesmo SamJoE Core.

## 3.4 Regra de corte

Se o tempo ficar insuficiente, reduzir quantidade de conteúdo e complexidade do backoffice. **Nunca cortar:** segurança de pagamento, proteção premium no servidor, direitos de conteúdo, privacidade, capacidade de cancelar e caminho de suporte. Se não houver checkout validado, lançar beta gratuito com lista de espera em vez de cobrar por produto incompleto.

---

# 4. JORNADAS E EXPERIÊNCIA UX

## 4.1 Jornada A — leitor anônimo

1. Abre `/{livro}/{capitulo}` a partir de busca, Instagram ou indicação.
2. Visualiza texto, referência, barra de progresso simples, ajustes de fonte/contraste e navegação entre capítulos.
3. Encontra um bloco discreto após trecho relevante: “Por que essa passagem é interpretada de formas diferentes?”; o bloco **não cobre o texto**.
4. Abre estudo introdutório gratuito com ênfase no contexto.
5. Vê opção de explorar “originais”, “fontes históricas” ou “comparativo doutrinário” com amostra real, não um bloqueio total.
6. Caso escolha premium, visualiza o que será liberado e preço/periodicidade claros.
7. Pode voltar a ler sem fechar modal, sem perseguição comercial e sem perder posição.

**Regra:** não interromper leitura com modal automático, contador falso, gatilhos de culpa religiosa ou paywall inesperado.

## 4.2 Jornada B — comprador pelo WhatsApp

1. Anúncio / publicação abre conversa iniciada pelo próprio interessado com parâmetros de campanha.
2. Assistente comercial identifica o tema de interesse sem afirmar crenças religiosas pessoais que o usuário não declarou.
3. Oferece link direto para estudo gratuito específico com `utm_*`/`lead_id` opaco; link nunca expõe telefone ou credencial.
4. Após interação consentida, apresenta benefícios concretos e o checkout seguro por link assinado de curta duração.
5. Pagamento confirmado no backend; usuário recebe link de ativação por e-mail e, se permitido, mensagem pelo WhatsApp.
6. Acesso premium disponível imediatamente após confirmação de assinatura.
7. Possibilidade de recusa/opt-out e suporte humano.

## 4.3 Jornada C — estudo avançado

1. Lê passagem; toca em “Exegese”.
2. Visualiza contexto literário, histórico, textual, lexical e teológico, com limites da análise e fontes.
3. Abre interpretações divergentes em cartões organizados por escola e época.
4. Compara duas posições lado a lado sem atribuir citações fabricadas.
5. Vê obra, edição, tradução, capítulo/página ou identificador verificável, trecho permitido e link para fonte, quando disponível.
6. Salva estudo e retorna posteriormente.

## 4.4 Arquitetura de informação e rotas

- `/` — marketing, proposta de valor, demonstração, planos, CTA.
- `/biblia` — escolha de livro.
- `/biblia/:slug/:capitulo` — leitura.
- `/biblia/:slug/:capitulo/:versiculo` — âncora da passagem.
- `/estudos` — catálogo por assunto.
- `/estudos/:slug` — conteúdo editorial, flags free/premium.
- `/temas/:slug` — página temática com textos e obras relacionadas.
- `/autores/:slug` — biografia contextual e fontes autorizadas.
- `/comparar/:slug` — comparação histórica/doutrinária.
- `/planos` — preços e benefícios.
- `/checkout/:plan` — confirmação e redirecionamento seguro.
- `/entrar` e `/auth/callback` — login.
- `/minha-conta` e `/minha-assinatura` — conta e cobrança.
- `/privacidade`, `/termos`, `/direitos-autorais`, `/contato`.
- `/admin/*` — autenticação administrativa forte e autorização baseada em papéis.

## 4.5 Princípios de UI

- Mobile-first, responsiva, PWA-ready, tipografia confortável, line-height amplo, modo claro/escuro opcional.
- Hierarquia visual mínima e foco no texto. Jamais copiar interface ou identidade de Logos/Bíblia Raízes.
- Controles contextuais pequenos, acessíveis por toque e teclado.
- Indicadores premium discretos, sem popup automático.
- Velocidade percebida: exibir capítulo mesmo se IA/recomendações estiverem indisponíveis.
- Possibilidade de compartilhar link profundo para estudo/versículo.
- Acessibilidade WCAG 2.2 AA como meta: contraste, foco visível, sem dependência exclusiva de cor, `aria-label`, testes de navegação por teclado.
- SEO: páginas públicas SSR/prerender; título e descrição únicos, canonical, sitemap, dados estruturados adequados, Open Graph, sem indexar conteúdo privado.

---

# 5. REQUISITOS FUNCIONAIS

## RF-001 — Catálogo bíblico

Importação versionada de texto com `translation_id`, livro/capítulo/versículo, atribuição e registro jurídico da licença. Busca de referência deve aceitar `Rm 9:16`, `Romanos 9 16`, nomes completos e abreviações. Validar cânon inicial e preservar possibilidade futura de diferentes cânones, sem assumir que todos possuem a mesma lista de livros.

## RF-002 — Leitor

Navegação por capítulos, links para versículos, acessibilidade, renderização resiliente, URLs permanentes, leitura sem login; persistir posição local quando não autenticado e no servidor quando autenticado em fase posterior.

## RF-003 — Conteúdo editorial

Estudos têm título, resumo, tese/objetivo, escopo, texto-base, nível de profundidade, data de revisão, responsáveis, bibliografia, licença e status editorial. Exigir `draft → in_review → approved → published → archived`; publicação somente por editor autorizado. Separar blocos acessíveis ao gratuito e ao premium sem revelar material premium nos payloads públicos.

## RF-004 — Relacionamentos semânticos

Relacionar estudo↔passagem, estudo↔tema, estudo↔autor, autor↔obra, obra↔debate e debate↔tradição; registrar tipo de relação e nível de confiança/editorial. Recomendação inicial determinística baseada nas associações manuais. Embeddings são opcionais P1, não bloqueiam MVP.

## RF-005 — Exegese

Template: delimitação do texto, contexto literário, contexto histórico, análise textual quando necessária, termos originais quando licenciados e validados, estrutura argumentativa, paralelos canônicos, interpretações, limites e conclusão provisória. Proibir alegações sobre léxico grego/hebraico sem fontes válidas.

## RF-006 — Comparação doutrinária

Comparar tradições e escolas sem caricatura: questão, passagens relevantes, premissas, argumentos, documentos normativos, representantes, críticas e respostas, divergências internas, bibliografia. Distinguir resumo nosso de afirmação efetivamente encontrada na fonte.

## RF-007 — Autenticação

E-mail OTP/magic link via provedor maduro; não armazenar senha em texto; token de sessão seguro, `httpOnly`, `secure`, `sameSite`; expiração, logout e revogação; limitação de tentativas. Vinculação de WhatsApp à conta exige comprovação de posse/autorização, não confiar só no número fornecido na URL.

## RF-008 — Catálogo de planos

Planos configuráveis por versão: free, semanal, mensal e anual; preços iniciais são hipóteses e precisam de configuração administrativa. Cada plano tem `features`, limites, período, moeda, status, texto de oferta e política de renovação. A periodicidade semanal não deve ser apresentada como “mais barata por mês” quando o custo mensal equivalente for maior. Mostrar preço total e renovação.

## RF-009 — Pagamento e assinatura

Criar checkout via provedor suportado. Estado da assinatura `pending, active, grace, past_due, canceled, expired, refunded`; manter trilha de eventos. Aprovação somente por webhook validado + leitura server-side do recurso no provedor. Não confiar em retorno do navegador. Operações de cobrança idempotentes e auditáveis. Habilitar gestão/cancelamento e suporte.

## RF-010 — Entitlements

`canAccess(user, feature, resource)` no servidor. Planos pagantes não equivalem automaticamente a acesso irrestrito a todo conteúdo futuro: benefícios devem ser explícitos e versionados. Usuário gratuito pode ver previews estabelecidos no CMS sem recuperar HTML premium completo. Verificar em cada endpoint, não só na UI.

## RF-011 — WhatsApp comercial

Canal desacoplado por interface `MessagingProvider`; reaproveitar integração existente quando adequada. Serviços: aquisição, links de estudo, suporte, notificações opt-in e confirmação de compra. Política de IA/WhatsApp e consentimento revistos antes de ir ao ar. Nunca usar credenciais de assinatura pessoal de modelos LLM para processar solicitações dos assinantes.

## RF-012 — IA contextual (P1, com extensão preparada no MVP)

RAG sobre corpus curado; retrieval por IDs de fonte; chamadas por gateway de provedores comerciais autorizados; classificação de intenção e seleção de capacidades. Resposta deve distinguir citação literal, paráfrase e síntese; quando fontes não sustentarem resposta, dizer que não foi possível verificar. Ferramentas que escrevem dados requerem validação e autorização.

## RF-013 — Consumo proporcional

Franquia mensal exibida como percentual com hard limits. Custo ponderado por tokens/modelo/áudio/documentos e orçamento interno; meter por operação. Pré-reservar orçamento para chamadas caras, ajustar após custo real, impedir concorrência de gastos duplicados. Avisos graduais e upgrade explícito; sem surpresa de cobrança.

## RF-014 — Eventos e métricas

Cada evento deve ter idempotency_id, user_id pseudonimizado quando possível, timestamp, sessão/campanha/experimento, tipo, propriedades mínimas. Não enviar conteúdo bíblico lido, crenças inferidas ou consultas religiosas sensíveis para plataformas de anúncio por padrão.

## RF-015 — Administração e revisão

Permissões `owner, admin, editor, reviewer, support, user`. Separação entre redigir, aprovar e publicar quando equipe permitir; no MVP, a mesma pessoa pode acumular papéis com registro de autoria e aprovação. Audit log de alterações e versionamento.

## RF-016 — Comunicações

E-mails transacionais de login, compra, renovação, falha e cancelamento. Marketing apenas com base legal apropriada e opção de descadastro. Templates aprovados quando aplicável ao WhatsApp.

---

# 6. ARQUITETURA TÉCNICA

## 6.1 Princípio

Arquitetura **modular monolith primeiro**: núcleo bem organizado, serviços internos claros, sem microserviços prematuros. Preparar interfaces para extração posterior. Um único deployment web/API pode ser suficiente no MVP; tarefas assíncronas em fila quando necessário.

```text
Instagram / Google / Conteúdo orgânico
                 |
              Landing ─────> WhatsApp comercial já existente
                 |                     |
                 v                     v
          Web App / PWA  <────> API / Orchestrator
                 |                 |       |
                 |                 |       +── Billing Adapter ── Mercado Pago
                 |                 |       +── Messaging Adapter ─ WhatsApp API
                 |                 |       +── AI Gateway ────── LLM/API autorizado
                 |                 |                  |
                 |                 |                  +── MCP Client/Gateway
                 |                 |                          |
                 |                 |                   Content / Study Tools
                 v                 v
              Auth / DB / CMS / Bibliografia / Event store
                                    |
                             Jobs / Analytics
```

## 6.2 Stack de referência, adaptável ao repositório real

- **Front-end**: Next.js + TypeScript ou React/Vite, com renderização/indexação adequada; escolher aquilo que o repositório atual suportar. Não migrar uma base funcional só por preferência.
- **UI**: componentes acessíveis, CSS/Tailwind, tokens de design e temas.
- **Backend**: Cloudflare Workers com Hono/TypeScript **se** requisitos de execução, banco, sessões e bibliotecas forem compatíveis; caso contrário Node serverless compatível.
- **Banco canônico**: PostgreSQL/Supabase, especialmente se a organização já possui Supabase Pro, RLS, FTS e futuro `pgvector`. D1 pode servir a módulos específicos, mas evitar dois bancos de verdade sem necessidade.
- **Autenticação**: Supabase Auth ou equivalente confiável; não reinventar fluxo de e-mail.
- **Arquivos**: objeto privado (Supabase Storage/R2) para PDFs, fontes licenciadas, anexos de editor, materiais de cursos futuros.
- **Hospedagem**: Cloudflare Pages/Workers ou Vercel, conforme infraestrutura atual e custo total.
- **Pagamento**: adapter Mercado Pago para Brasil; avaliar assinaturas semanais/mensais/anuais, cartão, retentativas e Pix com regras específicas de recorrência; confirmar capacidades do produto escolhido antes da implementação.
- **Analytics**: eventos próprios + agregação; cookies e trackers só conforme consentimento e legislação aplicável.
- **Observabilidade**: logging estruturado, coleta de erros e alertas simples.
- **CI/CD**: GitHub Actions, lint/test/build/migrations, preview e produção separados.

**Critério de escolha:** menor prazo com segurança, usando componentes que o fundador já paga e domina. Evitar introduzir n8n só para uma chamada HTTP; usá-lo para fluxos assíncronos que realmente se beneficiem.

## 6.3 Organização sugerida do repositório

```text
/apps
  /web                   # leitor, landing, conta, premium e admin
  /api                   # rotas HTTP, webhooks, orchestrator
/packages
  /core                  # tipos, config, domain, errors
  /content               # corpus, reader, studies, sources
  /billing               # provider adapter, entitlements, ledger
  /identity              # auth, session, roles
  /messaging             # WhatsApp adapter, leads, campaigns
  /ai-gateway            # provider adapters, budgets, policies
  /mcp                   # capability catalog, schemas, tools
  /ui                    # design tokens and shared components
/infra                   # migrations, IaC/config examples
/content
  /studies               # fontes Markdown/MDX ou JSON editorial
  /authors
  /topics
  /translations          # metadados e manifestos de direitos
/scripts                  # importação, validação, SEO, seeds
/tests                    # e2e, integration, unit, security
/docs                     # arquitetura, decisões, runbooks
```

## 6.4 Multi-produto e multi-tenant sem exageros

O produto teológico funciona como **primeiro product_id** no SamJoE Core. Identidade e pagamentos podem ser compartilhados entre produtos; conteúdo e permissões continuam isolados por `product_id`. No MVP, não construir interface pública de criação de novos nichos; manter configurações versionadas em código/DB para evolução futura. Nunca permitir que `tenant_id`, `product_id` ou papel venham de input confiado sem checagem do token/ACL.

## 6.5 Camada de configuração

```yaml
product_id: theology
locale: pt-BR
entrypoint: /biblia
modules:
  reader: true
  studies: true
  doctrine_comparison: true
  historical_library: limited
  ai_chat: false # habilitar somente após qualidade e orçamento validados
channels:
  web: true
  whatsapp_sales: true
  whatsapp_study_bot: false
access:
  anonymous_reader: true
  premium_requires_subscription: true
```

---

# 7. MODELO DE DADOS — ENTIDADES CANÔNICAS

## 7.1 Identidade e produto

- `users(id, auth_subject, email, display_name, locale, created_at, deleted_at)`.
- `products(id, slug, brand_name, settings_json, status)`.
- `user_product_access(user_id, product_id, role, created_at)`.
- `preferences(user_id, product_id, font_scale, theme, notifications_json)`.
- `user_consents(id, user_id, purpose, channel, granted_at, revoked_at, source, policy_version)`.
- `audit_events(id, actor_id, action, object_type, object_id, timestamp, metadata_redacted)`.

## 7.2 Bíblia e fontes

- `translations(id, name, language, canon_id, license_type, license_url, commercial_use_allowed, source_manifest, attribution, verified_at)`.
- `canons(id, slug, name)`.
- `bible_books(id, canon_id, book_code, slug, order_no, chapters_count, display_name, aliases_json)`.
- `bible_verses(id, translation_id, book_code, chapter_no, verse_no, text, source_hash)`.
- `authors(id, slug, name, period_start, period_end, tradition_summary, biography, review_status)`.
- `works(id, author_id, title, original_language, work_date, rights_status, edition, translator, license_id, source_url)`.
- `sources(id, work_id, citation_locator, source_text_excerpt, excerpt_rights, primary_or_secondary, verified_by, verified_at)`.
- `doctrines(id, slug, name, scope_note, editorial_status)`.
- `traditions(id, slug, name, period, scope_note)`.
- `studies(id, slug, title, summary, body_ref_or_richtext, access_tier, status, reviewer_id, published_at, updated_at, version, reading_minutes, seo_json)`.
- `study_verses(study_id, book_code, chapter_from, verse_from, chapter_to, verse_to, relationship_type)`.
- `study_sources(study_id, source_id, usage_type, note)`.
- `study_topics(study_id, doctrine_id, relationship_type)`.
- `comparisons(id, slug, question, access_tier, status, reviewed_at)`.
- `comparison_positions(id, comparison_id, tradition_id, position_summary, supporting_sources_json, counterarguments_json)`.
- `related_content(id, from_type, from_id, to_type, to_id, relation, editorial_weight)`.

**Integridade:** chaves estrangeiras, índices por `slug`, `translation_id/book_code/chapter_no/verse_no`, `study/status/access_tier`, relações e buscas. FTS básico PostgreSQL e URLs indexáveis. Auditar todas as importações contra manifesto de direitos e hash.

## 7.3 Cobrança e acesso

- `plans(id, product_id, code, period_unit, period_count, price_minor, currency, capabilities_json, limits_json, provider_plan_id, status, effective_from)`.
- `subscriptions(id, user_id, product_id, plan_id, provider, provider_subscription_id, status, started_at, current_period_start, current_period_end, cancel_at_period_end, canceled_at, updated_at)`.
- `payments(id, subscription_id, provider_payment_id, amount_minor, currency, status, paid_at, raw_event_ref)`.
- `billing_events(id, provider_event_id UNIQUE, type, payload_hash, received_at, processed_at, result, retry_count)`.
- `entitlement_grants(id, user_id, product_id, feature, source_subscription_id, start_at, end_at)`.
- `checkout_sessions(id, user_id, plan_id, provider_reference, status, expires_at, created_at)`.

**Valores financeiros sempre em inteiros de centavos; UTC no banco e timezone do usuário no front.** Chaves do provedor nunca no cliente.

## 7.4 IA, chat e métricas (P1)

- `ai_requests(id, user_id, product_id, operation, model, input_tokens, output_tokens, estimated_cost_minor, actual_cost_minor, status, created_at)`.
- `usage_wallets(id, user_id, product_id, period_start, period_end, budget_units, spent_units, reserved_units)`.
- `usage_ledger(id, wallet_id, request_id, event_type, delta_units, created_at)`.
- `conversation_sessions(id, user_id, product_id, status, expires_at, summary_ref)`.
- `memory_items(id, user_id, product_id, kind, content_ref, importance, expires_at, created_at)`.
- `marketing_leads(id, campaign_ref, source, whatsapp_contact_ref_encrypted, status, consent_ref, created_at)`.
- `analytics_events(id, event_name, actor_pseudonym, product_id, session_id, occurred_at, campaign_json, properties_minimized)`.

**Não colocar texto religioso livre nem conteúdo sensível em logs de depuração ou analytics de anúncios.**

---

# 8. API — CONTRATOS MÍNIMOS

- `GET /api/v1/translations` — lista versões autorizadas.
- `GET /api/v1/books?translation=...` — lista livros.
- `GET /api/v1/bible/{book}/{chapter}?translation=...` — texto/atribuição e relações públicas.
- `GET /api/v1/studies?topic=&access=&page=` — catálogo público paginado.
- `GET /api/v1/studies/{slug}` — corpo gratuito ou premium conforme autorização; `403`/`402` de negócio com preview seguro quando sem acesso.
- `GET /api/v1/comparisons/{slug}` — conteúdo de comparação conforme entitlement.
- `POST /api/v1/auth/*` — delegar ao provedor de autenticação, com callbacks de segurança.
- `GET /api/v1/me` — perfil, funcionalidades e plano efetivo.
- `GET /api/v1/plans` — planos ativos e versão de preços.
- `POST /api/v1/checkout` — `{plan_code, return_url}`; sessão autenticada, checar plano e URL permitida.
- `POST /api/v1/webhooks/billing/{provider}` — validação de assinatura, reconsulta e idempotência.
- `GET /api/v1/subscription` — plano e período.
- `POST /api/v1/subscription/cancel` — cancelamento com semântica clara.
- `POST /api/v1/leads/whatsapp` — somente payload validado, consentimentos e origem.
- `GET /api/v1/admin/studies`, `POST /api/v1/admin/studies`, `PATCH /api/v1/admin/studies/{id}`, `POST /api/v1/admin/studies/{id}/submit`, `/approve`, `/publish` — RBAC e auditoria.
- P1: `POST /api/v1/ai/study-query`, `GET /api/v1/usage`, `GET /api/v1/ai/models-policy` interno.

**Contrato de erro padronizado:**

```json
{
  "error": {
    "code": "PREMIUM_ACCESS_REQUIRED",
    "message": "Este recurso está disponível em um plano de estudo.",
    "request_id": "req_..."
  }
}
```

**Exemplo de recurso público:**

```json
{
  "slug": "romanos-9-misericordia",
  "title": "Misericórdia e eleição em Romanos 9",
  "access": "free_preview",
  "status": "published",
  "summary": "Contexto e histórico das principais interpretações.",
  "sources_count": 5,
  "preview_blocks": ["context", "historical_question"],
  "premium_blocks_available": ["exegesis", "comparison", "bibliography"]
}
```

Documentar endpoints com OpenAPI/Zod schemas; paginação e rate limit nos recursos públicos.

---

# 9. PAGAMENTOS, OFERTAS E ECONOMIA

## 9.1 Planos propostos para teste, não preços definitivos

- **Free:** leitura e estudos introdutórios, páginas públicas, amostras premium.
- **Semanal:** janela curta de acesso premium; bom para estudo pontual. Preço experimental sugerido R$ 6,90–9,90 por semana, **a validar**.
- **Mensal:** estudo aprofundado recorrente; preço experimental R$ 19,90–29,90/mês, **a validar**.
- **Anual:** desconto frente à mensalidade equivalente; preço experimental R$ 119,90–199,90/ano, **a validar e compatibilizar com margem**.
- **Cursos futuros:** produtos avulsos e/ou pacote premium, sem prometer certificação ainda inexistente.

Não apresentar comparativos enganosos; mostrar total cobrado, periodicidade, renovação automática, política de cancelamento e qualquer período promocional com condições claras.

## 9.2 Gate de pagamento

1. Criar ordem/sessão com ID interno e plano versionado.
2. Redirecionar ao checkout oficial.
3. Receber callback/webhook validado e idempotente.
4. Reconsultar a transação do provedor para confirmação.
5. Persistir assinatura, pagamento, entitlement e evento de auditoria em transação consistente.
6. Enviar confirmação transacional sem incluir informações religiosas desnecessárias.
7. Em falha, registrar `past_due`, avisar e aplicar política explícita de grace period.
8. Em cancelamento, não renovar; preservar acesso já pago até o fim do período, salvo regra contratual válida.
9. Em estorno/refund, revogar acesso conforme política de pagamento e direitos do consumidor.
10. A compra nunca depende de “voltar à página de sucesso” para liberar acesso.

## 9.3 Critérios financeiros

- CAC pago por campanha e canal.
- Conversão `visitor→study_opened→checkout→paid`.
- ARPPU, receita bruta, receita líquida, reembolsos.
- Margem por assinante = receita líquida menos infraestrutura, pagamento, IA, suporte e conteúdo amortizado.
- Churn semanal/mensal, tempo para primeira leitura, leituras por semana, retenção D1/D7/D30.
- Taxa de upgrades free→paid e receita acumulada por coorte.
- Payback do CAC baseado em margem de contribuição, não no faturamento bruto.
- Faturamento anual antecipado não é automaticamente lucro nem receita mensal recorrente.

---

# 10. IA, CONTEXTO, MCP E SEGURANÇA DE AGENTES

## 10.1 Não transformar o produto em chat infinito

O principal é a **experiência editorial e pesquisa dirigida**. O usuário pede uma interpretação de um trecho ou compara um conjunto de fontes; o backend monta a tarefa com escopo delimitado. Chamadas gerais e abertas não serão padrão. Para o MVP, conteúdo curado pode atender ao usuário sem IA dinâmica e evita custos/erros.

## 10.2 Camadas

- **Intent Router:** reconhece `read_passage`, `explain_context`, `compare_views`, `find_source`, `save_note` etc.; pode usar regras antes de LLM.
- **Context Engine:** busca estado, passagem atual e fontes apropriadas. Contexto é efêmero, memória é persistente e dados factuais são estruturados.
- **AI Gateway:** política de modelo por tarefa, limite de tokens, custo e fallback; nunca depende de assinatura pessoal de um provedor.
- **MCP Gateway:** registro de ferramentas, escopos, autorização, schemas e auditoria; o LLM só enxerga ferramentas permitidas pelo recurso/plano/usuário.
- **Execution Layer:** valida parâmetros, chama operações determinísticas, controla efeitos colaterais e retorna resultados tipados.
- **Editorial QA:** avaliação de citações e fontes, não apenas fluência textual.

## 10.3 Catálogo de ferramentas MCP propostas

```text
bible.get_passage(reference, translation)
bible.find_cross_references(reference)
content.search_studies(query, access_scope)
content.get_study(study_id)
sources.search(query, author_ids?, work_ids?)
sources.get_verified_excerpt(source_id)
comparison.get_positions(topic_id, traditions[])
reader.get_current_position()
notes.create(note_text, reference)        # autenticação e confirmação
usage.get_remaining_budget()
subscription.get_entitlements()
```

**Sem ferramentas genéricas de SQL nem execução livre de Bash no ambiente de produção.** MCP é protocolo de interface, não substitui autenticação, autorização, segurança do banco nem limitação de custo. O conjunto de ferramentas varia conforme escopos da requisição.

## 10.4 Contrato de resposta da IA

```json
{
  "answer": "...",
  "answer_kind": "source_grounded_summary",
  "citations": [
    {
      "source_id": "src_123",
      "locator": "Livro X, seção 4",
      "mode": "paraphrase",
      "verified": true
    }
  ],
  "positions": [],
  "uncertainties": [],
  "quality_flags": []
}
```

**Restrições:** nunca gerar citações bibliográficas inexistentes; não simular fala de Agostinho/Calvino como declaração literal; rotular claramente diálogo didático fictício; distinguir datas e controvérsias; se fontes forem insuficientes, responder com incerteza. A IA não publica diretamente material editorial definitivo.

## 10.5 Hard limits e compactação

- Limite por requisição de entrada (ex.: teto operacional configurável), saída e número máximo de tool calls.
- Contexto inicial = referência atual + objetivo + 3–8 trechos relevantes **limitados por orçamento** + memória mínima consentida.
- Não enviar histórico inteiro. Compactar conversa quando necessário, preservando ponteiros para fontes e dados estruturados; resumos não substituem registros.
- Cache de estudos pré-processados por `study_version + passage + feature + locale`; invalidar em revisão editorial.
- Controle de custo por usuário/plano e global, com reserva de orçamento atômica antes da chamada.
- Percentual exibido ao usuário baseado em unidades ponderadas de consumo, não apenas quantidade de mensagens.
- Ao acabar a franquia, oferecer informações editoriais já publicadas e opção clara de upgrade; não bloquear a leitura gratuita.
- Proteção contra abuso, prompt injection em documentos recuperados, exfiltração via ferramentas e custos explosivos.

## 10.6 Política de uso de modelos

Desenvolvimento pessoal e testes locais podem utilizar ferramentas CLI conforme os termos do provedor. **Não encaminhar tarefas de consumidores usando credenciais individuais de assinatura pessoal.** Em produção, usar API autorizada ou inferência própria legalmente licenciada. Escolher modelo por métricas de qualidade/custo/latência; não supor que o mais barato tenha qualidade suficiente. Testar com conjunto de questões reais envolvendo exegese, contexto, termos originais, cronologia histórica, múltiplas tradições e checagem de fontes.

---

# 11. GOVERNANÇA EDITORIAL E DIREITOS

## 11.1 Pipeline editorial diário (após MVP)

1. Planejamento de pauta por demanda e relevância.
2. Mapeamento de passagens, bibliografia e direitos.
3. Rascunho editorial (pode ser assistido por IA).
4. Verificação de citações, passagens, datas, contexto e interpretação.
5. Revisão teológica humana, incluindo argumentos divergentes quando relevantes.
6. Aprovação, publicação versionada e registro de responsável.
7. Distribuição como estudo, recomendação contextual, link compartilhável e possível conteúdo social.
8. Revisão periódica e correções com changelog.

## 11.2 Padrões mínimos de um estudo

Campos obrigatórios: problema, texto-base, delimitação, contexto literário/histórico, interpretação principal, fontes verificadas, divergências quando materialmente relevantes, glossário se necessário, perguntas de aprofundamento, bibliografia, data e revisor. Se mencionar grego/hebraico, indicar termo original, transliteração, análise morfológica e referência léxica confiável (quando disponível).

## 11.3 Temas editoriais iniciais sugeridos

- Romanos 9 e graça/eleição.
- Isaías 53, 1 Pedro 2:24 e suas aplicações à cura e salvação.
- Efésios 6 e armadura de Deus: contexto literário e batalhas espirituais.
- Tiago 5 e oração pelos enfermos.
- João 15 e frutos, permanência em Cristo e contexto.
- Atos 15 e Concílio de Jerusalém.
- Justificação: Romanos/Gálatas e recepção histórica.
- Autoridade espiritual, cobertura pastoral e história dos movimentos contemporâneos.

A escolha final deve priorizar fontes verificáveis e evitar publicar conclusões pessoais como consenso acadêmico.

## 11.4 Direitos autorais

- Preferir texto bíblico cujo **uso comercial e exibição digital** sejam permitidos e comprovados; domínio público precisa ser avaliado por edição e tradução.
- Não assumir que Almeida Revista e Atualizada, Nova Almeida Atualizada, NVI ou ACF são livres para reprodução.
- Obras históricas podem estar em domínio público, mas traduções, notas, introduções e edições modernas podem ser protegidas.
- Registrar em `licenses` o detentor, fonte, comprovante, permissões, restrições de citações e data de verificação.
- Não publicar livros completos de terceiros sem autorização.
- Material de professores parceiros exige contrato para gravações, trechos, distribuição, edição, retirada e remuneração.

---

# 12. SEGURANÇA, PRIVACIDADE E COMPLIANCE

## 12.1 Dados religiosos sensíveis

Dados que revelem convicções religiosas ou associação a organização religiosa podem ser dados pessoais sensíveis pela LGPD. A plataforma não deve inferir e registrar religião/confissão a partir de leituras ou pesquisas, salvo finalidade legítima, necessidade e base legal adequada. Opt-in de marketing distinto das demais finalidades; política transparente, direitos do titular, retenção, descarte e revisão jurídica antes de expandir.

## 12.2 Requisitos

- Minimização de dados e retenção configurável.
- Criptografia em trânsito, armazenamento protegido, secrets fora do repositório.
- RBAC + políticas por recurso; testes para acesso cruzado/IDOR.
- Proteção contra SQL injection, XSS, CSRF quando aplicável, SSRF, open redirect e enumeração de contas.
- Sanitização de Markdown/HTML gerado.
- Webhooks verificados; idempotência e rate limiting.
- Logs mascarados sem tokens, números completos, históricos de leitura associados à pessoa ou mensagens sensíveis.
- Rotinas de exportação e exclusão de dados, inclusive retenções legais justificadas.
- Backups testados e possibilidade de rollback.
- Documentar suboperadores, DPA e transferência internacional quando aplicável.
- Administração com MFA onde possível.
- Banner de cookies somente se aplicável aos rastreadores usados, com preferência por analytics próprios minimizados.
- Políticas de WhatsApp e permissões para mensagens comerciais revisadas antes de campanha.
- Direitos do consumidor, cancelamentos e reembolsos exibidos claramente; revisar com profissional jurídico.

## 12.3 WhatsApp e IA

Os termos de WhatsApp Business Solution e Business Messaging são específicos e mudam. Há ressalvas e exceções jurisdicionais nos termos atuais, incluindo números brasileiros, mas não presumir permissão irrestrita para qualquer chatbot. **Projetar o WhatsApp como atendimento comercial sobre produto web, não como dependência única da experiência teológica.** Validar com assessoria e provedores as operações efetivamente permitidas, as janelas e templates e as regras de uso dos dados.

---

# 13. INFRAESTRUTURA, AMBIENTES E OPERAÇÃO

## 13.1 Ambientes

`local`, `preview/staging`, `production`; variáveis por ambiente, provedores com sandbox para pagamentos, DB isolado, contas de teste, feature flags e dados fictícios. Migrações reversíveis quando possível, com checklist pré-deploy.

## 13.2 Segurança de lançamento

- CI bloqueia lint, tipos e testes falhos.
- HTTPS, domínio, certificados e redirects corretos.
- Migrações aplicadas antes do deploy, testes de integridade.
- Verificar segurança de tokens de e-mail e links de pagamento.
- Conferir webhook com duplicação/reordenação simulada.
- Conferir revogação/cancelamento e período pago.
- Checar robots e sitemaps; `/admin` e conteúdo premium não indexados.
- Ter canal de suporte identificado e política de resposta.
- Testar em Android Chrome, iOS Safari e desktop.

## 13.3 Observabilidade e runbooks

Dashboards: disponibilidade, erro 5xx, webhooks pendentes, conversão, assinaturas, latência, APIs de terceiros e gastos com IA. Alertas de erro recorrente de pagamento e vazamento de custos. Runbooks para provedor indisponível, pagamento pendente, assinatura não ativada, rollback, remoção de conteúdo, solicitação de exclusão de dados e incidentes de segurança.

---

# 14. ESTRATÉGIA COMERCIAL E CRESCIMENTO

## 14.1 Pré-lançamento

Criar landing com proposta transparente, exemplo completo e formulário mínimo; preparar campanhas com objetivo rastreável. O WhatsApp comercial oferece demonstração e direciona ao app. Uma campanha por hipótese, preferencialmente começando em Instagram/Meta; jogos/apps são canal experimental posterior para não confundir grande volume de cliques com compradores.

## 14.2 Estrutura de oferta

- Uma amostra completa de exegese e um comparativo aberto demonstram qualidade.
- Botão discreto “Ver pesquisa completa” associado à intenção do usuário.
- Paywall somente quando uma ação premium for solicitada, com voltar à leitura facilmente.
- Oferta semanal para experimentação, mensal para hábito, anual para compromisso/desconto — **sem dark patterns**.
- Não declarar que cursos ou certificados já existem antes do lançamento.

## 14.3 Proposta de primeiros testes

- Criativo A: “O que realmente significa Isaías 53:5?”
- Criativo B: “Como Agostinho, Calvino e Wesley interpretam este tema?”
- Criativo C: “Estude a Bíblia com fontes, não só respostas prontas.”
- Cada peça remete a material relevante e real, não a uma landing genérica.
- Definir teto de campanha, stop-loss e critério de conversão: venda aprovada, não clique ou conversa.

## 14.4 Metas e gates

- Dia do MVP: jornada completa funcional, no mínimo um pagamento de teste aprovado e cancelamento testado.
- Até 7 dias: primeiros usuários reais, feedback de leitura, fricções e comparação de fontes de tráfego.
- Até 30 dias: primeira receita real, CAC por canal, conversão free→paid, ativação, custo de infraestrutura/IA por usuário e sinais de retenção.
- Escala só após margem de contribuição positiva por coorte e capacidade de suporte.

---

# 15. PLANO DE EXECUÇÃO — 17 A 20/11/2026

**Restrição conhecida:** quinta-feira, 19/11, há compromisso no evento da igreja. Não planejar tarefas críticas que dependam de presença contínua nesse dia. O fundador cogitou compensar com madrugada; a engenharia deve reduzir retrabalho e evitar publicar pagamentos/autenticação sem testes, independentemente das horas investidas.

## Terça 17/11 — Fundação e primeira leitura

- Inspecionar repositórios e infraestrutura existentes; **não reimplementar** módulos prontos.
- Congelar decisões de stack, schemas e infraestrutura em `/docs/ADR-001.md`.
- Criar migrations de `products, translations, verses, studies, sources, users, plans`.
- Importar tradução cuja licença foi validada e montar leitor mobile funcional.
- Montar design system e páginas `/`, `/biblia`, `/estudos`.
- Preparar fixture de 1 estudo premium e 1 gratuito (com revisão editorial).
- Testes rápidos de navegação e URL permanente.

**Entrega verificável:** visitante anônimo abre um capítulo e um estudo publicado, no celular.

## Quarta 18/11 — Conteúdo e monetização antecipada

- Completar navegação por livros/capítulos e blocos contextuais.
- Colocar no ar 5–10 estudos ou o menor conjunto de alta qualidade possível.
- Integrar Auth + plano/entitlement + checkout sandbox.
- Implementar webhook e teste automático de reentrada/duplicação.
- Conectar primeiro CTA do WhatsApp e rastreamento básico.
- Publicar termos e política de privacidade revisáveis.

**Entrega verificável:** fluxo completo de teste `cadastro→plano→checkout sandbox→ativação`.

## Quinta 19/11 — Dia de compromisso externo

- Sem tarefas críticas no caminho do lançamento.
- Opcional: revisão de textos e checklist de bugs pequenos, sem mexer em cobrança/segurança se cansado.
- CI e testes automatizados podem rodar sem acompanhamento ativo.

## Sexta 20/11 — Hardening e publicação

- Testar compra real controlada (baixo valor ou configuração aprovada), confirmação, cancelamento, pagamento negado, webhook duplicado, acesso sem login e acesso premium indevido.
- Testar iOS/Android/desktop, links, e-mail, domínio, SEO, suporte e backups.
- Revisar direitos de conteúdo e legibilidade da oferta.
- Deploy e smoke test em produção.
- Ativar campanhas apenas se os critérios de aceite forem cumpridos.

**Definição de pronto:** um desconhecido consegue abrir, ler algo útil, entender e experimentar o diferencial, comprar, receber acesso e gerenciar a assinatura sem apoio do fundador.

---

# 16. CRITÉRIOS DE ACEITE / QA

## A. Leitor

- [ ] Abre Bíblia gratuita sem autenticação.
- [ ] URL direta para um capítulo/versículo funciona e pode ser compartilhada.
- [ ] Não há popup durante leitura; aprofundamento depende de ação do usuário.
- [ ] Fonte, atribuição e informações de direitos são exibidas corretamente.
- [ ] Funciona em telas pequenas e com teclado/leitor de tela básico.

## B. Editorial

- [ ] Estudo sem fontes não pode ser marcado como academicamente verificado.
- [ ] Estudo premium não é retornado integralmente em endpoint anônimo.
- [ ] Comparação apresenta mais de uma interpretação quando o tema exige.
- [ ] Autores históricos nunca recebem citações inventadas.
- [ ] Toda publicação registra versão, autor/editor e data.

## C. Billing

- [ ] Checkout teste gera transação no provedor e acesso apenas após confirmação.
- [ ] Duplicar webhook não duplica pagamento nem acesso.
- [ ] Pagamento negado não libera premium.
- [ ] Cancelamento e expiração mudam entitlements corretamente.
- [ ] Planos e periodicidades exibem valores/renovação de modo inequívoco.
- [ ] Usuário encontra canal de suporte e termos.

## D. Segurança

- [ ] Acesso premium validado no servidor.
- [ ] Acesso cruzado entre contas é negado.
- [ ] Segredos não estão em repositório ou bundle web.
- [ ] Eventos e logs não contêm dados sensíveis desnecessários.
- [ ] Rate limits para login, checkout e endpoints vulneráveis.
- [ ] Backup/restauração mínima demonstrada.

## E. Comercial

- [ ] Link do WhatsApp abre a conversa correta, com origem rastreável sem dados pessoais em URL.
- [ ] Página gratuita apresenta valor real sem exigir compra.
- [ ] Evento `payment_approved` só dispara em confirmação efetiva.
- [ ] Atribuição de campanha permite distinguir lead, checkout e venda.

---

# 17. TESTES SUGERIDOS

**Unitários:** parser de referência bíblica; regras de entitlement; cálculo de período; limites de uso; sanitizador; escolha de conteúdo contextual; mapper de status do provedor.

**Integração:** conexão Auth→DB; checkout→webhook→entitlement; pagamento recusado; cancelamento; admin publicar→rota pública; IDs inválidos e falta de autorização.

**E2E:** visitante lê Romanos 9; abre comparativo; vê preview premium; cria conta; inicia compra sandbox; webhook confirma; reabre comparativo completo; cancela; suporte. Cenário negativo com usuário free tentando URL premium direta.

**Segurança:** IDOR de estudo privado e assinatura; injeção em busca; XSS em Markdown; manipulação de `plan_id` e preço; replay de webhook; acesso admin sem papel; enumeração de e-mail.

**IA P1:** 100 perguntas de referência histórica e exegese com gabarito editorial, checagem de fontes, custo e latência, taxa de respostas sem sustentação, resistência a prompt injection.

---

# 18. DECISÕES A SEREM TOMADAS PELO AGENTE DURANTE IMPLEMENTAÇÃO

O agente deve **inspecionar primeiro** a infraestrutura existente, identificar o que já está funcional e registrar as decisões seguintes no repositório, sem bloquear a entrega por perguntas desnecessárias:

1. Nome definitivo do produto: usar marca provisória e configuração (`PUBLIC_APP_NAME`), não hard-code.
2. Tradução bíblica: escolher apenas corpus com uso comercial documentado e fonte íntegra; se não houver, lançar demonstração de estudos com citações curtas autorizadas até regularizar licença.
3. Stack: manter ferramentas já instaladas/funcionais sempre que seguras.
4. Domínio: usar subdomínio configurável da SamJoE ou domínio provisório.
5. Provedor de pagamento: usar Mercado Pago ou outro já integrado; validar funcionalidade de recorrência semanal/mensal/anual antes de disponibilizar plano.
6. IA: **não bloquear MVP por chat dinâmico**; usar conteúdos revisados e interfaces de extensão.
7. Preços: valores são experimentais e parametrizáveis, não regras fixas de negócio.
8. Interface: criar design próprio minimalista, sem copiar competitor.
9. Profissionais/parcerias: preparar entidade futura, não prometer professores contratados.
10. SEO/social: verificar dados de teste/placeholder antes de indexar.

---

# 19. ORDEM DE EXECUÇÃO PARA O AGENTE LOCAL

**Instrução operacional:** execute de forma incremental, crie código e testes utilizáveis. Não produza apenas pseudocódigo ou um plano de implementação. Priorize qualidade do caminho crítico.

1. Inventarie o repositório, dependências, envs e componentes reaproveitáveis (sem revelar credenciais). Entregue relatório curto.
2. Proponha estrutura mínima de módulos e ADR; faça scaffold só do que falta.
3. Crie migrations e seeds legais/documentados.
4. Implemente leitor bíblico e páginas SEO.
5. Implemente CMS mínimo e estudos com fontes.
6. Implemente Auth + entitlements no servidor.
7. Implemente checkout sandbox + webhook seguro + cancelamento.
8. Faça integração leve de vendas com WhatsApp já existente.
9. Escreva e execute testes E2E e integração.
10. Entregue deploy reproduzível, scripts de rollback, README e checklist de produção.

**A cada marco:** reportar arquivos alterados, migrações, testes executados e resultados; não marcar feito sem evidência de execução. Se uma integração externa depender de credenciais, criar interface/config segura e registrar exatamente qual dependência impede o teste. Se houver impasse, entregar o restante funcional sem inventar que o pagamento está pronto.

**Definition of Done:** build limpa, testes críticos verdes, URL funcional, estudo gratuito real, preview premium, compra verificada, acesso habilitado/revogado corretamente, documentação de operação e fontes/licenças registradas.

---

# 20. MATRIZ DE RISCOS E CONTINGÊNCIAS

| Risco | Impacto | Mitigação |
|---|---|---|
| Prazo de 4 dias corridos com compromisso quinta | Alto | P0 reduzido, checkout iniciado quarta, feature flags |
| Licença do texto bíblico | Crítico | Corpus documentalmente autorizado; fallback para estudos e trechos permitidos |
| Webhook/entitlement incorreto | Crítico | Reconsulta provedor, idempotência, testes de status |
| Falta de conteúdo sério | Alto | 5–10 estudos bem revisados em vez de centenas artificiais |
| Alucinação bibliográfica da IA | Alto | IA não necessária para MVP; validação humana e citações estruturadas em P1 |
| CAC muito alto | Alto | Testes pequenos, criativos por estudo, medir compra aprovada |
| Regras WhatsApp para IA | Alto | WhatsApp para vendas e links; produto central web; revisão de termos |
| Dados religiosos sensíveis | Crítico | LGPD by design, minimização, controles de marketing |
| Cobrança semanal com churn alto | Médio/alto | Transparência de equivalência de preços, medir coortes, cancelamento simples |
| Escopo explode para cursos/comunidade | Alto | P2 explicitamente fora de MVP |
| Ausência de suporte operacional | Médio | Email/FAQ, eventos e processos de reembolso/cancelamento |

---

# 21. REFERÊNCIAS TÉCNICAS E REGULATÓRIAS A VALIDAR NA IMPLEMENTAÇÃO

1. MCP especificação 2026-07-28 — https://modelcontextprotocol.io/specification/2026-07-28
2. MCP Authorization — https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
3. Mercado Pago: visão geral de assinaturas — https://www.mercadopago.com.br/developers/pt/docs/subscriptions/overview
4. Mercado Pago: planos — https://www.mercadopago.com.br/developers/pt/docs/subscription-plans/overview
5. WhatsApp Business Solution Terms — https://www.whatsapp.com/legal/business-solution-terms/
6. WhatsApp Business Messaging Policy — https://whatsappbusiness.com/policy/
7. ANPD / LGPD FAQ — https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes
8. Sociedade Bíblica do Brasil — https://www.sbb.org.br/

**Aviso:** links são referências para verificação de condições atuais, não parecer jurídico nem autorização para reproduzir obras. Conferir políticas, taxas e licenças no dia da implementação.

---

# 22. CRITÉRIO ESTRATÉGICO FINAL

O MVP não é “um chat teológico”. É um **leitor bíblico com aprofundamento contextual integrado**, um pequeno acervo de estudos auditáveis e um fluxo completo de assinatura.

A arquitetura deve permitir crescer para biblioteca viva, comparador de doutrinas, ferramentas linguísticas, cursos e professores sem reescrever o Core. No entanto, abstrações futuras não podem impedir a venda e entrega de um produto real no primeiro lançamento.

**Meta da sexta:** uma pessoa que nunca ouviu falar da SamJoE encontra um estudo útil, experimenta o diferencial, compra um plano, acessa a pesquisa completa e gerencia a assinatura sem precisar de atendimento manual.

**Meta do mês:** medir vendas, custo por compra, qualidade, uso, margem e retenção — e só então acelerar o investimento em publicidade.
