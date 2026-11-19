@echo off
setlocal EnableExtensions

rem Sem argumento, abre um CMD independente desta sessao de agente.
if /I not "%~1"=="--run" (
  start "Biblia Bereana - deploy Cloudflare" cmd.exe /d /k call "%~f0" --run
  exit /b 0
)

title Biblia Bereana - deploy Cloudflare
cd /d "%~dp0"

echo.
echo ================================================================
echo   Biblia Bereana - publicacao no Cloudflare
echo ================================================================
echo Projeto: %CD%
echo.

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo ERRO: npm.cmd nao foi encontrado neste computador.
  echo Instale ou habilite o Node.js e tente novamente.
  goto :end
)

echo Iniciando build e deploy. Nao feche esta janela ate a conclusao.
echo.
call npm.cmd run deploy
set "DEPLOY_EXIT=%ERRORLEVEL%"

echo.
if "%DEPLOY_EXIT%"=="0" (
  echo ================================================================
  echo   Deploy concluido com sucesso.
  echo ================================================================
) else (
  echo ================================================================
  echo   Deploy terminou com erro. Codigo: %DEPLOY_EXIT%
  echo ================================================================
)

:end
echo.
echo Esta janela pode ser fechada quando terminar de revisar o resultado.
pause
exit /b %DEPLOY_EXIT%
