// Parte diario del plan: cada noche (hora de España) el agente de IA revisa el día de cada alumno que tenga plan y operaciones.
// Se ejecuta cada 10 minutos entre las 23:00 y las 03:00 aprox. (hora de España) y en cada pasada sigue con los alumnos que faltan.
// Si un alumno sube las operaciones al día siguiente, se analizan sus días de los últimos 3 días que no tengan parte.
import { getStore } from '@netlify/blobs';
import { planNormal, planGuardado, sumarDias } from '../lib/plan.mjs';
import { idsAlumnos, leerInformes, generarInforme, fechaMadrid, huellaPeriodo } from '../lib/analisis.mjs';
import { iaActiva } from '../lib/ia.mjs';

const CONCURRENCIA = 6;
const LIMITE_MS = 27000; // las funciones programadas tienen 30 s
const EMPEZAR_HASTA_MS = 13000; // no se empieza un análisis nuevo pasado este tiempo

async function datosAlumno(store, id) {
  const [d, com, perfil] = await Promise.all([
    store.get(`u/${id}/datos`, { type: 'json' }), store.get(`u/${id}/comentarios`, { type: 'json' }), store.get(`u/${id}/perfil`, { type: 'json' }),
  ]);
  if (!d) return null;
  const c = com || {};
  d.trades = (d.trades || []).map((t) => ({ ...t, comentario: c[t.id]?.texto || '' }));
  return { datos: d, nombre: perfil?.nombre || 'Alumno' };
}

export async function ejecutar(ahora = Date.now(), store = getStore({ name: 'alumnos-agx', consistency: 'strong' })) {
  const t0 = Date.now();
  const dia = fechaMadrid(ahora - 4 * 3600e3); // de 23:00 a 03:00 sigue siendo "hoy" (el día de trading)
  if (!iaActiva()) return { dia, procesados: 0, pendientes: 0, sinIA: true }; // sin clave de Claude no hay parte que escribir
  const kEstado = 'sistema/informe-diario';
  let est = (await store.get(kEstado, { type: 'json' })) || {};
  if (est.dia !== dia) est = { dia, hechos: [], intentos: {} };
  const cola = (await idsAlumnos(store)).filter((id) => !est.hechos.includes(id));
  const hechosAhora = [];

  async function procesar(id) {
    const a = await datosAlumno(store, id);
    if (!a || !planGuardado(planNormal(a.datos.plan))) return false;
    const informes = await leerInformes(store, id);
    const dias = [...new Set((a.datos.trades || []).filter((t) => !t.ejemplo && t.fecha >= sumarDias(dia, -3) && t.fecha <= dia).map((t) => t.fecha))]
      .sort().reverse().filter((f) => {
        const i = informes[`dia:${f}`];
        // un análisis que pidió el propio alumno a media sesión se rehace si luego siguió operando
        return !i || !i.ia || (f === dia && i.origen === 'manual' && i.huella !== huellaPeriodo(a.datos, 'dia', f));
      }).slice(0, 2);
    for (const f of dias) {
      const queda = LIMITE_MS - (Date.now() - t0);
      if (queda < 6000) throw new Error('sin_tiempo');
      await generarInforme({ store, id, nombre: a.nombre, datos: a.datos, tipo: 'dia', fecha: f, origen: 'auto', timeoutMs: queda - 1500 });
      informes[`dia:${f}`] = true;
    }
    return !!(informes[`dia:${dia}`] && (informes[`dia:${dia}`] === true || informes[`dia:${dia}`].ia)); // si hoy aún no ha subido nada, se vuelve a mirar en la siguiente pasada
  }

  async function trabajador() {
    while (cola.length && Date.now() - t0 < EMPEZAR_HASTA_MS) {
      const id = cola.shift();
      try {
        if (await procesar(id)) { est.hechos.push(id); hechosAhora.push(id); }
      } catch (e) {
        est.intentos[id] = (est.intentos[id] || 0) + 1;
        if (est.intentos[id] >= 3) est.hechos.push(id);
        console.error(`Informe diario de ${id}:`, e.message);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCIA }, trabajador));
  await store.setJSON(kEstado, est);
  return { dia, procesados: hechosAhora.length, pendientes: cola.length };
}

export default async () => {
  const r = await ejecutar();
  console.log(`Parte diario ${r.dia}: ${r.procesados} alumnos revisados, ${r.pendientes} pendientes.`);
};

export const config = { schedule: '*/10 22,23,0,1 * * *' };
