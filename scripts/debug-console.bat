@echo off
cd /d "%~dp0\.."
cd app
echo === LLM MultiChat Debug Console ===
echo.
echo Aktuelles Verzeichnis: %cd%
echo.
echo Node.js Version:
node --version 2>nul || echo Node.js nicht gefunden!
echo.
echo npm Version:
npm --version 2>nul || echo npm nicht gefunden!
echo.
echo === Starte mit DevTools ===
echo.
npm start -- --dev
echo.
echo === Fertig ===
echo.
pause
