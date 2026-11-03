// Informes del plan: comprobación exacta de reglas + texto del agente de IA. Se guardan en u/{id}/informes.
import { planNormal, planGuardado, evaluarPeriodo, huellaOps, sumarDias, hhmm, horaEn } from './plan.mjs';
import { pedirIA, iaActiva, MODELO } from './ia.mjs';

const MAX_INFORMES = 90;
const MAX_CAPTURAS = 6; // capturas que se mandan a la IA por análisis
const MAX_CAPTURA_BYTES = 1.6e6;

export const fechaMadrid = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));

export async function idsAlumnos(store) {
  const ids = new Set();
  const { blobs, directories } = await store.list({ prefix: 'u/', directories: true });
  (directories || []).forEach((d) => { const m = String(d).match(/u\/(\d+)/); if (m) ids.add(m[1]); });
  (blobs || []).forEach((b) => { const m = String(b.key).match(/^u\/(\d+)\//); if (m) ids.add(m[1]); });
  return [...ids];
}

export const leerInformes = async (store, id) => (await store.get(`u/${id}/informes`, { type: 'json' })) || {};
export const listaInformes = (mapa) => Object.values(mapa || {}).sort((a, b) => String(b.hasta).localeCompare(String(a.hasta)) || String(b.creado).localeCompare(String(a.creado)));

const opsDe = (datos, desde, hasta) => (datos.trades || []).filter((t) => !t.ejemplo && t.fecha >= desde && t.fecha <= hasta);

// Huella de lo analizado: si el alumno cambia operaciones o plan, el informe sale como desactualizado
export function huellaPeriodo(datos, tipo, fecha) {
  const desde = tipo === 'semana' ? sumarDias(fecha, -6) : fecha;
  const p = planNormal(datos.plan);
  return huellaOps(opsDe(datos, desde, fecha)) + '.' + String(p.actualizado || '');
}

// Capturas de ATAS de las operaciones del periodo (las más recientes primero, hasta MAX_CAPTURAS)
async function capturasDe(store, id, trades, zona) {
  const out = [];
  const lista = trades.slice(-MAX_CAPTURAS);
  for (const t of lista) {
    try {
      const v = await store.get(`u/${id}/cap/${t.id}`);
      if (!v || typeof v !== 'string' || v.length > MAX_CAPTURA_BYTES || !v.startsWith('data:image/')) continue;
      const i = trades.indexOf(t) + 1;
      const h = t.hEnt ? hhmm(horaEn(t.hEnt, zona)) : 'sin hora';
      out.push({ etiqueta: `${i}ª operación, ${t.fecha} ${h}, ${t.inst} ${t.dir === 'L' ? 'largo' : 'corto'}${t.setup ? ', setup ' + t.setup : ''}`, dataUrl: v });
    } catch (e) { /* sin captura */ }
  }
  return out;
}

export async function generarInforme({ store, id, nombre, datos, tipo, fecha, origen, timeoutMs }) {
  const plan = planNormal(datos.plan);
  if (!planGuardado(plan)) { const e = new Error('sin_plan'); e.codigo = 'sin_plan'; throw e; }
  const zona = plan.zona || 'Europe/Madrid';
  const desde = tipo === 'semana' ? sumarDias(fecha, -6) : fecha;
  const trades = opsDe(datos, desde, fecha).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hEnt || 0) - (b.hEnt || 0));
  if (!trades.length) { const e = new Error('sin_operaciones'); e.codigo = 'sin_operaciones'; throw e; }
  const periodo = evaluarPeriodo(plan, trades, desde, fecha, zona);
  const contexto = evaluarPeriodo(plan, datos.trades || [], sumarDias(fecha, -29), fecha, zona);
  const mapa = await leerInformes(store, id);
  const previo = listaInformes(mapa).find((x) => x.ia && x.hasta < fecha) || null;

  let ia = null;
  if (iaActiva()) {
    const imagenes = await capturasDe(store, id, trades, zona);
    ia = await pedirIA({ nombre, tipo, desde, hasta: fecha, plan, periodo, trades, contexto, previo, cuenta: datos.cuenta, rutinas: datos.rutinas, todas: datos.trades, imagenes }, { timeoutMs });
  }

  const informe = {
    clave: `${tipo}:${fecha}`, tipo, origen, desde, hasta: fecha, creado: new Date().toISOString(),
    huella: huellaPeriodo(datos, tipo, fecha), n: periodo.n, neto: Math.round(periodo.neto * 100) / 100,
    diasOk: periodo.diasOk, dias: periodo.dias.length, pctReglas: periodo.pctReglas,
    detalle: periodo.dias.map((d) => ({ fecha: d.fecha, n: d.n, neto: Math.round(d.neto * 100) / 100, ok: d.ok, cumplidas: d.cumplidas, aplicables: d.aplicables,
      reglas: d.reglas.map((r) => ({ id: r.id, nombre: r.nombre, ok: r.ok, detalle: r.detalle })) })),
    ia, modelo: ia ? MODELO() : null,
  };
  mapa[informe.clave] = informe;
  const claves = listaInformes(mapa).map((x) => x.clave);
  claves.slice(MAX_INFORMES).forEach((k) => delete mapa[k]);
  await store.setJSON(`u/${id}/informes`, mapa);
  return informe;
}
