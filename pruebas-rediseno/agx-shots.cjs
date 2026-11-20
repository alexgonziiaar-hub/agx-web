#!/usr/bin/env node
// Capturas completas de la web AGX (agx-web): todas las pantallas y estados, en claro y oscuro,
// en ordenador, tableta, móvil y móvil estrecho. Sirve para comparar antes y después de un rediseño.
//
// Uso:
//   BASE=http://localhost:4400/ OUT=/ruta/salida NODE_PATH=$(npm root -g) node agx-shots.cjs
//
// Variables opcionales:
//   LIMPIAR=1        borra los PNG y capturas.json de OUT antes de empezar
//   JOBS=3           contextos en paralelo (la máquina tiene 4 CPU)
//   SOLO='regex'     solo las capturas cuyo nombre <tamaño-tema>-<número>-<nombre> encaje (p. ej. SOLO='^d-claro-1[1-6]' o SOLO='cajon')
//   FECHA=ISO        reloj fijo del navegador (por defecto viernes 30 oct 2026, 16:30 en Madrid)
//   FONTS=/ruta      carpeta node_modules con @fontsource-variable/archivo y @fontsource/bebas-neue
//   CANAL=chromium   usa Chromium completo en vez de headless shell
//   SIN_CONTACTO=1   no genera las hojas de contacto al terminar
//
// Qué garantiza:
//   - Reloj fijo (Date), zona Europe/Madrid, es-ES, azar fijo (las preguntas no se barajan: la A es la correcta).
//   - Un contexto limpio por escena: sin localStorage ni IndexedDB heredados.
//   - Fuentes locales (Archivo variable y Bebas Neue) en lugar de Google Fonts.
//   - Ninguna petición sale a Internet: todo lo que no sea BASE o el host ficticio se corta.
//   - Modo servidor simulado en https://demo-agx.netlify.app/ con /api/* de mentira.
//   - Página completa = ventana tan alta como la página (la barra lateral y los pies pegajosos quedan en su sitio),
//     y se repite hasta que dos capturas seguidas salen idénticas.
//   - Los avisos (toast) duran 8 s en vez de 2,8 s para poder capturarlos; antes de cada página completa se ocultan.
//   - Antes de cada captura de ventana se espera a que termine el desplazamiento suave.
// Sale con código 0 si no hay problemas, 2 si hay problemas de captura o errores de página y 1 si no arranca.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const BASE = (process.env.BASE || 'http://localhost:4400/').replace(/\/?$/, '/');
const OUT = process.env.OUT || path.join(__dirname, '..', 'base');
const JOBS = Math.max(1, parseInt(process.env.JOBS || '3', 10));
const SOLO = process.env.SOLO ? new RegExp(process.env.SOLO) : null;
const FECHA = new Date(process.env.FECHA || '2026-10-30T15:30:00Z');
const SRV = 'https://demo-agx.netlify.app/';
const FONTS = process.env.FONTS || path.join(__dirname, '..', 'fonts', 'node_modules');
const BASE_ORIGIN = new URL(BASE).origin;
const SRV_ORIGIN = new URL(SRV).origin;

fs.mkdirSync(OUT, { recursive: true });
if (process.env.LIMPIAR === '1') {
  for (const f of fs.readdirSync(OUT)) if (/\.png$/.test(f) || f === 'capturas.json') fs.unlinkSync(path.join(OUT, f));
}

/* ---------- Fuentes locales ---------- */
let ARCHIVO = null, BEBAS = null;
try {
  ARCHIVO = fs.readFileSync(path.join(FONTS, '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2'));
  BEBAS = fs.readFileSync(path.join(FONTS, '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2'));
} catch (e) { /* se avisa al final */ }
const FONT_CSS = `
@font-face{font-family:'Archivo';font-style:normal;font-weight:100 900;font-stretch:62% 125%;font-display:swap;src:url(https://fonts.gstatic.com/agx-local/archivo.woff2) format('woff2')}
@font-face{font-family:'Bebas Neue';font-style:normal;font-weight:400;font-display:swap;src:url(https://fonts.gstatic.com/agx-local/bebas.woff2) format('woff2')}`;

/* ---------- Tamaños y temas ---------- */
const TAGS = {
  'd-claro': { vp: { width: 1440, height: 900 }, dsf: 1, movil: false, oscuro: false, todo: true },
  'd-oscuro': { vp: { width: 1440, height: 900 }, dsf: 1, movil: false, oscuro: true, todo: false },
  't-claro': { vp: { width: 820, height: 1180 }, dsf: 1, movil: true, oscuro: false, todo: false },
  'm-claro': { vp: { width: 390, height: 844 }, dsf: 2, movil: true, oscuro: false, todo: false },
  'm-oscuro': { vp: { width: 390, height: 844 }, dsf: 2, movil: true, oscuro: true, todo: true },
  'n-oscuro': { vp: { width: 360, height: 740 }, dsf: 2, movil: true, oscuro: true, todo: false },
};
// Vistas principales: las que se capturan también en los tamaños y temas que no llevan el juego completo
const PRINCIPALES = new Set(['01', '05', '07', '11', '13', '30', '31', '32', '33', '35', '41', '43', '44', '45', '46', '47', '48', '49', '50', '71']);

// Catálogo: número de captura -> nombre. El nombre del archivo es <tamaño-tema>-<número>-<nombre>.png
const CAT = {
  '01': 'diario-resumen-mes', '02': 'diario-resumen-todo', '03': 'diario-curva-punto', '04': 'diario-filtro-activo',
  '05': 'diario-estadisticas', '06': 'diario-estadisticas-ayuda', '07': 'diario-plan',
  '08': 'operacion-detalle', '09': 'operacion-borrar-confirmacion', '10': 'visor-captura',
  '11': 'cajon-vacio', '12': 'cajon-error', '13': 'cajon-relleno', '14': 'aviso-operacion-guardada', '15': 'plan-cuenta-configurada', '16': 'resumen-con-cuenta',
  '17': 'importar-inicio', '18': 'importar-vista-previa', '19': 'importar-error', '20': 'resumen-tras-importar', '21': 'cajon-completar-atas',
  '22': 'rutina-preparar', '23': 'rutina-cerrar', '25': 'paleta-abierta', '26': 'paleta-busqueda',
  '30': 'formacion-ruta', '31': 'formacion-leccion', '32': 'test-pregunta-sin-responder', '33': 'test-pregunta-bien', '34': 'test-pregunta-mal',
  '35': 'test-resultado-aprobado', '36': 'test-resultado-suspendido', '37': 'examen-en-curso', '38': 'examen-poco-tiempo', '39': 'examen-resultado-no-apto',
  '40': 'examen-nivel-apto', '41': 'formacion-repaso-libre', '42': 'test-pregunta-con-figura',
  '43': 'directos-portada', '44': 'directos-test-sin-responder', '45': 'directos-test-acertado-clip', '46': 'directos-test-fallado',
  '47': 'directos-portada-con-progreso', '48': 'directos-repaso-fallos', '49': 'directos-todo-respondido',
  '50': 'ranking-mes', '51': 'ranking-historico',
  '60': 'srv-alumno-resumen', '61': 'srv-alumno-ruta-bloqueada', '62': 'srv-alumno-leccion-bloqueada', '63': 'srv-alumno-plan-ia', '64': 'srv-alumno-ranking', '65': 'srv-alumno-estadisticas',
  '70': 'entrada-cargando', '71': 'entrada-login', '72': 'entrada-login-error', '73': 'entrada-sin-acceso', '74': 'entrada-error',
  '80': 'admin-alumnos-lista', '81': 'admin-alumno-diario', '82': 'admin-operacion-comentario', '83': 'admin-alumno-plan',
};

const problemas = [];
const erroresPagina = new Set();
const bloqueadas = new Set();
const manifiesto = [];

/* ---------- Datos de mentira para el modo servidor ---------- */
const VALOR = { NQ: 20, ES: 50, MNQ: 2, MES: 5 };
// Hora de Madrid a epoch: en octubre de 2026 el cambio de hora es el domingo 25
function madrid(fecha, h, m) { const a = fecha.split('-').map(Number); return Date.UTC(a[0], a[1] - 1, a[2], h - (fecha < '2026-10-25' ? 2 : 1), m); }
function op(id, fecha, hm, dur, ses, inst, dir, ct, usd, setup, stop, nota, extra) {
  const [h, m] = hm.split(':').map(Number), hEnt = madrid(fecha, h, m);
  return Object.assign({ id, fecha, sesion: ses, inst, dir, ct, usd, setup, nota, comentario: '', ejemplo: false, hEnt, hSal: hEnt + dur * 60000,
    stop: stop || null, riesgo: stop ? Math.round(stop * VALOR[inst] * ct) : null, errores: [] }, extra || {});
}
function atas(id, fecha, hm, dur, dir, pEnt, pts, extra) {
  const t = op(id, fecha, hm, dur, 'NY', 'NQ', dir, 1, pts * 20, '', null, '', extra);
  const pSal = pEnt + (dir === 'L' ? pts : -pts);
  return Object.assign(t, { origen: 'atas', pEnt, pSal, pts, com: 4.5, cuenta: 'APEX-50K-01', clave: ['APEX-50K-01', 'NQZ6', fecha + ' ' + hm + ':10', pEnt, fecha, pSal].join('|') }, extra || {});
}
const PLAN_DEMO = { perdidaMaxDia: 600, riesgoMaxOp: 300, maxContratos: 2, maxOps: 3, maxPerdidasSeguidas: 2, objetivoDia: null, horaDesde: '15:30', horaHasta: '18:30', dias: [1, 2, 3, 4, 5],
  instrumentos: ['NQ', 'MNQ', 'ES', 'MES'], setups: ['Patrón Gonzi', 'Imbalance', 'Agotamiento de Big Trade', 'Rechazo Call Wall / Put Wall', 'Giro por perfil'], registro: true, conStop: true,
  texto: 'Opero la apertura de Nueva York, de 15:30 a 18:30. Solo entro con confirmación en el footprint: absorción o agotamiento en un nivel marcado antes de la sesión. Si pierdo dos seguidas, cierro la plataforma.',
  zona: 'Europe/Madrid', actualizado: '2026-10-02T18:00:00.000Z' };
const ID_LUCIA = '300000000000000001', ID_ALEX = '900000000000000001';
function estadoLucia() {
  const trades = [
    op('l01', '2026-10-05', '15:41', 14, 'NY', 'NQ', 'L', 1, 400, 'Agotamiento de Big Trade', 12, 'Big trade vendedor en el mínimo de la apertura y sin continuación.', { comentario: 'Buena lectura. Así se espera la confirmación.' }),
    op('l02', '2026-10-06', '15:52', 9, 'NY', 'NQ', 'C', 1, -180, 'Divergencia', 9, 'Entré con la primera divergencia, sin confirmación.', { errores: ['fuera_plan'], comentario: 'La divergencia sola no es un setup de tu plan.' }),
    op('l03', '2026-10-08', '09:26', 21, 'Londres', 'MNQ', 'L', 5, 240, 'Rechazo Call Wall / Put Wall', 15, 'Rechazo limpio en la Put Wall con absorción.'),
    op('l04', '2026-10-13', '16:02', 17, 'NY', 'NQ', 'C', 1, 500, 'Patrón Gonzi', 12, 'Patrón Gonzi en el máximo de ayer.'),
    op('l05', '2026-10-14', '16:20', 6, 'NY', 'NQ', 'L', 2, -420, 'Imbalance', 10, 'Doblé contratos para recuperar la anterior.', { errores: ['tamano', 'revancha'], comentario: 'Dos reglas rotas en una operación. Vuelve a leer tu plan antes de la sesión.' }),
    op('l06', '2026-10-16', '15:36', 25, 'NY', 'ES', 'L', 1, 300, 'Giro por perfil', 4, 'Giro en el VAL del perfil de ayer.'),
    op('l07', '2026-10-20', '15:43', 8, 'NY', 'NQ', 'C', 1, -200, 'Rechazo Call Wall / Put Wall', 10, 'La Call Wall no aguantó.'),
    op('l08', '2026-10-21', '15:50', 19, 'NY', 'NQ', 'L', 1, 450, 'Agotamiento de Big Trade', 12, 'Big trade de 600 al bid en el mínimo y vela de rechazo.'),
    op('l09', '2026-10-26', '16:04', 22, 'NY', 'NQ', 'L', 1, 400, 'Patrón Gonzi', 12, 'Patrón Gonzi en el mínimo de la semana pasada.'),
    op('l10', '2026-10-28', '15:38', 11, 'NY', 'MES', 'L', 3, -60, 'Giro por perfil', 4, 'Salí antes de tiempo por miedo.', { errores: ['pronto'] }),
    atas('l11', '2026-10-29', '15:41', 12, 'L', 24510.25, 25.5),
    atas('l12', '2026-10-29', '16:15', 7, 'C', 24552.5, -7.5),
    atas('l13', '2026-10-30', '15:47', 9, 'L', 24488.75, -13, { setup: 'Patrón Gonzi', nota: 'Entré antes de la confirmación.', stop: 13, riesgo: 260, errores: ['fomo'] }),
  ];
  const lec = {};
  ['n1-1', 'n1-2', 'n1-3', 'n1-4', 'n1-5', 'n2-1', 'n2-2', 'n2-3'].forEach((id, i) => { lec[id] = { ok: true, mejor: [100, 90, 100, 90, 100, 90, 100, 90][i], intentos: 1 + (i % 2), fecha: '2026-10-' + String(3 + i * 2).padStart(2, '0') }; });
  lec['n2-4'] = { mejor: 70, intentos: 1 };
  const r = (s, a, c) => ({ checks: c || ['niveles', 'noticias', 'plan', 'descanso'], sueno: s, animo: a, nota: '', hora: null });
  return { directos: respuestasDirectos([1, 2, 3, 4, 5, 13, 14, 30, 39], [3, 14]), periodo: 'mes', trades, temas: {}, examen: null, fallos: ['delta-2', 'absorcion-4'], bloque: 'of', progresoEjemplo: false, objetivo: 3000, plan: PLAN_DEMO,
    ruta: { lec, niv: { n1: { ok: true, fallos: 1, total: 20, fecha: '2026-10-12' } } },
    cuenta: { firma: 'Apex Trader Funding', tamano: 50000, ddMax: 2500, ddTipo: 'eod', bloqueo: true, limiteDiario: 1000, objetivo: 3000, desde: '2026-10-01', fase: 'evaluacion', actualizado: '2026-10-02T18:10:00.000Z' },
    rutinas: { '2026-10-05': { pre: r(4, 4) }, '2026-10-06': { pre: r(2, 3) }, '2026-10-13': { pre: r(5, 4) }, '2026-10-14': { pre: r(2, 2, ['niveles']) }, '2026-10-16': { pre: r(4, 5) }, '2026-10-20': { pre: r(3, 3) },
      '2026-10-21': { pre: r(4, 4) }, '2026-10-26': { pre: r(4, 4), post: { disciplina: 4, mejora: 'Esperar el cierre de la vela antes de entrar', nota: '', hora: null } }, '2026-10-28': { pre: r(3, 2) }, '2026-10-29': { pre: r(4, 5) },
      '2026-10-30': { pre: Object.assign(r(4, 4, ['niveles', 'noticias', 'plan']), { nota: 'Vigilo el mínimo de ayer y la Put Wall de 24.400.' }) } } };
}
// Misma huella que calcula la web (huellaOps + plan.actualizado): así el informe no sale marcado como antiguo
function huella(trades, plan, desde, hasta) {
  const usd = (t) => (t.usd != null && isFinite(t.usd) ? Number(t.usd) : (Number(t.pts) || 0) * (VALOR[t.inst] || 20) * (Number(t.ct) || 1));
  const pos = (v) => { const x = Number(v); return isFinite(x) && x > 0 ? x : null; };
  const ts = trades.filter((t) => !t.ejemplo && t.fecha >= desde && t.fecha <= hasta);
  const s = JSON.stringify(ts.map((t) => [t.id, Math.round(usd(t)), t.setup || '', t.nota || '', t.ct, t.hEnt || 0, t.inst, pos(t.stop) || 0, pos(t.riesgo) || 0]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + '.' + String(plan.actualizado || '');
}
function informesLucia() {
  const st = estadoLucia();
  return [
    { clave: 'dia:2026-10-29', tipo: 'dia', origen: 'auto', desde: '2026-10-29', hasta: '2026-10-29', creado: '2026-10-29T21:10:00Z', huella: huella(st.trades, st.plan, '2026-10-29', '2026-10-29'), n: 2, neto: 360,
      ia: { puntuacion: 7, titular: 'Buen día de resultado, pero dos operaciones sin setup ni stop apuntados',
        resumen: 'Cerraste el día en positivo con dos operaciones dentro de tu horario y con un contrato. El problema no está en el resultado: ninguna de las dos lleva setup, stop ni nota, así que no se puede comprobar si eran entradas de tu plan.',
        bien: ['Respetaste el máximo de operaciones y de contratos.', 'Las dos entradas están dentro de tu horario de 15:30 a 18:30.'],
        mal: [{ regla: 'Registrar setup y nota', detalle: 'Las dos operaciones importadas de ATAS están sin completar.' }, { regla: 'Stop en cada operación', detalle: 'No hay stop apuntado en ninguna de las dos.' }],
        patrones: ['Es la segunda semana en la que las operaciones importadas se quedan sin completar hasta el día siguiente.'],
        capturas: [{ operacion: 'NQ largo 15:41', coherente: true, detalle: 'La captura muestra absorción en el mínimo antes de la entrada.' }, { operacion: 'NQ corto 16:15', coherente: false, detalle: 'En la captura no se ve el rechazo que describe un setup de tu plan.' }],
        acciones: ['Completa setup, stop y nota justo al cerrar cada operación, antes de mirar la siguiente.', 'Sube la captura con el nivel marcado antes de entrar.'] } },
    { clave: 'semana:2026-10-25', tipo: 'semana', origen: 'pedido', desde: '2026-10-19', hasta: '2026-10-25', creado: '2026-10-25T18:00:00Z', huella: 'antigua', n: 2, neto: 250,
      ia: { puntuacion: 9, titular: 'Semana limpia: dos operaciones de tu plan y nada más',
        resumen: 'Dos entradas, las dos con setup del plan, stop apuntado y dentro de horario. Una pérdida controlada de 1 R y una ganadora de casi 2 R.',
        bien: ['Todas las reglas cumplidas los dos días.', 'La pérdida del martes se quedó en 1 R exacto.'], mal: [], patrones: ['Tus mejores días llegan cuando preparas la sesión con todo marcado.'], capturas: [],
        acciones: ['Repite la misma rutina la semana que viene.'] } },
  ];
}
function alumnosDemo() {
  const lucia = estadoLucia();
  const gen = (pref, filas, extra) => Object.assign({ periodo: 'mes', trades: filas.map((f, i) => op(pref + (i + 1), f[0], f[1], 8 + i * 3, 'NY', f[2], f[3], f[4], f[5], f[6], f[7], f[8] || '', { comentario: f[9] || '' })),
    temas: {}, examen: null, fallos: [], bloque: 'base', progresoEjemplo: false, objetivo: 3000, plan: null, ruta: { lec: {}, niv: {} }, cuenta: null, rutinas: {} }, extra || {});
  const lecs = (ids) => { const o = {}; ids.forEach((id) => { o[id] = { ok: true, mejor: 90, intentos: 1, fecha: '2026-10-10' }; }); return o; };
  return [
    { id: ID_LUCIA, nombre: 'Lucía Ferrer', avatar: null, ultimaVez: '2026-10-30T15:05:00.000Z', datos: lucia, ultimoInforme: { hasta: '2026-10-29', tipo: 'dia', puntuacion: 7, titular: 'Buen día de resultado' } },
    { id: '300000000000000002', nombre: 'Diego Ramírez', avatar: null, ultimaVez: '2026-10-29T20:00:00.000Z', ultimoInforme: { hasta: '2026-10-29', tipo: 'dia', puntuacion: 9, titular: 'Plan cumplido' },
      datos: gen('d', [['2026-10-07', '15:40', 'NQ', 'L', 1, 380, 'Patrón Gonzi', 12, 'Mínimo de ayer con absorción.', 'Perfecta.'], ['2026-10-15', '15:55', 'NQ', 'C', 1, 420, 'Imbalance', 10, 'Imbalances vendedores apilados.', 'Bien gestionada.'],
        ['2026-10-22', '16:10', 'ES', 'L', 1, -150, 'Giro por perfil', 3, 'El perfil no estaba formado.', 'Espera a que el valor se defina.'], ['2026-10-29', '15:45', 'NQ', 'L', 1, 520, 'Agotamiento de Big Trade', 12, 'Big trade en el mínimo.', 'De manual.']],
        { plan: PLAN_DEMO, ruta: { lec: lecs(['n1-1', 'n1-2', 'n1-3', 'n1-4', 'n1-5', 'n2-1', 'n2-2', 'n2-3', 'n2-4', 'n2-5', 'n3-1', 'n3-2']), niv: { n1: { ok: true, fallos: 0, total: 20, fecha: '2026-10-05' }, n2: { ok: true, fallos: 2, total: 20, fecha: '2026-10-18' } } } }) },
    { id: '300000000000000003', nombre: 'Andrés Cabrera', avatar: null, ultimaVez: '2026-10-28T19:00:00.000Z', ultimoInforme: { hasta: '2026-10-28', tipo: 'dia', puntuacion: 3, titular: 'Tres reglas rotas' },
      datos: gen('a', [['2026-10-12', '15:35', 'NQ', 'L', 2, -640, 'Imbalance', 16, 'Entré tarde.'], ['2026-10-19', '15:50', 'NQ', 'C', 2, -560, 'Divergencia', 14, ''], ['2026-10-23', '16:30', 'NQ', 'L', 1, 300, 'Patrón Gonzi', 12, 'Esta sí la esperé.'],
        ['2026-10-27', '15:44', 'NQ', 'C', 3, -900, 'Rechazo Call Wall / Put Wall', 15, 'Aguanté la perdedora.'], ['2026-10-28', '17:05', 'MNQ', 'L', 4, -120, 'Imbalance', 15, '']],
        { plan: PLAN_DEMO, cuenta: { firma: 'Topstep', tamano: 50000, ddMax: 2000, ddTipo: 'eod', bloqueo: true, limiteDiario: 1000, objetivo: 3000, desde: '2026-10-01', fase: 'evaluacion', actualizado: '2026-10-03T10:00:00.000Z' },
          ruta: { lec: lecs(['n1-1', 'n1-2']), niv: {} } }) },
    { id: '300000000000000004', nombre: 'Marta Soler', avatar: null, ultimaVez: '2026-10-27T18:00:00.000Z', ultimoInforme: null,
      datos: gen('m', [['2026-10-09', '15:48', 'MNQ', 'L', 3, 150, 'Patrón Gonzi', 15, 'Primera con el patrón.', 'Buen comienzo.'], ['2026-10-20', '16:12', 'MNQ', 'C', 3, -90, 'Imbalance', 15, ''], ['2026-10-27', '15:39', 'MES', 'L', 2, 110, 'Giro por perfil', 4, 'VAL de ayer.']],
        { ruta: { lec: lecs(['n1-1', 'n1-2', 'n1-3', 'n1-4', 'n1-5']), niv: { n1: { ok: true, fallos: 1, total: 20, fecha: '2026-10-14' } } } }) },
    { id: '300000000000000005', nombre: 'Iker Navarro', avatar: null, ultimaVez: '2026-10-21T18:00:00.000Z', ultimoInforme: null,
      datos: gen('i', [['2026-10-14', '15:58', 'NQ', 'L', 1, -260, 'Imbalance', 13, ''], ['2026-10-21', '16:40', 'NQ', 'C', 1, -180, 'Divergencia', 9, 'Sin confirmación.']], { ruta: { lec: lecs(['n1-1']), niv: {} } }) },
    { id: '300000000000000006', nombre: 'Sofía Medina', avatar: null, ultimaVez: '2026-10-30T09:00:00.000Z', ultimoInforme: null, datos: gen('s', [], {}) },
  ];
}
function rankingDemo() {
  const ahora = FECHA.getTime(), H = 3600e3;
  const P = (id, nombre, e, p, o, h) => ({ discord_id: id, nombre, avatar_url: null, total: e + p + o, evaluaciones: e, payouts: p, otros: o, ultimo: new Date(ahora - h * H).toISOString() });
  const R = (id, nombre, tipo, texto, min) => ({ message_id: 'm' + min, discord_id: id, nombre, avatar_url: null, tipo, texto, url: 'https://discord.com/channels/1/2/' + min, fecha: new Date(ahora - min * 60e3).toISOString() });
  return { actualizado: new Date(ahora - 4 * 60e3).toISOString(),
    mes: [P('r-diego', 'Diego Ramírez', 3, 2, 2, 3), P(ID_LUCIA, 'Lucía Ferrer', 2, 2, 2, 9), P('r-marta', 'Marta Soler', 3, 1, 1, 6), P('r-andres', 'Andrés Cabrera', 2, 1, 1, 12), P('r-sofia', 'Sofía Medina', 1, 1, 2, 26),
      P('r-pablo', 'Pablo Ortega', 1, 1, 1, 15), P('r-valen', 'Valentina Ruiz', 2, 0, 1, 30), P('r-iker', 'Iker Navarro', 1, 0, 1, 8), P('r-hugo', 'Hugo Prieto', 1, 0, 0, 18)],
    historico: [P('r-diego', 'Diego Ramírez', 11, 12, 8, 3), P(ID_LUCIA, 'Lucía Ferrer', 10, 9, 9, 9), P('r-andres', 'Andrés Cabrera', 9, 8, 7, 12), P('r-marta', 'Marta Soler', 8, 6, 8, 6), P('r-sofia', 'Sofía Medina', 5, 4, 6, 26),
      P('r-valen', 'Valentina Ruiz', 4, 3, 5, 30), P('r-pablo', 'Pablo Ortega', 4, 2, 4, 15), P('r-iker', 'Iker Navarro', 2, 1, 4, 8), P('r-hugo', 'Hugo Prieto', 1, 1, 2, 18)],
    recientes: [R('r-diego', 'Diego Ramírez', 'payout', 'Segundo payout del mes en la cuenta de 100K.', 14), R('r-marta', 'Marta Soler', 'evaluacion', 'Evaluación de 50K superada.', 95),
      R(ID_LUCIA, 'Lucía Ferrer', 'otro', 'Diario al día toda la semana, con captura en cada operación.', 540), R('r-andres', 'Andrés Cabrera', 'payout', 'Primer retiro de la cuenta fondeada.', 720)],
    campeones: [{ mes: '2026-09', discord_id: 'r-diego', nombre: 'Diego Ramírez', total: 9 }, { mes: '2026-08', discord_id: 'r-andres', nombre: 'Andrés Cabrera', total: 8 }, { mes: '2026-07', discord_id: ID_LUCIA, nombre: 'Lucía Ferrer', total: 7 }] };
}
// Imagen de captura de ATAS simulada (SVG): sirve para subirla en el cajón y como respuesta de /api/captura
function svgCaptura(semilla, largo, gano) {
  let a = semilla >>> 0;
  const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const W = 960, H = 540, n = 38, ent = 27, s = largo ? 1 : -1, v = []; let p = 100;
  for (let i = 0; i < n; i++) { const d = i < ent ? -s * 0.32 : (gano ? s : -s) * 0.75, o = p, c = o + d + (rnd() - 0.5) * 2.3; v.push({ o, c, h: Math.max(o, c) + rnd() * 1.3, l: Math.min(o, c) - rnd() * 1.3 }); p = c; }
  const mn = Math.min(...v.map((x) => x.l)), mx = Math.max(...v.map((x) => x.h)), Y = (x) => (56 + ((mx - x) / (mx - mn)) * 370).toFixed(1), cw = 854 / n;
  let g = `<rect width="${W}" height="${H}" fill="#14151B"/>`;
  for (let x = 60; x < 874; x += 80) g += `<line x1="${x}" x2="${x}" y1="36" y2="514" stroke="#22242D"/>`;
  v.forEach((x, i) => { const cx = (10 + i * cw + cw / 2).toFixed(1), col = x.c >= x.o ? '#26A69A' : '#EF5350';
    g += `<line x1="${cx}" x2="${cx}" y1="${Y(x.h)}" y2="${Y(x.l)}" stroke="${col}"/><rect x="${(cx - cw * 0.32).toFixed(1)}" y="${Y(Math.max(x.o, x.c))}" width="${(cw * 0.64).toFixed(1)}" height="${Math.max(1.5, Math.abs(Y(x.o) - Y(x.c))).toFixed(1)}" fill="${col}"/>`; });
  g += `<text x="14" y="24" fill="#C9CBD6" font-family="Arial,sans-serif" font-size="15" font-weight="600">NQZ6, 1 minuto</text><text x="14" y="${H - 8}" fill="#6E7285" font-family="Arial,sans-serif" font-size="12">Captura simulada</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`;
}
const capturaDataUrl = (id) => { let h = 7; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgCaptura(h, h % 2 === 0, h % 3 !== 0)); };
const CSV_ATAS = ['Account;Instrument;Open time;Open price;Open volume;Close time;Close price;Close volume;PnL;Commission',
  'APEX-50K-01;NQZ6;27.10.2026 15:36:12;24410,50;1;27.10.2026 15:49:40;24432,25;1;435;4,5',
  'APEX-50K-01;NQZ6;28.10.2026 15:44:03;24468,00;1;28.10.2026 15:51:30;24459,25;1;-175;4,5',
  'APEX-50K-01;MNQZ6;28.10.2026 16:20:45;24471,25;4;28.10.2026 16:38:02;24489,75;4;148;3,2',
  'APEX-50K-01;NQZ6;29.10.2026 15:41:10;24510,25;1;29.10.2026 15:52:40;24535,75;1;510;4,5',
  'APEX-50K-01;NQZ6;29.10.2026 16:15:22;24552,50;1;29.10.2026 16:22:05;24560,00;1;-150;4,5',
  'APEX-50K-02;ESZ6;30.10.2026 15:47:31;6851,25;1;30.10.2026 15:58:12;6856,75;1;275;4,1'].join('\n') + '\n';

/* ---------- Red: fuentes locales, BASE, host ficticio; el resto se corta ---------- */
let INDEX_HTML = null;
/* ---------- Tests de los directos: la clave se lee del propio index.html (const DIRECTOS=[…], una línea JSON por clip) ---------- */
let DIRECTOS = [];
function leerDirectos(html) { const a = html.indexOf('const DIRECTOS=['), b = html.indexOf('\n];', a); if (a < 0 || b < 0) return []; try { return JSON.parse(html.slice(a + 15, b + 2)); } catch (e) { return []; } }
// Respuestas guardadas de las preguntas «nums» (1…90); los de «fallados» con una opción equivocada
function respuestasDirectos(nums, fallados) {
  const o = {};
  nums.forEach((n) => { const d = DIRECTOS[n - 1]; if (d) { const mal = (fallados || []).includes(n); o[d.id] = { o: mal ? (d.correcta + 1) % 4 : d.correcta, ok: !mal, f: '2026-10-29' }; } });
  return o;
}
function manejarServidor(route, req, u, srv) {
  const p = u.pathname.replace(/\/+$/, '') || '/', m = req.method();
  const json = (o, status) => route.fulfill({ status: status || 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(o) });
  const texto = (t) => route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body: t });
  if (p === '/' || p === '/index.html') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: INDEX_HTML });
  if (p === '/favicon.ico') return route.fulfill({ status: 204, body: '' });
  if (p.startsWith('/clips/')) return route.fetch({ url: BASE + p.slice(1) }).then((r) => route.fulfill({ response: r })).catch(() => route.abort()); // los clips del host ficticio salen del servidor local
  if (p === '/api/yo') {
    if (srv.yo === 'cargando') { srv.pendiente = route; return; } // no se responde: la entrada se queda en «cargando»
    if (srv.yo === 'login') return json({ sesion: false }, 401);
    if (srv.yo === 'sin_acceso') return json({ sesion: true, id: '400000000000000001', nombre: 'Carlos Vega', avatar: null, acceso: false, motivo: 'no_miembro', admin: false }, 403);
    if (srv.yo === 'error') return json({ error: 'error_interno' }, 500);
    if (srv.yo === 'admin') return json({ sesion: true, id: ID_ALEX, nombre: 'Alex García', avatar: null, acceso: true, motivo: null, admin: true });
    return json({ sesion: true, id: ID_LUCIA, nombre: 'Lucía Ferrer', avatar: null, acceso: true, motivo: null, admin: false });
  }
  if (p === '/api/datos') return m === 'GET' ? json({ datos: srv.yo === 'admin' ? null : estadoLucia() }) : json({ ok: true, guardado: FECHA.toISOString() });
  if (p === '/api/ranking') return json(rankingDemo());
  if (p === '/api/captura') return m === 'GET' ? texto(capturaDataUrl(u.searchParams.get('id'))) : json({ ok: true });
  if (p === '/api/analisis') return m === 'GET' ? json({ informes: informesLucia(), ia: true, restantes: 3 }) : json({ informe: informesLucia()[0], restantes: 2 });
  if (p === '/api/admin/alumnos') return json({ alumnos: alumnosDemo() });
  if (p === '/api/admin/captura') return texto(capturaDataUrl(u.searchParams.get('id')));
  if (p === '/api/admin/informes') return json({ informes: u.searchParams.get('alumno') === ID_LUCIA ? informesLucia() : [], ia: true });
  if (p === '/api/admin/comentario') { let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) { /* vacío */ } return json({ ok: true, texto: b.texto || '' }); }
  return json({ error: 'no_encontrado' }, 404);
}
function manejador(srv) {
  return (route) => {
    const req = route.request(); let u;
    try { u = new URL(req.url()); } catch (e) { return route.abort(); }
    if (u.hostname === 'fonts.googleapis.com') return ARCHIVO ? route.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS }) : route.abort();
    if (u.hostname === 'fonts.gstatic.com') return ARCHIVO ? route.fulfill({ status: 200, contentType: 'font/woff2', body: /bebas/.test(u.pathname) ? BEBAS : ARCHIVO, headers: { 'access-control-allow-origin': '*' } }) : route.abort();
    if (u.origin === BASE_ORIGIN) return route.continue();
    if (u.origin === SRV_ORIGIN) return manejarServidor(route, req, u, srv);
    bloqueadas.add(u.origin);
    return route.abort();
  };
}

/* ---------- Contexto limpio por escena ---------- */
async function nuevoContexto(browser, cfg, srv) {
  const ctx = await browser.newContext({ viewport: cfg.vp, deviceScaleFactor: cfg.dsf, isMobile: cfg.movil, hasTouch: cfg.movil, colorScheme: cfg.oscuro ? 'dark' : 'light',
    reducedMotion: 'no-preference', timezoneId: 'Europe/Madrid', locale: 'es-ES' });
  await ctx.clock.setFixedTime(FECHA);
  await ctx.addInitScript((oscuro) => {
    try { localStorage.setItem('agx-modo', oscuro ? 'oscuro' : 'claro'); } catch (e) { /* sin almacenamiento */ }
    // Azar fijo: con 0,999999 el barajado de la web deja el orden original (primeras N preguntas, opción A correcta)
    Math.random = () => 0.999999;
    // Los avisos (toast) de la web duran 2,8 s: aquí 8 s, para capturarlos sin carreras. Antes de cada página completa se ocultan a mano.
    const st = window.setTimeout;
    window.setTimeout = function (fn, ms, ...resto) { return st.call(window, fn, ms === 2800 ? 8000 : ms, ...resto); };
  }, cfg.oscuro);
  await ctx.route('**/*', manejador(srv));
  return ctx;
}
// PNG de 8 bits sin entrelazar (lo que da Playwright) a píxeles, para comparar dos capturas con tolerancia
function decodificarPNG(buf) {
  let p = 8, w = 0, h = 0, tipo = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), t = buf.toString('latin1', p + 4, p + 8);
    if (t === 'IHDR') { w = buf.readUInt32BE(p + 8); h = buf.readUInt32BE(p + 12); tipo = buf[p + 17]; } else if (t === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const bpp = tipo === 6 ? 4 : tipo === 2 ? 3 : 0; if (!bpp) return null;
  const raw = zlib.inflateSync(Buffer.concat(idat)), fila = w * bpp, px = Buffer.allocUnsafe(fila * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (fila + 1)], o = y * (fila + 1) + 1, d = y * fila;
    for (let x = 0; x < fila; x++) {
      const a = x >= bpp ? px[d + x - bpp] : 0, b = y ? px[d + x - fila] : 0, c = x >= bpp && y ? px[d + x - fila - bpp] : 0;
      let v = raw[o + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[d + x] = v & 255;
    }
  }
  return { w, h, bpp, px };
}
// Fracción de píxeles que cambian de forma apreciable entre dos capturas (el ruido de 1/255 de los desenfoques no cuenta)
function fraccionDistinta(a, b) {
  if (a.equals(b)) return 0;
  const A = decodificarPNG(a), B = decodificarPNG(b);
  if (!A || !B || A.w !== B.w || A.h !== B.h || A.bpp !== B.bpp) return 1;
  let n = 0; const bpp = A.bpp, N = A.px.length, P = A.px, Q = B.px;
  for (let i = 0; i < N; i += bpp) if (Math.abs(P[i] - Q[i]) > 10 || Math.abs(P[i + 1] - Q[i + 1]) > 10 || Math.abs(P[i + 2] - Q[i + 2]) > 10) n++;
  return n / (A.w * A.h);
}
function tamanoPNG(f) { const b = Buffer.alloc(24), fd = fs.openSync(f, 'r'); fs.readSync(fd, b, 0, 24, 0); fs.closeSync(fd); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }

function crearSesion(tag, cfg, ctx, page, srv, nums, out) {
  const hechas = new Set(), problemas = out.prob, manifiesto = out.mani;
  const S = {
    tag, cfg, ctx, page, srv, hechas,
    quiere: (n) => nums.includes(n) && (!SOLO || SOLO.test(`${tag}-${n}-${CAT[n]}`)),
    alguna: (...ns) => ns.some((n) => S.quiere(n)),
    async abrir(hash) { await page.goto(BASE + hash); await page.waitForSelector('#vista > *'); },
    async ir(hash) { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(450); await S.sinTransicion(); },
    async fuera() { await page.mouse.move(1, 1); },
    async arribaDelTodo() { await page.evaluate(() => window.scrollTo(0, 0)); },
    async sinToast() { await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.hidden = true; }); },
    // Espera a que termine cualquier desplazamiento suave (ventana, cajón o diálogos): una captura a medias sale descolocada
    async quieto() {
      let antes = null, iguales = 0;
      for (let i = 0; i < 60 && iguales < 3; i++) {
        const y = await page.evaluate(() => Math.round(scrollY) + ':' + Array.from(document.querySelectorAll('.cajon-cuerpo,.imp-capa,#paleta-lista')).map((e) => Math.round(e.scrollTop)).join(','));
        if (y === antes) iguales++; else { antes = y; iguales = 0; }
        await page.waitForTimeout(90);
      }
    },
    // Las transiciones de vista (startViewTransition) duran 0,35 s: no se captura ni se cambia de ventana a medias
    async sinTransicion() { await page.waitForFunction(() => { try { return !document.documentElement.matches(':active-view-transition'); } catch (e) { return true; } }, null, { timeout: 6000 }).catch(() => {}); },
    async sinConfeti() { await page.waitForTimeout(450); await page.waitForFunction(() => !document.querySelector('.confeti'), null, { timeout: 8000 }).catch(() => {}); },
    async foto(nombre, completa) {
      const f = path.join(OUT, nombre + '.png');
      if (completa) {
        await S.sinToast();
        await S.arribaDelTodo();
        const vp = page.viewportSize();
        const h = await page.evaluate(() => Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)));
        const alto = Math.min(Math.max(vp.height, h), Math.floor(30000 / cfg.dsf));
        if (alto !== vp.height) { await page.setViewportSize({ width: vp.width, height: alto }); await page.waitForTimeout(150); }
        // Dos capturas seguidas tienen que salir idénticas: así no se cuela una zona sin pintar de una página muy alta
        let img = await page.screenshot({ fullPage: true, animations: 'disabled' });
        for (let i = 0; i < 3; i++) {
          const otra = await page.screenshot({ fullPage: true, animations: 'disabled' });
          const dif = fraccionDistinta(otra, img);
          img = otra;
          if (dif < 0.0002) break;
          if (i === 2) problemas.push(`${nombre}: la página no se queda quieta entre dos capturas (cambia el ${(dif * 100).toFixed(2)} % de los píxeles; se guarda la última)`);
        }
        fs.writeFileSync(f, img);
        if (alto !== vp.height) { await page.setViewportSize(vp); await page.waitForTimeout(100); }
      } else { await S.quieto(); await page.screenshot({ path: f, animations: 'disabled' }); }
      const kb = fs.statSync(f).size / 1024, [w, h2] = tamanoPNG(f);
      if (kb < 6) problemas.push(`${nombre}: la imagen pesa ${kb.toFixed(1)} kB, parece vacía`);
      manifiesto.push({ nombre, tag, completa: !!completa, ancho: w, alto: h2, kb: Math.round(kb) });
    },
    // Captura numerada. o.full=false: solo la ventana. o.arriba: además el primer pantallazo. o.expect: selectores que tienen que verse.
    async shot(num, o) {
      o = o || {};
      const nombre = `${tag}-${num}-${CAT[num]}`;
      if (!S.quiere(num)) return false;
      try {
        if (!o.raton) await S.fuera();
        await S.sinTransicion();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(o.espera == null ? 500 : o.espera);
        for (const sel of o.expect || []) if (!(await page.locator(sel).first().isVisible())) throw new Error('no se ve «' + sel + '»');
        const cabe = await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2);
        if (o.arriba && !cabe) { await S.arribaDelTodo(); await S.sinToast(); await page.waitForTimeout(80); await S.foto(nombre + '-arriba', false); }
        await S.foto(nombre, o.full !== false);
        hechas.add(num);
        return true;
      } catch (e) { problemas.push(`${nombre}: ${String(e.message).split('\n')[0]}`); hechas.add(num); return false; }
    },
    // Diálogo o cajón: la ventana real y, si el contenido no cabe, otra «-completo» con la ventana estirada
    async shotDialogo(num, selScroll, o) {
      if (!(await S.shot(num, Object.assign({}, o, { full: false })))) return;
      const extra = await page.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.scrollHeight - e.clientHeight : 0; }, selScroll);
      if (extra < 24) return;
      const vp = page.viewportSize();
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height + extra + 4 });
        await page.waitForTimeout(200);
        await S.foto(`${tag}-${num}-${CAT[num]}-completo`, false);
      } catch (e) { problemas.push(`${tag}-${num}-${CAT[num]}-completo: ${String(e.message).split('\n')[0]}`); }
      await page.setViewportSize(vp);
      await page.waitForTimeout(100);
    },
  };
  return S;
}

/* ---------- Pasos comunes ---------- */
async function abrirCajon(S) {
  const { page, cfg } = S;
  await page.click(cfg.vp.width <= 900 ? '.fab' : '.cab-acc [data-accion="nueva"]');
  await page.waitForSelector('#cajon:not([hidden])');
}
async function rellenarCajon(S) {
  const { page } = S;
  await page.fill('#f-hora', '15:42');
  await page.click('#cajon [data-accion="ct-mas"]');
  await page.fill('#f-stop', '12');
  await page.locator('#f-setup label', { hasText: 'Patrón Gonzi' }).click();
  await page.fill('#f-imp', '720');
  await page.setInputFiles('#f-cap', { name: 'atas-nq.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svgCaptura(11, true, true)) });
  await page.waitForSelector('#zona-cap .previa img');
  await page.fill('#f-nota', 'Patrón Gonzi en el mínimo de ayer, con absorción en el footprint. Esperé la confirmación antes de entrar.');
  await page.locator('#f-errores label', { hasText: 'Salida antes de tiempo' }).click();
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); document.querySelector('#c-imp').scrollIntoView({ block: 'center' }); });
}
async function responder(S, pos) { await S.page.click(`.opciones .opcion[data-pos="${pos}"]`); await S.page.waitForSelector('.opciones .opcion:disabled'); }
// Tras responder en un test con explicación: pasa a la siguiente o al resultado. Devuelve false cuando ya está en el resultado.
async function seguir(S) {
  const { page } = S;
  if (await page.locator('[data-accion="ver-resultado"]').count()) { await page.click('[data-accion="ver-resultado"]'); await page.waitForSelector('.res-hero'); return false; }
  const antes = await page.locator('.p-num').textContent();
  await page.click('.preg-nav [data-accion="siguiente"]');
  await page.waitForFunction((t) => { const e = document.querySelector('.p-num'); return e && e.textContent !== t; }, antes);
  return true;
}
// Responde lo que queda de un test con explicación; elige(i) dice la posición a pulsar en la pregunta i (0 = la correcta)
async function terminarTest(S, elige, desde) {
  for (let i = desde || 0; i < 60; i++) { await responder(S, elige(i)); if (!(await seguir(S))) return; }
  throw new Error('el test no termina');
}
// En un examen (sin explicación): responde y avanza; devuelve false en la última pregunta
async function responderExamen(S, pos) {
  const { page } = S;
  await page.click(`.opciones .opcion[data-pos="${pos}"]`);
  await page.waitForSelector('.opciones .opcion.elegida');
  if (!(await page.locator('.preg-nav [data-accion="siguiente"]').count())) return false;
  const antes = await page.locator('.p-num').textContent();
  await page.click('.preg-nav [data-accion="siguiente"]');
  await page.waitForFunction((t) => { const e = document.querySelector('.p-num'); return e && e.textContent !== t; }, antes);
  return true;
}

/* ---------- Escenas ---------- */
const ESCENAS = [];
const escena = (id, nums, fn, servidor) => ESCENAS.push({ id, nums, fn, servidor: !!servidor });

escena('resumen', ['01', '02', '03', '04'], async (S) => {
  const { page, cfg } = S;
  await S.abrir('#diario');
  await S.shot('01', { arriba: true, espera: 1400, expect: ['#curva svg', '#kpis .kcard', '#insights .insight', '#calendario .cal', '#tabla table'] });
  if (S.quiere('02')) {
    await page.click('.seg-oscuro [data-periodo="todo"]');
    await S.fuera();
    await S.shot('02', { espera: 1400, expect: ['.seg-oscuro [data-periodo="todo"][aria-pressed="true"]', '#curva svg', '#tabla table'] });
    await page.click('.seg-oscuro [data-periodo="mes"]');
  }
  if (S.quiere('03')) {
    const svg = page.locator('#curva svg');
    await svg.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    if (cfg.movil) { await svg.focus(); for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowRight'); } else { const b = await svg.boundingBox(); await page.mouse.move(b.x + b.width * 0.64, b.y + b.height * 0.45, { steps: 8 }); }
    await S.shot('03', { full: false, raton: true, expect: ['#curva .tip', '#curva .h-cursor'] });
    await S.fuera();
  }
  if (S.quiere('04')) {
    await page.locator('#insights .insight').first().click();
    await S.fuera();
    await page.waitForSelector('#filtros .chip-f');
    await S.shot('04', { full: false, espera: 1100, expect: ['#filtros .chip-f', '#tabla table'] });
  }
});

escena('numeros', ['05', '06', '07'], async (S) => {
  const { page, cfg } = S;
  await S.abrir('#diario/estadisticas');
  await S.shot('05', { arriba: true, espera: 1100, expect: ['#est .kpis4 .kcard', '#est .num-grid', '#est .bv .bv-barra', '#est .est-t'] });
  if (S.quiere('06')) {
    const col = page.locator('#est .bv').first().locator('.bv-col:has(.bv-val)').last();
    await col.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    if (cfg.movil) await col.focus(); else await col.hover();
    await S.shot('06', { full: false, raton: true, expect: ['#tip-g'] });
    await S.fuera();
  }
  await S.ir('#diario/plan');
  await page.waitForSelector('#ia-cuerpo .inf, #ia-cuerpo .ia-vacio');
  await S.shot('07', { arriba: true, espera: 900, expect: ['#form-plan', '#form-cuenta', '#cumple .cu', '#ia-cuerpo .inf'] });
});

escena('operacion', ['08', '09', '10'], async (S) => {
  const { page } = S;
  await S.abrir('#diario');
  await page.locator('#tabla tr.op .chev').first().click();
  await page.waitForSelector('#tabla tr.detalle .det-cap img[src]');
  await page.evaluate(() => { document.querySelector('#tabla tr.op.abierta').scrollIntoView({ block: 'start' }); window.scrollBy(0, -110); });
  await S.fuera();
  await S.shot('08', { full: false, espera: 700, expect: ['#tabla tr.detalle .det-grid', '#tabla tr.detalle .det-alex'] });
  await page.click('#tabla tr.detalle [data-accion="borrar"]');
  await page.waitForSelector('[data-accion="borrar-si"]');
  await page.evaluate(() => { document.querySelector('.detalle-acc').scrollIntoView({ block: 'center' }); });
  await S.fuera();
  await S.shot('09', { full: false, expect: ['[data-accion="borrar-si"]', '[data-accion="borrar-no"]'] });
  await page.click('[data-accion="borrar-no"]');
  await page.locator('#tabla tr.op .mini-cap').first().click();
  await page.waitForSelector('#visor:not([hidden]) #visor-img[src]');
  await S.shot('10', { full: false, expect: ['#visor', '#visor-img'] });
});

escena('cajon', ['11', '12', '13', '14', '15', '16'], async (S) => {
  const { page } = S;
  await S.abrir('#diario');
  await page.waitForTimeout(700);
  await abrirCajon(S);
  await S.shot('11', { full: false, expect: ['#cajon', '#form-op', '#zona-cap .subida'] });
  if (S.quiere('12')) {
    await page.click('#btn-guardar-op');
    await page.waitForSelector('#form-error:not([hidden])');
    await S.shotDialogo('12', '.cajon-cuerpo', { espera: 700, expect: ['#form-error', '.campo.invalido'] });
  }
  if (!S.alguna('13', '14', '15', '16')) return;
  await rellenarCajon(S);
  await S.shotDialogo('13', '.cajon-cuerpo', { expect: ['#zona-cap .previa img', '#f-r.pos', '#pie-res.pos'] });
  if (!S.alguna('14', '15', '16')) return;
  await page.click('#btn-guardar-op');
  await page.waitForSelector('#toast:not([hidden])');
  await page.waitForSelector('#tabla tr.op.abierta');
  await S.shot('14', { full: false, espera: 600, expect: ['#toast', '#tabla tr.op.abierta'] });
  if (!S.alguna('15', '16')) return;
  await S.ir('#diario/plan');
  await page.fill('#ct-firma', 'Apex Trader Funding');
  await page.fill('#ct-tamano', '50000');
  await page.fill('#ct-dd', '2500');
  await page.fill('#ct-limite', '1000');
  await page.fill('#ct-obj', '3000');
  await page.fill('#ct-desde', '2026-10-01');
  await page.click('#form-cuenta button[type="submit"]');
  await page.waitForSelector('.cta-res');
  await S.fuera();
  await S.shot('15', { espera: 800, expect: ['.cta-res .cta-gauge', '.cta-res .cta-datos', '#form-cuenta'] });
  await S.ir('#diario');
  await page.waitForSelector('#hoy-fila .hoy-card');
  await page.evaluate(() => { document.querySelector('#hoy-fila').scrollIntoView({ block: 'center' }); });
  await S.shot('16', { full: false, espera: 1300, expect: ['#hoy-fila a.hoy-card .hoy-barra', '#hoy-fila .hoy-card.rut'] });
});

escena('importar', ['17', '18', '19', '20', '21'], async (S) => {
  const { page } = S;
  await S.abrir('#diario');
  await page.waitForTimeout(700);
  await page.click('.cab-acc [data-accion="importar"]');
  await page.waitForSelector('#imp:not([hidden]) .subida');
  await S.shotDialogo('17', '#imp', { expect: ['#imp .imp-pasos', '#imp .subida', '#imp-tz'] });
  await page.setInputFiles('#imp-file', { name: 'notas.csv', mimeType: 'text/csv', buffer: Buffer.from('uno;dos\n1;2\n') });
  await page.waitForSelector('#imp .error');
  await S.shotDialogo('19', '#imp', { expect: ['#imp .error'] });
  await page.setInputFiles('#imp-file', { name: 'ATAS_statistics_2026-10-30.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV_ATAS) });
  await page.waitForSelector('#imp .imp-res');
  await S.shotDialogo('18', '#imp', { expect: ['#imp .imp-res', '#imp .imp-tabla', '#imp .imp-cuentas'] });
  await page.click('#imp [data-accion="imp-ok"]');
  await page.waitForSelector('#avisos-diario .aviso-d');
  await S.shot('20', { espera: 1400, expect: ['#avisos-diario .aviso-d', '#tabla .etq-atas', '#tabla .etq-falta'] });
  await page.click('[data-accion="completar-sig"]');
  await page.waitForSelector('#cajon.atas:not([hidden])');
  await S.shotDialogo('21', '.cajon-cuerpo', { expect: ['#atas-res', '#f-setup'] });
});

escena('rutina-paleta', ['22', '23', '25', '26'], async (S) => {
  const { page, cfg } = S;
  await S.abrir('#diario');
  await page.waitForTimeout(700);
  await page.click('[data-accion="rutina"][data-modo="pre"]');
  await page.waitForSelector('#rut:not([hidden]) .rut-checks');
  for (const i of [0, 1, 2]) await page.locator('#rut .pl-check').nth(i).click();
  await page.locator('#rut .rut-esc').nth(0).locator('label').nth(3).click();
  await page.locator('#rut .rut-esc').nth(1).locator('label').nth(2).click();
  await page.fill('#rut-nota', 'Vigilo el mínimo de ayer y la Put Wall de 24.400. Si pierdo dos seguidas, cierro.');
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await S.shotDialogo('22', '#rut', { expect: ['#rut .rut-checks', '#rut .rut-botones'] });
  await page.click('#rut [data-accion="guardar-rut"]');
  await page.waitForSelector('#rut', { state: 'hidden' });
  await S.sinToast();
  await page.click('[data-accion="rutina"][data-modo="post"]');
  await page.waitForSelector('#rut:not([hidden]) #rut-mejora');
  await page.locator('#rut .rut-esc').nth(0).locator('label').nth(3).click();
  await page.fill('#rut-mejora', 'No entrar hasta ver la absorción confirmada');
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await S.shotDialogo('23', '#rut', { expect: ['#rut-mejora', '#rut .rut-botones'] });
  await page.locator('#rut [data-accion="cerrar-rut"]').first().click();
  await page.waitForSelector('#rut', { state: 'hidden' });
  await S.sinToast();
  if (cfg.movil) await page.click('.buscar'); else await page.keyboard.press('Control+k');
  await page.waitForSelector('#paleta:not([hidden]) .pal-op');
  await S.shot('25', { full: false, expect: ['#paleta .paleta', '#paleta .pal-op.act', '#paleta .pal-grupo'] });
  await page.fill('#paleta-in', 'operaciones');
  await S.shot('26', { full: false, expect: ['#paleta .pal-op.act'] });
});

escena('formacion', ['30', '31', '32', '33', '34', '35', '36'], async (S) => {
  const { page } = S;
  await S.abrir('#formacion');
  await S.shot('30', { arriba: true, espera: 1300, expect: ['.ruta-hero .f-anillo', '.ruta-datos', '.niv[open] .lec-fila', '.niv .niv-barra'] });
  await S.ir('#formacion/l/n1-1');
  await page.waitForSelector('.lec-teoria');
  await S.shot('31', { arriba: true, espera: 700, expect: ['.lec-teoria .lec-clave', '.lec-test [data-accion="test-leccion"]'] });
  if (!S.alguna('32', '33', '34', '35', '36')) return;
  await page.click('[data-accion="test-leccion"]');
  await page.waitForSelector('.quiz-grid .opcion');
  await S.fuera();
  await S.shot('32', { arriba: true, espera: 800, expect: ['.opciones .opcion:not(:disabled)', '.q-barra', '.navegador .nq.actual', '.racha'] });
  await responder(S, 0);
  await S.fuera();
  await S.shot('33', { expect: ['.opcion.bien', '.veredicto-txt.pos', '.nq.bien'] });
  if (!S.alguna('34', '35', '36')) return;
  await seguir(S);
  await responder(S, 1);
  await S.fuera();
  await S.shot('34', { expect: ['.opcion.mal', '.opcion.bien', '.veredicto-txt.neg', '.nq.mal'] });
  await seguir(S);
  await terminarTest(S, () => 0, 2);
  await S.sinConfeti();
  await S.fuera();
  await S.shot('35', { espera: 900, expect: ['.res-hero .f-anillo', '.res-hero .veredicto:not(.no)', '.navegador .nq.bien'] });
  if (!S.quiere('36')) return;
  await page.click('.res-acc [data-accion="repetir"]');
  await page.waitForSelector('.quiz-grid .opcion:not(:disabled)');
  await terminarTest(S, (i) => (i < 5 ? 1 : 0));
  await S.fuera();
  await S.shot('36', { espera: 900, expect: ['.res-hero .veredicto.no', '.fallos .fallo'] });
});

escena('examen', ['37', '38', '39', '40', '41', '42'], async (S) => {
  const { page, ctx } = S;
  await S.abrir('#formacion/libre');
  await page.waitForSelector('.modos .tcard-ex');
  await S.shot('41', { arriba: true, espera: 1300, expect: ['.hero-form .radar', '.modos .tcard-ex', '.ruta .ruta-b[aria-pressed="true"]', '.tgrid .tcard'] });
  if (!S.alguna('37', '38', '39', '40', '42')) return;
  await page.click('.modos [data-accion="examen"]');
  await page.waitForSelector('#reloj');
  for (const pos of [0, 1, 0]) await responderExamen(S, pos);
  await S.fuera();
  await S.shot('37', { arriba: true, espera: 700, expect: ['#reloj', '.navegador .nq.resp', '.navegador .nq.actual', '.resumen-ex', '[data-accion="entregar"]'] });
  if (S.quiere('38')) {
    await ctx.clock.setFixedTime(new Date(FECHA.getTime() + 28 * 60000 + 40000));
    await page.waitForSelector('#reloj.poco');
    await S.arribaDelTodo();
    await S.shot('38', { full: false, espera: 300, expect: ['#reloj.poco'] });
    await ctx.clock.setFixedTime(FECHA);
    await page.waitForSelector('#reloj:not(.poco)');
  }
  await page.click('[data-accion="entregar"]');
  await page.waitForSelector('.res-hero .veredicto.no');
  await S.fuera();
  await S.shot('39', { espera: 900, expect: ['.res-hero .veredicto.no', '.fallos .fallo'] });
  if (S.quiere('42')) {
    await page.click('.quiz-cab [data-accion="temario"]');
    await page.waitForSelector('.tgrid .tcard[data-tema="footprint"]');
    await page.click('.tgrid .tcard[data-tema="footprint"]');
    await page.waitForSelector('.quiz-grid .opcion');
    for (let i = 0; i < 12 && !(await page.locator('.preg-cuerpo .figura svg').count()); i++) { await responder(S, 0); await seguir(S); }
    await S.fuera();
    await S.shot('42', { expect: ['.preg-cuerpo .figura svg', '.opciones .opcion:not(:disabled)'] });
  }
  if (S.quiere('40')) {
    await S.ir('#formacion');
    await page.waitForSelector('.niv[open] [data-accion="examen-nivel"]');
    await page.locator('.niv[open] [data-accion="examen-nivel"]').first().click();
    await page.waitForSelector('#reloj');
    for (let i = 0; i < 80; i++) if (!(await responderExamen(S, 0))) break;
    await page.click('[data-accion="entregar"]');
    await page.waitForSelector('.res-hero .veredicto');
    await S.sinConfeti();
    await S.fuera();
    await S.shot('40', { espera: 900, expect: ['.res-hero .veredicto:not(.no)'] });
  }
});

/* Tests de los directos (modo ejemplo). El estado se siembra en localStorage para llegar a «con progreso» y «todo respondido» sin responder clip a clip.
   Las categorías de la portada son plegables y lo que se abre a mano se recuerda (localStorage «agx-directos-cats»): cada siembra lo borra, para capturar
   siempre lo que sale por defecto. Las variantes «-abierta» (43 y 49) abren una categoría a mano para ver sus tarjetas. */
async function sembrarDirectos(S, nums, fallados, hash) {
  const { page } = S;
  await page.evaluate(({ dir }) => { const k = 'agx-alumnos-v4', s = JSON.parse(localStorage.getItem(k)); s.directos = dir; localStorage.setItem(k, JSON.stringify(s)); localStorage.removeItem('agx-directos-cats'); }, { dir: respuestasDirectos(nums, fallados) });
  await page.goto('about:blank');
  await S.abrir(hash);
}
// La portada del clip tiene que estar cargada antes de capturar (el vídeo no se pide: preload="none")
async function portadaLista(S) { await S.page.waitForFunction(() => { const v = document.getElementById('dir-video'); if (!v) return false; if (!v._p) { v._p = new Image(); v._p.src = v.poster; } return v._p.complete && v._p.naturalWidth > 0; }, null, { timeout: 10000 }); }
async function responderDirecto(S, bien) {
  const { page } = S;
  const n = Number(/directos\/(\d+)/.exec(page.url())[1]), d = DIRECTOS[n - 1];
  await page.click(`.dir-test [data-accion="dir-opcion"][data-o="${bien ? d.correcta : (d.correcta + 1) % 4}"]`);
  await page.waitForSelector('#dir-video');
  await portadaLista(S);
}
// Variante «-abierta» de una captura de la portada: se pulsa la cabecera de una categoría y se captura la página entera
async function abrirCategoria(S, num, cat, expect) {
  const { page } = S, nombre = `${S.tag}-${num}-${CAT[num]}-abierta`;
  try {
    await page.click(`details.dir-cat[data-c="${cat}"] > summary`);
    await S.fuera(); await S.sinTransicion(); await page.waitForTimeout(500);
    for (const sel of expect || []) if (!(await page.locator(sel).first().isVisible())) throw new Error('no se ve «' + sel + '»');
    await S.foto(nombre, true);
  } catch (e) { problemas.push(`${nombre}: ${String(e.message).split('\n')[0]}`); }
}
escena('directos', ['43', '44', '45', '46', '47', '48', '49'], async (S) => {
  const { page } = S;
  if (!DIRECTOS.length) throw new Error('no encuentro const DIRECTOS en index.html');
  await S.abrir('#formacion/directos');
  await page.waitForSelector('.dir-hero');
  await S.shot('43', { arriba: true, espera: 1300, expect: ['.dir-hero .dir-anillo', '.sub-tabs a[aria-current="page"][href="#formacion/directos"]', 'details.dir-cat.actual > summary', 'details.dir-cat:not([open]) .niv-chev'] });
  if (S.quiere('43')) await abrirCategoria(S, '43', 'C', ['.dir-cat[open] .dir-card.sig', '.dir-cat[open] .dir-card.pend']);
  if (!S.alguna('44', '45', '46', '47', '48', '49')) return;
  await S.ir('#formacion/directos/13');
  await page.waitForSelector('.dir-test.fresco .opcion');
  await S.fuera();
  await S.shot('44', { arriba: true, espera: 700, expect: ['.dir-test.fresco .opcion:not(:disabled)', '.dir-pantalla.apagada'] });
  if (!S.alguna('45', '46', '47', '48', '49')) return;
  await responderDirecto(S, true);
  await S.fuera();
  // «-ventana»: lo que ve el alumno justo después de responder. Se espera 1,3 s: Chromium enseña un instante su indicador de carga al crear el <video>
  if (S.quiere('45')) { await S.quieto(); await page.waitForTimeout(1300); await S.foto(`${S.tag}-45-${CAT['45']}-ventana`, false); }
  await S.shot('45', { espera: 700, expect: ['.opcion.bien', '.veredicto-txt.pos', '#dir-video', '.dir-exp', '[data-accion="dir-sig"]'] });
  if (!S.alguna('46', '47', '48', '49')) return;
  await page.click('[data-accion="dir-sig"]');
  await page.waitForSelector('.dir-test.fresco .opcion');
  await S.sinTransicion();
  await responderDirecto(S, false);
  await S.fuera();
  if (S.quiere('46')) { await S.quieto(); await page.waitForTimeout(1300); await S.foto(`${S.tag}-46-${CAT['46']}-ventana`, false); }
  await S.shot('46', { espera: 700, expect: ['.opcion.mal', '.opcion.bien', '.veredicto-txt.neg', '.fallo-buena', '#dir-video'] });
  if (!S.alguna('47', '48', '49')) return;
  await sembrarDirectos(S, [1, 2, 3, 4, 5, 6, 7, 8, 13, 14, 15, 16, 17, 18, 19, 30, 31, 39], [3, 7, 14, 17, 31], '#formacion/directos');
  await page.waitForSelector('.dir-hero');
  await S.shot('47', { arriba: true, espera: 1300, expect: ['.dir-hechas > summary', '.dir-card.sig', '.dir-card.pend', '[data-accion="dir-fallos"]', '.dir-barra .g', '.dir-barra .p'] });
  // «-respondidas»: la misma portada con el plegable «Ver las N respondidas» de la categoría abierta desplegado (tarjetas con estado y título del clip)
  if (S.quiere('47')) {
    const nombre = `${S.tag}-47-${CAT['47']}-respondidas`;
    try {
      await page.click('details.dir-cat[open] .dir-hechas > summary');
      await S.fuera(); await S.sinTransicion(); await page.waitForTimeout(500);
      for (const sel of ['.dir-hechas[open] .dir-card.ok', '.dir-hechas[open] .dir-card.ko', '.dir-hechas[open] .dir-vid']) if (!(await page.locator(sel).first().isVisible())) throw new Error('no se ve «' + sel + '»');
      await S.foto(nombre, true);
    } catch (e) { problemas.push(`${nombre}: ${String(e.message).split('\n')[0]}`); }
  }
  if (S.quiere('48')) {
    await page.click('[data-accion="dir-fallos"]');
    await page.waitForSelector('.dir-test.fresco .opcion');
    await S.sinTransicion();
    await S.fuera();
    await S.shot('48', { espera: 700, expect: ['.dir-rep', '.dir-test.fresco .opcion:not(:disabled)', '.dir-pantalla.apagada'] });
  }
  if (!S.quiere('49')) return;
  await sembrarDirectos(S, DIRECTOS.map((d, i) => i + 1), [7, 21, 33], '#formacion/directos');
  await page.waitForSelector('.dir-hero');
  await S.shot('49', { arriba: true, espera: 1300, expect: ['.dir-hero [data-accion="dir-fallos"]', 'details.dir-cat:not([open]) > summary'] });
  await abrirCategoria(S, '49', 'E', ['.dir-cat[open] .dir-card.ok', '.dir-cat[open] .dir-card.ko']);
});

escena('ranking', ['50', '51'], async (S) => {
  const { page } = S;
  await S.abrir('#ranking');
  await page.waitForSelector('.rk-podio .rk-pd');
  await S.shot('50', { arriba: true, espera: 1300, expect: ['.rk-podio .rk-pd.p1 .rk-corona', '.rk-cel', '#rk-lista .rk-fila.yo', '.rk-feed .rk-ev', '.rk-pasos'] });
  if (!S.quiere('51')) return;
  await page.click('[data-accion="rk-periodo"][data-p="historico"]');
  await S.fuera();
  await S.shot('51', { espera: 900, expect: ['[data-accion="rk-periodo"][data-p="historico"][aria-pressed="true"]', '#rk-lista .rk-fila'] });
});

escena('srv-alumno', ['60', '61', '62', '63', '64', '65'], async (S) => {
  const { page } = S;
  S.srv.yo = 'alumno';
  await page.goto(SRV + '#diario');
  await page.waitForSelector('#vista .hero-diario');
  await S.shot('60', { arriba: true, espera: 1500, expect: ['#avisos-diario .aviso-d', '#hoy-fila a.hoy-card', '#tabla .etq-atas', '#errores .err-lista'].concat(S.cfg.vp.width > 900 ? ['#alumno-sub .salir'] : []) });
  await S.ir('#formacion');
  await page.waitForSelector('.niveles .niv');
  await S.shot('61', { espera: 1200, expect: ['.niv-est.ok', '.niv.actual[open] .lec-chip.ok', '.niv-est.cerr'] });
  await S.ir('#formacion/l/n3-1');
  await page.waitForSelector('.lec-bloq');
  await S.shot('62', { full: false, expect: ['.lec-bloq .lec-bloq-ico'] });
  await S.ir('#diario/plan');
  await page.waitForSelector('#ia-cuerpo .inf');
  await S.shot('63', { espera: 900, expect: ['.cta-res .cta-gauge', '#cumple .cu', '#ia-cuerpo .inf[open] .inf-nota', '#ia-cuerpo .inf-caps'] });
  await S.ir('#diario/estadisticas');
  await page.waitForSelector('#est .kcard');
  await S.shot('65', { espera: 1100, expect: ['#est .est-rut', '#est-errores .err-lista'] });
  await S.ir('#ranking');
  await page.waitForSelector('.rk-sync.vivo');
  await S.shot('64', { espera: 1200, expect: ['.rk-sync.vivo', '#rk-lista .rk-fila.yo', '.rk-ev-pie a'] });
}, true);

escena('srv-entrada', ['70', '71', '72', '73', '74'], async (S) => {
  const { page } = S;
  const casos = [['70', 'cargando', '', '.entrada-carga'], ['71', 'login', '', 'a.boton-dc'], ['72', 'login', '?error=login', '.entrada-error'], ['73', 'sin_acceso', '', 'a.boton-dc'], ['74', 'error', '', 'button.boton-dc']];
  for (const [num, modo, query, sel] of casos) {
    if (!S.quiere(num)) continue;
    S.srv.yo = modo;
    await page.goto(SRV + query);
    await page.waitForSelector('#entrada:not([hidden]) ' + sel);
    if (modo !== 'cargando') await page.waitForSelector('#entrada-t');
    await S.shot(num, { full: false, espera: 700, expect: ['#entrada .entrada-caja', '#entrada .marca-agx', '#entrada ' + sel] });
    if (S.srv.pendiente) { await S.srv.pendiente.abort().catch(() => {}); S.srv.pendiente = null; }
  }
}, true);

escena('srv-admin', ['80', '81', '82', '83'], async (S) => {
  const { page } = S;
  S.srv.yo = 'admin';
  await page.goto(SRV + '#alumnos');
  await page.waitForSelector('.al-grid .al-card');
  await S.shot('80', { arriba: true, espera: 1100, expect: ['#nav-alumnos', '.kpis4 .kcard', '.al-card .al-stats', '.al-card .al-pend', '#al-buscar'] });
  await S.ir('#alumnos/' + ID_LUCIA);
  await page.waitForSelector('.rev-cab');
  await page.waitForSelector('#tabla tr.op');
  await S.shot('81', { espera: 1400, expect: ['.rev-cab .rk-av', '#curva svg', '#tabla table'] });
  await page.locator('#tabla tr.op .chev').nth(2).click();
  await page.waitForSelector('#tabla tr.detalle .rev-com textarea');
  await page.fill('#tabla tr.detalle .rev-com textarea', 'Buena lectura de la absorción. La próxima vez espera el cierre de la vela antes de entrar.');
  await page.click('#tabla tr.detalle [data-accion="guardar-com"]');
  await page.waitForSelector('#toast:not([hidden])');
  await page.evaluate(() => { document.querySelector('#tabla tr.op.abierta').scrollIntoView({ block: 'start' }); window.scrollBy(0, -110); });
  await S.fuera();
  await S.shot('82', { full: false, espera: 500, expect: ['#tabla tr.detalle .rev-com textarea', '#tabla tr.detalle .rev-estado', '#toast'] });
  await S.ir('#alumnos/' + ID_LUCIA + '/plan');
  await page.waitForSelector('#ia-cuerpo .inf');
  await S.shot('83', { espera: 900, expect: ['#form-plan', '.cta-res', '#ia-cuerpo .inf'] });
}, true);

/* ---------- Ejecución ---------- */
const reintentos = [];
async function unaVez(browser, tag, cfg, esc, nums) {
  const out = { prob: [], errs: [], mani: [] };
  const srv = { yo: 'alumno', pendiente: null };
  const ctx = await nuevoContexto(browser, cfg, srv);
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => out.errs.push(`[${tag} · ${esc.id}] ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_(FAILED|ABORTED|BLOCKED_BY_CLIENT)|status of (401|403|404|500)/.test(m.text())) out.errs.push(`[${tag} · ${esc.id}] consola: ${m.text().slice(0, 300)}`); });
  const S = crearSesion(tag, cfg, ctx, page, srv, nums, out);
  try { await esc.fn(S); } catch (e) {
    const faltan = nums.filter((n) => S.quiere(n) && !S.hechas.has(n));
    out.prob.push(`${tag} · escena ${esc.id}: ${String(e.message).split('\n')[0]}${faltan.length ? ' (sin capturar: ' + faltan.join(', ') + ')' : ''}`);
  }
  await ctx.close().catch(() => {});
  return out;
}
async function correr(browser, tag, esc) {
  const cfg = TAGS[tag];
  const nums = esc.nums.filter((n) => cfg.todo || PRINCIPALES.has(n));
  if (!nums.length) return;
  if (SOLO && !nums.some((n) => SOLO.test(`${tag}-${n}-${CAT[n]}`))) return;
  let out;
  for (let intento = 1; intento <= 2; intento++) {
    out = await unaVez(browser, tag, cfg, esc, nums);
    // Con la máquina cargada, Chromium puede cortar una transición de vista por tiempo: no es un fallo de la web; se repite la escena una vez
    const cortada = out.errs.some((e) => /Transition was (aborted|skipped)/.test(e));
    if ((!cortada && !out.prob.length) || intento === 2) break;
    reintentos.push(`${tag} · ${esc.id}${cortada ? ' (transición de vista cortada)' : ' (' + out.prob[0] + ')'}`);
  }
  out.prob.forEach((x) => problemas.push(x));
  out.errs.forEach((x) => erroresPagina.add(x));
  out.mani.forEach((x) => { const i = manifiesto.findIndex((m) => m.nombre === x.nombre); if (i >= 0) manifiesto[i] = x; else manifiesto.push(x); });
}

(async () => {
  const t0 = Date.now();
  if (!ARCHIVO) problemas.push('fuentes: no se han encontrado los woff2 en ' + FONTS + ' (se captura con la tipografía de reserva)');
  try { const r = await fetch(BASE); if (!r.ok) throw new Error('HTTP ' + r.status); INDEX_HTML = await r.text(); DIRECTOS = leerDirectos(INDEX_HTML); } catch (e) { console.error('FALLO: no responde ' + BASE + ' (' + e.message + ')'); process.exit(1); }
  // LANG en español: los campos de fecha y hora se pintan como dd/mm/aaaa y en 24 horas
  const opciones = { env: Object.assign({}, process.env, { LANG: 'es_ES.UTF-8', LC_ALL: 'es_ES.UTF-8', LANGUAGE: 'es_ES:es' }) };
  if (process.env.CANAL) opciones.channel = process.env.CANAL;
  const browser = await chromium.launch(opciones);
  const cola = [];
  for (const tag of Object.keys(TAGS)) for (const esc of ESCENAS) cola.push([tag, esc]);
  const total = cola.length; let hechos = 0;
  await Promise.all(Array.from({ length: JOBS }, async () => {
    for (;;) {
      const j = cola.shift(); if (!j) return;
      await correr(browser, j[0], j[1]);
      hechos++;
      if (process.stdout.isTTY) process.stdout.write(`\r${hechos}/${total} escenas `);
    }
  }));
  await browser.close();
  manifiesto.sort((a, b) => a.nombre.localeCompare(b.nombre));
  fs.writeFileSync(path.join(OUT, 'capturas.json'), JSON.stringify({ base: BASE, fecha: FECHA.toISOString(), capturas: manifiesto }, null, 1));
  if (process.env.SIN_CONTACTO !== '1' && manifiesto.length) {
    const r = spawnSync('python3', ['-I', path.join(__dirname, 'agx-contact.py'), OUT], { encoding: 'utf8' });
    if (r.status !== 0) problemas.push('hojas de contacto: ' + String(r.stderr || r.error || '').trim().split('\n').pop());
    else process.stdout.write(r.stdout);
  }
  const porTag = {}; manifiesto.forEach((m) => { porTag[m.tag] = (porTag[m.tag] || 0) + 1; });
  console.log(`\nCAPTURAS: ${manifiesto.length} en ${OUT} (${Object.keys(porTag).map((k) => k + ' ' + porTag[k]).join(', ')}) en ${Math.round((Date.now() - t0) / 1000)} s`);
  if (bloqueadas.size) console.log('PETICIONES EXTERNAS CORTADAS: ' + Array.from(bloqueadas).join(', '));
  if (reintentos.length) console.log('ESCENAS REPETIDAS: ' + reintentos.join('; '));
  console.log('PROBLEMAS DE CAPTURA: ' + (problemas.length ? '\n  - ' + problemas.join('\n  - ') : 'ninguno'));
  console.log('ERRORES DE PÁGINA: ' + (erroresPagina.size ? '\n  - ' + Array.from(erroresPagina).join('\n  - ') : 'ninguno'));
  process.exit(problemas.length || erroresPagina.size ? 2 : 0);
})().catch((e) => { console.error('FALLO: ' + e.message); process.exit(1); });
