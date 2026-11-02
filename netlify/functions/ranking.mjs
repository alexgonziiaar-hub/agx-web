// Ranking AGX: API pública de solo lectura que consume el área de alumnos.
// GET https://agxcommunity.com/api/ranking
import { getStore } from '@netlify/blobs';

// Minutos que la hora de España va por delante de UTC en el instante t
function offsetMadrid(t) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t));
  const g = (k) => +p.find((x) => x.type === k).value;
  return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - Math.floor(t / 1000) * 1000) / 60000);
}
const mesDe = (t) => {
  const l = new Date(t + offsetMadrid(t) * 60000);
  return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, '0')}`;
};

// Agrupa por alumno. A igualdad de logros va delante quien llegó antes.
function agregar(logros) {
  const m = new Map();
  for (const r of logros) {
    const a = m.get(r.discord_id) || { discord_id: r.discord_id, nombre: r.nombre, avatar_url: r.avatar_url, total: 0, evaluaciones: 0, payouts: 0, otros: 0, ultimo: r.fecha, _ult: 0 };
    const t = Date.parse(r.fecha);
    a.total++;
    if (r.tipo === 'evaluacion') a.evaluaciones++;
    else if (r.tipo === 'payout') a.payouts++;
    else a.otros++;
    if (t >= a._ult) { a._ult = t; a.ultimo = r.fecha; a.nombre = r.nombre; a.avatar_url = r.avatar_url; }
    m.set(r.discord_id, a);
  }
  return [...m.values()]
    .sort((p, q) => q.total - p.total || p._ult - q._ult)
    .map(({ _ult, ...x }) => x);
}

export function construir(logros, estado, ahora = Date.now()) {
  const mesActual = mesDe(ahora);
  const porMes = new Map();
  for (const r of logros) {
    const k = mesDe(Date.parse(r.fecha));
    if (!porMes.has(k)) porMes.set(k, []);
    porMes.get(k).push(r);
  }
  const campeones = [...porMes.keys()]
    .filter((k) => k < mesActual)
    .sort()
    .reverse()
    .slice(0, 6)
    .map((k) => {
      const g = agregar(porMes.get(k))[0];
      return { mes: k, discord_id: g.discord_id, nombre: g.nombre, avatar_url: g.avatar_url, total: g.total };
    });
  return {
    actualizado: estado?.actualizado || null,
    mes: agregar(porMes.get(mesActual) || []).slice(0, 50),
    historico: agregar(logros).slice(0, 50),
    recientes: [...logros].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha)).slice(0, 12)
      .map(({ validado_por, ...x }) => x),
    campeones,
  };
}

export default async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': process.env.RANKING_ORIGEN || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  try {
    const store = getStore('ranking-agx');
    const [logros, estado] = await Promise.all([store.get('logros', { type: 'json' }), store.get('estado', { type: 'json' })]);
    return new Response(JSON.stringify(construir(logros || [], estado)), {
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
    });
  } catch (e) {
    console.error('Error al leer el ranking AGX:', e.message);
    return new Response(JSON.stringify({ error: 'No se pudo leer el ranking' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
};

export const config = { path: '/api/ranking' };
