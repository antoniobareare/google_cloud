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
| 2026-11-25 | Facturación de `hackathon-prueba-antonio` vinculada a `015D2B-DCA929-C88BCA` | Necesaria para Gemini (Agent Platform) | Claude (con "sí" de Antonio) | Antonio a mano: `gcloud billing projects unlink hackathon-prueba-antonio` (unlink sigue bloqueado para Claude) |
| 2026-11-25 | APIs habilitadas en `hackathon-prueba-antonio`: aiplatform, run, cloudbuild, artifactregistry, secretmanager (bigquery, storage, logging, cloudtrace ya estaban) | AGENTS.md §4 | Claude | `gcloud services disable <api>` (a mano; bloqueado para Claude). Sin coste por estar habilitadas |
