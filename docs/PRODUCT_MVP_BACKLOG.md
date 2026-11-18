# Bíblia Bereana — backlog de produto

## Norte do produto

O leitor é a tela principal. A área pessoal dá continuidade à leitura; materiais, estudos, análises e cursos aprofundam o texto sem competir com ele.

## Fase P1 — navegação e continuidade de leitura

| ID | Entrega | Dependência | Critério de aceite |
| --- | --- | --- | --- |
| P1-01 | App shell e menu lateral | Leitor C13 | Navegação responsiva para Início, Bíblia, Materiais, Notas, Estudos, Cursos, Planos e Perfil. |
| P1-02 | Página inicial pessoal | Auth + progresso | Resumo de capítulos lidos, sequência, retomar leitura e incentivo honesto; sem métricas inventadas. |
| P1-03 | Novidades | Fonte versionada | Lista de melhorias, versões, análises e traduções liberadas com data e status. |
| P1-04 | Biblioteca de notas | Auth + C5 | Notas, destaques e filtros por cor, capítulo e referência; isolamento por usuário. |
| P1-05 | Materiais e estudos | Catálogo editorial | Separar materiais de apoio, estudos e análises; status editorial, fontes e aviso de IA. |

## Fase P2 — cursos por tema

| ID | Entrega | Dependência | Critério de aceite |
| --- | --- | --- | --- |
| P2-01 | Modelo de curso/trilha | Banco/Auth | Tema → módulos → lições → leituras → progresso. |
| P2-02 | Catálogo de cursos | P2-01 | Filtros por tema/tradição/nível; sem prometer conteúdo não publicado. |
| P2-03 | Página de curso | P2-01 | Objetivo, sequência, leituras, estudos relacionados e progresso pessoal. |

## Fase P3 — conta e segurança

| ID | Entrega | Dependência | Critério de aceite |
| --- | --- | --- | --- |
| P3-01 | Login/cadastro/reset de senha | Supabase Auth configurado; entrega de e-mail em `tasks/auth/AUTH-E01-ses-smtp.md` | Fluxos reais de e-mail, erros seguros e sessão server-side. |
| P3-02 | Perfil | P3-01 + Storage | Nome, foto opcional, preferências e exclusão/exportação de dados. |
| P3-03 | 2FA | Descoberta em `tasks/auth/AUTH-2FA-01-descoberta-tokens-whatsapp-sms.md` + política | TOTP/MFA real, recuperação segura e testes de acesso. |

Login e cadastro já estão publicados e ligados ao Supabase Auth; o que falta em P3-01 é entrega de
e-mail própria, especificada em `docs/EMAIL_DELIVERY_ARCHITECTURE.md`. P3-03 não começa antes da
descoberta de canal aprovada: nenhuma tela promete segunda etapa hoje.

## Fase P4 — planos e checkout

| ID | Entrega | Dependência | Critério de aceite |
| --- | --- | --- | --- |
| P4-01 | Catálogo de planos | Decisão comercial | Benefícios, preço, renovação e cancelamento claros. |
| P4-02 | Provedor de cobrança | Escolha do operador | Checkout hospedado, webhooks verificados e nenhuma confiança em retorno do cliente. |
| P4-03 | Entitlements | P4-02 | Acesso premium calculado no servidor, auditoria de mudanças e cancelamento/reembolso. |

## Regras transversais

- Análises sempre informam apoio de IA, curadoria e possibilidade de erro.
- Conteúdo premium nunca é enviado antes de `canAccess` no servidor.
- Fotos, notas e progresso são privados por RLS e identidade autenticada.
- Materiais históricos e versões bíblicas só aparecem conforme direitos aprovados.
- Cada fase termina com testes, acessibilidade mobile e estados vazios/erro reais.
