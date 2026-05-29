// roundRect polyfill for iOS < 15.4
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
        const rr=Math.min(typeof r==='number'?r:r[0], Math.min(Math.abs(w),Math.abs(h))/2);
        this.moveTo(x+rr,y);
        this.lineTo(x+w-rr,y); this.arcTo(x+w,y,x+w,y+rr,rr);
        this.lineTo(x+w,y+h-rr); this.arcTo(x+w,y+h,x+w-rr,y+h,rr);
        this.lineTo(x+rr,y+h); this.arcTo(x,y+h,x,y+h-rr,rr);
        this.lineTo(x,y+rr); this.arcTo(x,y,x+rr,y,rr);
        this.closePath();
    };
}
// Read config from DOM (external script — bypasses iOS Safari inline script issues)
var _ld = document.getElementById('_ld');
var LIVE = {};
try { LIVE = JSON.parse(_ld ? _ld.textContent : '{}'); } catch(e) {}
var _cfg = document.getElementById('_cfg');
var _cds = (_cfg && _cfg.dataset) ? _cfg.dataset : {};
var GHUSER = _cds.gu || '';
var GHREPO = _cds.gr || '';
var IMGBB  = _cds.ib || '';
var apiKey = _cds.ak ? _cds.ak.split(',').map(Number).map(function(c){return String.fromCharCode(c^5);}).join('') : '';

let L = LIVE;
let hist = [], busy = false;
let ME = (function(){ try { return localStorage.getItem('gb_persona')||'Dominik'; } catch(e){ return 'Dominik'; } })();
function setPers(name) {
    ME = name;
    try { localStorage.setItem('gb_persona', name); } catch(e) {}
    document.querySelectorAll('.pb-btn').forEach(b => b.classList.toggle('active', b.textContent.includes(name)));
}

// ── BOOT ───────────────────────────────────────────────────────────────────
// Script is at end of <body> — DOM is fully built, call directly (no load event needed).
window.addEventListener('resize', () => { if(L) drawChart(L); });

async function poll() {
    try {
        const r = await fetch('./data.json?_=' + Date.now());
        if (r.ok) { L = await r.json(); renderAll(L); }
    } catch(e) {}
}

// ── RENDER ─────────────────────────────────────────────────────────────────
function renderAll(d) {
    [renderHeader, renderKPIs, drawChart, renderStatus, renderRisk,
     renderStrategies, renderAgents, renderSignals, renderEvents
    ].forEach(function(fn){ try { fn(d); } catch(e) { console.error(fn.name, e); } });
}

function renderHeader(d) {
    const p = d.price;
    document.getElementById('hPrice').textContent = (p && p !== '–') ? '$' + Number(p).toLocaleString('de-AT',{minimumFractionDigits:2,maximumFractionDigits:2}) : '–';
    document.getElementById('hTime').textContent = d.updated || '–';
}

function renderKPIs(d) {
    const wr=d.wr||0, pf=d.pf||0, dd=d.max_dd||0, pnl=d.net_pnl||0, tr=d.trades||0;
    document.getElementById('kWR').textContent    = wr  ? wr.toFixed(1)+'%'                      : '–';
    document.getElementById('kPF').textContent    = pf  ? pf.toFixed(2)                           : '–';
    document.getElementById('kDD').textContent    = dd  ? dd.toFixed(1)+'%'                       : '–';
    document.getElementById('kPnL').textContent   = pnl ? (pnl>0?'+':'')+pnl.toFixed(0)+'$'      : '–';
    document.getElementById('kTrades').textContent = tr + ' Trades';
    const fd=d.from_date||'', td=d.to_date||'';
    document.getElementById('kPeriod').textContent = (fd!=='–'&&td!=='–'&&fd&&td) ? fd.slice(0,10)+' – '+td.slice(0,10) : '–';
    const card = document.getElementById('kPnLCard');
    const c = pnl >= 0 ? '#10B981' : '#EF4444';
    const g = pnl >= 0 ? 'rgba(16,185,129,.28)' : 'rgba(239,68,68,.28)';
    card.style.setProperty('--kc', c);
    card.style.setProperty('--kg', g);
}

// ── CHART ──────────────────────────────────────────────────────────────────
function drawChart(d) {
    const canvas = document.getElementById('pnlChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.parentElement.clientWidth;
    const H = 110;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    // Build points
    const variants = d.variants || [];
    let pts = [];
    if (variants.length > 2) {
        const sorted = [...variants].sort((a,b) => (a.wr||0)-(b.wr||0));
        let eq = 10000;
        pts = sorted.map((v,i) => { eq += (v.net_pnl||0)*0.08; return eq; });
    } else {
        const wr = d.wr||55, n = Math.max(d.trades||60, 20);
        let eq = 10000, rng = 1234;
        function rand() { rng = (rng*1664525+1013904223)&0xffffffff; return (rng>>>0)/0xffffffff; }
        pts = Array.from({length:Math.min(n,80)}, () => { const w=rand()<wr/100; eq+=w?eq*.013:-eq*.008; return eq; });
    }
    if (pts.length < 2) return;

    const minY = Math.min(...pts), maxY = Math.max(...pts), rng = maxY-minY||1;
    const pad = {t:10,b:10,l:4,r:4};
    const iW = W-pad.l-pad.r, iH = H-pad.t-pad.b;
    const px = i => pad.l + (i/(pts.length-1))*iW;
    const py = v => pad.t + (1-(v-minY)/rng)*iH;

    const isUp = pts[pts.length-1] >= pts[0];
    const col = isUp ? '16,185,129' : '239,68,68';

    // Fill gradient
    const fill = ctx.createLinearGradient(0,pad.t,0,H-pad.b);
    fill.addColorStop(0, `rgba(${col},.22)`);
    fill.addColorStop(1, `rgba(${col},0)`);

    ctx.beginPath();
    ctx.moveTo(px(0), py(pts[0]));
    for (let i=1;i<pts.length;i++) {
        const cx=(px(i-1)+px(i))/2;
        ctx.bezierCurveTo(cx,py(pts[i-1]),cx,py(pts[i]),px(i),py(pts[i]));
    }
    ctx.lineTo(px(pts.length-1), H-pad.b);
    ctx.lineTo(px(0), H-pad.b);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    // Line
    const lg = ctx.createLinearGradient(0,0,W,0);
    lg.addColorStop(0,`rgba(${col},.5)`);
    lg.addColorStop(1,`rgb(${col})`);
    ctx.beginPath();
    ctx.moveTo(px(0), py(pts[0]));
    for (let i=1;i<pts.length;i++) {
        const cx=(px(i-1)+px(i))/2;
        ctx.bezierCurveTo(cx,py(pts[i-1]),cx,py(pts[i]),px(i),py(pts[i]));
    }
    ctx.strokeStyle = lg; ctx.lineWidth = 2; ctx.stroke();

    // End dot
    const ex=px(pts.length-1), ey=py(pts[pts.length-1]);
    ctx.beginPath(); ctx.arc(ex,ey,7,0,Math.PI*2);
    ctx.fillStyle=`rgba(${col},.2)`; ctx.fill();
    ctx.beginPath(); ctx.arc(ex,ey,3.5,0,Math.PI*2);
    ctx.fillStyle=`rgb(${col})`; ctx.fill();

    const pct = ((pts[pts.length-1]-pts[0])/pts[0]*100).toFixed(1);
    document.getElementById('chartMeta').textContent = (isUp?'+':'')+pct+'% Gesamt';
    document.getElementById('chartFrom').textContent = (d.from_date||'').slice(0,10)||'–';
    const chEl = document.getElementById('chartChange');
    chEl.textContent = (pct>=0?'+':'')+pct+'%';
    chEl.style.color = isUp ? 'var(--green)' : 'var(--red)';
}

// ── STATUS ─────────────────────────────────────────────────────────────────
function renderStatus(d) {
    const mEl = document.getElementById('macroVal');
    const mPill = document.getElementById('macroPill');
    if (d.macro_blocked) {
        mEl.textContent = '🔴 BLOCKIERT';
        mEl.style.color = 'var(--red)';
        mPill.style.borderColor = 'rgba(239,68,68,.28)';
    } else {
        const mins = d.macro_mins;
        mEl.textContent = mins ? '✅ Frei · '+mins+'min' : '✅ Frei';
        mEl.style.color = 'var(--green)';
        mPill.style.borderColor = '';
    }
    const bias = d.gold_bias||'neutral';
    const dEl = document.getElementById('dxyVal');
    const dStr = d.dxy ? d.dxy.toFixed(2) : '–';
    const em = bias==='bullish'?'🟢':bias==='bearish'?'🔴':'⚪';
    dEl.textContent = em+' '+bias.toUpperCase()+' '+dStr;
    dEl.style.color = bias==='bullish'?'var(--green)':bias==='bearish'?'var(--red)':'var(--text)';
    document.getElementById('sigStat').textContent = (d.n_signals||0)+' Signal(e)';
    const bwr = d.best_wr||0;
    document.getElementById('optStat').textContent = bwr ? 'WR '+bwr.toFixed(1)+'% | '+(d.candidates||0)+' Kand.' : '–';
}

function renderRisk(d) {
    const b = document.getElementById('riskBanner');
    const alerts = d.alerts||[];
    if (d.risk_status==='blocked'||alerts.length) {
        b.classList.add('on');
        document.getElementById('riskTxt').textContent = alerts.length ? alerts.join(' | ') : 'Risk-Limit erreicht';
    } else { b.classList.remove('on'); }
}

function renderStrategies(d) {
    const el = document.getElementById('stratList');
    const v = d.variants||[];
    if (!v.length) { el.innerHTML='<div class="empty"><div class="empty-ico">🔄</div>Noch keine Strategien</div>'; return; }
    const top = [...v].sort((a,b)=>(b.wr||0)-(a.wr||0)).slice(0,6);
    el.innerHTML = top.map((s,i)=>
        `<div class="str-row">
          <div class="str-rank">${i+1}</div>
          <div class="str-info">
            <div class="str-name">${esc(s.name||s.strategy||'Strategie '+(i+1))}</div>
            <div class="str-det">PF: ${s.pf?s.pf.toFixed(2):'–'} · DD: ${s.max_dd?s.max_dd.toFixed(1):'–'}% · ${s.trades||0} Trades</div>
          </div>
          <div class="str-wr">${s.wr?s.wr.toFixed(1)+'%':'–'}</div>
        </div>`
    ).join('');
    drawStratsChart(top);
}

function drawStratsChart(top) {
    const canvas = document.getElementById('stratsChart');
    if (!canvas || !top.length) return;
    canvas.style.display = 'block';
    const PAD = 14, LABEL = 72, VAL_W = 36, BAR_H = 18, GAP = 7;
    const totalW = canvas.parentElement.clientWidth;
    const W = totalW;
    const H = top.length * (BAR_H + GAP) + PAD * 2;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const maxWR = Math.max(...top.map(s => s.wr||0), 65);
    const barArea = W - PAD*2 - LABEL - VAL_W;
    top.forEach((s, i) => {
        const y = PAD + i * (BAR_H + GAP);
        const wr = s.wr || 0;
        const name = (s.name || s.strategy || 'Strategie '+(i+1)).slice(0, 11);
        ctx.font = '600 11px -apple-system,BlinkMacSystemFont,sans-serif';
        ctx.fillStyle = 'rgba(139,155,180,0.9)';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, PAD, y + BAR_H/2);
        const bx = PAD + LABEL;
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath(); ctx.roundRect(bx, y, barArea, BAR_H, 4); ctx.fill();
        const bw = (wr / maxWR) * barArea;
        const col = wr >= 60 ? '#10B981' : wr >= 50 ? '#F59E0B' : '#EF4444';
        const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        grad.addColorStop(0, col + '55'); grad.addColorStop(1, col);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(bx, y, bw, BAR_H, 4); ctx.fill();
        ctx.font = '700 11px -apple-system,BlinkMacSystemFont,sans-serif';
        ctx.fillStyle = col;
        ctx.fillText(wr.toFixed(1) + '%', bx + barArea + 5, y + BAR_H/2);
    });
}

function renderAgents(d) {
    const el = document.getElementById('agentList');
    const agents = d.agents||[];
    if (!agents.length) { el.innerHTML='<div class="empty"><div class="empty-ico">🤖</div>Keine Agenten-Daten</div>'; return; }
    el.innerHTML = agents.map(ag=>{
        const pc = ag.status==='working'?'#F59E0B':ag.status==='active'?'#10B981':'#374151';
        const tags = (ag.tags||[]).map(t=>`<span class="ag-tag" style="color:${ag.color};border-color:${ag.color}33;background:${ag.bg}">${esc(t)}</span>`).join('');
        const badgeTxt = ag.status==='working'?'◉ Working':ag.status==='active'?'✓ Aktiv':'· Idle';
        return `<div class="ag-card ${ag.status}">
          <div class="ag-top">
            <div class="ag-ico" style="background:${ag.bg}"><span style="color:${ag.color}">${esc(ag.icon)}</span></div>
            <div class="ag-meta"><div class="ag-name">${esc(ag.name)}</div><div class="ag-role">${esc(ag.role)}</div></div>
            <div class="ag-badge ${ag.status}">${badgeTxt}</div>
          </div>
          <div class="ag-bar"><div class="ag-bar-fill" style="width:${ag.prog||0}%;background:${pc}"></div></div>
          <div class="ag-task">${esc(ag.task||'–')}</div>
          <div class="ag-foot"><div class="ag-tags">${tags}</div><div class="ag-last">Zuletzt: ${esc(ag.last||'–')}</div></div>
        </div>`;
    }).join('');
}

function renderSignals(d) {
    const sigs = d.signals||[], n=sigs.length;
    const badge = document.getElementById('sigBadge');
    if(badge){badge.textContent=n; badge.style.display=n?'flex':'none';}
    document.getElementById('sigCount2').textContent = n+' Signal(e)';
    const el = document.getElementById('sigList');
    if (!n) { el.innerHTML='<div class="empty"><div class="empty-ico">⚡</div>Keine aktuellen Signale</div>'; return; }
    el.innerHTML = sigs.map(s=>{
        const dir=(s.direction||'LONG').toUpperCase(), isL=dir==='LONG';
        return `<div class="sig-row">
          <div class="sig-dir ${isL?'long':'short'}">${dir}</div>
          <div class="sig-info">
            <div class="sig-price">$${Number(s.price||0).toFixed(2)}</div>
            <div class="sig-det">SL ${Number(s.sl||0).toFixed(2)} · TP ${Number(s.tp||0).toFixed(2)} · RSI ${s.rsi||'–'}</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            ${s.has_fvg?'<span class="sig-fvg">FVG</span>':''}
            <span class="sig-rr">1:${(s.rr||0).toFixed(1)}</span>
          </div>
        </div>`;
    }).join('');
}

function renderEvents(d) {
    const evs = d.macro_today||[];
    const card = document.getElementById('evCard');
    if (!evs.length) { card.style.display='none'; return; }
    card.style.display='';
    document.getElementById('evList').innerHTML = evs.map(e=>{
        const imp=(e.impact||'MED').toUpperCase();
        const cls=imp==='HIGH'?'high':imp==='MEDIUM'||imp==='MED'?'med':'low';
        return `<div class="ev-row">
          <div class="ev-imp ${cls}">${imp}</div>
          <div class="ev-info">
            <div class="ev-name">${esc(e.event||e.name||'–')}</div>
            <div class="ev-det">${esc(e.time||'')} ${esc(e.currency||'')} ${e.actual?'Akt: '+esc(e.actual):''} ${e.forecast?'Prog: '+esc(e.forecast):''}</div>
          </div>
        </div>`;
    }).join('');
}

// ── TABS ───────────────────────────────────────────────────────────────────
var _tabMap = {stats:'panelDashboard', agents:'panelAgents', chat:'panelChat', notes:'panelNotes'};
function switchTab(tab) {
    var targetId = _tabMap[tab];
    // Update panel visibility
    Object.values(_tabMap).forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        if (id === targetId) { el.classList.add('show'); }
        else { el.classList.remove('show'); }
    });
    // Update tab button state
    document.querySelectorAll('.tbtn').forEach(function(b) {
        if (b.dataset.tab === tab) { b.classList.add('show'); }
        else { b.classList.remove('show'); }
    });
    if (tab === 'notes') renderNotes();
    if (tab === 'chat' && document.getElementById('chatBox') && !document.getElementById('chatBox').children.length) initChat();
}

// ── CHAT ───────────────────────────────────────────────────────────────────
function initChat() {
    // Set initial persona button highlight
    document.querySelectorAll('.pb-btn').forEach(b => b.classList.toggle('active', b.textContent.includes(ME)));
    const saved = (() => { try { return JSON.parse(localStorage.getItem('gb_chat')||'[]'); } catch(e) { return []; } })();
    if (saved.length) {
        hist=saved; hist.forEach(m=>renderMsg(m.role,m.content,m.ts,m.author));
    } else {
        welcome();
    }
}

function welcome() {
    const d=L;
    const wr=d.wr?d.wr.toFixed(1)+'%':'–', pf=d.pf?d.pf.toFixed(2):'–';
    const dd=d.max_dd?d.max_dd.toFixed(1)+'%':'–', pnl=d.net_pnl?(d.net_pnl>0?'+':'')+d.net_pnl.toFixed(0)+'$':'–';
    addMsg('assistant',`**Gold Bot Commander** bereit ⚡

📊 System-Status:
• Win Rate: **${wr}** | Profit Factor: **${pf}**
• Max DD: **${dd}** | Net PnL: **${pnl}**
• Gold-Bias: **${(d.gold_bias||'neutral').toUpperCase()}** | DXY: ${d.dxy||'–'}
• Macro: ${d.macro_blocked?'🔴 BLOCKIERT':'✅ Trading frei'}

Wie kann ich helfen? Ich kann Agenten starten, Strategien analysieren und Befehle an den Bot senden.`);
}

function sysPrompt() {
    const d=L;
    return `Du bist der Gold Bot Commander — KI-Assistent für einen automatisierten Gold-Trading-Bot (XAUUSD, M15).

Aktueller Status:
- Win Rate: ${d.wr||'–'}% | Profit Factor: ${d.pf||'–'} | Max DD: ${d.max_dd||'–'}%
- Trades: ${d.trades||0} | PnL: ${d.net_pnl||0}$ | Preis: ${d.price||'–'}
- Signale: ${d.n_signals||0} | Gold-Bias: ${d.gold_bias||'neutral'}
- DXY: ${d.dxy||'–'} | US10Y: ${d.tnx||'–'}%
- Macro-Block: ${d.macro_blocked||false} | Risk: ${d.risk_status||'ok'}
- Agenten: ${(d.agents||[]).map(a=>a.name+':'+a.status).join(', ')}
- Top-Strategie: WR ${d.best_wr||'–'}% | PF ${d.best_pf||'–'} | ${d.candidates||0} Kandidaten

Du kannst Bot-Befehle als JSON senden (in <dispatch>...</dispatch>):
{ "type": "run_agent", "name": "backtester_agent" }
{ "type": "run_agent", "name": "optimizer_agent" }
{ "type": "run_agent", "name": "signal_agent" }
{ "type": "run_agent", "name": "risk_agent" }

Antworte präzise auf Deutsch. Nutze **Markdown** für Formatierung. Sei direkt und konkret.`;
}

function renderMsg(role, text, ts, author) {
    const box = document.getElementById('chatBox');
    const d = document.createElement('div');
    d.className = 'msg ' + role;
    const who = author||(role==='user'?ME:'Commander');
    const md = text
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
        .replace(/`([^`]+)`/g,'<code style="background:rgba(255,255,255,.08);padding:1px 5px;border-radius:3px;font-size:.78rem">$1</code>')
        .replace(/\n/g,'<br>');
    d.innerHTML = '<div class="bubble">'+md+'</div><div class="msg-meta">'+esc(who)+' · '+fmt(ts||Date.now())+'</div>';
    box.appendChild(d); box.scrollTop = box.scrollHeight;
}

function addMsg(role, text) {
    const ts=Date.now(), author=role==='user'?ME:'Commander';
    hist.push({role,content:text,ts,author});
    renderMsg(role,text,ts,author);
    try { localStorage.setItem('gb_chat', JSON.stringify(hist.slice(-60))); } catch(e) {}
}

function showTyping() {
    const box=document.getElementById('chatBox');
    const d=document.createElement('div'); d.className='msg assistant'; d.id='typer';
    d.innerHTML='<div class="t-bubble"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>';
    box.appendChild(d); box.scrollTop=box.scrollHeight;
}
function hideTyping() { const e=document.getElementById('typer'); if(e)e.remove(); }

async function sendMsg() {
    if (busy) return;
    const inp=document.getElementById('chatInput');
    const txt=inp.value.trim(); if(!txt) return;
    inp.value=''; inp.style.height='40px';
    addMsg('user',txt);
    if (!apiKey) { addMsg('assistant','⚠️ Kein API Key konfiguriert.'); return; }
    busy=true; document.getElementById('sendBtn').disabled=true; showTyping();
    try {
        const msgs=hist.slice(0,-1).map(m=>({role:m.role==='user'?'user':'assistant',content:m.content}));
        msgs.push({role:'user',content:txt});
        const res=await fetch('https://api.anthropic.com/v1/messages',{
            method:'POST',
            headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
            body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1024,system:sysPrompt(),messages:msgs})
        });
        if(!res.ok){const e=await res.json();throw new Error(e.error?.message||'API Fehler');}
        const data=await res.json();
        const raw=data.content[0].text;
        const dm=raw.match(/<dispatch>([\s\S]*?)<\/dispatch>/);
        const clean=raw.replace(/<dispatch>[\s\S]*?<\/dispatch>/g,'').trim();
        hideTyping(); addMsg('assistant',clean);
        if(dm){try{const cmd=JSON.parse(dm[1]);cmd.id=Date.now().toString();await dispatch(cmd);}catch(e){addMsg('assistant','⚠️ Dispatch-Fehler: '+e.message);}}
    } catch(err) {
        hideTyping(); addMsg('assistant','❌ **Fehler:** '+err.message);
    } finally {
        busy=false; document.getElementById('sendBtn').disabled=false;
    }
}

function onKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}}
function autoGrow(el){el.style.height='40px';el.style.height=Math.min(el.scrollHeight,110)+'px';}

// ── DISPATCH ───────────────────────────────────────────────────────────────
function ghTok(){return localStorage.getItem('gh_token')||'';}
async function ghGet(){
    const r=await fetch(`https://api.github.com/repos/${GHUSER}/${GHREPO}/contents/state.json`,
        {headers:{Authorization:'Bearer '+ghTok(),'User-Agent':'gold-bot'}});
    if(!r.ok) throw new Error('GitHub GET '+r.status);
    const m=await r.json();
    return {data:JSON.parse(atob(m.content.replace(/\n/g,''))),sha:m.sha};
}
async function ghPut(data,sha){
    const r=await fetch(`https://api.github.com/repos/${GHUSER}/${GHREPO}/contents/state.json`,{
        method:'PUT',
        headers:{Authorization:'Bearer '+ghTok(),'Content-Type':'application/json','User-Agent':'gold-bot'},
        body:JSON.stringify({message:'dispatch',content:btoa(unescape(encodeURIComponent(JSON.stringify(data,null,2)))),sha})
    });
    if(!r.ok) throw new Error('GitHub PUT '+r.status);
}
async function dispatch(cmd){
    if(!ghTok()){addMsg('assistant','⚠️ Kein GitHub Token. `localStorage.setItem("gh_token","...")` im Browser-Konsole ausführen.');return;}
    try{
        const{data,sha}=await ghGet();
        (data.commands=data.commands||[]).push({...cmd,status:'pending',dispatched:Date.now()});
        await ghPut(data,sha);
        addMsg('assistant','⚡ **Befehl gesendet!** "'+esc(cmd.name||cmd.type)+'" wurde übermittelt.\n\nErgebnis erscheint in ~2 Min. im Dashboard.');
        toast('Befehl gesendet ✓');
    }catch(e){addMsg('assistant','⚠️ Dispatch fehlgeschlagen: '+e.message);}
}

// ── NOTES ──────────────────────────────────────────────────────────────────
function getNotes(){try{return JSON.parse(localStorage.getItem('gb_notes')||'[]');}catch(e){return[];}}
function saveNotes(n){try{localStorage.setItem('gb_notes',JSON.stringify(n));}catch(e){}}

function saveNote(){
    const inp=document.getElementById('noteInput');
    const txt=inp.value.trim(); if(!txt) return;
    const notes=getNotes();
    notes.unshift({text:txt,ts:Date.now()});
    saveNotes(notes);
    inp.value='';
    renderNotes();
    toast('Notiz gespeichert ✓');
}

function deleteNote(idx){
    const notes=getNotes(); notes.splice(idx,1); saveNotes(notes); renderNotes();
}

function clearNotes(){
    if(!confirm('Alle Notizen löschen?')) return;
    saveNotes([]); renderNotes(); toast('Alle Notizen gelöscht');
}

function renderNotes(){
    const notes=getNotes();
    const el=document.getElementById('notesList'); if(!el) return;
    if(!notes.length){el.innerHTML='<div class="empty"><div class="empty-ico">📝</div>Noch keine Notizen</div>';return;}
    el.innerHTML='<div class="note-saved">'+notes.map((n,i)=>
        `<div class="note-item">
          <div class="note-item-text">${esc(n.text)}</div>
          <div class="note-item-meta">${fmt(n.ts)}</div>
          <button class="note-del" onclick="deleteNote(${i})">✕</button>
        </div>`
    ).join('')+'</div>';
}

// ── PHOTOS ─────────────────────────────────────────────────────────────────
function getPhotos(){try{return JSON.parse(localStorage.getItem('gb_photos')||'[]');}catch(e){return[];}}
function savePhotosList(p){try{localStorage.setItem('gb_photos',JSON.stringify(p));}catch(e){}}

async function uploadPhotos(input){
    const files=Array.from(input.files); if(!files.length) return;
    toast('Lade hoch…');
    for(const file of files){
        try{
            const fd=new FormData(); fd.append('image',file); fd.append('key',IMGBB);
            const r=await fetch('https://api.imgbb.com/1/upload',{method:'POST',body:fd});
            const d=await r.json();
            if(d.success){
                const photos=getPhotos();
                photos.unshift({url:d.data.url,thumb:d.data.thumb?.url||d.data.url,ts:Date.now(),name:file.name});
                savePhotosList(photos);
                renderPhotos();
                toast('Foto hochgeladen ✓');
            } else { toast('Upload fehlgeschlagen',true); }
        } catch(e){ toast('Upload Fehler: '+e.message,true); }
    }
    input.value='';
}

function deletePhoto(idx){
    const photos=getPhotos(); photos.splice(idx,1); savePhotosList(photos); renderPhotos();
}

function renderPhotos(){
    const photos=getPhotos();
    const grid=document.getElementById('photoGrid'); if(!grid) return;
    const cnt=document.getElementById('photoCount'); if(cnt) cnt.textContent=photos.length+' Foto(s)';
    if(!photos.length){grid.innerHTML='';return;}
    grid.innerHTML=photos.map((p,i)=>
        `<div class="photo-thumb">
          <img src="${esc(p.thumb||p.url)}" alt="${esc(p.name||'')}" onclick="openLightbox('${esc(p.url)}')">
          <button class="ph-del" onclick="deletePhoto(${i})">✕</button>
        </div>`
    ).join('');
}

function openLightbox(url){
    document.getElementById('lbImg').src=url;
    document.getElementById('lightbox').classList.add('on');
}
function closeLightbox(){
    document.getElementById('lightbox').classList.remove('on');
    document.getElementById('lbImg').src='';
}

// ── UTILS ──────────────────────────────────────────────────────────────────
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function fmt(ts){
    const d=new Date(ts),diff=Date.now()-ts;
    if(diff<60000)return'Gerade eben';
    if(diff<3600000)return Math.floor(diff/60000)+' Min. ago';
    if(diff<86400000)return d.toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'});
    return d.toLocaleDateString('de-AT',{day:'2-digit',month:'2-digit'});
}
function toast(msg,err){
    const t=document.getElementById('toast');
    t.textContent=msg;
    t.style.cssText=`background:${err?'rgba(239,68,68,.14)':'rgba(16,185,129,.14)'};border:1px solid ${err?'rgba(239,68,68,.3)':'rgba(16,185,129,.3)'};color:${err?'var(--red)':'var(--green)'};`;
    t.classList.add('on');
    setTimeout(()=>t.classList.remove('on'),2800);
}

// ── BOOT (inline — DOM is ready because script is at end of <body>) ──────────
(function boot() {
    var notesInp = document.getElementById('t-notes');
    if (notesInp) notesInp.addEventListener('change', function() { if (this.checked) renderNotes(); });
    renderAll(L);
    initChat();
    renderNotes();
    renderPhotos();
    setInterval(poll, 30000);
})();