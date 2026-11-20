#!/bin/bash
# Comprobación en vivo de agxcommunity.com tras publicar «Tests de los directos». Solo lecturas. Uso: bash vivo-directos2.sh [repo]
REPO="${1:-/home/user/agx-web}"; BASE="https://agxcommunity.com"; TMP="$(dirname "$0")/.rango.bin"; fallos=0
ok()  { echo "  ok   $*"; }; mal() { echo "  MAL  $*"; fallos=$((fallos+1)); }
echo "== Portada"
l=$(md5sum "$REPO/index.html" | cut -d' ' -f1); v=$(curl -sS --max-time 60 "$BASE/" | md5sum | cut -d' ' -f1)
[ "$l" = "$v" ] && ok "index.html en vivo = repo ($l)" || mal "index.html distinto (repo $l, vivo $v)"
echo "== Manifiesto, iconos y API"
x=$(curl -sSI -o /dev/null -w '%{http_code} %{content_type}' --max-time 30 "$BASE/manifest.webmanifest"); case "$x" in "200 application/manifest+json"*) ok "manifest: $x";; *) mal "manifest: $x";; esac
for i in iconos/icono-192.png iconos/icono-512.png iconos/apple-touch-icon.png; do c=$(curl -sSI -o /dev/null -w '%{http_code}' --max-time 30 "$BASE/$i"); [ "$c" = 200 ] && ok "$i 200" || mal "$i $c"; done
c=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$BASE/api/yo"); [ "$c" = 401 ] && ok "/api/yo sin sesión: 401" || mal "/api/yo $c"
echo "== Clips"
n=0; nok=0
for f in "$REPO"/clips/*.mp4; do
  b=$(basename "$f"); tam=$(stat -c %s "$f"); n=$((n+1)); bien=1
  x=$(curl -sSI -o /dev/null -w '%{http_code} %{content_type} %header{content-length}' --max-time 60 "$BASE/clips/$b")
  [ "$x" = "200 video/mp4 $tam" ] || { mal "$b HEAD: $x (esperado 200 video/mp4 $tam)"; bien=0; }
  x=$(curl -sS -o "$TMP" -w '%{http_code} %header{content-range}' --max-time 60 -H 'Range: bytes=1000-1999' "$BASE/clips/$b")
  if [ "$x" = "206 bytes 1000-1999/$tam" ]; then cmp -s <(dd if="$f" bs=1 skip=1000 count=1000 2>/dev/null) "$TMP" || { mal "$b: el trozo servido no coincide con el archivo"; bien=0; }
  else mal "$b rango: $x"; bien=0; fi
  p="${b%.mp4}.jpg"; x=$(curl -sSI -o /dev/null -w '%{http_code} %{content_type} %header{content-length}' --max-time 30 "$BASE/clips/$p")
  [ "$x" = "200 image/jpeg $(stat -c %s "$REPO/clips/$p")" ] || { mal "$p: $x"; bien=0; }
  nok=$((nok+bien))
done
ok "$nok de $n clips correctos (tipo vídeo, tamaño exacto, petición parcial 206 con el contenido correcto y portada)"
echo "== Cabeceras de un clip"
curl -sSI --max-time 30 "$BASE/clips/$(basename "$(ls "$REPO"/clips/*.mp4 | head -1)")" | tr -d '\r' | grep -iE '^(cache-control|x-robots-tag|accept-ranges|content-type):'
echo; [ $fallos = 0 ] && echo "RESULTADO EN VIVO: OK" || echo "RESULTADO EN VIVO: $fallos FALLOS"; exit $fallos
