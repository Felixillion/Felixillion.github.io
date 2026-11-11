/* ETF Tools — compare funds, backtest a portfolio, track your own holdings.
 * Data: data/prices/<CODE>.json (weekly, built by .github/workflows/scripts/fetch_prices.py from Yahoo
 * Finance) and data/etf_data.json (hand-checked fees, sectors and top holdings for ~45 popular funds).
 * Everything runs in the browser; "My portfolio" is saved only in this browser (localStorage).
 */
'use strict';
const ETF_TOOLS_VERSION = '2026-11-11-rebuild';
const BASE = (document.querySelector('meta[name="baseurl"]')?.content || '');
const PRICE_URL = c => `${BASE}/data/prices/${c}.json`;
const STORE_KEY = 'felixillion-etf-portfolio-v1';
const MOS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PALETTE = ['#38bdf8','#4ade80','#f59e0b','#a78bfa','#f472b6','#fb923c','#2dd4bf','#e879f9'];
const SEC_CLR = { 'Financials':'#38bdf8','Materials':'#f59e0b','Health Care':'#4ade80','Info. Technology':'#a78bfa',
  'Industrials':'#fb923c','Consumer Staples':'#2dd4bf','Consumer Discretionary':'#f472b6','Energy':'#ef4444',
  'Real Estate':'#84cc16','Comm. Services':'#e879f9','Utilities':'#94a3b8','Other':'#475569','Fixed Income':'#64748b','Cash':'#334155' };

// Australian CPI, annual-average % change (RBA Table G1 / ABS) — for "today's dollars"
const AU_CPI_YR = { 1990:7.3,1991:3.2,1992:1,1993:1.8,1994:1.9,1995:4.6,1996:2.6,1997:0.3,1998:0.9,1999:1.5,2000:4.5,
  2001:4.4,2002:3,2003:2.8,2004:2.3,2005:2.7,2006:3.5,2007:2.4,2008:4.3,2009:1.8,2010:2.9,2011:3.4,2012:1.7,2013:2.4,
  2014:2.5,2015:1.5,2016:1.3,2017:1.9,2018:1.9,2019:1.6,2020:0.9,2021:2.9,2022:6.6,2023:5.6,2024:3.2,2025:2.8 };

// ── small helpers ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const money = (v, dp = 0) => v == null || !isFinite(v) ? '—' : (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-AU', {minimumFractionDigits: dp, maximumFractionDigits: dp});
const moneyK = v => { const a = Math.abs(v); const s = v < 0 ? '−$' : '$';
  return a >= 1e6 ? s + (a/1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M' : a >= 1e4 ? s + Math.round(a/1e3) + 'k' : a >= 1e3 ? s + (a/1e3).toFixed(1) + 'k' : s + Math.round(a); };
const pct = (v, dp = 1) => v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(dp) + '%';
const pctPlain = (v, dp = 1) => v == null || !isFinite(v) ? '—' : v.toFixed(dp) + '%';
const posNeg = v => v == null ? 'var(--text-secondary)' : v >= 0 ? '#4ade80' : '#f87171';
const iso = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const daysBetween = (a, b) => (new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5;
const fmtDate = s => { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${+d} ${MOS[+m - 1]} ${y}`; };
const fmtMonth = s => { const [y, m] = s.split('-'); return `${MOS[+m - 1]} ${y}`; };
const friday = s => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7)); return iso(d); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, dflt = 0) => { const n = parseFloat(String(v).replace(/[$,\s]/g, '')); return isFinite(n) ? n : dflt; };

// CPI index (1.0 at the start of 1990), interpolated weekly — good enough to express results in today's dollars
function cpiIndex(dateStr) {
  const y = +dateStr.slice(0, 4), frac = daysBetween(`${y}-01-01`, dateStr) / 365.25;
  let idx = 1;
  for (let yr = 1990; yr < y; yr++) idx *= 1 + (AU_CPI_YR[yr] ?? 2.5) / 100;
  return idx * Math.pow(1 + (AU_CPI_YR[y] ?? 2.5) / 100, frac);
}

// ── data layer ───────────────────────────────────────────────────────────────
let INDEX = null, ETF_META = null, ASSET = null;
const _series = {}, _pending = {};
async function loadIndex() {
  if (INDEX) return INDEX;
  try { INDEX = await (await fetch(`${BASE}/data/prices/index.json`)).json(); }
  catch (e) { INDEX = { tickers: [], updated: null }; }
  INDEX.byCode = Object.fromEntries((INDEX.tickers || []).map(t => [t.c, t]));
  return INDEX;
}
async function loadMeta() {
  if (ETF_META) return ETF_META;
  try { const d = await (await fetch(`${BASE}/data/etf_data.json`)).json(); ETF_META = d.etfs || {}; ASSET = d.assetClassReturns || {}; } catch (e) { ETF_META = {}; ASSET = {}; }
  return ETF_META;
}
/** Weekly series for a code: {code, name, dates[], p[], x[], d[[date,amt]]} or null if not available. */
async function loadSeries(code) {
  code = String(code || '').toUpperCase().trim();
  if (!code) return null;
  if (code in _series) return _series[code];
  if (_pending[code]) return _pending[code];
  _pending[code] = fetch(PRICE_URL(code)).then(r => r.ok ? r.json() : null).then(r => {
    if (!r) return (_series[code] = null);
    const dates = r.p.map((_, i) => addDays(r.s, 7 * i));
    return (_series[code] = { code, name: r.n, type: r.t, region: r.r, updated: r.u, dates, p: r.p, x: r.x, d: r.d || [],
      start: dates[0], end: dates[dates.length - 1], pos: Object.fromEntries(dates.map((d, i) => [d, i])) });
  }).catch(() => (_series[code] = null)).finally(() => delete _pending[code]);
  return _pending[code];
}
const at = (s, date) => s.pos[date];           // week index of a Friday date in a series

// Weekly Fridays from a to b inclusive
function weeks(a, b) { const out = []; for (let d = friday(a); d <= b; d = addDays(d, 7)) out.push(d); return out; }

// Contribution dates on a weekly grid
function contribFlags(grid, freq) {
  const f = grid.map(() => false);
  if (freq === 'none') return f;
  grid.forEach((d, i) => {
    if (i === 0) return;                                   // the starting amount covers week 0
    const prev = grid[i - 1];
    if (freq === 'weekly') f[i] = true;
    else if (freq === 'fortnightly') f[i] = i % 2 === 0;
    else if (freq === 'monthly') f[i] = d.slice(5, 7) !== prev.slice(5, 7);
    else if (freq === 'quarterly') f[i] = d.slice(5, 7) !== prev.slice(5, 7) && ['01','04','07','10'].includes(d.slice(5, 7));
    else if (freq === 'yearly') f[i] = d.slice(0, 4) !== prev.slice(0, 4);
  });
  return f;
}
const FREQ_PER_YEAR = { none: 0, weekly: 52, fortnightly: 26, monthly: 12, quarterly: 4, yearly: 1 };

// ── statistics ───────────────────────────────────────────────────────────────
function cagr(v0, v1, years) { return v0 > 0 && years > 0 ? (Math.pow(v1 / v0, 1 / years) - 1) * 100 : null; }
function maxDrawdown(vals, dates) {
  let peak = vals[0], peakI = 0, worst = 0, wPeak = 0, wTrough = 0;
  vals.forEach((v, i) => { if (v > peak) { peak = v; peakI = i; } const dd = v / peak - 1; if (dd < worst) { worst = dd; wPeak = peakI; wTrough = i; } });
  let rec = null; for (let i = wTrough; i < vals.length; i++) if (vals[i] >= vals[wPeak]) { rec = i; break; }
  return { pct: worst * 100, peak: dates?.[wPeak], trough: dates?.[wTrough], recovered: rec != null ? dates?.[rec] : null };
}
function volatility(vals) {
  const r = []; for (let i = 1; i < vals.length; i++) if (vals[i - 1] > 0) r.push(Math.log(vals[i] / vals[i - 1]));
  if (r.length < 10) return null;
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1) * 52) * 100;
}
function calendarReturns(vals, dates) {                     // full calendar years only (+ YTD flagged)
  const ye = {}, first = dates[0].slice(0, 4);
  dates.forEach((d, i) => { ye[d.slice(0, 4)] = vals[i]; });
  const out = {};
  // a year counts when the series has a value at the end of the previous year (so a part-year start is skipped)
  Object.keys(ye).sort().forEach(y => { const p = String(+y - 1); if (ye[p] != null && p >= first) out[y] = (ye[y] / ye[p] - 1) * 100; });
  return out;
}
function correl(a, b) {
  const n = Math.min(a.length, b.length); if (n < 10) return null;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  return c / Math.sqrt(va * vb);
}
const weeklyRets = v => v.slice(1).map((x, i) => x / v[i] - 1);
/** Money-weighted annual return. flows: [{date, amount}] (negative = money in), final value positive at endDate. */
function xirr(flows) {
  if (flows.length < 2 || !flows.some(f => f.amount < 0) || !flows.some(f => f.amount > 0)) return null;
  const t0 = flows[0].date, t = flows.map(f => daysBetween(t0, f.date) / 365.25);
  const npv = r => flows.reduce((s, f, i) => s + f.amount / Math.pow(1 + r, t[i]), 0);
  let lo = -0.99, hi = 10;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; (npv(lo) * npv(m) <= 0) ? hi = m : lo = m; }
  return (lo + hi) / 2 * 100;
}

// ── SVG line chart with hover ────────────────────────────────────────────────
/** series: [{name, color, vals[], dash?, width?}], dates[] shared. Returns HTML; call wireChart(id) after insert. */
const _charts = {};
function lineChart(id, dates, series, opts = {}) {
  const W = 860, H = opts.height || 300, P = { t: 14, r: 14, b: 32, l: 64 }, cw = W - P.l - P.r, ch = H - P.t - P.b;
  const all = series.flatMap(s => s.vals.filter(v => v != null && isFinite(v)));
  let lo = opts.min ?? Math.min(0, ...all), hi = Math.max(...all, lo + 1);
  if (opts.log) { lo = Math.max(Math.min(...all), 1e-6); }
  const y = v => opts.log ? ch - (Math.log(v / lo) / Math.log(hi / lo)) * ch : ch - (v - lo) / (hi - lo) * ch;
  const x = i => dates.length > 1 ? i / (dates.length - 1) * cw : 0;
  const fmtY = opts.fmt || moneyK;
  let ticks;
  if (opts.log) ticks = [lo, Math.sqrt(lo * hi), hi];
  else { const st = niceStep((hi - lo) / 4); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st; ticks = []; for (let v = lo; v <= hi + st / 2; v += st) ticks.push(v); }
  const years = [...new Set(dates.map(d => d.slice(0, 4)))];
  const step = Math.max(1, Math.ceil(years.length / 10));
  const yearTicks = years.filter((_, i) => i % step === 0).map(yr => dates.findIndex(d => d.startsWith(yr))).filter(i => i > 0);
  const path = s => { let out = '', pen = false;
    s.vals.forEach((v, i) => { if (v == null || !isFinite(v)) { pen = false; return; } out += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true; });
    return out; };
  _charts[id] = { dates, series, x, cw, P, fmt: opts.tipFmt || (v => money(v)), W };
  return `<div class="etf-chart" style="position:relative;">
    <svg id="${id}" viewBox="0 0 ${W} ${H}" width="100%" style="display:block;cursor:crosshair;" role="img" aria-label="${esc(opts.label || 'Chart')}">
      <rect width="${W}" height="${H}" fill="#020818" rx="8"/>
      <g transform="translate(${P.l},${P.t})">
        ${ticks.map(v => `<line x1="0" x2="${cw}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#1e293b" stroke-dasharray="3,3"/>
          <text x="-8" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" fill="#64748b" font-size="11" font-family="monospace">${fmtY(v)}</text>`).join('')}
        ${opts.zero && lo < 0 ? `<line x1="0" x2="${cw}" y1="${y(0)}" y2="${y(0)}" stroke="#475569"/>` : ''}
        ${yearTicks.map(i => `<text x="${x(i).toFixed(1)}" y="${ch + 20}" text-anchor="middle" fill="#64748b" font-size="11">${dates[i].slice(0, 4)}</text>`).join('')}
        ${series.map(s => s.area ? `<path d="${path(s)} L${x(s.vals.length - 1).toFixed(1)},${y(Math.max(lo, 0))} L0,${y(Math.max(lo, 0))} Z" fill="${s.color}" opacity=".18"/>` : '').join('')}
        ${series.map(s => `<path d="${path(s)}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round"/>`).join('')}
        <line id="${id}-x" y1="0" y2="${ch}" stroke="#64748b" opacity="0"/>
        <rect id="${id}-hit" width="${cw}" height="${ch}" fill="transparent"/>
      </g>
    </svg>
    <div id="${id}-tip" class="etf-tip"></div>
    ${opts.legend === false ? '' : `<div class="etf-legend">${series.filter(s => s.name).map(s => `<span><i style="background:${s.color};${s.dash ? 'opacity:.6' : ''}"></i>${esc(s.name)}</span>`).join('')}</div>`}
  </div>`;
}
function wireChart(id) {
  const c = _charts[id], svg = $(id), hit = $(id + '-hit'), tip = $(id + '-tip'), xl = $(id + '-x');
  if (!c || !svg || !hit) return;
  const move = ev => {
    const r = svg.getBoundingClientRect(), pt = (ev.touches ? ev.touches[0] : ev);
    const sx = (pt.clientX - r.left) / r.width * c.W - c.P.l;
    const i = clamp(Math.round(sx / c.cw * (c.dates.length - 1)), 0, c.dates.length - 1);
    xl.setAttribute('x1', c.x(i)); xl.setAttribute('x2', c.x(i)); xl.setAttribute('opacity', '1');
    tip.innerHTML = `<div style="color:#94a3b8;margin-bottom:.2rem;">${fmtDate(c.dates[i])}</div>` +
      c.series.filter(s => s.name && s.vals[i] != null).map(s => `<div><span style="color:${s.color};">●</span> ${esc(s.name)}: <b>${c.fmt(s.vals[i], s)}</b></div>`).join('');
    tip.style.display = 'block';
    const left = (pt.clientX - r.left) > r.width * 0.6 ? (pt.clientX - r.left) - tip.offsetWidth - 12 : (pt.clientX - r.left) + 12;
    tip.style.left = Math.max(0, left) + 'px'; tip.style.top = '10px';
  };
  const out = () => { tip.style.display = 'none'; xl.setAttribute('opacity', '0'); };
  hit.addEventListener('mousemove', move); hit.addEventListener('mouseleave', out);
  hit.addEventListener('touchmove', e => { move(e); }, { passive: true }); hit.addEventListener('touchend', out);
}
const niceStep = r => { const p = Math.pow(10, Math.floor(Math.log10(r))), m = r / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
/** Bar chart of calendar-year returns: groups = years, bars = series. */
function barChart(years, series) {
  const W = 860, H = 240, P = { t: 14, r: 10, b: 28, l: 44 }, cw = W - P.l - P.r, ch = H - P.t - P.b;
  const vals = series.flatMap(s => years.map(y => s.vals[y]).filter(v => v != null));
  const step = niceStep(Math.max(5, ...vals.map(Math.abs)) / 2);
  const hi = Math.ceil(Math.max(5, ...vals) / step) * step, lo = Math.floor(Math.min(-5, ...vals) / step) * step;
  const y = v => ch - (v - lo) / (hi - lo) * ch, gw = cw / years.length, bw = Math.max(2, (gw * 0.8) / series.length);
  const yt = []; for (let v = lo; v <= hi + 1e-9; v += step) yt.push(+v.toFixed(6));
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;"><rect width="${W}" height="${H}" fill="#020818" rx="8"/>
    <g transform="translate(${P.l},${P.t})">
    ${yt.map(v => `<line x1="0" x2="${cw}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? '#475569' : '#1e293b'}" ${v ? 'stroke-dasharray="3,3"' : ''}/><text x="-6" y="${y(v) + 4}" text-anchor="end" fill="#64748b" font-size="11" font-family="monospace">${Math.round(v)}%</text>`).join('')}
    ${years.map((yr, gi) => series.map((s, si) => { const v = s.vals[yr]; if (v == null) return '';
      const x0 = gi * gw + gw * 0.1 + si * bw; return `<rect x="${x0.toFixed(1)}" width="${(bw - 1).toFixed(1)}" y="${Math.min(y(v), y(0)).toFixed(1)}" height="${Math.abs(y(v) - y(0)).toFixed(1)}" fill="${s.color}"><title>${esc(s.name)} ${yr}: ${pct(v)}</title></rect>`; }).join('')
      + (years.length <= 25 || gi % 2 === 0 ? `<text x="${(gi * gw + gw / 2).toFixed(1)}" y="${ch + 18}" text-anchor="middle" fill="#64748b" font-size="10">${years.length > 14 ? "'" + yr.slice(2) : yr}</text>` : '')).join('')}
    </g></svg>`;
}

// ── ticker picker (search the ~670 codes by code or name) ───────────────────
function pickerHTML(id, value, placeholder = 'Code or name, e.g. VAS') {
  return `<div class="etf-picker" data-picker="${id}">
    <input id="${id}" class="etf-input" value="${esc(value || '')}" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false">
    <div class="etf-sugg" id="${id}-sugg"></div></div>`;
}
function wirePicker(id, onPick) {
  const inp = $(id), box = $(id + '-sugg');
  if (!inp) return;
  const show = () => {
    const q = inp.value.trim().toUpperCase();
    if (!q || !INDEX?.tickers?.length) { box.style.display = 'none'; return; }
    const hits = INDEX.tickers.filter(t => t.c.startsWith(q)).concat(
      INDEX.tickers.filter(t => !t.c.startsWith(q) && (t.n || '').toUpperCase().includes(q))).slice(0, 12);
    box.innerHTML = hits.length ? hits.map(t => `<div class="etf-sugg-row" data-c="${t.c}"><b>${t.c}</b> <span>${esc(t.n)}</span> <em>${esc(t.t)}</em></div>`).join('')
      : `<div class="etf-sugg-row etf-sugg-none">Not on the list — ${requestLink(q)}</div>`;
    box.style.display = 'block';
  };
  inp.addEventListener('input', show);
  inp.addEventListener('focus', show);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const c = inp.value.trim().toUpperCase(); if (c) { box.style.display = 'none'; onPick(c); } } });
  inp.addEventListener('blur', () => setTimeout(() => box.style.display = 'none', 200));
  box.addEventListener('mousedown', e => { const r = e.target.closest('[data-c]'); if (r) { e.preventDefault(); inp.value = r.dataset.c; box.style.display = 'none'; onPick(r.dataset.c); } });
}
const REPO = 'https://github.com/Felixillion/Felixillion.github.io';
function requestLink(code) {
  const c = encodeURIComponent(String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  return `<a href="${REPO}/issues/new?title=Add%20ticker%3A%20${c}&body=${encodeURIComponent('Please add this ASX code to the ETF Tools price list. (Leave the title as “Add ticker: CODE” — it is processed automatically.)')}" target="_blank" rel="noopener">request ${c ? decodeURIComponent(c) : 'a ticker'} ↗</a>`;
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — COMPARE
// ════════════════════════════════════════════════════════════════════════════
const cmp = { codes: ['VAS', 'VGS', 'NDQ'], start: '', end: '', initial: 10000, contrib: 500, freq: 'monthly', drp: true, fee: 0, real: false };

/** Simulate one fund on a weekly grid. Buys happen at the Friday close; DRP reinvests at the ex-date close. */
function simulate(s, grid, cfg) {
  const flags = contribFlags(grid, cfg.freq);
  const i0 = at(s, grid[0]);
  let u = 0, cash = 0, invested = 0, income = 0;
  const value = [], inv = [], flows = [], incomeArr = [];
  let di = s.d.findIndex(([d]) => d > grid[0]); if (di < 0) di = s.d.length;
  grid.forEach((date, k) => {
    const i = i0 + k;
    // distributions with ex-date in (previous Friday, this Friday] go to units held before this week's buy
    if (!cfg.drp && k > 0) {
      while (di < s.d.length && s.d[di][0] <= date) { const amt = u * s.d[di][1]; cash += amt; income += amt; di++; }
    }
    const buy = k === 0 ? cfg.initial : (flags[k] ? cfg.contrib : 0);
    if (buy > 0) {
      const net = Math.max(0, buy - cfg.fee);
      u += net / (cfg.drp ? s.x[i] : s.p[i]);
      invested += buy; flows.push({ date, amount: -buy });
    }
    value.push(u * (cfg.drp ? s.x[i] : s.p[i]) + cash); inv.push(invested); incomeArr.push(income);
  });
  flows.push({ date: grid[grid.length - 1], amount: value[value.length - 1] });
  return { value, invested: inv, income: incomeArr, flows, totalIncome: income };
}

/** Stats on the fund itself (independent of contributions) over a grid. */
function fundStats(s, grid) {
  const i0 = at(s, grid[0]), i1 = at(s, grid[grid.length - 1]);
  const xs = s.x.slice(i0, i1 + 1), ps = s.p.slice(i0, i1 + 1), yrs = daysBetween(grid[0], grid[grid.length - 1]) / 365.25;
  const cal = calendarReturns(xs, grid), years = Object.keys(cal);
  const last12 = addDays(grid[grid.length - 1], -365);
  const ttm = s.d.filter(([d]) => d > last12 && d <= grid[grid.length - 1]).reduce((a, [, v]) => a + v, 0);
  return { tr: cagr(xs[0], xs[xs.length - 1], yrs), price: cagr(ps[0], ps[ps.length - 1], yrs), vol: volatility(xs),
    dd: maxDrawdown(xs, grid), cal, best: years.length ? Math.max(...years.map(y => cal[y])) : null,
    worst: years.length ? Math.min(...years.map(y => cal[y])) : null, yield: ps.length ? ttm / ps[ps.length - 1] * 100 : null, xs };
}

function readHash() {
  const h = location.hash.replace(/^#/, ''); if (!h) return;
  const [tab, q] = h.split('?'); if (tab) state.tab = tab;
  if (!q) return;
  const p = new URLSearchParams(q);
  if (tab === 'compare') {
    if (p.get('c')) cmp.codes = p.get('c').toUpperCase().split(',').filter(Boolean).slice(0, 6);
    ['start', 'end', 'freq'].forEach(k => { if (p.get(k)) cmp[k] = p.get(k); });
    ['initial', 'contrib', 'fee'].forEach(k => { if (p.get(k)) cmp[k] = num(p.get(k)); });
    if (p.get('drp')) cmp.drp = p.get('drp') === '1';
    if (p.get('real')) cmp.real = p.get('real') === '1';
  }
  if (tab === 'backtest' && p.get('a')) {
    const parse = v => v.split(',').map(t => { const [c, w] = t.split(':'); return { c: c.toUpperCase(), w: num(w) }; }).filter(h => h.c);
    bt.a = parse(p.get('a')); bt.b = p.get('b') ? parse(p.get('b')) : [];
    ['start', 'end', 'rebal', 'freq'].forEach(k => { if (p.get(k)) bt[k] = p.get(k); });
    ['initial', 'contrib'].forEach(k => { if (p.get(k)) bt[k] = num(p.get(k)); });
  }
}
function writeHash() {
  let q = '';
  if (state.tab === 'compare') q = new URLSearchParams({ c: cmp.codes.join(','), start: cmp.start, end: cmp.end, initial: cmp.initial, contrib: cmp.contrib,
    freq: cmp.freq, drp: cmp.drp ? 1 : 0, fee: cmp.fee, real: cmp.real ? 1 : 0 }).toString();
  if (state.tab === 'backtest') q = new URLSearchParams({ a: bt.a.map(h => h.c + ':' + h.w).join(','), b: bt.b.map(h => h.c + ':' + h.w).join(','),
    start: bt.start, end: bt.end, rebal: bt.rebal, initial: bt.initial, contrib: bt.contrib, freq: bt.freq }).toString();
  history.replaceState(null, '', '#' + state.tab + (q ? '?' + q : ''));
}

function freqSelect(id, v) {
  return `<select id="${id}" class="etf-input">${[['none', 'No regular amount'], ['weekly', 'Weekly'], ['fortnightly', 'Fortnightly'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly']]
    .map(([k, l]) => `<option value="${k}"${k === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
}

function renderCompare(el) {
  el.innerHTML = `
  <div class="etf-intro">Pick up to 6 ETFs, LICs or ASX 200 shares and see what the same investments would have grown to — a starting amount plus regular contributions, with distributions reinvested or taken as cash.
    Uses real weekly prices and distributions since each fund listed.</div>
  <div class="etf-chips" id="cmp-chips"></div>
  <div class="etf-grid">
    <div><label class="etf-label">Add a fund or share</label>${pickerHTML('cmp-add', '', 'Type a code or name…')}</div>
    <div><label class="etf-label">Starting amount</label><input id="cmp-initial" class="etf-input" inputmode="decimal" value="${cmp.initial}"></div>
    <div><label class="etf-label">Regular amount</label><input id="cmp-contrib" class="etf-input" inputmode="decimal" value="${cmp.contrib}"></div>
    <div><label class="etf-label">How often</label>${freqSelect('cmp-freq', cmp.freq)}</div>
    <div><label class="etf-label">From</label><input id="cmp-start" type="date" class="etf-input" value="${cmp.start}"></div>
    <div><label class="etf-label">To</label><input id="cmp-end" type="date" class="etf-input" value="${cmp.end}"></div>
    <div><label class="etf-label">Brokerage per purchase</label><input id="cmp-fee" class="etf-input" inputmode="decimal" value="${cmp.fee}"></div>
    <div><label class="etf-label">Distributions</label><select id="cmp-drp" class="etf-input"><option value="1"${cmp.drp ? ' selected' : ''}>Reinvested (DRP)</option><option value="0"${!cmp.drp ? ' selected' : ''}>Taken as cash</option></select></div>
  </div>
  <label class="etf-check"><input type="checkbox" id="cmp-real"${cmp.real ? ' checked' : ''}> Show in today's dollars (adjusted for inflation)</label>
  <div id="cmp-out"><div class="etf-loading">Loading prices…</div></div>
  <details class="etf-details" id="cmp-browse"><summary>🔎 Browse all ${INDEX?.tickers?.length || ''} funds and shares — sort by return, yield or history</summary><div id="browse-body"></div></details>`;
  const upd = debounce(() => { readCompareInputs(); computeCompare(); }, 250);
  ['cmp-initial', 'cmp-contrib', 'cmp-fee'].forEach(id => $(id).addEventListener('input', upd));
  ['cmp-freq', 'cmp-start', 'cmp-end', 'cmp-drp', 'cmp-real'].forEach(id => $(id).addEventListener('change', upd));
  wirePicker('cmp-add', c => { if (!cmp.codes.includes(c) && cmp.codes.length < 6) cmp.codes.push(c); $('cmp-add').value = ''; drawChips(); computeCompare(); });
  $('cmp-browse').addEventListener('toggle', e => { if (e.target.open) renderBrowser(); });
  drawChips(); computeCompare();
}
function readCompareInputs() {
  cmp.initial = Math.max(0, num($('cmp-initial').value)); cmp.contrib = Math.max(0, num($('cmp-contrib').value));
  cmp.fee = Math.max(0, num($('cmp-fee').value)); cmp.freq = $('cmp-freq').value; cmp.start = $('cmp-start').value; cmp.end = $('cmp-end').value;
  cmp.drp = $('cmp-drp').value === '1'; cmp.real = $('cmp-real').checked;
}
function drawChips() {
  $('cmp-chips').innerHTML = cmp.codes.map((c, i) => `<span class="etf-chip" style="border-color:${PALETTE[i]};"><i style="background:${PALETTE[i]}"></i>${esc(c)}
    <button type="button" data-rm="${esc(c)}" aria-label="Remove ${esc(c)}">✕</button></span>`).join('') +
    (cmp.codes.length ? '' : '<span style="color:var(--text-secondary);font-size:.85rem;">Add a fund to start.</span>');
  $('cmp-chips').querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { cmp.codes = cmp.codes.filter(c => c !== b.dataset.rm); drawChips(); computeCompare(); }));
}

async function computeCompare() {
  writeHash();
  const out = $('cmp-out'); if (!out) return;
  if (!cmp.codes.length) { out.innerHTML = ''; return; }
  const loaded = await Promise.all(cmp.codes.map(loadSeries));
  const missing = cmp.codes.filter((c, i) => !loaded[i]);
  const ss = loaded.filter(Boolean);
  let note = missing.length ? `<div class="etf-warn">No price data for ${missing.map(esc).join(', ')} — ${missing.map(requestLink).join(' · ')} (added automatically, usually within minutes).</div>` : '';
  if (!ss.length) { out.innerHTML = note || '<div class="etf-warn">Price data not available yet.</div>'; return; }
  // common period: the latest listing date of the chosen funds to the earliest last price
  const first = ss.reduce((a, s) => s.start > a.start ? s : a);
  let a = first.start, b = ss.map(s => s.end).sort()[0];
  if (cmp.start && friday(cmp.start) > a) a = friday(cmp.start);
  if (cmp.end && cmp.end < b) b = cmp.end;
  const grid = weeks(a, b).filter(d => ss.every(s => at(s, d) != null));
  if (grid.length < 5) { out.innerHTML = note + '<div class="etf-warn">Pick a longer period (these funds don\'t share at least a few weeks of history in the dates chosen).</div>'; return; }
  if (!cmp.start && ss.length > 1) note += `<div class="etf-note">Compared over the period all of them have traded: from <b>${fmtDate(grid[0])}</b> (when ${esc(first.code)} listed) to ${fmtDate(grid[grid.length - 1])}. Set “From” to change it.</div>`;
  const cfg = { ...cmp };
  const sims = ss.map(s => simulate(s, grid, cfg)), stats = ss.map(s => fundStats(s, grid));
  const end = grid[grid.length - 1];
  const realF = cmp.real ? grid.map(d => cpiIndex(end) / cpiIndex(d)) : grid.map(() => 1);
  const realInv = (() => { let tot = 0; const fl = contribFlags(grid, cmp.freq); return grid.map((d, k) => { const add = k === 0 ? cmp.initial : fl[k] ? cmp.contrib : 0; tot += add * (cpiIndex(end) / cpiIndex(d)); return tot; }); })();
  const series = ss.map((s, i) => ({ name: s.code, color: PALETTE[cmp.codes.indexOf(s.code)], vals: sims[i].value.map((v, k) => v * realF[k]) }));
  const invVals = cmp.real ? realInv : sims[0].invested;
  const chart = lineChart('cmp-chart', grid, [...series, { name: cmp.real ? 'Total put in (today\'s $)' : 'Total put in', color: '#94a3b8', dash: '5,4', width: 1.5, vals: invVals }],
    { label: 'Value over time' });
  const yearsAll = [...new Set(stats.flatMap(st => Object.keys(st.cal)))].sort();
  const ytdYear = end.slice(0, 4), ytdShown = !end.endsWith('-12-31') && end < `${ytdYear}-12-24`;
  const rows = [
    ['Total put in', (s, i) => money(cmp.real ? realInv[realInv.length - 1] : sims[i].invested.at(-1))],
    ['Value at ' + fmtDate(end), (s, i) => `<b>${money(sims[i].value.at(-1))}</b>`],
    ['Gain', (s, i) => { const g = sims[i].value.at(-1) - (cmp.real ? realInv.at(-1) : sims[i].invested.at(-1)); return `<span style="color:${posNeg(g)}">${money(g)}</span>`; }],
    ...(!cmp.drp ? [['Distributions received (cash)', (s, i) => money(sims[i].totalIncome)]] : []),
    ['Your annual return <span class="etf-q" title="Money-weighted (like an IRR): accounts for when each contribution went in. Before tax; after the fund\'s fees; brokerage included.">?</span>', (s, i) => { const r = xirr(sims[i].flows); return `<span style="color:${posNeg(r)}">${pct(r)}</span>`; }],
    ['Fund total return p.a. <span class="etf-q" title="Time-weighted return of the fund itself with distributions reinvested, after its fees.">?</span>', (s, i) => pct(stats[i].tr)],
    ['Price-only growth p.a.', (s, i) => pct(stats[i].price)],
    ['Distribution yield (last 12 months)', (s, i) => pctPlain(stats[i].yield)],
    ['Worst fall (peak to bottom)', (s, i) => `<span style="color:#f87171">${pct(stats[i].dd.pct)}</span><div class="etf-sub">${stats[i].dd.peak ? fmtMonth(stats[i].dd.peak) + ' → ' + fmtMonth(stats[i].dd.trough) + (stats[i].dd.recovered ? ', recovered ' + fmtMonth(stats[i].dd.recovered) : ', not yet recovered') : ''}</div>`],
    ['Volatility <span class="etf-q" title="Annualised standard deviation of weekly returns.">?</span>', (s, i) => pctPlain(stats[i].vol)],
    ['Best / worst calendar year', (s, i) => stats[i].best == null ? '—' : `${pct(stats[i].best, 0)} / ${pct(stats[i].worst, 0)}`],
    ['Listed', s => fmtDate(s.start)],
  ];
  out.innerHTML = note + chart + `
    <div style="overflow-x:auto;margin-top:1rem;"><table class="etf-table">
      <thead><tr><th></th>${ss.map(s => `<th style="color:${PALETTE[cmp.codes.indexOf(s.code)]}">${esc(s.code)}<div class="etf-sub">${esc(s.name)}</div></th>`).join('')}</tr></thead>
      <tbody>${rows.map(([l, f]) => `<tr><td>${l}</td>${ss.map((s, i) => `<td>${f(s, i)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <h4 class="etf-h4">Calendar-year total returns</h4>
    ${yearsAll.length ? barChart(yearsAll, ss.map((s, i) => ({ name: s.code, color: PALETTE[cmp.codes.indexOf(s.code)], vals: stats[i].cal }))) : ''}
    <div style="overflow-x:auto;"><table class="etf-table etf-table-num">
      <thead><tr><th>Year</th>${ss.map(s => `<th>${esc(s.code)}</th>`).join('')}</tr></thead>
      <tbody>${yearsAll.slice().reverse().map(y => `<tr><td>${y}${y === ytdYear && ytdShown ? ' <span class="etf-sub">to ' + fmtDate(end).slice(0, -5) + '</span>' : ''}</td>${stats.map(st => `<td style="color:${posNeg(st.cal[y])}">${pct(st.cal[y])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="etf-actions"><button type="button" class="dl-btn" id="cmp-csv">⬇ Weekly values (CSV)</button>
      <button type="button" class="dl-btn" id="cmp-share">🔗 Copy link to this comparison</button>
      <button type="button" class="dl-btn" id="cmp-to-bt">📐 Backtest these as a portfolio →</button></div>
    <div class="etf-fine">Before tax and franking credits; after each fund's fees (they're taken out of the unit price). ${cmp.drp ? 'Distributions are reinvested at the price on the ex-date (a close approximation of DRP).' : 'Distributions are kept as cash, without interest.'}
      Prices are weekly closes from Yahoo Finance, updated weekly${INDEX?.updated ? ' (last update ' + fmtDate(INDEX.updated) + ')' : ''}. Past performance is not a reliable indicator of future performance.</div>`;
  wireChart('cmp-chart');
  $('cmp-csv').onclick = () => csv([['Date', 'Total put in', ...ss.map(s => s.code + ' value')], ...grid.map((d, k) => [d, invVals[k].toFixed(2), ...sims.map(sm => sm.value[k].toFixed(2))])], 'etf-comparison.csv');
  $('cmp-share').onclick = () => { navigator.clipboard?.writeText(location.href); $('cmp-share').textContent = '✓ Link copied'; };
  $('cmp-to-bt').onclick = () => { bt.a = ss.map(s => ({ c: s.code, w: +(100 / ss.length).toFixed(1) })); bt.b = []; setTab('backtest'); };
}
function csv(rows, name) {
  const blob = new Blob([rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── fund browser ─────────────────────────────────────────────────────────────
const brw = { q: '', type: 'all', region: 'all', sort: 'r5', dir: -1, limit: 60 };
function renderBrowser() {
  const body = $('browse-body'); if (!body || !INDEX?.tickers) return;
  const regions = [...new Set(INDEX.tickers.map(t => t.r).filter(Boolean))].sort();
  body.innerHTML = `<div class="etf-grid" style="margin:.6rem 0;">
      <div><label class="etf-label">Search</label><input id="brw-q" class="etf-input" value="${esc(brw.q)}" placeholder="e.g. nasdaq, bond, VAS"></div>
      <div><label class="etf-label">Type</label><select id="brw-type" class="etf-input">${['all', 'ETF', 'LIC', 'Share'].map(t => `<option${brw.type === t ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label class="etf-label">Region</label><select id="brw-region" class="etf-input"><option value="all">All</option>${regions.map(r => `<option${brw.region === r ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></div>
    </div><div id="brw-table"></div>`;
  const draw = () => {
    const q = brw.q.toUpperCase();
    let rows = INDEX.tickers.filter(t => (brw.type === 'all' || t.t === brw.type) && (brw.region === 'all' || t.r === brw.region)
      && (!q || t.c.includes(q) || (t.n || '').toUpperCase().includes(q)));
    const k = brw.sort;
    rows.sort((a, b) => { const va = a[k], vb = b[k]; if (va == null) return 1; if (vb == null) return -1; return (va > vb ? 1 : va < vb ? -1 : 0) * brw.dir; });
    const cols = [['c', 'Code'], ['n', 'Name'], ['r1', '1 yr'], ['r3', '3 yr p.a.'], ['r5', '5 yr p.a.'], ['r10', '10 yr p.a.'], ['y', 'Yield'], ['s', 'Since']];
    $('brw-table').innerHTML = `<div style="overflow-x:auto;"><table class="etf-table etf-table-num etf-sortable"><thead><tr>${cols.map(([k, l]) => `<th data-k="${k}">${l}${brw.sort === k ? (brw.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}<th></th></tr></thead><tbody>
      ${rows.slice(0, brw.limit).map(t => `<tr><td><b>${t.c}</b></td><td class="etf-name">${esc(t.n)}<div class="etf-sub">${esc(t.t)}${t.r ? ' · ' + esc(t.r) : ''}</div></td>
        ${['r1', 'r3', 'r5', 'r10'].map(k => `<td style="color:${posNeg(t[k])}">${pct(t[k])}</td>`).join('')}<td>${pctPlain(t.y)}</td><td>${t.s?.slice(0, 4) || ''}</td>
        <td><button type="button" class="dl-btn" data-add="${t.c}">+ compare</button></td></tr>`).join('')}</tbody></table></div>
      <div class="etf-fine">${rows.length} match${rows.length === 1 ? '' : 'es'}${rows.length > brw.limit ? ` — showing ${brw.limit}. <a href="#" id="brw-more">Show more</a>` : ''}. Total returns (distributions reinvested) to ${fmtDate(INDEX.updated)}; yield = distributions in the last 12 months ÷ price.
      Not there? ${requestLink('')}.</div>`;
    $('brw-table').querySelectorAll('th[data-k]').forEach(th => th.onclick = () => { if (brw.sort === th.dataset.k) brw.dir *= -1; else { brw.sort = th.dataset.k; brw.dir = ['c', 'n', 's'].includes(th.dataset.k) ? 1 : -1; } draw(); });
    $('brw-table').querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const c = b.dataset.add; if (!cmp.codes.includes(c)) { if (cmp.codes.length >= 6) cmp.codes.shift(); cmp.codes.push(c); } drawChips(); computeCompare(); b.textContent = '✓ added'; });
    $('brw-more')?.addEventListener('click', e => { e.preventDefault(); brw.limit += 100; draw(); });
  };
  $('brw-q').addEventListener('input', debounce(e => { brw.q = $('brw-q').value; brw.limit = 60; draw(); }, 200));
  $('brw-type').onchange = e => { brw.type = e.target.value; draw(); };
  $('brw-region').onchange = e => { brw.region = e.target.value; draw(); };
  draw();
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — BACKTEST A PORTFOLIO
// ════════════════════════════════════════════════════════════════════════════
const bt = { a: [{ c: 'VAS', w: 40 }, { c: 'VGS', w: 50 }, { c: 'VGE', w: 10 }], b: [{ c: 'VDHG', w: 100 }],
  rebal: 'yearly', initial: 10000, contrib: 0, freq: 'monthly', start: '', end: '' };
const BT_PRESETS = [
  ['DIY high growth (VAS / VGS / VGE)', [['VAS', 40], ['VGS', 50], ['VGE', 10]]],
  ['DIY balanced (VAS / VGS / VAF / VIF)', [['VAS', 30], ['VGS', 30], ['VAF', 20], ['VIF', 20]]],
  ['Vanguard High Growth (VDHG)', [['VDHG', 100]]],
  ['Betashares All Growth (DHHF)', [['DHHF', 100]]],
  ['Australian shares only (A200)', [['A200', 100]]],
  ['US tech tilt (VAS / IVV / NDQ)', [['VAS', 40], ['IVV', 40], ['NDQ', 20]]],
];

function portfolioEditor(key, title, color) {
  const rows = bt[key];
  const tot = rows.reduce((a, h) => a + (+h.w || 0), 0);
  return `<div class="etf-port" style="border-color:${color}55;">
    <div class="etf-port-head"><b style="color:${color}">${title}</b>
      <select class="etf-input etf-preset" data-key="${key}" style="max-width:260px;"><option value="">Load an example…</option>${BT_PRESETS.map((p, i) => `<option value="${i}">${esc(p[0])}</option>`).join('')}${key === 'b' ? '<option value="clear">— none (no comparison)</option>' : ''}</select></div>
    ${rows.map((h, i) => `<div class="etf-port-row">${pickerHTML(`bt-${key}-c${i}`, h.c)}
      <div class="etf-w"><input class="etf-input" id="bt-${key}-w${i}" inputmode="decimal" value="${h.w}"><span>%</span></div>
      <button type="button" class="etf-x" data-rm="${key}:${i}" aria-label="Remove">✕</button></div>`).join('')}
    <div class="etf-port-foot"><button type="button" class="dl-btn" data-addrow="${key}">+ Add holding</button>
      <span style="color:${Math.abs(tot - 100) < 0.05 ? 'var(--text-secondary)' : '#fbbf24'};font-size:.8rem;">Total ${+tot.toFixed(2)}%${Math.abs(tot - 100) >= 0.05 && rows.length ? ' — scaled to 100%' : ''}</span></div>
  </div>`;
}

function renderBacktest(el) {
  el.innerHTML = `<div class="etf-intro">Build a portfolio from any of the funds and shares, choose how often it's rebalanced, and see how it would have done — growth, worst falls, year-by-year returns and how the holdings move together.
    Optionally compare it with a second portfolio or a single fund (like Portfolio Visualizer, but with Australian prices).</div>
    <div class="etf-port-wrap"><div id="bt-ed-a"></div><div id="bt-ed-b"></div></div>
    <div class="etf-grid">
      <div><label class="etf-label">Rebalance</label><select id="bt-rebal" class="etf-input">${[['none', 'Never (buy and hold)'], ['yearly', 'Every year'], ['quarterly', 'Every quarter'], ['monthly', 'Every month']].map(([k, l]) => `<option value="${k}"${bt.rebal === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label class="etf-label">Starting amount</label><input id="bt-initial" class="etf-input" inputmode="decimal" value="${bt.initial}"></div>
      <div><label class="etf-label">Regular amount</label><input id="bt-contrib" class="etf-input" inputmode="decimal" value="${bt.contrib}"></div>
      <div><label class="etf-label">How often</label>${freqSelect('bt-freq', bt.freq)}</div>
      <div><label class="etf-label">From</label><input id="bt-start" type="date" class="etf-input" value="${bt.start}"></div>
      <div><label class="etf-label">To</label><input id="bt-end" type="date" class="etf-input" value="${bt.end}"></div>
    </div>
    <div id="bt-out"><div class="etf-loading">Loading prices…</div></div>`;
  drawEditors();
  const upd = debounce(() => { readBtInputs(); computeBacktest(); }, 300);
  ['bt-initial', 'bt-contrib'].forEach(id => $(id).addEventListener('input', upd));
  ['bt-rebal', 'bt-freq', 'bt-start', 'bt-end'].forEach(id => $(id).addEventListener('change', upd));
  computeBacktest();
}
function drawEditors() {
  $('bt-ed-a').innerHTML = portfolioEditor('a', 'Portfolio', PALETTE[0]);
  $('bt-ed-b').innerHTML = portfolioEditor('b', 'Compare with (optional)', PALETTE[2]);
  ['a', 'b'].forEach(key => {
    bt[key].forEach((h, i) => {
      wirePicker(`bt-${key}-c${i}`, c => { bt[key][i].c = c; computeBacktest(); });
      $(`bt-${key}-c${i}`).addEventListener('change', e => { bt[key][i].c = e.target.value.trim().toUpperCase(); computeBacktest(); });
      $(`bt-${key}-w${i}`).addEventListener('input', debounce(e => { bt[key][i].w = num(e.target.value); drawEditorsTotals(); computeBacktest(); }, 300));
    });
  });
  document.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.rm.split(':'); bt[k].splice(+i, 1); drawEditors(); computeBacktest(); });
  document.querySelectorAll('[data-addrow]').forEach(b => b.onclick = () => { bt[b.dataset.addrow].push({ c: '', w: 0 }); drawEditors(); });
  document.querySelectorAll('.etf-preset').forEach(sel => sel.onchange = () => {
    const k = sel.dataset.key;
    bt[k] = sel.value === 'clear' ? [] : sel.value === '' ? bt[k] : BT_PRESETS[+sel.value][1].map(([c, w]) => ({ c, w }));
    drawEditors(); computeBacktest(); });
}
function drawEditorsTotals() { /* totals refresh on next full draw; keep inputs focused while typing */ }
function readBtInputs() {
  bt.initial = Math.max(0, num($('bt-initial').value)); bt.contrib = Math.max(0, num($('bt-contrib').value));
  bt.rebal = $('bt-rebal').value; bt.freq = $('bt-freq').value; bt.start = $('bt-start').value; bt.end = $('bt-end').value;
}
const isRebal = (prev, d, how) => how === 'none' ? false : how === 'yearly' ? d.slice(0, 4) !== prev.slice(0, 4)
  : how === 'quarterly' ? d.slice(5, 7) !== prev.slice(5, 7) && ['01', '04', '07', '10'].includes(d.slice(5, 7))
  : d.slice(5, 7) !== prev.slice(5, 7);

/** Simulate a weighted portfolio (distributions reinvested). Returns value, invested, an index (growth of $1, no contributions), flows. */
function simPortfolio(hold, grid, cfg) {
  const tot = hold.reduce((a, h) => a + h.w, 0) || 1, w = hold.map(h => h.w / tot);
  const flags = contribFlags(grid, cfg.freq);
  const run = (initial, contrib) => {
    let u = hold.map(() => 0); const value = [], invested = [], flows = []; let inv = 0;
    grid.forEach((d, k) => {
      const px = hold.map(h => h.s.x[at(h.s, d)]);
      let val = u.reduce((a, uu, j) => a + uu * px[j], 0);
      if (k > 0 && isRebal(grid[k - 1], d, cfg.rebal)) u = w.map((wj, j) => val * wj / px[j]);
      const buy = k === 0 ? initial : flags[k] ? contrib : 0;
      if (buy > 0) { u = u.map((uu, j) => uu + buy * w[j] / px[j]); inv += buy; flows.push({ date: d, amount: -buy }); }
      val = u.reduce((a, uu, j) => a + uu * px[j], 0);
      value.push(val); invested.push(inv);
    });
    flows.push({ date: grid[grid.length - 1], amount: value[value.length - 1] });
    return { value, invested, flows };
  };
  const main = run(cfg.initial, cfg.contrib), idx = run(1, 0).value;
  return { ...main, idx };
}
function cashReturn(a, b) {                       // average RBA cash rate over the period (for the Sharpe ratio)
  const c = ASSET?.CASH || {}; const ys = []; for (let y = +a.slice(0, 4); y <= +b.slice(0, 4); y++) if (c[y] != null) ys.push(c[y]);
  return ys.length ? ys.reduce((x, y) => x + y, 0) / ys.length : 3;
}

async function computeBacktest() {
  writeHash();
  const out = $('bt-out'); if (!out) return;
  const ports = [['a', 'Portfolio', PALETTE[0]], ['b', 'Comparison', PALETTE[2]]].filter(([k]) => bt[k].some(h => h.c && h.w > 0));
  if (!ports.length) { out.innerHTML = '<div class="etf-note">Add at least one holding with a weight.</div>'; return; }
  const codes = [...new Set(ports.flatMap(([k]) => bt[k].filter(h => h.c && h.w > 0).map(h => h.c)))];
  const loaded = Object.fromEntries(await Promise.all(codes.map(async c => [c, await loadSeries(c)])));
  const missing = codes.filter(c => !loaded[c]);
  if (missing.length) { out.innerHTML = `<div class="etf-warn">No price data for ${missing.map(esc).join(', ')} — check the code or ${missing.map(requestLink).join(' · ')}.</div>`; return; }
  const ss = codes.map(c => loaded[c]);
  const latest = ss.reduce((a, s) => s.start > a.start ? s : a);
  let a = latest.start, b = ss.map(s => s.end).sort()[0];
  if (bt.start && friday(bt.start) > a) a = friday(bt.start);
  if (bt.end && bt.end < b) b = bt.end;
  const grid = weeks(a, b).filter(d => ss.every(s => at(s, d) != null));
  if (grid.length < 26) { out.innerHTML = '<div class="etf-warn">Less than six months of shared history for these holdings — choose a longer period or older funds.</div>'; return; }
  const res = ports.map(([k, label, color]) => {
    const hold = bt[k].filter(h => h.c && h.w > 0).map(h => ({ ...h, s: loaded[h.c] }));
    const sim = simPortfolio(hold, grid, bt);
    const yrs = daysBetween(grid[0], grid.at(-1)) / 365.25, cal = calendarReturns(sim.idx, grid), cy = Object.values(cal);
    const ret = cagr(sim.idx[0], sim.idx.at(-1), yrs), vol = volatility(sim.idx), cash = cashReturn(grid[0], grid.at(-1));
    // worst 12-month stretch
    let w12 = null; for (let i = 52; i < sim.idx.length; i++) { const r = (sim.idx[i] / sim.idx[i - 52] - 1) * 100; if (w12 == null || r < w12) w12 = r; }
    return { k, label: k === 'b' && hold.length === 1 ? hold[0].c : label, color, hold, sim, cal, ret, vol, dd: maxDrawdown(sim.idx, grid),
      best: cy.length ? Math.max(...cy) : null, worst: cy.length ? Math.min(...cy) : null, w12, sharpe: ret != null && vol ? (ret - cash) / vol : null, irr: xirr(sim.flows) };
  });
  const limitNote = !bt.start ? `<div class="etf-note">From <b>${fmtDate(grid[0])}</b>, the first week every holding was trading (${esc(latest.code)} listed ${fmtDate(latest.start)}). Older history isn't simulated with stand-ins.</div>` : '';
  const growth = lineChart('bt-growth', grid, [...res.map(r => ({ name: r.label, color: r.color, vals: r.sim.value })),
    ...(bt.contrib > 0 || bt.initial > 0 ? [{ name: 'Total put in', color: '#94a3b8', dash: '5,4', width: 1.5, vals: res[0].sim.invested }] : [])], { label: 'Portfolio value' });
  const dd = lineChart('bt-dd', grid, res.map(r => { let pk = 0; return { name: r.label, color: r.color, area: true, vals: r.sim.idx.map(v => { pk = Math.max(pk, v); return (v / pk - 1) * 100; }) }; }),
    { height: 200, fmt: v => Math.round(v) + '%', tipFmt: v => pct(v), zero: true, label: 'Drawdowns' });
  const years = [...new Set(res.flatMap(r => Object.keys(r.cal)))].sort();
  const metric = [['Final value', r => `<b>${money(r.sim.value.at(-1))}</b>`], ['Total put in', r => money(r.sim.invested.at(-1))],
    ['Annual return (time-weighted)', r => pct(r.ret)], ['Your annual return (money-weighted)', r => pct(r.irr)],
    ['Volatility (std. dev.)', r => pctPlain(r.vol)], ['Worst fall', r => `<span style="color:#f87171">${pct(r.dd.pct)}</span><div class="etf-sub">${fmtMonth(r.dd.peak)} → ${fmtMonth(r.dd.trough)}${r.dd.recovered ? '' : ' (not recovered)'}</div>`],
    ['Best year / worst year', r => r.best == null ? '—' : `${pct(r.best, 0)} / ${pct(r.worst, 0)}`], ['Worst 12 months', r => pct(r.w12)],
    ['Sharpe ratio <span class="etf-q" title="Return above the average RBA cash rate, divided by volatility. Higher = more return per unit of risk.">?</span>', r => r.sharpe == null ? '—' : r.sharpe.toFixed(2)]];
  // correlations between holdings (weekly total returns)
  const corrCodes = codes.slice(0, 10), rets = Object.fromEntries(corrCodes.map(c => [c, weeklyRets(grid.map(d => loaded[c].x[at(loaded[c], d)]))]));
  const corrTbl = corrCodes.length > 1 ? `<h4 class="etf-h4">How the holdings move together <span class="etf-q" title="Correlation of weekly returns: 1 = move in lockstep, 0 = unrelated, negative = tend to move opposite ways. Lower correlation = more diversification.">?</span></h4>
    <div style="overflow-x:auto;"><table class="etf-table etf-table-num"><thead><tr><th></th>${corrCodes.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>
    ${corrCodes.map(r => `<tr><td><b>${r}</b></td>${corrCodes.map(c => { const v = r === c ? 1 : correl(rets[r], rets[c]); const h = v == null ? 0 : Math.max(0, v);
      return `<td style="background:rgba(56,189,248,${(h * 0.35).toFixed(2)})">${v == null ? '—' : v.toFixed(2)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : '';
  out.innerHTML = limitNote + growth + `
    <div style="overflow-x:auto;margin-top:1rem;"><table class="etf-table"><thead><tr><th></th>${res.map(r => `<th style="color:${r.color}">${esc(r.label)}<div class="etf-sub">${r.hold.map(h => `${h.c} ${+(h.w / r.hold.reduce((a, x) => a + x.w, 0) * 100).toFixed(1)}%`).join(' · ')}</div></th>`).join('')}</tr></thead>
    <tbody>${metric.map(([l, f]) => `<tr><td>${l}</td>${res.map(r => `<td>${f(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <h4 class="etf-h4">Falls from the previous peak</h4>${dd}
    <h4 class="etf-h4">Calendar-year returns</h4>${barChart(years, res.map(r => ({ name: r.label, color: r.color, vals: r.cal })))}
    ${corrTbl}
    <div id="bt-inside"></div>
    <div class="etf-actions"><button type="button" class="dl-btn" id="bt-csv">⬇ Weekly values (CSV)</button><button type="button" class="dl-btn" id="bt-share">🔗 Copy link to this backtest</button></div>
    <div class="etf-fine">Distributions reinvested; after each fund's fees; before tax, franking credits and trading costs. Rebalancing happens in the first week of each ${bt.rebal === 'yearly' ? 'year' : bt.rebal === 'quarterly' ? 'quarter' : 'month'}${bt.rebal === 'none' ? ' — never (weights drift)' : ''}; regular amounts are split by the target weights.
      Time-weighted return measures the portfolio; money-weighted measures your dollars (it depends on when you added money).</div>`;
  wireChart('bt-growth'); wireChart('bt-dd');
  $('bt-csv').onclick = () => csv([['Date', ...res.map(r => r.label + ' value'), 'Total put in'], ...grid.map((d, k) => [d, ...res.map(r => r.sim.value[k].toFixed(2)), res[0].sim.invested[k].toFixed(2)])], 'portfolio-backtest.csv');
  $('bt-share').onclick = () => { navigator.clipboard?.writeText(location.href); $('bt-share').textContent = '✓ Link copied'; };
  renderInside(res[0].hold);
}

/** Look-through: sectors and biggest underlying companies, for funds with hand-checked data. */
async function renderInside(hold) {
  await loadMeta();
  const el = $('bt-inside'); if (!el) return;
  const tot = hold.reduce((a, h) => a + h.w, 0) || 1;
  const sectors = {}, comp = {}; let covered = 0;
  hold.forEach(h => {
    const w = h.w / tot, m = ETF_META[h.c];
    if (m?.sectors) { covered += w; Object.entries(m.sectors).forEach(([s, v]) => sectors[s] = (sectors[s] || 0) + w * v);
      (m.topHoldings || []).forEach(t => { const k = t.ticker || t.name; comp[k] = comp[k] || { name: t.name, w: 0, via: [] }; comp[k].w += w * t.weight; comp[k].via.push(h.c); }); }
    else if (h.s?.type === 'Share') { covered += w; sectors['Single shares'] = (sectors['Single shares'] || 0) + w * 100;
      comp[h.c] = comp[h.c] || { name: h.s.name, w: 0, via: [] }; comp[h.c].w += w * 100; comp[h.c].via.push('direct'); }
  });
  if (covered < 0.01) { el.innerHTML = ''; return; }
  const secs = Object.entries(sectors).map(([k, v]) => [k, v / covered]).sort((a, b) => b[1] - a[1]);
  const tops = Object.values(comp).map(c => ({ ...c, w: c.w / covered })).sort((a, b) => b.w - a.w).slice(0, 12);
  el.innerHTML = `<h4 class="etf-h4">What's inside the portfolio</h4>
    <div class="etf-two"><div><div class="etf-label">Sectors</div>${secs.map(([k, v]) => `<div class="etf-bar"><span>${esc(k)}</span><div><i style="width:${Math.min(100, v)}%;background:${SEC_CLR[k] || '#64748b'}"></i></div><b>${v.toFixed(1)}%</b></div>`).join('')}</div>
    <div><div class="etf-label">Biggest underlying companies</div><table class="etf-table etf-table-num">${tops.map(t => `<tr><td style="text-align:left">${esc(t.name)}${t.via.length > 1 ? ` <span class="etf-sub">via ${t.via.join(', ')}</span>` : ''}</td><td>${t.w.toFixed(1)}%</td></tr>`).join('')}</table></div></div>
    <div class="etf-fine">Based on hand-checked snapshots of each fund's sectors and top holdings (in data/etf_data.json) — covers ${Math.round(covered * 100)}% of this portfolio${covered < 0.99 ? '; funds without that data are left out' : ''}. Companies held through more than one fund are added together (the overlap).</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 — MY PORTFOLIO (saved only in this browser)
// ════════════════════════════════════════════════════════════════════════════
const pf = { trades: [], targets: {}, benchmark: 'VDHG', next: 1000, confirmClear: false };
function pfLoad() { try { const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (d) Object.assign(pf, { trades: d.trades || [], targets: d.targets || {}, benchmark: d.benchmark || 'VDHG' }); } catch (e) {} }
function pfSave() { try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, trades: pf.trades, targets: pf.targets, benchmark: pf.benchmark })); } catch (e) {} }
const newId = () => Math.random().toString(36).slice(2, 10);
const EXAMPLE_TRADES = [['2019-03-12', 'VAS', 'buy', 120, 81.5, 9.5], ['2019-03-12', 'VGS', 'buy', 110, 74.2, 9.5], ['2020-04-02', 'VAS', 'buy', 80, 64.0, 9.5],
  ['2021-08-17', 'NDQ', 'buy', 150, 33.9, 9.5], ['2022-10-04', 'VGS', 'buy', 60, 92.0, 9.5], ['2024-02-20', 'VAS', 'sell', 50, 96.5, 9.5], ['2024-06-11', 'VAF', 'buy', 100, 45.3, 9.5]];

function renderPortfolio(el) {
  pfLoad();
  el.innerHTML = `<div class="etf-intro">Track what you actually own: enter your buys and sells (or import a CSV from your broker) and see today's value, gains, distributions received and your real annual return — compared with putting the same money into a single benchmark fund.
    <b>Your trades are saved only in this browser</b> — nothing is uploaded. Use Export to back them up or move them to another device.</div>
    <div class="etf-actions" style="margin-top:0;">
      <button type="button" class="dl-btn" id="pf-export">⬇ Export (backup file)</button>
      <label class="dl-btn" style="cursor:pointer;">⬆ Import file or broker CSV<input type="file" id="pf-import" accept=".json,.csv,.txt" style="display:none"></label>
      ${pf.trades.length ? '' : '<button type="button" class="dl-btn" id="pf-example">Try an example portfolio</button>'}
      ${pf.trades.length ? `<button type="button" class="dl-btn" id="pf-clear" style="margin-left:auto;">${pf.confirmClear ? '⚠ Click again to delete all trades' : '🗑 Clear all'}</button>` : ''}
    </div>
    <div id="pf-msg"></div>
    <div id="pf-out"></div>
    <h4 class="etf-h4">Add a trade</h4>
    <div class="etf-grid etf-trade-form">
      <div><label class="etf-label">Date</label><input id="pf-date" type="date" class="etf-input" value="${iso(new Date())}"></div>
      <div><label class="etf-label">Code</label>${pickerHTML('pf-code', '', 'e.g. VAS')}</div>
      <div><label class="etf-label">Buy or sell</label><select id="pf-side" class="etf-input"><option value="buy">Buy</option><option value="sell">Sell</option></select></div>
      <div><label class="etf-label">Units</label><input id="pf-units" class="etf-input" inputmode="decimal"></div>
      <div><label class="etf-label">Price per unit</label><input id="pf-price" class="etf-input" inputmode="decimal"><a href="#" id="pf-fillpx" class="etf-mini">use that week's closing price</a></div>
      <div><label class="etf-label">Brokerage</label><input id="pf-fee" class="etf-input" inputmode="decimal" value="0"></div>
    </div>
    <button type="button" class="etf-btn" id="pf-add">Add trade</button>
    <div class="etf-fine">Reinvested distributions (DRP): add each allotment as a buy at the DRP price — the distribution is counted as income and the allotment as money in, so they cancel out in your return.
      CSV import understands most broker exports with columns like Date, Code, Buy/Sell, Quantity, Price, Brokerage, and CommSec's transaction export (“B 100 VAS @ 91.23”).</div>
    <div id="pf-trades"></div>`;
  wirePicker('pf-code', () => {});
  $('pf-add').onclick = addTradeFromForm;
  $('pf-fillpx').onclick = async e => { e.preventDefault(); const s = await loadSeries($('pf-code').value); const d = $('pf-date').value;
    if (!s || !d) { pfMsg('Enter a code and date first.', true); return; }
    const i = s.pos[friday(d)] ?? (friday(d) > s.end ? s.p.length - 1 : null); if (i == null) { pfMsg(`No ${s.code} price for that week.`, true); return; }
    $('pf-price').value = s.p[i]; };
  $('pf-export').onclick = () => { const blob = new Blob([JSON.stringify({ v: 1, exported: iso(new Date()), trades: pf.trades, targets: pf.targets, benchmark: pf.benchmark }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `my-portfolio-${iso(new Date())}.json`; a.click(); };
  $('pf-import').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => importText(r.result, f.name); r.readAsText(f); };
  $('pf-example')?.addEventListener('click', () => { pf.trades = EXAMPLE_TRADES.map(([date, code, side, units, price, fee]) => ({ id: newId(), date, code, side, units, price, fee }));
    pf.targets = { VAS: 35, VGS: 40, NDQ: 15, VAF: 10 }; pfSave(); renderPortfolio(el); });
  $('pf-clear')?.addEventListener('click', () => { if (!pf.confirmClear) { pf.confirmClear = true; renderPortfolio(el); return; }
    pf.trades = []; pf.targets = {}; pf.confirmClear = false; pfSave(); renderPortfolio(el); });
  computePortfolio();
}
function pfMsg(t, bad) { const m = $('pf-msg'); if (m) m.innerHTML = t ? `<div class="${bad ? 'etf-warn' : 'etf-note'}">${t}</div>` : ''; }
async function addTradeFromForm() {
  const t = { id: newId(), date: $('pf-date').value, code: $('pf-code').value.trim().toUpperCase().replace(/\.AX$/, ''), side: $('pf-side').value,
    units: num($('pf-units').value), price: num($('pf-price').value), fee: num($('pf-fee').value) };
  if (!t.date || !t.code || !(t.units > 0) || !(t.price > 0)) { pfMsg('Please fill in the date, code, units and price.', true); return; }
  if (!(await loadSeries(t.code))) pfMsg(`Added — but there's no price data for ${esc(t.code)} yet, so it can't be valued. ${requestLink(t.code)}.`, true); else pfMsg('');
  pf.trades.push(t); pfSave(); $('pf-units').value = ''; $('pf-price').value = ''; computePortfolio();
}

// ── import (backup JSON, generic broker CSV, CommSec CSV) ───────────────────
function parseDate(s) {
  s = String(s || '').trim().replace(/^"|"$/g, '');
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);                // Australian day/month/year
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  m = s.match(/^(\d{1,2}) (\w{3})\w* (\d{4})/);
  if (m) { const mi = MOS.findIndex(x => x.toLowerCase() === m[2].toLowerCase()); if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return null;
}
function splitCSV(line) { const out = []; let cur = '', q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out.map(s => s.trim()); }
function importText(text, name) {
  let trades = [], skipped = 0;
  try {
    if (/\.json$/i.test(name) || text.trim().startsWith('{')) {
      const d = JSON.parse(text); trades = (d.trades || []).map(t => ({ ...t, id: newId() }));
      if (d.targets) pf.targets = d.targets; if (d.benchmark) pf.benchmark = d.benchmark;
    } else {
      const lines = text.split(/\r?\n/).filter(l => l.trim()); const head = splitCSV(lines[0]).map(h => h.toLowerCase());
      const col = re => head.findIndex(h => re.test(h));
      const details = col(/^details$/);
      if (details >= 0) {                                   // CommSec: "B 100 VAS @ 91.230000"
        const di = col(/^date/), deb = col(/debit/), cre = col(/credit/);
        lines.slice(1).forEach(l => { const c = splitCSV(l); const m = (c[details] || '').match(/^([BS])\s+([\d,.]+)\s+([A-Z0-9]+)\s+@\s+([\d.]+)/i);
          if (!m) return; const units = num(m[2]), price = num(m[4]), gross = units * price, cash = num(m[1].toUpperCase() === 'B' ? c[deb] : c[cre]);
          trades.push({ id: newId(), date: parseDate(c[di]), code: m[3].toUpperCase(), side: m[1].toUpperCase() === 'B' ? 'buy' : 'sell', units, price,
            fee: cash ? +Math.abs(m[1].toUpperCase() === 'B' ? cash - gross : gross - cash).toFixed(2) : 0 }); });
      } else {
        const di = col(/date/), ci = col(/^(code|ticker|symbol|security|asx code|instrument|stock)/), si = col(/(type|action|side|buy|transaction)/),
          ui = col(/(quantity|units|qty|shares|volume)/), pi = col(/(price)/), fi = col(/(brokerage|fee|commission)/);
        if (di < 0 || ci < 0 || ui < 0 || pi < 0) throw new Error('Could not find Date, Code, Quantity and Price columns');
        lines.slice(1).forEach(l => { const c = splitCSV(l); const units = Math.abs(num(c[ui])), price = num(c[pi]);
          if (!(units > 0) || !(price > 0)) { skipped++; return; }
          const sideTxt = si >= 0 ? c[si] : ''; const sell = /sell|^s$|disposal/i.test(sideTxt) || num(c[ui]) < 0;
          if (si >= 0 && /div|drp|distribution|split|transfer/i.test(sideTxt) && !/buy|sell/i.test(sideTxt)) { skipped++; return; }
          trades.push({ id: newId(), date: parseDate(c[di]), code: c[ci].toUpperCase().replace(/^ASX:/, '').replace(/\.AX$/, '').trim(), side: sell ? 'sell' : 'buy', units, price, fee: fi >= 0 ? Math.abs(num(c[fi])) : 0 }); });
      }
    }
    const good = trades.filter(t => t.date && t.code && t.units > 0 && t.price > 0);
    skipped += trades.length - good.length;
    const key = t => [t.date, t.code, t.side, t.units, t.price].join('|'), have = new Set(pf.trades.map(key));
    const fresh = good.filter(t => !have.has(key(t)));
    pf.trades.push(...fresh); pfSave();
    renderPortfolio($('etf-tool-container'));
    pfMsg(`Imported ${fresh.length} trade${fresh.length === 1 ? '' : 's'}${good.length - fresh.length ? `, skipped ${good.length - fresh.length} already there` : ''}${skipped ? `, ignored ${skipped} row(s) that weren't buys or sells` : ''}.`);
  } catch (e) { pfMsg('Couldn\'t read that file: ' + esc(e.message), true); }
}

async function computePortfolio() {
  const out = $('pf-out'), tl = $('pf-trades'); if (!out) return;
  const trades = pf.trades.slice().sort((a, b) => a.date.localeCompare(b.date));
  tl.innerHTML = trades.length ? `<h4 class="etf-h4">Your trades (${trades.length})</h4><div style="overflow-x:auto;"><table class="etf-table etf-table-num"><thead><tr><th>Date</th><th>Code</th><th></th><th>Units</th><th>Price</th><th>Brokerage</th><th>Total</th><th></th></tr></thead><tbody>
    ${trades.slice().reverse().map(t => `<tr><td>${fmtDate(t.date)}</td><td><b>${esc(t.code)}</b></td><td>${t.side === 'sell' ? '<span style="color:#f87171">Sell</span>' : 'Buy'}</td><td>${(+t.units).toLocaleString('en-AU')}</td><td>${money(t.price, 2)}</td><td>${money(t.fee, 2)}</td>
      <td>${money(t.units * t.price + (t.side === 'sell' ? -t.fee : t.fee), 2)}</td><td><button type="button" class="etf-x" data-del="${t.id}" aria-label="Delete trade">✕</button></td></tr>`).join('')}</tbody></table></div>` : '';
  tl.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { pf.trades = pf.trades.filter(t => t.id !== b.dataset.del); pfSave(); computePortfolio(); });
  if (!trades.length) { out.innerHTML = ''; return; }
  const codes = [...new Set(trades.map(t => t.code))];
  const S = Object.fromEntries(await Promise.all(codes.map(async c => [c, await loadSeries(c)])));
  const bench = await loadSeries(pf.benchmark);
  const priced = codes.filter(c => S[c]);
  const lastDate = priced.map(c => S[c].end).sort().at(-1) || iso(new Date());
  const grid = weeks(trades[0].date, lastDate);
  const priceAt = (c, d) => { const s = S[c]; if (!s) return null; if (d < s.start) return null; const i = s.pos[d]; return i != null ? s.p[i] : s.p[s.p.length - 1]; };
  // per-holding positions, average cost, realised gains and distributions (units held the day before each ex-date)
  const pos = {}, flows = [];
  codes.forEach(c => pos[c] = { units: 0, cost: 0, realised: 0, income: 0, fees: 0 });
  trades.forEach(t => {
    const p = pos[t.code], gross = t.units * t.price;
    if (t.side === 'buy') { p.cost += gross + t.fee; p.units += t.units; flows.push({ date: t.date, amount: -(gross + t.fee) }); }
    else { const avg = p.units ? p.cost / p.units : 0, u = Math.min(t.units, p.units); p.realised += gross - t.fee - avg * u; p.cost -= avg * u; p.units -= u; flows.push({ date: t.date, amount: gross - t.fee }); }
    p.fees += t.fee;
  });
  const unitsOn = (c, d) => trades.filter(t => t.code === c && t.date < d).reduce((a, t) => a + (t.side === 'buy' ? t.units : -t.units), 0);
  const incomeByWeek = grid.map(() => 0);
  codes.forEach(c => { const s = S[c]; if (!s) return;
    s.d.forEach(([d, amt]) => { if (d < trades[0].date || d > lastDate) return; const u = unitsOn(c, d); if (u <= 0) return;
      const inc = u * amt; pos[c].income += inc; flows.push({ date: d, amount: inc }); const k = grid.findIndex(g => g >= d); if (k >= 0) incomeByWeek[k] += inc; }); });
  // weekly holdings value, net money in, and the benchmark fed the same money
  const valueW = [], netIn = [], incCum = [], benchW = [];
  let bu = 0, net = 0, inc = 0, ti = 0;
  grid.forEach((d, k) => {
    while (ti < trades.length && friday(trades[ti].date) <= d) { const t = trades[ti++], amt = t.units * t.price + (t.side === 'buy' ? t.fee : -t.fee);
      net += t.side === 'buy' ? amt : -amt;
      if (bench) { const bi = bench.pos[d] ?? (d > bench.end ? bench.x.length - 1 : null); if (bi != null && d >= bench.start) bu += (t.side === 'buy' ? amt : -amt) / bench.x[bi]; } }
    inc += incomeByWeek[k];
    let v = 0; codes.forEach(c => { const px = priceAt(c, d); if (px != null) v += unitsOn(c, addDays(d, 1)) * px; });
    valueW.push(v); netIn.push(net); incCum.push(v + inc);
    if (bench) { const bi = bench.pos[d] ?? (d > bench.end ? bench.x.length - 1 : null); benchW.push(bi != null && d >= bench.start ? bu * bench.x[bi] : null); }
  });
  const value = codes.reduce((a, c) => a + (S[c] ? pos[c].units * priceAt(c, lastDate) : 0), 0);
  const costNow = codes.reduce((a, c) => a + pos[c].cost, 0), unreal = value - costNow;
  const realised = codes.reduce((a, c) => a + pos[c].realised, 0), income = codes.reduce((a, c) => a + pos[c].income, 0);
  flows.sort((a, b) => a.date.localeCompare(b.date)); const irr = xirr([...flows, { date: lastDate, amount: value }]);
  const benchFlows = trades.map(t => ({ date: t.date, amount: (t.side === 'buy' ? -1 : 1) * (t.units * t.price + (t.side === 'buy' ? t.fee : -t.fee)) }));
  const benchIrr = bench && benchW.at(-1) != null ? xirr([...benchFlows, { date: lastDate, amount: benchW.at(-1) }]) : null;
  const unpriced = codes.filter(c => !S[c]);
  // allocation vs targets + where to put the next contribution
  const held = codes.filter(c => pos[c].units > 1e-9);
  const tgtTot = held.reduce((a, c) => a + (num(pf.targets[c]) || 0), 0);
  const nextBuys = (() => { if (!tgtTot) return null; const total = value + pf.next; const gaps = held.map(c => ({ c, gap: Math.max(0, total * (num(pf.targets[c]) || 0) / tgtTot - pos[c].units * (priceAt(c, lastDate) || 0)) }));
    const g = gaps.reduce((a, x) => a + x.gap, 0); return gaps.filter(x => x.gap > 0).map(x => ({ c: x.c, amt: g ? pf.next * x.gap / g : 0 })); })();
  const card = (l, v, sub, col) => `<div class="etf-stat"><div class="etf-stat-l">${l}</div><div class="etf-stat-v" style="${col ? 'color:' + col : ''}">${v}</div>${sub ? `<div class="etf-sub">${sub}</div>` : ''}</div>`;
  out.innerHTML = (unpriced.length ? `<div class="etf-warn">No prices for ${unpriced.map(esc).join(', ')} — these aren't valued. ${unpriced.map(requestLink).join(' · ')}.</div>` : '') + `
    <div class="etf-stats">
      ${card('Value', money(value), 'at ' + fmtDate(lastDate) + ' close')}
      ${card('Unrealised gain', money(unreal), costNow ? pct(unreal / costNow * 100) + ' on cost' : '', posNeg(unreal))}
      ${card('Realised gain', money(realised), 'from sales (average cost)', posNeg(realised))}
      ${card('Distributions received', money(income), 'estimated from ex-dates')}
      ${card('Your annual return', pct(irr), 'money-weighted, incl. distributions', posNeg(irr))}
      ${card('Same money in ' + esc(pf.benchmark), pct(benchIrr), bench ? 'with distributions reinvested' : 'no data for that code', posNeg(benchIrr))}
    </div>
    ${lineChart('pf-chart', grid, [{ name: 'Holdings value', color: PALETTE[0], vals: valueW }, { name: 'Value + distributions received', color: PALETTE[1], vals: incCum, width: 1.5 },
      ...(bench ? [{ name: `Same money in ${pf.benchmark}`, color: PALETTE[2], vals: benchW, width: 1.5 }] : []), { name: 'Net money put in', color: '#94a3b8', dash: '5,4', width: 1.5, vals: netIn }], { label: 'Portfolio value over time' })}
    <div style="max-width:16rem;margin-top:.6rem;"><label class="etf-label">Compare with (benchmark)</label>${pickerHTML('pf-bench', pf.benchmark)}</div>
    <h4 class="etf-h4">Holdings</h4>
    <div style="overflow-x:auto;"><table class="etf-table etf-table-num"><thead><tr><th>Code</th><th>Units</th><th>Avg cost</th><th>Price</th><th>Value</th><th>Gain</th><th>Distributions</th><th>Weight</th><th>Target %</th></tr></thead><tbody>
    ${held.map(c => { const px = priceAt(c, lastDate), v = px != null ? pos[c].units * px : null, g = v != null ? v - pos[c].cost : null;
      return `<tr><td style="text-align:left"><b>${c}</b><div class="etf-sub">${esc(S[c]?.name || '')}</div></td><td>${(+pos[c].units.toFixed(4)).toLocaleString('en-AU')}</td><td>${money(pos[c].cost / pos[c].units, 2)}</td>
        <td>${money(px, 2)}</td><td><b>${money(v)}</b></td><td style="color:${posNeg(g)}">${money(g)}<div class="etf-sub">${g != null && pos[c].cost ? pct(g / pos[c].cost * 100) : ''}</div></td>
        <td>${money(pos[c].income)}</td><td>${v != null && value ? (v / value * 100).toFixed(1) + '%' : '—'}</td>
        <td><input class="etf-input etf-tgt" data-tgt="${c}" inputmode="decimal" value="${pf.targets[c] ?? ''}" placeholder="—" style="width:4.5rem;padding:.3rem .4rem;"></td></tr>`; }).join('')}
    </tbody></table></div>
    ${tgtTot ? `<div class="etf-next"><label class="etf-label">Next contribution</label><input id="pf-next" class="etf-input" inputmode="decimal" value="${pf.next}" style="max-width:9rem;">
      <div>${nextBuys?.length ? 'To move towards your targets without selling, buy: ' + nextBuys.map(b => `<b>${b.c}</b> ${money(b.amt)}${priceAt(b.c, lastDate) ? (b.amt >= priceAt(b.c, lastDate) ? ` (≈${Math.floor(b.amt / priceAt(b.c, lastDate))} units)` : ' (less than 1 unit)') : ''}`).join(' · ') : 'You are at (or above) your targets.'}</div></div>`
      : '<div class="etf-fine">Enter target percentages in the table to see how to split your next contribution to get back on target.</div>'}
    <div class="etf-fine">Values use the latest weekly closing prices (updated weekly). Gains use the average-cost method; your tax return may need specific parcels and the CGT discount — this isn't tax advice.
      Distributions are estimated from units held before each ex-date; check your statements for exact amounts and franking.</div>`;
  wireChart('pf-chart');
  wirePicker('pf-bench', c => { pf.benchmark = c; pfSave(); computePortfolio(); });
  out.querySelectorAll('.etf-tgt').forEach(i => i.addEventListener('change', () => { const v = i.value.trim(); if (v === '') delete pf.targets[i.dataset.tgt]; else pf.targets[i.dataset.tgt] = num(v); pfSave(); computePortfolio(); }));
  $('pf-next')?.addEventListener('change', e => { pf.next = Math.max(0, num(e.target.value)); computePortfolio(); });
}

// ════════════════════════════════════════════════════════════════════════════
// Tabs, styles, start-up
// ════════════════════════════════════════════════════════════════════════════
const state = { tab: 'compare' };
const TABS = { compare: renderCompare, backtest: renderBacktest, portfolio: renderPortfolio };
function setTab(tab) {
  if (!TABS[tab]) tab = 'compare';
  state.tab = tab;
  document.querySelectorAll('.etf-tab-btn').forEach(b => b.classList.toggle('etf-tab-active', b.dataset.tab === tab));
  const el = $('etf-tool-container');
  if (!INDEX?.tickers?.length) {
    el.innerHTML = `<div class="etf-warn" style="margin:1rem 0;">Price data isn't available yet. It's downloaded weekly by the “Weekly Price Update” GitHub Action — once it has run, refresh this page.</div>`;
    if (tab !== 'portfolio') return;
  }
  TABS[tab](el);
  writeHash();
}

const _css = document.createElement('style');
_css.textContent = `
  .etf-intro{color:var(--text-secondary);font-size:.9rem;line-height:1.6;margin-bottom:1rem;}
  .etf-label{display:block;font-size:.7rem;color:var(--text-secondary);margin-bottom:.35rem;letter-spacing:.05em;text-transform:uppercase;}
  .etf-input{width:100%;box-sizing:border-box;background:#0a0f1e;border:1px solid var(--glass-border);border-radius:8px;color:#f0f0f0;padding:.55rem .7rem;font-size:.88rem;font-family:inherit;}
  .etf-input:focus{outline:none;border-color:#38bdf8;}
  input[type=date].etf-input{color-scheme:dark;}
  .etf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.75rem;margin:.75rem 0;}
  .etf-check{display:flex;align-items:center;gap:.5rem;font-size:.85rem;color:var(--text-secondary);margin:.25rem 0 1rem;cursor:pointer;}
  .etf-chips{display:flex;flex-wrap:wrap;gap:.45rem;}
  .etf-chip{display:inline-flex;align-items:center;gap:.4rem;border:1px solid;border-radius:999px;padding:.25rem .3rem .25rem .7rem;font-size:.85rem;font-weight:600;}
  .etf-chip i{width:.55rem;height:.55rem;border-radius:50%;display:inline-block;}
  .etf-chip button,.etf-x{background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:.85rem;padding:.15rem .4rem;border-radius:6px;}
  .etf-chip button:hover,.etf-x:hover{color:#f87171;}
  .etf-picker{position:relative;}
  .etf-sugg{display:none;position:absolute;z-index:50;left:0;right:0;top:100%;margin-top:2px;background:#0b1224;border:1px solid #334155;border-radius:8px;max-height:300px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.5);}
  .etf-sugg-row{padding:.45rem .65rem;font-size:.82rem;cursor:pointer;display:flex;gap:.5rem;align-items:baseline;}
  .etf-sugg-row:hover{background:rgba(56,189,248,.1);}
  .etf-sugg-row span{color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
  .etf-sugg-row em{color:#64748b;font-style:normal;font-size:.7rem;}
  .etf-sugg-none{cursor:default;color:var(--text-secondary);}
  .etf-sugg a,.etf-warn a,.etf-fine a,.etf-note a{color:#38bdf8;}
  .etf-loading{color:var(--text-secondary);padding:2rem;text-align:center;}
  .etf-note{background:rgba(56,189,248,.06);border:1px solid rgba(56,189,248,.25);border-radius:8px;padding:.6rem .85rem;font-size:.82rem;color:#cbd5e1;margin:.6rem 0;}
  .etf-warn{background:rgba(251,191,36,.07);border:1px solid rgba(251,191,36,.35);border-radius:8px;padding:.6rem .85rem;font-size:.82rem;color:#fde68a;margin:.6rem 0;}
  .etf-fine{font-size:.74rem;color:#64748b;line-height:1.55;margin-top:.6rem;}
  .etf-sub{font-size:.7rem;color:#64748b;font-weight:400;margin-top:.1rem;}
  .etf-q{display:inline-block;width:1rem;height:1rem;line-height:1rem;text-align:center;border-radius:50%;border:1px solid #475569;color:#94a3b8;font-size:.62rem;cursor:help;}
  .etf-h4{font-size:.95rem;margin:1.4rem 0 .5rem;color:#e2e8f0;}
  .etf-table{width:100%;border-collapse:collapse;font-size:.84rem;}
  .etf-table th{text-align:left;font-size:.75rem;color:#94a3b8;font-weight:600;padding:.45rem .55rem;border-bottom:1px solid #1e293b;vertical-align:bottom;}
  .etf-table td{padding:.45rem .55rem;border-bottom:1px solid #111827;vertical-align:top;}
  .etf-table-num td,.etf-table-num th{text-align:right;}
  .etf-table-num td:first-child,.etf-table-num th:first-child{text-align:left;}
  .etf-table .etf-name{text-align:left;max-width:280px;}
  .etf-sortable th{cursor:pointer;white-space:nowrap;}
  .etf-chart{margin-top:.75rem;}
  .etf-tip{display:none;position:absolute;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:.5rem .7rem;font-size:.75rem;pointer-events:none;z-index:20;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.5);}
  .etf-legend{display:flex;flex-wrap:wrap;gap:.9rem;font-size:.75rem;color:var(--text-secondary);margin-top:.4rem;}
  .etf-legend i{display:inline-block;width:.9rem;height:3px;margin-right:.35rem;vertical-align:middle;border-radius:2px;}
  .etf-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem;}
  .dl-btn{padding:.4rem .85rem;border-radius:6px;border:1px solid var(--glass-border);background:transparent;color:var(--text-secondary);cursor:pointer;font-size:.78rem;font-family:inherit;}
  .dl-btn:hover{border-color:#4ade80;color:#4ade80;}
  .etf-btn{padding:.55rem 1.2rem;border-radius:8px;border:1px solid #38bdf8;background:rgba(56,189,248,.1);color:#38bdf8;cursor:pointer;font-weight:600;font-family:inherit;}
  .etf-mini{display:inline-block;font-size:.7rem;color:#38bdf8;margin-top:.3rem;}
  .etf-details{margin-top:1.5rem;border:1px solid var(--glass-border);border-radius:10px;padding:.7rem .9rem;}
  .etf-details summary{cursor:pointer;font-weight:600;font-size:.9rem;}
  .etf-port-wrap{display:grid;grid-template-columns:1fr 1fr;gap:.9rem;}
  .etf-port{border:1px solid;border-radius:10px;padding:.75rem;}
  .etf-port-head{display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-bottom:.5rem;flex-wrap:wrap;}
  .etf-port-row{display:grid;grid-template-columns:1fr 6.5rem auto;gap:.4rem;margin-bottom:.4rem;align-items:center;}
  .etf-w{display:flex;align-items:center;gap:.25rem;color:var(--text-secondary);}
  .etf-port-foot{display:flex;justify-content:space-between;align-items:center;gap:.5rem;}
  .etf-two{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;}
  .etf-bar{display:grid;grid-template-columns:10rem 1fr 3.2rem;gap:.5rem;align-items:center;font-size:.8rem;margin:.25rem 0;}
  .etf-bar div{background:#0a0f1e;border-radius:4px;height:.6rem;overflow:hidden;}
  .etf-bar i{display:block;height:100%;border-radius:4px;}
  .etf-bar b{text-align:right;font-weight:500;}
  .etf-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem;}
  .etf-stat{background:#0a0f1e;border:1px solid var(--glass-border);border-radius:10px;padding:.75rem;}
  .etf-stat-l{font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary);}
  .etf-stat-v{font-size:1.25rem;font-weight:700;margin-top:.25rem;}
  .etf-next{display:flex;flex-wrap:wrap;gap:.8rem;align-items:end;margin-top:.8rem;font-size:.85rem;}
  .etf-retire{margin-top:1.5rem;font-size:.85rem;color:var(--text-secondary);}
  .etf-retire a{color:#38bdf8;}
  @media(max-width:700px){
    .etf-port-wrap,.etf-two{grid-template-columns:1fr;}
    .etf-bar{grid-template-columns:7rem 1fr 3rem;}
    .etf-table{font-size:.78rem;}
    .etf-stat-v{font-size:1.05rem;}
  }`;
document.head.appendChild(_css);

async function initETF() {
  document.querySelectorAll('.etf-tab-btn').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  await Promise.all([loadIndex(), loadMeta()]);
  readHash();
  setTab(state.tab);
}
initETF();
