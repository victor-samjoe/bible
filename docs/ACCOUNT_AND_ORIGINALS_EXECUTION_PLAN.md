# Plano de execução — contas e idiomas originais

Status: planejado em 2026-11-17. Este plano separa as duas entregas porque
ambas escrevem no Supabase, mas têm autoridades diferentes: conta depende de
configuração de identidade; textos originais dependem de aprovação editorial e
de licença.

## Resultado esperado

1. Uma pessoa pode criar e acessar a própria conta por OTP/magic link, encerrar
   a sessão e solicitar exclusão da conta. Dados pessoais de leitura ficam
   acessíveis apenas ao próprio usuário.
2. O leitor exibe, para uma seleção, o hebraico do AT ou o grego do NT somente
   quando a edição correspondente estiver aprovada e importada. A interface
   identifica fonte e atribuição; não inventa glossa, tradução, Strong ou
   morfologia onde não houver ativo aprovado.

## Frente A — criação de contas e controle de acesso

### Pré-requisitos do proprietário

- Configurar URL pública e URLs de redirecionamento no Supabase Auth.
- Fornecer `SUPABASE_URL`, chave publicável e chave de servidor por secret de
  produção; nunca versionar nem registrar valores.
- Escolher o único método inicial: OTP/magic link por e-mail (sem senha).
- Confirmar política pública de privacidade, canal de suporte e fluxo de
  exclusão de conta antes de liberar cadastro.

### Implementação

1. Conferir o baseline remoto e aplicar `0003_reading_personal_data.sql` apenas
   depois de verificar que as tabelas e RLS não existem parcialmente.
2. Instalar e configurar o cliente Supabase por requisição, validando ambiente
   no servidor e falhando fechado se faltar configuração.
3. Implementar `/entrar`, `/criar-conta` e `/auth/callback`: pedir e-mail,
   solicitar OTP/magic link, confirmar retorno, renovar sessão e exibir erros
   neutros. Aplicar rate limit e não revelar se o e-mail existe.
4. Criar perfil no primeiro acesso por gatilho ou transação servidor-side;
   papéis são lidos da tabela confiável, nunca de cookie, formulário ou
   metadado editável no cliente.
5. Ligar notas, destaques, progresso e preferências às tabelas com RLS, com
   fallback local explícito para visitante.
6. Construir `/conta` para sessão, dados mínimos, sair e solicitar exclusão.
   Exclusão precisa revogar sessão e apagar/anonomizar dados conforme a decisão
   de retenção aprovada.

### Aceite

- Usuário anônimo não lê nem altera dados pessoais.
- Usuário A não lê nem altera registros de B, inclusive por chamada direta.
- Callback inválido, token vencido e configuração ausente falham sem vazar
  segredos ou existência de conta.
- Testes unitários, integração com RLS em banco descartável e E2E do fluxo OTP
  passam antes do deploy.

### Dados de infraestrutura que faltam

Registrado em 2026-11-18. A base de autenticação, cadastro e controle de acesso
está implementada e testada, e falha fechada: enquanto os itens abaixo não
existirem, `/entrar`, `/criar-conta`, `/conta`, `/perfil` e `/acessos` declaram a
indisponibilidade em vez de simular conta. Nada aqui é segredo: são os valores e
decisões que só o proprietário pode fornecer.

| Item | Onde | Sem ele |
| --- | --- | --- |
| `SUPABASE_PUBLISHABLE_KEY` (ou a legada `SUPABASE_ANON_KEY`) | `wrangler secret put` em produção; `.env.local` em desenvolvimento. Hoje vazia nos dois | Toda a frente fica `unconfigured`: nenhum e-mail sai, nenhum campo aceita digitação |
| `PUBLIC_SITE_URL` | Mesma origem pública do app, com `https` (ou `http://localhost:3000` em desenvolvimento). Variável nova, ainda não declarada em nenhum ambiente | O link do e-mail usa a Site URL do projeto Supabase em vez de `<origem>/auth/callback`; o código de 6 dígitos continua funcionando |
| Site URL e lista de redirecionamentos no painel Supabase Auth | Authentication → URL Configuration. Precisa conter `<origem>/auth/callback` | O provedor recusa o `redirect_to` e o link do e-mail não volta para o app |
| Provedor de e-mail e template com `token_hash` | Authentication → Providers (e-mail habilitado, senha desabilitada) e Email Templates com `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` | O código digitado funciona; o atalho por link não |
| Conexão Postgres no Worker: binding `HYPERDRIVE` em `wrangler.jsonc` ou `DATABASE_URL` no ambiente do Worker | `wrangler.jsonc` hoje não declara `HYPERDRIVE` | Papel e pedido de exclusão não podem ser lidos nem gravados: a sessão autenticada cai em `degraded`, sem conceder permissão alguma |
| Aplicação de `drizzle/0003_reading_personal_data.sql` e `drizzle/0006_account_access.sql`, depois de ler o baseline remoto | Supabase remoto. Nenhuma das duas foi aplicada | Sem `profiles` com RLS, sem gatilho de criação de perfil e sem `account_deletion_requests`, a conta autenticada permanece em `degraded` |
| Armazenamento compartilhado para limite de tentativas (KV, Durable Object ou tabela) | Cloudflare. Hoje o limite é por isolate, em memória | O limite por e-mail e por IP contém repetição no mesmo isolate, mas não é global; o teto efetivo passa a ser o do próprio Supabase |
| Política de retenção aprovada e canal de suporte publicado | Decisão do proprietário, com reflexo em `/privacidade` e `/contato` | O pedido de exclusão registra e revoga a sessão, mas a remoção dos dados não tem prazo nem responsável definidos |
| `SUPABASE_SECRET_KEY` | `wrangler secret put`. Vazia hoje | A exclusão definitiva do usuário no provedor (Admin API) continua manual; não é usada por nenhum código atual |

### Atualização 18/11/2026 — o que saiu da lista

A tabela acima é o estado de 18/11 pela manhã. Na mesma data, por ordem do
operador, foram resolvidos: a chave publicável (secret do Worker), a
`PUBLIC_SITE_URL` (var em `wrangler.jsonc`, `https://bibliabereianos.com.br`) e
a aplicação de `0003` e `0006` — `0003` já estava aplicada e o `drizzle-kit`
aplicou `0005` e `0006`, deixando o ledger em 7. A linha do **`HYPERDRIVE`
deixou de valer**: o Worker lê o Postgres pela direct connection, provado em
produção pela busca e pelo leitor. Continuam valendo as linhas de Site URL e
redirecionamentos, template de e-mail, limite de tentativas compartilhado,
política de retenção e `SUPABASE_SECRET_KEY`.

Entraram duas linhas novas: **`mailer_otp_length` está em 8**, e a interface
promete seis dígitos; e **`rate_limit_email_sent` é 2 por hora**, teto do e-mail
embutido do Supabase, que impede uso real sem SMTP próprio. Detalhes e o HTTP
400 da Management API estão em `docs/IMPLEMENTATION_LOG.md`.

Decisões tomadas nesta frente, para o proprietário confirmar ou reverter:

- **Método único:** código de 6 dígitos digitado no app, com o link do e-mail como
  atalho. O link é frágil por natureza — verificador de e-mail que faz pré-busca
  consome o token de uso único —, por isso não é o caminho principal.
- **Sem senha e sem duas etapas:** não há senha para vazar nem recuperação para
  sequestrar. Duas etapas não foi construída e as telas não a prometem.
- **Sessão em cookie `httpOnly`, `SameSite=Lax`, `Secure` fora de localhost**,
  com janela de inatividade de 7 dias. O cookie carrega os tokens do provedor e
  não é assinado por nós: não existe segredo próprio configurado e inventar um
  seria pior. A integridade vem do provedor, que valida o JWT a cada requisição.
- **Papel só de `profiles`**, lido no servidor. Papel fora do enum é tratado como
  ausência de papel, nunca como `reader`.
- **Exclusão é pedido registrado + revogação imediata da sessão**, não apagamento
  no clique, porque a política de retenção ainda não foi aprovada.

## Frente B — grego e hebraico

### Estado já verificado

- SBLGNT: 27 livros, 7.927 versículos e 137.542 tokens; checksum válido.
- MorphHB: 39 livros, 23.213 versículos, 306.785 tokens e 471.674 morfemas;
  checksum válido.
- Ambos continuam `collected_pending_human_approval`; isto não autoriza exibição.

### Decisões obrigatórias do proprietário/editor

1. Aprovar formalmente SBLGNT (grego, CC BY 4.0) e MorphHB/OSHB (hebraico e
   morfologia, CC BY 4.0/base WLC), incluindo atribuição publicada.
2. Designar a identidade editorial que assinará `approved_by` e a data de
   aprovação.
3. Confirmar que a reprodução integral no leitor atende as licenças e a política
   editorial. Nenhum léxico, glossa ou transliteração entra sem fonte própria.

### Implementação

1. Aplicar `0005_original_languages.sql` após backup e leitura do estado remoto;
   não usar `db:migrate` até o baseline remoto estar registrado.
2. Criar importador idempotente que recebe somente os manifestos verificados,
   registra edição, atribuição, checksum e proveniência, e grava versículos,
   tokens e morfemas em lotes transacionais.
3. Criar repositório/contrato server-side que consulta apenas edições
   `approved`, limita a referência solicitada e nunca entrega o corpus inteiro.
4. Ligar o painel “Consultar original” a esse contrato: AT retorna hebraico;
   NT retorna grego; inexistência ou edição não aprovada continua explicada.
5. Exibir fonte, licença e atribuição junto da consulta; não permitir exportação
   em massa por esta rota.

### Aceite

- Reexecutar importação não duplica linhas; checksum divergente bloqueia tudo.
- Seleção do AT não retorna grego e seleção do NT não retorna hebraico.
- Edição `collected`, `under_review` ou `blocked` não aparece publicamente.
- Consulta de referência retorna só os versículos selecionados e preserva tokens
  e morfemas da fonte.
- Testes de parser, importador, autorização e rota passam; validação em banco
  descartável ocorre antes de qualquer escrita remota.

### Tarefas do leitor de originais

| ID | Entrega | Dependência |
| --- | --- | --- |
| `ORIGINAL-READER-001` | Repositório/contrato de consulta por seleção, com limite de referência e atribuição da edição | Importador local validado |
| `ORIGINAL-READER-002` | Painel “Consultar original”: AT mostra hebraico e NT mostra grego apenas para edição aprovada | `ORIGINAL-READER-001` + aprovação editorial |
| `ORIGINAL-VERSIONS-001` | Ativar HEB (MorphHB) e GRC (SBLGNT) no seletor de versões, preservando indisponibilidade honesta até a aprovação | `ORIGINAL-READER-002` |

## Sequência e delegação

1. Claude CLI: produzir desenho técnico e checklist executável para as duas
   frentes, sem alterar banco remoto, segredos ou deploy.
2. Revisão humana: aprovar as decisões de identidade, privacidade e licenças.
3. Implementar primeiro a infraestrutura local/testada; só então pedir uma
   autorização operacional separada para cada escrita no Supabase remoto.
4. Fazer deploy depois de testes e confirmação dos fluxos reais, nunca para
   simular conta ou original disponíveis.
