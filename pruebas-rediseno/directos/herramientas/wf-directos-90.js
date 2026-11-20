export const meta = {
  name: 'agx-directos-90',
  description: 'Tests de los directos: ampliar de 45 a 90 clips (45 preguntas nuevas, clips aligerados y portadas nítidas dentro de la web), revisarlo con tres revisores independientes y corregirlo (rama tests-directos, sin publicar)',
  phases: [
    { title: 'Integración', detail: 'los 90 clips ligeros y sus portadas al repositorio, las 90 preguntas en la web, pruebas y capturas' },
    { title: 'Revisión', detail: 'tres revisores independientes: datos y guardado, uso en móvil y ordenador con 90 clips, y contenido cruzado de las 90 preguntas' },
    { title: 'Arreglos', detail: 'se confirma cada hallazgo, se arregla y se vuelve a verificar toda la web' },
  ],
}

const S = '/tmp/claude-0/-home-user-diario-trading-app/ec1a6cef-642a-5a40-a283-3eb03b91ed9b/scratchpad'
const AGX = S + '/agx'
const TOOLS = AGX + '/tools'
const REPO = '/home/user/agx-web'
const CL = '/tmp/claude-0/-home-user/ec1a6cef-642a-5a40-a283-3eb03b91ed9b/scratchpad/clips'
const A = args || {}

const WEB = `# QUÉ ES ESTO
AGX («Método AGX») es una academia española de trading de futuros con Order Flow (NQ, ATAS: footprint, clusters, imbalances, big trades, heatmap, delta, VWAP, perfil de volumen, Renko y el «Patrón Gonzi», setup del mentor, Alex; nunca «gonci»). Su web de alumnos es agxcommunity.com (Diario de trading, Formación con lecciones y tests, Ranking, panel de Alumnos).
ES PRODUCCIÓN, con alumnos reales, sobre todo en el móvil. Lo publicado sale de la rama main de ${REPO} (commit ecdabe3). Netlify publica TODO lo que hay en el repositorio (publish = "."). El grueso es UN archivo, index.html (~870 KB): CSS en <style> al principio, esqueleto HTML y un <script> que pinta las vistas con cadenas de texto. El temario (miles de líneas: «const BLOQUES=», «const PREGUNTAS=») no hace falta leerlo entero.

En la rama tests-directos (NO publicada) ya está construido y revisado el apartado nuevo de Formación «Tests de los directos»: cada test es UNA pregunta ligada a un clip corto de un directo de Alex; el alumno responde y ve si ha acertado, el clip (alojado en la propia web, carpeta clips/) y la explicación. El título del clip no se enseña hasta responder. Hoy tiene 45 clips. Cómo está hecho (rutas #formacion/directos y #formacion/directos/<número>, «const DIRECTOS=», estado state.directos = { <id>: { o, ok, f } }, vistas, CSS, pruebas, decisiones y hallazgos de la revisión con su estado): LÉELO en el cuaderno ${AGX}/directos.md y en git -C ${REPO} log --oneline origin/main..tests-directos.

Documentos y herramientas:
- ${AGX}/progreso.md — el sistema visual 3D (variables, recetas de placa / tecla / hundido / pista). El apartado usa ese sistema.
- ${TOOLS}/agx-e2e.cjs — prueba de funcionamiento de toda la web (1.054 comprobaciones). ${TOOLS}/agx-e2e-directos.cjs — prueba del apartado nuevo. ${TOOLS}/agx-shots.cjs — capturas. ${TOOLS}/agx-verificar.sh <etiqueta> [solo-prueba|solo-capturas] ejecuta la prueba antigua y las capturas contra http://localhost:4400/ (sirve ${REPO}; si no responde lo arranca). La prueba nueva: NODE_PATH=$(npm root -g) BASE=http://localhost:4400/ node ${TOOLS}/agx-e2e-directos.cjs. La prueba antigua tiene una carrera conocida en «Diario · escritura … Mayús+Tab»: si falla solo eso una vez, repite antes de buscar causa.
- En local la web arranca en «modo ejemplo» (datos de octubre de 2026, localStorage «agx-alumnos-v4»). El «modo servidor simulado» (host falso https://demo-agx.netlify.app/ con /api/* simulado) está montado en las pruebas: cópialo de ahí. NUNCA hagas peticiones reales a agxcommunity.com.
- Playwright + Chromium globales: NODE_PATH=$(npm root -g) node tu-script.cjs. Este Chromium no trae H.264/AAC: NO puede reproducir los clips; se comprueba todo menos la reproducción.
- Los «sleep N» sueltos en primer plano están bloqueados: usa bucles until o comandos con timeout amplio. Lee las capturas con Read (PNG).

# LO QUE CAMBIA AHORA: DE 45 A 90 CLIPS
El mentor ha subido 45 clips más. Material preparado (solo lectura):
- ${CL}/sitio2/clips/ — LOS 90 clips definitivos <id>.mp4 y sus 90 portadas <id>.jpg. Son versiones MÁS LIGERAS de los mismos vídeos (H.264 High + AAC mono, misma imagen y duración, arranque rápido; 262 MB en total frente a 508; el mayor pesa 6,4 MB) y portadas nuevas de 1280 px (antes 640, se veían borrosas). Los nombres ya llevan «gonzi» (nunca «gonci»). SUSTITUYEN a todo lo que hay hoy en clips/ del repositorio (que eran los 45 originales pesados y portadas de 640).
- Preguntas del primer lote (45, ya revisadas y corregidas): ${CL}/preguntas-final.json, que sale de ${CL}/final/{C,E,G,P}.json con: python3 -I ${CL}/herramientas/validar.py ${CL}/final. OJO: lo que manda para estas 45 es lo que YA está en «const DIRECTOS=» de la rama (lleva las correcciones de la revisión y los id con «gonzi»): no pierdas ninguna corrección.
- Preguntas del segundo lote (45 nuevas, redactadas con el nombre del clip y su transcripción, examinadas a ciegas, contrastadas y corregidas): ${CL}/lote2/final/{C1,C2,EG,P}.json → se unen con: python3 -I ${CL}/herramientas/validar2.py (tiene que dar OK con 45) → ${CL}/lote2/preguntas-final.json, con la misma forma que el primer lote (id, cat, tema, titulo, pregunta, opciones[4], correcta, explicacion, clave, seg, ancho, alto). En la web el id de cada clip es el nombre del archivo con «gonci» cambiado por «gonzi» (igual que en ${CL}/sitio2/clips/).
- Transcripción de cada clip: ${CL}/transcripciones/<nombre original, con gonci>.json. Vídeos originales: ${CL}/descargas/.
Con los 90: Conceptos 32, Entradas 26, Gestión 11, Psicología 21.
${A.contexto ? '\nEstado al empezar este paso: ' + A.contexto : ''}`

const REGLAS_EDICION = `# REGLAS QUE NO SE NEGOCIAN
- Trabaja SOLO en la rama tests-directos de ${REPO}. Nunca toques main ni hagas push a main (hay un seguro que lo bloquea). No abras pull requests. No toques netlify/functions/.
- No cambies la lógica, los datos, los textos ni los nombres accesibles de lo que ya existe fuera del apartado «Tests de los directos». Los alumnos tienen datos guardados SIN nada de esto: el código tiene que funcionar con un estado antiguo sin errores y sin perder nada.
- Sin librerías ni hosts externos. Sin service worker.
- Commits pequeños, en español, con el prefijo que se te indica, y push tras cada uno:
    git -C ${REPO} add -A && git -C ${REPO} commit -q -F <archivo con el mensaje> && git -C ${REPO} -c push.negotiate=true push -q -u origin tests-directos
  (si el push se corta, reinténtalo; los vídeos se suben en varios commits de ≤ 60 MB cada uno). Cada mensaje de commit termina con estas dos líneas:
Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F5ecHA7fnTQnQRWfWRyXkK
- Sigue el cuaderno ${AGX}/directos.md (añade una sección para este paso: qué has hecho, decisiones, qué queda). SI ESTÁS REANUDANDO (el cuaderno ya tiene esa sección o git log ya tiene commits con tu prefijo): no empieces de cero; lee el cuaderno, mira git log y git status, y continúa.`

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    commits: { type: 'array', items: { type: 'string' } },
    pushed: { type: 'boolean' },
    e2eAntiguo: { type: 'string', description: 'línea RESULTADO de agx-e2e.cjs sobre el último commit' },
    e2eNuevo: { type: 'string', description: 'línea RESULTADO de agx-e2e-directos.cjs sobre el último commit y cuántas comprobaciones tiene' },
    capturas: { type: 'string', description: 'carpeta de capturas de la verificación completa y problemas de captura / errores de página' },
    clipsEnRepo: { type: 'string', description: 'cuántos mp4 y jpg hay en clips/ en la rama, tamaño total, si coinciden byte a byte con sitio2 y con los id de DIRECTOS' },
    datos: { type: 'string', description: 'cómo has comprobado que las 90 preguntas de la web son las de los dos lotes (y que las 45 primeras conservan las correcciones de la revisión)' },
    cambiosDeDiseno: { type: 'string', description: 'qué has tenido que cambiar en la portada o el test para que 90 clips se usen bien, y por qué' },
    summary: { type: 'string' },
    knownIssues: { type: 'array', items: { type: 'string' } },
  },
  required: ['commits', 'pushed', 'e2eAntiguo', 'e2eNuevo', 'capturas', 'clipsEnRepo', 'datos', 'cambiosDeDiseno', 'summary', 'knownIssues'],
}

const buildPrompt = `${WEB}

${REGLAS_EDICION}

# TU TRABAJO: ampliar el apartado a los 90 clips (prefijo de commits: [D90])
0. PREPARA: git -C ${REPO} status (rama tests-directos, sin cambios pendientes; si los hay, entiende de qué son antes de seguir) y lee el cuaderno entero.
1. CLIPS: sustituye el contenido de ${REPO}/clips/ por ${CL}/sitio2/clips/ (90 mp4 + 90 jpg; mismos nombres para los 45 que ya había). Hazlo en varios commits de ≤ 60 MB con push tras cada uno. Al acabar comprueba que clips/ tiene exactamente esos 180 archivos, idénticos byte a byte a los de sitio2 (cmp), y nada más. Como nada de esto se ha publicado todavía, cambiar el contenido de un archivo con el mismo nombre no da problemas de caché.
2. DATOS: «const DIRECTOS=» con las 90 preguntas (una línea por clip, ordenadas por id). Las 45 que ya están se quedan TAL CUAL están en la rama (con sus correcciones); añade las 45 del segundo lote desde ${CL}/lote2/preguntas-final.json (pasa antes validar2.py; id con «gonzi»). Aplica a las 45 nuevas los mismos criterios de redacción que la revisión impuso a las primeras (están en el commit aa54304 y en el cuaderno: términos como en el temario —VAL, VAH, nivel mental, Order Flow—, «Patrón Gonzi», nada de «cubrir el corto», etc.) SOLO si es un cambio de término evidente; no reescribas preguntas. Deja en ${CL}/preguntas-90.json exactamente lo que queda en la web (lo usarán los revisores) y comprueba con un script que DIRECTOS y ese archivo son idénticos y que cada id tiene su mp4 y su jpg.
3. UNA SOLA LÍNEA PARA MUDAR LOS VÍDEOS: que la dirección base de clips y portadas salga de una única constante (p. ej. const CLIPS_BASE='clips/';) usada en src y poster, con un comentario que diga que para alojar los vídeos en otro sitio basta cambiarla. Nada más.
4. QUE 90 SE USEN BIEN: repasa en móvil (360 y 390), tableta y ordenador, claro y oscuro: la portada del apartado con 32/26/11/21 clips por categoría (¿se hace eterna en el móvil?, ¿se entiende el progreso por categoría?, ¿se encuentra rápido «Continuar» y lo pendiente?), «Clip NN de 90», el anillo, la banda de la ruta, la tarjeta del administrador. Si la revisión anterior ya dejó una solución para la portada larga (hallazgo B6 del cuaderno), comprueba que aguanta con 90; si no aguanta, mejórala con el sistema 3D (p. ej. categorías plegables que recuerdan su estado, o enseñar primero lo pendiente). Nada del código puede depender de que sean 45.
5. PRUEBAS: actualiza ${TOOLS}/agx-e2e-directos.cjs a 90 (total y reparto 32/26/11/21 en constantes al principio; cada clips/<id>.mp4 y .jpg existe y el servidor local lo sirve; ningún «gonci» en DIRECTOS ni en clips/; el título no aparece antes de responder en ninguno de los 90; DIRECTOS idéntico a ${CL}/preguntas-90.json; con los 90 respondidos el PUT /api/datos sigue siendo pequeño) y ${TOOLS}/agx-shots.cjs si alguna captura del apartado lo necesita. ${TOOLS}/agx-e2e.cjs tiene que seguir en RESULTADO: OK sin tocarla.
6. VERIFICACIÓN COMPLETA al final: bash ${TOOLS}/agx-verificar.sh d90 (prueba + capturas) y la prueba nueva, las dos en RESULTADO: OK sobre el último commit. MIRA las capturas del apartado (portada con 90, test, respondido) en móvil y ordenador, claro y oscuro, y corrige lo que desentone. Comprueba que las vistas que no son del apartado no han cambiado frente a ${AGX}/c/ (capturas de lo publicado) salvo la pestaña nueva de Formación y lo ya anotado en el cuaderno.
Devuelve el resultado estructurado. En summary, en lenguaje llano, qué ve el alumno ahora.`

const HALLAZGOS_SCHEMA = {
  type: 'object',
  properties: {
    lente: { type: 'string' },
    hallazgos: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, titulo: { type: 'string' }, donde: { type: 'string' },
      gravedad: { type: 'string', enum: ['alta', 'media', 'baja'] },
      evidencia: { type: 'string' }, comoReproducir: { type: 'string' }, propuesta: { type: 'string' },
    }, required: ['id', 'titulo', 'donde', 'gravedad', 'evidencia', 'comoReproducir', 'propuesta'] } },
    cubierto: { type: 'string' },
    sinProblemas: { type: 'string' },
  },
  required: ['lente', 'hallazgos', 'cubierto', 'sinProblemas'],
}

const REGLAS_REVISOR = `# TU PAPEL: REVISOR INDEPENDIENTE (solo lectura)
No has participado en la construcción. Es la última revisión antes de publicar para alumnos reales. NO edites ${REPO}, no hagas commits, no cambies de rama (está en tests-directos), no toques ${TOOLS}/ ni ${CL}/. Tus scripts y capturas van en tu carpeta.
- Solo cuenta lo COMPROBADO por ti y reproducible (vista, tamaño, tema, pasos, ruta del script o captura). Gustos sin consecuencia no cuentan. Lo ya anotado en el cuaderno como conocido, aceptado o pendiente documentado no es un hallazgo nuevo salvo que sea peor de lo que dice. Si algo está bien, dilo en «sinProblemas». Como mucho 8 hallazgos, de más a menos importante. Unas 60 llamadas a herramientas como mucho.
- Para comparar con lo publicado: git -C ${REPO} show origin/main:index.html > tu carpeta/main.html y sírvelo en otro puerto.`

const revisores = (b) => [
  { label: 'revisión · datos y guardado', prompt: `${WEB}

${REGLAS_REVISOR}

# TU LENTE: A · Los datos de los alumnos y el riesgo para lo que ya funciona
Carpeta: ${AGX}/d90-a/
Lo hecho en este paso (según quien lo hizo): ${b.summary} · Datos: ${b.datos} · Clips: ${b.clipsEnRepo}
Revisa git -C ${REPO} diff origin/main tests-directos -- index.html netlify.toml y DEMUESTRA con Playwright (intenta ROMPERLO, no confirmarlo):
1. Fuera del apartado nuevo nada cambia: misma secuencia de acciones en main y en la rama (diario: nueva operación, editar, borrar; plan; formación: lección, test, examen; ranking) → localStorage idéntico salvo la clave «directos»; en servidor simulado, las mismas peticiones /api/* con los mismos cuerpos salvo esa clave. Hay un guion de comparación hecho en ${AGX}/ver-4/ (dif.cjs, comparar.cjs) y otro de la revisión anterior en ${AGX}/dir-a/: adáptalos en tu carpeta.
2. El guardado al responder un clip en modo servidor. Mira en el cuaderno y en el código si se quedó la unión entre dos dispositivos (dirSubir / dirUnir) o se retiró. Si está: busca cómo perder datos con ella (dos dispositivos con cambios cruzados en diario y directos; el GET de /api/datos falla, tarda más que el tope, devuelve 401, JSON roto o un estado más antiguo o vacío; responder varios clips seguidos muy rápido; responder y cerrar la pestaña; el administrador abre a un alumno mientras hay una subida en curso; un alumno con diario grande). Un solo caso en el que se pierda o se pise algo que antes no se perdía es gravedad alta. Puntos concretos que nadie ha intentado romper todavía: (a) dirBase solo se renueva al abrir y tras una subida de dirSubir, no tras los guardados normales (guardar → subirDatos): busca una secuencia en UN SOLO dispositivo (operación nueva, editar, borrar, plan, lección… mezclados con respuestas de clips, rápido y despacio) en la que la unión cambie o pierda algo; (b) subirDatos ahora sube «st || estadoPropio || state» en TODOS los guardados de la web: demuestra que para un alumno normal y para el administrador (entrar al diario de un alumno, salir, volver a lo suyo, con guardados pendientes en cada momento) cada PUT lleva el estado correcto y nunca el de otra persona; (c) el servidor responde { datos: null } a un alumno nuevo sin nada guardado y la función real mezcla los comentarios del mentor dentro de trades al leer (mira ${REPO}/netlify/functions/alumnos.mjs, solo lectura): comprueba que la unión no se confunde con eso ni con un estado remoto vacío o más pobre que el local. Si se retiró: comprueba que el guardado es exactamente el de siempre.
3. Estados antiguos: un alumno real con datos SIN la clave nueva (y con claves viejas o raras, o con «directos» con forma inesperada, o con respuestas de id que ya no existen, p. ej. los antiguos con «gonci») entra, navega a todas las vistas y al apartado, y su primer guardado conserva todo lo que tenía.
4. Datos de los 90: DIRECTOS idéntico a ${CL}/preguntas-90.json; 90 id únicos; cada uno con su clips/<id>.mp4 y .jpg en la rama (git ls-tree) e idénticos a ${CL}/sitio2/clips/; ningún archivo de más en clips/; «seg» coincide con la duración real (ffprobe) ± 1 s; correcta 0–3; ninguna opción repetida; nada de «gonci».
5. Antes de responder: ni el título ni el nombre del archivo ni el <video> están en el DOM ni se piden por red, en ninguno de los 90 (recórrelos con script); consola limpia; ninguna petición a hosts externos. netlify.toml: TOML válido, cabeceras de /clips/* y del manifiesto, sin pisar las existentes.
6. Las pruebas: ¿${TOOLS}/agx-e2e-directos.cjs caza fallos de verdad con 90? Haz 4 mutaciones en una COPIA de index.html servida en otro puerto (título a la vista antes de responder, correcta mal marcada en un clip del segundo lote, progreso sin guardar, un id que no tiene vídeo) y mira si las caza.
Devuelve lente="A".` },
  { label: 'revisión · uso con 90 clips', prompt: `${WEB}

${REGLAS_REVISOR}

# TU LENTE: B · Uso real del apartado con 90 clips
Carpeta: ${AGX}/d90-b/
Lo hecho en este paso: ${b.summary} · Cambios de diseño: ${b.cambiosDeDiseno}
Recorre el apartado como un alumno, con Playwright, capturando cada paso y MIRANDO las capturas: móvil 390×844 y 360×740 (dedo), móvil apaisado 844×390, tableta 820×1180, ordenador 1440×900 y 1280×720 (ratón y teclado); claro y oscuro.
Flujo: llegar desde Formación (pestaña, distintivo «Nuevo», banda de la ruta, acciones rápidas) → portada con 90 → empezar → responder bien → ver veredicto, clip y explicación → siguiente → responder mal → volver → abrir uno respondido → repetir → repasar fallos → responder 30, 60 y los 90 (con script) y ver la portada en cada punto.
Mira sobre todo lo que cambia con 90: ¿la portada se hace eterna en el móvil?, ¿se encuentra enseguida por dónde seguir y lo que falta en cada categoría (32 / 26 / 11 / 21)?, ¿al volver de un clip se conserva dónde estabas?, ¿«Clip 87 de 90» y los números de dos cifras caben a 360 px?, ¿el anillo y los contadores cuadran (respondidos, aciertos, fallos, por categoría)?, ¿la portada del vídeo se ve nítida ahora (1280 px)?, ¿el vídeo queda a la vista tras responder en móvil vertical y apaisado y en un portátil de 1280×720?, ¿«Siguiente clip» se alcanza?; textos largos sin cortes ni desbordes a 360 px en los clips nuevos (recorre los 90 con script midiendo desbordes y zonas táctiles < 44 px); foco de teclado visible; tema claro; coherencia con el sistema 3D y con los tests de las lecciones (${AGX}/c/ tiene capturas de lo publicado).
Devuelve lente="B".` },
  { label: 'revisión · contenido de las 90 preguntas', prompt: `${WEB}

${REGLAS_REVISOR}

# TU LENTE: C · El contenido: 90 preguntas como conjunto
Carpeta: ${AGX}/d90-c/
Eres un trader con experiencia en Order Flow que revisa el material antes de que lo vean alumnos de pago. Las 45 primeras ya pasaron una revisión de contenido pregunta a pregunta; las 45 nuevas pasaron un examen a ciegas y un contraste con su clip por grupos. Lo que NADIE ha mirado todavía es el conjunto. Datos: ${CL}/preguntas-90.json (lo que sale en la web).
1. Repeticiones entre las 90: dos tests que plantean la misma situación con la misma respuesta (el alumno siente que responde dos veces lo mismo), o un test cuyo enunciado, opciones o explicación regala la respuesta de otro. Hay clips muy parecidos (Patrón Gonzi, ahorcar el stop, no anticiparse en la apertura, call wall / put wall, operar fuera de hora, drawdown): míralos por familias.
2. Contradicciones entre tests o con el temario publicado (grep en «const PREGUNTAS=» de ${REPO}/index.html): lo que en uno es la respuesta correcta y en otro un error, sin que la situación lo justifique (p. ej. promediar, ahorcar, entrar antes de la apertura).
3. Coherencia de términos y de tono entre los dos lotes (VAL/VAH, nivel mental, Order Flow, «Patrón Gonzi», tuteo, español de España, firma de la explicación), límites de longitud, la correcta regalada por la redacción (la más larga o la única con vocabulario del método), reparto de la posición de la correcta dentro de cada categoría.
4. De las 45 NUEVAS, escoge las 12 que te parezcan más dudosas tras leerlas todas y contrástalas con su transcripción (${CL}/transcripciones/<nombre con gonci>.json; fotogramas de ${CL}/descargas/ si hace falta): ¿la correcta es lo que Alex hace o defiende en ESE clip?, ¿el título y la «clave» son fieles?, ¿la explicación inventa cifras o resultados?
Hallazgos solo de lo que haya que cambiar, con los id afectados, la prueba (frase de la transcripción o los dos textos que chocan) y la redacción completa que propones. Aquí el tope es de 12 hallazgos.
Devuelve lente="C".` },
]

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    commits: { type: 'array', items: { type: 'string' } },
    pushed: { type: 'boolean' },
    e2eAntiguo: { type: 'string' },
    e2eNuevo: { type: 'string' },
    capturas: { type: 'string' },
    resueltos: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, queSeHizo: { type: 'string' } }, required: ['id', 'queSeHizo'] } },
    descartados: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, motivo: { type: 'string' } }, required: ['id', 'motivo'] } },
    pendientes: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, motivo: { type: 'string' } }, required: ['id', 'motivo'] } },
    summary: { type: 'string' },
  },
  required: ['commits', 'pushed', 'e2eAntiguo', 'e2eNuevo', 'capturas', 'resueltos', 'descartados', 'pendientes', 'summary'],
}

const fixPrompt = (b, revs) => `${WEB}

${REGLAS_EDICION}

# TU TRABAJO: comprobar y corregir los hallazgos de la última revisión antes de publicar (prefijo de commits: [D90R])
Lo hecho en el paso anterior: ${b.summary}
Hallazgos (JSON):
${JSON.stringify(revs.map(r => ({ lente: r.lente, hallazgos: r.hallazgos })), null, 1)}
Lo que dicen que está bien (no lo estropees): ${revs.map(r => `[${r.lente}] ${r.sinProblemas}`).join(' · ')}

1. Apunta cada hallazgo en ${AGX}/directos.md con su estado. COMPRUEBA cada uno antes de tocar; descarta con motivo lo que no sea real.
2. Arregla por gravedad. Cualquier hallazgo en el que se pierdan o se pisen datos de un alumno va primero: si el arreglo no es limpio y demostrable, retira el mecanismo que lo causa y deja el guardado como está en lo publicado. Los de contenido: corrige la pregunta en «const DIRECTOS=» y en ${CL}/preguntas-90.json (tienen que quedar idénticos; comprueba con la transcripción que explicación y clave siguen cuadrando; mantén la posición de la correcta salvo que el hallazgo sea el reparto).
3. Tras cada grupo: bash ${TOOLS}/agx-verificar.sh d90r solo-prueba (RESULTADO: OK) + la prueba nueva (RESULTADO: OK) → capturas de lo tocado → commit [D90R] + push. Si la revisión demostró que la prueba nueva no caza algún fallo importante, refuérzala.
4. Al final, verificación COMPLETA (bash ${TOOLS}/agx-verificar.sh d90r: prueba + capturas; y la prueba nueva) sobre el último commit, todo subido, y el cuaderno al día con lo que queda pendiente y por qué.
Devuelve el resultado estructurado; en summary, en lenguaje llano, cómo queda el apartado y qué falta.`

phase('Integración')
const build = A.build || await agent(buildPrompt, { label: 'integración de los 90 clips', phase: 'Integración', schema: BUILD_SCHEMA })
log(build ? `Integración: ${build.commits.length} commits · antigua: ${build.e2eAntiguo.slice(0, 70)} · nueva: ${build.e2eNuevo.slice(0, 70)}` : 'Integración: no terminó (al reanudar continúa desde sus commits y su cuaderno)')
if (!build) return { build: null, revs: [], fix: null }

phase('Revisión')
const revs = (await parallel(revisores(build).map(r => () =>
  agent(r.prompt, { label: r.label, phase: 'Revisión', schema: HALLAZGOS_SCHEMA })
))).filter(Boolean)
const total = revs.reduce((n, r) => n + r.hallazgos.length, 0)
log(`Revisión: ${revs.length} de 3 revisores · ${total} hallazgos (${revs.map(r => `${r.lente}: ${r.hallazgos.length} [${r.hallazgos.filter(h => h.gravedad === 'alta').length} altas]`).join(', ')})`)
if (revs.length < 3) log('OJO: algún revisor no terminó; su parte queda sin cubrir en esta ejecución (al reanudar se repite).')

let fix = null
if (total) {
  phase('Arreglos')
  fix = await agent(fixPrompt(build, revs), { label: 'arreglos de la última revisión', phase: 'Arreglos', schema: FIX_SCHEMA })
  log(fix ? `Arreglos: ${fix.resueltos.length} resueltos, ${fix.descartados.length} descartados, ${fix.pendientes.length} pendientes` : 'Arreglos: no terminó')
}
return { build, revs, fix, revisoresCompletos: revs.length === 3 }
