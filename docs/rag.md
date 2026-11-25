# RAG como posible reto

RAG (Retrieval-Augmented Generation): el agente busca primero en vuestros documentos o datos y responde con lo que
encuentra, citando la fuente. Así no se inventa nada. Es uno de los retos más probables en un hackathon de agentes y
datos, porque se presta a una demo clara: "pregunta sobre nuestros manuales/contratos/tickets y el agente responde con
la fuente".

## Qué opción elegir (de más simple a más montada)
| Situación del reto | Opción | Por qué |
|---|---|---|
| Pocos documentos (cabe en ~1M tokens: decenas de PDF) | **Meterlos en el prompt** (con context caching si se repite) | Cero infraestructura. Gemini 3.8 Flash y 4 tienen 1M de contexto. Es lo más rápido de montar |
| Muchos PDF/Docs y queréis algo gestionado dentro de ADK | **RAG Engine** + herramienta `VertexAiRagRetrieval` de ADK | Google trocea, vectoriza e indexa. Es la historia más "plataforma de Google" para un agente ADK |
| Buscador tipo empresa, varias fuentes (Drive, web, BigQuery), o Gemini Enterprise | **Agent Search** (antes Vertex AI Search) | Llave en mano, con conectores. Requiere habilitar `discoveryengine.googleapis.com` |
| Los datos ya están en BigQuery (tablas, tickets, descripciones) | **Embeddings + `VECTOR_SEARCH` en BigQuery** | Sin mover datos. Combina filtros SQL con búsqueda semántica (RAG híbrido) |

Regla rápida: si os dan **documentos**, RAG Engine. Si os dan **tablas**, BigQuery. Si os dan **poquito**, al prompt.
Elegid el más simple que resuelva el reto (AGENTS.md §7.6).

## Estado en hackathon-prueba-antonio (2026-11-25)
- RAG Engine responde en us-central1, us-east4, europe-west1, europe-west3 y europe-west4 (sin corpus creados).
  Que se puedan listar no garantiza que se puedan crear corpus en todas esas regiones: comprobadlo al crear el primero.
- Embeddings: `gemini-embedding-001` funciona en `global` y en `us-central1` (3072 dimensiones; se puede reducir con
  `output_dimensionality`, por ejemplo 768). `gemini-embedding-2` solo en `global`.
- Agent Search: API no habilitada.
- BigQuery: API y `bigqueryconnection` habilitadas (necesarias para llamar a Gemini o embeddings desde SQL).

## Plan para montarlo rápido (RAG Engine + ADK)
1. Bucket `gs://bucket-antonio-rag-<sufijo>` y subir los documentos del reto (pedir confirmación: crea recursos).
2. Crear el corpus en RAG Engine con `gemini-embedding-001` e importar desde el bucket. Trozos de ~500–1000 tokens
   con solapamiento de ~100.
3. Agente ADK (`gemini-3.8-flash`, thinking `low`) con la herramienta `VertexAiRagRetrieval` (top_k 5).
   Instrucción: "responde solo con lo recuperado, cita el documento y di 'no lo sé' si no está".
4. Evaluación: 5–10 preguntas con respuesta conocida en `tests/`, incluidas un par cuya respuesta NO está en los
   documentos (para comprobar que dice "no lo sé"). Medir aciertos y latencia.
5. Desplegar en Cloud Run (`adk deploy cloud_run --with_ui`) o en Agent Runtime.

Ojo: según la documentación, gemini-4-argon **no** admite RAG Engine como herramienta. gemini-3.8-flash sí.

## Qué valora el jurado en un RAG
- Respuestas con **cita de la fuente** (documento y página o fila).
- Que diga **"no lo sé"** cuando no está en los datos, en vez de inventar.
- **Evaluación** con preguntas reales y su resultado (aciertos, latencia).
- Seguridad: los documentos pueden traer prompt injection; usad callbacks o Model Armor (AGENTS.md §8).
