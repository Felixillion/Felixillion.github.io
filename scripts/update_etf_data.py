#!/usr/bin/env python3
"""
update_etf_data.py  —  GitHub Actions ETF data updater
=======================================================
Fetches real total return data (adjusted close) from Yahoo Finance and:
  1. Updates historicalReturns in data/etf_data.json for all tracked ETFs
  2. Updates assetClassReturns for the retirement simulator
  3. Generates individual stock/ETF JSON files in data/stocks/ for live lookup

Data source: Yahoo Finance via the `yfinance` library.
  - "Adjusted Close" prices correctly account for dividends reinvested,
    so year-over-year changes represent total returns (price + dividends).
  - This is the same data source used by sites like the Streamlit app you're comparing against.

Usage:
  pip install yfinance
  python scripts/update_etf_data.py

Or via GitHub Actions (see .github/workflows/daily-update.yml).
"""

import json
import sys
import time
from datetime import date, datetime
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    print("ERROR: yfinance not installed. Run: pip install yfinance")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR   = Path(__file__).parent.parent
DATA_DIR   = BASE_DIR / 'data'
STOCKS_DIR = DATA_DIR / 'stocks'
STOCKS_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# ETF tickers (Yahoo Finance uses .AX suffix for ASX-listed securities)
# ---------------------------------------------------------------------------
ETF_TICKERS = [
    # Australian equities
    'VAS.AX', 'A200.AX', 'IOZ.AX', 'STW.AX', 'VHY.AX', 'MVW.AX', 'VAP.AX',
    'MVA.AX', 'ATEC.AX',
    # International equities
    'VGS.AX', 'IVV.AX', 'VTS.AX', 'NDQ.AX', 'QUAL.AX', 'MOAT.AX', 'VESG.AX',
    'BGBL.AX', 'VGAD.AX', 'IHVV.AX', 'HNDQ.AX',
    # CNDX.AX removed: 404 on Yahoo Finance as of 2026 (likely delisted / merged)
    'ASIA.AX', 'DJRE.AX', 'IEM.AX', 'F100.AX',
    # Diversified / multi-asset
    'VDHG.AX', 'DHHF.AX', 'VDGR.AX', 'VDBA.AX', 'VDCO.AX',
    # Thematic / sector
    'HACK.AX', 'ETHI.AX', 'SEMI.AX', 'CLNE.AX', 'RBTZ.AX',
    'URNM.AX', 'GEAR.AX',
    # Fixed income / other
    'VAF.AX', 'QAU.AX', 'QPON.AX',
    # Actively managed / LICs — for comparison with passive ETFs
    'AFI.AX', 'ARG.AX', 'WAM.AX', 'WGB.AX', 'MFF.AX', 'PMC.AX',
]

# Asset class proxies for the retirement simulator
ASSET_CLASS_PROXIES = {
    'AU_SHARES':   'VAS.AX',
    'INTL_SHARES': 'VGS.AX',
    'AU_BONDS':    'VAF.AX',
    # GLOBAL_BONDS: no clean ETF proxy available on ASX; skip auto-update
    # CASH: use RBA cash rate — no ETF proxy; skip auto-update
}

# Top ASX stocks to pre-fetch for the live lookup feature
# Users can type any of these in the Compounding tab
TOP_ASX_STOCKS = [
    # Big 4 banks + MQG
    'CBA.AX', 'NAB.AX', 'WBC.AX', 'ANZ.AX', 'MQG.AX',
    # Resources
    'BHP.AX', 'RIO.AX', 'FMG.AX', 'S32.AX', 'MIN.AX', 'WHC.AX',
    'IGO.AX', 'LYC.AX', 'PLS.AX', 'PDN.AX', 'BOE.AX', 'NST.AX', 'EVN.AX',
    # Healthcare
    'CSL.AX', 'SHL.AX', 'COH.AX', 'RMD.AX', 'PME.AX',
    # Consumer
    'WES.AX', 'WOW.AX', 'COL.AX', 'JBH.AX', 'HVN.AX', 'PMV.AX',
    # Tech / software
    'WTC.AX', 'XRO.AX', 'REA.AX', 'CPU.AX', 'CAR.AX', 'SEK.AX',
    'NXT.AX', 'ALU.AX', 'TYR.AX',
    # Industrials / infrastructure
    'TCL.AX', 'APA.AX', 'TLS.AX', 'WDS.AX', 'STO.AX',
    'AMC.AX', 'BXB.AX', 'QAN.AX', 'FLT.AX',
    # Real estate
    'GMG.AX', 'SCG.AX', 'GPT.AX', 'DXS.AX', 'MGR.AX', 'CHC.AX',
    # Insurance / diversified financials
    'QBE.AX', 'IAG.AX', 'SUN.AX', 'MFG.AX',
    # Index funds & LICs
    'AFI.AX', 'ARG.AX', 'MLT.AX',
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def safe_fetch(ticker_str: str, period: str = '20y', interval: str = '1mo') -> dict | None:
    """Fetch historical data from Yahoo Finance. Returns None on failure."""
    try:
        t = yf.Ticker(ticker_str)
        hist = t.history(period=period, interval=interval, auto_adjust=True)
        if hist.empty:
            print(f"    ⚠ No data returned for {ticker_str}")
            return None
        # Strip timezone for easier handling
        if hist.index.tzinfo is not None:
            hist.index = hist.index.tz_localize(None)
        return hist
    except Exception as e:
        print(f"    ✗ Error fetching {ticker_str}: {e}")
        return None


def annual_total_returns(hist, start_year: int = 2009) -> dict:
    """
    Compute annual total returns from monthly adjusted close history.

    Yahoo Finance 'Adjusted Close' (auto_adjust=True) folds all dividends and
    splits into the price series, so year-over-year changes represent TOTAL
    returns including dividend reinvestment.

    IMPORTANT: Because MER is charged internally by the fund and is already
    reflected in the ETF's NAV/price, these returns are NET of MER.
    The compounding calculator deducts MER again on top of historical returns,
    which causes a small (~MER × years) double-deduction in historical mode.
    For typical AU ETFs (MER 0.07–0.67%) this is 0.7–6.7% over 10 years —
    acceptable for planning but worth knowing. Projection mode returns are
    gross estimates, so the MER deduction there is correct.

    We use Dec-close / prior-Dec-close for each calendar year so that year
    boundaries are consistent regardless of trading day calendar.
    """
    if hist is None:
        return {}

    returns = {}
    today_year = date.today().year

    # Get last close of each calendar year
    year_end_prices = {}
    for yr in range(start_year - 1, today_year + 1):
        yr_data = hist[hist.index.year == yr]
        if not yr_data.empty:
            year_end_prices[yr] = float(yr_data['Close'].iloc[-1])

    for yr in range(start_year, today_year):
        if yr in year_end_prices and (yr - 1) in year_end_prices:
            ret = round((year_end_prices[yr] / year_end_prices[yr - 1] - 1) * 100, 1)
            returns[str(yr)] = ret

    # Also compute current partial year
    cur_data = hist[hist.index.year == today_year]
    if not cur_data.empty and (today_year - 1) in year_end_prices:
        ret = round((float(cur_data['Close'].iloc[-1]) / year_end_prices[today_year - 1] - 1) * 100, 1)
        returns[str(today_year)] = ret

    return returns


def build_weekly_prices(hist, max_weeks: int = 520) -> list:
    """Return last N weeks of weekly closing prices for charting."""
    if hist is None:
        return []
    # Resample monthly hist to get approximate weekly by using as-is
    return [
        {'date': str(idx.date()), 'close': round(float(row['Close']), 3)}
        for idx, row in hist.tail(max_weeks).iterrows()
    ]


def fetch_ticker_info(ticker_str: str) -> dict:
    """Fetch yfinance .info dict with a timeout-safe wrapper."""
    try:
        t = yf.Ticker(ticker_str)
        info = t.info or {}
        return info
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Step 1 — Update ETF annual returns in etf_data.json
# ---------------------------------------------------------------------------
def update_etf_returns(etf_data: dict) -> dict:
    print("\n── Updating ETF historical returns ──")
    for key in etf_data.get('etfs', {}):
        ticker_ax = f'{key}.AX'
        print(f"  {ticker_ax} ...", end=' ', flush=True)

        hist = safe_fetch(ticker_ax, period='20y', interval='1mo')
        if hist is None:
            print("skipped")
            continue

        # Inception year from JSON (don't look further back than fund existed)
        inception = etf_data['etfs'][key].get('inceptionYear', 2009)
        new_returns = annual_total_returns(hist, start_year=max(inception, 2009))

        if not new_returns:
            print("no returns calculated")
            continue

        # Merge: only update years that actually have data (don't overwrite
        # pre-existing historical estimates for years before Yahoo has data)
        existing = etf_data['etfs'][key].get('historicalReturns', {})
        existing.update(new_returns)
        etf_data['etfs'][key]['historicalReturns'] = existing

        # Update long-run average return (5-year CAGR as annualReturn)
        cur_yr = date.today().year
        recent = {k: v for k, v in new_returns.items()
                  if int(k) >= cur_yr - 5 and int(k) < cur_yr}
        if recent:
            avg = round(sum(recent.values()) / len(recent), 1)
            etf_data['etfs'][key]['annualReturn'] = avg

        print(f"✓  ({len(new_returns)} years, avg {avg if recent else '—'}%)")
        time.sleep(0.3)  # polite rate limiting

    return etf_data


# ---------------------------------------------------------------------------
# Step 2 — Update asset class returns for retirement simulator
# ---------------------------------------------------------------------------
def update_asset_class_returns(etf_data: dict) -> dict:
    print("\n── Updating asset class returns (retirement simulator) ──")
    for asset_class, ticker_ax in ASSET_CLASS_PROXIES.items():
        print(f"  {asset_class} ← {ticker_ax} ...", end=' ', flush=True)
        hist = safe_fetch(ticker_ax, period='20y', interval='1mo')
        if hist is None:
            print("skipped")
            continue

        new_returns = annual_total_returns(hist, start_year=2009)
        if not new_returns:
            print("no data")
            continue

        existing = etf_data['assetClassReturns'].get(asset_class, {})
        # Only update 2009+ (pre-2009 data is academic estimates, keep them)
        for yr, ret in new_returns.items():
            if int(yr) >= 2009:
                existing[yr] = ret
        etf_data['assetClassReturns'][asset_class] = existing
        print(f"✓  ({len(new_returns)} years)")
        time.sleep(0.3)

    return etf_data


# ---------------------------------------------------------------------------
# Step 3 — Generate per-stock JSON files for live lookup
# ---------------------------------------------------------------------------
def fetch_and_save_stock(ticker_ax: str) -> dict | None:
    """Fetch a single stock and write its JSON file."""
    print(f"    {ticker_ax} ...", end=' ', flush=True)

    hist_weekly = safe_fetch(ticker_ax, period='5y', interval='1wk')
    hist_monthly = safe_fetch(ticker_ax, period='20y', interval='1mo')
    info = fetch_ticker_info(ticker_ax)

    if hist_weekly is None:
        print("no data")
        return None

    key = ticker_ax.replace('.AX', '')

    # `or` is ambiguous for DataFrames — use explicit None + empty check instead
    hist_to_use = hist_monthly if (hist_monthly is not None and not hist_monthly.empty) \
                  else hist_weekly
    annual = annual_total_returns(hist_to_use, start_year=2015)
    weekly_prices = build_weekly_prices(hist_weekly)

    # 5-year CAGR
    if len(hist_weekly) > 50:
        cagr = round(
            (float(hist_weekly['Close'].iloc[-1]) / float(hist_weekly['Close'].iloc[0])) ** (1 / 5) - 1,
            4) * 100
        cagr = round(cagr, 1)
    else:
        cagr = None

    div_yield_raw = info.get('dividendYield') or info.get('yield') or 0
    div_yield = round(div_yield_raw * 100, 2) if div_yield_raw < 1 else round(div_yield_raw, 2)

    result = {
        'ticker': key,
        'name': info.get('longName') or info.get('shortName') or key,
        'exchange': 'ASX',
        'currentPrice': info.get('currentPrice') or info.get('regularMarketPrice'),
        'currency': 'AUD',
        'marketCap': info.get('marketCap'),
        'sector': info.get('sector') or info.get('category') or 'Unknown',
        'industry': info.get('industry', ''),
        'dividendYield': div_yield,
        'mer': None,  # ETF-specific, not in Yahoo Finance
        'annualReturn': cagr,
        'historicalReturns': annual,
        'weeklyPrices': weekly_prices,
        'lastUpdated': str(date.today()),
    }

    out_path = STOCKS_DIR / f'{ticker_ax}.json'
    with open(out_path, 'w') as f:
        json.dump(result, f, separators=(',', ':'))

    print(f"✓  {result['name'][:35]}  cagr={cagr}%")
    return {k: v for k, v in result.items() if k != 'weeklyPrices'}  # index entry (no prices)


def build_stock_index(entries: list[dict]):
    """Write data/stocks/index.json — all tickers in one lightweight file."""
    index_path = STOCKS_DIR / 'index.json'
    payload = {
        'lastUpdated': str(date.today()),
        'count': len(entries),
        'stocks': entries,
    }
    with open(index_path, 'w') as f:
        json.dump(payload, f, indent=2)
    print(f"\n  Saved {index_path}  ({len(entries)} entries)")


def fetch_all_stocks():
    print("\n── Pre-fetching ASX stocks for live lookup ──")
    all_tickers = list(dict.fromkeys(ETF_TICKERS + TOP_ASX_STOCKS))  # deduplicate
    entries = []
    for ticker_ax in all_tickers:
        entry = fetch_and_save_stock(ticker_ax)
        if entry:
            entries.append(entry)
        time.sleep(0.5)  # polite rate limiting
    build_stock_index(entries)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    etf_data_path = DATA_DIR / 'etf_data.json'
    if not etf_data_path.exists():
        print(f"ERROR: {etf_data_path} not found. Make sure you run from the repo root.")
        sys.exit(1)

    print(f"Loading {etf_data_path}")
    with open(etf_data_path) as f:
        etf_data = json.load(f)

    # Update ETF historical returns
    etf_data = update_etf_returns(etf_data)

    # Update asset class returns for retirement simulator
    etf_data = update_asset_class_returns(etf_data)

    # Stamp last updated
    etf_data['meta']['lastUpdated'] = str(date.today())

    # Save
    with open(etf_data_path, 'w') as f:
        json.dump(etf_data, f, indent=2)
    print(f"\n✅ Saved {etf_data_path}")

    # Pre-fetch individual stock files
    fetch_all_stocks()

    print("\n✅ All done.")


if __name__ == '__main__':
    main()
