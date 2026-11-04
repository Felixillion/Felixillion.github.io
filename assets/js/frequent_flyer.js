// ──────────────────────────────────────────────────────────────────
//  AU Frequent Flyer Points Tracker
//  Data source: _data/ff_weekly.json
//
//  ── Affiliate Links ──────────────────────────────────────────────
//  To add an affiliate link to any card, open _data/ff_weekly.json
//  and add an "affiliateLink" field to that card's object:
//
//    {
//      "bank": "ANZ",
//      "name": "Frequent Flyer Black",
//      ...
//      "affiliateLink": "https://refer.anz.com.au/your-code"
//    }
//
//  This code uses affiliateLink when present; falls back to link.
//  The Apply button already reads: card.affiliateLink || card.link
// ──────────────────────────────────────────────────────────────────

let cardData = null;
let currentScheme = 'qantas';
let sortConfig = { key: 'netValue', direction: 'desc' };

// Detect mobile (< 700px) once on load
const IS_MOBILE = window.innerWidth < 700;

function initFF() {
  try {
    cardData = window.FF_DATA;
    renderTable();
    const el = document.getElementById('last-updated');
    if (el && cardData.lastUpdated) {
      el.textContent = `Offers last verified: ${cardData.lastUpdated} (manually curated — always confirm on the bank's site)`;
    }
  } catch (err) {
    console.error('Failed to load card data:', err);
    const c = document.getElementById('card-table-container');
    if (c) c.innerHTML = '<p style="color:var(--tritc-red);padding:2rem;">Card data failed to load. Please try again later.</p>';
  }
}

// Cost per bonus point, in cents.
//   Year 1:  (first-year fee − cashback) / year-1 bonus
//   2 years: (first-year fee + ongoing fee − cashback) / (year-1 + year-2 bonus)
// Ignores points earned from normal spending, interest, FX fees and perks.
function yr1Fee(card) { return (card.firstYearFee ?? card.fee) - (card.cashback || 0); }
function calcCentsPerPoint(card, twoYear = false) {
  const fees = twoYear ? yr1Fee(card) + card.fee : yr1Fee(card);
  const pts  = twoYear ? (card.signupBonus + (card.year1Bonus || 0)) : card.signupBonus;
  if (!pts) return null;
  return ((fees * 100) / pts).toFixed(2);
}

// Estimated net $ value in year 1 at the user's chosen point valuation
let pointValueCents = 1.5;
function netValueYr1(card) {
  return Math.round(card.signupBonus * pointValueCents / 100 - yr1Fee(card));
}
function newsFlag(card) {
  const f = (window.FF_PROMOS?.card_flags || {})[`${card.bank}|${card.name}`];
  if (!f || !f.length) return '';
  const n = f[0];
  return `<div style="font-size:.7rem;margin-top:.2rem;"><a href="${n.link}" target="_blank" rel="noopener" style="color:#fbbf24;">📰 In the news ${n.date} — offer may have changed</a></div>`;
}
function verifiedBadge(card) {
  if (!card.verified) return '<div style="font-size:.68rem;color:var(--tritc-red);">Offer not re-verified</div>' + newsFlag(card);
  const days = Math.floor((Date.now() - new Date(card.verified)) / 86400000);
  const col = days > 45 ? 'var(--tritc-red)' : 'var(--text-secondary)';
  return `<div style="font-size:.68rem;color:${col};" title="${card.source || ''}">Checked ${card.verified}${days > 45 ? ' — may be out of date' : ''}</div>` + newsFlag(card);
}

function renderTable() {
  const container = document.getElementById('card-table-container');
  if (!container || !cardData) return;

  let data = [...(cardData[currentScheme] || [])].map(card => ({
    ...card,
    centsPoint:       parseFloat(calcCentsPerPoint(card))          || Infinity,
    annualCentsPoint: parseFloat(calcCentsPerPoint(card, true))    || Infinity,
    netValue:         netValueYr1(card),
  }));

  data.sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ?  1 : -1;
    return 0;
  });

  if (IS_MOBILE) {
    renderCards(container, data);
  } else {
    renderDesktopTable(container, data);
  }
}

// ── Mobile: stack as cards ─────────────────────────────────────────
function renderCards(container, data) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1rem;padding:1rem;">
      ${data.map(card => `
        <div style="background:rgba(255,255,255,.03);border:1px solid var(--glass-border);
                    border-radius:12px;padding:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;
                      margin-bottom:.75rem;">
            <div>
              <div style="font-weight:600;color:white;font-size:.95rem;">${card.bank}</div>
              <div style="font-size:.8rem;color:var(--text-secondary);">${card.name}</div>
            </div>
            <a href="${card.affiliateLink || card.link}" target="_blank" rel="noopener"
               class="subheading"
               style="font-size:.7rem;text-decoration:none;padding:.35rem .7rem;white-space:nowrap;">
              Apply ↗
            </a>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem .75rem;font-size:.82rem;">
            <div>
              <div style="color:var(--text-secondary);font-size:.68rem;text-transform:uppercase;
                          letter-spacing:.04em;">Bonus Points</div>
              <div style="color:var(--fitc-green);font-weight:700;">${card.signupBonus.toLocaleString()}</div>
              ${card.year1Bonus ? `<div style="font-size:.68rem;color:var(--text-secondary);">+${card.year1Bonus.toLocaleString()} yr 2</div>` : ''}
            </div>
            <div>
              <div style="color:var(--text-secondary);font-size:.68rem;text-transform:uppercase;
                          letter-spacing:.04em;">cents / pt</div>
              <div style="color:var(--dapi-blue);font-weight:600;">
                ${card.centsPoint === Infinity ? '—' : card.centsPoint}¢
                <span style="font-size:.72rem;color:var(--text-secondary);">
                  [${card.annualCentsPoint === Infinity || !card.year1Bonus ? '—' : card.annualCentsPoint+'¢'}]
                </span>
              </div>
            </div>
            <div>
              <div style="color:var(--text-secondary);font-size:.68rem;text-transform:uppercase;
                          letter-spacing:.04em;">Annual Fee</div>
              <div style="color:white;">$${card.fee}${(card.firstYearFee ?? card.fee) !== card.fee ? ` <span style="font-size:.7rem;color:var(--text-secondary);">($${card.firstYearFee} yr 1)</span>` : ''}${card.cashback ? `<div style="font-size:.7rem;color:var(--fitc-green);">−$${card.cashback} cashback</div>` : ''}</div>
            </div>
            <div>
              <div style="color:var(--text-secondary);font-size:.68rem;text-transform:uppercase;
                          letter-spacing:.04em;">Est. net value yr 1</div>
              <div style="color:${card.netValue >= 0 ? 'var(--fitc-green)' : 'var(--tritc-red)'};font-weight:600;">$${card.netValue.toLocaleString()}</div>
            </div>
            <div>
              <div style="color:var(--text-secondary);font-size:.68rem;text-transform:uppercase;
                          letter-spacing:.04em;">Min Spend</div>
              <div style="color:white;">$${card.minSpend.toLocaleString()}${card.spendDays ? ` / ${card.spendDays} days` : ''}</div>
            </div>
          </div>
          ${verifiedBadge(card)}
          ${card.loungePasses && card.loungePasses !== 'None' ? `
            <div style="margin-top:.5rem;font-size:.78rem;color:#a78bfa;">
              ✈ ${card.loungePasses}
            </div>` : ''}
          ${card.notes ? `
            <div style="margin-top:.5rem;font-size:.75rem;color:var(--text-secondary);
                        font-style:italic;border-top:1px solid rgba(255,255,255,.06);
                        padding-top:.4rem;">
              ${card.notes}
            </div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// ── Desktop: traditional table ─────────────────────────────────────
function renderDesktopTable(container, data) {
  const sortArrow = key => sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : '';
  const th = (label, key, right = false) =>
    `<th style="padding:1.2rem;${right ? 'text-align:right;' : ''}${key ? 'cursor:pointer;' : ''}"
        ${key ? `onclick="toggleSort('${key}')"` : ''}>
      ${label}${key ? sortArrow(key) : ''}
    </th>`;

  container.innerHTML = `
    <div style="overflow-x:auto;background:var(--glass-bg);border-radius:12px;">
      <table style="width:100%;border-collapse:collapse;min-width:820px;">
        <thead>
          <tr style="text-align:left;border-bottom:2px solid var(--glass-border);">
            ${th('Bank / Card', '')}
            ${th('Bonus pts', 'signupBonus')}
            ${th('Cost ¢/pt yr 1 [2-yr]', 'centsPoint')}
            ${th(`Est. net value yr 1 (@${pointValueCents}¢/pt)`, 'netValue')}
            ${th('Annual Fee', 'fee')}
            ${th('Min Spend', '')}
            ${th('Lounge', '')}
            ${th('Apply', '', true)}
          </tr>
        </thead>
        <tbody>
          ${data.map(card => `
            <tr style="border-bottom:1px solid var(--glass-border);transition:background .2s;"
                onmouseover="this.style.background='rgba(255,255,255,.02)'"
                onmouseout="this.style.background=''">
              <td style="padding:1.2rem 1rem;">
                <div style="font-weight:600;color:white;">${card.bank}</div>
                <div style="font-size:.8rem;color:var(--text-secondary);">${card.name}</div>
                ${card.notes ? `<div style="font-size:.72rem;color:#64748b;margin-top:.2rem;font-style:italic;">${card.notes}</div>` : ''}
                ${verifiedBadge(card)}
              </td>
              <td style="padding:1rem;">
                <div style="color:var(--fitc-green);font-weight:bold;">
                  ${card.signupBonus.toLocaleString()}
                </div>
                ${card.year1Bonus ? `<div style="font-size:.7rem;color:var(--text-secondary);">
                  +${card.year1Bonus.toLocaleString()} (Yr 2)
                </div>` : ''}
              </td>
              <td style="padding:1rem;">
                <span style="color:var(--dapi-blue);font-weight:600;">
                  ${card.centsPoint === Infinity ? '—' : card.centsPoint + '¢'}
                </span>
                <span style="font-size:.8rem;color:var(--text-secondary);">
                  [${(card.annualCentsPoint === Infinity || !card.year1Bonus) ? '—' : card.annualCentsPoint + '¢'}]
                </span>
              </td>
              <td style="padding:1rem;color:${card.netValue >= 0 ? 'var(--fitc-green)' : 'var(--tritc-red)'};font-weight:600;">$${card.netValue.toLocaleString()}</td>
              <td style="padding:1rem;">$${card.fee}${(card.firstYearFee ?? card.fee) !== card.fee ? `<div style="font-size:.7rem;color:var(--text-secondary);">$${card.firstYearFee} yr 1</div>` : ''}${card.cashback ? `<div style="font-size:.7rem;color:var(--fitc-green);">−$${card.cashback} cashback</div>` : ''}</td>
              <td style="padding:1rem;">$${card.minSpend.toLocaleString()}${card.spendDays ? `<div style="font-size:.7rem;color:var(--text-secondary);">in ${card.spendDays} days</div>` : ''}</td>
              <td style="padding:1rem;font-size:.8rem;color:${card.loungePasses && card.loungePasses !== 'None' ? '#a78bfa' : 'var(--text-secondary)'};">
                ${card.loungePasses ?? '—'}
              </td>
              <td style="padding:1rem;text-align:right;">
                <a href="${card.affiliateLink || card.link}" target="_blank" rel="noopener"
                   class="subheading"
                   style="font-size:.7rem;text-decoration:none;padding:.4rem .8rem;">
                  Apply ↗
                </a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Sort toggle ────────────────────────────────────────────────────
window.toggleSort = key => {
  sortConfig.direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
  sortConfig.key = key;
  renderTable();
};

// ── Scheme toggle buttons ──────────────────────────────────────────
document.getElementById('toggle-qantas')?.addEventListener('click', e => {
  currentScheme = 'qantas';
  document.querySelectorAll('.card-controls button').forEach(b => { b.style.opacity = '.5'; });
  e.target.style.opacity = '1';
  renderTable();
});

document.getElementById('toggle-velocity')?.addEventListener('click', e => {
  currentScheme = 'velocity';
  document.querySelectorAll('.card-controls button').forEach(b => { b.style.opacity = '.5'; });
  e.target.style.opacity = '1';
  renderTable();
});

// Point valuation input
document.getElementById('point-value')?.addEventListener('input', e => {
  const v = parseFloat(e.target.value);
  if (v > 0 && v < 10) { pointValueCents = v; renderTable(); }
});

// Set Qantas as active on load
const qBtn = document.getElementById('toggle-qantas');
if (qBtn) qBtn.style.opacity = '1';

initFF();

// Auto-updated news list (headlines + links only)
(function renderNews() {
  const ul = document.getElementById('ff-news');
  if (!ul) return;
  const items = (window.FF_PROMOS?.cards || []).slice(0, 8);
  const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  ul.innerHTML = items.length
    ? items.map(n => `<li>${n.date} · <a href="${esc(n.link)}" target="_blank" rel="noopener" style="color:var(--fitc-green);">${esc(n.title)}</a> <span style="opacity:.6;">(${esc(n.source)})</span></li>`).join('')
    : '<li>No card-offer headlines in the last few months yet — the list fills in automatically.</li>';
})();
