@echo off
set PATH=C:\Users\DELL\AppData\Local\nvm\v24.21.0;%PATH%
cd /d D:\workspace\PiGui
npx electron-vite dev > dev.log 2>&1
