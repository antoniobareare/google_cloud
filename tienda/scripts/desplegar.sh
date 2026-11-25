#!/usr/bin/env bash
# Despliega la tienda oficial (tienda-antonio, la URL guardada en el portal) con la configuración buena y la comprueba.
#   bash tienda/scripts/desplegar.sh            despliega desde main (lo normal)
#   bash tienda/scripts/desplegar.sh --forzar   despliega aunque no estés en main o haya cambios sin commit
# Pasos: prueba local → gcloud run deploy → comprobación de la URL → medición como el hito → errores en logs.
# Antes de desplegar, mirad en el portal que no haya ninguna prueba en marcha.
set -uo pipefail

SERVICIO="tienda-antonio"
PROYECTO="hackathon-devoteam"
REGION="europe-southwest1"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORZAR="${1:-}"

ok()    { printf '\033[32m✔\033[0m %s\n' "$*"; }
aviso() { printf '\033[33m!\033[0m %s\n' "$*"; }
error() { printf '\033[31m✘\033[0m %s\n' "$*" >&2; exit 1; }
paso()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }

command -v gcloud >/dev/null 2>&1 || PATH="$PATH:$(cygpath "${LOCALAPPDATA:-}" 2>/dev/null)/Google/Cloud SDK/google-cloud-sdk/bin"
command -v gcloud >/dev/null 2>&1 || error "gcloud no encontrado"
export PYTHONWARNINGS=ignore
cd "$DIR"

paso "1/5 Rama y cambios"
RAMA="$(git branch --show-current)"
if [ "$RAMA" != "main" ] && [ "$FORZAR" != "--forzar" ]; then
  error "Estás en '$RAMA'. Lo oficial se despliega desde main (o usa --forzar)."
fi
if [ -n "$(git status --porcelain -- .)" ] && [ "$FORZAR" != "--forzar" ]; then
  error "Hay cambios sin commit en tienda/. Haz commit o usa --forzar."
fi
git fetch -q origin 2>/dev/null && [ "$RAMA" = "main" ] && [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ] \
  && aviso "Tu main no coincide con origin/main: ¿falta un git pull?"
ok "Rama $RAMA · commit $(git log --oneline -1)"

paso "2/5 Prueba local"
node scripts/probar_local.mjs || error "La prueba local falla: no se despliega"

paso "3/5 Despliegue de $SERVICIO ($PROYECTO, $REGION)"
# min-instances 1: sin arranque en frío (hito Tiempo de respuesta). Al acabar el evento, volver a 0.
gcloud run deploy "$SERVICIO" --source . --region "$REGION" --project "$PROYECTO" \
  --allow-unauthenticated --labels owner=antonio,app=hackathon \
  --cpu 1 --memory 512Mi --concurrency 250 --min-instances 1 --max-instances 5 --cpu-boost \
  --set-env-vars GOOGLE_CLOUD_PROJECT=hackathon-devoteam,GOOGLE_CLOUD_LOCATION=global,MODELO_ASISTENTE=gemini-3.5-flash-lite \
  --set-secrets CLAVE_EQUIPO=hk-clave-equipo:latest \
  --quiet || error "Falló el despliegue"
URL="$(gcloud run services describe "$SERVICIO" --region "$REGION" --project "$PROYECTO" --format='value(status.url)')"
ok "Desplegado: $URL"

paso "4/5 Comprobación desde fuera"
CODIGO="$(curl -s -o /dev/null -w '%{http_code}' "$URL/")"
[ "$CODIGO" = "200" ] && ok "Portada 200" || aviso "La portada responde $CODIGO"
CAB="$(curl -sI "$URL/")"
for c in strict-transport-security x-content-type-options content-security-policy "set-cookie: hk_sesion"; do
  grep -qi "^$c" <<<"$CAB" && ok "$c" || aviso "Falta $c"
done
bash "$DIR/scripts/medir_portada.sh" "$URL/"

paso "5/5 Errores en los logs (últimos 5 min)"
ERR="$(gcloud logging read "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$SERVICIO\" AND severity>=ERROR" \
  --project "$PROYECTO" --freshness=5m --limit=10 --format='value(timestamp,textPayload,httpRequest.status)' 2>/dev/null)"
[ -z "$ERR" ] && ok "Sin errores" || { aviso "Errores recientes:"; echo "$ERR"; }
