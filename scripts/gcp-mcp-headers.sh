#!/usr/bin/env bash
# Genera la cabecera de autenticación para los servidores MCP remotos de Google.
# Usa tus credenciales ADC (gcloud auth application-default login). No guarda nada en disco.
# Los tokens caducan cada hora; Claude Code vuelve a ejecutar este script al reconectar.
set -euo pipefail
PROJECT="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
TOKEN="$(gcloud auth application-default print-access-token)"
printf '{"Authorization":"Bearer %s","x-goog-user-project":"%s"}' "$TOKEN" "$PROJECT"
