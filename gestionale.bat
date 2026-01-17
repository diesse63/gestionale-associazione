@echo off
title Gestionale Pro - Server Locale
cd /d "C:\GitHub\Chiara"
echo Avvio del server in corso...
start http://localhost:3000
node server.js
pause