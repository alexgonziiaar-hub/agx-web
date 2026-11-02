// Generado a partir de fuentes/plan-core.js: es el mismo código que usa la web para comprobar el plan.
/* ---------- Plan de trading: reglas y comprobación (el mismo código en la web y en el servidor) ---------- */
const VALOR_PUNTO={NQ:20,ES:50,YM:5,RTY:50,MNQ:2,MES:5,MYM:0.5,M2K:5};
const PLAN_DIAS_L=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const PLAN_REGLAS={
  perdida:'Pérdida máxima diaria',
  riesgo:'Pérdida máxima por operación',
  contratos:'Contratos máximos',
  ops:'Operaciones máximas al día',
  racha:'Parar tras pérdidas seguidas',
  objetivo:'Parar al llegar al objetivo',
  horario:'Horario',
  dias:'Días de trading',
  instrumentos:'Instrumentos',
  setups:'Setups del plan',
  registro:'Registrar setup y nota'
};
function planVacio(){
  return {perdidaMaxDia:null,riesgoMaxOp:null,maxContratos:null,maxOps:null,maxPerdidasSeguidas:null,objetivoDia:null,
    horaDesde:'',horaHasta:'',dias:[1,2,3,4,5],instrumentos:[],setups:[],registro:true,texto:'',zona:'',actualizado:null};
}
function planNormal(p){
  const b=planVacio(); if(!p || typeof p!=='object') return b;
  const n=v=>{ const x=Number(v); return isFinite(x) && x>0 ? Math.round(x*100)/100 : null; };
  const h=v=>/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(v||'')) ? String(v).padStart(5,'0') : '';
  const l=v=>Array.isArray(v) ? v.map(x=>String(x).slice(0,60)).filter(Boolean).slice(0,30) : [];
  return {
    perdidaMaxDia:n(p.perdidaMaxDia), riesgoMaxOp:n(p.riesgoMaxOp), maxContratos:n(p.maxContratos), maxOps:n(p.maxOps),
    maxPerdidasSeguidas:n(p.maxPerdidasSeguidas), objetivoDia:n(p.objetivoDia),
    horaDesde:h(p.horaDesde), horaHasta:h(p.horaHasta),
    dias:Array.isArray(p.dias) ? Array.from(new Set(p.dias.map(Number).filter(d=>d>=0 && d<=6))).sort() : b.dias,
    instrumentos:l(p.instrumentos), setups:l(p.setups), registro:p.registro!==false,
    texto:String(p.texto||'').slice(0,4000), zona:String(p.zona||'').slice(0,60), actualizado:p.actualizado||null
  };
}
function planGuardado(p){ return !!(p && p.actualizado); }
function plural(n,a,b){ return n+' '+(n===1?a:b); }
function usdOp(t){ if(t.usd!=null && isFinite(t.usd)) return Number(t.usd); return (Number(t.pts)||0)*(VALOR_PUNTO[t.inst]||20)*(Number(t.ct)||1); }
function dolares(u){ const v=Math.round(u); return (v>0?'+':v<0?'−':'')+String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+' $'; }
function minutosHora(s){ const m=/^(\d{1,2}):(\d{2})$/.exec(String(s||'')); return m ? Number(m[1])*60+Number(m[2]) : null; }
function hhmm(m){ return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
function horaEn(ts,zona){
  try{
    const o={}; new Intl.DateTimeFormat('en-GB',{timeZone:zona||undefined,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ts)).forEach(p=>{ o[p.type]=p.value; });
    return (parseInt(o.hour,10)%24)*60+parseInt(o.minute,10);
  }catch(e){ const d=new Date(ts); return d.getHours()*60+d.getMinutes(); }
}
function diaDeFecha(f){ const a=String(f).split('-').map(Number); return new Date(Date.UTC(a[0],a[1]-1,a[2])).getUTCDay(); }
function sumarDias(f,n){ const a=String(f).split('-').map(Number); const d=new Date(Date.UTC(a[0],a[1]-1,a[2]+n)); return d.toISOString().slice(0,10); }
function ordenarDia(ts){ return ts.every(t=>t.hEnt) ? ts.slice().sort((a,b)=>a.hEnt-b.hEnt) : ts.slice(); }
function huellaOps(ts){
  const s=JSON.stringify(ts.map(t=>[t.id,Math.round(usdOp(t)),t.setup||'',t.nota||'',t.ct,t.hEnt||0,t.inst]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0).toString(36);
}

/* Comprueba un día de operaciones contra el plan. Devuelve una regla por cada norma que el alumno ha puesto en su plan. */
function evaluarDia(plan,ops,zona){
  const p=planNormal(plan), o=ordenarDia(ops), R=[], z=zona||p.zona||undefined;
  const usd=o.map(usdOp); let c=0; const acum=usd.map(u=>(c+=u)); const neto=c;
  const cual=t=>t.hEnt ? 'la de las '+hhmm(horaEn(t.hEnt,z)) : 'la '+(o.indexOf(t)+1)+'ª del día';
  const lista=ts=>ts.slice(0,3).map(cual).join(', ')+(ts.length>3?' y '+(ts.length-3)+' más':'');
  const regla=(id,ok,detalle,malas)=>R.push({id,nombre:PLAN_REGLAS[id],ok,detalle,ops:(malas||[]).map(t=>t.id)});

  if(p.perdidaMaxDia){
    const L=p.perdidaMaxDia, k=acum.findIndex(v=>v<=-L+1e-9), despues=k>=0?o.slice(k+1):[];
    if(despues.length) regla('perdida',false,`Tocaste tu pérdida máxima de ${dolares(-L)} y seguiste operando: ${plural(despues.length,'operación','operaciones')} más. Cerraste el día en ${dolares(neto)}.`,despues);
    else if(neto<-L*1.1) regla('perdida',false,`Cerraste el día en ${dolares(neto)}, pasado tu límite de ${dolares(-L)}.`,o.slice(-1));
    else if(k>=0) regla('perdida',true,`Llegaste a tu pérdida máxima (${dolares(-L)}) y paraste.`);
    else regla('perdida',true,Math.min(...acum)<0?`El peor momento del día fue ${dolares(Math.min(...acum))}, dentro de tu límite de ${dolares(-L)}.`:`El día no llegó a estar en negativo. Tu límite: ${dolares(-L)}.`);
  }
  if(p.riesgoMaxOp){
    const L=p.riesgoMaxOp, malas=o.filter(t=>usdOp(t)<-L*1.1);
    if(malas.length){ const peor=Math.min(...malas.map(usdOp)); regla('riesgo',false,`${malas.length===1?'Una operación perdió':plural(malas.length,'operación','operaciones')+' perdieron'} más de ${dolares(-L)} (${lista(malas)}). La peor: ${dolares(peor)}.`,malas); }
    else regla('riesgo',true,`Ninguna operación perdió más de ${dolares(-L)}.`);
  }
  if(p.maxContratos){
    const malas=o.filter(t=>Number(t.ct)>p.maxContratos);
    if(malas.length) regla('contratos',false,`Entraste con más de ${plural(p.maxContratos,'contrato','contratos')} en ${lista(malas)} (hasta ${Math.max(...malas.map(t=>Number(t.ct)))}).`,malas);
    else regla('contratos',true,`Todas las entradas con ${p.maxContratos===1?'1 contrato':'un máximo de '+p.maxContratos+' contratos'}.`);
  }
  if(p.maxOps){
    if(o.length>p.maxOps) regla('ops',false,`Hiciste ${plural(o.length,'operación','operaciones')}; tu máximo es ${p.maxOps}.`,o.slice(p.maxOps));
    else regla('ops',true,`${plural(o.length,'operación','operaciones')} de un máximo de ${p.maxOps}.`);
  }
  if(p.maxPerdidasSeguidas){
    const K=p.maxPerdidasSeguidas; let r=0, corte=-1;
    for(let i=0;i<o.length;i++){ if(usd[i]<0){ r++; if(r>=K){ corte=i; break; } } else r=0; }
    const despues=corte>=0?o.slice(corte+1):[];
    if(despues.length) regla('racha',false,`Tras ${K} ${K===1?'pérdida':'pérdidas seguidas'} hiciste ${plural(despues.length,'operación','operaciones')} más.`,despues);
    else regla('racha',true,corte>=0?`Llegaste a ${K} ${K===1?'pérdida':'pérdidas seguidas'} y paraste.`:`No llegaste a ${K} ${K===1?'pérdida':'pérdidas seguidas'}.`);
  }
  if(p.objetivoDia){
    const k=acum.findIndex(v=>v>=p.objetivoDia-1e-9), despues=k>=0?o.slice(k+1):[];
    if(despues.length) regla('objetivo',false,`Llegaste a tu objetivo de ${dolares(p.objetivoDia)} y seguiste operando: ${plural(despues.length,'operación','operaciones')} más. Cerraste en ${dolares(neto)}.`,despues);
    else regla('objetivo',true,k>=0?`Objetivo de ${dolares(p.objetivoDia)} conseguido y a casa.`:`No llegaste al objetivo de ${dolares(p.objetivoDia)}; no aplica parar.`);
  }
  const ini=minutosHora(p.horaDesde), fin=minutosHora(p.horaHasta);
  if(ini!=null && fin!=null){
    const conHora=o.filter(t=>t.hEnt), dentro=m=>ini<=fin ? (m>=ini && m<=fin) : (m>=ini || m<=fin);
    const malas=conHora.filter(t=>!dentro(horaEn(t.hEnt,z)));
    const sin=o.length-conHora.length;
    if(malas.length) regla('horario',false,`Fuera de tu horario (${p.horaDesde} a ${p.horaHasta}): ${lista(malas)}.`,malas);
    else if(conHora.length) regla('horario',true,`Todas las entradas dentro de tu horario (${p.horaDesde} a ${p.horaHasta}).`+(sin?` ${plural(sin,'operación','operaciones')} sin hora no se han podido comprobar.`:''));
  }
  if(p.dias.length && p.dias.length<7 && o.length){
    const d=diaDeFecha(o[0].fecha);
    if(!p.dias.includes(d)) regla('dias',false,`Operaste un ${PLAN_DIAS_L[d]}, que no está entre tus días de trading.`,o);
    else regla('dias',true,`El ${PLAN_DIAS_L[d]} es día de trading en tu plan.`);
  }
  if(p.instrumentos.length){
    const malas=o.filter(t=>!p.instrumentos.includes(t.inst));
    if(malas.length) regla('instrumentos',false,`Operaste ${Array.from(new Set(malas.map(t=>t.inst))).join(', ')}, fuera de tus instrumentos (${p.instrumentos.join(', ')}).`,malas);
    else regla('instrumentos',true,`Solo instrumentos de tu plan (${p.instrumentos.join(', ')}).`);
  }
  if(p.setups.length){
    const malas=o.filter(t=>t.setup && !p.setups.includes(t.setup));
    if(malas.length) regla('setups',false,`${malas.length===1?'Una entrada':plural(malas.length,'entrada','entradas')} con setups fuera de tu plan: ${Array.from(new Set(malas.map(t=>t.setup))).join(', ')}.`,malas);
    else regla('setups',true,o.some(t=>t.setup)?'Todas las entradas con setups de tu plan.':'Sin setups apuntados todavía.');
  }
  if(p.registro){
    const malas=o.filter(t=>!t.setup || !String(t.nota||'').trim());
    if(malas.length) regla('registro',false,`${malas.length===1?'Una operación está':plural(malas.length,'operación','operaciones')+' están'} sin setup o sin nota.`,malas);
    else regla('registro',true,'Todas las operaciones con su setup y su nota.');
  }
  const ok=R.filter(r=>r.ok).length;
  return {fecha:o.length?o[0].fecha:null,n:o.length,neto,reglas:R,cumplidas:ok,aplicables:R.length,ok:R.every(r=>r.ok),pct:R.length?ok/R.length:null};
}

/* Todos los días con operaciones entre dos fechas (incluidas) */
function evaluarPeriodo(plan,trades,desde,hasta,zona){
  const por={};
  trades.forEach(t=>{ if(!t.fecha || t.fecha<desde || t.fecha>hasta) return; (por[t.fecha]=por[t.fecha]||[]).push(t); });
  const dias=Object.keys(por).sort().map(f=>evaluarDia(plan,por[f],zona));
  const rotas={}; dias.forEach(d=>d.reglas.forEach(r=>{ if(!r.ok) rotas[r.id]=(rotas[r.id]||0)+1; }));
  const ok=dias.filter(d=>d.ok).length, reg=dias.reduce((s,d)=>s+d.aplicables,0), cum=dias.reduce((s,d)=>s+d.cumplidas,0);
  return {dias,diasOk:ok,pctDias:dias.length?ok/dias.length:null,pctReglas:reg?cum/reg:null,rotas,neto:dias.reduce((s,d)=>s+d.neto,0),n:dias.reduce((s,d)=>s+d.n,0)};
}

/* El plan en texto, para el agente de IA */
function planComoTexto(plan){
  const p=planNormal(plan), l=[];
  if(p.perdidaMaxDia) l.push(`Pérdida máxima diaria: ${p.perdidaMaxDia} $`);
  if(p.riesgoMaxOp) l.push(`Pérdida máxima por operación: ${p.riesgoMaxOp} $`);
  if(p.maxContratos) l.push(`Contratos máximos por operación: ${p.maxContratos}`);
  if(p.maxOps) l.push(`Operaciones máximas al día: ${p.maxOps}`);
  if(p.maxPerdidasSeguidas) l.push(`Parar tras ${p.maxPerdidasSeguidas} pérdidas seguidas`);
  if(p.objetivoDia) l.push(`Parar al llegar a +${p.objetivoDia} $ en el día`);
  if(p.horaDesde && p.horaHasta) l.push(`Horario de entradas: de ${p.horaDesde} a ${p.horaHasta} (hora del alumno)`);
  if(p.dias.length && p.dias.length<7) l.push(`Días de trading: ${p.dias.map(d=>PLAN_DIAS_L[d]).join(', ')}`);
  if(p.instrumentos.length) l.push(`Instrumentos permitidos: ${p.instrumentos.join(', ')}`);
  if(p.setups.length) l.push(`Setups permitidos: ${p.setups.join(', ')}`);
  if(p.registro) l.push('Apuntar setup y nota en cada operación');
  return l;
}

export { VALOR_PUNTO, PLAN_REGLAS, PLAN_DIAS_L, planVacio, planNormal, planGuardado, usdOp, dolares, hhmm, horaEn, minutosHora, sumarDias, diaDeFecha, huellaOps, evaluarDia, evaluarPeriodo, planComoTexto };
