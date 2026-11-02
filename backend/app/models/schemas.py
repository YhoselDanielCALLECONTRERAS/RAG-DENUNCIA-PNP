"""
Esquemas Pydantic estrictos para validación de entrada/salida del pipeline RAG.
Representan la ontología jurídica de delitos contra el patrimonio (Cód. Penal Peruano).
Incluye schemas de autenticación JWT y transcripción de audio (Whisper).
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, Optional
from pydantic import BaseModel, Field, field_validator, model_validator
import re


# ── Schemas de Autenticación JWT ──────────────────────────────────────────────

class LoginRequest(BaseModel):
    """Solicitud de inicio de sesión del personal PNP."""
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        description="Nombre de usuario del personal PNP",
        examples=["operador"],
    )
    password: str = Field(
        ...,
        min_length=4,
        max_length=128,
        description="Contraseña del personal PNP",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "username": "operador",
                "password": "pnp2026",
            }
        }
    }


class UserInfoResponse(BaseModel):
    """Información del personal PNP autenticado."""
    username: str
    full_name: str
    badge_number: str = Field(description="Número de placa/credencial PNP")
    rank: str = Field(description="Rango o grado policial")
    unit: str = Field(description="Unidad o dependencia policial")
    role: str = Field(description="Rol en el sistema: admin, operator, investigator")


class TokenResponse(BaseModel):
    """Respuesta de autenticación con token JWT."""
    access_token: str = Field(description="Token JWT de acceso")
    token_type: str = Field(default="bearer", description="Tipo de token")
    expires_in: int = Field(description="Segundos hasta la expiración del token")
    user: UserInfoResponse = Field(description="Información del usuario autenticado")


# ── Schema de Transcripción de Audio ─────────────────────────────────────────

class TranscriptionResponse(BaseModel):
    """Respuesta de transcripción de audio con OpenAI Whisper."""
    success: bool
    transcription: str = Field(description="Texto transcrito del audio")
    language: str = Field(default="es", description="Idioma detectado")
    duration_seconds: Optional[float] = Field(None, description="Duración del audio en segundos")
    latencia_ms: float = Field(description="Latencia del servicio Whisper en ms")
    model: str = Field(default="whisper-1", description="Modelo Whisper utilizado")


# ── Enumeraciones controladas ─────────────────────────────────────────────────

class TipoPenal(str, Enum):
    HURTO_SIMPLE = "Hurto Simple"
    HURTO_AGRAVADO = "Hurto Agravado"
    ROBO_SIMPLE = "Robo Simple"
    ROBO_AGRAVADO = "Robo Agravado"
    ARREBATO = "Arrebato / Cogoteo"
    ESTAFA = "Estafa"
    NO_DETERMINADO = "No Determinado"


class Articulo(str, Enum):
    ART_185 = "Art. 185 - Hurto Simple"
    ART_186 = "Art. 186 - Hurto Agravado"
    ART_188 = "Art. 188 - Robo Simple"
    ART_189 = "Art. 189 - Robo Agravado"
    ART_185_186 = "Art. 185/186 - Hurto (Simple/Agravado)"
    NO_APLICA = "No Aplica"


class ModalidadDelictiva(str, Enum):
    AL_PASO = "Al paso"
    ARMA_DE_FUEGO = "Con arma de fuego"
    ARMA_BLANCA = "Con arma blanca"
    COGOTEO = "Cogoteo"
    MOTOCICLETA = "En motocicleta"
    VEHICULO = "En vehículo"
    BANDA_ORGANIZADA = "Banda organizada"
    DESTREZA = "Por destreza / carterismo"
    ESCALAMIENTO = "Escalamiento"
    ENGANO = "Mediante engaño"
    NO_DETERMINADA = "No determinada"


class NivelViolencia(str, Enum):
    NINGUNA = "Ninguna"
    AMENAZA = "Amenaza verbal"
    INTIMIDACION = "Intimidación con arma"
    FISICA = "Violencia física"


# ── Request / Response Bodies ─────────────────────────────────────────────────

class DatosDenunciante(BaseModel):
    """Datos de filiación del denunciante para el Acta de Denuncia PNP."""
    nombres_apellidos: str = Field(default="Carlos Alberto Quispe Huamán", description="Nombres y apellidos completos")
    tipo_documento: str = Field(default="DNI", description="DNI, Carné de Extranjería o Pasaporte")
    numero_documento: str = Field(default="47891234", description="Número de documento de identidad")
    edad: Optional[int] = Field(default=34, description="Edad del denunciante")
    sexo: str = Field(default="Masculino", description="Sexo")
    estado_civil: str = Field(default="Soltero(a)", description="Estado civil")
    grado_instruccion: str = Field(default="Superior Universitaria", description="Nivel educativo alcanzado")
    ocupacion: str = Field(default="Ingeniero de Sistemas", description="Ocupación o profesión")
    domicilio: str = Field(default="Av. Brasil 1450 Dpto. 501, Jesús María, Lima", description="Domicilio real")
    telefono: str = Field(default="987654321", description="Teléfono de contacto")


class RelatoInput(BaseModel):
    """Cuerpo de la solicitud de análisis."""
    relato: Annotated[str, Field(
        min_length=20,
        max_length=2000,
        description="Relato informal del hecho denunciado en lenguaje coloquial",
        examples=["Ayer a las 9pm dos sujetos en moto me encañonaron y quitaron el celular"]
    )]
    include_context: bool = Field(
        default=True,
        description="Incluir fragmentos normativos recuperados (RAG context)"
    )
    datos_denunciante: Optional[DatosDenunciante] = Field(
        default=None,
        description="Datos del ciudadano denunciante para el Acta Policial"
    )

    @field_validator("relato")
    @classmethod
    def sanitize_relato(cls, v: str) -> str:
        v = v.strip()
        # Eliminar secuencias de control excepto saltos de línea normales
        v = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", v)
        if len(v) < 20:
            raise ValueError("El relato debe tener al menos 20 caracteres.")
        return v


class Cronologia(BaseModel):
    """Datos temporales extraídos del relato."""
    hora_aproximada: Optional[str] = Field(None, description="Hora del hecho (ej. '21:00')")
    dia_semana: Optional[str] = Field(None, description="Día de la semana si se menciona")
    momento_dia: Optional[str] = Field(
        None,
        description="Momento del día: madrugada, mañana, tarde, noche"
    )
    fecha_relativa: Optional[str] = Field(
        None,
        description="Referencia temporal relativa (ej. 'ayer', 'hace dos días')"
    )


class PerpetradorInfo(BaseModel):
    """Información sobre perpetradores extraída del relato."""
    cantidad: Optional[int] = Field(None, ge=1, le=50)
    descripcion_fisica: Optional[str] = None
    uso_vehiculo: bool = False
    tipo_vehiculo: Optional[str] = None
    uso_arma: bool = False
    tipo_arma: Optional[str] = None


class DocumentoNormativo(BaseModel):
    """Fragmento normativo recuperado por el sistema RAG."""
    articulo_id: str = Field(..., description="Identificador del artículo")
    titulo: str
    texto_fragmento: str = Field(..., description="Extracto del cuerpo legal")
    score_similitud: float = Field(..., ge=0.0, le=1.0, description="Score coseno de similitud")


class TablaDenuncia(BaseModel):
    """
    Salida tabular estructurada del pipeline RAG.
    Representa la ontología jurídica extraída del relato informal.
    """
    # ── Clasificación jurídica ────────────────────────────────────────────────
    tipo_penal: TipoPenal = Field(
        ...,
        description="Clasificación del tipo penal según el Código Penal Peruano"
    )
    articulo: Articulo = Field(
        ...,
        description="Artículo penal aplicable"
    )
    modalidad: ModalidadDelictiva = Field(
        ...,
        description="Modalidad delictiva identificada"
    )
    nivel_violencia: NivelViolencia = Field(
        ...,
        description="Nivel de violencia o intimidación empleado"
    )

    # ── Circunstancias del hecho ──────────────────────────────────────────────
    bien_sustraido: list[str] = Field(
        ...,
        min_length=1,
        description="Lista de bienes sustraídos o afectados"
    )
    lugar_hecho: Optional[str] = Field(
        None,
        description="Lugar o contexto espacial del hecho"
    )
    cronologia: Cronologia = Field(
        ...,
        description="Datos temporales del hecho"
    )
    perpetradores: PerpetradorInfo = Field(
        ...,
        description="Información sobre los perpetradores"
    )

    # ── Trazabilidad RAG ──────────────────────────────────────────────────────
    grounding_span: str = Field(
        ...,
        description="Extracto literal del relato que sustenta la clasificación"
    )
    confianza_clasificacion: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confianza del modelo en la clasificación (0-1)"
    )
    documentos_recuperados: list[DocumentoNormativo] = Field(
        default_factory=list,
        description="Fragmentos normativos recuperados por RAG"
    )

    # ── Metadata ──────────────────────────────────────────────────────────────
    relato_original: str = Field(..., description="Relato original ingresado")
    timestamp_procesamiento: datetime = Field(
        default_factory=datetime.utcnow,
        description="Marca temporal del procesamiento"
    )
    version_pipeline: str = Field(default="1.0.0")
    datos_denunciante: Optional[DatosDenunciante] = Field(
        default=None,
        description="Datos generales del denunciante para el Acta Policial"
    )
    acta_numero: Optional[str] = Field(
        default=None,
        description="Número correlativo oficial del Acta Policial PNP"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "tipo_penal": "Robo Agravado",
                "articulo": "Art. 189 - Robo Agravado",
                "modalidad": "Con arma de fuego",
                "nivel_violencia": "Intimidación con arma",
                "bien_sustraido": ["Teléfono celular"],
                "lugar_hecho": "vía pública",
                "cronologia": {
                    "hora_aproximada": "21:00",
                    "momento_dia": "noche",
                    "fecha_relativa": "ayer"
                },
                "perpetradores": {
                    "cantidad": 2,
                    "uso_vehiculo": True,
                    "tipo_vehiculo": "motocicleta",
                    "uso_arma": True,
                    "tipo_arma": "arma de fuego"
                },
                "grounding_span": "dos sujetos en moto me encañonaron y quitaron el celular",
                "confianza_clasificacion": 0.94
            }
        }
    }


class AnalysisResponse(BaseModel):
    """Respuesta completa del endpoint de análisis."""
    success: bool
    tabla_denuncia: Optional[TablaDenuncia] = None
    latencia_ms: float = Field(..., description="Latencia total del pipeline en ms")
    error: Optional[str] = None
    request_id: str = Field(..., description="ID único de la solicitud")


class MetricasEvaluacion(BaseModel):
    """Métricas de desempeño del pipeline evaluado sobre el Gold Standard."""
    accuracy: float = Field(..., ge=0.0, le=1.0)
    precision: float = Field(..., ge=0.0, le=1.0)
    recall: float = Field(..., ge=0.0, le=1.0)
    f1_score: float = Field(..., ge=0.0, le=1.0)
    latencia_promedio_ms: float
    total_casos: int
    casos_correctos: int
    timestamp_evaluacion: datetime = Field(default_factory=datetime.utcnow)


# ── Schema de sesión activa ───────────────────────────────────────────────────

class SessionInfo(BaseModel):
    """Información de sesión activa del turno policial."""
    is_authenticated: bool
    user: Optional[UserInfoResponse] = None
    session_start: Optional[datetime] = None
    token_expires_at: Optional[datetime] = None
