#!/usr/bin/env node
/*
 * agx-e2e.cjs — Prueba de funcionamiento de «AGX Área de alumnos» (agx-web/index.html).
 * Red de seguridad antes del rediseño: recorre todas las funciones y comprueba RESULTADOS.
 *
 * Uso:
 *   BASE=http://localhost:4400/ NODE_PATH=$(npm root -g) node agx-e2e.cjs
 * Variables de entorno:
 *   BASE         URL donde se sirve la carpeta de la web en local (por defecto http://localhost:4400/).
 *                Tiene que ser un host local: así la app arranca en modo ejemplo. Nunca producción.
 *   SOLO         expresión regular para ejecutar solo algunos grupos (p. ej. SOLO='Formación' o SOLO='lectura|Móvil').
 *                Grupos: «Diario · lectura», «Diario · escritura», «Ranking, acciones rápidas y tema»,
 *                «Formación · modo ejemplo», «Servidor simulado», «Formación · ruta en servidor»,
 *                «Móvil y desbordamiento», «Destructivos».
 *   CONCURRENCIA grupos a la vez (por defecto 3; cada grupo usa su propio contexto limpio).
 *   FONTS        carpeta node_modules con @fontsource-variable/archivo y @fontsource/bebas-neue (opcional).
 *   VERBOSO=1    imprime cada comprobación en cuanto ocurre (además del informe ordenado del final).
 * Salida: una línea por comprobación (✓/✗) y al final «RESULTADO: OK» (código 0) o «RESULTADO: FALLO (n): …» (código 1).
 *
 * Cómo está montada:
 *   - Reloj fijo con la API de reloj de Playwright: viernes 30 de octubre de 2026, 16:30 en Europe/Madrid
 *     (11:30 en Nueva York, sesión de NY abierta). Los datos de ejemplo son de octubre de 2026.
 *   - Modo ejemplo: BASE en localhost (estado en localStorage, capturas en IndexedDB), contexto limpio por grupo.
 *   - Modo servidor: host ficticio https://demo-agx.netlify.app/ con TODAS las peticiones interceptadas
 *     (index.html descargado de BASE y /api/* simuladas). No sale ninguna petición real.
 *   - Clave de respuestas del temario: se lee del propio index.html (se evalúa su script en una página aparte
 *     y se exportan PREGUNTAS y RUTA; la opción 0 de cada pregunta es la correcta).
 *   - Los valores esperados del diario están calculados a mano a partir de EJEMPLOS (ver el bloque ESPERADOS).
 *   - Importación de Excel: la app descarga su lector (xlsx 0.18.5) de cdnjs; aquí se sirve la copia local
 *     tools/vendor/xlsx.full.min.js (del paquete npm xlsx@0.18.5) y con ella se genera el .xlsx de prueba.
 *   - No toca el repositorio ni escribe nada en disco. Los únicos fallos de consola que se toleran son: las fuentes,
 *     las respuestas de error que el propio caso simula en /api/* y en cdnjs, y el aviso conocido «Transition was
 *     skipped» (ver contexto()); todo lo demás cuenta como fallo.
 *
 * ============================== GANCHOS ==============================
 * Lo que el rediseño tiene que conservar para que esta prueba (y el JS de la app) siga funcionando.
 *
 * 1) Atributos que ya usa el JS:  data-accion (y sus data-*: data-id, data-periodo, data-fecha, data-setup,
 *    data-sesion, data-dow, data-tipo, data-v, data-f, data-modo, data-tema, data-b, data-n, data-l, data-pos,
 *    data-i, data-p, data-cuenta, data-cap) y data-ruta en los enlaces del menú.
 * 2) Ids (casi todos los usa el JS; el resto son destinos de aria-labelledby / aria-controls):
 *    #vista #bs-fecha #bs-hora #bs-sesion #bs-modo #lat-widgets #toast #nav-alumnos #alumno-nombre #alumno-sub #alumno-av
 *    #hero-saludo #hero-etq #hero-neto #hero-sub #hero-chips #obj-in #kpis #k-media #insights #curva #ticker-caja
 *    #avisos-diario #hoy-fila #calendario #cal-mes #mapa #setups #comentarios #errores #filtros #ops-meta #tabla
 *    #aviso-ejemplo #fila-<id> #det-<id> #com-<id> #com-est-<id>
 *    #cajon #capa #t-nueva #cajon-desc #form-op #f-fecha #f-hora #f-ct #f-stop #f-imp #f-riesgo #f-r #f-nota #f-cap
 *    #zona-cap #atas-res #calculo #pie-res #form-error #btn-guardar-op
 *    #visor #visor-t #visor-img #paleta #paleta-in #paleta-lista #imp #imp-cuerpo #imp-pie #imp-file #imp-tz #imp-zona
 *    #rut #rut-t #rut-sub #rut-cuerpo #rut-nota #rut-mejora #rut-nota2
 *    #est #est-errores #tip-g #form-plan #pl-perdida #pl-riesgo #pl-contratos #pl-ops #pl-racha #pl-objetivo
 *    #pl-desde #pl-hasta #pl-stop #pl-registro #pl-texto #pl-estado #cumple #ia-cuerpo
 *    #form-cuenta #ct-firma #ct-tamano #ct-dd #ct-tipo #ct-limite #ct-obj #ct-desde #ct-fase #ct-bloqueo #ct-estado #t-cta
 *    #f-pct #r-tit #f-tit #t-preg #reloj-t #rk-lista #rk-d #rk-h #rk-m #rk-s #rk-cuenta-t #rk-premio
 *    #entrada #entrada-caja #entrada-t #al-buscar
 * 3) name de los controles de formulario: f-sesion, f-inst, f-dir, f-res, f-setup, f-err, rut-check, rut-sueno,
 *    rut-animo, rut-disc, pl-dia, pl-ins, pl-set (y sus value). Las fichas se pulsan por su <label>, que debe
 *    seguir envolviendo al <input>.
 * 4) Textos accesibles (aria-label / role) que la prueba lee tal cual:
 *    - #hero-neto y #f-pct con role="img" y aria-label con la cifra («Resultado neto en octubre: +2.234 $», «Completado: 1 %»).
 *    - La curva: un elemento role="img" dentro de #curva, enfocable, con aria-label «Curva de resultados: termina en …».
 *    - Celdas del calendario, del mapa y barras de estadísticas con su aria-label; botones «Mes anterior/siguiente»,
 *      «Un contrato más/menos», «Cerrar», «Cerrar captura», «Activar modo oscuro/claro», «Nueva operación» (botón flotante).
 *    - Navegador de preguntas: elementos con aria-label «Pregunta N, correcta|incorrecta|contestada|sin contestar».
 *    - Podio: role="listitem" con aria-label «Puesto N: nombre, X logros»; tu fila del ranking con aria-current="true".
 *    - Lecciones y exámenes bloqueados con aria-disabled="true"; periodos, filtros y opciones con aria-pressed;
 *      detalle de la operación con aria-expanded; pestañas y menú con aria-current="page".
 *    - <nav aria-label="Módulos">, «Secciones del diario», «Secciones de la formación»; diálogos con role="dialog".
 *    - Barras de estadísticas: role="img" + data-tip (lo usa el JS) + enfocables; su dato sale en #tip-g.
 *    - Acciones rápidas: opciones con role="option" y aria-selected dentro de #paleta-lista; el cuadro, role="dialog".
 *    - Test: barra de progreso con role="progressbar" y aria-valuenow; avisos de la entrada con role="status" / role="alert".
 *    - Ventanas de importar, rutina y acciones rápidas: un role="dialog" dentro de #imp, #rut y #paleta.
 * 5) Estructura de la que SÍ depende (no hay alternativa por rol o id):
 *    - Ids de operación: e<n> (ejemplos), t<marca de tiempo> (propias), i<…> (importadas); de ahí #fila-e14, [id^="fila-t"], [id^="fila-i"].
 *    - La figura de una lección va dentro de <figure>; el enlace «Salir» de la sesión es un <a> dentro de #alumno-sub.
 *    - El buscador de alumnos oculta tarjetas con el atributo hidden; los botones que no aplican en una pantalla no se pintan
 *      o quedan con display:none (el botón grande de «Nueva operación» en móvil, el flotante en escritorio).
 *    - Los niveles de la ruta son <details> con su <summary> (se abre/cierra pulsando el summary y se lee .open).
 *    - Las lecciones disponibles son enlaces <a href="#formacion/l/<id>">; las tarjetas de alumno, <a href="#alumnos/<id>">.
 *    - El confeti es un <canvas> añadido a <body>.
 *    - html[data-modo="oscuro"] para el tema oscuro (y nada para el claro), guardado en localStorage «agx-modo».
 *    - La sección de la cuenta de fondeo es <section aria-labelledby="t-cta">.
 *    - El orden de lectura del texto dentro de cada tarjeta, fila o lista (p. ej. «Acierto 57 % 8 de 14», etiqueta y luego
 *      valor): las comprobaciones de bloques leen textContent y buscan los trozos, sin mirar clases ni etiquetas. En los
 *      bloques de varias tarjetas (indicadores, fichas del resultado, números clave, cuenta) el orden ENTRE tarjetas es libre;
 *      en listas ordenadas (operaciones, setups, comentarios, ranking, reglas) el orden sí se comprueba.
 * 6) Clases CSS: ninguna. La prueba no usa selectores de clase.
 * =====================================================================
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const zlib = require('zlib');

const BASE = (process.env.BASE || 'http://localhost:4400/').replace(/\/?$/, '/');
const SOLO = process.env.SOLO ? new RegExp(process.env.SOLO, 'i') : null;
const CONCURRENCIA = Math.max(1, parseInt(process.env.CONCURRENCIA || '3', 10) || 3);
const VERBOSO = !!process.env.VERBOSO;
const FONTS = process.env.FONTS || path.join(__dirname, '..', 'fonts', 'node_modules');
const VENDOR_XLSX = path.join(__dirname, 'vendor', 'xlsx.full.min.js');
const HOST_SRV = 'demo-agx.netlify.app';
const URL_SRV = `https://${HOST_SRV}/`;
// Viernes 30 de octubre de 2026, 16:30 en Madrid (UTC+1 desde el 25 de octubre) = 11:30 en Nueva York (EDT hasta el 1 de noviembre).
const AHORA = new Date('2026-10-30T15:30:00Z');
const T_GRUPO = 170000;

if (/agxcommunity\.com/i.test(new URL(BASE).hostname)) { console.error('BASE apunta a producción. Esta prueba solo se ejecuta contra un servidor local.'); process.exit(2); }

/* ============================== ESPERADOS (calculados a mano) ==============================
 * EJEMPLOS (fecha, sesión, instrumento, dirección, contratos, puntos) → $ = puntos × valor del punto × contratos
 * (NQ 20 $, MNQ 2 $, ES 50 $, MES 5 $):
 *   e1  05-oct lun NY      NQ  L 1 +20   → +400     e8  20-oct mar NY      NQ  C 1 −9    → −180
 *   e2  06-oct mar NY      NQ  C 1 −8    → −160     e9  21-oct mié NY      NQ  L 1 +22,5 → +450
 *   e3  08-oct jue Londres MNQ L 5 +24   → +240     e10 22-oct jue NY      MNQ C 4 −12   → −96
 *   e4  09-oct vie NY      NQ  L 1 −5    → −100     e11 26-oct lun NY      NQ  L 1 +20   → +400
 *   e5  13-oct mar NY      NQ  C 1 +25   → +500     e12 27-oct mar Londres NQ  C 1 +8    → +160
 *   e6  14-oct mié Asia    MNQ L 5 −12   → −120     e13 28-oct mié NY      MES L 3 −4    → −60
 *   e7  16-oct vie NY      ES  L 1 +6    → +300     e14 29-oct jue NY      NQ  L 1 +25   → +500
 * Octubre (= todo): 14 operaciones, 8 ganadoras (57 %), ganado 2.950, perdido 716, neto +2.234; PF 2950/716 = 4,12;
 *   media 2234/14 = 159,6 → +160 $; racha actual 1 ganadora; mejor racha 2.
 * Semana del 26-oct al 1-nov: e11..e14 → +1.000 $, 4 operaciones, 3 ganadoras (75 %), PF 1060/60 = 17,67, media +250 $.
 * Setups: Patrón Gonzi +1.400 (3, 100 %) · Agotamiento +850 (2) · Giro por perfil +240 (2) · Rechazo +60 (2) ·
 *   Imbalance −60 (3) · Divergencia −256 (2, 0 %).
 * Sesiones: NY +1.954 (11) · Londres +400 (2) · Asia −120 (1).   Largos +2.010 (9) · Cortos +224 (5).
 * Días de la semana: lunes +800 · martes +320 · miércoles +270 · jueves +644 · viernes +200.
 * Horas de entrada del ejemplo: NY 15:34 + (i·7 mod 40) min, Londres 9:12 + …, Asia 2:20 + … (i = posición desde 0).
 * Stop y riesgo del ejemplo: stop = base (NQ 12, MNQ 15, ES 4, MES 5) o los puntos perdidos si son más; riesgo = stop × valor × contratos;
 *   e6 no tiene stop. e14: stop 12, riesgo 240 $, R = 500/240 = +2,1 R.
 * Plan de ejemplo (pérdida 600, riesgo 300, 2 contratos, 3 operaciones, 2 pérdidas seguidas, 15:30–18:30, L–V,
 *   NQ/MNQ/ES/MES, todos los setups menos Divergencia, stop y registro): días que cumplen todo: 8 de 14; reglas rotas 11 de 154 → 93 %.
 *   Rotas: contratos (e3, e6, e10, e13 → 4 días), horario (e3, e6, e12 → 3), setups (e2, e10 → 2), stop (e6), registro (e13).
 */
const E = {
  mes: { etq: 'Resultado neto en octubre', neto: '+2.234 $', sub: '14 operaciones y 57 % de acierto, sin comisiones.', meta: '14 operaciones, este mes' },
  semana: { etq: 'Resultado neto esta semana', neto: '+1.000 $', sub: '4 operaciones y 75 % de acierto, sin comisiones.', meta: '4 operaciones, esta semana' },
  todo: { etq: 'Resultado neto desde que empezaste', neto: '+2.234 $', sub: '14 operaciones y 57 % de acierto, sin comisiones.', meta: '14 operaciones, en el diario' },
  setups: ['Patrón Gonzi', 'Agotamiento de Big Trade', 'Giro por perfil', 'Rechazo Call Wall / Put Wall', 'Imbalance', 'Divergencia'],
};

/* ============================== utilidades ============================== */
const norm = (s) => String(s == null ? '' : s).replace(/[\s ]+/g, ' ').trim();
const compacto = (s) => String(s == null ? '' : s).replace(/[\s ]+/g, '');
const linea1 = (e) => { // primera línea del error y, si es una espera de Playwright, qué estaba esperando y por qué no pudo
  const l = String((e && e.message) || e).split('\n').map((x) => x.replace(/\u001b\[[0-9;]*m/g, '').trim()).filter(Boolean);
  const log = l.filter((x) => /^- /.test(x)); const extra = log.length ? ' [' + log.slice(0, 1).concat(log.slice(-2)).join(' ') + ']' : '';
  return (l[0] + extra).slice(0, 520);
};
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
async function hasta(fn, pred, ms = 5000, paso = 40) {
  const t0 = Date.now(); let v;
  for (;;) {
    try { v = await fn(); if (pred(v)) return { ok: true, v }; } catch (e) { v = '(error: ' + linea1(e) + ')'; }
    if (Date.now() - t0 > ms) return { ok: false, v };
    await pausa(paso);
  }
}
function descargar(url) {
  return new Promise((res, rej) => {
    (url.startsWith('https:') ? https : http).get(url, (r) => {
      if (r.statusCode !== 200) { rej(new Error(`${url} responde ${r.statusCode}`)); r.resume(); return; }
      const c = []; r.on('data', (d) => c.push(d)); r.on('end', () => res(Buffer.concat(c).toString('utf8')));
    }).on('error', rej);
  });
}
/* PNG pequeño generado a mano (RGB, 8 bits) para la captura adjunta */
function png(w, h) {
  const tabla = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; tabla[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = tabla[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const trozo = (tipo, datos) => { const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const td = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const cab = Buffer.alloc(13); cab.writeUInt32BE(w, 0); cab.writeUInt32BE(h, 4); cab[8] = 8; cab[9] = 2;
  const crudo = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; const vela = (x >> 3) % 2 ? [38, 166, 154] : [239, 83, 80]; const dentro = y > 8 + (x % 16) && y < h - 8; const c = dentro ? vela : [20, 21, 27]; crudo[o] = c[0]; crudo[o + 1] = c[1]; crudo[o + 2] = c[2]; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', cab), trozo('IDAT', zlib.deflateSync(crudo)), trozo('IEND', Buffer.alloc(0))]);
}
const hueco = (h, m, d = 30) => Date.UTC(2026, 9, d, h - 1, m); // hora de Madrid (UTC+1) de un día de finales de octubre de 2026

let ARCHIVO = null, BEBAS = null;
try {
  ARCHIVO = fs.readFileSync(path.join(FONTS, '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2'));
  BEBAS = fs.readFileSync(path.join(FONTS, '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2'));
} catch (e) { /* sin fuentes locales: se sirve una hoja vacía y se usa la tipografía de reserva */ }
const FONT_CSS = ARCHIVO && BEBAS ? `
@font-face{font-family:'Archivo';font-style:normal;font-weight:100 900;font-stretch:62% 125%;src:url(http://fonts.local/archivo.woff2) format('woff2')}
@font-face{font-family:'Bebas Neue';font-style:normal;font-weight:400;src:url(http://fonts.local/bebas.woff2) format('woff2')}` : '';

/* ============================== grupo de comprobaciones ============================== */
class Grupo {
  constructor(nombre) { this.nombre = nombre; this.out = []; this.fallos = []; this.n = 0; this.errores = []; this.conocidos = 0; this.externas = []; this.contextos = []; this.t0 = Date.now(); }
  p(s) { this.out.push(s); if (VERBOSO) console.log(`[${this.nombre}] ${s}`); }
  ok(nombre, cond, detalle) {
    this.n++;
    if (cond) this.p(`  ✓ ${nombre}`);
    else { const d = detalle ? ' — ' + String(detalle).slice(0, 600) : ''; this.p(`  ✗ ${nombre}${d}`); this.fallos.push(`${this.nombre} › ${nombre}${d}`); }
    return !!cond;
  }
  async igual(nombre, fn, esperado, ms) { const r = await hasta(fn, (v) => v === esperado, ms); return this.ok(nombre, r.ok, `esperado «${esperado}», obtenido «${r.v}»`); }
  async cumple(nombre, fn, pred, ms, pista) { const r = await hasta(fn, pred, ms); return this.ok(nombre, r.ok, `${pista ? pista + '; ' : ''}obtenido «${typeof r.v === 'string' ? r.v : JSON.stringify(r.v)}»`); }
  txt(nombre, loc, esperado, ms) { return this.igual(nombre, async () => norm(await loc.textContent({ timeout: 1500 })), esperado, ms); }
  attr(nombre, loc, a, esperado, ms) { return this.igual(nombre, () => loc.getAttribute(a, { timeout: 1500 }), esperado, ms); }
  valor(nombre, loc, esperado, ms) { return this.igual(nombre, () => loc.inputValue({ timeout: 1500 }), esperado, ms); }
  cuenta(nombre, loc, n, ms) { return this.igual(nombre, () => loc.count(), n, ms); }
  visible(nombre, loc, ms) { return this.igual(nombre, () => loc.isVisible(), true, ms); }
  oculto(nombre, loc, ms) { return this.igual(nombre, () => loc.isVisible(), false, ms); }
  marcado(nombre, loc, esperado = true, ms) { return this.igual(nombre, () => loc.isChecked({ timeout: 1500 }), esperado, ms); }
  /* El texto del bloque contiene todos los trozos, en ese orden (se comparan sin espacios, sobre textContent) */
  async partes(nombre, loc, lista, ms) {
    let falta = '';
    const r = await hasta(async () => compacto(await loc.textContent({ timeout: 1500 })), (t) => { let i = 0; for (const s of lista) { const k = t.indexOf(compacto(s), i); if (k < 0) { falta = s; return false; } i = k + compacto(s).length; } return true; }, ms);
    const todos = !r.ok && lista.every((x) => String(r.v).includes(compacto(x)));
    return this.ok(nombre, r.ok, `falta «${falta}» (en orden) en «${String(r.v).slice(0, 260)}»${todos ? ' · están todos los trozos pero en otro orden: si el rediseño ha cambiado el orden del texto a propósito, actualiza esta comprobación' : ''}`);
  }
  /* Para bloques con varias tarjetas: cada grupo tiene que aparecer (los trozos de un grupo, en orden), en cualquier posición */
  async tiene(nombre, loc, grupos, ms) {
    let falta = '';
    const r = await hasta(async () => compacto(await loc.textContent({ timeout: 1500 })), (t) => {
      for (const gr of grupos) { const lista = Array.isArray(gr) ? gr : [gr]; let i = 0; for (const x of lista) { const k = t.indexOf(compacto(x), i); if (k < 0) { falta = lista.join(' → '); return false; } i = k + compacto(x).length; } }
      return true;
    }, ms);
    return this.ok(nombre, r.ok, `falta «${falta}» en «${String(r.v).slice(0, 260)}»`);
  }
  async sinTexto(nombre, loc, trozo, ms) { const r = await hasta(async () => compacto(await loc.textContent({ timeout: 1500 })), (t) => !t.includes(compacto(trozo)), ms); return this.ok(nombre, r.ok, `no debería aparecer «${trozo}»`); }
  toast(page, texto, nombre) { return this.cumple(nombre || `Aviso: «${texto}»`, async () => ((await page.locator('#toast').isVisible()) ? norm(await page.locator('#toast').textContent()) : '(oculto)'), (t) => t.includes(texto), 5000, `esperado «${texto}»`); }
  async seccion(titulo, fn) {
    this.p(`— ${titulo}`);
    try { await fn(); } catch (e) { this.ok(`${titulo}: se completa sin excepciones`, false, linea1(e)); }
  }
}

/* ============================== contexto del navegador ============================== */
async function contexto(g, env, o = {}) {
  const ctx = await env.browser.newContext({
    viewport: o.viewport || { width: 1440, height: 900 }, deviceScaleFactor: o.dpr || 1, isMobile: !!o.movil, hasTouch: !!o.tactil,
    locale: 'es-ES', timezoneId: 'Europe/Madrid', colorScheme: 'light', reducedMotion: 'no-preference', serviceWorkers: 'block',
  });
  g.contextos.push(ctx);
  const origen = new URL(BASE).origin + '/';
  // Nada sale a internet: lo que no sea BASE o una ruta simulada se corta y se apunta.
  await ctx.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith(origen)) return route.continue(); g.externas.push(u); return route.abort(); });
  await ctx.route(/^https?:\/\/fonts\.googleapis\.com\//, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS }));
  await ctx.route(/^https?:\/\/fonts\.gstatic\.com\//, (r) => r.abort());
  await ctx.route('http://fonts.local/archivo.woff2', (r) => (ARCHIVO ? r.fulfill({ status: 200, contentType: 'font/woff2', body: ARCHIVO, headers: { 'access-control-allow-origin': '*' } }) : r.abort()));
  await ctx.route('http://fonts.local/bebas.woff2', (r) => (BEBAS ? r.fulfill({ status: 200, contentType: 'font/woff2', body: BEBAS, headers: { 'access-control-allow-origin': '*' } }) : r.abort()));
  // Lector de Excel: la app lo carga de cdnjs. Aquí se sirve la copia local o se corta, según o.xlsx.modo.
  if (o.xlsx) await ctx.route(/^https:\/\/cdnjs\.cloudflare\.com\/.*xlsx/, (r) => (o.xlsx.modo === 'ok' ? r.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: env.xlsxLib }) : r.abort()));
  if (o.servidor) await o.servidor.montar(ctx);
  await ctx.clock.install({ time: AHORA });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const tolera = o.tolera || [];
  const quien = o.nombre || 'página';
  page.on('pageerror', (e) => {
    // ERROR CONOCIDO DE LA APP (ver findings): si se navega dos veces en menos de 0,35 s, la transición de vista en curso se
    // cancela y su promesa rechazada queda sin recoger («Transition was skipped»). No afecta a lo que se ve. Se cuenta aparte.
    if (/Transition was skipped/.test(e.message)) { g.conocidos++; return; }
    g.errores.push(`[${quien}] error de página: ${linea1(e)}`);
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const donde = (m.location() && m.location().url) || '', t = m.text();
    if (/fonts\.(googleapis|gstatic)\.com|fonts\.local/.test(donde + ' ' + t)) return; // solo se ignoran las fuentes
    if (tolera.some((re) => re.test(donde + ' ' + t))) return; // fallos de red que el propio caso provoca a propósito
    g.errores.push(`[${quien}] consola: ${t} (${donde})`);
  });
  return { ctx, page };
}
function cierre(g) {
  if (g.conocidos) g.p(`  · nota: ${g.conocidos} avisos «Transition was skipped» al encadenar navegaciones (error conocido de la app, no cuenta como fallo)`);
  g.ok('Sin errores de página ni de consola', g.errores.length === 0, g.errores.slice(0, 6).join(' | '));
  g.ok('Sin peticiones a hosts externos', g.externas.length === 0, Array.from(new Set(g.externas)).slice(0, 6).join(' | '));
}

/* ============================== preparación: clave del temario y Excel de prueba ============================== */
async function prepararClave(browser, html) {
  const MARCA = /\narrancar\(\);\s*\n\}\)\(\);/;
  if (!MARCA.test(html)) throw new Error('No encuentro el final del script de index.html («arrancar();» y cierre del IIFE) para leer el temario.');
  const exporta = `
;(function(){ const d=document.createElement('div'); const plano=s=>{ d.innerHTML=String(s); return d.textContent; };
  window.__AGX_CLAVE={
    preguntas:PREGUNTAS.map(p=>({id:p.id,tema:p.tema,texto:plano(p.texto),opciones:p.opciones.map(plano),nota:plano(p.nota)})),
    ruta:RUTA.map(n=>({id:n.id,titulo:n.titulo,preparando:!!n.preparando,lecciones:n.lecciones.map(l=>({id:l.id,titulo:l.titulo,min:l.min,n:poolLec(l).length}))})),
    temas:TEMAS.map(t=>({id:t.id,nombre:t.nombre,bloque:t.bloque})),
    bloques:BLOQUES.map(b=>({id:b.id,nombre:b.nombre}))
  }; })();
})();`;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await ctx.route('**/*', (r) => r.abort());
  await ctx.route('http://agx-clave.test/', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html.replace(MARCA, () => exporta) }));
  await page.goto('http://agx-clave.test/');
  const k = await page.evaluate(() => window.__AGX_CLAVE);
  await ctx.close();
  if (!k || !k.preguntas || k.preguntas.length < 100) throw new Error('No se ha podido leer el banco de preguntas de index.html.');
  const porTexto = new Map();
  k.preguntas.forEach((p) => { const t = norm(p.texto); if (porTexto.has(t) && porTexto.get(t).opciones[0] !== p.opciones[0]) throw new Error('Dos preguntas con el mismo enunciado y distinta respuesta: ' + t); porTexto.set(t, p); });
  const lec = {}; k.ruta.forEach((n, ni) => n.lecciones.forEach((l, li) => { lec[l.id] = Object.assign({ nivel: n, ni, li }, l); }));
  return { clave: k, porTexto, lec, activos: k.ruta.filter((n) => !n.preparando) };
}
async function prepararXlsx(browser, lib) {
  // Un .xlsx real, con cabeceras en español y fechas como número de serie de Excel (así las escribe ATAS)
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addScriptTag({ content: lib });
  const b64 = await page.evaluate(() => {
    const serie = (y, m, d, h, mi) => Date.UTC(y, m - 1, d, h, mi, 0) / 864e5 + 25569;
    const filas = [['Cuenta', 'Instrumento', 'Hora de apertura', 'Precio de apertura', 'Volumen de apertura', 'Hora de cierre', 'Precio de cierre', 'Volumen de cierre', 'Beneficio', 'Comisión'],
      ['APEX-1', 'NQZ6', serie(2026, 10, 26, 15, 35), 24300, 1, serie(2026, 10, 26, 15, 47), 24310, 1, 200, 4.5]];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), 'Journal');
    return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  });
  await ctx.close();
  return Buffer.from(b64, 'base64');
}
const CSV_ATAS = [
  'Account;Instrument;Open time;Open price;Open volume;Close time;Close price;Close volume;PnL;Commission;Comment',
  'APEX-1;NQZ6;30.10.2026 15:40:00;24500,00;1;30.10.2026 15:52:00;24512,50;1;250,00;4,50;Importada 1',
  'APEX-1;MNQZ6;29.10.2026 09:10:00;24480,00;2;29.10.2026 09:25:00;24490,00;2;-40,00;2,00;',
  'APEX-1;ESZ6;28.10.2026 16:00:00;6850,00;1;28.10.2026 16:12:00;6853,00;1;150,00;4,00;',
  'SIM-2;NQZ6;27.10.2026 15:35:00;24400,00;1;27.10.2026 15:41:00;24390,00;1;-200,00;4,50;',
].join('\r\n') + '\r\n';

/* ============================== ayudas de interfaz ============================== */
const etiqueta = (page, sel) => page.locator(sel).locator('xpath=ancestor::label[1]'); // la ficha visible es el <label> que envuelve al <input>
const hashDe = (page) => new URL(page.url()).hash;
/* Carga completa (no solo cambio de #ruta): hace falta para volver a pasar por /api/yo y /api/datos */
async function cargar(page, url) { await page.goto('about:blank'); await page.goto(url); }
const h1 = (page) => page.locator('#vista').getByRole('heading', { level: 1 });
async function soltar(page, sel, archivo) {
  await page.evaluate(({ sel, name, type, b64 }) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const dt = new DataTransfer(); dt.items.add(new File([bin], name, { type }));
    document.querySelector(sel).dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, { sel, name: archivo.name, type: archivo.mimeType, b64: archivo.buffer.toString('base64') });
}
async function pegar(page, archivo) {
  await page.evaluate(({ name, type, b64 }) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const dt = new DataTransfer(); dt.items.add(new File([bin], name, { type }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, { name: archivo.name, type: archivo.mimeType, b64: archivo.buffer.toString('base64') });
}
/* Acciones rápidas: la app pone el foco en el buscador un instante después de abrir, y Esc solo cierra con el foco ahí */
async function abrirPaleta(page) {
  await page.keyboard.press('Control+k');
  await page.locator('#paleta').waitFor();
  const r = await hasta(() => page.evaluate(() => document.activeElement && document.activeElement.id), (id) => id === 'paleta-in', 4000);
  if (!r.ok) throw new Error('Las acciones rápidas no ponen el foco en el buscador');
}
async function cerrarPaleta(page) { await page.keyboard.press('Escape'); await page.locator('#paleta').waitFor({ state: 'hidden' }); }
async function abrirDetalle(page, id) {
  const b = page.locator(`#tabla [data-accion="detalle"][data-id="${id}"]`);
  if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click();
  return b;
}

/* --- Tests de formación: leer la pregunta en pantalla y resolverla con la clave --- */
async function estadoQuiz(page) {
  return page.evaluate(() => {
    const v = document.getElementById('vista'), q = document.getElementById('t-preg'); if (!q) return null;
    const m = /Pregunta (\d+) de (\d+)/.exec(v.textContent) || [];
    return { i: Number(m[1]), n: Number(m[2]), q: q.textContent, ops: Array.from(v.querySelectorAll('[data-accion="opcion"]')).map((b) => ({ pos: Number(b.dataset.pos), t: b.textContent, pulsada: b.getAttribute('aria-pressed') === 'true', off: b.disabled })) };
  });
}
async function esperaPregunta(page, i) {
  const r = await hasta(() => estadoQuiz(page), (s) => !!s && s.ops.length === 3 && (i == null || s.i === i), 8000);
  if (!r.ok) throw new Error(`No aparece la pregunta ${i == null ? '' : i} del test (${JSON.stringify(r.v).slice(0, 160)})`);
  return r.v;
}
function analizar(env, st) {
  const p = env.porTexto.get(norm(st.q));
  if (!p) throw new Error('Pregunta que no está en la clave: ' + norm(st.q).slice(0, 120));
  const kDe = {};
  st.ops.forEach((o) => { const k = p.opciones.findIndex((t) => norm('ABC'[o.pos] + t) === norm(o.t)); if (k < 0) throw new Error('Opción que no está en la clave: ' + norm(o.t).slice(0, 120)); kDe[o.pos] = k; });
  const posOk = st.ops.find((o) => kDe[o.pos] === 0).pos, posMal = st.ops.find((o) => kDe[o.pos] !== 0).pos;
  return { p, kDe, posOk, posMal };
}
/* Modos con corrección al momento (lección, tema, test rápido, fallos). decide(i,n) → 'bien' | 'mal' */
async function hacerPractica(page, env, decide, opc = {}) {
  const hechas = [];
  for (;;) {
    const st = await esperaPregunta(page, hechas.length + 1), info = analizar(env, st), d = decide(st.i, st.n), pos = d === 'bien' ? info.posOk : info.posMal;
    const teclado = opc.teclado && opc.teclado(st.i);
    if (teclado) await page.keyboard.press('abc'[pos]); else await page.locator(`#vista [data-accion="opcion"][data-pos="${pos}"]`).click();
    const sig = page.locator('#vista [data-accion="siguiente"], #vista [data-accion="ver-resultado"]');
    await sig.waitFor();
    const reg = { i: st.i, n: st.n, p: info.p, bien: d === 'bien', elegida: info.p.opciones[info.kDe[pos]], letraOk: 'ABC'[info.posOk] };
    hechas.push(reg);
    if (opc.tras) await opc.tras(reg);
    if (teclado) await page.keyboard.press('Enter'); else await sig.click();
    if (st.i === st.n) break;
  }
  return hechas;
}
/* Modos de examen (final o de nivel). decide(i,n) → 'bien' | 'mal' | 'blanco'. No entrega. */
async function hacerExamen(page, env, decide, opc = {}) {
  const hechas = [];
  for (;;) {
    const st = await esperaPregunta(page, hechas.length + 1), info = analizar(env, st), d = decide(st.i, st.n);
    const teclado = opc.teclado && opc.teclado(st.i, d);
    if (d !== 'blanco') {
      const pos = d === 'bien' ? info.posOk : info.posMal;
      if (teclado) await page.keyboard.press('abc'[pos]); else await page.locator(`#vista [data-accion="opcion"][data-pos="${pos}"]`).click();
      const r = await hasta(() => page.locator(`#vista [data-accion="opcion"][data-pos="${pos}"]`).getAttribute('aria-pressed'), (v) => v === 'true', 4000);
      if (!r.ok) throw new Error(`La opción elegida en la pregunta ${st.i} no queda marcada`);
    }
    hechas.push({ i: st.i, n: st.n, p: info.p, d, info });
    if (opc.tras) await opc.tras(hechas[hechas.length - 1]);
    if (st.i === st.n) break;
    if (teclado) await page.keyboard.press('ArrowRight'); else await page.locator('#vista [data-accion="siguiente"]').click();
  }
  return hechas;
}
function fallosPorTema(env, hechas) {
  const cuenta = {}; hechas.filter((x) => x.d !== 'bien').forEach((x) => { cuenta[x.p.tema] = (cuenta[x.p.tema] || 0) + 1; });
  return Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a]).map((k) => `${env.clave.temas.find((t) => t.id === k).nombre} (${cuenta[k]})`).join(', ');
}

/* --- Desbordamiento horizontal --- */
async function medir(page, ancho) {
  return page.evaluate((w) => {
    const d = document.documentElement, y = window.scrollY, x0 = window.scrollX; window.scrollTo(100000, y); const sx = window.scrollX; window.scrollTo(x0, y);
    const ok = d.scrollWidth <= w + 1 && sx === 0 && window.innerWidth <= w + 1;
    let culpables = [];
    if (!ok) {
      const recorta = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== 'visible') return true; } return false; };
      culpables = Array.from(document.body.querySelectorAll('*')).filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > w + 1 && getComputedStyle(el).position !== 'fixed' && !recorta(el); })
        .slice(0, 4).map((el) => `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}> hasta ${Math.round(el.getBoundingClientRect().right)}px`);
    }
    return { ok, detalle: `ancho ${w}px, scrollWidth ${d.scrollWidth}, innerWidth ${window.innerWidth}, scrollX ${sx}. ${culpables.join(' · ')}` };
  }, ancho);
}
async function sinDesborde(g, page, ancho, nombre) {
  const r = await hasta(() => medir(page, ancho), (m) => m.ok, 2500, 120);
  return g.ok(`${ancho}px · ${nombre}: sin desbordamiento horizontal`, r.ok && r.v.ok, r.v && r.v.detalle);
}
async function dentro(g, page, ancho, sel, nombre) {
  const r = await hasta(() => page.locator(sel).first().boundingBox(), (b) => !!b && b.width > 0 && b.x >= -0.5 && b.x + b.width <= ancho + 0.5, 2500, 120);
  return g.ok(`${ancho}px · ${nombre}: cabe en la pantalla`, r.ok, r.v ? `x ${Math.round(r.v.x)}, ancho ${Math.round(r.v.width)}` : 'no visible');
}

/* ============================== servidor simulado (modo servidor) ============================== */
function crearServidor(env, ini = {}) {
  const s = Object.assign({
    yo: { status: 200, body: { sesion: true, id: '111', nombre: 'Lucía Ferrer', avatar: null, acceso: true, admin: false } },
    datos: { status: 200, body: { datos: null } }, datosPut: 200, persistir: true,
    ranking: { status: 200, body: { actualizado: null, mes: [], historico: [], recientes: [], campeones: [] } },
    analisisGet: { informes: [], ia: true, restantes: 3 }, analisisPost: { status: 200, body: {} },
    alumnos: { status: 200, body: { alumnos: [] } }, informesAdmin: { informes: [], ia: true }, comentario: 200,
    capturas: {}, adminCapturas: {}, puerta: null, puertaAlumnos: null,
  }, ini);
  s.reg = { put: [], capPut: [], capDel: [], capGet: [], analisis: [], adminCap: [], informes: [], comentarios: [], otras: [], orden: [], yo: 0 };
  s.montar = (ctx) => ctx.route((u) => u.hostname === HOST_SRV, async (route) => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname.replace(/\/+$/, '') || '/', m = req.method();
    const json = (st, b) => route.fulfill({ status: st, contentType: 'application/json; charset=utf-8', body: JSON.stringify(b) });
    const texto = (t) => route.fulfill({ status: 200, contentType: 'text/plain', body: t });
    if (p.startsWith('/api/')) s.reg.orden.push(m + ' ' + p);
    try {
      if (p === '/' || p === '/index.html') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: env.html });
      if (p === '/favicon.ico') return route.fulfill({ status: 204, body: '' });
      if (p === '/api/yo') { s.reg.yo++; if (s.puerta) await s.puerta; if (s.yo === 'cortar') return route.abort('failed'); return json(s.yo.status, s.yo.body); }
      if (p === '/api/datos' && m === 'GET') { if (s.datos.crudo != null) return route.fulfill({ status: 200, contentType: 'application/json', body: s.datos.crudo }); return json(s.datos.status || 200, s.datos.body); }
      if (p === '/api/datos' && m === 'PUT') {
        let b = null; try { b = JSON.parse(req.postData() || 'null'); } catch (e) { /* cuerpo no válido */ }
        s.reg.put.push(b);
        if (s.datosPut !== 200) return json(s.datosPut, { error: 'simulado' });
        if (s.persistir && b) s.datos = { status: 200, body: { datos: b } };
        return json(200, { ok: true, guardado: '2026-10-30T15:30:00.000Z' });
      }
      if (p === '/api/captura') {
        const id = u.searchParams.get('id');
        if (m === 'GET') { s.reg.capGet.push(id); return s.capturas[id] ? texto(s.capturas[id]) : json(404, { error: 'no_existe' }); }
        if (m === 'PUT') { s.capturas[id] = req.postData(); s.reg.capPut.push({ id, cuerpo: req.postData() || '' }); return json(200, { ok: true }); }
        if (m === 'DELETE') { delete s.capturas[id]; s.reg.capDel.push(id); return json(200, { ok: true }); }
      }
      if (p === '/api/ranking') return json(s.ranking.status, s.ranking.body);
      if (p === '/api/analisis' && m === 'GET') return json(200, s.analisisGet);
      if (p === '/api/analisis' && m === 'POST') { s.reg.analisis.push(JSON.parse(req.postData() || '{}')); return json(s.analisisPost.status, s.analisisPost.body); }
      if (p === '/api/admin/alumnos') { if (s.puertaAlumnos) await s.puertaAlumnos; return json(s.alumnos.status, s.alumnos.body); }
      if (p === '/api/admin/captura') { const k = u.searchParams.get('alumno') + '/' + u.searchParams.get('id'); s.reg.adminCap.push(k); return s.adminCapturas[k] ? texto(s.adminCapturas[k]) : json(404, { error: 'no_existe' }); }
      if (p === '/api/admin/informes') { s.reg.informes.push(u.searchParams.get('alumno')); return json(200, s.informesAdmin); }
      if (p === '/api/admin/comentario' && m === 'PUT') { const b = JSON.parse(req.postData() || '{}'); s.reg.comentarios.push(b); return s.comentario === 200 ? json(200, { ok: true, texto: b.texto }) : json(s.comentario, { error: 'simulado' }); }
      s.reg.otras.push(m + ' ' + p);
      return json(404, { error: 'no_encontrado' });
    } catch (e) { s.reg.otras.push('EXCEPCIÓN ' + m + ' ' + p + ' ' + linea1(e)); return route.abort(); }
  });
  s.esperaPut = (pred, ms = 6000) => hasta(() => s.reg.put.slice().reverse().find((b) => b && pred(b)) || null, (v) => !!v, ms, 60);
  return s;
}
const TOLERA_API = [new RegExp('^https://' + HOST_SRV.replace(/\./g, '\\.') + '/api/')];
const opSrv = (id, dia, h, mi, inst, dir, ct, usd, setup, nota, comentario, extra) => Object.assign({ id, fecha: `2026-10-${dia}`, sesion: 'NY', inst, dir, ct, usd, setup, nota, comentario, ejemplo: false, hEnt: hueco(h, mi, dia), errores: [] }, extra || {});
function datosLucia() {
  return {
    periodo: 'mes', temas: {}, examen: null, fallos: [], bloque: 'base', progresoEjemplo: false, objetivo: 3000, cuenta: null, rutinas: {},
    trades: [
      opSrv('s1', 28, 15, 40, 'NQ', 'L', 1, 300, 'Imbalance', 'Nota s1', 'Bien esperada.', { stop: 10, riesgo: 200 }),
      opSrv('s2', 29, 16, 10, 'ES', 'C', 1, -150, 'Divergencia', '', ''),
      opSrv('s3', 30, 15, 50, 'MNQ', 'L', 2, 80, 'Patrón Gonzi', 'Nota s3', ''),
    ],
    // Plan: pérdida máxima 200 $, 1 contrato, registro. s1 cumple todo; s2 sin nota; s3 con 2 contratos → 1 de 3 días, 10 de 12 reglas (83 %).
    plan: { perdidaMaxDia: 200, riesgoMaxOp: null, maxContratos: 1, maxOps: null, maxPerdidasSeguidas: null, objetivoDia: null, horaDesde: '', horaHasta: '', dias: [1, 2, 3, 4, 5], instrumentos: [], setups: [], registro: true, conStop: false, texto: 'Solo opero la apertura de Nueva York.', zona: 'Europe/Madrid', actualizado: '2026-10-20T10:00:00.000Z' },
    ruta: { lec: Object.fromEntries(['n1-1', 'n1-2', 'n1-3', 'n1-4', 'n1-5', 'n2-1', 'n2-2'].map((k) => [k, { ok: true, mejor: 100, intentos: 1, fecha: '2026-10-21' }])), niv: { n1: { ok: true, fallos: 1, total: 20, fecha: '2026-10-22' } } },
  };
}

/* =====================================================================================================
 * GRUPO 1 · Diario: navegación y lectura (resumen, estadísticas, plan e IA) con los datos de ejemplo
 * ===================================================================================================== */
async function gDiarioLectura(g, env) {
  const { page } = await contexto(g, env, { nombre: 'diario-lectura' });
  const v = page.locator('#vista');
  const per = (k) => v.locator(`[data-accion="periodo"][data-periodo="${k}"]`);
  const filas = page.locator('#tabla [data-accion="detalle"]');
  const meta = page.locator('#ops-meta'), filtros = page.locator('#filtros');
  const quitar = (f) => page.locator(`#filtros [data-accion="quitar-filtro"][data-f="${f}"]`);
  const menu = (r) => page.locator(`a[data-ruta="${r}"]`);
  const pestana = (n) => page.getByRole('navigation', { name: 'Secciones del diario' }).getByRole('link', { name: n });
  await page.goto(BASE);

  await g.seccion('Arranque en modo ejemplo, barra superior y menú', async () => {
    g.ok('Título del documento', (await page.title()) === 'AGX Área de Alumnos', await page.title());
    await g.txt('Fecha de hoy en la barra', page.locator('#bs-fecha'), 'Viernes, 30 de octubre');
    await g.txt('Hora en la barra', page.locator('#bs-hora'), '16:30');
    await g.partes('Sesión en vivo: NY abierta y cuánto queda (16:00 − 11:30 de NY)', page.locator('#bs-sesion'), ['Sesión de NY abierta', 'Cierra en 4 h 30 min']);
    await g.txt('Sin ruta se abre el Diario', h1(page), 'Diario de trading');
    await g.attr('Diario marcado en el menú', menu('diario'), 'aria-current', 'page');
    await g.txt('Saludo según la hora y nombre de ejemplo', page.locator('#hero-saludo'), 'Buenas tardes, Javi');
    await g.txt('Nombre del alumno de ejemplo', page.locator('#alumno-nombre'), 'Javi Martín');
    await g.oculto('El módulo Alumnos no se ve fuera del modo administrador', menu('alumnos'));
    await g.oculto('Sin pantalla de entrada en modo ejemplo', page.locator('#entrada'));
    await g.tiene('Resúmenes de la barra lateral', page.locator('#lat-widgets'), [['Esta semana, 4 operaciones', '+1.000 $'], ['Formación: 0 de 70 lecciones', '0 %'], ['Ranking de octubre', '4º · 5 logros']]);
  });

  await g.seccion('Navegación entre módulos y pestañas del Diario', async () => {
    await menu('formacion').click();
    await g.igual('Formación: la URL pasa a #formacion', () => hashDe(page), '#formacion');
    await g.txt('Formación: título', h1(page), 'Formación AGX');
    await g.attr('Formación marcada en el menú', menu('formacion'), 'aria-current', 'page');
    await g.attr('Diario desmarcado', menu('diario'), 'aria-current', null);
    await menu('ranking').click();
    await g.igual('Ranking: la URL pasa a #ranking', () => hashDe(page), '#ranking');
    await g.txt('Ranking: título', h1(page), 'Ranking de logros');
    await menu('diario').click();
    await g.txt('Vuelta al Diario', h1(page), 'Diario de trading');
    await page.goBack();
    await g.txt('Botón atrás del navegador: vuelve al Ranking', h1(page), 'Ranking de logros');
    await page.goForward();
    await g.txt('Botón adelante: otra vez el Diario', h1(page), 'Diario de trading');
    await pestana('Estadísticas').click();
    await g.igual('Pestaña Estadísticas: URL', () => hashDe(page), '#diario/estadisticas');
    await g.attr('Pestaña Estadísticas marcada', pestana('Estadísticas'), 'aria-current', 'page');
    await g.visible('Pestaña Estadísticas: se pinta el panel', page.locator('#est'));
    await pestana('Plan e IA').click();
    await g.igual('Pestaña Plan e IA: URL', () => hashDe(page), '#diario/plan');
    await g.visible('Pestaña Plan e IA: se pinta el formulario del plan', page.locator('#form-plan'));
    await pestana('Resumen').click();
    await g.igual('Pestaña Resumen: URL', () => hashDe(page), '#diario');
    await g.visible('Pestaña Resumen: se pinta el resultado', page.locator('#hero-neto'));
    await page.goto(BASE + '#no-existe');
    await g.txt('Una ruta desconocida abre el Diario', h1(page), 'Diario de trading');
    await page.goto(BASE + '#diario');
  });

  const comprobarPeriodo = async (k, nombre) => {
    const e = E[k];
    await g.attr(`${nombre}: botón marcado`, per(k), 'aria-pressed', 'true');
    await g.txt(`${nombre}: etiqueta del resultado`, page.locator('#hero-etq'), e.etq);
    await g.attr(`${nombre}: resultado neto ${e.neto}`, page.locator('#hero-neto'), 'aria-label', `${e.etq}: ${e.neto}`);
    await g.txt(`${nombre}: operaciones y acierto`, page.locator('#hero-sub'), e.sub);
    await g.txt(`${nombre}: recuento de la lista`, meta, e.meta);
    await g.cuenta(`${nombre}: filas en la lista`, filas, parseInt(e.meta, 10));
  };
  await g.seccion('Resumen: periodo (mes, semana, todo) y cifras esperadas', async () => {
    await comprobarPeriodo('mes', 'Este mes (por defecto)');
    await g.tiene('Este mes: tarjetas (acierto, profit factor, media, racha)', page.locator('#kpis'), [['Acierto', '57%', '8 de 14', 'operaciones en positivo'], ['Profit factor', '4,12', 'Ganado +2.950 $', 'Perdido −716 $'], ['Media por operación', 'Mejor +500 $, peor −180 $'], ['Racha actual', '1 ganadora', 'Mejor racha: 2 ganadoras seguidas']]);
    await g.txt('Este mes: media por operación (termina de contar en +160 $)', page.locator('#k-media'), '+160 $');
    await g.tiene('Este mes: fichas del resultado (objetivo, mejor y peor día, setup estrella)', page.locator('#hero-chips'), [['Objetivo de octubre', '74 %', '2.234 $ de 3.000 $'], ['Mejor día', '+500 $', '13 oct'], ['Peor día', '−180 $', '20 oct'], ['Setup estrella', 'Patrón Gonzi', '+1.400 $']]);
    await g.cumple('Este mes: curva con su resumen accesible', () => page.locator('#curva [role="img"]').getAttribute('aria-label'), (t) => String(t).startsWith('Curva de resultados: termina en +2.234 $ tras 14 operaciones.'));
    await per('semana').click();
    await comprobarPeriodo('semana', 'Esta semana');
    await g.attr('Esta semana: «Este mes» deja de estar marcado', per('mes'), 'aria-pressed', 'false');
    await g.tiene('Esta semana: tarjetas', page.locator('#kpis'), [['Acierto', '75%', '3 de 4'], ['Profit factor', '17,67', 'Ganado +1.060 $', 'Perdido −60 $'], ['Media por operación', 'Mejor +500 $, peor −60 $'], ['Racha actual', '1 ganadora', 'Mejor racha: 2 ganadoras seguidas']]);
    await g.txt('Esta semana: media por operación', page.locator('#k-media'), '+250 $');
    await g.tiene('Esta semana: mejor y peor día', page.locator('#hero-chips'), [['Objetivo de octubre', '74 %'], ['Mejor día', '+500 $', '29 oct'], ['Peor día', '−60 $', '28 oct'], ['Setup estrella', 'Patrón Gonzi', '+900 $']]);
    await g.cumple('Esta semana: curva de 4 operaciones', () => page.locator('#curva [role="img"]').getAttribute('aria-label'), (t) => String(t).startsWith('Curva de resultados: termina en +1.000 $ tras 4 operaciones.'));
    await page.reload();
    await g.attr('El periodo elegido se conserva al recargar', per('semana'), 'aria-pressed', 'true');
    await g.attr('…con su cifra', page.locator('#hero-neto'), 'aria-label', 'Resultado neto esta semana: +1.000 $');
    await per('todo').click();
    await comprobarPeriodo('todo', 'Todo');
    await per('mes').click();
    await comprobarPeriodo('mes', 'Vuelta a este mes');
  });

  await g.seccion('Resumen: lo que dicen tus datos (tarjetas que filtran)', async () => {
    const ins = (t) => page.locator(`#insights [data-accion="insight"][data-tipo="${t}"]`);
    await g.cuenta('Cuatro tarjetas', page.locator('#insights [data-accion="insight"]'), 4);
    await g.partes('Mejor sesión', ins('sesion'), ['Tu mejor sesión', 'NY', '+1.954 $ en 11 operaciones. En Asia llevas −120 $.']);
    await g.partes('Setup a vigilar', ins('setup'), ['Setup a vigilar', 'Divergencia', 'Te ha costado −256 $ en 2 operaciones.']);
    await g.partes('Largos frente a cortos', ins('dir'), ['Rindes más en largos', '+2.010 $', 'Largos +2.010 $ en 9 operaciones. Cortos +224 $ en 5 operaciones.']);
    await g.partes('Mejor día de la semana', ins('dow'), ['Tu mejor día', 'Lunes', '+800 $ sumando todos los lunes. El peor, los viernes: +200 $.']);
    await ins('sesion').click();
    await g.partes('Pulsar «mejor sesión» filtra por NY', filtros, ['Filtrando:', 'Sesión de NY', 'Quitar filtros']);
    await g.txt('…y quedan 11 operaciones', meta, '11 operaciones con este filtro');
    await g.cuenta('…11 filas', filas, 11);
    await ins('dir').click();
    await g.partes('Pulsar «largos» cambia el filtro', filtros, ['Solo largos']);
    await g.txt('…9 operaciones', meta, '9 operaciones con este filtro');
    await quitar('dir').click();
    await g.txt('Quitar la ficha «Solo largos» devuelve la lista', meta, E.mes.meta);
    await ins('dow').click();
    await g.partes('Pulsar «mejor día» filtra los lunes', filtros, ['Los lunes']);
    await g.txt('…2 operaciones', meta, '2 operaciones con este filtro');
    await ins('setup').click();
    await g.partes('Pulsar «setup a vigilar» filtra Divergencia', filtros, ['Setup: Divergencia']);
    await g.txt('…2 operaciones', meta, '2 operaciones con este filtro');
    await quitar('todo').click();
    await g.txt('«Quitar filtros» devuelve la lista completa', meta, E.mes.meta);
    await g.igual('…y desaparecen las fichas de filtro', async () => norm(await filtros.textContent()), '');
  });

  await g.seccion('Resumen: calendario', async () => {
    const dia = (f) => page.locator(`#calendario [data-accion="filtro-dia"][data-fecha="${f}"]`);
    await g.txt('Mes mostrado', page.locator('#cal-mes'), 'Octubre 2026');
    await g.cuenta('14 días con operaciones', page.locator('#calendario [data-accion="filtro-dia"]'), 14);
    await g.partes('Pie del calendario', page.locator('#calendario'), ['14 operaciones en octubre', '+2.234 $']);
    await g.attr('Etiqueta del día 13', dia('2026-10-13'), 'aria-label', '13 de octubre: +500 $, 1 operación. Ver operaciones de ese día');
    await g.cuenta('Hoy (30) aparece sin operaciones', page.locator('#calendario [aria-label="30 de octubre, sin operaciones"]'), 1);
    await dia('2026-10-13').click();
    await g.attr('Pulsar un día lo deja marcado', dia('2026-10-13'), 'aria-pressed', 'true');
    await g.partes('…y filtra por ese día', filtros, ['Día: mar 13 oct']);
    await g.txt('…1 operación', meta, '1 operación con este filtro');
    await g.cuenta('…1 fila', filas, 1);
    await quitar('dia').click();
    await g.txt('Quitar la ficha del día devuelve la lista', meta, E.mes.meta);
    await per('semana').click();
    await dia('2026-10-13').click();
    await g.txt('Un día de fuera del periodo también se puede ver (13 oct con «Esta semana»)', meta, '1 operación con este filtro');
    await dia('2026-10-13').click();
    await g.attr('Pulsar otra vez el día quita el filtro', dia('2026-10-13'), 'aria-pressed', 'false');
    await per('mes').click();
    await page.locator('[data-accion="cal-prev"]').click();
    await g.txt('Mes anterior', page.locator('#cal-mes'), 'Septiembre 2026');
    await g.partes('Septiembre sin operaciones', page.locator('#calendario'), ['0 operaciones en septiembre']);
    await g.cuenta('…ningún día pulsable', page.locator('#calendario [data-accion="filtro-dia"]'), 0);
    await page.locator('[data-accion="cal-sig"]').click();
    await page.locator('[data-accion="cal-sig"]').click();
    await g.txt('Mes siguiente (dos veces)', page.locator('#cal-mes'), 'Noviembre 2026');
    await page.getByRole('button', { name: 'Mes anterior' }).click();
    await g.txt('Vuelta a octubre', page.locator('#cal-mes'), 'Octubre 2026');
  });

  await g.seccion('Resumen: mapa «Cuándo operas mejor»', async () => {
    const c = (s, d) => page.locator(`#mapa [data-accion="filtro-mapa"][data-sesion="${s}"][data-dow="${d}"]`);
    await g.cuenta('8 casillas con operaciones', page.locator('#mapa [data-accion="filtro-mapa"]'), 8);
    await g.attr('NY, lunes', c('NY', 1), 'aria-label', 'NY, lunes: +800 $ en 2 operaciones');
    await g.attr('NY, martes', c('NY', 2), 'aria-label', 'NY, martes: +160 $ en 3 operaciones');
    await g.attr('NY, jueves', c('NY', 4), 'aria-label', 'NY, jueves: +404 $ en 2 operaciones');
    await g.attr('Londres, jueves', c('Londres', 4), 'aria-label', 'Londres, jueves: +240 $ en 1 operación');
    await g.attr('Asia, miércoles', c('Asia', 3), 'aria-label', 'Asia, miércoles: −120 $ en 1 operación');
    await g.cuenta('Casilla vacía', page.locator('#mapa [aria-label="Asia, lunes: sin operaciones"]'), 1);
    await c('NY', 1).click();
    await g.attr('Pulsar una casilla la deja marcada', c('NY', 1), 'aria-pressed', 'true');
    await g.partes('…y filtra por sesión y día', filtros, ['Sesión de NY, lunes']);
    await g.txt('…2 operaciones', meta, '2 operaciones con este filtro');
    await c('NY', 1).click();
    await g.txt('Pulsarla otra vez quita el filtro', meta, E.mes.meta);
    await c('Londres', 4).click();
    await g.txt('Otra casilla (Londres, jueves): 1 operación', meta, '1 operación con este filtro');
    await quitar('mapa').click();
    await g.txt('Quitar la ficha de sesión devuelve la lista', meta, E.mes.meta);
    await g.attr('…y desmarca la casilla', c('Londres', 4), 'aria-pressed', 'false');
  });

  await g.seccion('Resumen: rendimiento por setup', async () => {
    const s = (n) => page.locator(`#setups [data-accion="filtro-setup"][data-setup="${n}"]`);
    await g.igual('Setups ordenados de más a menos resultado', async () => (await page.locator('#setups [data-accion="filtro-setup"]').evaluateAll((a) => a.map((b) => b.dataset.setup))).join(' | '), E.setups.join(' | '));
    await g.partes('Patrón Gonzi', s('Patrón Gonzi'), ['Patrón Gonzi', '3 operaciones, 100 % acierto', '+1.400 $']);
    await g.partes('Agotamiento de Big Trade', s('Agotamiento de Big Trade'), ['2 operaciones, 100 % acierto', '+850 $']);
    await g.partes('Imbalance', s('Imbalance'), ['3 operaciones, 33 % acierto', '−60 $']);
    await g.partes('Divergencia', s('Divergencia'), ['2 operaciones, 0 % acierto', '−256 $']);
    await s('Patrón Gonzi').click();
    await g.attr('Pulsar un setup lo deja marcado', s('Patrón Gonzi'), 'aria-pressed', 'true');
    await g.partes('…y filtra', filtros, ['Setup: Patrón Gonzi']);
    await g.txt('…3 operaciones', meta, '3 operaciones con este filtro');
    await page.locator('#mapa [data-accion="filtro-mapa"][data-sesion="NY"][data-dow="1"]').click();
    await g.txt('Filtros combinados (Gonzi + NY lunes): 1 operación', meta, '1 operación con este filtro');
    await quitar('setup').click();
    await g.txt('Quitar solo el setup deja el de sesión', meta, '2 operaciones con este filtro');
    await quitar('todo').click();
    await g.txt('Quitar filtros', meta, E.mes.meta);
  });

  await g.seccion('Resumen: cinta de últimas operaciones y comentarios', async () => {
    await g.visible('La cinta se ve', page.locator('#ticker-caja'));
    await g.partes('Título de la cinta', page.locator('#ticker-caja'), ['Últimas operaciones']);
    const tk = page.locator('#ticker-caja [data-accion="ir-op"]');
    await g.cuenta('10 operaciones en la cinta (y su copia para el bucle)', tk, 20);
    await g.attr('La primera es la más reciente', tk.first(), 'aria-label', 'NQ largo del 29 oct, +500 $, Patrón Gonzi');
    await tk.first().focus(); await page.keyboard.press('Enter'); // la cinta se mueve: se activa con el teclado
    await g.attr('Pulsar una operación de la cinta abre su detalle', page.locator('#tabla [data-accion="detalle"][data-id="e14"]'), 'aria-expanded', 'true');
    await page.locator('#tabla [data-accion="detalle"][data-id="e14"]').click();
    await g.attr('…y se puede volver a plegar', page.locator('#tabla [data-accion="detalle"][data-id="e14"]'), 'aria-expanded', 'false');
    await g.partes('Comentarios de Alex: los cuatro últimos, del más reciente al más antiguo', page.locator('#comentarios'), ['Alex', 'en tu operación del 28 oct, Giro por perfil', 'El perfil no estaba formado todavía. Espera a que el valor se defina.', 'en tu operación del 22 oct, Divergencia', 'en tu operación del 14 oct, Imbalance', 'en tu operación del 9 oct, Imbalance', 'Buena salida. Gestionar también es esto.']);
    await g.cuenta('Cuatro enlaces «Ver operación»', page.locator('#comentarios [data-accion="ir-op"]'), 4);
    await page.locator('#comentarios [data-accion="ir-op"]').first().click();
    await g.attr('«Ver operación» abre la del comentario (28 oct)', page.locator('#tabla [data-accion="detalle"][data-id="e13"]'), 'aria-expanded', 'true');
    await g.partes('…con el comentario de Alex dentro', page.locator('#det-e13'), ['Sin nota.', 'Comentario de Alex', 'El perfil no estaba formado todavía. Espera a que el valor se defina.']);
    await page.locator('#tabla [data-accion="detalle"][data-id="e13"]').click();
  });

  await g.seccion('Resumen: lista de operaciones, detalle y visor de capturas', async () => {
    await g.igual('Operaciones de la más reciente a la más antigua', async () => (await filas.evaluateAll((a) => a.map((b) => b.dataset.id))).join(','), 'e14,e13,e12,e11,e10,e9,e8,e7,e6,e5,e4,e3,e2,e1');
    await g.partes('Fila del 29 oct', page.locator('#fila-e14'), ['jue 29 oct', '15:45', 'Ejemplo', 'NY', 'NQ', 'Largo', 'Patrón Gonzi', '1', '+500 $', '+2,1 R']);
    await g.partes('Fila del 8 oct (5 micros en Londres)', page.locator('#fila-e3'), ['jue 8 oct', '09:26', 'Londres', 'MNQ', 'Largo', 'Rechazo Call Wall / Put Wall', '5', '+240 $', '+1,6 R']);
    await g.cumple('Las 14 miniaturas de captura se cargan', () => page.locator('#tabla img[data-cap]').evaluateAll((a) => a.filter((i) => /^data:image\//.test(i.getAttribute('src') || '')).length), (n) => n === 14);
    const b = await abrirDetalle(page, 'e14');
    await g.attr('Abrir el detalle', b, 'aria-expanded', 'true');
    await g.partes('Detalle del 29 oct', page.locator('#det-e14'), ['Resultado', '+500 $', 'con 1 contrato de NQ (Nasdaq 100), sesión de NY.', 'Entrada a las 15:45 · Stop de 12 puntos · riesgo 240 $ · ', '+2,1 R', 'Tu nota', 'Esperé la confirmación del patrón. Paciencia.', 'Comentario de Alex', 'Todavía sin revisar.', 'Editar operación', 'Borrar operación']);
    await abrirDetalle(page, 'e6');
    await g.partes('Detalle sin stop (14 oct)', page.locator('#det-e6'), ['−120 $', 'con 5 contratos de MNQ (Micro Nasdaq 100), sesión de Asia.', 'Entrada a las 02:55 · Sin stop apuntado', 'Fuera de horario y fuera de plan. Esta no se repite.']);
    await g.cuenta('Dos detalles abiertos a la vez', page.locator('#tabla [data-accion="detalle"][aria-expanded="true"]'), 2);
    await page.locator('#fila-e14 [data-accion="ver-captura"]').click();
    await g.visible('La miniatura abre el visor', page.locator('#visor'));
    await g.txt('Título del visor', page.locator('#visor-t'), 'NQ largo, jue 29 oct, Patrón Gonzi, +500 $');
    await g.cumple('El visor muestra la imagen', () => page.locator('#visor-img').evaluate((i) => (i.getAttribute('src') || '').slice(0, 23) + '|' + (i.complete && i.naturalWidth > 0)), (t) => t === 'data:image/jpeg;base64,|true');
    await g.attr('Texto alternativo de la captura', page.locator('#visor-img'), 'alt', 'Captura de ATAS de la operación del 29 oct');
    await page.keyboard.press('Escape');
    await g.oculto('Esc cierra el visor', page.locator('#visor'));
    await page.locator('#det-e14 [data-accion="ver-captura"]').click();
    await g.visible('La captura del detalle también abre el visor', page.locator('#visor'));
    await page.getByRole('button', { name: 'Cerrar captura' }).click();
    await g.oculto('El botón de cerrar cierra el visor', page.locator('#visor'));
    await page.locator('#tabla [data-accion="detalle"][data-id="e14"]').click();
    await page.locator('#tabla [data-accion="detalle"][data-id="e6"]').click();
    await g.cuenta('Detalles plegados', page.locator('#tabla [data-accion="detalle"][aria-expanded="true"]'), 0);
  });

  await g.seccion('Resumen: curva de resultados con teclado y ratón', async () => {
    const svg = page.locator('#curva [role="img"]'), tip = page.locator('#curva').getByText(/^Acumulado/);
    await svg.scrollIntoViewIfNeeded();
    await g.oculto('Sin dato de punto al empezar', tip);
    await svg.focus();
    await page.keyboard.press('ArrowRight');
    await g.partes('Flecha derecha: primer punto (5 oct)', page.locator('#curva'), ['lun 5 oct, NQ largo', 'Agotamiento de Big Trade', '+400 $', 'Acumulado +400 $', 'Pulsa para ver la operación']);
    await g.visible('…y el dato se ve', tip);
    await page.keyboard.press('ArrowRight');
    await g.partes('Flecha derecha: segundo punto (6 oct)', page.locator('#curva'), ['mar 6 oct, NQ corto', 'Divergencia', '−160 $', 'Acumulado +240 $']);
    await page.keyboard.press('ArrowLeft');
    await g.partes('Flecha izquierda: vuelve al primero', page.locator('#curva'), ['lun 5 oct, NQ largo', 'Acumulado +400 $']);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await g.attr('Intro abre la operación del punto (6 oct)', page.locator('#tabla [data-accion="detalle"][data-id="e2"]'), 'aria-expanded', 'true');
    await page.locator('#tabla [data-accion="detalle"][data-id="e2"]').click();
    await svg.scrollIntoViewIfNeeded();
    const caja = await svg.boundingBox();
    await page.mouse.move(caja.x + caja.width - 3, caja.y + caja.height / 2);
    await g.partes('Ratón en el extremo derecho: último punto', page.locator('#curva'), ['jue 29 oct, NQ largo', 'Patrón Gonzi', '+500 $', 'Acumulado +2.234 $']);
    await page.mouse.move(caja.x + 2, caja.y + caja.height / 2);
    await g.partes('Ratón en el extremo izquierdo: primer punto', page.locator('#curva'), ['lun 5 oct, NQ largo', 'Acumulado +400 $']);
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height + 160);
    await g.oculto('Al salir el ratón se oculta el dato', tip);
    await page.mouse.click(caja.x + caja.width - 3, caja.y + caja.height / 2);
    await g.attr('Pulsar un punto abre su operación (29 oct)', page.locator('#tabla [data-accion="detalle"][data-id="e14"]'), 'aria-expanded', 'true');
    await page.locator('#tabla [data-accion="detalle"][data-id="e14"]').click();
  });

  await g.seccion('Resumen: avisos, cuenta, rutina y errores sin datos propios', async () => {
    await g.partes('Aviso del plan del último día operado', page.locator('#avisos-diario'), ['Jue 29 oct: cumpliste todo el plan.', 'Así se construye la consistencia.', 'Ver el plan']);
    await g.cuenta('…que enlaza con Plan e IA', page.locator('#avisos-diario a[href="#diario/plan"]'), 1);
    await g.tiene('Franja de hoy: cuenta sin configurar y sesión sin preparar', page.locator('#hoy-fila'), [['Configura tu cuenta de fondeo', 'Configurar'], ['Tu sesión de hoy', 'Antes de operar, prepara la sesión. Son treinta segundos.'], 'Preparar sesión', 'Cerrar sesión']);
    await g.txt('Errores: todavía ninguno marcado', page.locator('#errores'), 'Marca los errores en tus operaciones y aquí verás cuánto te cuesta cada uno.');
    await g.visible('Aviso de operaciones de ejemplo con su botón', page.locator('#aviso-ejemplo [data-accion="borrar-ejemplos"]'));
  });

  await g.seccion('Estadísticas: se pintan con los datos de ejemplo', async () => {
    await pestana('Estadísticas').click();
    const est = page.locator('#est');
    await g.partes('Cabecera del periodo', v, ['Tus números de octubre']);
    await g.tiene('Tarjetas: neto, expectativa, profit factor y drawdown', est, [['Resultado neto', '+2.234 $', '14 operaciones'], ['Expectativa', '+160 $', 'lo que ganas de media por operación'], ['Profit factor', '4,12', 'ganas 4,12 $ por cada dólar que pierdes'], ['Drawdown máximo', '−180 $', 'la mayor caída desde un máximo, hasta el 20 oct']]);
    await g.tiene('Números clave', est, [['Números clave', '14 días operados'], 'Acierto 57 % 8 de 14', 'Ganancia media +369 $', 'Pérdida media −119 $', 'Ratio ganancia / pérdida 3,09', 'Mayor ganancia +500 $', 'Mayor pérdida −180 $', 'Racha ganadora máxima 2 seguidas', 'Racha perdedora máxima 1 operación', 'Días en verde 8 de 14 57 % de los días', 'Media por día +160 $', 'Operaciones por día 1', 'Contratos por operación 1,9', 'Duración media ganadoras 19 min', 'Duración media perdedoras 21 min', 'Comisiones −', 'Mejor día +500 $']);
    await g.tiene('Números en R', est, ['Expectativa en R +0,7 R', ['Riesgo medio 208 $', 'en 13 de 14 operaciones'], 'Ganadora media en R +1,6 R', 'Perdedora media en R −0,7 R']);
    await g.partes('Desglose por dirección', est, ['Desglose', 'Dirección', 'Cortos', '5', '40 %', '+224 $', '+45 $', 'Largos', '9', '67 %', '+2.010 $', '+223 $']);
    await g.partes('Desglose por sesión', est, ['Sesión', 'Asia', '1', '0 %', '−120 $', '−120 $', 'Londres', '2', '100 %', '+400 $', '+200 $', 'NY', '11', '55 %', '+1.954 $', '+178 $']);
    await g.partes('Desglose por instrumento', est, ['Instrumento', 'NQ', '9', '67 %', '+1.970 $', '+219 $', 'MNQ', '3', '33 %', '+24 $', '+8 $', 'ES', '1', '100 %', '+300 $', '+300 $', 'MES', '1', '0 %', '−60 $', '−60 $']);
    const barra = (t) => est.locator(`[role="img"][aria-label="${t}"]`);
    // Nota: la app escribe «1 operaciones» en la etiqueta accesible de las barras (ver findings); aquí se refleja tal cual.
    for (const t of ['De 2 a 3: −120 $ en 1 operaciones', 'De 9 a 10: +400 $ en 2 operaciones', 'De 15 a 16: +1.054 $ en 9 operaciones', 'De 16 a 17: +900 $ en 2 operaciones', 'De 3 a 4: sin operaciones',
      'Lunes: +800 $ en 2 operaciones', 'Martes: +320 $ en 4 operaciones', 'Miércoles: +270 $ en 3 operaciones', 'Jueves: +644 $ en 3 operaciones', 'Viernes: +200 $ en 2 operaciones',
      'De −200 $ a −100 $: 3 operaciones', 'De −100 $ a 0 $: 3 operaciones', 'De 0 $ a +100 $: 0 operaciones', 'De +400 $ a +500 $: 3 operaciones', 'De +500 $ a +600 $: 2 operaciones']) await g.cuenta(`Gráfico · ${t}`, barra(t), 1, 2500);
    await g.cuenta('Barras en total (15 horas + 5 días + 8 tramos)', est.locator('[role="img"][data-tip]'), 28);
    const tip = page.locator('#tip-g');
    await barra('De 15 a 16: +1.054 $ en 9 operaciones').focus();
    await g.visible('Enfocar una barra muestra su dato', tip);
    await g.partes('…con el detalle de la hora', tip, ['15:00 a 15:59', '+1.054 $ en 9 operaciones', '44 % de acierto']);
    await barra('Lunes: +800 $ en 2 operaciones').hover();
    await g.partes('Pasar el ratón por otra barra cambia el dato', tip, ['Lunes', '+800 $ en 2 operaciones', '100 % de acierto']);
    await barra('De 15 a 16: +1.054 $ en 9 operaciones').blur();
    await page.mouse.move(5, 5);
    await g.oculto('Al salir se oculta', tip);
    await g.txt('Errores en estadísticas: todavía ninguno', page.locator('#est-errores'), 'Marca los errores en tus operaciones y aquí verás cuánto te cuesta cada uno.');
    await g.partes('«Cómo llegas y cómo te va» sin rutinas', est, ['Cómo llegas y cómo te va', 'Cuando prepares tus sesiones (sueño y ánimo de 1 a 5) verás aquí si tu resultado cambia según cómo llegas.']);
    await per('semana').click();
    await g.partes('Estadísticas de esta semana', v, ['Tus números de esta semana', 'Resultado neto', '+1.000 $', '4 operaciones', 'Expectativa', '+250 $', 'Profit factor', '17,67', 'Drawdown máximo', '−60 $', 'hasta el 28 oct', '4 días operados', 'Acierto', '75 %', '3 de 4']);
    await per('todo').click();
    await g.partes('Estadísticas de todo', v, ['Tus números desde que empezaste', '+2.234 $', '14 operaciones']);
    await per('mes').click();
    await g.partes('Vuelta a este mes', v, ['Tus números de octubre', '+2.234 $']);
  });

  await g.seccion('Plan e IA: plan de ejemplo, cumplimiento y agente', async () => {
    await pestana('Plan e IA').click();
    const cu = page.locator('#cumple'), ia = page.locator('#ia-cuerpo');
    await g.partes('Cabecera del plan', page.locator('#form-plan'), ['Tu plan de trading', 'Actualizado el 4 oct']);
    for (const [id, val] of [['pl-perdida', '600'], ['pl-riesgo', '300'], ['pl-contratos', '2'], ['pl-ops', '3'], ['pl-racha', '2'], ['pl-objetivo', ''], ['pl-desde', '15:30'], ['pl-hasta', '18:30']]) await g.valor(`Plan · ${id} = «${val}»`, page.locator('#' + id), val, 2500);
    const marcados = (n) => page.locator(`#form-plan input[name="${n}"]:checked`).evaluateAll((a) => a.map((i) => i.value).join(','));
    await g.igual('Plan · días L a V', () => marcados('pl-dia'), '1,2,3,4,5');
    await g.igual('Plan · instrumentos', () => marcados('pl-ins'), 'NQ,ES,MNQ,MES');
    await g.igual('Plan · setups (todos menos Divergencia)', () => marcados('pl-set'), 'Imbalance,Patrón Gonzi,Rechazo Call Wall / Put Wall,Giro por perfil,Agotamiento de Big Trade');
    await g.marcado('Plan · stop en cada operación', page.locator('#pl-stop'));
    await g.marcado('Plan · registro de setup y nota', page.locator('#pl-registro'));
    await g.cumple('Plan · texto con sus palabras', () => page.locator('#pl-texto').inputValue(), (t) => t.startsWith('Opero la apertura de Nueva York, de 15:30 a 18:30.'));
    await g.partes('Cumplimiento: 8 de 14 días y 93 % regla a regla', cu, ['57%', '8 de 14 días', 'cumpliste todo el plan.', 'Contando regla a regla, un 93 %.']);
    await g.cuenta('Un botón por día operado', cu.locator('[data-accion="plan-dia"]'), 14);
    await g.partes('Reglas que más se rompen', cu, ['Las reglas que más rompes', 'Contratos máximos', '4 días', 'Horario', '3 días', 'Setups del plan', '2 días']);
    await g.partes('Detalle del último día (29 oct): todo cumplido', cu, ['Jue 29 oct', '+500 $ · 1 operación', 'Pérdida máxima diaria', ': cumplida', 'El día no llegó a estar en negativo. Tu límite: −600 $.', 'Horario', 'Todas las entradas dentro de tu horario (15:30 a 18:30).', 'Registrar setup y nota', 'Todas las operaciones con su setup y su nota.']);
    await g.sinTexto('…ninguna regla rota ese día', cu, ': rota');
    const d22 = cu.locator('[data-accion="plan-dia"][data-fecha="2026-10-22"]');
    await g.attr('Etiqueta del 22 oct', d22, 'aria-label', 'jue 22 oct: 2 reglas rotas, −96 $');
    await d22.click();
    await g.attr('Pulsar un día lo selecciona', cu.locator('[data-accion="plan-dia"][data-fecha="2026-10-22"]'), 'aria-pressed', 'true');
    await g.partes('Detalle del 22 oct: contratos y setup', cu, ['Jue 22 oct', '−96 $ · 1 operación', 'Contratos máximos', ': rota', 'Entraste con más de 2 contratos en la de las 15:57 (hasta 4).', 'Setups del plan', ': rota', 'Una entrada con setups fuera de tu plan: Divergencia.']);
    await g.partes('Detalle del 14 oct (sin stop, 5 contratos, de madrugada)', (await cu.locator('[data-accion="plan-dia"][data-fecha="2026-10-14"]').click(), cu), ['Mié 14 oct', '−120 $', 'Stop en cada operación', ': rota', 'Una operación no tiene el stop apuntado (la de las 02:55).', 'Contratos máximos', ': rota', 'Horario', ': rota', 'Fuera de tu horario (15:30 a 18:30): la de las 02:55.']);
    await cu.locator('[data-accion="plan-dia"][data-fecha="2026-10-22"]').click();
    await g.partes('Agente: informe de ejemplo', ia, ['Ejemplo', 'Parte del jue 22 oct', '4', '/10', '−96 $', 'Divergencia sola otra vez, y con el doble de contratos', 'Lo que hiciste bien', 'Lo que tienes que corregir', 'Contratos máximos', 'Setups del plan', 'Patrones', 'Para tu próxima sesión']);
    const an = (t) => ia.locator(`[data-accion="analizar"][data-tipo="${t}"]`);
    await g.txt('El botón de análisis sigue al día elegido', an('dia'), 'Analizar el 22 oct');
    await an('dia').click();
    await g.toast(page, 'En agxcommunity.com la IA analiza tus operaciones reales', 'Pedir el análisis del día en modo ejemplo: aviso, sin error');
    await an('semana').click();
    await g.toast(page, 'En agxcommunity.com la IA analiza tus operaciones reales', 'Pedir el análisis de la semana en modo ejemplo: aviso, sin error');
    await g.cuenta('…y el informe de ejemplo sigue ahí', ia.getByText('Parte del jue 22 oct'), 1);
    await g.partes('Cuenta de fondeo sin configurar', page.locator('section[aria-labelledby="t-cta"]'), ['Tu cuenta de fondeo', 'Sin configurar', 'Firma', 'Drawdown máximo', 'Guardar cuenta']);
  });

  await g.seccion('Plan e IA: editar y guardar el plan', async () => {
    const estado = page.locator('#pl-estado'), cu = page.locator('#cumple');
    await page.locator('#pl-contratos').fill('5');
    await g.txt('Al tocar un campo avisa de cambios sin guardar', estado, 'Cambios sin guardar');
    await page.locator('#pl-hasta').fill('');
    await page.locator('#form-plan').getByRole('button', { name: 'Guardar plan' }).click();
    await g.txt('Validación: horario a medias', estado, 'Pon la hora de inicio y la de fin, o deja las dos vacías.');
    await page.locator('#pl-hasta').fill('18:30');
    await etiqueta(page, '#form-plan input[name="pl-set"][value="Divergencia"]').click();
    await g.marcado('Se añade Divergencia a los setups del plan', page.locator('#form-plan input[name="pl-set"][value="Divergencia"]'));
    await page.locator('#form-plan').getByRole('button', { name: 'Guardar plan' }).click();
    await g.toast(page, 'Plan guardado');
    await g.txt('Estado tras guardar: 11 reglas y el texto', estado, 'Guardado. La IA comprobará 11 reglas y tu texto.');
    await g.partes('Fecha de actualización', page.locator('#form-plan'), ['Actualizado el 30 oct']);
    // Con 5 contratos y Divergencia permitidos dejan de romperse contratos y setups: cumplen 10 de 14 días; quedan 5 reglas rotas de 154 → 97 %.
    await g.partes('El cumplimiento se recalcula con el plan nuevo', cu, ['71%', '10 de 14 días', 'Contando regla a regla, un 97 %.', 'Las reglas que más rompes', 'Horario', '3 días', 'Stop en cada operación', '1 día', 'Registrar setup y nota', '1 día']);
    await page.reload();
    await g.valor('El plan guardado se conserva al recargar', page.locator('#pl-contratos'), '5');
    await g.marcado('…con el setup añadido', page.locator('#form-plan input[name="pl-set"][value="Divergencia"]'));
    await g.partes('…y su cumplimiento', page.locator('#cumple'), ['10 de 14 días']);
  });
  cierre(g);
}

/* =====================================================================================================
 * GRUPO 2 · Diario: objetivo, nueva operación, editar, borrar, cuenta de fondeo, rutina, errores e importar
 * ===================================================================================================== */
async function gDiarioEscritura(g, env) {
  const xlsx = { modo: 'cortado' };
  const { page } = await contexto(g, env, { nombre: 'diario-escritura', xlsx, tolera: [/cdnjs\.cloudflare\.com/] });
  const v = page.locator('#vista');
  const per = (k) => v.locator(`[data-accion="periodo"][data-periodo="${k}"]`);
  const filas = page.locator('#tabla [data-accion="detalle"]');
  const neto = page.locator('#hero-neto'), sub = page.locator('#hero-sub'), meta = page.locator('#ops-meta');
  const cajon = page.locator('#cajon'), err = page.locator('#form-error'), guardar = page.locator('#btn-guardar-op');
  const pestana = (n) => page.getByRole('navigation', { name: 'Secciones del diario' }).getByRole('link', { name: n });
  const PNG = { name: 'captura-atas.png', mimeType: 'image/png', buffer: env.png };
  const radio = (n, val) => etiqueta(page, `#form-op input[name="${n}"][value="${val}"]`);
  const nueva = () => page.getByRole('button', { name: 'Nueva operación' }).click();
  await page.goto(BASE);
  await g.attr('Punto de partida: datos de ejemplo de octubre', neto, 'aria-label', 'Resultado neto en octubre: +2.234 $');

  await g.seccion('Objetivo del mes', async () => {
    const chips = page.locator('#hero-chips');
    await chips.locator('[data-accion="editar-obj"]').click();
    const campo = page.getByLabel('Objetivo de octubre');
    await g.valor('«Cambiar» abre el campo con el objetivo actual', campo, '3000');
    await g.igual('…con el foco dentro', () => page.evaluate(() => document.activeElement && document.activeElement.id), 'obj-in');
    await page.keyboard.press('Escape');
    await g.cuenta('Esc cancela la edición', page.locator('#obj-in'), 0);
    await chips.locator('[data-accion="editar-obj"]').click();
    await page.locator('#obj-in').fill('0');
    await page.keyboard.press('Enter');
    await g.cuenta('Un objetivo de 0 no se acepta', page.locator('#obj-in'), 1);
    await page.locator('#obj-in').fill('4000');
    await chips.getByRole('button', { name: 'Guardar' }).click();
    await g.toast(page, 'Objetivo guardado');
    await g.partes('La ficha se recalcula: 2.234 de 4.000 = 56 %', chips, ['Objetivo de octubre', '56 %', '2.234 $ de 4.000 $']);
    await page.reload();
    await g.partes('El objetivo se conserva al recargar', page.locator('#hero-chips'), ['56 %', '2.234 $ de 4.000 $']);
  });

  let N1 = null;
  await g.seccion('Nueva operación: abrir, validaciones, contratos, riesgo y R', async () => {
    await nueva();
    await g.visible('El botón abre el cajón', cajon);
    await g.txt('Título del cajón', page.locator('#t-nueva'), 'Nueva operación');
    await g.valor('Fecha de hoy por defecto', page.locator('#f-fecha'), '2026-10-30');
    await g.igual('Foco en la fecha', () => page.evaluate(() => document.activeElement && document.activeElement.id), 'f-fecha');
    await g.txt('Botón de guardar', guardar, 'Guardar operación');
    await g.cuenta('Ocho instrumentos', page.locator('#form-op input[name="f-inst"]'), 8);
    await g.cuenta('Seis setups', page.locator('#form-op input[name="f-setup"]'), 6);
    await g.cuenta('Diez errores para marcar', page.locator('#form-op input[name="f-err"]'), 10);
    await page.keyboard.press('Escape');
    await g.oculto('Esc cierra el cajón', cajon);
    await page.keyboard.press('n');
    await g.visible('La tecla N lo abre', cajon);
    await cajon.getByRole('button', { name: 'Cancelar' }).click();
    await g.oculto('«Cancelar» lo cierra', cajon);
    await nueva();
    await cajon.getByRole('button', { name: 'Cerrar' }).click();
    await g.oculto('La X lo cierra', cajon);
    await nueva();
    await page.locator('#capa').click({ position: { x: 20, y: 20 } });
    await g.oculto('Pulsar fuera, sobre el fondo, lo cierra', cajon);
    await nueva();
    await guardar.focus(); await page.keyboard.press('Tab');
    await g.igual('El tabulador no sale del cajón: del último control pasa al primero', () => page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label')), 'Cerrar');
    await page.keyboard.press('Shift+Tab');
    await g.igual('…y con Mayús+Tab, del primero al último', () => page.evaluate(() => document.activeElement && document.activeElement.id), 'btn-guardar-op');

    await guardar.click();
    await g.txt('Validación: falta el setup', err, 'Elige el setup de la operación.');
    await g.visible('…el error se ve', err);
    await radio('f-setup', 'Divergencia').click();
    await g.marcado('Se elige el setup', page.locator('#form-op input[name="f-setup"][value="Divergencia"]'));
    await g.oculto('Al corregir se quita el error', err);
    await guardar.click();
    await g.txt('Validación: falta el importe', err, 'Falta el importe ganado o perdido, en dólares.');
    await page.locator('#f-imp').fill('abc');
    await guardar.click();
    await g.txt('Validación: importe que no es un número', err, 'Falta el importe ganado o perdido, en dólares.');
    await page.locator('#f-imp').fill('100');
    await guardar.click();
    await g.txt('Validación: falta la captura', err, 'Falta la captura de ATAS de la entrada.');
    await page.locator('#f-stop').fill('abc');
    await guardar.click();
    await g.txt('Validación: stop no numérico', err, 'El stop tiene que ser un número de puntos, por ejemplo 15.');
    await page.locator('#f-stop').fill('10');
    await page.locator('#f-ct').fill('0');
    await guardar.click();
    await g.txt('Validación: cero contratos', err, 'Pon al menos 1 contrato.');
    await page.locator('#f-ct').fill('1');
    await page.locator('#f-fecha').fill('');
    await guardar.click();
    await g.txt('Validación: falta la fecha', err, 'Falta la fecha.');
    await page.locator('#f-fecha').fill('2026-10-30');

    const mas = cajon.getByRole('button', { name: 'Un contrato más' }), menos = cajon.getByRole('button', { name: 'Un contrato menos' });
    await mas.click(); await mas.click();
    await g.valor('Contratos: + dos veces → 3', page.locator('#f-ct'), '3');
    await menos.click(); await menos.click(); await menos.click();
    await g.valor('Contratos: − no baja de 1', page.locator('#f-ct'), '1');
    await mas.click();
    await g.valor('Contratos: 2', page.locator('#f-ct'), '2');
    await g.valor('Riesgo automático en NQ: 10 pts × 20 $ × 2 = 400', page.locator('#f-riesgo'), '400');
    await radio('f-inst', 'MNQ').click();
    await g.valor('Riesgo automático en MNQ: 10 pts × 2 $ × 2 = 40', page.locator('#f-riesgo'), '40');
    await g.txt('Ganada de 100 $: resultado en R = 100/40', page.locator('#f-r'), '+2,5 R');
    await g.txt('…pie del cajón', page.locator('#pie-res'), '+100 $');
    await g.txt('…texto de ayuda del importe', page.locator('#calculo'), 'Ganancia con 2 contratos de MNQ.');
    await radio('f-res', 'P').click();
    await g.txt('Perdida: R negativa', page.locator('#f-r'), '−2,5 R');
    await g.txt('…pie del cajón', page.locator('#pie-res'), '−100 $');
    await g.txt('…texto de ayuda', page.locator('#calculo'), 'Pérdida con 2 contratos de MNQ.');
    await page.locator('#f-imp').fill('0');
    await g.txt('Importe 0: break even', page.locator('#calculo'), 'Operación en break even.');
    await page.locator('#f-imp').fill('100');
    await page.locator('#f-riesgo').fill('50');
    await g.txt('Riesgo escrito a mano: R = −100/50', page.locator('#f-r'), '−2,0 R');
    await page.locator('#f-stop').fill('12');
    await g.valor('…y ya no se pisa al cambiar el stop', page.locator('#f-riesgo'), '50');
    await page.locator('#f-riesgo').fill('mucho');
    await guardar.click();
    await g.txt('Validación: riesgo no numérico', err, 'El riesgo tiene que ser un importe en dólares, por ejemplo 300.');
    await page.locator('#f-riesgo').fill('');
    await g.valor('Al borrarlo vuelve el automático: 12 × 2 × 2 = 48', page.locator('#f-riesgo'), '48');
    // ERROR ACTUAL DE LA APP (ver findings): al salir del campo, ese valor automático queda fijado como si se hubiera escrito
    // a mano y deja de seguir al stop. La prueba no depende de ello: escribe el riesgo que toca, como haría el alumno.
    await page.locator('#f-stop').fill('10');
    await page.locator('#f-riesgo').fill('40');
    await g.txt('Stop 10 y riesgo 40: R = −100/40', page.locator('#f-r'), '−2,5 R');
    await radio('f-sesion', 'Londres').click();
    await radio('f-sesion', 'NY').click();
    await g.marcado('Sesión NY', page.locator('#f-ses-ny'));
    await radio('f-dir', 'C').click();
    await g.marcado('Dirección: corto', page.locator('#f-dir-c'));
    await page.locator('#f-hora').fill('16:05');
    await page.locator('#f-nota').fill('Prueba e2e: entrada tarde');
    await radio('f-err', 'fomo').click();
    await radio('f-err', 'revancha').click();
    await g.igual('Errores marcados', () => page.locator('#form-op input[name="f-err"]:checked').evaluateAll((a) => a.map((i) => i.value).join(',')), 'fomo,revancha');
  });

  await g.seccion('Nueva operación: captura adjunta y guardado', async () => {
    const previa = page.getByAltText('Vista previa de la captura de ATAS');
    await page.locator('#f-cap').setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('no soy una imagen') });
    await g.txt('Un archivo que no es imagen se rechaza', err, 'Eso no es una imagen. Sube la captura en PNG o JPG.');
    const [selector] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#zona-cap [data-accion="elegir-captura"]').click()]);
    await selector.setFiles(PNG);
    await g.visible('Elegir la imagen con el botón: aparece la vista previa', previa);
    await g.oculto('…y se quita el error', err);
    await g.txt('Botón para cambiarla', page.locator('#zona-cap [data-accion="elegir-captura"]'), 'Cambiar imagen');
    await page.locator('#zona-cap [data-accion="quitar-captura"]').click();
    await g.oculto('«Quitar» la elimina', previa);
    await g.partes('…y vuelve la zona de subida', page.locator('#zona-cap'), ['Sube la captura de ATAS']);
    await soltar(page, '#zona-cap', PNG);
    await g.visible('Arrastrar y soltar la imagen también vale', previa);
    await page.locator('#zona-cap [data-accion="quitar-captura"]').click();
    await pegar(page, PNG);
    await g.visible('Pegarla con Ctrl+V también', previa);
    await guardar.click();
    await g.oculto('Guardar cierra el cajón', cajon);
    await g.toast(page, 'Operación guardada');
    const mia = page.locator('#tabla [data-accion="detalle"][data-id^="t"]');
    await g.cuenta('La operación nueva aparece en la lista', mia, 1);
    N1 = await mia.getAttribute('data-id');
    await g.igual('…la primera', async () => (await filas.first().getAttribute('data-id')) === N1, true);
    await g.partes('Fila nueva', page.locator('#fila-' + N1), ['vie 30 oct', '16:05', 'NY', 'MNQ', 'Corto', 'Divergencia', '2', '−100 $', '−2,5 R']);
    await g.sinTexto('…sin la marca de ejemplo', page.locator('#fila-' + N1), 'Ejemplo');
    await g.attr('Al guardar se abre su detalle', mia, 'aria-expanded', 'true');
    await g.partes('Detalle: resultado, errores, stop, riesgo, R y nota', page.locator('#det-' + N1), ['−100 $', 'con 2 contratos de MNQ (Micro Nasdaq 100), sesión de NY.', 'FOMO / perseguir el precio', 'Revancha', 'Entrada a las 16:05 · Stop de 10 puntos · riesgo 40 $ · ', '−2,5 R', 'Prueba e2e: entrada tarde', 'Todavía sin revisar.']);
    // 2.234 − 100 = 2.134; 15 operaciones, 8 ganadoras → 53 %
    await g.attr('Cambia el resultado del mes', neto, 'aria-label', 'Resultado neto en octubre: +2.134 $');
    await g.txt('…y el recuento', sub, '15 operaciones y 53 % de acierto, sin comisiones.');
    await g.txt('…y la lista', meta, '15 operaciones, este mes');
    await g.partes('…y el calendario (hoy ya tiene operación)', page.locator('#calendario'), ['15 operaciones en octubre', '+2.134 $']);
    await g.attr('…con su celda', page.locator('#calendario [data-accion="filtro-dia"][data-fecha="2026-10-30"]'), 'aria-label', '30 de octubre: −100 $, 1 operación. Ver operaciones de ese día');
    await g.partes('…y la barra lateral (semana: 1.000 − 100)', page.locator('#lat-widgets'), ['Esta semana, 5 operaciones', '+900 $']);
    await g.partes('Lo que te cuestan tus errores', page.locator('#errores'), ['Tus operaciones limpias dan de media', '+160 $', 'las que llevan algún error,', '−100 $', 'Sin esos errores el periodo habría cerrado en', '+2.234 $', 'FOMO / perseguir el precio', '1 operación', '−100 $', 'Revancha', '1 operación', '−100 $']);
    await page.locator(`#fila-${N1} [data-accion="ver-captura"]`).click();
    await g.visible('Ver la captura adjunta en el visor', page.locator('#visor'));
    await g.txt('…con su título', page.locator('#visor-t'), 'MNQ corto, vie 30 oct, Divergencia, −100 $');
    await g.cumple('…y la imagen subida (64×48, convertida a JPEG)', () => page.locator('#visor-img').evaluate((i) => (i.getAttribute('src') || '').slice(0, 23) + '|' + i.naturalWidth + 'x' + i.naturalHeight), (t) => t === 'data:image/jpeg;base64,|64x48');
    await page.keyboard.press('Escape');
    await g.oculto('Esc cierra el visor', page.locator('#visor'));
    await nueva();
    await g.valor('El cajón vuelve vacío: importe', page.locator('#f-imp'), '');
    await g.valor('…nota', page.locator('#f-nota'), '');
    await g.cuenta('…sin setup elegido', page.locator('#form-op input[name="f-setup"]:checked'), 0);
    await g.oculto('…y sin captura', page.getByAltText('Vista previa de la captura de ATAS'));
    await page.keyboard.press('Escape');
    await page.reload();
    await g.cuenta('La operación sigue ahí al recargar', page.locator(`#tabla [data-accion="detalle"][data-id="${N1}"]`), 1);
    await g.cumple('…y su captura se recupera del navegador', () => page.locator(`#fila-${N1} img[data-cap]`).getAttribute('src'), (s) => /^data:image\/jpeg;base64,/.test(s || ''));
  });

  await g.seccion('Operación de otro mes, borrar con «Cancelar» y con «Sí, borrar»', async () => {
    await nueva();
    await page.locator('#f-fecha').fill('2026-09-15');
    await radio('f-setup', 'Imbalance').click();
    await page.locator('#f-imp').fill('300');
    await page.locator('#f-cap').setInputFiles(PNG);
    await g.visible('Captura adjunta', page.getByAltText('Vista previa de la captura de ATAS'));
    await guardar.click();
    await g.toast(page, 'Operación guardada. Cambia el periodo para verla.', 'Guardar una operación de septiembre avisa de que está fuera del periodo');
    await g.txt('…y no entra en «Este mes»', meta, '15 operaciones, este mes');
    await per('todo').click();
    // 2.134 + 300 = 2.434; 16 operaciones, 9 ganadoras → 56 %
    await g.attr('En «Todo» sí cuenta', neto, 'aria-label', 'Resultado neto desde que empezaste: +2.434 $');
    await g.txt('…16 operaciones', sub, '16 operaciones y 56 % de acierto, sin comisiones.');
    const fila = page.locator('[id^="fila-t"]').filter({ hasText: '15 sept' });
    await g.partes('Fila de septiembre (NQ largo por defecto, sin hora)', fila, ['mar 15 sept', 'NY', 'NQ', 'Largo', 'Imbalance', '1', '+300 $']);
    await page.locator('[data-accion="cal-prev"]').click();
    await g.partes('El calendario de septiembre la muestra', page.locator('#calendario'), ['1 operación en septiembre', '+300 $']);
    await page.locator('[data-accion="cal-sig"]').click();
    const N2 = await fila.locator('[data-accion="detalle"]').getAttribute('data-id');
    await fila.locator('[data-accion="detalle"]').click();
    await g.partes('Su detalle: sin stop', page.locator('#det-' + N2), ['+300 $', 'con 1 contrato de NQ (Nasdaq 100), sesión de NY.', 'Sin stop apuntado', 'Sin nota.']);
    await page.locator(`#det-${N2} [data-accion="borrar"]`).click();
    await g.partes('«Borrar operación» pide confirmación', page.locator('#det-' + N2), ['¿Borrar esta operación?', 'Sí, borrar', 'Cancelar']);
    await page.locator(`#det-${N2} [data-accion="borrar-no"]`).click();
    await g.cuenta('«Cancelar» no borra nada', page.locator(`#tabla [data-accion="detalle"][data-id="${N2}"]`), 1);
    await g.visible('…y vuelve el botón de borrar', page.locator(`#det-${N2} [data-accion="borrar"]`));
    await page.locator(`#det-${N2} [data-accion="borrar"]`).click();
    await page.locator(`#det-${N2} [data-accion="borrar-si"]`).click();
    await g.toast(page, 'Operación borrada');
    await g.cuenta('«Sí, borrar» la quita de la lista', page.locator(`#tabla [data-accion="detalle"][data-id="${N2}"]`), 0);
    await g.attr('…y del resultado', neto, 'aria-label', 'Resultado neto desde que empezaste: +2.134 $');
    await per('mes').click();
    await g.txt('Vuelta a este mes', meta, '15 operaciones, este mes');
  });

  await g.seccion('Editar una operación (y cancelar una edición)', async () => {
    await abrirDetalle(page, N1);
    await page.locator(`#det-${N1} [data-accion="editar-op"]`).click();
    await g.visible('«Editar operación» abre el cajón', cajon);
    await g.txt('…con otro título', page.locator('#t-nueva'), 'Editar operación');
    await g.txt('…y otro botón', guardar, 'Guardar cambios');
    await g.valor('Datos cargados: fecha', page.locator('#f-fecha'), '2026-10-30');
    await g.valor('…hora', page.locator('#f-hora'), '16:05');
    await g.valor('…contratos', page.locator('#f-ct'), '2');
    await g.valor('…importe', page.locator('#f-imp'), '100');
    await g.valor('…stop', page.locator('#f-stop'), '10');
    await g.valor('…riesgo', page.locator('#f-riesgo'), '40');
    await g.valor('…nota', page.locator('#f-nota'), 'Prueba e2e: entrada tarde');
    await g.marcado('…instrumento MNQ', page.locator('#form-op input[name="f-inst"][value="MNQ"]'));
    await g.marcado('…corto', page.locator('#f-dir-c'));
    await g.marcado('…perdida', page.locator('#f-res-p'));
    await g.marcado('…setup', page.locator('#form-op input[name="f-setup"][value="Divergencia"]'));
    await g.igual('…errores', () => page.locator('#form-op input[name="f-err"]:checked').evaluateAll((a) => a.map((i) => i.value).join(',')), 'fomo,revancha');
    await g.visible('…y su captura', page.getByAltText('Vista previa de la captura de ATAS'));
    await radio('f-res', 'G').click();
    await page.locator('#f-imp').fill('120');
    await g.txt('R recalculada: 120/40', page.locator('#f-r'), '+3,0 R');
    await guardar.click();
    await g.toast(page, 'Operación actualizada');
    await g.oculto('Guardar cambios cierra el cajón', cajon);
    await g.partes('La fila refleja el cambio', page.locator('#fila-' + N1), ['vie 30 oct', '16:05', 'MNQ', 'Corto', 'Divergencia', '2', '+120 $', '+3,0 R']);
    // 2.234 + 120 = 2.354; 15 operaciones, 9 ganadoras → 60 %
    await g.attr('…y el resultado del mes', neto, 'aria-label', 'Resultado neto en octubre: +2.354 $');
    await g.txt('…y el acierto', sub, '15 operaciones y 60 % de acierto, sin comisiones.');
    await g.partes('…y el coste de los errores', page.locator('#errores'), ['Tus operaciones limpias dan de media', '+160 $', 'las que llevan algún error,', '+120 $', 'FOMO / perseguir el precio', '1 operación', '+120 $', 'Revancha', '+120 $']);
    await g.sinTexto('…ya sin la frase de «sin esos errores»', page.locator('#errores'), 'Sin esos errores');
    await abrirDetalle(page, 'e14');
    await page.locator('#det-e14 [data-accion="editar-op"]').click();
    await g.valor('Editar un ejemplo carga sus datos', page.locator('#f-imp'), '500');
    await g.marcado('…con su setup', page.locator('#form-op input[name="f-setup"][value="Patrón Gonzi"]'));
    await page.locator('#f-imp').fill('999');
    await cajon.getByRole('button', { name: 'Cancelar' }).click();
    await g.partes('Cancelar la edición no cambia la operación', page.locator('#fila-e14'), ['+500 $', '+2,1 R']);
    await nueva();
    await g.txt('Después, «Nueva operación» abre el cajón limpio', page.locator('#t-nueva'), 'Nueva operación');
    await g.valor('…sin importe', page.locator('#f-imp'), '');
    await g.valor('…con la fecha de hoy', page.locator('#f-fecha'), '2026-10-30');
    await page.keyboard.press('Escape');
    await abrirDetalle(page, 'e2');
    await page.locator('#det-e2 [data-accion="borrar"]').click();
    await page.locator('#det-e2 [data-accion="borrar-si"]').click();
    await g.toast(page, 'Operación borrada');
    // Sin e2 (−160): 2.354 + 160 = 2.514; 14 operaciones, 9 ganadoras → 64 %
    await g.attr('Borrar un ejemplo (6 oct, −160 $) sube el resultado', neto, 'aria-label', 'Resultado neto en octubre: +2.514 $');
    await g.txt('…y baja el recuento', sub, '14 operaciones y 64 % de acierto, sin comisiones.');
    await g.cuenta('…y su fila desaparece', page.locator('#fila-e2'), 0);
  });

  const cta = page.locator('section[aria-labelledby="t-cta"]');
  await g.seccion('Cuenta de fondeo: configurar', async () => {
    await page.locator('#hoy-fila a[href="#diario/plan"]').click();
    await g.igual('La tarjeta «Configura tu cuenta» lleva a Plan e IA', () => hashDe(page), '#diario/plan');
    await g.partes('Sin configurar', cta, ['Tu cuenta de fondeo', 'Sin configurar']);
    await cta.getByRole('button', { name: 'Guardar cuenta' }).click();
    await g.txt('Validación: hace falta el drawdown', page.locator('#ct-estado'), 'Pon al menos el drawdown máximo.');
    await page.locator('#ct-firma').fill('Apex');
    await page.locator('#ct-tamano').fill('50000');
    await page.locator('#ct-dd').fill('2500');
    await page.locator('#ct-tipo').selectOption('eod');
    await page.locator('#ct-limite').fill('500');
    await page.locator('#ct-obj').fill('3000');
    await page.locator('#ct-desde').fill('2026-10-01');
    await page.locator('#ct-fase').selectOption('evaluacion');
    await g.marcado('Bloqueo del drawdown marcado por defecto', page.locator('#ct-bloqueo'));
    await cta.getByRole('button', { name: 'Guardar cuenta' }).click();
    await g.toast(page, 'Cuenta guardada');
    // Solo cuentan las operaciones propias (no las de ejemplo): la del 30 oct, +120 $.
    // Trailing de fin de día: pico 0 → suelo −2.500; margen 120 + 2.500 = 2.620 (100 % del drawdown); objetivo 120/3.000 = 4 %; riesgo razonable 10 % del margen = 262.
    await g.tiene('Resumen de la cuenta', cta, ['Tu cuenta de fondeo', 'Actualizada el 30 oct', ['Cuenta sana', '+120 $'], 'Drawdown −2.500 $', 'Pico 0 $', 'Margen 2620 $', 'Peor margen 2620 $', 'Objetivo 4 %', 'Hoy +120 $', 'Riesgo razonable 262 $', 'Días operados 1', 'Calculado con tus operaciones desde 1 oct.']);
    await g.cuenta('Indicador de margen', cta.locator('[role="img"][aria-label="Margen 100 % del drawdown"]'), 1);
    await g.valor('El formulario conserva lo guardado', page.locator('#ct-firma'), 'Apex');
    await pestana('Resumen').click();
    await g.attr('Tarjeta de la cuenta en el resumen', page.locator('#hoy-fila a[href="#diario/plan"]'), 'aria-label', 'Cuenta de fondeo: Cuenta sana, margen 2620 $');
    await g.tiene('…con sus datos', page.locator('#hoy-fila'), [['Cuenta sana', 'Apex · evaluación · +120 $ acumulado'], '2620 $ margen hasta el drawdown', '4 % del objetivo · faltan 2880 $', '+120 $ hoy · límite 500 $']);
  });

  await g.seccion('Rutina: preparar y cerrar la sesión', async () => {
    const rut = page.locator('#rut'), hoy = page.locator('#hoy-fila');
    const pre = hoy.locator('[data-accion="rutina"][data-modo="pre"]'), post = hoy.locator('[data-accion="rutina"][data-modo="post"]');
    const esc5 = (n, val) => etiqueta(page, `#rut input[name="${n}"][value="${val}"]`);
    await g.txt('Botón «Preparar sesión»', pre, 'Preparar sesión');
    await pre.click();
    await g.visible('Abre la ventana', rut);
    await g.txt('Título', page.locator('#rut-t'), 'Preparar la sesión');
    await g.txt('Subtítulo', page.locator('#rut-sub'), 'Treinta segundos antes de operar. Tu estado también es parte de tu riesgo.');
    await g.cuenta('Cuatro comprobaciones', page.locator('#rut input[name="rut-check"]'), 4);
    await g.partes('Recuerda el margen de la cuenta', page.locator('#rut-cuerpo'), ['Margen hasta el drawdown:', '2620 $', 'Límite de hoy: 500 $.', 'Riesgo razonable por operación: unos', '262 $']);
    await page.keyboard.press('Escape');
    await g.oculto('Esc la cierra', rut);
    await pre.click();
    await rut.getByRole('button', { name: 'Cancelar' }).click();
    await g.oculto('«Cancelar» la cierra', rut);
    await pre.click();
    await etiqueta(page, '#rut input[name="rut-check"][value="niveles"]').click();
    await etiqueta(page, '#rut input[name="rut-check"][value="noticias"]').click();
    await esc5('rut-sueno', 4).click();
    await esc5('rut-animo', 2).click();
    await page.locator('#rut-nota').fill('Vigilo el VAL de ayer');
    await rut.locator('[data-accion="guardar-rut"]').click();
    await g.oculto('Guardar la cierra', rut);
    // ERROR ACTUAL DE LA APP (ver findings): al guardar la preparación sale el aviso de «Sesión cerrada…» porque el modo se
    // borra antes de elegir el texto. La prueba acepta el texto actual y el correcto, para no romperse el día que se arregle.
    await g.cumple('Aviso al guardar la preparación (hoy sale el de cierre: error conocido)', async () => ((await page.locator('#toast').isVisible()) ? norm(await page.locator('#toast').textContent()) : ''), (t) => /Sesión preparada\. Buen trading\.|Sesión cerrada\. Mañana, una cosa mejor\./.test(t));
    await g.partes('La tarjeta de hoy resume la preparación', hoy, ['Tu sesión de hoy', 'Preparada: sueño 4/5, ánimo 2/5, 2 de 4 comprobaciones.']);
    await g.txt('El botón pasa a «Preparada»', pre, 'Preparada');
    await pre.click();
    await g.marcado('Al reabrir conserva las comprobaciones', page.locator('#rut input[name="rut-check"][value="niveles"]'));
    await g.marcado('…lo no marcado sigue sin marcar', page.locator('#rut input[name="rut-check"][value="plan"]'), false);
    await g.marcado('…el sueño', page.locator('#rut input[name="rut-sueno"][value="4"]'));
    await g.valor('…y la nota', page.locator('#rut-nota'), 'Vigilo el VAL de ayer');
    await rut.getByRole('button', { name: 'Cerrar' }).click();
    await g.txt('Botón «Cerrar sesión»', post, 'Cerrar sesión');
    await post.click();
    await g.txt('Cerrar la sesión: título', page.locator('#rut-t'), 'Cerrar la sesión');
    await g.txt('…subtítulo', page.locator('#rut-sub'), 'Un minuto al terminar. Se juzga el proceso, no el dinero.');
    await esc5('rut-disc', 5).click();
    await page.locator('#rut-mejora').fill('Esperar la confirmación');
    await page.locator('#rut-nota2').fill('Día tranquilo');
    await rut.locator('[data-accion="guardar-rut"]').click();
    await g.toast(page, 'Sesión cerrada. Mañana, una cosa mejor.');
    await g.partes('La tarjeta añade el cierre', hoy, ['Preparada: sueño 4/5, ánimo 2/5, 2 de 4 comprobaciones.', 'Cerrada con disciplina 5/5.']);
    await g.txt('El botón pasa a «Cerrada»', post, 'Cerrada');
    await page.reload();
    await g.partes('La rutina se conserva al recargar', page.locator('#hoy-fila'), ['Preparada: sueño 4/5', 'Cerrada con disciplina 5/5.']);
  });

  await g.seccion('Importar de ATAS: CSV con dos cuentas', async () => {
    const imp = page.locator('#imp'), cuerpo = page.locator('#imp-cuerpo'), ok = page.locator('#imp-pie [data-accion="imp-ok"]');
    const CSV = { name: 'atas-octubre.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV_ATAS, 'utf8') };
    await page.getByRole('button', { name: 'Importar de ATAS' }).click();
    await g.visible('El botón abre la ventana de importar', imp);
    await g.partes('Instrucciones y zona de subida', imp, ['Importar operaciones de ATAS', 'Exportar estadísticas', 'Arrastra aquí el Excel de ATAS', 'Las horas del archivo están en', 'tu hora (Europe/Madrid)', 'UTC']);
    await page.keyboard.press('Escape');
    await g.oculto('Esc la cierra', imp);
    await page.getByRole('button', { name: 'Importar de ATAS' }).click();
    await soltar(page, '#imp-zona', { name: 'lista.csv', mimeType: 'text/csv', buffer: Buffer.from('hola;mundo\r\n1;2\r\n') });
    await g.partes('Un archivo sin operaciones (soltado en la zona) da un error claro', cuerpo, ['No encontramos operaciones cerradas en este archivo.']);
    await page.locator('#imp-tz').selectOption('utc');
    const [selector] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#imp [data-accion="imp-elegir"]').click()]);
    await selector.setFiles(CSV);
    await g.partes('Con las horas en UTC, las 15:40 del archivo son las 16:40 de Madrid', cuerpo, ['vie 30 oct', '16:40', 'NQ', 'Largo']);
    await page.locator('#imp-pie [data-accion="imp-otro"]').click();
    await g.valor('«Elegir otro archivo» vuelve al inicio y conserva la zona horaria', page.locator('#imp-tz'), 'utc');
    await page.locator('#imp-tz').selectOption('local');
    await page.locator('#imp-file').setInputFiles(CSV);
    // 4 filas: +250, −40, +150 (APEX-1) y −200 (SIM-2) → +160 $
    await g.partes('Vista previa: 4 operaciones nuevas de dos cuentas', cuerpo, ['atas-octubre.csv', '4', 'operaciones nuevas', '+160 $', 'resultado', '27 oct – 30 oct', 'periodo', 'Cuentas del archivo', 'SIM-2', 'APEX-1']);
    await g.partes('…con la tabla (hora local, instrumento, dirección deducida, contratos, resultado)', cuerpo, ['vie 30 oct', '15:40', 'NQ', 'Largo', '1', '+250 $', 'jue 29 oct', '09:10', 'MNQ', 'Corto', '2', '−40 $', 'mié 28 oct', '16:00', 'ES', 'Largo', '1', '+150 $', 'mar 27 oct', '15:35', 'NQ', 'Largo', '1', '−200 $']);
    await g.txt('Botón de importar', ok, 'Importar 4 operaciones');
    await etiqueta(page, '#imp input[data-cuenta="SIM-2"]').click();
    await g.partes('Desmarcar una cuenta la deja fuera', cuerpo, ['3', 'operaciones nuevas', '+360 $', '28 oct – 30 oct']);
    await g.txt('…y el botón se actualiza', ok, 'Importar 3 operaciones');
    await ok.click();
    await g.toast(page, '3 operaciones importadas');
    await g.oculto('Importar cierra la ventana', imp);
    // 14 + 3 = 17 operaciones; 2.514 + 360 = 2.874; ganadoras 9 + 2 = 11 → 65 %
    await g.attr('Se añaden al resultado del mes', neto, 'aria-label', 'Resultado neto en octubre: +2.874 $');
    await g.txt('…al recuento', sub, '17 operaciones y 65 % de acierto, sin comisiones.');
    await g.cuenta('…y a la lista', filas, 17);
    const imp1 = page.locator('[id^="fila-i"]').filter({ hasText: '15:40' });
    await g.partes('Fila importada', imp1, ['vie 30 oct', '15:40', 'ATAS', 'NY', 'NQ', 'Largo', 'Sin setup · completar', '1', '+250 $']);
    await g.partes('La de las 9:10 de Madrid cae en la sesión de Londres', page.locator('[id^="fila-i"]').filter({ hasText: '09:10' }), ['jue 29 oct', '09:10', 'ATAS', 'Londres', 'MNQ', 'Corto', '2', '−40 $']);
    await imp1.locator('[data-accion="detalle"]').click();
    const I1 = await imp1.locator('[data-accion="detalle"]').getAttribute('data-id');
    await g.partes('Detalle con precios, duración, puntos y comisión', page.locator('#det-' + I1), ['+250 $', 'con 1 contrato de NQ (Nasdaq 100), sesión de NY.', 'Entrada 24.500 a las 15:40 · salida 24.512,5 a las 15:52 (12 min) · +12,5 puntos · comisión 4,5 $', 'Sin stop apuntado', 'Importada 1', 'Completar setup y nota']);
    await imp1.locator('[data-accion="detalle"]').click();
    await g.partes('Aviso de operaciones por completar', page.locator('#avisos-diario'), ['Tienes 3 operaciones importadas sin completar.', 'Completar']);
    await page.locator('#avisos-diario [data-accion="completar-sig"]').click();
    await g.txt('«Completar» abre la más reciente', page.locator('#t-nueva'), 'Completar operación');
    await g.partes('…con los datos de ATAS fijos', page.locator('#atas-res'), ['Datos de ATAS', 'NQ largo', ', 1 contrato · ', '+250 $', 'vie 30 oct, 15:40 a 15:52 · entrada 24.500, salida 24.512,5']);
    await g.oculto('…y sin los campos que vienen de ATAS', page.locator('#f-fecha'));
    await g.oculto('…ni el importe', page.locator('#f-imp'));
    await radio('f-setup', 'Imbalance').click();
    await page.locator('#f-stop').fill('15');
    await g.valor('Riesgo: 15 pts × 20 $ × 1', page.locator('#f-riesgo'), '300');
    await g.txt('R: 250/300', page.locator('#f-r'), '+0,8 R');
    await guardar.click();
    await g.toast(page, 'Guardada. Te quedan 2 por completar');
    await g.partes('La fila queda completa', imp1, ['Imbalance', '+250 $', '+0,8 R']);
    await g.partes('El aviso baja a 2', page.locator('#avisos-diario'), ['Tienes 2 operaciones importadas sin completar.']);
    await g.cuenta('Dos filas con «Sin setup · completar»', page.locator('#tabla [data-accion="editar-op"]').filter({ hasText: 'Sin setup · completar' }), 2);

    await abrirPaleta(page); await page.locator('#paleta-in').fill('importar'); await page.keyboard.press('Enter');
    await g.visible('Importar también desde las acciones rápidas', imp);
    await page.locator('#imp-file').setInputFiles(CSV);
    await g.partes('Repetir el archivo no duplica: solo es nueva la de la otra cuenta', cuerpo, ['1', 'operación nueva', '−200 $', '27 oct', '3 ya estaban en tu diario']);
    await etiqueta(page, '#imp input[data-cuenta="SIM-2"]').click();
    await g.partes('…y sin ella no queda nada que importar', cuerpo, ['0', 'operaciones nuevas', 'Todas las operaciones de este archivo ya estaban en tu diario.']);
    await g.txt('…botón desactivado', ok, 'Nada nuevo que importar');
    await g.igual('…de verdad desactivado', () => ok.isDisabled(), true);
    await page.locator('#imp-pie [data-accion="imp-otro"]').click();
  });

  await g.seccion('Importar de ATAS: Excel (.xlsx)', async () => {
    const imp = page.locator('#imp'), cuerpo = page.locator('#imp-cuerpo'), ok = page.locator('#imp-pie [data-accion="imp-ok"]');
    const XLS = { name: 'ATAS_statistics.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: env.xlsx };
    await page.locator('#imp-file').setInputFiles(XLS);
    await g.partes('Si el lector de Excel no se puede descargar, lo dice', cuerpo, ['No se ha podido abrir el lector de Excel. Revisa tu conexión o guarda el archivo como CSV.']);
    xlsx.modo = 'ok';
    await page.locator('#imp-file').setInputFiles(XLS);
    await g.partes('Con el lector disponible lee el Excel (cabeceras en español, fechas de Excel)', cuerpo, ['ATAS_statistics.xlsx', '1', 'operación nueva', '+200 $', '26 oct', 'periodo', 'lun 26 oct', '15:35', 'NQ', 'Largo', '1', '+200 $']);
    await g.sinTexto('…una sola cuenta: sin selector de cuentas', cuerpo, 'Cuentas del archivo');
    await g.txt('Botón de importar', ok, 'Importar 1 operación');
    await ok.click();
    await g.toast(page, '1 operación importada');
    await g.oculto('Importar cierra la ventana', imp);
    // 18 operaciones; 2.874 + 200 = 3.074; 12 ganadoras → 67 %
    await g.attr('Resultado del mes con todo lo importado', neto, 'aria-label', 'Resultado neto en octubre: +3.074 $');
    await g.txt('…recuento', sub, '18 operaciones y 67 % de acierto, sin comisiones.');
    // Semana: ejemplos +1.000, propia +120, importadas +250 −40 +150 +200 → +1.680 en 9 operaciones
    await g.partes('…y la semana en la barra lateral', page.locator('#lat-widgets'), ['Esta semana, 9 operaciones', '+1.680 $']);
    await page.reload();
    await g.attr('Todo se conserva al recargar', page.locator('#hero-neto'), 'aria-label', 'Resultado neto en octubre: +3.074 $');
    await g.cuenta('…con las 4 importadas', page.locator('[id^="fila-i"]'), 4);
  });

  await g.seccion('Cuenta de fondeo y estadísticas con las operaciones propias', async () => {
    await pestana('Plan e IA').click();
    // Operaciones propias desde el 1 oct, por orden: 26 oct +200 · 28 oct +150 · 29 oct −40 · 30 oct +250 y +120 → +680.
    // Trailing de fin de día: pico al cierre 200 → 350 → 350; suelo 350 − 2.500 = −2.150; margen 680 + 2.150 = 2.830;
    // peor margen 310 + 2.150 = 2.460; objetivo 680/3.000 = 23 %; hoy +370; riesgo razonable 283; 4 días.
    await g.tiene('La cuenta se recalcula', cta, [['Cuenta sana', '+680 $'], 'Drawdown −2.150 $', 'Pico +350 $', 'Margen 2830 $', 'Peor margen 2460 $', 'Objetivo 23 %', 'Hoy +370 $', 'Riesgo razonable 283 $', 'Días operados 4']);
    await pestana('Estadísticas').click();
    const est = page.locator('#est');
    await g.partes('Estadísticas con comisiones (4,5 + 2 + 4 + 4,5 = 15 $)', est, ['Resultado neto', '+3.074 $', '18 operaciones, 15 $ en comisiones']);
    await g.partes('Coste de los errores en estadísticas', page.locator('#est-errores'), ['FOMO / perseguir el precio', '1 operación', '+120 $', 'Revancha', '1 operación', '+120 $']);
    // Hoy (sueño 4, ánimo 2) las operaciones propias suman +250 +120 = +370
    await g.partes('«Cómo llegas y cómo te va» con la rutina de hoy', est, ['Cómo llegas y cómo te va', 'Sueño', '1-2', '−', 'sin días', '3', '−', 'sin días', '4-5', '+370 $', '1 día · media por día', 'Ánimo', '1-2', '+370 $', '1 día · media por día', '3', '−', 'sin días', '4-5', '−', 'sin días']);
    await pestana('Resumen').click();
    await g.tiene('Tarjeta de la cuenta en el resumen', page.locator('#hoy-fila'), [['Cuenta sana', 'Apex · evaluación · +680 $ acumulado'], '2830 $ margen hasta el drawdown', '23 % del objetivo · faltan 2320 $', '+370 $ hoy · límite 500 $']);
  });
  cierre(g);
}

/* =====================================================================================================
 * GRUPO 3 · Ranking, acciones rápidas (Ctrl+K) y tema claro/oscuro
 * ===================================================================================================== */
async function gRankingPaletaTema(g, env) {
  const { page } = await contexto(g, env, { nombre: 'ranking-paleta-tema' });
  const v = page.locator('#vista');
  await page.goto(BASE + '#ranking');

  await g.seccion('Ranking de logros (datos de ejemplo)', async () => {
    const lista = page.locator('#rk-lista'), mia = lista.locator('[aria-current="true"]');
    const periodo = (p) => v.locator(`[data-accion="rk-periodo"][data-p="${p}"]`);
    await g.txt('Título', h1(page), 'Ranking de logros');
    await g.partes('Estado de la conexión', v, ['Datos de ejemplo', 'se conectará al canal de logros']);
    await g.partes('Premio del mes', v, ['Premio de octubre', 'Sesión 1:1 con Alex']);
    await g.txt('Cuándo cierra', page.locator('#rk-cuenta-t'), 'El ranking cierra el 31 de octubre a las 23:59, hora de España');
    // Del viernes 30 a las 16:30 al sábado 31 a las 24:00 hay 1 día, 7 horas y 30 minutos
    await g.txt('Cuenta atrás: días', page.locator('#rk-d'), '01');
    await g.txt('Cuenta atrás: horas', page.locator('#rk-h'), '07');
    await g.cumple('Cuenta atrás: minutos', () => page.locator('#rk-m').textContent(), (t) => ['30', '29', '28'].includes(t));
    const s1 = await page.locator('#rk-s').textContent();
    await g.cumple('Cuenta atrás: los segundos corren', () => page.locator('#rk-s').textContent(), (t) => /^\d\d$/.test(t) && t !== s1, 4000);
    await g.partes('Tu posición', v, ['Vas 4º con 5 logros', 'Te faltan 2 logros para entrar en el podio.']);
    for (const t of ['Puesto 1: Lucía Ferrer, 7 logros', 'Puesto 2: Diego Ramírez, 6 logros', 'Puesto 3: Marta Soler, 6 logros']) await g.cuenta(`Podio · ${t}`, v.locator(`[role="listitem"][aria-label="${t}"]`), 1, 2500);
    await g.attr('«Este mes» marcado', periodo('mes'), 'aria-pressed', 'true');
    // Orden: más logros primero y, a igualdad, quien llegó antes
    await g.partes('Clasificación del mes', lista, ['1', 'Lucía Ferrer', '7', 'logros', '2', 'Diego Ramírez', '6', '3', 'Marta Soler', '6', '4', 'Javi Martín', 'Tú', '5', 'Sofía Medina', '4', 'Andrés Cabrera', '4', 'Valentina Ruiz', '3', 'Pablo Ortega', '3', 'Camila Torres', '2', 'Iker Navarro', '2', 'Nerea Gil', '1', 'logro', 'Hugo Prieto', '1', 'logro']);
    await g.cuenta('Tu fila está marcada', mia, 1);
    await g.cumple('Tu fila: 4º, con tus logros por tipo y el total', async () => compacto(await mia.textContent()), (t) => t.startsWith('4') && ['JaviMartín', 'Tú', '1Payoutcobrado', '2Evaluaciónsuperada', '2Otrologro', '5logros'].every((x) => t.includes(x)));
    await periodo('historico').click();
    await g.attr('«Histórico» marcado', periodo('historico'), 'aria-pressed', 'true');
    await g.attr('…y «Este mes» no', periodo('mes'), 'aria-pressed', 'false');
    await g.partes('Clasificación histórica', lista, ['1', 'Diego Ramírez', '31', '2', 'Lucía Ferrer', '28', '3', 'Andrés Cabrera', '24', '4', 'Marta Soler', '22', '5', 'Javi Martín', 'Tú', '17', 'Sofía Medina', '15', 'Hugo Prieto', '4']);
    await g.cumple('Tu fila en el histórico: 5º con 17 logros', async () => compacto(await mia.textContent()), (t) => t.startsWith('5') && t.includes('JaviMartín') && t.endsWith('17logros'));
    await periodo('mes').click();
    await g.cumple('Vuelta a este mes: 4º con 5', async () => compacto(await mia.textContent()), (t) => t.startsWith('4') && t.endsWith('5logros'));
    await g.cumple('Últimos logros', async () => compacto(await v.textContent()), (t) => /LucíaFerrerOtrologroSemanacompletasiguiendoelplan,sinsaltarmeningunaregla\.hace1[4-9]min/.test(t));
    await g.partes('Campeones de meses anteriores', v, ['Campeones', 'Diego Ramírez', 'septiembre 2026 · 9 logros', 'Andrés Cabrera', 'agosto 2026 · 8 logros', 'Lucía Ferrer', 'julio 2026 · 7 logros']);
    await g.partes('Cómo sumar logros', v, ['Cómo sumar logros', 'Publícalo en el canal de logros', 'Payout cobrado', 'Evaluación superada', 'Otro logro', 'Bases.']);
    await g.partes('Resumen del ranking en la barra lateral', page.locator('#lat-widgets'), ['Ranking de octubre', '4º · 5 logros']);
  });

  const paleta = page.locator('#paleta'), entrada = page.locator('#paleta-in'), opciones = page.locator('#paleta-lista [role="option"]');
  const elegida = page.locator('#paleta-lista [role="option"][aria-selected="true"]');
  const abrir = () => abrirPaleta(page);
  const lanzar = async (texto) => { await abrir(); await entrada.fill(texto); await page.keyboard.press('Enter'); };
  await g.seccion('Acciones rápidas (Ctrl+K): abrir, moverse, buscar y cerrar', async () => {
    await page.keyboard.press('Control+k');
    await g.visible('Ctrl+K abre las acciones rápidas', paleta);
    await g.igual('…con el foco en el buscador', () => page.evaluate(() => document.activeElement && document.activeElement.id), 'paleta-in');
    await g.cumple('…y la lista completa de acciones', () => opciones.count(), (n) => n > 100);
    await g.txt('La primera acción está elegida', elegida, 'Nueva operación');
    await page.keyboard.press('ArrowDown');
    await g.txt('Flecha abajo: la siguiente', elegida, 'Cambiar el objetivo del mes');
    await page.keyboard.press('ArrowUp');
    await g.txt('Flecha arriba: la anterior', elegida, 'Nueva operación');
    await page.keyboard.press('Tab');
    await g.igual('Tabulador no saca el foco', () => page.evaluate(() => document.activeElement && document.activeElement.id), 'paleta-in');
    await entrada.fill('zzzz');
    await g.partes('Búsqueda sin resultados', page.locator('#paleta-lista'), ['No hay ninguna acción con ese nombre.']);
    await entrada.fill('ranking historico');
    await g.cuenta('La búsqueda filtra (sin tildes)', opciones, 1);
    await g.txt('…a la acción buscada', elegida, 'Ver ranking histórico');
    await page.keyboard.press('Escape');
    await g.oculto('Esc cierra', paleta);
    await page.locator('[data-accion="paleta"]').click();
    await g.visible('El botón «Acciones rápidas» del menú también abre', paleta);
    await page.keyboard.press('Control+k');
    await g.oculto('Ctrl+K otra vez cierra', paleta);
    await g.cuenta('En modo ejemplo no hay «Cerrar sesión» ni «alumnos»', (await abrir(), await entrada.fill('cerrar sesion discord'), opciones), 0);
    await page.keyboard.press('Escape');
  });

  await g.seccion('Acciones rápidas: ejecutar acciones', async () => {
    await lanzar('ranking historico');
    await g.oculto('Intro ejecuta y cierra', paleta);
    await g.attr('«Ver ranking histórico»: se queda en el ranking con el histórico', v.locator('[data-accion="rk-periodo"][data-p="historico"]'), 'aria-pressed', 'true');
    await lanzar('gonzi');
    await g.igual('«Ver operaciones de Patrón Gonzi»: va al diario', () => hashDe(page), '#diario');
    await g.partes('…con el filtro puesto', page.locator('#filtros'), ['Setup: Patrón Gonzi']);
    await g.txt('…y 3 operaciones', page.locator('#ops-meta'), '3 operaciones con este filtro');
    await lanzar('objetivo del mes');
    await g.igual('«Cambiar el objetivo del mes»: abre el campo con el foco', () => page.evaluate(() => document.activeElement && document.activeElement.id), 'obj-in');
    await page.keyboard.press('Escape');
    await lanzar('nueva operacion');
    await g.visible('«Nueva operación»: abre el cajón', page.locator('#cajon'));
    await page.keyboard.press('Escape');
    await lanzar('preparar la sesion');
    await g.visible('«Preparar la sesión de hoy»: abre la rutina', page.locator('#rut'));
    await g.txt('…de preparación', page.locator('#rut-t'), 'Preparar la sesión');
    await page.keyboard.press('Escape');
    await lanzar('cerrar la sesion de hoy');
    await g.txt('«Cerrar la sesión de hoy»: abre la rutina de cierre', page.locator('#rut-t'), 'Cerrar la sesión');
    await page.keyboard.press('Escape');
    await lanzar('esta semana');
    await g.attr('«Ver resultados: esta semana»: cambia el periodo', v.locator('[data-accion="periodo"][data-periodo="semana"]'), 'aria-pressed', 'true');
    await g.attr('…y la cifra', page.locator('#hero-neto'), 'aria-label', 'Resultado neto esta semana: +1.000 $');
    await lanzar('ver mis estadisticas');
    await g.igual('«Ver mis estadísticas»', () => hashDe(page), '#diario/estadisticas');
    await lanzar('cuenta de fondeo');
    await g.igual('«Mi cuenta de fondeo»', () => hashDe(page), '#diario/plan');
    await lanzar('analizar');
    await g.toast(page, 'En agxcommunity.com la IA analiza tus operaciones reales', '«Analizar mi último día con la IA»: en modo ejemplo avisa, sin error');
    await abrir(); await entrada.fill('ir a formacion');
    await opciones.first().click();
    await g.igual('Pulsar una acción con el ratón: «Ir a formación»', () => hashDe(page), '#formacion');
    await g.oculto('…y se cierra', paleta);
    await lanzar('AMD');
    await g.igual('Buscar una lección por su título', () => hashDe(page), '#formacion/l/n3-4');
    await g.txt('…y abrirla', h1(page), 'AMD: acumulación, manipulación y distribución');
    await lanzar('examen final');
    await g.txt('«Empezar examen final»', h1(page), 'Examen final');
    await g.partes('…con 30 preguntas', v, ['Pregunta 1 de 30']);
    await lanzar('test rapido de 10');
    await g.txt('«Test rápido de 10 preguntas»', h1(page), 'Test rápido');
    await g.partes('…con 10 preguntas', v, ['Pregunta 1 de 10']);
    await lanzar('practicar tema 1:');
    await g.txt('«Practicar tema 1»', h1(page), 'Tema 1: Subasta y tipos de órdenes');
    await lanzar('continuar mi ruta');
    await g.igual('«Continuar mi ruta de formación»: abre la siguiente lección', () => hashDe(page), '#formacion/l/n1-1');
    await lanzar('ir al ranking');
    await g.txt('«Ir al ranking de logros»', h1(page), 'Ranking de logros');
    await lanzar('ir al diario');
    await g.txt('«Ir al diario de trading»', h1(page), 'Diario de trading');
  });

  await g.seccion('Tema claro y oscuro', async () => {
    const boton = page.locator('#bs-modo'), modo = () => page.evaluate(() => document.documentElement.dataset.modo || 'claro');
    const firma = () => page.evaluate(() => { const c = getComputedStyle(document.body); return c.backgroundColor + ' / ' + c.color; });
    await g.igual('Empieza en claro', modo, 'claro');
    await g.attr('El botón ofrece el modo oscuro', boton, 'aria-label', 'Activar modo oscuro');
    const claro = await firma();
    await boton.click();
    await g.igual('El botón cambia a oscuro', modo, 'oscuro');
    await g.attr('…y ahora ofrece el claro', boton, 'aria-label', 'Activar modo claro');
    await g.cumple('Los colores de la página cambian', firma, (f) => f !== claro, 5000, 'en claro: ' + claro);
    const oscuro = await firma();
    await page.reload();
    await g.igual('El tema oscuro se conserva al recargar', modo, 'oscuro');
    await g.attr('…con el botón correcto', boton, 'aria-label', 'Activar modo claro');
    await g.igual('…y los mismos colores', firma, oscuro);
    await g.attr('El diario se pinta igual en oscuro', page.locator('#hero-neto'), 'aria-label', 'Resultado neto esta semana: +1.000 $');
    await lanzar('modo claro');
    await g.igual('Desde las acciones rápidas: «Cambiar a modo claro»', modo, 'claro');
    await g.igual('…vuelven los colores claros', firma, claro);
    await page.reload();
    await g.igual('El tema claro se conserva al recargar', modo, 'claro');
    await abrir(); await entrada.fill('modo oscuro');
    await g.txt('La acción rápida ofrece ahora el oscuro', elegida, 'Cambiar a modo oscuro');
    await page.keyboard.press('Escape');
  });

  await g.seccion('Barra superior a otra hora (reloj adelantado 5 h 5 min)', async () => {
    await page.clock.fastForward('05:05:00');
    // 21:35 en Madrid = 16:35 en Nueva York, viernes: después del cierre de NY y antes del cierre semanal (17:00)
    await g.cumple('La hora avanza', () => page.locator('#bs-hora').textContent(), (t) => /^21:3\d$/.test(t));
    await g.partes('La sesión pasa a «después del cierre»', page.locator('#bs-sesion'), ['Después del cierre de NY', 'El mercado cierra en']);
    await page.reload();
    await g.txt('Y el saludo pasa a «Buenas noches»', page.locator('#hero-saludo'), 'Buenas noches, Javi');
  });
  cierre(g);
}

/* =====================================================================================================
 * GRUPO 4 · Formación en modo ejemplo: ruta (todo abierto), lección, repaso libre, tests y examen final
 * ===================================================================================================== */
async function gFormacionLibre(g, env) {
  const { page } = await contexto(g, env, { nombre: 'formación-libre' });
  const v = page.locator('#vista');
  const K = env.clave, total = K.preguntas.length;
  const temaN = (id) => { const i = K.temas.findIndex((t) => t.id === id); return { i: i + 1, nombre: K.temas[i].nombre }; };
  const nivel = (titulo) => v.locator('details').filter({ hasText: titulo });
  await page.goto(BASE + '#formacion');

  await g.seccion('Ruta por niveles en modo ejemplo (todo desbloqueado)', async () => {
    g.ok('Temario leído de index.html: 14 niveles activos, 70 lecciones', env.activos.length === 14 && env.activos.reduce((s, n) => s + n.lecciones.length, 0) === 70, `${env.activos.length} niveles, ${total} preguntas`);
    await g.txt('Título', h1(page), 'Formación AGX');
    await g.partes('Entradilla', v, ['Del primer día a operar con Order Flow: 14 niveles y 70 lecciones.']);
    const tabs = page.getByRole('navigation', { name: 'Secciones de la formación' });
    await g.attr('Pestaña «Ruta por niveles» marcada', tabs.getByRole('link', { name: 'Ruta por niveles' }), 'aria-current', 'page');
    await g.partes('Cabecera de la ruta', v, ['Nivel 1 de 14', 'Mentalidad y punto de partida', '0 de 70 lecciones aprobadas.']);
    await g.attr('Progreso: 0 %', page.locator('#f-pct'), 'aria-label', 'Completado: 0 %');
    await g.txt('Nivel actual', page.locator('#r-tit'), 'Mentalidad y punto de partida');
    await g.cuenta('15 niveles (14 activos y uno en preparación)', v.locator('details'), 15);
    await g.cuenta('70 lecciones abiertas (más el botón de empezar)', v.locator('a[href^="#formacion/l/"]'), 71);
    await g.cuenta('14 exámenes de nivel disponibles', v.locator('[data-accion="examen-nivel"]'), 14);
    await g.cuenta('Nada bloqueado salvo las 4 lecciones en preparación', v.locator('[aria-disabled="true"]'), 4);
    await g.partes('Nivel en preparación', nivel('Los setups del Método AGX'), ['En preparación', 'Estas lecciones salen de las clases en directo de Alex.', 'Próximamente']);
    await g.txt('Botón para empezar', v.locator('a[href="#formacion/l/n1-1"]').first(), 'Empezar: Por qué el 90 % pierde dinero');
    await g.igual('El nivel 1 empieza abierto', () => nivel('Mentalidad y punto de partida').evaluate((d) => d.open), true);
    await g.igual('El nivel 3 empieza cerrado', () => nivel('Estructura de mercado').evaluate((d) => d.open), false);
    await nivel('Estructura de mercado').locator('summary').click();
    await g.igual('Pulsar un nivel lo abre', () => nivel('Estructura de mercado').evaluate((d) => d.open), true);
    await g.partes('…con sus lecciones y su examen', nivel('Estructura de mercado'), ['03', 'Estructura de mercado', '0 de 4', 'Soportes y resistencias que importan', '6 min de lectura · test de 10 preguntas', 'Disponible', 'AMD: acumulación, manipulación y distribución', 'Examen del nivel 3', '20 preguntas, 20 minutos · apruebas con 2 fallos o menos', 'Disponible']);
    await nivel('Estructura de mercado').locator('summary').click();
    await g.igual('Pulsarlo otra vez lo cierra', () => nivel('Estructura de mercado').evaluate((d) => d.open), false);
  });

  const fT = page.locator('#f-tit');
  const bloque = (b) => v.locator(`[data-accion="bloque"][data-b="${b}"]`);
  const tarjeta = (t) => v.locator(`[data-accion="practicar"][data-tema="${t}"]`).last();
  const fallosEj = ['delta-2', 'absorcion-4', 'contexto-7', 'op-griegas-6', 'op-niveles-5', 'op-flujos-2'].filter((id) => K.preguntas.some((p) => p.id === id)).length;
  // Ojo: empezar cualquier test borra el progreso de ejemplo, así que esto va antes de abrir ningún test.
  await g.seccion('Repaso libre: progreso de ejemplo y «Empezar de cero»', async () => {
    await page.getByRole('navigation', { name: 'Secciones de la formación' }).getByRole('link', { name: 'Repaso libre y examen' }).click();
    await g.igual('Pestaña de repaso libre: URL', () => hashDe(page), '#formacion/libre');
    await g.attr('…marcada', page.getByRole('navigation', { name: 'Secciones de la formación' }).getByRole('link', { name: 'Repaso libre y examen' }), 'aria-current', 'page');
    // Progreso de ejemplo: 12+9+11+8+9+6+5+10+9+5 = 84 preguntas dominadas
    await g.txt('Preguntas dominadas del ejemplo', fT, `84 de ${total} preguntas dominadas`);
    await g.attr('Porcentaje completado', page.locator('#f-pct'), 'aria-label', `Completado: ${Math.round(84 / total * 100)} %`);
    await g.partes('Último examen de ejemplo', v, ['No apto', 'Último examen,', '27 oct', ': 5 fallos de 30.']);
    await g.partes('Fallos pendientes de ejemplo', v.locator('[data-accion="fallos"]'), ['Tus fallos', `${fallosEj} preguntas que fallaste.`, 'Repasar fallos']);
    await g.cuenta('Seis bloques', v.locator('[data-accion="bloque"]'), 6);
    await g.attr('Bloque del ejemplo marcado', bloque('of'), 'aria-pressed', 'true');
    await g.partes('…con su cabecera', v, ['Bloque 2: Footprint y delta']);
    await g.partes('Aviso de progreso de ejemplo', v, ['El progreso que ves es de ejemplo.', 'Empezar de cero']);
    await v.locator('[data-accion="reset-progreso"]').click();
    await g.toast(page, 'Progreso borrado');
    await g.txt('«Empezar de cero» pone el progreso a cero', fT, `0 de ${total} preguntas dominadas`);
    await g.attr('…0 %', page.locator('#f-pct'), 'aria-label', 'Completado: 0 %');
    await g.partes('…y el examen sin hacer', v, ['Sin hacer', 'Todavía no has hecho el examen final.']);
    await g.cuenta('…y desaparece el aviso', v.locator('[data-accion="reset-progreso"]'), 0);
    await page.reload();
    await g.txt('El reinicio se conserva al recargar', page.locator('#f-tit'), `0 de ${total} preguntas dominadas`);
  });

  await g.seccion('Lección: teoría, figura y test', async () => {
    await page.goto(BASE + '#formacion');
    await nivel('Footprint y clusters').locator('summary').click();
    await v.locator('a[href="#formacion/l/n6-6"]').click();
    await g.igual('Abrir una lección cambia la URL', () => hashDe(page), '#formacion/l/n6-6');
    await g.txt('Título de la lección', h1(page), 'Absorción e icebergs');
    await g.partes('Migas y resumen', v, ['Ruta de formación', 'Nivel 6 · Footprint y clusters · Lección 6 de 6', '7 min de lectura y un test de 10 preguntas. Apruebas con 9 aciertos.']);
    await g.partes('Teoría con su idea clave', v, ['Idea clave', 'Test de la lección', '10 preguntas con la explicación de cada una. Apruebas con 9 de 10 y se desbloquea lo siguiente.']);
    await g.cumple('Figura del footprint con texto alternativo', () => v.locator('figure [role="img"]').first().getAttribute('aria-label'), (t) => String(t).startsWith('Footprint de NQ.'));
    await g.cuenta('Enlace a la lección anterior', v.locator('a[href="#formacion/l/n6-5"]'), 1);
    await g.txt('Botón del test', v.locator('[data-accion="test-leccion"]'), 'Hacer el test');
    await v.locator('[data-accion="test-leccion"]').click();
    await g.txt('El test empieza', h1(page), 'Test: Absorción e icebergs');
    await g.partes('…en la pregunta 1 de 10 y con la racha a cero', v, ['Volver a la lección', 'Racha 0', 'Pregunta 1 de 10', 'Elige una respuesta y aquí verás si es correcta y por qué, explicado por Alex.']);
    await g.cuenta('Tres opciones', v.locator('[data-accion="opcion"]'), 3);
    await v.locator('[data-accion="abandonar"]').click();
    await g.txt('«Volver a la lección» deja el test', h1(page), 'Absorción e icebergs');
    await v.getByRole('link', { name: 'Ruta de formación' }).click();
    await g.igual('«Ruta de formación» vuelve a la ruta', () => hashDe(page), '#formacion');
  });

  await g.seccion('Repaso de fallos', async () => {
    await page.goto(BASE + '#formacion/libre');
    await v.locator('[data-accion="fallos"]').click();
    await g.txt('Empieza el repaso', h1(page), 'Repaso de tus fallos');
    await g.partes(`…con las ${fallosEj} preguntas falladas`, v, [`Pregunta 1 de ${fallosEj}`]);
    await hacerPractica(page, env, (i) => (i === 1 ? 'mal' : 'bien'));
    await g.partes('Resultado con una fallada', v, ['Resultado del test', `${fallosEj - 1}/${fallosEj}`, 'correctas', 'Repaso de tus fallos', `${fallosEj - 1} de ${fallosEj} correctas`, 'Las que has fallado se han guardado en tu lista de fallos para que las repases.', 'Repasar fallos otra vez']);
    await v.locator('[data-accion="repetir"]').click();
    await g.partes('«Repasar fallos otra vez»: solo queda la que se falló', (await esperaPregunta(page, 1), v), ['Pregunta 1 de 1']);
    await hacerPractica(page, env, () => 'bien');
    await g.partes('Al acertarla, sale de la lista', v, ['Todas correctas', 'Has limpiado estas preguntas de tu lista de fallos.']);
    await v.locator('[data-accion="temario"]').first().click();
    await g.partes('Sin fallos pendientes', v.locator('[data-accion="fallos"]'), ['No tienes fallos pendientes.', 'Sin fallos pendientes']);
    await v.locator('[data-accion="fallos"]').click();
    await g.toast(page, 'No tienes fallos pendientes', 'Repasar sin fallos: solo avisa');
    await g.txt('…y no empieza ningún test', h1(page), 'Formación AGX');
  });

  await g.seccion('Bloques, práctica de un tema y test rápido', async () => {
    const T = temaN('op-basicos'), nT = K.preguntas.filter((p) => p.tema === 'op-basicos').length, nB = K.preguntas.filter((p) => K.temas.find((t) => t.id === p.tema).bloque === 'op').length;
    await bloque('op').click();
    await g.attr('Elegir un bloque lo marca', bloque('op'), 'aria-pressed', 'true');
    await g.partes('…y muestra sus temas', v, ['Bloque 6: Opciones', `8 temas y ${nB} preguntas`, 'Test rápido del bloque']);
    await g.attr('Tarjeta del tema sin empezar', tarjeta('op-basicos'), 'aria-label', `Tema ${T.i}, ${T.nombre}. Sin empezar, 0 de ${nT}. Practicar`);
    await tarjeta('op-basicos').click();
    await g.txt('Practicar un tema', h1(page), `Tema ${T.i}: ${T.nombre}`);
    const hechas = await hacerPractica(page, env, (i) => (i === 2 ? 'mal' : 'bien'), {
      teclado: (i) => i >= 4,
      tras: async (r) => {
        if (r.i === 1) {
          await g.partes('Acierto: lo dice, con la explicación de Alex', v, ['Explicación', 'Correcto', 'Alex', r.p.nota]);
          await g.partes('…y sube la racha', v, ['Racha 1']);
          await g.cuenta('…las opciones quedan bloqueadas', v.locator('[data-accion="opcion"][disabled]'), 3);
        }
        if (r.i === 2) {
          await g.partes('Fallo: dice cuál era la correcta y lo guarda en fallos', v, ['Racha 0', `Incorrecto, era la ${r.letraOk}`, r.p.nota, 'Guardada en tu lista de fallos para repasarla.']);
        }
        if (r.i === 4) await g.partes('Responder con el teclado (A, B, C e Intro)', v, ['Racha 2', 'Correcto']);
      },
    });
    const mala = hechas[1];
    await g.partes('Resultado del tema con un fallo', v, ['Resultado del test', `${nT - 1}/${nT}`, `Tema: ${T.nombre}`, `${nT - 1} de ${nT} correctas`, 'Las que has fallado se han guardado en tu lista de fallos para que las repases.', 'Repetir tema', 'Repasar mis fallos (1)', 'Volver a formación']);
    await g.partes('Repaso del fallo: tu respuesta, la correcta y la explicación', v, ['Repasa tus fallos', '1 pregunta', mala.p.texto, 'Tu respuesta: ' + mala.elegida, 'Correcta: ' + mala.p.opciones[0], mala.p.nota]);
    await g.cuenta('Navegador de preguntas: una incorrecta', v.locator('[aria-label="Pregunta 2, incorrecta"]'), 1);
    await g.cuenta(`…y ${nT - 1} correctas`, v.locator('[aria-label^="Pregunta "][aria-label$=", correcta"]'), nT - 1);
    await v.locator('[data-accion="temario"]').first().click();
    await g.attr('La tarjeta del tema queda «En progreso»', tarjeta('op-basicos'), 'aria-label', `Tema ${T.i}, ${T.nombre}. En progreso, ${nT - 1} de ${nT}. Practicar`);
    await g.txt('Suben las preguntas dominadas', fT, `${nT - 1} de ${total} preguntas dominadas`);
    await g.attr('…y el porcentaje del bloque', bloque('op'), 'aria-label', `Bloque 6, Opciones. 8 temas, ${nB} preguntas, ${Math.round((nT - 1) / nB * 100)} % dominado`);
    await tarjeta('op-basicos').click();
    await hacerPractica(page, env, () => 'bien', { teclado: (i) => i > 1 });
    await g.partes('Repetirlo sin fallos: tema dominado', v, ['Tema dominado', 'Todas bien. Sigue así.']);
    await g.cumple('…con confeti', () => page.locator('body > canvas').count(), (n) => n === 1, 3000);
    await v.locator('[data-accion="temario"]').first().click();
    await g.attr('La tarjeta pasa a «Dominado»', tarjeta('op-basicos'), 'aria-label', `Tema ${T.i}, ${T.nombre}. Dominado, ${nT} de ${nT}. Practicar`);
    await g.partes('Y el fallo acertado sale de la lista', v.locator('[data-accion="fallos"]'), ['No tienes fallos pendientes.']);
    await v.locator('[data-accion="rapido"][data-b="op"]').click();
    await g.txt('Test rápido del bloque', h1(page), 'Test rápido de Opciones');
    const st = await esperaPregunta(page, 1), p1 = analizar(env, st).p;
    await g.partes('…10 preguntas, con el bloque y el tema de cada una', v, [`Pregunta 1 de 10, Opciones: ${K.temas.find((t) => t.id === p1.tema).nombre}`]);
    await hacerPractica(page, env, () => 'bien', { teclado: () => true });
    await g.partes('Resultado del test rápido', v, ['10/10', 'Test rápido de Opciones', 'Todas correctas', 'Todas bien. Sigue así.', 'Otro test rápido']);
    await v.locator('[data-accion="temario"]').first().click();
    await g.txt('Vuelta a formación', h1(page), 'Formación AGX');
  });

  await g.seccion('Examen final: responder, navegar, entregar y resultado', async () => {
    await v.locator('[data-accion="examen"]').first().click();
    await g.txt('Empieza el examen', h1(page), 'Examen final');
    await g.cumple('Reloj en 30 minutos', () => page.locator('#reloj-t').textContent(), (t) => /^(30:00|29:[45]\d)$/.test(t));
    await g.partes('Panel del examen', v, ['Salir del examen', 'Tu examen', 'Contestadas', '0 de 30', 'Sin contestar', '30', 'Para aprobar', '3 fallos o menos', 'Las preguntas sin contestar cuentan como fallo.', 'Entregar examen']);
    await g.cuenta('Navegador con 30 preguntas', v.locator('[data-accion="ir"]'), 30);
    // Pregunta 1: se cambia de respuesta; 5 y 9 mal; 12 en blanco → 3 fallos (apto por los pelos)
    const hechas = await hacerExamen(page, env, (i) => (i === 5 || i === 9 ? 'mal' : i === 12 ? 'blanco' : 'bien'), {
      teclado: (i) => i > 3,
      tras: async (r) => {
        if (r.i !== 1) return;
        const bl = K.bloques.find((b) => b.id === K.temas.find((t) => t.id === r.p.tema).bloque).nombre;
        await g.partes('Cada pregunta indica su bloque y su tema', v, [`Pregunta 1 de 30, ${bl}: ${K.temas.find((t) => t.id === r.p.tema).nombre}`]);
        await g.partes('Al contestar sube el contador y no se corrige todavía', v, ['Contestadas', '1 de 30', 'Sin contestar', '29']);
        await g.sinTexto('…sin decir si es correcta', v, 'Correcto');
        await v.locator(`[data-accion="opcion"][data-pos="${r.info.posMal}"]`).click();
        await g.attr('Se puede cambiar la respuesta', v.locator(`[data-accion="opcion"][data-pos="${r.info.posMal}"]`), 'aria-pressed', 'true');
        await g.cuenta('…solo queda una marcada', v.locator('[data-accion="opcion"][aria-pressed="true"]'), 1);
        await v.locator(`[data-accion="opcion"][data-pos="${r.info.posOk}"]`).click();
        await v.locator('[data-accion="siguiente"]').click();
        await esperaPregunta(page, 2);
        await v.locator('[data-accion="anterior"]').click();
        await esperaPregunta(page, 1);
        await g.attr('«Anterior» vuelve y conserva la respuesta', v.locator(`[data-accion="opcion"][data-pos="${r.info.posOk}"]`), 'aria-pressed', 'true');
      },
    });
    await g.partes('Al llegar al final: 29 contestadas', v, ['Pregunta 30 de 30', 'Contestadas', '29 de 30', 'Sin contestar', '1']);
    await v.locator('[data-accion="ir"][aria-label="Pregunta 12, sin contestar"]').click();
    await g.partes('El navegador salta a la que quedó en blanco', v, ['Pregunta 12 de 30']);
    await page.keyboard.press('ArrowLeft');
    await g.partes('Flecha izquierda: pregunta anterior', v, ['Pregunta 11 de 30']);
    await v.locator('[data-accion="entregar"]').click();
    await g.partes('Resultado: apto con 3 fallos', v, ['Resultado del examen', '27/30', 'correctas', 'Apto', '3 fallos de 30', 'Examen aprobado. Tienes la base de Order Flow y opciones para aplicarla en tu diario.', `Fallos por tema: ${fallosPorTema(env, hechas)}.`, 'Repetir examen', 'Repasar mis fallos (3)']);
    await g.partes('Repaso de los fallos del examen', v, ['Repasa tus fallos', '3 preguntas', hechas[4].p.texto, 'Tu respuesta: ' + hechas[4].p.opciones[hechas[4].info.kDe[hechas[4].info.posMal]], 'Correcta: ' + hechas[4].p.opciones[0], hechas[8].p.texto, hechas[11].p.texto, 'Tu respuesta: sin contestar', 'Correcta: ' + hechas[11].p.opciones[0]]);
    await g.cuenta('Navegador: la 12 sin contestar', v.locator('[aria-label="Pregunta 12, sin contestar"]'), 1);
    await g.cuenta('…la 5 incorrecta', v.locator('[aria-label="Pregunta 5, incorrecta"]'), 1);
    await g.cumple('Confeti al aprobar', () => page.locator('body > canvas').count(), (n) => n === 1, 3000);
    await v.locator('[data-accion="temario"]').first().click();
    await g.partes('El examen queda apuntado', v, ['Apto', 'Último examen,', '30 oct', ': 3 fallos de 30.']);
    await g.partes('…y sus fallos van al repaso', v.locator('[data-accion="fallos"]'), ['3 preguntas que fallaste.']);
  });

  await g.seccion('Examen final: salir sin entregar y fin del tiempo', async () => {
    await v.locator('[data-accion="examen"]').last().click();
    await esperaPregunta(page, 1);
    await page.keyboard.press('a');
    await g.cuenta('Se contesta una', v.locator('[data-accion="opcion"][aria-pressed="true"]'), 1);
    await v.locator('[data-accion="abandonar"]').click();
    await g.txt('«Salir del examen» vuelve a formación', h1(page), 'Formación AGX');
    await g.partes('…sin tocar el último examen', v, ['Apto', ': 3 fallos de 30.']);
    await v.locator('[data-accion="examen"]').first().click();
    const st = await esperaPregunta(page, 1), info = analizar(env, st);
    await v.locator(`[data-accion="opcion"][data-pos="${info.posOk}"]`).click();
    await g.attr('Otro examen: una contestada bien', v.locator(`[data-accion="opcion"][data-pos="${info.posOk}"]`), 'aria-pressed', 'true');
    await page.clock.fastForward('30:05');
    await g.toast(page, 'Se acabó el tiempo. Examen entregado.', 'Al agotarse los 30 minutos el examen se entrega solo');
    await g.partes('…y cuenta lo que no dio tiempo', v, ['Resultado del examen', '1/30', 'No apto', '29 fallos de 30', 'Para aprobar necesitas 3 fallos o menos.']);
    await v.locator('[data-accion="temario"]').first().click();
    await g.partes('El último examen pasa a no apto', v, ['No apto', 'Último examen,', '30 oct', ': 29 fallos de 30.']);
  });
  cierre(g);
}

/* =====================================================================================================
 * GRUPO 5 · Modo servidor simulado: pantalla de entrada, alumno (datos, guardado, IA) y administrador
 * ===================================================================================================== */
async function gServidor(g, env) {
  const s = crearServidor(env);
  const { page } = await contexto(g, env, { nombre: 'servidor', servidor: s, tolera: TOLERA_API });
  const v = page.locator('#vista'), ent = page.locator('#entrada'), caja = page.locator('#entrada-caja');
  const menu = (r) => page.locator(`a[data-ruta="${r}"]`);
  const per = (k) => v.locator(`[data-accion="periodo"][data-periodo="${k}"]`);
  const pestana = (n) => page.getByRole('navigation', { name: 'Secciones del diario' }).getByRole('link', { name: n });

  await g.seccion('Pantalla de entrada: cargando', async () => {
    let abrir; s.puerta = new Promise((r) => { abrir = r; });
    s.yo = { status: 401, body: { sesion: false } };
    await page.goto(URL_SRV);
    await g.visible('Mientras se comprueba el acceso se ve la pantalla de entrada', ent);
    await g.partes('…con la marca y el estado de carga', caja, ['AGX', 'Área de alumnos', 'Comprobando tu acceso']);
    await g.cuenta('…anunciado como estado', caja.locator('[role="status"]'), 1);
    await g.igual('…y la aplicación aún sin pintar', () => page.evaluate(() => document.getElementById('vista').children.length), 0);
    abrir(); s.puerta = null;
    await g.txt('Sin sesión pasa a la pantalla de acceso', page.locator('#entrada-t'), 'Tu diario, tu formación y el ranking');
  });

  await g.seccion('Pantalla de entrada: login con Discord', async () => {
    const boton = caja.getByRole('link', { name: 'Entrar con Discord' });
    await g.visible('Botón «Entrar con Discord»', boton);
    await g.attr('…que lleva al acceso con Discord', boton, 'href', '/api/auth/login');
    await g.igual('…y recibe el foco', () => page.evaluate(() => document.activeElement && document.activeElement.getAttribute('href')), '/api/auth/login');
    await g.partes('Texto de la pantalla', caja, ['Entra con la cuenta de Discord con la que estás en la comunidad AGX.', 'Solo pedimos tu nombre y tu avatar de Discord.']);
    await g.cuenta('Sin aviso de error', caja.locator('[role="alert"]'), 0);
    await g.cuenta('El diálogo de entrada tiene nombre', page.getByRole('dialog', { name: 'Tu diario, tu formación y el ranking' }), 1);
    await page.goto(URL_SRV + '?error=login');
    await g.txt('Si la entrada falló (?error=login) lo avisa', caja.locator('[role="alert"]'), 'No se ha podido completar la entrada. Vuelve a intentarlo.');
  });

  await g.seccion('Pantalla de entrada: sin acceso', async () => {
    s.yo = { status: 403, body: { sesion: true, id: '555', nombre: 'Marta Soler', avatar: null, acceso: false, motivo: 'no_miembro', admin: false } };
    await page.goto(URL_SRV);
    await g.txt('Saludo con el nombre', page.locator('#entrada-t'), 'Hola, Marta');
    await g.partes('Motivo: no está en el servidor de Discord', caja, ['Tu cuenta no está en el servidor de Discord de AGX. Únete a la comunidad y vuelve a entrar.']);
    await g.attr('Botón «Volver a comprobar»', caja.getByRole('link', { name: 'Volver a comprobar' }), 'href', '/api/auth/login');
    await g.attr('Enlace «Entrar con otra cuenta»', caja.getByRole('link', { name: 'Entrar con otra cuenta' }), 'href', '/api/auth/salir');
    s.yo = { status: 403, body: { sesion: true, id: '555', nombre: 'Marta Soler', avatar: null, acceso: false, motivo: 'sin_rol', admin: false } };
    await page.goto(URL_SRV);
    await g.partes('Otro motivo: sin acceso al área', caja, ['Tu cuenta no tiene acceso al área de alumnos. Si acabas de unirte, espera unos minutos y vuelve a entrar.']);
    await g.igual('La aplicación sigue sin pintar', () => page.evaluate(() => document.getElementById('vista').children.length), 0);
  });

  const OK = { status: 200, body: { sesion: true, id: '111', nombre: 'Lucía Ferrer', avatar: null, acceso: true, admin: false } };
  await g.seccion('Pantalla de entrada: error y «Reintentar»', async () => {
    s.yo = { status: 500, body: { error: 'error_interno' } };
    await page.goto(URL_SRV);
    await g.txt('Error del servidor', page.locator('#entrada-t'), 'No hemos podido cargar tu área');
    await g.partes('…con la indicación', caja, ['Revisa tu conexión y vuelve a intentarlo.']);
    s.yo = 'cortar';
    await page.goto(URL_SRV);
    await g.txt('Sin conexión', page.locator('#entrada-t'), 'No hemos podido cargar tu área');
    s.yo = OK; s.datos = { crudo: 'esto no es JSON' };
    await page.goto(URL_SRV);
    await g.txt('Si fallan los datos del alumno, también', page.locator('#entrada-t'), 'No hemos podido cargar tu área');
    s.datos = { status: 200, body: { datos: datosLucia() } };
    s.capturas.s1 = 'data:image/png;base64,' + env.png.toString('base64');
    s.ranking = { status: 200, body: {
      actualizado: new Date(AHORA.getTime() - 5 * 60e3).toISOString(),
      mes: [{ discord_id: '222', nombre: 'Diego Ramírez', avatar_url: null, total: 5, evaluaciones: 2, payouts: 2, otros: 1, ultimo: '2026-10-29T10:00:00.000Z' }, { discord_id: '111', nombre: 'Lucía Ferrer', avatar_url: null, total: 3, evaluaciones: 1, payouts: 1, otros: 1, ultimo: '2026-10-30T09:00:00.000Z' }],
      historico: [{ discord_id: '222', nombre: 'Diego Ramírez', avatar_url: null, total: 12, evaluaciones: 5, payouts: 4, otros: 3, ultimo: '2026-10-29T10:00:00.000Z' }, { discord_id: '111', nombre: 'Lucía Ferrer', avatar_url: null, total: 9, evaluaciones: 4, payouts: 3, otros: 2, ultimo: '2026-10-30T09:00:00.000Z' }],
      recientes: [{ message_id: 'm1', discord_id: '111', nombre: 'Lucía Ferrer', avatar_url: null, tipo: 'payout', texto: 'Primer payout de la cuenta de 50K.', url: 'https://discord.com/channels/1/2/3', fecha: '2026-10-30T09:00:00.000Z' }],
      campeones: [{ mes: '2026-09', discord_id: '222', nombre: 'Diego Ramírez', avatar_url: null, total: 6 }],
    } };
    await caja.getByRole('button', { name: 'Reintentar' }).click();
    await g.oculto('«Reintentar» recarga y, ya con todo bien, entra', ent);
  });

  await g.seccion('Entrada correcta como alumno: /api/yo y /api/datos', async () => {
    await g.txt('Saludo con su nombre de Discord', page.locator('#hero-saludo'), 'Buenas tardes, Lucía');
    await g.txt('Nombre en la barra lateral', page.locator('#alumno-nombre'), 'Lucía Ferrer');
    await g.txt('Iniciales del avatar', page.locator('#alumno-av'), 'LF');
    await g.txt('Tipo de cuenta y enlace para salir', page.locator('#alumno-sub'), 'Alumno AGX · Salir');
    await g.attr('…que cierra la sesión', page.locator('#alumno-sub a'), 'href', '/api/auth/salir');
    await g.oculto('Un alumno no ve el módulo Alumnos', menu('alumnos'));
    // Sus datos: +300, −150, +80 → +230 $, 3 operaciones, 2 ganadoras (67 %)
    await g.attr('Su diario llega de /api/datos', page.locator('#hero-neto'), 'aria-label', 'Resultado neto en octubre: +230 $');
    await g.txt('…con sus operaciones', page.locator('#hero-sub'), '3 operaciones y 67 % de acierto, sin comisiones.');
    await g.cuenta('…sin operaciones de ejemplo', page.locator('#aviso-ejemplo [data-accion="borrar-ejemplos"]'), 0);
    await g.partes('Comentario de Alex guardado en el servidor', page.locator('#comentarios'), ['Alex', 'en tu operación del 28 oct, Imbalance', 'Bien esperada.']);
    await g.partes('Aviso del plan (2 contratos con máximo de 1)', page.locator('#avisos-diario'), ['Vie 30 oct: cumpliste 3 de 4 reglas.', 'Rota: contratos máximos.']);
    await g.cumple('La captura se pide a /api/captura y se muestra', () => page.locator('#fila-s1 img[data-cap]').getAttribute('src'), (x) => /^data:image\/png;base64,/.test(x || ''));
    await g.partes('La operación sin captura lo indica', page.locator('#fila-s2'), ['Sin captura']);
    await g.ok('Se han pedido las tres capturas', ['s1', 's2', 's3'].every((id) => s.reg.capGet.includes(id)), s.reg.capGet.join(','));
    await page.goto(URL_SRV + '#alumnos');
    await g.txt('Un alumno no puede abrir #alumnos: ve su diario', h1(page), 'Diario de trading');
    await menu('ranking').click();
    await g.partes('Ranking conectado a /api/ranking', v, ['Conectado a Discord', 'Vas 2º con 3 logros', 'Estás en el podio. Te faltan 3 logros para el primer puesto.']);
    await g.cumple('…con la hora de la última sincronización', async () => compacto(await v.textContent()), (t) => /ConectadoaDiscord·actualizadohace[5-9]min/.test(t));
    await g.cumple('Su fila es la del usuario de Discord con sesión', async () => compacto(await page.locator('#rk-lista [aria-current="true"]').textContent()), (t) => t.startsWith('2') && t.includes('LucíaFerrer') && t.includes('Tú') && t.endsWith('3logros'));
    await g.attr('Enlace al mensaje de Discord', v.getByRole('link', { name: /Ver en Discord/ }), 'href', 'https://discord.com/channels/1/2/3');
    await g.partes('Campeón del mes anterior', v, ['Diego Ramírez', 'septiembre 2026 · 6 logros']);
    await g.partes('Resumen del ranking en la barra lateral', page.locator('#lat-widgets'), ['Ranking de octubre', '2º · 3 logros']);
    await menu('formacion').click();
    await g.partes('Formación con su progreso del servidor (nivel 1 aprobado, 7 lecciones)', v, ['Nivel 2 de 14', 'Cómo se mueve el precio', '7 de 70 lecciones aprobadas.']);
    await menu('diario').click();
  });

  await g.seccion('Guardado en el servidor: PUT /api/datos, capturas y fallo de red', async () => {
    const antes = s.reg.put.length;
    await per('semana').click();
    const r = await s.esperaPut((b) => b.periodo === 'semana');
    g.ok('Cambiar el periodo envía el estado a PUT /api/datos', r.ok, `PUT recibidos: ${s.reg.put.length - antes}`);
    if (r.ok) {
      g.ok('…con las operaciones del alumno', Array.isArray(r.v.trades) && r.v.trades.map((t) => t.id).join(',') === 's1,s2,s3', JSON.stringify((r.v.trades || []).map((t) => t.id)));
      g.ok('…y el resto del estado (plan, ruta, objetivo)', !!(r.v.plan && r.v.plan.maxContratos === 1 && r.v.ruta && r.v.ruta.lec['n1-1'].ok && r.v.objetivo === 3000), JSON.stringify(r.v).slice(0, 200));
    }
    await per('mes').click();
    await page.getByRole('button', { name: 'Nueva operación' }).click();
    await etiqueta(page, '#form-op input[name="f-setup"][value="Imbalance"]').click();
    await page.locator('#f-imp').fill('50');
    await page.locator('#f-cap').setInputFiles({ name: 'captura.png', mimeType: 'image/png', buffer: env.png });
    await page.getByAltText('Vista previa de la captura de ATAS').waitFor();
    await page.locator('#btn-guardar-op').click();
    await g.toast(page, 'Operación guardada');
    const r2 = await s.esperaPut((b) => (b.trades || []).length === 4);
    g.ok('Guardar una operación la envía al servidor', r2.ok, `último PUT: ${JSON.stringify(s.reg.put[s.reg.put.length - 1]).slice(0, 200)}`);
    const nuevaOp = r2.ok ? r2.v.trades[3] : {};
    g.ok('…con sus datos', nuevaOp.usd === 50 && nuevaOp.setup === 'Imbalance' && nuevaOp.fecha === '2026-10-30' && nuevaOp.inst === 'NQ' && nuevaOp.ejemplo === false, JSON.stringify(nuevaOp).slice(0, 240));
    const rc = await hasta(() => s.reg.capPut.find((c) => c.id === nuevaOp.id) || null, (x) => !!x, 4000);
    g.ok('…y su captura se sube a PUT /api/captura?id=…', rc.ok && /^data:image\/jpeg;base64,/.test(rc.v.cuerpo), rc.ok ? rc.v.cuerpo.slice(0, 40) : 'sin petición');
    await g.attr('El resultado se actualiza (+230 + 50)', page.locator('#hero-neto'), 'aria-label', 'Resultado neto en octubre: +280 $');
    await page.reload();
    await g.attr('Al recargar, el servidor devuelve lo guardado', page.locator('#hero-neto'), 'aria-label', 'Resultado neto en octubre: +280 $');
    await g.cumple('…incluida la captura', () => page.locator(`#fila-${nuevaOp.id} img[data-cap]`).getAttribute('src'), (x) => /^data:image\/jpeg;base64,/.test(x || ''));
    await abrirDetalle(page, nuevaOp.id);
    await page.locator(`#det-${nuevaOp.id} [data-accion="borrar"]`).click();
    await page.locator(`#det-${nuevaOp.id} [data-accion="borrar-si"]`).click();
    const r3 = await s.esperaPut((b) => (b.trades || []).length === 3 && s.reg.put.indexOf(b) > s.reg.put.indexOf(r2.v));
    g.ok('Borrarla también se guarda', r3.ok);
    g.ok('…y borra su captura (DELETE /api/captura)', (await hasta(() => s.reg.capDel.includes(nuevaOp.id), (x) => x, 3000)).ok, s.reg.capDel.join(','));
    s.datosPut = 500;
    await per('todo').click();
    await g.toast(page, 'No se ha podido guardar. Revisa tu conexión.', 'Si el servidor falla al guardar, avisa');
    s.datosPut = 200;
    await per('mes').click();
    g.ok('Y al volver la conexión guarda otra vez', (await s.esperaPut((b) => b.periodo === 'mes' && s.reg.put.indexOf(b) > s.reg.put.indexOf(r3.v))).ok);
  });

  await g.seccion('Plan e IA en el servidor: informes y análisis', async () => {
    await pestana('Plan e IA').click();
    const ia = page.locator('#ia-cuerpo'), dia = ia.locator('[data-accion="analizar"][data-tipo="dia"]');
    await g.partes('Lista de informes vacía y análisis disponibles (GET /api/analisis)', ia, ['Analizar el 30 oct', 'Analizar la semana', 'Te quedan 3 análisis hoy.', 'Aún no hay informes.']);
    await g.partes('Cumplimiento de su plan: 1 de 3 días, 10 de 12 reglas', page.locator('#cumple'), ['1 de 3 días', 'cumpliste todo el plan.', 'Contando regla a regla, un 83 %.']);
    s.analisisPost = { status: 200, body: { restantes: 2, informe: { clave: 'dia:2026-10-30', tipo: 'dia', origen: 'manual', desde: '2026-10-30', hasta: '2026-10-30', creado: '2026-10-30T15:31:00.000Z', huella: 'x', n: 1, neto: 80, dias: 1, diasOk: 0, detalle: [], ia: { puntuacion: 6, titular: 'Buen día, pero con el doble de tamaño', resumen: 'Ganaste 80 $ con 2 contratos cuando tu plan dice 1.', bien: ['Apuntaste setup y nota.'], mal: [{ regla: 'Contratos máximos', detalle: 'Entraste con 2 contratos.' }], patrones: [], acciones: ['Fija 1 contrato en el DOM.'] } } } };
    await dia.click();
    await g.toast(page, 'Análisis listo');
    g.ok('El análisis se pide a POST /api/analisis con el tipo y la fecha', s.reg.analisis.length === 1 && s.reg.analisis[0].tipo === 'dia' && s.reg.analisis[0].fecha === '2026-10-30', JSON.stringify(s.reg.analisis));
    await g.partes('El informe aparece con su nota y sus bloques', ia, ['Te quedan 2 análisis hoy.', 'Pedido por ti', 'Parte del vie 30 oct', '6', '/10', '+80 $', 'Buen día, pero con el doble de tamaño', 'Lo que hiciste bien', 'Apuntaste setup y nota.', 'Lo que tienes que corregir', 'Contratos máximos', 'Para tu próxima sesión', 'Fija 1 contrato en el DOM.']);
    await g.partes('Si el diario cambió desde el análisis, lo avisa y ofrece repetirlo', ia, ['Has cambiado operaciones o el plan desde este análisis.', 'Volver a analizar']);
    s.analisisPost = { status: 429, body: { error: 'limite', restantes: 0 } };
    await ia.locator('[data-accion="analizar"][data-tipo="semana"]').click();
    await g.toast(page, 'Has llegado al máximo de análisis de hoy.', 'Al llegar al límite diario, avisa');
    await g.partes('…y lo refleja', ia, ['Te quedan 0 análisis hoy.']);
    g.ok('…tras pedir el de la semana', s.reg.analisis.length === 2 && s.reg.analisis[1].tipo === 'semana', JSON.stringify(s.reg.analisis));
    await abrirPaleta(page); await page.locator('#paleta-in').fill('cerrar sesion discord');
    await g.txt('Con sesión, las acciones rápidas incluyen «Cerrar sesión»', page.locator('#paleta-lista [role="option"][aria-selected="true"]'), 'Cerrar sesión');
    await page.locator('#paleta-in').fill('alumnos admin');
    await g.cuenta('…pero no la de alumnos', page.locator('#paleta-lista [role="option"]'), 0);
    await page.keyboard.press('Escape');
  });

  await g.seccion('Importar en el servidor: la IA analiza sola el último día ya cerrado', async () => {
    s.analisisPost = { status: 200, body: { restantes: 1, informe: { clave: 'dia:2026-10-29', tipo: 'dia', origen: 'auto', desde: '2026-10-29', hasta: '2026-10-29', creado: '2026-10-30T15:32:00.000Z', huella: 'y', n: 2, neto: -190, dias: 1, diasOk: 0, detalle: [], ia: { puntuacion: 4, titular: 'Dos pérdidas y ninguna nota', resumen: 'Perdiste en las dos entradas y no apuntaste por qué entraste.', bien: [], mal: [], patrones: [], acciones: [] } } } };
    const antes = s.reg.analisis.length;
    await pestana('Resumen').click();
    await page.getByRole('button', { name: 'Importar de ATAS' }).click();
    await page.locator('#imp-file').setInputFiles({ name: 'atas.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV_ATAS, 'utf8') });
    await page.locator('#imp-pie [data-accion="imp-ok"]').click();
    // Importadas: 27, 28, 29 y 30 oct. El último día ya cerrado es el 29 y no tenía informe → se pide solo.
    await g.toast(page, 'La IA ha revisado tu 29 oct. Lo tienes en Plan e IA', 'Tras importar, aviso de que la IA ha revisado el 29 oct');
    g.ok('…pedido a POST /api/analisis para ese día', s.reg.analisis.length === antes + 1 && s.reg.analisis[antes].tipo === 'dia' && s.reg.analisis[antes].fecha === '2026-10-29', JSON.stringify(s.reg.analisis.slice(antes)));
    const iPost = s.reg.orden.lastIndexOf('POST /api/analisis'), iPut = s.reg.orden.lastIndexOf('PUT /api/datos', iPost), ultimo = s.reg.put[s.reg.put.length - 1] || {};
    g.ok('…después de guardar en el servidor las operaciones importadas', iPut >= 0 && iPut < iPost && (ultimo.trades || []).length === 7 && ultimo.trades.filter((t) => t.origen === 'atas').length === 4, `orden: ${s.reg.orden.slice(-4).join(' → ')}; operaciones guardadas: ${(ultimo.trades || []).length}`);
    // +230 +250 −40 +150 −200 = +390 $; 7 operaciones, 4 ganadoras → 57 %
    await g.attr('El diario suma lo importado', page.locator('#hero-neto'), 'aria-label', 'Resultado neto en octubre: +390 $');
    await g.txt('…con su recuento', page.locator('#hero-sub'), '7 operaciones y 57 % de acierto, sin comisiones.');
    await pestana('Plan e IA').click();
    await g.partes('El parte automático aparece en Plan e IA, detrás del de hoy', page.locator('#ia-cuerpo'), ['Parte del vie 30 oct', 'Parte automático', 'Parte del jue 29 oct', '4', '/10', '−190 $']);
    await pestana('Resumen').click();
  });

  await g.seccion('Sesión caducada al guardar', async () => {
    s.datosPut = 401; s.yo = { status: 401, body: { sesion: false } };
    await per('semana').click();
    await g.toast(page, 'Tu sesión ha caducado. Vuelve a entrar.', 'Si el servidor responde 401 al guardar, avisa');
    await g.txt('…y recarga hasta la pantalla de acceso', page.locator('#entrada-t'), 'Tu diario, tu formación y el ranking');
    s.datosPut = 200;
  });

  await g.seccion('Administrador: módulo Alumnos (lista y buscador)', async () => {
    const lucia = { id: '111', nombre: 'Lucía Ferrer', avatar: null, ultimaVez: '2026-10-30T15:00:00.000Z', datos: datosLucia(), ultimoInforme: { hasta: '2026-10-29', tipo: 'dia', puntuacion: 7, titular: 'Sin nota no hay revisión' } };
    const diego = { id: '222', nombre: 'Diego Ramírez', avatar: null, ultimaVez: '2026-10-28T10:00:00.000Z', datos: { periodo: 'mes', trades: [opSrv('d1', 27, 15, 45, 'NQ', 'L', 1, 500, 'Patrón Gonzi', 'De manual', 'Muy bien.')], temas: {} }, ultimoInforme: null };
    const nerea = { id: '333', nombre: 'Nerea Gil', avatar: null, ultimaVez: '2026-10-12T10:00:00.000Z', datos: null, ultimoInforme: null };
    s.yo = { status: 200, body: { sesion: true, id: '999', nombre: 'Alex Gonzi', avatar: null, acceso: true, admin: true } };
    s.datos = { status: 200, body: { datos: null } };
    s.alumnos = { status: 200, body: { alumnos: [nerea, diego, lucia] } };
    s.adminCapturas['111/s1'] = 'data:image/png;base64,' + env.png.toString('base64');
    s.informesAdmin = { ia: true, informes: [{ clave: 'dia:2026-10-29', tipo: 'dia', origen: 'auto', desde: '2026-10-29', hasta: '2026-10-29', creado: '2026-10-29T22:10:00.000Z', huella: 'h', n: 1, neto: -150, dias: 1, diasOk: 0, detalle: [], ia: { puntuacion: 5, titular: 'Sin nota no hay revisión', resumen: 'Perdiste 150 $ y no apuntaste por qué entraste.', bien: [], mal: [{ regla: 'Registrar setup y nota', detalle: 'Falta la nota.' }], patrones: [], acciones: ['Apunta la nota al cerrar.'] } }] };
    let abrir; s.puertaAlumnos = new Promise((r) => { abrir = r; });
    await cargar(page, URL_SRV + '#diario');
    await g.txt('Entra como administrador', page.locator('#alumno-sub'), 'Administrador · Salir');
    await g.visible('El módulo Alumnos aparece en el menú', menu('alumnos'));
    await g.attr('Su propio diario está vacío', page.locator('#hero-neto'), 'aria-label', 'Resultado neto en octubre: sin operaciones');
    await g.partes('…con la invitación a crear el plan', page.locator('#avisos-diario'), ['Crea tu plan de trading.', 'Crear mi plan']);
    await menu('formacion').click();
    await g.partes('En formación ve todo desbloqueado', v, ['Vista de Alex: todo desbloqueado']);
    await g.cuenta('…las 70 lecciones', v.locator('a[href^="#formacion/l/"]'), 71);
    await menu('alumnos').click();
    await g.igual('Alumnos: URL', () => hashDe(page), '#alumnos');
    await g.txt('Alumnos: título', h1(page), 'Alumnos');
    await g.partes('Mientras llega la lista, lo indica', v, ['Cargando alumnos…']);
    abrir(); s.puertaAlumnos = null;
    const tarjetas = v.locator('a[href^="#alumnos/"]');
    await g.igual('Lista de alumnos, primero quien operó más recientemente', async () => (await tarjetas.evaluateAll((a) => a.map((x) => x.getAttribute('href')))).join(' '), '#alumnos/111 #alumnos/222 #alumnos/333');
    // Semana: Lucía 3 + Diego 1; sin comentar: s2 y s3; formación media: (7/70 + 0 + 0)/3 = 3 %
    await g.tiene('Resumen general', v, ['Alumnos 3 han entrado al área', 'Esta semana 4 operaciones registradas', 'Sin comentar 2 operaciones esperando tu revisión', 'Formación media 3 % de las lecciones de la ruta']);
    await g.partes('Tarjeta de Lucía', v.locator('a[href="#alumnos/111"]'), ['Lucía Ferrer', 'Última operación: 30 oct', '3', 'ops. este mes', '+230 $', 'resultado del mes', '10 %', 'formación', 'Plan cumplido', '1 de 3', 'días', 'IA', '7/10', '2 operaciones sin comentar']);
    await g.partes('Tarjeta de Diego', v.locator('a[href="#alumnos/222"]'), ['Diego Ramírez', 'Última operación: 27 oct', '1', 'ops. este mes', '+500 $', '0 %', 'Sin plan de trading', 'Todo revisado']);
    await g.partes('Tarjeta de quien aún no ha operado', v.locator('a[href="#alumnos/333"]'), ['Nerea Gil', 'Sin operaciones todavía', '0', 'ops. este mes', '−', 'resultado del mes', '0 %', 'Sin plan de trading']);
    await page.getByLabel('Buscar alumno').fill('dié');
    await g.igual('El buscador filtra por nombre (sin tildes)', async () => (await tarjetas.evaluateAll((a) => a.filter((x) => !x.hidden).map((x) => x.getAttribute('href')))).join(' '), '#alumnos/222');
    await page.getByLabel('Buscar alumno').fill('');
    await g.igual('…y al borrarlo vuelven todos', () => tarjetas.evaluateAll((a) => a.filter((x) => !x.hidden).length), 3);
    await abrirPaleta(page); await page.locator('#paleta-in').fill('alumnos admin');
    await g.txt('Las acciones rápidas del administrador incluyen la de alumnos', page.locator('#paleta-lista [role="option"][aria-selected="true"]'), 'Ver las operaciones de los alumnos');
    await page.keyboard.press('Escape');
  });

  await g.seccion('Administrador: abrir un alumno, revisar y comentar una operación', async () => {
    const puts = s.reg.put.length;
    await v.locator('a[href="#alumnos/111"]').click();
    await g.igual('Abrir un alumno: URL', () => hashDe(page), '#alumnos/111');
    await g.txt('Título con su nombre', h1(page), 'Diario de Lucía Ferrer');
    await g.cuenta('Enlace para volver a la lista', v.locator('a[href="#alumnos"]'), 1);
    await g.cuenta('Sin botones de nueva operación', page.locator('[data-accion="nueva"]'), 0);
    await g.cuenta('…ni de importar', page.locator('[data-accion="importar"]'), 0);
    await g.attr('Se ve todo su diario (periodo «Todo»)', per('todo'), 'aria-pressed', 'true');
    await g.attr('Sus cifras', page.locator('#hero-neto'), 'aria-label', 'Resultado neto desde que empezaste: +230 $');
    await g.txt('…y sus operaciones', page.locator('#hero-sub'), '3 operaciones y 67 % de acierto, sin comisiones.');
    await g.txt('Cabecera con su nombre', page.locator('#hero-saludo'), 'Lucía Ferrer');
    await g.partes('Aviso de su plan', page.locator('#avisos-diario'), ['Vie 30 oct: cumplió 3 de 4 reglas.', 'Rota: contratos máximos.']);
    await g.partes('Panel de comentarios del revisor', v, ['Tus comentarios', 'Los últimos que le has dejado']);
    await g.partes('…con el que ya tenía', page.locator('#comentarios'), ['Tú', 'en su operación del 28 oct, Imbalance', 'Bien esperada.']);
    await g.partes('Panel de errores en tercera persona', v, ['Lo que le cuestan sus errores']);
    await g.cumple('Su captura se pide a /api/admin/captura', () => page.locator('#fila-s1 img[data-cap]').getAttribute('src'), (x) => /^data:image\/png;base64,/.test(x || ''));
    g.ok('…con el alumno y la operación', s.reg.adminCap.includes('111/s1'), s.reg.adminCap.join(','));
    await abrirDetalle(page, 's2');
    const area = page.getByLabel('Tu comentario');
    await g.partes('Detalle de una operación suya', page.locator('#det-s2'), ['−150 $', 'con 1 contrato de ES (S&P 500), sesión de NY.', 'Su nota', 'Sin nota.', 'Tu comentario', 'Guardar comentario']);
    await g.cuenta('…sin editar ni borrar', page.locator('#det-s2 [data-accion="editar-op"], #det-s2 [data-accion="borrar"]'), 0);
    await g.valor('Comentario vacío', area, '');
    await area.fill('Falta la nota. Apunta por qué entraste.');
    await page.locator('#det-s2 [data-accion="guardar-com"]').click();
    await g.txt('Guardar comentario: estado', page.locator('#com-est-s2'), 'Guardado. Lo verá en su diario.');
    await g.toast(page, 'Comentario guardado');
    g.ok('El comentario se envía a PUT /api/admin/comentario', s.reg.comentarios.length === 1 && s.reg.comentarios[0].alumno === '111' && s.reg.comentarios[0].trade === 's2' && s.reg.comentarios[0].texto === 'Falta la nota. Apunta por qué entraste.', JSON.stringify(s.reg.comentarios));
    await g.partes('…y aparece en el panel de comentarios', page.locator('#comentarios'), ['en su operación del 29 oct, Divergencia', 'Falta la nota. Apunta por qué entraste.', 'en su operación del 28 oct, Imbalance']);
    await abrirDetalle(page, 's1');
    await g.valor('El comentario anterior se puede editar', page.locator('#com-s1'), 'Bien esperada.');
    await page.locator('#com-s1').fill('');
    await page.locator('#det-s1 [data-accion="guardar-com"]').click();
    await g.txt('Vaciar el comentario lo borra', page.locator('#com-est-s1'), 'Comentario borrado.');
    s.comentario = 500;
    await page.locator('#com-s1').fill('Otra vez');
    await page.locator('#det-s1 [data-accion="guardar-com"]').click();
    await g.txt('Si el servidor falla, lo dice', page.locator('#com-est-s1'), 'No se ha podido guardar. Vuelve a intentarlo.');
    s.comentario = 200;
    await pestana('Estadísticas').click();
    await g.igual('Estadísticas del alumno: URL', () => hashDe(page), '#alumnos/111/estadisticas');
    await g.partes('…con sus números', page.locator('#est'), ['Resultado neto', '+230 $', '3 operaciones', 'Acierto', '67 %', '2 de 3']);
    await pestana('Plan e IA').click();
    await g.igual('Plan del alumno: URL', () => hashDe(page), '#alumnos/111/plan');
    await g.partes('Su plan, solo lectura', page.locator('#form-plan'), ['Su plan de trading', 'Actualizado el 20 oct']);
    await g.valor('…con sus valores', page.locator('#pl-perdida'), '200');
    await g.igual('…campos desactivados', () => page.locator('#pl-perdida').isDisabled(), true);
    await g.cuenta('…sin botón de guardar', page.locator('#form-plan').getByRole('button', { name: 'Guardar plan' }), 0);
    await g.partes('Su cuenta de fondeo', page.locator('section[aria-labelledby="t-cta"]'), ['Su cuenta de fondeo', 'No ha configurado su cuenta.']);
    await g.partes('Su cumplimiento', page.locator('#cumple'), ['1 de 3 días', 'cumplió todo el plan.', 'Contando regla a regla, un 83 %.']);
    await g.partes('Sus informes llegan de /api/admin/informes', page.locator('#ia-cuerpo'), ['Parte automático', 'Parte del jue 29 oct', '5', '/10', '−150 $', 'Sin nota no hay revisión']);
    g.ok('…pedidos para ese alumno', s.reg.informes.includes('111'), s.reg.informes.join(','));
    await g.cuenta('…sin botones de analizar', page.locator('#ia-cuerpo [data-accion="analizar"]'), 0);
    g.ok('Revisando a un alumno no se guarda nada en /api/datos', s.reg.put.length === puts, `PUT nuevos: ${s.reg.put.length - puts}`);
    await v.locator('a[href="#alumnos"]').click();
    await g.partes('De vuelta en la lista, Lucía tiene una operación menos sin comentar (y la que se borró)', v.locator('a[href="#alumnos/111"]'), ['2 operaciones sin comentar']);
    await page.goto(URL_SRV + '#alumnos/000');
    await g.partes('Un alumno que no existe', v, ['No encuentro a ese alumno.', 'Volver a la lista']);
    await menu('diario').click();
    await g.txt('Al salir vuelve su propio diario', h1(page), 'Diario de trading');
    await g.attr('…vacío, sin mezclar datos del alumno', page.locator('#hero-neto'), 'aria-label', 'Resultado neto en octubre: sin operaciones');
    await g.visible('…con sus botones de siempre', page.getByRole('button', { name: 'Nueva operación' }));
  });
  g.ok('Todas las peticiones del modo servidor estaban previstas', s.reg.otras.length === 0, s.reg.otras.join(' | '));
  cierre(g);
}

/* =====================================================================================================
 * GRUPO 6 · Formación en el servidor (alumno): bloqueo y desbloqueo, test de lección y examen de nivel
 * ===================================================================================================== */
async function gFormacionRuta(g, env) {
  const s = crearServidor(env, { yo: { status: 200, body: { sesion: true, id: '444', nombre: 'Pablo Ortega', avatar: null, acceso: true, admin: false } } });
  const { page } = await contexto(g, env, { nombre: 'formación-ruta', servidor: s, tolera: TOLERA_API });
  const v = page.locator('#vista');
  const L = env.lec, n1 = env.clave.ruta[0], n2 = env.clave.ruta[1];
  const nivel = (titulo) => v.locator('details').filter({ hasText: titulo });
  const enlace = (id) => v.locator(`a[href="#formacion/l/${id}"]`);
  await page.goto(URL_SRV + '#formacion');

  await g.seccion('Ruta de un alumno nuevo: solo la primera lección está disponible', async () => {
    await g.txt('Título', h1(page), 'Formación AGX');
    await g.partes('Cabecera', v, ['Nivel 1 de 14', n1.titulo, '0 de 70 lecciones aprobadas.']);
    await g.attr('Progreso 0 %', page.locator('#f-pct'), 'aria-label', 'Completado: 0 %');
    await g.cuenta('Una sola lección abierta (más el botón de empezar)', v.locator('a[href^="#formacion/l/"]'), 2);
    await g.txt('Botón de empezar', enlace('n1-1').first(), 'Empezar: ' + L['n1-1'].titulo);
    await g.cuenta('Ningún examen de nivel disponible', v.locator('[data-accion="examen-nivel"]'), 0);
    // 69 lecciones + 14 exámenes bloqueados + 4 lecciones en preparación
    await g.cuenta('Todo lo demás, bloqueado', v.locator('[aria-disabled="true"]'), 87);
    await g.partes('Nivel 1: primera disponible, resto y examen bloqueados', nivel(n1.titulo), ['01', n1.titulo, '0 de 5', L['n1-1'].titulo, 'Disponible', L['n1-2'].titulo, 'Bloqueada', L['n1-5'].titulo, 'Bloqueada', 'Examen del nivel 1', 'Bloqueado']);
    await g.cuenta('…cinco elementos bloqueados en el nivel 1', nivel(n1.titulo).locator('[aria-disabled="true"]'), 5);
    await g.partes('Nivel 2 bloqueado', nivel(n2.titulo), ['02', n2.titulo, 'Bloqueado']);
    await nivel(n2.titulo).locator('summary').click();
    await g.igual('Un nivel bloqueado se puede desplegar', () => nivel(n2.titulo).evaluate((d) => d.open), true);
    await g.cuenta('…pero sin nada que abrir', nivel(n2.titulo).locator('a, button'), 0);
    await g.partes('…con sus lecciones bloqueadas', nivel(n2.titulo), [L['n2-1'].titulo, 'Bloqueada']);
    await page.goto(URL_SRV + '#formacion/l/n1-2');
    await g.partes('Entrar por URL a una lección bloqueada', v, [L['n1-2'].titulo, 'Esta lección se desbloquea al aprobar la anterior.', 'Ir a mi siguiente lección']);
    await g.cuenta('…sin test', v.locator('[data-accion="test-leccion"]'), 0);
    await page.goto(URL_SRV + '#formacion/l/n2-1');
    await g.partes('La primera de un nivel bloqueado pide también el examen', v, ['Esta lección se desbloquea al aprobar la anterior y el examen del nivel previo.']);
    await page.goto(URL_SRV + '#formacion/l/n13-1');
    await g.partes('Una lección en preparación', v, ['Esta lección sale de las clases en directo de Alex y todavía se está preparando.']);
    await page.goto(URL_SRV + '#formacion/l/no-existe');
    await g.partes('Una lección que no existe', v, ['No encuentro esa lección.', 'Volver a la ruta']);
    await v.getByRole('link', { name: 'Volver a la ruta' }).click();
    await g.igual('…y se vuelve a la ruta', () => hashDe(page), '#formacion');
  });

  await g.seccion('Test de lección: fallar a propósito (8 de 10) y repaso de fallos', async () => {
    await enlace('n1-1').last().click();
    await g.txt('Abrir la lección disponible', h1(page), L['n1-1'].titulo);
    await g.partes('Su ficha', v, ['Nivel 1 · ' + n1.titulo + ' · Lección 1 de 5', '7 min de lectura y un test de 10 preguntas. Apruebas con 9 aciertos.']);
    await g.txt('Botón del test', v.locator('[data-accion="test-leccion"]'), 'Hacer el test');
    await v.locator('[data-accion="test-leccion"]').click();
    await g.txt('Empieza el test', h1(page), 'Test: ' + L['n1-1'].titulo);
    const hechas = await hacerPractica(page, env, (i) => (i === 3 || i === 7 ? 'mal' : 'bien'), {
      tras: async (r) => {
        if (r.i === 1) await g.partes('Respuesta correcta: «Correcto» y la explicación', v, ['Correcto', r.p.nota]);
        if (r.i === 3) await g.partes('Respuesta fallada: dice la letra correcta y la explica', v, [`Incorrecto, era la ${r.letraOk}`, r.p.nota, 'Guardada en tu lista de fallos para repasarla.']);
        if (r.i === 3) await g.attr('…la barra de progreso avanza', v.locator('[role="progressbar"]'), 'aria-valuenow', '3');
      },
    });
    const malas = hechas.filter((x) => !x.bien);
    await g.partes('Resultado: no aprobada con 8 de 10', v, ['Resultado del test', '8/10', 'correctas', L['n1-1'].titulo, 'No aprobada', '8 de 10 correctas', 'Necesitas 9 de 10. Repasa la teoría y vuelve a intentarlo; abajo tienes las que fallaste.', 'Repetir el test', 'Volver a la lección']);
    await g.cuenta('…sin botón de siguiente lección', v.locator('[data-accion="ir-leccion"]'), 0);
    await g.partes('Repaso de fallos: las dos preguntas, tu respuesta, la correcta y la explicación', v, ['Repasa tus fallos', '2 preguntas', malas[0].p.texto, 'Tu respuesta: ' + malas[0].elegida, 'Correcta: ' + malas[0].p.opciones[0], malas[0].p.nota, malas[1].p.texto, 'Tu respuesta: ' + malas[1].elegida, 'Correcta: ' + malas[1].p.opciones[0], malas[1].p.nota]);
    await g.cuenta('Navegador: la 3 incorrecta', v.locator('[aria-label="Pregunta 3, incorrecta"]'), 1);
    await g.cuenta('…la 7 incorrecta', v.locator('[aria-label="Pregunta 7, incorrecta"]'), 1);
    await g.cuenta('…y 8 correctas', v.locator('[aria-label^="Pregunta "][aria-label$=", correcta"]'), 8);
    await g.cuenta('Sin confeti al suspender', page.locator('body > canvas'), 0);
    const r = await s.esperaPut((b) => b.ruta && b.ruta.lec && b.ruta.lec['n1-1'] && b.ruta.lec['n1-1'].intentos === 1);
    g.ok('El intento se guarda en el servidor: 80 %, sin aprobar, 2 fallos', r.ok && r.v.ruta.lec['n1-1'].mejor === 80 && !r.v.ruta.lec['n1-1'].ok && (r.v.fallos || []).length === 2, r.ok ? JSON.stringify(r.v.ruta.lec['n1-1']) + ' fallos ' + JSON.stringify(r.v.fallos) : 'sin PUT');
    await v.locator('[data-accion="temario"]').first().click();
    await g.partes('De vuelta en la lección: mejor nota y botón de repetir', v, ['Tu mejor nota: 80 %. Necesitas un 90 % para aprobar.', 'Repetir el test']);
    await v.getByRole('link', { name: 'Ruta de formación' }).click();
    await g.cuenta('La siguiente lección sigue bloqueada', enlace('n1-2'), 0);
    await g.partes('…y el progreso a cero', v, ['0 de 70 lecciones aprobadas.']);
  });

  await g.seccion('Test de lección: aprobar al 100 % desbloquea la siguiente', async () => {
    await enlace('n1-1').last().click();
    await v.locator('[data-accion="test-leccion"]').click();
    await hacerPractica(page, env, () => 'bien');
    await g.partes('Resultado: aprobada con 10 de 10', v, ['10/10', 'Aprobada', '10 de 10 correctas', `Se ha desbloqueado «${L['n1-2'].titulo}».`, 'Siguiente lección', 'Repetir el test']);
    await g.sinTexto('…sin lista de fallos', v, 'Repasa tus fallos');
    await g.cumple('Confeti al aprobar', () => page.locator('body > canvas').count(), (n) => n === 1, 3000);
    await g.partes('La barra lateral cuenta la lección', page.locator('#lat-widgets'), ['Formación: 1 de 70 lecciones', '1 %']);
    const r = await s.esperaPut((b) => b.ruta && b.ruta.lec && b.ruta.lec['n1-1'] && b.ruta.lec['n1-1'].ok === true);
    g.ok('Se guarda en el servidor: aprobada, 100 %, 2 intentos, fecha de hoy, fallos limpios', r.ok && r.v.ruta.lec['n1-1'].mejor === 100 && r.v.ruta.lec['n1-1'].intentos === 2 && r.v.ruta.lec['n1-1'].fecha === '2026-10-30' && (r.v.fallos || []).length === 0, r.ok ? JSON.stringify(r.v.ruta.lec['n1-1']) + ' fallos ' + JSON.stringify(r.v.fallos) : 'sin PUT');
    await v.locator('[data-accion="ir-leccion"]').click();
    await g.igual('«Siguiente lección» abre la desbloqueada', () => hashDe(page), '#formacion/l/n1-2');
    await g.txt('…con su título', h1(page), L['n1-2'].titulo);
    await g.txt('…y su test disponible', v.locator('[data-accion="test-leccion"]'), 'Hacer el test');
    await g.cuenta('…y enlace a la anterior', enlace('n1-1'), 1);
    await enlace('n1-1').click();
    await g.partes('La lección aprobada lo indica', v, ['Aprobada con un 100 % el 30 oct.', 'Repetir el test', 'Siguiente lección']);
    await v.getByRole('link', { name: 'Ruta de formación' }).click();
    await g.partes('Ruta: cambia el progreso', v, ['Nivel 1 de 14', '1 de 70 lecciones aprobadas.']);
    await g.attr('…1 %', page.locator('#f-pct'), 'aria-label', 'Completado: 1 %');
    await g.txt('…y el botón pasa a «Continuar» con la siguiente', enlace('n1-2').first(), 'Continuar: ' + L['n1-2'].titulo);
    await g.partes('Nivel 1: primera aprobada, segunda disponible, tercera bloqueada', nivel(n1.titulo), ['1 de 5', L['n1-1'].titulo, '100 %', L['n1-2'].titulo, 'Disponible', L['n1-3'].titulo, 'Bloqueada', 'Examen del nivel 1', 'Bloqueado']);
    await g.cuenta('…dos lecciones abiertas', nivel(n1.titulo).locator('a[href^="#formacion/l/"]'), 2);
    await g.cuenta('…cuatro elementos bloqueados', nivel(n1.titulo).locator('[aria-disabled="true"]'), 4);
    await page.reload();
    await g.partes('Al recargar, el servidor devuelve el progreso', v, ['1 de 70 lecciones aprobadas.']);
  });

  const exNivel = v.locator('[data-accion="examen-nivel"][data-n="n1"]');
  let fallosPrevios = [];
  await g.seccion('Última lección del nivel (con teclado) y examen de nivel: empezar y abandonar', async () => {
    // Otra sesión: el alumno ya tiene aprobadas las cuatro primeras lecciones
    const lec = Object.fromEntries(['n1-1', 'n1-2', 'n1-3', 'n1-4'].map((k) => [k, { ok: true, mejor: 90, intentos: 1, fecha: '2026-10-28' }]));
    s.datos = { status: 200, body: { datos: { periodo: 'mes', trades: [], temas: {}, examen: null, fallos: [], bloque: 'base', progresoEjemplo: false, objetivo: 3000, plan: null, ruta: { lec, niv: {} }, cuenta: null, rutinas: {} } } };
    await cargar(page, URL_SRV + '#formacion');
    await g.partes('Cuatro lecciones aprobadas: falta la quinta', v, ['4 de 70 lecciones aprobadas.']);
    await g.partes('…con sus notas, y el examen aún bloqueado', nivel(n1.titulo), ['4 de 5', '90 %', L['n1-5'].titulo, 'Disponible', 'Examen del nivel 1', 'Bloqueado']);
    await g.cuenta('…sin botón de examen', exNivel, 0);
    await enlace('n1-5').last().click();
    await v.locator('[data-accion="test-leccion"]').click();
    fallosPrevios = (await hacerPractica(page, env, (i) => (i === 10 ? 'mal' : 'bien'), { teclado: () => true })).filter((x) => !x.bien).map((x) => x.p.id);
    await g.partes('Aprobar con 9 de 10 (justo el 90 %) la última lección abre el examen', v, ['9/10', 'Aprobada', '9 de 10 correctas', 'Has terminado las lecciones del nivel. Ya puedes hacer su examen.']);
    await v.locator('[data-accion="temario"]').first().click();
    await g.partes('La lección queda aprobada con un 90 %', v, ['Aprobada con un 90 % el 30 oct.']);
    await g.txt('…y ofrece el examen del nivel', exNivel, 'Examen del nivel 1');
    await exNivel.click();
    await g.txt('El examen empieza', h1(page), 'Examen del nivel 1: ' + n1.titulo);
    await g.igual('…en la ruta', () => hashDe(page), '#formacion');
    await g.cumple('…con 20 minutos', () => page.locator('#reloj-t').textContent(), (t) => /^(20:00|19:[45]\d)$/.test(t));
    await g.partes('Panel del examen: 20 preguntas, 2 fallos como máximo', v, ['Salir del examen', 'Pregunta 1 de 20', 'Tu examen', 'Contestadas', '0 de 20', 'Sin contestar', '20', 'Para aprobar', '2 fallos o menos', 'Entregar examen']);
    await g.cuenta('…navegador de 20 preguntas', v.locator('[data-accion="ir"]'), 20);
    await page.keyboard.press('b');
    await g.cuenta('Se contesta una', v.locator('[data-accion="opcion"][aria-pressed="true"]'), 1);
    await v.locator('[data-accion="abandonar"]').click();
    await g.txt('«Salir del examen» vuelve a la ruta', h1(page), 'Formación AGX');
    await g.partes('…sin dejar nota: el examen sigue disponible', nivel(n1.titulo), ['5 de 5', 'Examen del nivel 1', '20 preguntas, 20 minutos · apruebas con 2 fallos o menos', 'Disponible']);
    await g.txt('…y la cabecera lo propone', exNivel.first(), 'Hacer el examen del nivel 1');
    await g.cuenta('El nivel 2 sigue bloqueado', enlace('n2-1'), 0);
  });

  await g.seccion('Examen de nivel: responder, entregar y resultado (no apto, tiempo agotado y apto)', async () => {
    await exNivel.last().click();
    // 17 bien, la 4 mal y la 8 y la 15 en blanco → 3 fallos (el máximo es 2)
    const hechas = await hacerExamen(page, env, (i) => (i === 4 ? 'mal' : i === 8 || i === 15 ? 'blanco' : 'bien'), {
      // En el examen de nivel la flecha derecha solo avanza si la pregunta está contestada (en el examen final avanza siempre;
      // ver findings), así que las que se dejan en blanco se pasan con el botón «Siguiente».
      teclado: (i, d) => i % 2 === 0 && d !== 'blanco',
      tras: async (r) => { if (r.i === 2) { await g.sinTexto('En el examen no se corrige al contestar', v, 'Correcto'); await g.cuenta('…y la pregunta contestada se marca en el navegador', v.locator('[data-accion="ir"][aria-label="Pregunta 1, contestada"]'), 1); } },
    });
    await g.partes('Al final: 18 contestadas y 2 sin contestar', v, ['Pregunta 20 de 20', 'Contestadas', '18 de 20', 'Sin contestar', '2']);
    await v.locator('[data-accion="entregar"]').click();
    await g.partes('Resultado: no apto con 3 fallos', v, ['Resultado del examen', '17/20', 'correctas', 'No apto', '3 fallos de 20', 'Para aprobar el nivel necesitas 2 fallos o menos. Repasa las lecciones donde más has fallado.', `Fallos por tema: ${fallosPorTema(env, hechas)}.`, 'Repetir examen', 'Volver a la ruta']);
    await g.partes('…con el repaso de los tres', v, ['Repasa tus fallos', '3 preguntas', hechas[3].p.texto, 'Correcta: ' + hechas[3].p.opciones[0], hechas[7].p.texto, 'Tu respuesta: sin contestar', hechas[14].p.texto, 'Tu respuesta: sin contestar']);
    const r = await s.esperaPut((b) => b.ruta && b.ruta.niv && b.ruta.niv.n1 && b.ruta.niv.n1.fallos === 3);
    g.ok('El examen suspendido se guarda en el servidor', r.ok && r.v.ruta.niv.n1.ok === false && r.v.ruta.niv.n1.total === 20, r.ok ? JSON.stringify(r.v.ruta.niv.n1) : 'sin PUT');
    // Lista de fallos: la que se falló en la lección más las tres del examen, menos las que el examen haya acertado
    const esperados = new Set(fallosPrevios); hechas.forEach((x) => { if (x.d === 'bien') esperados.delete(x.p.id); else esperados.add(x.p.id); });
    g.ok('…y la lista de fallos queda al día', r.ok && (r.v.fallos || []).slice().sort().join(',') === Array.from(esperados).sort().join(','), r.ok ? `guardados ${JSON.stringify(r.v.fallos)}, esperados ${JSON.stringify(Array.from(esperados))}` : 'sin PUT');
    await v.locator('[data-accion="temario"]').first().click();
    await g.partes('En la ruta el examen queda como no apto', nivel(n1.titulo), ['Examen del nivel 1', 'No apto · 3 fallos']);
    await g.cuenta('…y el nivel 2 sigue bloqueado', enlace('n2-1'), 0);
    await exNivel.last().click();
    const st = await esperaPregunta(page, 1), info = analizar(env, st);
    await v.locator(`[data-accion="opcion"][data-pos="${info.posOk}"]`).click();
    await g.attr('Segundo intento: una contestada', v.locator(`[data-accion="opcion"][data-pos="${info.posOk}"]`), 'aria-pressed', 'true');
    await page.clock.fastForward('20:05');
    await g.toast(page, 'Se acabó el tiempo. Examen entregado.', 'A los 20 minutos se entrega solo');
    await g.partes('…con todo lo que faltaba como fallo', v, ['1/20', 'No apto', '19 fallos de 20']);
    await v.locator('[data-accion="repetir"]').click();
    await esperaPregunta(page, 1);
    await g.cumple('«Repetir examen» empieza de nuevo con el reloj a 20:00', () => page.locator('#reloj-t').textContent(), (t) => /^(20:00|19:[45]\d)$/.test(t));
    await hacerExamen(page, env, () => 'bien', { teclado: (i) => i > 2 });
    await g.partes('Todo contestado', v, ['Contestadas', '20 de 20', 'Sin contestar', '0', 'Todo contestado. Puedes revisar y cambiar respuestas hasta que entregues.']);
    await v.locator('[data-accion="entregar"]').click();
    await g.partes('Resultado: apto sin fallos', v, ['20/20', 'Apto', '0 fallos de 20', 'Nivel aprobado. Se ha desbloqueado el nivel siguiente de la ruta.']);
    await g.cumple('Confeti al aprobar el nivel', () => page.locator('body > canvas').count(), (n) => n === 1, 3000);
    const r2 = await s.esperaPut((b) => b.ruta && b.ruta.niv && b.ruta.niv.n1 && b.ruta.niv.n1.ok === true);
    g.ok('El nivel aprobado se guarda en el servidor', r2.ok && r2.v.ruta.niv.n1.fallos === 0 && r2.v.ruta.niv.n1.fecha === '2026-10-30', r2.ok ? JSON.stringify(r2.v.ruta.niv.n1) : 'sin PUT');
    await v.locator('[data-accion="temario"]').first().click();
    await g.partes('Ruta: nivel 1 aprobado y nivel 2 en curso', v, ['Nivel 2 de 14', n2.titulo, '5 de 70 lecciones aprobadas.', '1', 'niveles aprobados', '5', 'lecciones aprobadas']);
    await g.partes('…con el examen apto', nivel(n1.titulo), ['Aprobado', 'Examen del nivel 1', 'Apto']);
    await g.partes('…y la primera lección del nivel 2 disponible', nivel(n2.titulo), ['0 de 5', L['n2-1'].titulo, 'Disponible', L['n2-2'].titulo, 'Bloqueada']);
    await g.txt('…que es la siguiente propuesta', enlace('n2-1').first(), 'Continuar: ' + L['n2-1'].titulo);
    await g.igual('El nivel en curso aparece abierto', () => nivel(n2.titulo).evaluate((d) => d.open), true);
    await page.goto(URL_SRV + '#formacion/l/n2-1');
    await g.txt('Ya se puede abrir la primera lección del nivel 2', v.locator('[data-accion="test-leccion"]'), 'Hacer el test');
  });
  g.ok('Todas las peticiones del modo servidor estaban previstas', s.reg.otras.length === 0, s.reg.otras.join(' | '));
  cierre(g);
}

/* =====================================================================================================
 * GRUPO 7 · Móvil (390×844 táctil) y desbordamiento horizontal a 360, 390, 820 y 1440
 * ===================================================================================================== */
async function recorrerDesborde(g, env, page, w) {
  const v = page.locator('#vista');
  const ir = async (hash, listo) => { await page.goto(BASE + hash); await page.locator(listo).first().waitFor(); };
  await ir('#diario', '#tabla [data-accion="detalle"]');
  await sinDesborde(g, page, w, 'Diario · Resumen');
  await abrirDetalle(page, 'e14');
  await page.locator('#det-e14').waitFor();
  await sinDesborde(g, page, w, 'Diario · operación desplegada');
  await page.locator('#fila-e14 [data-accion="ver-captura"]').click();
  await page.locator('#visor').waitFor();
  await dentro(g, page, w, '#visor-img', 'Visor de captura');
  await page.keyboard.press('Escape');
  await page.locator('[data-accion="nueva"]:visible').first().click();
  await dentro(g, page, w, '#cajon', 'Cajón de nueva operación');
  await dentro(g, page, w, '#btn-guardar-op', 'Botón de guardar del cajón');
  await page.keyboard.press('Escape');
  await page.locator('[data-accion="importar"]:visible').first().click();
  await dentro(g, page, w, '#imp [role="dialog"]', 'Ventana de importar');
  await page.locator('#imp-file').setInputFiles({ name: 'atas.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV_ATAS, 'utf8') });
  await page.locator('#imp-pie [data-accion="imp-ok"]').waitFor();
  await dentro(g, page, w, '#imp [role="dialog"]', 'Ventana de importar con la vista previa');
  await page.keyboard.press('Escape');
  await page.locator('#hoy-fila [data-accion="rutina"][data-modo="pre"]').click();
  await dentro(g, page, w, '#rut [role="dialog"]', 'Ventana de la rutina');
  await page.keyboard.press('Escape');
  await abrirPaleta(page);
  await dentro(g, page, w, '#paleta [role="dialog"]', 'Acciones rápidas');
  await cerrarPaleta(page);
  await ir('#diario/estadisticas', '#est [role="img"]');
  await sinDesborde(g, page, w, 'Diario · Estadísticas');
  await ir('#diario/plan', '#cumple [data-accion="plan-dia"]');
  await sinDesborde(g, page, w, 'Diario · Plan e IA');
  await ir('#formacion', '#vista details');
  await sinDesborde(g, page, w, 'Formación · Ruta');
  await page.evaluate(() => document.querySelectorAll('#vista details').forEach((d) => { d.open = true; }));
  await sinDesborde(g, page, w, 'Formación · Ruta con todos los niveles abiertos');
  await ir('#formacion/l/n6-6', '#vista [data-accion="test-leccion"]');
  await sinDesborde(g, page, w, 'Formación · Lección');
  await v.locator('[data-accion="test-leccion"]').click();
  await esperaPregunta(page, 1);
  await sinDesborde(g, page, w, 'Formación · Test (pregunta)');
  for (let i = 1; i <= 10; i++) {
    await esperaPregunta(page, i);
    await v.locator('[data-accion="opcion"][data-pos="0"]').click();
    const sig = v.locator('[data-accion="siguiente"], [data-accion="ver-resultado"]'); await sig.waitFor();
    if (i === 1) await sinDesborde(g, page, w, 'Formación · Test (explicación)');
    await sig.click();
  }
  await v.locator('[data-accion="repetir"]').waitFor();
  await sinDesborde(g, page, w, 'Formación · Test (resultado)');
  await ir('#formacion/libre', '#vista [data-accion="bloque"]');
  await sinDesborde(g, page, w, 'Formación · Repaso libre');
  await v.locator('[data-accion="examen"]').first().click();
  await esperaPregunta(page, 1);
  await sinDesborde(g, page, w, 'Formación · Examen (pregunta)');
  await v.locator('[data-accion="entregar"]').click();
  await v.locator('[data-accion="repetir"]').waitFor();
  await sinDesborde(g, page, w, 'Formación · Examen (resultado)');
  await ir('#ranking', '#rk-lista [aria-current="true"]');
  await sinDesborde(g, page, w, 'Ranking');
}
async function gMovil(g, env) {
  const PNG = { name: 'captura.png', mimeType: 'image/png', buffer: env.png };
  await g.seccion('Móvil 390×844 táctil: navegación, botón de nueva operación y cajón', async () => {
    const { ctx, page } = await contexto(g, env, { nombre: 'móvil-390', viewport: { width: 390, height: 844 }, movil: true, tactil: true, dpr: 2 });
    const v = page.locator('#vista'), menu = (r) => page.locator(`a[data-ruta="${r}"]`), cajon = page.locator('#cajon');
    const enPantalla = async (nombre, loc) => { await loc.scrollIntoViewIfNeeded(); const r = await hasta(() => loc.boundingBox(), (b) => !!b && b.x >= 0 && b.x + b.width <= 390.5 && b.y >= 0 && b.y + b.height <= 844.5, 3000, 100); g.ok(nombre, r.ok, JSON.stringify(r.v)); };
    await page.goto(BASE);
    await g.attr('El diario carga en el móvil', page.locator('#hero-neto'), 'aria-label', 'Resultado neto en octubre: +2.234 $');
    for (const r of ['diario', 'formacion', 'ranking']) await g.visible(`Menú: «${r}» visible`, menu(r), 2500);
    await g.oculto('Los resúmenes laterales se ocultan en móvil', page.locator('#lat-widgets'));
    await menu('formacion').tap();
    await g.txt('Tocar «Formación»', h1(page), 'Formación AGX');
    await g.attr('…queda marcada', menu('formacion'), 'aria-current', 'page');
    await menu('ranking').tap();
    await g.txt('Tocar «Ranking»', h1(page), 'Ranking de logros');
    await menu('diario').tap();
    await g.txt('Tocar «Diario»', h1(page), 'Diario de trading');
    await page.getByRole('navigation', { name: 'Secciones del diario' }).getByRole('link', { name: 'Estadísticas' }).tap();
    await g.visible('Pestaña Estadísticas tocando', page.locator('#est'));
    await page.getByRole('navigation', { name: 'Secciones del diario' }).getByRole('link', { name: 'Plan e IA' }).tap();
    await g.visible('Pestaña Plan e IA tocando', page.locator('#form-plan'));
    await page.getByRole('navigation', { name: 'Secciones del diario' }).getByRole('link', { name: 'Resumen' }).tap();
    await v.locator('[data-accion="periodo"][data-periodo="semana"]').tap();
    await g.attr('Cambiar de periodo tocando', page.locator('#hero-neto'), 'aria-label', 'Resultado neto esta semana: +1.000 $');
    await v.locator('[data-accion="periodo"][data-periodo="mes"]').tap();
    const fab = page.getByRole('button', { name: 'Nueva operación' });
    await g.cuenta('En móvil hay un único botón de nueva operación a la vista (el flotante)', fab, 1);
    await g.cumple('…fijo en la esquina inferior derecha', () => fab.boundingBox(), (b) => !!b && b.x > 195 && b.x + b.width <= 390 && b.y > 600 && b.y + b.height <= 844);
    await fab.tap();
    await g.visible('Tocarlo abre el cajón', cajon);
    await g.cumple('El cajón ocupa la pantalla sin salirse', () => cajon.boundingBox(), (b) => !!b && b.x >= 0 && Math.round(b.width) === 390 && b.height <= 844.5);
    await enPantalla('El botón de guardar queda a la vista', page.locator('#btn-guardar-op'));
    for (const [nombre, sel] of [['fecha', '#f-fecha'], ['contratos', '#f-ct'], ['stop', '#f-stop'], ['importe', '#f-imp'], ['riesgo', '#f-riesgo'], ['nota', '#f-nota']]) await enPantalla(`Campo ${nombre} alcanzable dentro del cajón`, page.locator(sel));
    await etiqueta(page, '#form-op input[name="f-setup"][value="Giro por perfil"]').tap();
    await g.marcado('Elegir setup tocando', page.locator('#form-op input[name="f-setup"][value="Giro por perfil"]'));
    await cajon.getByRole('button', { name: 'Un contrato más' }).tap();
    await g.valor('Sumar un contrato tocando', page.locator('#f-ct'), '2');
    await page.locator('#f-stop').fill('8');
    await g.valor('Riesgo: 8 × 20 × 2', page.locator('#f-riesgo'), '320');
    await page.locator('#f-imp').fill('640');
    await g.txt('R: 640/320', page.locator('#f-r'), '+2,0 R');
    await etiqueta(page, '#form-op input[name="f-err"][value="pronto"]').tap();
    await page.locator('#f-cap').setInputFiles(PNG);
    await g.visible('Captura adjunta', page.getByAltText('Vista previa de la captura de ATAS'));
    await page.locator('#btn-guardar-op').tap();
    await g.oculto('Guardar cierra el cajón', cajon);
    await g.toast(page, 'Operación guardada');
    await g.attr('La operación cuenta (+2.234 + 640)', page.locator('#hero-neto'), 'aria-label', 'Resultado neto en octubre: +2.874 $');
    const mia = page.locator('#tabla [data-accion="detalle"][data-id^="t"]');
    await g.attr('…y aparece desplegada en la lista', mia, 'aria-expanded', 'true');
    await sinDesborde(g, page, 390, 'Diario con la operación nueva desplegada');
    await page.locator('#tabla [data-accion="ver-captura"]').first().tap();
    await g.visible('Ver la captura tocando', page.locator('#visor'));
    await page.getByRole('button', { name: 'Cerrar captura' }).tap();
    await g.oculto('…y cerrarla', page.locator('#visor'));
    await page.locator('#hoy-fila [data-accion="rutina"][data-modo="pre"]').tap();
    await etiqueta(page, '#rut input[name="rut-sueno"][value="3"]').tap();
    await page.locator('#rut [data-accion="guardar-rut"]').tap();
    await g.partes('Preparar la sesión tocando', page.locator('#hoy-fila'), ['Preparada: sueño 3/5, ánimo –/5, 0 de 4 comprobaciones.']);
    await ctx.close();
  });

  for (const [w, h, opc] of [[390, 844, { movil: true, tactil: true, dpr: 2 }], [360, 740, { movil: true, tactil: true, dpr: 2 }], [820, 1180, { tactil: true }], [1440, 900, {}]]) {
    await g.seccion(`Desbordamiento horizontal a ${w} px en todas las vistas`, async () => {
      const { ctx, page } = await contexto(g, env, Object.assign({ nombre: `ancho-${w}`, viewport: { width: w, height: h } }, opc));
      try { await recorrerDesborde(g, env, page, w); } finally { await ctx.close(); }
    });
  }

  await g.seccion('Modo servidor en móvil: pantalla de entrada y Alumnos sin desbordamiento', async () => {
    const s = crearServidor(env, { yo: { status: 401, body: { sesion: false } } });
    const { ctx, page } = await contexto(g, env, { nombre: 'móvil-servidor', servidor: s, tolera: TOLERA_API, viewport: { width: 390, height: 844 }, movil: true, tactil: true, dpr: 2 });
    await page.goto(URL_SRV);
    await g.visible('Pantalla de acceso en móvil', page.locator('#entrada-caja').getByRole('link', { name: 'Entrar con Discord' }));
    await dentro(g, page, 390, '#entrada-caja', 'Pantalla de acceso');
    await sinDesborde(g, page, 390, 'Pantalla de acceso');
    s.yo = { status: 200, body: { sesion: true, id: '999', nombre: 'Alex Gonzi', avatar: null, acceso: true, admin: true } };
    s.alumnos = { status: 200, body: { alumnos: [{ id: '111', nombre: 'Lucía Ferrer', avatar: null, ultimaVez: '2026-10-30T15:00:00.000Z', datos: datosLucia(), ultimoInforme: null }] } };
    await cargar(page, URL_SRV + '#alumnos');
    await page.locator('#vista a[href="#alumnos/111"]').waitFor();
    await g.visible('El administrador ve «Alumnos» en el menú del móvil', page.locator('a[data-ruta="alumnos"]'));
    await sinDesborde(g, page, 390, 'Alumnos · lista');
    await page.locator('#vista a[href="#alumnos/111"]').tap();
    await page.locator('#tabla [data-accion="detalle"]').first().waitFor();
    await abrirDetalle(page, 's2');
    await page.getByLabel('Tu comentario').waitFor();
    await sinDesborde(g, page, 390, 'Alumnos · diario de un alumno con una operación desplegada');
    g.ok('Peticiones previstas', s.reg.otras.length === 0, s.reg.otras.join(' | '));
    await ctx.close();
  });
  cierre(g);
}

/* =====================================================================================================
 * GRUPO 8 · Destructivos: «Borrar ejemplos» y diario vacío
 * ===================================================================================================== */
async function gDestructivos(g, env) {
  const { page } = await contexto(g, env, { nombre: 'destructivos' });
  const v = page.locator('#vista');
  const pestana = (n) => page.getByRole('navigation', { name: 'Secciones del diario' }).getByRole('link', { name: n });
  await page.goto(BASE);
  await g.seccion('«Borrar ejemplos» deja el diario vacío', async () => {
    await g.cuenta('Antes: 14 operaciones de ejemplo', page.locator('#tabla [data-accion="detalle"]'), 14);
    await page.locator('#aviso-ejemplo [data-accion="borrar-ejemplos"]').click();
    await g.toast(page, 'Ejemplos borrados');
    await g.cuenta('Después: ninguna', page.locator('#tabla [data-accion="detalle"]'), 0);
    await g.attr('Resultado sin operaciones', page.locator('#hero-neto'), 'aria-label', 'Resultado neto en octubre: sin operaciones');
    await g.txt('Texto del resultado', page.locator('#hero-sub'), 'Todavía no hay operaciones este mes.');
    await g.txt('Lista vacía', page.locator('#tabla'), 'No hay operaciones este mes. Pulsa Nueva operación para guardar la primera.');
    await g.txt('Recuento a cero', page.locator('#ops-meta'), '0 operaciones, este mes');
    await g.txt('Curva vacía', page.locator('#curva'), 'Con dos operaciones en el periodo aparece aquí tu curva de resultados.');
    await g.txt('Patrones vacíos', page.locator('#insights'), 'Con tres operaciones en el periodo empiezan a salir aquí tus patrones: mejor sesión, setup a vigilar y más.');
    await g.txt('Setups vacíos', page.locator('#setups'), 'Aquí verás qué setup te da dinero y cuál te lo quita.');
    await g.txt('Comentarios vacíos', page.locator('#comentarios'), 'Cuando Alex revise tus operaciones, sus comentarios aparecen aquí.');
    await g.tiene('Tarjetas a cero', page.locator('#kpis'), [['Acierto', '−', '0 de 0'], ['Profit factor', '−'], ['Media por operación', 'Sin operaciones'], ['Racha actual', '−']]);
    await g.partes('Calendario vacío', page.locator('#calendario'), ['0 operaciones en octubre']);
    await g.cuenta('Mapa sin casillas', page.locator('#mapa [data-accion="filtro-mapa"]'), 0);
    await g.oculto('Sin cinta', page.locator('#ticker-caja'));
    await g.cuenta('Sin aviso de ejemplos', page.locator('#aviso-ejemplo [data-accion="borrar-ejemplos"]'), 0);
    await g.partes('Objetivo a cero', page.locator('#hero-chips'), ['Objetivo de octubre', '0 %', '0 $ de 3.000 $']);
    await g.partes('Barra lateral', page.locator('#lat-widgets'), ['Esta semana, 0 operaciones', '−']);
    await g.partes('El plan de ejemplo se conserva, sin días que comprobar', (await pestana('Plan e IA').click(), page.locator('#cumple')), ['Cuando tengas operaciones en los últimos 30 días, aquí aparece día a día si cumples el plan.']);
    await g.partes('Agente sin operaciones', page.locator('#ia-cuerpo'), ['Cuando tengas operaciones podrás analizarlas.', 'Aún no hay informes.']);
    await g.igual('…con los botones de análisis desactivados', () => page.locator('#ia-cuerpo [data-accion="analizar"]').evaluateAll((a) => a.every((b) => b.disabled)), true);
    await pestana('Estadísticas').click();
    await g.partes('Estadísticas vacías, con acceso a importar', page.locator('#est'), ['No hay operaciones este mes. Importa tu historial de ATAS y aquí tendrás todos tus números.', 'Importar de ATAS']);
    await page.locator('#est [data-accion="importar"]').click();
    await g.visible('…que abre la ventana de importar', page.locator('#imp'));
    await page.locator('#imp').getByRole('button', { name: 'Cancelar' }).click();
    await g.oculto('…y «Cancelar» la cierra', page.locator('#imp'));
    await page.reload();
    await page.goto(BASE + '#diario');
    await g.cuenta('El borrado se conserva al recargar', page.locator('#tabla [data-accion="detalle"]'), 0);
    await g.txt('…sin operaciones', page.locator('#hero-sub'), 'Todavía no hay operaciones este mes.');
  });
  await g.seccion('Primera operación propia en un diario vacío', async () => {
    await page.getByRole('button', { name: 'Nueva operación' }).click();
    await etiqueta(page, '#form-op input[name="f-setup"][value="Patrón Gonzi"]').click();
    await page.locator('#f-imp').fill('1.250,50');
    await page.locator('#f-cap').setInputFiles({ name: 'captura.png', mimeType: 'image/png', buffer: env.png });
    await page.getByAltText('Vista previa de la captura de ATAS').waitFor();
    await g.txt('Importe con formato español (1.250,50)', page.locator('#pie-res'), '+1.251 $');
    await page.locator('#btn-guardar-op').click();
    await g.toast(page, 'Operación guardada');
    await g.attr('Resultado con una operación', page.locator('#hero-neto'), 'aria-label', 'Resultado neto en octubre: +1.251 $');
    await g.txt('…en singular', page.locator('#hero-sub'), '1 operación y 100 % de acierto, sin comisiones.');
    await g.txt('…y la lista', page.locator('#ops-meta'), '1 operación, este mes');
    await g.txt('Con una sola operación aún no hay curva', page.locator('#curva'), 'Con dos operaciones en el periodo aparece aquí tu curva de resultados.');
    await g.tiene('Tarjetas', page.locator('#kpis'), [['Acierto', '100%', '1 de 1'], ['Profit factor', 'Sin pérdidas'], ['Racha actual', '1 ganadora', 'Mejor racha: 1 ganadora seguidas']]);
    await g.tiene('Objetivo: 1.250,50 de 3.000 = 42 %', page.locator('#hero-chips'), [['Objetivo de octubre', '42 %', '1.251 $ de 3.000 $'], ['Mejor día', '+1.251 $', '30 oct'], ['Setup estrella', 'Patrón Gonzi']]);
    await g.sinTexto('…sin «peor día» con una sola operación', page.locator('#hero-chips'), 'Peor día');
    await g.partes('Errores: ninguno marcado', page.locator('#errores'), ['Sin errores marcados en el periodo.']);
    await g.partes('Aviso del plan de hoy (sin stop apuntado)', page.locator('#avisos-diario'), ['Vie 30 oct: cumpliste', 'reglas.', 'Rota:', 'stop en cada operación']);
  });
  cierre(g);
}

/* ============================== ejecución ============================== */
const GRUPOS = [
  ['Diario · lectura', gDiarioLectura],
  ['Diario · escritura', gDiarioEscritura],
  ['Ranking, acciones rápidas y tema', gRankingPaletaTema],
  ['Formación · modo ejemplo', gFormacionLibre],
  ['Servidor simulado', gServidor],
  ['Formación · ruta en servidor', gFormacionRuta],
  ['Móvil y desbordamiento', gMovil],
  ['Destructivos', gDestructivos],
];

(async () => {
  const t0 = Date.now();
  const elegidos = GRUPOS.filter(([n]) => !SOLO || SOLO.test(n));
  console.log(`AGX · prueba de funcionamiento · BASE=${BASE} · reloj fijo: viernes 30-oct-2026 16:30 (Europe/Madrid) · ${elegidos.length} grupos, ${CONCURRENCIA} a la vez`);
  let browser = null; const resumen = []; let fatal = null;
  try {
    const html = await descargar(BASE);
    if (!fs.existsSync(VENDOR_XLSX)) throw new Error('Falta el lector de Excel local para la prueba de importación: ' + VENDOR_XLSX);
    const xlsxLib = fs.readFileSync(VENDOR_XLSX, 'utf8');
    browser = await chromium.launch();
    const env = Object.assign({ browser, html, xlsxLib, png: png(64, 48) }, await prepararClave(browser, html));
    env.xlsx = await prepararXlsx(browser, xlsxLib);
    const grupos = elegidos.map(([n, fn]) => ({ g: new Grupo(n), fn, hecho: false }));
    let sig = 0, impresos = 0;
    const imprimir = () => { while (impresos < grupos.length && grupos[impresos].hecho) { const { g } = grupos[impresos++]; console.log(`\n■ ${g.nombre} (${g.n} comprobaciones, ${((g.t1 - g.t0) / 1000).toFixed(1)} s)`); if (!VERBOSO) console.log(g.out.join('\n')); } };
    const trabajador = async () => {
      while (sig < grupos.length) {
        const it = grupos[sig++], { g } = it; g.t0 = Date.now();
        let reloj;
        try {
          await Promise.race([it.fn(g, env), new Promise((_, rej) => { reloj = setTimeout(() => rej(new Error(`el grupo tarda más de ${T_GRUPO / 1000} s`)), T_GRUPO); })]);
        } catch (e) { g.ok('El grupo termina sin excepciones', false, linea1(e)); }
        clearTimeout(reloj);
        await Promise.all(g.contextos.map((c) => c.close().catch(() => {})));
        g.t1 = Date.now(); it.hecho = true; imprimir();
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, grupos.length) }, trabajador));
    grupos.forEach(({ g }) => resumen.push(g));
  } catch (e) { fatal = e; }
  if (browser) await browser.close().catch(() => {});
  const fallos = resumen.flatMap((g) => g.fallos), n = resumen.reduce((s, g) => s + g.n, 0);
  if (fatal) fallos.unshift('No se ha podido ejecutar la prueba: ' + linea1(fatal));
  console.log(`\n${n} comprobaciones en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!fallos.length) { console.log('RESULTADO: OK'); process.exit(0); }
  console.log(`RESULTADO: FALLO (${fallos.length}): ${fallos.map((f, i) => `\n  ${i + 1}. ${f}`).join('')}`);
  process.exit(1);
})();
