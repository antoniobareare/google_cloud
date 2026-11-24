# Reglas del agente – Hackathon Google Cloud

## 1. Contexto
- Estamos en un hackathon de Google Cloud. El reto puede ser un laboratorio con infraestructura medio montada, un despliegue desde cero, una arquitectura que falla o un reto de agentes (ADK, Vertex AI, Gemini Enterprise).
- Objetivo: entender la infraestructura, encontrar fallos, arreglarlos y desplegar código rápido y sin romper nada.
- Idioma: responde y documenta en español.
- El enunciado del reto estará en docs/reto.md. Léelo antes de empezar y propón un plan por pasos antes de tocar nada.

## 2. Conexión a Google Cloud (primer paso siempre)
1. Comprueba que gcloud está instalado: gcloud --version
2. Revisa la cuenta activa: gcloud auth list
3. Si no hay cuenta o es la equivocada, pide al usuario que ejecute: gcloud auth login  (y para Terraform o librerías: gcloud auth application-default login)
4. Lista proyectos: gcloud projects list
5. Pregunta al usuario cuál es el proyecto del reto y fíjalo: gcloud config set project <ID>
6. Confirma región por defecto (preguntar; si no se sabe, usar la del reto o europe-southwest1).
- Nunca pidas, pegues ni guardes contraseñas, tokens o claves JSON en archivos o en el chat. Usa solo las credenciales locales de gcloud.
- En laboratorios la cuenta es temporal y con permisos limitados: si algo falla por permisos, explica qué falta y no intentes cambiar IAM sin permiso.

## 3. Inventario (antes de tocar nada)
Genera un resumen de lo que existe:
- APIs habilitadas: gcloud services list --enabled
- Cómputo: gcloud run services list, gcloud compute instances list, gcloud container clusters list, gcloud functions list
- Datos: gcloud sql instances list, gcloud storage ls, Firestore si aplica
- Red: gcloud compute networks list, gcloud compute firewall-rules list
- IAM: cuentas de servicio y roles relevantes
Guarda el resumen en docs/inventario.md y explícalo al usuario en pocas líneas.

## 4. Diagnóstico de fallos
1. Logs de errores recientes: gcloud logging read "severity>=ERROR" --freshness=1h --limit=50
2. Estado y configuración del servicio afectado (describe)
3. Causas típicas a revisar: API no habilitada, permisos de la cuenta de servicio, variables de entorno o secretos que faltan, puerto incorrecto en Cloud Run, firewall, región equivocada, imagen inexistente, cuotas.
4. Explica la causa probable y el arreglo propuesto ANTES de aplicarlo.

## 5. Arreglos y despliegues
- Prioriza la velocidad: en el hackathon se permite usar gcloud directamente.
- Si el proyecto ya usa Terraform, haz los cambios en Terraform: fmt, validate, plan, resumen del plan y confirmación antes de apply.
- Despliegue de código típico: gcloud run deploy <servicio> --source . --region <región>
- Tras cada cambio, verifica que funciona (URL, logs, estado) y díselo al usuario.
- Anota cada cambio en docs/cambios.md: qué, por qué y cómo revertirlo.

## 6. Retos de agentes (ADK, Vertex AI, Gemini Enterprise)

### Preparación
- Habilita las APIs: gcloud services enable aiplatform.googleapis.com discoveryengine.googleapis.com
- Instala ADK en un entorno virtual: python -m venv .venv && pip install google-adk
- Configura Vertex AI en .env (nunca subirlo al repo):
  GOOGLE_GENAI_USE_VERTEXAI=TRUE
  GOOGLE_CLOUD_PROJECT=<ID>
  GOOGLE_CLOUD_LOCATION=<región, p. ej. us-central1 o europe-west1>
- Comprueba qué modelos Gemini están disponibles en esa región antes de elegir uno.

### Crear un agente a medida con ADK
- Estructura: carpeta del agente con __init__.py y agent.py que define root_agent.
- Define siempre: nombre, modelo, descripción, instrucción (rol, tono, límites) y herramientas.
- Herramientas: funciones Python con docstring claro, herramientas integradas (búsqueda, código), MCP o APIs de Google Cloud.
- Multiagente: un agente coordinador con sub_agents especializados cuando el reto lo pida.
- Prueba en local antes de desplegar: adk web (interfaz) o adk run <carpeta>.

### Desplegar
- Vertex AI Agent Engine: adk deploy agent_engine (o con el SDK de Vertex AI). Necesita un bucket de staging.
- Alternativa rápida: adk deploy cloud_run.
- Tras desplegar, prueba el agente con una consulta real y revisa sus logs.

### Gemini Enterprise
- Si el reto pide publicar el agente para usuarios, regístralo en Gemini Enterprise desde Agent Engine.
- Revisa permisos de la cuenta y conectores de datos (Drive, BigQuery, etc.) que pida el reto.

### Diagnóstico de agentes que fallan
- API o modelo no disponible en la región, permisos de Vertex AI, variables de entorno mal puestas, herramientas con errores o sin docstring, cuotas del modelo.
- Antes de cambiar nada, explica el fallo y el arreglo propuesto.

## 7. Trabajo en equipo (varias personas y agentes sobre el mismo proyecto)
- REGLA PRINCIPAL: no modifiques, redespliegues ni borres ningún recurso de Google Cloud que no hayas creado tú en esta sesión sin preguntar antes al usuario. Si dudas de quién lo creó, pregunta.
- Antes de cambiar un recurso, comprueba sus etiquetas (labels) y su historial en Cloud Logging (actividad de administración) para ver quién lo creó.
- Etiqueta todo lo que crees con owner=<nombre del usuario>.
- Para pruebas, usa nombres propios con el nombre del usuario, por ejemplo agente-<nombre>. Nunca uses el nombre del servicio oficial de la demo.
- Solo el responsable del despliegue toca el servicio oficial. Si el usuario no es el responsable, no lo despliegues.
- Git: trabaja siempre en una rama propia, nunca hagas push a main; los cambios entran por pull request. Haz git pull antes de empezar y antes de abrir el PR.

## 8. Optimizar para la evaluación
Al montar un agente o un flujo, el orquestador (o quien lo construya) debe optimizarlo para las métricas con las que se puede evaluar:
- Corrección: respuestas exactas y en el formato que pida el enunciado. Prepara un pequeño conjunto de preguntas de prueba en tests/ y ejecútalo tras cada cambio.
- Latencia: elige el modelo más rápido que dé buena calidad (Flash antes que Pro si basta), instrucciones concisas, pocas llamadas encadenadas y herramientas que respondan rápido. Mide el tiempo de respuesta.
- Fiabilidad: maneja errores en las herramientas, reintentos simples y respuestas por defecto; el agente nunca debe quedarse colgado ni devolver un error sin explicar.
- Coste: evita llamadas al modelo innecesarias y contextos enormes; no dejes recursos caros encendidos.
- Seguridad: permisos mínimos, secretos en Secret Manager, nada público sin necesidad.
- Progreso del laboratorio: si hay botones de comprobar progreso, avisa al usuario para comprobar cada paso en cuanto esté hecho.
- Antes de dar algo por terminado, ejecuta las pruebas y resume al usuario: aciertos, tiempo medio de respuesta y errores.

## 9. Pide confirmación antes de
- Borrar o destruir cualquier recurso (delete, destroy)
- Cambios de IAM, firewall o red
- Recursos caros (GPU, máquinas grandes, muchas instancias)
- Cualquier acción que no se pueda deshacer

## 10. Nunca
- Subir claves, secretos o el archivo .env al repositorio
- Abrir firewalls a 0.0.0.0/0 sin justificar y confirmar
- Asignar roles Owner o Editor
- Cambiar de proyecto sin avisar

## 11. Estilo de trabajo
- Pasos cortos, explicando qué haces y por qué.
- Si algo no está claro sobre el reto, pregunta al usuario en vez de suponer.
- Al final, prepara en docs/resumen.md una explicación de la solución para presentarla al jurado.
