# Inventario de Google Cloud

Auditoría de solo lectura del 2026-11-25 con la cuenta personal `antoniobareare@gmail.com`.
Si el reto es un laboratorio, este inventario NO aplica: se rehace con la cuenta del lab (docs/LABORATORIO.md).

## Resumen
- 4 proyectos, todos con rol **Owner**. No hay organización, así que tampoco hay políticas de organización que limiten regiones o APIs.
- 2 cuentas de facturación abiertas.
- `hackathon-prueba-antonio` está listo para trabajar (APIs, facturación, ADC, MCP) y **vacío**: no hay recursos que cuesten dinero.
- Nada roto. Los únicos errores de las últimas 24 h son de Google al habilitar las APIs (ver "Rarezas").

## Herramientas locales
| Herramienta | Versión |
|---|---|
| Google Cloud SDK / bq | 594.0.1 / 2.1.42 |
| gh | 2.105.0 (cuenta antoniobareare, scopes repo, read:org, gist) |
| Python (.venv) / uv | 3.11.9 / 0.13.10 |
| google-adk (CLI `adk`) | 2.15.1 |
| google-genai / google-cloud-aiplatform / google-cloud-bigquery | 2.34.0 / 2.10.0 / 3.47.0 |
| langgraph / langchain-google-vertexai | 1.2.24 / 3.3.0 |
| terraform | 1.17.2 + proveedor hashicorp/google 8.12.0 (probado con un `plan` de solo lectura contra hackathon-prueba-antonio, usa el ADC) |

## Cuentas de facturación
| ID | Nombre | Proyectos vinculados |
|---|---|---|
| 015D2B-DCA929-C88BCA | Mi cuenta de facturación | hackathon-prueba-antonio, disco-vista-473214-b3 |
| 01B72F-8D72D5-AB05E7 | My Billing Account | gen-lang-client-0156398206 |

## Proyectos
| Proyecto | Para qué es | Facturación | APIs | Recursos |
|---|---|---|---|---|
| **hackathon-prueba-antonio** | Pruebas del hackathon (labels owner=antonio, app=hackathon) | Sí (015D2B…) | 34: aiplatform, run, cloudbuild, artifactregistry, bigquery, storage, secretmanager, logging, cloudtrace, pubsub, dataplex… | Ninguno: 0 Cloud Run, 0 buckets, 0 datasets, 0 secretos, 0 Agent Runtime (us-central1, europe-west1). Solo la cuenta de cómputo por defecto |
| disco-vista-473214-b3 | "My First Project" (creado por defecto) | Sí (015D2B…) | 21 (BigQuery, Storage…; **sin** aiplatform ni run) | Ninguno |
| gen-lang-client-0156398206 | "Default Gemini Project" de AI Studio (Gemini Developer API con API key) | Sí (01B72F…) | Solo generativelanguage | Ninguno visible |
| mis-fincas-df3e1 | App Firebase personal | No | Firebase, Firestore, App Engine… | Cuenta de Firebase Admin. **No tocar: no es del hackathon** |

### hackathon-prueba-antonio: IAM
| Rol | Miembro |
|---|---|
| roles/owner | antoniobareare@gmail.com |
| roles/editor | 855976332597-compute@developer.gserviceaccount.com (cuenta de cómputo por defecto) |
| Agentes de servicio | aiplatform, cloudbuild (builder + serviceAgent), containerregistry, pubsub, run |

Para lo final, crear una cuenta de servicio dedicada por agente (AGENTS.md §8). La de cómputo por defecto tiene Editor y no debe usarse en la demo final.

### Región y configuración local
- gcloud: configuración `default`, proyecto `hackathon-prueba-antonio`, `run/region=europe-west1`.
- `.env`: `GOOGLE_CLOUD_PROJECT=hackathon-prueba-antonio`, `GOOGLE_CLOUD_LOCATION=global`, `REGION=europe-west1`.
- ADC: quota project `hackathon-prueba-antonio`.
- MCP bigquery, logging y cloudrun: conectados y probados.
- GitHub: repo `antoniobareare/google_cloud` (privado), ramas `main` y `antonio/setup`.

## Modelos Gemini (hackathon-prueba-antonio)
**El catálogo (`models.list`) engaña.** Lista decenas de modelos en us-central1 y europe-west1 que luego dan 404 al
llamarlos. Lo que cuenta es la llamada real. Prueba "Responde solo: Hola", una llamada por modelo (en frío):

| Modelo | global | us-central1 | europe-west1 |
|---|---|---|---|
| gemini-3.8-flash | ✅ 5,4 s | ❌ 404 | — |
| gemini-3.7-flash | ✅ 8,8 s | — | — |
| gemini-3.5-flash-lite | ✅ 0,6 s | ❌ 404 | — |
| gemini-3.1-pro-preview | ✅ 3,1 s | — | — |
| **gemini-4-argon** | ✅ 2,7 s | — | — |
| **gemini-4-carbon** | ✅ 4,0 s | — | — |
| **gemini-4-hydrogen** | ✅ 1,2 s | — | — |
| **gemini-4-neon** | ✅ 20,1 s | ❌ 404 | — |
| gemini-2.5-flash / -lite | ❌ 404 | ❌ 404 | ❌ 404 |
| gemini-embedding-001 (3072 dim.) | ✅ | ✅ | — |
| gemini-embedding-2 (3072 dim.) | ✅ | ❌ 404 | — |

Conclusiones:
- **Todo Gemini por `GOOGLE_CLOUD_LOCATION=global`.** Aunque Cloud Run o Agent Runtime estén en otra región, el modelo se llama en global.
- **Novedad: hay 4 variantes `gemini-4-*` funcionando** (argon, carbon, hydrogen, neon). Los nombres no indican
  cuál es la grande y cuál la rápida. Antes de usar una, mira su ficha en Model Garden (AGENTS.md §7.2: no
  supongas) y mide latencia y calidad en el caso del reto. Por la latencia de esta prueba, hydrogen parece la ligera y
  neon la de razonamiento, pero una sola llamada no basta para decidirlo.
- Por defecto se mantiene lo de AGENTS.md §9.1: `gemini-3.8-flash` (thinking low) para el agente y
  `gemini-3.5-flash-lite` para enrutar o clasificar.
- Para embeddings en Agent Runtime (us-central1), `gemini-embedding-001` funciona en las dos ubicaciones.
- Fijad siempre un timeout en el cliente (`types.HttpOptions(timeout=...)`): la primera prueba, sin timeout,
  se quedó colgada más de 10 minutos.

## Rarezas encontradas
- 11 errores `SetIamPolicy` el 2026-11-25 a las 09:06 UTC, hechos por `service-agent-manager@system.gserviceaccount.com`
  ("concurrent policy changes", "service account does not exist"). Es Google creando sus agentes de servicio al habilitar
  las APIs en paralelo. La política final está bien. **No requiere acción.**
- gcloud usa su propio Python 3.10 y avisa de que ya no tiene soporte. Funciona. Si molesta:
  `export CLOUDSDK_PYTHON="$(cygpath -w "$PWD/.venv/Scripts/python.exe")"`.
- `gcloud billing ...` tiene un límite de peticiones por minuto. Si se lanza en bucle da 429: esperar un minuto.
- `gen-lang-client-0156398206` es la vía de la Gemini Developer API con API key, que tiene su propia facturación.
  En el reto se usa Gemini vía Agent Platform con ADC (AGENTS.md §7.1), no esta.

## Si el reto usa un proyecto compartido
Repetir este inventario en ese proyecto con `gcloud`/MCP (AGENTS.md §3) y comparar.
