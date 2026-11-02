"""
Endpoints de Audio/Voz — SistemaRAG PNP
Ruta: POST /api/v1/audio/transcribe
Integración con OpenAI Whisper para Speech-to-Text
"""
from __future__ import annotations

import io
import logging
import time
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.security import get_current_active_user
from app.models.schemas import TranscriptionResponse

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/v1/audio", tags=["Audio / Speech-to-Text"])

# Tipos MIME permitidos
ALLOWED_AUDIO_TYPES = {
    "audio/webm",
    "audio/webm;codecs=opus",
    "audio/ogg",
    "audio/ogg;codecs=opus",
    "audio/wav",
    "audio/mpeg",
    "audio/mp4",
    "audio/x-m4a",
    "application/octet-stream",  # Fallback para algunos navegadores
}

MAX_AUDIO_SIZE_MB = 25  # Límite de Whisper API
MAX_AUDIO_BYTES = MAX_AUDIO_SIZE_MB * 1024 * 1024


@router.post(
    "/transcribe",
    response_model=TranscriptionResponse,
    summary="Transcribir audio a texto con OpenAI Whisper",
    description=(
        "Recibe un archivo de audio grabado desde el navegador (WebM/OGG/WAV) "
        "y retorna la transcripción en español usando OpenAI Whisper. "
        "Requiere autenticación JWT."
    ),
    responses={
        200: {"description": "Transcripción completada"},
        400: {"description": "Formato de audio no soportado"},
        401: {"description": "No autorizado"},
        413: {"description": "Archivo demasiado grande (máx 25 MB)"},
        503: {"description": "Servicio Whisper no disponible"},
    },
)
async def transcribe_audio(
    audio: Annotated[UploadFile, File(description="Archivo de audio grabado (WebM/OGG/WAV)")],
    current_user: dict = Depends(get_current_active_user),
) -> TranscriptionResponse:
    """
    Transcripción de audio a texto usando OpenAI Whisper.

    **Flujo:**
    1. Validación del archivo (tipo MIME, tamaño)
    2. Envío a la API de Whisper (modelo `whisper-1`)
    3. Retorno de la transcripción en español
    4. El frontend puede usar el texto como entrada del pipeline RAG
    """
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("sk-your"):
        logger.info(f"OPENAI_API_KEY no configurada. Generando transcripción simulada de laboratorio para {current_user['username']}")
        return TranscriptionResponse(
            success=True,
            transcription="Ayer a las 9pm dos sujetos en moto me encañonaron con pistola y quitaron mi celular iPhone 14 en la avenida Brasil.",
            language="es",
            duration_seconds=4.2,
            latencia_ms=25.0,
            model="whisper-1-laboratorio-demo",
        )

    # Validar tipo MIME
    content_type = audio.content_type or "application/octet-stream"
    if content_type not in ALLOWED_AUDIO_TYPES:
        logger.warning(
            f"Tipo de audio rechazado: {content_type} "
            f"(usuario: {current_user['username']})"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de audio no soportado: {content_type}. "
                   f"Use WebM, OGG, WAV o MP3.",
        )

    # Leer contenido del archivo
    audio_bytes = await audio.read()

    # Validar tamaño
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Archivo demasiado grande ({len(audio_bytes) / 1024 / 1024:.1f} MB). "
                   f"Máximo permitido: {MAX_AUDIO_SIZE_MB} MB.",
        )

    if len(audio_bytes) < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archivo de audio vacío o demasiado corto. Intente grabar nuevamente.",
        )

    logger.info(
        f"Transcripción solicitada por {current_user['username']} — "
        f"archivo: {audio.filename}, tamaño: {len(audio_bytes) / 1024:.1f} KB, "
        f"tipo: {content_type}"
    )

    # ── Llamada a OpenAI Whisper ──────────────────────────────────────────────
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        start_time = time.monotonic()

        # Determinar extensión del archivo para Whisper
        ext_map = {
            "audio/webm": "webm",
            "audio/webm;codecs=opus": "webm",
            "audio/ogg": "ogg",
            "audio/ogg;codecs=opus": "ogg",
            "audio/wav": "wav",
            "audio/mpeg": "mp3",
            "audio/mp4": "mp4",
            "audio/x-m4a": "m4a",
        }
        extension = ext_map.get(content_type, "webm")
        filename_whisper = f"audio.{extension}"

        # Enviar a Whisper API
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename_whisper

        transcript = await client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename_whisper, audio_file, content_type),
            language="es",
            response_format="verbose_json",
            prompt=(
                "Transcripción de una denuncia policial peruana. "
                "Incluye términos como: robo, hurto, asalto, celular, billetera, "
                "motocicleta, cuchillo, pistola, noche, madrugada."
            ),
        )

        latency_ms = (time.monotonic() - start_time) * 1000
        transcription_text = transcript.text.strip()

        logger.info(
            f"Transcripción completada en {latency_ms:.0f}ms — "
            f"{len(transcription_text)} caracteres"
        )

        return TranscriptionResponse(
            success=True,
            transcription=transcription_text,
            language=getattr(transcript, "language", "es"),
            duration_seconds=getattr(transcript, "duration", None),
            latencia_ms=round(latency_ms, 1),
            model="whisper-1",
        )

    except Exception as e:
        logger.error(f"Error en transcripción Whisper: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error en el servicio de transcripción: {str(e)[:200]}",
        )


@router.get(
    "/health",
    summary="Estado del servicio de audio",
    tags=["Audio / Speech-to-Text"],
)
async def audio_health() -> JSONResponse:
    """Verifica si el servicio Whisper está configurado correctamente."""
    return JSONResponse(content={
        "service": "whisper",
        "model": "whisper-1",
        "status": "available" if settings.OPENAI_API_KEY else "unconfigured",
        "max_file_size_mb": MAX_AUDIO_SIZE_MB,
        "supported_formats": ["webm", "ogg", "wav", "mp3", "mp4", "m4a"],
        "language": "es",
    })
