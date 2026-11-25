#!/usr/bin/env bash
# Genera la cabecera de autenticación para los servidores MCP remotos de Google.
# Usa tus credenciales ADC (gcloud auth application-default login). No guarda nada en disco.
# Los tokens caducan cada hora; Claude Code vuelve a ejecutar este script al reconectar.
#
# Claude Code da 10 s a este script y arranca los servidores en paralelo. En Windows cada
# llamada a gcloud tarda 3-5 s, así que se evita gcloud en el caso normal:
#   - proyecto: GOOGLE_CLOUD_PROJECT → .env del repo → archivo de configuración de gcloud
#   - token: ADC de usuario (authorized_user) → intercambio directo con oauth2.googleapis.com
# Si algo de eso no está disponible, se usa gcloud como antes.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GCLOUD_CFG="${CLOUDSDK_CONFIG:-}"
if [ -z "$GCLOUD_CFG" ]; then
  if [ -n "${APPDATA:-}" ]; then GCLOUD_CFG="$(cygpath "$APPDATA" 2>/dev/null || echo "$APPDATA")/gcloud"
  else GCLOUD_CFG="$HOME/.config/gcloud"; fi
fi

# Valor de "clave": "valor" en un JSON sencillo (sin depender de jq ni python).
json_get() { sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$2" | head -1; }

usar_gcloud() {
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
}

# --- Proyecto ---
PROJECT="${GOOGLE_CLOUD_PROJECT:-}"
if [ -z "$PROJECT" ] && [ -f "$DIR/.env" ]; then
  PROJECT="$(sed -n 's/^[[:space:]]*GOOGLE_CLOUD_PROJECT[[:space:]]*=[[:space:]]*["'\'']\{0,1\}\([^"'\''[:space:]#]*\).*/\1/p' "$DIR/.env" | tail -1)"
  [ "$PROJECT" = "MI_PROJECT_ID" ] && PROJECT=""
fi
if [ -z "$PROJECT" ]; then
  ACTIVE="$(cat "$GCLOUD_CFG/active_config" 2>/dev/null || echo default)"
  PROJECT="$(sed -n 's/^[[:space:]]*project[[:space:]]*=[[:space:]]*\([^[:space:]]*\).*/\1/p' \
    "$GCLOUD_CFG/configurations/config_$ACTIVE" 2>/dev/null | head -1 || true)"
fi
if [ -z "$PROJECT" ]; then usar_gcloud; PROJECT="$(gcloud config get-value project 2>/dev/null || true)"; fi
[ -n "$PROJECT" ] || { echo "gcp-mcp-headers: sin proyecto (gcloud config set project <ID>)" >&2; exit 1; }

# --- Token ---
TOKEN=""
ADC="${GOOGLE_APPLICATION_CREDENTIALS:-$GCLOUD_CFG/application_default_credentials.json}"
if [ -f "$ADC" ] && [ "$(json_get type "$ADC")" = "authorized_user" ] && command -v curl >/dev/null 2>&1; then
  CID="$(json_get client_id "$ADC")"; CSEC="$(json_get client_secret "$ADC")"; RTOK="$(json_get refresh_token "$ADC")"
  if [ -n "$CID" ] && [ -n "$CSEC" ] && [ -n "$RTOK" ]; then
    # Los secretos van por stdin, no por la línea de comandos.
    RESP="$(printf 'grant_type=refresh_token&client_id=%s&client_secret=%s&refresh_token=%s' "$CID" "$CSEC" "$RTOK" \
      | curl -s -m 6 -X POST https://oauth2.googleapis.com/token \
          -H 'Content-Type: application/x-www-form-urlencoded' --data-binary @- || true)"
    TOKEN="$(printf '%s' "$RESP" | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  fi
fi
if [ -z "$TOKEN" ]; then
  usar_gcloud
  TOKEN="$(gcloud auth application-default print-access-token 2>/dev/null)" \
    || { echo "gcp-mcp-headers: sin ADC (gcloud auth application-default login)" >&2; exit 1; }
fi

printf '{"Authorization":"Bearer %s","x-goog-user-project":"%s"}' "$TOKEN" "$PROJECT"
