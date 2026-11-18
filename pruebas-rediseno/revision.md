# Revisión independiente · cuaderno ([R])
Rama rediseno-3d de /home/user/agx-web. Etiqueta de verificación: rev. Scripts propios: …/agx/tmp/rev/.
Estado por hallazgo: por comprobar / confirmado / descartado (+motivo) / arreglado (+commit).

## Lente A
- A1 campo no válido sin rojo — CONFIRMADO (medido: mismo borde que en reposo) → ARREGLADO en 8d3a56f (regla de error con la cadena de :not())
- A2 campos sin foco — CONFIRMADO → ARREGLADO en 8d3a56f (regla de :focus con la cadena de :not())
- A3 placeholder parece dato — CONFIRMADO (2,65 / 2,10 frente al valor) → ARREGLADO en 8d3a56f (--hundido-ayuda #68637C / #8880AD, peso 450: 4,68 y 5,31 contra el pozo, 3,07 y 3,16 contra el valor; 4,88 en la paleta oscura)
- A4 franja muerta de las teclas con ratón — CONFIRMADO (puls1.cjs: sin relleno el clic a +1 px se pierde) → ARREGLADO en cc6abc1 (::after invisible mientras está pulsada; pulsacion.cjs: 12/12 teclas actúan a +1, +2,5 y +4,5 px, igual que main)
- A5 cinta: 3 de 10 con ratón (= C1) — CONFIRMADO → ARREGLADO en cc6abc1 (barra fina con puntero fino; cinta.cjs arrastra el tirador: scrollLeft 0 → 989). OJO: Playwright oculta las barras; para verla, launch({ignoreDefaultArgs:['--hide-scrollbars']})
- A6 ficha de cumplimiento elegida: foco — CONFIRMADO → ARREGLADO en 2a68012 (con foco el cerco pasa a 3 px y se separa 5 px)
- A7 entrada en pantallas bajas — CONFIRMADO → ARREGLADO en e3bef44 (≤760 de ancho y ≤620 de alto: sin velas; 320×568 y 360×560 sin desplazamiento). De paso, apaisado 844×390 cabe entero (antes 28 px de desplazamiento)

## Lente B
- B1 ficha de operación en móvil — CONFIRMADO (captura rev-b y medida propia: «+160 $» partido, «N contr.» bajo la R) → ARREGLADO en 3c0208e (tr.op flexible con salto de línea; --cap/--sep; a ≤380 px miniatura de 50 px)
- B2 barra superior tapa reloj/título — CONFIRMADO (examen.cjs; también en ordenador a 1280×720) → ARREGLADO en a5101be (≤900 px la barra no se pega; subir() deja la vista bajo la barra pegada en ordenador)
- B3 marco fijo ocupa demasiado — CONFIRMADO → ARREGLADO en a5101be (.barra-sup estática ≤900 px, sin backdrop-filter; scroll-padding-top 12 px). Queda la barra de abajo de 69 px (apaisado: 82 % útil, como main)
- B4 márgenes seguros arriba — CONFIRMADO con simulación (safe.cjs, env()→59/34 px; heredado de main) → ARREGLADO en a5101be (.lateral con padding-top + env; body::after del color de la cabecera ≤900; .entrada con max(…, env))
- B5 tableta/apaisado: columna Resultado fuera — CONFIRMADO (heredado de main; también a 1100 px de ordenador) → ARREGLADO en b8dd1c6 (th:last-child y td.fuerte pegados a la derecha en .tabla-wrap; detalle abierto ajustado al ancho visible con cqw)
- B6 curva no responde al toque — CONFIRMADO PERO DESCARTADO: igual en main, no es del rediseño y arreglarlo es lógica nueva de JS (primer toque enseña, segundo abre); queda anotado en pendientes
- B7 test 360: «Siguiente» medio tapada — CONFIRMADO → ARREGLADO en b8dd1c6 (JS: elegir() hace scrollIntoView nearest del botón en práctica; b7.cjs: 46/46 px visibles a 360, apaisado, 390 y ordenador)
- B8 letra < 12 px en objetos — CONFIRMADO → ARREGLADO en b8dd1c6 salvo la barra del administrador a 360 px (11,5 px: acortar el rótulo sería cambiar texto) y lo heredado de main (horas de gráficas, chip IA)
- B9 zonas táctiles < 44 px — CONFIRMADO (43/42/43/25 px) → ARREGLADO en 3c0208e (fichas 45 y 44,3 px, paleta 44,5 px, «Sin setup · completar» con zona de 45 px por ::before)
- B10 pie del cajón a dos filas — CONFIRMADO (heredado) → MEJORADO en b0cb79c (una fila hasta 4 cifras a 390 px y hasta 3 a 360 px; con importes mayores sigue saltando a dos)
- B11 importar móvil: columna Resultado escondida — CONFIRMADO (heredado) → ARREGLADO en b8dd1c6 (misma regla que B5)

## Lente C
- C1 cinta (= A5) — duplicado de A5 → ARREGLADO en cc6abc1
- C2 entrada: placa y velas pequeñas — CONFIRMADO → MEJORADO en e3bef44 (≥1200×700: placa hasta 1180 px, velas clamp(430px,56vh,640px), marca 96 px; mesa con degradado duro de marca y rejilla; 1440: 31 → 46 % de pantalla, 1920: 19 → 35 %). No se tocó la escena de velas (escala vertical): riesgo de recortes
- C3 calendario/mapa: altura distingue poco — CONFIRMADO → ARREGLADO en 2a68012 (--col-max 22 px en tableta/ordenador; JS: alto = 0,12 + 0,88·|u|/máx; mínimo 3 px; móvil igual que antes: 12 y 10 px)
- C4 hero vacío del alumno nuevo — CONFIRMADO → ARREGLADO en b0cb79c (JS: pintarCurva pinta .h-fantasma con svg decorativo aria-hidden + el mismo texto; ocupa el alto de la columna)
- C5 tarjeta «Cuenta sana» en escalera — CONFIRMADO → ARREGLADO en 2a68012 (.hoy-dato alineado arriba)
- C6 pozos de pérdida en claro — CONFIRMADO → ARREGLADO en 2a68012 (--pierde-suelo #F3C3CA, --pierde-suelo-tinta #84101F: 6,49:1; --pierde-umbra y --pierde-labio). OJO: el material es global: también cambia racha, fichas ko, nq mal y reloj en rojo (más oscuros, mismo contraste o mejor)
- C7 columnas altas tocan la casilla anterior — CONFIRMADO → ARREGLADO en 2a68012 (--col-k .25 + calles de 10 px + 6 px a la izquierda: hueco mínimo 4,5 px, nada fuera de la rejilla; en móvil sigue .36)
- C8 día elegido = foco — CONFIRMADO → ARREGLADO en 2a68012 (cerco 3 px + número/ops encendido; con foco, cerco a 5 px)
- C9 mapa con un tercio vacío — CONFIRMADO → ARREGLADO en 2a68012 (≥1061 px el mapa reparte el alto: hueco bajo la leyenda 160 → 16 px)
- C10 1920: fichas del hero mal repartidas — CONFIRMADO (heredado, trivial) → ARREGLADO en 2a68012 (comprobado con c10.cjs a 1920, 1440 y 1280: el objetivo ocupa su línea)
- C11 errores pegado a operaciones — CONFIRMADO (heredado, trivial) → ARREGLADO en 2a68012 (#panel-ops con margen de 23 px)

## Diario de trabajo
- 8d3a56f: A1+A2+A3. Prueba OK (1.054). Script de medida: tmp/rev/campos.cjs.
- 3c0208e: B1+B9. Prueba OK. Scripts: tmp/rev/ficha.cjs, ficha2.cjs (recorte del panel), ficha3.cjs (anchos), tactil.cjs.
- cc6abc1: A4 + A5/C1. a5101be: B2 + B3 + B4 (toca JS: subir()). Prueba OK (1.054) sobre el árbol final de ambos.
- b8dd1c6: B5+B7+B8+B11 (toca JS: elegir()). Prueba OK. Scripts: tabla-t.cjs, b7.cjs.
- 2a68012: C3+C5+C6+C7+C8+C9+C10+C11+A6 (toca JS: fórmula de alto en pintarCalendario y pintarMapa). Prueba OK. Scripts: cal.cjs, sel.cjs, extremos.cjs. Decisión: NO poner día y cifra en fila (desbordaba en casillas de 62 px); con interlineado 1,15 caben en columna y solo crece la fila de un pozo de más de 14 px.
- e3bef44: A7+C2. b0cb79c: C4+B10. Prueba OK. Scripts: entrada.cjs, extremos.cjs (vacio, uno), pie.cjs.
- dba40e9: el «30» de hoy sobre un pozo quedaba en 3,96:1 con el suelo nuevo (lo cazó tmp/rev/auditar.cjs, copia del de P3) → tinta de la columna.
- VERIFICACIÓN FINAL sobre dba40e9 (árbol limpio, empujado a origin/rediseno-3d): agx-verificar.sh rev → RESULTADO: OK (1.054), 225 capturas,
  PROBLEMAS DE CAPTURA: ninguno, ERRORES DE PÁGINA: ninguno. Auditoría de contraste (d-claro, d-oscuro, t-claro, m-claro, m-oscuro, n-oscuro): 0 por debajo;
  táctil < 44 solo .bv-col (conocido). limpia.py informe: 0 declaraciones muertas. dif.py final→rev: 23 idénticas, 69 solo ruido, 133 cambian (todas por
  cambios buscados: marcador de posición más claro, hero 3 px más alto por la cinta, +23 px entre errores y operaciones, calendario/mapa, ficha, barra estática, entrada).
- Sección «Revisión independiente» añadida a progreso.md.

## ESTADO: TERMINADO. Arreglados o mejorados 27 de 29 hallazgos (A5 y C1 son el mismo). Sin arreglar: B6 (heredado, lógica nueva). Parciales: B3 (barra de abajo), B8 (barra del administrador a 360), B10 (importes de 5 cifras), C2 (escena de velas sin tocar).
