"""Self-contained HTML report for a time machine run: an animated replay of
every historical trade, the 10,000-path "buy today" fan, the spread of
resampled years, and the trade list. No external files or scripts."""

from __future__ import annotations

import html
import json

import numpy as np
import pandas as pd


def _payload(df: pd.DataFrame, result: dict, max_bars: int = 1500) -> dict:
    tail = df.tail(max_bars)
    mc_t = dict(result["trade_monte_carlo"])
    hist = mc_t.pop("hist", None)
    bt = result["buy_today_monte_carlo"]
    rules = result["exit_rules"]
    atr = None
    if bt["with_drift"]:
        from ..indicators import compute_all
        atr = float(compute_all(df)["atr14"].iloc[-1])
    start = bt["with_drift"]["start_price"]
    stop = start - rules["stop_atr"] * atr if atr else None
    target = start + rules["target_r"] * (start - stop) if (atr and rules.get("target_r")) else None
    return {
        "symbol": result["symbol"], "as_of": result["as_of"], "source": result.get("source"),
        "dates": [str(d.date()) for d in tail.index], "close": tail["close"].round(4).tolist(),
        "trades": [t for t in result["replay"]["trades"] if t["entry_date"] >= str(tail.index[0].date())],
        "stats": result["replay"]["stats"], "mc_trades": mc_t,
        "hist": None if hist is None else {"counts": hist[0].tolist(), "edges": np.round(hist[1], 2).tolist()},
        "fan": {"with": bt["with_drift"]["fan"], "without": bt["without_drift"]["fan"]},
        "bt": {k.split("_")[0]: {a: b for a, b in v.items() if a != "fan"} for k, v in bt.items()},
        "stop": None if stop is None else round(stop, 2), "target": None if target is None else round(target, 2),
        "verdict": result["verdict"], "rules": result["strategy_rules"], "exit_rules": rules,
    }


def render(df: pd.DataFrame, result: dict) -> str:
    data = json.dumps(_payload(df, result), default=str).replace("</", "<\\/")
    title = html.escape(f"{result['symbol']} time machine")
    return TEMPLATE.replace("__TITLE__", title).replace("__DATA__", data)


TEMPLATE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>__TITLE__</title>
<style>
:root{color-scheme:light;--bg:#fcfcfb;--card:#ffffff;--ink:#0b0b0b;--ink2:#52514e;--muted:#8a8984;--grid:#e6e5e0;--line:#d4d3cd;
--s1:#2a78d6;--f1:#cde2fb;--f2:#86b6ef;--good:#0ca30c;--bad:#d03b3b;--warn:#fab219}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#1a1a19;--card:#232322;--ink:#f0efec;--ink2:#c3c2b7;--muted:#8f8e86;--grid:#33332f;--line:#45443f;--s1:#86b6ef;--f1:#0d366b;--f2:#1c5cab}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#1a1a19;--card:#232322;--ink:#f0efec;--ink2:#c3c2b7;--muted:#8f8e86;--grid:#33332f;--line:#45443f;--s1:#86b6ef;--f1:#0d366b;--f2:#1c5cab}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1100px;margin:0 auto;padding:20px 16px 48px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:0 0 8px}
.sub{color:var(--ink2);margin:0 0 16px}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;margin:0 0 14px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 14px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px}.tile b{display:block;font-size:22px;font-variant-numeric:tabular-nums}
.tile span{color:var(--ink2);font-size:12px}.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-weight:600;border:1px solid var(--line)}
svg{display:block;width:100%;height:auto;overflow:visible}.axis{fill:var(--muted);font-size:11px}.gl{stroke:var(--grid);stroke-width:1}
.ctrl{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 8px}button,select{font:inherit;padding:5px 12px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink);cursor:pointer}
input[type=range]{flex:1;min-width:140px}.tip{position:fixed;pointer-events:none;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:6px 9px;font-size:12px;display:none;z-index:9;box-shadow:0 2px 8px #0002}
table{border-collapse:collapse;width:100%;font-size:12.5px;font-variant-numeric:tabular-nums}th,td{padding:5px 8px;border-bottom:1px solid var(--grid);text-align:right}th:first-child,td:first-child{text-align:left}
.tw{overflow-x:auto;max-height:360px}.legend{display:flex;gap:14px;flex-wrap:wrap;color:var(--ink2);font-size:12px;margin:6px 0 0}.legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-2px}
.note{color:var(--ink2);font-size:12.5px}ul{margin:6px 0 0 18px;padding:0}
</style></head><body><main>
<h1 id="h"></h1><p class="sub" id="sub"></p>
<div class="card"><h2>Verdict <span class="badge" id="vb"></span></h2><ul id="vn"></ul></div>
<div class="tiles" id="tiles"></div>
<div class="card"><h2>Replay</h2>
<div class="ctrl"><button id="play">▶ Play replay</button><input type="range" id="scrub" min="20" value="0" aria-label="Replay position"><span id="pos" class="note"></span></div>
<div id="price"></div>
<div class="legend"><span><i style="background:var(--s1)"></i>Close</span><span>▲ entry</span><span style="color:var(--good)">● win exit</span><span style="color:var(--bad)">✕ loss exit</span></div></div>
<div class="card"><h2>If you buy today: 10,000 simulated paths</h2>
<div class="ctrl"><select id="drift"><option value="with">With the stock's past drift</option><option value="without">Drift removed</option></select></div>
<div id="fan"></div>
<div class="legend"><span><i style="background:var(--f1)"></i>5th to 95th percentile</span><span><i style="background:var(--f2)"></i>25th to 75th</span><span><i style="background:var(--s1)"></i>Median</span><span style="color:var(--bad)">— stop</span><span style="color:var(--good)">— target</span></div>
<p class="note" id="fanNote"></p></div>
<div class="card"><h2>10,000 resampled years of these trades</h2><div id="hist"></div><p class="note" id="histNote"></p></div>
<div class="card"><h2>Rules tested</h2><ul id="rules"></ul></div>
<div class="card"><h2>Every replayed trade</h2><div class="tw"><table id="tt"></table></div></div>
<p class="note">Research and paper trading only. Not financial advice. Backtests and simulations estimate odds from past data and cannot guarantee profit.</p>
</main><div class="tip" id="tip"></div>
<script>
const D=__DATA__;const $=id=>document.getElementById(id);const NS="http://www.w3.org/2000/svg";
const fmt=(v,d=2)=>v==null?"n/a":Number(v).toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d});
const el=(t,a={},p)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e};
const tip=$("tip");const showTip=(ev,h)=>{tip.innerHTML=h;tip.style.display="block";tip.style.left=Math.min(ev.clientX+12,innerWidth-220)+"px";tip.style.top=(ev.clientY+12)+"px"};const hideTip=()=>tip.style.display="none";
$("h").textContent=D.symbol+" time machine";$("sub").textContent=`Data to ${D.as_of} · ${D.source||""}`;
$("vb").textContent=D.verdict.label;D.verdict.notes.forEach(n=>{const li=document.createElement("li");li.textContent=n;$("vn").appendChild(li)});
const S=D.stats,M=D.mc_trades,B=D.bt.with;
const tiles=[["Historical trades",S.trades??0,0],["Win rate",S.win_rate_pct,1,"%"],["Average trade (R)",S.expectancy_r,2],["Profitable resampled years",M.prob_profit_pct,1,"%"],["Buy today: chance of profit",B.prob_profit_pct,1,"%"],["Buy today: hits target first",B.prob_target_pct,1,"%"]];
tiles.forEach(([l,v,d,u])=>{const t=document.createElement("div");t.className="tile";t.innerHTML=`<b>${v==null?"n/a":fmt(v,d)+(u||"")}</b><span>${l}</span>`;$("tiles").appendChild(t)});
Object.entries(D.rules).forEach(([k,v])=>{const li=document.createElement("li");li.textContent=`${k}: ${v}`;$("rules").appendChild(li)});
const er=D.exit_rules;{const li=document.createElement("li");li.textContent=`Exit: stop ${er.stop_atr} ATR, target ${er.target_r??"none"}R, trailing ${er.trail_atr??"none"} ATR, time stop ${er.max_bars} bars, costs ${er.cost_bps} bps per side.`;$("rules").appendChild(li)}

function frame(host,W,H){host.innerHTML="";return el("svg",{viewBox:`0 0 ${W} ${H}`,role:"img"},host)}
function yAxis(svg,y,lo,hi,x0,x1){for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4,yy=y(v);el("line",{x1:x0,x2:x1,y1:yy,y2:yy,class:"gl"},svg);el("text",{x:x1+4,y:yy+4,class:"axis"},svg).textContent=fmt(v,v>100?0:2)}}

// replay chart
const W=1000,H=340,L=8,R=940,T=10,Bm=300;const n=D.close.length;
const lo=Math.min(...D.close)*0.97,hi=Math.max(...D.close)*1.03;const x=i=>L+(R-L)*i/(n-1),y=v=>Bm-(Bm-T)*(v-lo)/(hi-lo);
const idx={};D.dates.forEach((d,i)=>idx[d]=i);
const svgP=frame($("price"),W,H);yAxis(svgP,y,lo,hi,L,R);
for(let k=0;k<5;k++){const i=Math.round((n-1)*k/4);el("text",{x:x(i),y:H-18,class:"axis","text-anchor":k==0?"start":k==4?"end":"middle"},svgP).textContent=D.dates[i]}
const path=el("path",{fill:"none",stroke:"var(--s1)","stroke-width":2,"stroke-linejoin":"round"},svgP);const marks=el("g",{},svgP);
const cross=el("line",{y1:T,y2:Bm,stroke:"var(--muted)","stroke-dasharray":"3 3",visibility:"hidden"},svgP);
let upto=n-1;
function draw(){let d="";for(let i=0;i<=upto;i++)d+=(i?"L":"M")+x(i).toFixed(1)+","+y(D.close[i]).toFixed(1);path.setAttribute("d",d);marks.innerHTML="";
 let eq=0,cnt=0;D.trades.forEach(t=>{const a=idx[t.entry_date],b=idx[t.exit_date];if(a==null||a>upto)return;
  const g=el("g",{},marks);const ax=x(a),ay=y(t.entry);el("path",{d:`M${ax},${ay+3}l-6,10h12z`,fill:"var(--ink2)"},g);
  if(b!=null&&b<=upto&&!t.open){cnt++;eq+=t.r_multiple;const win=t.return_pct>0,bx=x(b),by=y(t.exit);el("line",{x1:ax,y1:ay,x2:bx,y2:by,stroke:win?"var(--good)":"var(--bad)","stroke-width":1.5,"stroke-dasharray":"2 2"},g);
   if(win)el("circle",{cx:bx,cy:by,r:5,fill:"var(--good)",stroke:"var(--card)","stroke-width":2},g);else el("path",{d:`M${bx-5},${by-5}L${bx+5},${by+5}M${bx+5},${by-5}L${bx-5},${by+5}`,stroke:"var(--bad)","stroke-width":2.5},g)}
  const hit=el("rect",{x:ax-8,y:T,width:Math.max(16,(b!=null?x(b):ax)-ax+16),height:Bm-T,fill:"transparent"},g);
  hit.addEventListener("mousemove",ev=>showTip(ev,`<b>${t.entry_date} → ${t.exit_date}</b><br>Entry ${fmt(t.entry)} · Exit ${fmt(t.exit)}<br>${t.exit_reason} · ${t.bars} bars<br>${t.return_pct>0?"▲":"▼"} ${fmt(t.return_pct)}% (${fmt(t.r_multiple)}R)`));hit.addEventListener("mouseleave",hideTip)});
 $("pos").textContent=`${D.dates[upto]} · ${cnt} closed trades · ${eq>=0?"+":""}${eq.toFixed(1)}R so far`;$("scrub").value=upto}
$("scrub").max=n-1;$("scrub").addEventListener("input",e=>{upto=+e.target.value;draw()});
svgP.addEventListener("mousemove",ev=>{const r=svgP.getBoundingClientRect();const px=(ev.clientX-r.left)*W/r.width;const i=Math.max(0,Math.min(upto,Math.round((px-L)/(R-L)*(n-1))));
 if(ev.target.tagName!=="rect"){cross.setAttribute("x1",x(i));cross.setAttribute("x2",x(i));cross.setAttribute("visibility","visible");showTip(ev,`${D.dates[i]}<br>Close ${fmt(D.close[i])}`)}});
svgP.addEventListener("mouseleave",()=>{cross.setAttribute("visibility","hidden");hideTip()});
let timer=null;$("play").onclick=()=>{if(timer){clearInterval(timer);timer=null;$("play").textContent="▶ Play replay";return}
 if(upto>=n-1)upto=20;$("play").textContent="❚❚ Pause";timer=setInterval(()=>{upto=Math.min(n-1,upto+Math.max(1,Math.round(n/300)));draw();if(upto>=n-1){clearInterval(timer);timer=null;$("play").textContent="▶ Play replay"}},30)};
draw();

// fan
function fan(which){const F=D.fan[which],m=F.p50.length;const vals=[...F.p5,...F.p95,D.stop??F.p5[0],D.target??F.p95[0]];
 const lo=Math.min(...vals)*0.99,hi=Math.max(...vals)*1.01,W=1000,H=300,L=8,R=940,T=10,Bm=262;const x=i=>L+(R-L)*i/(m-1),y=v=>Bm-(Bm-T)*(v-lo)/(hi-lo);
 const svg=frame($("fan"),W,H);yAxis(svg,y,lo,hi,L,R);
 const band=(a,b,c)=>{let d="M"+a.map((v,i)=>x(i)+","+y(v)).join("L")+"L"+b.map((v,i)=>x(i)+","+y(v)).reverse().join("L")+"Z";el("path",{d,fill:c},svg)};
 band(F.p5,F.p95,"var(--f1)");band(F.p25,F.p75,"var(--f2)");el("path",{d:"M"+F.p50.map((v,i)=>x(i)+","+y(v)).join("L"),fill:"none",stroke:"var(--s1)","stroke-width":2},svg);
 [[D.stop,"var(--bad)","stop"],[D.target,"var(--good)","target"]].forEach(([v,c,l])=>{if(v==null)return;el("line",{x1:L,x2:R,y1:y(v),y2:y(v),stroke:c,"stroke-width":1.5,"stroke-dasharray":"6 4"},svg);el("text",{x:L+4,y:y(v)-5,class:"axis"},svg).textContent=`${l} ${fmt(v)}`});
 el("text",{x:L,y:H-12,class:"axis"},svg).textContent="day 1";el("text",{x:R,y:H-12,class:"axis","text-anchor":"end"},svg).textContent=`day ${m}`;
 const cr=el("line",{y1:T,y2:Bm,stroke:"var(--muted)","stroke-dasharray":"3 3",visibility:"hidden"},svg);
 svg.addEventListener("mousemove",ev=>{const r=svg.getBoundingClientRect();const i=Math.max(0,Math.min(m-1,Math.round(((ev.clientX-r.left)*W/r.width-L)/(R-L)*(m-1))));cr.setAttribute("x1",x(i));cr.setAttribute("x2",x(i));cr.setAttribute("visibility","visible");
  showTip(ev,`Day ${i+1}<br>95th ${fmt(F.p95[i])}<br>75th ${fmt(F.p75[i])}<br><b>Median ${fmt(F.p50[i])}</b><br>25th ${fmt(F.p25[i])}<br>5th ${fmt(F.p5[i])}`)});
 svg.addEventListener("mouseleave",()=>{cr.setAttribute("visibility","hidden");hideTip()});
 const b=D.bt[which];$("fanNote").textContent=`Start ${fmt(b.start_price)}. Profit in ${b.prob_profit_pct}% of paths; target first ${b.prob_target_pct}%, stop ${b.prob_stop_pct}%, trailing stop ${b.prob_trailing_pct}%, time stop ${b.prob_time_exit_pct}%. Median result ${fmt(b.median_return_pct)}% (5th ${fmt(b.p5_return_pct)}%, 95th ${fmt(b.p95_return_pct)}%). The band shows price paths without exits; exits are applied to each path for the odds.`}
$("drift").onchange=e=>fan(e.target.value);fan("with");

// histogram
if(D.hist){const c=D.hist.counts,e=D.hist.edges,W=1000,H=240,L=8,R=940,T=10,Bm=200;const mx=Math.max(...c);const bw=(R-L)/c.length;const svg=frame($("hist"),W,H);
 for(let i=0;i<=4;i++){const yy=Bm-(Bm-T)*i/4;el("line",{x1:L,x2:R,y1:yy,y2:yy,class:"gl"},svg)}
 c.forEach((v,i)=>{const h=(Bm-T)*v/mx,neg=e[i+1]<=0;const r=el("rect",{x:L+i*bw+1,y:Bm-h,width:Math.max(1,bw-2),height:h,rx:2,fill:neg?"var(--bad)":"var(--s1)"},svg);
  const hit=el("rect",{x:L+i*bw,y:T,width:bw,height:Bm-T,fill:"transparent"},svg);hit.addEventListener("mousemove",ev=>showTip(ev,`${fmt(e[i],1)}% to ${fmt(e[i+1],1)}%<br>${v.toLocaleString()} of 10,000 years`));hit.addEventListener("mouseleave",hideTip)});
 [0,Math.floor(c.length/2),c.length].forEach((k,j)=>el("text",{x:L+k*bw,y:H-16,class:"axis","text-anchor":j==0?"start":j==2?"end":"middle"},svg).textContent=fmt(e[k],1)+"%");
 $("histNote").textContent=`${M.trades_per_path} trades per year at ${M.risk_per_trade_pct}% risk each. Profitable in ${M.prob_profit_pct}% of resampled years; median ${fmt(M.median_return_pct,1)}%, 5th percentile ${fmt(M.p5_return_pct,1)}%, 95th ${fmt(M.p95_return_pct,1)}%. Median worst drawdown ${fmt(M.median_max_drawdown_pct,1)}%. Red bars are losing years.`}
else $("histNote").textContent=M.note||"No trades to resample.";

// table
const th="<tr><th>Entry</th><th>Exit</th><th>Entry px</th><th>Exit px</th><th>Reason</th><th>Bars</th><th>Return</th><th>R</th></tr>";
$("tt").innerHTML=th+D.trades.slice().reverse().map(t=>`<tr><td>${t.entry_date}</td><td>${t.exit_date}</td><td>${fmt(t.entry)}</td><td>${fmt(t.exit)}</td><td>${t.exit_reason}</td><td>${t.bars}</td><td>${t.return_pct>0?"▲":"▼"} ${fmt(t.return_pct)}%</td><td>${fmt(t.r_multiple)}</td></tr>`).join("");
</script></body></html>
"""
