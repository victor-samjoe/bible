# Entrega de e-mail transacional — Bíblia Bereana

**Status:** arquitetura definida, execução bloqueada em decisões do proprietário
**Atualizado em:** 2026-11-18
**Arquitetura de origem:** `E:\Sistema Juridico\docs\comercial\RUNBOOK_CONTA_AWS_E_AMAZON_SES.md`
**Tarefa de execução:** `tasks/auth/AUTH-E01-ses-smtp.md`

Neste documento, e-mail significa **somente mensagem automática de autenticação**: código de
acesso, confirmação de endereço, primeiro acesso e alteração de e-mail. Não inclui caixa postal da
equipe, Google Workspace, marketing ou atendimento humano.

## 1. Por que este documento existe

O leitor já está em produção em `https://bibliabereianos.com.br` com a frente de conta publicada e
ligada ao Supabase Auth. O login por código de 6 dígitos depende de um remetente. Hoje usa o
remetente embutido do Supabase, limitado a **2 mensagens por hora** (`rate_limit_email_sent: 2`),
o que serve para teste e não serve para abrir ao público.

A SamJoE já decidiu e documentou a arquitetura de envio no sistema jurídico. Este documento **não
inventa nada**: encaixa a Bíblia naquela estrutura e enumera o que falta.

## 2. A arquitetura herdada, com a Bíblia dentro

```text
Conta AWS de gerenciamento da proponente        (sem workloads, cobrança consolidada)
└── AWS Organization (all features)
    ├── sj-email-expatritax-prod   → SES → SMTP → Supabase da Expatritax
    ├── sj-email-biblia-prod       → SES → SMTP → Supabase samjoe-bible-mvp   ← ESTE PROJETO
    └── sj-email-[cliente]-prod    → SES → SMTP → Supabase desse cliente
```

Três regras herdadas do runbook, que valem aqui sem alteração:

- a conta de gerenciamento não recebe workload;
- cada produto/escritório tem **conta-membro própria**, para que credencial, reputação, limite ou
  suspensão de um não contamine os outros;
- credencial SMTP vive **somente no Dashboard do Supabase do projeto**, nunca no repositório,
  frontend, log, print ou documento.

### Decisão do proprietário em 18/11/2026: usar a conta AWS existente

A Bíblia **não** abre conta nova. O desenho de conta-membro acima foi escrito para vender o SaaS a
escritórios, onde separar cobrança e reputação por cliente é parte do produto. A Bíblia é produto
próprio da SamJoE, então usa a conta AWS que já existe.

O que **não** muda com isso, porque é o que de fato isola reputação: o remetente continua em
subdomínio exclusivo (`auth.bibliabereianos.com.br`) com DKIM próprio. Reputação de envio é por
domínio, não por conta AWS.

O que se aceita como risco, declarado: **limite de envio e suspensão do SES são por conta AWS e
região.** Se algum dia outro uso dentro dessa mesma conta gerar reclamação e a AWS suspender o
envio, o login do app para junto. Hoje nada mais envia por ali, então o risco é teórico.

Se um dia valer a pena separar, mover é barato: verificar o domínio na outra conta, gerar nova
credencial SMTP e colar no painel do Supabase. **Nenhuma linha de código muda.**

## 3. O que a Bíblia acrescenta à estrutura

Dois itens novos, que o proprietário levantou e este documento especifica.

### 3.1 Endereços de e-mail necessários

| Papel | Endereço | Quem controla | Para que serve |
| --- | --- | --- | --- |
| Conta-membro AWS | `aws+biblia@<domínio-da-proponente>` | proponente | login raiz da conta-membro; precisa ser único e receber de fato |
| Remetente do app | `nao-responda@auth.bibliabereianos.com.br` | SES | `From` dos códigos de acesso; não precisa receber |
| Contato de retorno | caixa real da proponente | proponente | `Reply-To` e rodapé; onde a pessoa responde se algo deu errado |
| Relatórios DMARC | `dmarc@<domínio-da-proponente>` | proponente | destino do `rua=` do DMARC |

O endereço da conta-membro **não pode** ser o e-mail da Expatritax nem o pessoal: é a regra da
seção 3 do runbook. Se o serviço corporativo aceitar alias com `+`, um endereço resolve.

### 3.2 DNS de e-mail na zona `bibliabereianos.com.br`

A zona está na Cloudflare e hoje tem **um único registro**. Nenhum MX, SPF, DKIM ou DMARC. Tudo
abaixo é novo, e o subdomínio de envio é exclusivo de autenticação — o ápice continua servindo o
Worker e **não recebe MX**, para não transformar o domínio do app em destino de e-mail por
acidente.

Subdomínio de envio: **`auth.bibliabereianos.com.br`**

| Nome | Tipo | Valor | Observação |
| --- | --- | --- | --- |
| `auth` | TXT | `v=spf1 include:amazonses.com ~all` | autoriza o SES a enviar pelo subdomínio |
| `<sel1>._domainkey.auth` | CNAME | `<sel1>.dkim.amazonses.com` | gerado pelo Easy DKIM do SES |
| `<sel2>._domainkey.auth` | CNAME | `<sel2>.dkim.amazonses.com` | idem |
| `<sel3>._domainkey.auth` | CNAME | `<sel3>.dkim.amazonses.com` | idem |
| `bounce.auth` | MX | `feedback-smtp.us-east-2.amazonses.com` (prioridade 10) | MAIL FROM próprio, para alinhar SPF ao DMARC |
| `bounce.auth` | TXT | `v=spf1 include:amazonses.com ~all` | exigido pelo MAIL FROM próprio |
| `_dmarc.auth` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@<domínio>; fo=1` | começa em `p=none`; endurecer depois de ler relatórios |

Dois detalhes que quebram a configuração se passarem batido:

- os três CNAME de DKIM precisam ficar **DNS only** na Cloudflare, sem nuvem laranja;
- os seletores (`<sel1..3>`) só existem depois de criar a identidade no SES — não há como
  pré-cadastrar.

Ordem de endurecimento do DMARC: `p=none` até os relatórios mostrarem só envio legítimo, depois
`p=quarantine`, depois `p=reject`. Pular para `reject` antes de validar derruba o login.

## 4. Lado Supabase

Projeto `samjoe-bible-mvp` (ref `exumjnikkrevlyublrfn`, `sa-east-1`).

| Campo do painel | Valor |
| --- | --- |
| Host | `email-smtp.us-east-2.amazonaws.com` |
| Porta | `587` (STARTTLS) |
| Usuário / senha | credencial **SMTP** do SES, que não é a access key da AWS |
| Sender e-mail | `nao-responda@auth.bibliabereianos.com.br` |
| Sender name | Bíblia Bereana |

A região é **us-east-2**, não `sa-east-1`: uma política da organização nega `ses:*` em todas as
outras regiões dessa conta. O e-mail não precisa estar na mesma região do banco.

Depois do SMTP configurado, dois ajustes em Authentication:

1. **Rate Limits:** o padrão com SMTP próprio é 30 e-mails/hora. Subir conforme a franquia do SES,
   nunca acima dela, lembrando que o sandbox limita a 200/dia.
2. **Email Templates:** há forte indício de que o plano free com remetente padrão **proíbe editar
   template** — foi o que provavelmente causou o `HTTP 400` da Management API em 18/11. Com SMTP
   próprio a edição deve destravar, e é ela que o atalho por link do e-mail precisa, porque o
   template atual usa `{{ .ConfirmationURL }}` em vez de
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink`.

## 5. Custo

Plano **Essentials**: US$ 0,16 por 1.000 mensagens, sem mensalidade. Contas novas entram nele desde
21/07/2026. O free tier específico do SES (3.000/mês por 12 meses) **fechou para novos clientes
nessa mesma data**; quem já estava nele mantém até o fim do período. Em troca, contas novas recebem
até US$ 200 em créditos do AWS Free Tier nos primeiros seis meses.

Dimensionando pelo uso real do app: 2.000 códigos de acesso por mês custam **US$ 0,32**. Dez mil
custam US$ 1,60. O planejamento comercial do jurídico reserva R$ 5/mês por conta, o que cobre isso
com folga.

Alertas de orçamento em US$ 1, US$ 5 e US$ 10, como manda o runbook. Nada de IP dedicado
(US$ 24,95/mês), EC2, Mail Manager ou Virtual Deliverability Manager.

## 6. Bloqueadores

Com a decisão de usar a conta AWS existente, a lista encurtou para três itens:

- [x] conta AWS — já existe, decisão de 18/11/2026;
- [ ] aprovar `auth.bibliabereianos.com.br` como subdomínio de envio;
- [ ] definir a caixa que recebe os relatórios DMARC;
- [ ] autorizar a escrita dos registros DNS na zona (é mudança ao ar).

Caiu daqui o que era exigência do modelo de revenda: e-mail corporativo novo, CNPJ da proponente,
AWS Organization e conta-membro. Esses itens continuam valendo para o sistema jurídico, em
`AUTH-003` de lá, não para a Bíblia.

Observação de custo que vale conferir no console: se essa conta AWS **já usava SES antes de
21/07/2026**, o free tier de 3.000 mensagens/mês pode ainda estar ativo até fechar os 12 meses.

Enquanto isso não existir, o login continua funcionando com o remetente embutido a 2/hora: honesto,
suficiente para teste, insuficiente para público.

## 7. Alternativa documentada, não recomendada como destino

Se a conta AWS não sair a tempo, um provedor com free tier (Resend, 100/dia) configura em minutos e
atende a Bíblia. Como para o Supabase o provedor é apenas host, porta, usuário e senha no painel,
trocar depois pelo SES é mudança de dois minutos, **sem tocar em uma linha de código**.

O que não se deve fazer é usar o Google Workspace da empresa como SMTP transacional: o remetente
teria de ser uma caixa humana, a cota é diária e um código marcado como spam contamina a reputação
do e-mail corporativo inteiro.

## 8. Estado real em 18/11/2026 — para quem pegar daqui (humano ou agente)

### Como autenticar

A credencial não está no repositório e não precisa estar. Ela vive no perfil do usuário da máquina:

```
profile:  samjoe-project        (arquivo ~/.aws/config)
região:   us-east-2             (única permitida nessa conta)
teste:    aws sts get-caller-identity --profile samjoe-project
expirou:  aws login --profile samjoe-project      <- precisa de console Windows real
```

O `aws login` abre o navegador e **não funciona pelo Git Bash** nem por comando sem terminal:
devolve `stdin is not a tty` ou `expecting a Windows console`. Rodar no PowerShell, em janela
normal. A sessão dura algumas horas e vale para qualquer ferramenta na máquina.

A conta é um "projeto" AWS de terceiro (não da pessoa jurídica que opera o produto), usada em
caráter temporário por decisão do proprietário em 18/11/2026, com migração prevista antes do
lançamento. **Sair do sandbox não migra**: na conta nova será preciso pedir de novo, recriar a
identidade, gerar novos tokens de DKIM e reescrever os registros de DNS.

### Restrição que surpreende

Uma Service Control Policy da organização **nega `ses:*` fora de us-east-2**:

```
AccessDeniedException ... explicit deny in a service control policy
```

Não insista em outra região: não é falta de permissão do papel, é política acima dele.

### O que já existe

Estado medido em 18/11/2026, depois de ligar o SMTP.

| Recurso | Estado |
| --- | --- |
| Identidade `auth.bibliabereianos.com.br` | criada, **verificada para envio** |
| Easy DKIM (RSA 2048) | **SUCCESS**, três CNAME publicados na Cloudflare, sem proxy |
| MAIL FROM `bounce.auth.bibliabereianos.com.br` | **SUCCESS**, com MX e SPF próprios |
| DMARC `_dmarc.auth` | `v=DMARC1; p=none; fo=1` — **sem `rua=`**, falta definir a caixa de relatórios |
| Usuário IAM `ses-smtp-biblia` | política inline `ses-send-only-biblia`, que só permite `SendEmail`/`SendRawEmail` **nessa identidade** |
| Chave de acesso do usuário IAM | uma, ativa, criada em 18/11 só para o SMTP |
| Saída do sandbox | **concedida** — caso `179502721300942`, plano Essentials, 50.000/dia e 14/s |
| SMTP no Supabase | **configurado** em 18/11 via Management API |
| Templates de e-mail | **em português**, com código de 6 dígitos e link `token_hash` |

### Como ficou o SMTP

| Campo | Valor |
| --- | --- |
| Host | `email-smtp.us-east-2.amazonaws.com` |
| Porta | `587`, STARTTLS |
| Usuário | access key do `ses-smtp-biblia` |
| Senha | derivada da secret key pelo algoritmo SigV4 do SES, **só existe no Supabase** |
| Remetente | `Biblia Bereana <nao-responda@auth.bibliabereianos.com.br>` |
| `smtp_max_frequency` | 60 s entre mensagens para o mesmo endereço |
| `rate_limit_email_sent` | 100 por hora, bem abaixo da cota do SES |

Três verificações feitas na hora, nesta ordem: `AUTH` aceito no endpoint com STARTTLS; mensagem
enviada e aceita para `success@simulator.amazonses.com`, que exercita identidade, MAIL FROM e
política do IAM sem tocar em caixa de ninguém; e leitura de volta da configuração confirmando os
campos gravados.

### O `400` dos templates, resolvido

A hipótese estava certa. Enquanto o projeto usava o remetente embutido, qualquer PATCH com
`mailer_templates_*` voltava `HTTP 400`. Com SMTP próprio configurado, o mesmo PATCH passou com
**200** e `mailer_templates_custom_contents` virou `true` para confirmação e magic link. Os dois
templates agora mostram `{{ .Token }}` em destaque — que é o caminho principal da interface — e
oferecem o link em `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=...`, nos tipos
que `src/server/auth/client.ts` aceita.

### O que ainda falta

1. **Caixa de relatórios DMARC.** O registro segue sem `rua=`, então ninguém recebe relatório de
   autenticação. Depende de o proprietário escolher o endereço.
2. **Endurecer o DMARC** para `quarantine` e depois `reject`, mas só depois de ler relatório de
   verdade — o que depende do item 1.
3. **Teste humano do fluxo completo**: pedir código em `/entrar` numa caixa real e conferir entrega,
   pasta de spam e o atalho por link.
4. **Limite de abuso compartilhado.** `src/server/auth/rate-limit.ts` é por isolate e em memória. O
   teto do Supabase em 100/hora segura o custo, mas não substitui limite global ou CAPTCHA antes de
   divulgar o site.

### Regra que não muda

Senha SMTP **somente** no Dashboard do Supabase. Nunca em `.env*`, repositório, log, print,
documento ou mensagem de chat. Rotacionar significa apagar a chave antiga no IAM e criar outra.
