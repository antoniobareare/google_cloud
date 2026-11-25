#!/usr/bin/env bash
# Reproduce el hito "Tiempo de respuesta": 20 peticiones seguidas a la portada.
# Nota completa: mediana <= 0,2 s y p95 <= 0,5 s (cero con >= 1 s y >= 2 s).
# Uso: bash tienda/scripts/medir_portada.sh [URL]
set -euo pipefail
URL="${1:-https://tienda-antonio-643279844872.europe-southwest1.run.app/}"
stats() { sort -n | awk '{t[NR]=$1} END{printf "mediana=%.3f s  p95=%.3f s  máx=%.3f s\n",(t[10]+t[11])/2,t[19],t[20]}'; }

echo "URL: $URL"
echo -n "Conexión nueva cada vez:  "
for _ in $(seq 1 20); do curl -s -o /dev/null -H 'accept-encoding: gzip' -w "%{time_total}\n" "$URL"; done | stats
echo -n "Reutilizando conexión:    "
args=(); for _ in $(seq 1 20); do args+=(-o /dev/null "$URL"); done
curl -s -H 'accept-encoding: gzip' -w "%{time_total}\n" "${args[@]}" | stats
echo -n "Red (TCP connect):        "
for _ in $(seq 1 5); do curl -s -o /dev/null -w "%{time_connect}\n" "$URL"; done | sort -n | awk '{t[NR]=$1} END{printf "%.3f s (cada conexión HTTPS nueva cuesta ~3 veces esto)\n",t[3]}'
