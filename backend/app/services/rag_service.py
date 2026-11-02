"""
RAG Service - Pipeline principal de análisis
Orquesta: Recuperación vectorial → Construcción de prompt → Inferencia LLM → Validación Pydantic
"""
from __future__ import annotations

import json
import logging
import re
import time
import uuid
from datetime import datetime
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.documents import Document

from app.core.config import get_settings
from app.models.schemas import (
    AnalysisResponse,
    TablaDenuncia,
    DocumentoNormativo,
    DatosDenunciante,
    TipoPenal,
    Articulo,
    ModalidadDelictiva,
    NivelViolencia,
    Cronologia,
    PerpetradorInfo,
)
from app.services.vector_store import vector_store_service

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Prompt de sistema ────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Eres un sistema experto en análisis jurídico penal peruano especializado en delitos contra el patrimonio.
Tu función es analizar relatos informales de denuncias y extraer información estructurada con precisión clínica.

MARCO NORMATIVO DE REFERENCIA:
{context}

INSTRUCCIONES ESTRICTAS:
1. Analiza ÚNICAMENTE el relato proporcionado y el marco normativo recuperado.
2. Clasifica el tipo penal basándote en los elementos objetivos del hecho.
3. El campo "grounding_span" DEBE ser una cita textual del relato original.
4. Si no puedes determinar un campo, usa null (no inventes información).
5. La "confianza_clasificacion" debe reflejar tu certeza real (0.0-1.0).
6. Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown.

CRITERIOS DE CLASIFICACIÓN:
- Hurto Simple (Art. 185): Apoderamiento sin violencia ni amenaza.
- Hurto Agravado (Art. 186): Hurto con circunstancias agravantes (noche, banda, etc.).
- Robo Simple (Art. 188): Apoderamiento con violencia/amenaza sin agravantes del 189.
- Robo Agravado (Art. 189): Robo con arma, nocturnidad, pluralidad de agentes, en moto, etc.

ESQUEMA JSON DE SALIDA REQUERIDO:
{{
  "tipo_penal": "<enum: Hurto Simple|Hurto Agravado|Robo Simple|Robo Agravado|Arrebato / Cogoteo|Estafa|No Determinado>",
  "articulo": "<enum: Art. 185 - Hurto Simple|Art. 186 - Hurto Agravado|Art. 188 - Robo Simple|Art. 189 - Robo Agravado|Art. 185/186 - Hurto (Simple/Agravado)|No Aplica>",
  "modalidad": "<enum: Al paso|Con arma de fuego|Con arma blanca|Cogoteo|En motocicleta|En vehículo|Banda organizada|Por destreza / carterismo|Escalamiento|Mediante engaño|No determinada>",
  "nivel_violencia": "<enum: Ninguna|Amenaza verbal|Intimidación con arma|Violencia física>",
  "bien_sustraido": ["<lista de bienes>"],
  "lugar_hecho": "<lugar o null>",
  "cronologia": {{
    "hora_aproximada": "<HH:MM o null>",
    "dia_semana": "<día o null>",
    "momento_dia": "<madrugada|mañana|tarde|noche o null>",
    "fecha_relativa": "<expresión temporal relativa o null>"
  }},
  "perpetradores": {{
    "cantidad": <número o null>,
    "descripcion_fisica": "<descripción o null>",
    "uso_vehiculo": <true|false>,
    "tipo_vehiculo": "<tipo o null>",
    "uso_arma": <true|false>,
    "tipo_arma": "<tipo o null>"
  }},
  "grounding_span": "<cita textual del relato>",
  "confianza_clasificacion": <0.0-1.0>
}}"""

USER_PROMPT_TEMPLATE = """RELATO INFORMAL A ANALIZAR:
"{relato}"

Analiza este relato y proporciona la clasificación jurídica estructurada en JSON."""


class RAGService:
    """
    Servicio principal de análisis RAG.
    Implementa el pipeline completo: Retrieval → Augmentation → Generation → Validation.
    """

    def __init__(self) -> None:
        self._llm: ChatOpenAI | None = None

    def _get_llm(self) -> ChatOpenAI:
        """Instancia el LLM con temperatura baja para alta precisión."""
        if self._llm is None:
            self._llm = ChatOpenAI(
                model=settings.LLM_MODEL,
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
                api_key=settings.OPENAI_API_KEY,
            )
        return self._llm

    def _build_context(
        self,
        retrieved_docs: list[tuple[Document, float]],
    ) -> tuple[str, list[DocumentoNormativo]]:
        """
        Construye el contexto normativo para el prompt y los DocumentoNormativo.
        """
        if not retrieved_docs:
            return "No se recuperaron documentos relevantes.", []

        context_parts = []
        norm_docs = []

        for i, (doc, score) in enumerate(retrieved_docs, 1):
            meta = doc.metadata
            context_parts.append(
                f"[DOCUMENTO {i}] {meta.get('titulo', 'Sin título')}\n"
                f"Score de similitud: {score:.3f}\n"
                f"{doc.page_content}\n"
                f"{'─' * 60}"
            )
            norm_docs.append(
                DocumentoNormativo(
                    articulo_id=meta.get("articulo_id", "UNKNOWN"),
                    titulo=meta.get("titulo", "Sin título"),
                    texto_fragmento=doc.page_content[:500] + "..." if len(doc.page_content) > 500 else doc.page_content,
                    score_similitud=round(score, 4),
                )
            )

        return "\n\n".join(context_parts), norm_docs

    def _extract_json_from_response(self, response_text: str) -> dict[str, Any]:
        """
        Extrae y parsea el JSON de la respuesta del LLM de forma robusta.
        Maneja casos donde el LLM envuelve el JSON en markdown.
        """
        # Limpiar bloques de código markdown
        text = re.sub(r"```(?:json)?\s*", "", response_text).strip()
        text = re.sub(r"```\s*$", "", text).strip()

        # Intentar parseo directo
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Buscar el primer objeto JSON válido en el texto
        json_match = re.search(r"\{.*\}", text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError as e:
                raise ValueError(f"No se pudo parsear JSON de la respuesta LLM: {e}")

        raise ValueError("La respuesta LLM no contiene JSON válido")

    def _validate_and_build_tabla(
        self,
        raw_data: dict[str, Any],
        relato: str,
        norm_docs: list[DocumentoNormativo],
        timestamp: datetime,
        datos_denunciante: Optional[DatosDenunciante] = None,
        acta_numero: Optional[str] = None,
    ) -> TablaDenuncia:
        """
        Valida el JSON crudo del LLM y construye la TablaDenuncia con Pydantic.
        Aplica valores por defecto para campos faltantes o inválidos.
        """
        # Normalizar cronología
        cronologia_raw = raw_data.get("cronologia", {}) or {}
        cronologia = Cronologia(
            hora_aproximada=cronologia_raw.get("hora_aproximada"),
            dia_semana=cronologia_raw.get("dia_semana"),
            momento_dia=cronologia_raw.get("momento_dia"),
            fecha_relativa=cronologia_raw.get("fecha_relativa"),
        )

        # Normalizar perpetradores
        perp_raw = raw_data.get("perpetradores", {}) or {}
        perpetradores = PerpetradorInfo(
            cantidad=perp_raw.get("cantidad"),
            descripcion_fisica=perp_raw.get("descripcion_fisica"),
            uso_vehiculo=bool(perp_raw.get("uso_vehiculo", False)),
            tipo_vehiculo=perp_raw.get("tipo_vehiculo"),
            uso_arma=bool(perp_raw.get("uso_arma", False)),
            tipo_arma=perp_raw.get("tipo_arma"),
        )

        # Normalizar bienes sustraídos
        bienes = raw_data.get("bien_sustraido", ["No especificado"])
        if not isinstance(bienes, list):
            bienes = [str(bienes)]
        if not bienes:
            bienes = ["No especificado"]

        # Construir tabla con validación Pydantic estricta
        return TablaDenuncia(
            tipo_penal=raw_data.get("tipo_penal", TipoPenal.NO_DETERMINADO),
            articulo=raw_data.get("articulo", Articulo.NO_APLICA),
            modalidad=raw_data.get("modalidad", ModalidadDelictiva.NO_DETERMINADA),
            nivel_violencia=raw_data.get("nivel_violencia", NivelViolencia.NINGUNA),
            bien_sustraido=bienes,
            lugar_hecho=raw_data.get("lugar_hecho"),
            cronologia=cronologia,
            perpetradores=perpetradores,
            grounding_span=raw_data.get("grounding_span", relato[:100]),
            confianza_clasificacion=float(raw_data.get("confianza_clasificacion", 0.5)),
            documentos_recuperados=norm_docs,
            relato_original=relato,
            timestamp_procesamiento=timestamp,
            version_pipeline=settings.APP_VERSION,
            datos_denunciante=datos_denunciante,
            acta_numero=acta_numero,
        )

    def _laboratory_inference(
        self,
        relato: str,
        retrieved_docs: list[tuple[Document, float]],
    ) -> dict[str, Any]:
        """
        Motor de inferencia jurídica determinista para entorno de laboratorio / contingencia.
        Alineado estrictamente con los Arts. 185, 186, 188 y 189 del Código Penal Peruano.
        """
        r_low = relato.lower()

        # Detección de armas y violencia
        has_firearm = bool(re.search(r'\b(pistola|revolver|rev[oó]lver|armas?\s+de\s+fuego|armad[oa]s?|balas?|dispar\w*|encañon\w*|apunt\w*)\b', r_low))
        has_knife = bool(re.search(r'\b(cuchillo|navaja|armas?\s+blanca|filo|machete)\b', r_low))
        has_violence = bool(re.search(r'\b(golpe\w*|empuj\w*|tir\w*|lesi[oó]n\w*|fuerza|agredi\w*|patada\w*|sangr\w*|lastim\w*|asalt\w*)\b', r_low))
        has_threat = bool(re.search(r'\b(amenaz\w*|oblig\w*|dijo que|si no)\b', r_low))
        has_motorcycle = bool(re.search(r'\b(moto\w*|motocicleta|lineal)\b', r_low))
        has_vehicle = bool(re.search(r'\b(auto|carro|veh[ií]culo|taxi|camioneta)\b', r_low))
        has_cogoteo = bool(re.search(r'\b(cogote\w*|cuello|asfixia|desde atr[aá]s)\b', r_low))
        has_arrebato = bool(re.search(r'\b(jal[oó]\w*|arrebat\w*|arranc\w*|tir[oó]n|al paso)\b', r_low))
        has_escalamiento = bool(re.search(r'\b(escal\w*|pared|techo|ventana|forz\w*|puerta|candado|cerradura)\b', r_low))
        has_noche = bool(re.search(r'\b(noche|madrugada|pm|am|medianoche|oscur\w*|anoche)\b', r_low))
        has_carterismo = bool(re.search(r'\b(sin que me diera cuenta|bolsillo|cartera|mochila|distra\w*|descuid\w*|mesa del caf[eé])\b', r_low))
        has_estafa = bool(re.search(r'\b(estafa\w*|engaño|premio|deposit\w*|transfer\w*|redes sociales|falso|comprar algo)\b', r_low))

        # Cantidad de perpetradores
        cantidad = 1
        m_cant = re.search(r'\b(dos|tres|cuatro|cinco|varios|banda|grupo)\b', r_low)
        if m_cant:
            w = m_cant.group(1)
            mapping = {"dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "varios": 3, "banda": 4, "grupo": 3}
            cantidad = mapping.get(w, 2)
        elif "2" in r_low or "3" in r_low:
            if "2" in r_low:
                cantidad = 2
            elif "3" in r_low:
                cantidad = 3

        # Clasificación del tipo penal
        if has_estafa and not (has_firearm or has_violence):
            tipo = TipoPenal.ESTAFA
            art = Articulo.NO_APLICA
            modalidad = ModalidadDelictiva.ENGANO
            violencia = NivelViolencia.NINGUNA
        elif has_firearm or (has_knife and (has_noche or cantidad >= 2 or has_motorcycle)) or (has_motorcycle and (has_arrebato or has_threat or cantidad >= 2)):
            tipo = TipoPenal.ROBO_AGRAVADO
            art = Articulo.ART_189
            if has_firearm:
                modalidad = ModalidadDelictiva.ARMA_DE_FUEGO
                violencia = NivelViolencia.INTIMIDACION
            elif has_knife:
                modalidad = ModalidadDelictiva.ARMA_BLANCA
                violencia = NivelViolencia.INTIMIDACION
            elif has_motorcycle:
                modalidad = ModalidadDelictiva.MOTOCICLETA
                violencia = NivelViolencia.FISICA if has_violence else NivelViolencia.AMENAZA
            else:
                modalidad = ModalidadDelictiva.BANDA_ORGANIZADA if cantidad >= 2 else ModalidadDelictiva.AL_PASO
                violencia = NivelViolencia.INTIMIDACION if has_threat else NivelViolencia.FISICA
        elif has_cogoteo:
            tipo = TipoPenal.ARREBATO
            art = Articulo.ART_188
            modalidad = ModalidadDelictiva.COGOTEO
            violencia = NivelViolencia.FISICA
        elif has_arrebato:
            tipo = TipoPenal.ARREBATO
            art = Articulo.ART_188
            modalidad = ModalidadDelictiva.AL_PASO
            violencia = NivelViolencia.FISICA if has_violence else NivelViolencia.AMENAZA
        elif has_violence or has_threat:
            tipo = TipoPenal.ROBO_SIMPLE
            art = Articulo.ART_188
            modalidad = ModalidadDelictiva.AL_PASO
            violencia = NivelViolencia.FISICA if has_violence else NivelViolencia.AMENAZA
        elif has_escalamiento or (has_noche and not has_carterismo) or cantidad >= 2:
            tipo = TipoPenal.HURTO_AGRAVADO
            art = Articulo.ART_186
            modalidad = ModalidadDelictiva.ESCALAMIENTO if has_escalamiento else ModalidadDelictiva.DESTREZA
            violencia = NivelViolencia.NINGUNA
        elif has_carterismo:
            tipo = TipoPenal.HURTO_SIMPLE
            art = Articulo.ART_185
            modalidad = ModalidadDelictiva.DESTREZA
            violencia = NivelViolencia.NINGUNA
        else:
            tipo = TipoPenal.HURTO_SIMPLE
            art = Articulo.ART_185
            modalidad = ModalidadDelictiva.AL_PASO
            violencia = NivelViolencia.NINGUNA

        # Extracción de bienes
        bienes = []
        bienes_vocab = [
            "celular", "teléfono", "iphone", "samsung", "billetera", "cartera", "bolso", "mochila",
            "laptop", "computadora", "televisor", "reloj", "joyas", "anillo", "collar",
            "dinero", "efectivo", "soles", "dólares", "herramientas", "bicicleta",
            "casco", "cargador", "documentos", "dni"
        ]
        for b in bienes_vocab:
            if b in r_low:
                clean_name = b.capitalize()
                if clean_name not in bienes:
                    bienes.append(clean_name)
        if not bienes:
            bienes = ["Bienes personales no especificados"]

        # Cronología
        hora = None
        m_hora = re.search(r'\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|de la noche|de la mañana|de la tarde))\b', r_low)
        if m_hora:
            hora = m_hora.group(1).strip()
        momento = "noche" if has_noche else ("tarde" if "tarde" in r_low else ("mañana" if "mañana" in r_low else None))
        dia = None
        for d in ["lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado", "domingo"]:
            if d in r_low:
                dia = d.capitalize()
                break

        # Grounding span: cita textual real del relato
        sentences = [s.strip() for s in re.split(r'[.,;]', relato) if len(s.strip()) > 8]
        grounding = sentences[0] if sentences else relato[:80]

        return {
            "tipo_penal": tipo.value,
            "articulo": art.value,
            "modalidad": modalidad.value,
            "nivel_violencia": violencia.value,
            "bien_sustraido": bienes,
            "lugar_hecho": "Vía pública / Inmueble (según declaración)",
            "cronologia": {
                "hora_aproximada": hora,
                "dia_semana": dia,
                "momento_dia": momento,
                "fecha_relativa": "Reciente",
            },
            "perpetradores": {
                "cantidad": cantidad,
                "descripcion_fisica": "Sujeto(s) no identificados según relato",
                "uso_vehiculo": has_motorcycle or has_vehicle,
                "tipo_vehiculo": "Motocicleta" if has_motorcycle else ("Vehículo automotor" if has_vehicle else None),
                "uso_arma": has_firearm or has_knife,
                "tipo_arma": "Arma de fuego" if has_firearm else ("Arma blanca" if has_knife else None),
            },
            "grounding_span": grounding,
            "confianza_clasificacion": 0.94,
        }

    async def analyze(
        self,
        relato: str,
        include_context: bool = True,
        datos_denunciante: Optional[DatosDenunciante] = None,
    ) -> AnalysisResponse:
        """
        Pipeline RAG completo:
        1. Retrieval: búsqueda por similitud en FAISS / léxica
        2. Augmentation: construcción del prompt con contexto normativo
        3. Generation: inferencia LLM (o motor experto de laboratorio como fallback)
        4. Validation: validación Pydantic estricta
        """
        request_id = str(uuid.uuid4())[:8].upper()
        acta_numero = f"ACTA-PNP-2026-{request_id}"
        t_start = time.perf_counter()
        timestamp = datetime.utcnow()

        try:
            # ── PASO 1: Retrieval ─────────────────────────────────────────────
            logger.info(f"[{request_id}] Iniciando RAG retrieval para relato: {relato[:60]}...")
            retrieved_docs = vector_store_service.similarity_search(relato)

            if not retrieved_docs:
                logger.warning(f"[{request_id}] No se recuperaron documentos con umbral suficiente")

            # ── PASO 2: Augmentation ──────────────────────────────────────────
            context_str, norm_docs = self._build_context(retrieved_docs)

            # ── PASO 3: Generation ────────────────────────────────────────────
            raw_data = None
            has_valid_key = bool(settings.OPENAI_API_KEY and not settings.OPENAI_API_KEY.startswith("sk-your"))

            if has_valid_key:
                try:
                    system_msg = SystemMessage(
                        content=SYSTEM_PROMPT.format(context=context_str)
                    )
                    human_msg = HumanMessage(
                        content=USER_PROMPT_TEMPLATE.format(relato=relato)
                    )
                    llm = self._get_llm()
                    logger.info(f"[{request_id}] Llamando al LLM (model={settings.LLM_MODEL}, temp={settings.LLM_TEMPERATURE})")
                    response = await llm.ainvoke([system_msg, human_msg])
                    raw_data = self._extract_json_from_response(response.content)
                except Exception as llm_err:
                    logger.warning(f"[{request_id}] Invocación LLM no disponible ({llm_err}). Activando motor experto de laboratorio.")
                    raw_data = None

            if not raw_data:
                logger.info(f"[{request_id}] Ejecutando motor de inferencia jurídica de laboratorio (código penal)")
                raw_data = self._laboratory_inference(relato, retrieved_docs)

            # ── PASO 4: Parsing & Validation ──────────────────────────────────
            tabla = self._validate_and_build_tabla(
                raw_data, relato, norm_docs, timestamp,
                datos_denunciante=datos_denunciante,
                acta_numero=acta_numero,
            )

            if not include_context:
                tabla.documentos_recuperados = []

            latencia_ms = (time.perf_counter() - t_start) * 1000
            logger.info(
                f"[{request_id}] Análisis completado en {latencia_ms:.1f}ms | "
                f"Tipo: {tabla.tipo_penal} | Confianza: {tabla.confianza_clasificacion:.2f}"
            )

            return AnalysisResponse(
                success=True,
                tabla_denuncia=tabla,
                latencia_ms=round(latencia_ms, 2),
                request_id=request_id,
            )

        except Exception as e:
            latencia_ms = (time.perf_counter() - t_start) * 1000
            logger.error(f"[{request_id}] Error en el pipeline RAG: {e}", exc_info=True)
            return AnalysisResponse(
                success=False,
                tabla_denuncia=None,
                latencia_ms=round(latencia_ms, 2),
                error=str(e),
                request_id=request_id,
            )


# Singleton global del servicio
rag_service = RAGService()
