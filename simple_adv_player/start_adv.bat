@echo off
cd /d "%~dp0"

set SIMPLE_ADV_PORT=8770

start "Simple ADV Server" cmd /k "node tools\dev-server.mjs"

timeout /t 1 /nobreak >nul
start "" http://127.0.0.1:8770/editor/