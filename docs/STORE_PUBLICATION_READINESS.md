# Publicação oficial — SamJoE Estudos

Status em 2026-11-17. Este documento prepara decisões e evidências; não cria contas, não aceita contratos, não envia binários e não autoriza lançamento.

## Estado atual do repositório

| Item | Estado | Evidência / próximo passo |
| --- | --- | --- |
| Nome de apresentação | Pronto provisoriamente | `SamJoE Estudos` em `mobile/capacitor.config.json`. Confirmar disponibilidade nas lojas antes de registrar. |
| Identificador de pacote | Pronto provisoriamente | `com.samjoe.estudos`; não reutilizar nem mudar após publicar. Confirmar que pertence à SamJoE Tech & Consulting. |
| PWA | Em andamento | Há manifesto e suporte de instalação web; publicação HTTPS precisa ser confirmada. |
| Android nativo | Bloqueado | Não há projeto Capacitor Android, Android App Bundle (AAB) nem assinatura de release. |
| iOS nativo | Bloqueado | Não há projeto iOS, archive/IPA, assinatura Apple nem Mac/Xcode comprovados. |
| Política de privacidade | Bloqueado | Não existe página pública de política de privacidade no app/repositório. |
| Dados de privacidade | Bloqueado | Falta inventário aprovado de coleta, retenção, compartilhamento, conta e exclusão. |
| Monetização | Não aplicável ao lançamento atual | Não configurar cobrança até decisão comercial e revisão de regras das lojas. |

## Regra de titularidade

As duas contas devem ser criadas e mantidas pela **SamJoE Tech & Consulting**, com e-mail corporativo controlado pela empresa, recuperação em mais de uma pessoa autorizada e 2FA. O titular humano da conta deve registrar internamente a titularidade, acessos administrativos, e-mails de recuperação e datas de renovação. Não compartilhar senhas, certificados, chaves de assinatura, perfis de provisionamento ou tokens neste repositório, em chat ou em imagens.

## Google Play (Android)

### Depende do usuário / responsável empresarial

- Criar ou validar a conta Google Play Console da organização, concluir verificações de identidade/organização solicitadas pelo Google e aceitar os contratos aplicáveis.
- Definir e-mail público de suporte e contato de privacidade da SamJoE.
- Criar o registro do app com nome, idioma padrão, `com.samjoe.estudos`, classificação, público-alvo e contato.
- Aprovar texto e URL pública HTTPS da política de privacidade; ela deve mencionar SamJoE ou o app, dados coletados/usados/compartilhados, retenção, segurança e canal de contato.
- Preencher Data safety com base em inventário técnico e jurídico aprovado; se houver criação de conta, aprovar fluxo público de exclusão de conta e dados.
- Aprovar ícone, screenshots, descrição curta/completa, categoria, classificação indicativa e acesso de teste para revisão.

### Bloqueios técnicos antes de enviar

- Implementar e testar o aplicativo Android nativo; a loja recebe **AAB assinado de release**, não o APK de depuração.
- Criar chave de assinatura de release sob guarda corporativa e configurar assinatura/reprodutibilidade do build; nunca versionar a chave.
- Executar testes em dispositivos físicos e produzir build versionado (`versionCode`/`versionName`).
- Validar fluxo de autenticação, recuperação/exclusão de conta, links legais e conteúdo premium sem expor material protegido.

O Play Console exige política de privacidade acessível na ficha e no app; para apps com conta, há exigência de exclusão clara de conta. Consulte a documentação oficial de [política do programa](https://support.google.com/googleplay/android-developer/answer/18265346) e de [preparo para revisão](https://support.google.com/googleplay/android-developer/answer/9859455).

## Apple App Store (iPhone/iPad)

### Depende do usuário / responsável empresarial

- Inscrever a SamJoE no Apple Developer Program como organização e concluir verificação/contratos; o **Account Holder** deve ser uma pessoa autorizada pela empresa.
- Criar o app record no App Store Connect para o bundle ID corporativo e convidar equipe com menor privilégio necessário.
- Fornecer dados da página: nome, subtítulo, descrição, palavras-chave, suporte, marketing, ícone e screenshots por dispositivo suportado.
- Aprovar questionário de classificação etária, App Privacy (Privacy Nutrition Label), contato de revisão e informações de acesso/demonstração caso login seja obrigatório.
- Definir política de privacidade pública e condizente com o app e SDKs efetivamente usados.

### Bloqueios técnicos antes de enviar

- Preparar projeto iOS no macOS com Xcode, bundle ID confirmado, certificados, perfil de provisionamento e assinatura da equipe SamJoE.
- Gerar archive/IPA de distribuição, testar em dispositivos e enviar primeiro ao TestFlight. O IPA não pode ser produzido de modo confiável neste Windows sem a infraestrutura Apple.
- Corrigir qualquer falha de revisão/beta antes de submeter ao App Review.

O App Store Connect requer detalhes de privacidade para submissões e permite beta via TestFlight; confira [submissão](https://developer.apple.com/app-store/submitting/), [privacidade](https://developer.apple.com/app-store/app-privacy-details/) e [fluxo do App Store Connect](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow/).

## Dados que precisam de aprovação antes das lojas

1. Nome legal, CNPJ/endereço empresarial quando a loja solicitar, e contato de suporte/privacidade.
2. Inventário verdadeiro: autenticação Supabase, e-mail, identificadores, logs, analytics, cookies, pagamentos futuros e qualquer SDK de terceiros.
3. Finalidade, base/consentimento quando aplicável, retenção, operadores, transferência internacional e processo de exclusão/exportação.
4. Política de privacidade, termos de uso, aviso de análises com IA, atribuições da Bíblia Livre e política editorial.
5. Classificação etária e orientação de conteúdo religioso/estudos bíblicos; não declarar público infantil sem revisão específica.

## Gates de aprovação

Nenhuma pessoa ou automação publica sem os sete gates abaixo, todos registrados pelo responsável SamJoE:

1. Titularidade e contas corporativas confirmadas.
2. Identificador e marca aprovados.
3. Política de privacidade e inventário de dados aprovados.
4. Build nativo assinado e testado em dispositivo físico.
5. Metadados, screenshots, classificação e contatos revisados.
6. Acesso de revisão funcional, sem segredos expostos e com conteúdo/licenças verificados.
7. Aprovação explícita para TestFlight/faixa de teste e, separadamente, para lançamento público.

## Ordem recomendada

1. Publicar a PWA HTTPS e a política de privacidade.
2. O responsável SamJoE cria/valida as contas corporativas.
3. Fechar inventário de dados e metadados de loja.
4. Resolver os bloqueios Capacitor/build nativo.
5. Android: teste interno Play antes de produção. iOS: TestFlight antes de App Review.


---

## Revisão de 2026-11-17 (tarefa C12)

Checklist conferido contra o estado real do repositório e do build de produção.
Nenhuma conta foi criada, nenhum app assinado, nada enviado a loja.

### Itens que passaram a ter evidência

| Item | Estado |
| --- | --- |
| Manifest servido e válido | sim: `/manifest.webmanifest`, 200, `standalone`, `start_url` `/`, `lang` `pt-BR` |
| Service worker instalando | **sim, agora**: chega a `activated`; antes falhava por pré-cache de URL 404 (ver `docs/MOBILE_RELEASE.md`) |
| Shell offline | `/offline` pré-cacheado; navegação offline cai nele sem exibir texto bíblico |
| Cache sem dado pessoal ou premium | confirmado: só `/offline` e `/icon.svg` |
| Metadados do app | `applicationName`, `appleWebApp`, `formatDetection` e `manifest` definidos em `app/layout.tsx` |
| Leitura bíblica funcionando | sim, do corpus publicado: 66 livros / 1189 capítulos / 31102 versículos |
| Atribuição de licença visível | sim, no rodapé do leitor e em `/direitos-autorais` |

### Bloqueios que permanecem, em ordem de impedimento

1. **Ícones de loja ausentes** — PNG 192/512 `maskable` e apple-touch-icon 180.
   Sem eles, a instalação no Android fica com moldura branca e o atalho no iOS não
   usa ícone próprio. Depende de arte aprovada.
2. **Política de privacidade e canal de suporte** — ambos são texto-marcador.
   As duas lojas recusam publicação sem política específica e contato válido.
   É requisito legal, não técnico.
3. **Cadeia de build Android inexistente** — sem JDK funcional, sem SDK, sem
   Capacitor. Detalhes em `docs/APK_BLOCKER.md`.
4. **Estratégia de empacotamento não decidida** — o leitor e a busca são rotas de
   servidor (`force-dynamic`); não há export estático utilizável.
5. **Contas de desenvolvedor e assinatura** — fora do escopo desta frente por
   ordem explícita; exigem pagamento, identidade e chaves do proprietário.
6. **Nenhum teste em dispositivo real** — a validação foi em Chromium desktop.

### Observação de honestidade de catálogo

A ficha de loja não pode prometer NVI, NTLH ou Almeida: no produto elas aparecem
como "Em licenciamento", sem data, e nenhuma licença foi obtida. Qualquer texto
promocional que cite essas versões cria divergência entre a ficha e o aplicativo.
