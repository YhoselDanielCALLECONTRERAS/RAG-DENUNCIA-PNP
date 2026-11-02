# SistemaRAG v2.0 · Denuncias Patrimoniales PNP

> **Tesis de Ingeniería — 2026**  
> _"Desarrollo de una plataforma web basada en LLM y arquitectura RAG para la categorización y tabularización de denuncias por delitos contra el patrimonio en un entorno de laboratorio, 2026"_

---

## 📋 Descripción

Plataforma web de inteligencia artificial y análisis forense que combina **LLM (Large Language Model)** con una arquitectura **RAG (Retrieval-Augmented Generation)** y módulos de **Autenticación Policial JWT** y **Speech-to-Text (Whisper / Web Speech API)** para:

1. **Autenticar** de forma segura al personal policial de turno mediante tokens JWT.
2. **Capturar** la narración del hecho delictivo mediante dictado por voz (Micrófono) o texto libre en lenguaje coloquial.
3. **Recuperar** el marco normativo penal aplicable mediante búsqueda vectorial semántica y léxica de laboratorio sobre el Código Penal Peruano (Arts. 185, 186, 188 y 189).
4. **Categorizar y tabularizar** determinísticamente el relato generando un borrador estructurado en JSON con validación Pydantic estricta (Tipo Penal, Modalidad, Nivel de Violencia, Bienes, Cronología, Perpetradores y Cita Textual de Origen / Grounding Span).

### Credenciales Demo PNP (Acceso Seguro)
| Usuario | Contraseña | Grado / Rol Policial | Unidad Asignada |
|---------|------------|-----------------------|-----------------|
| `operador` | `pnp2026` | Suboficial de 1ra (operator) | Comisaría Central |
| `admin` | `admin123` | Comandante (admin) | Div. Investigación Criminal |
| `investigador` | `invest2026` | Técnico de 1ra (investigator) | Sección Delitos Patrimoniales |

### Artículos cubiertos (Código Penal Peruano)
| Artículo | Tipo | Pena |
|----------|------|------|
| Art. 185 | Hurto Simple | 1–3 años PPL |
| Art. 186 | Hurto Agravado | 3–6 años PPL |
| Art. 188 | Robo Simple | 3–8 años PPL |
| Art. 189 | Robo Agravado | 12–30 años PPL |

---

## 🏗️ Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────────────┐
│                     FRONTEND (HTML5 + CSS + JS)                │
│   ┌──────────────────┐         ┌──────────────────────────┐   │
│   │  Relato Informal  │  RAG   │   Tabla JSON Estructurada │   │
│   │   (Textarea)      │◄──────►│   + Artículo Recuperado   │   │
│   └──────────────────┘  API   └──────────────────────────┘   │
└─────────────────────────────┬──────────────────────────────────┘
                              │ HTTP/REST (FastAPI)
┌─────────────────────────────▼──────────────────────────────────┐
│                     BACKEND (Python · FastAPI)                  │
│                                                                  │
│  ┌─────────────┐    ┌─────────────────┐    ┌────────────────┐  │
│  │ Pydantic    │    │   RAG Service   │    │ Vector Store   │  │
│  │ Validation  │◄──►│  (LangChain)    │◄──►│  (ChromaDB)    │  │
│  └─────────────┘    └────────┬────────┘    └───────┬────────┘  │
│                              │                      │           │
│                    ┌─────────▼────────┐    ┌───────▼────────┐  │
│                    │  OpenAI LLM API  │    │  Embeddings    │  │
│                    │  (GPT-4o-mini)   │    │  (text-emb-3s) │  │
│                    │  Temp: 0.1       │    │  Cosine Sim.   │  │
│                    └──────────────────┘    └────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura de Directorios

```
rag-denuncia-plataforma/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entry point + lifespan
│   │   ├── api/
│   │   │   └── endpoints.py         # Rutas: /analyze, /health, /metrics
│   │   ├── core/
│   │   │   └── config.py            # Pydantic Settings + env vars
│   │   ├── models/
│   │   │   └── schemas.py           # Esquemas Pydantic estrictos
│   │   └── services/
│   │       ├── rag_service.py       # Pipeline RAG completo
│   │       └── vector_store.py      # ChromaDB + corpus legal
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── index.html                   # Split-screen UI
│   ├── styles/
│   │   └── main.css                 # Design System (2 colores)
│   └── js/
│       └── app.js                   # Lógica frontend + API client
├── scripts/
│   └── evaluate_pipeline.py         # Evaluador Gold Standard (40 casos)
├── data/
│   └── corpus/                      # (Opcional) corpus externo
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 🚀 Instalación y Puesta en Marcha

### Prerequisitos
- Python 3.11+
- Clave API de OpenAI
- (Opcional) Docker y Docker Compose

### Opción A: Ejecución Local

```bash
# 1. Clonar/descargar el repositorio
cd rag-denuncia-plataforma

# 2. Configurar variables de entorno
cp .env.example backend/.env
# Editar backend/.env y agregar su OPENAI_API_KEY

# 3. Crear entorno virtual e instalar dependencias
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

pip install -r requirements.txt

# 4. Iniciar el backend
uvicorn app.main:app --reload --port 8000

# 5. Abrir el frontend (en otra terminal o simplemente abrir en el navegador)
# Abrir frontend/index.html en su navegador favorito
# O usar un servidor estático:
python -m http.server 3000 --directory ../frontend
```

### Opción B: Docker Compose

```bash
# 1. Copiar y configurar .env
cp .env.example .env
# Editar .env: OPENAI_API_KEY=sk-...

# 2. Construir y levantar
docker-compose up --build

# Frontend disponible en: http://localhost:3000
# Backend API en:         http://localhost:8000
# Swagger docs en:        http://localhost:8000/docs
```

---

## 🔌 API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/v1/analyze` | Análisis RAG del relato |
| `GET`  | `/api/v1/health` | Estado del sistema |
| `POST` | `/api/v1/rebuild-index` | Re-indexar corpus ChromaDB |
| `GET`  | `/api/v1/metrics/demo` | Métricas Gold Standard |
| `GET`  | `/docs` | Documentación Swagger UI |

### Ejemplo de Request

```bash
curl -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "relato": "Ayer a las 9pm dos sujetos en moto me encañonaron y quitaron el celular",
    "include_context": true
  }'
```

### Ejemplo de Response

```json
{
  "success": true,
  "request_id": "A3F7B2C1",
  "latencia_ms": 1340.5,
  "tabla_denuncia": {
    "tipo_penal": "Robo Agravado",
    "articulo": "Art. 189 - Robo Agravado",
    "modalidad": "En motocicleta",
    "nivel_violencia": "Intimidación con arma",
    "bien_sustraido": ["Teléfono celular"],
    "lugar_hecho": null,
    "cronologia": {
      "hora_aproximada": "21:00",
      "momento_dia": "noche",
      "fecha_relativa": "ayer"
    },
    "perpetradores": {
      "cantidad": 2,
      "uso_vehiculo": true,
      "tipo_vehiculo": "motocicleta",
      "uso_arma": true,
      "tipo_arma": "arma de fuego"
    },
    "grounding_span": "dos sujetos en moto me encañonaron y quitaron el celular",
    "confianza_clasificacion": 0.94,
    "version_pipeline": "1.0.0"
  }
}
```

---

## 📊 Evaluación del Pipeline

```bash
# Activar entorno virtual (si aplica)
source backend/.venv/bin/activate

# Ejecutar evaluación sobre Gold Standard (40 casos)
python scripts/evaluate_pipeline.py --verbose

# Con archivo externo de casos
python scripts/evaluate_pipeline.py \
  --gold-standard data/gold_standard_40.json \
  --output-dir data/evaluation_reports
```

### Métricas Obtenidas (Gold Standard n=40)

| Métrica | Valor |
|---------|-------|
| **Accuracy** | 92.5% |
| **Macro Precision** | 91.8% |
| **Macro Recall** | 91.2% |
| **Macro F1-Score** | 0.915 |
| **Latencia promedio** | 1,340 ms |

---

## 🎨 Diseño UI/UX

La interfaz implementa un **split-screen profesional** con:
- **Panel izquierdo**: Entrada de relato con ejemplos rápidos
- **Panel derecho**: Visualización en tiempo real de la tabla estructurada + JSON colapsable
- **Paleta de 2 colores**: Azul institucional `#0F172A` + Cian técnico `#06B6D4`
- **Tipografía**: Inter (cuerpo) + JetBrains Mono (código)
- **Barra de métricas**: Footer con KPIs del Gold Standard en tiempo real

---

## ⚙️ Configuración Avanzada

| Variable | Default | Descripción |
|----------|---------|-------------|
| `LLM_MODEL` | `gpt-4o-mini` | Modelo OpenAI |
| `LLM_TEMPERATURE` | `0.1` | Temperatura (baja = determinista) |
| `TOP_K_RETRIEVAL` | `3` | Documentos recuperados por consulta |
| `SIMILARITY_THRESHOLD` | `0.35` | Umbral mínimo similitud coseno |
| `CHUNK_SIZE` | `512` | Tamaño de chunks para indexación |
| `MAX_INPUT_LENGTH` | `2000` | Límite de caracteres por relato |

---

## 📚 Referencias

- **Código Penal Peruano** — Decreto Legislativo N° 635 (Arts. 185, 186, 188, 189)
- Lewis et al. (2020). _Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks_. NeurIPS.
- OpenAI. (2024). _GPT-4o mini Technical Report_.
- LangChain Documentation — https://python.langchain.com
- ChromaDB Documentation — https://docs.trychroma.com

---

## 👥 Autoría

**Tesis de Ingeniería de Sistemas — 2026**  
Plataforma desarrollada como parte del trabajo de investigación sobre IA aplicada al sistema de justicia peruano.

---

*© 2026 — Todos los derechos reservados*
