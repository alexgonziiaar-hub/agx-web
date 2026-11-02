// Área de alumnos AGX: entrada con Discord y datos privados de cada alumno.
//   /api/auth/login     -> manda al alumno a Discord para identificarse
//   /api/auth/callback  -> vuelve de Discord, comprueba el acceso y abre la sesión
//   /api/auth/salir     -> cierra la sesión
//   /api/yo             -> quién eres y si tienes acceso
//   /api/datos          -> GET / PUT del diario y el progreso del alumno
//   /api/captura?id=    -> GET / PUT / DELETE de las capturas de ATAS
//   /api/admin/...      -> solo Alex: lista de alumnos, sus capturas y sus comentarios
// Solo entra quien está en el servidor de Discord (y, si DISCORD_ROLES_ACCESO tiene IDs, quien tenga uno de esos roles).
import { getStore } from '@netlify/blobs';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const API = 'https://discord.com/api/v10';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1566860329240105080';
const GUILD = process.env.DISCORD_GUILD_ID || '1378071900546400286';
const COOKIE = 'agx_sesion';
const DIAS_SESION = 30;
const RECOMPROBAR_MS = 6 * 3600e3; // cada 6 horas se vuelve a mirar si sigue teniendo acceso
const MAX_DATOS = 2e6;
const MAX_CAPTURA = 4.5e6;
const ADMINS = () => String(process.env.ADMIN_IDS || '941007449681436752').split(',').map((x) => x.trim()).filter(Boolean);
const esAdmin = (id) => ADMINS().includes(id);
const idAlumno = (v) => (/^\d{5,25}$/.test(v || '') ? v : null);

const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Falta la variable de entorno ${k}`);
  return v;
};
const clave = () => createHmac('sha256', 'agx-sesion').update(env('DISCORD_CLIENT_SECRET')).digest();
const b64 = (s) => Buffer.from(s).toString('base64url');
const firma = (s) => createHmac('sha256', clave()).update(s).digest('base64url');

function json(cuerpo, status = 200, extra = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}
function redirigir(url, cookies = []) {
  const h = new Headers({ Location: url, 'Cache-Control': 'no-store' });
  cookies.forEach((c) => h.append('Set-Cookie', c));
  return new Response(null, { status: 302, headers: h });
}
const galleta = (nombre, valor, maxAge) =>
  `${nombre}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

function leerCookies(req) {
  const out = {};
  (req.headers.get('cookie') || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}
function crearSesion(datos) {
  const cuerpo = b64(JSON.stringify(datos));
  return `${cuerpo}.${firma(cuerpo)}`;
}
function leerSesion(req) {
  const v = leerCookies(req)[COOKIE];
  if (!v || !v.includes('.')) return null;
  const [cuerpo, f] = v.split('.');
  const esperada = Buffer.from(firma(cuerpo));
  const dada = Buffer.from(f || '');
  if (esperada.length !== dada.length || !timingSafeEqual(esperada, dada)) return null;
  try {
    const s = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
    if (!s.id || Date.now() > s.exp) return null;
    return s;
  } catch {
    return null;
  }
}

// ¿Está en el servidor y tiene un rol válido? Usa el bot del ranking.
async function comprobarAcceso(userId) {
  const r = await fetch(`${API}/guilds/${GUILD}/members/${userId}`, {
    headers: { Authorization: `Bot ${env('DISCORD_TOKEN')}` },
  });
  if (r.status === 404) return { acceso: false, motivo: 'no_miembro' };
  if (!r.ok) throw new Error(`Discord ${r.status} al comprobar el miembro`);
  const m = await r.json();
  const roles = String(process.env.DISCORD_ROLES_ACCESO || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (roles.length && !(m.roles || []).some((x) => roles.includes(x))) return { acceso: false, motivo: 'sin_rol', nick: m.nick };
  return { acceso: true, nick: m.nick };
}

function origen(req) {
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

async function login(req) {
  const estado = randomBytes(16).toString('hex');
  const url = new URL('https://discord.com/oauth2/authorize');
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'identify',
    redirect_uri: `${origen(req)}/api/auth/callback`,
    state: estado,
    prompt: 'none',
  });
  return redirigir(url.toString(), [galleta('agx_estado', estado, 600)]);
}

async function callback(req, store) {
  const u = new URL(req.url);
  const code = u.searchParams.get('code');
  const estado = u.searchParams.get('state');
  const limpiar = galleta('agx_estado', '', 0);
  if (!code || !estado || estado !== leerCookies(req).agx_estado) return redirigir('/?error=login', [limpiar]);

  const tok = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: env('DISCORD_CLIENT_SECRET'),
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${origen(req)}/api/auth/callback`,
    }),
  });
  if (!tok.ok) {
    console.error('Discord rechazó el código', tok.status, await tok.text());
    return redirigir('/?error=login', [limpiar]);
  }
  const { access_token } = await tok.json();
  const yo = await (await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${access_token}` } })).json();
  if (!yo.id) return redirigir('/?error=login', [limpiar]);

  const a = await comprobarAcceso(yo.id);
  const sesion = {
    id: yo.id,
    nombre: String(a.nick || yo.global_name || yo.username || 'Alumno').slice(0, 80),
    avatar: yo.avatar ? `https://cdn.discordapp.com/avatars/${yo.id}/${yo.avatar}.png?size=96` : null,
    acceso: a.acceso,
    motivo: a.motivo || null,
    comprobado: Date.now(),
    exp: Date.now() + DIAS_SESION * 864e5,
  };
  if (sesion.acceso) {
    try { await store.setJSON(`u/${yo.id}/perfil`, { nombre: sesion.nombre, avatar: sesion.avatar, ultimaVez: new Date().toISOString() }); } catch (e) { console.error('No se pudo guardar el perfil:', e.message); }
  }
  return redirigir('/', [limpiar, galleta(COOKIE, crearSesion(sesion), DIAS_SESION * 86400)]);
}

// Devuelve la sesión y, si hace falta, vuelve a comprobar el acceso
async function sesionActual(req) {
  const s = leerSesion(req);
  if (!s) return { s: null, cookies: [] };
  if (Date.now() - (s.comprobado || 0) < RECOMPROBAR_MS) return { s, cookies: [] };
  try {
    const a = await comprobarAcceso(s.id);
    Object.assign(s, { acceso: a.acceso, motivo: a.motivo || null, comprobado: Date.now() });
    if (a.nick) s.nombre = String(a.nick).slice(0, 80);
    return { s, cookies: [galleta(COOKIE, crearSesion(s), Math.max(60, Math.round((s.exp - Date.now()) / 1000)))] };
  } catch (e) {
    console.error('No se pudo recomprobar el acceso:', e.message);
    return { s, cookies: [] };
  }
}

// Los comentarios de Alex se guardan aparte para que el alumno no los pise al guardar su diario
async function datosConComentarios(store, id) {
  const [d, com] = await Promise.all([store.get(`u/${id}/datos`, { type: 'json' }), store.get(`u/${id}/comentarios`, { type: 'json' })]);
  if (!d) return null;
  const c = com || {};
  d.trades = (d.trades || []).map((t) => ({ ...t, comentario: c[t.id]?.texto || '' }));
  return d;
}

async function idsAlumnos(store) {
  const ids = new Set();
  const { blobs, directories } = await store.list({ prefix: 'u/', directories: true });
  (directories || []).forEach((d) => { const m = String(d).match(/u\/(\d+)/); if (m) ids.add(m[1]); });
  (blobs || []).forEach((b) => { const m = String(b.key).match(/^u\/(\d+)\//); if (m) ids.add(m[1]); });
  return [...ids];
}

async function admin(ruta, req, store, extra) {
  const u = new URL(req.url);
  if (ruta === '/api/admin/alumnos' && req.method === 'GET') {
    const ids = await idsAlumnos(store);
    const alumnos = await Promise.all(ids.map(async (id) => {
      const [perfil, datos] = await Promise.all([store.get(`u/${id}/perfil`, { type: 'json' }), datosConComentarios(store, id)]);
      return { id, nombre: perfil?.nombre || 'Alumno', avatar: perfil?.avatar || null, ultimaVez: perfil?.ultimaVez || null, datos };
    }));
    return json({ alumnos }, 200, extra);
  }
  if (ruta === '/api/admin/captura' && req.method === 'GET') {
    const al = idAlumno(u.searchParams.get('alumno'));
    const id = idCaptura(u.searchParams.get('id'));
    if (!al || !id) return json({ error: 'id_no_valido' }, 400);
    const v = await store.get(`u/${al}/cap/${id}`);
    return v ? new Response(v, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'private, max-age=86400' } }) : json({ error: 'no_existe' }, 404);
  }
  if (ruta === '/api/admin/comentario' && req.method === 'PUT') {
    const b = JSON.parse(await req.text());
    const al = idAlumno(b.alumno);
    const id = idCaptura(b.trade);
    if (!al || !id) return json({ error: 'id_no_valido' }, 400);
    const texto = String(b.texto || '').trim().slice(0, 2000);
    const k = `u/${al}/comentarios`;
    const c = (await store.get(k, { type: 'json' })) || {};
    if (texto) c[id] = { texto, fecha: new Date().toISOString() };
    else delete c[id];
    await store.setJSON(k, c);
    return json({ ok: true, texto }, 200, extra);
  }
  return json({ error: 'no_encontrado' }, 404);
}

const idCaptura = (v) => (/^[\w-]{1,48}$/.test(v || '') ? v : null);

export const crearManejador = (obtenerStore) => async (req) => {
  const ruta = new URL(req.url).pathname.replace(/\/+$/, '');
  try {
    if (ruta === '/api/auth/login') return await login(req);
    if (ruta === '/api/auth/callback') return await callback(req, obtenerStore());
    if (ruta === '/api/auth/salir') return redirigir('/', [galleta(COOKIE, '', 0)]);

    const { s, cookies } = await sesionActual(req);
    const extra = {};
    if (cookies.length) extra['Set-Cookie'] = cookies[0];

    if (ruta === '/api/yo') {
      if (!s) return json({ sesion: false }, 401);
      return json({ sesion: true, id: s.id, nombre: s.nombre, avatar: s.avatar, acceso: !!s.acceso, motivo: s.motivo, admin: !!s.acceso && esAdmin(s.id) }, s.acceso ? 200 : 403, extra);
    }

    if (!s) return json({ error: 'sin_sesion' }, 401);
    if (!s.acceso) return json({ error: 'sin_acceso', motivo: s.motivo }, 403, extra);
    const store = obtenerStore();

    if (ruta.startsWith('/api/admin/')) {
      if (!esAdmin(s.id)) return json({ error: 'solo_admin' }, 403);
      return await admin(ruta, req, store, extra);
    }

    if (ruta === '/api/datos') {
      const k = `u/${s.id}/datos`;
      if (req.method === 'GET') return json({ datos: await datosConComentarios(store, s.id) }, 200, extra);
      if (req.method === 'PUT' || req.method === 'POST') {
        const txt = await req.text();
        if (txt.length > MAX_DATOS) return json({ error: 'demasiado_grande' }, 413);
        const d = JSON.parse(txt);
        if (!d || typeof d !== 'object' || !Array.isArray(d.trades)) return json({ error: 'datos_no_validos' }, 400);
        await store.setJSON(k, d);
        await store.setJSON(`u/${s.id}/perfil`, { nombre: s.nombre, avatar: s.avatar, ultimaVez: new Date().toISOString() });
        return json({ ok: true, guardado: new Date().toISOString() }, 200, extra);
      }
    }

    if (ruta === '/api/captura') {
      const id = idCaptura(new URL(req.url).searchParams.get('id'));
      if (!id) return json({ error: 'id_no_valido' }, 400);
      const k = `u/${s.id}/cap/${id}`;
      if (req.method === 'GET') {
        const v = await store.get(k);
        return v ? new Response(v, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'private, max-age=86400' } }) : json({ error: 'no_existe' }, 404);
      }
      if (req.method === 'PUT') {
        const txt = await req.text();
        if (!/^data:image\/(jpeg|png|webp);base64,/.test(txt)) return json({ error: 'no_es_imagen' }, 400);
        if (txt.length > MAX_CAPTURA) return json({ error: 'demasiado_grande' }, 413);
        await store.set(k, txt);
        return json({ ok: true }, 200, extra);
      }
      if (req.method === 'DELETE') {
        await store.delete(k);
        return json({ ok: true }, 200, extra);
      }
    }
    return json({ error: 'no_encontrado' }, 404);
  } catch (e) {
    console.error('Error en el área de alumnos:', e.message);
    return json({ error: 'error_interno' }, 500);
  }
};

export default crearManejador(() => getStore('alumnos-agx'));

export const config = { path: ['/api/auth/*', '/api/yo', '/api/datos', '/api/captura', '/api/admin/*'] };
