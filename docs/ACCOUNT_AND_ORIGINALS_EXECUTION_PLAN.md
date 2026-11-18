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

## Sequência e delegação

1. Claude CLI: produzir desenho técnico e checklist executável para as duas
   frentes, sem alterar banco remoto, segredos ou deploy.
2. Revisão humana: aprovar as decisões de identidade, privacidade e licenças.
3. Implementar primeiro a infraestrutura local/testada; só então pedir uma
   autorização operacional separada para cada escrita no Supabase remoto.
4. Fazer deploy depois de testes e confirmação dos fluxos reais, nunca para
   simular conta ou original disponíveis.
