#!/usr/bin/env bash
# Verifica agx-web (rama de trabajo) en local: prueba de funcionamiento + capturas + hojas de contacto.
# Uso: bash agx-verificar.sh <etiqueta> [solo-prueba|solo-capturas]
#   Salida de capturas: <carpeta agx>/<etiqueta>/   (el «antes» está en <carpeta agx>/base/)
#   Variables opcionales: SOLO='^d-claro-0[1-7]' (solo esas capturas), PUERTO (por defecto 4400), REPO (por defecto /home/user/agx-web)
set -u
ETQ="${1:?falta la etiqueta}"; MODO="${2:-todo}"
TOOLS="$(cd "$(dirname "$0")" && pwd)"; AGX="$(dirname "$TOOLS")"
REPO="${REPO:-/home/user/agx-web}"; PUERTO="${PUERTO:-4400}"; BASE="http://localhost:$PUERTO/"
OUT="$AGX/$ETQ"; mkdir -p "$OUT"
export NODE_PATH="$(npm root -g)"

if ! curl -s -o /dev/null "$BASE"; then
  (cd "$REPO" && (setsid nohup python3 -m http.server "$PUERTO" --bind 127.0.0.1 >/dev/null 2>&1 &))
  n=0; until curl -s -o /dev/null "$BASE"; do n=$((n+1)); [ $n -gt 40 ] && { echo "El servidor local no arranca"; exit 1; }; sleep 0.3; done
fi
echo "Rama: $(git -C "$REPO" branch --show-current) · $(git -C "$REPO" log --oneline -1 | cut -c1-90)"
echo "index.html: $(wc -c < "$REPO/index.html") bytes"

ESTADO=0
if [ "$MODO" != "solo-capturas" ]; then
  echo "== prueba de funcionamiento"
  BASE="$BASE" timeout 600 node "$TOOLS/agx-e2e.cjs" > "$OUT/e2e.log" 2>&1; ESTADO=$?
  grep -E "^■|✗" "$OUT/e2e.log" | cut -c1-260
  grep -E "comprobaciones en" "$OUT/e2e.log"
  sed -n '/^RESULTADO/,$p' "$OUT/e2e.log" | cut -c1-400 | head -40
fi
if [ "$MODO" != "solo-prueba" ]; then
  echo "== capturas"
  LIMPIAR=1 BASE="$BASE" OUT="$OUT" timeout 1200 node "$TOOLS/agx-shots.cjs" > "$OUT/shots.log" 2>&1
  grep -E "capturas|PROBLEMAS DE CAPTURA|ERRORES DE PÁGINA" "$OUT/shots.log" | cut -c1-600 | tail -6
fi
echo "Salida en: $OUT"
exit $ESTADO
