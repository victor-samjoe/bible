# Orientação para agentes — frente de e-mail e autenticação

Escrito em 18/11/2026 pela sessão Claude Code que executou esta frente. Vale para qualquer agente
que pegar o assunto depois. **Não é regra geral do repositório** — a fila de execução continua
sendo `CLAUDE_MVP_EXECUTION_QUEUE.txt` e `docs/CLAUDE_MVP_EXECUTION_QUEUE.md`.

Se você for mexer em e-mail, login, SES, DNS ou 2FA: leia isto primeiro e economize meia hora.

---

## 1. Credencial AWS — onde está e como usar

Não está no repositório e não deve estar. Está no perfil do usuário da máquina.

```bash
profile:  samjoe-project          # ~/.aws/config
região:   us-east-2               # única permitida nesta conta
testar:   aws sts get-caller-identity --profile samjoe-project
```

Duas armadilhas, as duas já custaram tempo:

- **A sessão expira e só o humano renova.** `aws login --profile samjoe-project` abre o navegador e
  exige console Windows de verdade. Pelo Git Bash devolve
  `expecting a Windows console`; por comando sem terminal, `stdin is not a tty`. Não tente
  contornar: peça ao operador rodar no PowerShell, em janela normal.
- **Não existe outra região.** Uma Service Control Policy da organização nega `ses:*` fora de
  us-east-2 (`explicit deny in a service control policy`). Não é permissão do papel, é política
  acima dele. Insistir só gasta chamadas.

A conta é um projeto AWS de terceiro, em uso temporário por decisão do proprietário, com migração
prevista antes do lançamento. Quando migrar, **nada disso viaja**: identidade, DKIM, DNS e saída do
sandbox têm de ser refeitos na conta nova.

## 2. O que já está feito — não refaça

| Recurso | Estado |
| --- | --- |
| Identidade SES `auth.bibliabereianos.com.br` | criada e **verificada para envio** |
| Easy DKIM RSA 2048 | **SUCCESS** — três CNAME publicados na Cloudflare, sem proxy |
| MAIL FROM `bounce.auth.bibliabereianos.com.br` | **SUCCESS** — com MX e SPF próprios |
| Saída do sandbox | **concedida** — caso `179502721300942`, Essentials, 50.000/dia e 14/s |
| Usuário IAM `ses-smtp-biblia` | política inline `ses-send-only-biblia`, envio **só** por essa identidade |
| Chave de acesso desse usuário | **uma, ativa** — é a que o SMTP usa; não crie outra |
| SMTP do Supabase | **configurado em 18/11**, host `email-smtp.us-east-2.amazonaws.com:587` |
| Templates de confirmação e magic link | **em português**, com `{{ .Token }}` e link `token_hash` |
| `site_url`, `uri_allow_list`, `mailer_otp_length` | corrigidos em 18/11 |
| DMARC em `_dmarc.auth` | `v=DMARC1; p=none; fo=1` — ainda **sem `rua=`** |
| Frente de conta no app | publicada e lendo as chaves em produção |

Antes de criar qualquer coisa, confira o estado real:

```bash
aws sesv2 get-account --profile samjoe-project --region us-east-2
aws sesv2 get-email-identity --email-identity auth.bibliabereianos.com.br   --profile samjoe-project --region us-east-2
aws iam list-access-keys --user-name ses-smtp-biblia --profile samjoe-project
```

A última chamada deve devolver **exatamente uma** chave. Duas significa que alguém gerou outra sem
apagar a anterior — a antiga vira credencial órfã com permissão de envio.

## 3. O que falta, nesta ordem

1. **Definir a caixa de relatórios DMARC** e acrescentar `rua=mailto:<endereço>` ao TXT de
   `_dmarc.auth.bibliabereianos.com.br`. Hoje não há `rua`, então ninguém recebe relatório.
2. **Teste humano do fluxo**: pedir código em `/entrar` numa caixa real, conferir entrega, pasta de
   spam e o atalho por link. Só uma pessoa com caixa postal faz isso.
3. Depois de ler relatório DMARC de verdade, endurecer a política para `quarantine` e depois
   `reject`.
4. Antes de divulgar o site, limite de abuso compartilhado ou CAPTCHA — ver item 4 abaixo.

## 4. Nunca faça

- **Não gere outra chave de acesso para `ses-smtp-biblia` "para testar".** Já existe uma, em uso
  pelo Supabase, e a senha SMTP derivada dela não está em lugar nenhum fora do painel. Rotacionar
  é: criar a nova, gravar no Supabase, confirmar envio, **aí** apagar a antiga.
- **Não grave senha SMTP em `.env*`, repositório, log, print, documento ou mensagem.** Ela vive
  somente no Supabase.
- **Não confie no limitador atual contra abuso.** `src/server/auth/rate-limit.ts` é por isolate e
  em memória, portanto **não é global**. O teto de 100 e-mails/hora no Supabase segura o custo, não
  o abuso.
- **Não edite `.env*`** nem aplique migration remota sem ordem explícita — regra da fila.
- **Não desligue confirmação de e-mail** para resolver problema de entrega.
- **Não habilite serviço AWS pago** (IP dedicado, EC2, Mail Manager, Virtual Deliverability
  Manager) sem aprovação registrada.

## 5. Duas coisas que vão te confundir

**O `HTTP 400` da Management API do Supabase, que já foi resolvido.** Enquanto o projeto usava o
remetente embutido, qualquer PATCH com `mailer_templates_*` era recusado — plano free. Confirmado
por eliminação na época: o mesmo PATCH sem os campos de template passava com 200. Depois de
configurar SMTP próprio, o PATCH com templates passou com **200**. Se você vir esse 400 de novo,
verifique primeiro se o SMTP continua configurado.

**O "disparo de e-mail" do sistema jurídico não existe.** `E:\Sistema Juridico\src\lib\auth-email.ts`
registra que o projeto Supabase de produção está com `smtp_user = "email-delivery-disabled"` e que
nenhum e-mail de Auth sai em nenhum ambiente. O `AUTH-003` de lá está `todo` desde 27/08/2026 e
nunca houve conta AWS para aquele projeto. Não há credencial a reaproveitar; o que se reaproveita é
a arquitetura.

## 6. Onde está o resto

| Assunto | Arquivo |
| --- | --- |
| Arquitetura, DNS, custo, estado completo | `docs/EMAIL_DELIVERY_ARCHITECTURE.md` (seção 8 = estado real) |
| Tarefa de execução do SES | `tasks/auth/AUTH-E01-ses-smtp.md` |
| Descoberta de 2FA por WhatsApp/SMS | `tasks/auth/AUTH-2FA-01-descoberta-tokens-whatsapp-sms.md` |
| Histórico do que foi feito e por quê | `docs/IMPLEMENTATION_LOG.md` |
| Decisões de produto e fases | `docs/PRODUCT_MVP_BACKLOG.md` |

## 7. Estado do app, para contexto

Produção em `https://bibliabereianos.com.br`, servida por Worker Cloudflare (`samjoe-estudos`).
Login por código de 6 dígitos **funciona**, com envio próprio pelo Amazon SES (us-east-2) desde
18/11/2026, teto de 100 e-mails por hora no Supabase.
Banco Supabase `samjoe-bible-mvp` em `sa-east-1` com as 7 migrations aplicadas, RLS ativo em
`profiles` e gatilho de criação de perfil em `auth.users`. O Worker alcança o Postgres pela direct
connection — **não existe binding `HYPERDRIVE` e não é necessário**, provado em produção.

Não confunda as regiões: **banco em `sa-east-1`, e-mail em `us-east-2`**. É assim de propósito.
