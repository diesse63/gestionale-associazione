@echo off
color 0A
echo ========================================================
echo  SINCRONIZZAZIONE PROGETTO PER AI STUDIO
echo ========================================================

:: --- PERCORSI ---
:: La cartella dove sei ora
set "source=%~dp0"
:: Rimuove l'ultimo backslash per compatibilità con Robocopy
set "source=%source:~0,-1%"

:: La cartella di destinazione su Google Drive
:: NOTA: Se hai chiamato la cartella su Drive diversamente, modifica qui sotto
set "dest=G:\Il mio Drive\AI_Projects\GestionenaleDB_Mirror"

:: --- ESECUZIONE ---
echo Copia in corso da:
echo %source%
echo a:
echo %dest%
echo.

:: --- COMANDO ROBOCOPY ---
:: Cosa fa questo comando:
:: 1. Copia file .js, .json, .txt, .html, .css (il codice)
:: 2. /S  -> Copia anche le sottocartelle (public, ecc.)
:: 3. /XD -> ESCLUDE le cartelle pesanti (node_modules, .git) e quelle dei file caricati (archivio_files)
:: 4. /XF -> ESCLUDE il database (database.db) e file inutili
:: 5. /MIR -> Mirroring (se cancelli un file su C, lo toglie anche da G per tenerlo pulito)

robocopy "%source%" "%dest%" *.js *.json *.txt *.html *.css *.md /S /XD node_modules .git .vscode archivio_files documenti /XF database.db package-lock.json *.log .env

echo.
echo ========================================================
if %ERRORLEVEL% LEQ 8 (
    echo  SUCCESSO! File aggiornati su Google Drive.
    echo  Ora puoi selezionare la cartella "GestionenaleDB_Mirror"
    echo  da Google AI Studio.
) else (
    echo  ERRORE durante la copia.
)
echo ========================================================
timeout /t 5