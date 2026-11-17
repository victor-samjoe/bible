# Bloqueio da geração do APK

Em 2026-11-17, a inspeção dos pré-requisitos não pôde ser concluída: o executor de comandos falhou ao iniciar com `helper_unknown_error: setup refresh had errors`. Portanto, não foi possível verificar Android SDK, Java, Gradle, Capacitor ou a segurança do export estático, e nenhum APK foi gerado.

Após restaurar o executor, verificar na raiz do projeto:

```powershell
Get-Content docs/MOBILE_RELEASE.md
Get-Content package.json
Get-Command java, javac, gradle, adb, sdkmanager -ErrorAction SilentlyContinue
Get-ChildItem Env:ANDROID_HOME,Env:ANDROID_SDK_ROOT,Env:JAVA_HOME -ErrorAction SilentlyContinue
Test-Path node_modules/@capacitor/core/package.json
Test-Path node_modules/@capacitor/cli/package.json
Test-Path "$env:LOCALAPPDATA\Android\Sdk"
```

Inspecionar também a configuração Next.js e as rotas para confirmar que o export estático é compatível antes de adicionar Capacitor ou compilar um APK debug.
