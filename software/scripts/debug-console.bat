@echo off
cd /d "%~dp0\..\.."
cd software\app
echo === LLM MultiChat Debug Console ===
echo.
echo Aktuelles Verzeichnis: %cd%
echo.
echo Node.js Version:
node --version 2>nul || echo Node.js nicht gefunden!
echo.
echo === Starte mit DevTools ===
echo.
npx electron . --dev
echo.
echo === Fertig ===
echo.
pause
