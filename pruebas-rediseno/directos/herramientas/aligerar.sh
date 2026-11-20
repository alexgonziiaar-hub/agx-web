#!/bin/bash
# Aligera los clips para la web: mismo tamaño de imagen y 30 fps, vídeo H.264 con calidad constante y voz en mono a 64 kb/s.
# Uso: bash aligerar.sh <carpeta originales> <carpeta salida>     (salta los que ya están hechos; registro por la salida estándar)
src="$1"; out="$2"; mkdir -p "$out"
for f in "$src"/*.mp4; do
  b=$(basename "$f"); d="$out/$b"
  [ -s "$d" ] && [ -s "$d.ok" ] && continue
  for crf in 28 25 22; do
    nice -n 19 ffmpeg -y -v error -i "$f" -map 0:v:0 -map 0:a:0 -c:v libx264 -preset medium -crf $crf -pix_fmt yuv420p -profile:v high -level 4.0 -threads 2 \
      -c:a aac -b:a 64k -ac 1 -ar 48000 -movflags +faststart -map_metadata -1 "$d.tmp.mp4" || { echo "ERROR ffmpeg $b"; continue 2; }
    ssim=$(nice -n 19 ffmpeg -hide_banner -threads 2 -i "$d.tmp.mp4" -i "$f" -lavfi ssim -f null - 2>&1 | grep -o 'All:[0-9.]*' | cut -d: -f2)
    awk -v s="$ssim" 'BEGIN{exit !(s>=0.985)}' && break
  done
  do=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"); dn=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$d.tmp.mp4")
  to=$(stat -c %s "$f"); tn=$(stat -c %s "$d.tmp.mp4")
  if awk -v a="$do" -v b="$dn" 'BEGIN{d=a-b; if(d<0)d=-d; exit !(d<0.2)}' && [ "$tn" -lt "$to" ] && awk -v s="$ssim" 'BEGIN{exit !(s>=0.985)}'; then
    mv "$d.tmp.mp4" "$d"; echo "$crf $ssim $to $tn" > "$d.ok"; echo "ok $b crf=$crf ssim=$ssim $to -> $tn ($(( tn*100/to ))%)"
  else
    rm -f "$d.tmp.mp4"; cp "$f" "$d"; echo "orig $ssim $to $to" > "$d.ok"; echo "SE QUEDA EL ORIGINAL $b (ssim=$ssim dur $do/$dn tam $to/$tn)"
  fi
done
echo FIN
