# Descarga los clips de la carpeta pública de Drive (lista.html) y saca sus datos. Uso: python3 -I descargar.py <lista.html> <carpeta descargas> <salida.json>
import sys, re, html, os, subprocess, json, time
lista, dest, salida = sys.argv[1:4]
s = open(lista, encoding='utf-8', errors='replace').read()
ent = re.findall(r'<div class="flip-entry" id="entry-([^"]+)".*?<div class="flip-entry-title">(.*?)</div>', s, re.S)
res = []
for i, (fid, t) in enumerate(ent, 1):
    nombre = html.unescape(t).strip()
    if not re.fullmatch(r'[A-Za-z0-9_.\-]+\.mp4', nombre): print('NOMBRE RARO, se salta:', repr(nombre)); continue
    ruta = os.path.join(dest, nombre); ok = False
    for intento in range(4):
        if os.path.exists(ruta) and os.path.getsize(ruta) > 50000:
            p = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size', '-show_entries', 'stream=codec_name,width,height', '-of', 'json', ruta], capture_output=True, text=True)
            try:
                j = json.loads(p.stdout); dur = float(j['format']['duration']); ok = True; break
            except Exception: pass
        url = f'https://drive.usercontent.google.com/download?id={fid}&export=download&confirm=t'
        subprocess.run(['curl', '-sS', '-m', '600', '-L', '-o', ruta, url], capture_output=True)
        time.sleep(1 + intento * 4)
    if not ok: print(f'{i:2d} FALLO {nombre}'); res.append({'archivo': nombre, 'drive': fid, 'ok': False}); continue
    v = [x for x in j['streams'] if x.get('width')][0]; a = [x for x in j['streams'] if not x.get('width')]
    # ¿moov antes que mdat? (arranque rápido)
    with open(ruta, 'rb') as f: cab = f.read(min(os.path.getsize(ruta), 4_000_000))
    fast = 0 <= cab.find(b'moov') < (cab.find(b'mdat') if cab.find(b'mdat') >= 0 else 10**12)
    res.append({'archivo': nombre, 'drive': fid, 'ok': True, 'bytes': os.path.getsize(ruta), 'seg': round(dur, 1), 'ancho': v['width'], 'alto': v['height'], 'video': v['codec_name'], 'audio': a[0]['codec_name'] if a else None, 'faststart': fast})
    print(f"{i:2d} ok {nombre}  {os.path.getsize(ruta)/1e6:.1f} MB  {dur:.0f} s  {v['width']}x{v['height']} {v['codec_name']}/{a[0]['codec_name'] if a else '-'} faststart={fast}", flush=True)
json.dump(res, open(salida, 'w'), ensure_ascii=False, indent=1)
okk = [r for r in res if r.get('ok')]
print(f"TOTAL: {len(okk)} de {len(ent)} · {sum(r['bytes'] for r in okk)/1e6:.0f} MB · {sum(r['seg'] for r in okk)/60:.1f} min · mayor {max(r['bytes'] for r in okk)/1e6:.1f} MB · más largo {max(r['seg'] for r in okk):.0f} s")
