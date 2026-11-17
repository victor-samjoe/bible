# Bloqueio da geração do APK

Verificação executada em 2026-11-17 (tarefa C12). A inspeção anterior não pôde
rodar porque o executor de comandos falhava; agora rodou, e o resultado está
abaixo. **Nenhum APK foi gerado, nenhuma conta foi criada, nada foi assinado nem
enviado a loja.**

## O que foi medido

| Pré-requisito | Resultado real |
| --- | --- |
| `java` / `javac` no PATH | resolvem para o stub `C:\Program Files\Common Files\Oracle\Java\javapath\`, que **falha ao executar** (sem saída, código de erro) |
| `JAVA_HOME` | definido como `C:\Program Files\Java\jdk-17`, mas **não existe `bin\java.exe` nesse caminho** — o JDK foi removido e a variável ficou apontando para o vazio |
| `gradle` | ausente |
| `adb` | ausente |
| `sdkmanager` | ausente |
| `ANDROID_HOME` / `ANDROID_SDK_ROOT` | ausentes |
| Android SDK em `%LOCALAPPDATA%\Android\Sdk` | ausente |
| `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` | ausentes de `node_modules` |
| `mobile/www` | ausente |
| `out/` (export estático) | ausente — `npm run build` produz `.next` |

Conclusão: **não há cadeia de build Android nesta máquina.** `Get-Command java`
retornar um caminho é enganoso: o stub existe, o JDK não.

## Bloqueio adicional, independente de ferramenta

O aplicativo tem rotas que exigem servidor e por isso **não** pode ser exportado
como site estático para dentro do Capacitor no estado atual:

- `app/biblia/page.tsx` e `app/biblia/[book]/[chapter]/page.tsx` — `force-dynamic`,
  porque leem o corpus no banco;
- `app/api/biblia/busca/route.ts` — endpoint de busca, também `force-dynamic`;
- `app/estudos/[slug]/page.tsx` e `app/temas/[slug]/page.tsx` — rotas por parâmetro.

Empacotar um `out/` estático hoje significaria um aplicativo sem leitura bíblica,
sem busca e sem autorização premium. A decisão de arquitetura (apontar o app para
a API publicada, ou separar um bundle offline com conteúdo licenciado) pertence ao
proprietário e ainda não foi tomada.

## Ordem para destravar, quando houver decisão

1. Instalar um JDK real (17 ou 21) e corrigir `JAVA_HOME`; conferir com
   `& "$env:JAVA_HOME\bin\java.exe" -version`.
2. Instalar Android Studio + SDK; definir `ANDROID_HOME`.
3. Decidir a estratégia de bundle para o Capacitor (ver `docs/MOBILE_RELEASE.md`).
4. Só então instalar `@capacitor/*` e rodar `cap add android`.
5. Resolver os ícones pendentes (PNG 192/512 maskable e apple-touch-icon 180) —
   sem eles o aplicativo não passa na revisão de loja.

Divergência a resolver antes de criar projeto nativo: `mobile/capacitor.config.json`
declara `appId: com.samjoe.bibliabereana`, enquanto `docs/MOBILE_RELEASE.md` cita
`com.samjoe.estudos`. O identificador é permanente na loja; precisa ser decidido
uma vez e corrigido nos dois lugares.
