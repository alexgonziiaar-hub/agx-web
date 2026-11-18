# Progreso del rediseño 3D de agxcommunity.com

Rama `rediseno-3d` de `/home/user/agx-web` (solo `index.html`). Cada paquete añade su sección.

---

## P1 · Sistema, marco y Diario (resumen), con sus capas — TERMINADO

Verificación: etiqueta `p1` (`…/agx/p1/`): prueba `RESULTADO: OK` (1.054), capturas sin problemas ni errores de página.
Scripts propios en `…/agx/tmp/p1/`: `auditar.cjs` (contraste, zonas táctiles, animaciones infinitas, backdrop-filter, desbordamiento;
`node auditar.cjs m-oscuro|m-claro|d-claro|d-oscuro|n-oscuro [ruta-hash] [cajon|rutina|detalle|paleta|importar]`), `estados.cjs` y
`estados2.cjs` (pulsado, foco, movimiento reducido, estados elegidos), `corta.py` y `mosaico.py` (recortes de capturas).

### 1. Dónde está cada cosa en el CSS
- **Materiales (variables):** en `:root` (tema claro), bajo el comentario «Sistema 3D», y en `:root[data-modo="oscuro"]`.
- **Reglas antiguas que chocaban:** se han sustituido EN SU SITIO (donde estaba la regla vieja), para no romper la cascada con los
  `@media` antiguos que vienen después. Si reescribes la regla base de un componente, hazlo en su sitio; si la pones al final,
  repite sus ajustes de móvil porque la capa del final gana a los `@media` antiguos.
- **Capa «SISTEMA 3D»:** al final de `<style>` (busca `SISTEMA 3D ·`). Manda sobre todo lo anterior. Orden: hundido → placa → tecla
  (reposo, pulsada, elegida) → flotantes → foco → marco → objetos (`.col3d`, curva, anillo) → Diario → capas → rareza 7 → móvil
  (`@media 900`, `640`, `380`). Añade ahí tus secciones (antes de los `@media` del final si no son de móvil).

### 2. Materiales (variables). Luz de arriba a la izquierda: cara clara, frente medio, lado oscuro
| Grupo | Variables | Claro → oscuro |
|---|---|---|
| Mesa (nivel 0) | `--mesa` (= `--fondo-pagina`) | `#F3F0FA` → `#0A061C` |
| Hundido (H) | `--hundido`, `--hundido-borde`, `--hundido-sombra` (sombra interior arriba), `--hundido-luz` (arista clara abajo) | `#EAE6F5` → `#0D0826` |
| Placa (1) | `--placa` (= `--fondo`), `--placa-borde` (= `--borde`), `--placa-arista` (hilo de luz), `--canto` (canto fino) | blanco, canto `#C6BDE0` → `#17103C`, canto `#04020E` |
| Tecla neutra (2) | `--tecla`, `--tecla-sube` (al pasar), `--tecla-borde`, `--tecla-arista`, `--tecla-canto`, `--tecla-tinta` | blanca, canto `#AFA3D2` → `#261C5E`, canto `#120B36` |
| Marca | `--marca-cara` `#8A63F5` (luz; sin texto encima), `--marca-frente` `#5B2ED1` (admite texto blanco), `--marca-lado` `#35188F`, `--marca-sube`, `--marca-tinta` | en oscuro frente `#6540DC`, lado `#2B1378` |
| Ganancia | `--gana-cara` `#45D6A1` (texto encima: `--gana-tinta` `#04261A`), `--gana-frente` `#13805F` (admite blanco), `--gana-lado` `#0A5740` | iguales en los dos temas |
| Pérdida | `--pierde-cara` `#FF8493` (texto: `--pierde-tinta`), `--pierde-frente` `#C93545` (admite blanco), `--pierde-lado` `#8E1F2D`; pozo: `--pierde-suelo` + `--pierde-suelo-tinta` | suelo `#FBDDE1`/`#9A1C2D` → `#3A0F1B`/`#FF9DA9` |
| Neutro (objeto sin signo) | `--neutro-cara`, `--neutro-frente`, `--neutro-lado` | |
| Rellenos de barra con volumen | `--barra-marca`, `--barra-gana`, `--barra-pierde` (degradado duro: banda clara arriba + frente) | |
| Superficies siempre oscuras (hero, barra lateral, visor): un solo juego | `--osc-tecla`, `--osc-tecla-sube`, `--osc-tecla-borde`, `--osc-tecla-arista`, `--osc-tecla-canto`, `--osc-pozo`, `--osc-pozo-borde`, `--osc-pozo-sombra`, `--osc-pozo-luz`, `--hero-canto`, `--hero-filo` | no cambian con el tema |
| Móvil | `--nav-movil` (alto de la barra de navegación fija: 68px hasta 900 px de ancho, 0 en ordenador) | |

Cambios en variables que ya existían: `--fondo-pagina`, `--fondo-2`, `--borde`, `--borde-2` (un punto más lavanda); `--compra` `#0E7656`
y `--venta` `#BE2C3B` en claro (algo más profundos: ahora el texto verde/rojo pasa 4,5:1 también sobre `--morado-suave`, `--hundido`
y las etiquetas suaves); `--hero-tenue` `#BBAFE6`; `--sombra` ya NO es una sombra difusa: vale lo mismo que el canto de una placa
(las reglas viejas `…:hover{box-shadow:var(--sombra)}` dan canto, no flotan). En oscuro: `--fondo #17103C`, `--fondo-2 #1E164B`, `--morado #9E86FF`.
Regla de contraste del sistema: texto verde/rojo pequeño NO va sobre `--hundido` en claro salvo que sea ≥ 18,66 px en negrita.

### 3. Niveles de profundidad (iguales en los dos temas)
| Nivel | Clase utilitaria y quién lo lleva ya | Receta |
|---|---|---|
| 0 Mesa | `body` | `background:var(--mesa)`; liso, sin halos |
| H Hundido | `.hundido` · campos y textarea de `.campo`, `select`, `.al-buscar`, `.sesion-viva`, `.imp-res>div`, `.rut-cuenta`, `.r-caja`, `.kicono`, bandejas `.sub-tabs` / `.seg-claro`; en oscuro fijo: `.hero-chips li`, `.seg-oscuro`, `.lw`, `.nav-ico` | `border:1px solid var(--hundido-borde); background:var(--hundido); box-shadow:inset 0 2px 0 var(--hundido-sombra),0 1px 0 var(--hundido-luz)` (sobre hero/lateral: las `--osc-pozo*`) |
| H pistas | `.pista` · `.hoy-barra`, `.err-barra`, `.pista-s`, `.mini-barra`, `.q-barra`, `.rk-barra` | fondo hundido + `inset 0 1px 0`; el relleno (`span`) lleva `background:var(--barra-gana|pierde|marca)` |
| 1 Placa | `.placa` · `.panel`, `.kcard`, `.hoy-card`, `.aviso-d`, `.niv`, `.inf`; el `.hero` es una placa oscura (canto de 4 px `--hero-canto`) | `border:1px solid var(--placa-borde); background:var(--placa); box-shadow:inset 0 1px 0 var(--placa-arista),0 3px 0 var(--canto)`; nunca sombra difusa ni elevación al pasar |
| 2 Tecla | `.tecla` · ver punto 4 | canto grueso que cede al pulsar |
| 3 Objeto | `.col3d`, curva, anillo, canal del objetivo, canal de R | ver punto 5 |
| 4 Flotante | `.cajon`, `.imp`, `.paleta`, `.toast`, `.fab`, `.tip`, `.tip-g` | los únicos con sombra difusa |

### 4. Teclas: una sola regla de pulsación
Tres listas de selectores en la capa 3D (añade el tuyo a las tres; a la tercera solo si se puede quedar elegido):
1. **Reposo:** `border`, `background:var(--k-cara)`, `color:var(--k-tinta)`, `box-shadow:inset 0 1px 0 var(--k-arista),0 var(--k-alto) 0 var(--k-canto)`, transición de 0,1 s.
2. **Pulsada (`:active`):** `transform:translateY(calc(var(--k-alto) - 1px))` y el canto queda en 1 px. En fichas con `<label>`: `label:active span`.
3. **Elegida (se queda abajo y se enciende):** `aria-pressed="true"`, `aria-current="page"` o `input:checked+span` → misma bajada,
   cara `--k-lit` (por defecto `--marca-frente`), leyenda `--k-lit-tinta` (blanco), borde `--k-lit-borde`, sombra interior arriba.
   Teclas grandes con cifras dentro (filas, tarjetas) usan la variante `.sel`: abajo + tinte `--morado-suave` + borde `--morado` (no tapa sus cifras).

En la regla propia de cada tecla solo van la geometría y estas variables (todas opcionales; los valores por defecto son la tecla neutra):
`--k-alto` (4px; 3px pequeñas; 5px grandes; 2px minis) · `--k-cara` · `--k-tinta` · `--k-borde` · `--k-arista` · `--k-canto` · `--k-lit` · `--k-lit-tinta` · `--k-lit-borde`.
Ejemplos: tecla de marca = `.boton` (`--k-cara:var(--marca-frente);--k-arista:var(--marca-cara);--k-canto:var(--marca-lado)`);
neutra = `.boton.sec`; sobre fondo oscuro = las `--osc-tecla*` (`.nav a`, `.buscar`, `.tk`, `.seg-oscuro button`, `.boton.fantasma`, `.visor .icono-btn`);
verde/roja = `--k-lit:var(--gana-frente)` / `var(--pierde-frente)` (`.radios span.verde/.rojo`); peligro = `.detalle-acc .enlace.peligro`.
Ya son teclas: `.boton` (+`.sec .blanco .fantasma .peq .grande`), `.icono-btn`, `.fab`, `.buscar`, `.nav a`, `.sub-tabs a`, `.seg-oscuro button`,
`.seg-claro button`, `.stepper button`, `.radios span`, `.chips-sel span`, `.rut-botones span`, `.tk`, `.insight`, `.setup-fila`, `a.aviso-d`,
`a.hoy-card`, `.chev`, `.detalle-acc .enlace`, y heredadas sin pulir: `.tcard` (y `.tcard-ex`), `.al-card`, `.ruta-b`.
El canto es `box-shadow` (no ocupa sitio): deja ≥ 5 px libres debajo (las bandejas llevan `padding:5px 5px 8px`).
El `.chip-f` (filtro activo) es una tecla ya encendida: cara de marca, sin canto.
En móvil (≤ 900 px) todo lo pulsable mide ≥ 44 px; los campos pasan a 16 px de letra (sin zoom en iOS).
`prefers-reduced-motion`: las pulsaciones son instantáneas (regla global de duración 0,01 ms); el 3D estático se queda.

### 5. Objetos
- **Columna cuya altura es el dinero — `.col3d`** (calendario y mapa). La pinta el JS: `<button class="celda col3d g|p|z" style="--a:0.25…1">`.
  `--a` = fracción de la altura máxima; el contenedor fija `--col-max` (16 px; 12 px en móvil) y deja `row-gap:calc(var(--col-max) + 4px)`.
  `g` = prisma que sube: la cara (con las cifras, de frente) se desplaza `translate(-dx,-h)` y los pseudo-elementos dibujan el frente
  (`::before`, `skewX(19.8deg)`) y el lado (`::after`, `skewY(70.2deg)`), con `dx = 0,36·h`. `p` = pozo: suelo `--pierde-suelo`, pared del fondo
  y pared izquierda con `box-shadow` interior. `z` = cero: baldosa. Dentro, el texto hereda la tinta de la cara (`.col3d .n,.v,b,small{color:inherit}`).
  Elegida: `outline` de marca (la altura es dato, no se aplasta). Pulsada: la cara se oscurece y no baja (hasta [V] bajaba al 45 % y con ratón perdía el clic en la franja de arriba). Hoy: barra de marca bajo la casilla (`.cal .hoy::after`).
  Para reutilizarla en otra rejilla: contenedor con `--col-max` y hueco entre filas; casilla `position:relative` con `col3d g|p|z` y `--a`.
- **Curva en relieve** (`pintarCurva`): todo dentro del mismo SVG, sin rotar ni transformar nada. Capas: rejilla → sombra de contacto
  (`.h-sombra`) → `g.h-area` [cara superior por tramo `.h-techo s|b` (más clara si sube), lado `.h-lado`, muro frontal `.h-muro` con
  `#gradCurva`, hitos `.h-hito` (una línea por operación)] → línea de cero → halo y canto luminoso (`.h-linea`, se sigue trazando) → puntos →
  último punto con pulso → cursor → zona de captura. La profundidad es `DX,DY` (20×14; 12×9 en estrecho) y va incluida en `P.r` y `P.t`, así
  que la conversión puntero → operación no cambia. El suelo del relieve es el mínimo del eje. Se quitó el filtro `#brillo` (desenfoque).
- **Anillo-toro** (`anillo()`): `.an-pista` hundida + `.an-pista-s` (sombra interior arriba a la izquierda) + `g.an-valor` con tres círculos
  que heredan `stroke-dasharray/offset` del grupo: `.an-lado` (sombra, abajo a la derecha), `.an-cara` (hereda el trazo: `#gradMarca`,
  `#gradAnillo` en `.f-anillo`, rojo en `.reloj.poco`), `.an-luz` (hilo blanco arriba a la izquierda). El JS del reloj sigue escribiendo en `.an-valor`.
- **Objetivo del mes:** `.obj-barra` es un canal de 14 px con marcas cada 25 % y relleno con volumen; `.obj.logrado` cambia a material de ganancia.
- **Resultado en R (cajón):** `#f-r.r-caja` lleva `--rp` / `--rn` (0…1, tope 3 R) que escribe `pintarCalculo()`; el `::after` es el canal que crece desde el centro.
- **Racha:** fichas verdes levantadas y rojas hundidas (`.racha-pts .g/.p`).

### 6. Qué se quitó de la «capa premium»
Auroras (`.aurora{display:none}`: el HTML sigue en los heros), ruido `feTurbulence`, luz y bordes que seguían al ratón e inclinación de
tarjetas (CSS y el `pointermove`/`pointerout` del JS), halo de la barra lateral, brillo animado del logo (ahora relieve fijo con
`text-shadow` duro en `.lateral .marca-agx`), halos del `body`, resplandor del neto (rareza 11), cinta en movimiento (ahora fila fija
que se desplaza con el dedo; el grupo duplicado se oculta), `ruta-brillo`. `backdrop-filter` solo en 3 sitios: `.barra-sup`, `.capa`
(velo del cajón) y `.entrada-caja`. Animaciones infinitas visibles en el Diario: 2 (pulso del último punto y latido de la sesión).
Siguen vivas y son de otros paquetes: `barrido` (`.q-barra`), `rk-flota` (corona) + su `drop-shadow`, `girar` (`.ia-orbe`), `carga`.

### 7. Marco
- Barra lateral plana; enlaces = teclas oscuras (el actual, encendido); widgets = pozos; marca en relieve.
- **Móvil/tableta (≤ 900 px):** la navegación es una barra fija abajo (`.nav`, z-index 22, alto `--nav-movil`); arriba quedan la marca y la lupa.
  `.fab`, `.toast` y `.pl-pie` suben `--nav-movil`; `html{scroll-padding-bottom}` evita que el foco quede debajo. Si añades algo pegado o fijo
  abajo, súmale `var(--nav-movil)`. `.lateral` ya no lleva `isolation:isolate` (rompería el z-index de la barra).
- `.app{grid-template-rows:auto minmax(0,1fr)}` en móvil (rareza 6).
- Tabla de operaciones: en ≤ 640 px cada `tr.op` es una ficha en rejilla (por `nth-child`: 1 flecha, 2 captura, 3 fecha, 4 sesión,
  5 instrumento, 6 dirección, 7 setup, 8 contratos, 9 resultado) y `tr.detalle` va debajo a todo el ancho (rareza 2). No cambies el orden de las celdas.

### 8. Textos tocados (uno)
La leyenda del mapa decía «Cuanto más intenso, más dinero»; ahora la altura es el dinero y dice «Cuanto más alta o más honda, más dinero».

### 9. Pendiente / para otros paquetes
- Pozos de los otros heros (`.f-estado`, `.ruta-datos li`, `.rk-cel span`, `.rk-yo`) siguen con `--hero-chip`/`--hero-borde` (vidrio claro):
  pasarlos a `--osc-pozo*`. Con `--hero-chip` el texto `--hero-tenue` de 11–13,5 px queda en 3,8–4,3:1 en el peor punto del degradado.
- Avatares del ranking (`.rk-av`, colores `AV_COL` del JS): iniciales blancas sobre colores claros (2,4–3,7:1).
- Formación: `.lec-fila.cerrada{opacity:.62}` baja el contraste a 2,7–2,8:1. Ranking: `.t-otro` 3,2–3,6:1 en claro.
- Zonas táctiles < 44 px fuera de mi ámbito: `.bv-col` (estadísticas), `.cu-d` (38×42, plan).
- `.tcard`, `.al-card`, `.ruta-b`, `.opcion`, `.nq`, `.lec-fila`, `.niv`, `.inf`, columnas `.bv-*`, podio y entrada heredan el material pero no están pulidos.
- Rarezas que se dejan (cambian comportamiento): 3, 4, 8, 10, 12. Rareza 1 y 5: de Formación y Plan.

---

## P2 · Estadísticas, Plan e IA y Formación — TERMINADO

Verificación: etiqueta `p2` (`…/agx/p2/`): prueba `RESULTADO: OK` (1.054), capturas sin problemas ni errores de página.
Scripts propios en `…/agx/tmp/p2/`: `auditar.cjs` (el de P1 con pasos encadenados para llegar a cualquier estado:
`PASOS='click:SEL;;key:a;;fill:#id=valor;;wait:400;;down:SEL;;focus:SEL;;tab:3;;scroll:SEL' node auditar.cjs <tag> <hash>`; `FOTO=ruta.png` guarda la vista;
tags `d-claro d-oscuro t-claro m-claro m-oscuro n-oscuro`) e `ia.cjs` (estado de espera del agente de IA, que no sale en las capturas).

### 1. Dónde está cada cosa
- Tres secciones nuevas en la capa «SISTEMA 3D», antes de «MÓVIL Y TABLETA»: **«DIARIO · ESTADÍSTICAS (P2)»**, **«DIARIO · PLAN E IA (P2)»** y **«FORMACIÓN (P2)»**.
- Sus ajustes de móvil y tableta van en un bloque al final de `<style>` (**«P2 · ajustes de móvil y tableta…»**), detrás de los `@media` de P1,
  porque tienen que ganar a las reglas base de esas tres secciones. Si añades una sección nueva a la capa, pon sus `@media` después de ella.
- Reglas viejas sustituidas en su sitio (chocaban con la pulsación): `.opcion:hover`, `button.nq:hover`, `a.lec-fila:hover`, y se han quitado
  `barrido` (brillo en bucle del progreso), `brillo-ok` (animaba `box-shadow`) y `sacudir` (ahora `tecla-baja` y `sacudir-t`, que respetan la tecla bajada).
- Teclas nuevas en las tres listas de P1: `.cu-d`, `.opcion`, `button.nq`, `a.lec-fila`, `button.lec-fila`, `.lec-nav a`
  (pulsada: `.opcion:not(:disabled):active`; elegidas: `.cu-d[aria-pressed="true"]`, `button.nq.actual`).

### 2. Objetos y recetas nuevas (reutilízalas)
- **Columnas con base en cero** (`barrasV`, estadísticas): `.bv-barra` es el FRENTE del prisma y su altura sigue siendo exactamente el valor;
  `::before` = cara superior y `::after` = lado derecho, con los colores `--c1/--c2/--c3` (clases `g`, `p`, `z`). `.bv-cero` es la repisa del cero (z 1):
  las ganancias se apoyan encima (z 2) y las pérdidas (`.abajo`, z 0) cuelgan por debajo, con la sombra de la repisa. Profundidad y ángulos en `.bv`:
  `--bv-dx/--bv-dy` (7×5 px; 5×4 en móvil) y `--bv-ax/--bv-ay` (= −atan(dx/dy), −atan(dy/dx)). El JS ya no pinta barras de valor 0 y marca la etiqueta
  con `.arr`/`.abj`. Para otra gráfica de columnas: mismo HTML de `barrasV` y nada más.
- **Medidor de la cuenta de fondeo** (`medidorCuenta(ev,cls)`; lo usan `panelCuenta()` y `pintarHoy()`): `.cta-pista` (canal hundido) con `--pos` y `--pico` en %.
  `::before` = el suelo (prisma rojo: el drawdown), `>span` = relleno con volumen hasta la posición (verde; ámbar en `cta-aviso`; rojo en peligro/quemada/límite),
  `.cta-m.pos` = aguja de la posición, `.cta-m.pico` = banderín del pico (o del inicio si el drawdown es estático), `.cta-m.dev` = rayado de lo devuelto desde el pico.
  Eje: del suelo al máximo entre pico y posición (como mínimo, el drawdown entero). Variante `.mini` en la tarjeta del resumen. Leyenda: `.cta-suelo::before` y `.cta-pico::before`.
- **Fichas de cumplimiento** `.cu-d` (44×46): `ok` = tecla verde levantada, `ko` = roja hundida (`--k-alto:2px`), elegida = cara encendida (`--k-lit`) + cerco de marca.
- **Flecha-tecla de los `<details>`**: `.inf-chev` y `.niv-chev` (mini tecla; cede al pulsar el `summary`, se enciende con `[open]`). El icono gira dentro; la tecla no.
- **Dial de la nota de la IA** `.inf-nota` con `style="--n:0…10"`: anillo con `conic-gradient` y color `--nc` (alta verde, media ámbar, baja rojo). El texto no cambia.
- **Peldaño de la ruta** `details.niv` + clases de estado que pone `vistaRuta()`: `ok` (canto verde y número en prisma verde), `actual` (borde y canto de marca, número encendido),
  `cerr` (hundido, apagado, candado en la etiqueta), `prep` (hundido con borde discontinuo). El canto es `--niv-canto`.
  Progreso `.niv-barra`: una `<i>` por lección (`.ok` = ficha verde levantada) y `<i class="ex">` (más estrecha) por el examen (`.ok` / `.ko`).
  Filas de lección `.lec-fila`: `a`/`button` = teclas (`.ok`, `.sig` = siguiente, con borde y canto de marca); `div.cerrada` = hueco hundido sin opacidad.
- **Fichas de preguntas** `.nq`: `span` = ficha que no se pulsa (hueco / verde levantada / roja hundida; `.actual` = cerco); `button` = tecla (examen; `.resp` teñida, `.actual` encendida).
  `ol.navegador.pulsable` (examen) es en ≤ 640 px una sola fila que se desplaza; `centrarNavegador()` deja a la vista la pregunta actual tras cada repintado.
- **Opciones del test** `.opcion` (tecla grande, `--k-alto:5px`; 3px cuando está desactivada) con `.letra` (pozo): `.elegida` = abajo + tinte de marca + letra encendida;
  `.bien` = verde abajo; `.mal` = roja abajo; `.ico` = disco verde/rojo con el icono en blanco.
- **Reloj del examen** `.reloj`: toro (anillo de P1, ahora 54/9) dentro de un pozo en píldora; `.poco` pasa el pozo, la cifra y el anillo a rojo.
- **Sellos**: `.veredicto` (grande, Bebas, doble filete, girado −3°, animación `sellar-3d`) y `.sello` (pequeño, en el hero del repaso libre; `.no`, `.nada`).
- **Radar**: `.rd-borde` = pozo hexagonal; `.rd-sombra` + `.rd-dato` = polígono de dominio en relieve.
- **Pozos del juego oscuro** en los heros de Formación: `.f-estado`, `.ruta-datos li` (pendiente de P1). Los del Ranking (`.rk-cel span`, `.rk-yo`) siguen pendientes.
- **Hero de Formación en móvil** (≤ 640): `.hero-form>div:not([class]){display:contents}` para poner el anillo (104 px) a la izquierda y nivel + título a la derecha.

### 3. Rarezas y pendientes de P1 resueltos
- Rareza 1 (repaso de fallos en móvil): `.fallo` va en una columna hasta 900 px, con iconos de fallo/acierto además del color.
- Rareza 5 (`.pl-pie` sobre el formulario de la cuenta): `.cta-form .pl-pie{position:static}`; solo el pie del plan se queda pegado.
- `.lec-fila.cerrada` ya no usa opacidad (contraste), `.cu-d` mide 44×46, `barrido` eliminado, pozos de los heros de Formación con `--osc-pozo*`.
- Deseable hecho: medidor de la cuenta de fondeo con suelo, pico y posición.

### 4. Comprobado
- Contraste (auditoría propia): sin fallos en claro y oscuro, en ordenador, tableta, móvil y 360 px, en estadísticas, plan (con cuenta), ruta, lección, test
  (sin responder, bien, mal), resultados, examen y repaso libre. Zonas táctiles ≥ 44 px en todo salvo las columnas de las gráficas (ver pendientes).
- Animaciones infinitas visibles en mis pantallas: solo el latido de la sesión (y el orbe de la IA mientras analiza). Sin `backdrop-filter` ni `filter` nuevos.
- Estados: opción pulsada, elegida, con foco; ficha de cumplimiento con foco; globo y foco de las columnas; espera de la IA.

### 5. Pendiente / conocido
- `.bv-col` (columnas de las gráficas) mide menos de 44 px de ancho en móvil cuando hay muchas (15 horas = 21 px; reparto = 39 px). Son datos con globo, no
  controles, y la gráfica entera tiene que verse de un vistazo; el alto sí es toda la gráfica.
- «Profit factor como balanza» (deseable de P1) sin hacer. El radar sigue siendo plano dentro de su pozo (no es un prisma).
- En 360 px los tres datos del hero de la ruta caben de dos en dos solo si el texto no crece.
- Rarezas 3, 4, 8, 10 y 12: sin tocar (cambian comportamiento).

---

## P3 · Ranking, Entrada, Alumnos y repaso general — TERMINADO

Scripts propios en `…/agx/tmp/p3/`:
- `auditar.cjs <tamaño-tema> [filtro] [BASE]` — auditoría general. Mide el contraste REAL de cada texto contra los píxeles que tiene detrás
  (captura con el texto oculto; percentil 10 del fondo; incluye texto dentro de SVG y los textos de ayuda de los campos), zonas táctiles < 44 px,
  animaciones infinitas visibles, `backdrop-filter` y desbordamiento, en 21 vistas (modo ejemplo y servidor simulado, que reutiliza en solo lectura
  los datos de `tools/agx-shots.cjs`). `REDUCIR=1` para movimiento reducido; `INYECTAR='css'` para comprobar que detecta un fallo puesto a propósito.
- `perf.cjs [rondas]` — fotogramas al desplazar con la CPU frenada ×4 (CDP), antes (`main` servida desde `tmp/main-copia` en :4401) y después (:4400).
- `limpia.py informe|aplicar` — quita solo las declaraciones CSS que nunca pueden ganar la cascada (mismo selector redeclarado más abajo, fuera de `@media`).
- `muerto.py` (clases, keyframes y variables sin uso), `dif.py dirA dirB [regex] [umbral]` (compara capturas con tolerancia: la barra superior con vidrio mete ruido de ±24 niveles),
  `rm.cjs` (movimiento reducido), `cr.cjs` (contraste entre dos colores), `commit.sh`.

### 1. Dónde está cada cosa
- Las secciones antiguas **«Ranking de logros»**, **«Entrada con Discord»** y **«Alumnos»** están REESCRITAS EN SU SITIO (con sus `@media` dentro), no en la capa del final.
  Solo quedan en la capa «SISTEMA 3D» sus selectores de las listas comunes (`.rk-barra` en pistas, `.al-buscar` y `.rev-com textarea` en hundidos, `.al-card` y `.boton-dc` en teclas).
- Bloque **«P3 · repaso general»** al final de `<style>`: ajustes de marco para 360 px y para la barra de abajo con cuatro teclas (administrador).

### 2. Materiales nuevos (en `:root`, no cambian con el tema)
`--oro-cara/-frente/-lado/-tinta`, `--plata-*`, `--bronce-*`. Clases `.oro`, `.plata`, `.bronce` → definen `--m-cara`, `--m-frente`, `--m-lado`, `--m-tinta` para cualquier objeto de metal.

### 3. Objetos y recetas nuevas
- **Podio** (`vistaRanking`): `.rk-podio` es una rejilla de 3 columnas SIN hueco; cada `.rk-pd` (orden DOM 2º, 1º, 3º: así el apilado natural da las oclusiones correctas)
  lleva corona (solo el 1º), avatar-moneda y `.rk-pd-base`, que es el FRENTE del prisma: `::before` = cara superior (`skewX`), `::after` = lado derecho (`skewY`).
  Variables: `--pd-dx/--pd-dy` (14×10; 10×7 hasta 1060 px, con sus ángulos), `--pd-alto` (altura = puesto), `--pd-cara/-frente/-lado`, `--medalla/--medalla-s` (metal del canto de la moneda).
  Dentro del frente van el nombre, los logros y el número (`.rk-pd-pos`, con `order:-1` para pintarlo arriba sin cambiar el orden de lectura). Libre = prisma apagado.
- **Cuenta atrás**: `.rk-cel span` = ficha (placa con canto de 3 px del juego oscuro, no se pulsa). Sin texto con degradado.
- **Puestos 1–3** (`.rk-pos.p1/.p2/.p3`) = fichas de oro, plata y bronce; el resto, hueco hundido. Fila propia (`.rk-fila.yo`) = tinte y cerco de marca, sin canto (no se pulsa).
- **Trofeo con volumen** `TROFEO_3D` (SVG con clases `.t-c` cara, `.t-f` frente, `.t-l` lado, `.t-a` asas) dentro de `.rk-camp-tr.oro`. Todos los campeones son de oro: cada uno ganó su mes.
- **Avatares** `AV_COL`: seis parejas más profundas; iniciales blancas ≥ 4,7:1 en todo el degradado.
- **Entrada**: `#entrada > .entrada-placa > (#velas.velas + #entrada-caja)`. `velas3d()` pinta la sesión: `.velas-esc` (escena de 320×180 unidades, `--u` = ancho del contenedor / 312, con `cqw`;
  `perspective` + `rotateX(-20deg) rotateY(-28deg)`), `.velas-suelo` (rejilla), `.velas-max` (máximo de la sesión) y 14 `.vela` (`.b` = bajista) con mecha `<i>` y cuerpo de tres caras `<b>`
  (frente, lado, cara superior). Datos en `VELAS` (mecha arriba, mecha abajo, cuerpo arriba, alto, alcista). Solo se levantan al entrar (`vela-sube`); después, estático.
  `.boton-dc` es una tecla blanca (`--k-alto:5px`). Sin `backdrop-filter`: quedan 2 en toda la web (`.barra-sup` y `.capa`).
- **Espera** `.entrada-carga` (entrada, alumnos, importar, informes): un canal con UNA pieza que va y viene (`::after`); los tres `<span>` se ocultan. Con movimiento reducido, quieta.
- **Alumnos**: `a.al-card` = tecla grande (`--k-alto:5px`); `.al-stats` = pozo con las tres cifras (19 px en negrita: el verde/rojo cumple como texto grande); `.al-pend` = etiqueta de marca;
  `.kpis4.al-kpis` va de dos en dos en el móvil.
- **Hero del Ranking**: `grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))` → dos columnas si caben (tableta incluida), una en el móvil.

### 4. Repaso general (lo que se midió y lo que se cambió fuera de mi ámbito)
- **Contraste** (`auditar.cjs`, 21 vistas × 6 combinaciones: ordenador claro/oscuro, tableta, móvil claro/oscuro, 360 px; unos 2.650–3.000 textos por combinación):
  0 textos por debajo de 4,5:1 (3:1 desde 24 px o 18,66 px en negrita). Para llegar ahí: textos de ayuda de los campos (placeholder) sin opacidad (3,45 → 5,3:1),
  iniciales de los avatares, `.t-otro` en claro. La medición detecta un fallo puesto a propósito (`INYECTAR`).
- **Zonas táctiles** (≤ 900 px): todo ≥ 44 px salvo las columnas de las gráficas de estadísticas (`.bv-col`: son datos con globo, no controles). Arreglado: enlaces
  «Entrar con otra cuenta» y «Ver en Discord», flechas de operación en tableta, casillas del calendario y del mapa a 360 px (44 px con `--col-max:10px`).
- **Sin desbordamiento horizontal** en ninguna vista ni tamaño.
- **Presupuesto**: como mucho 2 animaciones infinitas visibles a la vez (latido de la sesión + pulso del último punto, o + latido de «Conectado a Discord»);
  `backdrop-filter` en 2 sitios (`.barra-sup`, `.capa`), ninguno en listas; sin auroras (ni en el HTML), sin ruido, sin `filter`.
- **Fotogramas al desplazar** (CPU ×4, mediana de 5 rondas, `perf.cjs`; antes = `main`, después = rama): fotogramas de más de 25 ms y trabajo del hilo principal
  | Vista | Móvil antes → después | Ordenador antes → después |
  |---|---|---|
  | Resumen del Diario | 7,0 % → 0,3 % · p95 28 → 18 ms · 3.767 → 2.294 ms | 6,5 % → 0,3 % · p95 29 → 18 ms · 3.019 → 1.887 ms |
  | Ruta de Formación | 0,6 % → 0 % · p95 19 → 18 ms · 1.946 → 1.253 ms | 0 % → 0 % · p95 20 → 17 ms · 784 → 478 ms |
  | Ranking | 5,4 % → 0,3 % · p95 26 → 18 ms · 2.990 → 1.414 ms | 3,5 % → 0 % · p95 25 → 18 ms · 826 → 481 ms |
- **Movimiento reducido** (`rm.cjs`, `REDUCIR=1`): ninguna animación viva, duración máxima 0,01 ms (pulsaciones instantáneas), ninguna inclinación; el 3D estático se queda.
- **Limpieza** (`limpia.py`): 449 declaraciones muertas menos (80 reglas enteras), HTML de las auroras, brillo del bloque elegido, `.lec-whop*`, `.tcard-rapido`,
  variables `--morado-osc`, `--lateral-2`, `--hero-chip`. Capturas antes/después (`p3-pre` / `p3-post`): 178 idénticas, 44 con solo ruido de la barra con vidrio,
  3 que cambian por el puntero sobre la lupa en la escena del examen (al repetirlas con el mismo código salen iguales: no es la limpieza).
- **Marco**: a 360 px la sesión cabe en una línea y los rótulos de la barra de abajo se condensan; con las cuatro teclas del administrador también caben.

### 5. Aviso para quien siga
- Las capturas llevan ruido: la barra superior con vidrio cambia ±24 niveles entre dos ejecuciones idénticas, y en la escena del examen (40, 42) la lupa del lateral
  sale a veces con el puntero encima. Para comparar, `dif.py` con umbral 24 y repetir las que salgan.
- Si redeclaras una propiedad con el mismo selector más abajo, la de arriba queda muerta: `limpia.py informe` las lista.
- `.entrada-carga span` está oculto: si se quiere otro indicador de espera, se cambia el `::after`.

### 6. Pendiente / conocido
- `.bv-col` por debajo de 44 px de ancho en móvil (21 px con 15 horas, 39 px en el reparto): la gráfica entera tiene que verse de un vistazo.
- Deseables sin hacer: «profit factor como balanza», radar como prisma hexagonal.
- Rarezas 3, 4, 8, 10 y 12: sin tocar (cambian comportamiento). La leyenda del mapa sigue con el texto que puso P1.
- En el móvil el aviso «Comentario guardado» tapa unos segundos parte del cuadro del comentario (posición del aviso de P1, sobre la barra de abajo).
- Con la entrada abierta, el latido de la sesión sigue corriendo debajo (no se ve; solo `transform` y `opacity`).
- El podio usa alturas fijas por puesto (no por número de logros) y todos los trofeos de Campeones son de oro.
- A 360 px las columnas del calendario llegan casi al borde del panel (3 px) para dar 44 px a cada casilla.

---

## Revisión independiente ([R]) — TERMINADA

Tres revisores (A: funcionamiento y estados · B: móvil y tableta · C: dirección de arte en ordenador) dejaron 29 hallazgos. Cada uno se
comprobó antes de tocar nada (captura, script del revisor o medida propia). Cuaderno con el detalle, hallazgo a hallazgo: `…/agx/revision.md`.
Scripts propios en `…/agx/tmp/rev/` (`lib.cjs` es el montaje de los revisores: `abrir(browser,'rama'|'main',tam,oscuro,srv,opc)`; `main` se sirve
desde `tmp/main-copia` en :4411): `campos.cjs` (foco, error y texto de ejemplo), `ficha*.cjs` (ficha de operación), `tactil.cjs`, `cinta.cjs`,
`pulsacion.cjs` y `puls1.cjs` (franja muerta de las teclas), `examen.cjs` (barra sobre el reloj), `safe.cjs` (márgenes seguros simulados),
`tabla-t.cjs`, `b7.cjs`, `cal.cjs`, `sel.cjs`, `extremos.cjs`, `entrada.cjs`, `pie.cjs`, `c10.cjs`, `auditar.cjs` (copia del de P3).
Verificación final: etiqueta `rev` (`…/agx/rev/`): prueba `RESULTADO: OK` (1.054), 225 capturas sin problemas ni errores de página;
auditoría de contraste de P3 en ordenador y móvil, claro y oscuro: 0 textos por debajo de 4,5:1; `limpia.py informe`: 0 declaraciones muertas.

### 1. Arreglado (9 commits `[R]`)
| Hallazgo | Qué pasaba | Qué se hizo y dónde |
|---|---|---|
| A1, A2 | El campo que falla al guardar no se ponía en rojo y los campos no mostraban foco: la regla base (`:not():not()`, 0,3,1) ganaba a las de estado | `.campo input:not(…):not(…):focus` y `.campo.invalido input:not(…):not(…)` en su sitio («Cajón») |
| A3 | El ejemplo de un campo vacío parecía un dato | Material nuevo `--hundido-ayuda` (`#68637C` / `#8880AD`) y peso 450 en `::placeholder`: 4,5:1 contra el pozo, 3:1 contra el valor |
| A4 | Con ratón, soltar en los 1–4 px de arriba de una tecla perdía el clic (la tecla baja) | Lista nueva tras «Tecla pulsada»: `…:active::after` invisible que cubre la franja. **Si añades una tecla a las listas, añádela también a esta** (y no uses su `::after` para otra cosa) |
| A5 = C1 | La cinta de últimas operaciones no se podía recorrer con ratón (3 de 10) | Barra fina con `@media (hover:hover) and (pointer:fine)` junto a `.tk-marco`. Playwright oculta las barras: para verla, `launch({ignoreDefaultArgs:['--hide-scrollbars']})` |
| A6, C8 | Elegido y foco eran el mismo cerco | Día/casilla elegidos: cerco de 3 px + número (u operaciones) encendido; con foco el cerco se separa a 5 px. Igual en `.cu-d` |
| A7, C2 | Entrada: no cabía en pantallas bajas; en ordenador, placa y velas pequeñas en un fondo liso | Sin velas con ≤ 760×620; apaisado sin desplazamiento; desde 1200×700 la placa llega a 1180 px (las velas crecen con ella: `--u` va por `cqw`), marca de 96 px; mesa de `.entrada` con degradado duro de marca y rejilla |
| B1 | Ficha de operación en móvil: la R pisaba «N contr.» y el importe se partía a 360 px | `tr.op` pasa de rejilla a **fila flexible con salto de línea** (`::before` con `order:3` fuerza el salto): 1.ª fecha + resultado, 2.ª instrumento/dirección/sesión/contratos, 3.ª setup. Miniaturas en `position:absolute`; geometría en `--cap` y `--sep` (50 px / 6 px a ≤ 380). El orden de las celdas sigue siendo por `nth-child` |
| B2, B3 | La barra superior pegada tapaba el reloj y el título del examen y, con la de abajo, dejaba el 77–80 % de la pantalla | ≤ 900 px `.barra-sup{position:static}` sin `backdrop-filter` (queda 1 en móvil: `.capa`); `scroll-padding-top:12px`. **JS:** `subir()` deja la vista justo debajo de la barra cuando está pegada (ordenador: a 1280×720 también tapaba el reloj) |
| B4 | App a pantalla completa en iPhone: la cabecera quedaba bajo la franja de estado | `.lateral` suma `env(safe-area-inset-top)`; `body::after` del color de la cabecera ≤ 900; `.entrada` con `max(…, env())` |
| B5, B11 | Tablas que no caben: la columna «Resultado» quedaba fuera (tableta, apaisado, portátil pequeño, importar en móvil) | `.tabla-wrap th:last-child, .tabla-wrap td.fuerte{position:sticky;right:0}`; `.tabla-wrap{container-type:inline-size}` y el detalle abierto (`.det-grid`) mide `100cqw - 74px`: ya no se corta |
| B7 | Tras responder un test a 360 px, «Siguiente» quedaba medio tapada por la barra de abajo | **JS:** `elegir()` hace `scrollIntoView({block:'nearest'})` del botón en práctica (respeta `scroll-padding-bottom`) |
| B8 | Letra < 12 px en objetos | Número del día 11,5 px, operaciones del mapa 11,5 px (82 %), «completado» del anillo 12 px |
| B9 | Zonas táctiles de 42–43 px y 25 px | Fichas 45/44 px, opciones de la paleta 44,5 px, `button.etq-falta` con zona de 45 px (`::before`) |
| B10 | Pie del cajón a dos filas en cuanto había importe | Una fila hasta 4 cifras a 390 px y hasta 3 a 360 px (cifra de 22 px, botones más ceñidos) |
| C3, C7, C9 | La altura distinguía poco el dinero; las caras altas tocaban la casilla vecina; el mapa dejaba un tercio vacío | `--col-max:22px` en tableta y ordenador (móvil igual: 12 y 10 px). **JS:** `alto = 0,12 + 0,88·|u|/máx` (antes 0,25 + 0,75) en `pintarCalendario` y `pintarMapa`; mínimo de 3 px en CSS. Desplazamiento lateral en variables `--col-k` / `--col-ax` / `--col-ay` (0,25 en `.cal,.mapa`; 0,36 en móvil), calles de 10 px. Desde 1061 px el mapa reparte el alto del panel |
| C6 | En claro los pozos no parecían hundidos | `--pierde-suelo:#F3C3CA`, `--pierde-suelo-tinta:#84101F` (6,5:1) y dos materiales nuevos: `--pierde-umbra` (sombra dura de la pared en el suelo) y `--pierde-labio` (arista iluminada). El suelo es global: también lo llevan racha, fichas `ko`, `nq.mal` y el reloj en rojo |
| C4 | Hero del alumno sin operaciones: rectángulo vacío | **JS:** `pintarCurva` pinta `.h-fantasma` (SVG decorativo `aria-hidden`: suelo y cordillera a trazos, sin eje ni cifras) con el mismo texto; ocupa el alto de la columna |
| C5, C10, C11 | Cifras de la cuenta en escalera; fichas del hero mal repartidas a 1920; «errores» pegado a «operaciones» | `.hoy-dato{align-self:flex-start}` · `.hero-chips li.obj` con `margin-right` que fuerza su línea · `#panel-ops{margin-top:23px}` |

### 2. Descartado o parcial
- **B6** (la curva no responde al toque: hay que arrastrar): es igual en `main` y arreglarlo es lógica nueva (primer toque enseña, segundo abre). Se deja anotado.
- **B8, barra del administrador a 360 px** (rótulos a 11,5 px): para subirlos habría que acortar «Diario de trading», que es cambiar texto.
- **B3, resto:** la barra de abajo (69 px) sigue fija; en apaisado queda el 82 % útil (en `main`, 83 %). Con teclas de 44 px no se gana más de 10 px.
- **B10, resto:** con importes de 5 cifras (4 a 360 px) el pie vuelve a dos filas.
- **C2, resto:** no se ha tocado la geometría de la escena de velas (escala vertical): riesgo de recortes por poco beneficio.

### 3. Aviso para quien siga
- Hay tres cambios de JS, todos de presentación: `subir()`, `elegir()` (desplazamiento) y la fórmula de `alto` de calendario y mapa; más la plantilla del hero vacío.
- Si cambias `--pierde-suelo` o pones texto de color sobre un pozo, repite la auditoría de contraste (`tmp/rev/auditar.cjs d-claro`): el «30» morado de hoy
  sobre una pérdida se quedó en 3,96:1 al oscurecer el suelo y hubo que darle la tinta de la columna (`.cal .hoy .col3d .n`).
- La prueba de 1.054 comprobaciones no mira estilos: no habría visto A1/A2. `campos.cjs` mide el borde con foco y con error.
- Pendiente conocido que sigue igual: `.bv-col` < 44 px de ancho, rarezas 3, 4, 8, 10 y 12, caras del calendario que rozan la casilla vecina a 360 px.

---

## App instalable ([APP]) — TERMINADA

La web se puede llevar a la pantalla de inicio del teléfono y abrirse como una app (a pantalla completa, con su icono). **Sin service worker**
(decisión tomada: la web necesita conexión de todos modos y así no hay caché que deje a nadie en una versión vieja). Tres commits `[APP]`.
Verificación: etiqueta `app` (`…/agx/app/`): prueba `RESULTADO: OK` (1.054), 225 capturas sin problemas ni errores de página. Frente a las capturas de la
revisión (`…/agx/rev/`, `dif.py`): 183 idénticas, 41 con solo el ruido de la barra con vidrio y 1 distinta (`m-oscuro-22`, la ventana de la rutina 12 px más arriba
en `rev/`: era un desplazamiento suelto de aquella captura; el código anterior a [APP], vuelto a capturar, sale idéntico al de ahora). Sin evento y fuera del iPhone la web
se ve igual que antes. Las capturas de `…/agx/final/` son anteriores a la revisión [R]: para comparar, usar `rev/`.
Pruebas a la vista en `…/agx/app/`: `instalar-00-iconos.png` (iconos a tamaño real y a 48 px, con las máscaras de Android e iOS), `instalar-01…09-*.png` (tarjeta, acción,
hojas del iPhone, tableta, 360 px, ordenador, como app) e `instalar-10/11-margenes-seguros-*.png` (iPhone instalado, vertical y apaisado).
Scripts propios en `…/agx/tmp/app/` (`lib.cjs` es el montaje de los revisores con `opc.ua`, `opc.tactil` y `opc.antes`, y el host simulado sirve
también el manifiesto y los iconos): `c1-manifiesto.cjs`, `c2-cdp.cjs`, `c3-aviso.cjs` (118 comprobaciones; deja las capturas `instalar-*.png` en
`…/agx/app/`), `segura.cjs` (márgenes seguros simulados: copia con `env()` sustituido en :4457 vertical y :4458 apaisado), `entrada-h.cjs`,
`iconos.py` + `favicon.py` + `rasteriza.cjs` + `hacer-iconos.sh` (los iconos; `py/` lleva fontTools), `hoja-final.py`, `notas.md`.
**Ojo:** `agx-verificar.sh app` escribe en `…/agx/app/` y borra los PNG antes de capturar: las capturas del aviso se regeneran después con `c3-aviso.cjs`.

### 1. Archivos nuevos en el repositorio (Netlify publica la raíz)
- **`manifest.webmanifest`**: «AGX · Área de alumnos» / «AGX», `lang es`, `dir ltr`, `id` = `start_url` = `scope` = `/`, `display standalone`, `orientation any`,
  `theme_color #1A0E3E` (= `--lateral`: la barra lateral, que en el móvil es la cabecera), `background_color #150A38` (= `--hero-2`: el tono central de la mesa
  de la entrada, que es lo primero que se ve al abrir), `categories` education/finance, tres iconos y tres atajos (`/#diario`, `/#formacion`, `/#ranking`, con los
  nombres de la navegación; `leerRuta()` reconoce esas rutas tal cual).
- **`iconos/`**: `icono-192.png`, `icono-512.png` (tecla con las esquinas transparentes, para ordenador), `icono-maskable-512.png` (a sangre, opaco, la marca dentro
  del círculo central del 80 %), `apple-touch-icon.png` (180×180, opaco, sin esquinas: iOS las recorta), `favicon.svg` (1 KB, la marca en trazados: no depende de la
  fuente) y `favicon-32.png`.
- **Diseño del icono:** una tecla de marca vista de frente con los materiales del sistema: cara `--marca-frente #5B2ED1` con una luz muy leve de arriba a la izquierda
  (`#663AE0 → #5B2ED1 → #5127C8`), arista de luz arriba (`#9474F8`), canto abajo (`--marca-lado #35188F`) y «AGX» en Bebas Neue, blanca, con el relieve de `.marca-agx`
  (bandas `#C3B2FF`, `#9B7DFF`, `#4421A8`, `#2A1470` hacia abajo). «AGX» va en trazados sacados de la fuente local (posiciones medidas en Chromium, con su kerning y
  `letter-spacing .02em`). Se probaron cuatro variantes (A plana, B con más luz y letras mayores, C tecla sobre la mesa oscura, D = A con luz leve): se eligió la D
  porque es la que mejor se lee a 48 px sin salirse de los materiales del sistema; la C pierde tamaño de letra y se funde con los fondos oscuros.
  Para regenerarlos: `bash …/agx/tmp/app/hacer-iconos.sh`.

### 2. `index.html`
- **`<head>`**: `link rel=manifest`, `theme-color` (dos etiquetas, una por esquema del sistema, con el mismo color), `mobile-web-app-capable`,
  `apple-mobile-web-app-capable`, `apple-mobile-web-app-title` = AGX, `apple-mobile-web-app-status-bar-style` = default, `apple-touch-icon` y `icon` (png de 32 y svg).
  **Por qué el color de tema no cambia con el tema de la web:** la franja del sistema toca la cabecera del móvil, que es la barra lateral, y esa superficie es oscura
  (`--lateral`) en claro y en oscuro (igual que hizo [R] con `body::after`). Además el tema de la web no sigue al del sistema (se guarda en «agx-modo»), así que
  `prefers-color-scheme` no sirve para elegirlo. Resultado: un solo color, igual que `theme_color`, y nada que actualizar al cambiar de tema.
- **JS, sección «App instalable»** (antes de «Barra superior»): `enApp()`, `navegadorIOS()` → `'safari' | 'otro' | null`, `modoInstalar()` → `'directo' | 'safari' | 'otro' | null`,
  `pintarInstalar()` (la llama `pintarDatos()` y los dos eventos), `instalarApp(origen)`, `abrirInstalar(tipo, origen)` / `cerrarInstalar()`.
  Acciones nuevas: `data-accion="instalar"`, `"instalar-no"`, `"cerrar-instalar"`. `localStorage «agx-instalar»` = `cerrado` | `instalada`.
  - **Cuándo se ofrece:** nunca dentro de la app (`display-mode: standalone` o `navigator.standalone`); si hay un `beforeinstallprompt` guardado → `'directo'`
    («Instalar» llama a `prompt()`; el evento vale una vez: si el alumno cancela, el navegador lanza otro); si es iPhone o iPad → hoja. En cualquier otro caso, nada.
  - **iPhone/iPad:** Safari = lleva `Version/` y `Safari/` y ninguna marca de otro navegador; «otro» = `CriOS`, `FxiOS`, `EdgiOS`, Instagram, Facebook… o una vista web
    (lleva `Mobile/` pero no `Safari/`); si no encaja en ninguno, nada. El iPad que pide «sitio de escritorio» se reconoce por `Macintosh` + pantalla táctil.
  - **Tarjeta** `aside.instalar-d.placa#instalar-d`: se inserta BAJO DEMANDA detrás de `#avisos-diario` (no hay contenedor fijo: sin evento y fuera del iPhone, el DOM
    del resumen es el de antes) y solo si `(pointer: coarse)`, no es la revisión de un alumno (`REV`) y no está «agx-instalar». Dice «móvil» o «tableta» según la pantalla.
  - **Acción** «Instalar la app» en las acciones rápidas (grupo Ajustes, la primera), también en ordenador y aunque la tarjeta esté cerrada.
  - **Hoja** `#instalar` (`.imp-capa > .imp.instalar`, `role="dialog"`, `aria-modal`, con nombre y descripción): mismo patrón que importar y rutina (foco al abrir en
    «Entendido», Escape, clic fuera, el foco vuelve a quien la abrió).
- **CSS, bloque «APP INSTALABLE ([APP])»** al final de `<style>`: `.instalar-d` (placa de una línea; el icono se oculta ≤ 380 px para que el rótulo quepa),
  `.instalar-ico` (el icono de la app en pequeño: tecla de marca con «AGX» en relieve), `.imp.instalar`, `.pasos-app` (cada paso es un `li.hundido` con `.paso-n`,
  ficha de marca, `.paso-txt` y `.paso-dib.placa` con el botón de Safari dibujado), `.instalar-nota`. No hay teclas nuevas (usa `.boton` e `.icono-btn`): nada que
  añadir a las listas de teclas. Sus teclas miden 44 px en cualquier ancho (la tarjeta solo sale en pantallas táctiles).

### 3. A pantalla completa (márgenes seguros), en su sitio
| Qué | Antes | Ahora |
|---|---|---|
| `html{scroll-padding-bottom}` (≤ 900) | no contaba el indicador de inicio: lo enfocado podía quedar 14 px bajo la barra | suma `env(safe-area-inset-bottom)` |
| `.imp-capa` (importar, rutina, instalar) | 24 px abajo | `24px + env(bottom)` |
| `.cajon` / `.cajon-pie` | el margen de abajo lo ponía el cajón: bajo el pie quedaba una tira de otro tono | lo pone el pie: su fondo llega al borde |
| `.entrada` | 16/14 px a los lados | `max(16px/14px, env(left/right))`: con el móvil girado no se mete bajo la muesca |
| `.entrada` apaisada y baja (`min-width:761px` y `max-height:480px`) | centrada con `place-items`: si no cabía, la parte de arriba quedaba fuera sin poder llegar | `place-items:start` + `margin-block:auto` en la placa, columnas 3fr/4fr y márgenes de 6 px: cabe en 844×390 con y sin muesca y, si no, se desplaza |
Ya estaban bien (medido con `segura.cjs`, vertical y apaisado, claro y oscuro): barra de abajo (`.nav`), botón flotante, aviso (toast), `.pl-pie`, cajón (arriba y derecha),
barra superior, acciones rápidas y visor. Con `env()` = 0 (ordenador, capturas) todo se pinta igual que antes.

### 4. Comprobado
- **Manifiesto e iconos** (`c1-manifiesto.cjs`, 42 comprobaciones): se sirve como `application/manifest+json`, JSON válido, cada icono existe, es del mismo origen y mide lo
  que declara; el maskable y el apple-touch-icon no tienen transparencia; los atajos apuntan a rutas que existen y se llaman como en la navegación; las etiquetas del `<head>`.
- **Instalable** (`c2-cdp.cjs`): `Page.getAppManifest` sin errores en los tres montajes. `Page.getInstallabilityErrors`: vacío con headless shell y con Chromium completo
  en un perfil normal, donde además **Chromium lanza por sí solo `beforeinstallprompt`** (la prueba de que se puede instalar sin service worker). Con Chromium completo en un
  contexto de Playwright devuelve `in-incognito`: es del entorno (esos contextos son de incógnito), no de la web.
- **Aviso** (`c3-aviso.cjs`): sin evento no sale nada (móvil, Android sin evento, Firefox de Android, Instagram en Android, iPhone dudoso, Mac, ordenador); con evento sintético
  (con `prompt()` y `userChoice`): tarjeta, acción, `prompt()` una sola vez, cancelar, aceptar, `appinstalled`; cerrada no vuelve (ni con otro evento, ni al cambiar de sección,
  ni al recargar, ni si el navegador no deja guardar); iPhone en Safari (hoja, foco, Escape, clic fuera, contraste, 44 px), en Chrome/Firefox/Edge de iOS, en Instagram y en una
  vista web; iPad; tableta; 360 px; ordenador (solo acción); otras vistas; alumno real y administrador en el servidor simulado.
- **Como app:** `Emulation.setEmulatedMedia` con `display-mode` **no hace nada en Chromium 153** (lo acepta, pero la media query sigue en `browser`). Se comprueba de verdad con
  una ventana de aplicación (`--app=URL`, `launchPersistentContext` sin `isMobile`), donde `display-mode` es `standalone`: ni tarjeta ni acción; en una pestaña normal del
  mismo perfil, la tarjeta sale con el evento real. También con `navigator.standalone = true`.
- El headless shell (el de la prueba y las capturas) no pide ni el manifiesto ni los iconos; Chromium completo sí pide los iconos. La prueba sigue sin ver peticiones a otros hosts.
- Entrada y cierre de sesión: son navegaciones normales en la misma ventana (`<a href="/api/auth/login">`, `<a href="/api/auth/salir">` y `location.href`), sin `window.open`.

### 5. Pendiente / conocido
- **Sin probar en teléfonos reales** (solo Chromium y simulaciones). Conviene probar en un iPhone y en un Android: instalar, entrar con Discord dentro de la app (la página de
  Discord es de otro dominio y cada sistema la enseña a su manera; en Android, si está la app de Discord, puede abrirla), el color de la franja de estado y girar el teléfono.
- En iPhone la app instalada no comparte sesión con Safari: hay que entrar con Discord una vez dentro de la app. Tampoco comparte el tema ni «agx-instalar».
- En iPhone no hay forma de saber que se ha instalado: en Safari la tarjeta sigue hasta que el alumno la oculta (dentro de la app no sale nunca).
- El navegador de dentro de algunas apps de iPhone es el propio Safari «incrustado» y no se puede distinguir: ahí salen los dos pasos y la nota «¿No te sale esa opción? Abre … en Safari».
- Chrome y Firefox de iOS también saben añadir a la pantalla de inicio desde iOS 16.4, pero la hoja manda a Safari (lo pedido, y vale para todos).
- Sin service worker no hay modo sin conexión: sin red, la app instalada enseña el error del sistema. En iPhone la app abierta no tiene botón de recargar: tras publicar una
  versión nueva la coge al cerrarla y volver a abrirla.
- Android con Firefox o dentro de Instagram/Discord: no hay evento, no se ofrece nada (se puede instalar a mano desde el menú del navegador donde exista).
- Los iconos de 512 pesan 62–80 KB (la luz de la cara es un degradado). Los atajos del manifiesto usan el icono de 192.

---

## Segunda ronda de comprobación ([V]) — TERMINADA

Cuatro comprobadores independientes (V1: correcciones [R] de funcionamiento y móvil · V2: correcciones de dirección de arte · V3: código nuevo de [R] y [APP] · V4: lo que la
web guarda y envía frente a la publicada) dejaron 10 problemas (V1-2 y V3-1 son el mismo). Cada uno se comprobó antes de tocar (script del comprobador, captura o medida
propia): los 10 eran reales y los 10 están arreglados, en 6 commits `[V]` (d7988f7 … 63ab975). Cuaderno, problema a problema: `…/agx/verificacion.md`.
Scripts propios en `…/agx/tmp/v/` (`lib.cjs` = montaje de `ver-3` con `main` en :4411; la rama tal como estaba al empezar (6dab448) se sirve desde `tmp/v/head/` en :4440 para
comparar): `col.cjs` (clic real en las columnas del calendario y del mapa, desde el borde de la casilla), `tcard.cjs` (las 8 tarjetas de Práctica libre), `cta.cjs` (tarjeta de la
cuenta por anchos y con 3, 2 y 1 cifras), `rev-cta.cjs`, `imp.cjs` (qué queda tapado en la vista previa de importar), `ops.cjs` y `ops2.cjs` (columna pegada), `hoja.cjs`, `ct.cjs`,
`ent.cjs` (entrada en ventanas grandes), `dif.cjs` + `dif.py` (un selector, antes y después, píxel a píxel). Copias de los scripts de los comprobadores, con la salida en mi carpeta
para no pisar sus pruebas: `tmp/v/v1/`, `tmp/v/v3/`, `tmp/v/c3/` (el `c3-aviso.cjs` de [APP]) y `tmp/v/v4/` (prueba diferencial de datos).
Verificación final: etiqueta `v` (`…/agx/v/`): prueba `RESULTADO: OK` (1.054), 225 capturas sin problemas ni errores de página, más las 18 `instalar-*.png` regeneradas.
Frente a `…/agx/app/` (`tmp/p3/dif.py`): 172 idénticas, 48 con solo el ruido de la barra con vidrio y 5 distintas: las 2 de la vista previa de importar en el móvil y la tabla de
operaciones en tableta (lo tocado) y 2 con un desplazamiento suelto de la captura (`m-oscuro-09`, 2 px, y `m-oscuro-22`): repetidas a solas con el código de antes y el de ahora
salen idénticas (`…/agx/v-rep-head/` y `v-rep-rama/`). `limpia.py informe`: 0 declaraciones muertas.

### 1. Arreglado
| Problema | Qué pasaba | Qué se hizo y dónde |
|---|---|---|
| V1-1 (media) | Con ratón, pulsar en los 10–12 px de arriba de un día que gana mucho (donde está el número) hundía la columna pero no filtraba: la cara bajaba y el clic caía fuera | `.col3d.g:active` ya no cambia `--h`: **la columna no baja al pulsar, la cara se oscurece** (`#37BE8F` + sombra interior). Fuera la transición de `transform` de `.col3d`. Aquí no vale el relleno de A4: `::before` y `::after` son el frente y el lado |
| V1-2 = V3-1 | La tarjeta «Examen final» perdía el clic en sus 3 px de arriba: `overflow:hidden` recortaba el relleno de A4 | `.tcard-ex` sin `overflow:hidden` (ya no recortaba nada visible: 82 píxeles con diferencia ≤ 6/255 en reposo) |
| V2-1 (media) | Entre 901 y 1320 px las cifras de la cuenta no cabían junto al título y, al alinearse arriba (C5), tapaban «Cuenta sana» | Bloque nuevo tras la regla de C5: **dos líneas cuando no cabe** (icono y título arriba, cifras debajo a partes iguales, rótulos en dos líneas si hace falta). Con 3 cifras, de 901 a 1439 px; con 2, de 901 a 1279; se cuenta con `.hoy-txt:nth-last-child(4|3)`. `align-content:center`: si la tarjeta de la rutina la estira, el contenido queda centrado en bloque. Desde 1440 y hasta 900, igual que antes |
| V3-2 | La hoja de instalar no era modal de verdad: Tab salía a lo de detrás, Ctrl/⌘+K abría las acciones rápidas por debajo y, al navegar, se quedaba abierta | **JS:** en el `keydown` global la hoja se atiende la primera (Escape, Tab que da la vuelta entre la X y «Entendido», Ctrl/⌘+K sin efecto); el `hashchange` la cierra (sin devolver el foco a algo de la vista que se va a repintar) |
| V3-3 | En iPhone apaisado y móviles de 320 px la hoja se abría desplazada hasta «Entendido»: título y X fuera | **JS:** `abrirInstalar` pone `scrollTop=0` y enfoca con `preventScroll` |
| V4-1 | Vista previa de importar en el móvil: «Resultado» pegada tapaba «Dirección» y «Contr.» («Largo» se leía «L») | Hasta 520 px `.imp-tabla` son **fichas de dos líneas** (misma técnica que la tabla de operaciones: `thead` solo para lectores, `tr` flexible con salto, «N contr.» con `::after`). Desde 521 px la tabla cabe entera. Y en la tabla de operaciones (641–1260 px) la columna pegada lleva ahora un filo y una sombra dura en un `::before`: **el `box-shadow` de 1 px de [R] no llegaba a pintarse** (no pinta en celdas de una tabla con `border-collapse:collapse`) |
| V1-3 | Con margen seguro arriba (app a pantalla completa con la franja sobre la web), `subir()` dejaba «Salir» y medio reloj del examen bajo la franja. Latente | **JS:** `subir()` suma el alto de `body::after` cuando la barra no está pegada; `scroll-padding-top:calc(12px + env(safe-area-inset-top))` hasta 900 px. Con margen 0 el registro del examen es idéntico al de antes (72 líneas) |
| V1-4 | Tras «Pon al menos 1 contrato», corregir con «+» dejaba el campo en rojo y el aviso puesto (venía así de `main`) | **JS:** `ct-mas` y `ct-menos` llaman a `alCambiar({target})`, lo mismo que al teclear |
| V2-2 | A 2560×1440 la placa de la entrada volvía al 21 % de la pantalla | Bloque nuevo `@media (min-width:2000px) and (min-height:1000px)`: placa `min(60vw,110vh)` (nunca menos de 1180 px) y velas `clamp(430px,56vh,34vw)`: 34 % a 2560×1440 y a 3840×2160; hasta 1920×1080 no cambia |

### 2. Lo que la web guarda y envía
Solo se ha tocado presentación y teclado. Repetida la prueba diferencial de V4 (`tmp/v/v4/`, misma secuencia contra `main` y la rama, en ordenador y móvil): **localStorage e
IndexedDB idénticos en los 24 bloques** (0 diferencias) y las peticiones `/api/*` con el mismo patrón que tenía la rama antes de esta ronda: 20 tramos iguales y los mismos 4
avisos que ya vio V4 (texto leído a destiempo en «IA» ×2; en Formación en móvil `main` hace más guardados intermedios, 6 frente a 3, y **el último cuerpo enviado es idéntico**;
y un tramo, «salir» en móvil, que falla igual en las dos por el propio script).
Único cambio de comportamiento frente a la publicada hecho a propósito en esta ronda: V1-4 (las teclas «+»/«−» de contratos quitan el rojo y el aviso). No cambia lo que se guarda.

### 3. No tocado, a propósito
- **Ventanas de importar y de la rutina (`#imp`, `#rut`)**: tienen los mismos tres defectos de teclado que tenía la hoja de instalar (Tab se sale, Ctrl+K abre la paleta por debajo,
  no se cierran al navegar). Es lo que hace la web publicada; arreglarlo es cambiar lógica que no es nueva. Si se quiere, el arreglo es el mismo de `#instalar`.
- **Tabla de operaciones en tableta y portátil pequeño**: «Contr.» sigue debajo de «Resultado» en reposo (se ve al desplazar); ahora hay un filo que lo avisa.
- **Tarjeta de la cuenta con una sola cifra** a 901–1000 px: el título se parte en dos líneas («Cuenta / sana»), como en `main`; no se pisa nada.
- **Entrada**: el texto de la caja no crece en monitores muy grandes (solo la placa y las velas). A 2560×1080 la placa se queda en el 26 %.
- En el examen (no en la práctica) en el móvil, tras responder, «Siguiente» puede quedar bajo la barra de abajo (a 360×740, entero; a 390×844, 11 px) y hay que desplazar.
  Ya estaba así antes de esta ronda y ningún comprobador lo marcó (B7 solo se arregló para la práctica); visto en `tmp/v/v1/examen.log`.

### 4. Aviso para quien siga
- Sección 5 de P1 («Objetos»): la columna pulsada ya **no baja al 45 %**; se oscurece.
- `box-shadow` no sirve en `td`/`th` de `.tabla` (bordes fundidos): usar un pseudo-elemento o un borde.
- La prueba de funcionamiento tiene una carrera propia en «El tabulador no sale del cajón» (Diario · escritura): `abrirCajon` enfoca la fecha con `setTimeout 0` y la prueba enfoca
  «Guardar» justo después. Falló una vez de las ocho pasadas completas de esta ronda (justo después de otro script con Chromium); repetida, pasa. No lanzar otros Chromium a la vez.
- Al medir pulsaciones con Playwright, cerrar siempre los contextos: con páginas huérfanas la transición no avanza y sale un falso «sí».
- `agx-verificar.sh v` borra los PNG de `…/agx/v/` antes de capturar: las `instalar-*.png` hay que volver a copiarlas desde `tmp/v/c3/cap/` (o regenerarlas con esa copia de `c3-aviso.cjs`).
