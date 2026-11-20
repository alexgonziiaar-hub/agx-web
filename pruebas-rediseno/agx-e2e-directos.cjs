#!/usr/bin/env node
/*
 * agx-e2e-directos.cjs — Prueba de funcionamiento del apartado «Tests de los directos» de Formación (agx-web/index.html).
 * Mismo estilo que agx-e2e.cjs: comprobaciones con nombre, «RESULTADO: OK / FALLO» y código de salida.
 *
 * Uso:
 *   BASE=http://localhost:4400/ NODE_PATH=$(npm root -g) node agx-e2e-directos.cjs
 * Variables de entorno:
 *   BASE         URL donde se sirve la carpeta de la web en local (por defecto http://localhost:4400/). Nunca producción.
 *   REPO         carpeta del repositorio (por defecto /home/user/agx-web): ahí se comprueba que cada clip existe y está en git.
 *   PREGUNTAS    preguntas-90.json del material: lo que queda en la web, para los revisores (se comprueba que DIRECTOS es idéntico; PREGUNTAS='' lo salta).
 *   SOLO         expresión regular para ejecutar solo algunos grupos: «Datos y archivos», «Modo ejemplo», «Estado y repaso»,
 *                «Servidor simulado», «Tamaños y temas», «Dos dispositivos», «El resto guarda igual», «Pantallas difíciles».
 *   CONCURRENCIA grupos a la vez (por defecto 3).   VERBOSO=1 imprime cada comprobación en cuanto ocurre.
 *
 * Cómo está montada (igual que agx-e2e.cjs):
 *   - Reloj fijo: viernes 30 de octubre de 2026, 16:30 en Europe/Madrid. La fecha de una respuesta es «2026-10-30».
 *   - Modo ejemplo en BASE (estado en localStorage «agx-alumnos-v4»). Modo servidor: host ficticio https://demo-agx.netlify.app/ con
 *     /api/* simulado y /clips/* servido desde BASE. Ninguna petición sale a Internet.
 *   - La clave de respuestas se lee del propio index.html (se evalúa su script en una página aparte y se exportan DIRECTOS y DIR_CAT).
 *   - «Dos dispositivos» y «El resto guarda igual» usan un servidor HTTP de verdad en 127.0.0.1 (puerto libre) y otro navegador que resuelve TODOS
 *     los hosts a 127.0.0.1 (--host-resolver-rules): la interceptación de Playwright no ve el guardado de salida (fetch con keepalive). «El resto
 *     guarda igual» compara con la web publicada, que lee con «git show origin/main:index.html» del REPO.
 *   - El total de clips y el reparto por categoría están en las constantes TOTAL y REPARTO, justo debajo: es lo único que hay que tocar si cambian.
 *   - OJO: este Chromium no trae H.264/AAC: no puede reproducir los clips. Se comprueba todo menos la reproducción.
 *
 * GANCHOS de los que depende (sin selectores de clase):
 *   - Rutas: #formacion/directos (portada) y #formacion/directos/<número> (pregunta 1…TOTAL). Enlaces <a href> a esas rutas.
 *   - La unidad es la PREGUNTA («Pregunta 07», «Siguiente pregunta»); «clip» es solo el vídeo. Cada pregunta tiene un «nombre» (DIRECTOS[i].nombre) que se
 *     enseña antes de responder; el título del clip (DIRECTOS[i].titulo), no.
 *   - <nav aria-label="Secciones de la formación"> con el enlace «Directos» (aria-current="page" cuando toca).
 *   - Portada: #d-tit, un role="img" con el resumen del anillo, [data-accion="dir-fallos"] y una <section aria-labelledby="dc-C|E|G|P"> por categoría
 *     con un <details data-c="C|E|G|P"> plegable dentro (su <summary> es la cabecera: nombre, descripción y «n de m»; dentro, primero la lista de las
 *     pendientes y, si hay respondidas, otro <details> sin data-c con su <summary> «Ver las N respondidas» y la lista de las respondidas).
 *     Lo que el alumno abre o cierra se apunta en localStorage «agx-directos-cats» = {"C":1,"E":0…} (no en su estado).
 *   - Test: <h1> = nombre de la pregunta, con «Pregunta NN de TOTAL · Categoría» en el elemento justo antes; #d-preg (enunciado), [data-accion="dir-opcion"][data-o="0…3"] (aria-pressed, disabled), #d-ver (veredicto),
 *     #d-clip-t (título del clip o rótulo de la pantalla apagada), #dir-video, #dir-error (role="alert"),
 *     [data-accion="dir-sig"], [data-accion="dir-repetir"], [data-accion="dir-reintentar"], [data-accion="dir-ant"] («Anterior», al repasar con
 *     todo respondido).
 *   - Estado: state.directos = { <id>: { o, ok, f } } dentro de «agx-alumnos-v4» / PUT /api/datos. localStorage «agx-directos» = visto.
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawnSync } = require('child_process');
const zlib = require('zlib');

const BASE = (process.env.BASE || 'http://localhost:4400/').replace(/\/?$/, '/');
const REPO = process.env.REPO || '/home/user/agx-web';
const PREGUNTAS = process.env.PREGUNTAS || '/tmp/claude-0/-home-user/ec1a6cef-642a-5a40-a283-3eb03b91ed9b/scratchpad/clips/preguntas-90.json';
const SOLO = process.env.SOLO ? new RegExp(process.env.SOLO, 'i') : null;
const CONCURRENCIA = Math.max(1, parseInt(process.env.CONCURRENCIA || '3', 10) || 3);
const VERBOSO = !!process.env.VERBOSO;
const FONTS = process.env.FONTS || path.join(__dirname, '..', 'fonts', 'node_modules');
const HOST_SRV = 'demo-agx.netlify.app';
const URL_SRV = `https://${HOST_SRV}/`;
const AHORA = new Date('2026-10-30T15:30:00Z');
const HOY = '2026-10-30';
const T_GRUPO = 240000;
const CLAVE = 'agx-alumnos-v4';

/* ---- LO QUE CAMBIA CUANDO CAMBIA EL MATERIAL: cuántos clips hay y cómo se reparten por categoría (en el orden en que salen en la portada) ----
   Todo lo demás de la prueba se calcula a partir de aquí. Los clips con los que se juega (7–10, 12, 13, 21, 30, 31…) solo necesitan que existan,
   que los diez primeros sean de la primera categoría y que haya más de 31. */
const TOTAL = 90;
const REPARTO = [['C', 'Conceptos', 32], ['E', 'Entradas', 26], ['G', 'Gestión', 11], ['P', 'Psicología', 21]];
const CAT1 = REPARTO[0][2]; // clips de la primera categoría
if (REPARTO.reduce((s, r) => s + r[2], 0) !== TOTAL || CAT1 < 10 || TOTAL < 32) { console.error('TOTAL y REPARTO no cuadran (o hay menos clips de los que la prueba necesita).'); process.exit(2); }

if (/agxcommunity\.com/i.test(new URL(BASE).hostname)) { console.error('BASE apunta a producción. Esta prueba solo se ejecuta contra un servidor local.'); process.exit(2); }

/* ============================== utilidades ============================== */
const norm = (s) => String(s == null ? '' : s).replace(/[\s ]+/g, ' ').trim();
const linea1 = (e) => {
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
function cabeceras(url) { // HEAD: estado, tipo y tamaño
  return new Promise((res) => {
    const u = new URL(url);
    const rq = http.request({ method: 'HEAD', hostname: u.hostname, port: u.port, path: u.pathname }, (r) => { r.resume(); res({ st: r.statusCode, tipo: String(r.headers['content-type'] || ''), tam: Number(r.headers['content-length'] || -1) }); });
    rq.on('error', (e) => res({ st: 0, tipo: String(e.message), tam: -1 })); rq.end();
  });
}
const igualJSON = (a, b) => JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
function ordenar(v) { if (Array.isArray(v)) return v.map(ordenar); if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach((k) => { o[k] = ordenar(v[k]); }); return o; } return v; }
const dur = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const num2 = (n) => String(n).padStart(2, '0');

let ARCHIVO = null, BEBAS = null;
try {
  ARCHIVO = fs.readFileSync(path.join(FONTS, '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2'));
  BEBAS = fs.readFileSync(path.join(FONTS, '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2'));
} catch (e) { /* sin fuentes locales: tipografía de reserva */ }
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
  cuenta(nombre, loc, n, ms) { return this.igual(nombre, () => loc.count(), n, ms); }
  visible(nombre, loc, ms) { return this.igual(nombre, () => loc.isVisible(), true, ms); }
  oculto(nombre, loc, ms) { return this.igual(nombre, () => loc.isVisible(), false, ms); }
  async partes(nombre, loc, lista, ms) { // el texto contiene todos los trozos, en ese orden (sin espacios)
    const c = (s) => String(s == null ? '' : s).replace(/[\s ]+/g, ''); let falta = '';
    const r = await hasta(async () => c(await loc.textContent({ timeout: 1500 })), (t) => { let i = 0; for (const s of lista) { const k = t.indexOf(c(s), i); if (k < 0) { falta = s; return false; } i = k + c(s).length; } return true; }, ms);
    return this.ok(nombre, r.ok, `falta «${falta}» (en orden) en «${String(r.v).slice(0, 300)}»`);
  }
  toast(page, texto, nombre) { return this.cumple(nombre || `Aviso: «${texto}»`, async () => ((await page.locator('#toast').isVisible()) ? norm(await page.locator('#toast').textContent()) : '(oculto)'), (t) => t.includes(texto), 5000, `esperado «${texto}»`); }
  async seccion(titulo, fn) {
    this.p(`— ${titulo}`);
    try { await fn(); } catch (e) { this.ok(`${titulo}: se completa sin excepciones`, false, linea1(e)); }
  }
}

/* ============================== contexto del navegador ============================== */
async function contexto(g, env, o = {}) {
  const ctx = await env.browser.newContext({
    viewport: o.viewport || { width: 1440, height: 900 }, deviceScaleFactor: o.dpr || 1, isMobile: !!o.movil, hasTouch: !!o.movil,
    locale: 'es-ES', timezoneId: 'Europe/Madrid', colorScheme: o.oscuro ? 'dark' : 'light', reducedMotion: o.reducir ? 'reduce' : 'no-preference', serviceWorkers: 'block',
  });
  g.contextos.push(ctx);
  const origen = new URL(BASE).origin + '/';
  const red = { clips: [] }; // todo lo que se pide de /clips/ (portadas y vídeos), en BASE o en el host ficticio
  await ctx.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith(origen)) { if (/\/clips\//.test(u)) red.clips.push(decodeURIComponent(new URL(u).pathname)); return route.continue(); } g.externas.push(u); return route.abort(); });
  await ctx.route(/^https?:\/\/fonts\.googleapis\.com\//, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS }));
  await ctx.route(/^https?:\/\/fonts\.gstatic\.com\//, (r) => r.abort());
  await ctx.route('http://fonts.local/archivo.woff2', (r) => (ARCHIVO ? r.fulfill({ status: 200, contentType: 'font/woff2', body: ARCHIVO, headers: { 'access-control-allow-origin': '*' } }) : r.abort()));
  await ctx.route('http://fonts.local/bebas.woff2', (r) => (BEBAS ? r.fulfill({ status: 200, contentType: 'font/woff2', body: BEBAS, headers: { 'access-control-allow-origin': '*' } }) : r.abort()));
  if (o.servidor) await o.servidor.montar(ctx, red);
  if (o.cortarVideo) await ctx.route(/\/clips\/[^/]+\.mp4$/, (r) => { red.clips.push(decodeURIComponent(new URL(r.request().url()).pathname)); return r.abort('failed'); });
  if (o.modo) await ctx.addInitScript((m) => { try { localStorage.setItem('agx-modo', m); } catch (e) { /* sin almacenamiento */ } }, o.modo);
  await ctx.clock.install({ time: AHORA });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const tolera = o.tolera || [];
  const quien = o.nombre || 'página';
  page.on('pageerror', (e) => {
    if (/Transition was skipped/.test(e.message)) { g.conocidos++; return; } // error conocido de la app al encadenar navegaciones (ver agx-e2e.cjs)
    g.errores.push(`[${quien}] error de página: ${linea1(e)}`);
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const donde = (m.location() && m.location().url) || '', t = m.text();
    if (/fonts\.(googleapis|gstatic)\.com|fonts\.local/.test(donde + ' ' + t)) return;
    if (tolera.some((re) => re.test(donde + ' ' + t))) return;
    g.errores.push(`[${quien}] consola: ${t} (${donde})`);
  });
  return { ctx, page, red };
}
function cierre(g) {
  if (g.conocidos) g.p(`  · nota: ${g.conocidos} avisos «Transition was skipped» al encadenar navegaciones (error conocido de la app, no cuenta como fallo)`);
  g.ok('Sin errores de página ni de consola', g.errores.length === 0, g.errores.slice(0, 6).join(' | '));
  g.ok('Sin peticiones a hosts externos', g.externas.length === 0, Array.from(new Set(g.externas)).slice(0, 6).join(' | '));
}

/* ============================== clave: DIRECTOS y DIR_CAT leídos de index.html ============================== */
async function prepararClave(browser, html) {
  const MARCA = /\narrancar\(\);\s*\n\}\)\(\);/;
  if (!MARCA.test(html)) throw new Error('No encuentro el final del script de index.html («arrancar();» y cierre del IIFE).');
  const exporta = `
;window.__AGX_DIR={directos:DIRECTOS,cats:DIR_CAT,vacio:estadoVacio()};
})();`;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await ctx.route('**/*', (r) => r.abort());
  await ctx.route('http://agx-clave.test/', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html.replace(MARCA, () => exporta) }));
  await page.goto('http://agx-clave.test/');
  const k = await page.evaluate(() => window.__AGX_DIR);
  await ctx.close();
  if (!k || !Array.isArray(k.directos)) throw new Error('No se ha podido leer DIRECTOS de index.html.');
  return { D: k.directos, CATS: k.cats, vacio: k.vacio };
}

/* ============================== ayudas de interfaz ============================== */
const hashDe = (page) => new URL(page.url()).hash;
async function cargar(page, url) { await page.goto('about:blank'); await page.goto(url); }
const h1 = (page) => page.locator('#vista').getByRole('heading', { level: 1 });
const tabs = (page) => page.getByRole('navigation', { name: 'Secciones de la formación' });
const opcion = (page, o) => page.locator(`#vista [data-accion="dir-opcion"][data-o="${o}"]`);
const guardado = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return '(no es JSON)'; } }, CLAVE);
async function sembrar(page, estado, url) { // deja un estado guardado (modo ejemplo) y carga la web con él, sin categorías abiertas o cerradas a mano de antes
  await page.goto(BASE);
  await page.evaluate(({ k, s }) => { if (s == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(s)); localStorage.removeItem('agx-directos-cats'); }, { k: CLAVE, s: estado });
  await cargar(page, url);
}
/* Lo que hay en pantalla en el test de un clip */
async function estadoClip(page) {
  return page.evaluate(() => {
    const v = document.getElementById('vista'), q = document.getElementById('d-preg'); if (!q) return null;
    const t = v.querySelector('h1'), c = t && t.previousElementSibling, m = /^Pregunta (\d+) de (\d+) · (.+)$/.exec(c ? c.textContent.replace(/\s+/g, ' ').trim() : '') || [];
    const ver = document.getElementById('d-ver'), vid = document.getElementById('dir-video');
    return { n: Number(m[1]), total: Number(m[2]), cat: m[3], nombre: t ? t.textContent.replace(/\s+/g, ' ').trim() : null, q: q.textContent,
      ops: Array.from(v.querySelectorAll('[data-accion="dir-opcion"]')).map((b) => ({ o: Number(b.dataset.o), t: b.textContent, pulsada: b.getAttribute('aria-pressed') === 'true', off: b.disabled })),
      ver: ver ? ver.textContent : null, video: !!vid, videos: document.querySelectorAll('video').length };
  });
}
async function esperaClip(page, n, resp) { // espera al clip n; resp: true = con respuesta a la vista, false = sin ella, undefined = da igual
  const r = await hasta(() => estadoClip(page), (s) => !!s && s.n === n && s.ops.length === 4 && (resp === undefined || (!!s.ver) === resp), 8000);
  if (!r.ok) throw new Error(`No aparece el clip ${n}${resp === undefined ? '' : resp ? ' respondido' : ' sin responder'} (${JSON.stringify(r.v).slice(0, 200)})`);
  return r.v;
}
const otra = (d) => (d.correcta + 1) % 4; // una opción que no es la correcta
/* La portada: qué categorías están abiertas, y la tarjeta de un clip con su categoría abierta (pulsando la cabecera, como haría el alumno) */
const CLAVE_CATS = 'agx-directos-cats';
const abiertas = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#vista details[data-c]')).filter((d) => d.open).map((d) => d.dataset.c).join(''));
const apuntadas = (page) => page.evaluate((k) => localStorage.getItem(k), CLAVE_CATS);
const cabecera = (page, c) => page.locator(`#vista details[data-c="${c}"] > summary`);
async function tarjeta(page, n) { // abre, como el alumno (pulsando su <summary>), la categoría y, si es una respondida, su plegable «Ver las N respondidas»
  const a = page.locator(`#vista ul a[href="#formacion/directos/${n}"]`);
  for (let k = 0; k < 3; k++) {
    const hay = await a.evaluate((e) => { const ds = []; for (let d = e.closest('details'); d; d = d.parentElement.closest('details')) ds.unshift(d); const c = ds.find((d) => !d.open); if (c) c.setAttribute('data-prueba-abrir', ''); return !!c; });
    if (!hay) break;
    await page.locator('#vista details[data-prueba-abrir] > summary').click();
    await page.evaluate(() => document.querySelectorAll('[data-prueba-abrir]').forEach((d) => d.removeAttribute('data-prueba-abrir')));
  }
  await a.waitFor({ state: 'visible' });
  return a;
}
const cabTest = (page) => page.locator('#vista h1').locator('xpath=preceding-sibling::*[1]'); // «Pregunta NN de TOTAL · Categoría»
const hechas = (page, c) => page.locator(`#vista details[data-c="${c}"] details > summary`); // «Ver las N respondidas» de una categoría
const escHtml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const catDe = (n) => { let a = 0; for (const [c, , k] of REPARTO) { a += k; if (n <= a) return c; } return null; }; // categoría del clip número n
/* Nada de lo que regala la respuesta puede estar en la vista: ni el título (ni en el texto ni en ningún atributo), ni el id (es el título en minúsculas), ni la clave, ni la explicación */
async function fugas(page, ds) {
  const { html, texto } = await page.evaluate(() => { const v = document.getElementById('vista'); return { html: v.innerHTML, texto: v.textContent }; });
  const t = norm(texto), out = [];
  ds.forEach((d) => { if (t.includes(norm(d.titulo))) out.push('título de ' + d.id); if (html.includes(d.titulo) || html.includes(escHtml(d.titulo))) out.push('título (en el HTML) de ' + d.id); if (html.includes(d.id)) out.push('id ' + d.id); if (t.includes(norm(d.clave))) out.push('clave de ' + d.id); if (t.includes(norm(d.explicacion))) out.push('explicación de ' + d.id); });
  return out;
}
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
  return g.ok(`${nombre}: sin desbordamiento horizontal`, r.ok && r.v.ok, r.v && r.v.detalle);
}
/* Zonas táctiles: lo que se pulsa dentro de la vista mide al menos 44 px de alto (y de ancho) */
async function tactiles(g, page, nombre) {
  const r = await page.evaluate(() => Array.from(document.querySelectorAll('#vista a[href], #vista button, #vista summary')).filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.disabled; })
    .map((e) => { const b = e.getBoundingClientRect(); return { t: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 }; }).filter((x) => x.h < 43.5 || x.w < 43.5));
  return g.ok(`${nombre}: zonas táctiles de 44 px o más`, r.length === 0, JSON.stringify(r.slice(0, 5)));
}

/* ============================== servidor simulado (modo servidor) ============================== */
function crearServidor(env, ini = {}) {
  const s = Object.assign({
    yo: { status: 200, body: { sesion: true, id: '111', nombre: 'Lucía Ferrer', avatar: null, acceso: true, admin: false } },
    datos: { status: 200, body: { datos: null } }, persistir: true,
    ranking: { status: 200, body: { actualizado: null, mes: [], historico: [], recientes: [], campeones: [] } },
    alumnos: { status: 200, body: { alumnos: [] } },
  }, ini);
  s.reg = { put: [], otras: [], orden: [] };
  s.montar = (ctx, red) => ctx.route((u) => u.hostname === HOST_SRV, async (route) => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname.replace(/\/+$/, '') || '/', m = req.method();
    const json = (st, b) => route.fulfill({ status: st, contentType: 'application/json; charset=utf-8', body: JSON.stringify(b) });
    if (p.startsWith('/api/')) s.reg.orden.push(m + ' ' + p);
    try {
      if (p === '/' || p === '/index.html') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: env.html });
      if (p === '/favicon.ico') return route.fulfill({ status: 204, body: '' });
      if (p.startsWith('/clips/')) { // los clips del host ficticio salen del servidor local
        red.clips.push(decodeURIComponent(p));
        if (/\.mp4$/.test(p)) return route.abort('failed'); // el vídeo no se descarga en la prueba (y con preload="none" no se tiene que pedir)
        const r = await ctx.request.get(BASE + p.slice(1));
        return route.fulfill({ status: r.status(), contentType: r.headers()['content-type'] || 'application/octet-stream', body: await r.body() });
      }
      if (p === '/api/yo') return json(s.yo.status, s.yo.body);
      if (p === '/api/datos' && m === 'GET') return json(s.datos.status || 200, s.datos.body);
      if (p === '/api/datos' && m === 'PUT') {
        let b = null; try { b = JSON.parse(req.postData() || 'null'); } catch (e) { /* cuerpo no válido */ }
        s.reg.put.push(b);
        if (s.persistir && b) s.datos = { status: 200, body: { datos: b } };
        return json(200, { ok: true, guardado: '2026-10-30T15:30:00.000Z' });
      }
      if (p === '/api/captura') return json(404, { error: 'no_existe' });
      if (p === '/api/ranking') return json(s.ranking.status, s.ranking.body);
      if (p === '/api/analisis' && m === 'GET') return json(200, { informes: [], ia: true, restantes: 3 });
      if (p === '/api/admin/alumnos') return json(s.alumnos.status, s.alumnos.body);
      if (p === '/api/admin/informes') return json(200, { informes: [], ia: true });
      if (p === '/api/admin/captura') return json(404, { error: 'no_existe' });
      s.reg.otras.push(m + ' ' + p);
      return json(404, { error: 'no_encontrado' });
    } catch (e) { s.reg.otras.push('EXCEPCIÓN ' + m + ' ' + p + ' ' + linea1(e)); return route.abort(); }
  });
  s.esperaPut = (pred, ms = 6000) => hasta(() => s.reg.put.slice().reverse().find((b) => b && pred(b)) || null, (v) => !!v, ms, 60);
  return s;
}
const TOLERA_API = [new RegExp('^https://' + HOST_SRV.replace(/\./g, '\\.') + '/api/')];
const hueco = (h, m, d = 30) => Date.UTC(2026, 9, d, h - 1, m);
const opSrv = (id, dia, h, mi, inst, dir, ct, usd, setup, nota, comentario) => ({ id, fecha: `2026-10-${dia}`, sesion: 'NY', inst, dir, ct, usd, setup, nota, comentario, ejemplo: false, hEnt: hueco(h, mi, dia), errores: [] });
/* Un alumno real tal como está guardado HOY en producción: sin la clave «directos» */
function datosLucia() {
  return {
    periodo: 'mes', temas: {}, examen: null, fallos: [], bloque: 'base', progresoEjemplo: false, objetivo: 3000, cuenta: null, rutinas: {},
    trades: [opSrv('s1', 28, 15, 40, 'NQ', 'L', 1, 300, 'Imbalance', 'Nota s1', 'Bien esperada.'), opSrv('s2', 29, 16, 10, 'ES', 'C', 1, -150, 'Divergencia', '', ''), opSrv('s3', 30, 15, 50, 'MNQ', 'L', 2, 80, 'Patrón Gonzi', 'Nota s3', '')],
    plan: { perdidaMaxDia: 200, riesgoMaxOp: null, maxContratos: 1, maxOps: null, maxPerdidasSeguidas: null, objetivoDia: null, horaDesde: '', horaHasta: '', dias: [1, 2, 3, 4, 5], instrumentos: [], setups: [], registro: true, conStop: false, texto: 'Solo opero la apertura de Nueva York.', zona: 'Europe/Madrid', actualizado: '2026-10-20T10:00:00.000Z' },
    ruta: { lec: Object.fromEntries(['n1-1', 'n1-2'].map((k) => [k, { ok: true, mejor: 100, intentos: 1, fecha: '2026-10-21' }])), niv: {} },
  };
}
/* Estado antiguo del modo ejemplo (lo que guardaba la web publicada): sin «directos» */
function estadoAntiguo() {
  return { periodo: 'mes', trades: [{ id: 'e1', fecha: '2026-10-05', sesion: 'NY', inst: 'NQ', dir: 'L', ct: 1, pts: 20, setup: 'Imbalance', nota: 'Una nota', comentario: '', ejemplo: true }],
    temas: { subasta: { mejor: 3, intentos: 1 } }, examen: null, fallos: ['delta-2'], bloque: 'of', progresoEjemplo: false, objetivo: 2500, plan: null, ruta: { lec: { 'n1-1': { ok: true, mejor: 90, intentos: 2, fecha: '2026-10-10' } }, niv: {} }, cuenta: null, rutinas: {} };
}
const respuesta = (d, ok, f) => ({ o: ok ? d.correcta : otra(d), ok: !!ok, f: f || '2026-10-28' });

/* =====================================================================================================
 * GRUPO 1 · Datos y archivos: las preguntas, los clips en el repositorio y en el servidor local, Netlify
 * ===================================================================================================== */
async function gDatos(g, env) {
  const D = env.D;
  await g.seccion('Las preguntas (const DIRECTOS de index.html)', async () => {
    g.ok(`${TOTAL} clips`, D.length === TOTAL, `hay ${D.length}`);
    const por = (c) => D.filter((d) => d.cat === c).length;
    g.ok('Por categoría: ' + REPARTO.map(([, nom, n]) => `${nom} ${n}`).join(', '), REPARTO.every(([c, , n]) => por(c) === n), REPARTO.map(([c]) => `${c} ${por(c)}`).join(', '));
    g.ok('Las categorías, con su nombre y en su orden', igualJSON(Object.keys(env.CATS), REPARTO.map((r) => r[0])) && REPARTO.every(([c, nom]) => env.CATS[c].nombre === nom), JSON.stringify(env.CATS));
    g.ok('Van agrupados por categoría y en el orden ' + REPARTO.map((r) => r[0]).join(', '), D.map((d) => d.cat).join('') === REPARTO.map(([c, , n]) => c.repeat(n)).join(''), D.map((d) => d.cat).join(''));
    const campos = ['id', 'cat', 'tema', 'titulo', 'nombre', 'pregunta', 'opciones', 'correcta', 'explicacion', 'clave', 'seg'];
    const malos = D.filter((d) => !igualJSON(Object.keys(d), campos) || !/^[CEGP]\d\d_[a-z0-9-]+$/.test(d.id) || d.id[0] !== d.cat || d.tema !== d.id.slice(0, 3)
      || !Array.isArray(d.opciones) || d.opciones.length !== 4 || d.opciones.some((o) => typeof o !== 'string' || o.length < 10) || new Set(d.opciones).size !== 4
      || !Number.isInteger(d.correcta) || d.correcta < 0 || d.correcta > 3 || !Number.isInteger(d.seg) || d.seg < 5 || d.seg > 600
      || [d.titulo, d.pregunta, d.explicacion, d.clave].some((t) => typeof t !== 'string' || t.length < 15) || !/^En el clip: /.test(d.clave));
    g.ok('Cada una con sus once campos (en su orden), cuatro opciones distintas, la correcta entre 0 y 3 y la clave «En el clip: …»', malos.length === 0, malos.map((d) => d.id).join(', '));
    g.ok('Ids sin repetir', new Set(D.map((d) => d.id)).size === D.length);
    const malN = D.filter((d) => typeof d.nombre !== 'string' || d.nombre !== d.nombre.trim() || d.nombre.length < 10 || d.nombre.length > 50);
    g.ok(`Los ${TOTAL} tienen nombre de pregunta, de 10 a 50 caracteres`, malN.length === 0, malN.map((d) => `${d.id}: «${d.nombre}»`).slice(0, 4).join(', '));
    g.ok('…sin repetir', new Set(D.map((d) => String(d.nombre).toLowerCase())).size === D.length);
    const igualT = D.filter((d) => norm(d.nombre).toLowerCase() === norm(d.titulo).toLowerCase() || norm(d.titulo).toLowerCase().includes(norm(d.nombre).toLowerCase()));
    g.ok('…ninguno igual a su título (ni contenido en él: el título es la respuesta)', igualT.length === 0, igualT.map((d) => d.id).slice(0, 4).join(', '));
    const conT = D.filter((d) => D.some((e) => norm(d.nombre).toLowerCase().includes(norm(e.titulo).toLowerCase())));
    g.ok('…y ninguno contiene el título de ningún clip', conT.length === 0, conT.map((d) => d.id).slice(0, 4).join(', '));
    const conClip = D.filter((d) => /clip|gonci|[<>]/i.test(d.nombre));
    g.ok('…sin «clip», «gonci» ni HTML', conClip.length === 0, conClip.map((d) => `«${d.nombre}»`).slice(0, 4).join(', '));
    g.ok('Sin «gonci» en los textos (siempre «Patrón Gonzi»)', !D.some((d) => /gonci/i.test([d.titulo, d.pregunta, d.explicacion, d.clave].concat(d.opciones).join(' '))));
    g.ok('…ni en los id, ni en ninguna otra parte de DIRECTOS', !/gonci/i.test(JSON.stringify(D)), D.filter((d) => /gonci/i.test(JSON.stringify(d))).map((d) => d.id).join(', '));
    g.ok('Ordenados por id', igualJSON(D.map((d) => d.id), D.map((d) => d.id).sort()));
    g.ok('Sin HTML en los textos', !D.some((d) => /[<>]/.test([d.titulo, d.pregunta, d.explicacion, d.clave].concat(d.opciones).join(' '))));
    const reparto = [0, 1, 2, 3].map((k) => D.filter((d) => d.correcta === k).length);
    g.ok('La opción correcta está repartida entre las cuatro posiciones', Math.min(...reparto) >= Math.floor(TOTAL / 6), reparto.join(' / '));
    if (PREGUNTAS && g.ok(`Está ${path.basename(PREGUNTAS)}, el archivo que usan los revisores`, fs.existsSync(PREGUNTAS), PREGUNTAS)) {
      const P = JSON.parse(fs.readFileSync(PREGUNTAS, 'utf8'));
      g.ok(`DIRECTOS es idéntico a ${path.basename(PREGUNTAS)} (mismos clips, mismo orden, mismos campos y mismos textos)`, JSON.stringify(D) === JSON.stringify(P), `${P.length} en el archivo; difieren: ` + D.filter((d, i) => JSON.stringify(d) !== JSON.stringify(P[i])).map((d) => d.id).slice(0, 5).join(', '));
    } else if (!PREGUNTAS) g.p('  · nota: PREGUNTAS vacío; no se compara con el material');
    g.ok('estadoVacio() trae la clave nueva con su valor por defecto ({})', env.vacio && igualJSON(env.vacio.directos, {}), JSON.stringify(env.vacio && env.vacio.directos));
  });

  await g.seccion('Los clips: en el repositorio y servidos en local', async () => {
    const enGit = new Set(String(spawnSync('git', ['-C', REPO, 'ls-files', 'clips'], { encoding: 'utf8' }).stdout || '').split('\n').filter(Boolean));
    const faltaDisco = [], faltaGit = [], vacios = [];
    D.forEach((d) => ['mp4', 'jpg'].forEach((x) => { const rel = `clips/${d.id}.${x}`, f = path.join(REPO, rel);
      if (!fs.existsSync(f)) faltaDisco.push(rel); else if (fs.statSync(f).size < (x === 'mp4' ? 200000 : 5000)) vacios.push(rel);
      if (!enGit.has(rel)) faltaGit.push(rel); }));
    g.ok('Cada clips/<id>.mp4 y clips/<id>.jpg existe en el repositorio', faltaDisco.length === 0, faltaDisco.slice(0, 5).join(', '));
    g.ok('…con un tamaño creíble (vídeo ≥ 200 kB, portada ≥ 5 kB)', vacios.length === 0, vacios.slice(0, 5).join(', '));
    g.ok(`…y está en git (los ${2 * TOTAL} archivos)`, faltaGit.length === 0 && enGit.size >= 2 * TOTAL, `faltan ${faltaGit.length}: ${faltaGit.slice(0, 4).join(', ')}`);
    const sobran = Array.from(enGit).filter((f) => !D.some((d) => f === `clips/${d.id}.mp4` || f === `clips/${d.id}.jpg`));
    g.ok('No hay archivos de más en clips/', sobran.length === 0, sobran.slice(0, 5).join(', '));
    const enDisco = fs.existsSync(path.join(REPO, 'clips')) ? fs.readdirSync(path.join(REPO, 'clips')) : [];
    g.ok(`…ni en la carpeta (exactamente ${2 * TOTAL} archivos: un mp4 y un jpg por clip)`, enDisco.length === 2 * TOTAL && enDisco.every((f) => D.some((d) => f === d.id + '.mp4' || f === d.id + '.jpg')), `${enDisco.length} archivos; de más: ${enDisco.filter((f) => !D.some((d) => f === d.id + '.mp4' || f === d.id + '.jpg')).slice(0, 4).join(', ')}`);
    g.ok('Ningún «gonci» en los nombres de clips/ (ni en la carpeta ni en git)', !enDisco.concat(Array.from(enGit)).some((f) => /gonci/i.test(f)), enDisco.concat(Array.from(enGit)).filter((f) => /gonci/i.test(f)).slice(0, 4).join(', '));
    const base = /const CLIPS_BASE='([^']*)';/.exec(env.html);
    g.ok('La dirección de los clips sale de una sola constante (CLIPS_BASE) y hoy es la carpeta de la propia web', !!base && base[1] === 'clips/' && (env.html.match(/CLIPS_BASE/g) || []).length >= 4 && !/(src|poster)="clips\//.test(env.html), base ? base[1] : 'no está');
    const pesados = D.filter((d) => fs.existsSync(path.join(REPO, `clips/${d.id}.mp4`)) && fs.statSync(path.join(REPO, `clips/${d.id}.mp4`)).size > 20 * 1048576).map((d) => d.id);
    g.ok('Ningún vídeo pasa de 20 MB', pesados.length === 0, pesados.join(', '));
    const total = D.reduce((s, d) => s + ['mp4', 'jpg'].reduce((a, x) => { const f = path.join(REPO, `clips/${d.id}.${x}`); return a + (fs.existsSync(f) ? fs.statSync(f).size : 0); }, 0), 0);
    g.p(`  · clips/: ${D.length} vídeos y ${D.length} portadas, ${(total / 1048576).toFixed(0)} MB`);
    // cabecera de un MP4 con arranque rápido: «ftyp» al principio y «moov» antes que «mdat»
    const lentos = D.filter((d) => { const f = path.join(REPO, `clips/${d.id}.mp4`); if (!fs.existsSync(f)) return false; const fd = fs.openSync(f, 'r'), b = Buffer.alloc(4096); fs.readSync(fd, b, 0, 4096, 0); fs.closeSync(fd); const t = b.toString('latin1'); return t.slice(4, 8) !== 'ftyp' || t.indexOf('moov') < 0 || (t.indexOf('mdat') >= 0 && t.indexOf('mdat') < t.indexOf('moov')); }).map((d) => d.id);
    g.ok('Los vídeos son MP4 con arranque rápido (el índice va al principio)', lentos.length === 0, lentos.slice(0, 5).join(', '));
    const noJpg = D.filter((d) => { const f = path.join(REPO, `clips/${d.id}.jpg`); if (!fs.existsSync(f)) return false; const fd = fs.openSync(f, 'r'), b = Buffer.alloc(3); fs.readSync(fd, b, 0, 3, 0); fs.closeSync(fd); return !(b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff); }).map((d) => d.id);
    g.ok('Las portadas son JPEG', noJpg.length === 0, noJpg.slice(0, 5).join(', '));
    // ancho de la portada: el primer marcador SOFn del JPEG lleva alto y ancho
    const anchoJpg = (f) => { const b = fs.readFileSync(f); for (let i = 2; i + 9 < b.length;) { if (b[i] !== 0xff) return 0; const m = b[i + 1]; if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return b.readUInt16BE(i + 7); i += 2 + b.readUInt16BE(i + 2); } return 0; };
    const chicas = D.filter((d) => { const f = path.join(REPO, `clips/${d.id}.jpg`); return fs.existsSync(f) && anchoJpg(f) < 1000; }).map((d) => d.id);
    g.ok('…de 1.000 px de ancho o más (las de 640 se veían borrosas)', chicas.length === 0, chicas.slice(0, 5).join(', '));
    const mal = [];
    for (const d of D) for (const x of ['mp4', 'jpg']) {
      const c = await cabeceras(`${BASE}clips/${d.id}.${x}`), tam = fs.existsSync(path.join(REPO, `clips/${d.id}.${x}`)) ? fs.statSync(path.join(REPO, `clips/${d.id}.${x}`)).size : -2;
      if (c.st !== 200 || !(x === 'mp4' ? /^video\/mp4/ : /^image\/jpeg/).test(c.tipo) || c.tam !== tam) mal.push(`${d.id}.${x} → ${c.st} ${c.tipo} ${c.tam}/${tam}`);
    }
    g.ok(`El servidor local sirve los ${2 * TOTAL} archivos (200, tipo correcto y tamaño completo)`, mal.length === 0, mal.slice(0, 4).join(' | '));
  });

  await g.seccion('Netlify', async () => {
    const f = path.join(REPO, 'netlify.toml');
    const r = spawnSync('python3', ['-I', '-c', 'import tomllib,sys,json;print(json.dumps(tomllib.load(open(sys.argv[1],"rb"))))', f], { encoding: 'utf8' });
    if (!g.ok('netlify.toml sigue siendo TOML válido', r.status === 0, String(r.stderr).trim().split('\n').pop())) return;
    const t = JSON.parse(r.stdout), hs = t.headers || [], de = (ruta) => (hs.find((h) => h.for === ruta) || {}).values || {};
    g.ok('Lo que había sigue igual (publish, functions, cabeceras de «/*»)', t.build && t.build.publish === '.' && t.build.functions === 'netlify/functions' && t.functions && t.functions.node_bundler === 'esbuild' && de('/*')['X-Frame-Options'] === 'DENY' && de('/*')['X-Content-Type-Options'] === 'nosniff', JSON.stringify(t).slice(0, 300));
    g.ok('«/clips/*»: una semana de caché y fuera de los buscadores', de('/clips/*')['Cache-Control'] === 'public, max-age=604800' && de('/clips/*')['X-Robots-Tag'] === 'noindex', JSON.stringify(de('/clips/*')));
    g.ok('«/manifest.webmanifest» con su tipo', de('/manifest.webmanifest')['Content-Type'] === 'application/manifest+json; charset=utf-8', JSON.stringify(de('/manifest.webmanifest')));
    g.ok('No se ha tocado netlify/functions/', String(spawnSync('git', ['-C', REPO, 'diff', '--stat', 'origin/main', 'HEAD', '--', 'netlify/functions'], { encoding: 'utf8' }).stdout || '').trim() === '');
  });
}

/* =====================================================================================================
 * GRUPO 2 · Modo ejemplo: pestaña, ruta, portada, test de un clip, vídeo, teclado, navegación
 * ===================================================================================================== */
async function gEjemplo(g, env) {
  const D = env.D;
  const { page, red } = await contexto(g, env, { nombre: 'ejemplo', cortarVideo: true, tolera: [/clips\/.*\.mp4/, /net::ERR_FAILED/] });
  const v = page.locator('#vista');
  const tarjetas = v.locator('ul a[href^="#formacion/directos/"]');
  const sig = v.locator('[data-accion="dir-sig"]'), repetir = v.locator('[data-accion="dir-repetir"]');
  await page.goto(BASE + '#formacion');

  await g.seccion('Pestaña, distintivo «Nuevo» y acceso desde la ruta', async () => {
    await g.cuenta('Formación tiene tres pestañas', tabs(page).getByRole('link'), 3);
    await g.igual('…en este orden', async () => (await tabs(page).getByRole('link').evaluateAll((a) => a.map((x) => x.getAttribute('href')))).join(' '), '#formacion #formacion/libre #formacion/directos');
    await g.attr('«Ruta por niveles» sigue marcada al entrar en Formación', tabs(page).getByRole('link', { name: 'Ruta por niveles' }), 'aria-current', 'page');
    const tab = tabs(page).locator('a[href="#formacion/directos"]');
    await g.txt('La tercera es «Directos» y lleva el distintivo «Nuevo»', tab, 'DirectosNuevo');
    const banda = page.locator('#vista > a[href="#formacion/directos"]');
    await g.cuenta('En la ruta hay un acceso a los tests de los directos (además de la pestaña)', banda, 1);
    await g.partes('…que dice qué son, con el distintivo «Nuevo» y cuántas preguntas hay', banda, ['Tests de los directos', 'Nuevo', 'Preguntas sacadas de momentos reales de los directos de Alex.', `${TOTAL} preguntas`]);
    g.ok('…sin «clip» como unidad', !/\b\d+ clips?\b/i.test(norm(await banda.textContent())), norm(await banda.textContent()));
    g.ok('La ruta no pinta ningún título ni id de clip', (await fugas(page, D)).length === 0, (await fugas(page, D)).slice(0, 3).join(', '));
    await tab.click();
    await g.igual('Pulsar la pestaña: URL', () => hashDe(page), '#formacion/directos');
    await g.attr('…queda marcada', tabs(page).locator('a[href="#formacion/directos"]'), 'aria-current', 'page');
    await g.attr('…y «Ruta por niveles» ya no', tabs(page).getByRole('link', { name: 'Ruta por niveles' }), 'aria-current', null);
    await g.txt('Título del módulo', h1(page), 'Formación AGX');
    await g.txt('Al entrar, el distintivo «Nuevo» desaparece de la pestaña', tabs(page).locator('a[href="#formacion/directos"]'), 'Directos');
    await g.igual('…y queda apuntado en el dispositivo', () => page.evaluate(() => localStorage.getItem('agx-directos')), 'visto');
    await tabs(page).getByRole('link', { name: 'Ruta por niveles' }).click();
    await g.igual('Volver a la ruta: URL', () => hashDe(page), '#formacion');
    await g.cumple('…y el acceso de la ruta ya no dice «Nuevo»', async () => norm(await page.locator('#vista > a[href="#formacion/directos"]').textContent()), (t) => t.startsWith('Tests de los directosPreguntas sacadas'));
    await page.goBack();
    await g.igual('Atrás del navegador vuelve a la portada de los directos', () => hashDe(page), '#formacion/directos');
    await g.attr('…con su pestaña marcada', tabs(page).locator('a[href="#formacion/directos"]'), 'aria-current', 'page');
  });

  await g.seccion('Portada sin nada respondido', async () => {
    await g.txt('Rótulo de la placa', page.locator('#d-tit'), `${TOTAL} preguntas de los directos de Alex`);
    await g.cuenta('Anillo de progreso con su resumen', v.getByRole('img', { name: `0 de ${TOTAL} preguntas respondidas: 0 aciertos y 0 fallos` }), 1);
    await g.partes('Cifras: aciertos, fallos y sin responder', v.locator('section[aria-labelledby="d-tit"]'), [`0/${TOTAL}`, 'respondidas', 'Tests de los directos', '0', 'aciertos', '0', 'fallos', `${TOTAL}`, 'sin responder']);
    const emp = v.getByRole('link', { name: 'Empezar', exact: true });
    await g.attr('Botón «Empezar» hacia la primera pregunta', emp, 'href', '#formacion/directos/1');
    await g.cuenta('Sin «Continuar» todavía', v.getByRole('link', { name: /^Continuar/ }), 0);
    await g.cuenta('Sin «Repasar fallos»', v.locator('[data-accion="dir-fallos"]'), 0);
    await g.cuenta(`${TOTAL} tarjetas de pregunta`, tarjetas, TOTAL);
    for (const [c, nombre, n] of REPARTO) {
      const sec = v.locator(`section[aria-labelledby="dc-${c}"]`);
      await g.txt(`Categoría ${nombre}: título`, sec.getByRole('heading', { level: 2 }), nombre);
      await g.cuenta(`…con ${n} preguntas`, sec.locator('a[href^="#formacion/directos/"]'), n);
      await g.partes('…y su progreso', sec, [`0 de ${n} respondidas`]);
      await g.cuenta('…sin plegable de respondidas (no hay ninguna)', sec.locator('details details'), 0);
    }
    const textos = await tarjetas.evaluateAll((a) => a.map((x) => [x.getAttribute('href'), x.textContent.replace(/\s+/g, ' ').trim()]));
    const esperado = D.map((d, i) => [`#formacion/directos/${i + 1}`, `Pregunta ${num2(i + 1)} · ${env.CATS[d.cat].nombre} · sin responder${d.nombre}`]);
    g.ok('Cada tarjeta: «Pregunta NN» (más categoría y «sin responder» para lectores de pantalla) y el nombre de la pregunta, en orden y con su enlace por número', igualJSON(textos, esperado), JSON.stringify(textos.find((t, i) => !igualJSON(t, esperado[i]))) + ' ≠ ' + JSON.stringify(esperado[textos.findIndex((t, i) => !igualJSON(t, esperado[i]))]));
    const conDur = textos.filter((t, i) => t[1].includes(dur(D[i].seg)) || /· \d{1,2}:\d\d/.test(t[1]));
    g.ok('…sin la duración del vídeo', conDur.length === 0, JSON.stringify(conDur.slice(0, 2)));
    g.ok('…y sin «Clip NN» como unidad', !/\bClips? \d/.test(norm(await v.innerText())) && !textos.some((t) => /\bclip\b/i.test(t[1])));
    const f = await fugas(page, D);
    g.ok('La portada no pinta ningún título (ni en atributos), id, clave ni explicación', f.length === 0, f.slice(0, 4).join(', '));
    g.ok('…ni pide nada de /clips/', red.clips.length === 0, red.clips.slice(0, 3).join(', '));
    await g.cuenta('…ni lleva ningún <video> ni imagen de clip', page.locator('video, img[src*="clips/"]'), 0);
  });

  await g.seccion('Categorías plegables: sin empezar, las cuatro cerradas; lo que se abre o se cierra se recuerda', async () => {
    const [c1, , n1] = REPARTO[0], [c2, nom2, n2] = REPARTO[1];
    await g.cuenta('Cada categoría es una placa plegable con su cabecera', v.locator('section[aria-labelledby^="dc-"] > details[data-c] > summary'), REPARTO.length);
    await g.igual('Sin nada respondido van las cuatro cerradas: se ve el mapa entero', () => abiertas(page), '');
    await g.cuenta('…y ninguna tarjeta de clip a la vista', v.locator('ul a[href^="#formacion/directos/"]:visible'), 0);
    await g.partes(`La cabecera dice el nombre, de qué va y cuántos lleva («0 de ${n2}»)`, cabecera(page, c2), [nom2, env.CATS[c2].desc, `0 de ${n2}`]);
    const antes = JSON.stringify(await guardado(page));
    await cabecera(page, c2).click();
    await g.igual(`Pulsar la cabecera de ${nom2} la abre`, () => abiertas(page), c2);
    await g.cuenta(`…con sus ${n2} preguntas a la vista`, v.locator(`details[data-c="${c2}"] ul a:visible`), n2);
    await g.igual('…y queda apuntado en el dispositivo', () => apuntadas(page), JSON.stringify({ [c2]: 1 }));
    g.ok('…no en el estado del alumno (abrir y cerrar no guarda nada)', JSON.stringify(await guardado(page)) === antes, JSON.stringify(await guardado(page)).slice(0, 160));
    await cargar(page, BASE + '#formacion/directos');
    await g.igual('Al volver a cargar sigue abierta', () => abiertas(page), c2);
    await cabecera(page, c1).focus();
    await page.keyboard.press('Enter');
    await g.igual('Con el teclado (Intro en la cabecera) se abre otra', () => abiertas(page), c1 + c2);
    await g.cuenta('…y ya están a la vista las preguntas de las dos', v.locator('ul a[href^="#formacion/directos/"]:visible'), n1 + n2);
    await cabecera(page, c2).click();
    await g.igual('Pulsar otra vez la cierra', () => abiertas(page), c1);
    await g.igual('…y también se apunta', async () => JSON.stringify(ordenar(JSON.parse(await apuntadas(page)))), JSON.stringify(ordenar({ [c1]: 1, [c2]: 0 })));
    await cargar(page, BASE + '#formacion/directos');
    await g.igual('…y así sigue al volver', () => abiertas(page), c1);
    await g.cuenta(`Las ${TOTAL} preguntas siguen en la página aunque su categoría esté cerrada (solo no se ven)`, tarjetas, TOTAL);
    g.ok('Sigue sin pedirse nada de /clips/', red.clips.length === 0, red.clips.slice(0, 3).join(', '));
    for (const raro of ['x', '[1]', 'null', JSON.stringify({ [c1]: 'si', Z: 1, [c2]: 2 })]) {
      await page.evaluate(({ k, x }) => localStorage.setItem(k, x), { k: CLAVE_CATS, x: raro });
      await cargar(page, BASE + '#formacion/directos');
      await page.locator('#d-tit').waitFor();
      await g.igual(`Un apunte estropeado (${raro.slice(0, 22)}) se ignora: las cuatro cerradas, sin errores`, () => abiertas(page), '');
    }
    await page.evaluate((k) => localStorage.removeItem(k), CLAVE_CATS);
    await cargar(page, BASE + '#formacion/directos');
    await page.locator('#d-tit').waitFor();
  });

  const d7 = D[6], d8 = D[7];
  await g.seccion('Enlace directo a una pregunta sin responder', async () => {
    await cargar(page, BASE + '#formacion/directos/7');
    const st = await esperaClip(page, 7, false);
    await g.txt(`Cabecera «Pregunta 07 de ${TOTAL} · ${REPARTO[0][1]}»`, cabTest(page), `Pregunta 07 de ${TOTAL} · ${env.CATS[d7.cat].nombre}`);
    await g.txt('Título de la pantalla (h1): el nombre de la pregunta, ya antes de responder', h1(page), d7.nombre);
    g.ok('El enunciado', norm(st.q) === norm(d7.pregunta), norm(st.q).slice(0, 120));
    await g.partes('En este orden: «Pregunta 07 de 90 · Categoría», el nombre, el enunciado y las opciones', v, [`Pregunta 07 de ${TOTAL}`, d7.nombre, d7.pregunta, 'A', d7.opciones[0]]);
    g.ok('Sin «Clip NN» como unidad en la pantalla', !/\bClips? \d/.test(norm(await v.innerText())), norm(await v.innerText()).slice(0, 200));
    const pagina = await page.evaluate(() => { const c = document.documentElement.cloneNode(true); c.querySelectorAll('script').forEach((x) => x.remove()); return c.outerHTML; }); // todo lo pintado (sin el código, que lleva los datos)
    g.ok('El título del clip no está ni en el texto ni en ningún atributo de la página', !pagina.includes(d7.titulo) && !pagina.includes(escHtml(d7.titulo)) && !(await page.title()).includes(d7.titulo));
    g.ok('Cuatro opciones A–D con su texto, sin marcar y activas', igualJSON(st.ops.map((o) => norm(o.t)), d7.opciones.map((t, i) => norm('ABCD'[i] + t))) && st.ops.every((o) => !o.pulsada && !o.off), JSON.stringify(st.ops).slice(0, 300));
    await g.attr('Pestañas: en el test no se pintan, pero el menú sigue en Formación', page.locator('a[data-ruta="formacion"]'), 'aria-current', 'page');
    g.ok('Sin responder no hay <video> en la página', st.videos === 0, `vídeos: ${st.videos}`);
    await g.cuenta('…ni imagen del clip', page.locator('img[src*="clips/"], [poster]'), 0);
    const f = await fugas(page, D);
    g.ok('…ni el título, el id, la clave o la explicación en la vista', f.length === 0, f.slice(0, 4).join(', '));
    g.ok('…ni se ha pedido nada de /clips/', red.clips.length === 0, red.clips.slice(0, 3).join(', '));
    await g.partes('La pantalla del clip está apagada y dice cuánto dura', v, ['El clip del directo', 'Responde para ver el clip', `El momento del directo en el que Alex lo explica · ${dur(d7.seg)}`]);
    await g.cuenta('Todavía sin «Siguiente pregunta» ni «Repetir»', v.locator('[data-accion="dir-sig"], [data-accion="dir-repetir"]'), 0);
    await g.attr('Enlace para volver a la portada', v.locator('a[href="#formacion/directos"]').first(), 'href', '#formacion/directos');
    g.ok('Todavía no se ha guardado ninguna respuesta', !((await guardado(page)) || {}).directos, JSON.stringify(((await guardado(page)) || {}).directos));
  });

  await g.seccion('Acertar: opción marcada, explicación, clip y guardado', async () => {
    await opcion(page, d7.correcta).click();
    const st = await esperaClip(page, 7, true);
    g.ok('Veredicto «Correcto»', norm(st.ver) === 'Correcto', st.ver);
    g.ok('Las cuatro opciones quedan desactivadas', st.ops.every((o) => o.off));
    g.ok('La elegida queda marcada (aria-pressed) y solo ella', st.ops.filter((o) => o.pulsada).map((o) => o.o).join() === String(d7.correcta), JSON.stringify(st.ops.map((o) => o.pulsada)));
    await g.cumple('…y dice que es la correcta también a quien no ve el color', async () => norm(await opcion(page, d7.correcta).textContent()), (t) => t.endsWith('(tu respuesta, correcta)'));
    await g.cuenta('Sin línea «Correcta: …» cuando se acierta', v.getByText(/^Correcta: /), 0);
    await g.partes('La explicación, firmada por el método y no por Alex (el texto habla de él en tercera persona)', v, ['Explicación', 'Método AGX, la lección del clip', d7.explicacion]);
    g.ok('La firma de la explicación no dice «Alex, Método AGX»', !/Alex\s*,\s*Método AGX/.test(norm(await v.innerText())));
    await g.partes('El bloque del clip: rótulo, título y clave', v, ['Así lo explica Alex en el directo', d7.titulo, d7.clave]);
    await g.txt('…con el título como encabezado', page.locator('#d-clip-t'), d7.titulo);
    const vid = page.locator('#dir-video');
    await g.cuenta('Un solo <video>', page.locator('video'), 1);
    const a = await vid.evaluate((e) => ({ src: e.getAttribute('src'), poster: e.getAttribute('poster'), preload: e.getAttribute('preload'), controls: e.controls, playsinline: e.hasAttribute('playsinline'), autoplay: e.autoplay, loop: e.loop, muted: e.muted, paused: e.paused, t: e.currentTime, nombre: e.getAttribute('aria-label'), absSrc: e.src }));
    g.ok('src = clips/<id>.mp4', a.src === `clips/${d7.id}.mp4`, a.src);
    g.ok('poster = clips/<id>.jpg', a.poster === `clips/${d7.id}.jpg`, a.poster);
    g.ok('preload="none"', a.preload === 'none', a.preload);
    g.ok('Con controles', a.controls === true);
    g.ok('Con playsinline (no salta a pantalla completa en el iPhone)', a.playsinline === true);
    g.ok('No se reproduce solo (sin autoplay, parado, en 0:00, con sonido)', a.autoplay === false && a.paused === true && a.t === 0 && a.muted === false && a.loop === false, JSON.stringify(a));
    g.ok('Con nombre accesible', a.nombre === `Clip del directo: ${d7.titulo}`, a.nombre);
    g.ok('El vídeo es del mismo origen', a.absSrc === `${BASE}clips/${d7.id}.mp4`, a.absSrc);
    const caja = await vid.evaluate((e) => { const b = e.getBoundingClientRect(), p = e.parentElement.getBoundingClientRect(); return { w: b.width, h: b.height, ar: getComputedStyle(e.parentElement).aspectRatio, pw: p.width, ph: p.height }; });
    g.ok('Proporción reservada 16:9 (sin saltos al cargar la portada)', caja.ar.replace(/\s/g, '') === '16/9' && Math.abs(caja.pw / caja.ph - 16 / 9) < 0.02 && caja.w > 300, JSON.stringify(caja));
    await g.cumple('Se pide la portada del clip', () => red.clips.slice(), (c) => c.includes(`/clips/${d7.id}.jpg`), 4000);
    await g.cumple('…y carga', () => vid.evaluate((e) => new Promise((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth); i.onerror = () => res(0); i.src = e.poster; })), (w) => w >= 320, 5000);
    await pausa(600);
    g.ok('El vídeo no se pide hasta que el alumno le da a reproducir', !red.clips.some((c) => /\.mp4$/.test(c)), red.clips.join(', '));
    g.ok('Solo se ha pedido la portada de este clip', igualJSON(Array.from(new Set(red.clips)), [`/clips/${d7.id}.jpg`]), red.clips.join(', '));
    await g.oculto('Sin aviso de error de carga', page.locator('#dir-error'));
    await g.txt('Botón «Siguiente pregunta»', sig, 'Siguiente pregunta');
    await g.txt('Botón «Repetir»', repetir, 'Repetir');
    await g.txt('Tras responder, la cabecera sigue igual (el nombre como título)', h1(page), d7.nombre);
    await g.cuenta('Botón «Volver»', v.getByRole('link', { name: 'Volver', exact: true }), 1);
    const s = await guardado(page);
    g.ok('Guardado en state.directos con la forma { o, ok, f }', !!s && igualJSON(s.directos, { [d7.id]: { o: d7.correcta, ok: true, f: HOY } }), JSON.stringify(s && s.directos));
    await g.cumple('Tras responder, el veredicto y el clip quedan a la vista', () => page.evaluate(() => { const a = document.getElementById('d-ver').getBoundingClientRect(), b = document.getElementById('dir-video').getBoundingClientRect(); return { a: Math.round(a.top), b: Math.round(b.bottom), h: innerHeight }; }), (m) => m.a >= 0 && m.a < m.h && m.b <= m.h + 1, 4000);
  });

  await g.seccion('Si el vídeo no carga, lo dice', async () => {
    const vid = page.locator('#dir-video'), err = page.locator('#dir-error');
    await vid.evaluate((e) => { const p = e.play(); if (p && p.catch) p.catch(() => {}); });
    await g.visible('Al fallar la carga aparece el aviso', err, 8000);
    await g.partes('…con un texto claro', err, ['No se ha podido cargar el clip. Revisa tu conexión.']);
    await g.attr('…anunciado como alerta', err, 'role', 'alert');
    const caja = await page.evaluate(() => { const a = document.getElementById('dir-error').getBoundingClientRect(), b = document.getElementById('dir-video').getBoundingClientRect(); return { dentro: a.top >= b.top - 1 && a.bottom <= b.bottom + 1 && a.left >= b.left - 1 && a.right <= b.right + 1, visto: a.top >= 0 && a.bottom <= innerHeight, a: [Math.round(a.top), Math.round(a.bottom)], b: [Math.round(b.top), Math.round(b.bottom)] }; });
    g.ok('…pintado DENTRO de la pantalla del clip, sobre el vídeo (no debajo, donde podía quedar fuera de la vista)', caja.dentro && caja.visto, JSON.stringify(caja));
    g.ok('(el vídeo se ha pedido solo al darle a reproducir)', red.clips.includes(`/clips/${d7.id}.mp4`), red.clips.join(', '));
    const n = red.clips.filter((c) => /\.mp4$/.test(c)).length;
    await v.locator('[data-accion="dir-reintentar"]').click();
    await g.cumple('«Reintentar» vuelve a pedir el vídeo', () => red.clips.filter((c) => /\.mp4$/.test(c)).length, (k) => k > n, 5000);
    await g.visible('…y si sigue sin cargar, el aviso vuelve', err, 8000);
  });

  await g.seccion('«Siguiente pregunta», fallar y atajos de teclado', async () => {
    await page.evaluate(() => { window.__pausas = 0; const p = HTMLMediaElement.prototype.pause; HTMLMediaElement.prototype.pause = function () { window.__pausas++; return p.apply(this, arguments); }; });
    await sig.click();
    await g.igual('«Siguiente pregunta» lleva a la siguiente sin responder', () => hashDe(page), '#formacion/directos/8');
    let st = await esperaClip(page, 8, false);
    g.ok('Al salir de un clip respondido, su vídeo se para antes de quitarlo de la página (si no, podría seguir sonando)', (await page.evaluate(() => window.__pausas)) >= 1, `llamadas a pause(): ${await page.evaluate(() => window.__pausas)}`);
    g.ok('…que se abre como pregunta nueva, sin vídeo', st.videos === 0 && st.ops.every((o) => !o.off));
    await g.igual('…y empieza arriba', () => page.evaluate(() => Math.round(window.scrollY)), 0);
    g.ok('…sin título, id, clave ni explicación del clip nuevo', (await fugas(page, [d8])).length === 0, (await fugas(page, [d8])).join(', '));
    g.ok('…y con su nombre como título', st.nombre === d8.nombre, st.nombre);
    const mal = otra(d8);
    await page.keyboard.press('abcd'[mal]);
    st = await esperaClip(page, 8, true);
    g.ok(`Tecla «${'ABCD'[mal]}»: responde esa opción`, st.ops.filter((o) => o.pulsada).map((o) => o.o).join() === String(mal), JSON.stringify(st.ops.map((o) => o.pulsada)));
    g.ok('Veredicto «Incorrecto, era la X»', norm(st.ver) === `Incorrecto, era la ${'ABCD'[d8.correcta]}`, st.ver);
    await g.partes('…con el texto de la correcta', v, [`Correcta: ${d8.opciones[d8.correcta]}`]);
    await g.cumple('La fallada lo dice sin depender del color', async () => norm(await opcion(page, mal).textContent()), (t) => t.endsWith('(tu respuesta, incorrecta)'));
    await g.cumple('…y la correcta también', async () => norm(await opcion(page, d8.correcta).textContent()), (t) => t.endsWith('(la correcta)'));
    await g.partes('Al fallar también salen la explicación y el clip', v, [d8.titulo, d8.clave, d8.explicacion]);
    await g.attr('…con su vídeo', page.locator('#dir-video'), 'src', `clips/${d8.id}.mp4`);
    let s = await guardado(page);
    g.ok('Guardado como fallo', igualJSON(s.directos[d8.id], { o: mal, ok: false, f: HOY }) && Object.keys(s.directos).length === 2, JSON.stringify(s.directos));
    await page.keyboard.press('abcd'[d8.correcta]);
    await pausa(300);
    s = await guardado(page);
    g.ok('Ya respondido, las teclas no cambian la respuesta', s.directos[d8.id].o === mal, JSON.stringify(s.directos[d8.id]));
    await page.keyboard.press('Enter');
    await g.igual('Intro: siguiente pregunta', () => hashDe(page), '#formacion/directos/9');
    await esperaClip(page, 9, false);
    await page.keyboard.press('Enter');
    await pausa(250);
    await g.igual('Intro sin responder no hace nada', () => hashDe(page), '#formacion/directos/9');
    await page.keyboard.press(String(D[8].correcta + 1));
    st = await esperaClip(page, 9, true);
    g.ok(`Tecla «${D[8].correcta + 1}»: responde la opción ${'ABCD'[D[8].correcta]}`, st.ops.filter((o) => o.pulsada).map((o) => o.o).join() === String(D[8].correcta) && norm(st.ver) === 'Correcto', JSON.stringify(st.ops.map((o) => o.pulsada)));
    await page.keyboard.press('ArrowRight');
    await g.igual('Flecha derecha: siguiente pregunta', () => hashDe(page), '#formacion/directos/10');
    await esperaClip(page, 10, false);
    for (const [tecla, o] of [['4', 3], ['d', 3]]) { // la D y el 4, que los tests de tres opciones no tienen
      if (tecla === 'd') { await page.locator('[data-accion="dir-repetir"]').click(); await esperaClip(page, 10, false); }
      await page.keyboard.press(tecla);
      st = await esperaClip(page, 10, true);
      g.ok(`Tecla «${tecla.toUpperCase()}»: responde la D`, st.ops.filter((x) => x.pulsada).map((x) => x.o).join() === String(o), JSON.stringify(st.ops.map((x) => x.pulsada)));
    }
    await page.keyboard.press('Control+b');
    await page.keyboard.press('Alt+a');
    g.ok('Con Ctrl o Alt las letras no responden', (await guardado(page)).directos[D[9].id].o === 3);
    await page.locator('#dir-video').focus();
    await page.keyboard.press('ArrowRight');
    await pausa(300);
    await g.igual('Con el foco en el vídeo, las flechas son del vídeo (no cambia de clip)', () => hashDe(page), '#formacion/directos/10');
  });

  await g.seccion('Atrás, adelante y recarga', async () => {
    await page.goBack();
    await g.igual('Atrás: vuelve al clip anterior', () => hashDe(page), '#formacion/directos/9');
    const st = await esperaClip(page, 9, true);
    g.ok('…que se ve en modo repaso (respuesta, explicación y clip)', st.video && st.ops.every((o) => o.off) && norm(st.ver) === 'Correcto');
    await page.goForward();
    await g.igual('Adelante', () => hashDe(page), '#formacion/directos/10');
    await esperaClip(page, 10, true);
    await page.reload();
    const st2 = await esperaClip(page, 10, true);
    g.ok('Recargar en un clip respondido: sigue respondido', st2.video && st2.ops.filter((o) => o.pulsada).map((o) => o.o).join() === '3');
    await g.txt('…con su cabecera', cabTest(page), `Pregunta 10 de ${TOTAL} · ${env.CATS[D[9].cat].nombre}`);
    await g.txt('…y su nombre', h1(page), D[9].nombre);
  });

  await g.seccion('Portada con progreso tras recargar', async () => {
    await cargar(page, BASE + '#formacion/directos');
    const okD10 = D[9].correcta === 3; // clips 7 (bien), 8 (mal), 9 (bien) y 10 (opción D)
    const ac = 2 + (okD10 ? 1 : 0), fa = 1 + (okD10 ? 0 : 1);
    await g.txt('Rótulo: lo que queda', page.locator('#d-tit'), `Te quedan ${TOTAL - 4} preguntas por responder`);
    await g.cuenta('Anillo con el resumen', v.getByRole('img', { name: `4 de ${TOTAL} preguntas respondidas: ${ac} ${ac === 1 ? 'acierto' : 'aciertos'} y ${fa} ${fa === 1 ? 'fallo' : 'fallos'}` }), 1);
    await g.partes('Cifras', v.locator('section[aria-labelledby="d-tit"]'), [`4/${TOTAL}`, `${ac}`, 'aciertos', `${fa}`, fa === 1 ? 'fallo' : 'fallos', `${TOTAL - 4}`, 'sin responder']);
    await g.attr('«Continuar» va a la primera pregunta sin responder', v.getByRole('link', { name: /^Continuar/ }), 'href', '#formacion/directos/1');
    await g.txt('…y dice cuál', v.getByRole('link', { name: /^Continuar/ }), 'Continuar: pregunta 01');
    await g.cuenta('Ya no hay «Empezar»', v.getByRole('link', { name: 'Empezar', exact: true }), 0);
    await g.txt('«Repasar fallos (n)»', v.locator('[data-accion="dir-fallos"]'), `Repasar fallos (${fa})`);
    await g.txt('Tarjeta acertada: «Pregunta 07», «Acertada», el nombre y el título del clip', v.locator('a[href="#formacion/directos/7"]'), `Pregunta 07 · ${env.CATS[d7.cat].nombre}Acertada${d7.nombre}${d7.titulo}`);
    await g.txt('Tarjeta fallada: «Pregunta 08», «Fallada», el nombre y el título del clip', v.locator('a[href="#formacion/directos/8"]'), `Pregunta 08 · ${env.CATS[d8.cat].nombre}Fallada${d8.nombre}${d8.titulo}`);
    await g.cuenta('…cada estado con su icono (además del color)', v.locator('a[href="#formacion/directos/7"] > span[aria-hidden="true"] svg, a[href="#formacion/directos/8"] > span[aria-hidden="true"] svg, a[href="#formacion/directos/1"] > span[aria-hidden="true"] svg'), 3);
    await g.cuenta('…y el título del clip con el icono de vídeo (solo en las respondidas)', v.locator('a[href="#formacion/directos/7"] svg, a[href="#formacion/directos/8"] svg, a[href="#formacion/directos/1"] svg'), 5);
    await g.igual('Las respondidas van recogidas tras «Ver las 4 respondidas», cerrado mientras queden pendientes en la categoría', async () => { const sm = hechas(page, 'C'); return `${await sm.count()} ${norm(await sm.innerText())} ${await sm.evaluate((e) => e.parentElement.open)}`; }, '1 Ver las 4 respondidas false');
    g.ok('…después de las pendientes', await page.evaluate(() => { const cat = document.querySelector('#vista details[data-c="C"]'), s = cat.querySelector(':scope details > summary'), p = cat.querySelector('a[href="#formacion/directos/1"]'); return !!(p.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING); }));
    await g.igual('…y las pendientes a la vista, sin las respondidas', () => v.locator('details[data-c="C"] a[href^="#formacion/directos/"]:visible').count(), CAT1 - 4);
    await hechas(page, 'C').click();
    await g.igual('Pulsar «Ver las 4 respondidas» las enseña', () => v.locator('details[data-c="C"] a[href^="#formacion/directos/"]:visible').count(), CAT1);
    await g.igual('…y el rótulo pasa a «Ocultar las 4 respondidas»', async () => norm(await hechas(page, 'C').innerText()), 'Ocultar las 4 respondidas');
    await hechas(page, 'C').click();
    await g.igual('…y volver a pulsarlo las recoge', () => v.locator('details[data-c="C"] a[href^="#formacion/directos/"]:visible').count(), CAT1 - 4);
    const resp = new Set([6, 7, 8, 9]);
    const f = await fugas(page, D.filter((d, i) => !resp.has(i)));
    g.ok('Los títulos de los clips sin responder siguen sin aparecer', f.length === 0, f.slice(0, 4).join(', '));
    await g.partes('Progreso de la categoría', v.locator('section[aria-labelledby="dc-C"]'), [`4 de ${CAT1} respondidas`, `${ac} ${ac === 1 ? 'acierto' : 'aciertos'}`]);
    await g.igual('Con algo respondido, está abierta la categoría de la siguiente pregunta sin responder (y solo esa)', () => abiertas(page), REPARTO[0][0]);
    g.ok('…sin que eso se apunte como elección del alumno', (await apuntadas(page)) === null, String(await apuntadas(page)));
    await v.getByRole('link', { name: /^Continuar/ }).click();
    await g.igual('Pulsar «Continuar»: URL', () => hashDe(page), '#formacion/directos/1');
    await esperaClip(page, 1, false);
  });

  await g.seccion('Modo repaso, «Repetir» y «Volver»', async () => {
    await v.locator('a[href="#formacion/directos"]').first().click();
    await g.igual('El enlace de arriba vuelve a la portada', () => hashDe(page), '#formacion/directos');
    await (await tarjeta(page, 8)).click();
    let st = await esperaClip(page, 8, true);
    g.ok('Una pregunta ya respondida se abre en modo repaso: respuesta marcada, veredicto y vídeo', st.video && st.ops.every((o) => o.off) && /^Incorrecto/.test(norm(st.ver)));
    await g.partes('…con su explicación y su clip', v, [d8.titulo, d8.clave, d8.explicacion]);
    await repetir.click();
    st = await esperaClip(page, 8, false);
    g.ok('«Repetir»: vuelve a ser una pregunta nueva, sin vídeo', st.videos === 0 && st.ops.every((o) => !o.off && !o.pulsada));
    g.ok('…y vuelve a esconder título, clave y explicación', (await fugas(page, [d8])).length === 0, (await fugas(page, [d8])).join(', '));
    g.ok('…sin borrar lo guardado hasta que se responde', (await guardado(page)).directos[d8.id].ok === false);
    await g.igual('…y la URL no cambia', () => hashDe(page), '#formacion/directos/8');
    await opcion(page, d8.correcta).click();
    st = await esperaClip(page, 8, true);
    g.ok('Responder otra vez sustituye la respuesta', norm(st.ver) === 'Correcto' && igualJSON((await guardado(page)).directos[d8.id], { o: d8.correcta, ok: true, f: HOY }), JSON.stringify((await guardado(page)).directos[d8.id]));
    await repetir.click();
    await esperaClip(page, 8, false);
    await v.locator('a[href="#formacion/directos"]').first().click();
    await g.igual('Salir a medias de «Repetir»', () => hashDe(page), '#formacion/directos');
    await (await tarjeta(page, 8)).click();
    st = await esperaClip(page, 8, true);
    g.ok('…y al volver a abrirlo está en modo repaso con la respuesta guardada', st.video && norm(st.ver) === 'Correcto');
    await v.getByRole('link', { name: 'Volver', exact: true }).click();
    await g.igual('«Volver» lleva a la portada', () => hashDe(page), '#formacion/directos');
    await g.txt('…con el resumen', page.locator('#d-tit'), `Te quedan ${TOTAL - 4} preguntas por responder`);
    await g.cumple('…y deja a la vista y con el foco la tarjeta de la pregunta de la que se viene (abre su plegable de respondidas)', () => page.evaluate(() => { const a = document.querySelector('#vista a[href="#formacion/directos/8"]'), r = a.getBoundingClientRect(); return { foco: document.activeElement === a, top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight }; }), (m) => m.foco && m.top >= 0 && m.bottom <= m.h, 3000);
  });

  await g.seccion('Pregunta que no existe y acción rápida', async () => {
    for (const mala of ['0', String(TOTAL + 1), '999']) {
      await cargar(page, BASE + '#formacion/directos/' + mala);
      await g.partes(`#formacion/directos/${mala}: «No encuentro esa pregunta»`, v, ['No encuentro esa pregunta.', 'Volver a los tests de los directos']);
    }
    for (const mala of ['abc', '-1', '1000', '7?x=1', '7/8', D[6].id, '%3Cimg%20src=x%20onerror=window.__xss=1%3E']) { // lo que cuelga de «directos/» y no es un número de clip
      await cargar(page, BASE + '#formacion/directos/' + mala);
      await g.partes(`#formacion/directos/${mala.slice(0, 24)}: «No encuentro esa pregunta» (y no el Diario)`, v, ['No encuentro esa pregunta.', 'Volver a los tests de los directos']);
    }
    await g.attr('…con «Formación» marcada en el menú', page.locator('a[data-ruta="formacion"]'), 'aria-current', 'page');
    g.ok('…y sin ejecutar nada de lo que venga en la dirección', (await page.evaluate(() => window.__xss)) === undefined);
    await cargar(page, BASE + '#formacion/directos/7/');
    g.ok('Con una barra de más al final (…/directos/7/) se abre la pregunta 7', (await esperaClip(page, 7)).n === 7);
    await cargar(page, BASE + '#formacion/directos/');
    await g.txt('«#formacion/directos/» (sin número) es la portada', page.locator('#d-tit'), `Te quedan ${TOTAL - 4} preguntas por responder`);
    await cargar(page, BASE + '#formacion/directosX');
    await g.txt('Lo que no es de este apartado sigue cayendo en el Diario, como cualquier dirección desconocida', h1(page), 'Diario de trading');
    await page.keyboard.press('Control+k');
    await page.locator('#paleta').waitFor();
    await hasta(() => page.evaluate(() => document.activeElement && document.activeElement.id), (id) => id === 'paleta-in', 4000);
    await page.locator('#paleta-in').fill('directos');
    await g.txt('Acciones rápidas: «Tests de los directos»', page.locator('#paleta-lista [role="option"][aria-selected="true"]'), 'Tests de los directos');
    await g.cuenta('…una sola acción con ese nombre', page.locator('#paleta-lista [role="option"]'), 1);
    await page.keyboard.press('Enter');
    await g.igual('…que lleva a la portada', () => hashDe(page), '#formacion/directos');
    await g.txt('…ya pintada', page.locator('#d-tit'), `Te quedan ${TOTAL - 4} preguntas por responder`);
    await page.locator('a[data-ruta="formacion"]').click();
    await g.igual('El menú «Formación» sigue llevando a la ruta por niveles', () => hashDe(page), '#formacion');
    await g.partes('…cuyo acceso a los directos enseña el progreso', page.locator('#vista > a[href="#formacion/directos"]'), ['Tests de los directos', `4 de ${TOTAL}`]);
  });
  cierre(g);
}

/* =====================================================================================================
 * GRUPO 3 · Estado: antiguo sin la clave, valores raros, repaso de fallos, todo respondido
 * ===================================================================================================== */
async function gEstado(g, env) {
  const D = env.D;
  const { page, red } = await contexto(g, env, { nombre: 'estado' });
  const v = page.locator('#vista');
  const sig = v.locator('[data-accion="dir-sig"]');

  await g.seccion('Estado antiguo (sin la clave «directos»)', async () => {
    const viejo = estadoAntiguo();
    await sembrar(page, viejo, BASE + '#formacion/directos');
    await g.txt('La portada se pinta a cero', page.locator('#d-tit'), `${TOTAL} preguntas de los directos de Alex`);
    await g.cuenta(`…con sus ${TOTAL} preguntas`, v.locator('ul a[href^="#formacion/directos/"]'), TOTAL);
    g.ok('Entrar y mirar no guarda nada', igualJSON(await guardado(page), viejo), JSON.stringify(await guardado(page)).slice(0, 200));
    await (await tarjeta(page, 3)).click();
    await esperaClip(page, 3, false);
    g.ok('Abrir un clip tampoco guarda nada', igualJSON(await guardado(page), viejo));
    await opcion(page, D[2].correcta).click();
    await esperaClip(page, 3, true);
    const s = await guardado(page);
    g.ok('Al responder aparece la clave nueva…', igualJSON(s.directos, { [D[2].id]: { o: D[2].correcta, ok: true, f: HOY } }), JSON.stringify(s.directos));
    const resto = Object.assign({}, s); delete resto.directos;
    g.ok('…y el resto del estado queda idéntico (operaciones, temas, fallos, ruta, objetivo…)', igualJSON(resto, viejo), JSON.stringify(resto).slice(0, 300));
    await cargar(page, BASE + '#diario');
    await g.txt('El Diario sigue cargando con ese estado', h1(page), 'Diario de trading');
    await cargar(page, BASE + '#formacion');
    await g.partes('…y la Formación (su lección aprobada sigue ahí)', page.locator('#lat-widgets'), ['Formación: 1 de 70 lecciones']);
  });

  await g.seccion('Valores raros en «directos»: se leen como sin responder, sin errores', async () => {
    const raros = [null, [], 'x', 7, { [D[0].id]: null, [D[1].id]: { o: 9, ok: true }, [D[2].id]: { o: '1', ok: true }, [D[3].id]: { ok: true }, [D[4].id]: 'si', 'clip-que-ya-no-existe': { o: 0, ok: true, f: '2026-01-01' } }];
    for (const [i, r] of raros.entries()) {
      await sembrar(page, Object.assign(estadoAntiguo(), { directos: r }), BASE + '#formacion/directos');
      await g.txt(`directos = ${JSON.stringify(r).slice(0, 34)}…: portada a cero`, page.locator('#d-tit'), `${TOTAL} preguntas de los directos de Alex`);
      if (i === raros.length - 1) {
        await (await tarjeta(page, 2)).click();
        const st = await esperaClip(page, 2, false);
        g.ok('…un clip con una respuesta imposible se abre sin responder', st.videos === 0 && st.ops.every((o) => !o.off));
        await opcion(page, D[1].correcta).click();
        await esperaClip(page, 2, true);
        const s = await guardado(page);
        g.ok('…y al responder se guarda bien, sin tocar lo demás', igualJSON(s.directos[D[1].id], { o: D[1].correcta, ok: true, f: HOY }) && igualJSON(s.directos['clip-que-ya-no-existe'], { o: 0, ok: true, f: '2026-01-01' }), JSON.stringify(s.directos).slice(0, 300));
      }
    }
    await sembrar(page, Object.assign(estadoAntiguo(), { directos: 'x' }), BASE + '#formacion/directos/1');
    await esperaClip(page, 1, false);
    await opcion(page, otra(D[0])).click();
    await esperaClip(page, 1, true);
    g.ok('Con «directos» estropeado, responder lo deja con la forma correcta', igualJSON((await guardado(page)).directos, { [D[0].id]: { o: otra(D[0]), ok: false, f: HOY } }), JSON.stringify((await guardado(page)).directos));
    await sembrar(page, Object.assign(estadoAntiguo(), { directos: { [D[0].id]: { o: D[0].correcta, ok: false, f: '2026-10-01' } } }), BASE + '#formacion/directos');
    await g.cuenta('El acierto se decide con la opción guardada y la clave, no con el «ok» guardado', v.getByRole('img', { name: `1 de ${TOTAL} preguntas respondidas: 1 acierto y 0 fallos` }), 1);
  });

  await g.seccion('«Repasar fallos» recorre los fallados como preguntas nuevas', async () => {
    const dir = {}; [0, 1, 2, 3, 4].forEach((i) => { dir[D[i].id] = respuesta(D[i], i !== 1 && i !== 3); }); // fallados: clips 2 y 4
    await sembrar(page, Object.assign(estadoAntiguo(), { directos: dir }), BASE + '#formacion/directos');
    await g.txt('Botón con el número de fallos', v.locator('[data-accion="dir-fallos"]'), 'Repasar fallos (2)');
    const pedidas = red.clips.length;
    await v.locator('[data-accion="dir-fallos"]').click();
    await g.igual('Empieza por el primer fallado', () => hashDe(page), '#formacion/directos/2');
    let st = await esperaClip(page, 2, false);
    g.ok('…como pregunta nueva: opciones activas, sin vídeo', st.videos === 0 && st.ops.every((o) => !o.off && !o.pulsada));
    g.ok('…sin título, clave ni explicación', (await fugas(page, [D[1]])).length === 0, (await fugas(page, [D[1]])).join(', '));
    await g.partes('La cabecera dice que es un repaso y por dónde va', v, ['Repaso de fallos · 1 de 2']);
    g.ok('…y no se ha pedido nada de /clips/', red.clips.length === pedidas, red.clips.slice(pedidas).join(', '));
    await opcion(page, D[1].correcta).click();
    st = await esperaClip(page, 2, true);
    g.ok('Acertarlo ahora lo deja acertado', norm(st.ver) === 'Correcto' && (await guardado(page)).directos[D[1].id].ok === true);
    await g.txt('Botón «Siguiente pregunta»', sig, 'Siguiente pregunta');
    await g.cuenta('En el repaso no hay «Repetir»', v.locator('[data-accion="dir-repetir"]'), 0);
    await sig.click();
    await g.igual('«Siguiente pregunta» salta a la siguiente FALLADA (no al siguiente sin responder)', () => hashDe(page), '#formacion/directos/4');
    st = await esperaClip(page, 4, false);
    g.ok('…también como pregunta nueva', st.videos === 0 && st.ops.every((o) => !o.off));
    await g.partes('…2 de 2', v, ['Repaso de fallos · 2 de 2']);
    await page.goBack();
    st = await esperaClip(page, 2, true);
    g.ok('Atrás durante el repaso: el anterior, ya respondido', st.video && norm(st.ver) === 'Correcto');
    await page.goForward();
    await esperaClip(page, 4);
    await cargar(page, BASE + '#formacion/directos/4');
    st = await esperaClip(page, 4, true);
    g.ok('Recargar a mitad del repaso: el clip vuelve a su estado guardado (fallado, en modo repaso)', st.video && /^Incorrecto/.test(norm(st.ver)));
    await cargar(page, BASE + '#formacion/directos');
    await g.txt('Queda un fallo por repasar', v.locator('[data-accion="dir-fallos"]'), 'Repasar fallos (1)');
    await v.locator('[data-accion="dir-fallos"]').click();
    await esperaClip(page, 4, false);
    await g.partes('Repaso de un solo clip', v, ['Repaso de fallos · 1 de 1']);
    await opcion(page, otra(D[3])).click();
    await esperaClip(page, 4, true);
    await g.txt('En el último, el botón es «Terminar el repaso»', sig, 'Terminar el repaso');
    await sig.click();
    await g.igual('…y vuelve a la portada', () => hashDe(page), '#formacion/directos');
    await g.toast(page, 'Repaso terminado: 0 de 1 acertada', 'Con un aviso del resultado del repaso');
    await g.txt('…con el resumen', page.locator('#d-tit'), `Te quedan ${TOTAL - 5} preguntas por responder`);
    await g.txt('…y el fallo sigue pendiente', v.locator('[data-accion="dir-fallos"]'), 'Repasar fallos (1)');
  });

  await g.seccion('El último clip y todo respondido', async () => {
    await sembrar(page, Object.assign(estadoAntiguo(), { directos: { [D[1].id]: respuesta(D[1], true) } }), BASE + '#formacion/directos/' + TOTAL);
    await esperaClip(page, TOTAL, false);
    await opcion(page, D[TOTAL - 1].correcta).click();
    await esperaClip(page, TOTAL, true);
    await g.txt('En la última pregunta, con otras pendientes, el botón sigue siendo «Siguiente pregunta»', sig, 'Siguiente pregunta');
    await sig.click();
    await g.igual('…y da la vuelta: lleva al primero sin responder', () => hashDe(page), '#formacion/directos/1');
    await esperaClip(page, 1, false);
    const dir = {}; D.forEach((d, i) => { if (i !== TOTAL - 1) dir[d.id] = respuesta(d, i !== 20); }); // falta el último; fallado el 21
    await sembrar(page, Object.assign(estadoAntiguo(), { directos: dir }), BASE + '#formacion/directos');
    await g.txt(`${TOTAL - 1} de ${TOTAL}: queda una`, page.locator('#d-tit'), 'Te queda 1 pregunta por responder');
    await g.txt('«Continuar» apunta al único que falta', v.getByRole('link', { name: /^Continuar/ }), `Continuar: pregunta ${num2(TOTAL)}`);
    await v.getByRole('link', { name: /^Continuar/ }).click();
    await esperaClip(page, TOTAL, false);
    await opcion(page, D[TOTAL - 1].correcta).click();
    await esperaClip(page, TOTAL, true);
    await g.txt('Sin preguntas por responder, el botón es «Ver el resumen»', sig, 'Ver el resumen');
    await g.cuenta(`Confeti al completar los ${TOTAL}`, page.locator('canvas'), 1, 3000);
    await sig.click();
    await g.igual('…y lleva a la portada', () => hashDe(page), '#formacion/directos');
    await g.txt('Portada con todo respondido', page.locator('#d-tit'), `Las ${TOTAL} preguntas respondidas`);
    await g.cuenta(`Anillo: ${TOTAL} de ${TOTAL}`, v.getByRole('img', { name: `${TOTAL} de ${TOTAL} preguntas respondidas: ${TOTAL - 1} aciertos y 1 fallo` }), 1);
    await g.cuenta('Sin «Empezar» ni «Continuar»', v.getByRole('link', { name: /^(Empezar|Continuar)/ }), 0);
    await g.txt('«Repasar fallos (1)» como botón principal', v.locator('[data-accion="dir-fallos"]'), 'Repasar fallos (1)');
    const titulos = await v.locator('ul a[href^="#formacion/directos/"]').evaluateAll((a) => a.map((x) => x.textContent));
    const cuerposT = await v.locator('details[data-c]').evaluateAll((ds) => ds.map((d) => { const h = d.querySelector('details'); return [d.querySelectorAll(':scope > div > ul').length, h ? h.open : null, h ? Array.from(h.querySelector('summary').children).filter((e) => getComputedStyle(e).display !== 'none' && e.textContent.trim()).map((e) => e.textContent.trim()).join(' ') : '']; }));
    g.ok('Con todo respondido, en cada categoría el plegable de respondidas viene abierto («Ocultar las N respondidas») y no hay lista de pendientes', igualJSON(cuerposT, REPARTO.map(([, , n]) => [0, true, `Ocultar las ${n} respondidas`])), JSON.stringify(cuerposT));
    g.ok(`Las ${TOTAL} tarjetas enseñan ya su nombre y el título del clip`, D.every((d, i) => norm(titulos[i]).endsWith(norm(d.nombre + d.titulo))), 'falta en ' + D.filter((d, i) => !norm(titulos[i] || '').endsWith(norm(d.nombre + d.titulo))).map((d) => d.id).slice(0, 3).join(', '));
    g.ok(`Las ${TOTAL} tarjetas enseñan ya su título`, D.every((d, i) => norm(titulos[i]).endsWith(norm(d.titulo))), 'falta en ' + D.filter((d, i) => !norm(titulos[i] || '').endsWith(norm(d.titulo))).map((d) => d.id).slice(0, 3).join(', '));
    const ant = v.locator('[data-accion="dir-ant"]'), volver = v.getByRole('link', { name: 'Volver', exact: true });
    await g.igual('Con todo respondido, las cuatro categorías van cerradas', () => abiertas(page), '');
    await (await tarjeta(page, 12)).click();
    await esperaClip(page, 12, true);
    await g.txt('Abrir una pregunta para repasarla con todo respondido: el botón principal es «Siguiente pregunta» (la que sigue por orden)', sig, 'Siguiente pregunta');
    await g.txt('…con «Anterior»', ant, 'Anterior');
    await g.cuenta('…«Repetir»', v.locator('[data-accion="dir-repetir"]'), 1);
    await g.cuenta('…y «Volver»', volver, 1);
    await page.keyboard.press('Enter');
    await g.igual('Intro: a la pregunta siguiente', () => hashDe(page), '#formacion/directos/13');
    let rv = await esperaClip(page, 13, true);
    g.ok('…que se abre también en modo repaso', rv.video && rv.ops.every((o) => o.off));
    await ant.click();
    await g.igual('«Anterior» vuelve al de antes', () => hashDe(page), '#formacion/directos/12');
    await esperaClip(page, 12, true);
    await page.keyboard.press('ArrowLeft');
    await g.igual('Flecha izquierda: otro más atrás', () => hashDe(page), '#formacion/directos/11');
    await esperaClip(page, 11, true);
    await cargar(page, BASE + '#formacion/directos/1');
    await esperaClip(page, 1, true);
    await g.cuenta('En el primero no hay «Anterior»', ant, 0);
    await cargar(page, BASE + '#formacion/directos/' + TOTAL);
    await esperaClip(page, TOTAL, true);
    await g.txt('En el último, el botón principal es «Ver el resumen»', sig, 'Ver el resumen');
    await g.cuenta('…sin «Volver» (sería lo mismo)', volver, 0);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.keyboard.press('Enter');
    await g.igual('Intro: al resumen', () => hashDe(page), '#formacion/directos');
    await g.igual('…que empieza arriba, con el anillo a la vista', () => page.evaluate(() => Math.round(window.scrollY)), 0);
    const todo = {}; D.forEach((d) => { todo[d.id] = respuesta(d, true); });
    await sembrar(page, Object.assign(estadoAntiguo(), { directos: todo }), BASE + '#formacion/directos');
    await g.txt(`Con los ${TOTAL} acertados`, page.locator('#d-tit'), `Las ${TOTAL} preguntas respondidas`);
    await g.cuenta('…no queda nada que repasar', v.locator('[data-accion="dir-fallos"]'), 0);
    await g.partes('…y lo dice', v.locator('section[aria-labelledby="d-tit"]'), [`Las ${TOTAL} acertadas.`]);
    g.ok('Con algo respondido ya no sale «Nuevo» en la pestaña', norm(await tabs(page).locator('a[href="#formacion/directos"]').textContent()) === 'Directos');
  });

  await g.seccion('Categorías plegables: lo pendiente, abierto; lo que el alumno cambia se recuerda; al completar una, se pliega', async () => {
    const [c1, nom1, n1] = REPARTO[0], [c2, nom2] = REPARTO[1], cU = REPARTO[REPARTO.length - 1][0];
    const hasta_ = (k) => { const o = {}; D.slice(0, k).forEach((d, i) => { o[d.id] = respuesta(d, i % 5 !== 3); }); return o; };
    const limpia = () => page.evaluate((k) => localStorage.removeItem(k), CLAVE_CATS);
    await sembrar(page, Object.assign(estadoAntiguo(), { directos: hasta_(5) }), BASE + '#formacion/directos'); await limpia();
    await cargar(page, BASE + '#formacion/directos'); await page.locator('#d-tit').waitFor();
    await g.igual(`Con 5 respondidos: abierta ${nom1} (ahí está el siguiente) y las demás cerradas`, () => abiertas(page), c1);
    await sembrar(page, Object.assign(estadoAntiguo(), { directos: hasta_(n1 + 2) }), BASE + '#formacion/directos');
    await page.locator('#d-tit').waitFor();
    await g.igual(`Con ${nom1} completa y dos de ${nom2}: abierta ${nom2} y ${nom1} plegada`, () => abiertas(page), c2);
    await g.partes(`…y la cabecera de ${nom1} sigue diciendo cómo va`, cabecera(page, c1), [nom1, `${n1} de ${n1} respondidas`, 'aciertos']);
    await g.txt('«Continuar» apunta al siguiente', v.getByRole('link', { name: /^Continuar/ }), `Continuar: pregunta ${num2(n1 + 3)}`);
    await g.cuenta('…y su tarjeta está a la vista', v.locator(`ul a[href="#formacion/directos/${n1 + 3}"]:visible`), 1);
    await cabecera(page, cU).click();
    await g.igual('El alumno abre la última categoría', () => abiertas(page), c2 + cU);
    await cabecera(page, c2).click();
    await g.igual('…y cierra la que estaba abierta por defecto', () => abiertas(page), cU);
    // el navegador avisa del plegado (evento «toggle») un instante después del clic: se espera a que quede apuntado antes de recargar
    await page.waitForFunction(({ k, c }) => { try { return JSON.parse(localStorage.getItem(k) || '{}')[c] === 2; } catch (e) { return false; } }, { k: CLAVE_CATS, c: c2 }, { timeout: 4000 }).catch(() => {});
    await cargar(page, BASE + '#formacion/directos'); await page.locator('#d-tit').waitFor();
    await g.igual('Al volver, todo sigue como lo dejó', () => abiertas(page), cU);
    const apunte = await apuntadas(page);
    g.ok('…porque está apuntado (2 = la cerró cuando ya era la del siguiente pendiente)', igualJSON(JSON.parse(apunte), { [cU]: 1, [c2]: 2 }), apunte);
    await v.getByRole('link', { name: /^Continuar/ }).click();
    await esperaClip(page, n1 + 3, false);
    await opcion(page, D[n1 + 2].correcta).click();
    await esperaClip(page, n1 + 3, true);
    await v.getByRole('link', { name: 'Volver', exact: true }).click();
    await page.locator('#d-tit').waitFor();
    // B1 de la revisión [DN]: la recién respondida ya está en el plegable de respondidas, al final; «Volver» lleva a la siguiente pendiente, no al fondo
    await g.cumple(`«Volver» tras responder, desde una categoría cerrada: la abre y deja a la vista y con el foco la siguiente pendiente (${num2(n1 + 4)}), con las respondidas plegadas`, () => page.evaluate((n) => { const a = document.querySelector(`#vista a.dir-card[href="#formacion/directos/${n}"]`), r = a.getBoundingClientRect(), h = a.closest('.dir-cuerpo').querySelector('.dir-hechas'); return { foco: document.activeElement === a, pend: a.classList.contains('pend'), alto: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight, hechasCerrado: !!h && !h.open }; }, n1 + 4), (m) => m.foco && m.pend && m.hechasCerrado && m.alto > 30 && m.top >= 0 && m.bottom <= m.h, 3000);
    await g.igual('…junto a la que el alumno tenía abierta', () => abiertas(page), c2 + cU);
    g.ok('…sin cambiar lo apuntado (no lo ha pedido el alumno)', (await apuntadas(page)) === apunte, String(await apuntadas(page)));
    await cargar(page, BASE + '#formacion/directos'); await page.locator('#d-tit').waitFor();
    await g.igual('…y al volver a entrar sigue cerrada, como la dejó', () => abiertas(page), cU);
    // completar una categoría que el alumno abrió a mano
    const casi = hasta_(n1); delete casi[D[n1 - 1].id];
    await sembrar(page, Object.assign(estadoAntiguo(), { directos: casi }), BASE + '#formacion/directos');
    await page.evaluate(({ k, x }) => localStorage.setItem(k, x), { k: CLAVE_CATS, x: JSON.stringify({ [c1]: 1, [cU]: 1 }) });
    await cargar(page, BASE + '#formacion/directos/' + n1);
    await esperaClip(page, n1, false);
    await opcion(page, D[n1 - 1].correcta).click();
    await esperaClip(page, n1, true);
    await g.igual(`Al responder el último clip de ${nom1}, su apunte se olvida (lo demás no)`, () => apuntadas(page), JSON.stringify({ [cU]: 1 }));
    await cargar(page, BASE + '#formacion/directos'); await page.locator('#d-tit').waitFor();
    await g.igual(`…y en la portada ${nom1} queda plegada y ${nom2}, que es la siguiente, abierta`, () => abiertas(page), c2 + cU);
    // B-4: una categoría cerrada a mano ANTES de ser la del siguiente pendiente se vuelve a abrir sola cuando pasa a serlo
    await sembrar(page, Object.assign(estadoAntiguo(), { directos: hasta_(n1 - 1) }), BASE + '#formacion/directos');
    await page.locator('#d-tit').waitFor();
    await cabecera(page, c2).click(); await cabecera(page, c2).click();
    await page.waitForFunction(({ k, c }) => { try { return JSON.parse(localStorage.getItem(k) || '{}')[c] === 0; } catch (e) { return false; } }, { k: CLAVE_CATS, c: c2 }, { timeout: 4000 }).catch(() => {});
    g.ok(`El alumno abre y cierra ${nom2} cuando todavía no le toca (se apunta 0)`, igualJSON(JSON.parse(await apuntadas(page) || '{}'), { [c2]: 0 }), String(await apuntadas(page)));
    await cargar(page, BASE + '#formacion/directos/' + n1); await esperaClip(page, n1, false);
    await opcion(page, D[n1 - 1].correcta).click(); await esperaClip(page, n1, true);
    await cargar(page, BASE + '#formacion/directos'); await page.locator('#d-tit').waitFor();
    await g.igual(`…al completar ${nom1}, ${nom2} pasa a ser la del siguiente pendiente y se abre sola`, () => abiertas(page), c2);
    await cabecera(page, c2).click();
    await page.waitForFunction(({ k, c }) => { try { return JSON.parse(localStorage.getItem(k) || '{}')[c] === 2; } catch (e) { return false; } }, { k: CLAVE_CATS, c: c2 }, { timeout: 4000 }).catch(() => {});
    await cargar(page, BASE + '#formacion/directos'); await page.locator('#d-tit').waitFor();
    await g.igual('…y si la cierra ahora, que ya le toca, se queda cerrada', () => abiertas(page), '');
    await limpia();
  });

  await g.seccion(`Ninguna de las ${TOTAL} preguntas enseña el título de su clip antes de responder (y todas enseñan su nombre)`, async () => {
    await sembrar(page, estadoAntiguo(), BASE + '#formacion/directos/1');
    await esperaClip(page, 1, false);
    const pedidas = red.clips.length, mal = [];
    for (let n = 1; n <= TOTAL; n++) {
      await page.evaluate((x) => { location.hash = '#formacion/directos/' + x; }, n);
      const st = await esperaClip(page, n, false);
      const f = await fugas(page, [D[n - 1]]);
      const medios = await page.locator('video, [poster], img[src*="clips"]').count();
      if (f.length || medios || st.videos || norm(st.q) !== norm(D[n - 1].pregunta) || st.nombre !== D[n - 1].nombre || st.total !== TOTAL || document_title_tiene(await page.title(), D[n - 1])) mal.push(`pregunta ${n}: ${f.join(', ') || (medios ? 'hay vídeo o imagen' : 'otra pregunta, otro nombre o título en la pestaña')}`);
    }
    g.ok(`En las ${TOTAL}: su nombre como título de la pantalla; ni el título del clip (ni en atributos), ni el id, ni la clave, ni la explicación, ni vídeo o imagen del clip (tampoco en el título de la pestaña)`, mal.length === 0, mal.slice(0, 4).join(' | '));
    g.ok('…y sin pedir nada de /clips/', red.clips.length === pedidas, red.clips.slice(pedidas, pedidas + 3).join(', '));
    await cargar(page, BASE + '#formacion/directos'); await page.locator('#d-tit').waitFor();
    for (const [c] of REPARTO) await cabecera(page, c).click();
    await g.igual('Portada sin empezar con las cuatro categorías abiertas a mano', () => abiertas(page), REPARTO.map((r) => r[0]).join(''));
    const f = await fugas(page, D);
    g.ok(`…tampoco ahí aparece ningún título de los ${TOTAL}`, f.length === 0, f.slice(0, 4).join(', '));
    await page.evaluate((k) => localStorage.removeItem(k), CLAVE_CATS);
  });
  cierre(g);
}
const document_title_tiene = (t, d) => norm(t).includes(norm(d.titulo));

/* =====================================================================================================
 * GRUPO 4 · Servidor simulado: alumno real, PUT /api/datos, lecciones bloqueadas, administrador
 * ===================================================================================================== */
async function gServidor(g, env) {
  const D = env.D;
  const original = datosLucia();
  const s = crearServidor(env, { datos: { status: 200, body: { datos: datosLucia() } } });
  const { page, red } = await contexto(g, env, { nombre: 'servidor', servidor: s, tolera: TOLERA_API });
  const v = page.locator('#vista');

  await g.seccion('Alumno con sesión y datos antiguos (sin «directos»)', async () => {
    await page.goto(URL_SRV + '#formacion');
    await g.txt('Entra en Formación', h1(page), 'Formación AGX');
    await g.cumple('Su ruta tiene lecciones bloqueadas', () => v.locator('[aria-disabled="true"]').count(), (n) => n > 20);
    await g.txt('La pestaña «Directos» con «Nuevo»', tabs(page).locator('a[href="#formacion/directos"]'), 'DirectosNuevo');
    await tabs(page).locator('a[href="#formacion/directos"]').click();
    await g.igual('URL', () => hashDe(page), '#formacion/directos');
    await g.txt('Portada a cero', page.locator('#d-tit'), `${TOTAL} preguntas de los directos de Alex`);
    await g.cuenta(`Las ${TOTAL} preguntas están abiertas (son enlaces), aunque tenga lecciones bloqueadas`, v.locator('ul a[href^="#formacion/directos/"]'), TOTAL);
    await g.cuenta('…y ninguno aparece bloqueado', v.locator('[aria-disabled="true"]'), 0);
    await cabecera(page, REPARTO[1][0]).click();
    await g.igual('Abre una categoría', () => abiertas(page), REPARTO[1][0]);
    await cabecera(page, REPARTO[1][0]).click();
    await g.igual('…y la cierra', () => abiertas(page), '');
    await pausa(1100);
    g.ok('Entrar, abrir y cerrar categorías no envía nada al servidor', s.reg.put.length === 0, `PUT: ${s.reg.put.length}`);
    await page.evaluate((k) => localStorage.removeItem(k), CLAVE_CATS);
  });

  let put1 = null;
  await g.seccion('Responder guarda con PUT /api/datos', async () => {
    await page.goto(URL_SRV + '#formacion/directos/30');
    await esperaClip(page, 30, false);
    g.ok('Sin responder no se pide nada de /clips/ al servidor', red.clips.length === 0, red.clips.join(', '));
    await opcion(page, otra(D[29])).click();
    await esperaClip(page, 30, true);
    const r = await s.esperaPut((b) => b.directos && Object.keys(b.directos).length === 1);
    g.ok('Tras responder se envía el estado a PUT /api/datos', r.ok, `PUT recibidos: ${s.reg.put.length}`);
    if (!r.ok) return;
    put1 = r.v;
    g.ok('…con la clave nueva y la forma { o, ok, f }', igualJSON(put1.directos, { [D[29].id]: { o: otra(D[29]), ok: false, f: HOY } }), JSON.stringify(put1.directos));
    const resto = Object.assign({}, put1); delete resto.directos;
    g.ok('…y el resto del estado idéntico al que tenía (operaciones, plan, ruta, temas…)', igualJSON(resto, original), 'claves: ' + Object.keys(resto).sort().join(',') + ' / ' + Object.keys(original).sort().join(','));
    g.ok('…sin claves de más', igualJSON(Object.keys(put1).sort(), Object.keys(original).concat('directos').sort()), Object.keys(put1).sort().join(','));
    await g.cumple('La portada del clip se pide al propio servidor', () => red.clips.slice(), (c) => c.includes(`/clips/${D[29].id}.jpg`), 4000);
    await pausa(500);
    g.ok('…y el vídeo no, hasta darle a reproducir', !red.clips.some((c) => /\.mp4$/.test(c)), red.clips.join(', '));
    await page.locator('[data-accion="dir-sig"]').click();
    await esperaClip(page, 31, false);
    await page.keyboard.press('abcd'[D[30].correcta]);
    await esperaClip(page, 31, true);
    const r2 = await s.esperaPut((b) => b.directos && Object.keys(b.directos).length === 2);
    g.ok('La segunda respuesta también se envía', r2.ok && igualJSON(r2.v.directos[D[30].id], { o: D[30].correcta, ok: true, f: HOY }), JSON.stringify(r2.v && r2.v.directos));
    const resto2 = Object.assign({}, r2.v || {}); delete resto2.directos;
    g.ok('…y el resto sigue idéntico', igualJSON(resto2, original));
    g.ok('Ninguna petición a rutas que no existen', s.reg.otras.length === 0, s.reg.otras.join(', '));
  });

  await g.seccion('Al volver a entrar, el progreso viene del servidor', async () => {
    await cargar(page, URL_SRV + '#formacion/directos');
    await g.txt('Portada', page.locator('#d-tit'), `Te quedan ${TOTAL - 2} preguntas por responder`);
    await g.cuenta('Anillo', v.getByRole('img', { name: `2 de ${TOTAL} preguntas respondidas: 1 acierto y 1 fallo` }), 1);
    await g.txt('Tarjeta del fallado', v.locator('a[href="#formacion/directos/30"]'), `Pregunta 30 · ${env.CATS[D[29].cat].nombre}Fallada${D[29].nombre}${D[29].titulo}`);
    await g.igual('Abierta, la categoría de la siguiente pregunta sin responder', () => abiertas(page), REPARTO[0][0]);
    await g.txt('«Continuar» a la primera sin responder', v.getByRole('link', { name: /^Continuar/ }), 'Continuar: pregunta 01');
    await page.locator('a[data-ruta="formacion"]').click();
    await g.cumple('La ruta por niveles sigue con sus bloqueos', () => v.locator('[aria-disabled="true"]').count(), (n) => n > 20);
    await g.partes('…y su acceso a los directos con el progreso', page.locator('#vista > a[href="#formacion/directos"]'), ['Tests de los directos', `2 de ${TOTAL}`]);
  });

  await g.seccion(`Con las ${TOTAL} preguntas respondidas, lo que se envía sigue siendo pequeño`, async () => {
    const casi = {}; D.forEach((d, i) => { if (i !== 6) casi[d.id] = respuesta(d, i % 4 !== 1); });
    s.datos = { status: 200, body: { datos: Object.assign(datosLucia(), { directos: casi }) } }; s.reg.put.length = 0;
    await cargar(page, URL_SRV + '#formacion/directos/7');
    await esperaClip(page, 7, false);
    await opcion(page, D[6].correcta).click();
    await esperaClip(page, 7, true);
    const r = await s.esperaPut((b) => b.directos && Object.keys(b.directos).length === TOTAL);
    if (!g.ok(`Al responder el que faltaba se envían las ${TOTAL} respuestas`, r.ok, `PUT recibidos: ${s.reg.put.length}`)) return;
    const bDir = Buffer.byteLength(JSON.stringify(r.v.directos)), bTodo = Buffer.byteLength(JSON.stringify({ datos: r.v })), bResto = bTodo - bDir;
    g.p(`  · PUT /api/datos con los ${TOTAL} clips: ${bTodo} bytes (${bDir} de «directos», ${bResto} del resto del estado de la alumna)`);
    g.ok(`…y «directos» ocupa poco: menos de 110 bytes por clip (${bDir} bytes en total)`, bDir <= TOTAL * 110, `${bDir} bytes`);
    g.ok('…cada respuesta guarda solo { o, ok, f }', Object.values(r.v.directos).every((x) => igualJSON(Object.keys(x).sort(), ['f', 'o', 'ok'])));
    g.ok('…muy por debajo de los 64 KiB que el navegador deja enviar en el guardado de salida', bTodo < 65536 / 4, `${bTodo} bytes`);
    s.datos = { status: 200, body: { datos: datosLucia() } }; s.reg.put.length = 0;
  });

  await g.seccion('Alumno nuevo (sin datos) y datos con «directos» estropeado', async () => {
    s.datos = { status: 200, body: { datos: null } }; s.reg.put.length = 0;
    await cargar(page, URL_SRV + '#formacion/directos/1');
    await esperaClip(page, 1, false);
    await opcion(page, D[0].correcta).click();
    await esperaClip(page, 1, true);
    const r = await s.esperaPut((b) => b.directos && b.directos[D[0].id]);
    g.ok('Un alumno sin datos guardados responde y se guarda', r.ok && igualJSON(r.v.directos, { [D[0].id]: { o: D[0].correcta, ok: true, f: HOY } }) && Array.isArray(r.v.trades) && r.v.trades.length === 0, JSON.stringify(r.v).slice(0, 200));
    s.datos = { status: 200, body: { datos: Object.assign(datosLucia(), { directos: null }) } };
    await cargar(page, URL_SRV + '#formacion/directos');
    await g.txt('Con directos = null en el servidor, portada a cero y sin errores', page.locator('#d-tit'), `${TOTAL} preguntas de los directos de Alex`);
  });

  await g.seccion('Administrador: ve el progreso del alumno y no lo cambia', async () => {
    const lucia = Object.assign(datosLucia(), { directos: { [D[0].id]: respuesta(D[0], true), [D[1].id]: respuesta(D[1], true), [D[12].id]: respuesta(D[12], false) } });
    const diego = datosLucia(); diego.trades = [opSrv('d1', 27, 15, 45, 'NQ', 'L', 1, 500, 'Patrón Gonzi', 'Nota d1', 'Vista.')];
    s.yo = { status: 200, body: { sesion: true, id: '999', nombre: 'Alex García', avatar: null, acceso: true, admin: true } };
    s.datos = { status: 200, body: { datos: null } };
    s.alumnos = { status: 200, body: { alumnos: [{ id: '111', nombre: 'Lucía Ferrer', avatar: null, ultimaVez: '2026-10-30T15:00:00.000Z', datos: lucia, ultimoInforme: null }, { id: '222', nombre: 'Diego Ramírez', avatar: null, ultimaVez: '2026-10-28T10:00:00.000Z', datos: diego, ultimoInforme: null }] } };
    s.reg.put.length = 0;
    await cargar(page, URL_SRV + '#alumnos');
    await g.partes('La tarjeta de Lucía enseña su progreso en los directos', v.locator('a[href="#alumnos/111"]'), ['Lucía Ferrer', 'Tests de los directos', `3 de ${TOTAL}`, '2 aciertos']);
    await g.cumple('La de quien no ha empezado no dice nada de los directos', async () => norm(await v.locator('a[href="#alumnos/222"]').textContent()), (t) => t.includes('Diego Ramírez') && !/directos/i.test(t));
    await v.locator('a[href="#alumnos/111"]').click();
    await g.txt('Diario de la alumna', h1(page), 'Diario de Lucía Ferrer');
    await g.partes('…con su progreso en los directos', v, ['Tests de los directos:', `3 de ${TOTAL}`, 'preguntas respondidas', '2 aciertos y 1 fallo']);
    await g.cuenta('Mirando a un alumno no hay nada que responder de los directos', v.locator('[data-accion^="dir-"]'), 0);
    for (const k of ['a', '1', 'Enter']) await page.keyboard.press(k);
    await page.goto(URL_SRV + '#alumnos/222');
    await g.txt('Diario de otro alumno', h1(page), 'Diario de Diego Ramírez');
    await g.partes('…que no ha empezado', v, ['Tests de los directos:', 'sin empezar']);
    await pausa(1200);
    g.ok('Revisando alumnos no se guarda nada en /api/datos', s.reg.put.length === 0, `PUT: ${s.reg.put.length}`);
    await page.goto(URL_SRV + '#formacion/directos');
    await g.txt('Los directos del administrador son los suyos, no los del alumno', page.locator('#d-tit'), `${TOTAL} preguntas de los directos de Alex`);
    await page.goto(URL_SRV + '#formacion/directos/13');
    const st = await esperaClip(page, 13, false);
    g.ok('…el clip que la alumna falló está sin responder para él', st.videos === 0 && st.ops.every((o) => !o.off));
    await opcion(page, D[12].correcta).click();
    await esperaClip(page, 13, true);
    const r = await s.esperaPut((b) => b.directos && b.directos[D[12].id]);
    g.ok('Lo que responde el administrador se guarda en SUS datos', r.ok && Object.keys(r.v.directos).length === 1 && r.v.trades.length === 0, JSON.stringify(r.v).slice(0, 200));
    await page.goto(URL_SRV + '#alumnos/111');
    await g.partes('…y la alumna sigue como estaba', v, ['Tests de los directos:', `3 de ${TOTAL}`, '2 aciertos y 1 fallo']);
    g.ok('Ninguna petición a rutas que no existen', s.reg.otras.length === 0, s.reg.otras.join(', '));
  });
  cierre(g);
}

/* =====================================================================================================
 * GRUPO 5 · Tamaños (360, 390, 820, 1440) y temas (claro y oscuro): desbordamiento, zonas táctiles, foco, movimiento reducido
 * ===================================================================================================== */
async function gTamanos(g, env) {
  const D = env.D;
  const sembrados = [0, 1, 2, 3, 12, 13, 29, 38];
  const dir = {}; sembrados.forEach((i, k) => { dir[D[i].id] = respuesta(D[i], k % 3 !== 1); });
  const largo = D.map((d, i) => [d.pregunta.length + d.opciones.join('').length, i]).filter((x) => !sembrados.includes(x[1])).sort((a, b) => b[0] - a[0])[0][1] + 1; // la pregunta sin responder con más texto
  const nomLargo = D.map((d, i) => [d.nombre.length, i]).filter((x) => !sembrados.includes(x[1])).sort((a, b) => b[0] - a[0])[0][1] + 1; // la pregunta sin responder con el nombre más largo
  const sinClipNN = async (page) => !/\bClips? \d/.test(norm(await page.locator('#vista').innerText()));
  const TAM = [[360, 740, true], [390, 844, true], [820, 1180, true], [1440, 900, false]];
  for (const [w, h, movil] of TAM) for (const oscuro of [false, true]) {
    const et = `${w}px ${oscuro ? 'oscuro' : 'claro'}`;
    await g.seccion(et, async () => {
      const { ctx, page } = await contexto(g, env, { nombre: et, viewport: { width: w, height: h }, dpr: movil ? 2 : 1, movil, oscuro, modo: oscuro ? 'oscuro' : 'claro' });
      const v = page.locator('#vista');
      await page.goto(BASE + '#formacion');
      await g.igual(`${et} · tema aplicado`, () => page.evaluate(() => document.documentElement.dataset.modo || 'claro'), oscuro ? 'oscuro' : 'claro');
      await sinDesborde(g, page, w, `${et} · ruta con el acceso a los directos`);
      const tb = await hasta(() => tabs(page).evaluate((n) => ({ sw: n.scrollWidth, cw: n.clientWidth, hs: Array.from(n.querySelectorAll('a')).map((a) => Math.round(a.getBoundingClientRect().height)), fuera: Array.from(n.querySelectorAll('a')).filter((a) => { const b = a.getBoundingClientRect(); return b.left < -0.5 || b.right > innerWidth + 0.5; }).length })), (m) => m.sw <= m.cw + 1 && m.fuera === 0, 2500, 120);
      g.ok(`${et} · las tres pestañas caben sin desplazar la fila`, tb.ok, JSON.stringify(tb.v));
      if (movil) g.ok(`${et} · …y miden 44 px o más`, tb.v && tb.v.hs.every((x) => x >= 44), JSON.stringify(tb.v && tb.v.hs));
      if (movil) await tactiles(g, page, `${et} · ruta`);
      await sembrar(page, Object.assign(estadoAntiguo(), { directos: dir }), BASE + '#formacion/directos');
      await page.locator('#d-tit').waitFor();
      await sinDesborde(g, page, w, `${et} · portada con progreso`);
      if (movil) await tactiles(g, page, `${et} · portada`);
      g.ok(`${et} · en la portada no queda «Clip NN» como unidad`, await sinClipNN(page));
      // las cuatro categorías y sus plegables de respondidas abiertos: los 90 nombres a la vista, también los más largos
      await page.evaluate(() => document.querySelectorAll('#vista details').forEach((d) => { d.dataset.ab = '1'; d.open = true; }));
      await sinDesborde(g, page, w, `${et} · portada con las ${TOTAL} tarjetas a la vista (los nombres más largos)`);
      const cortados = await page.evaluate(() => Array.from(document.querySelectorAll('#vista ul a[href^="#formacion/directos/"]')).map((a) => { const b = a.querySelector('b'), c = getComputedStyle(b), lh = parseFloat(c.lineHeight) || 20; return { n: a.getAttribute('href').split('/').pop(), lineas: Math.round(b.getBoundingClientRect().height / lh), corta: b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1 || c.textOverflow === 'ellipsis', ah: a.getBoundingClientRect().height }; }).filter((x) => x.corta || x.lineas > (innerWidth <= 380 ? 3 : 2) || x.ah < 44));
      g.ok(`${et} · ningún nombre de pregunta se corta ni pasa de dos líneas${w <= 380 ? ' (tres a 360 px)' : ''}, y cada tarjeta mide 44 px o más`, cortados.length === 0, JSON.stringify(cortados.slice(0, 4)));
      if (movil) await tactiles(g, page, `${et} · portada con todo abierto`);
      await page.goto(BASE + '#formacion/directos/' + nomLargo);
      await esperaClip(page, nomLargo, false);
      await sinDesborde(g, page, w, `${et} · test de la pregunta con el nombre más largo (${nomLargo})`);
      const op = await page.evaluate(() => { const o = document.querySelector('#vista [data-accion="dir-opcion"]').getBoundingClientRect(); return { top: Math.round(o.top), h: innerHeight }; });
      g.ok(`${et} · …y su nombre no empuja la primera opción fuera de la primera pantalla`, op.top < op.h - 60, JSON.stringify(op));
      g.ok(`${et} · en el test no queda «Clip NN» como unidad`, await sinClipNN(page));
      const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      g.ok(`${et} · el fondo es el del tema`, oscuro ? /rgb\(10, 6, 28\)/.test(fondo) : /rgb\(243, 240, 250\)/.test(fondo), fondo);
      await page.goto(BASE + '#formacion/directos/' + largo);
      await esperaClip(page, largo, false);
      await sinDesborde(g, page, w, `${et} · test sin responder (el clip con más texto)`);
      if (movil) await tactiles(g, page, `${et} · test sin responder`);
      await page.keyboard.press('Tab');
      const foco = await hasta(() => page.evaluate(() => { for (let i = 0; i < 12; i++) { const a = document.activeElement; if (a && a.dataset && a.dataset.accion === 'dir-opcion') { const c = getComputedStyle(a); return { ok: true, w: parseFloat(c.outlineWidth), st: c.outlineStyle }; } } return { ok: false }; }), (m) => m.ok, 300, 50);
      if (!foco.ok) { await opcion(page, 0).focus(); }
      const an = await opcion(page, 0).evaluate((e) => { e.focus(); const c = getComputedStyle(e); return { w: parseFloat(c.outlineWidth), st: c.outlineStyle, foco: e.matches(':focus-visible') }; });
      g.ok(`${et} · una opción con el foco del teclado lo enseña`, an.foco && an.w >= 2 && an.st !== 'none', JSON.stringify(an));
      await opcion(page, otra(D[largo - 1])).click();
      await esperaClip(page, largo, true);
      // antes de medir el desbordamiento (que mueve la página y cortaría el desplazamiento suave)
      await g.cumple(`${et} · tras responder, el veredicto queda a la vista`, () => page.evaluate(() => { const a = document.getElementById('d-ver').getBoundingClientRect(); return { t: Math.round(a.top), h: innerHeight }; }), (x) => x.t >= 0 && x.t < x.h - 60, 4000);
      if (w <= 1060) await g.cumple(`${et} · …y el clip entero también, sin tener que buscarlo`, () => page.evaluate(() => { const a = document.getElementById('d-ver').getBoundingClientRect(), b = document.getElementById('dir-video').getBoundingClientRect(), nav = document.querySelector('.nav'), tapa = nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().top : innerHeight; return { ver: Math.round(a.top), fin: Math.round(b.bottom), tope: Math.round(tapa), cabe: b.bottom - a.top <= tapa - 12 }; }), (x) => !x.cabe || (x.ver >= 0 && x.fin <= x.tope + 1), 4000);
      await sinDesborde(g, page, w, `${et} · test fallado, con explicación y clip`);
      if (movil) await tactiles(g, page, `${et} · test respondido`);
      const m = await page.locator('#dir-video').evaluate((e) => { const b = e.getBoundingClientRect(), p = e.closest('section').getBoundingClientRect(); return { w: b.width, h: b.height, x: b.left, pw: p.width, px: p.left }; });
      g.ok(`${et} · el vídeo guarda la proporción 16:9`, Math.abs(m.w / m.h - 16 / 9) < 0.03, JSON.stringify(m));
      if (w <= 640) g.ok(`${et} · …y va a todo el ancho de su placa`, m.w >= m.pw - 3 && m.w >= w - 36, JSON.stringify(m));
      else g.ok(`${et} · …y es grande (≥ 480 px de ancho)`, m.w >= 480, JSON.stringify(m));
      await page.goto(BASE + '#formacion/directos/1');
      await esperaClip(page, 1, true);
      await sinDesborde(g, page, w, `${et} · clip acertado en modo repaso`);
      await ctx.close();
    });
  }
  await g.seccion('Movimiento reducido', async () => {
    const { ctx, page } = await contexto(g, env, { nombre: 'reducido', viewport: { width: 390, height: 844 }, dpr: 2, movil: true, reducir: true });
    await page.goto(BASE + '#formacion/directos/5');
    await esperaClip(page, 5, false);
    await opcion(page, D[4].correcta).click();
    const st = await esperaClip(page, 5, true);
    g.ok('Con movimiento reducido se responde igual', norm(st.ver) === 'Correcto' && st.video);
    const dd = await page.evaluate(() => Array.from(document.querySelectorAll('#vista *')).map((e) => getComputedStyle(e)).reduce((mx, c) => Math.max(mx, ...String(c.animationDuration).split(',').map((x) => parseFloat(x) * (/ms$/.test(x.trim()) ? 1 : 1000)), ...String(c.transitionDuration).split(',').map((x) => parseFloat(x) * (/ms$/.test(x.trim()) ? 1 : 1000))), 0));
    g.ok('…y ninguna animación ni transición dura más de 0,01 ms', dd <= 0.011, `máximo ${dd} ms`);
    const y0 = await page.evaluate(() => { document.querySelector('[data-accion="dir-sig"]').scrollIntoView({ block: 'end' }); return Math.round(window.scrollY); });
    g.ok('(en el móvil, «Siguiente pregunta» queda más abajo: la página está desplazada)', y0 > 100, `scrollY ${y0}`);
    await page.locator('[data-accion="dir-sig"]').click();
    await esperaClip(page, 6, false);
    await g.igual('«Siguiente pregunta» en el móvil: la nueva empieza arriba', () => page.evaluate(() => Math.round(window.scrollY)), 0);
    await ctx.close();
  });
  cierre(g);
}

/* ============================== servidor HTTP de verdad (dos dispositivos, guardado de salida) ==============================
   La interceptación de Playwright no ve el guardado de salida (un fetch con keepalive mientras la página se va), así que lo que depende de él se
   prueba con un servidor HTTP en 127.0.0.1 y un navegador que resuelve TODOS los hosts a 127.0.0.1 (nada sale de la máquina): la web se abre en
   http://demo-agx.netlify.app:<puerto>/ y cree que está en el servidor. Sin rutas interceptadas: las fuentes de Google fallan y no pasa nada. */
const ARGS_REAL = ['--no-proxy-server', '--host-resolver-rules=MAP * 127.0.0.1'];
const SEMILLA = () => { let a = 0x9e3779b9; Math.random = function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
async function servidorReal(html, ini = {}) {
  const s = Object.assign({
    yo: { sesion: true, id: '111', nombre: 'Lucía Ferrer', avatar: null, acceso: true, admin: false },
    datos: null, alumnos: [], html, publicada: null,
    get: null,       // cómo responde GET /api/datos: null = normal · { retardo } · { status, crudo } · { cortar } · { colgar }; con { veces: n } solo las n primeras
    retardoPut: 0,   // ms que tarda el servidor en dar por recibido un PUT (si el navegador corta antes, no se guarda: «PUT cortado»)
  }, ini);
  s.log = []; s.otras = []; s.capturas = {}; const colgadas = [];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), p = u.pathname, m = req.method;
    const json = (st, b) => { res.writeHead(st, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(typeof b === 'string' ? b : JSON.stringify(b)); };
    const pagina = (t) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(t); };
    const archivo = (tipo) => { const f = path.join(REPO, decodeURIComponent(p)); if (!f.startsWith(REPO) || !fs.existsSync(f)) return json(404, { error: 'no_existe' }); res.writeHead(200, { 'Content-Type': tipo }); fs.createReadStream(f).pipe(res); };
    if (p === '/' || p === '/index.html') return pagina(s.html);
    if (p === '/publicada.html' && s.publicada) return pagina(s.publicada);
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (/^\/clips\/[^/]+\.jpg$/.test(p)) return archivo('image/jpeg');
    if (/^\/iconos\/[^/]+\.png$/.test(p)) return archivo('image/png');
    if (p === '/manifest.webmanifest') return archivo('application/manifest+json');
    if (!p.startsWith('/api/')) return json(404, { error: 'no_existe' });
    if (p === '/api/datos' && m === 'GET') {
      s.log.push({ m, p });
      const r = s.get; if (r && r.veces != null && --r.veces <= 0) s.get = null;
      if (!r) return json(200, { datos: s.datos });
      if (r.cortar) return req.socket.destroy();
      if (r.colgar) { colgadas.push(res); return; }
      const manda = () => json(r.status || 200, r.crudo !== undefined ? r.crudo : { datos: s.datos });
      return r.retardo ? setTimeout(manda, r.retardo) : manda();
    }
    if (p === '/api/datos' && m === 'PUT') {
      const c = []; let cortado = false; res.on('close', () => { if (!res.writableEnded) cortado = true; });
      req.on('data', (d) => c.push(d));
      req.on('end', () => setTimeout(() => {
        const txt = Buffer.concat(c).toString('utf8'); let b = null; try { b = JSON.parse(txt); } catch (e) { /* cuerpo no válido */ }
        if (cortado) { s.log.push({ m, p, cortado: true, bytes: txt.length }); return; }
        s.log.push({ m, p, cuerpo: b, bytes: txt.length });
        if (b) s.datos = b;
        json(200, { ok: true, guardado: '2026-10-30T15:30:00.000Z' });
      }, s.retardoPut));
      return;
    }
    if (p === '/api/captura') { // la captura de ATAS de una operación: texto (data:image/…)
      const idc = u.searchParams.get('id');
      if (m === 'GET') { s.log.push({ m, p: p + u.search }); return s.capturas[idc] ? (res.writeHead(200, { 'Content-Type': 'text/plain' }), res.end(s.capturas[idc])) : json(404, { error: 'no_existe' }); }
      const c = []; req.on('data', (d) => c.push(d));
      req.on('end', () => { const txt = Buffer.concat(c).toString('utf8'); s.log.push({ m, p: p + u.search.replace(/id=t\d{12,14}/, 'id=t#'), cuerpo: m === 'PUT' ? { bytes: txt.length, ini: txt.slice(0, 22) } : null }); if (m === 'PUT') s.capturas[idc] = txt; else delete s.capturas[idc]; json(200, { ok: true }); });
      return;
    }
    s.log.push({ m, p: p + u.search });
    if (p === '/api/yo') return json(200, s.yo);
    if (p === '/api/ranking') return json(200, { actualizado: null, mes: [], historico: [], recientes: [], campeones: [] });
    if (p === '/api/analisis' && m === 'GET') return json(200, { informes: [], ia: true, restantes: 3 });
    if (p === '/api/admin/captura') return json(404, { error: 'no_existe' });
    if (p === '/api/admin/alumnos') return json(200, { alumnos: s.alumnos });
    if (p === '/api/admin/informes') return json(200, { informes: [], ia: true });
    if (p === '/api/auth/salir') return pagina('<!doctype html><meta charset="utf-8"><title>Fuera</title><p id="fuera">Sesión cerrada</p>');
    s.otras.push(m + ' ' + p);
    return json(404, { error: 'no_encontrado' });
  });
  await new Promise((ok, mal) => { srv.once('error', mal); srv.listen(0, '127.0.0.1', ok); });
  s.url = `http://${HOST_SRV}:${srv.address().port}/`;
  s.puts = () => s.log.filter((e) => e.m === 'PUT' && e.p === '/api/datos' && e.cuerpo);
  s.orden = (desde = 0) => s.log.slice(desde).map((e) => e.m + ' ' + e.p + (e.cortado ? ' (cortado)' : ''));
  s.espera = (pred, ms = 6000) => hasta(() => { try { return !!pred(s.datos || {}); } catch (e) { return false; } }, (v) => v === true, ms, 40);
  s.cerrar = () => { colgadas.forEach((r) => { try { r.destroy(); } catch (e) { /* ya cerrada */ } }); if (srv.closeAllConnections) srv.closeAllConnections(); return new Promise((r) => srv.close(() => r())); };
  return s;
}
async function contextoReal(g, nav, o = {}) {
  const ctx = await nav.newContext({ viewport: o.movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: !!o.movil, hasTouch: !!o.movil, locale: 'es-ES', timezoneId: 'Europe/Madrid', reducedMotion: 'reduce', serviceWorkers: 'block' });
  g.contextos.push(ctx);
  if (o.semilla) await ctx.addInitScript(SEMILLA);
  await ctx.clock.install({ time: AHORA });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  const quien = o.nombre || 'página', tolera = o.tolera || [];
  page.on('pageerror', (e) => { if (/Transition was skipped/.test(e.message)) { g.conocidos++; return; } g.errores.push(`[${quien}] error de página: ${linea1(e)}`); });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const donde = (m.location() && m.location().url) || '', t = m.text();
    if (/fonts\.(googleapis|gstatic)\.com/.test(donde + ' ' + t) || TOLERA_CAPTURA.test(donde) || tolera.some((re) => re.test(donde + ' ' + t))) return;
    g.errores.push(`[${quien}] consola: ${t} (${donde})`);
  });
  return { ctx, page };
}
const TOLERA_DATOS = [/\/api\/datos/];
const TOLERA_CAPTURA = /\/api\/(admin\/)?captura\?/; // una operación sin captura guardada responde 404, como en producción
const sinDirectos = (b) => { const c = Object.assign({}, b); delete c.directos; return c; };
const etiqueta = (page, sel) => page.locator(sel).locator('xpath=ancestor::label[1]');
const radio = (page, n, val) => etiqueta(page, `#form-op input[name="${n}"][value="${val}"]`);
function png(w, h) { // una «captura de ATAS» de mentira, generada aquí
  const tabla = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; tabla[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = tabla[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const trozo = (tipo, datos) => { const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const td = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const cab = Buffer.alloc(13); cab.writeUInt32BE(w, 0); cab.writeUInt32BE(h, 4); cab[8] = 8; cab[9] = 2;
  const crudo = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3, c = y > 8 + (x % 16) && y < h - 8 ? ((x >> 3) % 2 ? [38, 166, 154] : [239, 83, 80]) : [20, 21, 27]; crudo[o] = c[0]; crudo[o + 1] = c[1]; crudo[o + 2] = c[2]; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', cab), trozo('IDAT', zlib.deflateSync(crudo)), trozo('IEND', Buffer.alloc(0))]);
}
const PNG = { name: 'captura-atas.png', mimeType: 'image/png', buffer: png(320, 180) };
async function irA(page, hash) { await page.evaluate((h) => { location.hash = h; }, hash); }
async function responde(page, n, o) { await irA(page, '#formacion/directos/' + n); await esperaClip(page, n, false); await opcion(page, o).click(); await esperaClip(page, n, true); }
async function nuevaOperacion(page, nota) { // una operación apuntada a mano en el Diario, con el formulario de siempre
  await irA(page, '#diario'); await page.locator('#hero-neto').waitFor();
  await page.getByRole('button', { name: 'Nueva operación' }).first().click(); await page.locator('#cajon').waitFor();
  await page.locator('#f-fecha').fill('2026-10-29'); await radio(page, 'f-sesion', 'Londres').click(); await page.locator('#f-hora').fill('10:05');
  await radio(page, 'f-inst', 'MNQ').click(); await radio(page, 'f-dir', 'C').click(); await page.locator('#f-ct').fill('3'); await radio(page, 'f-setup', 'Divergencia').click();
  await page.locator('#f-stop').fill('10'); await radio(page, 'f-res', 'P').click(); await page.locator('#f-imp').fill('100'); await page.locator('#f-nota').fill(nota);
  await page.locator('#f-cap').setInputFiles(PNG); await page.getByAltText('Vista previa de la captura de ATAS').waitFor();
  await page.locator('#btn-guardar-op').click(); await page.locator('#cajon').waitFor({ state: 'hidden' });
}
async function cambiaObjetivo(page, v) {
  await irA(page, '#diario'); await page.locator('#hero-neto').waitFor();
  await page.locator('#hero-chips [data-accion="editar-obj"]').click(); await page.locator('#obj-in').fill(String(v)); await page.keyboard.press('Enter');
}
/* Un diario grande: el estado pasa de 64 KiB, que es lo máximo que el navegador deja enviar en el guardado de salida */
function datosGrande() {
  const d = datosLucia();
  for (let i = 0; i < 420; i++) d.trades.push(opSrv('g' + i, String(1 + (i % 27)).padStart(2, '0'), 15, 30 + (i % 25), 'NQ', i % 2 ? 'L' : 'C', 1, (i % 7) * 40 - 100, 'Imbalance', 'Operación de relleno número ' + i + ' con una nota de tamaño normal sobre la entrada y la gestión.', ''));
  return d;
}

/* =====================================================================================================
 * GRUPO 6 · Guardado de salida y administrador (servidor HTTP de verdad)
 *   Responder un clip guarda como todo lo demás de la web (guardar → PUT /api/datos aplazado 700 ms, y el guardado de salida si el alumno se va antes).
 *   La unión con el estado del servidor que hubo en una versión intermedia se retiró: la revisión demostró que podía perder datos del diario.
 * ===================================================================================================== */
async function gDosDispositivos(g, env) {
  const D = env.D, id = (n) => D[n - 1].id;
  const nav = await chromium.launch({ args: ARGS_REAL });
  const s = await servidorReal(env.html, { publicada: env.htmlMain });
  const abre = async (o, ruta) => { const c = await contextoReal(g, nav, Object.assign({ tolera: TOLERA_DATOS }, o)); await c.page.goto(s.url + ruta); return c; };
  const hayToastDeError = (page) => page.evaluate(() => { const t = document.getElementById('toast'); return !!t && !t.hidden && getComputedStyle(t).display !== 'none' && /No se ha podido guardar|sesión ha caducado/.test(t.textContent); });
  try {
    const original = datosLucia();

    await g.seccion('Salir nada más responder', async () => {
      const caso = async (nombre, prepara, salir, comprueba) => {
        s.datos = datosLucia(); s.get = null; s.retardoPut = 0;
        const { ctx, page } = await abre({ movil: true, nombre }, '#formacion/directos/5');
        await esperaClip(page, 5, false);
        const n0 = s.log.length;
        if (prepara) await prepara();
        await opcion(page, D[4].correcta).click();
        await salir(page);
        const r = await s.espera((d) => igualJSON((d.directos || {})[id(5)], { o: D[4].correcta, ok: true, f: HOY }), 6000);
        g.ok(`${nombre}: la respuesta llega al servidor`, r.ok, s.orden(n0).join(', '));
        g.ok('…con el resto del estado intacto', igualJSON(sinDirectos(s.datos), original));
        if (comprueba) await comprueba(page, n0);
        s.get = null; s.retardoPut = 0;
        await ctx.close().catch(() => {});
      };
      const lento = () => { s.get = { retardo: 1500, veces: 1 }; }; // el servidor tarda en dejar leer: la salida ocurre antes de que conteste
      await caso('Responder e irse a otra página al instante (el servidor aún no ha contestado)', lento, (p) => p.goto('about:blank'));
      await caso('Responder y recargar al instante', lento, (p) => p.reload(), async (page) => { const st = await esperaClip(page, 5, true); g.ok('…y al recargar el clip sale respondido', st.video && norm(st.ver) === 'Correcto'); });
      await caso('Responder y cerrar la pestaña al instante', lento, (p) => p.close());
      await caso('Responder e irse a los 350 ms (antes de que salga la subida aplazada)', () => { s.retardoPut = 1500; }, async (p) => { await hasta(() => s.orden().length, () => false, 350); await p.goto('about:blank'); });
    });

    await g.seccion('Administrador: lo suyo va a lo suyo y mirando a un alumno no se escribe nada', async () => {
      const lucia = Object.assign(datosLucia(), { directos: { [id(1)]: respuesta(D[0], true), [id(2)]: respuesta(D[1], true), [id(13)]: respuesta(D[12], false) } });
      s.yo = { sesion: true, id: '999', nombre: 'Alex García', avatar: null, acceso: true, admin: true };
      s.datos = Object.assign(datosLucia(), { trades: [], ruta: { lec: {}, niv: {} }, plan: null }); s.get = null; s.retardoPut = 0;
      s.alumnos = [{ id: '111', nombre: 'Lucía Ferrer', avatar: null, ultimaVez: '2026-10-30T15:00:00.000Z', datos: lucia, ultimoInforme: null }];
      const { ctx, page } = await abre({ nombre: 'administrador' }, '#formacion/directos/13');
      await esperaClip(page, 13, false);
      const n0 = s.log.length;
      s.datos = Object.assign({}, s.datos, { directos: { [id(5)]: respuesta(D[4], true) } }); // en otro dispositivo suyo ha respondido el clip 5
      s.get = { retardo: 1500, veces: 1 };
      await opcion(page, D[12].correcta).click(); await esperaClip(page, 13, true);
      await irA(page, '#alumnos/111'); // abre el diario de una alumna antes de que el servidor haya contestado
      await g.txt('Responde un clip suyo y abre enseguida el diario de una alumna', h1(page), 'Diario de Lucía Ferrer', 6000);
      g.ok('(en ese momento su respuesta todavía no ha subido)', !s.orden(n0).includes('PUT /api/datos'), s.orden(n0).join(', '));
      const r = await hasta(() => s.puts().slice(-1)[0], (e) => !!e && s.log.indexOf(e) >= n0, 6000);
      const b = r.ok ? r.v.cuerpo : {};
      g.ok('Lo que sube es SU estado: su respuesta y ninguna operación (las de la alumna no)', r.ok && igualJSON(b.directos, { [id(13)]: { o: D[12].correcta, ok: true, f: HOY } }) && Array.isArray(b.trades) && b.trades.length === 0, JSON.stringify(b).slice(0, 240));
      await irA(page, '#alumnos/111/estadisticas'); await pausa(300); await irA(page, '#alumnos/111'); await page.locator('#hero-neto').waitFor();
      await g.partes('…y el diario de la alumna, al repintarse, sigue con sus respuestas y no con las de él', page.locator('#vista'), ['Tests de los directos:', `3 de ${TOTAL}`, 'preguntas respondidas', '2 aciertos y 1 fallo']);
      for (const k of ['a', '1', 'Enter', 'ArrowRight']) await page.keyboard.press(k);
      await page.locator('#vista [data-accion="periodo"][data-periodo="semana"]').first().click().catch(() => {});
      await pausa(1300);
      const escrituras = s.log.slice(n0).filter((e) => e.m !== 'GET');
      g.ok('Mirando a la alumna no se escribe nada más (un solo PUT en total, el suyo)', escrituras.length === 1, s.orden(n0).join(', '));
      await g.cuenta('…ni hay nada que responder en su diario', page.locator('#vista [data-accion^="dir-"]'), 0);
      await irA(page, '#formacion/directos');
      await g.cuenta('Al volver a sus tests, su progreso es el suyo (1 clip), no el de la alumna (3)', page.locator('#vista').getByRole('img', { name: `1 de ${TOTAL} preguntas respondidas: 1 acierto y 0 fallos` }), 1);
      g.ok('Ninguna petición a rutas que no existen', s.otras.length === 0, s.otras.join(', '));
      await ctx.close();
    });
  } finally {
    await s.cerrar().catch(() => {});
    await nav.close().catch(() => {});
  }
  g.ok('Sin errores de página ni de consola', g.errores.length === 0, g.errores.slice(0, 6).join(' | '));
}

/* =====================================================================================================
 * GRUPO 7 · El resto de la web guarda como antes: el mismo recorrido (diario, plan, lecciones, salida) contra la web publicada (origin/main)
 *   y contra la de ahora deja en el servidor exactamente las mismas peticiones /api/*, en el mismo orden y con el mismo contenido
 * ===================================================================================================== */
function normalizaLog(log) {
  const alias = new Map(); let nt = 0;
  const T0 = AHORA.getTime() - 5000, T1 = AHORA.getTime() + 3 * 3600e3;
  const anda = (x) => {
    if (Array.isArray(x)) return x.map(anda);
    if (x && typeof x === 'object') { const o = {}; Object.keys(x).sort().forEach((k) => { o[k] = anda(x[k]); }); return o; }
    if (typeof x === 'number' && x >= T0 && x <= T1) return '<ahora>';
    if (typeof x === 'string') { if (/^t\d{12,14}$/.test(x)) { if (!alias.has(x)) alias.set(x, 't#' + (++nt)); return alias.get(x); } return x.replace(/2026-10-30T1[5-8]:\d\d:\d\d(\.\d+)?Z/g, '<ahora>'); }
    return x;
  };
  return log.map((e) => anda({ m: e.m, p: e.p, cuerpo: e.cuerpo === undefined ? null : e.cuerpo, cortado: !!e.cortado }));
}
async function recorrido(g, nav, s, quien) {
  const { ctx, page } = await contextoReal(g, nav, { nombre: quien, semilla: true });
  const v = page.locator('#vista'), toast = page.locator('#toast');
  // Cada tramo espera a que el servidor deje de recibir guardados (900 ms sin ninguno nuevo) y apunta dónde acaba: con la máquina cargada, un guardado
  // retrasado caía en el tramo siguiente y la comparación escritura a escritura daba un FALLO falso (hallazgo A-1 de la revisión [DN]).
  s.marcas = [];
  const put = async (fn) => {
    const n = s.puts().length; await fn(); const r = await hasta(() => s.puts().length, (k) => k > n, 6000); if (!r.ok) throw new Error(`[${quien}] el guardado no llega al servidor`);
    let k = s.puts().length, quieto = Date.now(); while (Date.now() - quieto < 900) { await pausa(100); if (s.puts().length !== k) { k = s.puts().length; quieto = Date.now(); } }
    s.marcas.push(s.log.length);
  };
  await page.goto(s.url); await page.locator('#hero-neto').waitFor(); await pausa(800);
  await put(() => v.locator('[data-accion="periodo"][data-periodo="semana"]').first().click());                       // Diario · periodo
  await put(() => nuevaOperacion(page, 'Recorrido: entrada tarde, «con comillas» y ñ'));                               // Diario · operación nueva
  await put(async () => {                                                                                               // Diario · editar una operación
    const b = page.locator('#tabla [data-accion="detalle"][data-id="s3"]'); if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click();
    await page.locator('#det-s3 [data-accion="editar-op"]').click(); await page.locator('#cajon').waitFor();
    await page.locator('#f-nota').fill('Nota s3 editada'); await page.locator('#btn-guardar-op').click(); await page.locator('#cajon').waitFor({ state: 'hidden' });
  });
  await put(() => cambiaObjetivo(page, 4000));                                                                          // Diario · objetivo
  await put(async () => {                                                                                               // Plan
    await irA(page, '#diario/plan'); await page.locator('#form-plan').waitFor(); await pausa(500);
    for (const [c, val] of [['pl-perdida', '500'], ['pl-contratos', '3'], ['pl-ops', '4']]) await page.locator('#' + c).fill(val);
    await page.locator('#pl-texto').fill('No opero noticias de alto impacto.');
    await page.locator('#form-plan').getByRole('button', { name: 'Guardar plan' }).click();
  });
  await pausa(900);
  await put(async () => {                                                                                               // Formación · el test de una lección (guarda al terminar)
    await irA(page, '#formacion/l/n1-3'); await v.locator('[data-accion="test-leccion"]').click();
    for (let i = 0; i < 40; i++) {
      await page.locator('#t-preg').waitFor();
      await v.locator('[data-accion="opcion"][data-pos="0"]').click();
      const sig = v.locator('[data-accion="siguiente"], [data-accion="ver-resultado"]'); await sig.waitFor();
      const ultimo = (await sig.getAttribute('data-accion')) === 'ver-resultado'; await sig.click(); if (ultimo) break;
    }
    await v.locator('[data-accion="temario"]').first().waitFor();
  });
  await irA(page, '#formacion/libre'); await v.locator('[data-accion="practicar"]').first().waitFor();                  // Formación · práctica libre (guarda en cada respuesta)
  await v.locator('[data-accion="practicar"]').first().click();
  for (let i = 0; i < 3; i++) {
    await page.locator('#t-preg').waitFor();
    await put(() => v.locator('[data-accion="opcion"][data-pos="1"]').click());
    const sig = v.locator('[data-accion="siguiente"], [data-accion="ver-resultado"]'); await sig.waitFor(); await sig.click();
  }
  await irA(page, '#diario'); await page.locator('#hero-neto').waitFor(); await pausa(400);                             // Salida con un guardado pendiente: lo envía el guardado de salida
  await v.locator('[data-accion="periodo"][data-periodo="todo"]').first().click();
  await page.locator('#alumno-sub a').click();
  await page.locator('#fuera').waitFor();
  await hasta(() => (s.datos || {}).periodo, (p) => p === 'todo', 4000);
  await pausa(400);
  void toast;
  await ctx.close();
}
async function gRestoIgual(g, env) {
  if (!g.ok('Se puede leer la web publicada (git show origin/main:index.html)', !!env.htmlMain, 'sin ella no se puede comparar')) return;
  const nav = await chromium.launch({ args: ARGS_REAL });
  const sMain = await servidorReal(env.htmlMain, { datos: datosLucia() }), sRama = await servidorReal(env.html, { datos: datosLucia() });
  try {
    await g.seccion('El mismo recorrido en la web publicada y en la de ahora', async () => {
      await Promise.all([recorrido(g, nav, sMain, 'publicada'), recorrido(g, nav, sRama, 'ahora')]);
      const a = normalizaLog(sMain.log), b = normalizaLog(sRama.log);
      const putsRama = sRama.puts();
      g.ok('El recorrido guarda de verdad (periodo, operación nueva, edición, objetivo, plan, lección, práctica y salida)', sMain.puts().length >= 9 && putsRama.length >= 9, `PUT publicada: ${sMain.puts().length}, ahora: ${putsRama.length}`);
      g.ok('Cada guardado lleva la clave «directos» vacía (en la publicada, la lleva también o aún no existe)', putsRama.every((e) => igualJSON(e.cuerpo.directos, {})) && sMain.puts().every((e) => !('directos' in e.cuerpo) || igualJSON(e.cuerpo.directos, {})), JSON.stringify(putsRama.map((e) => e.cuerpo.directos)).slice(0, 200));
      a.concat(b).forEach((e) => { if (e.cuerpo && typeof e.cuerpo === 'object') delete e.cuerpo.directos; });
      // Las lecturas que el navegador lanza a la vez (las capturas de las operaciones) llegan en un orden que cambia de una pasada a otra: se comparan
      // como conjunto con repeticiones. Todo lo que escribe (PUT, POST, DELETE) se compara en su orden y con su contenido.
      const lee = (l) => l.filter((e) => e.m === 'GET').map((e) => e.p).sort(), escribe = (l) => l.filter((e) => e.m !== 'GET');
      g.ok(`Las mismas lecturas /api/* (${lee(a).length} GET, las mismas direcciones las mismas veces)`, igualJSON(lee(a), lee(b)), `publicada: ${lee(a).join(', ').slice(0, 400)} | ahora: ${lee(b).join(', ').slice(0, 400)}`);
      g.ok('…empezando igual: /api/yo y después /api/datos', igualJSON(a.slice(0, 2).map((e) => e.m + ' ' + e.p), ['GET /api/yo', 'GET /api/datos']) && igualJSON(b.slice(0, 2).map((e) => e.m + ' ' + e.p), ['GET /api/yo', 'GET /api/datos']));
      // Por tramos (cada acción del recorrido): varias escrituras seguidas a la misma dirección dentro de un tramo cuentan como un grupo, y de cada grupo
      // se compara la última (la que deja el estado). Cuántos PUT intermedios agrupa el navegador depende de los tiempos de la máquina, no de la web.
      const grupos = (l, marcas) => { const cortes = [0].concat(marcas, [l.length]), out = [];
        for (let t = 0; t + 1 < cortes.length; t++) { const tr = escribe(l.slice(cortes[t], cortes[t + 1])), gs = [];
          tr.forEach((e) => { const k = e.m + ' ' + e.p; if (gs.length && gs[gs.length - 1].k === k) gs[gs.length - 1].e = e; else gs.push({ t: t + 1, k, e }); }); out.push(...gs); }
        return out; };
      const ga = grupos(a, sMain.marcas), gb = grupos(b, sRama.marcas);
      const clave = (gs) => gs.map((x) => `${x.t}:${x.k}`);
      g.ok(`Las mismas escrituras, en el mismo orden y en el mismo tramo (${ga.length} grupos en ${sMain.marcas.length + 1} tramos: ${Array.from(new Set(ga.map((x) => x.k))).join(', ')})`, sMain.marcas.length === sRama.marcas.length && igualJSON(clave(ga), clave(gb)), `publicada: ${clave(ga).join(', ').slice(0, 400)} | ahora: ${clave(gb).join(', ').slice(0, 400)}`);
      const dif = ga.findIndex((x, i) => !gb[i] || !igualJSON(x.e, gb[i].e));
      g.ok('…y con el mismo contenido en el último guardado de cada grupo (salvo esa clave)', dif < 0 && ga.length === gb.length, dif >= 0 ? `tramo ${ga[dif].t}, ${ga[dif].k} difiere: ${JSON.stringify(ga[dif].e).slice(0, 220)} ≠ ${JSON.stringify((gb[dif] || {}).e).slice(0, 220)}` : '');
      g.ok('El guardado de salida llega en las dos (el último PUT lleva el periodo que se cambió justo antes de salir)', (sMain.puts().pop() || { cuerpo: {} }).cuerpo.periodo === 'todo' && (putsRama[putsRama.length - 1] || { cuerpo: {} }).cuerpo.periodo === 'todo');
      g.ok('Ningún GET de más a /api/datos: fuera de los tests de los directos, el estado solo se lee al abrir', sRama.log.filter((e) => e.m === 'GET' && e.p === '/api/datos').length === 1 && sMain.log.filter((e) => e.m === 'GET' && e.p === '/api/datos').length === 1);
      g.ok('Ninguna petición a rutas que no existen', sMain.otras.length === 0 && sRama.otras.length === 0, sMain.otras.concat(sRama.otras).join(', '));
    });
  } finally {
    await sMain.cerrar().catch(() => {}); await sRama.cerrar().catch(() => {});
    await nav.close().catch(() => {});
  }
  g.ok('Sin errores de página ni de consola', g.errores.length === 0, g.errores.slice(0, 6).join(' | '));
}

/* =====================================================================================================
 * GRUPO 8 · Pantallas difíciles: portátil bajo (1280×720, 1366×657, 1280×890), móvil apaisado, repasar un clip en el móvil y la portada en el móvil
 * ===================================================================================================== */
const enVista = (sel) => { // dónde queda un elemento respecto a lo que se ve (descontando la barra fija de abajo del móvil)
  const e = document.querySelector(sel); if (!e) return null;
  const r = e.getBoundingClientRect(), nav = document.querySelector('nav[aria-label="Secciones"], .nav'), fija = nav && getComputedStyle(nav).position === 'fixed' && nav.getBoundingClientRect().top > innerHeight / 2;
  const tope = fija ? nav.getBoundingClientRect().top : innerHeight;
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), tope: Math.round(tope), entero: r.height > 0 && r.top >= -1 && r.bottom <= tope + 1, y: Math.round(scrollY) };
};
async function gPantallas(g, env) {
  const D = env.D;
  const todo = {}; D.forEach((d, i) => { todo[d.id] = respuesta(d, i % 4 !== 1); });
  const veinte = {}; D.slice(0, 20).forEach((d, i) => { veinte[d.id] = respuesta(d, i % 4 !== 1); });
  const quieto = async (page) => { let a = -1; for (let i = 0; i < 25; i++) { const y = await page.evaluate(() => Math.round(scrollY)); if (y === a) return; a = y; await pausa(120); } };

  for (const [w, h] of [[1280, 720], [1366, 657], [1280, 890], [1440, 900]]) {
    await g.seccion(`Ordenador ${w}×${h}: las cuatro opciones y «Siguiente pregunta», sin desplazar`, async () => {
      const { ctx, page } = await contexto(g, env, { nombre: `${w}×${h}`, viewport: { width: w, height: h }, reducir: true });
      await page.goto(BASE + '#formacion/directos/1');
      const fuera = [];
      for (let n = 1; n <= TOTAL; n++) {
        await page.evaluate((x) => { location.hash = '#formacion/directos/' + x; }, n);
        await esperaClip(page, n, false);
        const m = await page.evaluate(() => { window.scrollTo(0, 0); const o = Array.from(document.querySelectorAll('#vista [data-accion="dir-opcion"]')).map((b) => b.getBoundingClientRect()); return { d: Math.round(o[3].bottom), h: innerHeight }; });
        if (m.d > m.h) fuera.push(`${n} (+${m.d - m.h} px)`);
      }
      g.ok(`${w}×${h} · en las ${TOTAL} preguntas (con su nombre encima) la opción D se ve entera sin desplazar`, fuera.length === 0, `no cabe en: ${fuera.slice(0, 12).join(', ')}`);
      if (h < 900) {
        const mal = [];
        for (const n of (w === 1280 && h === 720 ? D.map((d, i) => i + 1) : [1, 8, 20, 30])) { // a 1280×720, las 90 (B-2: antes se quedaba bajo el pliegue en unas cuantas)
          await page.evaluate((x) => { location.hash = '#formacion/directos/' + x; }, n);
          await esperaClip(page, n, false);
          await opcion(page, otra(D[n - 1])).click(); await esperaClip(page, n, true); await quieto(page);
          const m = { sig: await page.evaluate(enVista, '#vista [data-accion="dir-sig"]'), video: await page.evaluate(enVista, '#dir-video'), ver: await page.evaluate(enVista, '#d-ver') };
          if (!(m.sig.entero && m.video.entero && m.ver.entero)) mal.push(`pregunta ${n}: ${JSON.stringify(m)}`);
        }
        g.ok(`${w}×${h} · tras responder (fallando)${w === 1280 && h === 720 ? ` cada una de las ${TOTAL}` : ''}, el veredicto, el vídeo entero y «Siguiente pregunta» quedan a la vista a la vez`, mal.length === 0, mal.slice(0, 2).join(' | '));
        await sinDesborde(g, page, w, `${w}×${h} · test respondido`);
        await page.goto(BASE + '#formacion/directos'); await page.locator('#d-tit').waitFor();
        await g.cuenta(`${w}×${h} · en ordenador las categorías también son plegables: cuatro cabeceras a la vista`, page.locator('#vista details[data-c] > summary:visible'), REPARTO.length);
        const alto = await page.evaluate(() => document.documentElement.scrollHeight);
        g.ok(`${w}×${h} · …y la portada con una categoría abierta no pasa de tres pantallas (${alto} px)`, alto <= 3 * h + 200, `${alto} px`);
      }
      await ctx.close();
    });
  }

  await g.seccion('Móvil apaisado (844×390): el clip cabe entero', async () => {
    const { ctx, page } = await contexto(g, env, { nombre: 'apaisado', viewport: { width: 844, height: 390 }, dpr: 2, movil: true, reducir: true, cortarVideo: true, tolera: [/clips\/.*\.mp4/, /net::ERR_FAILED/] });
    for (const [n, ok] of [[7, true], [8, false]]) {
      await page.goto(BASE + '#formacion/directos/' + n); await esperaClip(page, n, false);
      await opcion(page, ok ? D[n - 1].correcta : otra(D[n - 1])).click(); await esperaClip(page, n, true); await quieto(page);
      const v = await page.evaluate(enVista, '#dir-video'), ver = await page.evaluate(enVista, '#d-ver');
      g.ok(`Pregunta ${n} ${ok ? 'acertada' : 'fallada'} · el vídeo entero cabe en lo que deja libre la barra de abajo y se ve nada más responder`, v.entero && v.h <= v.tope - 20 && v.w >= 380, JSON.stringify(v));
      g.ok('…junto con el veredicto', ver.entero, JSON.stringify(ver));
      g.ok('…y guarda la proporción 16:9', Math.abs(v.w / v.h - 16 / 9) < 0.03, JSON.stringify(v));
    }
    await sinDesborde(g, page, 844, 'Apaisado · test respondido');
    await page.locator('#dir-video').evaluate((e) => { const p = e.play(); if (p && p.catch) p.catch(() => {}); });
    await g.visible('Si el vídeo no carga, el aviso sale', page.locator('#dir-error'), 8000);
    const e = await page.evaluate(enVista, '#dir-error');
    g.ok('…entero a la vista (antes quedaba debajo de la barra)', !!e && e.entero, JSON.stringify(e));
    await tactiles(g, page, 'Apaisado · test respondido con el aviso');
    await ctx.close();
  });

  for (const [w, h] of [[390, 844], [360, 740]]) {
    await g.seccion(`Repasar una pregunta en el móvil (${w}×${h})`, async () => {
      const { ctx, page } = await contexto(g, env, { nombre: `repaso ${w}`, viewport: { width: w, height: h }, dpr: 2, movil: true, reducir: true, cortarVideo: true, tolera: [/clips\/.*\.mp4/, /net::ERR_FAILED/] });
      const v = page.locator('#vista');
      await sembrar(page, Object.assign(estadoAntiguo(), { directos: todo }), BASE + '#formacion/directos');
      await page.locator('#d-tit').waitFor();
      const t30 = await tarjeta(page, 30);
      await t30.scrollIntoViewIfNeeded(); await t30.click();
      await esperaClip(page, 30, true); await quieto(page);
      const vid = await page.evaluate(enVista, '#dir-video'), ver = await page.evaluate(enVista, '#d-ver');
      g.ok(`${w} px · una pregunta ya respondida se abre por la placa del clip: el vídeo entero a la vista`, vid.entero && vid.y > 100, JSON.stringify(vid));
      g.ok(`${w} px · …con su veredicto, si cabe`, ver.entero || vid.bottom - ver.top > vid.tope - 12, JSON.stringify(ver));
      await page.locator('#dir-video').evaluate((e) => { const p = e.play(); if (p && p.catch) p.catch(() => {}); });
      await g.visible(`${w} px · si el vídeo no carga, el aviso sale`, page.locator('#dir-error'), 8000);
      const er = await page.evaluate(enVista, '#dir-error');
      g.ok(`${w} px · …entero a la vista, sobre el vídeo y por encima de la barra de abajo`, !!er && er.entero && er.h >= 100, JSON.stringify(er));
      await tactiles(g, page, `${w} px · clip en repaso con el aviso`);
      for (const [nombre, loc] of [['«Volver»', v.getByRole('link', { name: 'Volver', exact: true })], ['el enlace de arriba', v.locator('a[href="#formacion/directos"]').first()]]) {
        await loc.click();
        await page.locator('#d-tit').waitFor(); await quieto(page);
        const t = await page.evaluate(enVista, '#vista a[href="#formacion/directos/30"]'), foco = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('href'));
        g.ok(`${w} px · ${nombre} vuelve a la portada con la tarjeta de la pregunta a la vista y con el foco (antes, arriba del todo)`, t.entero && t.y > 500 && foco === '#formacion/directos/30', JSON.stringify(t) + ' foco ' + foco);
        await t30.click(); await esperaClip(page, 30, true); await quieto(page);
      }
      await v.locator('[data-accion="dir-sig"]').scrollIntoViewIfNeeded(); await v.locator('[data-accion="dir-sig"]').click();
      await esperaClip(page, 31, true); await quieto(page);
      g.ok(`${w} px · «Siguiente pregunta» con todo respondido: la 31, también por la placa del clip`, (await page.evaluate(enVista, '#dir-video')).entero, JSON.stringify(await page.evaluate(enVista, '#dir-video')));
      await sinDesborde(g, page, w, `${w} px · clip en repaso (cuatro botones)`);
      await tactiles(g, page, `${w} px · clip en repaso`);
      // con clips pendientes, uno sin responder sigue empezando arriba
      await sembrar(page, Object.assign(estadoAntiguo(), { directos: veinte }), BASE + '#formacion/directos');
      await page.locator('#d-tit').waitFor();
      const t22 = await tarjeta(page, 22);
      await t22.scrollIntoViewIfNeeded(); await t22.click();
      await esperaClip(page, 22, false); await quieto(page);
      await g.igual(`${w} px · una pregunta sin responder se abre arriba, por su nombre`, () => page.evaluate(() => Math.round(window.scrollY)), 0);
      await ctx.close();
    });

    await g.seccion(`La portada en el móvil (${w}×${h})`, async () => {
      const { ctx, page } = await contexto(g, env, { nombre: `portada ${w}`, viewport: { width: w, height: h }, dpr: 2, movil: true, reducir: true });
      const v = page.locator('#vista'), cabs = v.locator('details[data-c] > summary');
      await sembrar(page, Object.assign(estadoAntiguo(), { directos: veinte }), BASE + '#formacion');
      const banda = page.locator('#vista > a[href="#formacion/directos"]');
      const yB = await banda.evaluate((a) => { window.scrollTo(0, a.getBoundingClientRect().top + scrollY - 200); return Math.round(scrollY); });
      await banda.click(); await page.locator('#d-tit').waitFor(); await quieto(page);
      g.ok(`${w} px · entrando por el acceso de la ruta (con la ruta desplazada ${yB} px), la portada empieza arriba (B-3)`, yB > 100 && (await page.evaluate(() => Math.round(window.scrollY))) === 0, `scrollY ${await page.evaluate(() => Math.round(window.scrollY))}`);
      await page.locator('#d-tit').waitFor();
      await g.cuenta(`${w} px · bajo la placa, una cabecera por categoría`, cabs, REPARTO.length);
      const esperado = REPARTO.map(([c, nom, n], k) => { const antes = REPARTO.slice(0, k).reduce((a, r) => a + r[2], 0); return [c, nom, `${Math.max(0, Math.min(n, 20 - antes))} de ${n}`]; });
      const cabsTxt = await v.locator('details[data-c]').evaluateAll((ds) => ds.map((d) => [d.dataset.c, d.querySelector('summary').textContent.replace(/\s+/g, ' ').trim()]));
      g.ok(`${w} px · …con su nombre y su «n de m»`, cabsTxt.length === esperado.length && esperado.every(([c, nom, nm], k) => cabsTxt[k][0] === c && cabsTxt[k][1].startsWith(nom) && cabsTxt[k][1].includes(nm)), JSON.stringify(cabsTxt).slice(0, 400));
      let acum = 0, p1 = 0; for (const r of REPARTO) { const ini = Math.max(acum, 20) + 1; if (!p1 && acum + r[2] - ini >= 2) p1 = ini; acum += r[2]; } // el primer clip sin responder de una categoría a la que le quedan tres o más (con 20 respondidos)
      await g.igual(`${w} px · abierta solo la categoría de la siguiente pregunta sin responder`, () => abiertas(page), catDe(21));
      await tarjeta(page, p1);
      const caja = (n) => { const a = document.querySelector(`#vista ul a[href="#formacion/directos/${n}"]`), b = a.getBoundingClientRect(), t = a.querySelector('b'), tb = t.getBoundingClientRect(), vid = a.querySelector('b + span'), vb = vid ? vid.getBoundingClientRect() : null;
        return { top: Math.round(b.top + scrollY), left: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height), nombre: Math.round(tb.height), lineas: Math.round(tb.height / (parseFloat(getComputedStyle(t).lineHeight) || 20)), vis: a.checkVisibility(), tit: vb ? Math.round(vb.height) : null }; };
      const mide = (p) => page.evaluate(({ p, caja }) => { const f = new Function('return ' + caja)(); const ul = document.querySelector(`#vista ul a[href="#formacion/directos/${p}"]`).closest('ul');
        return { p21: f(p), p22: f(p + 1), p23: f(p + 2), r1: f(1), r2: f(2), ancho: ul.clientWidth, vista: document.getElementById('vista').getBoundingClientRect().width, alto: document.documentElement.scrollHeight }; }, { p, caja: caja.toString() });
      let m = await mide(p1);
      g.ok(`${w} px · las preguntas sin responder van una por fila, a todo el ancho`, m.p22.top >= m.p21.top + m.p21.h && m.p22.left === m.p21.left && m.p23.top > m.p22.top && m.p21.w >= m.ancho - 4 && m.ancho >= m.vista - 60, JSON.stringify([m.p21, m.p22, m.p23, m.ancho, m.vista]));
      g.ok(`${w} px · …compactas: «Pregunta NN» y el nombre en dos líneas como mucho (entre 44 y 84 px de alto)`, [m.p21, m.p22, m.p23].every((x) => x.h >= 44 && x.h <= 84 && x.lineas <= 2), JSON.stringify([m.p21, m.p22, m.p23]));
      await g.txt(`${w} px · una tarjeta sin responder: «Pregunta NN» y su nombre (categoría y estado, para lectores de pantalla)`, v.locator(`ul a[href="#formacion/directos/${p1 + 1}"]`), `Pregunta ${num2(p1 + 1)} · ${env.CATS[D[p1].cat].nombre} · sin responder${D[p1].nombre}`);
      const cortos = await page.evaluate(() => Array.from(document.querySelectorAll('#vista ul a[href^="#formacion/directos/"]')).filter((a) => a.getBoundingClientRect().height > 0).map((a) => { const sm = a.querySelector('small'); return { n: a.getAttribute('href'), cabe: sm.getBoundingClientRect().height < 24 }; }).filter((x) => !x.cabe).map((x) => x.n));
      g.ok(`${w} px · «Pregunta NN» cabe en una línea en todas las tarjetas`, cortos.length === 0, cortos.slice(0, 5).join(', '));
      g.ok(`${w} px · las 20 respondidas, recogidas: ninguna a la vista`, !m.r1.vis && !m.r2.vis, JSON.stringify([m.r1, m.r2]));
      await g.igual(`${w} px · …tras «Ver las 20 respondidas», debajo de las pendientes`, async () => norm(await hechas(page, catDe(21)).innerText()), 'Ver las 20 respondidas');
      g.ok(`${w} px · con 20 respondidas y una categoría abierta, la portada mide ${m.alto} px`, m.alto <= 1700 + (REPARTO[0][2] - 20) * 100, `${m.alto} px`);
      await tarjeta(page, 1);
      m = await mide(p1);
      g.ok(`${w} px · al abrirlo, las respondidas a todo el ancho y una debajo de otra`, m.r1.vis && m.r1.w >= m.ancho - 4 && m.r2.top > m.r1.top, JSON.stringify([m.r1, m.r2, m.ancho]));
      g.ok(`${w} px · …con el título del clip en una sola línea (sin que la tarjeta pase de 120 px)`, m.r1.tit > 0 && m.r1.tit < 24 && m.r1.h <= 120 && m.r2.h <= 120, JSON.stringify([m.r1, m.r2]));
      await g.txt(`${w} px · …y su texto completo: «Pregunta 01», el estado, el nombre y el título del clip`, v.locator('ul a[href="#formacion/directos/1"]'), `Pregunta 01 · ${env.CATS[D[0].cat].nombre}${respuesta(D[0], true).o === D[0].correcta ? 'Acertada' : 'Fallada'}${D[0].nombre}${D[0].titulo}`);
      await tactiles(g, page, `${w} px · portada con las respondidas a la vista`);
      await sinDesborde(g, page, w, `${w} px · portada a medias`);
      await tactiles(g, page, `${w} px · portada a medias`);
      const ult = REPARTO[REPARTO.length - 1];
      await cabs.last().scrollIntoViewIfNeeded();
      const y0 = await page.evaluate((c) => Math.round(document.querySelector(`#vista details[data-c="${c}"] > summary`).getBoundingClientRect().top), ult[0]);
      await cabs.last().click();
      await g.cuenta(`${w} px · pulsar la cabecera de la última categoría la abre: sus ${ult[2]} preguntas, a la vista`, v.locator(`details[data-c="${ult[0]}"] ul a:visible`), ult[2]);
      const y1 = await page.evaluate((c) => Math.round(document.querySelector(`#vista details[data-c="${c}"] > summary`).getBoundingClientRect().top), ult[0]);
      g.ok(`${w} px · …sin que la cabecera se mueva de donde se ha pulsado`, Math.abs(y1 - y0) <= 2, `${y0} → ${y1}`);
      await sinDesborde(g, page, w, `${w} px · portada con dos categorías abiertas`);
      await tactiles(g, page, `${w} px · portada con dos categorías abiertas`);
      await page.evaluate((k) => localStorage.removeItem(k), CLAVE_CATS);
      await sembrar(page, estadoAntiguo(), BASE + '#formacion/directos');
      await page.locator('#d-tit').waitFor();
      const alto = await page.evaluate(() => document.documentElement.scrollHeight);
      g.ok(`${w} px · la portada sin empezar cabe en poco más de dos pantallas (${alto} px; con las ${TOTAL} tarjetas a la vista eran más de 4.500)`, alto <= 2.3 * h, `${alto} px con ${TOTAL} clips`);
      await g.cuenta(`${w} px · …con las cuatro cabeceras y ninguna tarjeta a la vista`, v.locator('ul a[href^="#formacion/directos/"]:visible'), 0);
      await sinDesborde(g, page, w, `${w} px · portada sin empezar`);
      await tactiles(g, page, `${w} px · portada sin empezar`);
      await sembrar(page, Object.assign(estadoAntiguo(), { directos: todo }), BASE + '#formacion/directos');
      await page.locator('#d-tit').waitFor();
      const altoT = await page.evaluate(() => document.documentElement.scrollHeight);
      g.ok(`${w} px · y con los ${TOTAL} respondidos, lo mismo (${altoT} px; con las cuatro abiertas eran unas doce pantallas)`, altoT <= 2.3 * h, `${altoT} px`);
      await ctx.close();
    });
  }
  cierre(g);
}

const GRUPOS = [
  ['Datos y archivos', gDatos],
  ['Modo ejemplo', gEjemplo],
  ['Estado y repaso', gEstado],
  ['Servidor simulado', gServidor],
  ['Tamaños y temas', gTamanos],
  ['Guardado de salida y administrador', gDosDispositivos],
  ['El resto guarda igual', gRestoIgual],
  ['Pantallas difíciles', gPantallas],
];

(async () => {
  const t0 = Date.now();
  const elegidos = GRUPOS.filter(([n]) => !SOLO || SOLO.test(n));
  console.log(`AGX · tests de los directos · BASE=${BASE} · reloj fijo: viernes 30-oct-2026 16:30 (Europe/Madrid) · ${elegidos.length} grupos, ${CONCURRENCIA} a la vez`);
  let browser = null; const resumen = []; let fatal = null;
  try {
    const html = await descargar(BASE);
    browser = await chromium.launch();
    const main = spawnSync('git', ['-C', REPO, 'show', 'origin/main:index.html'], { encoding: 'utf8', maxBuffer: 64 * 1048576 });
    const env = Object.assign({ browser, html, htmlMain: main.status === 0 && /<\/html>\s*$/.test(main.stdout) ? main.stdout : null }, await prepararClave(browser, html));
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
