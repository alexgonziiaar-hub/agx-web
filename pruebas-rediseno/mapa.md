# Mapa del diseño actual de agxcommunity.com (AGX Área de alumnos)

Fuente: `/home/user/agx-web/index.html` (6.737 líneas, rama `rediseno-3d` = `main`). Los números son líneas de ese archivo.
CSS 10–1491 · esqueleto HTML 1494–1614 · JS 1615–6734 (un IIFE; casi todo el HTML se pinta con cadenas desde JS).
Capturas del estado actual: carpeta `base/` (nombres `<tamaño-tema>-<número>-<nombre>.png`; se citan como `d-claro-01`).

Aviso para leer el CSS: está escrito **por capas**. Una regla de la línea 147 puede estar corregida en la 630. Las capas, en orden:
base 14–591 · «capa premium» 593–860 · ranking 862–1001 · entrada 1003–1026 · alumnos 1028–1061 · diario pro 1063–1306 · ruta 1308–1404 · cuenta, rutina y errores 1406–1490.

---

## 1. Sistema visual

### 1.1 Variables de `:root` (tema claro, 14–64)

| Grupo | Variables | Uso |
|---|---|---|
| Superficies | `--fondo #FFF`, `--fondo-2 #F7F6FB`, `--fondo-pagina #FAF9FE` | paneles, zonas tenues, fondo del `body` (594) |
| Texto | `--tinta #1A1726`, `--tinta-2 #5E5A6E` | texto y texto secundario |
| Bordes | `--borde #E9E6F2`, `--borde-2 #D3CEE2` | paneles y campos |
| Marca | `--morado #5B2ED1`, `--morado-osc`, `--morado-suave #EFEBFC`, `--violeta #8E6CFF`, `--violeta-claro #C3B2FF`, `--orquidea #C77DFF`, `--grad-marca` (115°, #4E25C2→#6E3BE8→#9147EA) | botón principal, estados activos, brillos |
| Resultado | `--compra #13805F`, `--compra-suave`, `--venta #CF3A4A`, `--venta-suave`, `--ambar #D99520` | ganancia, pérdida, aviso |
| Barra lateral (siempre oscura) | `--lateral #1A0E3E`, `--lateral-2`, `--lateral-borde`, `--lateral-txt` | `.lateral` |
| Hero (siempre oscuro) | `--hero-1 #3A1C93`, `--hero-2 #150A38`, `--hero-txt`, `--hero-tenue`, `--hero-linea`, `--hero-chip`, `--hero-borde`, `--pos-claro #5BE3A7`, `--neg-claro #FF8C98` | cabeceras oscuras, entrada, tarjeta de examen |
| Fijos (no cambian con el tema) | `--tinta-fija`, `--tinta-2-fija`, `--morado-fijo`, `--compra-fija`, `--venta-fija`, `--blanco`, `--pantalla #14151B` | globo de la curva (siempre blanco), fondo de capturas |
| Capas | `--capa`, `--visor`, `--cristal` (barra superior), `--toast-fondo`, `--toast-txt` | velos, visor, vidrio, avisos |
| Sombras | `--sombra 0 14px 34px rgba(29,16,67,.10)`, `--sombra-tip` | tarjetas al pasar, globos y avisos |
| Tipos | `--f-ui "Archivo"`, `--f-marca "Bebas Neue"` | ver 1.3 |

### 1.2 Modo oscuro (775–781)

- **Cómo se activa:** atributo `data-modo="oscuro"` en `<html>`. Lo pone el JS al arrancar leyendo `localStorage['agx-modo']` (1626) y lo cambia `cambiarModo()` (6238–6247), desde el botón `#bs-modo` (`data-accion="modo"`) o desde la paleta (6162). No sigue `prefers-color-scheme`.
- **El cambio va animado:** círculo que se abre desde el botón con View Transitions (clase `vt-modo` en `<html>`, 780–781 y 6243–6246).
- **Variables que cambian (776):** `--fondo #140E2E`, `--fondo-2 #1C1540`, `--fondo-pagina #0B0720`, `--tinta #F0ECFF`, `--tinta-2 #A9A1C9`, `--borde #2A2252`, `--borde-2 #3B3170`, `--morado #9478FF`, `--morado-osc`, `--morado-suave #22174F`, `--compra #3DD39B`, `--compra-suave`, `--venta #FF6B7D`, `--venta-suave`, `--capa`, `--sombra`, `--toast-fondo`, `--toast-txt` (el aviso pasa a claro), `--cristal`, `color-scheme:dark`.
- **No cambian:** toda la familia `--lateral-*`, `--hero-*`, `--violeta*`, `--orquidea`, `--grad-marca`, `--pos-claro`, `--neg-claro`, `--pantalla`, `--visor`, `--sombra-tip`, `--ambar`, los `*-fija`.
- **Reglas sueltas del modo oscuro:** texto de chip y letra elegidos (777), fondo del `body` (778), color del logro «otro» (930).
- Los colores escritos a mano no se adaptan: medallas y trofeos del ranking (889–890, 917–919, 962–963), `.cta-aviso .cta-etq` (1435), colores del confeti (5316) y de las capturas de ejemplo (5360–5390).

### 1.3 Tipografías

- **Archivo variable** (ejes `wdth 62–125` y `wght 100–900`, línea 9): toda la interfaz. Texto base 15px/1,5 (67). Los títulos y las cifras usan `font-stretch` ancho: `h1` 108 % (113), `.hero-neto` 118 % y peso 820 (158), `.kcard-v` 110 %, `.f-anillo-txt b` 115 %, `.pie-res b` y `.reloj b` 112 %. Cifras siempre con `font-variant-numeric:tabular-nums`.
- **Bebas Neue**: solo marca y sellos: `.marca-agx` (81, 601), `.sello` (416), `.veredicto` (524), `.ruta-n` (844), `.rk-cel b` (877), `.rk-pd-base span` (901), `.rk-total b` (935), `.rk-paso-n` (967), `.entrada-marca` (1008).
- Cuerpos habituales: 30 (h1; 25 en móvil), 23 (enunciado de test; 20 en móvil), 20–28 (cifras), 16–19 (títulos de panel y tarjeta), 14–15 (texto), 12–13,5 (etiquetas y ayudas).

### 1.4 Radios, sombras y degradados

- **Radios:** 24 (caja de entrada) · 20 (hero; 16 en móvil) · 18 (tarjetas de tema, niveles, alumnos, paleta, diálogos, FAB) · 16 (KPI, panel, tarjetas de hoy) · 14–15 (barra superior, opciones, avisos, chips del hero 12) · 10–11 (botones, campos, navegación) · 8–9 (botón pequeño, celdas) · 999 (píldoras, chips, etiquetas).
- **Sombras:** `--sombra` (tarjeta al pasar), `--sombra-tip` (globo, aviso), botón `0 6px 18px rgba(91,46,209,.28)` + brillo interior (119–120), hero `0 30px 60px -20px` (633), tarjeta inclinada `0 22px 44px -18px` (666), cajón `-20px 0 50px` (337), paleta y diálogos `0 30px 80px` (691, 1110), caja de entrada `0 40px 90px -20px` (1006).
- **Degradados:** `--grad-marca` (botones, icono activo, número de nivel actual, chip IA); hero radial `--hero-1→--hero-2` (148) + rejilla de líneas con máscara (149–151) + aurora (622–629) + ruido `feTurbulence` y luz del ratón (630–632); halos del `body::before` (595–596, 778); degradados SVG `#gradAnillo` y `#gradMarca` (1495–1500) para anillos y radar, `#gradCurva` y filtro `#brillo` dentro de la curva (5579–5580); texto con degradado en la marca (601) y en los segundos del ranking (879).
- **Vidrio (`backdrop-filter`):** velo del cajón (336), botón fantasma (618), chips del hero y selector de periodo (636), cinta (648), velo de paleta y diálogos (690, 1109), barra superior (706), contador del ranking (876), caja de entrada (1006).

### 1.5 Estructura

- `.app` (76): rejilla de 2 columnas, `264px` + `minmax(0,1fr)`, `min-height:100vh`.
- `.lateral` (77–79, 599–612): pegada arriba, `100vh`, con desplazamiento propio. Contiene `.marca`, `.buscar` (abre la paleta), `.nav` (4 enlaces; el de Alumnos, `#nav-alumnos`, oculto salvo administrador), `#lat-widgets`, `.alumno` y `.lema`. HTML fijo en 1503–1515.
- `.principal` (110): relleno 28/36px. Dentro, `.barra-sup` (706; pegada a 12px del borde, vidrio, `max-width:1280px`) con fecha, hora, sesión de futuros en vivo y botón de tema; y `#vista.contenido` (111; `max-width:1280px`), donde `render()` (6528) pinta cada pantalla.
- Fuera de `.app` (1526–1613), todo con `hidden` hasta que se abre: `#entrada`, `#capa` + `#cajon`, `#visor`, `#paleta`, `#imp` (importar), `#rut` (rutina), `#toast`. Orden de apilado: barra superior 15 · FAB 20 · velo 30 · cajón 31 · visor 50 · aviso y globo de columnas 60 · paleta 70 · diálogos 72 · confeti 80 · entrada 200.
- Rejillas de contenido: `.kpis4` (206), `.fila.a` 1:1 y `.fila.b` 7:5 (235–237), `.insights` (749), `.tgrid` 3 columnas y `.tgrid.c4` (419, 856), `.ruta` 6 columnas (836), `.rk-grid` 7:5 (906), `.al-grid` 3 (1031), `.plan-grid` 11:10 (1183), `.lec-grid` 1fr + 320px (1356), `.quiz-grid` 1fr + 360px (470), `.hoy-fila` 1,4:1 (1407).

### 1.6 Puntos de corte

| Ancho | Qué cambia | Líneas |
|---|---|---|
| ≤ 1340 | bloques del repaso libre (`.ruta`) de 6 a 3 columnas | 857 |
| ≤ 1200 | `.kpis4` e `.insights` a 2 columnas; `.fila.a/.b` a 1; hero de formación a 2 columnas con estado y radar debajo; `.num-grid` a 2 | 546–551, 783–787, 1272–1278 |
| ≤ 1060 | hero del diario a 1 columna (la curva baja); test y detalle de operación a 1 columna; `.tgrid` a 2; hero y rejilla del ranking a 1; alumnos a 2; plan a 1 columna (si el plan está guardado, la columna derecha sube: `order:-1`); lección a 1 columna | 552–556, 858, 975–978, 1060, 1279–1282, 1394 |
| **≤ 900** | **cambia la navegación:** `.app` a 1 columna; la barra lateral deja de ser lateral y pasa a ser un bloque arriba (no pegado) con marca, lupa y enlaces en fila; se ocultan los subtítulos de los enlaces, `#lat-widgets`, `.alumno` y `.lema`; se oculta el botón grande «Nueva operación» y aparece el botón flotante `.fab`; se oculta el atajo `N`; la lupa queda en icono; tarjetas de hoy a 1 columna | 557–571, 794, 820–826, 1283–1285, 1489 |
| ≤ 760 | tarjetas de examen y fallos (`.modos`) a 1 columna | 815 |
| ≤ 640 | hero con menos relleno y radio 16; KPI, tarjetas e `.insights` a 1 columna; campos del cajón a 1 columna; fila de setup en 2 líneas; enunciado 20px; sello 76px; se ocultan los atajos de teclado; `h1` 25px; enlaces de navegación con el icono encima; se oculta la hora; pestañas a todo el ancho; ranking compacto (sin barras); niveles y lecciones compactos; alumnos a 1 columna | 572–587, 788–793, 859, 979–998, 1061, 1286–1295, 1395–1403, 1490 |

- **Cajón:** `width:min(520px,100%)` (337): en móvil ocupa toda la pantalla; el pie con el resultado y los botones se queda abajo.
- **Tablas:** `.tabla-wrap{overflow-x:auto}` (301) y `.tabla-ops{min-width:920px}` (308): en móvil la tabla de operaciones se desplaza en horizontal, y el detalle abierto va dentro de esa tabla.
- **Diálogos** (`.imp-capa`, `.paleta-capa`): centrados arriba con `8vh`/`12vh`; si no caben, se desplaza el velo.
- Zonas seguras del móvil con `env(safe-area-inset-*)` en barra lateral, principal, cajón, visor, paleta, aviso y FAB.

---

## 2. Inventario de componentes

CSS = líneas de estilo. JS = función que lo pinta.

### Marco

| Componente | Para qué | Clases | CSS | JS |
|---|---|---|---|---|
| Barra lateral | navegación, marca, mini indicadores | `.lateral .marca .marca-agx .nav .nav-ico .nav-txt .buscar .lat-widgets .lw .lw-rk .lw-barra .alumno .avatar .lema` | 77–108, 599–612, 1000–1001, 1023–1026; móvil 559–566, 820–825, 980–982 | HTML 1503–1515; `pintarLateral0()` 5451–5457; `pintarAlumno()` 6707–6714; enlace activo en `render()` 6529 |
| Barra superior | fecha, hora, sesión de futuros, tema | `.barra-sup .bs-izq .bs-fecha .bs-hora .sesion-viva (+ny/londres/asia/post/pausa/cerrado) .punto .bs-modo` | 704–723 | HTML 1517–1521; `pintarBarra()` 6226–6233 (cada 20 s, 6692); `pintarBotonModo()` 6234 |
| Cabecera de módulo | título, texto y acciones | `.cab-modulo .sub .cab-acc .btn-imp` | 112–114, 1064–1065 | `cabDiario()` 4735–4743 y cada vista |
| Pestañas | secciones del diario y de formación | `.sub-tabs a[aria-current] .ia-chip` | 1066–1071; móvil 1287–1288 | `cabDiario()` 4742; `tabsForm()` 4241 |

### Controles

| Componente | Clases | CSS | Notas |
|---|---|---|---|
| Botón | `.boton` + `.grande .sec .blanco .fantasma .peq`; `:disabled` | 119–132, 614–618, 1228 | degradado que se desplaza y destello `::after` al pasar |
| Otros | `.enlace (.peligro)`, `.icono-btn`, `.fab`, `.volver`, `.boton-dc` | 133–138; 144, 569–570, 619; 446–448 y 1049–1051; 1015–1017 | `.volver` está definido dos veces |
| Etiquetas | `.etq` + `.etq-l .etq-c .etq-setup .etq-ej .etq-atas .etq-falta`; `.estado .est-dom .est-pro .est-nue`; `.contador`; `.sello (.no .nada)` | 139–143, 1090–1092; 426–429; 803; 416–418 | |
| Selector de periodo | `.seg-oscuro` (en el hero), `.seg-claro` (en claro) | 168–171; 908–911 y 1140–1143 | `.seg-claro` definido dos veces: manda la segunda |
| Radios como botones | `.radios .r2 .r3`, `span.verde/.rojo` | 364–374 | sesión, dirección, resultado (HTML 1539–1562) |
| Chips | `.chips-sel`, `.chips-grupo`, `.chip-f` (filtro activo) | 375–382; 298–300 | instrumentos, setups, errores, días; `prepararForm()` 5772–5780 |
| Stepper | `.stepper` | 360–363 | contratos; acciones `ct-menos`/`ct-mas` (6575–6576) |
| Campos | `.campos .campo (.invalido) .ancho-total .ayuda .dinero (.sufijo-l) .r-caja .error` | 349–359, 391, 757–760, 1299–1305 | importe con sufijo `$`/`pts`; resultado en R |
| Subida de imagen | `.zona (.arrastrando) .subida .previa .previa-acc` | 383–390 | `pintarZona()` 5422; arrastrar 6649–6652; pegar 6644–6648; `procesarImagen()` 5408 |
| Escala 1–5 | `.rut-esc .rut-botones .rut-ley` | 1463–1472 | `abrirRutina()` 4131 |
| Casilla | `.pl-check` | 1195–1196 | plan, cuenta, rutina |
| Tecla | `kbd`, `.kbd-b` | 506, 723 | |

### Diario

| Componente | Para qué | Clases | CSS | JS |
|---|---|---|---|---|
| Hero del diario | resultado neto, objetivo, curva y cinta | `.hero .hero-diario .aurora .hero-izq .hero-top .hero-saludo .hero-etq .hero-neto (.p/.n) .hero-sub .hero-chips .hero-dcha .hero-curva-cab .hero-curva` | 147–203, 621–638 | `vistaDiario()` 5460–5498; `pintarHero()` 5519–5526 |
| Cifra tipo odómetro | el neto y el % «ruedan» hasta su valor | `.od .od-col .od-tira .od-sim` | 725–730 | `odometro()` 5507–5518 |
| Objetivo del mes | barra y edición en línea | `.obj (.logrado) .obj-cab .obj-edit .obj-barra .obj-form .obj-fila` | 732–743 | `chipObjetivo()` 5529–5533; envío 6248–6254 |
| **Curva de resultados** | resultado acumulado, una operación por punto | `.h-rejilla .h-cero .h-eje .h-area .h-linea .h-pt (.p/.n) .h-pulso .h-fin .h-cursor .h-captura .tip .tip-r .h-vacio` | 176–203, 637–638 | `pintarCurva()` 5569–5602; `mostrarPunto()` 5603; `ocultarPunto()` 5615 |
| Cinta | últimas 10 operaciones en movimiento | `.ticker .tk-titulo .tk-marco .tk-pista .tk-grupo .tk .tk-dir .tk-r .tk-s .tk-f` | 640–656 | `pintarTicker()` 6115–6122 |
| Avisos | operaciones sin completar, plan del último día | `.avisos-d .aviso-d (.plan .ok .ko) .aviso-ico .aviso-ir` | 1074–1086 | `pintarAvisos()` 4762–4777 |
| Tarjetas de hoy | cuenta de fondeo y rutina | `.hoy-fila .hoy-card (.cta-ok/-aviso/-peligro/-quemada/-objetivo/-limite/-vacia, .rut) .hoy-ico .hoy-txt .hoy-dato .hoy-barra .hoy-ir .hoy-acc` | 1407–1430 | `pintarHoy()` 4098–4117 |
| Tarjeta KPI | acierto, profit factor, media, racha | `.kpis4 .kcard .kcard-cab .kcard-t .kicono .kcard-fila .kcard-v .kcard-s .split .split-ley .racha-pts` | 206–227, 659–674 | `pintarKpis()` 5621–5638; estadísticas 4921; alumnos 6510 |
| Anillo de progreso | % en círculo | `.anillo .an-pista .an-valor .an-txt` | 213–217, 671–672 | `anillo()` 5308–5311 (SVG) |
| Tarjetas de patrones | «Lo que dicen tus datos», filtran al pulsar | `.ins-sec .ins-cab .insights .insight .ins-t .ins-v .ins-txt .ins-ir` | 745–755 | `pintarInsights()` 5543–5561 |
| Panel | contenedor blanco | `.panel .panel-cab .panel-meta .panel-cuerpo .vacio .ayuda-click .fila` | 230–239, 659–660, 1450 | todas las vistas |
| Calendario | resultado por día, filtra al pulsar | `.cal-nav .cal-dias .cal .celda (.sel) .finde .hoy .n .v .cal-pie` | 242–256 | `pintarCalendario()` 5639–5660 |
| Mapa de calor | sesión × día de la semana | `.mapa .cab .ses .mc (.sel) .mapa-ley` | 259–270 | `pintarMapa()` 5661–5678 |
| Setups | barras por setup | `.setups .setup-fila (.sel) .setup-n .pista-s .setup-v` | 273–284 | `pintarSetups()` 5684–5693 |
| Comentarios | notas del mentor | `.coments .coment-meta .txt` | 287–293 | `pintarComentarios()` 5694–5701 |
| Errores con su coste | barras por error | `.err-lista .err-top .err-n .err-u .err-barra .err-comp` | 1452–1461 | `pintarErrores()` 4120–4128 |
| Tabla de operaciones | lista, detalle y borrado | `.filtros .tabla-wrap .tabla .tabla-ops tr.op (.abierta .destello) tr.detalle .chev .mini-cap .sin-cap .hora-op .r-op .det-grid .det-cap .det-info .det-alex (.rev) .det-atas .det-riesgo (.falta) .detalle-acc .aviso-ej` | 296–333, 1089–1094, 1303–1305 | `pintarFiltros()` 5707; `pintarTabla()` 5722–5757; `irAOperacion()` 5760 |
| Cajón | nueva, editar o completar operación | `.capa .cajon (.atas) .cajon-cab .cajon-cuerpo .cajon-pie .pie-res .pie-acc .atas-res .atas-t` | 336–348, 1097–1104 | HTML 1527–1580; `abrirCajon()` 5810; `prepararCajon()` 5172; `leerForm()` 5781; `validar()` 5790; `pintarCalculo()` 5800; envío 6663–6681 |
| Visor de captura | captura de ATAS a pantalla completa | `.visor .visor-cab` | 394–401 | HTML 1582–1587; `abrirVisor()` 5427 |
| Diálogo | importar de ATAS y rutina | `.imp-capa .imp .imp-cab .imp-cuerpo .imp-pie .imp-pasos .imp-tz .imp-arch .imp-res .imp-cuentas .imp-tabla` | 1107–1135 | HTML 1596–1612; `pintarImp()` 4799–4830; `abrirRutina()` 4131–4150 |
| Estadísticas | números y gráficos | `.est-barra .est-per .est-vacio .num-grid .nd .est-desg .est-t .est-nota .est-rut .est-rut-b .est-rut-etq` | 1138–1158, 1476–1481 | `vistaEstadisticas()` 4912; `pintarEstadisticas()` 4916–4992; `panelEstado()` 4197 |
| Columnas | por hora, por día, reparto | `.bv .bv-zona .bv-area (.con-neg) .bv-cero .bv-col .bv-barra (.g .p .z .abajo) .bv-val .bv-etqs .tip-g` | 1161–1180 | `barrasV()` 4895–4907; globo 4986–4991 y `ponerTip()` 4712 |
| Plan | formulario de reglas | `.plan-grid (.guardado) .plan-col .plan-form .pl-intro .pl-grupo .pl-campos .pl-horario .pl-sub .pl-checks .pl-pie .pl-estado` | 1183–1198 | `vistaPlan()` 4999–5042 |
| Cuenta de fondeo | margen hasta el drawdown | `.cta-res (.cta-<estado>) .cta-fila .cta-etq .cta-pnl .cta-gauge .cta-pista .cta-datos .cta-form` | 1432–1449 | `panelCuenta()` 4162–4188 |
| Cumplimiento | días con el plan cumplido | `.cu .cu-top .cu-v .cu-dias .cu-d (.ok .ko .sel) .cu-top3 .cu-dia .cu-dia-cab .reglas .r-ico` | 1199–1221 | `pintarCumple()` 5066–5085 |
| Agente de IA | botones, espera e informes | `.panel-ia .ia-acc .ia-botones .ia-cargando .ia-orbe .ia-carga .ia-vacio .infs .inf (.ej) .inf-cab .inf-tipo .inf-t .inf-dcha .inf-res .inf-nota (.alta .media .baja) .inf-cuerpo .inf-titular .inf-resumen .inf-sub .inf-bloque (.bien .mal .pat) .inf-caps .inf-acciones .inf-viejo` | 1222–1268, 1483–1486 | `pintarIA()` 5126–5148; `tarjetaInforme()` 5108–5125 |

### Formación

| Componente | Para qué | Clases | CSS | JS |
|---|---|---|---|---|
| Hero de formación | anillo de progreso, siguiente paso | `.hero-form .ruta-hero .f-anillo .f-anillo-txt .f-titulo .f-acc .f-estado .ruta-datos` | 404–415, 763–764, 1309–1312, 1404 | `vistaRuta()` 4243–4277; `vistaFormacion()` 5899 |
| Nivel | acordeón con lecciones y examen | `.niveles .niv (.actual .prep) .niv-num .niv-tit .niv-est (.ok .prep .cerr) .niv-chev .niv-barra .niv-nota` | 1313–1335 | `vistaRuta()` 4249–4266 (`<details>`) |
| Fila de lección | lección, estado, candado | `.lec-lista .lec-fila (.sig .cerrada .ex) .lec-n (.ex) .lec-t .lec-chip (.ok .ko .dis .cerr .prep)` | 1336–1353 | `vistaRuta()` 4253–4260 |
| Lección | teoría y test | `.lec-migas .lec-grid .lec-art .lec-teoria .lec-clave .lec-fig .lec-lado .lec-test .lec-ok .lec-ko .lec-acc .lec-nav .lec-bloq .lec-bloq-ico` | 1355–1392 | `vistaLeccion()` 4279–4301; la teoría es HTML dentro de `RUTA` (2655–3984) |
| Tarjeta de tema | tema del repaso libre | `.tgrid (.c4) .tcard .tcard-top .ticono .tcard-n .tcard-t .tcard-d .tcard-pie .mini-barra .ir .ir-sec`; `.tcard-ex` (examen, oscura), `.tcard-rapido`; `.modos` | 419–443, 659–677, 801–806 | `vistaFormacion()` 5913–5940 |
| Bloques | 6 bloques del repaso | `.ruta .ruta-b[aria-pressed] .ruta-cab .ruta-n .ruta-pc .ruta-t .ruta-m` | 836–852 | `vistaFormacion()` 5907–5911 |
| Radar | dominio por bloque | `.f-radar .radar .rd-nivel .rd-eje .rd-txt .rd-pct .rd-dato .rd-pt .rd-g .rd-pie` | 762–773, 798–800 | `radar()` 5888–5898 (SVG) |
| Cabecera de test | volver, título, racha o reloj | `.quiz-cab .quiz-titulo .racha (.sube)` | 445–454, 685 | `vistaPregunta()` 5999–6003 |
| **Temporizador de examen** | anillo y minutos | `.reloj (.poco) #reloj #reloj-t` | 455–459 | `relojHTML()` 5960; `arrancarReloj()` 6088–6098 (cada segundo) |
| Progreso y navegador | barra y casillas numeradas | `.q-barra`; `.navegador .nq (.actual .resp .bien .mal)` | 460–469, 680–684 | `vistaPregunta()` 6004; `navegador()` 5948–5958 |
| **Opciones de test** | A/B/C | `.opciones .opcion (.elegida .bien .mal) .letra .ico` | 486–503, 683–684 | `vistaPregunta()` 5969–5974; `elegir()` 6101 |
| Pregunta | enunciado, figura, explicación | `.quiz-grid .preg-cuerpo .p-num .enunciado .figura .preg-nav .atajos .lado (.entra-lado) .veredicto-txt .autor .explicacion .resumen-ex .aviso-txt` | 470–521 | `vistaPregunta()` 5965–6016 |
| Figuras | footprint, GEX, open interest | `.fp-precio .fp-num .fp-x .fp-compra .fp-venta .fp-marca .fp-mecha .fp-alc .fp-baj .fig-ancha .fg-*` | 477–485, 807–814 | `footprint()` 5855; `figGex()` 5833; `figOI()` 5844 (SVG) |
| Resultado | sello, anillo y repaso de fallos | `.res-hero .veredicto (.no) .res-txt .res-acc .fallos .fallo .fallo-q .fallo-tuya .fallo-buena .exp` | 523–538 | `vistaResultado()` 6017–6055 |

### Ranking, alumnos, entrada y capas

| Componente | Para qué | Clases | CSS | JS |
|---|---|---|---|---|
| Hero del ranking | premio, cuenta atrás, tu puesto | `.hero-rank .rk-izq .rk-eti .rk-cuenta-t .rk-cel .rk-yo .rk-yo-ico` | 870–884 | `vistaRanking()` 6385–6431; `tickRanking()` 6432; `tuPosicion()` 6370 |
| **Podio** | los 3 primeros del mes | `.rk-podio .rk-pd (.p1 .p2 .p3 .libre) .rk-av-pd .rk-corona .rk-pd-nom .rk-pd-n .rk-pd-base` | 887–905; móvil 986–993 | `vistaRanking()` 6388–6391 |
| **Clasificación** | lista con barras | `.rk-grid .rk-lado .rk-lista .rk-fila (.yo) .rk-pos (.p1–.p3) .rk-quien .rk-tu .rk-tipos .rk-chip (.t-payout .t-evaluacion .t-otro) .rk-barra .rk-total .rk-sep .rk-vacio` | 906–938 | `filasRanking()` 6356–6369; `chipsTipo()` 6352 |
| Últimos logros y campeones | actividad y ganadores | `.rk-feed .rk-ev .rk-ev-av .rk-ev-badge .rk-ev-c .rk-ev-tit .rk-ev-tipo .rk-ev-txt .rk-ev-pie .rk-camp-i .rk-camp-c .rk-camp-tr` | 939–964 | `vistaRanking()` 6392–6400 |
| Cómo sumar | 3 pasos | `.rk-pasos .rk-paso .rk-paso-n .rk-emojis .rk-emo .rk-bases` | 965–974 | `vistaRanking()` 6422–6430 |
| Estado de conexión | Discord o ejemplo | `.rk-sync (.vivo .aviso) .punto` | 864–869 | `estadoRanking()` 6380 |
| **Avatares** | iniciales o foto | `.avatar (.peq)`; `.rk-av` (colores por `--a1/--a2`) | 107–108, 1023–1024; 885–886 | HTML 1513; `avatarR()` 6346–6350 |
| Alumnos | lista del administrador | `.al-buscar .al-grid .al-card .al-top .al-quien .al-nom .al-sub .al-stats .al-cta .al-plan .al-pend .al-ok .admin-carga .rev-cab .rev-com .rev-acc .rev-estado` | 1029–1061, 1269–1270, 1487–1488 | `vistaAlumnos()` 6500–6520; revisión: `entrarRevision()` 6453 y las vistas del diario con `REV` |
| **Pantalla de entrada** | cargando, login, sin acceso, error | `.entrada .aurora .entrada-caja .entrada-marca .entrada-nota .entrada-error .boton-dc .entrada-carga` | 1004–1022 | HTML 1526; `pantallaEntrada()` 6695–6705; `arrancar()` 6715–6731 |
| **Aurora** | manchas de luz en movimiento | `.aurora span` ×3 | 622–629, 677 | en cada hero, en `.tcard-ex` y en la entrada |
| **Paleta** | acciones rápidas (Ctrl+K) | `.paleta-capa .paleta .paleta-cab #paleta-in #paleta-lista .pal-grupo .pal-op (.act) .pal-vacio .paleta-pie` | 688–702 | HTML 1588–1595; `accionesPaleta()` 6136; `pintarPaleta()` 6179 |
| **Aviso (toast)** | confirmaciones, 2,8 s | `.toast` | 540–542, 779 | HTML 1613; `toast()` 5300 |
| Confeti | al aprobar | `.confeti` (canvas) | 543 | `confeti()` 5312–5324 |

### La curva de resultados, en detalle

- Es **SVG**, no canvas. `pintarCurva()` (5569) lo escribe como cadena dentro de `#curva`: `viewBox="0 0 W H"`, con W = ancho real del contenedor (mínimo 280) y H = 220 si W < 520, si no 270. Un `ResizeObserver` (4750) la vuelve a pintar si el ancho cambia más de 2px.
- Capas: líneas de rejilla y de cero, rótulos del eje (`.h-eje`), área con `#gradCurva`, línea (`.h-linea`, `pathLength="1"`, se traza con la animación `trazar`, con el filtro `#brillo`), un círculo por operación (`.h-pt p|n`), punto final con pulso, cursor (`g.h-cursor` con línea y círculo), y un `rect.h-captura` transparente encima. El globo es un `div.tip` hermano del SVG.
- Interacción (5593–5601): `pointermove` calcula la operación más cercana con `getBoundingClientRect()` y llama a `mostrarPunto(i)`, que mueve el cursor y coloca el globo con `style.left/top` (y `style.transform` si no cabe arriba); `pointerleave` y `blur` lo ocultan; `click` abre la operación; con el foco, flechas izquierda/derecha recorren e Intro abre. Lleva `tabindex="0"`, `role="img"` y un `aria-label` con el resumen.
- Otros gráficos: columnas = `div` con CSS (`barrasV`), anillos y radar = SVG, capturas de ejemplo = `canvas` convertido a JPEG (`capturaEjemplo()` 5355–5392), confeti = `canvas`.

---

## 3. Ganchos que el JS necesita (no renombrar ni quitar)

`$`/`$$` son `querySelector`/`querySelectorAll` (1618–1619). El JS muestra y oculta con el atributo `hidden`, que depende de `[hidden]{display:none!important}` (66).

### 3.1 Ids

**En el HTML fijo (1494–1614):**

| Id | Línea de uso |
|---|---|
| `vista` | 1620 (contenedor de todas las pantallas) |
| `lat-widgets` | 5454 |
| `alumno-av`, `alumno-nombre`, `alumno-sub`, `nav-alumnos` | 6710–6713 |
| `kbd-k` | 6691 |
| `bs-fecha`, `bs-hora`, `bs-sesion` | 6228–6230 |
| `bs-modo` | 6162, 6235 |
| `entrada`, `entrada-caja` | 6696, 6706 (`entrada-t` lo usa `aria-labelledby`) |
| `capa` | 5813, 5818, 6544 |
| `cajon` | 4792, 5173, 5440, 5809, 5813, 5818, 6171, 6619 |
| `t-nueva`, `cajon-desc`, `btn-guardar-op` | 5176–5178 |
| `form-op` | 6659 (el botón guardar lo enlaza con `form="form-op"`) |
| `form-error` | 5409, 5814, 6660, 6665 |
| `atas-res` | 5188, 5195 |
| `f-fecha`, `f-hora`, `f-ct`, `f-stop`, `f-imp`, `f-riesgo`, `f-nota` | 4724–4725, 5180–5198, 5773, 5783–5787, 5795–5796, 6575–6576, 6660, 6677 |
| `f-inst`, `f-setup`, `f-errores` (contenedores que rellena el JS) | 5776–5778 |
| `f-r`, `pie-res`, `calculo` | 5802–5807 |
| `c-ct`, `c-setup`, `c-imp`, `c-stop`, `c-riesgo`, `c-cap` (campo que se marca como no válido) | 5792–5797 → 6670; 5417 |
| `zona-cap`, `f-cap` | 5423, 6649; 6577, 6653 |
| `visor`, `visor-img`, `visor-t` | 4792, 5432–5439, 6171, 6545, 6618 |
| `paleta`, `paleta-in`, `paleta-lista` | 4792, 6166–6184, 6546, 6613–6614, 6683 |
| `imp`, `imp-cuerpo`, `imp-pie`, `imp-file` | 4787–4800, 6547, 6556–6557, 6615, 6654 |
| `rut`, `rut-t`, `rut-sub`, `rut-cuerpo` | 4145–4151, 6548, 6616 |
| `toast` | 5300 |
| `gradAnillo`, `gradMarca` (SVG, 1497–1498) | los usa el CSS: 407, 671–672, 770 |

**En plantillas del JS (el JS los crea y luego los busca):**

| Id | Se crea | Se busca |
|---|---|---|
| `hero-neto`, `hero-etq`, `hero-sub`, `hero-chips`, `curva`, `ticker-caja` | 5467–5476 | 4732, 5521–5524, 5535, 4749/5570/5605/5616, 6116, 6572 |
| `avisos-diario`, `hoy-fila`, `kpis`, `insights`, `calendario`, `cal-mes`, `mapa`, `setups`, `comentarios`, `errores`, `panel-ops`, `ops-meta`, `filtros`, `aviso-ejemplo`, `tabla`, `t-ops` | 5478–5496 | 4763, 4099, 5622, 5544, 5640, 5642, 5662, 5685, 5695, 4121, 5758, 5725, 5708, 5703, 5723, 6586 |
| `k-media` | 5632 | 5637 |
| `obj-in`, `form-obj` | 5531 | 6139, 6249–6252, 6568, 6617 |
| `fila-<id>`, `det-<id>`, `com-<id>`, `com-est-<id>` | 5730, 5744, 5749 | 5765, 6475 |
| `est`, `tip-g`, `est-errores` | 4914, 4982 | 4917, 4712–4713, 4986, 4985 |
| `form-plan`, `pl-estado`, `pl-perdida`, `pl-riesgo`, `pl-contratos`, `pl-ops`, `pl-racha`, `pl-objetivo`, `pl-desde`, `pl-hasta`, `pl-stop`, `pl-registro`, `pl-texto` | 5006–5034 | 5047–5064 |
| `form-cuenta`, `ct-estado`, `ct-firma`, `ct-tamano`, `ct-dd`, `ct-tipo`, `ct-limite`, `ct-obj`, `ct-desde`, `ct-fase`, `ct-bloqueo` | 4173–4185 | 5050, 4190–4192 |
| `cumple`, `ia-cuerpo` | 5038–5039 | 5067, 5127 |
| `imp-zona`, `imp-tz` | 4807, 4809 | 4812, 6656 |
| `rut-nota`, `rut-mejora`, `rut-nota2` | 4139–4143 | 4154–4155 |
| `f-pct` | 4270, 5923 | 4310, 4312 |
| `reloj`, `reloj-t` | 5962 | 6093–6096 |
| `rk-d`, `rk-h`, `rk-m`, `rk-s`, `rk-lista` | 6409, 6416 | 6433–6437, 6608 |
| `al-buscar` | 6501 | 6523 |
| `pal-<i>` | 6183 | 6185 |
| `gradCurva`, `brillo` | 5579–5580 | dentro del mismo SVG |

Ids de las etiquetas (`t-*`, `l-cap`, `l-r`, `stop-ayuda`, `riesgo-ayuda`, `rk-premio`, `r-tit`…) los usan `aria-labelledby`/`aria-describedby` y `for`: si se quitan, se rompe la accesibilidad, no el JS.

### 3.2 Clases que el JS añade, quita o consulta

| Clase | Qué hace el JS | Línea |
|---|---|---|
| `invalido` (en `.campo`) | añade al validar; quita al escribir | 5417, 5814, 6660, 6669–6670 |
| `campo` | `closest('.campo')` y `$$('.campo.invalido')` | 5814, 6660, 6669 |
| `arrastrando` (en `.zona`) | al arrastrar un archivo encima | 4813–4815, 6650–6652 |
| `atas` (en `#cajon`) | modo completar operación importada | 5175 |
| `destello` (en `tr.op`) | resalta la fila a la que se salta | 5767 |
| `poco` (en `#reloj`) | quedan menos de 2 minutos | 5962, 6095 |
| `vt-modo` (en `<html>`) | durante el cambio de tema | 6243–6246 |
| `kcard`, `tcard`, `panel` | `closest()` para la luz y la inclinación | 6196, 6200, 6209 |
| `hero` | `closest()` para la luz | 6204 |
| `bv-col` | `closest()` para el globo de las columnas | 4988–4990 |
| `pal-op` | `closest()` al pulsar una acción de la paleta | 6549 |
| `h-cursor`, `tip` (dentro de `#curva`) | cursor y globo de la curva (`querySelector`, junto con `svg`, `line`, `circle`) | 5592, 5605–5609, 5617–5618 |
| `an-valor` (dentro de `#reloj`) | cambia `strokeDashoffset` cada segundo | 6096 |
| `od-tira` | aplica el `transform` final del odómetro | 5517 |
| `subida` | foco al abrir importar | 4788, 6557 |
| `chev` | foco al saltar a una operación | 5768 |
| `rk-av` (y su `img`) | quita la foto si falla la carga | 4752, 6441, 6522, 6608 |
| `al-card` | filtro del buscador de alumnos | 6523 |
| `seg-oscuro` (sus `button`) | actualiza `aria-pressed` | 5502 |
| `nav` (sus `a`) | marca `aria-current` | 6529 |
| `cab-modulo` | inserta las pestañas detrás | 4310 |
| `boton-dc` | foco en la entrada | 6700 |
| `confeti`, `sin-cap` | clases de elementos que crea el JS | 5314, 5404 |
| Clases de estado que el JS escribe con `className` | `hero-neto p\|n` (5522) · `r-caja pos\|neg` (5803) · `pos\|neg` en `#pie-res` (5804, 5807) · `sesion-viva ny\|londres\|asia\|post\|pausa\|cerrado` (6231) | |

Clases de estado que salen de las plantillas y que el CSS distingue: `pos/neg` y `p/n` (5290–5291), `g/p/z` (barras), `abierta`, `detalle`, `sel`, `hoy`, `finde`, `actual`, `prep`, `cerrada`, `sig`, `ok/ko`, `elegida/bien/mal`, `resp`, `sube`, `entra-lado`, `yo`, `p1–p3`, `libre`, `logrado`, `guardado`, `cta-<estado>`, `t-<tipo>`, `alta/media/baja`, `ej`, `vivo`, `aviso`.

### 3.3 Atributos `data-*` y otros atributos

- **`data-accion`**: todo el manejo de clics pasa por `e.target.closest('[data-accion]')` (6550) y un `switch` (6552–6610). Los 57 valores: `abandonar analizar anterior bloque borrar borrar-ejemplos borrar-no borrar-si cal-prev cal-sig cerrar-cajon cerrar-imp cerrar-rut cerrar-visor completar-sig ct-mas ct-menos detalle editar-obj editar-op elegir-captura entregar examen examen-nivel fallos filtro-dia filtro-mapa filtro-setup guardar-com guardar-rut imp-elegir imp-ok imp-otro importar insight ir ir-leccion ir-op modo nueva opcion paleta periodo plan-dia practicar quitar-captura quitar-filtro rapido repetir reset-progreso rk-periodo rutina siguiente temario test-leccion ver-captura ver-resultado`. Varios se buscan también por selector para devolver el foco (4846, 5435, 6109, 6564, 6578, 6588–6591, 6605).
- **Datos que acompañan a la acción:** `data-id` (6553–6590), `data-periodo` (5502, 6572), `data-fecha` (6564–6565, 6583), `data-setup` (6584), `data-sesion` y `data-dow` (6585), `data-f` (6586), `data-tipo` y `data-v` (6565, 6569), `data-modo` (rutina, 6559), `data-tema` (6593), `data-b` (6605–6606), `data-l` (6602, 6604), `data-n` (6603), `data-i` (6549, 6596), `data-pos` (6595, 6109), `data-p` (6608).
- **Otros:** `data-ruta` en los enlaces de `.nav` (6529) · `data-cap` en `img` (capturas que se cargan después, 5401–5402) · `data-tip` en `.bv-col` (4987) · `data-d` en `.od-tira` (5517) · `data-nombre` en `.al-card` (6523) · `data-cuenta` en casillas del importador (6657) · `data-atas="ocultar"` (lo usa el CSS, 1097) · `data-modo` en `<html>` (1626, 6162, 6235, 6239–6240).
- **`name` de los campos** (se leen con `input[name="…"]:checked`): `f-sesion`, `f-inst`, `f-dir`, `f-res`, `f-setup`, `f-err` (4724, 5171, 5180–5184, 5198–5199, 5782–5788, 5815, 6677) · `rut-check`, `rut-sueno`, `rut-animo`, `rut-disc` (4153–4155) · `pl-dia`, `pl-ins`, `pl-set` (5054–5058).
- **`hidden`**: lo cambia el JS en `#entrada`, `#capa`, `#cajon`, `#visor`, `#paleta`, `#imp`, `#rut`, `#toast`, `#form-error`, `#atas-res`, `#nav-alumnos`, `#avisos-diario`, `#hoy-fila`, `#ticker-caja`, `#tip-g`, `.tip`, `.al-card`.
- **ARIA con estilo o lógica:** `aria-current="page"` (navegación y pestañas: 86–89, 603–605, 1069; 6529), `aria-pressed` (`.seg-*`, `.ruta-b`: 171, 840–852, 911, 1143; 5502, 6608), `aria-expanded` en `.chev` (318), `[open]` en `details.niv` y `details.inf` (1315, 1332, 1238, 1246), `aria-hidden` en el grupo duplicado de la cinta (832), `:disabled` en `.opcion` (488–489).
- **Selectores de estructura:** `#cajon button, #cajon input:not([hidden]), #cajon textarea` (trampa de foco, 5809) · `#rut input, #rut textarea` (4149) · `img[data-cap]` y `closest('button')` (5401–5404) · `input:not([hidden]),button` dentro del campo no válido (6670).

### 3.4 Variables CSS y estilos que escribe el JS

| Qué | Dónde se escribe | Dónde se usa |
|---|---|---|
| `--mx`, `--my` (px, sobre `.kcard/.tcard/.panel`) | 6199, 6210 | borde y halo que siguen al ratón: 659–662 |
| `--rx`, `--ry` (grados, sobre `.kcard/.tcard`) | 6201, 6210 | inclinación 3D: 665–666 |
| `--hx`, `--hy` (px, sobre `.hero`) | 6205 | luz del hero: 631 |
| `--c` (perímetro del anillo) y `stroke-dashoffset` | 5310 | animación `anillo`: 215–217 |
| `--n` (número de columnas) | 4901 | 1163, 1176 |
| `--dur` (duración de la cinta) | 6121 | 644 |
| `--a1`, `--a2` (colores del avatar) | 6349 | 885 |
| `--d` (retraso del podio) | 6389–6390 | 891, 898 |
| `--medalla`, `--alto` | solo CSS (888–890, 1161, 1292) | |
| `document.body.style.overflow` (`hidden`/vacío) | 4148, 4151, 4787, 4792, 5434, 5440, 5813, 5818, 6166, 6171, 6696, 6706 | bloquea el fondo con cajón, visor, paleta, diálogos y entrada |
| `style.left/top/transform` del globo | 4712 (`#tip-g`, coordenadas de ventana), 5612–5613 (`.tip`) | |
| `style.transform` del odómetro | 5517 | 728 |
| `style.strokeDashoffset` del reloj | 6096 | 456 |

**Estilos en línea que salen de las plantillas** (un rediseño que cambie estos componentes tiene que tocar el JS):

- `width:N%` en barras: tarjetas de hoy 4107–4108 · errores 4125 · cuenta 4167 · nivel 4263 · barra lateral 5455 · objetivo 5532 · setups 5691 · bloques y temas 5911, 5919 · progreso del test 6004 · ranking 6364.
- `flex:N` del reparto ganado/perdido: 5630.
- `animation-delay` escalonado: 4261, 4905, 4921, 5558, 5629–5635, 5691, 5908, 5916, 5935, 6361, 6418–6419, 6510, 6512.
- `background:color-mix(in srgb, var(--compra|--venta) N%, var(--fondo))`: celdas del calendario 5654, del mapa 5672 y su leyenda 5676.
- Columnas: `top/bottom/height` en % y `calc()` 4901–4905.
- `transition-delay` por dígito del odómetro: 5513.
- Atributos SVG calculados: curva 5578–5589, anillo 5310, radar 5889–5897, figuras 5823–5872.
- Colores fijos dentro del JS: confeti 5316, capturas de ejemplo 5360–5390, avatares `AV_COL` 6274.

### 3.5 Teclado y eventos globales

Clic delegado en `document` (6543) · teclas (6612–6643): Ctrl/⌘+K paleta, Esc cierra, Tab atrapado en cajón, paleta y visor, `N` nueva operación, A/B/C o 1/2/3 e Intro y flechas en los tests · `paste` de imagen en el cajón (6644) · `hashchange` (6682) con rutas `#diario`, `#diario/estadisticas`, `#diario/plan`, `#formacion`, `#formacion/libre`, `#formacion/l/<id>`, `#ranking`, `#alumnos`, `#alumnos/<id>[/estadisticas|/plan]` (6527) · `pointermove`/`pointerout` (6191, 6208) · `scroll` (4713) · `pagehide` (5251) · `submit` de `#form-obj`, `#form-plan`, `#form-cuenta`, `#form-op`.

---

## 4. Efectos y movimiento

### 4.1 Animaciones (`@keyframes` → dónde se usa)

| Animación | Línea | Se usa en | Tipo |
|---|---|---|---|
| `entra` | 116 | `.entra` (115; casi todos los bloques al pintarse, con retraso en línea), `.det-grid` 323, `.previa` 387, `.entrada-caja` 1006 | entrada: sube 10px y aparece |
| `aparecer` | 193 | `.h-area` 183, `.h-pt` 185, `.racha-pts span` 225, `.capa` 336, `.visor` 394, `.paleta-capa` 690, `.imp-capa` 1109 | opacidad |
| `trazar` | 192 | `.h-linea` 184 | la curva se dibuja en 1,3 s |
| `anillo` | 217 | `.an-valor` 215 | el anillo se llena desde `--c` |
| `crecer` | 223 | `.split span` 219, `.pista-s span` 281, `.mini-barra span` 435, `.obj-barra span` 737, `.rk-barra span` 932 | barras que crecen desde la izquierda |
| `subir-b` | 1174 | `.bv-barra` 1169 | columnas que crecen |
| `destello` | 314 | `tr.destello` 313 | resalta la fila |
| `deslizar` | 339 | `.cajon` 337 | el cajón entra desde la derecha |
| `zoom` | 401 | `.visor img` 400, `.paleta` 691, `.imp` 1110 | escala de 0,94 a 1 |
| `toast` | 542 | `.toast` 540 | sube con rebote |
| `latir` | 454 | `.racha.sube` 453 | la racha late al subir |
| `pop` | 493 | `.opcion .ico` 492 | icono de acierto o fallo |
| `brillo-ok` | 502 | `.opcion.bien` 496 | onda verde |
| `sacudir` | 503 | `.opcion.mal` 499 | sacudida |
| `lado` | 510 | `.lado.entra-lado` 509 | la explicación entra de lado |
| `sellar` | 526 | `.veredicto` 524 | el sello cae |
| `radar-in` | 773 | `.rd-g` 772 | el radar se abre |
| `rk-sube`, `rk-aparece` | 903–904 | bases y avatares del podio 898, 891 (retraso `--d`) | el podio sube |
| `carga` | 1022 | `.entrada-carga span` 1019 | puntos de carga (sin fin) |
| `girar` | 1233 | `.ia-orbe` 1232 | la IA analizando (sin fin) |
| `brillo-logo` | 602 | `.marca-agx` 601 | brillo que recorre el logo (sin fin, 7 s) |
| `deriva1/2/3` | 627–629 | `.aurora span` 624–626, `.lateral::after` 600 | aurora (sin fin, 18–27 s) |
| `pulso` | 638 | `.h-pulso` 637 | onda en el último punto (sin fin) |
| `cinta` | 647 | `.tk-pista` 644 | cinta (sin fin; se para al pasar o con el foco, 646) |
| `barrido` | 682 | `.q-barra span::after` 681 | brillo en el progreso (sin fin) |
| `latido` | 720 | `.sesion-viva .punto::after` 719, `.rk-sync.vivo .punto::after` 869 | punto en vivo (sin fin) |
| `ruta-brillo` | 842 | `.ruta-b[aria-pressed="true"]::before` 841 | bloque activo (sin fin) |
| `rk-flota` | 905 | `.rk-corona` 894 | corona que flota (sin fin) |

Movimiento hecho en JS: contador que sube (`contar()` 5301, 1 s con `requestAnimationFrame`), odómetro (5507; transición de 1,25 s por dígito, 728), confeti (5312; 160 piezas, 2,2 s), temporizador (6088) y cuenta atrás del ranking (6432), una vez por segundo.

### 4.2 Transiciones de vista

- `transicion(fn)` (6126) envuelve el repintado en `document.startViewTransition` si existe y no hay movimiento reducido: al cambiar de ruta (6682), al empezar un test (6071), al salir (6600) y al cambiar de bloque (6605). Duración 0,35 s (818). No hay nombres de transición por elemento: es un fundido de toda la página.
- El cambio de tema usa otra transición con un círculo (`clipPath` animado sobre `::view-transition-new(root)`, 6245).
- Al entrar, cada bloque lleva `.entra` con `animation-delay` en línea: el escalonado sale del JS.

### 4.3 Luz que sigue al ratón e inclinación 3D (JS 6189–6211, CSS 658–670)

- Un único `pointermove` en `document`, solo con ratón (6192) y limitado a un fotograma (6194). Busca el `.kcard`, `.tcard` o `.panel` bajo el puntero y le escribe `--mx/--my` (6199). El CSS los usa en dos sitios: el **borde** (un degradado radial pintado en `border-box` bajo un fondo liso en `padding-box`, 659–660) y un **halo** en `::before` (662–663).
- En `.kcard` y `.tcard` escribe además `--rx/--ry`, hasta ±3,5° (6201). El CSS inclina la propia tarjeta: `transform:perspective(900px) rotateX(var(--rx)) rotateY(var(--ry)) translateY(-4px)` (665–666). Los hijos van planos: no hay `preserve-3d` ni capas en Z.
- En `.hero` escribe `--hx/--hy` (6205): una luz radial en `.hero::after` (631), encima del ruido.
- `pointerout` devuelve los valores a reposo (6208–6211).
- Al pasar, el icono gira −6° y crece (`.kicono`, `.ticono`, 424, 670), el botón desplaza su degradado y cruza un destello (119–122), las miniaturas crecen (320).

### 4.4 Qué se desactiva con `prefers-reduced-motion`

- CSS: todas las animaciones y transiciones a 0,01 ms y la curva ya trazada (588–591); una sola repetición (828); sin aurora, sin brillo del logo, sin pulso, sin barrido (829); la cinta se para, se puede desplazar a mano y se oculta el grupo duplicado (830–832); **sin inclinación** de tarjetas (833); sin latido (795), sin brillo de bloque (860), sin corona flotante (999), sin orbe ni columnas animadas (1296).
- JS (`REDUCIR`, 1625): contador directo (5304), sin confeti (5313), odómetro en texto plano (5510), desplazamientos sin suavizado (5758, 5766, 6100, 6670), sin transiciones de vista (6126, 6241), sin inclinación (6200).

---

## 5. Oportunidades para 3D y riesgos

### 5.1 Oportunidades, pantalla por pantalla (objetos que informan)

**Diario · Resumen**
- **Curva de resultados** (hero): es el objeto principal. Puede ser una cinta o un relieve con profundidad, con cada operación como un hito cuyo tamaño dependa del importe; el último punto ya «late». Hay que conservar lo que hace hoy: recorrido con ratón y flechas, globo y salto a la operación.
- **Objetivo del mes**: hoy es una barra de 6px. Un depósito o un anillo con volumen que se llena, con el estado «conseguido» (`.obj.logrado`) como cambio de material.
- **Calendario** y **mapa de calor**: hoy el importe va en la intensidad del color. En relieve, la altura puede ser el dinero (arriba ganancia, abajo pérdida) y el color queda para el signo: se lee mejor qué días pesan.
- **KPI**: el anillo de acierto como toro; el profit factor como balanza que se inclina según ganado y perdido (el icono ya es una balanza); la racha como fichas apiladas.
- **Tarjeta de cuenta de fondeo**: el margen hasta el drawdown es una distancia. Un medidor con suelo (drawdown), pico y posición actual explica el trailing mejor que la barra.
- **Cinta**: puede ganar profundidad (fichas que pasan en perspectiva), sin perder la pausa al pasar.

**Diario · Estadísticas**
- **Columnas** por hora, por día y de reparto: prismas con base en cero. Conservar el valor en el máximo y el mínimo y el globo al pasar o con el foco.
- **Rejilla de números**: mejor plana; son 16–20 cifras para leer.

**Diario · Plan e IA**
- **Cumplimiento**: los días como fichas en una línea de tiempo, verdes o rojas, con la elegida levantada.
- **Agente de IA**: el orbe de espera (`.ia-orbe`) puede ser una esfera; la nota de 0 a 10, un dial.
- **Cuenta de fondeo**: el mismo medidor del resumen, en grande.

**Nueva operación (cajón)**
- Un **indicador de riesgo y resultado en R** que cambie al escribir (stop, contratos, importe): es el único 3D con sentido aquí. El resto del formulario, plano y rápido.

**Formación**
- **Ruta de 14 niveles**: es una escalera. Niveles como peldaños o tramos de un camino, con candados en los cerrados, el actual iluminado y el progreso de cada uno a la vista.
- **Test**: la opción elegida puede girar para mostrar acierto o fallo y dar paso a la explicación; hoy ya hay onda verde y sacudida.
- **Temporizador de examen**: un dial con volumen que cambia de color al quedar 2 minutos (`.reloj.poco`).
- **Resultado**: el sello «APTO / NO APTO» que cae sobre la tarjeta (hoy `sellar` es una escala).
- **Repaso libre**: el radar como prisma hexagonal, y los 6 bloques como columnas cuya altura es el dominio.

**Ranking**
- **Podio**: ya es casi 3D (bases de distinta altura que suben). Es el sitio natural para volumen real: bloques con profundidad, avatares encima, corona.
- **Cuenta atrás**: dígitos de paleta que giran.
- **Campeones**: trofeos con material de oro, plata y bronce.

**Entrada**
- Logo AGX con relieve y luz que sigue al puntero; la aurora como capas en profundidad.

**Mejor planos:** barra lateral, barra superior, tablas, lección (lectura larga), diálogos, paleta, avisos.

### 5.2 Riesgos

**Rendimiento en móvil**
- La página ya gasta: `backdrop-filter` en 9 sitios (336, 618, 636, 648, 690, 706, 876, 1006, 1109); 3 manchas de aurora con `filter:blur(70px)`, `mix-blend-mode:screen` y `will-change` en cada hero (623–626), más las de `.tcard-ex` y `.lateral::after` (600); ruido `feTurbulence` (632); filtro de desenfoque en la curva (5580); y 10 animaciones sin fin (4.1).
- El resumen en móvil mide unos 6.700px de alto. Cualquier lienzo 3D tiene que pararse fuera de pantalla, limitar la densidad de píxeles y respetar el movimiento reducido.
- La inclinación actual solo responde al ratón (6192): en móvil no hay efecto. Un 3D que dependa del puntero no se verá en el teléfono.

**Ciclo de vida del DOM**
- `render()` (6528) hace `vista.innerHTML = …` en cada cambio de ruta, y `pintarDatos()` (5499) repinta **todas** las secciones del resumen en cada cambio de periodo o filtro; `pintarTabla()` repinta al abrir un detalle. Un objeto 3D montado dentro de `#vista` se destruye y se crea cada vez.
- No hay ningún punto de desmontaje: solo se desconecta el `ResizeObserver` de la curva (6530) y se paran los intervalos (6532, 6099). Un rediseño con WebGL necesita montar y liberar de forma explícita (los navegadores limitan el número de contextos).
- Las transiciones de vista hacen una foto de toda la página (6126): con lienzos grandes cuesta más.

**Zonas del CSS que se rompen con transformaciones**
- Un `transform`, `perspective`, `filter` o `will-change:transform` en un antecesor convierte a ese antecesor en la referencia de los `position:fixed` que tenga dentro. Dentro de `#vista` hay dos: `#tip-g` (1178; se coloca con coordenadas de ventana, 4712) y `.fab` (569; 5497). Si `#vista`, `.contenido` o `.principal` reciben una transformación, quedan descolocados.
- Los elementos pegados dependen de que ningún antecesor tenga `overflow` distinto de visible: `.lateral` (77), `.barra-sup` (706), `.pl-pie` (1197), `.lec-lado` (1370).
- `overflow:hidden` aplana el 3D de los hijos, y lo llevan `.hero` (147), `.tcard-ex` (676), `.ruta-b` (837), `.niv` (1314), `.panel-ia` (1222), `.mini-cap` y `.det-cap`. Para sacar un objeto del hero hay que replantear el recorte, que hoy contiene la aurora y la rejilla.
- La inclinación se aplica a la propia tarjeta y los ángulos se calculan con el `getBoundingClientRect()` de la tarjeta ya inclinada (6198): con ±3,5° no se nota; con ángulos mayores temblará.
- La curva convierte la posición del puntero a datos suponiendo un SVG sin rotar (5593, 5611). Si se inclina el hero, esa cuenta falla.

**Trucos frágiles**
- **Borde luminoso** (659–660): `background: linear-gradient(var(--fondo),var(--fondo)) padding-box, radial-gradient(…) border-box`. Solo funciona con `--fondo` opaco. Con un panel translúcido o con degradado, el borde invade el interior.
- **`color-mix(... var(--fondo))`** en calendario y mapa (5654, 5672): también da por hecho un fondo liso.
- **Odómetro** (725–730): depende de `height:1em`, `line-height:1` y `overflow:hidden` por dígito. Cambiar la fuente o el interlineado de `.hero-neto` o `#f-pct` lo descuadra.
- **Capas de reglas**: `.hero::after` nace como mancha desenfocada (152) y se redefine como luz y ruido (630–632); `.panel/.kcard/.tcard` cambian de borde en 659; `.hero-form` se define en 404, 763, 785 y 790; `.f-estado` en 413 y 764; `.seg-claro` en 908 y 1140; `.volver` en 446 y 1049; `.detalle-acc` en 331 y 1094; `.avatar` en 107 y 1023. Al tocar una, buscar todas.
- **`[hidden]{display:none!important}`** (66) y **`.cajon.atas [data-atas="ocultar"]{display:none!important}`** (1097): cualquier `display` con `!important` en un rediseño rompe el mostrar y ocultar.
- Los degradados `#gradAnillo` y `#gradMarca` viven en un SVG al principio del `body` (1495–1500): si se quita, los anillos se quedan sin trazo.

**Legibilidad**
- Hero y barra lateral son oscuros en los dos temas (variables `--hero-*` y `--lateral-*`); los paneles sí cambian. Un objeto 3D en un panel necesita dos juegos de materiales; en el hero, uno.
- Las cifras son la información: verde y rojo con signo, `tabular-nums`. Nada de texto dentro de texturas ni cifras en perspectiva.
- Los gráficos llevan texto alternativo (`role="img"` con `aria-label` en curva, radar, columnas, figuras, racha) y la curva y las columnas se usan con teclado. Un sustituto en lienzo tiene que conservar las dos cosas.
- Los atajos de los tests (A/B/C, Intro) y la trampa de foco del cajón dependen de botones reales en el DOM.

### 5.3 Rarezas vistas en el diseño actual (sin corregir)

1. **Móvil, repaso de fallos:** `.fallo` (532) no pasa a una columna; la pregunta queda en una tira de una palabra por línea (`m-oscuro-36`, `m-oscuro-39`).
2. **Móvil, detalle de operación:** va dentro de la tabla de 920px (308, 312); la nota y el comentario se cortan y hay que desplazar en horizontal (`m-oscuro-08`).
3. **Cajón, error de validación:** `#form-error` está al final del formulario (1573) y al fallar se centra el campo (6670): se ve el campo en rojo pero no el mensaje (`d-claro-12`).
4. **Móvil y tableta:** `.alumno` se oculta (566): no se ve el nombre ni el enlace «Salir». Solo se puede cerrar sesión desde la paleta (6161).
5. **Móvil, plan:** `.pl-pie` (pegado abajo, 1197) también se usa en el formulario de la cuenta (4185); «Guardar cuenta» flota sobre los campos (`m-oscuro-07…-arriba`).
6. **Móvil, vistas cortas:** la cabecera se estira en vertical cuando el contenido no llena la pantalla (`.app` con `min-height:100vh`; `m-oscuro-62`).
7. **Modo oscuro:** el texto pequeño del chip elegido (382) queda violeta claro sobre violeta, casi ilegible (`d-oscuro-11`); `.cta-aviso .cta-etq` (1435) tiene colores claros fijos.
8. **Revisión del administrador:** la fila de hoy queda con una sola tarjeta y media fila vacía (`d-claro-81`); el botón «Cambiar» del objetivo se pinta pero no hace nada (6551).
9. **Transiciones de vista:** `transicion()` (6126) no recoge el rechazo de la promesa; si el navegador corta la transición, sale un error sin capturar en consola.
10. `ICO.sol` e `ICO.luna` se definen dos veces (1659–1660 y 4091–4092).
11. **Cifra del hero:** el resplandor del neto (`text-shadow`, 634–635) se recorta en cada dígito del odómetro (`.od-col{overflow:hidden}`, 727): detrás de los números se ven rectángulos más claros, y no detrás del signo, el punto ni el `$` (`d-claro-01…-arriba`).
12. **Importar en móvil:** al leer el archivo, el foco va al botón «Importar» y el diálogo queda desplazado al final; el resumen de lo que se va a importar no se ve sin subir (`m-oscuro-18`).

---

## 6. Cómo se capturó el estado actual

- `tools/agx-shots.cjs` genera `base/`: 225 capturas y 29 hojas de contacto (`contacto-<tamaño>-<tema>-N.png`), más `capturas.json` con el tamaño de cada una.
- Juego completo en `d-claro` (1440×900) y `m-oscuro` (390×844 a 2x). Vistas principales también en `d-oscuro`, `t-claro` (820×1180), `m-claro` y `n-oscuro` (360×740 a 2x).
- Números: 01–07 diario · 08–16 operación, cajón, aviso y cuenta · 17–21 importar · 22–26 rutina y paleta · 30–42 formación y tests · 50–51 ranking · 60–65 alumno en modo servidor · 70–74 entrada · 80–83 administrador.
- Reloj fijo en el viernes 30 de octubre de 2026 a las 16:30 de Madrid. Las preguntas no se barajan: la respuesta correcta es siempre la A.
- Las páginas completas se capturan con la ventana tan alta como la página: la barra lateral llega hasta abajo y el botón flotante queda al final. La composición real del primer pantallazo está en las capturas `-arriba`.
