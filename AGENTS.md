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
| DMARC em `_dmarc.auth` | `v=DMARC1; p=none; fo=1` |
| Usuário IAM `ses-smtp-biblia` | política inline `ses-send-only-biblia`, envio **só** por essa identidade |
| Chave de acesso desse usuário | **nenhuma**, de propósito |
| `site_url`, `uri_allow_list`, `mailer_otp_length` no Supabase | corrigidos em 18/11 (HTTP 200) |
| Frente de conta no app | publicada e lendo as chaves em produção |

Antes de criar qualquer coisa, confira o estado real:

```bash
aws sesv2 get-account --profile samjoe-project --region us-east-2
aws sesv2 get-email-identity --email-identity auth.bibliabereianos.com.br \
  --profile samjoe-project --region us-east-2
```

## 3. O que falta, nesta ordem

1. **Definir a caixa de relatórios DMARC** e acrescentar `rua=mailto:<endereço>` ao TXT de
   `_dmarc.auth.bibliabereianos.com.br`. Hoje o registro não tem `rua`, então ninguém recebe
   relatório.
2. **Pedir saída do sandbox** (`aws sesv2 put-account-details`). Decisão do operador, pendente desde
   18/11. O texto proposto está no histórico da frente; é declaração formal dentro da conta de
   terceiro, então não envie sem ordem explícita.
3. **Só depois:** gerar a chave de acesso do `ses-smtp-biblia`, derivar a senha SMTP e configurar o
   SMTP no Supabase (`email-smtp.us-east-2.amazonaws.com`, porta 587, STARTTLS).
4. Ajustar `rate_limit_email_sent` em Authentication → Rate Limits conforme a cota do SES.
5. Trocar os templates de e-mail para o formato `token_hash` — veja o item 5 abaixo.

## 4. Nunca faça

- **Não ligue o SMTP no Supabase enquanto a conta estiver em sandbox.** O site está no ar. Em
  sandbox o SES entrega **apenas** para endereços verificados um a um; trocar agora melhora o teste
  do operador e **quebra o login de qualquer visitante real**. O remetente embutido do Supabase, com
  seu teto de 2 e-mails/hora, ao menos entrega para todos.
- **Não grave senha SMTP em `.env*`, repositório, log, print, documento ou mensagem.** Ela vive
  somente no Dashboard do Supabase. Rotacionar significa apagar a chave no IAM e criar outra.
- **Não edite `.env*`** nem aplique migration remota sem ordem explícita — regra da fila.
- **Não desligue confirmação de e-mail** para resolver problema de entrega.
- **Não habilite serviço AWS pago** (IP dedicado, EC2, Mail Manager, Virtual Deliverability
  Manager) sem aprovação registrada.

## 5. Duas coisas que vão te confundir

**O `HTTP 400` da Management API do Supabase.** Alterar `mailer_templates_*` é recusado neste
projeto — plano free com remetente padrão. Confirmado por eliminação: o mesmo PATCH **sem** os
campos de template passou com 200. Então os templates continuam com `{{ .ConfirmationURL }}`, que
não entrega `token_hash` ao `/auth/callback` e faz o atalho por link cair em `/entrar?erro=link`. O
código digitado de 6 dígitos funciona. Com SMTP próprio a edição deve destravar.

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
Login por código de 6 dígitos **funciona**, limitado a 2 e-mails/hora pelo remetente embutido.
Banco Supabase `samjoe-bible-mvp` em `sa-east-1` com as 7 migrations aplicadas, RLS ativo em
`profiles` e gatilho de criação de perfil em `auth.users`. O Worker alcança o Postgres pela direct
connection — **não existe binding `HYPERDRIVE` e não é necessário**, provado em produção.

Não confunda as regiões: **banco em `sa-east-1`, e-mail em `us-east-2`**. É assim de propósito.
