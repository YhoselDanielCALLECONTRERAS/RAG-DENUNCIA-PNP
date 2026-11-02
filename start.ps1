#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════════════════════
#  SistemaRAG · Denuncias Patrimoniales
#  Script de arranque completo para desarrollo local
#  Uso: Click derecho → "Ejecutar con PowerShell" o ejecutar desde VS Code
# ═══════════════════════════════════════════════════════════════════════════════

param(
    [switch]$SkipInstall,    # Omite instalación de dependencias
    [switch]$BackendOnly,    # Solo inicia el backend
    [switch]$FrontendOnly    # Solo inicia el frontend
)

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot
$BACKEND_DIR = Join-Path $ROOT "backend"
$FRONTEND_DIR = Join-Path $ROOT "frontend"
$VENV_PYTHON = Join-Path $BACKEND_DIR ".venv\Scripts\python.exe"
$VENV_PIP    = Join-Path $BACKEND_DIR ".venv\Scripts\pip.exe"
$VENV_UVICORN= Join-Path $BACKEND_DIR ".venv\Scripts\uvicorn.exe"
$ENV_FILE    = Join-Path $BACKEND_DIR ".env"

# Colores
function Write-Step($msg) { Write-Host "`n► $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red }

Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "  ║   SistemaRAG · Denuncias Patrimoniales v1.0.0       ║" -ForegroundColor Blue
Write-Host "  ║   Tesis de Ingeniería 2026                          ║" -ForegroundColor Blue
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# ── PASO 1: Verificar Python ───────────────────────────────────────────────────
Write-Step "Verificando Python..."
try {
    $pyVersion = python --version 2>&1
    Write-OK "Python encontrado: $pyVersion"
} catch {
    Write-Err "Python no está instalado o no está en PATH."
    Write-Host "  Descargue Python desde: https://python.org/downloads" -ForegroundColor Yellow
    Read-Host "Presione Enter para salir"
    exit 1
}

# ── PASO 2: Verificar .env ────────────────────────────────────────────────────
Write-Step "Verificando configuración (.env)..."
if (-not (Test-Path $ENV_FILE)) {
    $exampleEnv = Join-Path $ROOT ".env.example"
    if (Test-Path $exampleEnv) {
        Copy-Item $exampleEnv $ENV_FILE
        Write-Warn "Archivo .env creado desde .env.example"
    }
}

$envContent = Get-Content $ENV_FILE -Raw 2>$null
if ($envContent -match "OPENAI_API_KEY=sk-your") {
    Write-Host ""
    Write-Host "  ┌─────────────────────────────────────────────────────────┐" -ForegroundColor Yellow
    Write-Host "  │  ⚠️  OPENAI_API_KEY no configurada                       │" -ForegroundColor Yellow
    Write-Host "  │                                                         │" -ForegroundColor Yellow
    Write-Host "  │  Edite: backend\.env                                    │" -ForegroundColor Yellow
    Write-Host "  │  Línea: OPENAI_API_KEY=sk-tu-clave-aqui                 │" -ForegroundColor Yellow
    Write-Host "  │                                                         │" -ForegroundColor Yellow
    Write-Host "  │  El sistema iniciará pero el análisis RAG fallará       │" -ForegroundColor Yellow
    Write-Host "  └─────────────────────────────────────────────────────────┘" -ForegroundColor Yellow
    Write-Host ""
    Start-Sleep -Seconds 2
} else {
    Write-OK ".env configurado"
}

# ── PASO 3: Entorno virtual ───────────────────────────────────────────────────
Write-Step "Verificando entorno virtual Python..."
if (-not (Test-Path $VENV_PYTHON)) {
    Write-Host "  Creando entorno virtual..." -ForegroundColor Gray
    python -m venv (Join-Path $BACKEND_DIR ".venv")
    Write-OK "Entorno virtual creado"
} else {
    Write-OK "Entorno virtual encontrado"
}

# ── PASO 4: Instalar dependencias ─────────────────────────────────────────────
if (-not $SkipInstall) {
    Write-Step "Instalando dependencias Python..."
    Write-Host "  (Puede tardar 2-4 minutos la primera vez...)" -ForegroundColor Gray
    & $VENV_PIP install -r (Join-Path $BACKEND_DIR "requirements.txt") --quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Error instalando dependencias. Ejecute manualmente:"
        Write-Host "  cd backend && .venv\Scripts\pip install -r requirements.txt" -ForegroundColor Gray
        Read-Host "Presione Enter para continuar de todas formas"
    } else {
        Write-OK "Dependencias instaladas"
    }
}

# ── PASO 5: Iniciar backend ───────────────────────────────────────────────────
if (-not $FrontendOnly) {
    Write-Step "Iniciando Backend FastAPI en http://localhost:8000 ..."
    $backendProcess = Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoExit",
        "-Command",
        "Write-Host '  SistemaRAG Backend' -ForegroundColor Cyan; Write-Host '  http://localhost:8000' -ForegroundColor Green; Write-Host '  Swagger: http://localhost:8000/docs' -ForegroundColor Green; Write-Host ''; Set-Location '$BACKEND_DIR'; & '$VENV_UVICORN' app.main:app --reload --port 8000 --host 0.0.0.0"
    ) -PassThru
    Write-OK "Backend iniciado (PID: $($backendProcess.Id))"
    Start-Sleep -Seconds 3
}

# ── PASO 6: Iniciar frontend ──────────────────────────────────────────────────
if (-not $BackendOnly) {
    Write-Step "Iniciando Frontend en http://localhost:5500 ..."

    # Verificar si http-server está disponible via npx
    $npxAvailable = $null
    try { $npxAvailable = Get-Command npx -ErrorAction Stop } catch {}

    if ($npxAvailable) {
        $frontendProcess = Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-NoExit",
            "-Command",
            "Write-Host '  SistemaRAG Frontend' -ForegroundColor Cyan; Write-Host '  http://localhost:5500' -ForegroundColor Green; Write-Host ''; npx -y http-server '$FRONTEND_DIR' -p 5500 --cors -o"
        ) -PassThru
        Write-OK "Frontend iniciado (PID: $($frontendProcess.Id))"
    } else {
        # Fallback: servidor Python simple
        $frontendProcess = Start-Process -FilePath "powershell.exe" -ArgumentList @(
            "-NoExit",
            "-Command",
            "Write-Host '  SistemaRAG Frontend (Python server)' -ForegroundColor Cyan; Write-Host '  http://localhost:5500' -ForegroundColor Green; Write-Host ''; python -m http.server 5500 --directory '$FRONTEND_DIR'"
        ) -PassThru
        Write-OK "Frontend iniciado con Python (PID: $($frontendProcess.Id))"
        Start-Sleep -Seconds 2
        Start-Process "http://localhost:5500"
    }
}

# ── Resumen ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ┌──────────────────────────────────────────────────────────┐" -ForegroundColor Green
Write-Host "  │  ✅ SISTEMA LISTO                                         │" -ForegroundColor Green
Write-Host "  │                                                           │" -ForegroundColor Green
Write-Host "  │  🌐 Frontend:  http://localhost:5500                      │" -ForegroundColor Green
Write-Host "  │  ⚡ Backend:   http://localhost:8000                      │" -ForegroundColor Green
Write-Host "  │  📚 Swagger:   http://localhost:8000/docs                 │" -ForegroundColor Green
Write-Host "  │  💊 Health:    http://localhost:8000/api/v1/health        │" -ForegroundColor Green
Write-Host "  │                                                           │" -ForegroundColor Green
Write-Host "  │  Para cerrar: cierre las ventanas de terminal abiertas   │" -ForegroundColor Green
Write-Host "  └──────────────────────────────────────────────────────────┘" -ForegroundColor Green
Write-Host ""
