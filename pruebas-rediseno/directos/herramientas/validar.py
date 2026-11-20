# Valida las preguntas de los tests de los directos y, si están todas, las une en preguntas-final.json.
# Uso: python3 -I validar.py <carpeta con C.json E.json G.json P.json> [C|E|G|P]   (con letra: solo esa categoría)
import sys, os, json
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = sys.argv[1]; solo = sys.argv[2] if len(sys.argv) > 2 else None
clips = {c['archivo'][:-4]: c for c in json.load(open(os.path.join(B, 'clips.json')))}
LIM = {'titulo': 80, 'pregunta': 260, 'explicacion': 400, 'clave': 150}
err = []; todas = []
for cat in ([solo] if solo else ['C', 'E', 'G', 'P']):
    ruta = os.path.join(d, cat + '.json')
    if not os.path.exists(ruta): err.append(f'falta {ruta}'); continue
    try: qs = json.load(open(ruta, encoding='utf-8'))['preguntas']
    except Exception as e: err.append(f'{ruta}: JSON no válido ({e})'); continue
    esperados = sorted(a for a in clips if a[0] == cat)
    if sorted(q.get('archivo', '') for q in qs) != esperados: err.append(f'{cat}: los archivos no coinciden con los {len(esperados)} clips de la categoría (ni más ni menos, sin .mp4)')
    for q in qs:
        a = q.get('archivo', '?')
        for k in ['archivo', 'titulo', 'pregunta', 'opciones', 'correcta', 'explicacion', 'clave']:
            if k not in q: err.append(f'{a}: falta «{k}»')
        for k, n in LIM.items():
            if isinstance(q.get(k), str) and len(q[k]) > n: err.append(f'{a}: «{k}» tiene {len(q[k])} caracteres (máx. {n})')
            if isinstance(q.get(k), str) and not q[k].strip(): err.append(f'{a}: «{k}» vacío')
        o = q.get('opciones')
        if not (isinstance(o, list) and len(o) == 4 and all(isinstance(x, str) and x.strip() for x in o)): err.append(f'{a}: tiene que haber 4 opciones de texto')
        else:
            for i, x in enumerate(o):
                if len(x) > 125: err.append(f'{a}: opción {i} con {len(x)} caracteres (máx. 125)')
            if len(set(x.strip().lower() for x in o)) < 4: err.append(f'{a}: opciones repetidas')
            ls = [len(x) for x in o]
            if isinstance(q.get('correcta'), int) and 0 <= q['correcta'] <= 3 and ls[q['correcta']] > 1.35 * max(l for i, l in enumerate(ls) if i != q['correcta']): err.append(f'{a}: la correcta es mucho más larga que las demás (se regala)')
        if not (isinstance(q.get('correcta'), int) and 0 <= q['correcta'] <= 3): err.append(f'{a}: «correcta» tiene que ser 0–3')
        if isinstance(q.get('clave'), str) and not q['clave'].startswith('En el clip:'): err.append(f'{a}: «clave» tiene que empezar por «En el clip:»')
        if 'gonci' in json.dumps(q, ensure_ascii=False).replace(a, '').lower(): err.append(f'{a}: escribe «Patrón Gonzi», no «gonci»')
        todas.append(q)
if not solo and not err:
    from collections import Counter
    rep = Counter(q['correcta'] for q in todas)
    if len(todas) != 45: err.append(f'hay {len(todas)} preguntas, tienen que ser 45')
    if any(rep.get(i, 0) < 8 or rep.get(i, 0) > 14 for i in range(4)): err.append(f'reparto de la correcta descompensado: {dict(rep)} (cada posición entre 8 y 14)')
if err:
    print('ERRORES (' + str(len(err)) + '):'); [print(' -', e) for e in err]; sys.exit(1)
if solo: print(f'OK: {len(todas)} preguntas de la categoría {solo} válidas'); sys.exit(0)
todas.sort(key=lambda q: q['archivo'])
# [DR] El id publicado (nombre del clip en la web y clave del progreso del alumno) no lleva «gonci»: es «gonzi». El material (Drive, descargas, transcripciones) conserva su nombre.
pub = lambda a: a.replace('gonci', 'gonzi')
fin = [{'id': pub(q['archivo']), 'cat': q['archivo'][0], 'tema': q['archivo'][:3], 'titulo': q['titulo'].strip(), 'pregunta': q['pregunta'].strip(), 'opciones': [x.strip() for x in q['opciones']], 'correcta': q['correcta'], 'explicacion': q['explicacion'].strip(), 'clave': q['clave'].strip(), 'seg': round(clips[q['archivo']]['seg']), 'ancho': clips[q['archivo']]['ancho'], 'alto': clips[q['archivo']]['alto']} for q in todas]
json.dump(fin, open(os.path.join(B, 'preguntas-final.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'OK: 45 preguntas válidas → {os.path.join(B, "preguntas-final.json")} · reparto {dict(sorted(Counter(q["correcta"] for q in todas).items()))}')
