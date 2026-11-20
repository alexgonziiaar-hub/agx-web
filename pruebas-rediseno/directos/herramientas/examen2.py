# Saca el examen a ciegas de un grupo del segundo lote: solo pregunta y opciones (sin solución, sin título, sin nombre de archivo).
# Uso: python3 -I examen2.py <grupo>   → escribe lote2/examen/<grupo>.json
import sys, os, json
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); L = os.path.join(B, 'lote2'); g = sys.argv[1]
qs = sorted(json.load(open(os.path.join(L, 'final', g + '.json'), encoding='utf-8'))['preguntas'], key=lambda q: q['archivo'])
json.dump([{'n': i, 'pregunta': q['pregunta'], 'opciones': q['opciones']} for i, q in enumerate(qs)], open(os.path.join(L, 'examen', g + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(qs)} preguntas a ciegas → {os.path.join(L, "examen", g + ".json")}  (n = posición por orden alfabético de archivo)')
