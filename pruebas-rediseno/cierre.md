# Comprobación de cierre — cuaderno ([C])

Rama `rediseno-3d` (HEAD al empezar: 63ab975; al terminar: 51e8f34, empujado a origin/rediseno-3d; main sigue en 988c51e).
Estados: por comprobar / confirmado / descartado + motivo / pendiente + motivo / arreglado + commit.
Mis scripts: `…/agx/tmp/c/` (capturas en `tmp/c/cap/` y `tmp/c/seg/`). Para comparar serví la copia de la publicada en :4442 (la usan los scripts de cierre-1) y el HEAD de partida
(63ab975) en :4441 desde `tmp/c/head/`; los dos parados al terminar. :4400 sigue sirviendo la rama.

| Id | Problema | Gravedad | Estado |
|---|---|---|---|
| W1-1 | Móvil y tableta: al cambiar de vista desde la barra de abajo, la vista nueva no empieza arriba | media | confirmado (cierre-1/w7-nav.cjs en HEAD: rama m −715/−515/−315 px, t −741/−541/−341; en ordenador −808/−608/−408 igual que la publicada) → **arreglado en 0dd74ca** (JS): al navegar con un enlace o con irRuta, si cambia el módulo, la lección o el alumno (o el enlace es de la navegación principal), `scrollTo(0,0)` después de pintar. Copia de w7-nav.cjs: m, t y d quedan en y=0. También en ordenador (allí era heredado) |
| P1 | Rutina: tras «Preparar la sesión» el aviso dice «Sesión cerrada»; al cerrar no se pide el análisis automático (heredado) | media | confirmado (copia de seg.cjs s1) → **aviso arreglado en fcfd437** (el modo se guarda antes de cerrar). **Análisis automático al cerrar: PENDIENTE a propósito** (sigue sin pedirse, como en la publicada; activarlo gasta un análisis del día del alumno: decisión del cliente; queda un comentario en guardarRutina con el cambio de una palabra que lo activa) |
| P2 | Móvil: la lección abierta desde la lista de la ruta aparece desplazada al final (heredado) | baja | confirmado (seg.cjs s2: título a −547 px) → **arreglado en 0dd74ca** (mismo arreglo que W1-1): título a 271 px en móvil y a 155 px en ordenador |
| P3 | Móvil con cuenta de fondeo: en «Preparar la sesión», «Cancelar / Guardar» fuera de la pantalla al abrir (en la publicada cabían) | baja | confirmado (seg2.cjs t1: «Guardar» 873–917 con 844 de alto; tmp/c/rut.cjs: en la publicada solo cabía a 390×844; a 390×664, 360×740, 320×568 y 1366×768 tampoco) → **arreglado en a34bb7f** (CSS, solo #rut): la ventana no pasa del alto de la pantalla y se desplaza el cuerpo; desde 520 px de alto. «Guardar» a la vista al abrir en todos los tamaños probados salvo móvil apaisado (como antes) |
| P4 | Entrada con teclado: 5 controles tapados antes de «Entrar con Discord»; Ctrl+K abre la paleta por debajo (heredado) | baja | confirmado con matiz (tmp/c/ent-foco.cjs): en «login» el foco YA está en el botón al cargar (Intro entra sin tabular; el «Tab n.º 7» del comprobador cuenta desde el botón); lo que pasa es que Tab da la vuelta por 5 controles tapados, Ctrl+K abre la paleta debajo y, además, «N» abre el cajón de nueva operación debajo. En «sin acceso» y «error» el foco empieza en la página y hay 6 Tab hasta el botón → **arreglado en 51e8f34** (JS): `.app` inerte mientras la entrada está a la vista y el teclado global no atiende atajos. Tab: botón ↔ navegador; en «sin acceso» y «error», primer Tab al botón; Ctrl+K y «N» no abren nada; con sesión todo responde |

Veredictos del comprobador: a-entrada-y-entrar → resuelto (P4) · a-rutina-avisos → aviso resuelto, análisis automático pendiente del cliente (P1) · a-rutina-ventana-movil → resuelto (P3) ·
a-formacion-ruta-y-leccion → resuelto (P2).

## Notas
- W1-1 + P2 (0dd74ca). Qué sube y qué no, comparado con el HEAD de partida (tmp/c/nav2.cjs, móvil y ordenador, 52 pasos: 19 cambian, todos a propósito, y 33 quedan igual; salida en tmp/c/nav2.log, repetida con el HEAD final):
  suben: navegación principal (también Diario/plan → «Diario» y Formación/libre → «Formación»), lección desde la lista, lección siguiente/anterior, «Siguiente lección» tras el test,
  alumno desde la lista del administrador, y las acciones rápidas que cambian de módulo. NO cambian: pestañas del Diario y de Formación (misma posición que antes), «atrás/adelante» del
  navegador (mismos valores que antes), «Ver operaciones de <setup>» (sigue yendo a la tabla), abrir el cajón desde las acciones rápidas.
  Único matiz: «Empezar examen final» desde las acciones rápidas con otro módulo desplazado deja ahora la página en y=0 (antes subir() la dejaba con la vista a 12 px); el examen se ve entero igual.
  Cómo distingue «atrás/adelante»: `pedida` guarda el destino del último clic en un enlace `#…` o de irRuta; en el hashchange solo cuenta si coincide con la dirección a la que se ha llegado.
- Al ejecutar cierre-1/w7-nav.cjs en su sitio sobrescribí sus tres capturas `cierre-1/cap/nav-*-formacion-desde-900.png` con el «después»; las regeneré con el código de partida
  (BASE=http://localhost:4441/), así que vuelven a enseñar el fallo. El «después» está en `tmp/c/cap/` con el mismo nombre.
- P1 (fcfd437): la prueba de funcionamiento ya aceptaba los dos textos («error conocido»), sigue en OK. Captura: tmp/c/seg/rama-s1-aviso-tras-preparar.png.
  Sobre el análisis automático pendiente: Plan e IA dice «Cada noche, al cerrar la sesión, revisa tu día y te deja un parte», pero el código también habla de «sin esperar a la noche»
  (autoAnalisis al importar), así que puede que el servidor ya haga el parte por la noche; desde el repositorio de la web no se ve. Por eso no se activa sin preguntar.
- P3 (a34bb7f): capturas `tmp/c/cap/rut-p3-<ancho>x<alto>-<pre|post>-<tema>[-final].png`. Gesto táctil real (tmp/c/rut-gesto.cjs): el cuerpo desplaza 112 px a 390×844 y 277 px a 390×664, la página no se mueve;
  a 667×375 desplaza la capa, igual que antes. Tab recorre casillas → escalas → nota → X → Guardar (tmp/c/rut-rueda.cjs). #imp y #instalar no se tocan.
- P4 (51e8f34): copias de seg.cjs s3/s4 y seg2.cjs t2 en tmp/c: «Entrar con Discord» al Tab n.º 2 (el 1.º sale al navegador), 0 paradas tapadas, Intro entra, Ctrl+K no abre nada, cerrar sesión vuelve a la entrada.
  En navegadores sin `inert` (Safari < 15.5, Firefox < 112) se queda como estaba.
- Prueba de funcionamiento tras cada arreglo: RESULTADO: OK (1.054) las cuatro veces.

## Verificación final (HEAD = 51e8f34)
- `agx-verificar.sh c`: prueba RESULTADO: OK (1.054 comprobaciones en 74,3 s); 225 capturas, PROBLEMAS DE CAPTURA: ninguno, ERRORES DE PÁGINA: ninguno (salida en tmp/c/verificar-c.out). Carpeta: `…/agx/c/`.
- Frente a `…/agx/v/` (tmp/p3/dif.py): 179 idénticas, 45 solo ruido y 1 cambia: `m-oscuro-22-rutina-preparar.png` (lo tocado: la ventana de la rutina ya no se sale por abajo; el cuerpo desplaza 13 px).
  Hojas de contacto: 12 idénticas, 16 solo ruido y cambia `contacto-movil-oscuro-3.png` (esa misma captura).
  Para llegar ahí hubo que repetir capturas sueltas, como en la ronda anterior:
  · 1.ª pasada completa: además cambiaban `d-claro-40` y `d-claro-42` (1 px en el botón «Acciones rápidas» de la barra lateral). Repetida la escena del examen a solas dos veces con la rama
    y dos con el código de partida: las cuatro idénticas a `v/` (tmp/c/rep-rama1, rep-rama2, rep-antes, rep-antes2). No viene de los cambios (en esa escena no hay ni un clic en enlaces).
  · 2.ª pasada completa (solo capturas; la que queda en `c/`): 40 y 42 ya idénticas, pero `d-claro-09` salió con 1 px de desplazamiento suelto. Repetida a solas con la rama y con el código
    de partida: idénticas a `v/` (tmp/c/rep09-rama, rep09-antes). En `c/` está la repetida y las hojas de contacto se regeneraron con tools/agx-contact.py; las originales de cada pasada están
    en tmp/c/c-pasada1/ y tmp/c/c-pasada2/.
- Hoja de instalar (toqué el teclado global y el hashchange): copias de c3-aviso.cjs (118 OK), v3-aviso.cjs (0 fallos) y v3-hoja-baja.cjs (7 de 7) en tmp/c/c3 y tmp/c/v3. Las 18 `instalar-*.png`
  regeneradas están en `c/`: 15 idénticas a las de `v/`, 1 con ruido y 2 (`instalar-09-como-app-*`) cambian solo en la hora real del reloj (esa escena no usa el reloj fijo).
- Datos (copia de la prueba diferencial de V4 en tmp/c/v4, publicada en :4442): localStorage + IndexedDB idénticos a la publicada en los 24 bloques; lo único nuevo es el aviso leído en pantalla tras
  «Preparar» (el arreglo de P1). Peticiones /api/*: la rama envía exactamente lo mismo que en la ronda [V] en los 24 tramos (mismos métodos, rutas y cuerpos) y frente a la publicada salen los mismos
  4 avisos de entonces; en Formación-móvil el último cuerpo enviado es idéntico (3.930 bytes).
- `limpia.py informe`: 0 declaraciones muertas.
- Sin hacer: probar en teléfonos reales. #imp y #rut siguen con los defectos de teclado heredados (Tab se sale, Ctrl+K por debajo, no se cierran al navegar).
