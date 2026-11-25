#!/usr/bin/env bash
# Cambia este ordenador a la cuenta y el proyecto de un laboratorio (Qwiklabs / Skills Boost) y lo deja como antes.
# Guía completa: docs/LABORATORIO.md
#
#   bash scripts/lab.sh <ID_PROYECTO_LAB> [REGION]   entrar al laboratorio
#   bash scripts/lab.sh --volver                     volver a la cuenta y el proyecto personales
#   bash scripts/lab.sh --estado                     ver qué cuenta y proyecto están activos
#
# Lo ejecuta la persona en su terminal (no Claude): los inicios de sesión abren el navegador.
# No guarda contraseñas ni tokens. Copia .env a .env.personal (ignorado por git) para poder volver.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${LAB_ENV_FILE:-$DIR/.env}"
ENV_BAK="${ENV_FILE}.personal"
CFG_LAB="lab"
CFG_PERSONAL="default"

ok()    { printf '\033[32m✔\033[0m %s\n' "$*"; }
aviso() { printf '\033[33m!\033[0m %s\n' "$*"; }
error() { printf '\033[31m✘\033[0m %s\n' "$*" >&2; exit 1; }
paso()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
si()    { local r; read -r -p "$1 [S/n] " r; [[ -z "$r" || "$r" =~ ^[sSyY] ]]; }

# --- gcloud en el PATH (en Git Bash a veces no está) ---
if ! command -v gcloud >/dev/null 2>&1; then
  for d in \
    "${LOCALAPPDATA:+$(cygpath "$LOCALAPPDATA" 2>/dev/null)/Google/Cloud SDK/google-cloud-sdk/bin}" \
    "/c/Program Files/Google/Cloud SDK/google-cloud-sdk/bin" \
    "/c/Program Files (x86)/Google/Cloud SDK/google-cloud-sdk/bin" \
    "$HOME/google-cloud-sdk/bin" "/opt/homebrew/share/google-cloud-sdk/bin" "/usr/local/share/google-cloud-sdk/bin"; do
    if [ -n "$d" ] && [ -x "$d/gcloud" ]; then PATH="$PATH:$d"; break; fi
  done
fi
command -v gcloud >/dev/null 2>&1 || error "gcloud no encontrado (docs/PUESTA_EN_MARCHA.md)"
export PYTHONWARNINGS=ignore

# --- .env ---
env_get() { [ -f "$1" ] && sed -n "s/^[[:space:]]*$2[[:space:]]*=[[:space:]]*[\"']\{0,1\}\([^\"'#[:space:]]*\).*/\1/p" "$1" | tail -1; }
env_set() {
  if grep -q "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE"; then
    sed -i "s|^[[:space:]]*$1[[:space:]]*=.*|$1=$2|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
  fi
}

config_existe() { gcloud config configurations list --format="value(name)" 2>/dev/null | grep -qx "$1"; }
cuenta_de()     { gcloud config get-value account --configuration="$1" 2>/dev/null; }

aviso_navegador() {
  aviso "Se abrirá el navegador. Si sale tu cuenta PERSONAL: cierra esa pestaña, copia la URL que aparece"
  aviso "abajo en la terminal y pégala en la ventana de INCÓGNITO donde tienes abierto el laboratorio."
}

estado() {
  paso "Estado"
  local activa; activa="$(gcloud config configurations list --filter=is_active:true --format='value(name)' 2>/dev/null)"
  echo "Configuración gcloud activa: $activa"
  echo "Cuenta gcloud:               $(gcloud config get-value account 2>/dev/null)"
  echo "Proyecto gcloud:             $(gcloud config get-value project 2>/dev/null)"
  echo "Región Cloud Run:            $(gcloud config get-value run/region 2>/dev/null)"
  echo ".env GOOGLE_CLOUD_PROJECT:   $(env_get "$ENV_FILE" GOOGLE_CLOUD_PROJECT)"
  echo ".env REGION:                 $(env_get "$ENV_FILE" REGION)"
  local adc="${CLOUDSDK_CONFIG:-$(cygpath "${APPDATA:-}" 2>/dev/null || echo "$HOME/.config")/gcloud}/application_default_credentials.json"
  [ -f "$adc" ] && echo "ADC quota project:           $(sed -n 's/.*"quota_project_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$adc")" \
               || echo "ADC:                         no hay"
  [ -f "$ENV_BAK" ] && echo "Copia personal del .env:     sí ($ENV_BAK) → estás en modo laboratorio" \
                    || echo "Copia personal del .env:     no"
}

entrar() {
  local id="$1" region="${2:-}"
  [[ "$id" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || error "ID de proyecto no válido: '$id' (cópialo del panel del laboratorio)"

  paso "1/5 Configuración de gcloud '$CFG_LAB' (la personal '$CFG_PERSONAL' no se toca)"
  if config_existe "$CFG_LAB"; then gcloud config configurations activate "$CFG_LAB" >/dev/null 2>&1
  else gcloud config configurations create "$CFG_LAB" >/dev/null 2>&1; fi
  ok "Configuración '$CFG_LAB' activa"

  paso "2/5 Inicio de sesión con la cuenta del laboratorio"
  local cuenta; cuenta="$(cuenta_de "$CFG_LAB")"
  if [ -n "$cuenta" ] && si "La configuración '$CFG_LAB' ya usa $cuenta. ¿Es la de este laboratorio?"; then
    ok "Se mantiene $cuenta"
  else
    aviso_navegador
    gcloud auth login || error "Falló el inicio de sesión"
    cuenta="$(cuenta_de "$CFG_LAB")"
  fi
  [[ "$cuenta" == *@gmail.com ]] && aviso "La cuenta $cuenta parece personal, no del laboratorio. Revisa antes de seguir."

  paso "3/5 Proyecto y región"
  gcloud config set project "$id" >/dev/null 2>&1 || error "No se pudo fijar el proyecto $id"
  ok "Proyecto: $id"
  if [ -n "$region" ]; then
    gcloud config set run/region "$region" >/dev/null 2>&1
    gcloud config set compute/region "$region" >/dev/null 2>&1
    ok "Región: $region"
  fi

  paso "4/5 Credenciales para el código y los MCP (ADC)"
  aviso "Esto sustituye tu ADC personal. Para recuperarlo: bash scripts/lab.sh --volver"
  if si "¿Iniciar el ADC con la cuenta del laboratorio?"; then
    aviso_navegador
    gcloud auth application-default login || error "Falló el inicio de sesión del ADC"
    gcloud auth application-default set-quota-project "$id" >/dev/null 2>&1 \
      && ok "Quota project del ADC: $id" || aviso "No se pudo fijar el quota project (¿falta permiso?). Sigue: no suele bloquear."
  fi

  paso "5/5 .env"
  [ -f "$ENV_FILE" ] || cp "$DIR/.env.example" "$ENV_FILE"
  if [ -f "$ENV_BAK" ]; then ok "Ya había copia personal ($ENV_BAK); no se sobrescribe"
  else cp "$ENV_FILE" "$ENV_BAK"; ok "Copia personal guardada en $ENV_BAK"; fi
  env_set GOOGLE_CLOUD_PROJECT "$id"
  [ -n "$region" ] && env_set REGION "$region"
  ok ".env apunta a $id"

  paso "Comprobación rápida"
  gcloud projects describe "$id" --format="value(projectId,lifecycleState)" 2>/dev/null \
    && ok "Acceso al proyecto" || aviso "No se puede leer el proyecto $id: revisa cuenta e ID"
  local roles; roles="$(gcloud projects get-iam-policy "$id" --flatten='bindings[].members' \
    --filter="bindings.members:user:$cuenta" --format='value(bindings.role)' 2>/dev/null | tr '\n' ' ')"
  echo "Tus roles: ${roles:-(no se pueden leer)}"
  echo "APIs habilitadas: $(gcloud services list --enabled --project "$id" --format='value(config.name)' 2>/dev/null | wc -l)"

  estado
  paso "Siguiente"
  echo "1. En Claude Code: /mcp → reconecta bigquery, logging y cloudrun."
  echo "2. Dile a Claude: \"estamos en un laboratorio, sigue docs/LABORATORIO.md\"."
  echo "3. Apunta en docs/reto.md la hora de fin del laboratorio."
}

volver() {
  local personal; personal="$(env_get "$ENV_BAK" GOOGLE_CLOUD_PROJECT)"
  [ -n "$personal" ] || personal="$(gcloud config get-value project --configuration="$CFG_PERSONAL" 2>/dev/null)"
  local cuenta_lab; cuenta_lab="$(config_existe "$CFG_LAB" && cuenta_de "$CFG_LAB")"

  paso "1/4 Configuración personal '$CFG_PERSONAL'"
  gcloud config configurations activate "$CFG_PERSONAL" >/dev/null 2>&1 || error "No existe la configuración '$CFG_PERSONAL'"
  ok "Cuenta: $(gcloud config get-value account 2>/dev/null) · Proyecto: $(gcloud config get-value project 2>/dev/null)"

  paso "2/4 ADC personal"
  if si "¿Volver a iniciar el ADC con tu cuenta personal?"; then
    gcloud auth application-default login || error "Falló el inicio de sesión del ADC"
    [ -n "$personal" ] && gcloud auth application-default set-quota-project "$personal" >/dev/null 2>&1 \
      && ok "Quota project del ADC: $personal"
  fi

  paso "3/4 .env"
  if [ -f "$ENV_BAK" ]; then
    env_set GOOGLE_CLOUD_PROJECT "$(env_get "$ENV_BAK" GOOGLE_CLOUD_PROJECT)"
    local r; r="$(env_get "$ENV_BAK" REGION)"; [ -n "$r" ] && env_set REGION "$r"
    rm -f "$ENV_BAK"
    ok ".env vuelve a $(env_get "$ENV_FILE" GOOGLE_CLOUD_PROJECT) (el resto de variables se conserva)"
  else
    aviso "No hay $ENV_BAK: revisa GOOGLE_CLOUD_PROJECT en .env a mano"
  fi

  paso "4/4 Credenciales del laboratorio"
  if [ -n "$cuenta_lab" ] && [[ "$cuenta_lab" != *@gmail.com ]] && si "¿Quitar de este ordenador las credenciales de $cuenta_lab?"; then
    gcloud auth revoke "$cuenta_lab" >/dev/null 2>&1 && ok "Credenciales de $cuenta_lab eliminadas" \
      || aviso "No se pudieron revocar (el lab quizá ya terminó). No pasa nada."
  fi

  estado
  echo; echo "En Claude Code: /mcp → reconecta los tres servidores."
}

case "${1:-}" in
  --volver) volver ;;
  --estado) estado ;;
  ""|-h|--help) sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' ;;
  -*) error "Opción desconocida: $1" ;;
  *) entrar "$1" "${2:-}" ;;
esac
