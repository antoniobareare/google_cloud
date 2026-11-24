# Kit hackathon Google Cloud

## Qué hay en esta carpeta
| Archivo | Para qué | Lo lee |
|---|---|---|
| AGENTS.md | Todas las reglas: conexión, inventario, diagnóstico, agentes, datos, equipo, evaluación | Antigravity y Claude Code |
| CLAUDE.md | Importa AGENTS.md y añade lo específico de Claude Code | Claude Code |
| .claude/settings.json | Permisos REALES: lectura libre, despliegues con confirmación, borrados bloqueados | Solo Claude Code |
| .mcp.json + scripts/gcp-mcp-headers.sh | Servidores MCP de Google (BigQuery, Logging, Cloud Run) | Solo Claude Code |
| .gitignore | Evita subir .env, claves y estado de Terraform | Git |
| .env.example | Plantilla de variables; cópiala como .env | Tú / ADK |
| docs/reto.md | Plantilla para pegar el enunciado | Todos |
| tests/casos_prueba.md | Plantilla de casos de prueba | Todos |

Importante: .claude/settings.json solo protege a Claude Code. El agente propio de Antigravity
solo sigue AGENTS.md como instrucciones, así que revisa tú sus comandos de borrado/despliegue.

## Puesta en marcha (hoy, martes)
Estado en el equipo de Antonio (Windows): ✅ hecho · ⬜ pendiente
1. ✅ Kit copiado a la raíz del repo (github.com/antoniobareare/google_cloud, privado).
2. ✅ Script MCP ejecutable (en .mcp.json se llama con `bash ./scripts/...` para que funcione también en Windows con Git Bash).
3. ✅ `.env` creado desde `.env.example` (OWNER=antonio). ⬜ Falta poner GOOGLE_CLOUD_PROJECT.
4. ⬜ `gcloud config configurations create hackathon` (opcional, separa la cuenta del reto de la personal).
5. ✅ `gcloud auth login` · ⬜ `gcloud auth application-default login` (necesario para ADK y el MCP)
6. ⬜ `gcloud config set project <ID>` y `gcloud auth application-default set-quota-project <ID>`
7. Abre Claude Code en la carpeta y escribe `/permissions` para comprobar que cargó las reglas, y `/mcp` para ver los servidores.
   - Si el MCP no conecta, no pasa nada: Claude seguirá con gcloud y bq.
   - Para usar el MCP tu cuenta necesita roles/mcp.toolUser y, en BigQuery, roles/bigquery.jobUser y roles/bigquery.dataViewer.
8. Primer mensaje: "Lee AGENTS.md y empieza por la sección 0".

## Práctica recomendada para hoy
- [ ] Prueba de humo de Gemini (sección 7.1)
- [ ] Agente ADK con dos herramientas, probado con adk web y desplegado en Cloud Run con --with_ui
- [ ] El mismo agente en Agent Runtime con min_instances=0
- [ ] Una herramienta que consulte BigQuery
- [ ] Romper algo a propósito (desactivar una API) y que Claude lo diagnostique
- [ ] Repo en GitHub con estos archivos y compañeros como colaboradores
- [ ] Borrar a mano todos los despliegues de prueba (Claude tiene los delete bloqueados)

## El miércoles
1. Pega el enunciado en docs/reto.md.
2. "Lee docs/reto.md, haz el inventario y propónme un plan. No toques nada todavía."
3. Revisad el plan en equipo y repartid: Agente, Datos, Plataforma, Producto/demo.
4. Algo mínimo desplegado en 2–3 horas; luego iterar.
5. Congelar dos horas antes; ensayar la demo y grabar un vídeo de respaldo.
