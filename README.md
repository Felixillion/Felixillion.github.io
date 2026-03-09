# Felixillion — Personal Portfolio Site

A personal Jekyll site hosted on GitHub Pages. Features spatial biology image galleries, an AU ETF compounding and retirement simulator, a frequent flyer credit card tracker, and an astrobiology-themed cosmic horoscope lab.

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
│   ├── ff_weekly.json          ← FF card data served to Jekyll at build time
│   └── astrology_daily.json    ← Daily horoscope/planetary data
├── _includes/
│   └── nav.html                ← Navigation bar (shared across all pages)
├── _layouts/
│   └── default.html            ← Base HTML layout
├── assets/
│   ├── css/
│   │   └── style.css           ← Global styles + CSS variables
│   ├── js/
│   │   ├── etf_tools.js        ← ETF compounding + retirement simulator
│   │   ├── frequent_flyer.js   ← FF points card table
│   │   ├── astrobiology.js     ← Cosmic lab / horoscope frontend
│   │   ├── gallery.js          ← Spatial gallery renderer
│   │   ├── hero.js             ← Homepage animated canvas backdrops
│   │   └── home_interactions.js← Homepage misc interactions
│   └── gallery/
│       └── *.jpg               ← Gallery images (author's own — see licence above)
├── data/
│   ├── etf_data.json           ← ETF seed data (45 ETFs, asset class returns 1901–2024)
│   ├── astrology_daily.json    ← Mirror of _data/ for client-side fetch
│   └── stocks/
│       ├── index.json          ← Live-updated ticker index
│       └── <TICKER>.AX.json    ← Per-ETF live data from yfinance
├── pages/
│   ├── etf-tools.html
│   ├── frequent-flyer.html
│   ├── astrobiology.html
│   ├── gallery.html
│   ├── cv.html
│   └── privacy.html
├── .github/
│   └── workflows/
│       ├── daily-update.yml                ← GitHub Actions workflow
│       └── scripts/
│           ├── update_etf_data.py          ← yfinance ETF price updater
│           ├── generate_astrology_data.js  ← Daily horoscope generator
│           └── ff_scraper.js               ← FF card data writer
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
| ETF Tools | `/etf-tools.html` | Compounding calculator + retirement simulator |
| Privacy | `/privacy.html` | Privacy statement |

---

## Automation (GitHub Actions)

Workflow file: `.github/workflows/daily-update.yml`

| Job | Schedule | What it does |
|---|---|---|
| **Update ETF & Stock Data** | Daily, 7am AEST | Runs `update_etf_data.py` — fetches current prices and historical returns via `yfinance` for all 45 ETFs. Writes `data/stocks/<TICKER>.AX.json` and `data/stocks/index.json`. Commits to `data/`. |
| **Generate Astrology Data** | Daily, 7am AEST | Runs `generate_astrology_data.js` — computes real planetary positions (VSOP87-approximated), generates date-seeded horoscope readings, writes `data/astrology_daily.json` and `_data/astrology_daily.json`. |
| **Scrape FF Data** | Mondays, 7am AEST | Runs `ff_scraper.js` — writes the curated FF card dataset to `_data/ff_weekly.json`. Commits to `_data/`. |

Manual trigger: GitHub → Actions → Daily Data Update → Run workflow.

---

## ETF Tools — calculation notes

All calculation code is in `assets/js/etf_tools.js`. Key design decisions:

**Compounding (Projection mode)**
- Monthly compounding using `(1 + netAnnual)^(1/12) - 1` applied per month
- `netAnnual = (annualReturn / 100) − MER − dividendYield` (if DRIP off, dividends stripped from growth)
- Partial first/last month uses `daysRemaining / daysInMonth` fraction
- Verified against textbook annuity formula — exact match ✓

**Compounding (Historical mode)**
- Uses actual year-by-year returns from `historicalReturns` in `etf_data.json` (sourced from Yahoo Finance adjusted close prices)
- MER is NOT deducted in historical mode (returns are already net-of-fee from Yahoo adjusted close)
- Inflation adjustment uses real ABS CPI data by year (AU_CPI_YR table)

**Retirement simulator**
- Method: Bengen (1994) sequence-of-returns historical simulation — same approach as the Trinity Study
- Runs every historical start year from 1901 to (last data year − retirement duration)
- Each year: weighted composite return from asset class data minus fund MER
- Start-of-year timing (conservative) or end-of-year timing (optimistic)
- Pre-1970 data is estimated from DMS Yearbook — marked with dashed borders in heatmap
- Verified: withdrawal rate arithmetic, timing logic, binary search solver all correct ✓

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

Edit `.github/workflows/scripts/ff_scraper.js`. The card objects follow this shape:

```js
{
  bank: "ANZ",
  name: "Frequent Flyer Black",
  signupBonus: 130000,
  year1Bonus: 0,
  fee: 425,
  minSpend: 5000,
  link: "https://www.anz.com.au/...",
  affiliateLink: "",       // ← set to your referral URL to earn commission
  loungePasses: "2 Qantas Club",
  notes: "Optional note shown in table",
}
```

The script runs weekly (Mondays) and writes directly to `_data/ff_weekly.json`.

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

- FF card data is **manually curated** (banks block automated scraping). Update `ff_scraper.js` when offers change — typically quarterly.
- Horoscope readings: 7 per sign × 12 signs = 84 unique readings. With a daily seed they cycle slowly but will repeat. Expanding the reading pool in `generate_astrology_data.js` would reduce repetition.
- Pre-1970 asset class returns are estimated from academic sources and carry ±2–5% uncertainty. Treat retirement simulations starting before 1970 as illustrative only.
- ETF inception years: some ETFs launched after 2010 have limited historical data. The tool falls back to asset class history for years before inception.

---

## Data sources

- **ETF returns:** [Yahoo Finance](https://finance.yahoo.com/) adjusted close prices via `yfinance`
- **Asset class history (1970–2024):** RBA Statistics, ASX 200 total return index, MSCI data
- **Pre-1970 estimates:** Dimson, Marsh & Staunton — *Global Investment Returns Yearbook* (UBS, annual)
- **Australian CPI:** ABS Cat. 6401.0
- **Tax rates:** ATO 2025-26 resident individual rates (Stage 3 tax cuts)
- **Planetary positions:** VSOP87 truncated series (generate_astrology_data.js)
- **FF card data:** Manually sourced from bank websites
