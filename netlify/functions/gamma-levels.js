// netlify/functions/gamma-levels.js
const https=require("https");
const CONTRACT_SIZE=100,RISK_FREE_RATE=0.05;
const FMAP={
  ES:{etf:"SPY",idx:"I:SPX",mult:10,name:"E-mini S&P 500"},
  NQ:{etf:"QQQ",idx:"I:NDX",mult:40,name:"E-mini Nasdaq 100"},
  SPY:{etf:"SPY",idx:"I:SPX",mult:1,name:"S&P 500 ETF"},
  QQQ:{etf:"QQQ",idx:"I:NDX",mult:1,name:"Nasdaq 100 ETF"},
};
function npdf(x){return Math.exp(-.5*x*x)/Math.sqrt(2*Math.PI)}
function bsG(S,K,T,r,s){if(T<=0||s<=0||S<=0||K<=0)return 0;const d1=(Math.log(S/K)+(r+.5*s*s)*T)/(s*Math.sqrt(T));return npdf(d1)/(S*s*Math.sqrt(T))}
function tte(s){const e=new Date(s+"T16:00:00Z"),n=new Date();return Math.max((e-n)/864e5/365,1/365)}
function fj(url){return new Promise((r,j)=>{https.get(url,res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>{try{r(JSON.parse(d))}catch(e){j(e)}});res.on("error",j)}).on("error",j)})}
function fmt(v){const a=Math.abs(v);if(a>=1e9)return(v/1e9).toFixed(2)+"B";if(a>=1e6)return(v/1e6).toFixed(1)+"M";if(a>=1e3)return(v/1e3).toFixed(1)+"K";return v.toFixed(0)}

exports.handler=async(event)=>{
  const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Content-Type":"application/json"};
  if(event.httpMethod==="OPTIONS")return{statusCode:200,headers:H,body:""};
  try{
    const p=event.queryStringParameters||{};
    const raw=(p.ticker||"ES").toUpperCase();
    const maxExp=parseInt(p.expirations||"4",10);
    const m=FMAP[raw]||FMAP.ES;
    const isFut=raw==="ES"||raw==="NQ";
    const ak=process.env.MASSIVE_API_KEY;
    if(!ak)return{statusCode:500,headers:H,body:JSON.stringify({error:"MASSIVE_API_KEY not configured"})};

    // ── ETF price ──
    const sd=await fj(`https://api.polygon.io/v2/aggs/ticker/${m.etf}/prev?adjusted=true&apiKey=${ak}`);
    let etfP=0;if(sd.results&&sd.results[0])etfP=sd.results[0].c;

    // ── Index/futures price ──
    let idxP=etfP*m.mult;
    try{const id=await fj(`https://api.polygon.io/v2/aggs/ticker/${m.idx}/prev?adjusted=true&apiKey=${ak}`);if(id.results&&id.results[0])idxP=id.results[0].c;}catch(e){}
    const displayP=isFut?idxP:etfP;
    const spot=etfP||1;

    // ── Price history (5min candles, last 3 days) ──
    const now=new Date();
    const from=new Date(now.getTime()-3*24*60*60*1000).toISOString().split('T')[0];
    const to=now.toISOString().split('T')[0];
    let candles=[];
    try{
      const hUrl=`https://api.polygon.io/v2/aggs/ticker/${m.etf}/range/5/minute/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${ak}`;
      const hd=await fj(hUrl);
      if(hd.results){
        candles=hd.results.map(r=>({
          time:Math.floor(r.t/1000),
          open:isFut?r.o*m.mult:r.o,
          high:isFut?r.h*m.mult:r.h,
          low:isFut?r.l*m.mult:r.l,
          close:isFut?r.c*m.mult:r.c,
          volume:r.v||0,
        }));
      }
    }catch(e){console.error("Candles error:",e)}

    // ── Options chain ──
    const od=await fj(`https://api.polygon.io/v3/snapshot/options/${m.etf}?limit=250&apiKey=${ak}`);
    if(!od.results||!od.results.length)return{statusCode:404,headers:H,body:JSON.stringify({error:`No options for ${m.etf}`})};

    const contracts=[],expSet=new Set();
    for(const o of od.results){
      const d=o.details||{},g=o.greeks||{},oi=o.open_interest||0;
      if(oi<=0)continue;expSet.add(d.expiration_date);
      contracts.push({strike:d.strike_price,type:d.contract_type,exp:d.expiration_date,oi,gamma:g.gamma||0,iv:o.implied_volatility||.3,delta:g.delta||0});
    }
    const selE=new Set([...expSet].sort().slice(0,maxExp));
    const filt=contracts.filter(c=>selE.has(c.exp));

    // ── GEX calc ──
    const gS={},cG={},pG={},oiByStrike={};
    for(const c of filt){
      let gm=c.gamma;if(!gm)gm=bsG(spot,c.strike,tte(c.exp),RISK_FREE_RATE,c.iv);
      let gx=gm*c.oi*CONTRACT_SIZE*spot*spot*.01;
      if(c.type==="put")gx*=-1;
      const s=c.strike;
      gS[s]=(gS[s]||0)+gx;
      if(c.type==="call")cG[s]=(cG[s]||0)+gx;else pG[s]=(pG[s]||0)+gx;
      oiByStrike[s]=(oiByStrike[s]||0)+c.oi;
    }

    const strikes=Object.keys(gS).map(Number).sort((a,b)=>a-b);
    let cw={s:0,g:0},pw={s:0,g:0},mp={s:0,g:0},mn={s:0,g:0},gf=spot,net=0;
    for(const s of strikes){
      const g=gS[s];net+=g;
      if(g>mp.g)mp={s,g};if(g<mn.g)mn={s,g};
      const c=cG[s]||0;if(c>cw.g)cw={s,g:c};
      const pp=pG[s]||0;if(pp<pw.g)pw={s,g:pp};
    }
    for(let i=1;i<strikes.length;i++){
      const g1=gS[strikes[i-1]],g2=gS[strikes[i]];
      if(g1*g2<0){gf=Math.round((strikes[i-1]+(0-g1)*(strikes[i]-strikes[i-1])/(g2-g1))*100)/100;break;}
    }
    const hvlC=strikes.filter(s=>s>=spot*.95&&s<=spot*1.05);
    let hvl=spot,hvlM=0;for(const s of hvlC){if(Math.abs(gS[s])>hvlM){hvlM=Math.abs(gS[s]);hvl=s;}}

    // ── POC: strike with highest total OI ──
    let poc={strike:0,oi:0};
    for(const s of strikes){if((oiByStrike[s]||0)>poc.oi)poc={strike:s,oi:oiByStrike[s]};}

    const toD=s=>isFut?Math.round(s*m.mult*100)/100:s;
    const cStk=strikes.filter(s=>s>=spot*.92&&s<=spot*1.08);
    const dist=cStk.map(s=>({strike:toD(s),etfStrike:s,gex:Math.round(gS[s]),callGex:Math.round(cG[s]||0),putGex:Math.round(pG[s]||0),oi:oiByStrike[s]||0}));

    const gReg=spot>gf?"POSITIVE":"NEGATIVE";
    const vReg=spot>hvl?"LOW_VOL":"HIGH_VOL";
    const maxAbs=Math.max(Math.abs(mp.g),Math.abs(mn.g),1);
    const vScore=Math.min(100,Math.round(Math.abs(net)/maxAbs*100));
    let vLabel="Calm";if(vScore>70)vLabel="Extreme";else if(vScore>40)vLabel="Elevated";else if(vScore>20)vLabel="Moderate";

    return{statusCode:200,headers:H,body:JSON.stringify({
      ticker:raw,name:m.name,isFutures:isFut,
      spotPrice:Math.round(displayP*100)/100,etfPrice:Math.round(etfP*100)/100,etfTicker:m.etf,multiplier:m.mult,
      timestamp:new Date().toISOString(),expirations:[...selE],contractCount:filt.length,
      netGex:Math.round(net),netGexFormatted:fmt(net),gammaRegime:gReg,volRegime:vReg,
      volatility:{score:vScore,label:vLabel},
      candles,
      levels:{
        zeroGamma:{strike:toD(gf),etfStrike:gf,label:"Zero Gamma",shortLabel:"ZG",description:"Gamma flip — volatility regime change"},
        maxPositive:{strike:toD(mp.s),etfStrike:mp.s,gex:Math.round(mp.g),gexFormatted:fmt(mp.g),label:"Max + Gamma",shortLabel:"MG+",description:"Support — dealer hedging pins price"},
        maxNegative:{strike:toD(mn.s),etfStrike:mn.s,gex:Math.round(mn.g),gexFormatted:fmt(mn.g),label:"Max - Gamma",shortLabel:"MG-",description:"Amplified moves — dealers accelerate"},
        callWall:{strike:toD(cw.s),etfStrike:cw.s,gex:Math.round(cw.g),gexFormatted:fmt(cw.g),label:"Call Wall",shortLabel:"CW",description:"Resistance — highest call gamma"},
        putWall:{strike:toD(pw.s),etfStrike:pw.s,gex:Math.round(pw.g),gexFormatted:fmt(pw.g),label:"Put Wall",shortLabel:"PW",description:"Support — highest put gamma"},
        hvl:{strike:toD(hvl),etfStrike:hvl,label:"HVL",shortLabel:"HVL",description:"Above = low vol, Below = high vol"},
        poc:{strike:toD(poc.strike),etfStrike:poc.strike,oi:poc.oi,label:"POC",shortLabel:"POC",description:"Point of Control — max open interest"},
      },
      distribution:dist,
    })};
  }catch(err){
    console.error("Error:",err);
    return{statusCode:500,headers:H,body:JSON.stringify({error:"Failed",details:err.message})};
  }
};
