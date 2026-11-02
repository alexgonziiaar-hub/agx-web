// Ranking AGX: lee el canal de logros de Discord y guarda los logros validados en Netlify Blobs.
// Netlify la ejecuta sola cada 10 minutos (Scheduled Functions).
//
// Un mensaje cuenta como logro cuando un validador (tú o un moderador) reacciona con:
//   💰 payout cobrado   ·   🎯 evaluación superada   ·   ✅ o ⭐ otro logro
// Si quita la reacción o se borra el mensaje, el logro desaparece del ranking en la siguiente pasada.
import { getStore } from '@netlify/blobs';

const API = 'https://discord.com/api/v10';

// Reacción -> tipo de logro. Si hay varias, gana la primera de la lista.
export const TIPOS = [
  { emoji: '💰', tipo: 'payout' },
  { emoji: '🎯', tipo: 'evaluacion' },
  { emoji: '⭐', tipo: 'otro' },
  { emoji: '✅', tipo: 'otro' }, // la validación que ya usáis en el canal
];

const PRESUPUESTO_MS = 24000; // las funciones programadas tienen 30 s; dejamos margen
const RECHEQUEO_MS = 72 * 3600e3; // los logros de las últimas 72 h se vuelven a verificar en cada pasada

const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Falta la variable de entorno ${k}`);
  return v;
};
const lista = (v) => new Set(String(v || '').split(',').map((s) => s.trim()).filter(Boolean));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function discord(ruta, intento = 0) {
  const r = await fetch(API + ruta, {
    headers: {
      Authorization: `Bot ${env('DISCORD_TOKEN')}`,
      'User-Agent': 'DiscordBot (https://agxcommunity.com, 1.0) AGX-Ranking',
    },
  });
  if (r.status === 429 && intento < 3) {
    const j = await r.json().catch(() => ({}));
    await espera(Math.ceil((j.retry_after || 1) * 1000) + 100);
    return discord(ruta, intento + 1);
  }
  if (r.status === 404) return null;
  if (r.status === 401) throw new Error('Discord rechaza el token: revisa DISCORD_TOKEN');
  if (r.status === 403) throw new Error('El bot no tiene acceso al canal: invítalo al servidor y dale permiso para ver el canal y leer el historial');
  if (!r.ok) throw new Error(`Discord ${r.status} en ${ruta}: ${await r.text()}`);
  return r.json();
}

const limpiar = (s = '') =>
  String(s)
    .replace(/<a?:(\w+):\d+>/g, ':$1:') // emojis propios del servidor
    .replace(/<@[!&]?\d+>/g, '') // menciones
    .replace(/<#\d+>/g, '') // canales
    .replace(/\s+/g, ' ')
    .trim();

function fila(m, tipo, validador, guild, canal) {
  const a = m.author || {};
  return {
    message_id: m.id,
    discord_id: a.id,
    nombre: String(a.global_name || a.username || 'Alumno').slice(0, 80),
    avatar_url: a.avatar ? `https://cdn.discordapp.com/avatars/${a.id}/${a.avatar}.png?size=96` : null,
    tipo,
    texto: limpiar(m.content).slice(0, 220) || null,
    url: `https://discord.com/channels/${guild}/${canal}/${m.id}`,
    fecha: m.timestamp,
    validado_por: validador || null,
  };
}

export async function sincronizar(ahora = Date.now(), store = getStore('ranking-agx')) {
  const t0 = Date.now();
  const sinTiempo = () => Date.now() - t0 > PRESUPUESTO_MS;
  const canal = env('DISCORD_CANAL_LOGROS');
  const validadores = lista(env('DISCORD_VALIDADORES'));
  const excluir = lista(process.env.DISCORD_EXCLUIR);
  const ventanaDias = Number(process.env.VENTANA_DIAS || 40);
  const corte = ahora - ventanaDias * 864e5;

  const info = await discord(`/channels/${canal}`);
  if (!info) throw new Error('No encuentro el canal: revisa DISCORD_CANAL_LOGROS');
  const guild = info.guild_id;

  // 1. Mensajes de la ventana, del más nuevo al más antiguo
  const mensajes = [];
  let antes = null;
  let completo = false;
  while (!sinTiempo()) {
    const lote = await discord(`/channels/${canal}/messages?limit=100${antes ? `&before=${antes}` : ''}`);
    if (!lote || !lote.length) { completo = true; break; }
    for (const m of lote) {
      if (Date.parse(m.timestamp) < corte) { completo = true; break; }
      mensajes.push(m);
    }
    if (completo || lote.length < 100) { completo = true; break; }
    antes = lote[lote.length - 1].id;
  }

  // 2. Lo que ya está guardado
  const todos = (await store.get('logros', { type: 'json' })) || [];
  const guardados = new Map(todos.filter((r) => Date.parse(r.fecha) >= corte).map((r) => [r.message_id, r]));

  // 3. Comprobar qué mensajes están validados
  const validos = [];
  const revisados = new Set();
  let pendientes = 0;
  for (const m of mensajes) {
    if (m.author?.bot || excluir.has(m.author?.id)) { revisados.add(m.id); continue; }
    const presentes = TIPOS.filter((t) => (m.reactions || []).some((r) => !r.emoji?.id && r.emoji?.name === t.emoji));
    if (!presentes.length) { revisados.add(m.id); continue; }

    const previo = guardados.get(m.id);
    let elegido = null;
    let validador = null;
    let cortado = false;
    const reciente = ahora - Date.parse(m.timestamp) < RECHEQUEO_MS;
    if (previo && !reciente && presentes.some((t) => t.tipo === previo.tipo)) {
      // Validado hace más de 72 h y la reacción sigue: no gastamos llamadas a Discord
      elegido = TIPOS.find((t) => t.tipo === previo.tipo);
      validador = previo.validado_por;
    } else {
      for (const t of presentes) {
        if (sinTiempo()) { cortado = true; break; }
        const usuarios = (await discord(`/channels/${canal}/messages/${m.id}/reactions/${encodeURIComponent(t.emoji)}?limit=100`)) || [];
        const v = usuarios.find((u) => validadores.has(u.id));
        if (v) { elegido = t; validador = v.id; break; }
      }
    }
    if (cortado && !elegido) { pendientes++; continue; } // se revisa en la siguiente pasada
    revisados.add(m.id);
    if (elegido) validos.push(fila(m, elegido.tipo, validador, guild, canal));
  }

  // 4. Retirar los que ya no cuentan (sin validación o mensaje borrado) y guardar los válidos
  const vistos = new Set(mensajes.map((m) => m.id));
  const validosIds = new Set(validos.map((v) => v.message_id));
  const retirar = [...guardados.keys()].filter(
    (id) => !validosIds.has(id) && (revisados.has(id) || (completo && !vistos.has(id)))
  );
  const mapa = new Map(todos.map((r) => [r.message_id, r]));
  retirar.forEach((id) => mapa.delete(id));
  validos.forEach((v) => mapa.set(v.message_id, v));
  const final = [...mapa.values()].sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
  await store.setJSON('logros', final);

  const resumen = { mensajes: mensajes.length, validados: validos.length, retirados: retirar.length, pendientes, completo, total: final.length };
  await store.setJSON('estado', { actualizado: new Date().toISOString(), ...resumen });
  return resumen;
}

export default async () => {
  try {
    console.log('Ranking AGX sincronizado', await sincronizar());
  } catch (e) {
    console.error('Error al sincronizar el ranking AGX:', e.message);
  }
};

export const config = { schedule: '*/10 * * * *' };
