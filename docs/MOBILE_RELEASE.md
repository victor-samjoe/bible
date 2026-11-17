# Preparação para Android e iOS

Este diretório prepara a configuração mínima do Capacitor para uma etapa futura. Não há projeto nativo, APK ou IPA gerado. O contrato do MVP mantém o canal web como prioridade e não inclui aplicativo nativo na entrega de 19/11.

Um APK é um pacote Android e não roda no iPhone. A alternativa imediata para iOS é abrir a aplicação web publicada em HTTPS no Safari e usar Compartilhar → Adicionar à Tela de Início, quando disponível. Isso não gera um IPA; os recursos instaláveis e offline dependem da implementação e implantação da PWA, ainda não comprovadas aqui.

## Antes de empacotar

O projeto atual usa Next.js App Router e `npm run build` produz `.next`, não um diretório estático `out` pronto para o Capacitor. O Capacitor exige em `mobile/www` um bundle web compatível, com `index.html` na raiz. É necessária uma decisão e implementação futuras para produzir esse bundle e preservar as funções que dependem do servidor, incluindo autorização premium. Não copie `.next` para `www` nem inclua segredos ou conteúdo premium protegido no bundle. Sem esse bundle os comandos abaixo não entregam o aplicativo funcional. O `server.url` do Capacitor destina-se a live reload e não é uma solução de produção.

Confirme também o identificador `com.samjoe.estudos` e o nome em `mobile/capacitor.config.json` antes de criar os projetos nativos; são provisórios. Use versões compatíveis de Node.js, Capacitor 8 e SDKs conforme a [configuração oficial](https://capacitorjs.com/docs/getting-started/environment-setup). Os comandos assumem que o bundle validado já está em `mobile/www` e são executados a partir da raiz do repositório, exceto onde indicado. A instalação futura abaixo altera apenas `node_modules`, não os manifestos; não foi executada nesta preparação.

```sh
npm install --no-save --package-lock=false @capacitor/core@8 @capacitor/cli@8 @capacitor/android@8 @capacitor/ios@8
cd mobile
npx cap add android
npx cap sync android
```

Execute `cap add` uma única vez para cada plataforma; depois de atualizar o bundle, repita `cap sync`. Os projetos nativos criados devem ser revisados antes de versionar ou distribuir. Consulte o [guia do Capacitor](https://capacitorjs.com/docs/getting-started).

## APK Android para teste

Instale Android Studio, Android SDK e JDK compatíveis; configure o SDK no Android Studio. Com os comandos anteriores concluídos, em `mobile`:

```powershell
cd android
.\gradlew.bat assembleDebug
```

No macOS/Linux use `./gradlew assembleDebug`. O APK de debug esperado é `mobile/android/app/build/outputs/apk/debug/app-debug.apk`; ele é assinado com chave de debug e serve para testes, não para publicação. Para lançamento é necessária assinatura de release própria e revisão dos requisitos da loja. Veja a [documentação Android](https://capacitorjs.com/docs/android).

## IPA iOS

É necessário macOS com Xcode e ferramentas compatíveis, conta Apple Developer, equipe, certificado e perfil de provisionamento adequados. No Mac, após instalar as dependências e colocar o bundle validado em `mobile/www`, execute a partir de `mobile`:

```sh
npx cap add ios
npx cap sync ios
npx cap open ios
```

No Xcode selecione a equipe em Signing & Capabilities, configure assinatura e destino de distribuição e confirme o identificador. Depois, ainda em `mobile`, substitua `TEAM_ID` pelo identificador real da equipe e execute:

```sh
npx cap build ios --xcode-team-id TEAM_ID --xcode-export-method app-store-connect --xcode-signing-style automatic
```

O comando cria e exporta um IPA assinado para App Store Connect se a assinatura e o provisionamento estiverem corretos; consulte a saída do comando para localizar o arquivo. Para distribuição de testes fora da App Store, o método de exportação e o perfil devem corresponder à conta e aos dispositivos autorizados. Veja [iOS](https://capacitorjs.com/docs/ios) e [cap build](https://capacitorjs.com/docs/cli/commands/build).

---

## Validação de PWA executada em 2026-11-17 (tarefa C12)

Medido no build de produção (`next build` + `next start`), com navegador real em
`127.0.0.1` (contexto seguro, logo service worker habilitado). Nada foi publicado,
nenhuma conta criada, nenhum app assinado ou enviado a loja.

### Corrigido nesta validação

O service worker **não instalava**. Causa: `public/sw.js` pré-cacheava
`/apple-icon.svg` em `cache.addAll`, e essa URL respondia **404** — e um único 404
faz `addAll` rejeitar, derrubando a instalação inteira. O 404 acontecia porque o
Next **não gera rota de `apple-icon` a partir de SVG** (a convenção aceita `.png`,
`.jpg` e `.jpeg`); `app/apple-icon.svg` era um arquivo inerte, sem rota e sem
`<link>` no `<head>`.

Ações: a URL inexistente saiu de `STATIC_ASSETS` e da lista de ícones do manifest,
o cache foi para `samjoe-static-shell-v2` e `app/apple-icon.svg` foi removido. Isso
fecha o item B-02 de `docs/MVP_RELEASE_GATES.md`.

### Resultado medido depois da correção (15 de 15 checagens)

| Item | Resultado |
| --- | --- |
| `<link rel="manifest">` no `<head>` | presente, aponta `/manifest.webmanifest` |
| `/manifest.webmanifest` | 200, `application/manifest+json` |
| `display` / `start_url` / `lang` | `standalone` / `/` / `pt-BR` |
| `name` / `short_name` | "Bíblia Bereana" / "Bereana" |
| ícones do manifest | todos respondem 200 (hoje só `/icon.svg`) |
| service worker | registra e chega a `activated` |
| pré-cache | `/offline` e `/icon.svg` |
| conteúdo pessoal ou premium em cache | nenhum |
| navegação offline | cai no shell `/offline`, **sem exibir versículo** |
| requisições 4xx/5xx na carga | nenhuma |

### Pendências reais que seguem bloqueando loja e instalação completa

1. **Ícones.** Não existe PNG `192x192` nem `512x512`, nem variante
   `purpose: "maskable"`, nem apple-touch-icon PNG `180x180`. O Android exige
   maskable para instalação sem moldura branca; o iOS ignora SVG no atalho da tela
   de início. Rasterizar o `icon.svg` atual nesses tamanhos é mecânico, mas a
   margem de segurança do maskable é decisão de arte — não foi feita aqui.
2. **Política de privacidade.** `app/privacidade/page.tsx` continua texto-marcador
   e declara que "será completada". Google Play e App Store exigem política
   publicada e específica; `app/contato/page.tsx` ainda não publica e-mail de
   suporte.
3. **Cadeia de build Android.** Sem JDK funcional, sem SDK, sem Capacitor
   instalado. Ver `docs/APK_BLOCKER.md`.
4. **Estratégia de bundle.** O app depende de rotas de servidor (`force-dynamic`
   no leitor e na busca), então não há export estático utilizável hoje.
5. **Identificador do app.** `mobile/capacitor.config.json` usa
   `com.samjoe.bibliabereana` e este documento cita `com.samjoe.estudos`. Decidir
   uma vez e alinhar.
6. **Nenhuma evidência em dispositivo real.** A validação acima é em Chromium
   desktop; instalação em iPhone e Android ainda não foi demonstrada.
