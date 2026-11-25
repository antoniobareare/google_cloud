# Reglas del agente – Hackathon Google Cloud (agentes y datos)

Archivo de reglas compartido por Antigravity y Claude Code (CLAUDE.md lo importa).
Léelo entero al empezar y síguelo siempre.

## 0. Arranque rápido (lo primero en cada sesión)
1. Lee docs/reto.md si existe. Si no existe, pregunta al usuario por el reto.
2. Ejecuta la sección 2 (conexión) y la sección 3 (inventario).
3. Propón un plan por pasos con la arquitectura ANTES de crear o cambiar nada.
4. Escribe en docs/reto.md la frase de la demo: "El usuario X pide Y, el agente consulta Z y hace W".

## 1. Contexto
- Hackathon de Google Cloud de un partner (Devoteam). Lo más probable: retos de agentes (ADK, LangGraph, Agent Runtime, Gemini Enterprise) y datos (BigQuery). También puede ser un laboratorio con infraestructura rota que hay que arreglar.
- Se valora: caso de negocio claro, uso real del stack de Google (Gemini, ADK, Agent Runtime, BigQuery) y algo DESPLEGADO que funcione, observable y evaluado. Un agente modesto desplegado gana a uno ambicioso que solo corre en local.
- Idioma: responde y documenta en español.

### Nombres nuevos (desde abril de 2026) — reconoce ambos
| Nombre nuevo | Nombre antiguo (tutoriales, SDK) |
|---|---|
| Gemini Enterprise Agent Platform ("Agent Platform") | Vertex AI |
| Agent Runtime | Vertex AI Agent Engine |
| Agent Studio | Vertex AI Studio |
| Agent Search | Vertex AI Search |
| Agent Platform Evals | Gen AI evaluation service |
- El SDK sigue siendo google-cloud-aiplatform y se importa como vertexai. Los comandos siguen diciendo agent_engine / agent_engines.

## 2. Conexión a Google Cloud (primer paso siempre)
1. gcloud --version  (si no está, avisa al usuario; plan B: Cloud Shell)
2. gcloud config list  → cuenta y proyecto activos
3. gcloud auth list    → si no hay cuenta o es la equivocada, PIDE al usuario que ejecute `gcloud auth login` (se abre el navegador; la contraseña nunca pasa por ti).
4. Para el código (ADC): pide al usuario `gcloud auth application-default login` y después ejecuta `gcloud auth application-default set-quota-project <ID>`.
5. gcloud projects list → pregunta cuál es el proyecto del reto y fíjalo: gcloud config set project <ID>
6. Comprueba que hay facturación: gcloud billing projects describe <ID>  (sin facturación casi nada funciona).
7. Regiones:
   - Modelos Gemini: GOOGLE_CLOUD_LOCATION=global (o us-central1). Lo nuevo llega antes ahí.
   - Cloud Run, Storage, etc.: la que diga el reto; si no, europe-west1. Fíjala: gcloud config set run/region <región>
   - BigQuery: multirregión EU (o la del dataset del reto). No se pueden hacer JOIN entre ubicaciones distintas.
   - Agent Runtime: us-central1 salvo que el reto diga otra.
- Si se usa una configuración separada: gcloud config configurations activate hackathon
- Nunca pidas, pegues ni guardes contraseñas, tokens o claves JSON de cuentas de servicio. Usa solo ADC y las credenciales locales de gcloud.
- Cuentas de laboratorio (Qwiklabs / Skills Boost): son temporales y con permisos limitados. Si algo falla por permisos, explica qué falta; no intentes cambiar IAM sin permiso.

## 3. Inventario (antes de tocar nada)
Genera docs/inventario.md con:
- APIs: gcloud services list --enabled
- Cómputo: gcloud run services list; gcloud compute instances list; gcloud container clusters list; gcloud functions list
- Agentes desplegados en Agent Runtime (consola o SDK) y modelos usados
- Datos: bq ls (y bq ls <dataset>); gcloud storage ls; gcloud sql instances list
- Red: gcloud compute networks list; gcloud compute firewall-rules list
- IAM: gcloud iam service-accounts list y roles de cada cuenta relevante
- Secretos: gcloud secrets list
Explícalo al usuario en pocas líneas y señala lo que parezca roto o raro.

## 4. Habilitar APIs (solo las que falten)
gcloud services enable aiplatform.googleapis.com run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com bigquery.googleapis.com storage.googleapis.com secretmanager.googleapis.com logging.googleapis.com cloudtrace.googleapis.com
Si el reto lo pide: discoveryengine.googleapis.com (Agent Search / Gemini Enterprise), sqladmin.googleapis.com, pubsub.googleapis.com, eventarc.googleapis.com, workflows.googleapis.com.
Tras habilitar, espera uno o dos minutos antes de reintentar.

## 5. Diagnóstico de fallos
1. Logs: gcloud logging read 'severity>=ERROR' --freshness=1h --limit=50
   Cloud Run: gcloud run services logs read <servicio> --region <región> --limit 50
2. Estado y configuración: gcloud run services describe <servicio> --region <región> (o el describe que toque)
3. Compara con lo esperado (y con Terraform si existe: terraform plan para ver drift).
4. Explica la causa probable y el arreglo ANTES de aplicarlo.

### Errores frecuentes
| Error | Causa probable | Solución |
|---|---|---|
| API ... has not been used ... or it is disabled | API sin habilitar | gcloud services enable <api>, esperar 1–2 min |
| PERMISSION_DENIED desde Cloud Run / Agent Runtime | La cuenta de servicio del despliegue no tiene el rol | Dar el rol a ESA cuenta, no al usuario (pide confirmación) |
| Could not automatically determine credentials | Falta ADC en local | gcloud auth application-default login |
| Error de quota project o facturación en local | ADC sin proyecto de cuota | gcloud auth application-default set-quota-project <ID> |
| 404 model not found | Modelo no existe en esa ubicación o ID mal escrito | GOOGLE_CLOUD_LOCATION=global o copiar el ID exacto de Model Garden |
| 429 Resource exhausted | Cuota o límite de tasa del modelo | Reintentos con espera exponencial, otro modelo u otra región |
| Falla el build de adk deploy | La cuenta de cómputo por defecto no puede usar Cloud Build | Conceder el rol de Cloud Build que indica la guía de ADK (confirmar) |
| Cloud Run responde 403 | Servicio privado sin token | curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" <URL> |
| Contenedor no arranca en Cloud Run | No escucha en $PORT (8080) o falla al iniciar | Revisar logs de arranque y el puerto |
Otras causas: variables de entorno o secretos ausentes, región equivocada, imagen inexistente, firewall, cuotas, facturación desactivada.

## 6. Arreglos y despliegues
- En el hackathon se permite usar gcloud directamente para ir rápido.
- Si el proyecto ya usa Terraform: cambios en Terraform → fmt, validate, plan, resumen del plan (qué crea, cambia y DESTRUYE) y confirmación antes de apply.
- Tras cada cambio verifica que funciona (URL, logs, estado) y díselo al usuario.
- Registra cada cambio en docs/cambios.md: qué, por qué, quién y cómo revertirlo.

## 7. Retos de agentes

### 7.1 Entorno
- Python 3.11+: `uv venv && source .venv/bin/activate` (o python -m venv .venv)
  - Windows: Git Bash → `source .venv/Scripts/activate`; PowerShell → `.\.venv\Scripts\Activate.ps1` (en PowerShell 5.1 no existe `&&`: usa `;`).
- Paquetes: uv pip install google-adk "google-cloud-aiplatform[agent_engines,adk]" google-cloud-bigquery langgraph langchain-google-vertexai
- Fija versiones en requirements.txt.
- .env (NUNCA al repo; usa .env.example como plantilla):
  GOOGLE_GENAI_USE_VERTEXAI=True
  GOOGLE_CLOUD_PROJECT=<ID>
  GOOGLE_CLOUD_LOCATION=global
- Usa SIEMPRE Gemini vía Agent Platform (Vertex, con ADC/IAM), no la Gemini Developer API con API key, salvo que el reto diga lo contrario.
- Prueba de humo antes de construir: script con google-genai que llame al modelo Flash y responda "Hola". Si falla, arregla conexión/API/facturación antes de seguir.

### 7.2 Elegir modelo
- No inventes IDs: copia el ID exacto y GA desde Model Garden (cambian cada pocos meses).
- Flash (serie 3.x) para el agente principal y las herramientas.
- Pro / Gemini 4 solo para el paso de razonamiento duro (planificador, revisor), si la latencia lo permite.
- Flash-Lite para tareas masivas (clasificar miles de filas, enrutar).
- Embeddings: gemini-embedding-001.
- Si el reto espera Gemini como modelo principal, no uses modelos de terceros.

### 7.3 Construir con ADK
- `adk create <agente>` → carpeta con __init__.py, agent.py (define root_agent) y .env.
- Cada agente: name, model, description, instruction (rol, tono, límites, formato de salida) y tools.
- Herramientas: funciones Python con tipos y docstring claro (es lo que lee el modelo para decidir). "Herramientas antes que prompts": una buena herramienta mejora más que diez versiones del prompt.
- google_search y otras integradas no siempre se combinan con otras herramientas en el mismo agente: envuélvelas en un subagente y úsalo con AgentTool.
- Salida estructurada (output_schema / response_schema con Pydantic) cuando haya que encadenar pasos o el formato esté definido.
- Patrones multiagente (elige el más simple que resuelva el reto):
  1. Coordinador + especialistas (sub_agents).
  2. Pipeline: SequentialAgent([...]) con output_key en cada paso.
  3. Fan-out/fan-in: ParallelAgent + agente sintetizador.
  4. Generador + crítico: LoopAgent con max_iterations.
  5. AgentTool cuando el padre debe conservar el control.
  6. A2A: RemoteA2aAgent para agentes remotos o de otro framework.
- Regla de diseño: determinista donde puedas, agéntico donde aporte.
- Estado: tool_context.state; prefijos user: y app: para persistir entre sesiones.
- Callbacks para barreras de seguridad, logging y filtros de PII; confirmación de herramienta para acciones con efecto.
- Probar en local: adk web (interfaz), adk run <agente>, adk api_server.

### 7.4 LangGraph (si el flujo es un grafo con estados y ramas, o ya hay código LangChain)
- Gemini con ChatVertexAI(model=..., location="global").
- En producción no uses MemorySaver: checkpointer en Cloud SQL/AlloyDB (PostgresSaver). thread_id = clave de sesión.
- Limita pasos con recursion_limit.
- Despliegue: plantilla LanggraphAgent en Agent Runtime, o FastAPI en Cloud Run.
- Mezcla con ADK vía A2A si el reto pide interoperabilidad.

### 7.5 Datos con BigQuery
- Jerarquía proyecto.dataset.tabla; dialecto GoogleSQL; nombres con comillas invertidas.
- Coste por bytes escaneados: nada de SELECT * en tablas grandes; filtra por partición; usa --dry_run antes de consultas grandes y maximum_bytes_billed en el código.
- Carga rápida: bq load --autodetect (CSV) o PARQUET desde gs://.
- Conectar datos y agentes, de más seguro a menos: consultas parametrizadas como herramientas (MCP Toolbox for Databases) → toolset de BigQuery de ADK → SQL libre del LLM (evitar).
- Cuenta de servicio del agente: roles/bigquery.dataViewer en el dataset y roles/bigquery.jobUser en el proyecto.
- IA en SQL: AI.GENERATE / AI.GENERATE_TABLE (clasificar, extraer), AI.FORECAST, AI.DETECT_ANOMALIES, VECTOR_SEARCH.
- "Habla con tus datos" sin código: agentes de datos de BigQuery (Conversational Analytics).

### 7.6 RAG (documentos propios)
Pocos documentos → pásalos directamente al prompt. Corpus gestionado → RAG Engine (herramienta de ADK). Buscador llave en mano → Agent Search. Datos ya en BigQuery/AlloyDB → VECTOR_SEARCH / pgvector.

### 7.7 Desplegar
- Cloud Run (lo más rápido hacia una URL de demo):
  adk deploy cloud_run --project=<ID> --region=<región> --service_name=<nombre> --with_ui <agente>
  (--with_ui sube también la interfaz de adk web, útil para la demo)
  Alternativa genérica: gcloud run deploy <nombre> --source . --region <región> --service-account <sa> --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=True,GOOGLE_CLOUD_LOCATION=global --set-secrets <VAR>=<secreto>:latest --no-allow-unauthenticated --min-instances 0
- Agent Runtime (mejor historia de "producción en la plataforma de Google": sesiones, memoria, identidad, A2A):
  adk deploy agent_engine --project=<ID> --region=us-central1 --display_name="<nombre>" <agente>
  o con el SDK: vertexai.Client(...).agent_engines.create(agent=AdkApp(...), config={requirements, staging_bucket, display_name, env_vars, min_instances: 0}). Si falla, revisa la versión del SDK (la doc nueva también usa client.runtimes.create).
- COSTE: en Agent Runtime min_instances es 1 por defecto (una instancia siempre encendida). Pon min_instances=0 salvo durante la demo.
- Agents CLI (alternativa): agents-cli create / playground / deploy / eval / publish.
- No uses nombres reservados (PORT, GOOGLE_CLOUD_PROJECT) en env_vars de Agent Runtime.
- Tras desplegar: prueba con una consulta real y revisa logs.

### 7.8 Exponer a usuarios
- Frontend propio (Streamlit, Gradio, Next.js) en otro servicio de Cloud Run.
- Gemini Enterprise: publicar el agente (agents-cli publish o registro desde Agent Runtime). Revisa permisos y conectores de datos que pida el reto.
- A2A: exponer el agente como servidor A2A con su agent card.

### 7.9 Diagnóstico de agentes que fallan
Modelo o API no disponible en la región, permisos de Agent Platform (roles/aiplatform.user), variables de entorno mal puestas, herramientas con errores o sin docstring/tipos, cuotas (429), integradas que no se combinan con otras herramientas, bucles sin límite. Explica el fallo antes de cambiar nada.

## 8. Producción visible (suma puntos ante el jurado)
- Cuenta de servicio dedicada por agente/servicio con mínimo privilegio (o Agent Identity en Agent Runtime). Nunca la cuenta de cómputo por defecto en lo final.
- Secretos en Secret Manager (--set-secrets o referencias en env_vars).
- Trazas: ADK emite OpenTelemetry → Cloud Trace (en Agent Runtime, habilita la telemetría al desplegar).
- Logs estructurados con session_id y user_id.
- Evaluación: 5–10 casos en tests/ ejecutados con adk eval (trayectoria + respuesta final).
- Seguridad: Model Armor o callbacks contra prompt injection/PII; confirmación humana para acciones con efecto; consultas parametrizadas en vez de SQL libre.
- Diagrama de arquitectura en docs/arquitectura.md (Mermaid).

## 9. Optimizar para la evaluación (por si se puntúa de forma automática)
Al montar un agente o flujo, quien lo construya (el orquestador incluido) debe optimizar:
- Corrección: respuestas exactas y en el formato del enunciado. Juego de pruebas en tests/, ejecutado tras cada cambio.
- Latencia: modelo más rápido que dé la calidad necesaria (Flash antes que Pro), instrucciones concisas, pocas llamadas encadenadas, herramientas rápidas, context caching si el prompt es largo y repetido. Mide el tiempo de respuesta.

### 9.1 Latencia medida (2026-11-25, agente ADK + 1 herramienta BigQuery, desde España, ubicación global)
| Configuración | 1ª petición (fría) | Mediana en caliente | Aciertos |
|---|---|---|---|
| gemini-3.8-flash, thinking por defecto | 12,3 s | 6,9 s | 3/3 |
| gemini-3.8-flash, thinking_level="low" | 7,5 s | 4,0 s | 3/3 |
| gemini-3.5-flash-lite | 6,3 s | 3,1 s | 3/3 |
| gemini-3.5-flash-lite, thinking_level="minimal" | 6,6 s | 2,95 s | 3/3 |
Llamada suelta "Hola": 3.8-flash 2,1 s por defecto → 1,4 s con low; 3.5-flash-lite 0,6 s.
BigQuery (consulta parametrizada pequeña): `query().result()` 1,4–2,4 s → `query_and_wait()` 0,7 s → con `default_job_creation_mode="JOB_CREATION_OPTIONAL"` 0,5 s.

Ajustes, de más a menos impacto:
1. Calentar: clientes (genai, BigQuery) creados una vez a nivel de módulo y una llamada de calentamiento al arrancar; en la demo, Cloud Run con min-instances=1 (pide confirmación, cuesta) y volver a 0 al acabar. Quita los 6–12 s de la primera petición.
2. Thinking acotado en ADK: `planner=BuiltInPlanner(thinking_config=types.ThinkingConfig(thinking_level="low"))`. 3.8-flash no admite "minimal" (400); Flash-Lite sí.
3. Flash-Lite para enrutar, clasificar o rellenar parámetros; Flash solo donde haga falta razonar.
4. Cada uso de herramienta = 2 llamadas al modelo (decidir + redactar). Si el flujo es fijo, resuélvelo en código.
5. BigQuery: `query_and_wait`, modo JOB_CREATION_OPTIONAL, tablas pequeñas o precalculadas, `maximum_bytes_billed`.
6. Streaming para la latencia percibida (adk web ya lo hace).
- En hackathon-prueba-antonio, gemini-3.8-flash solo existe en `global` (404 en us-central1, europe-west1, europe-west4); gemini-2.5-flash ya no está disponible (404). Comprueba los modelos del proyecto del reto con `client.models.list(config={"query_base": True})`.
- Fiabilidad: errores controlados en herramientas, reintentos con espera exponencial, respuestas por defecto. El agente nunca se queda colgado ni devuelve un error sin explicar.
- Coste: Flash por defecto, contexto acotado, max_iterations / recursion_limit, instancias mínimas a 0, nada caro encendido.
- Seguridad: permisos mínimos, Secret Manager, nada público sin necesidad.
- Laboratorios: si hay botones de "comprobar progreso", avisa al usuario para comprobar cada paso en cuanto esté hecho.
- Antes de dar algo por terminado: ejecuta las pruebas y resume aciertos, tiempo medio de respuesta y errores.

## 10. Trabajo en equipo (varias personas y agentes en el mismo proyecto)
- REGLA PRINCIPAL: no modifiques, redespliegues ni borres ningún recurso de Google Cloud que no hayas creado tú en esta sesión sin preguntar antes al usuario. Si dudas de quién lo creó, pregunta.
- Antes de tocar un recurso, mira sus labels y la actividad de administración en Cloud Logging para saber quién lo creó.
- Etiqueta lo que crees con --labels=owner=<nombre>,app=hackathon (donde el servicio lo admita).
- Pruebas con nombre propio: agente-<nombre>, bucket-<nombre>-... Nunca uses el nombre del servicio oficial de la demo.
- Solo el responsable de despliegue toca el servicio oficial. Si el usuario no lo es, no lo despliegues.
- Git: rama propia, nunca push a main, cambios por pull request; git pull antes de empezar y antes del PR; commits pequeños.
- Registra en docs/cambios.md qué has creado, para poder limpiarlo.

## 11. Pide confirmación antes de
- Borrar o destruir cualquier recurso (delete, destroy, rm)
- Cambios de IAM, firewall, red o facturación
- Desplegar (gcloud run deploy, adk deploy, terraform apply)
- Recursos caros (GPU, máquinas grandes, min_instances > 0, muchas instancias)
- Consultas BigQuery que escaneen mucho (enseña antes el --dry_run)
- Cualquier acción que no se pueda deshacer

## 12. Nunca
- Subir claves, secretos, .env, *.tfstate o terraform.tfvars al repositorio
- Descargar claves JSON de cuentas de servicio
- Abrir firewalls a 0.0.0.0/0 ni servicios públicos sin justificar y confirmar
- Asignar roles Owner o Editor
- Cambiar de proyecto o de cuenta sin avisar
- Inventar IDs de modelo, nombres de recursos o resultados

## 13. Estilo de trabajo y entrega
- Pasos cortos, explicando qué haces y por qué.
- Si algo del reto no está claro, pregunta en vez de suponer.
- Primero algo mínimo que funcione de punta a punta y desplegado; luego mejorar.
- Congela funcionalidades unas dos horas antes del final.
- Al final prepara docs/resumen.md para el jurado: problema, solución, arquitectura, servicios de Google usados, resultados de las pruebas y siguientes pasos.
- Recuerda al usuario borrar los despliegues de prueba al terminar.
