# Felixillion — Personal Portfolio Site

A personal Jekyll site hosted on GitHub Pages. Features spatial biology image galleries, AU ETF tools (compare any ASX fund, backtest portfolios, track your holdings), a frequent flyer credit card tracker, and an astrobiology-themed cosmic horoscope lab.

**Live site:** [felixillion.github.io](https://felixillion.github.io)

---

## Licence & reuse

**Code:** All code in this repository is free to use, adapt, and redistribute for any purpose — personal or commercial — with no attribution required. No licence file is attached; treat it as public domain.

**Images:** All images in `assets/gallery/` and elsewhere on the site are original works by the author and **may not be reproduced or used without explicit written acknowledgement of authorship**. Please reach out before using them.

---

## Site structure

```
.
├── _data/
│   ├── ff_cards.json           ← FF card offers (edited by hand)
│   ├── ff_history.json         ← past offers (grows weekly)
│   ├── ff_checks.json          ← weekly automatic check of each bank page
│   └── astrology_daily.json    ← Daily horoscope/planetary data
├── _includes/
│   └── nav.html                ← Navigation bar (shared across all pages)
├── _layouts/
│   └── default.html            ← Base HTML layout
├── assets/
│   ├── css/
│   │   └── style.css           ← Global styles + CSS variables
│   ├── js/
│   │   ├── etf_tools.js        ← ETF Tools: compare, backtest, my portfolio
│   │   ├── frequent_flyer.js   ← FF points card table
│   │   ├── astrobiology.js     ← Cosmic lab / horoscope frontend
│   │   ├── gallery.js          ← Spatial gallery renderer
│   │   ├── hero.js             ← Homepage animated canvas backdrops
│   │   └── home_interactions.js← Homepage misc interactions
│   └── gallery/
│       └── *.jpg               ← Gallery images (author's own — see licence above)
├── data/
│   ├── etf_data.json           ← Asset-class returns 1901+ (AU Investing) + hand-checked fund sectors/holdings
│   ├── universe.json           ← The ~670 ASX codes whose prices are downloaded
│   ├── astrology_daily.json    ← Mirror of _data/ for client-side fetch
│   └── prices/
│       ├── index.json          ← Search list + headline returns for every code
│       ├── _quality.json       ← What the data sanity checks found
│       └── <CODE>.json         ← Weekly prices, total-return index and distributions
├── pages/
│   ├── etf-tools.html
│   ├── frequent-flyer.html
│   ├── astrobiology.html
│   ├── gallery.html
│   ├── cv.html
│   └── privacy.html
├── .github/
│   └── workflows/
│       ├── daily-update.yml                ← daily data jobs
│       ├── weekly-prices.yml               ← weekly ETF/share prices
│       ├── ticker-request.yml              ← "Add ticker: ABC" issues → added automatically
│       └── scripts/
│           ├── fetch_prices.py             ← yfinance weekly prices + sanity checks
│           ├── update_etf_data.py          ← new asset-class years from the price files
│           ├── generate_astrology_data.js  ← Daily horoscope generator
│           └── ff_check.py                 ← weekly FF link/offer check
├── 404.html
├── index.html
└── requirements.txt                        ← yfinance>=0.2.54
```

---

## Pages

| Page | Path | Description |
|---|---|---|
| Home | `/` | Hero with animated canvas backdrops |
| Gallery | `/gallery.html` | Spatial biology image showcase |
| CV | `/cv.html` | Academic CV with live ORCID publication fetch |
| Cosmic Lab | `/astrobiology.html` | Daily science-themed horoscopes |
| FF Points | `/frequent-flyer.html` | AU credit card bonus comparison |
| ETF Tools | `/etf-tools.html` | Compare funds, backtest a portfolio, track your holdings |
| Privacy | `/privacy.html` | Privacy statement |

---

## Automation (GitHub Actions)

Workflow file: `.github/workflows/daily-update.yml`

| Job | Schedule | What it does |
|---|---|---|
| **Weekly Price Update** (`weekly-prices.yml`) | Saturdays | Runs `fetch_prices.py` — full daily history from Yahoo Finance for every code in `data/universe.json`, cleaned and saved as weekly files in `data/prices/`; then `update_etf_data.py` adds any newly completed year to the asset-class returns. |
| **Ticker Request** (`ticker-request.yml`) | When an issue titled “Add ticker: ABC” is opened | Checks the code on Yahoo, adds it to `universe.json`, downloads it, replies and closes the issue. |
| **Generate Astrology Data** | Daily, 7am AEST | Runs `generate_astrology_data.js` — computes real planetary positions (VSOP87-approximated), generates date-seeded horoscope readings, writes `data/astrology_daily.json` and `_data/astrology_daily.json`. |
| **FF Offer Check** (`ff-check.yml`) | Mondays | Runs `ff_check.py` — tests each card link, compares bonus numbers with the bank's page, records offer history, opens an issue if anything needs re-checking. |

Manual trigger: GitHub → Actions → Daily Data Update → Run workflow.

---

## ETF Tools — calculation notes

All calculation code is in `assets/js/etf_tools.js`; prices come from `data/prices/` (weekly).

**Data**
- `fetch_prices.py` downloads full daily history (split-adjusted closes and cash distributions) and builds its own total-return index: distributions reinvested at the ex-date close. Yahoo's "Adj Close" isn't used because it is wrong for some funds and LICs.
- Sanity checks: one-day jumps over 40% that reverse within 3 days are treated as bad ticks; a single distribution over 50% of the price is dropped; over 15% is kept but flagged. Findings go to `data/prices/_quality.json` and the Data Audit.
- Saved weekly (last close of each week) to keep files small; dates are implicit (start Friday + 7 days × index).

**Compare** — buys at the weekly close; DRP on = units grow with the total-return index; DRP off = distributions paid as cash to units held before each ex-date. "Your annual return" is money-weighted (XIRR); "fund total return" is time-weighted. Today's-dollars mode uses ABS CPI (annual average, interpolated).

**Backtest** — weights, rebalancing at the first week of each year/quarter/month, contributions split by target weight, distributions reinvested. Metrics: CAGR, volatility (weekly, annualised), max drawdown, best/worst year, worst 12 months, Sharpe vs the average RBA cash rate, correlations of weekly returns. Look-through uses the hand-checked sectors/holdings in `etf_data.json`.

**My portfolio** — trades saved in the browser (localStorage, key `felixillion-etf-portfolio-v1`); export/import JSON; CSV import for generic broker exports and CommSec. Average-cost gains; distributions estimated from units held before each ex-date; XIRR includes distributions; the benchmark gets the same cash flows.

**Retirement** — moved to the AU Investing page (one maintained withdrawal-rate engine).

**Franking credits**
- Formula: `dividendYield × frankingPct × (0.30/0.70) × (1 − marginalRate)`
- This is the ATO-correct calculation of the net benefit of imputation credits to an investor at a given marginal rate
- At marginal rate = 30% (= corporate tax rate), benefit is exactly zero (credits offset the tax owed)
- Verified against ATO franking credit worked examples ✓

**Cents-per-point (FF Tracker)**
- Formula: `(annualFee × 100) / bonusPoints`
- Two-year version: `(fee × 2 × 100) / (signupBonus + year1Bonus)`
- Lower = better value ✓

---

## CV page — ORCID setup

Open `pages/cv.html` and fill in the `CV_CONFIG` block at the top:

```js
window.CV_CONFIG = {
  orcid: '0000-0000-0000-0000',   // ← your ORCID iD
  scholarUrl: 'https://scholar.google.com/citations?user=XXXXX',
  // ...
};
```

Once `orcid` is set, publications are fetched live from `https://pub.orcid.org/v3.0/{orcid}/works` on every page load. No GitHub Action needed. Falls back to `fallbackPublications` if ORCID is unreachable.

---

## Gallery — adding images

1. Place image files in `assets/gallery/`
2. Edit `_data/gallery.json`:

```json
[
  {
    "title": "My Dataset",
    "type": "Imaging Mass Cytometry",
    "color": "var(--dapi-blue)",
    "image": "assets/gallery/my_image.jpg",
    "description": "One-sentence description."
  }
]
```

No code changes needed — `gallery.js` reads from `window.GALLERY_DATA` injected by Jekyll.

---

## FF card data — updating manually

Edit `_data/ff_cards.json` (one object per card; the `_readme` at the top explains each field). Example:

```json
{ "id": "anz-ff-black", "program": "qantas", "issuer": "ANZ", "name": "Frequent Flyer Black",
  "stages": [{"pts": 50000, "year": 1, "need": "Spend $6,000 in 3 months"}, {"pts": 50000, "year": 2, "need": "Keep the card over 12 months"}],
  "minSpend": 6000, "spendDays": 90, "fees": {"y1": 425, "ongoing": 425}, "cashback": 0, "credits": 0,
  "link": "https://www.anz.com.au/personal/credit-cards/frequent-flyer-black/", "affiliateLink": "",
  "source": "anz.com.au product page", "verified": "2026-11-11" }
```

When you re-check a card, update its figures **and** its `verified` date. `.github/workflows/ff-check.yml` runs weekly (Mondays): it tests every link, checks the bonus numbers still appear on the bank's page, adds changed offers to `_data/ff_history.json` (the page's "Past offers"), and opens a GitHub issue “FF Points: offers to re-check” when something needs a human. Some banks block automated visitors — those cards just show no automatic tick.

**Affiliate links:** Set `affiliateLink` to your referral URL. The JS uses `card.affiliateLink || card.link`, so it falls back to the official link when empty.

---

## Local development

```bash
gem install bundler jekyll
bundle install
bundle exec jekyll serve
```

Visit `http://localhost:4000`.

**Cache busting:** The layout adds `?v={{ site.time | date: '%Y%m%d%H%M' }}` to all JS imports so browsers pick up changes on each Jekyll build.

---

## Deployment

Push to `main` — GitHub Pages builds and deploys automatically within ~60 seconds.

The Actions workflow runs separately on its own cron schedule and commits data updates back to `main`, which triggers a new Pages build.

---

## Known limitations / future work

- FF card offers are **edited by hand** in `_data/ff_cards.json` (banks have no feed). The weekly check tells you when to look.
- Horoscope readings: 7 per sign × 12 signs = 84 unique readings. With a daily seed they cycle slowly but will repeat. Expanding the reading pool in `generate_astrology_data.js` would reduce repetition.
- Pre-1970 asset class returns are estimated from academic sources and carry ±2–5% uncertainty. Treat retirement simulations starting before 1970 as illustrative only.
- ETF Tools only show real history: a comparison or backtest starts when the youngest fund listed (no stand-in index data). Prices are weekly and update weekly.

---

## Data sources

- **ETF/share prices and distributions:** [Yahoo Finance](https://finance.yahoo.com/) via `yfinance`, total returns rebuilt from prices + distributions
- **Asset class history (1970–2024):** RBA Statistics, ASX 200 total return index, MSCI data
- **Pre-1970 estimates:** Dimson, Marsh & Staunton — *Global Investment Returns Yearbook* (UBS, annual)
- **Australian CPI:** ABS Cat. 6401.0
- **Tax rates:** ATO 2025-26 resident individual rates (Stage 3 tax cuts)
- **Planetary positions:** VSOP87 truncated series (generate_astrology_data.js)
- **FF card data:** Manually sourced from bank websites

---

## Data audit & ground truth

`tests/audit_checks.py` (run automatically by `.github/workflows/data-audit.yml` after every data update, and on every push) checks the site against independent references in `data/ground_truth/reference_series.json`:

| Check | Reference | Fails when |
|---|---|---|
| Freshness | — | Cosmic Lab data > 1 day old, ETF data or weekly prices > 8–9 days old |
| CPI tables (ETF tools, AU investing) | RBA Table G1 | any year differs by > 0.15 pts |
| AU shares asset class | All Ords Accumulation (Market Index) | any year out of tolerance |
| Cash asset class | RBA Table F1 | any year differs by > 0.3 pts |
| VAS weekly total returns | All Ords Accumulation | any year differs by > 2.5 pts (checks the price pipeline) |
| Income tax second bracket | ATO rates by financial year | rate doesn't match the current FY |
| Status Credits | Qantas earning tables | table or tier thresholds differ |
| Planet positions | PyEphem (VSOP87/ELP) | any body off by > 0.5° |

Warnings (don't fail the build): FF offers not re-verified in 60 days, Rich List edition out of date, scraped "proposed" values awaiting review.
If the audit fails, an issue labelled `data-audit` is opened automatically.

**Yearly checklist (Jan–Jun):** add last year's CPI and cash rate from the RBA tables, last year's All Ords Accumulation return, next FY's tax rates (by 1 July) and the new AFR Rich List figures (late May) to `reference_series.json` / `_data/billionaires.json`; re-verify the FF card offers every ~6 weeks (update `verified` per card in `_data/ff_cards.json`).
