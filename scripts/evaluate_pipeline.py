#!/usr/bin/env python3
"""
Script de Evaluación Automatizada del Pipeline RAG
Evalúa el sistema contra el Gold Standard de 40 casos sintéticos.
Genera reporte de métricas: Accuracy, Precision, Recall, F1-score, Latencia.

Uso:
    python evaluate_pipeline.py [--gold-standard path] [--output-dir path]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

# Agregar el directorio backend al path
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.core.config import get_settings
from app.services.vector_store import vector_store_service
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Gold Standard sintético (40 casos) ───────────────────────────────────────
# En producción, cargar desde GOLD_STANDARD_PATH
GOLD_STANDARD: list[dict[str, Any]] = [
    # Casos de Robo Agravado (Art. 189)
    {"id": "GS-001", "relato": "Ayer a las 9pm dos sujetos en moto me encañonaron y quitaron el celular", "expected_tipo": "Robo Agravado", "expected_art": "Art. 189 - Robo Agravado"},
    {"id": "GS-002", "relato": "Un sujeto con pistola me asaltó a la medianoche en el parque", "expected_tipo": "Robo Agravado", "expected_art": "Art. 189 - Robo Agravado"},
    {"id": "GS-003", "relato": "Tres hombres en una moto negra me amenazaron con cuchillo y se llevaron mi mochila", "expected_tipo": "Robo Agravado", "expected_art": "Art. 189 - Robo Agravado"},
    {"id": "GS-004", "relato": "A las 11 de la noche me metieron a un auto y me robaron todo", "expected_tipo": "Robo Agravado", "expected_art": "Art. 189 - Robo Agravado"},
    {"id": "GS-005", "relato": "Me asaltaron con un revolver a las 10pm en la avenida principal cuatro sujetos", "expected_tipo": "Robo Agravado", "expected_art": "Art. 189 - Robo Agravado"},
    {"id": "GS-006", "relato": "Dos tipos encañonados llegaron a mi casa de noche y se llevaron la televisión y joyas", "expected_tipo": "Robo Agravado", "expected_art": "Art. 189 - Robo Agravado"},
    {"id": "GS-007", "relato": "Un sujeto en moto me apuntó con un arma y me arrebató el bolso", "expected_tipo": "Robo Agravado", "expected_art": "Art. 189 - Robo Agravado"},
    {"id": "GS-008", "relato": "Anoche a las 2am tres desconocidos armados entraron a mi negocio y vaciaron la caja", "expected_tipo": "Robo Agravado", "expected_art": "Art. 189 - Robo Agravado"},
    {"id": "GS-009", "relato": "Me pusieron una navaja en el cuello en la madrugada y me quitaron el reloj y la cartera", "expected_tipo": "Robo Agravado", "expected_art": "Art. 189 - Robo Agravado"},
    {"id": "GS-010", "relato": "Dos sujetos en moto amarilla a las 8pm me encañonaron con pistola y robaron el celular nuevo", "expected_tipo": "Robo Agravado", "expected_art": "Art. 189 - Robo Agravado"},
    # Casos de Robo Simple (Art. 188)
    {"id": "GS-011", "relato": "Un tipo me golpeó en la cabeza y huyó con mi mochila", "expected_tipo": "Robo Simple", "expected_art": "Art. 188 - Robo Simple"},
    {"id": "GS-012", "relato": "Me empujaron al piso y me quitaron la billetera y salieron corriendo", "expected_tipo": "Robo Simple", "expected_art": "Art. 188 - Robo Simple"},
    {"id": "GS-013", "relato": "Un hombre me amenazó verbalmente y me obligó a entregarle el celular", "expected_tipo": "Robo Simple", "expected_art": "Art. 188 - Robo Simple"},
    {"id": "GS-014", "relato": "Me jalaron del brazo con fuerza y se llevaron la cartera", "expected_tipo": "Robo Simple", "expected_art": "Art. 188 - Robo Simple"},
    {"id": "GS-015", "relato": "Un sujeto me tiró al piso de un golpe y huyó con mis pertenencias", "expected_tipo": "Robo Simple", "expected_art": "Art. 188 - Robo Simple"},
    # Casos de Arrebato / Cogoteo
    {"id": "GS-016", "relato": "Me cogotearon y me quitaron el celular en el paradero del bus", "expected_tipo": "Arrebato / Cogoteo", "expected_art": "Art. 188 - Robo Simple"},
    {"id": "GS-017", "relato": "Jalaron mi cartera de las manos mientras caminaba y corrieron", "expected_tipo": "Arrebato / Cogoteo", "expected_art": "Art. 188 - Robo Simple"},
    {"id": "GS-018", "relato": "Un tipo en bicicleta pasó y me arrancó el celular de la mano", "expected_tipo": "Arrebato / Cogoteo", "expected_art": "Art. 188 - Robo Simple"},
    {"id": "GS-019", "relato": "Me quitaron el bolso de un jalón mientras hablaba por teléfono", "expected_tipo": "Arrebato / Cogoteo", "expected_art": "Art. 188 - Robo Simple"},
    {"id": "GS-020", "relato": "Un muchacho me cogoteó desde atrás y se llevó mi reloj", "expected_tipo": "Arrebato / Cogoteo", "expected_art": "Art. 188 - Robo Simple"},
    # Casos de Hurto Agravado (Art. 186)
    {"id": "GS-021", "relato": "Anoche dos personas se metieron a mi casa escalando la pared y se llevaron el televisor", "expected_tipo": "Hurto Agravado", "expected_art": "Art. 186 - Hurto Agravado"},
    {"id": "GS-022", "relato": "Forzaron la puerta de mi cuarto mientras dormía y me quitaron el laptop", "expected_tipo": "Hurto Agravado", "expected_art": "Art. 186 - Hurto Agravado"},
    {"id": "GS-023", "relato": "Entraron a mi casa de madrugada por la ventana y robaron joyas y efectivo", "expected_tipo": "Hurto Agravado", "expected_art": "Art. 186 - Hurto Agravado"},
    {"id": "GS-024", "relato": "De noche unos ladrones tumbaron el candado y se llevaron las herramientas de mi taller", "expected_tipo": "Hurto Agravado", "expected_art": "Art. 186 - Hurto Agravado"},
    {"id": "GS-025", "relato": "Cuando llegué a casa encontré que habían roto la ventana y faltaban el televisor y el celular de repuesto", "expected_tipo": "Hurto Agravado", "expected_art": "Art. 186 - Hurto Agravado"},
    # Casos de Hurto Simple (Art. 185)
    {"id": "GS-026", "relato": "Me sacaron la billetera del bolsillo sin que me diera cuenta en el mercado", "expected_tipo": "Hurto Simple", "expected_art": "Art. 185 - Hurto Simple"},
    {"id": "GS-027", "relato": "Alguien metió la mano en mi mochila y me robó el celular en el bus", "expected_tipo": "Hurto Simple", "expected_art": "Art. 185 - Hurto Simple"},
    {"id": "GS-028", "relato": "Se llevaron mi laptop de la mesa del café mientras fui al baño", "expected_tipo": "Hurto Simple", "expected_art": "Art. 185 - Hurto Simple"},
    {"id": "GS-029", "relato": "Me distrajeron con una pregunta y en ese momento me sacaron el celular del bolsillo", "expected_tipo": "Hurto Simple", "expected_art": "Art. 185 - Hurto Simple"},
    {"id": "GS-030", "relato": "En el mercado me robaron la billetera de la cartera sin que lo sintiera", "expected_tipo": "Hurto Simple", "expected_art": "Art. 185 - Hurto Simple"},
    {"id": "GS-031", "relato": "Alguien aprovechó que estaba distraído mirando el teléfono y sacó mi cargador de la mochila", "expected_tipo": "Hurto Simple", "expected_art": "Art. 185 - Hurto Simple"},
    {"id": "GS-032", "relato": "Se robaron mi casco del asiento de la moto que dejé un momento sin vigilar", "expected_tipo": "Hurto Simple", "expected_art": "Art. 185 - Hurto Simple"},
    # Casos mixtos / límite
    {"id": "GS-033", "relato": "Dos personas en moto me arrebataron el celular de la mano de noche sin arma", "expected_tipo": "Robo Agravado", "expected_art": "Art. 189 - Robo Agravado"},
    {"id": "GS-034", "relato": "Un sujeto entró a mi patio en la noche y sin violencia se llevó la bicicleta", "expected_tipo": "Hurto Agravado", "expected_art": "Art. 186 - Hurto Agravado"},
    {"id": "GS-035", "relato": "Me amenazaron por teléfono que si no les daba dinero iban a hacerme daño", "expected_tipo": "Robo Simple", "expected_art": "Art. 188 - Robo Simple"},
    {"id": "GS-036", "relato": "Fui a comprar algo en redes sociales, pagué y el vendedor desapareció sin enviar el producto", "expected_tipo": "Estafa", "expected_art": "No Aplica"},
    {"id": "GS-037", "relato": "Me dijeron que ganaba un premio y para recibirlo debía depositar dinero primero, y lo hice", "expected_tipo": "Estafa", "expected_art": "No Aplica"},
    {"id": "GS-038", "relato": "Cuatro sujetos en dos motos con armas de fuego asaltaron mi bodega al cierre", "expected_tipo": "Robo Agravado", "expected_art": "Art. 189 - Robo Agravado"},
    {"id": "GS-039", "relato": "Alguien entró por el techo del local mientras estaba cerrado y se llevó la recaudación", "expected_tipo": "Hurto Agravado", "expected_art": "Art. 186 - Hurto Agravado"},
    {"id": "GS-040", "relato": "Me jalaron el cuello desde una moto dos sujetos de noche y me quitaron el collar de oro", "expected_tipo": "Robo Agravado", "expected_art": "Art. 189 - Robo Agravado"},
]


async def evaluate_pipeline(
    gold_standard: list[dict],
    output_dir: Path,
    verbose: bool = True,
) -> dict[str, Any]:
    """
    Evalúa el pipeline RAG contra el gold standard.
    Calcula: Accuracy, Precision, Recall, F1-score, Latencia promedio.
    """
    logger.info(f"Iniciando evaluación sobre {len(gold_standard)} casos...")

    # Inicializar servicios
    if not vector_store_service.is_initialized:
        logger.info("Inicializando vector store...")
        vector_store_service.initialize()

    results = []
    correct_tipo = 0
    total_latencia = 0.0
    errors = 0

    # Matrices de confusión por clase
    from collections import defaultdict
    tp_per_class: dict[str, int] = defaultdict(int)
    fp_per_class: dict[str, int] = defaultdict(int)
    fn_per_class: dict[str, int] = defaultdict(int)

    for i, case in enumerate(gold_standard, 1):
        case_id = case["id"]
        relato = case["relato"]
        expected_tipo = case["expected_tipo"]

        if verbose:
            print(f"\n[{i:02d}/{len(gold_standard)}] {case_id}: {relato[:60]}...")

        try:
            response = await rag_service.analyze(relato=relato, include_context=False)

            if response.success and response.tabla_denuncia:
                predicted_tipo = response.tabla_denuncia.tipo_penal.value
                is_correct = predicted_tipo == expected_tipo
                latencia = response.latencia_ms

                if is_correct:
                    correct_tipo += 1
                    tp_per_class[expected_tipo] += 1
                else:
                    fp_per_class[predicted_tipo] += 1
                    fn_per_class[expected_tipo] += 1

                total_latencia += latencia

                result = {
                    "case_id": case_id,
                    "relato": relato[:80] + "...",
                    "expected_tipo": expected_tipo,
                    "predicted_tipo": predicted_tipo,
                    "correct": is_correct,
                    "confianza": response.tabla_denuncia.confianza_clasificacion,
                    "latencia_ms": round(latencia, 2),
                    "articulo_predicho": response.tabla_denuncia.articulo.value,
                }

                if verbose:
                    status_icon = "✅" if is_correct else "❌"
                    print(
                        f"   {status_icon} Esperado: {expected_tipo:20s} | "
                        f"Predicho: {predicted_tipo:20s} | "
                        f"Confianza: {response.tabla_denuncia.confianza_clasificacion:.2f} | "
                        f"Latencia: {latencia:.0f}ms"
                    )
            else:
                errors += 1
                result = {
                    "case_id": case_id,
                    "relato": relato[:80] + "...",
                    "expected_tipo": expected_tipo,
                    "predicted_tipo": "ERROR",
                    "correct": False,
                    "error": response.error,
                    "latencia_ms": response.latencia_ms,
                }
                if verbose:
                    print(f"   ⚠️  ERROR: {response.error}")

        except Exception as e:
            errors += 1
            logger.error(f"Error evaluando {case_id}: {e}")
            result = {
                "case_id": case_id,
                "relato": relato[:80] + "...",
                "expected_tipo": expected_tipo,
                "predicted_tipo": "EXCEPTION",
                "correct": False,
                "error": str(e),
                "latencia_ms": 0,
            }

        results.append(result)

    # ── Calcular métricas globales ────────────────────────────────────────────
    total = len(gold_standard) - errors
    accuracy = correct_tipo / len(gold_standard) if gold_standard else 0
    latencia_promedio = total_latencia / total if total > 0 else 0

    # Macro F1
    all_classes = set(list(tp_per_class.keys()) + list(fn_per_class.keys()))
    precisions, recalls, f1s = [], [], []

    for cls in all_classes:
        tp = tp_per_class[cls]
        fp = fp_per_class[cls]
        fn = fn_per_class[cls]
        p = tp / (tp + fp) if (tp + fp) > 0 else 0
        r = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * p * r / (p + r) if (p + r) > 0 else 0
        precisions.append(p)
        recalls.append(r)
        f1s.append(f1)

    macro_precision = sum(precisions) / len(precisions) if precisions else 0
    macro_recall = sum(recalls) / len(recalls) if recalls else 0
    macro_f1 = sum(f1s) / len(f1s) if f1s else 0

    metrics = {
        "timestamp": datetime.now().isoformat(),
        "total_casos": len(gold_standard),
        "casos_evaluados": total,
        "casos_con_error": errors,
        "casos_correctos": correct_tipo,
        "accuracy": round(accuracy, 4),
        "macro_precision": round(macro_precision, 4),
        "macro_recall": round(macro_recall, 4),
        "macro_f1_score": round(macro_f1, 4),
        "latencia_promedio_ms": round(latencia_promedio, 2),
        "resultados_detallados": results,
    }

    # ── Guardar reporte ───────────────────────────────────────────────────────
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = output_dir / f"evaluation_report_{timestamp_str}.json"

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)

    # ── Imprimir resumen ──────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  REPORTE DE EVALUACIÓN DEL PIPELINE RAG")
    print("  SistemaRAG · Denuncias Patrimoniales - Tesis 2026")
    print("=" * 70)
    print(f"  Total de casos      : {len(gold_standard)}")
    print(f"  Casos correctos     : {correct_tipo}")
    print(f"  Casos con error     : {errors}")
    print(f"  ─────────────────────────────────────────────")
    print(f"  Accuracy            : {accuracy:.4f}  ({accuracy*100:.1f}%)")
    print(f"  Macro Precision     : {macro_precision:.4f}")
    print(f"  Macro Recall        : {macro_recall:.4f}")
    print(f"  Macro F1-Score      : {macro_f1:.4f}")
    print(f"  Latencia promedio   : {latencia_promedio:.1f} ms")
    print(f"  ─────────────────────────────────────────────")
    print(f"  Reporte guardado en : {report_path}")
    print("=" * 70)

    return metrics


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluador del Pipeline RAG - SistemaRAG Denuncias",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--gold-standard",
        type=Path,
        default=None,
        help="Ruta al archivo JSON del Gold Standard (default: datos embebidos)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("../data/evaluation_reports"),
        help="Directorio de salida para reportes",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        default=True,
        help="Mostrar resultados caso por caso",
    )
    args = parser.parse_args()

    # Cargar gold standard externo si se provee
    gold_data = GOLD_STANDARD
    if args.gold_standard and args.gold_standard.exists():
        with open(args.gold_standard, encoding="utf-8") as f:
            gold_data = json.load(f)
        logger.info(f"Gold standard cargado: {len(gold_data)} casos desde {args.gold_standard}")

    await evaluate_pipeline(
        gold_standard=gold_data,
        output_dir=args.output_dir,
        verbose=args.verbose,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
