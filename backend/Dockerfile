# ─────────────────────────────────────────────────────────────────────────────
#  SistemaRAG · Denuncias Patrimoniales PNP (Tesis 2026)
#  Dockerfile Optimizado para Despliegue en la Nube (Render, Railway, Fly.io)
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim AS runner

# Metadatos del contenedor
LABEL maintainer="Tesis Ingenieria de Sistemas 2026"
LABEL description="Backend FastAPI + LangChain + RAG + Whisper PNP"
LABEL version="2.0.0"

# Optimización de entorno Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000 \
    ENVIRONMENT=production

# Dependencias mínimas del sistema operativo (libgomp para FAISS CPU, curl para healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Directorio de trabajo
WORKDIR /app

# Crear usuario de baja seguridad (no-root) para ejecución segura
RUN useradd --create-home --shell /bin/bash appuser

# Instalar dependencias Python (aprovecha la caché de capas Docker)
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copiar el código fuente de la aplicación
COPY app/ ./app/

# Crear directorios para persistencia de vector stores y datos temporales
RUN mkdir -p /app/data/chroma_db /app/data/corpus && \
    chown -R appuser:appuser /app

USER appuser

# Exponer puerto dinámico
EXPOSE 8000

# Healthcheck interno compatible con la nube
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/v1/health || exit 1

# Comando de arranque adaptativo: utiliza la variable $PORT inyectada por Render/Railway
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
