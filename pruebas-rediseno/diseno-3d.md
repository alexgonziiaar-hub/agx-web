# Dirección de diseño: agxcommunity.com en 3D («Profundidad de mercado»)

Documento de dirección para rediseñar el «AGX Área de alumnos» (`/home/user/agx-web/index.html`).
Lo ha aprobado el cliente a partir de una propuesta previa hecha sobre otra app suya (capturas en
`/tmp/claude-0/-home-user-diario-trading-app/ec1a6cef-642a-5a40-a283-3eb03b91ed9b/scratchpad/design/profundidad/`:
mira `m-01-acceso`, `m-02-inicio`, `m-08-calendario`, `m-16-extracto`, `m-18-resultados`, `d-01-inicio`, `d-03-diario`).
El cliente eligió ese estilo («B · objetos 3D») y pidió literalmente: «poner la web y el diario con un diseño más óptimo, estilo 3D».
Aquel prototipo era oscuro y dorado; **esta web es morada, con tema claro y oscuro, y eso se mantiene**.

## 1. La idea

En trading, «profundidad» es literal: libro de órdenes, escalera de precios, perfil de volumen. La interfaz es una **mesa**
sobre la que se apilan **placas** como niveles de precio, se pulsan **teclas** y descansan unos pocos **objetos** que son los
datos del alumno hechos volumen. La luz viene de **arriba a la izquierda**: cara superior clara, frente medio, lateral derecho oscuro.

**El elemento memorable (uno):** el resultado del alumno convertido en relieve. La curva del hero del Diario es una cordillera
extruida con canto luminoso, y el calendario y el mapa «Cuándo operas mejor» son columnas cuya **altura es el dinero**
(suben en verde, se hunden en rojo). Todo lo demás es disciplinado y callado. Antes de terminar cada pantalla, quita un adorno.

Regla de oro: **un objeto 3D tiene que informar**. Altura, llenado o posición = un dato. Si no informa, fuera.
Las cifras nunca van en perspectiva ni sobre texturas: siempre de frente, con `tabular-nums`, verde/rojo con signo.

## 2. Niveles de profundidad (los mismos en los dos temas)

| Nivel | Qué es | Cómo se ve |
|---|---|---|
| 0 · Mesa | fondo de página | liso; nada flota |
| H · Hundido | pozos: campos de formulario, pistas de progreso, casillas, huecos de datos | sombra interior arriba, arista clara abajo |
| 1 · Placa | paneles y tarjetas de contenido | arista superior iluminada + **canto fino** inferior (3 px) del color de canto; sin sombra difusa |
| 2 · Tecla | todo lo que se pulsa: botones, pestañas, chips, radios, opciones de test, navegación | **canto grueso** (4–5 px) que cede al pulsar (`translateY` + canto que se acorta, 80–120 ms); **seleccionado = tecla que se queda abajo con la leyenda encendida** |
| 3 · Objeto | las piezas 3D que informan (lista en §4) | caras superior/frontal/lateral con los tres tonos de luz |
| 4 · Flotante | cajón, diálogos, paleta, avisos, botón flotante | los ÚNICOS con sombra difusa |

Coherencia: solo lo que se pulsa tiene canto grueso. Una placa no parece una tecla. No mezcles sombras difusas con cantos en el mismo nivel.

## 3. Materiales (marca AGX)

- Morado de marca `#5B2ED1` y su familia (`--violeta`, `--orquidea`, `--grad-marca`) son el «latón» de esta web: cara, frente y lateral
  del morado para teclas principales y objetos de marca (define `--marca-cara`, `--marca-frente`, `--marca-lado`).
- Verde ganancia y rojo pérdida también tienen sus tres caras (cara/frente/lado) para columnas y prismas. Siempre con signo además del color.
- **Tema claro:** mesa lavanda muy clara (la actual `--fondo-pagina`), placas blancas con canto lavanda-gris, pozos gris-lavanda.
  El hero y la barra lateral siguen siendo oscuros (como hoy): un solo juego de materiales ahí.
- **Tema oscuro:** mesa morado-negro, placas un punto más claras, cantos casi negros, arista superior con un hilo de luz.
- Tipografía: se mantiene **Archivo** (variable, con eje de anchura: úsalo; cifras grandes algo condensadas, 75–87 %) y
  **Bebas Neue** solo para la marca AGX y, si procede, dígitos del podio/cuenta atrás como hoy.
- Reduce los tics que el diseño actual tiene de más: degradados y auroras decorativas, brillos de borde que siguen al ratón en
  todos los paneles, desenfoques de fondo. Quita lo que no sea material o dato.

## 4. Objetos (por prioridad). Técnica: SVG y CSS; sin WebGL, sin canvas pesado, sin dependencias

### Imprescindibles
1. **Curva de resultados en relieve** (hero del Diario). Extrusión dibujada en el propio SVG (cara superior clara, frente, canto
   luminoso morado/orquídea, sombra de contacto), cada operación como hito. **No rotes ni transformes el SVG ni el hero**: la app
   convierte la posición del puntero a datos suponiendo un SVG sin rotar. Conserva TODO lo que hace hoy: recorrido con ratón y
   flechas, globo, salto a la operación, `role="img"` y `aria-label`, último punto que late.
2. **Calendario con columnas**: cada día con operaciones es una columna extruida cuya altura es proporcional al resultado
   (ganancia sube en verde; pérdida se hunde en rojo). Falso 3D con CSS (frente y lateral con pseudo-elementos o sombras duras), sin
   perspectiva real, para que el número del día y el importe se lean de frente. El día de hoy, marcado. Tiene que seguir siendo
   pulsable para filtrar y legible a 360 px.
3. **Mapa «Cuándo operas mejor»**: mismas columnas (altura = dinero) en la rejilla sesión × día.
4. **Teclas** en toda la web (nivel 2) y **placas** (nivel 1): es el 80 % de la sensación 3D. Pulsar cualquier cosa debe sentirse físico.
5. **Anillos con volumen**: acierto (KPI) y progreso de Formación como toro (trazos SVG en capas: cara, frente, sombra).
   Conserva los degradados `#gradAnillo`/`#gradMarca` del SVG inicial o sustitúyelos con cuidado.
6. **Objetivo del mes**: canal hundido que se llena; al conseguirlo (`.obj.logrado`) cambia de material.
7. **Ruta de Formación como escalera**: los 14 niveles son peldaños/placas apiladas: cerrados = hundidos y apagados con candado;
   actual = levantado e iluminado; aprobados = con su marca. El progreso de cada nivel a la vista.
8. **Test**: opciones A/B/C/D como teclas; correcta = tecla verde que se queda abajo; fallada = roja. Mantén atajos de teclado, iconos de
   acierto/fallo (no solo color) y la explicación.
9. **Podio del Ranking**: tres prismas con volumen real (cara superior, frente con el número, lateral), avatares encima, corona.
   Cuenta atrás como fichas (teclas no pulsables = placas con dígitos), sin animación de giro continua.
10. **Entrada (acceso con Discord)**: velas japonesas volumétricas (prismas con caras iluminadas, CSS 3D estático) como pieza de la
    pantalla, junto a la marca AGX en relieve. Código de referencia de las velas, la curva en relieve y el calendario isométrico en el
    prototipo: `/home/user/diario-trading-app/.claude/worktrees/wf_7f00f726-b83-2/src/components/Depth.tsx`, `src/lib/visual.ts`,
    `src/styles/objects.css` y `src/styles/base.css` (está en React; aquí es JS a pelo dentro de index.html: adapta la idea, no copies).

### Deseables (si no comprometen lo anterior)
- Estadísticas: columnas por hora/día/reparto como prismas con base en cero (conserva valores, globo y foco). La rejilla de números, plana.
- Cuenta de fondeo: medidor con suelo (drawdown), pico y posición actual.
- Cajón de nueva operación: indicador del resultado en R que crece al escribir. El resto del formulario, plano y rápido.
- Plan e IA: días de cumplimiento como fichas; nota de la IA como dial. Resultado de examen: sello «APTO / NO APTO».
- Campeones: trofeos con material oro/plata/bronce.

### Se quedan planos
Barra lateral (sus enlaces sí son teclas), barra superior, tablas, texto de las lecciones, cuerpo de diálogos, paleta, avisos.

## 5. Movimiento

- Responde a acciones: pulsar (tecla que cede), abrir, confirmar, acertar/fallar. Como mucho UNA entrada orquestada por vista (ya existe `.entra`).
- La página actual tiene 10 animaciones sin fin y manchas de aurora desenfocadas: **presupuesto nuevo: como mucho 2 animaciones
  infinitas visibles a la vez** (p. ej. el latido del último punto de la curva y el indicador de sesión en vivo), ninguna en listas.
- La inclinación con el ratón de `.kcard/.tcard` puede quedarse si es sutil (≤ 3°) o sustituirse por la pulsación. Nada depende del puntero para entenderse: en móvil no hay ratón.
- `prefers-reduced-motion: reduce`: sin inclinaciones, sin latidos, pulsaciones instantáneas. El 3D estático se queda.

## 6. Rendimiento (móvil primero: los alumnos la usan en el teléfono)

- Hoy hay `backdrop-filter` en 9 sitios, auroras con `filter: blur(70px)` + `mix-blend-mode`, ruido `feTurbulence` y un desenfoque en la curva.
  **Presupuesto: `backdrop-filter` en 3 sitios como mucho (barra superior pegada, capa del cajón/diálogos y, si acaso, la entrada) y ninguno en listas;
  fuera auroras desenfocadas en móvil; fuera el ruido.**
- Cantos con `box-shadow` duro (sin desenfoque) o pseudo-elementos: baratos. No animes `box-shadow`, `filter` ni `backdrop-filter` en scroll.
- Los objetos se repintan con `innerHTML` en cada cambio de periodo/filtro: tienen que ser HTML/SVG generados por las mismas funciones
  de pintado (sin estado propio, sin listeners que haya que liberar).
- No añadas librerías ni archivos: la web es un único `index.html`.

## 7. Lo que NO se puede romper

- **Es producción con alumnos reales.** Se trabaja solo en la rama `rediseno-3d`. Nunca `main`. Nunca push a `main`.
- Netlify publica todo lo que hay en el repositorio: no añadas archivos (ni notas, ni pruebas, ni imágenes). Solo se edita `index.html`.
- No cambies lógica, datos, textos ni nombres accesibles. Sí puedes cambiar CSS y el HTML que generan las funciones de pintado
  (plantillas en cadenas JS) cuando haga falta para el 3D, conservando los ganchos.
- **Ganchos**: todo lo listado en `mapa.md` §3 (ids, clases que el JS consulta, `data-*`, variables CSS que escribe el JS) y en la cabecera
  «GANCHOS» de `tools/agx-e2e.cjs`. La prueba (1.054 comprobaciones) tiene que seguir dando `RESULTADO: OK` **sin modificarla**.
- Trampas conocidas (`mapa.md` §5.2), resumidas: no pongas `transform`/`filter`/`perspective`/`will-change` en `#vista`, `.contenido` ni `.principal`
  (descolocan `#tip-g` y `.fab`, que son `position: fixed`); no pongas `overflow` distinto de visible en antecesores de elementos pegados
  (`.lateral`, `.barra-sup`, `.pl-pie`, `.lec-lado`); `overflow: hidden` aplana el 3D de los hijos; el odómetro de `.hero-neto`/`#f-pct` depende de
  `height: 1em; line-height: 1`; `[hidden]{display:none!important}` manda: nada de `display … !important`; el CSS está escrito por capas
  (una regla puede estar redefinida más abajo: busca todas antes de tocar una).
- Accesibilidad: contraste de texto ≥ 4,5:1 (≥ 3:1 desde 24 px) en los DOS temas, zonas táctiles ≥ 44 px en móvil, foco visible,
  `role="img"` + `aria-label` en gráficos, teclado en curva y columnas, nada cortado ni solapado a 360 px, sin desbordamiento horizontal.

## 8. De paso: rarezas del diseño actual que conviene arreglar (`mapa.md` §5.3)

Sí (son visuales): 1 (repaso de fallos en móvil), 2 (detalle de operación en móvil), 5 (`.pl-pie` flotando sobre el formulario de la cuenta),
6 (cabecera estirada en vistas cortas de móvil), 7 (chip elegido ilegible y `.cta-etq` en oscuro), 11 (resplandor recortado del odómetro).
También la 9 (promesa sin recoger en `transicion()`), que es una línea y no cambia comportamiento.
No (cambian comportamiento; se dejan anotadas): 3, 4, 8, 10, 12.

## 9. Cómo se verifica

- `bash …/agx/tools/agx-verificar.sh <etiqueta>` → prueba de funcionamiento + 225 capturas + hojas de contacto en `…/agx/<etiqueta>/`.
  Variantes: `solo-prueba`, `solo-capturas`. Para capturar solo un grupo mientras iteras: `SOLO='^d-claro-0[1-7]'` (ver cabecera de `agx-shots.cjs`).
- El «antes» está en `…/agx/base/` (mismos nombres de archivo): compara antes/después.
- Mira las capturas de verdad (hojas de contacto y sueltas, ordenador y móvil, claro y oscuro) y critica como un director de arte:
  ¿se nota el 3D?, ¿informa?, ¿se lee?, ¿hay algo cortado, solapado o desalineado?, ¿es coherente la luz?
