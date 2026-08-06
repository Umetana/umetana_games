@echo off
cd /d "%~dp0"

start "" http://127.0.0.1:8770/editor/
set SIMPLE_ADV_PORT=8770
node tools\dev-server.mjs

pause
