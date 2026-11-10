@echo off
rem buho-noche: CLI de Buho Noche. Usa el propio ejecutable de la app en modo Node. Guia: buho-noche skill
setlocal
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0..\BuhoNoche.exe" "%~dp0buho-noche.mjs" %*
exit /b %ERRORLEVEL%
