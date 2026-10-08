// Lightweight client-only diagnostics. No extra packets, timers or rendering changes.
export function createPerformancePanel(root) {
  const el = document.createElement('section'); el.className = 'perf-panel';
  el.style.cssText = 'position:fixed;left:196px;top:46px;z-index:6;width:248px;box-sizing:border-box;height:172px;padding:8px 10px;border:1px solid #ffffff38;border-radius:12px;background:rgba(9,17,29,.88);color:#f4f7fc;font:600 11px/1.4 ui-monospace,monospace;pointer-events:none';
  el.innerHTML = '<div style="display:flex;justify-content:space-between;font-size:10px;letter-spacing:.06em"><b>PERFORMANCE</b><span data-status>WAITING</span></div><div data-client></div><div data-net></div><div data-server></div><canvas width="226" height="54" style="display:block;width:100%;height:54px;margin:4px 0 2px"></canvas><div style="font-size:9px;color:#b8c8dc"><span style="color:#67dbff">RTT</span> / <span style="color:#ffb85c">server pause</span> / <span style="color:#b9a1ff">frame max</span> · last 60s</div><div data-note style="font-size:9px;color:#b8c8dc"></div>';
  root.appendChild(el); const q = s => el.querySelector(s), cv=q('canvas'), cx=cv.getContext('2d');
  const history = []; let session, previousPing=null, jitter=null;
  const num = v => Number.isFinite(v) ? Math.round(v) : '--';
  function graph(now) {
    cx.clearRect(0,0,226,54); const max=Math.max(100,...history.flatMap(s=>[s.rtt||0,s.pause||0,s.frame||0])); const ceiling=Math.ceil(max/100)*100;
    cx.strokeStyle='#ffffff20';cx.lineWidth=1;
    for(const y of [12,30,48]){cx.beginPath();cx.moveTo(0,y);cx.lineTo(226,y);cx.stroke();}
    cx.font='9px monospace';cx.fillStyle='#b8c8dc';cx.fillText(ceiling+' ms',2,9);
    for(const [key,color] of [['rtt','#67dbff'],['pause','#ffb85c'],['frame','#b9a1ff']]){cx.strokeStyle=color;cx.lineWidth=1.5;cx.beginPath();let pen=false;for(const s of history){const v=s[key];if(v===null){pen=false;continue;}const x=226*(1-(now-s.time)/60000),y=48-36*v/ceiling;if(pen)cx.lineTo(x,y);else cx.moveTo(x,y);pen=true;}cx.stroke();}
  }
  return { el, update({now,fps,frame,worst,net,visible}) {
    el.style.display=visible?'block':'none'; if(!visible)return;
    if(session!==net){session=net;history.length=0;previousPing=null;jitter=null;}
    const connected=!!net?.connected, age=connected&&net.latestRecv ? Math.max(0,(net.o.now()-net.latestRecv)*1000):null;
    const fresh=connected&&age!==null&&age<3000, sp=fresh?net.serverPerf:null, rtt=fresh&&net.hasPing?net.rttMs:null;
    if(rtt!==null&&previousPing!==null&&rtt!==previousPing)jitter=Math.abs(rtt-previousPing); if(rtt!==null)previousPing=rtt;
    const pause=sp&&Number.isFinite(sp[1])?sp[1]:null;
    history.push({time:now,rtt,pause,frame:worst}); while(history.length>120||history[0]?.time<now-60000)history.shift();
    const status=!net?'LOCAL':!connected?'RECONNECTING':!fresh?'WAITING / STALE':pause>100?'SERVER SPIKE':rtt>150?'HIGH RTT':worst>50?'FRAME SPIKE':'LIVE';
    q('[data-status]').textContent=status;q('[data-status]').style.color=status==='LIVE'||status==='LOCAL'?'#91e9ad':'#ffbc70';
    q('[data-client]').textContent=num(fps)+' FPS · frame '+num(frame)+' / '+num(worst)+' max ms';
    q('[data-net]').textContent='RTT '+num(rtt)+' ms · jitter '+num(jitter)+' ms';
    q('[data-server]').textContent='Tick '+num(sp?.[0])+' · pause '+num(pause)+' ms / 5s';
    q('[data-note]').textContent=net?'Snapshot age '+num(age)+' ms · RTT probe 2s': 'Local play: no server measurements';
    graph(now);
  }};
}
