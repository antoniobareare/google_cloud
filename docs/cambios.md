# Registro de cambios en Google Cloud

Qué se ha creado o cambiado, por qué, quién y cómo revertirlo (para poder limpiar al final).

| Fecha | Qué | Por qué | Quién | Cómo revertir |
|---|---|---|---|---|
| 2026-11-24 | Proyecto `hackathon-prueba-antonio` (nombre "Hackathon prueba Antonio", labels owner=antonio, app=hackathon) | Proyecto de prueba para practicar antes del hackathon | Claude (confirmado por Antonio) | Antonio a mano: `gcloud projects delete hackathon-prueba-antonio` (queda 30 días recuperable) |
| 2026-11-24 | gcloud local: `core/project=hackathon-prueba-antonio`, `run/region=europe-west1`, quota project del ADC | Trabajar sobre el proyecto de prueba | Claude | `gcloud config unset project`; `gcloud config unset run/region` |
| 2026-11-25 | Ordenador nuevo (LAPTOP-7VMJAQBP): winget Google.CloudSDK 594, GitHub.cli 2.105, Python 3.11.9, uv 0.13; `.venv` con requirements.txt; login gcloud + ADC + gh (antoniobareare) | Puesta en marcha para el reto | Claude (login hecho por Antonio en el navegador) | `winget uninstall --id <paquete>` |
| 2026-11-25 | gcloud local en este ordenador: proyecto, `run/region=europe-west1` y quota project del ADC = `hackathon-prueba-antonio` | Trabajar sobre el proyecto de prueba | Claude | `gcloud config unset project`; `gcloud config unset run/region` |
| 2026-11-25 | `.claude/settings.json`: `gcloud billing projects link` pasa de deny a ask (CLAUDE.md actualizado) | Decisión explícita de Antonio | Claude (pedido por Antonio) | Volver a moverlo a "deny" |
| 2026-11-25 | `.claude/settings.json`: quitado `Read(./.env)` de deny (se mantiene `*-key.json`) | Decisión explícita de Antonio, para que Claude pueda rellenar el .env | Claude (pedido por Antonio) | Volver a añadir `"Read(./.env)"` a "deny" |
| 2026-11-25 | MCP bigquery/logging/cloudrun en scope local (`~/.claude.json`, solo este ordenador) con `headersHelper` usando la ruta completa de Git Bash | `bash` en el PATH de Windows es el de WSL y el script no arrancaba | Claude | `claude mcp remove <nombre> -s local` (vuelve a usar `.mcp.json`) |
| 2026-11-25 | `~/.claude.json`: `hasTrustDialogAccepted=true` para esta carpeta (copia previa en el scratchpad de la sesión) | Sin confianza, Claude Code no ejecuta `headersHelper`; pedido por Antonio | Claude (pedido por Antonio) | Poner `false` en `projects["…/Conexion_Google_Cloud"].hasTrustDialogAccepted` |
| 2026-11-25 | `~/.claude.json`: la confianza y los MCP locales también bajo `c:/…` (minúscula, la que usa el panel) | El panel no encontraba la confianza y volvía a `.mcp.json` (bash de WSL) | Claude (pedido por Antonio) | Borrar la entrada `projects["c:/…/Conexion_Google_Cloud"]` |
| 2026-11-25 | Facturación de `hackathon-prueba-antonio` vinculada a `015D2B-DCA929-C88BCA` | Necesaria para Gemini (Agent Platform) | Claude (con "sí" de Antonio) | Antonio a mano: `gcloud billing projects unlink hackathon-prueba-antonio` (unlink sigue bloqueado para Claude) |
| 2026-11-25 | APIs habilitadas en `hackathon-prueba-antonio`: aiplatform, run, cloudbuild, artifactregistry, secretmanager (bigquery, storage, logging, cloudtrace ya estaban) | AGENTS.md §4 | Claude | `gcloud services disable <api>` (a mano; bloqueado para Claude). Sin coste por estar habilitadas |
| 2026-11-25 | Terraform 1.17.2 instalado con winget (Hashicorp.Terraform); PATH de usuario actualizado por winget | Por si el reto trae infraestructura en `.tf`; pedido por Antonio | Claude | `winget uninstall --id Hashicorp.Terraform` |
| 2026-11-25 | Proyecto del reto `hackathon-devoteam` (compartido, creado por miguelfidalgo724): gcloud `core/project`, `run/region=europe-southwest1`, quota project del ADC y `.env` apuntan a él | Proyecto del equipo para el reto | Claude (pedido por Antonio) | `bash scripts/lab.sh --estado`; volver con `gcloud config set project hackathon-prueba-antonio` y el `.env` |
| 2026-11-25 | APIs habilitadas en `hackathon-devoteam`: run, cloudbuild, artifactregistry, secretmanager | Necesarias para publicar en Cloud Run | Claude | Sin coste por estar habilitadas |
| 2026-11-25 | Cloud Run `tienda-antonio` en `hackathon-devoteam` (europe-southwest1, pública, labels owner=antonio,app=hackathon, min 0 / max 5). Crea también el repo de Artifact Registry `cloud-run-source-deploy` | Tienda del reto (prueba de Antonio) | Claude (pedido por Antonio) | Antonio a mano: `gcloud run services delete tienda-antonio --region europe-southwest1` |
| 2026-11-25 | Cloud Run `picasso-team` en `hackathon-devoteam` (europe-southwest1, pública, labels owner=antonio,app=hackathon, min 0 / max 5). Sustituye a `tienda-antonio` (nombre pedido por Antonio) | Tienda del equipo | Claude (pedido por Antonio) | Antonio a mano: `gcloud run services delete picasso-team --region europe-southwest1` |

## Cambios en la aplicación

| Fecha | Qué | Por qué | Quién | Cómo revertir |
|---|---|---|---|---|
| 2026-11-25 | Portada y fichas generadas desde el catálogo, carrito y envío de pedidos v1.0 en `miguel` | Preparar el recorrido de compra y el hito Presente | Codex (pedido por Miguel) | Revertir el cambio de la aplicación en la rama `miguel` |
