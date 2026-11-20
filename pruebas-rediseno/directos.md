# Cuaderno · «Tests de los directos» (rama `tests-directos`, commits `[D]`) — TERMINADO

Rama creada desde `origin/main` (ecdabe3) y subida a `origin/tests-directos`. 13 commits `[D]` (11238f7 … 9a923cc). No se ha tocado `main`,
no hay pull request y `netlify/functions/` está igual. Scripts propios en `…/agx/tmp/d/` (ver el final).

## Qué ve el alumno
- **Formación tiene una tercera pestaña, «Directos»** (con el distintivo «Nuevo» hasta que entra por primera vez). También se llega desde una
  banda-tecla en la ruta por niveles («Tests de los directos · 45 clips») y desde las acciones rápidas («Tests de los directos»).
- **Portada** (`#formacion/directos`): placa oscura con el anillo (respondidos de 45; verde = aciertos, rojo = fallos), «Empezar» /
  «Continuar: clip NN» / «Repasar fallos (n)» y las cifras; debajo, las cuatro categorías (Conceptos 12, Entradas 17, Gestión 9, Psicología 7)
  con su progreso y sus clips como tarjetas-tecla: «Clip 07 · Entradas · 0:36» y el estado con icono (sin responder / Acertado / Fallado).
  **El título del clip solo se ve cuando ya se ha respondido.**
- **Test de un clip** (`#formacion/directos/7`): «Clip 07 de 45 · Conceptos», la pregunta y cuatro opciones A–D como las teclas de los tests
  (atajos A–D, 1–4; Intro o flecha derecha para seguir). Antes de responder, la pantalla del clip está apagada («Responde para ver el clip»).
  Al responder: opción correcta y fallada marcadas (icono + color + texto para lectores), el veredicto («Correcto» / «Incorrecto, era la D» +
  la opción correcta), «Así lo explica Alex en el directo», el título, la clave («En el clip: …»), el vídeo (con su portada; no se reproduce solo)
  y la explicación escrita. Botones: «Siguiente clip» (el siguiente sin responder; si no quedan, «Ver el resumen»), «Repetir» y «Volver».
- Un clip ya respondido se abre en **modo repaso** (todo a la vista) con «Repetir». **«Repasar fallos»** recorre los fallados como preguntas
  nuevas («Repaso de fallos · 1 de 3») y termina con «Terminar el repaso» y un aviso («Repaso terminado: 2 de 3 acertados»).
- Si el vídeo no carga: «No se ha podido cargar el clip. Revisa tu conexión.» con «Reintentar».
- Al completar los 45, confeti (salvo con movimiento reducido) y la portada dice «Los 45 clips respondidos».

## Dónde vive cada cosa (`index.html`)
- **Datos:** sección `/* ---------- Tests de los directos … */` (delante de `const EXAMEN_N`): `DIR_CAT` (C, E, G, P con nombre y descripción),
  `const DIRECTOS=[…]` (una línea JSON por clip, idéntica a `preguntas-final.json`: id, cat, tema, titulo, pregunta, opciones, correcta,
  explicacion, clave, seg), `ICO.play`.
- **Estado:** `estDirectos(st)` (lee `state.directos`; si falta o no es un objeto, `{}`), `dirResp(d,st)` (respuesta válida o null),
  `dirOk(d,st)` (true/false/null: **se decide con `o` y la clave de aquí, no con el `ok` guardado**), `progresoDirectos(st,cat)`,
  `dirPendiente(desde)`, `dirFallados()`. `estadoVacio()` lleva `directos:{}`.
- **Vistas y acciones** (misma sección): `dirVista` (número del clip, sale de la dirección), `dirDeNuevo` (id que se responde otra vez) y
  `dirRep` ({cola}, repaso de fallos) solo en memoria; `dirNuevo()` / `dirVisto()` (localStorage «agx-directos» = visto), `dirActual()`,
  `dirLimpia()` y `pararClip()` (los llama `render()` al empezar), `anilloDirectos()`, `bandaDirectos()`, `vistaDirectos()`, `vistaDirecto(n)`,
  `trasDirectos()` (escucha `error` y `playing` del vídeo), `dirALaVista()`, `elegirDirecto(o)`, `dirSiguiente()`, `dirRepetir()`,
  `revDirectos()` (línea para el administrador), `dirRepasar()`.
- **Enganches en lo que ya había** (lo imprescindible): `tabsForm()` (tercera pestaña; clase `tres`), `vistaRuta()` (`${bandaDirectos()}` entre
  la cabecera y los niveles), `renderFormacion()` (una línea), `leerRuta()` (la expresión de `#formacion…` y `dirVista`), `render()`
  (`pararClip(); dirLimpia();`), el `switch` de acciones (`dir-opcion`, `dir-sig`, `dir-repetir`, `dir-fallos`, `dir-reintentar`), el `keydown`
  (bloque propio delante de los atajos del test), el `hashchange` (`dirVista` en la clave que decide si la vista nueva empieza arriba),
  `accionesPaleta()` (una acción), `resumenAlumno()` + tarjeta del alumno y `cabDiario()` (progreso para el administrador).
- **CSS:** bloque `TESTS DE LOS DIRECTOS ([D])` al final de `<style>` (con sus `@media` dentro). Teclas nuevas con la clase utilitaria
  `.tecla` (ya está en las listas de reposo, pulsada y franja de clic): `.tecla.dir-card`, `.tecla.dir-banda`. Lo demás reutiliza recetas:
  `.hero.hero-form` + `.f-anillo` + `.ruta-datos`, `.opcion`, `.veredicto-txt`, `.fallo-buena`, `.autor`, `.racha`, `.mini-barra`, `.ia-chip`.
- **Fuera de index.html:** `clips/` (45 mp4 + 45 jpg, 257 MB) y `netlify.toml` (cabeceras de `/clips/*` y tipo del manifiesto).

## Estado guardado
`state.directos = { "<id del clip>": { o: 0…3 (opción elegida), ok: true|false, f: "AAAA-MM-DD" } }`
- Se guarda al responder con `guardar()` (localStorage «agx-alumnos-v4» en ejemplo; `PUT /api/datos` en servidor: el JSON entero, 3,9 kB como
  mucho con los 45). Entrar, mirar o «Repetir» sin responder no guarda nada.
- Estado antiguo sin la clave: se lee como vacío y no se toca nada más. En servidor, `normalizarEstado()` la añade vacía en memoria
  (`directos:{}`), así que el siguiente PUT de ese alumno ya la lleva aunque no haya respondido nada.
- Va por `id` (estable aunque cambie el orden); en pantalla y en la dirección el clip va por su NÚMERO (1…45), porque el id es el título.

## Decisiones
- **Ruta por número, no por id:** `#formacion/directos/7`. El id (`C02_patron-gonci-en-tierra-de-nadie`) solo aparece en `src`/`poster`
  del vídeo, que no existe hasta responder. La prueba comprueba que ni título, ni id, ni clave, ni explicación están en el DOM antes.
- **Orden de las opciones:** el del material (la correcta ya viene repartida 11/11/12/11); no se barajan.
- **Todo 16:9:** los clips son 1280×720 o 1054×592 (1,778 y 1,780); la pantalla reserva 16/9 con `aspect-ratio` (y con relleno donde no existe).
- **«Nuevo»:** se apaga al entrar por primera vez en ese dispositivo (localStorage) o si ya hay algo respondido. No escribe en el estado.
- **Veredicto dentro de la placa del clip** (1.ª ronda de arte): en ordenador, al responder se ve todo de un vistazo (opciones marcadas a la
  izquierda; veredicto, título y vídeo a la derecha; «Siguiente clip» abajo). En móvil la placa del clip queda entera bajo las opciones y la
  explicación escrita va después. `dirALaVista()` solo desplaza lo justo.
- **Administrador:** mirando a un alumno (`#alumnos/<id>`) no existe la vista de los directos (solo se pinta su Diario): es solo lectura por
  construcción. Ve el progreso en la tarjeta del alumno («Tests de los directos 9 de 45 · 7 aciertos», solo si ha empezado) y en la cabecera
  de su diario. Los directos del administrador son los suyos.
- **Sin miniaturas en la portada:** más ligera en el móvil y ninguna imagen de un clip sin responder.
- **Aviso de carga:** el `<video>` va con `preload="none"`: solo pide la portada; el mp4 se pide al darle a reproducir.

## Pruebas
- `tools/agx-e2e.cjs` (la de siempre): **RESULTADO: OK, 1.054 comprobaciones, sin tocar ninguna**. La primera pasada completa dio un fallo en
  «Diario · escritura › …y con Mayús+Tab, del primero al último»: es la carrera conocida de la propia prueba (ver `progreso.md`, [V] §4);
  repetido el grupo tres veces y la prueba completa después, pasa.
- `tools/agx-e2e-directos.cjs` (nueva, mismo estilo): **RESULTADO: OK, 407 comprobaciones** en 5 grupos: «Datos y archivos» (45 clips,
  12/17/9/7, idénticos al JSON, cada mp4/jpg en el repositorio, en git y servido en local con su tipo y tamaño, MP4 con arranque rápido,
  netlify.toml válido), «Modo ejemplo» (pestaña, «Nuevo», portada, enlace directo, el título no aparece antes, acertar, fallar, vídeo con
  src/poster/preload/controls/playsinline, error de carga, atajos, atrás/adelante/recarga, repaso, «Repetir», «Volver», acción rápida),
  «Estado y repaso» (estado antiguo, valores raros, «Repasar fallos», último clip, todo respondido), «Servidor simulado» (PUT con la clave
  nueva y el resto idéntico, lecciones bloqueadas, administrador en solo lectura) y «Tamaños y temas» (360/390/820/1440 × claro/oscuro:
  desbordamiento, zonas de 44 px, foco, proporción del vídeo, movimiento reducido).
- `tools/agx-shots.cjs`: 7 capturas nuevas (43 portada, 44 test sin responder, 45 acertado con clip, 46 fallado, 47 portada con progreso,
  48 repaso de fallos, 49 todo respondido) en los seis juegos (1440 claro/oscuro, 820, 390 claro/oscuro, 360), con «-arriba» y «-ventana»
  (lo que se ve justo al responder). Lucía (servidor simulado) lleva ahora 9 clips respondidos para que salga el progreso del administrador.
- Auditoría de contraste, zonas táctiles, animaciones y desbordamiento (`tmp/d/auditar.cjs`, copia de la de P2) en 6 vistas × 6 juegos:
  0 textos por debajo de 4,5:1, 0 zonas < 44 px, sin desbordamiento, sin errores; una sola animación infinita (el latido de la sesión, de antes).
- Clips: `ffprobe` de los 45 (H.264 yuv420p + AAC, duración = `seg` ± 1 s, 16:9), 46 minutos en total; copia idéntica byte a byte del material.
- Verificación final: etiqueta `d` (`…/agx/d/`). Frente a `…/agx/c/` (`tmp/p3/dif.py`): solo cambian las capturas esperadas (30 y 61, la ruta
  con la pestaña y la banda; 41, la pestaña; 80, 81 y 83, el progreso para el administrador). `d-claro-82` y `d-claro-38` difieren por el ruido
  conocido (repetidas a solas: 82 idéntica; 38, un píxel del anillo del reloj).

## Dirección de arte (dos rondas)
1. Veredicto arriba de la placa del clip y explicación debajo, en una columna propia (antes había que desplazar en ordenador para ver el
   veredicto); rótulo de la portada sin repetir el anillo; progreso de la categoría en una línea a 360 px; pregunta con menos peso.
2. Cabecera del test en una fila (volver + contador) y título debajo (44 px menos en el móvil); placa de la pregunta más ceñida para que
   «Siguiente clip» se vea entero a 1440×900; fuera el párrafo que repetía la pantalla apagada; a 360 px, opciones un 10 % más anchas.

## Conocido / pendiente
- **No se ha podido comprobar la reproducción** (este Chromium no trae H.264/AAC). Probar en un iPhone y un Android: reproducir, pantalla
  completa, girar el teléfono y que el vídeo se pare al cambiar de clip (`pararClip()`).
- Chromium enseña un instante (< 1 s) su indicador de carga al crear el `<video>`; es del navegador, no hay petición del mp4.
- Los clips pesan 257 MB dentro del repositorio: cada alumno que vea los 45 descarga ese volumen del ancho de banda de Netlify.
  Caché de una semana en `/clips/*`: si se sustituye un clip, mejor con otro nombre.
- Sin H.264 o con el vídeo caído, el aviso dice «Revisa tu conexión» también cuando el motivo es otro.
- «Nuevo» es por dispositivo: en un segundo móvil vuelve a salir hasta entrar (o hasta que haya algo respondido).
- En el repaso de fallos no hay «Repetir» ni «saltar»; recargar a mitad vuelve al estado guardado (se pierde la cola, no las respuestas).
- Los números de clip dependen del orden de `DIRECTOS`: si se intercalan clips nuevos, los enlaces por número cambian (el progreso no).
- Duda para el mentor (del contraste con las transcripciones): en `E04_falsa-ruptura-en-el-imbalance-de-renko-y-de-una-ho`, «me pondría esto
  por aquí abajo»: ¿la orden de entrada o el stop? La pregunta vale en los dos casos.
- La prueba antigua tiene su carrera de siempre en «El tabulador no sale del cajón»: si falla una vez, repetir.

## Scripts propios (`…/agx/tmp/d/`)
`parche.py` (sustituciones con ancla única en index.html), `p1_datos.py` / `p2_vistas.py` (los dos primeros parches), `commit.sh "<título>"
"<cuerpo>"` (añade, hace el commit con las dos líneas finales y sube a `tests-directos`), `subir-lote.sh N` + `lotes.json` (los clips en
5 commits de ≤ 60 MB), `ver.cjs <tag> <hash> <png> [pasos] [resp]` (captura suelta con estado sembrado), `auditar.cjs` (copia de la de P2),
`spin.cjs` (el indicador de carga del vídeo), `cap/` (capturas de las dos rondas), `aud.log`, `dir-*.log`, `e2e-d1.log`, `verificar-d.log`.

---

# Revisión del apartado (commits `[DR]`) — TERMINADA (3 commits: aa54304, 1824924, f491e57; todo subido a `origin/tests-directos`)

Tres lentes: A (datos y código), B (pantallas), C (contenido). Scripts propios de esta fase en `…/agx/tmp/dr/`. Los 21 hallazgos se comprobaron
antes de tocar (todos eran reales): 19 arreglados (A3 es una mitigación), 1 descartado (A2, aceptado por el cliente) y 1 pendiente (B5, para el
paso siguiente).

| id | qué | gravedad | estado |
|----|-----|----------|--------|
| A1 | Dos dispositivos: el que estaba abierto pisa lo del otro | media | ARREGLADO y demostrado con pruebas (grupos «Dos dispositivos» y «El resto guarda igual»); ver «A1» más abajo |
| A2 | Los 45 clips son públicos sin sesión | media | DESCARTADO: conocido y aceptado por el cliente (son archivos estáticos de la propia web) |
| A3 | Responder y salir al instante con diario > 64 kB pierde la respuesta | baja | MITIGADO con A1 (la subida sale en cuanto contesta el servidor, no a los 700 ms; probado: diario de 423 operaciones, irse a los 450 ms → llega). Queda el límite del navegador: irse en los primeros ~100 ms con un estado > 64 KiB sigue sin llegar, como en lo publicado |
| A4 | Direcciones de clip mal escritas caen al Diario | baja | ARREGLADO (leerRuta): todo lo que cuelga de `#formacion/directos/` y no es un número de clip dice «No encuentro ese clip»; `…/7/` abre el 7 |
| A5 | La prueba nueva no caza 3 fallos sembrados ni el guardado al salir | baja | ARREGLADO: cuatro comprobaciones nuevas; los tres fallos sembrados (n01, n08, n14) ahora dan FALLO; el guardado de salida se prueba con un servidor HTTP de verdad |
| A6 | `function plural` dos veces | baja | ARREGLADO: queda solo la de siempre (bloque del plan) |
| B1 | El aviso de «no se ha podido cargar» queda bajo la barra | media | ARREGLADO: el aviso va DENTRO de la pantalla, sobre el vídeo, con «Reintentar» como tecla blanca. Antes se veían 8 de 114 px a 390×844 (0 en apaisado); ahora entero en los siete tamaños medidos |
| B2 | 1280×720: la D bajo el pliegue y «Siguiente clip» fuera | media | ARREGLADO: «Pregunta · 4 opciones · clip de m:ss» y disposición ceñida para portátil bajo (`@media (min-width:1061px) and (max-height:880px)`, y hasta 960 px de alto si el ancho es ≤ 1380). D entera en 45 de 45 a 1280×720, 1366×657, 1280×800/890 y 1536×730 (antes bajo el pliegue en 34 y 45 de 45); «Siguiente clip» a la vista tras responder. 1440×900 no cambia |
| B3 | Móvil apaisado: el clip no cabe | media | ARREGLADO: en apaisado (alto ≤ 520 px) la placa del clip respondido va a dos columnas (veredicto, título y clave a la izquierda; vídeo a la derecha) y el vídeo nunca pasa de lo que deja libre la barra. 844×390: vídeo 437×245 entero a la vista con el veredicto (antes 768×431 con 72–124 px visibles) |
| B4 | Volver a ver un clip respondido en el móvil | media | ARREGLADO: en móvil y tableta un clip ya respondido se abre por su placa (vídeo entero a la vista, como al responder); «Volver» y el enlace de arriba dejan a la vista y con el foco la tarjeta del clip (antes, arriba del todo); con todo respondido, un clip abierto para repasar lleva «Siguiente clip» (por orden), «Anterior», «Repetir» y «Volver» |
| B5 | Portadas de 640 px, borrosas | baja | PENDIENTE para el paso siguiente (se sustituyen los clips y sus portadas; aquí no se toca `clips/`) |
| B6 | Portada larga en el móvil | baja | ARREGLADO: en ≤ 640 px los clips sin responder van de dos en dos y compactos («Clip 21 · 1:12»; el texto completo sigue para lectores de pantalla), los respondidos a todo el ancho, y bajo la placa hay cuatro accesos a las categorías con su «n de m». Sin empezar: 3.142 px (3,7 pantallas) en vez de 4.930 (5,8) |
| C1–C9 | Contenido (clips 28, 40, 37, 20/23, 29, «ahorcar», términos, firma, «gonzi») | media/baja | ARREGLADOS en aa54304 (comprobado al reanudar: validador OK con 45 y DIRECTOS idéntico a preguntas-final.json) |

**Reanudación (20-nov):** la primera sesión de la revisión se cortó tras el commit aa54304. Lo que había sin commit: A6, A4 y A1 a medias.
Instrucciones nuevas para esta fase: A2 se descarta (aceptado); B5 no se toca (paso siguiente); A1 solo se queda si se demuestra con pruebas
automáticas; nada en el código puede depender de que sean 45 clips (serán 90) y la prueba nueva lleva el total y el reparto en constantes.

## A1 · Dos dispositivos (cómo queda)
- **Qué hace:** en modo servidor, responder un clip ya no usa `guardar()` (subida aplazada 700 ms del estado entero). Usa `dirSubir()`: pide
  `GET /api/datos`, une lo del servidor con lo de aquí (`dirUnir`) y hace el `PUT` en el momento. `dirBase` es la foto clave a clave del estado
  tal como estaba en el servidor la última vez que lo supimos (al abrir, `arrancar()`, y tras cada subida de `dirSubir`).
  - Claves que este dispositivo NO ha tocado desde la foto → se toman del servidor (operaciones, plan, objetivo, ruta, periodo…).
  - Claves que SÍ ha tocado → se quedan como están (lo de siempre: manda el último que guarda).
  - `directos` se une clip a clip: no se pierde ninguna respuesta; si los dos han respondido el mismo clip, gana la que es nueva aquí.
  - Solo se une mientras el alumno sigue en los tests de los directos; si ya se ha ido a otra vista, o el administrador ha abierto a un alumno,
    se sube tal cual. Si el GET falla, tarda más de 6 s o no trae un estado, se sube tal cual.
  - Mientras no esté confirmado, `tGuardar` sigue puesto (red de seguridad a los 9 s): si el alumno se va, lo envía el guardado de salida.
  - Si el servidor ya tiene exactamente lo mismo, no se hace el PUT.
- **Lo que se ha tocado fuera del bloque de los directos:** `subirDatos(salida, st)` devuelve `true` si llegó y sube `st || estadoPropio || state`
  (antes `state`: si el administrador abría el diario de un alumno con un guardado suyo pendiente, se subía el estado del alumno como suyo);
  `arrancar()` toma la foto. `guardar()`, el `pagehide` y `asegurarGuardado()` están igual.
- **Límite que queda (ya está en lo publicado):** el guardado del resto de la web sigue subiendo el estado entero sin leer antes. Un portátil que
  lleve la web abierta desde antes y apunte una operación pisa las respuestas que el móvil haya guardado después; se recuperan solas con la
  siguiente respuesta del móvil si sigue abierto (probado). Arreglarlo del todo pide tocar el servidor (versión o fusión en `alumnos.mjs`) o el
  guardado general; queda fuera de esta rama.
- **Pruebas (agx-e2e-directos.cjs):**
  - «Dos dispositivos» (88 comprobaciones, servidor HTTP real en 127.0.0.1 con `--host-resolver-rules`): móvil abierto desde antes (y que antes se
    ha paseado por toda la web) + portátil que
    responde, apunta una operación y cambia el objetivo → no se pierde nada de ninguno; el mismo clip en los dos; el otro con la versión publicada
    abierta; GET con 500 / no JSON / null / sin datos / no es un estado / conexión cortada / no contesta (6 s) / lento; `directos` estropeado o con
    entradas raras en el servidor; dos respuestas seguidas; respuesta + cambio de periodo; segunda respuesta mientras sube la primera; irse al
    Diario antes de que conteste; salir al instante (otra página, recargar, cerrar, durante la subida); diario de más de 64 KiB; administrador.
  - «El resto guarda igual» (11): el mismo recorrido (periodo, operación nueva con captura, edición, objetivo, plan, test de lección, práctica,
    salida con guardado pendiente) contra `origin/main` y contra la rama: mismas 37 lecturas, mismas 11 escrituras en el mismo orden y con el mismo
    contenido (salvo `directos:{}`), un solo `GET /api/datos` (al abrir).
  - Fallos sembrados (`tmp/dr/mutar.py` + `correr.sh`): los 15 de esta lente cazados (a1…a11, con a10b, de A1/A4 y n01, n08, n14 de la revisión).
  - Además, la diferencial grande de la revisión (`dir-a/dif.cjs` + `comparar.cjs servidor`): las únicas 23 diferencias siguen siendo `directos:{}`.

## Lente B (cómo queda)
- **B1** `vistaDirecto`: `#dir-error` es hijo de `.dir-pantalla` (posición absoluta, `inset:0`, fondo oscuro al 92 %) y «Reintentar» es `.boton.blanco.peq`.
  Fuera la regla móvil con `:has(+[hidden])`.
- **B2** `.p-num` dice cuántas opciones hay (`d.opciones.length`). CSS: bloque «portátil bajo» (columnas 7:6, enunciado 17 px, opciones más ceñidas).
- **B3** la placa respondida lleva la clase `hecho`; bloque «móvil apaisado» (dos columnas + ancho del vídeo limitado por `100dvh`, con `100vh` de
  reserva; sin `aspect-ratio` se queda como estaba).
- **B4** `dirSig(n)` (destino del botón principal), `dirReciente` (id del clip recién respondido: decide si el final es «Ver el resumen» o seguir
  repasando), `dirAlResumen`, `dirTrasNavegar(deClip)` (lo llama el `hashchange` tras `scrollTo(0,0)` cuando la navegación no viene del menú) y
  `dirALaVista(alAbrir)`. Acción nueva `dir-ant` y flecha izquierda. «Ver el resumen» y «Terminar el repaso» siguen yendo arriba.
- **B6** `li.resp`, `<span class="dir-m-cat">` dentro del `<small>` (mismo texto que antes), `<nav class="dir-atajos">` con botones
  `data-accion="dir-cat"` (solo visibles en ≤ 640 px).
- **Pruebas:** grupo nuevo «Pantallas difíciles» (69 comprobaciones: 1280×720, 1366×657, 1280×890 y 1440×900 con los 45 clips; apaisado; repaso
  y portada a 390 y 360 px) + comprobaciones en «Modo ejemplo» y «Estado y repaso». Fallos sembrados b1, b2, b3, b4 y b6: los cinco dan FALLO.
- **Medidas antes/después:** `tmp/dr/b_antes.txt`, `b_despues1.txt`, `b_despues2.txt` (script `tmp/dr/b_medir.cjs`). Capturas en `tmp/dr/cap-b/`
  y las de siempre (43–49) en `…/agx/dr/`.
- **Queda (no tocado):** en un ordenador estrecho y bajo (1100×700) la D se corta 16 px en dos clips y «Siguiente clip» queda justo bajo el
  pliegue; en apaisado, antes de responder, las barras de arriba se comen media pantalla (es del marco general, no de este apartado).

## Cierre de la revisión (20-nov)
- **Pruebas sobre el último commit (f491e57):** `agx-e2e.cjs` (la de siempre, sin tocar) → **RESULTADO: OK, 1.054 comprobaciones**;
  `agx-e2e-directos.cjs` → **RESULTADO: OK, 605 comprobaciones en 8 grupos** (cuatro pasadas seguidas iguales). Registros en `…/agx/dr/`.
- **`agx-e2e-directos.cjs` ha cambiado mucho** (copia de antes en `tmp/dr/agx-e2e-directos.antes-de-A.cjs`):
  - `TOTAL` y `REPARTO` al principio del archivo: es lo único que hay que tocar cuando sean 90 clips (más las comprobaciones que el material
    nuevo invalide: p. ej. «Van agrupados por categoría y en el orden C, E, G, P»). Los clips con los que juega la prueba (7–10, 12, 13, 20–25,
    30, 31) solo necesitan existir, que los diez primeros sean de la primera categoría y que haya más de 31.
  - Grupos nuevos: «Dos dispositivos» (88), «El resto guarda igual» (11) y «Pantallas difíciles» (69). Los dos primeros levantan un servidor HTTP
    en 127.0.0.1 y otro Chromium con `--host-resolver-rules`; «El resto guarda igual» necesita `git show origin/main:index.html`.
  - Fallos sembrados para comprobar la propia prueba: `tmp/dr/mutar.py` (20 variantes) y `tmp/dr/correr.sh <nombre> <puerto> [SOLO]`; las 20 dan FALLO.
- **Capturas:** las del apartado (43–49, seis juegos) en `…/agx/dr/`; las de detalle de la lente B en `tmp/dr/cap-b/`. Los juegos d-claro y m-claro
  enteros en `…/agx/dr-otras/`: frente a lo publicado (`…/agx/c/`) solo cambian las ya anotadas (30, 41, 61, 80, 81, 83 y el ruido conocido de 82)
  y frente a `…/agx/d/` solo las del apartado. **La verificación completa de las 225 capturas queda para el paso siguiente.**
- **Cambios de la revisión que corrigen lo escrito arriba:**
  - El id de tres clips lleva «gonzi» (antes «gonci»): archivos de `clips/` renombrados; el material de origen (`…/clips/sitio/clips/`) sigue con
    el nombre viejo.
  - La explicación la firma «Método AGX, la lección del clip». La cabecera de la pregunta dice «Pregunta · 4 opciones · clip de m:ss».
  - El aviso de carga está dentro de `.dir-pantalla`. La placa del clip respondido lleva la clase `hecho`.
  - Botones de un clip respondido: con clips pendientes, como antes («Siguiente clip» = el siguiente sin responder, «Repetir», «Volver»); recién
    respondido el último pendiente, «Ver el resumen» y «Repetir»; abierto para repasar con todo respondido, «Siguiente clip» (por orden; en el
    último, «Ver el resumen»), «Anterior», «Repetir» y «Volver».
  - Una dirección como `#formacion/directos/abc` ya no cae en el Diario.
  - En servidor, responder un clip hace `GET /api/datos` y después `PUT /api/datos` (ya no espera 700 ms).
- **Pendiente para el paso siguiente (90 clips):**
  - B5: portadas más grandes (hoy 640 px; se estiran hasta 2,3 veces en tableta a 2x). No se ha tocado `clips/`.
  - Poner `TOTAL`/`REPARTO` nuevos en la prueba y revisar las capturas 43–49 del script de capturas (siembra por número de clip).
  - La portada con 90 clips: en el móvil, sin empezar, serán unos 4.400 px (antes de B6 habrían sido unos 9.500); los accesos a las categorías
    ya están. En ordenador, 30 filas de tarjetas.
  - Los números de clip son la posición en `DIRECTOS`: si los clips nuevos se intercalan, los enlaces por número cambian (el progreso va por id
    y no se pierde).
- **Pendiente fuera de esta rama (límites de lo publicado, sin cambios):**
  - El guardado general sigue subiendo el estado entero sin leer antes (ver «A1»): un dispositivo con la web abierta desde antes que guarde algo
    del diario pisa lo que otro haya guardado después. Arreglo de fondo: versión o fusión en `netlify/functions/alumnos.mjs`.
  - El guardado de salida no puede con estados de más de 64 KiB (límite del navegador para `keepalive`).
  - A2: los clips son archivos públicos de la propia web (conocido y aceptado).
  - La reproducción real en iPhone y Android sigue sin verse en un dispositivo de verdad.

---

# De 45 a 90 clips (commits `[D90]`) — EN CURSO

Scripts propios de este paso en `…/agx/tmp/d90/`. Orden de trabajo: 1 clips · 2 datos · 3 `CLIPS_BASE` · 4 portada con 90 · 5 pruebas · 6 verificación.

## 1 · Clips (HECHO, 6 commits c4ce6a3 … 7ff8c14, todo subido)
- `clips/` es ahora copia exacta de `…/clips/sitio2/clips/`: 90 mp4 + 90 jpg (180 archivos, 284 MB en disco = 262 MiB de vídeo + 9,9 MB de portadas),
  comprobado con `cmp` archivo a archivo y con `git ls-files clips` (180). `tmp/d90/lotes.json` + `subir-lote.sh N` (6 lotes de ≤ 52 MB).
- `ffprobe` de los 90 (`tmp/d90/ffprobe.txt`): H.264 High yuv420p + AAC mono; 78 a 1280×720 y 12 a 1054×592; los 45 que ya estaban conservan
  tamaño de imagen y duración (diferencia máxima 0,02 s). 99,9 minutos en total. Portadas JPEG de 1280 px (B5 resuelto).
- El historial de la rama guarda también los 45 vídeos pesados de antes (257 MB): no afecta a lo que publica Netlify (solo el árbol), sí al tamaño del repositorio.

## 2–6 · Resto de la integración a 90 (cerrado por el coordinador tras cortarse la sesión del constructor por el límite de uso)
- 2 · Datos (HECHO, ff9fd3c): «const DIRECTOS=» con las 90 preguntas, una línea por clip, ordenadas por id; idéntico a `…/clips/preguntas-90.json`
  (comprobado: 90 id únicos, C 32 · E 26 · G 11 · P 21, correcta 23/23/22/22, cada id con su mp4 y su jpg en `clips/`, ningún archivo de más, nada de «gonci»).
- 3 · `CLIPS_BASE` (HECHO, bc44fa1): vídeo y portada salen de `CLIPS_BASE + id`; hoy `'clips/'`.
- 4 · Portada con 90 (HECHO, f27aef0): cada categoría es una placa plegable (`<details class="niv dir-cat">`); lo que el alumno abre o cierra se
  recuerda en el dispositivo (localStorage «agx-directos-cats»), no en su estado.
- 5 · Pruebas (HECHO): `agx-e2e-directos.cjs` con TOTAL = 90 y REPARTO 32/26/11/21 (682 comprobaciones). El coordinador añadió una espera en
  «Categorías plegables»: el navegador lanza el evento «toggle» un instante después del clic y la prueba recargaba antes de que quedara apuntado
  (fallaba de forma fija; en la web funciona). Consecuencia real, menor: si el alumno pliega una categoría y recarga en ese mismo instante, ese
  plegado puede no recordarse.
- 6 · Verificación completa sobre f27aef0 (HECHA por el coordinador): `agx-e2e.cjs` RESULTADO: OK (1.054); `agx-e2e-directos.cjs` RESULTADO: OK (682,
  dos pasadas seguidas); capturas en `…/agx/d90/` sin problemas de captura ni errores de página. Falta la revisión independiente.

---

# Última revisión y publicación (commit `[D90R]` 386e8e6 · publicado en main como 59005a3 el 20 nov 2026, 13:00 UTC)
- Revisión independiente con tres lentes sobre f27aef0 (carpetas `d90-a`, `d90-b`, `d90-c`). El arreglador no llegó a ejecutarse (límite de uso); lo cerró el coordinador.
- A1 y A2 (altas): la unión con el estado del servidor al responder un clip podía perder datos del diario. **RETIRADA ENTERA** (dirSubir / dirUnir /
  dirFoto / dirBase): responder un clip guarda con `guardar()`, como todo. Se conserva solo `JSON.stringify(estadoPropio||state)` en `subirDatos`
  (arregla un fallo publicado: un guardado pendiente del administrador subía el estado del alumno recién abierto).
  En la prueba, el grupo «Dos dispositivos» pasa a «Guardado de salida y administrador» (18 comprobaciones); copia de antes en `agx-e2e-directos.cjs.antes-de-quitar-union`.
- C1–C8: aplicadas las redacciones del revisor en 15 clips (`…/scratchpad/aplicar-c.py`; citas comprobadas en las transcripciones). C8-género: los
  tests se quedan en masculino («el Call Wall»); el temario no se toca.
- PENDIENTE (no bloqueaba): A3 (la prueba no caza título en atributos ni src mal construido en parte de los clips), B-1 (portada larga en el móvil
  a mitad de categoría), B-2 («Siguiente clip» bajo el pliegue en 2–11 clips en portátil), B-3 (entrando por la banda no empieza arriba),
  B-4 (categoría cerrada a mano no se reabre sola). Límite de fondo sin cambios: el guardado sube el estado entero (dos dispositivos: gana el último).
- Verificación final sobre 386e8e6: `agx-e2e.cjs` OK (1.054), `agx-e2e-directos.cjs` OK (612), capturas del apartado sin errores. En vivo
  (`…/scratchpad/vivo-directos2.sh`): index idéntico, 90 de 90 clips con video/mp4, tamaño exacto, 206 en peticiones parciales y portada; manifiesto con su tipo.
