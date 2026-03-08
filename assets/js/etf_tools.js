// ═══════════════════════════════════════════════════════════════
//  AU ETF Tools — etf_tools.js
//  Tabs: Compounding | Portfolio | Overlap | Retirement
//  Version: 2026-03-10-v4   ← bump this on each deploy to bust cache
// ═══════════════════════════════════════════════════════════════
const ETF_TOOLS_VERSION = '2026-03-10-v4';
console.info(`[ETF Tools] Loaded version ${ETF_TOOLS_VERSION}. Tax profiles: ATO 2025-26 Stage 3 rates (16/30/37/45%).`);

let etfData = null;
let currentTab = 'compound';
const NOW = new Date();
const CY = NOW.getFullYear();
const MOS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Debounce ─────────────────────────────────────────────────────
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const rerender = debounce(() => renderETFTools(), 60);

// ── Australian CPI by year (ABS 6401.0, calendar-year average, %) ────────────
// Used in historical mode so the inflation-adjustment uses REAL past CPI
// rather than a flat user assumption. 2025 is the current estimate.
const AU_CPI_YR = {
  2000:4.5, 2001:4.4, 2002:3.0, 2003:2.8, 2004:2.3, 2005:2.7,
  2006:3.5, 2007:2.3, 2008:4.4, 2009:1.8, 2010:2.8, 2011:3.3,
  2012:1.8, 2013:2.4, 2014:2.5, 2015:1.5, 2016:1.3, 2017:1.9,
  2018:1.9, 2019:1.6, 2020:0.9, 2021:3.8, 2022:7.8, 2023:5.4,
  2024:3.8, 2025:2.8
};

// ── Franking credit tax profiles ─────────────────────────────────
// Franking credits are tax offsets attached to dividends from Australian companies.
// The company has already paid 30% corporate tax; the credit refunds that to investors
// whose marginal rate is below 30% — and the FULL credit is refunded to tax-exempt
// entities (NFPs, charities, pension-phase super). This can substantially boost
// effective returns for low-tax investors.
// ── ATO 2025-26 resident rates (Stage 3 tax cuts apply from 1 Jul 2024) ──────
// Source: ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents
// Note: these rates EXCLUDE the 2% Medicare levy (which is added separately).
// Franking credit calculations use the statutory income tax rate only.
const TAX_PROFILES = {
  'nfp':    { label:'NFP / Charity (0%)',                  rate:0.00 },
  'pension':{ label:'Super — Pension Phase (0%)',           rate:0.00 },
  'super15':{ label:'Super — Accumulation (15%)',           rate:0.15 },
  'ind_0':  { label:'Individual — 0%  (≤$18,200)',          rate:0.00 },
  'ind_16': { label:'Individual — 16%  ($18,201–$45,000)',  rate:0.16 },
  'ind_30': { label:'Individual — 30%  ($45,001–$135,000)', rate:0.30 },
  'ind_37': { label:'Individual — 37%  ($135,001–$190,000)',rate:0.37 },
  'ind_45': { label:'Individual — 45%  (>$190,000)',        rate:0.45 },
};

// Returns historical annual returns for a ticker — uses _liveCache (data/stocks/) first
function getHistoricalReturns(ticker) {
  const key = ticker.replace('.AX', '');
  const cached = _liveCache[key];
  if (cached?.historicalReturns && Object.keys(cached.historicalReturns).length > 0)
    return cached.historicalReturns;
  return etfData?.etfs[key]?.historicalReturns || {};
}

// ── Days in month ─────────────────────────────────────────────────
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function dayOpts(y, m, sel) {
  const n = daysInMonth(y, m);
  return Array.from({length: n}, (_,i) => i+1)
    .map(d => `<option value="${d}" ${d===sel?'selected':''}>${d}</option>`).join('');
}

// ── State ─────────────────────────────────────────────────────────
let compState = {
  mode: 'projection', ticker: 'VAS',
  liveTickerInput: '',
  initial: 10000, monthly: 500,
  projStartDay: 1, projStartMonth: NOW.getMonth(), projStartYear: CY, years: 20,
  histStartDay: 1,  histStartMonth: 0,  histStartYear: 2015,
  histEndDay: 31,   histEndMonth: 11,   histEndYear: CY - 1,
  drip: true,
  showInflation: false,
  inflationRate: 2.5,
  // Franking credits: only meaningful for AU equity ETFs (frankingPct > 0 in etf_data)
  frankingMode: false,
  taxProfile: 'ind_30',   // default: 30% (most common bracket, $45k–$135k)
  custom: { name:'My ETF', annualReturn:10.0, mer:0.20, dividendYield:2.0, inceptionYear:2015,
            frankingPct:0.0 },
  // Custom allocation — only used when ticker==='CUSTOM' and useCustomAlloc===true
  useCustomAlloc: false,
  customAlloc: { AU_SHARES:50, INTL_SHARES:20, US_SHARES:20, AU_BONDS:5, GLOBAL_BONDS:5, CASH:0 },
};

let holdings = [{ ticker:'VAS', amount:5000 }, { ticker:'NDQ', amount:3000 }];

let overlapState = { selected:['VGS','NDQ'], view:'sectors', drillA:'VGS', drillB:'NDQ' };

let retState = {
  preset: 'VDHG',
  portfolioValue: 500000, annualWithdrawal: 25000,
  retirementYears: 30, timing: 'start',
  inflationAdjust: true, inflationRate: 2.5,
  manualMER: null,
  useCustomAlloc: false,
  customAlloc: { AU_SHARES:36, INTL_SHARES:20, US_SHARES:17, AU_BONDS:6, GLOBAL_BONDS:16, CASH:5 },
  // Franking credits on AU Shares component
  frankingMode: false,
  taxProfile: 'ind_30',
  auFrankingPct: 0.75,   // fraction of AU share dividends that carry franking credits
  auDividendYield: 4.0,  // assumed AU equity dividend yield (% p.a.) for franking calc
};

// Auto-calc state: "what can I withdraw?" / "how much do I need?"
let retAutoState = {
  open: false,
  mode: 'withdrawal',   // 'withdrawal' = find max safe WD | 'portfolio' = find required PV
  portfolioInput: 500000,
  withdrawalInput: 25000,
  targetSuccess: 90,
};

// ── Colours ───────────────────────────────────────────────────────
const SEC_CLR = {
  'Financials':'#3b82f6','Materials':'#f59e0b','Health Care':'#10b981',
  'Industrials':'#8b5cf6','Consumer Staples':'#f97316','Energy':'#ef4444',
  'Real Estate':'#06b6d4','Consumer Discretionary':'#ec4899',
  'Comm. Services':'#84cc16','Info. Technology':'#6366f1',
  'Utilities':'#a78bfa','Other':'#94a3b8'
};
const PIE_CLR = ['#38bdf8','#4ade80','#f59e0b','#ec4899','#a78bfa','#f97316','#06b6d4','#84cc16','#ef4444','#10b981'];

// ── Helpers ───────────────────────────────────────────────────────
const fmtAUD = v => v>=1e6?`$${(v/1e6).toFixed(2)}M`:v>=1e3?`$${(v/1e3).toFixed(1)}k`:`$${Math.round(v).toLocaleString()}`;
const fmtDate = (d,m,y) => `${d} ${MOS[m]} ${y}`;

function getETF(ticker) {
  if (ticker==='CUSTOM') {
    // When useCustomAlloc is on, derive annualReturn from asset class weights + frankingPct from AU share weight
    let annualReturn = compState.custom.annualReturn;
    let frankingPct  = compState.custom.frankingPct || 0;
    if (compState.useCustomAlloc && etfData?.assetClassReturns) {
      const alloc = compState.customAlloc;
      const allocLabelsRet = {'AU_SHARES':'AU Shares','INTL_SHARES':'Intl (ex-US)','US_SHARES':'US Shares',
                               'AU_BONDS':'AU Bonds','GLOBAL_BONDS':'Global Bonds','CASH':'Cash'};
      // Long-run averages per asset class (same as retirement model)
      const longRunAvg = { AU_SHARES:9.5, INTL_SHARES:9.8, US_SHARES:10.8, AU_BONDS:4.0, GLOBAL_BONDS:3.5, CASH:2.5 };
      annualReturn = Object.entries(alloc).reduce((s,[k,w])=>s+(w/100)*(longRunAvg[k]??7), 0);
      // Franking: proportional to AU shares weight × typical 75% franked
      frankingPct = Math.min(1, (alloc.AU_SHARES||0)/100 * 0.75 / ((compState.custom.dividendYield||2)/100||0.02));
      frankingPct = Math.min(1, (alloc.AU_SHARES||0)/100 * 0.75);
    }
    return {
      name: compState.custom.name, issuer:'Custom',
      annualReturn, mer: compState.custom.mer,
      dividendYield: compState.custom.dividendYield,
      inceptionYear: compState.custom.inceptionYear,
      frankingPct,
      historicalReturns:{}, topHoldings:[], sectors:{'Other':100}
    };
  }
  if (ticker==='LIVE') {
    // Live ticker from _liveCache — fetched via fetchLiveTicker from data/stocks/
    const key = compState.liveTickerInput.trim().toUpperCase().replace('.AX','');
    const cached = _liveCache[key];
    return {
      name: cached?.name || key,
      issuer: cached?.issuer || 'ASX Live',
      annualReturn: cached?.annualReturn || 10.0,
      mer: cached?.mer || 0.0,
      dividendYield: cached?.dividendYield || 0.0,
      inceptionYear: 2000,
      historicalReturns: cached?.historicalReturns || {},
      topHoldings: [], sectors: {'Other': 100},
      isLive: true, liveKey: key
    };
  }
  return etfData?.etfs[ticker] ?? null;
}

// ── Monthly compounding with day-precision ─────────────────────────
// Data is annual — intra-year returns are linearly interpolated per day.
// A partial first/last month uses (daysInPeriod/daysInMonth) fraction.
function calcMonthly() {
  const { mode, ticker, initial, monthly,
    projStartDay, projStartMonth, projStartYear, years,
    histStartDay, histStartMonth, histStartYear,
    histEndDay,   histEndMonth,   histEndYear, drip } = compState;
  const etf = getETF(ticker);
  if (!etf) return [];
  // Use live price cache returns if available, fall back to stored historicalReturns
  const historicalRets = ticker === 'LIVE'
    ? (getHistoricalReturns(compState.liveTickerInput.trim().toUpperCase()) ?? {})
    : getHistoricalReturns(ticker);
  const data = [];
  let bal = initial, contrib = initial, divs = 0;

  // Build list of months to step through + their calendar year for return lookup
  // Each element: { calYear, frac (0-1, fraction of month to apply), label, snap }
  let months = [];

  if (mode === 'projection') {
    const totalFullMonths = years * 12;
    const startMonthDays = daysInMonth(projStartYear, projStartMonth);
    const startFrac = (startMonthDays - projStartDay + 1) / startMonthDays;
    months.push({ y: projStartYear, m: projStartMonth, frac: startFrac,
      label: fmtDate(projStartDay, projStartMonth, projStartYear), snapBefore: true,
      ts: new Date(projStartYear, projStartMonth, projStartDay).getTime() });

    for (let i = 0; i < totalFullMonths; i++) {
      const d = new Date(projStartYear, projStartMonth + 1 + i);
      // Use last day of month as the end-of-month timestamp
      const lastDay = daysInMonth(d.getFullYear(), d.getMonth());
      months.push({ y: d.getFullYear(), m: d.getMonth(), frac: 1.0,
        label: fmtDate(1, d.getMonth(), d.getFullYear()), snapBefore: false,
        ts: new Date(d.getFullYear(), d.getMonth(), lastDay).getTime() });
    }
    months[months.length-1].labelAfter = fmtDate(projStartDay, projStartMonth, projStartYear + years);

  } else {
    // Historical: day-exact range
    const sm = daysInMonth(histStartYear, histStartMonth);
    const startFrac = (sm - histStartDay + 1) / sm;
    months.push({ y: histStartYear, m: histStartMonth, frac: startFrac,
      label: fmtDate(histStartDay, histStartMonth, histStartYear), snapBefore: true,
      ts: new Date(histStartYear, histStartMonth, histStartDay).getTime() });

    let cy = histStartYear, cm = histStartMonth + 1;
    if (cm > 11) { cm = 0; cy++; }
    while (cy < histEndYear || (cy === histEndYear && cm < histEndMonth)) {
      const lastDay = daysInMonth(cy, cm);
      months.push({ y: cy, m: cm, frac: 1.0,
        label: fmtDate(1, cm, cy), snapBefore: false,
        ts: new Date(cy, cm, lastDay).getTime() });
      cm++;
      if (cm > 11) { cm = 0; cy++; }
    }

    if (!(histEndYear === histStartYear && histEndMonth === histStartMonth)) {
      const em = daysInMonth(histEndYear, histEndMonth);
      const endFrac = histEndDay / em;
      months.push({ y: histEndYear, m: histEndMonth, frac: endFrac,
        label: fmtDate(histEndDay, histEndMonth, histEndYear), snapBefore: false, isLast: true,
        ts: new Date(histEndYear, histEndMonth, histEndDay).getTime() });
    }
  }

  // Push starting snapshot
  let monthsElapsed = 0;
  let cpiAccum = 1.0;   // tracks cumulative price level from start date
  let frankingCum = 0;  // cumulative franking credit cash received
  data.push({ date: months[0].label, label: months[0].label,
    value: Math.round(bal), contributions: Math.round(contrib), dividends: Math.round(divs),
    inflAdj: Math.round(bal), frankingCum: 0,
    isDivPayment: false, ts: months[0].ts });

  // Franking credit setup
  // Additional annual cash per $1 of balance = dividendYield × frankingPct × (30/70) × (1 − margRate)
  // This is the portion of the 30% corporate tax that is refunded to investors below that rate.
  const frankingPct   = compState.frankingMode ? (etf.frankingPct || 0) : 0;
  const margRate      = TAX_PROFILES[compState.taxProfile]?.rate ?? 0.325;
  const CORP_TAX      = 0.30;
  const frankingBoostAnnual = (etf.dividendYield / 100) * frankingPct * (CORP_TAX / (1 - CORP_TAX)) * (1 - margRate);

  for (let i = 0; i < months.length; i++) {
    const mo = months[i];
    const rawReturn = mode==='historical'
      ? (historicalRets[mo.y] ?? etf.annualReturn)
      : etf.annualReturn;

    // ── MER treatment ──────────────────────────────────────────────
    // Historical returns from fund prices already net of MER; projection uses gross estimate.
    const merDeduction = mode === 'historical' ? 0 : (etf.mer / 100);
    const divDeduction = drip ? 0 : (etf.dividendYield / 100);

    const netAnnual = (rawReturn / 100) - merDeduction - divDeduction;
    const mRate = Math.pow(1 + netAnnual, mo.frac / 12) - 1;
    const mDiv  = drip ? 0 : bal * (etf.dividendYield / 100) * mo.frac / 12;
    bal = bal * (1 + mRate) + monthly * mo.frac;
    contrib += monthly * mo.frac;
    divs += mDiv;

    // ── Franking credit cash (reinvested each month) ──────────────
    // The ATO refund is effectively annual; we distribute it monthly for smoothness.
    const frankingCashMonth = bal * frankingBoostAnnual * mo.frac / 12;
    if (frankingPct > 0) { bal += frankingCashMonth; frankingCum += frankingCashMonth; }

    monthsElapsed += mo.frac;

    // ── Inflation adjustment ──────────────────────────────────────
    // Historical mode: use real ABS CPI year-by-year (AU_CPI_YR lookup)
    // Projection mode: use user's flat CPI assumption
    const yearCPI = mode === 'historical'
      ? (AU_CPI_YR[mo.y] ?? 2.7)   // 2.7 = long-run Aus average for years not in table
      : compState.inflationRate;
    cpiAccum *= Math.pow(1 + yearCPI / 100, mo.frac / 12);
    const inflAdj = Math.round(bal / cpiAccum);

    const nextMo = months[i+1];
    const isYearBoundary = !nextMo || nextMo.m === 0;
    const isLast = i === months.length - 1;
    const xAxisLabel = mo.isLast ? mo.label : (isLast ? mo.label : (isYearBoundary ? `${mo.y}` : null));
    const isDivPayment = !drip && [1,4,7,10].includes(mo.m);

    data.push({
      date: mo.label, label: xAxisLabel,
      value: Math.round(bal),
      contributions: Math.round(contrib),
      dividends: Math.round(divs),
      inflAdj, frankingCum: Math.round(frankingCum),
      isDivPayment, ts: mo.ts
    });
  }

  return data;
}

// ── Interactive SVG chart ──────────────────────────────────────────
let _lastCompData = [];
let _lastRetData  = null; // {sims, retirementYears}

function buildChart(data, drip, svgId, tipId) {
  const showInfl = compState.showInflation;
  const P={t:12,r:12,b:40,l:68}, W=820, H=270, cw=W-P.l-P.r, ch=H-P.t-P.b;
  const maxV = Math.max(...data.map(d=>d.value), showInfl ? Math.max(...data.map(d=>d.inflAdj||0)) : 0, 1);
  const xs = i => (i / Math.max(data.length-1,1)) * cw;
  const ys = v => ch - Math.min(v/maxV,1)*ch;

  const line = (key,col,dash='') => {
    const d = data.map((p,i)=>`${i===0?'M':'L'}${xs(i).toFixed(1)},${ys(p[key]).toFixed(1)}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${dash?1.5:2.5}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
  };

  const yTicks  = [0,.25,.5,.75,1].map(t=>({y:ch-t*ch, lbl:fmtAUD(t*maxV)}));
  const labeled = data.filter(d=>d.label);
  const step    = Math.max(1, Math.ceil(labeled.length/9));
  const xLabels = labeled.filter((_,i)=>i%step===0||i===labeled.length-1);

  const divDots = !drip ? data
    .map((p,i) => ({p,i}))
    .filter(({p}) => p.isDivPayment && p.dividends > 0)
    .map(({p,i}) => {
      const x = xs(i).toFixed(1), y = ys(p.dividends).toFixed(1);
      return `<polygon points="${x},${(Number(y)-5).toFixed(1)} ${(Number(x)+4).toFixed(1)},${y} ${x},${(Number(y)+5).toFixed(1)} ${(Number(x)-4).toFixed(1)},${y}"
        fill="#f59e0b" opacity="0.85" class="div-marker" data-idx="${i}"/>`;
    }).join('') : '';

  return `<div style="position:relative;">
  <svg id="${svgId}" width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible;display:block;cursor:crosshair;">
    <rect width="${W}" height="${H}" fill="#020818" rx="8"/>
    <g transform="translate(${P.l},${P.t})">
      ${yTicks.map(t=>`
        <line x1="0" y1="${t.y.toFixed(1)}" x2="${cw}" y2="${t.y.toFixed(1)}" stroke="#1e293b" stroke-dasharray="3,3"/>
        <text x="-8" y="${(t.y+4).toFixed(1)}" text-anchor="end" fill="#475569" font-size="10" font-family="monospace">${t.lbl}</text>
      `).join('')}
      ${xLabels.map(d=>{
        const i=data.indexOf(d); const x=xs(i).toFixed(1);
        return `<line x1="${x}" y1="0" x2="${x}" y2="${ch}" stroke="#1e293b" stroke-dasharray="3,3"/>
        <text x="${x}" y="${ch+22}" text-anchor="middle" fill="#475569" font-size="9">${d.label}</text>`;
      }).join('')}
      ${line('contributions','#38bdf8','5,4')}
      ${line('value','#4ade80')}
      ${showInfl ? line('inflAdj','#fb923c','4,3') : ''}
      ${!drip ? line('dividends','#f59e0b','2,3') : ''}
      ${divDots}
      <line id="${svgId}-xline" x1="0" y1="0" x2="0" y2="${ch}" stroke="#475569" stroke-width="1" opacity="0" pointer-events="none"/>
      <rect id="${svgId}-overlay" x="0" y="0" width="${cw}" height="${ch}" fill="transparent"
        data-svg="${svgId}" data-tip="${tipId}" data-pl="${P.l}" data-cw="${cw}" data-len="${data.length}" data-type="comp"/>
    </g>
  </svg>
  <div id="${tipId}" style="display:none;position:absolute;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:.6rem .8rem;font-size:.75rem;pointer-events:none;z-index:100;min-width:170px;box-shadow:0 4px 20px rgba(0,0,0,.5);white-space:nowrap;"></div>
  </div>`;
}

function buildRetChart(sims, retirementYears) {
  const P={t:12,r:12,b:40,l:68}, W=820,H=270, cw=W-P.l-P.r, ch=H-P.t-P.b;
  const pv = retState.portfolioValue;
  const maxV = Math.max(...sims.flatMap(s=>s.path.map(p=>p.v)), pv, 1);
  const xs=(i,len)=>(i/Math.max(len-1,1))*cw, ys=v=>ch-Math.min(v/maxV,1)*ch;
  const yTicks=[0,.25,.5,.75,1].map(t=>({y:ch-t*ch,lbl:fmtAUD(t*maxV)}));
  const xLabels=Array.from({length:retirementYears+1},(_,i)=>i)
    .filter((_,i,a)=>i%Math.max(1,Math.ceil(a.length/8))===0||i===retirementYears);

  return `<div style="position:relative;">
  <svg id="ret-svg" width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible;display:block;cursor:crosshair;">
    <rect width="${W}" height="${H}" fill="#020818" rx="8"/>
    <g transform="translate(${P.l},${P.t})">
      ${yTicks.map(t=>`<line x1="0" y1="${t.y.toFixed(1)}" x2="${cw}" y2="${t.y.toFixed(1)}" stroke="#1e293b" stroke-dasharray="3,3"/>
        <text x="-8" y="${(t.y+4).toFixed(1)}" text-anchor="end" fill="#475569" font-size="10" font-family="monospace">${t.lbl}</text>`).join('')}
      ${xLabels.map(yr=>{const x=(yr/retirementYears*cw).toFixed(1);return `<line x1="${x}" y1="0" x2="${x}" y2="${ch}" stroke="#1e293b" stroke-dasharray="3,3"/>
        <text x="${x}" y="${ch+22}" text-anchor="middle" fill="#475569" font-size="9">Yr ${yr}</text>`;}).join('')}
      ${sims.map(s=>{const d=s.path.map((p,i)=>`${i===0?'M':'L'}${xs(i,s.path.length).toFixed(1)},${ys(p.v).toFixed(1)}`).join(' ');
        return `<path d="${d}" fill="none" stroke="${s.survived?'rgba(74,222,128,.28)':'rgba(239,68,68,.22)'}" stroke-width="1"/>`;}).join('')}
      <line x1="0" y1="${ys(pv).toFixed(1)}" x2="${cw}" y2="${ys(pv).toFixed(1)}" stroke="#334155" stroke-width="1" stroke-dasharray="6,3"/>
      <line id="ret-svg-xline" x1="0" y1="0" x2="0" y2="${ch}" stroke="#475569" stroke-width="1" opacity="0" pointer-events="none"/>
      <rect id="ret-svg-overlay" x="0" y="0" width="${cw}" height="${ch}" fill="transparent"
        data-svg="ret-svg" data-tip="ret-tip" data-pl="${P.l}" data-cw="${cw}" data-len="${sims[0]?.path.length||0}" data-type="ret"/>
    </g>
  </svg>
  <div id="ret-tip" style="display:none;position:absolute;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:.6rem .8rem;font-size:.75rem;pointer-events:none;z-index:100;min-width:180px;box-shadow:0 4px 20px rgba(0,0,0,.5);white-space:nowrap;"></div>
  </div>`;
}

function attachChartListeners() {
  document.querySelectorAll('[id$="-overlay"]').forEach(overlay => {
    const svgId = overlay.dataset.svg;
    const tipId = overlay.dataset.tip;
    const padL  = parseFloat(overlay.dataset.pl);
    const cw    = parseFloat(overlay.dataset.cw);
    const type  = overlay.dataset.type;
    const xline = document.getElementById(`${svgId}-xline`);
    const tip   = document.getElementById(tipId);
    const svgEl = document.getElementById(svgId);
    if (!tip || !svgEl) return;

    overlay.addEventListener('mousemove', e => {
      const rect  = svgEl.getBoundingClientRect();
      const scX   = 820 / rect.width;
      const rawX  = (e.clientX - rect.left) * scX - padL;
      const frac  = Math.max(0, Math.min(1, rawX / cw));

      if (type === 'comp') {
        // Fractional index → interpolate between adjacent monthly data points
        const exactIdx = frac * (_lastCompData.length - 1);
        const lo  = Math.floor(exactIdx);
        const hi  = Math.min(lo + 1, _lastCompData.length - 1);
        const t   = exactIdx - lo;            // 0–1 interpolation factor
        const loP = _lastCompData[lo];
        const hiP = _lastCompData[hi];
        if (!loP) return;

        // Linearly interpolate values
        const value         = Math.round(loP.value         + t * (hiP.value         - loP.value));
        const contributions = Math.round(loP.contributions + t * (hiP.contributions - loP.contributions));
        const dividends     = Math.round(loP.dividends     + t * (hiP.dividends     - loP.dividends));
        const inflAdj       = Math.round((loP.inflAdj||loP.value) + t * ((hiP.inflAdj||hiP.value) - (loP.inflAdj||loP.value)));
        const frankingCum   = Math.round((loP.frankingCum||0) + t * ((hiP.frankingCum||0) - (loP.frankingCum||0)));

        // Interpolate timestamp → daily date string
        let dateStr = loP.date;
        if (loP.ts && hiP.ts) {
          const ts = loP.ts + t * (hiP.ts - loP.ts);
          const d  = new Date(ts);
          dateStr  = `${d.getDate()} ${MOS[d.getMonth()]} ${d.getFullYear()}`;
        }

        if (xline) { xline.setAttribute('x1',(frac*cw).toFixed(1)); xline.setAttribute('x2',(frac*cw).toFixed(1)); xline.setAttribute('opacity','0.5'); }
        let h = `<div style="color:#94a3b8;margin-bottom:.3rem;font-weight:600;">${dateStr}</div>`;
        h += `<div style="color:#4ade80;">Value: <strong>${fmtAUD(value)}</strong></div>`;
        if (compState.showInflation) h += `<div style="color:#fb923c;">Real (${compState.mode==='historical'?'ABS CPI':compState.inflationRate+'%'}): <strong>${fmtAUD(inflAdj)}</strong></div>`;
        h += `<div style="color:#38bdf8;">Contributed: ${fmtAUD(contributions)}</div>`;
        h += `<div style="color:#f59e0b;">Gains: ${fmtAUD(value - contributions)}</div>`;
        if (compState.frankingMode && frankingCum > 0) h += `<div style="color:#fbbf24;">Franking received: ${fmtAUD(frankingCum)}</div>`;
        if (!compState.drip && dividends) {
          h += `<div style="color:#a78bfa;">Cumulative Dividends: ${fmtAUD(dividends)}</div>`;
          if (loP.isDivPayment && t < 0.5) h += `<div style="color:#f59e0b;font-size:.68rem;">◆ Dividend payment month</div>`;
        }
        tip.innerHTML = h;
      } else if (type === 'ret' && _lastRetData) {
        const { sims } = _lastRetData;
        const pathLen = sims[0]?.path.length || 0;
        const idx = Math.round(frac * (pathLen - 1));
        if (xline) { xline.setAttribute('x1',(frac*cw).toFixed(1)); xline.setAttribute('x2',(frac*cw).toFixed(1)); xline.setAttribute('opacity','0.5'); }
        const yr = idx;
        const vals = sims.map(s=>s.path[idx]?.v||0).filter(v=>v>0);
        if (!vals.length) { tip.style.display='none'; return; }
        vals.sort((a,b)=>a-b);
        const median = vals[Math.floor(vals.length/2)];
        const p10    = vals[Math.floor(vals.length*.1)];
        const p90    = vals[Math.floor(vals.length*.9)];
        const aliveN = vals.length;
        let h = `<div style="color:#94a3b8;margin-bottom:.3rem;font-weight:600;">Year ${yr} of retirement</div>`;
        h += `<div style="color:#4ade80;">Median: <strong>${fmtAUD(median)}</strong></div>`;
        h += `<div style="color:#94a3b8;font-size:.7rem;">10th pct: ${fmtAUD(p10)} · 90th pct: ${fmtAUD(p90)}</div>`;
        h += `<div style="color:${aliveN===sims.length?'#4ade80':'#f59e0b'};">Still surviving: ${aliveN}/${sims.length}</div>`;
        tip.innerHTML = h;
      }

      const tipW = 200;
      const lx = e.clientX - rect.left + 14;
      tip.style.left  = (lx + tipW > rect.width) ? `${lx - tipW - 20}px` : `${lx}px`;
      tip.style.top   = `${Math.max(0, e.clientY - rect.top - 30)}px`;
      tip.style.display = 'block';
    });
    overlay.addEventListener('mouseleave', () => {
      if (tip) tip.style.display = 'none';
      if (xline) xline.setAttribute('opacity', '0');
    });
  });
}

// ── SVG donut ──────────────────────────────────────────────────────
function donut(slices, colors, sz) {
  const cx=sz/2, cy=sz/2, r=sz*.38, tot=slices.reduce((s,v)=>s+v,0);
  if (!tot) return '';
  let a=-Math.PI/2;
  return `<svg width="100%" viewBox="0 0 ${sz} ${sz}">${slices.map((v,i)=>{
    const sw=(v/tot)*2*Math.PI;
    const x1=(cx+r*Math.cos(a)).toFixed(2), y1=(cy+r*Math.sin(a)).toFixed(2);
    a+=sw;
    const x2=(cx+r*Math.cos(a)).toFixed(2), y2=(cy+r*Math.sin(a)).toFixed(2);
    return `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${sw>Math.PI?1:0},1 ${x2},${y2} Z" fill="${colors[i%colors.length]}" opacity=".9"/>`;
  }).join('')}</svg>`;
}

// ── Shared UI primitives ───────────────────────────────────────────
// Live lookup cache: stores ETF-like objects fetched from /data/stocks/
const _liveCache = {};
let _stockIndex = null;  // populated on first lookup

async function fetchStockIndex() {
  if (_stockIndex) return _stockIndex;
  try {
    const r = await fetch('/data/stocks/index.json');
    if (r.ok) { _stockIndex = await r.json(); return _stockIndex; }
  } catch(e) {}
  _stockIndex = { stocks: [] };
  return _stockIndex;
}

async function fetchLiveTicker(rawTicker) {
  // Normalise: "CBA" → "CBA.AX", "CBA.AX" → "CBA.AX"
  const key = rawTicker.trim().toUpperCase();
  const axKey = key.endsWith('.AX') ? key : `${key}.AX`;
  const shortKey = axKey.replace('.AX', '');

  if (_liveCache[shortKey]) return _liveCache[shortKey];

  // Try to load from pre-generated stock file
  const el = document.getElementById('live-ticker-status');
  if (el) el.textContent = `Fetching ${shortKey}…`;
  try {
    const r = await fetch(`/data/stocks/${axKey}.json`);
    if (r.ok) {
      const d = await r.json();
      // Convert to our internal ETF format
      const etf = {
        name: d.name,
        issuer: d.sector || 'ASX',
        annualReturn: d.annualReturn || 0,
        mer: d.mer || 0,
        dividendYield: d.dividendYield || 0,
        inceptionYear: 2000,
        historicalReturns: d.historicalReturns || {},
        topHoldings: [],
        sectors: { [d.sector||'Other']: 100 },
        _weeklyPrices: d.weeklyPrices || [],
        _isLive: true,
        _lastUpdated: d.lastUpdated,
      };
      _liveCache[shortKey] = etf;
      if (el) el.textContent = `✓ ${d.name.slice(0,30)} (updated ${d.lastUpdated})`;
      return etf;
    } else {
      if (el) el.textContent = `⚠ ${shortKey} not in pre-fetched list. Run the daily update script to add it.`;
    }
  } catch(e) {
    if (el) el.textContent = `✗ Could not load ${shortKey}`;
  }
  return null;
}

function tickerOpts(sel, custom=false) {
  const G = {
    'AU Shares':['VAS','A200','IOZ','STW','VHY','MVW','VAP','MVA','ATEC'],
    'International':['VGS','BGBL','IVV','VTS','NDQ','QUAL','MOAT','VESG',
                     'VGAD','IHVV','HNDQ','ASIA','DJRE','IEM','F100'],
    'Diversified':['VDHG','DHHF','VDGR','VDBA','VDCO'],
    'Thematic':['HACK','ETHI','SEMI','CLNE','RBTZ','URNM','GEAR'],
    'Fixed Income / Other':['VAF','QAU','QPON'],
    'Actively Managed / LICs':['AFI','ARG','WAM','WGB','MFF','PMC'],
  };
  let h='';
  for(const[g,ts] of Object.entries(G)){
    const v=ts.filter(t=>etfData.etfs[t]); if(!v.length) continue;
    h+=`<optgroup label="${g}">${v.map(t=>`<option value="${t}" ${t===sel?'selected':''}>${t} — ${etfData.etfs[t].name}</option>`).join('')}</optgroup>`;
  }
  if(custom) h+=`<option value="CUSTOM" ${'CUSTOM'===sel?'selected':''}>✏ Custom / Unlisted</option>`;
  return h;
}
const yrOpts=(f,t,s)=>Array.from({length:t-f+1},(_,i)=>f+i).map(y=>`<option value="${y}" ${y===s?'selected':''}>${y}</option>`).join('');
const moOpts=s=>MOS.map((m,i)=>`<option value="${i}" ${i===s?'selected':''}>${m}</option>`).join('');
const sc=(l,v,c,sz='1.4rem')=>`<div class="etf-stat-card"><div class="etf-stat-label">${l}</div><div class="etf-stat-value" style="color:${c};font-size:${sz};">${v}</div></div>`;
const dlRow=(...bs)=>`<div style="display:flex;gap:.75rem;justify-content:flex-end;margin-top:1rem;flex-wrap:wrap;">${bs.map(([id,l])=>`<button id="${id}" class="dl-btn">${l}</button>`).join('')}</div>`;

// ══════════════════════════════════════════════════════════════════
//  TAB 1 — COMPOUNDING
// ══════════════════════════════════════════════════════════════════
function renderCompounding() {
  const { mode, ticker, initial, monthly,
    projStartDay, projStartMonth, projStartYear, years,
    histStartDay, histStartMonth, histStartYear,
    histEndDay,   histEndMonth,   histEndYear, drip, custom, liveTickerInput,
    showInflation, inflationRate, frankingMode, taxProfile, useCustomAlloc, customAlloc } = compState;
  const etf = getETF(ticker);
  if (!etf) return `<p style="color:#ef4444;padding:2rem;">ETF data unavailable.</p>`;
  _lastCompData = calcMonthly();
  const final = _lastCompData[_lastCompData.length - 1] ?? {value:0,contributions:0,dividends:0,frankingCum:0};
  const durMo = mode==='projection' ? years*12
    : (() => {
        const a = new Date(histStartYear, histStartMonth, histStartDay);
        const b = new Date(histEndYear,   histEndMonth,   histEndDay);
        return (b - a) / (1000 * 60 * 60 * 24 * 30.44);
      })();
  const totalC = initial + monthly * durMo;
  const gains  = final.value - totalC;
  const incept = ticker==='CUSTOM' ? custom.inceptionYear : ticker==='LIVE' ? 2000 : (etf.inceptionYear||2000);
  const histRets = ticker==='LIVE'
    ? getHistoricalReturns(liveTickerInput.trim().toUpperCase())
    : getHistoricalReturns(ticker);
  const hasHist = ticker!=='CUSTOM' && Object.keys(histRets).length > 0;
  const liveTicker = liveTickerInput.trim().toUpperCase();
  const liveKey = liveTicker.replace('.AX', '');
  const liveLoaded = ticker==='LIVE' && !!_liveCache[liveKey];
  const livePending = ticker==='LIVE' && !_liveCache[liveKey] && !!liveTicker;

  // Franking: show button only for AU equity ETFs
  const frankingPct = etf.frankingPct || 0;
  const hasFranking  = frankingPct > 0;
  const margRate     = TAX_PROFILES[taxProfile]?.rate ?? 0.325;
  const CORP_TAX     = 0.30;
  // Annual effective boost per $1 for the chosen tax profile
  const frankingBoostAnnualPct = (etf.dividendYield / 100) * frankingPct * (CORP_TAX / (1 - CORP_TAX)) * (1 - margRate) * 100;

  // CPI description: project uses flat rate; historical uses real ABS data
  const cpiDesc = mode === 'historical'
    ? `Real ABS CPI used year-by-year (e.g. 7.8% in 2022, 0.9% in 2020)`
    : `2.5% = RBA mid-band target (2–3%). Long-run Aus avg ≈ 2.7% p.a. since 2000.`;

  return `<div>
  <!-- Mode / DRP / Inflation / Franking row -->
  <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1.2rem;align-items:center;">
    <div style="display:flex;gap:.5rem;">
      <button class="mode-btn ${mode==='projection'?'mode-active':''}" data-mode="projection">📈 Projection</button>
      <button class="mode-btn ${mode==='historical'?'mode-active':''}" data-mode="historical"
        ${!hasHist?'title="No year-by-year data — average return used throughout"':''}>📅 Historical</button>
    </div>
    <div style="display:flex;gap:.5rem;margin-left:auto;flex-wrap:wrap;">
      <button class="mode-btn ${drip?'mode-active':''}"  id="drip-on">DRP On ♻</button>
      <button class="mode-btn ${!drip?'mode-active':''}" id="drip-off">DRP Off 💸</button>
      <button class="mode-btn ${showInflation?'mode-active infl-active':''}" id="infl-toggle"
        title="${cpiDesc}">🏷 Real Value</button>
      ${showInflation?`<div style="display:flex;align-items:center;gap:.3rem;" title="${cpiDesc}">
        ${mode==='historical'
          ?`<span style="font-size:.75rem;color:#fb923c;">ABS CPI</span>`
          :`<input id="infl-rate" type="number" class="etf-input" style="width:56px;padding:.3rem .5rem;"
              value="${inflationRate}" min="0" max="20" step=".5"/>
            <span style="color:var(--text-secondary);font-size:.8rem;">% CPI</span>`}
      </div>`:''}
      ${hasFranking?`<button class="mode-btn ${frankingMode?'mode-active frank-active':''}" id="frank-toggle"
        title="Model Australian dividend imputation (franking credits). The company has already paid 30% corporate tax; credits below that rate are refunded to you."
        >🏦 Franking</button>`:''}
    </div>
  </div>
  ${showInflation?`<div style="font-size:.7rem;color:#94a3b8;background:rgba(251,146,60,.05);border:1px solid rgba(251,146,60,.15);border-radius:6px;padding:.45rem .8rem;margin-bottom:.75rem;">
    <strong style="color:#fb923c;">Real Value</strong> deflates by CPI so you see purchasing power in today's dollars.
    ${mode==='historical'
      ?`Uses <strong>real ABS CPI year-by-year</strong> (e.g. 7.8% in 2022, 0.9% in 2020, 3.8% in 2024). No user assumption needed.`
      :`<strong>2.5%</strong> = RBA's mid-band target (2–3%). Long-run Aus avg since 2000 ≈ 2.7% p.a.
        Other scenarios: 2.0% (low inflation era), 3.5% (late 1990s), 6–8% (1970s–80s).`}
  </div>`:''}
  ${frankingMode && hasFranking ? `<div style="background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.2);border-radius:8px;padding:.6rem 1rem;margin-bottom:1rem;">
    <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;margin-bottom:.5rem;">
      <div style="font-size:.78rem;color:var(--text-secondary);">Tax profile:</div>
      <select id="tax-profile" class="etf-select" style="flex:1;min-width:180px;">
        ${Object.entries(TAX_PROFILES).map(([k,v])=>`<option value="${k}" ${k===taxProfile?'selected':''}>${v.label}</option>`).join('')}
      </select>
      <div style="font-size:.78rem;color:#fbbf24;">
        Franking: <strong>${(frankingPct*100).toFixed(0)}%</strong> franked
        &nbsp;→&nbsp; +<strong>${frankingBoostAnnualPct.toFixed(2)}%</strong> p.a. boost
      </div>
    </div>
    <div style="font-size:.7rem;color:#94a3b8;line-height:1.6;">
      <strong>How calculated:</strong>
      Boost = dividend yield × franked% × (30 ÷ 70) × (1 − marginal rate)<br>
      Companies pay 30% corporate tax before distributing dividends.
      The ATO returns this as a "franking credit" to investors.
      If your marginal rate is <em>below</em> 30%, the surplus is refunded in cash at tax time.
      At 0% (NFP, pension super, below threshold), the <em>entire</em> credit is returned — making
      franking worth +1–2% p.a. for eligible AU equity holdings at typical dividend yields.
      ${TAX_PROFILES[taxProfile]?.rate >= 0.30
        ? `At ${(TAX_PROFILES[taxProfile].rate*100).toFixed(0)}%, your rate equals or exceeds 30% — credits offset tax but generate no cash refund.`
        : `At ${(TAX_PROFILES[taxProfile]?.rate*100).toFixed(0)}%, a significant portion of the credit is refunded.`}
    </div>
  </div>` : ''}
  ${mode==='historical'&&!hasHist?`<div style="font-size:.75rem;color:#f59e0b;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:6px;padding:.5rem .8rem;margin-bottom:1rem;">
    ⚠ No year-by-year data for <strong>${ticker==='LIVE'?liveTicker:ticker}</strong>. ${ticker==='LIVE'&&!liveLoaded&&liveTicker?'Stock file not yet fetched — run the GitHub Action to populate data/stocks/.':'All periods use the average return ('+etf.annualReturn+'%).'}
  </div>`:''}

  <!-- ETF selector + info box -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.2rem;" class="resp-grid-1">
    <div>
      <label class="etf-label">ETF / Share</label>
      <select id="comp-ticker" class="etf-select"><option value="">— Select —</option>${tickerOpts(ticker,true)}</select>
      <!-- Live ticker search -->
      <div style="margin-top:.5rem;display:flex;gap:.4rem;align-items:center;">
        <input id="live-ticker-input" class="etf-input" type="text" style="flex:1;font-family:monospace;text-transform:uppercase;"
          placeholder="Any ASX ticker, e.g. CBA, BHP…" value="${liveTickerInput}"
          title="Type any ASX ticker (or US ticker without .AX) and press Load"/>
        <button id="live-ticker-load" style="padding:.5rem .9rem;background:rgba(56,189,248,.1);border:1px solid #38bdf8;color:#38bdf8;border-radius:8px;cursor:pointer;font-size:.8rem;white-space:nowrap;">Load ↗</button>
      </div>
      <div style="font-size:.68rem;color:#334155;margin-top:.25rem;">
        Requires daily price files from GitHub Action. <span style="color:#475569;">Data from Yahoo Finance via yfinance.</span>
      </div>
    </div>
    <div class="etf-info-box">
      <div style="color:var(--dapi-blue);font-weight:600;font-size:.85rem;">
        ${etf.issuer}${ticker==='LIVE'?` <span style="color:#38bdf8;">${liveTicker}${liveLoaded?` · CAGR ${etf.annualReturn?.toFixed(1)}%`:''}</span>`
          :ticker!=='CUSTOM'?` <span style="color:#475569;font-weight:400;">· est. ${etf.inceptionYear}</span>`:''}
      </div>
      <div style="font-size:.8rem;color:var(--text-secondary);margin-top:.25rem;">
        ${ticker==='LIVE'&&liveLoaded
          ? `CAGR: <span style="color:var(--fitc-green);">${_liveCache[liveKey]?.annualReturn?.toFixed(1) ?? '—'}%</span> &nbsp;·&nbsp; MER: <span style="color:#ef4444;">not in dataset</span> &nbsp;·&nbsp; <span style="color:#f59e0b;">${Object.keys(_liveCache[liveKey]?.historicalReturns||{}).length} years of data</span>`
          : `Return: <span style="color:var(--fitc-green);">${etf.annualReturn}%</span> &nbsp;·&nbsp; MER: <span style="color:#ef4444;">${etf.mer}%</span> &nbsp;·&nbsp; Yield: <span style="color:#f59e0b;">${etf.dividendYield}%</span>`
        }
      </div>
      <div style="font-size:.72rem;color:#334155;margin-top:.2rem;">DRP ${drip?'On — dividends reinvested':'Off — dividends paid out'}</div>
      ${mode==='historical'?`<div style="font-size:.68rem;color:#475569;margin-top:.3rem;line-height:1.5;">
        Historical returns are <strong style="color:#94a3b8;">net of MER</strong> (already embedded in fund prices).<br>
        <span style="color:#f59e0b;">⚡ Run the GitHub Action</span> to replace estimates with real Yahoo Finance prices for maximum accuracy.
      </div>`:''}
      ${livePending?`<div style="font-size:.7rem;color:#f59e0b;margin-top:.3rem;">⚠ ${liveTicker} not loaded — press Load or run GitHub Action first.</div>`:''}
    </div>
  </div>

  <!-- Custom ETF panel -->
  ${ticker==='CUSTOM'?`<div style="background:#0a0f1e;border:1px dashed #334155;border-radius:8px;padding:1rem;margin-bottom:1.2rem;">
    <div class="etf-label" style="margin-bottom:.5rem;">Custom ETF / Portfolio parameters</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:.6rem;margin-bottom:.75rem;">
      <div><label class="etf-label">Name</label><input id="cust-name" class="etf-input" type="text" value="${custom.name}"/></div>
      <div><label class="etf-label">MER %</label><input id="cust-mer" class="etf-input" type="number" step=".01" value="${custom.mer}"/></div>
      <div><label class="etf-label">Yield %</label><input id="cust-yield" class="etf-input" type="number" step=".1" value="${custom.dividendYield}"/></div>
      <div><label class="etf-label">Inception Year</label><input id="cust-inception" class="etf-input" type="number" step="1" value="${custom.inceptionYear}"/></div>
      <div><label class="etf-label">Franking %</label><input id="cust-franking" class="etf-input" type="number" step="5" min="0" max="100" value="${((custom.frankingPct||0)*100).toFixed(0)}"
        title="What % of dividends carry franking credits? 0% = international/bonds. 75–100% = AU equity."/></div>
    </div>
    <!-- Return source: manual or allocation-derived -->
    <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;margin-bottom:.5rem;">
      <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.78rem;color:var(--text-secondary);">
        <input type="checkbox" id="cust-use-alloc" ${useCustomAlloc?'checked':''} style="accent-color:var(--dapi-blue);"/>
        Derive return from asset class allocation
      </label>
      <span style="font-size:.7rem;color:#475569;">
        (uses long-run asset class averages: AU eq 9.5%, Intl eq 10.2%, AU bonds 4.0%, Global bonds 3.5%, Cash 2.5%)
      </span>
    </div>
    ${useCustomAlloc?`
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:.5rem;margin-bottom:.4rem;" class="resp-grid-2">
      ${['AU_SHARES','INTL_SHARES','US_SHARES','AU_BONDS','GLOBAL_BONDS','CASH'].map(k=>{
        const labels={AU_SHARES:'AU Shares',INTL_SHARES:'Intl (ex-US)',US_SHARES:'US Shares',AU_BONDS:'AU Bonds',GLOBAL_BONDS:'Global Bonds',CASH:'Cash'};
        return `<div>
          <label class="etf-label">${labels[k]} <span id="lv-ca-${k}" style="color:var(--fitc-green);">${customAlloc[k]??0}%</span></label>
          <input type="number" id="ca-${k}" class="etf-input" value="${customAlloc[k]??0}" min="0" max="100" step="1"/>
          <input type="range" id="ca-${k}-r" class="etf-range" value="${customAlloc[k]??0}" min="0" max="100" step="1"/>
        </div>`;
      }).join('')}
    </div>
    <div style="font-size:.72rem;margin-top:.3rem;">
      Total: <span style="color:${Math.abs(Object.values(customAlloc).reduce((s,v)=>s+v,0)-100)<0.5?'#4ade80':'#ef4444'};">
        ${Object.values(customAlloc).reduce((s,v)=>s+v,0)}%
      </span>
      &nbsp;→&nbsp; Blended return: <span style="color:var(--fitc-green);">
        ${(['AU_SHARES','INTL_SHARES','US_SHARES','AU_BONDS','GLOBAL_BONDS','CASH'].reduce((s,k)=>
          s+((customAlloc[k]??0)/100)*({AU_SHARES:9.5,INTL_SHARES:9.8,US_SHARES:10.8,AU_BONDS:4.0,GLOBAL_BONDS:3.5,CASH:2.5}[k]??7),0
        )).toFixed(2)}% p.a.
      </span>
    </div>`:`
    <div>
      <label class="etf-label">Return % <span style="font-size:.68rem;color:#475569;text-transform:none;">(manual override)</span></label>
      <input id="cust-return" class="etf-input" type="number" step=".1" value="${custom.annualReturn}" style="width:120px;"/>
    </div>`}
  </div>`:''}

  <!-- Input grid -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1.2rem;" class="resp-grid-1">
    <div>
      <label class="etf-label">Initial ($AUD) <span id="lv-initial" style="color:var(--fitc-green);float:right;">${fmtAUD(initial)}</span></label>
      <input type="number" id="comp-initial" class="etf-input" value="${initial}" min="0" step="500"/>
      <input type="range" id="comp-initial-r" class="etf-range" value="${initial}" min="0" max="1000000" step="500"/>
    </div>
    <div>
      <label class="etf-label">Monthly ($AUD) <span id="lv-monthly" style="color:var(--fitc-green);float:right;">${fmtAUD(monthly)}</span></label>
      <input type="number" id="comp-monthly" class="etf-input" value="${monthly}" min="0" step="100"/>
      <input type="range" id="comp-monthly-r" class="etf-range" value="${monthly}" min="0" max="10000" step="100"/>
    </div>
    ${mode==='projection'?`
    <div>
      <label class="etf-label">Years <span id="lv-years" style="color:var(--fitc-green);float:right;">${years} yrs</span></label>
      <input type="number" id="comp-years" class="etf-input" value="${years}" min="1" max="60" step="1"/>
      <input type="range" id="comp-years-r" class="etf-range" value="${years}" min="1" max="60" step="1"/>
      <div style="margin-top:.6rem;">
        <label class="etf-label" style="margin-bottom:.3rem;">Start Date</label>
        <div style="display:flex;gap:.3rem;">
          <select id="proj-sd" class="etf-select" style="flex:1;">${dayOpts(projStartYear, projStartMonth, projStartDay)}</select>
          <select id="proj-sm" class="etf-select" style="flex:2;">${moOpts(projStartMonth)}</select>
          <select id="proj-sy" class="etf-select" style="flex:2;">${yrOpts(1990, CY+5, projStartYear)}</select>
        </div>
      </div>
    </div>`:`
    <div>
      <label class="etf-label">Date Range
        <span style="color:#475569;font-size:.65rem;text-transform:none;float:right;">day-level precision (annual data interpolated)</span>
      </label>
      <div style="font-size:.7rem;color:var(--text-secondary);margin-bottom:.4rem;">From:</div>
      <div style="display:flex;gap:.3rem;margin-bottom:.4rem;">
        <select id="hist-sd" class="etf-select" style="flex:1;">${dayOpts(histStartYear, histStartMonth, histStartDay)}</select>
        <select id="hist-sm" class="etf-select" style="flex:2;">${moOpts(histStartMonth)}</select>
        <select id="hist-sy" class="etf-select" style="flex:2;">${yrOpts(incept, CY-1, histStartYear)}</select>
      </div>
      <div style="font-size:.7rem;color:var(--text-secondary);margin-bottom:.4rem;">To:</div>
      <div style="display:flex;gap:.3rem;">
        <select id="hist-ed" class="etf-select" style="flex:1;">${dayOpts(histEndYear, histEndMonth, histEndDay)}</select>
        <select id="hist-em" class="etf-select" style="flex:2;">${moOpts(histEndMonth)}</select>
        <select id="hist-ey" class="etf-select" style="flex:2;">${yrOpts(incept, CY-1, histEndYear)}</select>
      </div>
    </div>`}
  </div>

  <!-- Summary cards -->
  <div style="display:grid;grid-template-columns:repeat(${frankingMode&&hasFranking ? (drip?4:5) : (drip?3:4)},1fr);gap:1rem;margin-bottom:1.2rem;" class="resp-grid-2">
    ${sc('Final Value',    fmtAUD(final.value), 'var(--fitc-green)')}
    ${sc('Contributed',    fmtAUD(totalC),       'var(--dapi-blue)')}
    ${sc('Gains',          fmtAUD(gains),         '#f59e0b')}
    ${!drip ? sc('Dividends Paid', fmtAUD(final.dividends), '#a78bfa') : ''}
    ${frankingMode&&hasFranking ? sc('Franking Credits', fmtAUD(final.frankingCum||0), '#fbbf24') : ''}
  </div>

  ${buildChart(_lastCompData, drip, 'comp-svg', 'comp-tip')}
  <div style="display:flex;gap:1.5rem;justify-content:center;flex-wrap:wrap;margin-top:.5rem;font-size:.75rem;color:var(--text-secondary);">
    <span><span style="color:#4ade80;">——</span> Portfolio Value (nominal)</span>
    <span><span style="color:#38bdf8;">- -</span> Contributed</span>
    ${showInflation?`<span><span style="color:#fb923c;">--</span> Real Value (${mode==='historical'?'ABS CPI':inflationRate+'%'} adj.)</span>`:''}
    ${!drip?`<span><span style="color:#f59e0b;">··</span> Dividends paid out &nbsp; <span style="color:#f59e0b;">◆</span> = quarterly payment</span>`:''}
  </div>
  ${dlRow(['dl-csv-comp','⬇ Data (CSV)'],['dl-png-comp','⬇ Chart (PNG)'])}
  <p style="font-size:.7rem;color:#475569;margin-top:.75rem;text-align:center;">
    ${mode==='historical'
      ?`Returns are approximate annual figures; intra-year returns linearly interpolated per day. Excludes tax, CGT, brokerage.
        ${showInflation?' Real Value uses actual ABS CPI by year.':''}
        ${frankingMode&&hasFranking?` Franking: ${TAX_PROFILES[taxProfile].label} profile applied.`:''}`
      :`Projected from historical average return. Past performance not indicative. Excludes tax, CGT.
        ${showInflation?` Real Value uses ${inflationRate}% p.a. CPI (RBA target: 2–3%).`:''}`}
  </p>
  </div>`;
}

// ══════════════════════════════════════════════════════════════════
//  TAB 2 — PORTFOLIO
// ══════════════════════════════════════════════════════════════════
function calcSectorTotals() {
  const tot=holdings.reduce((s,h)=>s+h.amount,0), acc={};
  holdings.forEach(h=>{ const e=etfData.etfs[h.ticker]; if(!e) return;
    Object.entries(e.sectors).forEach(([s,p])=>{ acc[s]=(acc[s]||0)+h.amount*p/100; }); });
  return Object.entries(acc).sort((a,b)=>b[1]-a[1])
    .map(([sector,value])=>({sector,value,pct:tot>0?((value/tot)*100).toFixed(1):'0.0'}));
}

function renderPortfolio() {
  const tot=holdings.reduce((s,h)=>s+h.amount,0), secs=calcSectorTotals();
  const wY=tot>0?(holdings.reduce((s,h)=>s+h.amount*(etfData.etfs[h.ticker]?.dividendYield||0),0)/tot).toFixed(2):'0.00';
  const wM=tot>0?(holdings.reduce((s,h)=>s+h.amount*(etfData.etfs[h.ticker]?.mer||0),0)/tot).toFixed(3):'0.000';
  const rows=holdings.map((h,i)=>{
    const e=etfData.etfs[h.ticker];
    return `<div style="display:flex;gap:.75rem;align-items:center;margin-bottom:.6rem;">
      <select class="holding-ticker etf-select" style="flex:2;" data-idx="${i}">${tickerOpts(h.ticker)}</select>
      <div style="flex:1;position:relative;">
        <span style="position:absolute;left:.7rem;top:50%;transform:translateY(-50%);color:var(--text-secondary);font-size:.85rem;">$</span>
        <input type="number" class="holding-amount etf-input" style="padding-left:1.5rem;" data-idx="${i}" value="${h.amount}" min="0" step="100"/>
      </div>
      <div style="flex:1;font-size:.78rem;color:var(--text-secondary);white-space:nowrap;">
        ${tot>0?`${((h.amount/tot)*100).toFixed(1)}%`:'—'}${e?` <span style="color:#334155;">· ${e.dividendYield}% yield</span>`:''}
      </div>
      <button class="holding-remove" data-idx="${i}" style="background:transparent;border:1px solid #ef4444;color:#ef4444;border-radius:6px;padding:.3rem .6rem;cursor:pointer;font-size:.8rem;">✕</button>
    </div>`;
  }).join('');

  return `<div>
    <div id="holdings-list">${rows}</div>
    <button id="add-holding" style="background:transparent;border:1px dashed #334155;color:var(--text-secondary);border-radius:8px;padding:.5rem 1rem;cursor:pointer;font-size:.85rem;width:100%;margin-bottom:1.5rem;">+ Add ETF</button>
    ${tot>0?`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1.5rem;">
      ${sc('Total',fmtAUD(tot),'var(--fitc-green)','1.2rem')}
      ${sc('Holdings',`${holdings.length} ETFs`,'var(--dapi-blue)','1.2rem')}
      ${sc('Wtd Yield',`${wY}%`,'#f59e0b','1.2rem')}
      ${sc('Wtd MER',`${wM}%`,'#a78bfa','1.2rem')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;">
      <div>
        <div class="etf-label" style="margin-bottom:.5rem;">ETF Allocation</div>
        ${donut(holdings.map(h=>h.amount),PIE_CLR,200)}
        <div style="margin-top:.5rem;">${holdings.map((h,i)=>`
          <div style="display:flex;align-items:center;gap:.5rem;font-size:.75rem;margin-bottom:.3rem;">
            <span style="width:9px;height:9px;border-radius:50%;background:${PIE_CLR[i%PIE_CLR.length]};display:inline-block;flex-shrink:0;"></span>
            <span style="color:#e2e8f0;">${h.ticker}</span>
            <span style="color:#475569;">${fmtAUD(h.amount)} · ${((h.amount/tot)*100).toFixed(1)}%</span>
          </div>`).join('')}</div>
      </div>
      <div>
        <div class="etf-label" style="margin-bottom:.5rem;">Sector Breakdown</div>
        <div style="max-height:320px;overflow-y:auto;">${secs.map(({sector,value,pct})=>`
          <div style="margin-bottom:.5rem;">
            <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:.2rem;">
              <span style="color:#e2e8f0;">${sector}</span>
              <span style="color:var(--text-secondary);">${pct}% · ${fmtAUD(value)}</span>
            </div>
            <div style="background:#1e293b;border-radius:4px;height:6px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${SEC_CLR[sector]||'#94a3b8'};border-radius:4px;transition:width .4s ease;"></div>
            </div>
          </div>`).join('')}</div>
      </div>
    </div>
    ${dlRow(['dl-csv-port','⬇ Breakdown (CSV)'])}`:''}
  </div>`;
}

// ══════════════════════════════════════════════════════════════════
//  TAB 3 — OVERLAP
// ══════════════════════════════════════════════════════════════════
function secOverlap(a, b) {
  const sA=etfData.etfs[a]?.sectors||{}, sB=etfData.etfs[b]?.sectors||{};
  const all=new Set([...Object.keys(sA),...Object.keys(sB)]);
  return parseFloat([...all].reduce((s,k)=>s+Math.min(sA[k]||0,sB[k]||0),0).toFixed(1));
}

function holdOverlap(a, b) {
  const eA = etfData.etfs[a], eB = etfData.etfs[b];
  const hA = Object.fromEntries((eA?.topHoldings||[]).map(h=>[h.ticker, h.weight]));
  const hB = Object.fromEntries((eB?.topHoldings||[]).map(h=>[h.ticker, h.weight]));
  const allKeys = new Set([...Object.keys(hA), ...Object.keys(hB)]);
  const score   = [...allKeys].reduce((s,k)=>s + Math.min(hA[k]||0, hB[k]||0), 0);
  const shared  = [...allKeys]
    .filter(t => hA[t] && hB[t])
    .sort((x,y) => Math.min(hA[y],hB[y]) - Math.min(hA[x],hB[x]));
  return { score: parseFloat(score.toFixed(1)), shared, hA, hB,
    hasDataA: (eA?.topHoldings||[]).length > 0,
    hasDataB: (eB?.topHoldings||[]).length > 0 };
}

function renderOverlap() {
  const { selected, view, drillA, drillB } = overlapState;
  const allT = Object.keys(etfData.etfs);
  const allSectors = [...new Set(selected.flatMap(t=>Object.keys(etfData.etfs[t]?.sectors||{})))].sort();

  const heatBg = v => v>=70?'rgba(239,68,68,.3)':v>=50?'rgba(245,158,11,.2)':v>=25?'rgba(56,189,248,.15)':'transparent';
  const heatFg = v => v>=70?'#fca5a5':v>=50?'#fcd34d':v>=25?'#7dd3fc':'#94a3b8';

  const pairMatrix = (scoreFn, label) => {
    if (selected.length < 2) return '';
    return `<div class="etf-label" style="margin:1.2rem 0 .6rem;">${label}</div>
    <div style="overflow-x:auto;">
    <table style="border-collapse:collapse;font-size:.8rem;">
      <thead><tr>
        <th style="padding:.5rem;text-align:left;color:var(--text-secondary);min-width:55px;"></th>
        ${selected.map(t=>`<th style="padding:.5rem;color:#e2e8f0;text-align:center;min-width:70px;">${t}</th>`).join('')}
      </tr></thead>
      <tbody>${selected.map(tA=>`<tr>
        <td style="padding:.5rem;color:#e2e8f0;font-weight:600;">${tA}</td>
        ${selected.map(tB=>{
          if(tA===tB) return `<td style="padding:.5rem;text-align:center;color:#334155;">—</td>`;
          const s=scoreFn(tA,tB);
          const noData = view==='holdings' && (!etfData.etfs[tA]?.topHoldings?.length || !etfData.etfs[tB]?.topHoldings?.length);
          if(noData) return `<td style="padding:.5rem;text-align:center;color:#475569;font-size:.72rem;">no data</td>`;
          return `<td style="padding:.5rem;text-align:center;background:${heatBg(s)};border-radius:4px;color:${heatFg(s)};font-weight:600;cursor:pointer;"
            class="pair-cell" data-a="${tA}" data-b="${tB}">${s}%</td>`;
        }).join('')}
      </tr>`).join('')}</tbody>
    </table></div>
    <div style="font-size:.72rem;color:#334155;margin-top:.4rem;">
      🔴 >70% high &nbsp; 🟡 50-70% moderate &nbsp; 🔵 25-50% low &nbsp; No colour: minimal.
      ${view==='holdings'?' Click a cell to drill into shared holdings.':''}
    </div>`;
  };

  const sectorGrid = selected.length>0 ? `
    <div class="etf-label" style="margin:1.2rem 0 .6rem;">Sector Allocation (%)</div>
    <div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:.78rem;width:100%;">
      <thead><tr>
        <th style="padding:.5rem .75rem;color:var(--text-secondary);text-align:left;min-width:160px;">Sector</th>
        ${selected.map(t=>`<th style="padding:.5rem;color:#e2e8f0;text-align:center;min-width:75px;">${t}</th>`).join('')}
      </tr></thead>
      <tbody>${allSectors.map(sec=>{
        const vals=selected.map(t=>etfData.etfs[t]?.sectors?.[sec]||0);
        if(!vals.some(v=>v>0)) return '';
        return `<tr style="border-top:1px solid #0f172a;">
          <td style="padding:.5rem .75rem;color:#94a3b8;">${sec}</td>
          ${vals.map(v=>`<td style="padding:.5rem;text-align:center;background:${v>=20?`rgba(99,102,241,${(v/100).toFixed(2)})`:'transparent'};border-radius:3px;">
            ${v>0?`<span style="color:${v>=20?'#e2e8f0':'#94a3b8'};font-weight:${v>=20?'600':'400'};">${v}%</span>`:`<span style="color:#1e293b;">—</span>`}
          </td>`).join('')}
        </tr>`;
      }).join('')}</tbody>
    </table></div>` : '';

  // Holdings drill-down: shows for any selected pair
  const validPairs = [];
  for(let i=0;i<selected.length;i++) for(let j=i+1;j<selected.length;j++) {
    if(etfData.etfs[selected[i]]?.topHoldings?.length && etfData.etfs[selected[j]]?.topHoldings?.length)
      validPairs.push([selected[i],selected[j]]);
  }

  const pairSelectorHtml = validPairs.length>1 ? `
    <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.75rem;flex-wrap:wrap;">
      <span class="etf-label" style="margin:0;">Drill into pair:</span>
      ${validPairs.map(([a,b])=>`<button class="mode-btn ${a===drillA&&b===drillB?'mode-active':''} drill-pair"
        data-a="${a}" data-b="${b}">${a} × ${b}</button>`).join('')}
    </div>` : '';

  const activeDrillA = validPairs.some(([a,b])=>a===drillA&&b===drillB) ? drillA : validPairs[0]?.[0];
  const activeDrillB = validPairs.some(([a,b])=>a===drillA&&b===drillB) ? drillB : validPairs[0]?.[1];

  let holdDrillHtml = '';
  if(view==='holdings' && activeDrillA && activeDrillB) {
    const ov = holdOverlap(activeDrillA, activeDrillB);
    if(!ov.hasDataA || !ov.hasDataB) {
      holdDrillHtml = `<p style="color:#f59e0b;font-size:.82rem;margin-top:.5rem;">
        ⚠ Holdings data not available for ${!ov.hasDataA?activeDrillA:activeDrillB}. This ETF does not publish individual position-level data in our dataset.
      </p>`;
    } else if(ov.shared.length===0) {
      holdDrillHtml = `<p style="color:var(--text-secondary);font-size:.82rem;margin-top:.5rem;">
        No shared individual holdings found between <strong>${activeDrillA}</strong> and <strong>${activeDrillB}</strong>.
        This is expected when comparing Australian-only vs international funds (different underlying stocks).
      </p>`;
    } else {
      holdDrillHtml = `
        <div class="etf-label" style="margin:.75rem 0 .5rem;">Shared Holdings: ${activeDrillA} × ${activeDrillB} — overlap score <span style="color:#f59e0b;">${ov.score}%</span></div>
        <div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:.78rem;width:100%;">
          <thead><tr style="border-bottom:1px solid #1e293b;">
            <th style="padding:.4rem .75rem;text-align:left;color:var(--text-secondary);">Holding</th>
            <th style="padding:.4rem .6rem;text-align:center;color:#38bdf8;">${activeDrillA}</th>
            <th style="padding:.4rem .6rem;text-align:center;color:#4ade80;">${activeDrillB}</th>
            <th style="padding:.4rem .6rem;text-align:center;color:#f59e0b;">Overlap</th>
          </tr></thead>
          <tbody>${ov.shared.map(t=>`<tr style="border-bottom:1px solid #0f172a;">
            <td style="padding:.4rem .75rem;color:#e2e8f0;font-weight:600;">${t}</td>
            <td style="padding:.4rem .6rem;text-align:center;color:#38bdf8;">${ov.hA[t].toFixed(1)}%</td>
            <td style="padding:.4rem .6rem;text-align:center;color:#4ade80;">${ov.hB[t].toFixed(1)}%</td>
            <td style="padding:.4rem .6rem;text-align:center;color:#f59e0b;">${Math.min(ov.hA[t],ov.hB[t]).toFixed(1)}%</td>
          </tr>`).join('')}</tbody>
        </table></div>
        <p style="font-size:.7rem;color:#475569;margin-top:.4rem;">
          Holdings reflect approximate top positions only. Score = sum of min(weightA, weightB) for shared names.
          Note: 0% is correct and expected when comparing AU-only vs international funds — they hold entirely different companies.
        </p>`;
    }
  }

  return `<div>
    <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:1rem;">Select 2–6 ETFs to compare. <strong>Sector view</strong> measures weighted sector allocation overlap. <strong>Holdings view</strong> checks individual stock overlap (only meaningful for funds with shared universe, e.g. two global ETFs).</p>
    <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem;">
      ${allT.map(t=>`<button class="overlap-toggle ${selected.includes(t)?'overlap-active':''}" data-ticker="${t}" title="${etfData.etfs[t].name}">${t}</button>`).join('')}
    </div>
    <div style="display:flex;gap:.5rem;margin-bottom:1rem;">
      <button class="mode-btn ${view==='sectors'?'mode-active':''}" id="ov-sectors">Sector View</button>
      <button class="mode-btn ${view==='holdings'?'mode-active':''}" id="ov-holdings">Holdings View</button>
    </div>
    ${selected.length<2?`<p style="color:var(--text-secondary);text-align:center;padding:2rem;">Select at least 2 ETFs above.</p>`:''}
    ${view==='sectors' ? pairMatrix(secOverlap, 'Pairwise Sector Overlap Score (%)') + sectorGrid : ''}
    ${view==='holdings' && selected.length>=2 ? pairMatrix((a,b)=>holdOverlap(a,b).score, 'Pairwise Holdings Overlap Score (%)') : ''}
    ${view==='holdings' && selected.length>=2 ? pairSelectorHtml + holdDrillHtml : ''}
  </div>`;
}

// ══════════════════════════════════════════════════════════════════
//  TAB 4 — RETIREMENT
// ══════════════════════════════════════════════════════════════════
function getEffectiveAlloc() {
  if (retState.useCustomAlloc) return retState.customAlloc;
  return etfData.portfolioPresets[retState.preset]?.allocation || { AU_SHARES:100 };
}
function getEffectiveMER() {
  if (retState.manualMER !== null) return retState.manualMER;
  return etfData.portfolioPresets[retState.preset]?.mer ?? 0.27;
}

// ── Retirement solver helpers ──────────────────────────────────────
// Run a quick sim without mutating retState — used by binary search
function simSuccessRate(portfolioValue, annualWithdrawal) {
  const {retirementYears, timing, inflationAdjust, inflationRate} = retState;
  const frankBoost = frankingBoostRet() / 100;
  const yrNums = Object.keys(etfData.assetClassReturns['AU_SHARES']).map(Number).sort((a,b)=>a-b);
  const maxStart = yrNums[yrNums.length-1] - retirementYears;
  let succN=0, total=0;
  for (const startYear of yrNums.filter(y=>y<=maxStart)) {
    let bal=portfolioValue, wd=annualWithdrawal, ok=true;
    for (let y=0; y<retirementYears; y++) {
      const ret = (compositeReturn(startYear+y)/100) + frankBoost;
      if (timing==='start') { bal-=wd; if(bal<=0){ok=false;break;} bal*=(1+ret); }
      else { bal*=(1+ret); bal-=wd; if(bal<=0){ok=false;break;} }
      if (inflationAdjust) wd*=(1+inflationRate/100);
    }
    if(ok) succN++; total++;
  }
  return total>0 ? (succN/total)*100 : 0;
}

// Binary search: max annual withdrawal achieving >= targetRate %
function solveWithdrawal(targetRate, portfolioVal) {
  let lo=1000, hi=portfolioVal*0.25, best=0;
  for (let i=0; i<44; i++) {
    const mid=(lo+hi)/2;
    if (simSuccessRate(portfolioVal, mid) >= targetRate) { best=mid; lo=mid; } else hi=mid;
  }
  return Math.round(best/100)*100;  // round to nearest $100
}

// Binary search: min portfolio achieving >= targetRate % for given annual withdrawal
function solvePortfolio(targetRate, annualWd) {
  let lo=10000, hi=20000000, best=hi;
  for (let i=0; i<44; i++) {
    const mid=(lo+hi)/2;
    if (simSuccessRate(mid, annualWd) >= targetRate) { best=mid; hi=mid; } else lo=mid;
  }
  return Math.round(best/1000)*1000;  // round to nearest $1k
}

function compositeReturn(year) {
  const alloc = getEffectiveAlloc();
  const gross = Object.entries(alloc).reduce((s,[k,w]) => {
    const ret = etfData.assetClassReturns[k]?.[year];
    return s + (w/100) * (ret ?? 7.0);
  }, 0);
  return gross - getEffectiveMER();
}

// Returns annual % franking boost based on AU Shares allocation weight
function frankingBoostRet() {
  if (!retState.frankingMode) return 0;
  const alloc = getEffectiveAlloc();
  const auWt   = (alloc.AU_SHARES || 0) / 100;
  const CORP   = 0.30;
  const marg   = TAX_PROFILES[retState.taxProfile]?.rate ?? 0.30;
  // Effective boost = AU weight × dividendYield × frankingPct × grossUpFactor × (1-margRate)
  return auWt * (retState.auDividendYield / 100) * retState.auFrankingPct * (CORP / (1 - CORP)) * (1 - marg) * 100;
}

function runSims() {
  const {portfolioValue,annualWithdrawal,retirementYears,timing,inflationAdjust,inflationRate} = retState;
  const yrNums = Object.keys(etfData.assetClassReturns['AU_SHARES']).map(Number).sort((a,b)=>a-b);
  const maxStart = yrNums[yrNums.length-1] - retirementYears;
  const frankBoost = frankingBoostRet() / 100;   // add to annual return

  return yrNums.filter(y=>y<=maxStart).map(startYear => {
    let bal=portfolioValue, wd=annualWithdrawal, survived=true, depletedYear=null;
    const path=[{yr:0, v:bal}];
    for(let y=0;y<retirementYears;y++){
      const calYr = startYear+y;
      const ret   = (compositeReturn(calYr) / 100) + frankBoost;
      if(timing==='start'){
        bal -= wd;
        if(bal<=0){ survived=false; depletedYear=calYr; bal=0; }
        else bal *= (1+ret);
      } else {
        bal *= (1+ret);
        bal -= wd;
        if(bal<=0){ survived=false; depletedYear=calYr; bal=0; }
      }
      if(inflationAdjust) wd *= (1+inflationRate/100);
      path.push({yr:y+1, v:Math.max(0,Math.round(bal)), calYr:calYr+1});
      if(!survived){
        for(let r=y+2;r<=retirementYears;r++) path.push({yr:r,v:0,calYr:startYear+r});
        break;
      }
    }
    return {startYear, survived, depletedYear, finalValue:Math.round(bal), path, wd0:annualWithdrawal,
      earlyEst: startYear < 1970};
  });
}

function renderRetirement() {
  const {preset,portfolioValue,annualWithdrawal,retirementYears,timing,
    inflationAdjust,inflationRate,manualMER,useCustomAlloc,customAlloc,
    frankingMode,taxProfile,auFrankingPct,auDividendYield} = retState;
  const sims    = runSims();
  const succN   = sims.filter(s=>s.survived).length;
  const rate    = sims.length>0 ? ((succN/sims.length)*100).toFixed(0) : 'N/A';
  const wr      = (annualWithdrawal/portfolioValue*100).toFixed(2);
  const srC     = rate>=90?'#4ade80':rate>=70?'#f59e0b':'#ef4444';
  const failedYrs = sims.filter(s=>!s.survived).map(s=>s.startYear);
  const earlyN  = sims.filter(s=>s.earlyEst).length;
  const effectiveMER = getEffectiveMER();
  const frankBoostPct = frankingBoostRet();

  _lastRetData = { sims, retirementYears };

  const presetOpts = Object.entries(etfData.portfolioPresets)
    .filter(([k])=>k!=='CUSTOM')
    .map(([k,v])=>`<option value="${k}" ${k===preset?'selected':''}>${k} — ${v.label}</option>`).join('');

  const allocKeys = ['AU_SHARES','INTL_SHARES','US_SHARES','AU_BONDS','GLOBAL_BONDS','CASH'];
  const allocLabels = {'AU_SHARES':'AU Shares','INTL_SHARES':'Intl (ex-US)','US_SHARES':'US Shares','AU_BONDS':'AU Bonds','GLOBAL_BONDS':'Global Bonds','CASH':'Cash'};
  // Normalise allocation: fill missing keys with 0 so sliders work for all presets
  const normAlloc = Object.fromEntries(allocKeys.map(k=>[k, customAlloc[k]??0]));
  const allocSum = Object.values(normAlloc).reduce((s,v)=>s+v,0);

  const customAllocPanel = useCustomAlloc ? `
    <div style="background:#0a0f1e;border:1px dashed #334155;border-radius:8px;padding:1rem;margin-bottom:1rem;">
      <div class="etf-label" style="margin-bottom:.5rem;">Custom Allocation <span style="color:${Math.abs(allocSum-100)<0.5?'#4ade80':'#ef4444'};float:right;">Total: ${allocSum}%</span></div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:.6rem;" class="resp-grid-2">
        ${allocKeys.map(k=>`<div>
          <label class="etf-label">${allocLabels[k]} <span id="lv-alloc-${k}" style="color:var(--fitc-green);">${customAlloc[k]??0}%</span></label>
          <input type="number" id="alloc-${k}" class="etf-input" value="${customAlloc[k]??0}" min="0" max="100" step="1"/>
          <input type="range" id="alloc-${k}-r" class="etf-range" value="${customAlloc[k]??0}" min="0" max="100" step="1"/>
        </div>`).join('')}
      </div>
      ${Math.abs(allocSum-100)>0.5?`<div style="font-size:.72rem;color:#ef4444;margin-top:.4rem;">⚠ Allocation does not sum to 100% — results may be misleading.</div>`:''}
    </div>` : '';

  const methodologyHtml = `<details style="margin-bottom:1rem;background:#0a0f1e;border:1px solid var(--glass-border);border-radius:8px;">
    <summary style="padding:.7rem 1rem;cursor:pointer;font-size:.82rem;color:#94a3b8;font-weight:600;">ℹ How the simulation works — methodology &amp; sources</summary>
    <div style="padding:.5rem 1rem 1rem;font-size:.78rem;color:#64748b;line-height:1.8;">

      <p><strong style="color:#94a3b8;">Method: Historical Sequence-of-Returns Simulation</strong><br>
      This is the same approach used by Bengen (1994) when he first proposed the 4% rule, and later formalised by the
      <a href="https://www.aaii.com/journal/article/retirement-savings-choosing-a-withdrawal-rate-that-is-sustainable" target="_blank" style="color:#38bdf8;">Trinity Study (Cooley, Hubbard &amp; Walz, 1998)</a>.
      The method runs every historical retirement window — for a 30-year simulation it tests
      "what if you retired in 1901?", "1902?" and so on — and counts how many succeeded.
      Interactive US-market versions of this same approach:
      <a href="https://engaging-data.com/visualizing-4-rule/" target="_blank" style="color:#38bdf8;">Engaging Data 4% rule</a> ·
      <a href="https://cfiresim.com/" target="_blank" style="color:#38bdf8;">cFireSim</a> ·
      <a href="https://ficalc.app/" target="_blank" style="color:#38bdf8;">FICalc</a>.</p>

      <p><strong style="color:#94a3b8;">How each year is calculated</strong><br>
      Each year, the portfolio return is the weighted average of asset class returns for that calendar year (e.g. VDHG ≈ 36% AU Shares + 37% Intl Shares + 6% AU Bonds + 16% Global Bonds + 5% Cash), minus the fund MER.
      If inflation-adjustment is on, the withdrawal grows each year by the inflation rate. "Start of year" timing withdraws <em>before</em> returns apply (more conservative); "End of year" applies returns first (more optimistic).</p>

      <p><strong style="color:#94a3b8;">Success vs failure</strong><br>
      A scenario is a <span style="color:#4ade80;">Success</span> if the balance stays above zero for the full retirement duration.
      It becomes a <span style="color:#ef4444;">Failure</span> the year the balance hits zero — that calendar year is noted in the heatmap tooltip.</p>

      <p><strong style="color:#94a3b8;">Data sources (1970–2024) — reliable</strong><br>
      AU Shares: ASX 200 / All Ordinaries total return index.<br>
      Intl Shares (ex-US): MSCI World ex-Australia (AUD), approximated pre-VGS launch from MSCI data.<br>
      US Shares: S&P 500 total return (AUD-equivalent). Pre-1957: Ibbotson/DMS US equity series.<br>
      AU Bonds: Bloomberg AusBond Composite 0+ Yr Index.<br>
      Cash: RBA overnight cash rate.
      Full historical tables:
      <a href="https://www.rba.gov.au/statistics/tables/" target="_blank" style="color:#38bdf8;">RBA Statistics Tables</a>.</p>

      <p><strong style="color:#f59e0b;">Pre-1970 data — treat as illustrative only</strong><br>
      Estimates are reconstructed from two primary academic sources:
      <a href="https://www.ubs.com/global/en/investment-bank/in-focus/2024/global-investment-returns-yearbook.html" target="_blank" style="color:#38bdf8;">Dimson, Marsh &amp; Staunton — Global Investment Returns Yearbook (UBS, annual)</a>
      and supplementary RBA archival series. These carry ±2–5 percentage point uncertainty per year.
      Dashed-border cells in the heatmap indicate pre-1970 start years.
      Reliable continuous Australian equity data does not exist before approximately 1900.</p>

      <p><strong style="color:#94a3b8;">Key caveats</strong><br>
      This tool uses <em>Australian</em> data, which is important — the US-centric 4% rule is derived from US equity returns and may not apply to Australian investors.
      Australian equities have historically had a higher dividend yield (franking credits) but lower capital growth than the US.
      What is <em>not</em> modelled: capital gains tax, income tax on distributions, brokerage, or actual sequence-of-returns within a year.</p>

      <p><strong style="color:#94a3b8;">Why do 1900–1925 retirements show so many failures?</strong><br>
      These retirement cohorts faced an unlucky combination of two separate crises across their retirement window.
      Someone who retired in <strong>1900</strong> with a 30-year plan saw their portfolio run until <strong>1930</strong> —
      hitting the Great Depression almost at the finish line when reserves may have already been drawn down by 29 years of withdrawals.
      Someone retiring in <strong>1910</strong> faced WWI market disruption (1914–18) in years 4–8, the post-war recession (1920–21) in years 10–11,
      and then the Great Depression (1929–33) in years 19–23.
      The <strong>sequence-of-returns risk</strong> is most lethal when large losses occur in <em>early</em> retirement —
      the 1910 cohort experienced three separate crises, two of which fell in their first 15 years.
      Notably, pre-1970 data carries ±2–5% uncertainty per year, so these early failures may be slightly overstated — but the broad pattern is historically accurate.</p>

      <p><strong style="color:#94a3b8;">Real retirement spending declines with age — a note</strong><br>
      This simulator assumes constant inflation-adjusted withdrawals throughout retirement, which is the conservative standard approach.
      In practice, research by Blanchett (Morningstar, 2013) found that real spending follows a
      <strong>"retirement spending smile"</strong>: higher in the active early years (travel, activities),
      lower in the quieter middle years, and potentially rising again late in life due to healthcare costs.
      Real spending in mid-retirement may be 20–30% lower than in the first years.
      This means that scenarios the simulator marks as <span style="color:#ef4444;">Failures</span> — where the portfolio runs out in later years —
      would often be <span style="color:#4ade80;">Successes</span> if actual spending had naturally declined.
      The simulator is therefore conservative relative to most people's lived experience.
      For personalised advice consult a licensed financial adviser.</p>
    </div>
  </details>`;

  return `<div>
    ${methodologyHtml}
    <div style="font-size:.82rem;color:var(--text-secondary);margin-bottom:1rem;background:rgba(56,189,248,.05);border:1px solid rgba(56,189,248,.1);border-radius:6px;padding:.6rem .9rem;">
      Simulates every historical window using blended asset class returns, <strong>net of MER (${effectiveMER.toFixed(2)}%)</strong>.
      ${frankingMode?`<strong style="color:#fbbf24;">Franking boost: +${frankBoostPct.toFixed(2)}% p.a.</strong> applied to AU Shares component (${TAX_PROFILES[taxProfile].label}).`:''}
      Data covers ${sims[0]?.startYear}–${sims[sims.length-1]?.startYear} retirement start years.
      ${earlyN>0?`<span style="color:#f59e0b;">${earlyN} periods use pre-1970 data (high uncertainty — see methodology above).</span>`:''}
    </div>

    <!-- Controls row 1 -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;margin-bottom:1rem;">
      <div>
        <label class="etf-label">Portfolio Preset</label>
        <select id="ret-preset" class="etf-select">${presetOpts}</select>
        <div style="font-size:.7rem;color:#334155;margin-top:.25rem;">
          ${Object.entries(getEffectiveAlloc()).map(([k,v])=>`${allocLabels[k]||k}: ${v}%`).join(' | ')}
        </div>
        <label style="display:flex;align-items:center;gap:.4rem;margin-top:.4rem;cursor:pointer;font-size:.78rem;color:var(--text-secondary);">
          <input type="checkbox" id="ret-custom-alloc" ${useCustomAlloc?'checked':''} style="accent-color:var(--dapi-blue);"/> Use custom allocation
        </label>
      </div>
      <div>
        <label class="etf-label">Starting Portfolio <span id="lv-retpv" style="color:var(--fitc-green);float:right;">${fmtAUD(portfolioValue)}</span></label>
        <input type="number" id="ret-pv" class="etf-input" value="${portfolioValue}" min="10000" step="10000"/>
        <input type="range" id="ret-pv-r" class="etf-range" value="${portfolioValue}" min="100000" max="5000000" step="10000"/>
      </div>
      <div>
        <label class="etf-label">Annual Withdrawal <span id="lv-retwd" style="color:var(--fitc-green);float:right;">${fmtAUD(annualWithdrawal)}</span></label>
        <input type="number" id="ret-wd" class="etf-input" value="${annualWithdrawal}" min="1000" step="1000"/>
        <input type="range" id="ret-wd-r" class="etf-range" value="${annualWithdrawal}" min="5000" max="200000" step="1000"/>
        <div style="font-size:.72rem;color:#94a3b8;margin-top:.25rem;">= ${wr}% withdrawal rate</div>
      </div>
    </div>

    ${customAllocPanel}

    <!-- Controls row 2 -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:1rem;margin-bottom:.75rem;">
      <div><label class="etf-label">Duration</label>
        <select id="ret-yrs" class="etf-select">${[10,15,20,25,30,35,40].map(y=>`<option value="${y}" ${y===retirementYears?'selected':''}>${y} years</option>`).join('')}</select></div>
      <div><label class="etf-label">Withdrawal Timing</label>
        <select id="ret-timing" class="etf-select">
          <option value="start" ${timing==='start'?'selected':''}>Start of year</option>
          <option value="end" ${timing==='end'?'selected':''}>End of year</option>
        </select></div>
      <div>
        <label class="etf-label">Investment Fees (MER %)</label>
        <input type="number" id="ret-mer" class="etf-input" value="${effectiveMER}" min="0" max="5" step=".01"
          placeholder="${etfData.portfolioPresets[preset]?.mer||0.27}"/>
        <div style="font-size:.65rem;color:#334155;margin-top:.2rem;">Default: ${etfData.portfolioPresets[useCustomAlloc?'CUSTOM':preset]?.mer??0.27}% (preset MER). Override to compare scenarios.</div>
      </div>
      <div>
        <label class="etf-label">Inflation Adjust
          <span style="font-weight:400;text-transform:none;font-size:.65rem;color:#475569;"> (RBA target: 2–3%)</span>
        </label>
        <div style="display:flex;gap:.3rem;align-items:center;">
          <select id="ret-inf-on" class="etf-select" style="flex:1;">
            <option value="1" ${inflationAdjust?'selected':''}>Grow by</option>
            <option value="0" ${!inflationAdjust?'selected':''}>Fixed</option>
          </select>
          <input type="number" id="ret-inf-rate" class="etf-input" style="width:60px;flex-shrink:0;" value="${inflationRate}" min="0" max="15" step=".5" ${!inflationAdjust?'disabled':''}/>
          <span style="color:var(--text-secondary);">%</span>
        </div>
        <div style="font-size:.65rem;color:#475569;margin-top:.2rem;">
          Long-run Aus avg ≈ 2.7% p.a. (ABS, 2000–2024). 2.5% = RBA mid-band.
        </div>
      </div>
    </div>

    <!-- Franking credits row -->
    <div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;margin-bottom:1.2rem;
                background:rgba(251,191,36,.04);border:1px solid rgba(251,191,36,${frankingMode?.2:.1});
                border-radius:8px;padding:.6rem 1rem;">
      <button id="ret-frank-toggle" class="mode-btn ${frankingMode?'mode-active frank-active':''}"
        title="Add the tax refund from Australian dividend franking credits to the AU Shares portion of the portfolio">
        🏦 Franking Credits
      </button>
      ${frankingMode?`
      <select id="ret-tax-profile" class="etf-select" style="flex:1;min-width:200px;">
        ${Object.entries(TAX_PROFILES).map(([k,v])=>`<option value="${k}" ${k===taxProfile?'selected':''}>${v.label}</option>`).join('')}
      </select>
      <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;font-size:.8rem;">
        <span style="color:var(--text-secondary);">AU yield</span>
        <input id="ret-au-yield" type="number" class="etf-input" style="width:60px;padding:.3rem .5rem;"
          value="${auDividendYield}" min="0" max="15" step=".5"/>
        <span style="color:var(--text-secondary);">% &nbsp; franked</span>
        <input id="ret-au-franked" type="number" class="etf-input" style="width:60px;padding:.3rem .5rem;"
          value="${(auFrankingPct*100).toFixed(0)}" min="0" max="100" step="5"/>
        <span style="color:var(--text-secondary);">%</span>
        <span style="color:#fbbf24;font-weight:600;">→ +${frankBoostPct.toFixed(2)}% p.a. boost</span>
      </div>
      <div style="width:100%;font-size:.7rem;color:#94a3b8;line-height:1.5;">
        The boost = <em>AU weight × dividend yield × franked% × (30/70) × (1 − marginal rate)</em>.
        The 30% corporate tax has already been paid; this fraction is refunded at tax time.
        ${taxProfile==='nfp'||taxProfile==='pension'?`<strong style="color:#4ade80;">Full refund</strong> — your entity pays no tax, so the entire credit is returned.`
          :taxProfile==='ind_0'?`<strong style="color:#4ade80;">Full refund</strong> — below tax-free threshold.`
          :taxProfile==='super15'||taxProfile==='ind_16'?`<strong style="color:#4ade80;">Partial refund</strong> — your rate is below 30%, so most of the credit comes back.`
          :taxProfile==='ind_30'?`At 30% your rate <em>exactly</em> matches the corporate tax already paid — credits offset your tax liability dollar for dollar, but you receive no additional cash refund.`
          :`At rates above 30%, the franking credit offsets part of your tax bill but generates no additional cash. The effective boost shown above reflects this.`}
      </div>`
      :`<span style="font-size:.78rem;color:var(--text-secondary);">
        Model the ATO refund of 30% corporate tax paid on Australian dividends.
        Especially significant for NFPs and pension-phase super (full refund).
      </span>`}
    </div>

    <!-- ── Auto-Calculate ──────────────────────────────────────── -->
    <div style="margin-bottom:1.2rem;border:1px solid rgba(56,189,248,.2);border-radius:10px;overflow:hidden;">
      <button id="ret-auto-toggle"
        style="width:100%;text-align:left;padding:.65rem 1rem;background:rgba(56,189,248,.05);
               border:none;color:${retAutoState.open?'var(--dapi-blue)':'var(--text-secondary)'};
               cursor:pointer;font-size:.82rem;font-weight:600;display:flex;justify-content:space-between;align-items:center;">
        🔢 Auto-Calculate — Solve for withdrawal or portfolio size
        <span>${retAutoState.open?'▲':'▼'}</span>
      </button>
      ${retAutoState.open?`
      <div style="padding:1rem;background:#0a0f1e;">
        <!-- Mode selector -->
        <div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap;">
          <button class="mode-btn ${retAutoState.mode==='withdrawal'?'mode-active':''}" id="ra-mode-wd"
            style="flex:1;">💸 What can I withdraw?</button>
          <button class="mode-btn ${retAutoState.mode==='portfolio'?'mode-active':''}" id="ra-mode-pv"
            style="flex:1;">🎯 How much do I need?</button>
        </div>

        ${retAutoState.mode==='withdrawal'?`
        <!-- Mode 1: solve max withdrawal -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem;align-items:end;" class="resp-grid-1">
          <div>
            <label class="etf-label">My Portfolio Value</label>
            <input id="ra-pv" type="number" class="etf-input" value="${retAutoState.portfolioInput}" min="10000" step="10000"/>
          </div>
          <div>
            <label class="etf-label">Target Success Rate</label>
            <div style="display:flex;align-items:center;gap:.3rem;">
              <input id="ra-success" type="number" class="etf-input" value="${retAutoState.targetSuccess}" min="50" max="100" step="5"/>
              <span style="color:var(--text-secondary);">%</span>
            </div>
          </div>
          <button id="ra-solve" class="mode-btn mode-active" style="height:2.4rem;">Calculate ↗</button>
        </div>
        <div style="font-size:.7rem;color:#475569;margin-top:.4rem;">
          Uses your current preset/allocation/MER/timing/inflation settings above.
          90% is a common target (the "4% rule" was designed around ~95% historical US success).
        </div>
        `:`
        <!-- Mode 2: solve required portfolio -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem;align-items:end;" class="resp-grid-1">
          <div>
            <label class="etf-label">Desired Annual Withdrawal</label>
            <input id="ra-wd" type="number" class="etf-input" value="${retAutoState.withdrawalInput}" min="1000" step="1000"/>
          </div>
          <div>
            <label class="etf-label">Target Success Rate</label>
            <div style="display:flex;align-items:center;gap:.3rem;">
              <input id="ra-success" type="number" class="etf-input" value="${retAutoState.targetSuccess}" min="50" max="100" step="5"/>
              <span style="color:var(--text-secondary);">%</span>
            </div>
          </div>
          <button id="ra-solve" class="mode-btn mode-active" style="height:2.4rem;">Calculate ↗</button>
        </div>
        <div style="font-size:.7rem;color:#475569;margin-top:.4rem;">
          Finds the minimum starting portfolio that achieves your target success rate over ${retirementYears} years.
          Uses your current preset, MER, and inflation settings.
        </div>
        `}

        <!-- Result display -->
        <div id="ra-result" style="margin-top:1rem;${retAutoState.result?'':'display:none;'}">
          ${retAutoState.result?`
          <div style="background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);border-radius:8px;
                      padding:.9rem 1.2rem;display:flex;gap:2rem;flex-wrap:wrap;align-items:center;">
            ${retAutoState.mode==='withdrawal'?`
            <div>
              <div style="font-size:.72rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;">
                Max Safe Withdrawal
              </div>
              <div style="font-size:1.8rem;font-weight:700;color:var(--fitc-green);">${fmtAUD(retAutoState.result.value)}/yr</div>
              <div style="font-size:.8rem;color:#94a3b8;">
                = <strong>${((retAutoState.result.value/retAutoState.portfolioInput)*100).toFixed(2)}%</strong> withdrawal rate
              </div>
            </div>
            <div style="font-size:.8rem;color:var(--text-secondary);">
              <div>Portfolio: <strong style="color:white;">${fmtAUD(retAutoState.portfolioInput)}</strong></div>
              <div>Success: <strong style="color:#4ade80;">${retAutoState.targetSuccess}%</strong> over ${retirementYears} yrs</div>
              <div>Actual achieved: <strong style="color:#4ade80;">${simSuccessRate(retAutoState.portfolioInput, retAutoState.result.value).toFixed(1)}%</strong></div>
            </div>`:`
            <div>
              <div style="font-size:.72rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.06em;">
                Required Portfolio
              </div>
              <div style="font-size:1.8rem;font-weight:700;color:var(--fitc-green);">${fmtAUD(retAutoState.result.value)}</div>
              <div style="font-size:.8rem;color:#94a3b8;">
                = <strong>${((retAutoState.withdrawalInput/retAutoState.result.value)*100).toFixed(2)}%</strong> implied withdrawal rate
              </div>
            </div>
            <div style="font-size:.8rem;color:var(--text-secondary);">
              <div>Withdrawal: <strong style="color:white;">${fmtAUD(retAutoState.withdrawalInput)}/yr</strong></div>
              <div>Success: <strong style="color:#4ade80;">${retAutoState.targetSuccess}%</strong> over ${retirementYears} yrs</div>
              <div>Actual achieved: <strong style="color:#4ade80;">${simSuccessRate(retAutoState.result.value, retAutoState.withdrawalInput).toFixed(1)}%</strong></div>
            </div>`}
            <div style="font-size:.7rem;color:#475569;border-left:1px solid rgba(255,255,255,.08);padding-left:1.2rem;flex:1;min-width:180px;">
              Based on ${sims.length} historical windows (${sims[0]?.startYear}–${sims[sims.length-1]?.startYear}).
              Uses current preset: <strong style="color:#94a3b8;">${retAutoState.useCustomAlloc?'Custom':preset}</strong>,
              MER <strong style="color:#94a3b8;">${effectiveMER.toFixed(2)}%</strong>,
              ${inflationAdjust?`inflation-adj ${inflationRate}%`:'fixed withdrawal'}.
              ${frankingMode?`Franking +${frankBoostPct.toFixed(2)}% p.a.`:''}
            </div>
          </div>`:''}
        </div>
      </div>`:''}
    </div>

    <!-- KPI cards -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1.2rem;">
      ${sc('Historical Success Rate',`${rate}%`,srC,'1.6rem')}
      ${sc('Periods Tested',`${sims.length}`,`var(--dapi-blue)`,'1.2rem')}
      ${sc('Withdrawal Rate',`${wr}%`,'#f59e0b','1.2rem')}
      ${sc('Effective MER',`${effectiveMER.toFixed(2)}%`,'#a78bfa','1.2rem')}
    </div>

    ${buildRetChart(sims, retirementYears)}
    <div style="display:flex;gap:1.5rem;justify-content:center;flex-wrap:wrap;margin-top:.5rem;font-size:.75rem;color:var(--text-secondary);">
      <span><span style="color:rgba(74,222,128,.8);">——</span> Survived</span>
      <span><span style="color:rgba(239,68,68,.7);">——</span> Depleted</span>
      <span><span style="color:#334155;">- -</span> Starting value</span>
      <span style="color:#475569;font-size:.7rem;">Hover chart for median / percentiles</span>
    </div>

    <!-- Outcome heatmap -->
    <div class="etf-label" style="margin:1.5rem 0 .5rem;">Outcome by Retirement Start Year <span style="color:#475569;text-transform:none;font-size:.7rem;">(hover cells for details)</span></div>
    ${earlyN>0?`<div style="font-size:.72rem;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.2);border-radius:6px;padding:.5rem .8rem;margin-bottom:.5rem;line-height:1.6;">
      <strong style="color:#f59e0b;">Why do 1900–1940s retirements show many failures?</strong>
      <span style="color:#94a3b8;"> — this is historically correct, not a data error.</span><br>
      Those retiring <strong>1927–1933</strong> hit the <strong>Great Depression</strong> almost immediately (sequence-of-returns risk at its worst).
      Those retiring <strong>1900–1915</strong> faced a different problem: their retirement window <em>spanned</em> multiple crises —
      WWI economic disruption (1914–18), the post-war recession (1920–21), <em>and</em> the Great Depression (1929–33) — often striking mid-retirement when reserves were already reduced.
      See the methodology section for a full explanation. Pre-1970 return data (dashed borders) also carries ±2–5% uncertainty.
    </div>`:''}
    <!-- Spending smile note -->
    <div style="font-size:.7rem;background:rgba(74,222,128,.05);border:1px solid rgba(74,222,128,.12);border-radius:6px;padding:.4rem .75rem;margin-bottom:.5rem;line-height:1.5;color:#64748b;">
      <strong style="color:#86efac;">Note on spending:</strong> This assumes constant inflation-adjusted withdrawals.
      In reality, most people spend less in mid-retirement (the "spending smile" — Blanchett, 2013).
      Some simulated <span style="color:#ef4444;">failures</span> would succeed with naturally declining spending. The tool is therefore conservative.
      <span style="cursor:pointer;color:#38bdf8;" onclick="document.querySelector('details')?.setAttribute('open','')"> See methodology ↗</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(42px,1fr));gap:3px;">
      ${sims.map(s=>{
        const surviveYrs = s.survived ? retirementYears : (s.depletedYear - s.startYear);
        const bg = s.survived
          ? (s.earlyEst ? 'rgba(22,101,52,.7)' : '#166534')
          : `hsl(${Math.max(0,20-(retirementYears-surviveYrs))}deg,75%,${s.earlyEst?25:33}%)`;
        const bord = s.earlyEst ? '1px dashed rgba(245,158,11,.5)' : 'none';
        return `<div title="Start ${s.startYear}: ${s.survived?'Survived → final '+fmtAUD(s.finalValue):`Depleted yr ${s.depletedYear} (${surviveYrs}/${retirementYears} yrs)`}${s.earlyEst?' [pre-1970 estimate]':''}"
          style="background:${bg};border:${bord};border-radius:3px;height:28px;font-size:.6rem;color:rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;cursor:default;">${s.startYear}</div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:1.5rem;font-size:.72rem;color:#475569;margin-top:.4rem;flex-wrap:wrap;">
      <span>🟢 Survived ${retirementYears} years</span>
      <span>🟡→🔴 Partially survived → early depletion</span>
      ${earlyN>0?'<span>Dashed border = pre-1970 (estimated)</span>':''}
    </div>
    ${failedYrs.length>0?`<div style="margin-top:.75rem;padding:.6rem .9rem;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.15);border-radius:6px;font-size:.78rem;color:#fca5a5;">
      <strong>Failed start years (${failedYrs.length}):</strong> ${failedYrs.join(', ')}
    </div>`:''}

    ${dlRow(['dl-csv-ret','⬇ Results (CSV)'],['dl-png-ret','⬇ Chart (PNG)'])}
    <p style="font-size:.7rem;color:#475569;margin-top:.75rem;text-align:center;">
      Returns net of MER. Pre-1970 data is estimated and carries high uncertainty — treat as indicative only.
      Does not account for CGT, income tax, brokerage, or franking credits.
      Reliable Australian market data does not extend to the 1800s; earliest figures here begin ~1901.
    </p>
  </div>`;
}

// ── Source footer ──────────────────────────────────────────────────
function sourceFooter() {
  if(!etfData) return '';
  return `<div style="margin-top:2rem;padding:1rem 1.2rem;background:#0a0f1e;border:1px solid var(--glass-border);border-radius:10px;font-size:.75rem;color:#475569;line-height:1.8;">
    <div style="color:#94a3b8;font-weight:600;margin-bottom:.4rem;">About this data</div>
    ${etfData.meta.sources.map(s=>`<div>· ${s}</div>`).join('')}
    <div style="margin-top:.6rem;padding-top:.6rem;border-top:1px solid #1e293b;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">
      <span style="font-family:monospace;font-size:.7rem;color:#334155;">
        etf_tools.js ${ETF_TOOLS_VERSION}
      </span>
      <span style="font-size:.7rem;color:#334155;">
        Tax rates loaded: NFP 0% · Super Acc 15% · Ind <strong style="color:#4ade80;">16%</strong>/$18k–$45k ·
        <strong style="color:#4ade80;">30%</strong>/$45k–$135k · <strong style="color:#4ade80;">37%</strong>/$135k–$190k ·
        <strong style="color:#4ade80;">45%</strong>/$190k+ (ATO 2025-26 Stage 3)
      </span>
    </div>
  </div>`;
}


// ══════════════════════════════════════════════════════════════════
//  DOWNLOADS
// ══════════════════════════════════════════════════════════════════
function csvDL(rows, fn) {
  // UTF-8 BOM ensures correct encoding in Excel / Numbers
  const csv = '\uFEFF' + rows.map(r => Array.isArray(r)
    ? r.map(v=>`"${String(v==null?'':v).replace(/"/g,'""')}"`).join(',')
    : String(r)
  ).join('\r\n');
  Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})), download: fn
  }).click();
}

function pngDL(svgId, fn) {
  const svg = document.getElementById(svgId);
  if(!svg) return alert('Chart not found.');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}));
  const img = new Image(); img.crossOrigin='anonymous';
  img.onload = () => {
    const c=document.createElement('canvas'); c.width=820; c.height=270;
    const ctx=c.getContext('2d'); ctx.fillStyle='#020818'; ctx.fillRect(0,0,820,270); ctx.drawImage(img,0,0,820,270);
    URL.revokeObjectURL(url);
    Object.assign(document.createElement('a'),{href:c.toDataURL('image/png'),download:fn}).click();
  };
  img.onerror=()=>{ URL.revokeObjectURL(url); alert('PNG export failed — try a screenshot.'); };
  img.src=url;
}

function dlCompCSV() {
  const etf = getETF(compState.ticker);
  const isHist = compState.mode === 'historical';
  const frankOn = compState.frankingMode && (etf.frankingPct||0) > 0;
  const taxLabel = TAX_PROFILES[compState.taxProfile]?.label ?? compState.taxProfile;
  const cpiNote  = isHist
    ? 'ABS CPI (real, year-by-year)'
    : `${compState.inflationRate}% p.a. (user assumption)`;

  // Header metadata rows
  const meta = [
    `ETF: ${compState.ticker} — ${etf.name}`,
    `Mode: ${isHist ? 'Historical' : 'Projection'} | DRP: ${compState.drip?'On':'Off'} | Initial: $${compState.initial} | Monthly: $${compState.monthly}`,
    `Return: ${etf.annualReturn?.toFixed?.(1)??'—'}% p.a. | MER: ${etf.mer}% | Yield: ${etf.dividendYield}%`,
    `Inflation overlay: ${compState.showInflation ? 'On — '+cpiNote : 'Off'}`,
    frankOn
      ? `Franking credits: On | ${(etf.frankingPct*100).toFixed(0)}% franked | Tax profile: ${taxLabel} | Effective boost: +${((etf.dividendYield/100)*(etf.frankingPct)*(0.30/0.70)*(1-(TAX_PROFILES[compState.taxProfile]?.rate??0.30))*100).toFixed(2)}% p.a.`
      : `Franking credits: Off`,
    '',
  ];

  // Column headers — include all data columns
  const cols = [
    'Date', 'Portfolio Value (AUD)', 'Total Contributed (AUD)', 'Gains (AUD)',
    ...(!compState.drip ? ['Dividends Paid (AUD)'] : []),
    ...(compState.showInflation ? ['Real Value (CPI-adj AUD)'] : []),
    ...(frankOn ? ['Cumulative Franking Credits (AUD)'] : []),
  ];

  // In historical mode emit every monthly row; in projection mode every row has a label
  // _lastCompData always has all months — we filter to labelled rows only for projection
  // but emit ALL rows for historical (gives the monthly granularity shown on the chart)
  const rows = isHist
    ? _lastCompData   // all monthly data points
    : _lastCompData.filter(d => d.label);   // yearly tick marks only for projection

  csvDL([
    ...meta,
    cols,
    ...rows.map(d => [
      d.date,
      d.value,
      d.contributions,
      d.value - d.contributions,
      ...(!compState.drip ? [d.dividends] : []),
      ...(compState.showInflation ? [d.inflAdj] : []),
      ...(frankOn ? [d.frankingCum ?? 0] : []),
    ])
  ], `${compState.ticker}_compounding_${compState.mode}.csv`);
}
function dlPortCSV() {
  const tot=holdings.reduce((s,h)=>s+h.amount,0), secs=calcSectorTotals();
  csvDL([
    ['ETF','Name','Amount (AUD)','% Portfolio','Issuer','Yield %','MER %'],
    ...holdings.map(h=>{ const e=etfData.etfs[h.ticker]||{}; return [h.ticker,e.name||'',h.amount,((h.amount/tot)*100).toFixed(2),e.issuer||'',e.dividendYield??'',e.mer??'']; }),
    [],['Sector','Value (AUD)','% Portfolio'],...secs.map(s=>[s.sector,Number(s.value).toFixed(0),s.pct])
  ], 'portfolio_breakdown.csv');
}
function dlRetCSV() {
  const sims=runSims();
  csvDL([
    `Preset: ${retState.useCustomAlloc?'Custom':retState.preset} | MER: ${getEffectiveMER().toFixed(2)}% | Withdrawal: $${retState.annualWithdrawal} (${(retState.annualWithdrawal/retState.portfolioValue*100).toFixed(2)}%) | Duration: ${retState.retirementYears}yr | Inflation adj: ${retState.inflationAdjust?retState.inflationRate+'%':'No'}`,
    '',
    ['Start Year','Survived','Depleted Year','Final Value (AUD)','Initial Withdrawal (AUD)','Pre-1970 estimate'],
    ...sims.map(s=>[s.startYear, s.survived?'Yes':'No', s.depletedYear||'N/A', s.finalValue, s.wd0, s.earlyEst?'Yes':'No'])
  ], `retirement_${retState.useCustomAlloc?'custom':retState.preset}.csv`);
}

// ══════════════════════════════════════════════════════════════════
//  MAIN RENDER
// ══════════════════════════════════════════════════════════════════
function renderETFTools() {
  const c = document.getElementById('etf-tool-container');
  if(!c||!etfData) return;
  const fns = {compound:renderCompounding,portfolio:renderPortfolio,overlap:renderOverlap,retirement:renderRetirement};
  c.innerHTML = (fns[currentTab]?.() || '') + sourceFooter();
  attachListeners();
  attachChartListeners();
}

// ══════════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════════════════════════════════
function attachListeners() {
  // liveSlider: range fires 'input' → update display only; 'change' → update state + rerender
  // number input fires 'change' → update state + rerender
  function liveSlider(numId, rangeId, stObj, key, lvId, fmt) {
    const num=document.getElementById(numId), rng=document.getElementById(rangeId), lv=lvId?document.getElementById(lvId):null;
    const upd=v=>{ if(lv) lv.textContent=fmt?fmt(v):v; };
    rng?.addEventListener('input',  ()=>{ if(num) num.value=rng.value; upd(rng.value); });
    rng?.addEventListener('change', ()=>{ stObj[key]=Number(rng.value); rerender(); });
    num?.addEventListener('change', ()=>{ stObj[key]=Number(num.value); if(rng) rng.value=num.value; upd(num.value); rerender(); });
  }

  if(currentTab==='compound') {
    document.getElementById('comp-ticker')?.addEventListener('change',e=>{
      compState.ticker=e.target.value||'VAS';
      // Clear live ticker when selecting from the dropdown
      if(e.target.value !== 'LIVE') compState.liveTickerInput='';
      rerender();
    });
    document.querySelectorAll('.mode-btn[data-mode]').forEach(b=>b.addEventListener('click',()=>{ compState.mode=b.dataset.mode; rerender(); }));
    document.getElementById('drip-on')?.addEventListener('click', ()=>{ compState.drip=true;  rerender(); });
    document.getElementById('drip-off')?.addEventListener('click',()=>{ compState.drip=false; rerender(); });
    document.getElementById('infl-toggle')?.addEventListener('click', ()=>{ compState.showInflation=!compState.showInflation; rerender(); });
    document.getElementById('infl-rate')?.addEventListener('change', e=>{ compState.inflationRate=Number(e.target.value)||2.5; rerender(); });
    document.getElementById('frank-toggle')?.addEventListener('click', ()=>{ compState.frankingMode=!compState.frankingMode; rerender(); });
    document.getElementById('tax-profile')?.addEventListener('change', e=>{ compState.taxProfile=e.target.value; rerender(); });

    // Live ticker: sync input field value; Load button fetches price file
    document.getElementById('live-ticker-input')?.addEventListener('input', e=>{
      compState.liveTickerInput = e.target.value.toUpperCase();
    });
    document.getElementById('live-ticker-load')?.addEventListener('click', async () => {
      const raw = compState.liveTickerInput.trim().toUpperCase();
      if(!raw){ alert('Enter a ticker symbol first.'); return; }
      const btn = document.getElementById('live-ticker-load');
      if(btn){ btn.textContent='Loading…'; btn.disabled=true; }
      // fetchLiveTicker reads from data/stocks/ (written by the GitHub Action)
      const loaded = await fetchLiveTicker(raw);
      if(btn){ btn.textContent='Load ↗'; btn.disabled=false; }
      if(loaded){
        compState.ticker='LIVE';
        compState.mode='historical';
        // Auto-set historical range from available annual returns
        const rets = loaded.historicalReturns || {};
        const yrs = Object.keys(rets).map(Number).sort((a,b)=>a-b);
        if(yrs.length > 0){
          compState.histStartDay=1; compState.histStartMonth=0; compState.histStartYear=yrs[0];
          compState.histEndDay=31;  compState.histEndMonth=11;  compState.histEndYear=yrs[yrs.length-1];
        }
        rerender();
      } else {
        alert(`Could not load data for "${raw}".\n\n` +
          `1. Make sure the GitHub Action has run — it writes individual stock files to data/stocks/.\n` +
          `2. The ticker must be a valid ASX ticker (e.g. "CBA" or "CBA.AX").\n` +
          `3. Only ~60 ETFs and ~50 top ASX stocks are pre-fetched; add more in update_etf_data.py.\n\n` +
          `Alternatively use ✏ Custom mode to enter manual return assumptions.`);
      }
    });
    // Also allow pressing Enter in the input
    document.getElementById('live-ticker-input')?.addEventListener('keydown', e=>{
      if(e.key==='Enter') document.getElementById('live-ticker-load')?.click();
    });

    liveSlider('comp-initial','comp-initial-r',compState,'initial','lv-initial',v=>fmtAUD(Number(v)));
    liveSlider('comp-monthly','comp-monthly-r',compState,'monthly','lv-monthly',v=>fmtAUD(Number(v)));
    liveSlider('comp-years',  'comp-years-r',  compState,'years',  'lv-years',  v=>`${v} yrs`);

    // Projection date pickers
    document.getElementById('proj-sd')?.addEventListener('change',e=>{ compState.projStartDay=Number(e.target.value); rerender(); });
    document.getElementById('proj-sm')?.addEventListener('change',e=>{ compState.projStartMonth=Number(e.target.value); rerender(); });
    document.getElementById('proj-sy')?.addEventListener('change',e=>{ compState.projStartYear=Number(e.target.value); rerender(); });

    // Historical date pickers — update the day dropdowns when month/year changes
    const refreshDayDrop = (dayId, yrKey, moKey) => {
      const d=document.getElementById(dayId); if(!d) return;
      const cur=Number(d.value), max=daysInMonth(compState[yrKey],compState[moKey]);
      d.innerHTML = dayOpts(compState[yrKey], compState[moKey], Math.min(cur,max));
      compState[dayId==='hist-sd'?'histStartDay':'histEndDay'] = Math.min(cur,max);
    };
    document.getElementById('hist-sd')?.addEventListener('change',e=>{ compState.histStartDay=Number(e.target.value); rerender(); });
    document.getElementById('hist-sm')?.addEventListener('change',e=>{ compState.histStartMonth=Number(e.target.value); refreshDayDrop('hist-sd','histStartYear','histStartMonth'); rerender(); });
    document.getElementById('hist-sy')?.addEventListener('change',e=>{ compState.histStartYear=Number(e.target.value); refreshDayDrop('hist-sd','histStartYear','histStartMonth'); rerender(); });
    document.getElementById('hist-ed')?.addEventListener('change',e=>{ compState.histEndDay=Number(e.target.value); rerender(); });
    document.getElementById('hist-em')?.addEventListener('change',e=>{ compState.histEndMonth=Number(e.target.value); refreshDayDrop('hist-ed','histEndYear','histEndMonth'); rerender(); });
    document.getElementById('hist-ey')?.addEventListener('change',e=>{ compState.histEndYear=Number(e.target.value); refreshDayDrop('hist-ed','histEndYear','histEndMonth'); rerender(); });

    const cm={'cust-name':'name','cust-return':'annualReturn','cust-mer':'mer','cust-yield':'dividendYield','cust-inception':'inceptionYear'};
    Object.entries(cm).forEach(([id,k])=>document.getElementById(id)?.addEventListener('change',e=>{
      compState.custom[k]=id==='cust-name'?e.target.value:Number(e.target.value); rerender();
    }));
    document.getElementById('cust-franking')?.addEventListener('change',e=>{
      compState.custom.frankingPct=Number(e.target.value)/100; rerender();
    });
    document.getElementById('cust-use-alloc')?.addEventListener('change',e=>{
      compState.useCustomAlloc=e.target.checked; rerender();
    });
    // Custom allocation sliders/inputs
    const caKeys=['AU_SHARES','INTL_SHARES','US_SHARES','AU_BONDS','GLOBAL_BONDS','CASH'];
    caKeys.forEach(k=>{
      const inp=document.getElementById(`ca-${k}`);
      const rng=document.getElementById(`ca-${k}-r`);
      const lbl=document.getElementById(`lv-ca-${k}`);
      const set=v=>{ compState.customAlloc[k]=Number(v); if(inp)inp.value=v; if(rng)rng.value=v; if(lbl)lbl.textContent=v+'%'; rerender(); };
      inp?.addEventListener('change',e=>set(e.target.value));
      rng?.addEventListener('input', e=>set(e.target.value));
    });

    document.getElementById('dl-csv-comp')?.addEventListener('click',dlCompCSV);
    document.getElementById('dl-png-comp')?.addEventListener('click',()=>pngDL('comp-svg',`${compState.ticker}_chart.png`));
  }

  if(currentTab==='portfolio') {
    document.getElementById('add-holding')?.addEventListener('click',()=>{ holdings.push({ticker:'VAS',amount:1000}); rerender(); });
    document.querySelectorAll('.holding-remove').forEach(b=>b.addEventListener('click',()=>{ holdings.splice(Number(b.dataset.idx),1); rerender(); }));
    document.querySelectorAll('.holding-ticker').forEach(s=>s.addEventListener('change',()=>{ holdings[Number(s.dataset.idx)].ticker=s.value; rerender(); }));
    document.querySelectorAll('.holding-amount').forEach(i=>i.addEventListener('change',()=>{ holdings[Number(i.dataset.idx)].amount=Number(i.value); rerender(); }));
    document.getElementById('dl-csv-port')?.addEventListener('click',dlPortCSV);
  }

  if(currentTab==='overlap') {
    document.querySelectorAll('.overlap-toggle').forEach(b=>b.addEventListener('click',()=>{
      const t=b.dataset.ticker, idx=overlapState.selected.indexOf(t);
      if(idx>=0){ if(overlapState.selected.length>1) overlapState.selected.splice(idx,1); }
      else if(overlapState.selected.length<6) overlapState.selected.push(t);
      // Reset drill to first valid pair
      const s=overlapState.selected;
      if(s.length>=2){ overlapState.drillA=s[0]; overlapState.drillB=s[1]; }
      rerender();
    }));
    document.getElementById('ov-sectors')?.addEventListener('click',  ()=>{ overlapState.view='sectors';  rerender(); });
    document.getElementById('ov-holdings')?.addEventListener('click', ()=>{ overlapState.view='holdings'; rerender(); });
    document.querySelectorAll('.drill-pair').forEach(b=>b.addEventListener('click',()=>{
      overlapState.drillA=b.dataset.a; overlapState.drillB=b.dataset.b; rerender();
    }));
    document.querySelectorAll('.pair-cell').forEach(c=>c.addEventListener('click',()=>{
      overlapState.view='holdings'; overlapState.drillA=c.dataset.a; overlapState.drillB=c.dataset.b; rerender();
    }));
  }

  if(currentTab==='retirement') {
    document.getElementById('ret-preset')?.addEventListener('change',e=>{
      retState.preset=e.target.value;
      // Merge preset allocation; fill any missing keys with 0
      const presetAlloc = etfData.portfolioPresets[e.target.value]?.allocation || {};
      const fullAlloc = Object.fromEntries(['AU_SHARES','INTL_SHARES','US_SHARES','AU_BONDS','GLOBAL_BONDS','CASH'].map(k=>[k, presetAlloc[k]??0]));
      retState.customAlloc = fullAlloc;
      retState.manualMER = null;
      rerender();
    });
    document.getElementById('ret-custom-alloc')?.addEventListener('change',e=>{
      retState.useCustomAlloc=e.target.checked; rerender();
    });
    document.getElementById('ret-yrs')?.addEventListener('change',e=>{ retState.retirementYears=Number(e.target.value); rerender(); });
    document.getElementById('ret-timing')?.addEventListener('change',e=>{ retState.timing=e.target.value; rerender(); });
    document.getElementById('ret-mer')?.addEventListener('change',e=>{
      const v=Number(e.target.value);
      retState.manualMER = v === (etfData.portfolioPresets[retState.preset]?.mer??0.27) ? null : v;
      rerender();
    });
    document.getElementById('ret-inf-on')?.addEventListener('change',e=>{ retState.inflationAdjust=e.target.value==='1'; rerender(); });
    document.getElementById('ret-inf-rate')?.addEventListener('change',e=>{ retState.inflationRate=Number(e.target.value); rerender(); });
    document.getElementById('ret-frank-toggle')?.addEventListener('click',()=>{ retState.frankingMode=!retState.frankingMode; rerender(); });
    document.getElementById('ret-tax-profile')?.addEventListener('change',e=>{ retState.taxProfile=e.target.value; rerender(); });
    document.getElementById('ret-au-yield')?.addEventListener('change',e=>{ retState.auDividendYield=Number(e.target.value); rerender(); });
    document.getElementById('ret-au-franked')?.addEventListener('change',e=>{ retState.auFrankingPct=Number(e.target.value)/100; rerender(); });

    liveSlider('ret-pv','ret-pv-r',retState,'portfolioValue','lv-retpv',v=>fmtAUD(Number(v)));
    liveSlider('ret-wd','ret-wd-r',retState,'annualWithdrawal','lv-retwd',v=>fmtAUD(Number(v)));

    // Custom allocation sliders
    const ak=['AU_SHARES','INTL_SHARES','US_SHARES','AU_BONDS','GLOBAL_BONDS','CASH'];
    ak.forEach(k=>{
      const numEl=document.getElementById(`alloc-${k}`);
      const rngEl=document.getElementById(`alloc-${k}-r`);
      const lvEl =document.getElementById(`lv-alloc-${k}`);
      rngEl?.addEventListener('input',  ()=>{ if(numEl)numEl.value=rngEl.value; if(lvEl)lvEl.textContent=rngEl.value+'%'; });
      rngEl?.addEventListener('change', ()=>{ retState.customAlloc[k]=Number(rngEl.value); rerender(); });
      numEl?.addEventListener('change', ()=>{ retState.customAlloc[k]=Number(numEl.value); if(rngEl)rngEl.value=numEl.value; if(lvEl)lvEl.textContent=numEl.value+'%'; rerender(); });
    });

    document.getElementById('dl-csv-ret')?.addEventListener('click',dlRetCSV);
    document.getElementById('dl-png-ret')?.addEventListener('click',()=>pngDL('ret-svg','retirement_chart.png'));

    // ── Auto-calc panel ──────────────────────────────────────────────
    document.getElementById('ret-auto-toggle')?.addEventListener('click',()=>{
      retAutoState.open = !retAutoState.open;
      retAutoState.result = null;
      rerender();
    });
    document.getElementById('ra-mode-wd')?.addEventListener('click',()=>{
      retAutoState.mode='withdrawal'; retAutoState.result=null; rerender();
    });
    document.getElementById('ra-mode-pv')?.addEventListener('click',()=>{
      retAutoState.mode='portfolio'; retAutoState.result=null; rerender();
    });
    document.getElementById('ra-pv')?.addEventListener('change',e=>{
      retAutoState.portfolioInput=Number(e.target.value); retAutoState.result=null;
    });
    document.getElementById('ra-wd')?.addEventListener('change',e=>{
      retAutoState.withdrawalInput=Number(e.target.value); retAutoState.result=null;
    });
    document.getElementById('ra-success')?.addEventListener('change',e=>{
      retAutoState.targetSuccess=Number(e.target.value); retAutoState.result=null;
    });
    document.getElementById('ra-solve')?.addEventListener('click',()=>{
      const btn = document.getElementById('ra-solve');
      if(btn){ btn.textContent='Calculating…'; btn.disabled=true; }
      // Use setTimeout so UI can repaint before the binary search blocks
      setTimeout(()=>{
        const tgt = retAutoState.targetSuccess;
        if(retAutoState.mode==='withdrawal'){
          const pv = retAutoState.portfolioInput;
          retAutoState.result = { value: solveWithdrawal(tgt, pv) };
        } else {
          const wd = retAutoState.withdrawalInput;
          retAutoState.result = { value: solvePortfolio(tgt, wd) };
        }
        retAutoState.useCustomAlloc = retState.useCustomAlloc;
        rerender();
      }, 30);
    });
  }
}

// ── Tab switching ──────────────────────────────────────────────────
function setTab(tab,btn){
  currentTab=tab;
  document.querySelectorAll('.etf-tab-btn').forEach(b=>{ b.classList.remove('etf-tab-active'); b.style.opacity='.5'; });
  btn.classList.add('etf-tab-active'); btn.style.opacity='1';
  renderETFTools();
}
['compound','portfolio','overlap','retirement'].forEach(tab=>{
  const b=document.getElementById(`tab-${tab}`);
  b?.addEventListener('click',e=>setTab(tab,e.currentTarget));
  if(tab==='compound'&&b){ b.classList.add('etf-tab-active'); b.style.opacity='1'; }
  else if(b) b.style.opacity='.5';
});

// ── Shared CSS ─────────────────────────────────────────────────────
const _css=document.createElement('style');
_css.textContent=`
  .etf-label    { display:block;font-size:.75rem;color:var(--text-secondary);margin-bottom:.4rem;letter-spacing:.05em;text-transform:uppercase; }
  .etf-select   { width:100%;background:#0a0f1e;border:1px solid var(--glass-border);border-radius:8px;color:white;padding:.55rem .75rem;font-size:.85rem; }
  .etf-input    { width:100%;background:#0a0f1e;border:1px solid var(--glass-border);border-radius:8px;color:white;padding:.55rem .75rem;font-size:.85rem;box-sizing:border-box; }
  .etf-input:disabled { opacity:.4;cursor:not-allowed; }
  .etf-range    { width:100%;margin-top:.4rem;accent-color:var(--dapi-blue);cursor:pointer; }
  .etf-info-box { background:#0a0f1e;border-radius:8px;border:1px solid var(--glass-border);padding:.7rem 1rem; }
  .etf-stat-card  { background:#0a0f1e;border-radius:10px;border:1px solid var(--glass-border);padding:1rem;text-align:center; }
  .etf-stat-label { font-size:.7rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em; }
  .etf-stat-value { font-size:1.4rem;font-weight:700;margin-top:.3rem; }
  .mode-btn     { padding:.4rem .9rem;border-radius:6px;border:1px solid var(--glass-border);background:transparent;color:var(--text-secondary);cursor:pointer;font-size:.8rem;transition:all .2s; }
  .mode-active  { border-color:var(--dapi-blue)!important;background:rgba(56,189,248,.08)!important;color:var(--dapi-blue)!important; }
  .dl-btn       { padding:.4rem .9rem;border-radius:6px;border:1px solid var(--glass-border);background:transparent;color:var(--text-secondary);cursor:pointer;font-size:.78rem;transition:all .2s; }
  .dl-btn:hover { border-color:var(--fitc-green);color:var(--fitc-green); }
  .overlap-toggle       { padding:.3rem .6rem;border-radius:5px;border:1px solid var(--glass-border);background:transparent;color:var(--text-secondary);cursor:pointer;font-size:.75rem;font-family:monospace;transition:all .15s; }
  .overlap-toggle:hover { border-color:var(--dapi-blue);color:var(--dapi-blue); }
  .overlap-active       { border-color:var(--fitc-green)!important;background:rgba(74,222,128,.08)!important;color:var(--fitc-green)!important; }
  .pair-cell:hover { opacity:.75; }
  .infl-active  { border-color:#fb923c!important;background:rgba(251,146,60,.08)!important;color:#fb923c!important; }
  .frank-active { border-color:#fbbf24!important;background:rgba(251,191,36,.08)!important;color:#fbbf24!important; }
  optgroup { color:var(--text-secondary);font-size:.75rem; }

  /* ── Responsive / mobile ────────────────────────────────────────── */
  @media(max-width:700px){
    /* Stat cards: 2 columns on narrow screens */
    .etf-stat-card  { padding:.65rem .5rem; }
    .etf-stat-value { font-size:1rem!important; }
    .etf-stat-label { font-size:.62rem; }

    /* Mode/DRP buttons: allow wrapping and shrink text */
    .mode-btn { padding:.35rem .6rem;font-size:.75rem; }

    /* Charts: ensure they don't overflow on narrow viewports */
    svg[viewBox] { max-width:100%; }

    /* Overlap toggles: wrap tightly */
    .overlap-toggle { padding:.25rem .45rem;font-size:.7rem; }
  }

  @media(max-width:480px){
    .etf-stat-value { font-size:.85rem!important; }
    .mode-btn { padding:.3rem .5rem;font-size:.7rem; }
    .etf-select,.etf-input { font-size:.8rem;padding:.45rem .55rem; }
  }

  /* Force inline grid layouts to collapse on mobile.
     These are applied to elements using inline style="display:grid;grid-template-columns:..."
     We override with a utility class attached via JS. */
  @media(max-width:600px){
    .resp-grid-2  { grid-template-columns:1fr 1fr!important; }
    .resp-grid-1  { grid-template-columns:1fr!important; }
  }
  @media(max-width:420px){
    .resp-grid-2  { grid-template-columns:1fr!important; }
  }
`;
document.head.appendChild(_css);

// ── Init ───────────────────────────────────────────────────────────
async function initETF() {
  try {
    etfData = await (await fetch('/data/etf_data.json')).json();
    // Seed retState.customAlloc from default preset
    retState.customAlloc = {...etfData.portfolioPresets[retState.preset].allocation};
    renderETFTools();
  } catch(e) {
    console.error(e);
    const c=document.getElementById('etf-tool-container');
    if(c) c.innerHTML='<p style="color:var(--tritc-red);padding:2rem;text-align:center;">ETF data unavailable. Please try again later.</p>';
  }
}
initETF();
