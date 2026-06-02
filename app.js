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
let ME = (function(){ try { return localStorage.getItem('gb_persona')||'Dominik'; } catch(e){ return 'Dominik'; } })();
function setPers(name) {
    ME = name;
    try { localStorage.setItem('gb_persona', name); } catch(e) {}
    document.querySelectorAll('.pb-btn').forEach(b => b.classList.toggle('active', b.textContent.includes(name)));
}

// ── BOOT ───────────────────────────────────────────────────────────────────
// Build-Timestamp wird beim Deploy eingefügt — für Auto-Reload-Mechanismus
var APP_BUILD = 1780429904;

window.addEventListener('resize', () => { if(L) drawChart(L); });

async function poll() {
    try {
        const r = await fetch('./data.json?_=' + Date.now());
        if (!r.ok) return;
        const d = await r.json();
        // Veraltete Build-Version (APP_BUILD=0 = alte gecachte Version ohne Timestamp)
        if (d.min_required_build && APP_BUILD < d.min_required_build) {
            console.log('Veraltete Build-Version (' + APP_BUILD + ' < ' + d.min_required_build + ') — Seite wird aktualisiert...');
            window.location.reload(true);
            return;
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
     renderStrategies, renderAgents, renderSignals, renderEvents, renderPoly
    ].forEach(function(fn){ try { fn(d); } catch(e) { console.error(fn.name, e); } });
}

function renderHeader(d) {
    const p = d.price;
    const hp = document.getElementById('hPrice');
    if (hp) hp.textContent = (p && p !== '–') ? '$' + Number(p).toLocaleString('de-AT',{minimumFractionDigits:2,maximumFractionDigits:2}) : '–';
    const ht = document.getElementById('hTime');
    if (ht) ht.textContent = d.updated || '–';

    // Backtest-Parameter-Box (zeigt genau was getestet wird)
    var box = document.getElementById('_btParams');
    if (!box) {
        box = document.createElement('div');
        box.id = '_btParams';
        box.style.cssText = 'background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:10px 14px;margin:0 0 10px 0;font-size:.65rem;color:#8B9BB4;cursor:pointer';
        box.title = 'Backtest-Konfiguration';
        var anchor = document.getElementById('kReturn');
        var krow = anchor && anchor.closest ? anchor.closest('.kpi-grid') : null;
        if (krow) krow.parentNode.insertBefore(box, krow);
    }
    var fd = (d.from_date||'2026-01-01').slice(0,10);
    var td2 = (d.to_date||new Date().toISOString()).slice(0,10);
    var risk = d.risk_pct ? (d.risk_pct*100).toFixed(0)+'%' : '10%';
    var sym = (d.symbol || 'XAUUSD').toUpperCase();
    var upd = d.updated || '–';
    box.innerHTML = '<span style="color:#6366F1;font-weight:700;font-size:.7rem">⚙ BACKTEST-KONFIGURATION</span>'
        + '&nbsp;&nbsp;<span style="color:#F1F5F9">' + sym + '</span>'
        + '&nbsp;·&nbsp;<span style="color:#F1F5F9">' + fd + ' – ' + td2 + '</span>'
        + '&nbsp;·&nbsp;Risiko <span style="color:#F59E0B;font-weight:700">' + risk + '</span> / Trade'
        + '&nbsp;·&nbsp;Kapital <span style="color:#F1F5F9">$10.000</span>'
        + '&nbsp;·&nbsp;Strategie <span style="color:#10B981">Order Block+FVG+BOS</span>'
        + '&nbsp;·&nbsp;<span style="color:#475569">Stand: ' + upd + '</span>';
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
    const wr=d.wr||0, pf=d.pf||0, dd=d.max_dd||0, pnl=d.net_pnl||0, tr=d.trades||0;
    document.getElementById('kWR').textContent    = wr  ? wr.toFixed(1)+'%'                 : '–';
    document.getElementById('kPF').textContent    = pf  ? pf.toFixed(2)                      : '–';
    document.getElementById('kDD').textContent    = dd  ? dd.toFixed(1)+'%'                  : '–';
    document.getElementById('kPnL').textContent   = pnl ? (pnl>0?'+':'')+pnl.toFixed(0)+'$' : '–';
    document.getElementById('kTrades').textContent = tr + ' Trades';
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
    // Monatstabelle rendern
    renderMonthly(d.monthly||[]);

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
            : `<button onclick="event.stopPropagation();activateVariant('${esc(s.id||s.name||'')}','${esc(s.name||'')}')" style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);color:#F59E0B;font-size:.55rem;font-weight:700;padding:3px 9px;border-radius:20px;cursor:pointer;touch-action:manipulation;white-space:nowrap">Aktivieren</button>`;
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

// ── POLYMARKET ─────────────────────────────────────────────────────────────
function renderPoly(d) {
    var poly = d.polymarket || {};
    var opps = poly.opportunities || [];
    var orders = poly.all_orders || poly.orders_placed || [];
    var mode = poly.dry_run !== false ? 'PAPER' : 'LIVE';

    // KPIs
    var mEl = document.getElementById('polyMarkets');
    var oEl = document.getElementById('polyOpps');
    var ordEl = document.getElementById('polyOrders');
    var modeEl = document.getElementById('polyMode');
    if (mEl) mEl.textContent = poly.markets_scanned || '–';
    if (oEl) oEl.textContent = opps.length || '0';
    if (ordEl) ordEl.textContent = orders.length || '0';
    if (modeEl) { modeEl.textContent = mode; modeEl.style.color = mode === 'LIVE' ? 'var(--red)' : 'var(--green)'; }

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
            contentEl.innerHTML =
                '<div style="font-size:.82rem;font-weight:700;color:var(--text);margin-bottom:8px">' + esc(top.question) + '</div>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
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
                '<div style="font-size:.7rem;color:var(--text2);line-height:1.5">' + esc(top.reasoning || '') + '</div>';
        }
    } else if (topCard) {
        topCard.style.display = 'none';
    }

    // Opportunities list
    var oppEl = document.getElementById('polyOppList');
    if (oppEl) {
        if (!opps.length) {
            oppEl.innerHTML = '<div class="empty"><div class="empty-ico">⬡</div>Kein Scan gelaufen — startet alle 2h</div>';
        } else {
            oppEl.innerHTML = opps.map(function(o) {
                var edgePct = (o.edge * 100).toFixed(1);
                var hasEdge = o.edge >= 0.05;
                var edgeColor = hasEdge ? 'var(--green)' : 'var(--text3)';
                var confColor = o.confidence === 'high' ? 'var(--green)' : o.confidence === 'medium' ? 'var(--gold)' : 'var(--text3)';
                return '<div class="sig-row">' +
                    '<div class="sig-dir ' + (o.direction === 'YES' ? 'long' : 'short') + '" style="width:38px;font-size:.58rem">' + esc(o.direction) + '</div>' +
                    '<div class="sig-info">' +
                      '<div class="sig-price" style="font-size:.75rem">' + esc(o.question.slice(0, 70)) + (o.question.length > 70 ? '…' : '') + '</div>' +
                      '<div class="sig-det">YES ' + (o.yes_price * 100).toFixed(0) + '% · Claude ' + (o.claude_prob * 100).toFixed(0) + '% · Vol $' + (o.volume_24h || 0).toLocaleString() + '</div>' +
                    '</div>' +
                    '<div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end;flex-shrink:0">' +
                      '<span style="font-size:.7rem;font-weight:800;color:' + edgeColor + '">' + edgePct + '%</span>' +
                      '<span style="font-size:.58rem;color:' + confColor + '">' + esc(o.confidence || '') + '</span>' +
                    '</div>' +
                  '</div>';
            }).join('');
        }
    }

    // Orders list
    var ordListEl = document.getElementById('polyOrderList');
    if (ordListEl) {
        if (!orders.length) {
            ordListEl.innerHTML = '<div class="empty"><div class="empty-ico">📋</div>Noch keine Orders</div>';
        } else {
            ordListEl.innerHTML = orders.slice(0, 10).map(function(o) {
                var dirClass = o.direction === 'YES' ? 'long' : 'short';
                return '<div class="sig-row">' +
                    '<div class="sig-dir ' + dirClass + '" style="width:38px;font-size:.58rem">' + esc(o.direction) + '</div>' +
                    '<div class="sig-info">' +
                      '<div class="sig-price" style="font-size:.72rem">' + esc((o.question || '').slice(0, 65)) + '</div>' +
                      '<div class="sig-det">@ ' + ((o.price || 0) * 100).toFixed(0) + '¢ · Stake $' + (o.stake || 0).toFixed(2) + ' · ' + esc(o.ts || '') + '</div>' +
                    '</div>' +
                    '<span style="font-size:.65rem;font-weight:700;color:var(--purple);flex-shrink:0">' + esc(o.mode || 'PAPER') + '</span>' +
                  '</div>';
            }).join('');
        }
    }
}

// ── TABS ───────────────────────────────────────────────────────────────────
var _tabMap = {stats:'panelDashboard', agents:'panelAgents', poly:'panelPoly', chat:'panelChat', notes:'panelNotes'};
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
    if (tab === 'poly') initPolyChat();
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
        var borderColor = isActive ? 'var(--gold)' : 'var(--border)';
        var bgColor = isActive ? 'rgba(245,158,11,.1)' : 'var(--card)';
        var nameColor = isActive ? 'var(--gold)' : 'var(--text2)';
        var badge = isActive ? '<span style="font-size:.55rem;background:var(--gold);color:#000;padding:2px 5px;border-radius:4px;font-weight:700">AKTIV</span>' : '<span style="font-size:.55rem;background:var(--border);color:var(--text2);padding:2px 5px;border-radius:4px">INAKTIV</span>';
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

async function syncChat() {
    if (!ghTok() || !GHUSER || !GHREPO) return;
    try {
        const r = await fetch(
            'https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat.json',
            {headers:{Authorization:'Bearer '+ghTok(),'User-Agent':'gold-bot','Cache-Control':'no-cache'}}
        );
        if (r.status === 404) return;
        if (!r.ok) return;
        const m = await r.json();
        _chatSha = m.sha;
        let remote; try { remote = JSON.parse(_b64dec(m.content)); } catch(e) { return; }
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
            newMsgs.forEach(function(msg){
                hist.push(msg);
                renderMsg(msg.role, msg.content, msg.ts, msg.author);
                // Browser-Benachrichtigung wenn Tab im Hintergrund & anderer User
                if (msg.author !== ME && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
                    new Notification('A2A · ' + (msg.author||'Commander'), {
                        body: (msg.content||'').slice(0, 100),
                        icon: './icon-192.png', tag: 'a2a-chat', renotify: true
                    });
                }
            });
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
                'https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat.json',
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
                'https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat.json',
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
    // With column-reverse: first in DOM = visually at bottom.
    // welcome() first → stays at bottom. Saved messages stack above it. New synced messages appear at top.
    welcome();
    saved.forEach(function(m) { renderMsg(m.role, m.content, m.ts, m.author); });
    // Upload local history to GitHub first, then pull everyone else's messages
    setTimeout(function(){
        const st = document.getElementById('syncStatus');
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
    if (st) st.textContent = saved.length + ' lokale Msgs gefunden…';
    await uploadLocalHistory(saved);
    if (st) st.textContent = '⏳ Sync läuft…';
    await syncChat();
    const box = document.getElementById('chatBox');
    const n = box ? box.querySelectorAll('.msg').length : 0;
    if (st) st.textContent = '✓ Sync fertig · ' + n + ' Msgs · ' + new Date().toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit'});
}

async function uploadLocalHistory(localMsgs) {
    if (!ghTok() || !GHUSER || !GHREPO || !localMsgs.length) return;
    try {
        var rGet = await fetch(
            'https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat.json',
            {headers:{Authorization:'Bearer '+ghTok(),'User-Agent':'gold-bot'}}
        );
        var remote = [], sha = null;
        if (rGet.ok) {
            var mf = await rGet.json(); sha = mf.sha;
            try { remote = JSON.parse(_b64dec(mf.content)); } catch(e) { remote = []; }
        }
        // Merge: keep all unique messages by timestamp
        var byTs = {};
        remote.forEach(function(m){ byTs[m.ts]=m; });
        localMsgs.forEach(function(m){ if(!byTs[m.ts]) byTs[m.ts]=m; });
        var merged = Object.values(byTs).sort(function(a,b){return a.ts-b.ts;}).slice(-300);
        if (merged.length === remote.length) return; // nothing new
        var body = {message:'Upload local history ('+ME+')', content:btoa(unescape(encodeURIComponent(JSON.stringify(merged))))};
        if (sha) body.sha = sha;
        var rPut = await fetch(
            'https://api.github.com/repos/'+GHUSER+'/'+GHREPO+'/contents/chat.json',
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
    // Mirror to poly chat if initialized
    const polyBox = document.getElementById('polyChatBox');
    if (polyBox && polyBox._ready) { polyBox.appendChild(d.cloneNode(true)); polyBox.scrollTop = polyBox.scrollHeight; }
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
    ['chatBox','polyChatBox'].forEach(function(boxId) {
        const box=document.getElementById(boxId);
        if(!box || (boxId==='polyChatBox' && !box._ready)) return;
        const d=document.createElement('div'); d.className='msg assistant'; d.id=boxId==='chatBox'?'typer':'polyTyper';
        d.innerHTML='<div class="t-bubble"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>';
        box.appendChild(d); box.scrollTop=0;
    });
}
function hideTyping() { ['typer','polyTyper'].forEach(function(id){const e=document.getElementById(id);if(e)e.remove();}); }

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

// ── POLY SCOUT — eigenständiger Bot für Polymarket ────────────────────────
var polyHist = [], polyBusy = false;

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
    box.scrollTop = box.scrollHeight;
}

function polyShowTyping() {
    var box = document.getElementById('polyChatBox');
    if (!box) return;
    var d = document.createElement('div');
    d.className = 'msg assistant'; d.id = 'polyTyper';
    d.innerHTML = '<div class="t-bubble"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>';
    box.appendChild(d); box.scrollTop = box.scrollHeight;
}
function polyHideTyping() { var e = document.getElementById('polyTyper'); if (e) e.remove(); }

function initPolyChat() {
    var box = document.getElementById('polyChatBox');
    if (!box || box._ready) return;
    box._ready = true;
    // Gespeicherten Verlauf laden
    var saved = (function() {
        try { return JSON.parse(localStorage.getItem('gb_poly_chat') || '[]').filter(function(m){ return !m.auto; }); }
        catch(e) { return []; }
    })();
    polyHist = saved.slice();
    if (saved.length) {
        var sep = document.createElement('div');
        sep.style.cssText = 'text-align:center;font-size:.6rem;color:var(--text3);padding:6px 0;border-top:1px solid var(--border)';
        sep.textContent = '— ' + saved.length + ' gespeicherte Nachrichten —';
        box.appendChild(sep);
        saved.forEach(function(m) { polyRenderMsg(m.role, m.content, m.ts, m.author); });
    }
    polyWelcome();
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

function onPolyKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendPolyMsg();}}
function autoGrow(el){el.style.height='40px';el.style.height=Math.min(el.scrollHeight,110)+'px';}

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
            addMsg('assistant','⚡ **Befehl gesendet!** "'+esc(cmd.name||cmd.type)+'" wurde übermittelt.\n\nErgebnis erscheint in ~2 Min. im Dashboard.');
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

    var bar = document.getElementById('syncBar');
    var chatBox = document.getElementById('chatBox');
    if (!bar && chatBox) {
        bar = document.createElement('div');
        bar.id = 'syncBar';
        bar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 14px;border-bottom:1px solid rgba(255,255,255,.08);background:#07090E;flex-shrink:0';
        bar.innerHTML = '<span id="syncStatus" style="font-size:.6rem;color:#8B9BB4;flex:1">Sync bereit</span>'
            + NOTIF_BTN
            + '<button type="button" id="syncBtn" style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);color:#10B981;font-size:.6rem;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;touch-action:manipulation">↻ Sync</button>';
        chatBox.parentNode.insertBefore(bar, chatBox);
    }
    var btn = document.getElementById('syncBtn');
    if (btn) btn.onclick = manualSync;
    // Also inject into poly chat
    var polyBox = document.getElementById('polyChatBox');
    var polyBar = document.getElementById('polySyncBar');
    if (!polyBar && polyBox) {
        polyBar = bar ? bar.cloneNode(true) : null;
        if (polyBar) {
            polyBar.id = 'polySyncBar';
            polyBar.querySelector('#syncStatus').id = 'polySyncStatus';
            polyBar.querySelector('#syncBtn').id = 'polySyncBtn';
            polyBar.querySelector('#polySyncBtn').onclick = manualSync;
            polyBox.parentNode.insertBefore(polyBar, polyBox);
        }
    }
    _updateNotifBtn();
})();

// ── DOM UPGRADE (altes gecachtes HTML bekommt neue Elemente) ───────────────────
(function ensureDOM() {
    // Chart-Card als zuverlässiger Anker (canvas#pnlChart ist immer vorhanden)
    var chartEl = document.getElementById('pnlChart');
    var chartCard = chartEl && chartEl.closest ? chartEl.closest('.card') : null;
    if (!chartCard) return;

    // Extra KPI-Zeile VOR dem Chart einfügen (Return / End-Kapital / Long-Short / H4)
    if (!document.getElementById('kReturn')) {
        var kRow = document.createElement('div');
        kRow.className = 'kpi-grid';
        kRow.style.cssText = 'grid-template-columns:repeat(4,1fr);margin-top:0';
        kRow.innerHTML =
            '<div class="kpi" style="--kc:#10B981;--kg:rgba(16,185,129,.15)"><div class="kpi-lbl">Return</div><div class="kpi-val" id="kReturn" style="font-size:1.35rem">–</div><div class="kpi-sub">Gesamt-Rendite</div></div>' +
            '<div class="kpi" style="--kc:#6366F1;--kg:rgba(99,102,241,.15)"><div class="kpi-lbl">End-Kapital</div><div class="kpi-val" id="kEndCap" style="font-size:1.1rem">–</div><div class="kpi-sub" id="kRisk">–</div></div>' +
            '<div class="kpi" style="--kc:#F59E0B;--kg:rgba(245,158,11,.15)"><div class="kpi-lbl">Long / Short</div><div class="kpi-val" id="kLongShort" style="font-size:1.25rem">–</div><div class="kpi-sub">Richtungen</div></div>' +
            '<div class="kpi" style="--kc:#14B8A6;--kg:rgba(20,184,166,.15)"><div class="kpi-lbl">H4-Filter</div><div class="kpi-val" style="font-size:.95rem;color:#10B981">BOS+H4</div><div class="kpi-sub">Strategie</div></div>';
        chartCard.insertAdjacentElement('beforebegin', kRow);
    }
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