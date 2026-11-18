# AUTH-E01 — SES como SMTP do Supabase da Bíblia

- **Status:** todo
- **Prioridade:** P0
- **Responsável:** Victor para console AWS + agente para DNS, Supabase e testes
- **Macro-item:** `P3-01` de `docs/PRODUCT_MVP_BACKLOG.md`
- **Depende de:** aprovação do subdomínio de envio; autorização para escrever DNS na zona.
  **Não depende mais de abrir conta AWS**: decisão de 18/11/2026 é usar a conta existente
- **Arquitetura:** `docs/EMAIL_DELIVERY_ARCHITECTURE.md`
- **Equivalente no jurídico:** `E:\Sistema Juridico\tasks\auth\AUTH-003-smtp-confirmacao-email.md`
  (status `todo`, parado nos mesmos bloqueadores desde 27/08/2026)
- **Atualizado em:** 2026-11-18

## Objetivo

Substituir o remetente embutido do Supabase por envio transacional autenticado via Amazon SES, para
que o código de acesso de 6 dígitos deixe de depender de um teto de 2 mensagens por hora, e para
destravar a edição dos templates de e-mail.

## Contexto

A frente de conta está publicada em produção (commit `667b431`, versão de Worker
`a6423a92-f971-4d0b-8293-88296d957e1b`) e já lê as chaves do Supabase: `/entrar` serve o formulário
real e `/auth/callback` responde. O que falta para alguém logar de verdade não é código.

O provedor e a arquitetura **já foram decididos pela SamJoE** no sistema jurídico: Amazon SES por
uso, conta AWS de gerenciamento da proponente, AWS Organization e conta-membro por produto. A
Bíblia entra como `sj-email-biblia-prod`. Nada aqui escolhe provedor — apenas executa a escolha
existente.

Custo verificado em 18/11/2026: plano Essentials a US$ 0,16 por 1.000 mensagens, sem mensalidade.
O free tier específico do SES fechou para clientes novos em 21/07/2026 e foi substituído por até
US$ 200 em créditos do AWS Free Tier nos primeiros seis meses.

## Escopo

- configurar orçamento e alertas de gasto em US$ 1, US$ 5 e US$ 10 na conta AWS existente;
- criar a identidade de envio `auth.bibliabereianos.com.br` no SES da região escolhida;
- escrever na zona Cloudflare os registros SPF, três CNAME de DKIM, MX e TXT de MAIL FROM e DMARC
  em `p=none`, conforme a tabela de `docs/EMAIL_DELIVERY_ARCHITECTURE.md`;
- configurar MAIL FROM próprio em `bounce.auth.bibliabereianos.com.br`;
- solicitar a saída do sandbox do SES descrevendo o caso de uso real;
- criar credencial SMTP regional e guardá-la somente no Dashboard do Supabase;
- configurar SMTP no projeto `samjoe-bible-mvp` com autorização explícita;
- ajustar o rate limit de e-mail em Authentication, compatível com a franquia do SES;
- corrigir `site_url`, `uri_allow_list` e `mailer_otp_length` (ver "Pendência imediata");
- trocar os templates de confirmação e magic link para o formato `token_hash`;
- testar entrega, pasta de spam, bounce, link expirado, reenvio e cooldown;
- endurecer o DMARC para `quarantine` e depois `reject` após ler os relatórios;
- registrar evidências sanitizadas, volume e custo real em `docs/IMPLEMENTATION_LOG.md`.

## Fora do escopo

- e-mail de marketing, newsletter ou atendimento humano;
- caixa postal da equipe e Google Workspace;
- SMS e WhatsApp, que ficam em `AUTH-2FA-01`;
- Send Email Hook e fila própria de envio;
- IP dedicado, EC2, Mail Manager, Virtual Deliverability Manager ou qualquer add-on pago;
- gravar credencial SMTP em `.env*`, repositório, log, print ou nesta tarefa.

## Pendência imediata, que não depende do SES

Três campos do painel de Auth impedem o login hoje e podem ser corrigidos antes de qualquer conta
AWS existir:

| Campo | Valor em 18/11 | Valor correto |
| --- | --- | --- |
| `site_url` | `http://localhost:3000` | `https://bibliabereianos.com.br` |
| `uri_allow_list` | vazia | `https://bibliabereianos.com.br/auth/callback,http://localhost:3000/auth/callback` |
| `mailer_otp_length` | 8 | 6 |

A lista vazia faz o provedor recusar o `redirect_to` do app. O comprimento 8 não quebra a
verificação — o app não valida tamanho, só repassa ao provedor —, mas faz a tela mentir, porque
`src/domain/account-access.ts` promete seis dígitos.

Tentativa de corrigir pela Management API em 18/11 devolveu `HTTP 400`, com todos os campos válidos
contra o schema publicado. Hipótese principal: o plano free com remetente padrão recusa alteração de
template, e os dois campos de template iam no mesmo corpo. Um PATCH sem eles isola a causa.

## Dependências e pré-condições

- [x] provedor e modelo comercial definidos: Amazon SES por uso;
- [x] arquitetura definida: conta de gerenciamento + conta-membro por produto;
- [x] domínio da plataforma ativo e servindo produção;
- [x] projeto Supabase alvo confirmado: `samjoe-bible-mvp`, `exumjnikkrevlyublrfn`, `sa-east-1`;
- [x] conta AWS definida: a existente, por decisão de 18/11/2026;
- [x] `site_url`, `uri_allow_list` e `mailer_otp_length` corrigidos em 18/11/2026 (HTTP 200);
- [ ] caixa de relatórios DMARC definida;
- [ ] subdomínio `auth.bibliabereianos.com.br` aprovado;
- [ ] autorização para escrever DNS na zona;
- [ ] disponibilidade do SES em `sa-east-1` confirmada no console;
- [ ] proteção contra abuso de envio planejada (ver "Riscos").

## Plano de implementação

1. Victor abre a conta de gerenciamento, ativa MFA raiz e a AWS Organization, conforme o runbook do
   jurídico, sem compartilhar segredo algum.
2. Criar a conta-membro `sj-email-biblia-prod` com e-mail único da proponente e cobrança
   consolidada.
3. Configurar orçamento e alertas na conta-membro.
4. Criar a identidade de domínio no SES e coletar os três seletores de DKIM.
5. Escrever os registros na zona Cloudflare, com os CNAME em DNS only.
6. Configurar MAIL FROM próprio e aguardar a verificação do SES.
7. Solicitar saída do sandbox, descrevendo o fluxo de login por código.
8. Gerar credencial SMTP e guardá-la somente no Dashboard do Supabase.
9. Configurar SMTP no Supabase e ajustar o rate limit.
10. Corrigir `site_url`, `uri_allow_list`, `mailer_otp_length` e os dois templates.
11. Testar os fluxos com caixas de provedores distintos.
12. Ler relatórios DMARC e endurecer a política.
13. Registrar evidência, volume e custo real.

## Riscos e gates de segurança

- não desligar confirmação de e-mail para resolver problema de entrega;
- não expor host, usuário ou senha SMTP em print, log, task ou commit;
- bot consumindo a franquia: o limite por e-mail e por IP de `src/server/auth/rate-limit.ts` é por
  isolate e em memória, **não é global** — antes de abrir ao público, limite compartilhado ou
  CAPTCHA;
- não executar workload na conta de gerenciamento;
- não habilitar serviço AWS pago sem aprovação registrada;
- manter a mensagem de envio indistinguível entre e-mail com e sem conta, para não facilitar
  enumeração — a frase única já está em `ACCESS_CODE_SENT_NOTICE`;
- reputação: o remetente da Bíblia fica em subdomínio próprio, isolado do envio do jurídico.

## Critérios de aceite

- [ ] pedido de código em `/entrar` entrega o e-mail em prazo aceitável, em pelo menos dois
      provedores de caixa postal distintos;
- [ ] o código tem seis dígitos, igual ao que a tela promete;
- [ ] o atalho por link cai em `/auth/callback` e conclui a sessão, sem passar `token_hash` ao
      JavaScript da página;
- [ ] link inválido, expirado e reusado terminam em `/entrar?erro=link`, sem distinguir os casos;
- [ ] reenvio respeita cooldown e mostra mensagem compreensível;
- [ ] SPF, DKIM e DMARC válidos em ferramenta de verificação externa;
- [ ] rate limit do Supabase documentado e compatível com a franquia do SES;
- [ ] custo real do primeiro ciclo registrado;
- [ ] nenhuma credencial versionada, impressa ou colada em documento.

## Evidências e resultados reais

**2026-11-18 — estado inicial medido.** Produção publicada e lendo as chaves: `/entrar`,
`/criar-conta`, `/conta`, `/perfil` e `/acessos` em HTTP 200, sem o aviso de ambiente não
configurado; `/auth/callback` sem token devolve 303 para `/entrar?erro=link`. Banco em
`0006`, ledger com 7 migrations, RLS ativo em `profiles`. `auth.users` = 0.

Configuração de Auth lida na Management API: `site_url` em `http://localhost:3000`,
`uri_allow_list` vazia, `mailer_otp_length` 8, `rate_limit_email_sent` 2, templates com
`{{ .ConfirmationURL }}`. Projeto no plano **free**, criado em 12/11/2026.

Nenhuma conta AWS da proponente existe. O envio do sistema jurídico está desligado de propósito
(`smtp_user = "email-delivery-disabled"`), portanto **não há credencial a reaproveitar** — o que se
reaproveita é a arquitetura.
