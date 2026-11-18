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

A Bíblia é produto próprio da SamJoE, não escritório de cliente, mas recebe conta-membro pelo mesmo
motivo: isolar reputação. Um problema de entrega no jurídico não pode derrubar o login do app, nem
o contrário.

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
| `bounce.auth` | MX | `feedback-smtp.sa-east-1.amazonses.com` (prioridade 10) | MAIL FROM próprio, para alinhar SPF ao DMARC |
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
| Host | `email-smtp.sa-east-1.amazonaws.com` |
| Porta | `587` (STARTTLS) |
| Usuário / senha | credencial **SMTP** do SES, que não é a access key da AWS |
| Sender e-mail | `nao-responda@auth.bibliabereianos.com.br` |
| Sender name | Bíblia Bereana |

Confirmar no console que o SES está disponível em `sa-east-1`; se não estiver, `us-east-1` é a
alternativa e o host e o MX de bounce mudam de região junto.

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

### Do proprietário, herdados e ainda abertos desde 27/08/2026

- [ ] e-mail corporativo controlado pela proponente;
- [ ] razão social/CNPJ que operará e faturará;
- [ ] telefone corporativo e meio de pagamento;
- [ ] quem tem acesso ao e-mail e aos códigos de recuperação;
- [ ] conta AWS criada, MFA no usuário raiz, AWS Organization com `all features`.

### Específicos da Bíblia

- [ ] aprovar `auth.bibliabereianos.com.br` como subdomínio de envio;
- [ ] criar o endereço da conta-membro e a caixa de relatórios DMARC;
- [ ] autorizar a escrita dos registros DNS na zona (é mudança ao ar).

Enquanto isso não existir, o login continua funcionando com o remetente embutido a 2/hora: honesto,
suficiente para teste, insuficiente para público.

## 7. Alternativa documentada, não recomendada como destino

Se a conta AWS não sair a tempo, um provedor com free tier (Resend, 100/dia) configura em minutos e
atende a Bíblia. Como para o Supabase o provedor é apenas host, porta, usuário e senha no painel,
trocar depois pelo SES é mudança de dois minutos, **sem tocar em uma linha de código**.

O que não se deve fazer é usar o Google Workspace da empresa como SMTP transacional: o remetente
teria de ser uma caixa humana, a cota é diária e um código marcado como spam contamina a reputação
do e-mail corporativo inteiro.
