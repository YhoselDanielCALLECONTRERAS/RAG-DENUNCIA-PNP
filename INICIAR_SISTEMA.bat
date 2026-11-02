@echo off
title SistemaRAG PNP - Servidor Local
chcp 65001 > nul
echo ===================================================
echo   Iniciando SistemaRAG PNP v2.0 (Localhost)
echo ===================================================
echo.

set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%backend
set FRONTEND_DIR=%ROOT_DIR%frontend

echo [1/2] Levantando Backend FastAPI (http://localhost:8000)...
start "Backend - FastAPI" cmd /k "cd /d "%BACKEND_DIR%" && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak > nul

echo [2/2] Levantando Frontend (http://localhost:5500)...
start "Frontend - Web Server" cmd /k "cd /d "%FRONTEND_DIR%" && python -m http.server 5500"

timeout /t 2 /nobreak > nul

echo.
echo Abriendo navegador para transcripcion en vivo de voz...
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    echo [Navegador] Abriendo en Google Chrome (Soporte optimo Web Speech)...
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" http://localhost:5500/login.html
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    echo [Navegador] Abriendo en Microsoft Edge...
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" http://localhost:5500/login.html
) else (
    echo [Navegador] Abriendo en navegador predeterminado...
    start http://localhost:5500/login.html
)

echo.
echo ===================================================
echo  Sistema iniciado correctamente.
echo  Frontend:  http://localhost:5500/login.html
echo  Backend:   http://localhost:8000/docs
echo  Usuario:   operador  ^|  Clave: pnp2026
echo ===================================================

