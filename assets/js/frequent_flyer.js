/* FF Points — compare Qantas and Velocity credit card sign-up offers.
 * Data (built into the page by Jekyll):
 *   _data/ff_cards.json    the offers (edited by hand; each card has a 'verified' date and source)
 *   _data/ff_history.json  offers seen before (grows automatically each week)
 *   _data/ff_checks.json   the weekly automatic check of each bank page (links + bonus numbers)
 *   _data/promos.json      card-offer headlines from Australian frequent-flyer news sites
 * Referral links: set "affiliateLink" on a card in ff_cards.json; it's used instead of "link".
 */
'use strict';
(function () {
  const D = window.FF_DATA || { cards: [] }, H = (window.FF_HISTORY || {}).entries || [], C = (window.FF_CHECKS || {}).results || {};
  const NEWS = window.FF_PROMOS || {};
  const st = { program: 'qantas', cents: 1.5, spend: '', horizon: 'y1', credits: true, sort: 'net', dir: -1, had: new Set() };
  const hf = { program: 'tab', bank: 'all', q: '', changedOnly: false };      // past-offers filters
  const REPO = 'https://github.com/Felixillion/Felixillion.github.io';
  /** A pre-filled GitHub issue for reporting wrong details (one card, or the page in general). */
  function reportUrl(c) {
    const title = c ? `FF Points: ${c.issuer} ${c.name} details look wrong` : 'FF Points: card details look wrong';
    const body = c ? [`Card: ${c.issuer} ${c.name}`, `Shown on the site: ${c.stages.map(x => x.pts.toLocaleString('en-AU') + ' pts (' + x.need + ')').join(' + ')}; first-year fee $${c.fees.y1}, then $${c.fees.ongoing}; checked ${c.verified}`,
      `Bank page: ${c.link}`, '', 'What looks wrong (e.g. the bonus, spend, fee, or the link):', '', 'Where you saw the correct figure (link if possible):', '']
      : ['Which card(s)?', '', 'What looks wrong?', '', 'Where you saw the correct figure (link if possible):', ''];
    return `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body.join('\n'))}`;
  }
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => (v < 0 ? '−$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-AU');
  const pts = v => Math.round(v).toLocaleString('en-AU');
  const MOS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtD = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return d ? `${+d} ${MOS[+m - 1]} ${y}` : `${MOS[+m - 1]} ${y}`; };
  const daysAgo = s => Math.floor((Date.now() - new Date(s)) / 864e5);
  const PROG = { qantas: 'Qantas Points', velocity: 'Velocity Points' };

  function calc(c) {
    const y1 = c.stages.filter(s => s.year === 1).reduce((a, s) => a + s.pts, 0);
    const total = c.stages.reduce((a, s) => a + s.pts, 0);
    const two = st.horizon === 'y2';
    const points = two ? total : y1;
    const credits = st.credits ? (c.credits || 0) * (two ? 2 : 1) : 0;
    const cost = c.fees.y1 + (two ? c.fees.ongoing : 0) - (c.cashback || 0) - credits;
    const net = points * st.cents / 100 - cost;
    const cpp = points ? cost / points * 100 : null;
    const blocked = st.had.has(c.issuer) && c.eligibility?.months;     // had a card from this bank recently
    const reach = (!st.spend || c.minSpend <= +st.spend) && !blocked;
    // history: best and previous offers recorded for this card (excluding the current one)
    const past = H.filter(e => e.id === c.id && !(e.total === total && e.y1 === y1 && e.fee === c.fees.y1)).sort((a, b) => b.from.localeCompare(a.from));
    const best = past.reduce((m, e) => Math.max(m, e.total), 0);
    return { ...c, y1, total, points, cost, net, cpp, reach, blocked, past, best };
  }

  function vsPast(r) {
    if (!r.past.length) return '<span class="ff-muted">No earlier offer recorded yet</span>';
    const prev = r.past[0];
    if (r.total > r.best) return `<span class="ff-good">▲ Best we've recorded</span><div class="ff-muted">was ${pts(prev.total)} (${fmtD(prev.from)})</div>`;
    if (r.total < r.best) return `<span class="ff-warn">▼ Below the best seen</span><div class="ff-muted">${pts(r.best)} recorded ${fmtD(r.past.find(e => e.total === r.best).from)}</div>`;
    return `<span class="ff-muted">Same as the best seen (${pts(r.best)})</span>`;
  }
  function checkBadge(r) {
    const k = C[r.id], d = daysAgo(r.verified);
    const hand = `<div class="${d > 45 ? 'ff-warn' : 'ff-muted'}" title="${esc(r.source)}">Checked by hand ${fmtD(r.verified)}${d > 45 ? ' — may be out of date' : ''}</div>`;
    const auto = !k ? '' : k.status === 'match' ? `<div class="ff-good" title="The weekly check found ${esc((k.found || []).map(pts).join(', '))} on the bank's page">✓ Bank page matches (${fmtD(k.checked)})</div>`
      : k.status === 'differs' ? `<div class="ff-bad">⚠ Bank page shows different numbers (${fmtD(k.checked)})</div>`
      : k.status === 'broken' ? `<div class="ff-bad">⚠ Link broken (${fmtD(k.checked)})</div>` : '';
    const ended = r.offerEnds && r.offerEnds < new Date().toISOString().slice(0, 10) ? '<div class="ff-bad">Offer end date has passed</div>' : '';
    const flag = (NEWS.card_flags || {})[r.id]?.[0];
    const news = flag ? `<div><a href="${esc(flag.link)}" target="_blank" rel="noopener" class="ff-warn">📰 In the news ${esc(flag.date)} — may have changed</a></div>` : '';
    return hand + auto + ended + news + `<div><a class="ff-report" href="${reportUrl(r)}" target="_blank" rel="noopener">Report wrong details ↗</a></div>`;
  }
  const elig = r => { const e = r.eligibility || {};
    return `${e.months ? `<b class="ff-elig">⏱ ${e.months} months</b>` : '<b class="ff-elig ff-elig-new">New customers</b>'}<div class="ff-small" style="margin-top:.2rem;">${esc(e.rule || '')}</div>`
      + (r.blocked ? '<div class="ff-warn" style="font-size:.72rem;">You said you\'ve had a card from this bank recently — you may not get the bonus.</div>' : ''); };
  const apply = r => `<a class="ff-apply" href="${esc(r.affiliateLink || r.link)}" target="_blank" rel="noopener">Apply&nbsp;↗</a>`;
  const bonusCell = r => `<b class="ff-pts">${pts(r.total)}</b>${r.stages.length > 1 || r.statusCredits ? `<div class="ff-muted">${r.stages.map(s => `<span title="${esc(s.need)}">${pts(s.pts)} ${s.cond ? 'if eligible' : 'yr ' + s.year}</span>`).join(' + ')}${r.statusCredits ? ` · +${r.statusCredits} Status Credits` : ''}</div>` : ''}`;
  const feeCell = r => `${money(r.fees.y1)}${r.fees.ongoing !== r.fees.y1 ? `<div class="ff-muted">then ${money(r.fees.ongoing)}</div>` : ''}${r.feeNote ? ` <span class="ff-q" title="${esc(r.feeNote)}">?</span>` : ''}`;
  const extras = r => [r.cashback ? `${money(r.cashback)} cashback` : '', r.credits ? `${money(r.credits)}/yr travel credit <span class="ff-q" title="${esc(r.creditNote || '')}">?</span>` : '',
    r.lounge || '', r.earn ? `Earns ${esc(r.earn)}` : '', r.via ? `<span title="${esc(r.via)}">via bank points ⓘ</span>` : ''].filter(Boolean).join('<br>');

  function render() {
    const anyCredit = D.cards.some(c => c.program === st.program && c.credits);
    $('ff-credits-note').textContent = anyCredit ? '' : `— none of the ${st.program === 'qantas' ? 'Qantas' : 'Velocity'} cards currently offers a travel credit, so this makes no difference here`;
    const rows = D.cards.filter(c => c.program === st.program).map(calc);
    const key = { net: r => r.net, cpp: r => r.cpp ?? 1e9, total: r => r.total, fee: r => r.fees.y1, spend: r => r.minSpend }[st.sort];
    rows.sort((a, b) => (a.reach !== b.reach ? (a.reach ? -1 : 1) : (key(a) - key(b)) * st.dir));
    const th = (k, l) => `<th${k ? ` data-sort="${k}" class="ff-sort"` : ''}>${l}${st.sort === k ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    const yrs = st.horizon === 'y2' ? 'years 1–2' : 'year 1';
    $('ff-table').innerHTML = `<table class="ff-table"><thead><tr>${th('', 'Card')}${th('total', 'Bonus points')}${th('spend', 'Spend needed')}${th('fee', 'Annual fee')}
        ${th('net', `Net value (${yrs})`)}${th('cpp', 'Cost per point')}${th('', 'Bonus eligibility')}${th('', 'Extras')}${th('', 'Compared with past offers')}${th('', 'Checked')}${th('', '')}</tr></thead><tbody>
      ${rows.map(r => `<tr class="${r.reach ? '' : 'ff-dim'}">
        <td><b>${esc(r.issuer)}</b><div>${esc(r.name)}</div>${r.notes ? `<div class="ff-note">${esc(r.notes)}</div>` : ''}${r.offerEnds ? `<div class="ff-warn">Apply by ${fmtD(r.offerEnds)}</div>` : ''}</td>
        <td>${bonusCell(r)}</td>
        <td>${money(r.minSpend)}<div class="ff-muted">in ${r.spendDays} days</div>${r.reach ? '' : '<div class="ff-warn">more than you said you can spend</div>'}</td>
        <td>${feeCell(r)}</td>
        <td class="${r.net >= 0 ? 'ff-good' : 'ff-bad'}"><b>${money(r.net)}</b></td>
        <td>${r.cpp == null ? '—' : r.cpp <= 0 ? 'free' : r.cpp.toFixed(2) + '¢'}</td>
        <td class="ff-small" style="min-width:11rem;">${elig(r)}</td>
        <td class="ff-small">${extras(r) || '—'}</td>
        <td class="ff-small">${vsPast(r)}</td>
        <td class="ff-small">${checkBadge(r)}</td>
        <td>${apply(r)}</td></tr>`).join('')}</tbody></table>`;
    $('ff-table').querySelectorAll('[data-sort]').forEach(t => t.onclick = () => { const k = t.dataset.sort;
      if (st.sort === k) st.dir *= -1; else { st.sort = k; st.dir = ['cpp', 'fee', 'spend'].includes(k) ? 1 : -1; } render(); });
    // mobile cards
    $('ff-cards').innerHTML = rows.map(r => `<div class="ff-card ${r.reach ? '' : 'ff-dim'}">
      <div class="ff-card-head"><div><b>${esc(r.issuer)}</b><div>${esc(r.name)}</div></div>${apply(r)}</div>
      <div class="ff-card-grid">
        <div><span>Bonus</span>${bonusCell(r)}</div><div><span>Net value (${yrs})</span><b class="${r.net >= 0 ? 'ff-good' : 'ff-bad'}">${money(r.net)}</b></div>
        <div><span>Spend needed</span>${money(r.minSpend)} in ${r.spendDays} days</div><div><span>Annual fee</span>${feeCell(r)}</div>
        <div><span>Cost per point</span>${r.cpp == null ? '—' : r.cpp <= 0 ? 'free' : r.cpp.toFixed(2) + '¢'}</div><div><span>vs past offers</span>${vsPast(r)}</div>
        <div style="grid-column:1/-1;"><span>Bonus eligibility</span>${elig(r)}</div>
      </div>${extras(r) ? `<div class="ff-small" style="margin-top:.5rem;">${extras(r)}</div>` : ''}
      ${r.notes ? `<div class="ff-note">${esc(r.notes)}</div>` : ''}<div class="ff-small" style="margin-top:.4rem;">${checkBadge(r)}</div></div>`).join('');
    renderHad();
    renderHistory();
  }
  function renderHad() {
    const box = $('ff-had'); if (!box) return;
    const banks = [...new Set(D.cards.filter(c => c.program === st.program && c.eligibility?.months).map(c => c.issuer))].sort();
    box.innerHTML = banks.map(b => `<button type="button" class="ff-chip${st.had.has(b) ? ' ff-chip-on' : ''}" data-bank="${esc(b)}">${esc(b)}</button>`).join('');
    box.querySelectorAll('[data-bank]').forEach(x => x.onclick = () => { const b = x.dataset.bank; st.had.has(b) ? st.had.delete(b) : st.had.add(b); render(); });
  }

  function renderHistory() {
    const byId = Object.fromEntries(D.cards.map(c => [c.id, c]));
    const prog = hf.program === 'tab' ? st.program : hf.program;
    const banks = [...new Set(D.cards.filter(c => prog === 'all' || c.program === prog).map(c => c.issuer))].sort();
    if (hf.bank !== 'all' && !banks.includes(hf.bank)) hf.bank = 'all';
    const q = hf.q.trim().toLowerCase();
    let ids = [...new Set(H.map(e => e.id))].filter(id => byId[id] && (prog === 'all' || byId[id].program === prog)
      && (hf.bank === 'all' || byId[id].issuer === hf.bank) && (!q || (byId[id].issuer + ' ' + byId[id].name).toLowerCase().includes(q)));
    if (hf.changedOnly) ids = ids.filter(id => H.filter(e => e.id === id).length > 1);
    const sel = (id, opts, v) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    $('ff-history').innerHTML = `<p class="ff-muted" style="margin:.2rem 0 .8rem;">Every offer we've recorded for these cards — so you can tell a genuinely good deal from the usual one.
      The list grows automatically: each week the check adds a new line whenever a card's offer changes.</p>
      <div class="ff-controls ff-hist-filters">
        <label>Program ${sel('hf-program', [['tab', 'Same as the table above'], ['all', 'Qantas and Velocity'], ['qantas', 'Qantas'], ['velocity', 'Velocity']], hf.program)}</label>
        <label>Bank ${sel('hf-bank', [['all', 'All banks'], ...banks.map(b => [b, b])], hf.bank)}</label>
        <label>Search <input id="hf-q" type="search" value="${esc(hf.q)}" placeholder="e.g. black, platinum" style="width:11rem;"></label>
        <label class="ff-check"><input type="checkbox" id="hf-changed"${hf.changedOnly ? ' checked' : ''}> Only cards whose offer has changed</label>
      </div>
      ${ids.length ? `<div style="overflow-x:auto;"><table class="ff-table ff-hist"><thead><tr><th>Card</th><th>From</th><th>To</th><th>Bonus points</th><th>Year 1</th><th>First-year fee</th><th>Notes</th></tr></thead><tbody>
      ${ids.sort((a, b) => (byId[a].issuer + byId[a].name).localeCompare(byId[b].issuer + byId[b].name)).map(id => H.filter(e => e.id === id).sort((a, b) => b.from.localeCompare(a.from)).map((e, i, arr) =>
        `<tr${i === arr.length - 1 ? ' class="ff-hist-last"' : ''}><td>${i === 0 ? `<b>${esc(byId[id].issuer)}</b> ${esc(byId[id].name)}${prog === 'all' ? ` <span class="ff-muted">${byId[id].program === 'qantas' ? 'Qantas' : 'Velocity'}</span>` : ''}` : ''}</td><td>${fmtD(e.from)}</td><td>${e.to ? fmtD(e.to) : (i === 0 ? 'now' : '')}</td>
          <td><b>${pts(e.total)}</b>${e.sc ? ` +${e.sc} SC` : ''}</td><td>${pts(e.y1)}</td><td>${money(e.fee)}</td><td class="ff-small" title="${esc(e.source || '')}">${esc(e.note || '')}</td></tr>`).join('')).join('')}
      </tbody></table></div>` : '<p class="ff-muted">No cards match these filters.</p>'}`;
    $('hf-program').onchange = e => { hf.program = e.target.value; renderHistory(); };
    $('hf-bank').onchange = e => { hf.bank = e.target.value; renderHistory(); };
    $('hf-changed').onchange = e => { hf.changedOnly = e.target.checked; renderHistory(); };
    $('hf-q').oninput = e => { hf.q = e.target.value; const pos = e.target.selectionStart; renderHistory(); const i = $('hf-q'); i.focus(); i.setSelectionRange(pos, pos); };
  }

  function renderNews() {
    const items = (NEWS.cards || []).slice(0, 8);
    $('ff-news').innerHTML = items.length ? items.map(n => `<li>${esc(n.date)} · <a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a> <span class="ff-muted">(${esc(n.source)})</span></li>`).join('')
      : '<li>No card-offer headlines in the last few months yet — the list fills in automatically.</li>';
  }

  function wireTips() {
    const tip = document.createElement('div'); tip.className = 'ff-pop'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
    document.addEventListener('click', e => {
      const q = e.target.closest('.ff-q');
      if (!q) { tip.style.display = 'none'; return; }
      e.preventDefault();
      const text = q.dataset.tip || q.getAttribute('title') || ''; q.dataset.tip = text;
      if (tip.style.display === 'block' && tip.dataset.for === text) { tip.style.display = 'none'; return; }
      tip.textContent = text; tip.dataset.for = text; tip.style.display = 'block';
      const r = q.getBoundingClientRect(), w = Math.min(280, window.innerWidth - 24);
      tip.style.width = w + 'px';
      tip.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + window.scrollX + 'px';
      tip.style.top = r.bottom + 8 + window.scrollY + 'px';
    });
  }

  function init() {
    if (!$('ff-table')) return;
    wireTips();
    document.querySelectorAll('[data-program]').forEach(b => b.onclick = () => { st.program = b.dataset.program;
      document.querySelectorAll('[data-program]').forEach(x => x.classList.toggle('ff-tab-on', x === b)); render(); });
    $('ff-cents').oninput = e => { const v = parseFloat(e.target.value); if (v > 0 && v < 10) { st.cents = v; render(); } };
    $('ff-spend').oninput = e => { st.spend = e.target.value.replace(/[^\d]/g, ''); render(); };
    $('ff-horizon').onchange = e => { st.horizon = e.target.value; render(); };
    $('ff-credits').onchange = e => { st.credits = e.target.checked; render(); };
    $('ff-verified').textContent = fmtD(D.verified);
    $('ff-checked').textContent = window.FF_CHECKS?.checked ? fmtD(window.FF_CHECKS.checked) : 'not yet run';
    if (!D.cards.some(c => c.affiliateLink)) $('ff-affiliate').style.display = 'none';
    render(); renderNews();
  }
  init();
})();
