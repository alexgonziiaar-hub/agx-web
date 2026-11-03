// Generado a partir de fuentes/plan-core.js: es el mismo código que usa la web para comprobar el plan.
/* ---------- Plan de trading: reglas y comprobación (el mismo código en la web y en el servidor) ---------- */
const VALOR_PUNTO={NQ:20,ES:50,YM:5,RTY:50,MNQ:2,MES:5,MYM:0.5,M2K:5};
const PLAN_DIAS_L=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const PLAN_REGLAS={
  perdida:'Pérdida máxima diaria',
  riesgo:'Riesgo máximo por operación',
  stop:'Stop en cada operación',
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
    horaDesde:'',horaHasta:'',dias:[1,2,3,4,5],instrumentos:[],setups:[],registro:true,conStop:true,texto:'',zona:'',actualizado:null};
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
    instrumentos:l(p.instrumentos), setups:l(p.setups), registro:p.registro!==false, conStop:p.conStop!==false,
    texto:String(p.texto||'').slice(0,4000), zona:String(p.zona||'').slice(0,60), actualizado:p.actualizado||null
  };
}
function planGuardado(p){ return !!(p && p.actualizado); }
function plural(n,a,b){ return n+' '+(n===1?a:b); }
function usdOp(t){ if(t.usd!=null && isFinite(t.usd)) return Number(t.usd); return (Number(t.pts)||0)*(VALOR_PUNTO[t.inst]||20)*(Number(t.ct)||1); }
function dolares(u){ const v=Math.round(u); return (v>0?'+':v<0?'−':'')+String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+' $'; }
function importe(u){ return dolares(Math.abs(u)).replace(/^[+−]/,''); }
function riesgoOp(t){ const r=Number(t.riesgo); return isFinite(r) && r>0 ? r : null; }
function stopOp(t){ const s=Number(t.stop); return isFinite(s) && s>0 ? s : null; }
function rOp(t){ const r=riesgoOp(t); return r ? usdOp(t)/r : null; }
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
  const s=JSON.stringify(ts.map(t=>[t.id,Math.round(usdOp(t)),t.setup||'',t.nota||'',t.ct,t.hEnt||0,t.inst,stopOp(t)||0,riesgoOp(t)||0]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
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
    // Cuenta el riesgo que apuntó (stop × contratos) y, además, lo que perdió de verdad
    const L=p.riesgoMaxOp, altas=o.filter(t=>riesgoOp(t)>L*1.001), perdidas=o.filter(t=>!altas.includes(t) && usdOp(t)<-L*1.1);
    const txt=[];
    if(altas.length) txt.push(`Arriesgaste más de ${importe(L)} en ${lista(altas)} (hasta ${importe(Math.max(...altas.map(riesgoOp)))}).`);
    if(perdidas.length) txt.push(`${perdidas.length===1?'Una operación perdió':plural(perdidas.length,'operación','operaciones')+' perdieron'} más de ${importe(L)} (${lista(perdidas)}). La peor: ${dolares(Math.min(...perdidas.map(usdOp)))}.`);
    if(txt.length) regla('riesgo',false,txt.join(' '),altas.concat(perdidas));
    else regla('riesgo',true,o.some(riesgoOp)?`Todas las entradas con un riesgo de ${importe(L)} o menos.`:`Ninguna operación perdió más de ${importe(L)}.`);
  }
  if(p.conStop){
    // Sin stop apuntado, o perdiendo bastante más de lo que arriesgaba (señal de que movió el stop)
    const sin=o.filter(t=>!stopOp(t)), movido=o.filter(t=>stopOp(t) && riesgoOp(t) && usdOp(t)<-riesgoOp(t)*1.25-5);
    const txt=[];
    if(sin.length) txt.push(`${sin.length===1?'Una operación no tiene':plural(sin.length,'operación','operaciones')+' no tienen'} el stop apuntado (${lista(sin)}).`);
    if(movido.length) txt.push(`En ${lista(movido)} perdiste más de lo que arriesgabas (${movido.map(t=>dolares(usdOp(t))+' con '+importe(riesgoOp(t))+' de riesgo').slice(0,2).join('; ')}): ¿moviste el stop?`);
    if(txt.length) regla('stop',false,txt.join(' '),sin.concat(movido));
    else regla('stop',true,'Todas las operaciones con su stop, y ninguna perdió más de lo arriesgado.');
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
  if(p.riesgoMaxOp) l.push(`Riesgo máximo por operación: ${p.riesgoMaxOp} $`);
  if(p.conStop) l.push('Stop puesto y apuntado en cada operación, sin moverlo en contra');
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

/* ---------- Diario pro: cuenta de fondeo, errores con coste y rutina (mismo código en la web y en el servidor) ---------- */
const ERRORES={
  fomo:{n:'FOMO / perseguir el precio',d:'Entraste tarde por miedo a perderte el movimiento.'},
  revancha:{n:'Revancha',d:'Entraste para recuperar una pérdida anterior.'},
  fuera_plan:{n:'Fuera del plan',d:'Sin setup de tu plan o fuera de tu horario.'},
  sin_stop:{n:'Sin stop',d:'Entraste sin stop o lo quitaste.'},
  stop_movido:{n:'Stop movido en contra',d:'Alejaste el stop para no asumir la pérdida.'},
  tamano:{n:'Tamaño excesivo',d:'Más contratos de los que marca tu plan.'},
  pronto:{n:'Salida antes de tiempo',d:'Cerraste la ganadora antes de tu objetivo por miedo.'},
  tarde:{n:'Aguantar la perdedora',d:'No cerraste cuando la idea ya estaba invalidada.'},
  sobreoperar:{n:'Sobreoperar',d:'Entrada de más tras varias operaciones seguidas.'},
  noticia:{n:'Operar en noticia',d:'Dentro del mercado en un dato importante.'}
};
const ERRORES_IDS=Object.keys(ERRORES);
function erroresOp(t){ return Array.isArray(t.errores)?t.errores.filter(e=>ERRORES[e]):[]; }
/* Coste de cada error: suma del resultado de las operaciones marcadas con él, y comparación limpias frente a con error */
function costeErrores(ts){
  const por={}; let limpias=[], sucias=[];
  ts.forEach(t=>{ const u=usdOp(t), es=erroresOp(t); if(es.length) sucias.push(u); else limpias.push(u); es.forEach(e=>{ const o=por[e]||{id:e,n:0,u:0,perd:0}; o.n++; o.u+=u; if(u<0) o.perd+=u; por[e]=o; }); });
  const media=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
  const lista=Object.values(por).sort((a,b)=>a.u-b.u);
  return {lista,nCon:sucias.length,nSin:limpias.length,uCon:sucias.reduce((s,x)=>s+x,0),uSin:limpias.reduce((s,x)=>s+x,0),mediaCon:media(sucias),mediaSin:media(limpias)};
}

const CUENTA_TIPOS={eod:'Trailing de fin de día',intra:'Trailing intradía',estatico:'Estático'};
function cuentaVacia(){ return {firma:'',tamano:null,ddMax:null,ddTipo:'eod',bloqueo:true,limiteDiario:null,objetivo:null,desde:'',fase:'evaluacion',actualizado:null}; }
function cuentaNormal(c){
  const b=cuentaVacia(); if(!c || typeof c!=='object') return b;
  const n=v=>{ const x=Number(v); return isFinite(x) && x>0 ? Math.round(x*100)/100 : null; };
  return {firma:String(c.firma||'').slice(0,60),tamano:n(c.tamano),ddMax:n(c.ddMax),ddTipo:CUENTA_TIPOS[c.ddTipo]?c.ddTipo:'eod',bloqueo:c.bloqueo!==false,
    limiteDiario:n(c.limiteDiario),objetivo:n(c.objetivo),desde:/^\d{4}-\d{2}-\d{2}$/.test(c.desde||'')?c.desde:'',fase:c.fase==='fondeada'?'fondeada':'evaluacion',actualizado:c.actualizado||null};
}
function cuentaActiva(c){ return !!(c && c.actualizado && c.ddMax); }
function ordenCuenta(ts){ return ts.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.hEnt||0)-(b.hEnt||0)); }
/* Estado de la cuenta de fondeo a partir de las operaciones reales desde la fecha de inicio */
function evaluarCuenta(cuenta,trades,hoy){
  const c=cuentaNormal(cuenta); if(!cuentaActiva(c)) return null;
  const ops=ordenCuenta((trades||[]).filter(t=>!t.ejemplo && (!c.desde || t.fecha>=c.desde)));
  let pnl=0, picoIntra=0, picoEod=0, suelo=-c.ddMax, peorMargen=Infinity, ultimoDia=null, pnlDia=0;
  const dias={};
  ops.forEach(t=>{
    if(t.fecha!==ultimoDia){
      if(ultimoDia!=null) picoEod=Math.max(picoEod,pnl);
      ultimoDia=t.fecha;
    }
    pnl+=usdOp(t); dias[t.fecha]=(dias[t.fecha]||0)+usdOp(t);
    picoIntra=Math.max(picoIntra,pnl);
    const pico=c.ddTipo==='intra'?picoIntra:(c.ddTipo==='eod'?picoEod:0);
    suelo=pico-c.ddMax; if(c.bloqueo && suelo>0) suelo=0;
    peorMargen=Math.min(peorMargen,pnl-suelo);
  });
  const pico=c.ddTipo==='intra'?picoIntra:(c.ddTipo==='eod'?picoEod:0);
  suelo=pico-c.ddMax; if(c.bloqueo && suelo>0) suelo=0;
  const margen=pnl-suelo, hoyI=hoy||null, hoyPnl=hoyI&&dias[hoyI]||0;
  const pctMargen=Math.max(0,Math.min(1,margen/c.ddMax));
  let estado='ok';
  if(margen<=0) estado='quemada';
  else if(c.objetivo && pnl>=c.objetivo) estado='objetivo';
  else if(pctMargen<0.2) estado='peligro';
  else if(pctMargen<0.4) estado='aviso';
  const limiteHoy=c.limiteDiario?{limite:c.limiteDiario,usado:Math.max(0,-hoyPnl),queda:Math.max(0,c.limiteDiario+Math.min(0,hoyPnl)),roto:hoyPnl<=-c.limiteDiario}:null;
  if(limiteHoy && limiteHoy.roto && estado!=='quemada') estado='limite';
  const nDias=Object.keys(dias).length, saldo=(c.tamano||0)+pnl;
  return {c,pnl,saldo,pico,suelo,margen,pctMargen,peorMargen:isFinite(peorMargen)?peorMargen:c.ddMax,estado,hoyPnl,limiteHoy,nDias,n:ops.length,
    objetivo:c.objetivo?{total:c.objetivo,pct:Math.max(0,Math.min(1,pnl/c.objetivo)),falta:Math.max(0,c.objetivo-pnl)}:null,
    riesgoSugerido:Math.round(Math.max(0,margen)*0.1)};
}
function textoCuenta(ev){
  if(!ev) return [];
  const l=[`Cuenta de fondeo${ev.c.firma?' ('+ev.c.firma+')':''}: ${ev.c.fase==='fondeada'?'fondeada':'en evaluación'}, tamaño ${ev.c.tamano||'?'} $, drawdown ${CUENTA_TIPOS[ev.c.ddTipo].toLowerCase()} de ${ev.c.ddMax} $${ev.c.bloqueo?' que se bloquea en el saldo inicial':''}.`];
  l.push(`Resultado acumulado ${dolares(ev.pnl)}; margen hasta el drawdown ${Math.round(ev.margen)} $ (${Math.round(ev.pctMargen*100)} % del drawdown); el margen mínimo que ha tenido fue ${Math.round(ev.peorMargen)} $.`);
  if(ev.objetivo) l.push(`Objetivo ${ev.objetivo.total} $: lleva un ${Math.round(ev.objetivo.pct*100)} %, le faltan ${Math.round(ev.objetivo.falta)} $.`);
  if(ev.limiteHoy) l.push(`Límite de pérdida diaria ${ev.limiteHoy.limite} $: hoy ${dolares(ev.hoyPnl)}${ev.limiteHoy.roto?' (LÍMITE SUPERADO)':''}.`);
  l.push(`Estado: ${ev.estado}. Riesgo por operación razonable con este margen: unos ${ev.riesgoSugerido} $ (10 % del margen).`);
  return l;
}

/* Rutina: antes y después de la sesión, por fecha */
const RUTINA_PRE=[['niveles','Niveles de ayer y de la noche marcados'],['noticias','Calendario de noticias revisado'],['plan','Plan releído: riesgo, parada y setups'],['descanso','Pantalla y plataforma listas, sin distracciones']];
const ESCALA={1:'muy mal',2:'mal',3:'normal',4:'bien',5:'muy bien'};
function rutinaDe(rutinas,f){ const r=rutinas&&rutinas[f]; return r&&typeof r==='object'?r:null; }
function rutinaNormal(r){
  if(!r || typeof r!=='object') return null;
  const n=v=>{ const x=Number(v); return x>=1&&x<=5?Math.round(x):null; };
  const out={};
  if(r.pre){ const p=r.pre; out.pre={checks:(Array.isArray(p.checks)?p.checks:[]).filter(k=>RUTINA_PRE.some(x=>x[0]===k)),sueno:n(p.sueno),animo:n(p.animo),nota:String(p.nota||'').slice(0,500),hora:p.hora||null}; }
  if(r.post){ const q=r.post; out.post={disciplina:n(q.disciplina),mejora:String(q.mejora||'').slice(0,300),nota:String(q.nota||'').slice(0,800),hora:q.hora||null}; }
  return out.pre||out.post?out:null;
}
function textoRutina(r){
  const x=rutinaNormal(r); if(!x) return null; const l=[];
  if(x.pre){ const hechos=RUTINA_PRE.filter(k=>x.pre.checks.includes(k[0])).map(k=>k[1]); l.push(`Antes de la sesión: sueño ${x.pre.sueno?x.pre.sueno+'/5 ('+ESCALA[x.pre.sueno]+')':'sin apuntar'}, ánimo ${x.pre.animo?x.pre.animo+'/5 ('+ESCALA[x.pre.animo]+')':'sin apuntar'}. Preparación: ${hechos.length?hechos.join('; '):'nada marcado'} (${hechos.length} de ${RUTINA_PRE.length}).${x.pre.nota?' Nota: "'+x.pre.nota+'"':''}`); }
  if(x.post){ l.push(`Al cerrar: se puntuó la disciplina con ${x.post.disciplina?x.post.disciplina+'/5':'sin nota'}.${x.post.mejora?' Mejora para mañana: "'+x.post.mejora+'".':''}${x.post.nota?' Revisión: "'+x.post.nota+'"':''}`); }
  return l.join(' ');
}
/* Resultado del día según cómo llegó: para el panel de estadísticas */
function rendimientoPorEstado(rutinas,trades,clave){
  const porDia={}; (trades||[]).forEach(t=>{ porDia[t.fecha]=(porDia[t.fecha]||0)+usdOp(t); });
  const grupos={bajo:{n:0,u:0,etq:'1-2'},medio:{n:0,u:0,etq:'3'},alto:{n:0,u:0,etq:'4-5'}};
  Object.keys(porDia).forEach(f=>{ const r=rutinaNormal(rutinas&&rutinas[f]); const v=r&&r.pre&&r.pre[clave]; if(!v) return; const g=v<=2?'bajo':(v===3?'medio':'alto'); grupos[g].n++; grupos[g].u+=porDia[f]; });
  return grupos;
}

export { VALOR_PUNTO, PLAN_REGLAS, PLAN_DIAS_L, planVacio, planNormal, planGuardado, usdOp, dolares, importe, riesgoOp, stopOp, rOp, hhmm, horaEn, minutosHora, sumarDias, diaDeFecha, huellaOps, evaluarDia, evaluarPeriodo, planComoTexto, ERRORES, erroresOp, costeErrores, CUENTA_TIPOS, cuentaNormal, cuentaActiva, evaluarCuenta, textoCuenta, RUTINA_PRE, rutinaNormal, textoRutina };
