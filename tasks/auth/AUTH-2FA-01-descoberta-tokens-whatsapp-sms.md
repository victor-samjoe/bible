# AUTH-2FA-01 — Descoberta de envio de token por WhatsApp e SMS para 2FA

- **Status:** todo
- **Prioridade:** P1
- **Tipo:** **descoberta** — produz decisão documentada, não produz código nem contrato
- **Responsável:** agente para pesquisa e modelagem de custo; Victor para decisão e contratação
- **Macro-item:** `P3-03` de `docs/PRODUCT_MVP_BACKLOG.md`
- **Depende de:** nada técnico. Pode começar antes de `AUTH-E01`
- **Relacionado:** `docs/EMAIL_DELIVERY_ARCHITECTURE.md`, `tasks/auth/AUTH-E01-ses-smtp.md`
- **Atualizado em:** 2026-11-18

## Objetivo

Descobrir, com números e fontes verificáveis, como entregar token de segunda etapa por **WhatsApp**
e por **SMS** no Brasil: quais provedores servem, o que cada um exige de conformidade, quanto custa
por 1.000 autenticações e qual a taxa de entrega esperada. Terminar com uma recomendação que o
proprietário aprova ou rejeita.

Esta tarefa **não** escolhe provedor, não contrata, não envia mensagem, não guarda número de
telefone e não escreve código de produção.

## Contexto

A frente de conta hoje é deliberadamente sem senha e **sem segunda etapa**, e as telas não prometem
2FA — `src/domain/app-navigation.ts` e `/acessos` falam só do que existe. O backlog, porém, tem
`P3-03` pedindo MFA real, e segunda etapa será necessária quando houver conteúdo pago e papéis
administrativos.

O que já existe na casa, e que esta descoberta precisa avaliar em vez de assumir:

- `samjoe-sales-engine`, no Cloudflare da SamJoE, dispara WhatsApp pela **Evolution API**
  (`EVOLUTION_API_KEY`, `EVOLUTION_API_URL`). É gateway **não oficial**.
- `.env.example` deste projeto já reserva `WHATSAPP_ENABLED`, `WHATSAPP_PROVIDER_URL` e
  `WHATSAPP_PROVIDER_TOKEN`, todos vazios.
- O sistema jurídico colocou SMS e WhatsApp explicitamente **fora do escopo** do `AUTH-003`. Ou
  seja: isto é terreno novo para a empresa inteira, e a decisão daqui deve servir aos dois produtos.

## Perguntas que a descoberta precisa responder

### Bloco 1 — WhatsApp, a pergunta que decide tudo

1. Entrega de OTP por WhatsApp exige a **WhatsApp Business Platform** (Cloud API da Meta) com
   template da categoria **authentication** aprovado? Qual o processo e o prazo de aprovação?
2. Gateway não oficial baseado em sessão de WhatsApp Web, como a Evolution API que a SamJoE já usa,
   é permitido pelos termos da Meta para OTP? **Qual o risco concreto de banimento do número** e
   qual o impacto se o número banido for o mesmo do atendimento comercial?
3. Qual o custo real por mensagem de autenticação no Brasil na Cloud API, incluindo a política de
   preço por categoria vigente, e se há franquia de mensagens de serviço.
4. Exige número dedicado? Exige verificação de empresa (Business Manager verificado)? Exige CNPJ?

### Bloco 2 — SMS

5. Quais provedores o Supabase Auth suporta nativamente para telefone, e o que exige o **Send SMS
   hook** para plugar provedor fora dessa lista.
6. Custo por SMS para o Brasil em pelo menos três provedores, com data da consulta.
7. Restrição de remetente no Brasil: alfanumérico é aceito? Precisa registro em operadora, short
   code ou cadastro prévio? Há regra da Anatel aplicável a mensagem transacional?
8. Taxa de entrega e latência esperadas, e o que acontece com número portado ou pré-pago sem
   crédito.

### Bloco 3 — A alternativa que não custa nada

9. Comparar com **TOTP** (app autenticador), que o Supabase MFA suporta e que não tem custo por
   mensagem nem dependência de operadora. Em que cenários SMS/WhatsApp ganham de TOTP, de verdade?
10. Se TOTP for o caminho principal, SMS ou WhatsApp servem como **recuperação** quando a pessoa
    perde o aparelho? Qual o risco de SIM swap nesse papel?

### Bloco 4 — Conformidade e dados pessoais

11. Número de telefone é dado pessoal sob a LGPD: qual base legal, por quanto tempo retém, como a
    pessoa remove, e o que muda no pedido de exclusão que `account_deletion_requests` já registra.
12. Onde o número ficaria armazenado, com qual RLS, e se entra em `profiles` ou em tabela própria.
13. O que o aviso de privacidade em `/privacidade` precisa passar a dizer.

### Bloco 5 — Abuso e custo descontrolado

14. Como impedir que bot queime franquia pedindo token: limite por número, por IP, por conta,
    CAPTCHA. Lembrar que o limitador atual (`src/server/auth/rate-limit.ts`) é **por isolate e em
    memória**, portanto não é global.
15. Qual o custo do pior cenário de abuso em 24 horas, por provedor, e se há teto configurável.

## Entregáveis

1. `docs/TWO_FACTOR_DELIVERY_RESEARCH.md` com: tabela comparativa (TOTP, SMS, WhatsApp oficial,
   WhatsApp não oficial), custo modelado por 1.000 autenticações, exigências de conformidade,
   riscos e uma recomendação única com justificativa.
2. Decisão registrada: o que o proprietário aprova, com data e responsável.
3. Se a recomendação for aceita, uma tarefa de implementação separada — esta aqui não implementa.

## Fora do escopo

- contratar provedor, criar conta, gerar credencial ou configurar painel;
- enviar mensagem de teste, para número próprio ou de terceiro;
- coletar, armazenar ou validar número de telefone;
- escrever código de produção, migration ou alteração de UI;
- prometer 2FA em qualquer tela antes da decisão aprovada — hoje `/acessos` e `/perfil` dizem a
  verdade, e a verdade é que não existe segunda etapa.

## Critérios de aceite

- [ ] **todo número tem fonte e data**: URL oficial do provedor e dia da consulta. Preço de
      mensagem muda e documento sem data envelhece calado;
- [ ] a pergunta do gateway não oficial está respondida com citação dos termos da Meta, não com
      opinião;
- [ ] o custo do pior cenário de abuso está modelado, não estimado por sensação;
- [ ] a comparação inclui TOTP, mesmo que a conclusão seja SMS ou WhatsApp;
- [ ] o impacto em LGPD e no fluxo de exclusão de conta está escrito;
- [ ] a recomendação é única e assumida, com o que se perde ao seguir por ela;
- [ ] nenhuma mensagem foi enviada e nenhum número de telefone foi guardado durante a descoberta.

## Risco que esta tarefa existe para evitar

Reaproveitar a Evolution API porque "já está pronta no sales-engine" e descobrir depois que o
número foi banido pela Meta por envio de OTP — levando embora, no mesmo banimento, o canal de
atendimento comercial. A economia aparente de um gateway não oficial pode custar o número
principal da empresa. É isso que a pergunta 2 precisa responder antes de qualquer linha de código.
