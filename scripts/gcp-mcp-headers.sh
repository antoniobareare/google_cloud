#!/usr/bin/env bash
# Genera la cabecera de autenticación para los servidores MCP remotos de Google.
# Usa tus credenciales ADC (gcloud auth application-default login). No guarda nada en disco.
# Los tokens caducan cada hora; Claude Code vuelve a ejecutar este script al reconectar.
set -euo pipefail

# Si gcloud no está en el PATH del proceso (VS Code abierto antes de instalarlo), prueba las rutas habituales.
if ! command -v gcloud >/dev/null 2>&1; then
  for d in \
    "${LOCALAPPDATA:+$(cygpath "$LOCALAPPDATA" 2>/dev/null)/Google/Cloud SDK/google-cloud-sdk/bin}" \
    "/c/Program Files/Google/Cloud SDK/google-cloud-sdk/bin" \
    "/c/Program Files (x86)/Google/Cloud SDK/google-cloud-sdk/bin" \
    "$HOME/google-cloud-sdk/bin" \
    "/opt/homebrew/share/google-cloud-sdk/bin" \
    "/usr/local/share/google-cloud-sdk/bin"; do
    if [ -n "$d" ] && [ -x "$d/gcloud" ]; then PATH="$PATH:$d"; break; fi
  done
fi
command -v gcloud >/dev/null 2>&1 || { echo "gcp-mcp-headers: gcloud no encontrado" >&2; exit 1; }

PROJECT="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
[ -n "$PROJECT" ] || { echo "gcp-mcp-headers: sin proyecto (gcloud config set project <ID>)" >&2; exit 1; }

TOKEN="$(gcloud auth application-default print-access-token 2>/dev/null)" \
  || { echo "gcp-mcp-headers: sin ADC (gcloud auth application-default login)" >&2; exit 1; }

printf '{"Authorization":"Bearer %s","x-goog-user-project":"%s"}' "$TOKEN" "$PROJECT"
