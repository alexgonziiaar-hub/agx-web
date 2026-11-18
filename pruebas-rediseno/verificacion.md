# Segunda ronda de comprobación — cuaderno ([V])

Rama `rediseno-3d` (HEAD al empezar: 6dab448). Estados: por comprobar / confirmado / descartado + motivo / arreglado + commit.

| Id | Problema | Gravedad | Estado |
|---|---|---|---|
| V1-1 | Calendario y mapa: franja muerta de 10–12 px arriba en los días que más ganan (ratón) | media | confirmado (tmp/v/col.cjs: NO a +0,5…+9 px) → **arreglado en d7988f7**: la columna ya no baja al pulsar, la cara se oscurece. col.cjs: sí en todos los puntos (g y p, calendario y mapa) |
| V2-1 | Tarjeta «Cuenta sana» 901–1320 px: las cifras tapan el título | media | confirmado (tmp/v/cta.cjs: título pisado de 901 a 1280 con 3 cifras; con 2 cifras, a 901 y 1024; en main no) → **arreglado en a3098e3**: dos líneas cuando no cabe (3 cifras ≤ 1439 px, 2 cifras ≤ 1279 px), contenido centrado en bloque. cta.cjs y el p3.cjs del comprobador: título pisado y rótulos que se tocan = false de 901 a 1439; 1440, 1920, 820 y 390 idénticas a HEAD (dif.cjs) |
| V1-2 = V3-1 | Tarjeta «Examen final» (.tcard-ex): 3 px muertos arriba (overflow:hidden recorta el relleno de A4) | baja | confirmado (tmp/v/tcard.cjs: NO a +0,5…+3 px en HEAD) → **arreglado en d7988f7**: fuera overflow:hidden (no recortaba nada: 82 píxeles con diferencia ≤ 6/255 en reposo). Las 8 tarjetas actúan a +0,5…+4 px |
| V1-3 | Con margen seguro arriba, subir() deja «Salir» y el reloj bajo la franja de estado | baja | confirmado (ver-1/seg-v.log: salir=0/44, reloj=28/66; latente) → **arreglado en 732d049**: subir() suma el alto de body::after y scroll-padding-top suma env(top). Copia de v1-b-form.cjs seg-v: salir=44/44, reloj=66/66; con env()=0, `examen` da un registro idéntico al del comprobador (72 líneas) |
| V1-4 | Contratos: tras el error, «+» deja el campo en rojo (heredado de main) | baja | confirmado (v1-varios-a.cjs ct: sigueRojo en rama y en main) → **arreglado en 732d049**: ct-mas y ct-menos llaman a alCambiar (lo mismo que al teclear). sigueRojo=false, msgOculto=true. Único cambio de comportamiento frente a main, a propósito; no toca lo que se guarda |
| V2-2 | Entrada a 2560×1440: la placa se queda en el 21 % | baja | confirmado (captura ver-2/cap/ent-2560x1440-login.png) → **arreglado en 63ab975**: desde 2000×1000 la placa mide min(60vw, 110vh) y las velas clamp(430px,56vh,34vw). tmp/v/ent.cjs: 34 % a 2560×1440 y a 3840×2160, sin desplazamiento en los 4 estados; 1440 y 1920 como antes (46 % y 35 %) |
| V3-2 | Hoja de instalar: Tab se sale, Ctrl+K abre la paleta debajo, al navegar se queda abierta | baja | confirmado (ver-3/aviso.log I6, I8, I9) → **arreglado en d4015bc** solo en #instalar (código nuevo): trampa de Tab, Ctrl/⌘+K no actúa, se cierra con hashchange. Copias de v3-aviso.cjs (0 fallos) y c3-aviso.cjs (118 OK) en tmp/v/v3 y tmp/v/c3. #imp y #rut se comportan como en main: no se tocan (pendiente heredado) |
| V3-3 | Hoja de instalar en pantallas bajas: se abre desplazada (título y X fuera) | baja | confirmado (v3-hoja-baja.cjs: FALLO a 320×568, 320×454 y 667×375) → **arreglado en d4015bc**: focus({preventScroll:true}) + scrollTop=0. v3-hoja-baja.cjs: 7 de 7 OK |
| V4-1 | Vista previa de importar en móvil: «Resultado» pegada tapa «Dirección» y «Contr.» | baja | confirmado (capturas ver-4/cap/importar-rama-390x844.png frente a importar-main; tmp/v/imp.cjs: «Largo» tapado 76–100 %) → **arreglado en 2901e1f**: hasta 520 px la vista previa son fichas de dos líneas (como la tabla de operaciones); imp.cjs: todas las celdas «ok» de 320 a 520 px y tabla normal desde 521 (cabe). Además, en la tabla de operaciones (641–1260 px) la columna pegada lleva filo y sombra dura en un ::before: el box-shadow de 1 px que había no pintaba (bordes fundidos) |

## Notas
- Mis scripts: `…/agx/tmp/v/` (`lib.cjs` = montaje de ver-3 con main en :4411; HEAD de partida (6dab448) servido en :4440 desde `tmp/v/head/`).
  `col.cjs` (clic real en columnas g/p del calendario y del mapa a +0,5…+25 px), `tcard.cjs` (8 tarjetas de Práctica libre), `g1-shots.cjs`, `cta.cjs` (tarjeta de la cuenta por anchos y casos).
- Ojo al medir pulsaciones: si quedan contextos de Playwright sin cerrar, la página deja de pintar y la transición no avanza (falso «sí»).
- Grupo 1 (d7988f7): prueba RESULTADO: OK (1.054). Capturas: tmp/v/cap/g1-cal-cmp.png, g1-mapa-cmp.png (pulsada antes/después, claro y oscuro), g1-modos-cmp.png.
- Grupo 2 (a3098e3): prueba OK. Capturas: tmp/v/cap/g2-tres.png, g2-b.png (3, 2 y 1 cifras a varios anchos), rev-cta.png (revisión del administrador).
- Grupo 3 (d4015bc): prueba OK a la segunda. La primera pasada dio 2 fallos en «El tabulador no sale del cajón» (Diario · escritura): es una carrera de la propia
  prueba (abrirCajon enfoca #f-fecha con setTimeout 0 y la prueba enfoca «Guardar» justo después); el código del cajón no se ha tocado. Repetido: grupo suelto 2 veces OK y prueba completa OK.
  Capturas: tmp/v/cap/g3-hoja.png (667×375 claro, 320×568 oscuro, Tab en 390×844).
- Grupo 4 (2901e1f): prueba OK. Capturas: tmp/v/cap/g4-imp.png (antes/después a 390, 360 oscuro y 320), g4-ops2.png (columna pegada: reposo, ratón, desplazada, fila abierta; claro y oscuro).
  #tabla idéntica a HEAD a 390, 640, 1261 y 1440 (dif.cjs).
- Grupo 5 (732d049): prueba OK. Capturas: tmp/v/cap/g5-ct.png; registros en tmp/v/v1/.
- Grupo 6 (63ab975): prueba OK. Capturas: tmp/v/cap/g6-ent-2560.png, ent-fin-*.png.
- No tocado a propósito: #imp y #rut (Tab se sale, Ctrl+K por debajo, no se cierran al navegar) se comportan igual que en la web publicada.

## Verificación final (HEAD = 63ab975, empujado a origin/rediseno-3d; main sigue en 988c51e)
- `agx-verificar.sh v`: prueba RESULTADO: OK (1.054 comprobaciones en 76,3 s); 225 capturas, PROBLEMAS DE CAPTURA: ninguno, ERRORES DE PÁGINA: ninguno. Carpeta: `…/agx/v/` (+ 18 `instalar-*.png` copiadas de `tmp/v/c3/cap/`, c3-aviso.cjs: 118 OK).
- Frente a `…/agx/app/` (tmp/p3/dif.py): 172 idénticas, 48 solo ruido, 5 cambian: `m-oscuro-18-importar-vista-previa(.png y -completo.png)` y `t-claro-01-diario-resumen-mes.png` (lo tocado: fichas y filo de la
  columna pegada) y `m-oscuro-09` + `m-oscuro-22` (desplazamiento suelto de la captura: repetidas a solas con el código de antes (:4440) y el de ahora salen idénticas, `v-rep-head/` y `v-rep-rama/`).
- Datos (copia de la prueba diferencial de V4 en tmp/v/v4): localStorage + IndexedDB idénticos a main en los 24 bloques; peticiones /api/* con el mismo patrón ✓/✗ que tenía la rama antes de esta ronda
  (los 4 avisos son los que ya vio V4; en Formación-móvil el último cuerpo enviado es idéntico).
- Tabla de pulsaciones del comprobador (copia de v1-varios-a.cjs puls): todo «sí» con ratón y con dedo, calendario, mapa y tarjeta del examen.
- limpia.py informe: 0 declaraciones muertas.
- Servidores auxiliares (:4411 main-copia y :4440 HEAD de partida) parados al terminar; :4400 sigue sirviendo la rama.
- Sin hacer: probar en teléfonos reales. #imp y #rut siguen como en main (ver progreso.md, «Segunda ronda de comprobación», punto 3).
