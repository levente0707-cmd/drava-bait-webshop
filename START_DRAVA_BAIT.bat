@echo off
cd /d "%~dp0"
if not exist node_modules npm install
start "" http://localhost:3000
start "" http://localhost:3000/admin
node server.js
pause
