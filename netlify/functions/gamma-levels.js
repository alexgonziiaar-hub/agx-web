// netlify/functions/gamma-levels.js
const https = require("https");
const CONTRACT_SIZE = 100;
const RISK_FREE_RATE = 0.05;
const FUTURES_MAP = {
  ES: { etf: "SPY", multiplier: 10, name: "E-mini S&P 500" },
  NQ: { etf: "QQQ", multiplier: 40, name: "E-mini Nasdaq 100" },
  SPY: { etf: "SPY", multiplier: 1, name: "S&P 500 ETF" },
  QQQ: { etf: "QQQ", multiplier: 1, name: "Nasdaq 100 ETF" },
};
function normPdf(x) { return Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI); }
function bsGamma(S,K,T,r,sigma) {
  if(T<=0||sigma<=0||S<=0||K<=0) return 0;
  const d1=(Math.log(S/K)+(r+0.5*sigma*sigma)*T)/(sigma*Math.sqrt(T));
  return normPdf(d1)/(S*sigma*Math.sqrt(T));
}
function timeToExpiry(s) {
  const e=new Date(s+"T16:00:00Z"), n=new Date();
  return Math.max((e-n)/(1000*60*60*24*365),1/365);
}
function fetchJson(url) {
  return new Promise((resolve,reject)=>{
    https.get(url,(res)=>{
      let d=""; res.on("data",(c)=>d+=c);
      res.on("end",()=>{ try{resolve(JSON.parse(d))}catch(e){reject(e)} });
      res.on("error",reject);
    }).on("error",reject);
  });
}
function fmtGex(v) {
  const a=Math.abs(v);
  if(a>=1e9) return (v/1e9).toFixed(2)+"B";
  if(a>=1e6) return (v/1e6).toFixed(1)+"M";
  if(a>=1e3) return (v/1e3).toFixed(1)+"K";
  return v.toFixed(0);
}
exports.handler = async(event)=>{
  const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Content-Type":"application/json"};
  if(event.httpMethod==="OPTIONS") return {statusCode:200,headers:H,body:""};
  try {
    const p=event.queryStringParameters||{};
    const raw=(p.ticker||"ES").toUpperCase();
    const maxExp=parseInt(p.expirations||"4",10);
    const map=FUTURES_MAP[raw]||FUTURES_MAP.ES;
    const etf=map.etf, mult=map.multiplier, isFut=raw==="ES"||raw==="NQ";
    const apiKey=process.env.MASSIVE_API_KEY;
    if(!apiKey) return {statusCode:500,headers:H,body:JSON.stringify({error:"MASSIVE_API_KEY not configured"})};
    // ETF price
    const sd=await fetchJson(`https://api.polygon.io/v2/aggs/ticker/${etf}/prev?adjusted=true&apiKey=${apiKey}`);
    let etfP=0;
    if(sd.results&&sd.results.length>0) etfP=sd.results[0].c;
    // Futures/index price
    let futP=Math.round(etfP*mult*100)/100;
    if(isFut){
      try{
        const idx=raw==="ES"?"I:SPX":"I:NDX";
        const id=await fetchJson(`https://api.polygon.io/v2/aggs/ticker/${idx}/prev?adjusted=true&apiKey=${apiKey}`);
        if(id.results&&id.results.length>0) futP=id.results[0].c;
      }catch(e){}
    }
    const displayP=isFut?futP:etfP;
    const spot=etfP||1;
    // Options chain
    const od=await fetchJson(`https://api.polygon.io/v3/snapshot/options/${etf}?limit=250&apiKey=${apiKey}`);
    if(!od.results||od.results.length===0)
      return {statusCode:404,headers:H,body:JSON.stringify({error:`No options data for ${etf}`})};
    if(spot===1&&od.results[0].underlying_asset) {/*fallback*/}
    const contracts=[], expSet=new Set();
    for(const o of od.results){
      const d=o.details||{}, g=o.greeks||{}, oi=o.open_interest||0;
      if(oi<=0) continue;
      expSet.add(d.expiration_date);
      contracts.push({strike:d.strike_price,type:d.contract_type,expiration:d.expiration_date,oi,gamma:g.gamma||0,iv:o.implied_volatility||0.3,delta:g.delta||0});
    }
    const selExps=new Set([...expSet].sort().slice(0,maxExp));
    const filt=contracts.filter(c=>selExps.has(c.expiration));
    // GEX calc
    const gexS={}, cGex={}, pGex={};
    for(const c of filt){
      let gm=c.gamma;
      if(!gm) gm=bsGamma(spot,c.strike,timeToExpiry(c.expiration),RISK_FREE_RATE,c.iv);
      let gx=gm*c.oi*CONTRACT_SIZE*spot*spot*0.01;
      if(c.type==="put") gx*=-1;
      const s=c.strike;
      gexS[s]=(gexS[s]||0)+gx;
      if(c.type==="call") cGex[s]=(cGex[s]||0)+gx; else pGex[s]=(pGex[s]||0)+gx;
    }
    const strikes=Object.keys(gexS).map(Number).sort((a,b)=>a-b);
    let cw={strike:0,gex:0},pw={strike:0,gex:0},mp={strike:0,gex:0},mn={strike:0,gex:0},gf=spot,net=0;
    for(const s of strikes){
      const g=gexS[s]; net+=g;
      if(g>mp.gex) mp={strike:s,gex:g};
      if(g<mn.gex) mn={strike:s,gex:g};
      const c=cGex[s]||0; if(c>cw.gex) cw={strike:s,gex:c};
      const pp=pGex[s]||0; if(pp<pw.gex) pw={strike:s,gex:pp};
    }
    for(let i=1;i<strikes.length;i++){
      const g1=gexS[strikes[i-1]],g2=gexS[strikes[i]];
      if(g1*g2<0){gf=Math.round((strikes[i-1]+(0-g1)*(strikes[i]-strikes[i-1])/(g2-g1))*100)/100;break;}
    }
    const hvlC=strikes.filter(s=>s>=spot*0.95&&s<=spot*1.05);
    let hvl=spot,hvlM=0;
    for(const s of hvlC){if(Math.abs(gexS[s])>hvlM){hvlM=Math.abs(gexS[s]);hvl=s;}}
    const toDP=s=>isFut?Math.round(s*mult*100)/100:s;
    const cStk=strikes.filter(s=>s>=spot*0.92&&s<=spot*1.08);
    const dist=cStk.map(s=>({strike:toDP(s),etfStrike:s,gex:Math.round(gexS[s]),callGex:Math.round(cGex[s]||0),putGex:Math.round(pGex[s]||0)}));
    const gReg=spot>gf?"POSITIVE":"NEGATIVE";
    const vReg=spot>hvl?"LOW_VOL":"HIGH_VOL";
    const maxAbs=Math.max(Math.abs(mp.gex),Math.abs(mn.gex),1);
    const vScore=Math.min(100,Math.round(Math.abs(net)/maxAbs*100));
    let vLabel="Calm"; if(vScore>70) vLabel="Extreme"; else if(vScore>40) vLabel="Elevated"; else if(vScore>20) vLabel="Moderate";
    return {statusCode:200,headers:H,body:JSON.stringify({
      ticker:raw,name:map.name,isFutures:isFut,
      spotPrice:Math.round(displayP*100)/100,etfPrice:Math.round(etfP*100)/100,etfTicker:etf,multiplier:mult,
      timestamp:new Date().toISOString(),expirations:[...selExps],contractCount:filt.length,
      netGex:Math.round(net),netGexFormatted:fmtGex(net),gammaRegime:gReg,volRegime:vReg,
      volatility:{score:vScore,label:vLabel},
      levels:{
        zeroGamma:{strike:toDP(gf),etfStrike:gf,label:"Zero Gamma",shortLabel:"ZG",description:"Gamma flip — volatility regime change"},
        maxPositive:{strike:toDP(mp.strike),etfStrike:mp.strike,gex:Math.round(mp.gex),gexFormatted:fmtGex(mp.gex),label:"Max Positive Gamma",shortLabel:"MG+",description:"Strong support — dealer hedging pins price"},
        maxNegative:{strike:toDP(mn.strike),etfStrike:mn.strike,gex:Math.round(mn.gex),gexFormatted:fmtGex(mn.gex),label:"Max Negative Gamma",shortLabel:"MG-",description:"Amplified moves — dealers accelerate trend"},
        callWall:{strike:toDP(cw.strike),etfStrike:cw.strike,gex:Math.round(cw.gex),gexFormatted:fmtGex(cw.gex),label:"Call Wall",shortLabel:"CW",description:"Resistance — highest call gamma concentration"},
        putWall:{strike:toDP(pw.strike),etfStrike:pw.strike,gex:Math.round(pw.gex),gexFormatted:fmtGex(pw.gex),label:"Put Wall",shortLabel:"PW",description:"Support — highest put gamma concentration"},
        hvl:{strike:toDP(hvl),etfStrike:hvl,label:"HVL",shortLabel:"HVL",description:"Above = low vol, Below = high vol regime"},
      },
      distribution:dist,
    })};
  } catch(err){
    console.error("Error:",err);
    return {statusCode:500,headers:H,body:JSON.stringify({error:"Failed",details:err.message})};
  }
};
