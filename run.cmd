@echo off
set PATH=C:\Users\DELL\AppData\Local\nvm\v24.21.0;%PATH%
cd /d D:\workspace\PiGui
if not exist out\main\index.js (
  call npm run build || exit /b 1
)
start "" "node_modules\electron\dist\electron.exe" .
