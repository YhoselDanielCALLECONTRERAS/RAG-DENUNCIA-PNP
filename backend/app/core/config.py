"""
Configuración central del sistema RAG - SistemaRAG PNP v2.0
Gestión de variables de entorno con Pydantic Settings v2
Incluye configuración JWT para autenticación del personal policial.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Configuración global de la aplicación."""

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Aplicación ────────────────────────────────────────────────────────────
    APP_NAME: str = "SistemaRAG · Denuncias Patrimoniales PNP"
    APP_VERSION: str = "2.0.0"
    APP_DESCRIPTION: str = (
        "Plataforma LLM+RAG para categorización y tabularización "
        "de relatos informales en denuncias por delitos contra el patrimonio"
    )
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = [
        "*",
        "https://*.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5500",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5500",
        "http://127.0.0.1:8000",
        "null",  # Para apertura directa de archivos HTML (file://)
    ]

    # ── JWT / Autenticación ───────────────────────────────────────────────────
    SECRET_KEY: str = "sistemarag-pnp-secret-key-2026-cambiar-en-produccion"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 horas (turno completo policial)

    # ── LLM Provider ─────────────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_TEMPERATURE: float = 0.1          # Baja temperatura → alta precisión
    LLM_MAX_TOKENS: int = 1024
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # ── ChromaDB ─────────────────────────────────────────────────────────────
    CHROMA_PERSIST_DIR: str = str(BASE_DIR / "data" / "chroma_db")
    CHROMA_COLLECTION_NAME: str = "codigo_penal_peruano"

    # ── RAG Pipeline ─────────────────────────────────────────────────────────
    TOP_K_RETRIEVAL: int = 3              # Fragmentos recuperados por consulta
    SIMILARITY_THRESHOLD: float = 0.35   # Umbral mínimo de similitud coseno
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 64

    # ── Dataset & Evaluación ─────────────────────────────────────────────────
    GOLD_STANDARD_PATH: str = str(BASE_DIR / "data" / "gold_standard_40.json")

    # ── Seguridad / Rate Limiting ─────────────────────────────────────────────
    MAX_INPUT_LENGTH: int = 2000          # Máx. caracteres por relato
    RATE_LIMIT_PER_MINUTE: int = 30


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Singleton cacheado de configuración."""
    return Settings()
