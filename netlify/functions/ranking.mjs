// Ranking AGX: API pública de solo lectura que consume el área de alumnos.
// GET https://agxcommunity.com/api/ranking

async function supa(ruta) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(`${String(process.env.SUPABASE_URL).replace(/\/$/, '')}/rest/v1/${ruta}`, {
    headers: { apikey: key, ...(String(key).startsWith('sb_') ? {} : { Authorization: `Bearer ${key}` }) },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status} en ${ruta}: ${await r.text()}`);
  return r.json();
}

export default async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': process.env.RANKING_ORIGEN || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  try {
    const [mes, historico, recientes, campeones, estado] = await Promise.all([
      supa('ranking_mes?select=*&order=total.desc,ultimo.asc&limit=50'),
      supa('ranking_historico?select=*&order=total.desc,ultimo.asc&limit=50'),
      supa('logros?select=message_id,discord_id,nombre,avatar_url,tipo,texto,url,fecha&order=fecha.desc&limit=12'),
      supa('campeones?select=*&limit=6'),
      supa('sync_estado?select=actualizado&id=eq.1'),
    ]);
    const cuerpo = { actualizado: estado?.[0]?.actualizado || null, mes, historico, recientes, campeones };
    return new Response(JSON.stringify(cuerpo), {
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
