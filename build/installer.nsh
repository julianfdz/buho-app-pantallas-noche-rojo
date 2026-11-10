; Instalador de Búho Noche · Buho Corps Systems
; Solo pone el CLI buho-noche (carpeta cli) en el PATH del usuario y lo quita al desinstalar. Todo en HKCU.

!macro customInstall
  nsExec::ExecToLog `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$$d='$INSTDIR\cli'; $$p=[Environment]::GetEnvironmentVariable('Path','User'); if(-not $$p){$$p=''}; if(($$p -split ';') -notcontains $$d){[Environment]::SetEnvironmentVariable('Path',(($$p.TrimEnd(';')+';'+$$d).TrimStart(';')),'User')}"`
  Pop $0
!macroend

!macro customUnInstall
  nsExec::ExecToLog `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$$d='$INSTDIR\cli'; $$p=[Environment]::GetEnvironmentVariable('Path','User'); if($$p){[Environment]::SetEnvironmentVariable('Path',(($$p -split ';' | Where-Object { $$_ -and $$_ -ne $$d }) -join ';'),'User')}"`
  Pop $0
!macroend
