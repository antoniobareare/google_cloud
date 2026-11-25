# Qué modelo de Gemini usar para cada tarea

Medido el 2026-11-25 en `hackathon-prueba-antonio` (ubicación `global`, desde España), más la documentación oficial
de Google. En otro proyecto o laboratorio, repetid la prueba: la disponibilidad cambia.
Script: `scripts/bench_modelos.py` (4 tareas × 3 repeticiones en caliente). Es una muestra pequeña: sirve para
orientarse, no como benchmark.

## Recomendación rápida
| Tarea | Modelo | Ajuste | Por qué |
|---|---|---|---|
| **Agente principal con herramientas** | `gemini-3.8-flash` | `thinking_level="low"` | GA hasta 2027, 3/3 en todo, ~1,6 s. Google lo define como "workhorse… for autonomous agents". Admite RAG Engine |
| Agente principal si la latencia manda | `gemini-4-hydrogen` | `low` | 1,3–2,3 s y 3/3 en todo, incluido razonar. Pero tiene "disponibilidad más corta" y dio un 504 en frío: probadlo en el caso real antes |
| **Enrutar, clasificar, extraer a JSON, rellenar parámetros de herramientas** | `gemini-3.5-flash-lite` | por defecto | 0,6–1 s, 3/3 en clasificar, extraer y llamar a herramientas |
| Clasificar miles de filas | `gemini-3.5-flash-lite` (o `gemini-3.1-flash-lite`) | `minimal` | El más barato y rápido. Mejor por lotes o desde BigQuery |
| **Razonamiento duro** (planificador, revisor, cálculo de varios pasos) | `gemini-4-argon` | `low` (o `medium`) | 3/3 con muy pocos tokens, ~2,5–3,6 s. Es el modelo "frontier" de Google |
| Alternativa de razonamiento | `gemini-3.1-pro-preview` | `low` | Correcto pero el más lento (4–6,5 s) y está en preview. Solo si Argon no está |
| RAG / embeddings | `gemini-embedding-001` | `output_dimensionality=768` si basta | GA, funciona en `global` y `us-central1` |
| Vídeo, audio, multimodal | `gemini-3.8-flash` (comprensión), `gemini-omni-1.2-flash` (generar o editar vídeo) | | Según la documentación oficial |
| Voz en tiempo real | `gemini-3.8-live` (solo en us-central1 según el catálogo) | | No probado |

**No usar:** `gemini-3.5-flash-lite` para razonar (0/3 en el problema de cálculo), `gemini-2.5-*` (404, retirados),
`gemini-3.6-flash` (retirado el 2026-11-19) ni `gemini-3.7-flash` (se retira el 2027-01-28). `gemini-4-carbon` es la
variante "frontier" para empresas verificadas y ciberseguridad, así que no aporta nada para un agente normal.

## Resultados (mediana en caliente, en segundos · aciertos de 3)
| Modelo (thinking) | Clasificar | Extraer JSON | Llamar herramienta | Razonar (cálculo) |
|---|---|---|---|---|
| 3.5-flash-lite (minimal) | 0,66 · 3/3 | 1,02 · 3/3 | 0,72 · 3/3 | 0,61 · **0/3** |
| 3.5-flash-lite (defecto) | 0,55 · 3/3 | 0,81 · 3/3 | 0,71 · 3/3 | 0,66 · **0/3** |
| 3.8-flash (low) | 1,60 · 3/3 | 1,59 · 3/3 | 10,29* · 3/3 | 1,74 · 3/3 |
| 3.8-flash (defecto = medium) | 3,04 · 3/3 | 12,29 · 3/3 | 2,27 · 3/3 | 2,99 · 3/3 |
| 4-hydrogen (low) | 10,48** · 1/1 | 2,31 · 3/3 | 1,71 · 3/3 | 1,28 · 3/3 |
| 4-neon (low) | 3,45 · 3/3 | 6,04 · 3/3 | 2,17 · 3/3 | 3,13 · 3/3 |
| 4-argon (low) | 2,54 · 3/3 | 3,37 · 3/3 | 2,85 · 3/3 | 3,61 · 3/3 |
| 3.1-pro-preview (low) | 4,00 · 3/3 | 6,48 · 3/3 | 5,45 · 3/3 | 5,75 · 3/3 |

\* Picos puntuales: la misma tarea tarda 1–2 s casi siempre, pero a veces 10 s. \** Un 504 por tiempo agotado y luego
una llamada lenta. Lección: **timeout en el cliente y un reintento** (AGENTS.md §9).

Lo que enseñan los datos:
- **El thinking por defecto (`medium`) dispara tokens y latencia**: 3.8-flash extrayendo JSON pasa de 1,6 s a 12,3 s
  y de 36 a 697 tokens. Fijad `low` salvo que la tarea lo necesite.
- **Argon razona con muy pocos tokens** (6 en el cálculo frente a 96–300 de los demás), así que sale barato aunque el
  precio por token sea mayor.
- **Neon** no tiene página oficial y no destaca en nada. No lo usaría.

## Ubicaciones
| Ubicación | Generación (3.8-flash, 3.5-flash-lite, 4-hydrogen, 4-argon) | gemini-embedding-001 |
|---|---|---|
| `global` | ✅ | ✅ |
| `eu` (multirregión) | ✅ | ❌ 404 |
| `us` (multirregión) | ✅ | ❌ 404 |
| `us-central1`, `europe-west1` | ❌ 404 | ✅ en us-central1 |

- Por defecto `GOOGLE_CLOUD_LOCATION=global`, que es lo más rápido y donde está todo.
- **`eu` sirve si el reto pide que los datos no salgan de Europa** (cliente europeo, RGPD). Es un buen argumento ante el
  jurado y la latencia es igual.
- Los embeddings tienen que ir en `global` o en una región concreta (us-central1), no en `eu` ni en `us`.

## Parámetros (documentación de 3.8 Flash y Gemini 4)
- `thinking_level`: `LOW`, `MEDIUM` (por defecto) o `HIGH`. `MINIMAL` da error 400 en 3.8-flash y en Gemini 4; solo lo
  admite Flash-Lite. No mezclar con `thinking_budget`.
- `temperature`, `top_p` y `top_k` se ignoran en 3.8-flash y Gemini 4. El determinismo se consigue con `thinking_level`
  y `response_schema`. `candidate_count`, `frequency_penalty` y `presence_penalty` dan error.
- En ADK: `planner=BuiltInPlanner(thinking_config=types.ThinkingConfig(thinking_level="low"))` (AGENTS.md §9.1).
- Contexto: 1M de tokens (3.8-flash, Argon). Salida máxima: 65 536 tokens en 3.8-flash.
- Gemini 4 Argon admite function calling, salida estructurada, ejecución de código, URL context y grounding con Google
  Search y Agent Search, pero **no RAG Engine**.

## Precio orientativo (por millón de tokens, entrada / salida)
Fuentes de terceros sin verificar. Mirad la página oficial de precios antes de dar cifras al jurado:
3.5-flash-lite ~0,30 / 2,50 $ · 3.8-flash ~0,75 $ de entrada · 4-hydrogen ~1,50 / 7,50 $ · 4-argon ~2 / 10 $
(precio de lanzamiento hasta el 30-11-2026, luego ~4 / 20 $).
Para un hackathon el coste es irrelevante. Lo que importa es la latencia y los aciertos.

## Fuentes
- Modelos de Google: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models
- Versiones y retirada: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions
- Guía de 3.8 Flash: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-flash
