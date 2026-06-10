// UTF-8-sicheres Base64 decode (atob() allein zerstört Umlaute)
function _b64dec(s) {
    try { return decodeURIComponent(escape(atob(s.replace(/\n/g,'')))); }
    catch(e) { return atob(s.replace(/\n/g,'')); } // Fallback für reines ASCII
}

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
var _embeddedGhTok = _cds.gt ? _cds.gt.split(',').map(Number).map(function(c){return String.fromCharCode(c^5);}).join('') : '';

let L = LIVE;
let hist = [], busy = false;
var _tsxDataAvailable = false; // gesetzt sobald TopStepX daily_history vorliegt
var _tsxLastData = null;       // letzter erfolgreicher Abruf aus topstep.json
let ME = (function(){ try { return localStorage.getItem('gb_persona')||'Dominik'; } catch(e){ return 'Dominik'; } })();
function setPers(name) {
    ME = name;
    try { localStorage.setItem('gb_persona', name); } catch(e) {}
    document.querySelectorAll('.pb-btn').forEach(b => b.classList.toggle('active', b.textContent.includes(name)));
}

// ── BOOT ───────────────────────────────────────────────────────────────────
// Build-Timestamp wird beim Deploy eingefügt — für Auto-Reload-Mechanismus
var APP_BUILD = 0; // wird durch /*__APP_BUILD__*/ ersetzt

// ── BB SQUEEZE CHAMPION — historische Simulationsdaten (2 Jahre XAUUSD M15) ──
var BB_MONTHLY = [
  {m:'Jun 24', trades:18, wr:33, cap:89000},
  {m:'Jul 24', trades:18, wr:22, cap:78000},
  {m:'Aug 24', trades:18, wr:39, cap:105000},
  {m:'Sep 24', trades:18, wr:33, cap:147000},
  {m:'Okt 24', trades:18, wr:39, cap:184000},
  {m:'Nov 24', trades:18, wr:28, cap:132000},
  {m:'Dez 24', trades:18, wr:28, cap:97000},
  {m:'Jan 25', trades:18, wr:22, cap:69000},
  {m:'Feb 25', trades:18, wr:44, cap:112000},
  {m:'Mär 25', trades:18, wr:39, cap:179000},
  {m:'Apr 25', trades:18, wr:44, cap:280000},
  {m:'Mai 25', trades:18, wr:28, cap:215000},
  {m:'Jun 25', trades:18, wr:44, cap:345000},
  {m:'Jul 25', trades:18, wr:44, cap:553000},
  {m:'Aug 25', trades:18, wr:44, cap:887000},
  {m:'Sep 25', trades:18, wr:39, cap:1240000},
  {m:'Okt 25', trades:18, wr:39, cap:1800000},
  {m:'Nov 25', trades:18, wr:33, cap:1440000},
  {m:'Dez 25', trades:18, wr:44, cap:2160000},
  {m:'Jan 26', trades:18, wr:44, cap:3240000},
  {m:'Feb 26', trades:18, wr:33, cap:2592000},
  {m:'Mär 26', trades:18, wr:50, cap:4147200},
  {m:'Apr 26', trades:18, wr:39, cap:6220800},
  {m:'Mai 26', trades:15, wr:40, cap:8756000}
];
var BB_STATS = {
  wr:32.2, pf:1.11, trades:438, wins:141, losses:297,
  max_dd:-63.5, return_pct:8656, start_cap:100000, end_cap:8756010,
  longs:219, shorts:219, risk_pct:0.05
};
var _stratMode = 'smc';

function showStrategy(mode) {
  _stratMode = mode;
  var btnSMC = document.getElementById('stratBtnSMC');
  var btnBB  = document.getElementById('stratBtnBB');
  if (btnSMC && btnBB) {
    if (mode === 'bb') {
      btnBB.style.background  = 'rgba(139,92,246,.22)';
      btnBB.style.borderColor = 'rgba(139,92,246,.6)';
      btnSMC.style.background = 'rgba(255,255,255,.04)';
      btnSMC.style.borderColor= 'rgba(255,255,255,.1)';
    } else {
      btnSMC.style.background  = 'rgba(37,99,235,.14)';
      btnSMC.style.borderColor = 'rgba(37,99,235,.45)';
      btnBB.style.background  = 'rgba(139,92,246,.07)';
      btnBB.style.borderColor = 'rgba(139,92,246,.22)';
    }
  }
  if (mode === 'bb') {
    _setEl('kWR',   '32.2%');
    _setEl('kTrades', '438 Trades');
    _setEl('kPF',   '1.11');
    _setEl('kPeriod', 'Jun 2024 – Mai 2026');
    _setEl('kDD',   '-63.5%');
    _setEl('kPnL',  '+$8.656M');
    _setEl('kReturn', '+8.656%');
    _setEl('kEndCap', '$8.756M');
    _setEl('kRisk', '5% Risiko');
    _setEl('kLongShort', '219 / 219');
    var sv = document.getElementById('kStratVal');
    if (sv) { sv.textContent='BB-SQUEEZE'; sv.style.color='#8B5CF6'; sv.style.fontSize='.78rem'; }
    _setEl('kStratLbl', 'Strategie');
    _setEl('kStratSub', 'Champion');
    _setEl('chartTitle', 'BB Squeeze — Wachstumskurve');
    _setEl('chartMeta', '$100k → $8.75M in 24 Monaten');
    // Chart neu zeichnen mit lila Farbe
    drawBBChart();
    // Monatstabelle
    renderMonthlyBB();
  } else {
    // SMC: alles auf Backtest-Daten zurücksetzen
    if (L) renderAll(L);
    // Elemente die renderAll nicht kennt manuell zurücksetzen
    var sv = document.getElementById('kStratVal');
    if (sv) { sv.textContent='BOS+H4'; sv.style.color='#10B981'; sv.style.fontSize='.95rem'; }
    _setEl('kStratLbl', 'H4-Filter');
    _setEl('kStratSub', 'Strategie');
    _setEl('chartTitle', 'Performance-Kurve');
    var elChange = document.getElementById('chartChange');
    if (elChange) elChange.style.color='';
  }
}

function _setEl(id, txt) {
  var el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function drawBBChart() {
  var canvas = document.getElementById('pnlChart');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.parentElement.clientWidth || 320;
  if (W < 10) { setTimeout(drawBBChart, 150); return; }
  var H = 110, dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.scale(dpr, dpr);
  var pts = [100000].concat(BB_MONTHLY.map(function(m){ return m.cap; }));
  var minY = Math.min.apply(null, pts), maxY = Math.max.apply(null, pts), rng = maxY - minY || 1;
  var pad = {t:10,b:10,l:4,r:4};
  var iW = W-pad.l-pad.r, iH = H-pad.t-pad.b;
  var px = function(i){ return pad.l + (i/(pts.length-1))*iW; };
  var py = function(v){ return pad.t + (1-(v-minY)/rng)*iH; };
  var col = '139,92,246';
  var fill = ctx.createLinearGradient(0,pad.t,0,H-pad.b);
  fill.addColorStop(0,'rgba('+col+',.25)');
  fill.addColorStop(1,'rgba('+col+',0)');
  ctx.beginPath();
  ctx.moveTo(px(0), py(pts[0]));
  for (var i=1;i<pts.length;i++){
    var cx=(px(i-1)+px(i))/2;
    ctx.bezierCurveTo(cx,py(pts[i-1]),cx,py(pts[i]),px(i),py(pts[i]));
  }
  ctx.lineTo(px(pts.length-1),H-pad.b); ctx.lineTo(px(0),H-pad.b);
  ctx.closePath(); ctx.fillStyle=fill; ctx.fill();
  var lg = ctx.createLinearGradient(0,0,W,0);
  lg.addColorStop(0,'rgba('+col+',.5)');
  lg.addColorStop(1,'rgb('+col+')');
  ctx.beginPath(); ctx.moveTo(px(0),py(pts[0]));
  for (var j=1;j<pts.length;j++){
    var cx2=(px(j-1)+px(j))/2;
    ctx.bezierCurveTo(cx2,py(pts[j-1]),cx2,py(pts[j]),px(j),py(pts[j]));
  }
  ctx.strokeStyle=lg; ctx.lineWidth=2; ctx.stroke();
  var ex=px(pts.length-1), ey=py(pts[pts.length-1]);
  ctx.beginPath(); ctx.arc(ex,ey,7,0,Math.PI*2);
  ctx.fillStyle='rgba('+col+',.2)'; ctx.fill();
  ctx.beginPath(); ctx.arc(ex,ey,3.5,0,Math.PI*2);
  ctx.fillStyle='rgb('+col+')'; ctx.fill();
  // Label: $1M Linie
  var yMil = py(1000000);
  if (yMil > pad.t && yMil < H-pad.b) {
    ctx.setLineDash([3,3]);
    ctx.strokeStyle='rgba(37,99,235,.4)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.l,yMil); ctx.lineTo(W-pad.r,yMil); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='rgba(96,165,250,.9)'; ctx.font='bold 8px -apple-system,sans-serif';
    ctx.fillText('$1M',W-pad.r-18,yMil-2);
  }
  // From/To labels
  var elFrom = document.getElementById('chartFrom');
  var elChange = document.getElementById('chartChange');
  if (elFrom) elFrom.textContent = 'Jun 2024';
  if (elChange) { elChange.textContent = '+8.656%'; elChange.style.color='#8B5CF6'; }
}

function renderMonthlyBB() {
  var el = document.getElementById('monthlyTable');
  if (!el) return;
  el.innerHTML = BB_MONTHLY.map(function(m) {
    var wc = m.wr >= 40 ? '#10B981' : m.wr >= 30 ? '#F59E0B' : '#EF4444';
    var prev_cap = BB_MONTHLY[BB_MONTHLY.indexOf(m)-1] ? BB_MONTHLY[BB_MONTHLY.indexOf(m)-1].cap : 100000;
    var pnl = m.cap - prev_cap;
    var pc = pnl >= 0 ? '#10B981' : '#EF4444';
    var fmt = function(n) { return n >= 1e6 ? '$' + (n/1e6).toFixed(2)+'M' : '$' + Math.round(n/1000)+'k'; };
    return '<tr style="border-bottom:1px solid rgba(255,255,255,.05)">' +
      '<td style="padding:4px 6px;font-size:.65rem;color:#8B9BB4">'+m.m+'</td>' +
      '<td style="padding:4px 6px;text-align:right;font-size:.65rem">'+m.trades+'</td>' +
      '<td style="padding:4px 6px;text-align:right;font-size:.65rem;color:'+wc+';font-weight:700">'+m.wr+'%</td>' +
      '<td style="padding:4px 6px;text-align:right;font-size:.65rem;color:'+pc+';font-weight:600">'+(pnl>=0?'+':'')+Math.round(pnl/1000)+'k</td>' +
      '<td style="padding:4px 6px;text-align:right;font-size:.65rem;color:#8B5CF6;font-weight:700">'+fmt(m.cap)+'</td>' +
    '</tr>';
  }).join('');
}

async function poll() {
    try {
        const r = await fetch('./data.json?_=' + Date.now());
        if (!r.ok) return;
        const d = await r.json();
        // Veraltete Build-Version — nur einmal pro MRB-Version neuladen (kein Loop)
        if (d.min_required_build && APP_BUILD < d.min_required_build) {
            var lrm = parseInt(localStorage.getItem('_last_reload_mrb')||'0', 10);
            if (d.min_required_build > lrm) {
                localStorage.setItem('_last_reload_mrb', String(d.min_required_build));
                window.location.reload(true);
                return;
            }
        }
        // Neue Version erkannt — APP_BUILD ist gesetzt aber veraltet
        if (APP_BUILD > 0 && d.build_ts && d.build_ts > APP_BUILD) {
            console.log('Neue Version erkannt — Seite wird aktualisiert...');
            window.location.reload(true);
            return;
        }
        L = d; renderAll(L);
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
    const hp = document.getElementById('hPrice');
    if (hp) hp.textContent = (p && p !== '–') ? '$' + Number(p).toLocaleString('de-AT',{minimumFractionDigits:2,maximumFractionDigits:2}) : '–';
    const ht = document.getElementById('hTime');
    if (ht) ht.textContent = d.updated || '–';

    // Backtest-Parameter-Box (Inline-Accordion)
    var box = document.getElementById('_btParams');
    var fd   = (d.from_date||'2026-01-01').slice(0,10);
    var td2  = (d.to_date||new Date().toISOString()).slice(0,10);
    var rPct = d.risk_pct ? (d.risk_pct*100).toFixed(0) : '10';
    var sym  = (d.symbol || 'XAUUSD').toUpperCase();
    var upd  = d.updated || '–';
    var cap  = d.start_cap || 10000;
    var ashort = d.allow_short ? 'checked' : '';
    if (!box) return;
    var inp = 'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:6px 10px;color:#F1F5F9;font-size:.78rem;font-family:inherit;outline:none;-webkit-appearance:none';
    box.innerHTML =
        '<div onclick="_btToggle()" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;font-size:.65rem;color:#8B9BB4;user-select:none;-webkit-user-select:none">'
        + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
        + '<span style="color:#6366F1;font-weight:700;font-size:.7rem">⚙ BACKTEST-KONFIGURATION</span>'
        + '&nbsp;&nbsp;<span style="color:#F1F5F9">'+sym+'</span>'
        + '&nbsp;·&nbsp;<span style="color:#F1F5F9">'+fd+' – '+td2+'</span>'
        + '&nbsp;·&nbsp;Risiko <span style="color:#60A5FA;font-weight:700">'+rPct+'%</span>/Trade'
        + '&nbsp;·&nbsp;<span style="color:#475569">'+upd+'</span>'
        + '</span>'
        + '<span id="_btChev" style="color:#6366F1;font-size:.85rem;margin-left:10px;transition:transform .25s;flex-shrink:0">▼</span>'
        + '</div>'
        + '<div id="_btBody" style="max-height:0;overflow:hidden;transition:max-height .3s ease">'
        + '<div style="padding:4px 14px 14px;border-top:1px solid rgba(99,102,241,.2)">'
        + _aaRow('Symbol','<select id="_aaSym" style="'+inp+'"><option'+(sym==='XAUUSD'?' selected':'')+'>XAUUSD</option><option'+(sym==='XAGUSD'?' selected':'')+'>XAGUSD</option><option'+(sym==='EURUSD'?' selected':'')+'>EURUSD</option><option'+(sym==='GBPUSD'?' selected':'')+'>GBPUSD</option></select>')
        + _aaRow('Von','<input id="_aaFrom" type="date" value="'+fd+'" style="'+inp+'">')
        + _aaRow('Bis','<input id="_aaTo" type="date" value="'+td2+'" style="'+inp+'">')
        + _aaRow('Start-Kapital ($)','<input id="_aaCap" type="number" value="'+cap+'" min="1000" step="1000" style="'+inp+';width:100px">')
        + _aaRow('Risiko / Trade (%)','<input id="_aaRisk" type="number" value="'+rPct+'" min="1" max="50" step="1" style="'+inp+';width:70px">')
        + _aaRow('Short-Trades','<input id="_aaShort" type="checkbox" '+ashort+' style="width:22px;height:22px;accent-color:#10B981;cursor:pointer">',true)
        + '<div style="display:flex;gap:10px;margin-top:14px">'
        + '<button onclick="_runAccOpt(false)" style="flex:1;background:rgba(99,102,241,.18);border:1px solid rgba(99,102,241,.4);color:#818CF8;font-size:.78rem;font-weight:700;padding:13px;border-radius:10px;cursor:pointer;touch-action:manipulation">▶ Backtest</button>'
        + '<button onclick="_runAccOpt(true)" style="flex:1;background:rgba(37,99,235,.15);border:1px solid rgba(37,99,235,.4);color:#60A5FA;font-size:.78rem;font-weight:700;padding:13px;border-radius:10px;cursor:pointer;touch-action:manipulation">🔍 Optimieren</button>'
        + '</div>'
        + '</div></div>';
}
function _aaRow(label, ctrl, last) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0'+(last?'':';border-bottom:1px solid rgba(255,255,255,.06)')+'">'
        + '<span style="color:#8B9BB4;font-size:.78rem">'+label+'</span>'+ctrl+'</div>';
}
function _btToggle() {
    var body = document.getElementById('_btBody');
    var chev = document.getElementById('_btChev');
    if (!body) return;
    if (body._open) {
        body.style.maxHeight = '0';
        body._open = false;
        if (chev) chev.style.transform = '';
    } else {
        body.style.maxHeight = '520px';
        body._open = true;
        if (chev) chev.style.transform = 'rotate(180deg)';
    }
}
async function _runAccOpt(optimize) {
    var sym   = (document.getElementById('_aaSym')||{value:'XAUUSD'}).value;
    var from  = (document.getElementById('_aaFrom')||{value:'2026-01-01'}).value;
    var to    = (document.getElementById('_aaTo')||{value:''}).value;
    var cap   = parseInt((document.getElementById('_aaCap')||{value:'10000'}).value)||10000;
    var risk  = parseFloat((document.getElementById('_aaRisk')||{value:'10'}).value)/100;
    var ashort= !!(document.getElementById('_aaShort')||{checked:false}).checked;
    _btToggle(); // schließen
    if (optimize) {
        toast('Optimizer gestartet — Ergebnis in ~5 Min. im Dashboard 🔍');
        await dispatch({type:'optimize', params:{min_wr:0.60, min_trades:15}});
    } else {
        toast('Backtest gestartet — Ergebnis in ~2 Min. im Commander 📊');
        await dispatch({type:'backtest', params:{symbol:sym, from_date:from, to_date:to||undefined, initial_cap:cap, risk_pct:risk, allow_short:ashort}});
    }
}

// ── DETAIL MODAL ─────────────────────────────────────────────────────────────
var _variants = [];

function showVariantDetail(idx) {
    var s = _variants[idx]; if (!s) return;
    var cfg = s.config || {};
    var isActive = s.active || (s.name||'').includes('Aktuell aktiv');
    var rows = [
        ['Win Rate',      (s.wr||0).toFixed(1)+'%',  s.wr>=70?'#10B981':s.wr>=60?'#F59E0B':'#EF4444'],
        ['Profit Factor', (s.pf||0).toFixed(2)],
        ['Trades',        s.trades||0],
        ['Max Drawdown',  (s.mdd||0).toFixed(1)+'%', (s.mdd||0)>-5?'#10B981':(s.mdd||0)>-10?'#F59E0B':'#EF4444'],
        ['Net PnL',       ((s.pnl||0)>=0?'+':'')+(s.pnl||0).toFixed(0)+'$', (s.pnl||0)>=0?'#10B981':'#EF4444'],
        ['Datum',         s.date||'–'],
        ['─── Parameter ───', ''],
        ['OB Impuls (pips)',  cfg.ob_impulse_pips||'–'],
        ['OB Max-Alter',      cfg.ob_max_age||'–'],
        ['BOS erforderlich',  cfg.bos_required?'Ja':'Nein'],
        ['FVG Min (pips)',    cfg.fvg_min_pips||'–'],
        ['FVG Max-Alter',     cfg.fvg_max_age||'–'],
        ['RR-Verhältnis',     cfg.rr||'–'],
        ['RSI Limit',         cfg.rsi_limit||'–'],
        ['Cooldown (Bars)',   cfg.cooldown||'–'],
        ['EMA Periode',       cfg.ema_len||'–'],
        ['H4-Filter',         cfg.h4_stage_filter?'Aktiv':'Aus'],
        ['Risiko (optimiert)',cfg.risk_pct?(cfg.risk_pct*100).toFixed(1)+'%':'–'],
    ];
    var footer = isActive
        ? '<div style="margin-top:14px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);color:#10B981;font-size:.8rem;font-weight:700;padding:11px;border-radius:10px;text-align:center">✓ Bereits aktiv</div>'
        : '<button onclick="activateVariant(\''+esc(s.id||s.name||'')+'\',\''+esc(s.name||'')+'\');document.getElementById(\'_detailModal\').style.display=\'none\'" style="width:100%;margin-top:14px;background:rgba(16,185,129,.18);border:1px solid rgba(16,185,129,.4);color:#10B981;font-size:.82rem;font-weight:700;padding:12px;border-radius:10px;cursor:pointer;touch-action:manipulation">✓ Diese Variante für Live-Trading aktivieren</button>';
    showDetail(s.name||'Variante', rows, footer);
}

function showDetail(title, rows, footer) {
    var m = document.getElementById('_detailModal');
    if (!m) {
        m = document.createElement('div');
        m.id = '_detailModal';
        m.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px';
        m.onclick = function(e){ if(e.target===m) m.style.display='none'; };
        document.body.appendChild(m);
    }
    m.innerHTML = '<div style="background:#0E1117;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:20px;width:100%;max-width:360px;max-height:80vh;overflow-y:auto">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
        + '<span style="font-weight:700;font-size:.95rem;color:#F1F5F9">'+title+'</span>'
        + '<button onclick="document.getElementById(\'_detailModal\').style.display=\'none\'" style="background:none;border:none;color:#8B9BB4;font-size:1.2rem;cursor:pointer;padding:0 4px">✕</button>'
        + '</div>'
        + rows.map(function(r){ return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)">'
            + '<span style="color:#8B9BB4;font-size:.78rem">'+r[0]+'</span>'
            + '<span style="color:'+( r[2]||'#F1F5F9' )+';font-size:.78rem;font-weight:600">'+r[1]+'</span>'
            + '</div>'; }).join('')
        + (footer||'')
        + '</div>';
    m.style.display = 'flex';
}

function renderKPIs(d) {
    // Wenn BB-Modus aktiv ist renderAll nicht überschreiben lassen
    if (_stratMode === 'bb') return;
    const wr=d.wr||0, pf=d.pf||0, dd=d.max_dd||0, pnl=d.net_pnl||0, tr=d.trades||0;
    document.getElementById('kWR').textContent    = wr  ? wr.toFixed(1)+'%'                 : '–';
    document.getElementById('kPF').textContent    = pf  ? pf.toFixed(2)                      : '–';
    document.getElementById('kDD').textContent    = dd  ? dd.toFixed(1)+'%'                  : '–';
    document.getElementById('kPnL').textContent   = pnl ? (pnl>0?'+':'')+pnl.toFixed(0)+'$' : '–';
    document.getElementById('kTrades').textContent = tr + ' Trades';
    // SMC-Strategie-Card zurücksetzen (falls vorher BB aktiv war)
    var sv = document.getElementById('kStratVal');
    if (sv) { sv.textContent='BOS+H4'; sv.style.color='#10B981'; sv.style.fontSize='.95rem'; }
    _setEl('kStratLbl', 'H4-Filter');
    _setEl('kStratSub', 'Strategie');
    if (!_tsxDataAvailable) _setEl('chartTitle', 'Performance-Kurve');
    var elChange = document.getElementById('chartChange');
    if (elChange) elChange.style.color = '';
    const fd=d.from_date||'', td=d.to_date||'';
    document.getElementById('kPeriod').textContent = (fd!=='–'&&td!=='–'&&fd&&td) ? fd.slice(0,10)+' – '+td.slice(0,10) : '–';
    const card = document.getElementById('kPnLCard');
    const c = pnl >= 0 ? '#10B981' : '#EF4444';
    const g = pnl >= 0 ? 'rgba(16,185,129,.28)' : 'rgba(239,68,68,.28)';
    card.style.setProperty('--kc', c);
    card.style.setProperty('--kg', g);
    // Zusatz-KPIs: Start/End-Kapital, Return, Long/Short
    const ec = d.end_cap||0, sc = d.start_cap||10000, ret = d.return_pct||0;
    const elRet  = document.getElementById('kReturn');
    const elCap  = document.getElementById('kEndCap');
    const elLS   = document.getElementById('kLongShort');
    const elRisk = document.getElementById('kRisk');
    if (elRet)  { elRet.textContent  = ret  ? (ret>0?'+':'')+ret.toFixed(1)+'%'   : '–'; elRet.style.color = ret>=0?'#10B981':'#EF4444'; }
    if (elCap)  { elCap.textContent  = ec   ? '$'+ec.toLocaleString('de-DE',{maximumFractionDigits:0}) : '–'; }
    if (elLS)   { const l=d.longs||0, s=d.shorts||0; elLS.textContent = (l||s) ? l+'L / '+s+'S' : '–'; }
    if (elRisk) { elRisk.textContent = d.risk_pct ? (d.risk_pct*100).toFixed(0)+'% Risiko' : '–'; }
    // Monatstabelle rendern (nicht wenn TopStepX-Daten aktiv sind)
    if (!_tsxDataAvailable) renderMonthly(d.monthly||[]);

    // Karten anklickbar machen (Detail-Popup)
    var _addTap = function(elId, title, rows) {
        var el = document.getElementById(elId);
        var kpiEl = el && (el.closest ? el.closest('.kpi') : null);
        if (kpiEl && !kpiEl._tapDone) {
            kpiEl._tapDone = true;
            kpiEl.style.cursor = 'pointer';
            kpiEl.addEventListener('click', function(){ showDetail(title, rows); });
        }
    };
    _addTap('kWR',  'Win Rate Details', [
        ['Win Rate', wr.toFixed(1)+'%', wr>=60?'#10B981':wr>=45?'#F59E0B':'#EF4444'],
        ['Trades gesamt', tr],
        ['Zeitraum', fd.slice(0,10)+' – '+td.slice(0,10)],
        ['Ziel', '≥ 60%', '#10B981']
    ]);
    _addTap('kPF',  'Profit Factor Details', [
        ['Profit Factor', pf.toFixed(2), pf>=2?'#10B981':pf>=1.5?'#F59E0B':'#EF4444'],
        ['Bedeutung', pf>=2 ? 'Exzellent' : pf>=1.5 ? 'Gut' : pf>=1 ? 'Akzeptabel' : 'Verlustzone'],
        ['Net PnL', (pnl>0?'+':'')+pnl.toFixed(0)+'$', pnl>=0?'#10B981':'#EF4444'],
        ['Ziel', '≥ 2.0', '#10B981']
    ]);
    _addTap('kDD',  'Max Drawdown Details', [
        ['Max Drawdown', dd.toFixed(1)+'%', dd>-5?'#10B981':dd>-8?'#F59E0B':'#EF4444'],
        ['Risiko je Trade', d.risk_pct ? (d.risk_pct*100).toFixed(0)+'%' : '–'],
        ['Start-Kapital', '$'+sc.toLocaleString('de-DE',{maximumFractionDigits:0})],
        ['Status', dd>-5?'✅ Sicher':dd>-8?'⚠️ Warnung':'🔴 Kritisch']
    ]);
    _addTap('kPnL', 'Net PnL Details', [
        ['Net PnL', (pnl>0?'+':'')+pnl.toFixed(0)+'$', pnl>=0?'#10B981':'#EF4444'],
        ['Return', (ret>0?'+':'')+ret.toFixed(1)+'%', ret>=0?'#10B981':'#EF4444'],
        ['Start-Kapital', '$'+sc.toLocaleString('de-DE',{maximumFractionDigits:0})],
        ['End-Kapital', '$'+ec.toLocaleString('de-DE',{maximumFractionDigits:0}), ec>=sc?'#10B981':'#EF4444']
    ]);
}

function renderMonthly(monthly) {
    const el = document.getElementById('monthlyTable');
    if (!el || !monthly.length) return;
    el.innerHTML = monthly.map(function(m){
        const wr_c = m.wr >= 60 ? '#10B981' : m.wr >= 45 ? '#F59E0B' : '#EF4444';
        const pnl_c = m.pnl >= 0 ? '#10B981' : '#EF4444';
        return '<tr style="border-bottom:1px solid rgba(255,255,255,.05)">'
            +'<td style="padding:5px 8px;color:#8B9BB4;font-size:.7rem">'+m.month+'</td>'
            +'<td style="padding:5px 8px;text-align:right;font-size:.7rem">'+m.trades+'</td>'
            +'<td style="padding:5px 8px;text-align:right;font-size:.72rem;font-weight:700;color:'+wr_c+'">'+m.wr+'%</td>'
            +'<td style="padding:5px 8px;text-align:right;font-size:.72rem;font-weight:700;color:'+pnl_c+'">'+(m.pnl>0?'+':'')+m.pnl.toFixed(0)+'$</td>'
            +'<td style="padding:5px 8px;text-align:right;font-size:.7rem;color:#CBD5E1">$'+m.cap.toLocaleString('de-DE',{maximumFractionDigits:0})+'</td>'
            +'</tr>';
    }).join('');
}

// ── CHART ──────────────────────────────────────────────────────────────────
function drawChart(d) {
    // TopStepX-Daten aktiv → Backtest-Chart unterdrücken (nur TSX-Aufrufe mit d._tsx dürfen)
    if (_tsxDataAvailable && !d._tsx) return;
    const canvas = document.getElementById('pnlChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // clientWidth ist 0 wenn Tab noch nicht sichtbar → mit setTimeout nochmal versuchen
    let W = canvas.parentElement.clientWidth || canvas.closest('.card') && canvas.closest('.card').clientWidth || 0;
    if (W < 10) { setTimeout(function(){ drawChart(d); }, 150); return; }
    const H = 110;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    // Build points — echte Kapitalkurve (Priorität: monthly > start/end_cap > Simulation)
    let pts = [];
    const monthly = d.monthly || [];
    if (monthly.length >= 2) {
        const sc = d.start_cap || 10000;
        pts = [sc].concat(monthly.map(function(m){ return m.cap; }));
    } else if (d.start_cap && d.end_cap && d.end_cap > 0 && d.trades > 0) {
        // Realistische Kurve aus Backtest-Daten ableiten
        const sc = d.start_cap, ec = d.end_cap, n = Math.min(d.trades, 40);
        const wr = (d.wr||50)/100;
        let eq = sc, rng2 = Math.abs(Math.round(sc+ec));
        var rand2=function(){rng2=(rng2*1664525+1013904223)&0xffffffff;return(rng2>>>0)/0xffffffff;};
        const step = (ec-sc)/n;
        pts = [sc];
        for(var i=0;i<n-1;i++){const w=rand2()<wr;eq+=w?Math.abs(step)*1.5:-Math.abs(step)*0.5;pts.push(eq);}
        pts.push(ec);
    } else {
        const wr = d.wr||55, n = Math.max(d.trades||60, 20);
        let eq = 10000, rng2 = 1234;
        var rand=function(){ rng2 = (rng2*1664525+1013904223)&0xffffffff; return (rng2>>>0)/0xffffffff; };
        pts = Array.from({length:Math.min(n,80)}, function(){ const w=rand()<wr/100; eq+=w?eq*.013:-eq*.008; return eq; });
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
    // Only show banner when bot is actually blocked — not for backtest-derived alerts
    if (d.risk_status === 'blocked') {
        const alerts = d.alerts || [];
        b.classList.add('on');
        document.getElementById('riskTxt').textContent = alerts.length ? alerts.join(' | ') : 'Risk-Limit erreicht — Trading pausiert';
    } else {
        b.classList.remove('on');
    }
}

function renderStrategies(d) {
    const el = document.getElementById('stratList');
    const v = d.variants||[];
    if (!v.length) { el.innerHTML='<div class="empty"><div class="empty-ico">🔄</div>Noch keine Strategien</div>'; return; }
    const top = [...v].sort((a,b)=>(b.wr||0)-(a.wr||0)).slice(0,6);
    _variants = top;
    el.innerHTML = top.map((s,i) => {
        const isActive = s.active || (s.name||'').includes('Aktuell aktiv');
        const activeBadge = isActive
            ? '<span style="background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.4);color:#10B981;font-size:.55rem;font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap">✓ AKTIV</span>'
            : `<button onclick="event.stopPropagation();activateVariant('${esc(s.id||s.name||'')}','${esc(s.name||'')}')" style="background:rgba(37,99,235,.12);border:1px solid rgba(37,99,235,.35);color:#60A5FA;font-size:.55rem;font-weight:700;padding:3px 9px;border-radius:20px;cursor:pointer;touch-action:manipulation;white-space:nowrap">Aktivieren</button>`;
        return `<div class="str-row" onclick="showVariantDetail(${i})" style="align-items:center;gap:6px;cursor:pointer">
          <div class="str-rank">${i+1}</div>
          <div class="str-info" style="flex:1;min-width:0">
            <div class="str-name">${esc(s.name||s.strategy||'Strategie '+(i+1))}</div>
            <div class="str-det">PF: ${s.pf?s.pf.toFixed(2):'–'} · DD: ${s.mdd?s.mdd.toFixed(1):(s.max_dd?s.max_dd.toFixed(1):'–')}% · ${s.trades||0} Trades</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <div class="str-wr">${s.wr?s.wr.toFixed(1)+'%':'–'}</div>
            ${activeBadge}
          </div>
        </div>`;
    }).join('');
    drawStratsChart(top);
}

async function activateVariant(variantId, variantName) {
    if (!ghTok()) { toast('Kein GitHub-Token — Aktivierung nicht möglich', true); return; }
    const ok = confirm('Variante aktivieren für Live-Trading?\n\n"' + variantName + '"\n\nDer Bot übernimmt diese Parameter.');
    if (!ok) return;
    toast('Aktiviere ' + variantName + '…');
    await dispatch({
        type: 'set_active_variant',
        variant_id: variantId,
        variant_name: variantName,
        risk_pct: 0.10,
    });
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

// ── POLYMARKET (removed) ────────────────────────────────────────────────────
function renderPoly(d) { return; // disabled
    var poly = d.polymarket || {};
    var opps = poly.opportunities || [];
    var orders = poly.all_orders || poly.orders_placed || [];
    var mode = poly.dry_run !== false ? 'PAPER' : 'LIVE';

    // KPIs
    var mEl      = document.getElementById('polyMarkets');
    var wrEl     = document.getElementById('polyWR');
    var wrSubEl  = document.getElementById('polyWRSub');
    var portEl   = document.getElementById('polyPortfolio');
    var modeEl   = document.getElementById('polyMode');
    var pnlEl    = document.getElementById('polyPnL');
    var winsEl   = document.getElementById('polyWins');
    var lossesEl = document.getElementById('polyLosses');

    if (mEl) mEl.textContent = poly.markets_scanned || '–';
    if (modeEl) { modeEl.textContent = mode; modeEl.style.color = mode === 'LIVE' ? '#EF4444' : '#10B981'; }

    // Portfolio + echte Win Rate
    var port = poly.portfolio_usd;
    var pnl  = poly.total_pnl || 0;
    var wr   = poly.real_win_rate || 0;
    var wins = poly.resolved_wins || 0;
    var loss = poly.resolved_losses || 0;
    if (portEl && port !== undefined) portEl.textContent = '$' + parseFloat(port).toFixed(0);
    if (wrEl) wrEl.textContent = wr > 0 ? (wr * 100).toFixed(1) + '%' : '–';
    if (wrSubEl) wrSubEl.textContent = (wins + loss) > 0 ? (wins + loss) + ' aufgelöst' : 'noch keine Daten';
    if (pnlEl) { pnlEl.textContent = (pnl >= 0 ? '+' : '') + '$' + parseFloat(pnl).toFixed(2); pnlEl.style.color = pnl >= 0 ? '#10B981' : '#EF4444'; }
    if (winsEl) winsEl.textContent = wins;
    if (lossesEl) lossesEl.textContent = loss;

    // Top opportunity
    var top = poly.top_opportunity;
    var topCard = document.getElementById('polyTopCard');
    if (top && topCard) {
        topCard.style.display = '';
        var edgeEl = document.getElementById('polyTopEdge');
        var contentEl = document.getElementById('polyTopContent');
        if (edgeEl) edgeEl.textContent = (top.edge * 100).toFixed(1) + '% Edge';
        if (contentEl) {
            var dirColor = top.direction === 'YES' ? 'var(--green)' : 'var(--red)';
            var verdictIcon = top.debate_verdict === 'bull' ? '🐂' : top.debate_verdict === 'bear' ? '🐻' : '⚖️';
            var bullHtml = top.bull_argument
                ? '<div style="background:rgba(16,185,129,.07);border-left:2px solid var(--green);padding:6px 8px;border-radius:0 5px 5px 0;font-size:.67rem;color:var(--text2);line-height:1.45;margin-bottom:5px">' +
                  '<span style="color:var(--green);font-weight:700;font-size:.6rem">🐂 BULL &nbsp;</span>' + esc(top.bull_argument) + '</div>'
                : '';
            var bearHtml = top.bear_argument
                ? '<div style="background:rgba(239,68,68,.07);border-left:2px solid var(--red);padding:6px 8px;border-radius:0 5px 5px 0;font-size:.67rem;color:var(--text2);line-height:1.45;margin-bottom:5px">' +
                  '<span style="color:var(--red);font-weight:700;font-size:.6rem">🐻 BEAR &nbsp;</span>' + esc(top.bear_argument) + '</div>'
                : '';
            contentEl.innerHTML =
                '<div style="font-size:.82rem;font-weight:700;color:var(--text);margin-bottom:8px">' + esc(top.question) + '</div>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
                  '<span style="background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.3);color:var(--purple);padding:3px 8px;border-radius:5px;font-size:.65rem;font-weight:700">' +
                    top.direction + ' @ ' + (top.direction === 'YES' ? top.yes_price : top.no_price).toFixed(2) +
                  '</span>' +
                  '<span style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);color:var(--gold);padding:3px 8px;border-radius:5px;font-size:.65rem;font-weight:700">' +
                    'Claude: ' + (top.claude_prob * 100).toFixed(0) + '%' +
                  '</span>' +
                  '<span style="background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text2);padding:3px 8px;border-radius:5px;font-size:.65rem">' +
                    'Vol: $' + (top.volume_24h || 0).toLocaleString() +
                  '</span>' +
                '</div>' +
                (bullHtml || bearHtml
                  ? '<div style="margin-bottom:8px">' + bullHtml + bearHtml + '</div>'
                  : '') +
                '<div style="font-size:.67rem;color:var(--text3);line-height:1.5;border-top:1px solid var(--border);padding-top:7px">' +
                  verdictIcon + ' <b>Judge:</b> ' + esc(top.reasoning || top.key_factor || '') +
                '</div>';
        }
    } else if (topCard) {
        topCard.style.display = 'none';
    }

    // Opportunities list
    var oppEl = document.getElementById('polyOppList');
    if (oppEl) {
        if (!opps.length) {
            var scanned = poly.markets_scanned || 0;
            var emptyMsg = scanned > 0
                ? 'Letzter Scan: ' + scanned + ' Märkte — keine Opportunitäten (Edge≥8%, high confidence)'
                : 'Kein Scan gelaufen — startet alle 5 Min';
            oppEl.innerHTML = '<div class="empty"><div class="empty-ico">⬡</div>' + emptyMsg + '</div>';
        } else {
            oppEl.innerHTML = opps.map(function(o) {
                var edgePct = (o.edge * 100).toFixed(1);
                var hasEdge = o.edge >= 0.05;
                var edgeColor = hasEdge ? 'var(--green)' : 'var(--text3)';
                var confColor = o.confidence === 'high' ? 'var(--green)' : o.confidence === 'medium' ? 'var(--gold)' : 'var(--text3)';
                var confDE = o.confidence === 'high' ? 'high' : o.confidence === 'medium' ? 'medium' : 'low';
                return '<div class="sig-row">' +
                    '<div class="sig-dir ' + (o.direction === 'YES' ? 'long' : 'short') + '" style="width:38px;font-size:.58rem">' + esc(o.direction) + '</div>' +
                    '<div class="sig-info">' +
                      '<div class="sig-price" style="font-size:.75rem">' + esc(o.question.slice(0, 70)) + (o.question.length > 70 ? '…' : '') + '</div>' +
                      '<div class="sig-det">YES ' + (o.yes_price * 100).toFixed(0) + '% · Claude ' + (o.claude_prob * 100).toFixed(0) + '% · Vol $' + (o.volume_24h || 0).toLocaleString() + '</div>' +
                    '</div>' +
                    '<div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end;flex-shrink:0">' +
                      '<span style="font-size:.7rem;font-weight:800;color:' + edgeColor + '">' + edgePct + '%</span>' +
                      '<span style="font-size:.58rem;color:' + confColor + '">' + confDE + '</span>' +
                    '</div>' +
                  '</div>';
            }).join('');
        }
    }

    // Orders list
    var ordListEl = document.getElementById('polyOrderList');
    var ordHeaderEl = document.getElementById('polyOrderHeader');
    if (ordListEl) {
        if (!orders.length) {
            ordListEl.innerHTML = '<div class="empty"><div class="empty-ico">📋</div>Noch keine Orders</div>';
            if (ordHeaderEl) ordHeaderEl.textContent = 'Simulierte Orders';
        } else {
            var openOrders  = orders.filter(function(o){ return o.status === 'open'; });
            var totalStaked = openOrders.reduce(function(s,o){ return s + (o.stake||0); }, 0);
            var totalPotWin = openOrders.reduce(function(s,o){ return s + (o.potential_win||0); }, 0);
            if (ordHeaderEl) ordHeaderEl.innerHTML =
                '<span style="color:var(--text2)">' + openOrders.length + ' offen</span>' +
                '&nbsp;·&nbsp;<span style="color:var(--text3);font-size:.6rem">$' + totalStaked.toFixed(0) + ' gesetzt · pot. +$' + totalPotWin.toFixed(0) + '</span>';

            ordListEl.innerHTML = orders.slice(0, 10).map(function(o) {
                var dirClass = o.direction === 'YES' ? 'long' : 'short';
                var statusColor = o.status === 'won' ? 'var(--green)' : o.status === 'lost' ? 'var(--red)' : 'var(--text3)';
                var statusIcon  = o.status === 'won' ? '✓ +$'+(o.pnl||0).toFixed(2) : o.status === 'lost' ? '✗ -$'+(Math.abs(o.stake||0)).toFixed(2) : '+$'+(o.potential_win||0).toFixed(2)+'?';
                var winColor    = o.status === 'won' ? 'var(--green)' : o.status === 'lost' ? 'var(--red)' : 'var(--gold)';
                return '<div class="sig-row" style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)">' +
                    '<div class="sig-dir ' + dirClass + '" style="width:38px;font-size:.58rem;flex-shrink:0">' + esc(o.direction) + '</div>' +
                    '<div class="sig-info" style="flex:1;min-width:0">' +
                      '<div class="sig-price" style="font-size:.72rem;white-space:normal;line-height:1.3">' + esc((o.question || '').slice(0, 70)) + (o.question && o.question.length > 70 ? '…' : '') + '</div>' +
                      '<div class="sig-det" style="margin-top:3px">@ ' + ((o.price||0)*100).toFixed(0) + '¢ · $' + (o.stake||0).toFixed(0) + ' · ' + esc((o.ts||'').slice(11,16)) + '</div>' +
                    '</div>' +
                    '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;padding-left:8px">' +
                      '<span style="font-size:.72rem;font-weight:800;color:' + winColor + '">' + statusIcon + '</span>' +
                      '<span style="font-size:.55rem;color:' + statusColor + '">' + esc(o.status||'open') + '</span>' +
                    '</div>' +
                  '</div>';
            }).join('');
        }
    }
}

// ── TABS ───────────────────────────────────────────────────────────────────
var _tabMap = {stats:'panelDashboard', agents:'panelAgents', topstep:'panelTopstep', bitget:'panelBitget', chat:'panelChat', notes:'panelNotes'};
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
    if (tab === 'bitget') initBitget();
    if (tab === 'topstep') { calcTopstep(); _updateTsx2Chart(); if (typeof LIVE !== 'undefined') _refreshTsx2Panel(LIVE.tsx || {}); }
    // Badge löschen wenn Chat-Tab geöffnet wird
    if (tab === 'chat') { var b=document.getElementById('chatBadge'); if(b){b.textContent='0';b.style.display='none';} }
}

// ── BITGET ──────────────────────────────────────────────────────────────────
var BG_STRATS = {
    'a': {name:'A — Long-only ★ (Bitget)',wr:60,   weekly_pct:11.15,max_dd:26.5, trades_week:4.5,  color:'#F59E0B',  rr:'1.5:1',  desc:'5% Risiko · 5 Charts · Jan–Jun 2026'},
    'b': {name:'B — Long+Short (Bitget)', wr:52.6, weekly_pct:50.22,max_dd:53.5, trades_week:17.5, color:'#60A5FA',  rr:'2:1',    desc:'5% Risiko · 5 Charts · Jan–Jun 2026'},
};

function _bgFmt$(n) { return '$' + Math.abs(n).toLocaleString('de-DE', {minimumFractionDigits:0,maximumFractionDigits:0}); }
function _bgFmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }

function calcBitget() {
    var strat = (document.getElementById('bgStrategy')||{}).value || 'd';
    var capital = parseFloat((document.getElementById('bgCapital')||{}).value) || 1000;
    var s = BG_STRATS[strat];
    if (!s) return;
    var wkly = s.weekly_pct / 100;

    var infoEl = document.getElementById('bgStratInfo');
    if (infoEl) {
        infoEl.innerHTML = [
            ['Win Rate', s.wr + '%', s.color],
            ['R:R', s.rr, s.color],
            ['Trades/Woche', s.trades_week, '#9DB4CC'],
            ['Max DD', '-' + s.max_dd + '%', '#EF4444']
        ].map(function(x) {
            return '<div style="text-align:center">'
                + '<div style="font-size:.55rem;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">' + x[0] + '</div>'
                + '<div style="font-size:.8rem;font-weight:800;color:' + x[2] + '">' + x[1] + '</div></div>';
        }).join('');
    }

    var periods = [
        {label:'1 Woche', weeks:1},
        {label:'1 Monat', weeks:4.33},
        {label:'3 Monate', weeks:13},
        {label:'6 Monate', weeks:26},
        {label:'1 Jahr', weeks:52}
    ];
    var max1yr = capital * Math.pow(1 + wkly, 52);
    var rows = '';
    for (var i = 0; i < periods.length; i++) {
        var p = periods[i];
        var end = capital * Math.pow(1 + wkly, p.weeks);
        var gain = end - capital;
        var pct = (gain / capital) * 100;
        var col = gain >= 0 ? '#10B981' : '#EF4444';
        var bar_w = Math.min(100, ((end - capital) / (max1yr - capital)) * 100);
        rows += '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
            + '<span style="font-size:.68rem;color:var(--text2);flex-shrink:0;width:72px">' + p.label + '</span>'
            + '<div style="flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden">'
            + '<div style="height:100%;width:' + bar_w.toFixed(0) + '%;background:' + s.color + ';border-radius:2px;opacity:.8"></div></div>'
            + '<div style="text-align:right;flex-shrink:0">'
            + '<div style="font-size:.85rem;font-weight:900;color:' + col + '">' + (gain >= 0 ? '+' : '') + _bgFmt$(gain) + '</div>'
            + '<div style="font-size:.58rem;color:var(--text3)">' + _bgFmt$(end) + ' (' + _bgFmtPct(pct) + ')</div>'
            + '</div></div>';
    }
    var resEl = document.getElementById('bgResults');
    if (resEl) resEl.innerHTML = rows;

    var riskEl = document.getElementById('bgRiskNote');
    if (riskEl) riskEl.innerHTML = '<strong style="color:#F59E0B">⚠ Backtest-Projektion</strong> · Keine Garantie. '
        + 'Historischer Max Drawdown: <strong style="color:#EF4444">-' + s.max_dd + '%</strong> '
        + '→ maximaler Verlust auf ' + _bgFmt$(capital) + ': <strong style="color:#EF4444">-' + _bgFmt$(capital * s.max_dd / 100) + '</strong>';
}

// ── TOPSTEP STRATEGIE-RECHNER ────────────────────────────────────────────────
var TSX_STRATS = {
    'elite':  {name:'SMC Elite ★ (Live)',  wr:69.4, weekly_pct:0.44, max_dd:3.5,  trades_week:10, color:'#2563EB', pf:'1.28', desc:'MGC Gold · 5% Risiko · Jan–Jun 2026'},
    'moderat':{name:'SMC Moderat',         wr:65,   weekly_pct:0.22, max_dd:2.0,  trades_week:5,  color:'#10B981', pf:'1.15', desc:'2.5% Risiko · Reduzierte Frequenz'},
};

function calcTopstep() {
    var strat   = (document.getElementById('tsxStrategy')||{}).value || 'elite';
    var capital = parseFloat((document.getElementById('tsxCapital')||{}).value) || 50000;
    var s = TSX_STRATS[strat];
    if (!s) return;
    var wkly = s.weekly_pct / 100;

    var infoEl = document.getElementById('tsxStratInfo');
    if (infoEl) {
        infoEl.innerHTML = [
            ['Win Rate', s.wr + '%', s.color],
            ['Profit Fak.', s.pf, s.color],
            ['Trades/Woche', s.trades_week, '#9DB4CC'],
            ['Max DD', '-' + s.max_dd + '%', '#EF4444']
        ].map(function(x) {
            return '<div style="text-align:center">'
                + '<div style="font-size:.55rem;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">' + x[0] + '</div>'
                + '<div style="font-size:.8rem;font-weight:800;color:' + x[2] + '">' + x[1] + '</div></div>';
        }).join('');
    }

    var periods = [
        {label:'1 Woche',   weeks:1},
        {label:'1 Monat',   weeks:4.33},
        {label:'3 Monate',  weeks:13},
        {label:'6 Monate',  weeks:26},
        {label:'1 Jahr',    weeks:52}
    ];
    var max1yr = capital * Math.pow(1 + wkly, 52);
    var rows = '';
    for (var i = 0; i < periods.length; i++) {
        var p = periods[i];
        var end  = capital * Math.pow(1 + wkly, p.weeks);
        var gain = end - capital;
        var net  = gain * 0.8;
        var pct  = (gain / capital) * 100;
        var col  = gain >= 0 ? '#10B981' : '#EF4444';
        var bar_w = max1yr > capital ? Math.min(100, ((end - capital) / (max1yr - capital)) * 100) : 0;
        rows += '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
            + '<span style="font-size:.68rem;color:var(--text2);flex-shrink:0;width:72px">' + p.label + '</span>'
            + '<div style="flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden">'
            + '<div style="height:100%;width:' + bar_w.toFixed(0) + '%;background:' + s.color + ';border-radius:2px;opacity:.8"></div></div>'
            + '<div style="text-align:right;flex-shrink:0">'
            + '<div style="font-size:.85rem;font-weight:900;color:' + col + '">' + (net >= 0 ? '+' : '') + _bgFmt$(net) + '</div>'
            + '<div style="font-size:.58rem;color:var(--text3)">' + _bgFmtPct(pct) + ' · brutto ' + _bgFmt$(gain) + '</div>'
            + '</div></div>';
    }
    var resEl = document.getElementById('tsxResults');
    if (resEl) resEl.innerHTML = rows;

    var riskEl = document.getElementById('tsxRiskNote');
    if (riskEl) riskEl.innerHTML = '<strong style="color:#2563EB">⚠ Backtest-Projektion (80% Payout)</strong> · Keine Garantie. '
        + 'Max Drawdown: <strong style="color:#EF4444">-' + s.max_dd + '%</strong> '
        + '→ max. Verlust: <strong style="color:#EF4444">-' + _bgFmt$(capital * s.max_dd / 100) + '</strong> · '
        + 'TopStepX zahlt 80% der Gewinne aus (nach Combine-Pass).';
}

function initBitget() {
    calcBitget();
    _updateBgChart();
    var L = (typeof LIVE !== 'undefined') ? LIVE : {};
    var bg = L.bitget || {};
    var conn = !!bg.connected;

    var badge = document.getElementById('bgConnBadge');
    if (badge) {
        badge.textContent = conn ? '● Verbunden' : '· Nicht verbunden';
        badge.style.background = conn ? 'rgba(16,185,129,.15)' : 'rgba(55,65,81,.4)';
        badge.style.color = conn ? '#10B981' : 'var(--text3)';
    }
    var note = document.getElementById('bgConnNote');
    if (note) note.style.display = conn ? 'none' : 'block';

    if (conn) {
        var bal = bg.balance || 0;
        var pnlT = bg.realized_pnl_today || 0;
        var unpnl = bg.unrealized_pnl || 0;
        var positions = bg.positions || [];
        var el; el = document.getElementById('bgBalance');
        if (el) { el.textContent = bal > 0 ? '$' + bal.toFixed(2) : '–'; }
        el = document.getElementById('bgPnLToday');
        if (el) { el.textContent = (pnlT >= 0 ? '+$' : '-$') + Math.abs(pnlT).toFixed(2); el.style.color = pnlT >= 0 ? '#10B981' : '#EF4444'; }
        el = document.getElementById('bgUnrealPnL');
        if (el) { el.textContent = (unpnl >= 0 ? '+$' : '-$') + Math.abs(unpnl).toFixed(2); el.style.color = unpnl >= 0 ? '#10B981' : '#EF4444'; }
        el = document.getElementById('bgPosCnt');
        if (el) el.textContent = positions.length + ' Positionen';
        var posHtml = '';
        positions.forEach(function(p) {
            var c = p.direction === 'long' ? '#10B981' : '#EF4444';
            var pnl = p.unrealizedPnl || 0;
            posHtml += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
                + '<span style="font-size:.55rem;font-weight:800;padding:2px 6px;border-radius:4px;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '44">' + (p.direction||'?').toUpperCase() + '</span>'
                + '<span style="font-size:.7rem;font-weight:700;color:#F0F4FF">' + (p.symbol||'?') + '</span>'
                + '<span style="font-size:.62rem;color:#9DB4CC">' + (p.size||0) + 'x</span>'
                + '<span style="margin-left:auto;font-size:.72rem;font-weight:700;color:' + c + '">' + (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toFixed(2) + '</span>'
                + '</div>';
        });
        el = document.getElementById('bgPosList');
        if (el) el.innerHTML = posHtml || '<div style="font-size:.65rem;color:var(--text3);padding:4px 0">Keine offene Position</div>';

        // ── Stats-Seite: Bitget-Kurzfassung ─────────────────────────────────
        var totalPnl  = bg.total_realized_pnl || 0;
        var totalTr   = bg.total_trades  || 0;
        var totalWins = bg.total_wins    || 0;
        var wr = totalTr > 0 ? Math.round(totalWins / totalTr * 100) : 0;
        el = document.getElementById('bgSumBalance');
        if (el) el.textContent = bal > 0 ? '$' + bal.toFixed(2) : '–';
        el = document.getElementById('bgSumTotalPnl');
        if (el) { el.textContent = (totalPnl >= 0 ? '+$' : '-$') + Math.abs(totalPnl).toFixed(2); el.style.color = totalPnl >= 0 ? '#10B981' : '#EF4444'; }
        el = document.getElementById('bgSumWR');
        if (el) { el.textContent = totalTr > 0 ? wr + '%' : '–'; el.style.color = wr >= 60 ? '#10B981' : wr >= 40 ? '#F59E0B' : '#EF4444'; }
        el = document.getElementById('bgSumTrades');
        if (el) el.textContent = totalTr + ' Trades';
        el = document.getElementById('bgSumUnreal');
        if (el) { el.textContent = (unpnl >= 0 ? '+$' : '-$') + Math.abs(unpnl).toFixed(2); el.style.color = unpnl >= 0 ? '#10B981' : '#EF4444'; }
        el = document.getElementById('bgSumPosCnt');
        if (el) el.textContent = positions.length + ' Pos.';

        // ── Stats-Seite: Variante C (Bitget Live) ───────────────────────────
        el = document.getElementById('bgLiveWR');
        if (el) { el.textContent = totalTr > 0 ? wr + '%' : '–'; el.style.color = wr >= 60 ? '#10B981' : wr >= 40 ? '#F59E0B' : '#EF4444'; }
        el = document.getElementById('bgLiveTrades');
        if (el) el.textContent = totalTr > 0 ? totalTr : '–';
        el = document.getElementById('bgLivePnL');
        if (el) { el.textContent = (totalPnl >= 0 ? '+$' : '-$') + Math.abs(totalPnl).toFixed(2); el.style.color = totalPnl >= 0 ? '#10B981' : '#EF4444'; }
        el = document.getElementById('bgLiveBal');
        if (el) el.textContent = bal > 0 ? '$' + bal.toFixed(2) : '–';
        var hist = bg.daily_history || [];
        var fillsHtml = '';
        var recentFills = (bg.fills_today || []).slice(-5).reverse();
        recentFills.forEach(function(f) {
            var c = f.pnl > 0 ? '#10B981' : (f.pnl < 0 ? '#EF4444' : '#9DB4CC');
            fillsHtml += '<span style="margin-right:8px;color:' + c + '">' + (f.symbol || '?') + ' ' + (f.pnl >= 0 ? '+$' : '-$') + Math.abs(f.pnl || 0).toFixed(2) + '</span>';
        });
        el = document.getElementById('bgLiveFills');
        if (el) el.innerHTML = fillsHtml || '<span style="color:var(--text3)">Keine Fills heute</span>';
        if (hist.length > 0) {
            var period = hist[0].date + ' – ' + hist[hist.length - 1].date;
            el = document.getElementById('bgLivePeriod');
            if (el) el.textContent = period;
        }

        // Bitget-Chart zeichnen (falls aktiver Tab)
        if (_activeChartMode === 'bg') {
            _drawBitgetChart(hist, bg);
        }
    }

    // ── Trades Heute (immer rendern, auch ohne Verbindung) ───────────────────
    var fills = bg.fills_today || [];
    var closedFills = fills.filter(function(f) { return f.result !== 'OPEN'; });
    var openFills   = fills.filter(function(f) { return f.result === 'OPEN'; });
    var bdg = document.getElementById('bgTradesBadge');
    if (bdg) {
        bdg.textContent = fills.length;
        bdg.style.background = fills.length > 0 ? 'rgba(245,158,11,.18)' : 'rgba(55,65,81,.3)';
        bdg.style.color = fills.length > 0 ? '#F59E0B' : 'var(--text3)';
    }
    var cbdg = document.getElementById('bgClosedBadge');
    if (cbdg) cbdg.textContent = closedFills.length;
    var obdg = document.getElementById('bgOpenBadge');
    if (obdg) obdg.textContent = openFills.length;

    function _fillRow(f) {
        var col  = f.pnl > 0 ? '#10B981' : (f.pnl < 0 ? '#EF4444' : '#9DB4CC');
        var res  = f.result || (f.pnl > 0 ? 'WIN' : f.pnl < 0 ? 'LOSS' : 'OPEN');
        var fee  = f.fee || 0;
        var net  = (f.pnl || 0) + fee;
        var netCol = net > 0 ? '#10B981' : (net < 0 ? '#EF4444' : '#9DB4CC');
        var typ  = f.tradeSide === 'open' ? 'ENTRY' : (f.tradeSide === 'close' ? 'EXIT' : (f.tradeSide || ''));
        var typCol = f.tradeSide === 'open' ? '#60A5FA' : '#F59E0B';
        var hasPnl = f.pnl !== 0 || fee !== 0;
        return '<div style="padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.05)">'
            + '<div style="display:flex;align-items:center;gap:6px">'
            + (typ ? '<span style="font-size:.48rem;font-weight:800;padding:1px 5px;border-radius:3px;background:' + typCol + '22;color:' + typCol + ';border:1px solid ' + typCol + '33;flex-shrink:0">' + typ + '</span>' : '')
            + '<span style="font-size:.52rem;font-weight:800;padding:2px 6px;border-radius:4px;background:' + col + '22;color:' + col + ';border:1px solid ' + col + '44;flex-shrink:0">' + res + '</span>'
            + '<span style="font-size:.68rem;font-weight:700;color:#F0F4FF">' + (f.symbol || '?') + '</span>'
            + '<span style="font-size:.58rem;color:#9DB4CC">' + (f.side || '') + ' · ' + (f.qty || 0) + ' @ $' + (f.price || 0).toFixed(2) + '</span>'
            + '<span style="margin-left:auto;font-size:.72rem;font-weight:800;color:' + col + '">' + (f.pnl >= 0 ? '+$' : '-$') + Math.abs(f.pnl || 0).toFixed(2) + '</span>'
            + '</div>'
            + (hasPnl ? '<div style="display:flex;justify-content:flex-end;gap:12px;margin-top:2px">'
            + '<span style="font-size:.55rem;color:#6B7A90">Gebühr: <span style="color:#EF444488">-$' + Math.abs(fee).toFixed(4) + '</span></span>'
            + '<span style="font-size:.55rem;color:#6B7A90">Netto: <span style="font-weight:700;color:' + netCol + '">' + (net >= 0 ? '+$' : '-$') + Math.abs(net).toFixed(2) + '</span></span>'
            + '</div>' : '')
            + '</div>';
    }
    var cEl = document.getElementById('bgTradesClosedHtml');
    if (cEl) {
        if (!conn) {
            cEl.innerHTML = '<div style="font-size:.65rem;color:var(--text3);padding:8px 2px;text-align:center">API nicht verbunden · keine Fills</div>';
        } else if (closedFills.length === 0) {
            cEl.innerHTML = '<div style="font-size:.65rem;color:var(--text3);padding:6px 2px">Keine geschlossenen Trades heute</div>';
        } else {
            cEl.innerHTML = closedFills.slice().reverse().map(_fillRow).join('');
        }
    }
    var oEl = document.getElementById('bgTradesOpenHtml');
    if (oEl) {
        if (!conn) {
            oEl.innerHTML = '';
        } else if (openFills.length === 0) {
            oEl.innerHTML = '<div style="font-size:.65rem;color:var(--text3);padding:6px 2px">Keine offenen Positionen</div>';
        } else {
            oEl.innerHTML = openFills.slice().reverse().map(_fillRow).join('');
        }
    }

    // ── Trade-Verlauf (alle Tage) ────────────────────────────────────────────
    var allFills = bg.all_fills || [];
    var histBdg = document.getElementById('bgHistBadge');
    if (histBdg) histBdg.textContent = allFills.length;
    var histEl = document.getElementById('bgAllTradesHtml');
    if (histEl) {
        if (!conn) {
            histEl.innerHTML = '<div style="font-size:.65rem;color:var(--text3);padding:8px 2px;text-align:center">API nicht verbunden</div>';
        } else if (allFills.length === 0) {
            histEl.innerHTML = '<div style="font-size:.65rem;color:var(--text3);padding:8px 2px;text-align:center">Keine Trades gespeichert</div>';
        } else {
            // Gruppieren nach Datum
            var byDate = {};
            allFills.forEach(function(f) {
                var d = f.time || '?';
                if (!byDate[d]) byDate[d] = [];
                byDate[d].push(f);
            });
            var dates = Object.keys(byDate).sort().reverse();
            var html = '';
            dates.forEach(function(d) {
                var dayFills  = byDate[d];
                var dayPnl    = dayFills.reduce(function(s, f) { return s + (f.pnl || 0); }, 0);
                var dayFees   = dayFills.reduce(function(s, f) { return s + (f.fee || 0); }, 0);
                var dayNet    = dayPnl + dayFees;
                var wins      = dayFills.filter(function(f) { return f.pnl > 0; }).length;
                var losses    = dayFills.filter(function(f) { return f.pnl < 0; }).length;
                var closed    = dayFills.filter(function(f) { return f.result !== 'OPEN'; });
                var netCol    = dayNet >= 0 ? '#10B981' : '#EF4444';
                var bruttoCol = dayPnl >= 0 ? '#10B981' : '#EF4444';
                html += '<div style="margin-bottom:4px">'
                    + '<div style="padding:7px 8px;background:rgba(255,255,255,.04);border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,.06)" onclick="(function(el){var n=el.nextElementSibling;n.style.display=n.style.display===\'none\'?\'block\':\'none\';})(this)">'
                    + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
                    + '<span style="font-size:.68rem;font-weight:700;color:#C8D8E8">' + d + '</span>'
                    + '<span style="font-size:.58rem;color:var(--text3)">' + closed.length + ' Trades · ' + wins + 'W ' + losses + 'L</span>'
                    + '<span style="margin-left:auto;font-size:.75rem;font-weight:800;color:' + netCol + '">' + (dayNet >= 0 ? '+$' : '-$') + Math.abs(dayNet).toFixed(2) + ' netto</span>'
                    + '</div>'
                    + '<div style="display:flex;gap:14px">'
                    + '<span style="font-size:.55rem;color:#6B7A90">Brutto: <span style="color:' + bruttoCol + '">' + (dayPnl >= 0 ? '+$' : '-$') + Math.abs(dayPnl).toFixed(2) + '</span></span>'
                    + '<span style="font-size:.55rem;color:#6B7A90">Gebühren: <span style="color:#EF444488">-$' + Math.abs(dayFees).toFixed(2) + '</span></span>'
                    + '</div>'
                    + '</div>'
                    + '<div style="display:none;padding:0 2px;margin-top:2px">' + dayFills.map(_fillRow).join('') + '</div>'
                    + '</div>';
            });
            histEl.innerHTML = html;
        }
    }
}

function startOptimizer() {
    var m = document.getElementById('_optModal');
    if (!m) {
        m = document.createElement('div');
        m.id = '_optModal';
        m.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
        m.onclick = function(e){ if(e.target===m) m.style.display='none'; };
        document.body.appendChild(m);
    }
    var inp = 'background:#131920;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px 10px;color:#F1F5F9;font-size:.82rem;width:130px;text-align:right;-webkit-appearance:none';
    var today = new Date().toISOString().slice(0,10);
    m.innerHTML = '<div style="background:#0E1117;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:22px;width:100%;max-width:390px;max-height:88vh;overflow-y:auto">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">'
        + '<span style="font-weight:700;font-size:.92rem;color:#F1F5F9">⚙ Backtest / Optimizer</span>'
        + '<button onclick="document.getElementById(\'_optModal\').style.display=\'none\'" style="background:none;border:none;color:#8B9BB4;font-size:1.2rem;cursor:pointer;padding:2px 6px">✕</button>'
        + '</div>'
        + _optField('Symbol','<select id="_oSym" style="'+inp+'"><option>XAUUSD</option><option>XAGUSD</option><option>EURUSD</option><option>GBPUSD</option></select>')
        + _optField('Von (Datum)','<input id="_oFrom" type="date" value="2026-01-01" style="'+inp+'">')
        + _optField('Bis (Datum)','<input id="_oTo" type="date" value="'+today+'" style="'+inp+'">')
        + _optField('Start-Kapital ($)','<input id="_oCap" type="number" value="10000" min="1000" step="1000" style="'+inp+'">')
        + _optField('Risiko / Trade (%)','<input id="_oRisk" type="number" value="10" min="1" max="50" step="1" style="'+inp+'">')
        + _optField('Short-Trades erlaubt','<input id="_oShort" type="checkbox" checked style="width:22px;height:22px;accent-color:#10B981;cursor:pointer;margin-right:4px">')
        + '<div style="display:flex;gap:10px;margin-top:20px">'
        + '<button onclick="_runOpt(false)" style="flex:1;background:rgba(99,102,241,.18);border:1px solid rgba(99,102,241,.4);color:#818CF8;font-size:.78rem;font-weight:700;padding:13px;border-radius:10px;cursor:pointer;touch-action:manipulation">▶ Backtest</button>'
        + '<button onclick="_runOpt(true)" style="flex:1;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);color:#F59E0B;font-size:.78rem;font-weight:700;padding:13px;border-radius:10px;cursor:pointer;touch-action:manipulation">🔍 Optimieren</button>'
        + '</div></div>';
    m.style.display = 'flex';
}
function _optField(label, html) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)">'
        + '<span style="color:#8B9BB4;font-size:.8rem">'+label+'</span>'+html+'</div>';
}
async function _runOpt(optimize) {
    var sym   = (document.getElementById('_oSym')||{value:'XAUUSD'}).value;
    var from  = (document.getElementById('_oFrom')||{value:'2026-01-01'}).value;
    var to    = (document.getElementById('_oTo')||{value:''}).value;
    var cap   = parseInt((document.getElementById('_oCap')||{value:'10000'}).value)||10000;
    var risk  = parseFloat((document.getElementById('_oRisk')||{value:'10'}).value)/100;
    var ashort= !!(document.getElementById('_oShort')||{checked:true}).checked;
    document.getElementById('_optModal').style.display = 'none';
    if (optimize) {
        toast('Optimizer gestartet — Ergebnis in ~5 Min. im Dashboard 🔍');
        await dispatch({type:'optimize', params:{min_wr:0.60, min_trades:15}});
    } else {
        toast('Backtest gestartet — Ergebnis in ~2 Min. im Commander 📊');
        await dispatch({type:'backtest', params:{symbol:sym, from_date:from, to_date:to||undefined, initial_cap:cap, risk_pct:risk, allow_short:ashort}});
    }
}

// ── ASSET PICKER ───────────────────────────────────────────────────────────
var _assetCfg = (L && L.all_assets_cfg) ? L.all_assets_cfg : [];
var _pendingAssets = {};  // symbol → true/false (pending changes)

function renderAssetPicker() {
    var grid = document.getElementById('assetGrid');
    var countEl = document.getElementById('activeCount');
    if (!grid) return;
    var assets = (LIVE && LIVE.all_assets_cfg) ? LIVE.all_assets_cfg : _assetCfg;
    if (!assets || !assets.length) { grid.innerHTML = '<div style="color:var(--text2);font-size:.75rem">Keine Assets konfiguriert</div>'; return; }

    var activeCount = assets.filter(function(a) { return a.active; }).length;
    if (countEl) countEl.textContent = activeCount + ' aktiv';

    grid.innerHTML = assets.map(function(a) {
        var pending = _pendingAssets[a.symbol];
        var isActive = (pending !== undefined) ? pending : a.active;
        var borderColor = isActive ? 'rgba(37,99,235,.55)' : 'var(--border)';
        var bgColor = isActive ? 'rgba(37,99,235,.12)' : 'var(--card)';
        var nameColor = isActive ? 'var(--blue-bright)' : 'var(--text2)';
        var badge = isActive ? '<span style="font-size:.55rem;background:rgba(37,99,235,.85);color:#fff;padding:2px 5px;border-radius:4px;font-weight:700">AKTIV</span>' : '<span style="font-size:.55rem;background:rgba(255,255,255,.07);color:var(--text3);padding:2px 5px;border-radius:4px">INAKTIV</span>';
        var spin = (pending !== undefined) ? '<span style="font-size:.65rem;color:var(--text2)"> ⟳</span>' : '';
        return '<button type="button" onclick="toggleAsset(\'' + a.symbol + '\',' + !isActive + ')" style="'
            + 'background:' + bgColor + ';border:1px solid ' + borderColor + ';'
            + 'border-radius:10px;padding:10px 12px;cursor:pointer;text-align:left;'
            + 'touch-action:manipulation;-webkit-appearance:none;width:100%;transition:all .2s">'
            + '<div style="font-size:1.3rem;margin-bottom:3px">' + (a.emoji || '📊') + '</div>'
            + '<div style="font-size:.78rem;font-weight:700;color:' + nameColor + '">' + a.symbol + spin + '</div>'
            + '<div style="font-size:.62rem;color:var(--text2);margin:2px 0">' + (a.name || '') + '</div>'
            + badge
            + '</button>';
    }).join('');
}

async function toggleAsset(symbol, activate) {
    var msgEl = document.getElementById('assetMsg');
    _pendingAssets[symbol] = activate;
    renderAssetPicker();

    var action = activate ? 'aktiviert' : 'deaktiviert';
    if (msgEl) { msgEl.style.display = 'block'; msgEl.textContent = symbol + ' wird ' + action + '...'; }

    try {
        await dispatch({
            type:   'set_asset',
            symbol: symbol,
            active: activate,
            name:   'Asset ' + action + ': ' + symbol,
        });
        if (msgEl) msgEl.textContent = '✓ ' + symbol + ' ' + action + ' — Bot übernimmt beim nächsten Scan';
        // Update local config for immediate UI feedback
        if (LIVE && LIVE.all_assets_cfg) {
            LIVE.all_assets_cfg.forEach(function(a) { if (a.symbol === symbol) a.active = activate; });
        }
        delete _pendingAssets[symbol];
        renderAssetPicker();
    } catch(e) {
        if (msgEl) msgEl.textContent = '⚠️ Fehler: ' + e.message + ' — Token in Commander setzen';
        delete _pendingAssets[symbol];
        renderAssetPicker();
    }
    if (msgEl) setTimeout(function() { msgEl.style.display = 'none'; }, 5000);
}

// ── CHAT ───────────────────────────────────────────────────────────────────
var _chatSha = null;

async function clearChat() {
    if (!confirm('Chat wirklich löschen?\n\nAlle Nachrichten werden unwiderruflich gelöscht — auch auf GitHub.')) return;
    var st = document.getElementById('syncStatus');
    if (st) st.textContent = '⏳ Lösche…';
    try { localStorage.removeItem('gb_chat'); } catch(e) {}
    hist = [];
    _chatSha = null;
    var box = document.getElementById('chatBox');
    if (box) box.innerHTML = '';
    if (ghTok() && GHUSER && GHREPO) {
        try {
            var rGet = await fetch(
                'https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat_v2.json',
                {headers:{Authorization:'Bearer '+ghTok(),'User-Agent':'gold-bot'}}
            );
            var sha = null;
            if (rGet.ok) { sha = (await rGet.json()).sha; }
            var body = {message:'Clear chat', content: btoa('[]')};
            if (sha) body.sha = sha;
            var rPut = await fetch(
                'https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat_v2.json',
                {method:'PUT', headers:{Authorization:'Bearer '+ghTok(),'Content-Type':'application/json','User-Agent':'gold-bot'}, body:JSON.stringify(body)}
            );
            if (rPut.ok) { _chatSha = (await rPut.json()).content.sha; }
            if (st) st.textContent = 'Chat gelöscht ✓';
        } catch(e) {
            if (st) st.textContent = 'Gelöscht (lokal)';
        }
    } else {
        if (st) st.textContent = 'Gelöscht (lokal)';
    }
    welcome();
}

async function syncChat() {
    if (!ghTok() || !GHUSER || !GHREPO) return;
    try {
        const r = await fetch(
            'https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat_v2.json',
            {headers:{Authorization:'Bearer '+ghTok(),'User-Agent':'gold-bot','Cache-Control':'no-cache'}}
        );
        if (r.status === 404) return;
        if (!r.ok) return;
        const m = await r.json();
        _chatSha = m.sha;
        let remote; try { remote = JSON.parse(_b64dec(m.content)); } catch(e) { return; }
        // GitHub ist leer (Chat wurde geleert) aber lokal noch alte Nachrichten → sofort aufräumen
        var localNonAuto = hist.filter(function(h){return !h.auto;});
        if (remote.length === 0 && localNonAuto.length > 0) {
            hist = hist.filter(function(h){return h.auto;});
            try { localStorage.removeItem('gb_chat'); } catch(e) {}
            var box2 = document.getElementById('chatBox');
            if (box2) box2.innerHTML = '';
            welcome();
            return;
        }
        const knownTs = new Set(hist.map(function(h){return h.ts;}));
        const newMsgs = remote.filter(function(msg){return !msg.auto && !knownTs.has(msg.ts);});
        if (newMsgs.length > 0) {
            newMsgs.sort(function(a,b){return a.ts-b.ts;});
            const box = document.getElementById('chatBox');
            if (box && hist.length > 0) {
                const sep = document.createElement('div');
                sep.style.cssText = 'text-align:center;font-size:.6rem;color:var(--text3);padding:6px 0;border-top:1px dashed var(--border);margin-top:4px';
                sep.textContent = '— ' + newMsgs.length + ' neue Nachricht(en) —';
                box.appendChild(sep);
            }
            var fromOthers = 0;
            newMsgs.forEach(function(msg){
                hist.push(msg);
                renderMsg(msg.role, msg.content, msg.ts, msg.author);
                if (msg.author !== ME) {
                    fromOthers++;
                    // Browser-Benachrichtigung wenn Tab im Hintergrund
                    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
                        new Notification('A2A · ' + (msg.author||'Commander'), {
                            body: (msg.content||'').slice(0, 100),
                            icon: './icon-192.png', tag: 'a2a-chat', renotify: true
                        });
                    }
                }
            });
            // Badge auf Chat-Tab zeigen wenn Nachrichten von anderen kamen
            if (fromOthers > 0) {
                var chatBtn = document.querySelector('[data-tab="chat"]');
                var isOnChat = chatBtn && chatBtn.classList.contains('show');
                if (!isOnChat) {
                    var badge = document.getElementById('chatBadge');
                    if (badge) {
                        var cur = parseInt(badge.textContent) || 0;
                        badge.textContent = cur + fromOthers;
                        badge.style.display = 'flex';
                    }
                }
            }
            // SW über neuen Timestamp informieren
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                var maxTs = Math.max.apply(null, newMsgs.map(function(m){ return m.ts; }));
                navigator.serviceWorker.controller.postMessage({ type: 'UPDATE_TS', ts: maxTs });
            }
            // Lokal speichern
            try {
                var toSave = hist.filter(function(m){ return !m.auto; }).slice(-60);
                localStorage.setItem('gb_chat', JSON.stringify(toSave));
            } catch(e) {}
        }
    } catch(e) { console.warn('syncChat:', e); }
}

async function pushChatMsg(entry) {
    if (!ghTok() || !GHUSER || !GHREPO) return;
    for (var attempt=0; attempt<3; attempt++) {
        try {
            var rGet = await fetch(
                'https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat_v2.json',
                {headers:{Authorization:'Bearer '+ghTok(),'User-Agent':'gold-bot'}}
            );
            var messages = [], sha = null;
            if (rGet.ok) {
                var mf = await rGet.json();
                sha = mf.sha; _chatSha = sha;
                try { messages = JSON.parse(_b64dec(mf.content)); } catch(e) { messages = []; }
            }
            messages.push(entry);
            messages = messages.slice(-300);
            var body = {message:'Chat update', content:btoa(unescape(encodeURIComponent(JSON.stringify(messages))))};
            if (sha) body.sha = sha;
            var rPut = await fetch(
                'https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat_v2.json',
                {method:'PUT', headers:{Authorization:'Bearer '+ghTok(),'Content-Type':'application/json','User-Agent':'gold-bot'}, body:JSON.stringify(body)}
            );
            if (rPut.status===409) { await new Promise(function(r){setTimeout(r,800+Math.random()*400);}); continue; }
            if (rPut.ok) { _chatSha = (await rPut.json()).content.sha; break; }
            break;
        } catch(e) { break; }
    }
}

function _hasMojibake(msgs) {
    // Mojibake-Erkennung: "Ã" ist das Latin-1-Zeichen für 0xC3 (erstes Byte aller deutschen Umlaute + Emojis in UTF-8)
    return msgs.some(function(m) { return (m.content||'').indexOf('Ã') !== -1; });
}

function initChat() {
    document.querySelectorAll('.pb-btn').forEach(b => b.classList.toggle('active', b.textContent.includes(ME)));
    // Version-based force-clear: increment _CHAT_VER to wipe all browsers' localStorage chat
    var _CHAT_VER = '8';
    try {
        if (localStorage.getItem('gb_chat_ver') !== _CHAT_VER) {
            localStorage.removeItem('gb_chat');
            localStorage.setItem('gb_chat_ver', _CHAT_VER);
        }
    } catch(e) {}
    // Load saved conversation (never includes auto-generated welcome messages)
    var saved = (function() {
        try { return JSON.parse(localStorage.getItem('gb_chat') || '[]').filter(function(m){ return !m.auto; }); }
        catch(e) { return []; }
    })();
    // Mojibake-Check: kaputte Nachrichten → localStorage lautlos löschen
    if (_hasMojibake(saved)) {
        try { localStorage.removeItem('gb_chat'); } catch(e) {}
        saved = [];
    }
    hist = saved.slice(); // seed history with saved
    // With column-reverse: last in DOM = visually at top.
    // Render saved messages first (oldest → bottom), then welcome last (→ top).
    // Skip welcome when there are saved messages so it doesn't confuse the timeline.
    saved.forEach(function(m) { renderMsg(m.role, m.content, m.ts, m.author); });
    if (saved.length === 0) { welcome(); }
    // Sync mit GitHub: neue Nachrichten holen (DOM bleibt — kein Flash)
    setTimeout(function(){
        var st = document.getElementById('syncStatus');
        if (st) st.textContent = '⏳ Syncing…';
        uploadLocalHistory(saved).then(function(){
            return syncChat();
        }).then(function(){
            if (st) st.textContent = 'Sync ' + new Date().toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit'});
        });
    }, 1500);
}

async function manualSync() {
    const st = document.getElementById('syncStatus');
    if (st) st.textContent = '⏳ Lade hoch…';
    const saved = (function(){ try{return JSON.parse(localStorage.getItem('gb_chat')||'[]').filter(function(m){return !m.auto;});}catch(e){return [];} })();
    if (saved.length) await uploadLocalHistory(saved);
    // Full reload: clear DOM + hist so syncChat fetches everything from GitHub fresh
    const box = document.getElementById('chatBox');
    if (box) box.innerHTML = '';
    hist = [];
    if (st) st.textContent = '⏳ Sync läuft…';
    await syncChat();
    const n = box ? box.querySelectorAll('.msg').length : 0;
    if (st) st.textContent = '✓ ' + n + ' Msgs · ' + new Date().toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit'});
}

async function uploadLocalHistory(localMsgs) {
    if (!ghTok() || !GHUSER || !GHREPO || !localMsgs.length) return;
    try {
        var rGet = await fetch(
            'https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat_v2.json',
            {headers:{Authorization:'Bearer '+ghTok(),'User-Agent':'gold-bot'}}
        );
        var remote = [], sha = null;
        if (rGet.ok) {
            var mf = await rGet.json(); sha = mf.sha;
            try { remote = JSON.parse(_b64dec(mf.content)); } catch(e) { remote = []; }
        }
        // Chat wurde gezielt geleert (leer auf GitHub) — lokale alte Nachrichten NICHT re-uploaden
        if (rGet.ok && remote.length === 0) return;
        // Merge: keep all unique messages by timestamp
        var byTs = {};
        remote.forEach(function(m){ byTs[m.ts]=m; });
        localMsgs.forEach(function(m){ if(!byTs[m.ts]) byTs[m.ts]=m; });
        var merged = Object.values(byTs).sort(function(a,b){return a.ts-b.ts;}).slice(-300);
        if (merged.length === remote.length) return; // nothing new
        var body = {message:'Upload local history ('+ME+')', content:btoa(unescape(encodeURIComponent(JSON.stringify(merged))))};
        if (sha) body.sha = sha;
        var rPut = await fetch(
            'https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat_v2.json',
            {method:'PUT', headers:{Authorization:'Bearer '+ghTok(),'Content-Type':'application/json','User-Agent':'gold-bot'}, body:JSON.stringify(body)}
        );
        if (rPut.ok) console.log('Local history uploaded to GitHub ✓');
    } catch(e) { console.warn('uploadLocalHistory:', e); }
}

function welcome() {
    const d=L;
    const wr=d.wr?d.wr.toFixed(1)+'%':'–', pf=d.pf?d.pf.toFixed(2):'–';
    const dd=d.max_dd?d.max_dd.toFixed(1)+'%':'–', pnl=d.net_pnl?(d.net_pnl>0?'+':'')+d.net_pnl.toFixed(0)+'$':'–';
    // auto:true marks this as a generated status message — not saved to localStorage
    addMsg('assistant',`**Gold Bot Commander** bereit ⚡

📊 System-Status:
• Win Rate: **${wr}** | Profit Factor: **${pf}**
• Max DD: **${dd}** | Net PnL: **${pnl}**
• Gold-Bias: **${(d.gold_bias||'neutral').toUpperCase()}** | DXY: ${d.dxy||'–'}
• Macro: ${d.macro_blocked?'🔴 BLOCKIERT':'✅ Trading frei'}

Wie kann ich helfen? Ich kann Agenten starten, Strategien analysieren und Befehle an den Bot senden.`, true);
}

function sysPrompt() {
    const d=L;
    return `Du bist der A2A Systems Commander — ein KI-Assistent von Anthropic (Claude), eingebettet in ein automatisiertes Trading-System.

WICHTIG: Du bist Claude von Anthropic. Identifiziere dich NIEMALS als ChatGPT oder ein anderes Modell.

WICHTIG: Du KANNST echte Bot-Befehle senden! Die dispatch-Funktion schreibt Befehle in die GitHub state.json. Der Chief Agent läuft auf dem Server, prüft alle 2 Minuten neue Befehle und führt sie aus. Sage dem User NICHT dass du keine echten Befehle senden kannst — das stimmt nicht.

Live-Daten:
- Win Rate: ${d.wr||'–'}% | Profit Factor: ${d.pf||'–'} | Max DD: ${d.max_dd||'–'}%
- Trades: ${d.trades||0} | PnL: ${d.net_pnl||0}$ | Gold: $${d.price||'–'}
- Signale: ${d.n_signals||0} | Gold-Bias: ${(d.gold_bias||'neutral').toUpperCase()}
- DXY: ${d.dxy||'–'} | US10Y: ${d.tnx||'–'}% | Macro: ${d.macro_blocked?'BLOCKIERT':'Frei'}
- Top-Strategie: WR ${d.best_wr||'–'}% | ${d.candidates||0} Kandidaten

Bot-Befehle (JSON in <dispatch>...</dispatch>):

Backtest mit Parametern:
{"type":"run_agent","name":"backtester_agent","task":{"symbol":"XAUUSD","initial_cap":10000,"risk_pct":0.10,"allow_short":true,"from_date":"2026-01-01"}}

Parameter:
- initial_cap: Startkapital USD (z.B. 10000, 50000, 100000)
- risk_pct: Risiko/Trade als Dezimal (0.02=2%, 0.05=5%, 0.10=10%)
- allow_short: true=Long+Short, false=nur Long
- from_date: "2026-01-01" oder "2026" fuer Jahr
- to_date: Enddatum optional

Weitere Agenten:
{"type":"run_agent","name":"optimizer_agent"}
{"type":"run_agent","name":"signal_agent"}
{"type":"run_agent","name":"polymarket_agent"}

Variante aktivieren fuer vollautomatisches Live-Trading:
{"type":"set_active_variant","variant_id":"<ID>","variant_name":"<Name>","risk_pct":0.10}

Wichtig: variant_id und variant_name aus der Dashboard-Strategienliste verwenden (z.B. id="20260525_122104", name="Variante 2 — 25.05.2026"). risk_pct=0.10 = 10% Risiko/Trade. Wenn User sagt "aktiviere Variante 2" oder "nimm Variante 2" → sofort dispatchen ohne Rueckfrage.

WICHTIG: Wenn der User Backtest-Parameter nennt (Kapital, Risiko, Long/Short, Zeitraum), extrahiere sie sofort und sende den dispatch-Befehl ohne Rueckfrage.

Ergebnisse erscheinen in ~2 Min. im Dashboard. Antworte kurz auf Deutsch.`;
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
    box.appendChild(d); box.scrollTop = 0;
}

function addMsg(role, text, auto) {
    const ts=Date.now(), author=role==='user'?ME:'Commander';
    const entry = {role, content:text, ts, author};
    if (auto) entry.auto = true;
    hist.push(entry);
    renderMsg(role,text,ts,author);
    // Don't save auto-generated status messages — only real conversation
    if (!auto) {
        try {
            const toSave = hist.filter(function(m){ return !m.auto; }).slice(-60);
            localStorage.setItem('gb_chat', JSON.stringify(toSave));
        } catch(e) { console.warn('localStorage nicht verfügbar:', e); }
        // Push to GitHub so other users (Andreas, Johannes) see this message
        pushChatMsg(entry);
    }
}

function showTyping() {
    const box=document.getElementById('chatBox');
    if(!box) return;
    const d=document.createElement('div'); d.className='msg assistant'; d.id='typer';
    d.innerHTML='<div class="t-bubble"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>';
    box.appendChild(d); box.scrollTop=0;
}
function hideTyping() { var e=document.getElementById('typer'); if(e) e.remove(); }

async function sendMsg() {
    if (busy) return;
    const inp=document.getElementById('chatInput');
    const txt=inp.value.trim(); if(!txt) return;
    inp.value=''; inp.style.height='40px';
    addMsg('user',txt);
    if (!apiKey) { addMsg('assistant','⚠️ Kein API Key konfiguriert.'); return; }
    busy=true; document.getElementById('sendBtn').disabled=true; const _pSend=document.getElementById('polySendBtn'); if(_pSend)_pSend.disabled=true; showTyping();
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
        busy=false; document.getElementById('sendBtn').disabled=false; const _pS2=document.getElementById('polySendBtn'); if(_pS2)_pS2.disabled=false;
    }
}

function onKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}}

// ── POLY SCOUT (removed) ──────────────────────────────────────────────────
var polyHist = [], polyBusy = false; // stubs kept to avoid reference errors

function polySystemPrompt() {
    var d = L;
    var poly = d.polymarket || {};
    var opps = poly.opportunities || [];
    var orders = poly.all_orders || [];
    var top = poly.top_opportunity;
    return 'Du bist der A2A Poly Scout — ein spezialisierter KI-Assistent fuer Prediction Markets auf Polymarket.\n\n' +
        'WICHTIG: Du bist Claude von Anthropic. Spezialisiert auf Marktanalyse, Wahrscheinlichkeiten und Edge-Berechnungen.\n\n' +
        'Aktuelle Polymarket-Daten:\n' +
        '- Gescannte Maerkte: ' + (poly.markets_scanned || 0) + '\n' +
        '- Opportunities mit Edge: ' + opps.length + '\n' +
        '- Offene Orders: ' + orders.length + '\n' +
        '- Modus: ' + (poly.dry_run !== false ? 'PAPER TRADING' : 'LIVE') + '\n' +
        (top ? '- Top Opportunity: ' + (top.edge*100).toFixed(1) + '% Edge | ' + top.question + '\n' : '') +
        '\nBot-Befehle (JSON in <dispatch>...</dispatch>):\n\n' +
        'Markt-Scan starten:\n{"type":"run_agent","name":"polymarket_agent"}\n\n' +
        'Paper-Order platzieren:\n{"type":"run_agent","name":"polymarket_agent","task":{"force_order":true}}\n\n' +
        'WICHTIG: Wenn der User eine Marktfrage analysieren oder eine Order platzieren will, extrahiere den Befehl und sende ihn.\n' +
        'Ergebnisse erscheinen in ~2 Min. Antworte kurz auf Deutsch.\n' +
        'Erklaere Edges, Wahrscheinlichkeiten und Risiken klar und direkt.';
}

function polyWelcome() {
    var poly = L.polymarket || {};
    var opps = poly.opportunities || [];
    var top = poly.top_opportunity;
    var txt = '**Poly Scout** bereit ⬡\n\n' +
        '📊 Polymarket-Status:\n' +
        '• Gescannte Märkte: **' + (poly.markets_scanned || 0) + '**\n' +
        '• Opportunities: **' + opps.length + '** mit Edge ≥5%\n' +
        '• Modus: **' + (poly.dry_run !== false ? 'PAPER' : 'LIVE') + '**\n';
    if (top) txt += '• Top Edge: **' + (top.edge*100).toFixed(1) + '%** — ' + (top.question||'').slice(0,60) + '\n';
    txt += '\nIch analysiere Märkte, berechne Edges und platziere Paper-Orders.\nWas soll ich untersuchen?';
    polyAddMsg('assistant', txt, true);
}

function polyAddMsg(role, text, auto) {
    var ts = Date.now(), author = role === 'user' ? ME : 'Poly Scout';
    var entry = { role: role, content: text, ts: ts, author: author };
    if (auto) entry.auto = true;
    polyHist.push(entry);
    polyRenderMsg(role, text, ts, author);
    if (!auto) {
        try {
            var toSave = polyHist.filter(function(m){ return !m.auto; }).slice(-40);
            localStorage.setItem('gb_poly_chat', JSON.stringify(toSave));
        } catch(e) {}
    }
}

function polyRenderMsg(role, text, ts, author) {
    var box = document.getElementById('polyChatBox');
    if (!box) return;
    var d = document.createElement('div');
    d.className = 'msg ' + role;
    var who = author || (role === 'user' ? ME : 'Poly Scout');
    var md = text
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
        .replace(/`([^`]+)`/g,'<code style="background:rgba(255,255,255,.08);padding:1px 5px;border-radius:3px;font-size:.78rem">$1</code>')
        .replace(/\n/g,'<br>');
    d.innerHTML = '<div class="bubble">' + md + '</div><div class="msg-meta">' + esc(who) + ' · ' + fmt(ts) + '</div>';
    box.appendChild(d);
    box.scrollTop = 0;
}

function polyShowTyping() {
    var box = document.getElementById('polyChatBox');
    if (!box) return;
    var d = document.createElement('div');
    d.className = 'msg assistant'; d.id = 'polyTyper';
    d.innerHTML = '<div class="t-bubble"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>';
    box.appendChild(d); box.scrollTop = 0;
}
function polyHideTyping() { var e = document.getElementById('polyTyper'); if (e) e.remove(); }

function initPolyChat() {
    var box = document.getElementById('polyChatBox');
    if (!box || box._ready) return;
    box._ready = true;
    // Version-based force-clear
    var _POLY_VER = '2';
    try {
        if (localStorage.getItem('gb_poly_ver') !== _POLY_VER) {
            localStorage.removeItem('gb_poly_chat');
            localStorage.setItem('gb_poly_ver', _POLY_VER);
        }
    } catch(e) {}
    var saved = (function() {
        try { return JSON.parse(localStorage.getItem('gb_poly_chat') || '[]').filter(function(m){ return !m.auto; }); }
        catch(e) { return []; }
    })();
    polyHist = saved.slice();
    // column-reverse: render saved first (→ bottom), welcome last (→ top). Skip welcome if history exists.
    saved.forEach(function(m) { polyRenderMsg(m.role, m.content, m.ts, m.author); });
    if (saved.length === 0) { polyWelcome(); }
}

async function sendPolyMsg() {
    if (polyBusy) return;
    var inp = document.getElementById('polyChatInput');
    var txt = inp.value.trim(); if (!txt) return;
    inp.value = ''; inp.style.height = '40px';
    polyAddMsg('user', txt);
    if (!apiKey) { polyAddMsg('assistant', '⚠️ Kein API Key konfiguriert.'); return; }
    polyBusy = true;
    var sendBtn = document.getElementById('polySendBtn');
    if (sendBtn) sendBtn.disabled = true;
    polyShowTyping();
    try {
        var msgs = polyHist.slice(0,-1).map(function(m){ return {role: m.role==='user'?'user':'assistant', content: m.content}; });
        msgs.push({role:'user', content:txt});
        var res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
            body: JSON.stringify({model:'claude-sonnet-4-6', max_tokens:1024, system:polySystemPrompt(), messages:msgs})
        });
        if (!res.ok) { var er = await res.json(); throw new Error(er.error?.message||'API Fehler'); }
        var data = await res.json();
        var raw = data.content[0].text;
        var dm = raw.match(/<dispatch>([\s\S]*?)<\/dispatch>/);
        var clean = raw.replace(/<dispatch>[\s\S]*?<\/dispatch>/g,'').trim();
        polyHideTyping(); polyAddMsg('assistant', clean);
        if (dm) { try { var cmd=JSON.parse(dm[1]); cmd.id=Date.now().toString(); await dispatch(cmd); } catch(e) { polyAddMsg('assistant','⚠️ Dispatch-Fehler: '+e.message); } }
    } catch(err) {
        polyHideTyping(); polyAddMsg('assistant', '❌ **Fehler:** ' + err.message);
    } finally {
        polyBusy = false;
        if (sendBtn) sendBtn.disabled = false;
    }
}

function onPolyKey(e){}
function initPolyChat(){}
function sendPolyMsg(){}
function autoGrow(el){el.style.height='40px';el.style.height=Math.min(el.scrollHeight,110)+'px';}

// ── BOT CONTROL ────────────────────────────────────────────────────────────
var _botStateSha = null;

async function pollTopStep() {
    if (!ghTok() || !GHUSER || !GHREPO) return;
    try {
        const r = await fetch(
            'https://api.github.com/repos/' + GHUSER + '/' + GHREPO + '/contents/topstep.json',
            { headers: { 'Authorization': 'Bearer ' + ghTok() }, cache: 'no-store' }
        );
        if (!r.ok) return;
        const d   = await r.json();
        const tsx = JSON.parse(atob(d.content.replace(/\n/g, '')));
        if (!tsx.status || tsx.status !== 'ok') return;

        var panel = document.getElementById('tsxPanel');
        if (panel && panel.style.display === 'none') panel.style.display = 'block';

        var pnl   = tsx.daily_pnl || 0;
        var dd    = tsx.drawdown_pct || 0;
        var tr    = tsx.day_trades || 0;
        var wr    = tsx.day_wr || 0;
        var floor = tsx.floor_active;
        var bal   = tsx.balance || 50000;

        var DAILY_GOAL = 600;
        var pnlEl = document.getElementById('tsxPnl');
        if (pnlEl) {
            pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(0) + '$';
            pnlEl.style.color = pnl >= DAILY_GOAL ? '#10B981' : pnl >= 0 ? '#F59E0B' : '#EF4444';
        }
        var pnlSub = document.getElementById('tsxPnlSub');
        if (pnlSub) pnlSub.textContent = floor ? '🔒 Floor aktiv' : Math.round(Math.max(0, pnl) / DAILY_GOAL * 100) + '% von $600';

        var ddEl = document.getElementById('tsxDD');
        if (ddEl) {
            ddEl.textContent = dd.toFixed(1) + '%';
            ddEl.style.color = dd > 60 ? '#EF4444' : dd > 40 ? '#F59E0B' : '#10B981';
        }
        var ddMax = document.getElementById('tsxDDMax');
        if (ddMax) ddMax.textContent = 'Bal: $' + bal.toLocaleString('de-AT', {maximumFractionDigits:0});

        var wrValEl = document.getElementById('tsxWinRate');
        if (wrValEl) {
            wrValEl.textContent = tr > 0 ? wr + '%' : '—';
            wrValEl.style.color = wr >= 60 ? '#10B981' : wr >= 40 ? '#F59E0B' : (tr > 0 ? '#EF4444' : 'var(--text1)');
        }
        var trSubEl = document.getElementById('tsxTrades');
        if (trSubEl) trSubEl.textContent = tr + (tr === 1 ? ' Trade' : ' Trades') + (tsx.day_wins !== undefined ? ' (' + tsx.day_wins + 'W/' + tsx.day_losses + 'L)' : '');

        var rrEl = document.getElementById('tsxRR');
        var rr = tsx.day_rr || 0;
        if (rrEl) {
            rrEl.textContent = rr > 0 ? rr.toFixed(2) : '—';
            rrEl.style.color = rr >= 1.5 ? '#10B981' : rr > 0 ? '#F59E0B' : 'var(--text1)';
        }
        var rrSub = document.getElementById('tsxRRSub');
        if (rrSub) {
            var avgWin = tsx.avg_win || 0, avgLoss = tsx.avg_loss || 0;
            rrSub.textContent = (avgWin > 0 || avgLoss > 0) ? '+$' + avgWin.toFixed(0) + ' / -$' + avgLoss.toFixed(0) : 'Ø Win / Loss';
        }

        var flEl = document.getElementById('tsxFloor');
        if (flEl) {
            if (floor) {
                flEl.style.display = 'block';
                flEl.style.background = 'rgba(16,185,129,.15)';
                flEl.style.color = '#10B981';
                flEl.textContent = 'Profit Floor aktiv — Max Risiko: ' + (tsx.max_risk_now || 0).toFixed(0) + '$';
            } else {
                flEl.style.display = 'none';
            }
        }
        var posEl = document.getElementById('tsxPositions');
        if (posEl) {
            var pos = tsx.open_positions || [];
            if (pos.length) {
                posEl.innerHTML = pos.map(function(p) {
                    var col = p.pnl >= 0 ? '#10B981' : '#EF4444';
                    return '<span style="color:var(--text3)">' + p.symbol + '</span> ' +
                           p.direction + ' ' + p.size + 'x &nbsp; ' +
                           '<span style="color:' + col + '">' + (p.pnl >= 0 ? '+' : '') + p.pnl.toFixed(0) + '$</span>';
                }).join('&nbsp;&nbsp;·&nbsp;&nbsp;');
            } else {
                posEl.textContent = 'Keine offenen Positionen';
            }
        }

        // Chart und Monatstabelle mit TopStepX-History überschreiben wenn Daten vorhanden
        var hist = tsx.daily_history || [];
        if (hist.length >= 1) {
            _tsxDataAvailable = true; // Backtest-Rendering ab jetzt permanent unterdrücken
            _drawTsxChart(hist, tsx);
            _renderTsxMonthly(hist);
        }

        // Dedicated TopStepX panel updaten
        _refreshTsx2Panel(tsx);
    } catch(e) {}
}

function _drawTsxChart(hist, tsx) {
    var canvas = document.getElementById('pnlChart');
    if (!canvas) return;
    // Kapitalkurve aus daily_history + heutigem Stand
    var pts = [];
    var startBal = hist.length > 0 ? (hist[0].balance - hist[0].pnl) : (tsx.balance || 50000);
    pts.push(startBal);
    for (var i = 0; i < hist.length; i++) {
        pts.push(hist[i].balance);
    }
    if (pts.length < 2) {
        // Nur 1 Datenpunkt: heute mit aktuellem Stand anzeigen
        pts = [tsx.balance - tsx.daily_pnl, tsx.balance];
    }
    // Benutze drawChart-Logik direkt über synthetisches Objekt
    // Startpunkt immer als ersten Eintrag einfügen → monthly hat mindestens 2 Punkte
    // → drawChart nutzt den korrekten monthly-Pfad statt den Simulations-Fallback
    var fakeMonthly = [{cap: pts[0]}].concat(hist.map(function(h) { return { cap: h.balance }; }));
    var fakeD = {
        _tsx: true, // Markierung: dieser Aufruf kommt von TopStepX (nicht Backtest-Unterdrückung)
        monthly: fakeMonthly,
        start_cap: pts[0],
        end_cap: pts[pts.length - 1],
        trades: hist.reduce(function(s, h) { return s + h.trades; }, 0),
        wr: hist.length > 0 ? (hist.reduce(function(s, h) { return s + h.wr; }, 0) / hist.length) : 0,
        from_date: hist.length > 0 ? hist[0].date : new Date().toISOString().slice(0, 10),
        to_date:   hist.length > 0 ? hist[hist.length - 1].date : new Date().toISOString().slice(0, 10),
    };
    _setEl('chartTitle', 'TopStepX — Kapitalkurve');
    drawChart(fakeD);
    var fromEl = document.getElementById('chartFrom');
    if (fromEl) fromEl.textContent = fakeD.from_date.slice(0, 10);
}

var _activeChartMode = 'tsx'; // 'tsx' | 'bg'

function switchChart(mode) {
    _activeChartMode = mode;
    var btnTsx = document.getElementById('btnChartTsx');
    var btnBg  = document.getElementById('btnChartBg');
    if (btnTsx) { btnTsx.style.background = mode === 'tsx' ? 'rgba(37,99,235,.35)' : 'rgba(37,99,235,.18)'; btnTsx.style.borderColor = mode === 'tsx' ? 'rgba(37,99,235,.7)' : 'rgba(37,99,235,.4)'; }
    if (btnBg)  { btnBg.style.background  = mode === 'bg'  ? 'rgba(245,158,11,.22)' : 'rgba(245,158,11,.08)'; btnBg.style.borderColor  = mode === 'bg'  ? 'rgba(245,158,11,.6)'  : 'rgba(245,158,11,.3)'; }
    if (typeof LIVE === 'undefined') return;
    if (mode === 'tsx') {
        var tsxH = (LIVE.tsx && LIVE.tsx.daily_history) ? LIVE.tsx.daily_history : [];
        if (tsxH.length > 0) { _drawTsxChart(tsxH, LIVE.tsx); }
    } else {
        var bgH = (LIVE.bitget && LIVE.bitget.daily_history) ? LIVE.bitget.daily_history : [];
        _drawBitgetChart(bgH, LIVE.bitget || {});
    }
}

function _drawBitgetChart(hist, bg) {
    var canvas = document.getElementById('pnlChart');
    if (!canvas) return;
    var pts = [];
    var startBal = bg.start_balance || 0;
    if (hist.length > 0) {
        if (startBal <= 0) startBal = hist[0].balance - (hist[0].pnl || 0);
        pts.push(startBal);
        for (var i = 0; i < hist.length; i++) { pts.push(hist[i].balance); }
    } else if (bg.balance > 0) {
        var cur = bg.balance;
        var pnlT = bg.realized_pnl_today || 0;
        pts = [cur - pnlT, cur];
    }
    if (pts.length < 2) {
        _setEl('chartTitle', 'Bitget — Kapitalkurve');
        return;
    }
    var fakeMonthly = [{cap: pts[0]}].concat(
        hist.length > 0 ? hist.map(function(h) { return { cap: h.balance }; }) : [{cap: pts[pts.length-1]}]
    );
    var fakeD = {
        _tsx: true,
        monthly:    fakeMonthly,
        start_cap:  pts[0],
        end_cap:    pts[pts.length - 1],
        trades:     hist.reduce(function(s, h) { return s + (h.trades || 0); }, 0),
        wr:         0,
        from_date:  hist.length > 0 ? hist[0].date : new Date().toISOString().slice(0, 10),
        to_date:    hist.length > 0 ? hist[hist.length - 1].date : new Date().toISOString().slice(0, 10),
    };
    _setEl('chartTitle', 'Bitget — Kapitalkurve');
    drawChart(fakeD);
    var fromEl = document.getElementById('chartFrom');
    if (fromEl) fromEl.textContent = fakeD.from_date.slice(0, 10);
    var changeEl = document.getElementById('chartChange');
    if (changeEl) {
        var chg = pts[pts.length-1] - pts[0];
        changeEl.textContent = (chg >= 0 ? '+$' : '-$') + Math.abs(chg).toFixed(2);
        changeEl.style.color = chg >= 0 ? '#10B981' : '#EF4444';
    }
}

// ── PANEL EQUITY CHARTS ───────────────────────────────────────────────────────
function _drawPanelChart(canvasId, pts, opts) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || pts.length < 2) return;
    opts = opts || {};
    var dpr = window.devicePixelRatio || 1;
    var W   = canvas.offsetWidth || canvas.parentElement.offsetWidth || 300;
    var H   = 130;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    var pad  = 6;
    var minV = Math.min.apply(null, pts);
    var maxV = Math.max.apply(null, pts);
    var range = (maxV - minV) || (Math.abs(pts[0]) * 0.01) || 1;
    var xFn  = function(i) { return pad + (i / (pts.length - 1)) * (W - pad * 2); };
    var yFn  = function(v) { return H - pad - ((v - minV) / range) * (H - pad * 2); };

    var isUp = pts[pts.length - 1] >= pts[0];
    var rgb  = isUp ? '16,185,129' : '239,68,68';
    var col  = isUp ? '#10B981' : '#EF4444';

    // Gradient fill
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(' + rgb + ',.22)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.beginPath();
    ctx.moveTo(xFn(0), yFn(pts[0]));
    for (var i = 1; i < pts.length; i++) ctx.lineTo(xFn(i), yFn(pts[i]));
    ctx.lineTo(xFn(pts.length - 1), H);
    ctx.lineTo(xFn(0), H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Baseline
    ctx.beginPath();
    ctx.moveTo(pad, yFn(pts[0]));
    ctx.lineTo(W - pad, yFn(pts[0]));
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Line
    ctx.beginPath();
    ctx.moveTo(xFn(0), yFn(pts[0]));
    for (var i = 1; i < pts.length; i++) ctx.lineTo(xFn(i), yFn(pts[i]));
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.lineJoin  = 'round';
    ctx.stroke();

    // End dot
    ctx.beginPath();
    ctx.arc(xFn(pts.length - 1), yFn(pts[pts.length - 1]), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();

    // Change label
    var chgEl = opts.changeId ? document.getElementById(opts.changeId) : null;
    if (chgEl) {
        var chg = pts[pts.length - 1] - pts[0];
        var pct = pts[0] > 0 ? (chg / pts[0] * 100) : 0;
        chgEl.textContent = (chg >= 0 ? '+$' : '-$') + Math.abs(chg).toFixed(2) + ' (' + (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%)';
        chgEl.style.color = isUp ? '#10B981' : '#EF4444';
    }
    // From label
    var fromEl2 = opts.fromId ? document.getElementById(opts.fromId) : null;
    if (fromEl2 && opts.fromDate) fromEl2.textContent = opts.fromDate;
}

function _updateBgChart() {
    if (typeof LIVE === 'undefined') return;
    var bg   = LIVE.bitget || {};
    var hist = bg.daily_history || [];
    var pts  = [];
    if (hist.length > 0) {
        var s = bg.start_balance > 0 ? bg.start_balance : (hist[0].balance - (hist[0].pnl || 0));
        pts.push(s);
        hist.forEach(function(h) { pts.push(h.balance); });
    } else if (bg.balance > 0) {
        var pnlT = bg.realized_pnl_today || 0;
        pts = [bg.balance - pnlT, bg.balance];
    }
    if (pts.length < 2) return;
    _drawPanelChart('bgChart', pts, {
        changeId: 'bgChartChange',
        fromId:   'bgChartFrom',
        fromDate: hist.length > 0 ? hist[0].date : ''
    });
}

function _updateTsx2Chart() {
    if (typeof LIVE === 'undefined') return;
    var tsx  = LIVE.tsx || {};
    var hist = tsx.daily_history || [];
    var pts  = [];
    if (hist.length > 0) {
        var s = hist[0].balance - (hist[0].pnl || 0);
        pts.push(s);
        hist.forEach(function(h) { pts.push(h.balance); });
    } else if (tsx.balance > 0) {
        var pnlT = tsx.daily_pnl || 0;
        pts = [tsx.balance - pnlT, tsx.balance];
    }
    if (pts.length < 2) return;
    _drawPanelChart('tsx2Chart', pts, {
        changeId: 'tsx2ChartChange',
        fromId:   'tsx2ChartFrom',
        fromDate: hist.length > 0 ? hist[0].date : ''
    });
}

function _renderTsxMonthly(hist) {
    var tbody = document.getElementById('monthlyTable');
    if (!tbody) return;
    if (hist.length === 0) return;
    // Gruppiere nach Monat
    var months = {};
    for (var i = 0; i < hist.length; i++) {
        var h = hist[i];
        var mo = h.date.slice(0, 7); // "2026-06"
        if (!months[mo]) months[mo] = { pnl: 0, trades: 0, wins: 0, cap: h.balance };
        months[mo].pnl    += h.pnl;
        months[mo].trades += h.trades;
        months[mo].wins   += (h.wins || 0);
        months[mo].cap     = h.balance; // letzter Stand im Monat
    }
    var keys = Object.keys(months).sort();
    tbody.innerHTML = keys.map(function(mo) {
        var m = months[mo];
        var wr = m.trades > 0 ? Math.round(m.wins / m.trades * 100) : 0;
        var wrCol = wr >= 60 ? '#10B981' : wr >= 40 ? '#F59E0B' : '#EF4444';
        var pnlCol = m.pnl >= 0 ? '#10B981' : '#EF4444';
        var label = mo.slice(0, 4) + '-' + mo.slice(5, 7);
        return '<tr style="border-bottom:1px solid rgba(255,255,255,.05)">' +
            '<td style="padding:5px 8px;font-size:.68rem;color:var(--text2)">' + label + '</td>' +
            '<td style="padding:5px 8px;text-align:right;font-size:.68rem;color:var(--text2)">' + m.trades + '</td>' +
            '<td style="padding:5px 8px;text-align:right;font-size:.68rem;color:' + wrCol + ';font-weight:700">' + wr + '%</td>' +
            '<td style="padding:5px 8px;text-align:right;font-size:.68rem;color:' + pnlCol + ';font-weight:700">' + (m.pnl >= 0 ? '+' : '') + m.pnl.toFixed(0) + '$</td>' +
            '<td style="padding:5px 8px;text-align:right;font-size:.68rem;color:var(--text2)">$' + m.cap.toLocaleString('de-AT', {maximumFractionDigits:0}) + '</td>' +
            '</tr>';
    }).join('');
}

async function pollBotStatus() {
    if (!ghTok() || !GHUSER || !GHREPO) return;
    try {
        const r = await fetch(
            'https://api.github.com/repos/' + GHUSER + '/' + GHREPO + '/contents/state.json',
            { headers: { 'Authorization': 'Bearer ' + ghTok(), 'Accept': 'application/vnd.github.v3+json' }, cache: 'no-store' }
        );
        if (!r.ok) return;
        const d    = await r.json();
        _botStateSha = d.sha;
        const data = JSON.parse(atob(d.content.replace(/\n/g, '')));
        _renderBotStatus(data.bot_status || 'unknown');
        _renderLiveMode(data.live_trading || false);
        _renderBitgetLiveMode(data.live_bitget || false);
    } catch(e) {}
}

function _renderBotStatus(status) {
    var dot  = document.getElementById('botDot');
    var txt  = document.getElementById('botStatusTxt');
    var btnS = document.getElementById('btnBotStart');
    var btnX = document.getElementById('btnBotStop');
    if (!dot) return;
    if (status === 'running') {
        dot.style.background = '#10B981';
        if (txt) txt.textContent = 'Bot läuft';
        if (btnS) btnS.style.display = 'none';
        if (btnX) btnX.style.display = 'block';
    } else if (status === 'stopped') {
        dot.style.background = '#EF4444';
        if (txt) txt.textContent = 'Bot gestoppt';
        if (btnS) btnS.style.display = 'block';
        if (btnX) btnX.style.display = 'none';
    } else {
        dot.style.background = '#374151';
        if (txt) txt.textContent = 'Bot: Launcher nicht aktiv';
        if (btnS) btnS.style.display = 'none';
        if (btnX) btnX.style.display = 'none';
    }
}

function _renderLiveMode(isLive) {
    var dot  = document.getElementById('liveDot');
    var txt  = document.getElementById('liveTxt');
    var btnL = document.getElementById('btnGoLive');
    var btnD = document.getElementById('btnGoDry');
    if (!dot) return;
    if (isLive) {
        dot.style.background = '#EF4444';
        if (txt) { txt.textContent = 'LIVE TRADING aktiv'; txt.style.color = '#EF4444'; txt.style.fontWeight = '800'; }
        if (btnL) btnL.style.display = 'none';
        if (btnD) btnD.style.display = 'inline-block';
    } else {
        dot.style.background = '#F59E0B';
        if (txt) { txt.textContent = 'Dry-Run Modus'; txt.style.color = '#F59E0B'; txt.style.fontWeight = '700'; }
        if (btnL) btnL.style.display = 'inline-block';
        if (btnD) btnD.style.display = 'none';
    }
    // Sync TopStepX dedicated panel indicator
    var d2 = document.getElementById('tsx2LiveDot'), t2 = document.getElementById('tsx2LiveTxt');
    if (d2) d2.style.background = isLive ? '#EF4444' : '#F59E0B';
    if (t2) { t2.textContent = isLive ? 'LIVE TRADING aktiv' : 'Dry-Run Modus'; t2.style.color = isLive ? '#EF4444' : '#F59E0B'; }
}

function _refreshTsx2Panel(tsx) {
    var pnl   = tsx.daily_pnl || 0;
    var dd    = tsx.drawdown_pct || 0;
    var ddUsed= tsx.drawdown_used || 0;
    var ddMax = tsx.drawdown_max || 2500;
    var tr    = tsx.day_trades || 0;
    var wr    = tsx.day_wr || 0;
    var floor = tsx.floor_active;
    var bal   = tsx.balance || 0;
    var realPnl = tsx.realized_pnl || 0;
    var openPnl = tsx.open_pnl || 0;
    var el;

    // Connection badge
    el = document.getElementById('tsx2ConnBadge');
    if (el) {
        var ok = bal > 0 || tr > 0;
        el.textContent = ok ? '● Verbunden' : '· Keine Daten';
        el.style.background = ok ? 'rgba(16,185,129,.15)' : 'rgba(55,65,81,.4)';
        el.style.color = ok ? '#10B981' : 'var(--text3)';
    }

    var DAILY_GOAL = 600;
    el = document.getElementById('tsx2Pnl');
    if (el) { el.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(0) + '$'; el.style.color = pnl >= DAILY_GOAL ? '#10B981' : pnl >= 0 ? '#F59E0B' : '#EF4444'; }
    el = document.getElementById('tsx2PnlSub');
    if (el) el.textContent = floor ? '🔒 Floor aktiv' : Math.round(Math.max(0, pnl) / DAILY_GOAL * 100) + '% von $600';

    el = document.getElementById('tsx2DD');
    if (el) { el.textContent = dd.toFixed(1) + '%'; el.style.color = dd > 60 ? '#EF4444' : dd > 40 ? '#F59E0B' : '#10B981'; }
    el = document.getElementById('tsx2DDSub');
    if (el) el.textContent = 'Bal: $' + bal.toLocaleString('de-AT', {maximumFractionDigits:0});

    el = document.getElementById('tsx2WinRate');
    if (el) { el.textContent = tr > 0 ? wr + '%' : '—'; el.style.color = wr >= 60 ? '#10B981' : wr >= 40 ? '#F59E0B' : (tr > 0 ? '#EF4444' : 'var(--text1)'); }
    el = document.getElementById('tsx2Trades');
    if (el) el.textContent = tr + (tr === 1 ? ' Trade' : ' Trades') + (tsx.day_wins !== undefined ? ' (' + tsx.day_wins + 'W/' + tsx.day_losses + 'L)' : '');

    el = document.getElementById('tsx2RR');
    var rr = tsx.day_rr || 0;
    if (el) { el.textContent = rr > 0 ? rr.toFixed(2) : '—'; el.style.color = rr >= 1.5 ? '#10B981' : rr > 0 ? '#F59E0B' : 'var(--text1)'; }
    el = document.getElementById('tsx2RRSub');
    if (el) { var aw = tsx.avg_win || 0, al = tsx.avg_loss || 0; el.textContent = (aw > 0 || al > 0) ? '+$' + aw.toFixed(0) + ' / -$' + al.toFixed(0) : 'Ø Win / Loss'; }

    el = document.getElementById('tsx2Floor');
    if (el) { if (floor) { el.style.display = 'block'; el.style.background = 'rgba(16,185,129,.15)'; el.style.color = '#10B981'; el.textContent = 'Profit Floor aktiv — Max Risiko: ' + (tsx.max_risk_now || 0).toFixed(0) + '$'; } else { el.style.display = 'none'; } }

    // Drawdown bar
    var ddPct = ddMax > 0 ? Math.min(100, ddUsed / ddMax * 100) : 0;
    el = document.getElementById('tsx2DDBar');
    if (el) { el.style.width = ddPct + '%'; el.style.background = ddPct > 70 ? '#EF4444' : ddPct > 40 ? '#F59E0B' : '#10B981'; }
    el = document.getElementById('tsx2DDUsed');
    if (el) el.textContent = '$' + ddUsed.toFixed(0) + ' / $' + ddMax.toLocaleString('de-AT', {maximumFractionDigits:0});

    // Positions
    el = document.getElementById('tsx2Positions');
    if (el) {
        var pos = tsx.open_positions || [];
        if (pos.length) {
            el.innerHTML = pos.map(function(p) {
                var col = p.pnl >= 0 ? '#10B981' : '#EF4444';
                return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06)">'
                    + '<span style="font-size:.55rem;font-weight:800;padding:2px 6px;border-radius:4px;background:' + col + '22;color:' + col + ';border:1px solid ' + col + '44">' + (p.direction || '?') + '</span>'
                    + '<span style="font-size:.7rem;font-weight:700;color:#F0F4FF">' + (p.symbol || '?') + '</span>'
                    + '<span style="font-size:.65rem;color:#9DB4CC">' + (p.size || 0) + 'x</span>'
                    + '<span style="margin-left:auto;font-size:.72rem;font-weight:700;color:' + col + '">' + (p.pnl >= 0 ? '+' : '') + (p.pnl || 0).toFixed(0) + '$</span>'
                    + '</div>';
            }).join('');
        } else {
            el.textContent = 'Keine offenen Positionen';
        }
    }

    // Konto details
    el = document.getElementById('tsx2Bal');
    if (el) el.textContent = bal > 0 ? '$' + bal.toLocaleString('de-AT', {maximumFractionDigits:0}) : '–';
    el = document.getElementById('tsx2RealPnL');
    if (el) { el.textContent = (realPnl >= 0 ? '+$' : '-$') + Math.abs(realPnl).toFixed(0); el.style.color = realPnl >= 0 ? '#10B981' : '#EF4444'; }
    el = document.getElementById('tsx2OpenPnL');
    if (el) { el.textContent = (openPnl >= 0 ? '+$' : '-$') + Math.abs(openPnl).toFixed(0); el.style.color = openPnl >= 0 ? '#10B981' : '#EF4444'; }

    // Trades badge
    el = document.getElementById('tsx2TradesBadge');
    if (el) el.textContent = tr;

    calcTopstep();
    _updateTsx2Chart();
}

function _renderBitgetLiveMode(isLive) {
    var dot  = document.getElementById('bgLiveDot');
    var txt  = document.getElementById('bgLiveTxt');
    var btnL = document.getElementById('btnBgGoLive');
    var btnD = document.getElementById('btnBgGoDry');
    if (!dot) return;
    if (isLive) {
        dot.style.background = '#EF4444';
        if (txt) { txt.textContent = 'LIVE aktiv · Bitget Futures'; txt.style.color = '#EF4444'; txt.style.fontWeight = '800'; }
        if (btnL) btnL.style.display = 'none';
        if (btnD) btnD.style.display = 'inline-block';
    } else {
        dot.style.background = '#F59E0B';
        if (txt) { txt.textContent = 'Dry-Run Modus'; txt.style.color = '#F59E0B'; txt.style.fontWeight = '700'; }
        if (btnL) btnL.style.display = 'inline-block';
        if (btnD) btnD.style.display = 'none';
    }
}

async function setBitgetLiveMode(isLive) {
    if (!ghTok() || !GHUSER || !GHREPO) { toast('Kein GitHub-Token', true); return; }
    if (isLive && !confirm('⚠️ BITGET LIVE TRADING aktivieren?\n\nDer Bot platziert ab sofort ECHTE Orders bei Bitget Futures.\n\nNur aktivieren wenn Dry-Run Signale geprüft wurden!')) return;
    if (!isLive && !confirm('Bitget Live Trading deaktivieren?\n\nBot wechselt in Dry-Run Modus — keine echten Bitget Orders mehr.')) return;
    try {
        var r = await fetch(
            'https://api.github.com/repos/' + GHUSER + '/' + GHREPO + '/contents/state.json',
            { headers: { 'Authorization': 'Bearer ' + ghTok(), 'Accept': 'application/vnd.github.v3+json' }, cache: 'no-store' }
        );
        var sha = null, data = {};
        if (r.ok) { var d = await r.json(); sha = d.sha; data = JSON.parse(atob(d.content.replace(/\n/g, ''))); }
        data.live_bitget = isLive;
        var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
        var payload = { message: 'dashboard: live_bitget=' + isLive, content: encoded };
        if (sha) payload.sha = sha;
        await fetch(
            'https://api.github.com/repos/' + GHUSER + '/' + GHREPO + '/contents/state.json',
            { method: 'PUT', headers: { 'Authorization': 'Bearer ' + ghTok(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        _renderBitgetLiveMode(isLive);
        toast(isLive ? '🔴 Bitget LIVE aktiviert!' : '✓ Bitget Dry-Run aktiv');
        setTimeout(pollBotStatus, 3000);
    } catch(e) { toast('Fehler: ' + e.message, true); }
}

async function setLiveMode(isLive) {
    if (!ghTok() || !GHUSER || !GHREPO) { toast('Kein GitHub-Token', true); return; }
    if (isLive && !confirm('⚠️ LIVE TRADING aktivieren?\n\nDer Bot platziert ab sofort ECHTE Orders bei TopStepX.\n\nNur aktivieren wenn Dry-Run Signale geprüft wurden!')) return;
    if (!isLive && !confirm('Live Trading deaktivieren?\n\nBot wechselt in Dry-Run Modus — keine echten Orders mehr.')) return;
    try {
        var r = await fetch(
            'https://api.github.com/repos/' + GHUSER + '/' + GHREPO + '/contents/state.json',
            { headers: { 'Authorization': 'Bearer ' + ghTok(), 'Accept': 'application/vnd.github.v3+json' }, cache: 'no-store' }
        );
        var sha = null, data = {};
        if (r.ok) { var d = await r.json(); sha = d.sha; data = JSON.parse(atob(d.content.replace(/\n/g, ''))); }
        data.live_trading = isLive;
        var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
        var payload = { message: 'dashboard: live_trading=' + isLive, content: encoded };
        if (sha) payload.sha = sha;
        await fetch(
            'https://api.github.com/repos/' + GHUSER + '/' + GHREPO + '/contents/state.json',
            { method: 'PUT', headers: { 'Authorization': 'Bearer ' + ghTok(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        _renderLiveMode(isLive);
        toast(isLive ? '🔴 LIVE TRADING aktiviert!' : '✓ Dry-Run Modus aktiv');
        // Commander-Chat Eintrag schreiben
        try {
            var now = new Date();
            var ts = now.toLocaleDateString('de-AT') + ' ' + now.toLocaleTimeString('de-AT', {hour:'2-digit',minute:'2-digit'});
            var chatMsg = isLive
                ? '🔴 LIVE TRADING aktiviert — ' + ts + '\nBot handelt ab sofort echte MGC-Kontrakte bei TopStepX.'
                : '⚪ Dry-Run aktiviert — ' + ts + '\nBot wechselt zu Simulationsmodus — keine echten Orders mehr.';
            var cr = await fetch('https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat_v2.json',
                {headers:{'Authorization':'Bearer '+ghTok(),'Accept':'application/vnd.github.v3+json'},cache:'no-store'});
            var csha=null, cmsgs=[];
            if(cr.ok){var cd=await cr.json();csha=cd.sha;try{cmsgs=JSON.parse(atob(cd.content.replace(/\n/g,'')))}catch(e){cmsgs=[];}}
            cmsgs.push({author:'System',content:chatMsg,ts:Date.now(),auto:false,role:'assistant'});
            var cenc=btoa(unescape(encodeURIComponent(JSON.stringify(cmsgs))));
            var cpay={message:'bot: live mode change',content:cenc};
            if(csha)cpay.sha=csha;
            await fetch('https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat_v2.json',
                {method:'PUT',headers:{'Authorization':'Bearer '+ghTok(),'Content-Type':'application/json'},body:JSON.stringify(cpay)});
        } catch(e2) {}
        setTimeout(pollBotStatus, 3000);
    } catch(e) { toast('Fehler: ' + e.message, true); }
}

async function sendBotCommand(cmd) {
    if (!ghTok() || !GHUSER || !GHREPO) { toast('Kein GitHub-Token', true); return; }
    var txt = document.getElementById('botStatusTxt');
    if (txt) txt.textContent = cmd === 'start' ? 'Bot wird gestartet…' : 'Bot wird gestoppt…';
    try {
        var r = await fetch(
            'https://api.github.com/repos/' + GHUSER + '/' + GHREPO + '/contents/state.json',
            { headers: { 'Authorization': 'Bearer ' + ghTok(), 'Accept': 'application/vnd.github.v3+json' }, cache: 'no-store' }
        );
        var sha = null, data = {};
        if (r.ok) {
            var d = await r.json();
            sha  = d.sha;
            data = JSON.parse(atob(d.content.replace(/\n/g, '')));
        }
        data.bot_command = cmd;
        if (cmd === 'stop') { data.live_trading = false; data.live_bitget = false; } // Sicherheit: Stoppen setzt immer auf Dry-Run zurück
        var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
        var payload = { message: 'dashboard: bot ' + cmd, content: encoded };
        if (sha) payload.sha = sha;
        await fetch(
            'https://api.github.com/repos/' + GHUSER + '/' + GHREPO + '/contents/state.json',
            { method: 'PUT', headers: { 'Authorization': 'Bearer ' + ghTok(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        if (cmd === 'stop') { _renderLiveMode(false); _renderBitgetLiveMode(false); }
        toast(cmd === 'start' ? 'Start-Befehl gesendet' : 'Stop-Befehl gesendet — Dry-Run aktiv');
        setTimeout(pollBotStatus, 5000);
    } catch(e) { toast('Fehler: ' + e.message, true); }
}

// ── DISPATCH ───────────────────────────────────────────────────────────────
function ghTok(){return localStorage.getItem('gh_token') || _embeddedGhTok || '';}

function setGhToken() {
    var current = ghTok();
    var val = prompt(
        'GitHub Personal Access Token eingeben\n(Berechtigungen: repo + contents)',
        current || ''
    );
    if (val === null) return; // cancelled
    val = val.trim();
    if (!val) {
        localStorage.removeItem('gh_token');
        toast('Token gelöscht');
        updateTokenBtn();
        return;
    }
    try {
        localStorage.setItem('gh_token', val);
        toast('Token gespeichert ✓');
        updateTokenBtn();
    } catch(e) {
        toast('Speichern fehlgeschlagen: ' + e.message, true);
    }
}

function updateTokenBtn() {
    var btn = document.getElementById('tokenBtn');
    if (!btn) return;
    var manual = !!localStorage.getItem('gh_token');
    var embedded = !!_embeddedGhTok;
    var has = manual || embedded;
    btn.textContent = has ? ('🔑' + (embedded && !manual ? ' Auto ✓' : ' Token ✓')) : '🔑 Token setzen';
    btn.style.borderColor = has ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.4)';
    btn.style.color = has ? 'var(--green)' : 'var(--red)';
}
async function ghGet(){
    const r=await fetch(`https://api.github.com/repos/${GHUSER}/${GHREPO}/contents/state.json`,
        {headers:{Authorization:'Bearer '+ghTok(),'User-Agent':'gold-bot'}});
    if(!r.ok) throw new Error('GitHub GET '+r.status);
    const m=await r.json();
    return {data:JSON.parse(_b64dec(m.content)),sha:m.sha};
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
    if(!ghTok()){
        var lastWarn = parseInt(sessionStorage.getItem('_noTokWarn')||'0');
        if (Date.now() - lastWarn > 30000) {
            addMsg('assistant','⚠️ **Kein GitHub Token gesetzt.**\n\nTippe oben auf **🔑 Token setzen** um deinen GitHub Token einzugeben.', true);
            sessionStorage.setItem('_noTokWarn', Date.now().toString());
        }
        return;
    }
    for(var attempt=0; attempt<5; attempt++){
        try{
            // SHA bei jedem Versuch neu holen — verhindert 409-Konflikte bei parallelen Dispatches
            const{data,sha}=await ghGet();
            (data.commands=data.commands||[]).push({...cmd,status:'pending',dispatched:Date.now()});
            const r=await fetch('https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/state.json',{
                method:'PUT',
                headers:{Authorization:'Bearer '+ghTok(),'Content-Type':'application/json','User-Agent':'gold-bot'},
                body:JSON.stringify({message:'dispatch',content:btoa(unescape(encodeURIComponent(JSON.stringify(data,null,2)))),sha:sha})
            });
            if(r.status===409){
                await new Promise(function(res){setTimeout(res,600+Math.random()*600);});
                continue;
            }
            if(!r.ok) throw new Error('GitHub PUT '+r.status);
            if (cmd.type !== 'set_asset') {
                addMsg('assistant','⚡ **Befehl gesendet!** "'+esc(cmd.name||cmd.type)+'" wurde übermittelt.\n\nErgebnis erscheint in ~2 Min. im Dashboard.');
            }
            toast('Befehl gesendet ✓');
            return;
        }catch(e){
            if(attempt>=4) addMsg('assistant','⚠️ Dispatch fehlgeschlagen: '+e.message);
            else await new Promise(function(res){setTimeout(res,400);});
        }
    }
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

// ── BENACHRICHTIGUNGEN ────────────────────────────────────────────────────────
function requestNotifPerm() {
    if (typeof Notification === 'undefined') {
        toast('Benachrichtigungen werden auf diesem Browser nicht unterstützt.\nAuf iOS: App zum Home-Bildschirm hinzufügen.', true); return;
    }
    if (Notification.permission === 'granted') {
        toast('Benachrichtigungen bereits aktiv ✓'); _updateNotifBtn(); return;
    }
    if (Notification.permission === 'denied') {
        toast('Bitte in den Browser-Einstellungen erlauben: Einstellungen → Safari → Erweitert → Websites → Benachrichtigungen', true); return;
    }
    Notification.requestPermission().then(function(p) {
        if (p === 'granted') toast('Benachrichtigungen aktiviert ✓');
        else toast('Benachrichtigungen abgelehnt', true);
        _updateNotifBtn();
    });
}
function _updateNotifBtn() {
    var perm = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    var col = perm === 'granted' ? '#10B981' : perm === 'denied' ? '#EF4444' : '#F59E0B';
    var icon = perm === 'granted' ? '🔔' : perm === 'denied' ? '🔕' : '🔔?';
    document.querySelectorAll('.notifBtn').forEach(function(b) {
        b.textContent = icon;
        b.style.color = col;
        b.style.borderColor = col.replace(')', ',.3)').replace('rgb', 'rgba');
        b.title = perm === 'granted' ? 'Benachrichtigungen aktiv' : perm === 'denied' ? 'Benachrichtigungen blockiert — in Einstellungen ändern' : 'Benachrichtigungen aktivieren';
    });
}

// ── INJECT SYNC BAR + GLOBAL NOTIF BUTTON ────────────────────────────────────
(function injectSyncBar() {
    var NOTIF_BTN = '<button type="button" class="notifBtn" onclick="requestNotifPerm()" style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:#F59E0B;font-size:.75rem;font-weight:700;padding:4px 8px;border-radius:6px;cursor:pointer;touch-action:manipulation" title="Benachrichtigungen aktivieren">🔔?</button>';

    // 🔔 Button in den globalen Header einfügen (sichtbar auf allen Tabs)
    var hdr = document.querySelector('header') || document.querySelector('.header') || document.querySelector('[class*="header"]');
    if (!hdr) {
        // Fallback: direkt in den Body ganz oben, als fixed Badge
        var badge = document.getElementById('_notifBadge');
        if (!badge) {
            badge = document.createElement('button');
            badge.id = '_notifBadge';
            badge.className = 'notifBtn';
            badge.onclick = requestNotifPerm;
            badge.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);color:#F59E0B;font-size:1rem;font-weight:700;padding:6px 10px;border-radius:50px;cursor:pointer;touch-action:manipulation;backdrop-filter:blur(8px)';
            badge.title = 'Benachrichtigungen aktivieren';
            badge.textContent = '🔔?';
            document.body.appendChild(badge);
        }
    } else if (!hdr.querySelector('.notifBtn')) {
        var nb = document.createElement('button');
        nb.className = 'notifBtn';
        nb.onclick = requestNotifPerm;
        nb.style.cssText = 'background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:#F59E0B;font-size:.8rem;padding:4px 8px;border-radius:6px;cursor:pointer;margin-left:auto';
        nb.textContent = '🔔?';
        hdr.appendChild(nb);
    }

    var DEL_BTN_HTML = '<button type="button" id="delBtn" onclick="clearChat()" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#EF4444;font-size:.6rem;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;touch-action:manipulation" title="Chat löschen">🗑</button>';
    var bar = document.getElementById('syncBar');
    var chatBox = document.getElementById('chatBox');
    if (!bar && chatBox) {
        bar = document.createElement('div');
        bar.id = 'syncBar';
        bar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:#07090E;flex-shrink:0';
        bar.innerHTML = '<span id="syncStatus" style="font-size:.6rem;color:#8B9BB4;flex:1">Sync bereit</span>'
            + NOTIF_BTN
            + DEL_BTN_HTML
            + '<button type="button" id="syncBtn" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);color:#10B981;font-size:.6rem;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;touch-action:manipulation">↻ Sync</button>';
        chatBox.parentNode.insertBefore(bar, chatBox);
    } else if (bar && !document.getElementById('delBtn')) {
        // Del-Button in bestehendes HTML-syncBar einfügen
        var delBtnEl = document.createElement('button');
        delBtnEl.type = 'button'; delBtnEl.id = 'delBtn'; delBtnEl.onclick = clearChat;
        delBtnEl.style.cssText = 'background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#EF4444;font-size:.6rem;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;touch-action:manipulation';
        delBtnEl.title = 'Chat löschen'; delBtnEl.textContent = '🗑';
        var syncBtn0 = document.getElementById('syncBtn');
        if (syncBtn0) bar.insertBefore(delBtnEl, syncBtn0);
        else bar.appendChild(delBtnEl);
    }
    var btn = document.getElementById('syncBtn');
    if (btn) btn.onclick = manualSync;
    // Poly chat — eigene SyncBar ohne del (poly hat eigene localStorage-Logik)
    var polyBox = document.getElementById('polyChatBox');
    var polyBar = document.getElementById('polySyncBar');
    if (!polyBar && polyBox) {
        polyBar = document.createElement('div');
        polyBar.id = 'polySyncBar';
        polyBar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:#07090E;flex-shrink:0';
        polyBar.innerHTML = '<span id="polySyncStatus" style="font-size:.6rem;color:#8B9BB4;flex:1">Sync bereit</span>'
            + NOTIF_BTN
            + '<button type="button" id="polySyncBtn" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);color:#10B981;font-size:.6rem;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;touch-action:manipulation">↻ Sync</button>';
        polyBox.parentNode.insertBefore(polyBar, polyBox);
    }
    var polyBtn = document.getElementById('polySyncBtn');
    if (polyBtn) polyBtn.onclick = manualSync;
    _updateNotifBtn();
})();

// ── DOM UPGRADE (altes gecachtes HTML bekommt neue Elemente) ───────────────────
(function ensureDOM() {
    // Chart-Card als zuverlässiger Anker (canvas#pnlChart ist immer vorhanden)
    var chartEl = document.getElementById('pnlChart');
    var chartCard = chartEl && chartEl.closest ? chartEl.closest('.card') : null;
    if (!chartCard) return;

    // Monatliche Auswertung NACH dem Chart einfügen
    if (!document.getElementById('monthlyTable')) {
        var mDiv = document.createElement('div');
        mDiv.className = 'card';
        mDiv.innerHTML =
            '<div class="ch"><span class="ct">Monatliche Auswertung</span></div>' +
            '<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid rgba(255,255,255,.1)">' +
            '<th style="padding:5px 8px;text-align:left;font-size:.65rem;color:#8B9BB4;font-weight:600">Monat</th>' +
            '<th style="padding:5px 8px;text-align:right;font-size:.65rem;color:#8B9BB4;font-weight:600">Trades</th>' +
            '<th style="padding:5px 8px;text-align:right;font-size:.65rem;color:#8B9BB4;font-weight:600">WR</th>' +
            '<th style="padding:5px 8px;text-align:right;font-size:.65rem;color:#8B9BB4;font-weight:600">PnL</th>' +
            '<th style="padding:5px 8px;text-align:right;font-size:.65rem;color:#8B9BB4;font-weight:600">Kapital</th>' +
            '</tr></thead><tbody id="monthlyTable"></tbody></table>';
        chartCard.insertAdjacentElement('afterend', mDiv);
    }
})();

// ── BOOT (inline — DOM is ready because script is at end of <body>) ──────────
(function boot() {
    var notesInp = document.getElementById('t-notes');
    if (notesInp) notesInp.addEventListener('change', function() { if (this.checked) renderNotes(); });
    renderAll(L);
    renderAssetPicker();
    initChat();
    renderNotes();
    renderPhotos();
    updateTokenBtn();
    setInterval(poll, 30000);
    setInterval(syncChat, 8000); // Echtzeit-Sync alle 8 Sekunden
    pollBotStatus(); setInterval(pollBotStatus, 30000); // Bot-Status alle 30s
    pollTopStep();   setInterval(pollTopStep,   60000); // TopStepX Live alle 60s
    setInterval(function(){
        var saved=(function(){try{return JSON.parse(localStorage.getItem('gb_chat')||'[]').filter(function(m){return !m.auto;});}catch(e){return [];}})();
        if(saved.length) uploadLocalHistory(saved);
    }, 300000);
    // Service Worker + Push-Benachrichtigungen registrieren
    _initSW();
})();

function _initSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js').then(function(reg) {
        // SW mit Credentials versorgen
        function sendInitToSW(sw) {
            var lastTs = hist.length ? Math.max.apply(null, hist.map(function(m){ return m.ts||0; })) : 0;
            sw.postMessage({ type:'INIT', gu:GHUSER, gr:GHREPO, gt:ghTok(), me:ME, lastTs:lastTs });
        }
        if (reg.active) sendInitToSW(reg.active);
        reg.addEventListener('updatefound', function() {
            var sw = reg.installing;
            sw.addEventListener('statechange', function() {
                if (sw.state === 'activated') sendInitToSW(sw);
            });
        });
        // Neue Nachrichten vom SW empfangen → Tab aktualisieren
        navigator.serviceWorker.addEventListener('message', function(e) {
            if (e.data && e.data.type === 'NEW_MSGS') { syncChat(); }
        });
    }).catch(function(){});
}

// ── BB Squeeze Config (Backtest C) ───────────────────────────────────────────
function saveBBConfig() {
    var cfg = {
        capital: parseFloat(document.getElementById('cfgCapital').value) || 10000,
        risk:    parseFloat(document.getElementById('cfgRisk').value)    || 5,
        rr:      parseFloat(document.getElementById('cfgRR').value)      || 3,
        dir:     document.getElementById('cfgDir').value || 'both',
    };
    localStorage.setItem('bb_config', JSON.stringify(cfg));
    showToast('Einstellungen gespeichert', 'green');
    calcBBProjection();
}

function calcBBProjection() {
    var capital = parseFloat(document.getElementById('cfgCapital').value) || 10000;
    var risk    = parseFloat(document.getElementById('cfgRisk').value)    || 5;
    var rr      = parseFloat(document.getElementById('cfgRR').value)      || 3;
    var dir     = document.getElementById('cfgDir').value || 'both';
    var wr = 0.322; // historische WR BB Squeeze + EMA
    var trades_per_month = dir === 'both' ? 18 : 9;
    var cap = capital;
    var months = 0;
    var target = 1000000;
    while (cap < target && months < 60) {
        for (var t = 0; t < trades_per_month; t++) {
            var bet = cap * (risk / 100);
            if (Math.random() < wr) { cap += bet * rr; } else { cap -= bet; }
        }
        months++;
    }
    var proj = document.getElementById('bbProjection');
    if (!proj) return;
    var fmt = function(n) { return n >= 1e6 ? '$' + (n/1e6).toFixed(2) + 'M' : '$' + Math.round(n).toLocaleString('de-DE'); };
    var ev = (wr * rr - (1 - wr)).toFixed(3);
    proj.innerHTML =
        '<strong style="color:#8B5CF6">Simulation</strong> (' + trades_per_month + ' Trades/Monat · RR ' + rr + ':1 · ' + risk + '% Risiko)<br>' +
        'Start: ' + fmt(capital) + ' → ' +
        (months < 60
            ? '<strong style="color:#10B981">$1M in ca. ' + months + ' Monaten</strong>'
            : '<span style="color:#EF4444">$1M nicht erreicht in 60 Monaten</span>') +
        ' · EV/Trade: <strong>' + (parseFloat(ev) > 0 ? '+' : '') + ev + '</strong>';
}

// Beim Laden gespeicherte Werte wiederherstellen
(function() {
    try {
        var saved = JSON.parse(localStorage.getItem('bb_config') || '{}');
        if (saved.capital && document.getElementById('cfgCapital')) {
            document.getElementById('cfgCapital').value = saved.capital;
            document.getElementById('cfgRisk').value    = saved.risk || 5;
            document.getElementById('cfgRR').value      = saved.rr   || 3;
            document.getElementById('cfgDir').value     = saved.dir  || 'both';
        }
    } catch(e) {}
})();