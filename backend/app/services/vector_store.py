"""
Vector Store Service - FAISS (reemplaza ChromaDB para Windows sin C++ Build Tools)
Indexa y recupera fragmentos del Código Penal Peruano (Arts. 185, 186, 188, 189)
usando embeddings semánticos de OpenAI y FAISS como motor de búsqueda vectorial.
"""
from __future__ import annotations

import json
import logging
import pickle
import re
from pathlib import Path
from typing import TYPE_CHECKING

from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

from app.core.config import get_settings

if TYPE_CHECKING:
    from langchain_core.vectorstores import VectorStoreRetriever

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Corpus normativo: Artículos 185, 186, 188, 189 del Código Penal Peruano ──

CORPUS_LEGAL: list[dict] = [
    {
        "articulo_id": "ART_185",
        "titulo": "Art. 185 - Hurto Simple",
        "texto": (
            "Artículo 185 del Código Penal Peruano - Hurto Simple. "
            "El que, para obtener provecho, se apodera ilegítimamente de un bien mueble, "
            "total o parcialmente ajeno, sustrayéndolo del lugar donde se encuentra, "
            "será reprimido con pena privativa de libertad no menor de uno ni mayor de tres años. "
            "Se aplica cuando no existe violencia ni amenaza contra la persona, no se usa arma, "
            "no hay pluralidad de agentes, ni concurren circunstancias agravantes. "
            "Típicamente ocurre mediante carterismo, destreza, distracción de la víctima, "
            "sustracción de objetos en espacios públicos o comerciales sin confrontación directa. "
            "Bienes típicamente sustraídos: carteras, billeteras, celulares, documentos, joyas."
        ),
        "keywords": [
            "hurto", "hurto simple", "sustraer", "apoderarse", "bien mueble",
            "sin violencia", "carterismo", "destreza", "distracción", "bolsillo",
            "artículo 185", "art 185"
        ]
    },
    {
        "articulo_id": "ART_186",
        "titulo": "Art. 186 - Hurto Agravado",
        "texto": (
            "Artículo 186 del Código Penal Peruano - Hurto Agravado. "
            "El hurto será reprimido con pena privativa de libertad no menor de tres ni mayor de seis años "
            "cuando se comete: en casa habitada, durante la noche, mediante destreza, "
            "con el concurso de dos o más personas, en vehículo de transporte público, "
            "fingiendo ser autoridad, en establecimientos de hospedaje, de esparcimiento o similares, "
            "sobre bienes de gran valor económico o que afecten gravemente el patrimonio de la víctima, "
            "con ocasión de incendio, inundación, naufragio, calamidad pública o desgracia particular, "
            "utilizando espectro radioeléctrico para la comisión del delito, "
            "en agravio de menores de edad, personas con discapacidad, mujeres en estado de gravidez o adulto mayor. "
            "Circunstancias agravantes especiales: en inmueble habitado, de noche, banda criminal, "
            "destreza, en transporte público, escalamiento."
        ),
        "keywords": [
            "hurto agravado", "casa habitada", "noche", "dos personas", "banda",
            "escalamiento", "transporte público", "artículo 186", "art 186",
            "destreza nocturna", "hurto en grupo", "hurto noche"
        ]
    },
    {
        "articulo_id": "ART_188",
        "titulo": "Art. 188 - Robo Simple",
        "texto": (
            "Artículo 188 del Código Penal Peruano - Robo Simple. "
            "El que se apodera ilegítimamente de un bien mueble total o parcialmente ajeno, "
            "para aprovecharse de él, sustrayéndolo del lugar en que se encuentra, "
            "empleando violencia contra la persona o amenazándola con un peligro inminente "
            "para su vida o integridad física, será reprimido con pena privativa de libertad "
            "no menor de tres ni mayor de ocho años. "
            "Elementos esenciales: violencia física o amenaza directa contra la víctima, "
            "sin concurrir circunstancias agravantes del artículo 189. "
            "Casos típicos: empujón y huida, forcejeo sin arma, golpe simple para arrebatar bien."
        ),
        "keywords": [
            "robo simple", "violencia", "amenaza", "arrebato", "forcejeo",
            "empujón", "arrebatar", "arrebató", "artículo 188", "art 188",
            "golpe", "agresión física sin arma"
        ]
    },
    {
        "articulo_id": "ART_189_P1",
        "titulo": "Art. 189 - Robo Agravado (Primera Agravante)",
        "texto": (
            "Artículo 189 del Código Penal Peruano - Robo Agravado. Primera parte. "
            "La pena será no menor de doce ni mayor de veinte años si el robo es cometido: "
            "1. En inmueble habitado. "
            "2. Durante la noche o en lugar desolado. "
            "3. A mano armada (con arma de fuego, arma blanca, arma punzocortante). "
            "4. Con el concurso de dos o más personas. "
            "5. En cualquier medio de locomoción de transporte público o privado de pasajeros o de carga, "
            "terminales terrestres, ferroviarios, lacustres y fluviales, puertos, aeropuertos, restaurantes y afines. "
            "6. Fingiendo ser autoridad o servidor público o trabajador del sector privado. "
            "7. En agravio de menores de edad o ancianos. "
            "8. Mediante el uso de sustancias tóxicas u otras que produzcan privación o perturbación de las facultades. "
            "Casos más frecuentes: encañonamiento con arma de fuego, asalto nocturno, banda de dos o más en moto."
        ),
        "keywords": [
            "robo agravado", "a mano armada", "arma de fuego", "pistola", "encañonar",
            "encañonaron", "noche", "dos personas", "banda", "motocicleta", "moto",
            "artículo 189", "art 189", "asalto nocturno", "con arma", "revólver",
            "cuchillo", "navaja"
        ]
    },
    {
        "articulo_id": "ART_189_P2",
        "titulo": "Art. 189 - Robo Agravado (Segunda Agravante - Mayor gravedad)",
        "texto": (
            "Artículo 189 del Código Penal Peruano - Robo Agravado. Segunda parte. "
            "La pena será no menor de veinte ni mayor de treinta años si el robo resulta: "
            "1. Con lesiones graves en la integridad física o mental de la víctima. "
            "2. Con abuso de la incapacidad física o mental de la víctima o mediante el empleo de drogas. "
            "3. Con crueldad o causando sufrimiento innecesario. "
            "4. Causando la muerte de la víctima durante o con posterioridad al delito o por consecuencia. "
            "Comprende además: robo agravado con secuestro, robo con resultado de muerte, "
            "robo con herida a la víctima."
        ),
        "keywords": [
            "robo con muerte", "lesiones graves", "crueldad", "secuestro", "drogas",
            "herida", "dispararon", "mató", "cadáver", "artículo 189 segunda",
            "robo con resultado muerte"
        ]
    },
    {
        "articulo_id": "ART_188_ARREBATO",
        "titulo": "Modalidad: Arrebato / Cogoteo - Art. 188 o 189",
        "texto": (
            "Modalidad de arrebato o cogoteo en el Código Penal Peruano. "
            "El arrebato consiste en sustraer un bien mediante un movimiento rápido e inesperado "
            "para la víctima, sin que esta pueda ofrecer resistencia. Puede calificarse como "
            "Robo Simple (Art. 188) si solo hay violencia mínima, o Robo Agravado (Art. 189) "
            "si concurren circunstancias como nocturnidad, pluralidad de agentes o uso de vehículo. "
            "El cogoteo o jalón de cuello implica sujeción física de la víctima desde atrás. "
            "Casos típicos: jalaron el celular, le arrebataron la cartera, cogotearon al joven."
        ),
        "keywords": [
            "arrebato", "arrebataron", "jalaron", "cogotearon", "cogoteo",
            "jalón", "quitaron de las manos", "arrancaron", "arrebatarle",
            "le quitaron", "le sacaron"
        ]
    }
]


class VectorStoreService:
    """
    Servicio de almacenamiento y recuperación vectorial usando FAISS.
    Compatible con Windows sin necesidad de C++ Build Tools.
    """

    def __init__(self) -> None:
        self._vectorstore: FAISS | None = None
        self._embeddings: OpenAIEmbeddings | None = None
        self._initialized = False
        self._persist_path = Path(settings.CHROMA_PERSIST_DIR)  # reutilizamos la config

    def _get_embeddings(self) -> OpenAIEmbeddings:
        if self._embeddings is None:
            self._embeddings = OpenAIEmbeddings(
                model=settings.EMBEDDING_MODEL,
                api_key=settings.OPENAI_API_KEY,
            )
        return self._embeddings

    def initialize(self, force_rebuild: bool = False) -> None:
        """
        Inicializa el vector store FAISS.
        Carga desde disco si existe; de lo contrario indexa el corpus desde cero.
        """
        if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("sk-your"):
            logger.info("OPENAI_API_KEY no configurada. VectorStore operará en modo léxico de laboratorio.")
            self._initialized = True
            return

        self._persist_path.mkdir(parents=True, exist_ok=True)
        faiss_index_path = self._persist_path / "faiss_index.pkl"

        try:
            embeddings = self._get_embeddings()

            if faiss_index_path.exists() and not force_rebuild:
                logger.info("Cargando índice FAISS desde disco...")
                try:
                    self._vectorstore = FAISS.load_local(
                        folder_path=str(self._persist_path),
                        embeddings=embeddings,
                        index_name="faiss_index",
                        allow_dangerous_deserialization=True,
                    )
                    logger.info("Índice FAISS cargado correctamente")
                except Exception as e:
                    logger.warning(f"Error cargando FAISS, re-indexando: {e}")
                    self._build_index(embeddings)
            else:
                self._build_index(embeddings)

            self._initialized = True
        except Exception as e:
            logger.warning(f"No se pudo inicializar embeddings de OpenAI ({e}). Usando modo léxico de contingencia.")
            self._vectorstore = None
            self._initialized = True

    def _lexical_search(
        self,
        query: str,
        top_k: int | None = None,
    ) -> list[tuple[Document, float]]:
        """Búsqueda léxica determinista de respaldo sobre el corpus normativo."""
        k = top_k or settings.TOP_K_RETRIEVAL
        q_lower = query.lower()
        scored = []
        for item in CORPUS_LEGAL:
            match_score = 0.0
            for kw in item["keywords"]:
                if kw in q_lower:
                    match_score += 1.8
            words = re.findall(r'\b\w{4,}\b', q_lower)
            text_lower = item["texto"].lower()
            for w in words:
                if w in text_lower:
                    match_score += 0.2
            if match_score > 0:
                doc = Document(
                    page_content=f"{item['texto']}\n\nPalabras clave relacionadas: {', '.join(item['keywords'])}",
                    metadata={
                        "articulo_id": item["articulo_id"],
                        "titulo": item["titulo"],
                        "source": "Código Penal Peruano",
                    }
                )
                sim_score = min(0.96, round(0.55 + (match_score * 0.08), 4))
                scored.append((doc, sim_score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:k]

    def _build_documents(self) -> list[Document]:
        """Convierte el corpus legal en documentos LangChain."""
        docs = []
        for item in CORPUS_LEGAL:
            keywords_str = ", ".join(item["keywords"])
            full_text = (
                f"{item['texto']}\n\n"
                f"Palabras clave relacionadas: {keywords_str}"
            )
            doc = Document(
                page_content=full_text,
                metadata={
                    "articulo_id": item["articulo_id"],
                    "titulo": item["titulo"],
                    "source": "Código Penal Peruano",
                }
            )
            docs.append(doc)
        return docs

    def _build_index(self, embeddings: OpenAIEmbeddings) -> None:
        """Construye y persiste el índice FAISS desde el corpus legal."""
        logger.info("Construyendo índice FAISS desde corpus legal...")
        documents = self._build_documents()
        self._vectorstore = FAISS.from_documents(
            documents=documents,
            embedding=embeddings,
        )
        # Persistir en disco para reutilizar
        self._vectorstore.save_local(
            folder_path=str(self._persist_path),
            index_name="faiss_index",
        )
        logger.info(f"Índice FAISS construido con {len(documents)} documentos y guardado en disco")

    def similarity_search(
        self,
        query: str,
        top_k: int | None = None,
    ) -> list[tuple[Document, float]]:
        """
        Búsqueda por similitud semántica con FAISS (o léxica en modo laboratorio/fallback).
        Retorna lista de (Document, score) ordenada por relevancia descendente.
        """
        k = top_k or settings.TOP_K_RETRIEVAL

        if not self._initialized:
            self.initialize()

        if self._vectorstore is None:
            return self._lexical_search(query, k)

        try:
            raw_results = self._vectorstore.similarity_search_with_score(
                query=query,
                k=k,
            )

            results = []
            for doc, l2_dist in raw_results:
                sim_score = 1.0 / (1.0 + l2_dist)
                if sim_score >= settings.SIMILARITY_THRESHOLD:
                    results.append((doc, round(sim_score, 4)))

            results.sort(key=lambda x: x[1], reverse=True)
            return results
        except Exception as e:
            logger.warning(f"Fallo en FAISS search ({e}). Utilizando búsqueda léxica.")
            return self._lexical_search(query, k)

    def get_retriever(self) -> "VectorStoreRetriever":
        """Retorna un retriever LangChain estándar."""
        if not self._initialized:
            self.initialize()
        return self._vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": settings.TOP_K_RETRIEVAL},
        )

    @property
    def is_initialized(self) -> bool:
        return self._initialized


# Singleton global del servicio
vector_store_service = VectorStoreService()
