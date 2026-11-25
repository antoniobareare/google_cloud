# Instrucciones para Claude Code

Las reglas del proyecto están en AGENTS.md (compartidas con Antigravity). Síguelas siempre:

@AGENTS.md

## Específico de Claude Code
- Los permisos reales están en .claude/settings.json: lo que está en "deny" no se puede ejecutar aunque el usuario lo pida en el chat; díselo y que lo haga él a mano.
- Servidores MCP de Google en .mcp.json (BigQuery, Logging, Cloud Run). Comprueba la conexión con /mcp. Si no conectan, sigue con gcloud y bq.
- Para explorar datos usa primero las herramientas de solo lectura del MCP de BigQuery (list_*, get_*, execute_sql_readonly).
- Tras cada despliegue, lee los logs y resume errores.

## Windows (equipo de Antonio)
- Ejecuta gcloud, bq, gh, git, adk y terraform con la herramienta Bash (Git Bash), no con PowerShell: las reglas allow/ask de .claude/settings.json están escritas para Bash. PowerShell solo para lo que sea propio de Windows (winget, rutas del registro).
- Si gcloud no aparece en Git Bash: export PATH="$PATH:$(cygpath "$LOCALAPPDATA")/Google/Cloud SDK/google-cloud-sdk/bin"
- Ordenador nuevo o herramientas sin instalar (gcloud, gh, ADC, /mcp): sigue docs/PUESTA_EN_MARCHA.md antes que nada.
- El usuario se llama Antonio: usa owner=antonio en las etiquetas, ramas antonio/<tema> y recursos de prueba agente-antonio, bucket-antonio-...
- Crear proyectos de GCP (`gcloud projects create`) requiere DOBLE confirmación: 1) antes de ejecutarlo, pregunta en el chat indicando ID, nombre, cuenta de facturación prevista y coste posible, y espera un "sí" explícito; 2) después el permiso "ask" de settings.json vuelve a pedir aprobación. Vincular facturación (`gcloud billing projects link`) pasa a "ask" (decisión de Antonio, 2026-11-25): antes de ejecutarlo, indica en el chat proyecto, cuenta de facturación y coste posible; solo con un "sí" explícito. Desvincular sigue bloqueado.
- Repositorio: github.com/antoniobareare/google_cloud (privado). Rama de trabajo: antonio/setup; a main solo por pull request.
