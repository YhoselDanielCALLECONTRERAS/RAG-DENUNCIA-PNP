"""
SistemaRAG · Denuncias Patrimoniales PNP — v2.0
Punto de entrada de la aplicación FastAPI.
Incluye autenticación JWT, pipeline RAG y transcripción de audio Whisper.
Autor: Tesis de Ingeniería - 2026
"""
from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.api.endpoints import router as rag_router
from app.api.auth import router as auth_router
from app.api.audio import router as audio_router
from app.services.vector_store import vector_store_service

# ── Configuración de logging ──────────────────────────────────────────────────

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)
settings = get_settings()


# ── Lifespan: inicialización y cierre ─────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestión del ciclo de vida de la aplicación.
    - Startup: inicializa el vector store (FAISS + embeddings)
    - Shutdown: limpia recursos
    """
    logger.info("=" * 65)
    logger.info(f"  {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info("  Sistema RAG + JWT + Whisper — PNP Perú 2026")
    logger.info("=" * 65)

    try:
        logger.info("🔄 Inicializando vector store...")
        vector_store_service.initialize()
        logger.info("✅ Vector store inicializado correctamente")
        if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("sk-your"):
            logger.info("ℹ️  Modo laboratorio activo: Inferencia jurídica heurística y búsqueda léxica sobre Código Penal")
    except Exception as e:
        logger.error(f"❌ Error inicializando vector store: {e}", exc_info=True)
        logger.warning("El sistema continuará con funcionalidades limitadas.")

    logger.info("🔐 Módulo JWT de autenticación PNP: activo")
    logger.info("🎙️  Módulo Whisper de transcripción: configurado")
    logger.info("🚀 API lista → http://localhost:8000/docs")
    yield

    # Shutdown
    logger.info("🛑 Cerrando servidor SistemaRAG PNP...")


# ── Instancia FastAPI ─────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    openapi_tags=[
        {
            "name": "Autenticación",
            "description": "Endpoints de login/logout JWT para personal PNP",
        },
        {
            "name": "RAG Pipeline",
            "description": "Análisis de relatos y categorización de delitos patrimoniales",
        },
        {
            "name": "Audio / Speech-to-Text",
            "description": "Transcripción de audio con OpenAI Whisper",
        },
    ],
)


# ── Middlewares ───────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"],
)


# ── Manejadores globales de errores ───────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        f"Excepción no controlada en {request.url}: {exc}",
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "Error interno del servidor. Por favor contacte al administrador.",
            "detail": str(exc) if settings.DEBUG else "Internal Server Error",
        },
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": str(exc),
        },
    )


# ── Incluir routers ───────────────────────────────────────────────────────────

app.include_router(auth_router)    # /api/v1/auth/login, /me, /logout
app.include_router(rag_router)     # /api/v1/analyze, /health, /metrics
app.include_router(audio_router)   # /api/v1/audio/transcribe


# ── Root endpoint ─────────────────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {
        "sistema": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "documentacion": "/docs",
        "endpoints": {
            "auth": "/api/v1/auth/login",
            "analyze": "/api/v1/analyze",
            "transcribe": "/api/v1/audio/transcribe",
            "health": "/api/v1/health",
        },
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info",
        access_log=True,
    )
