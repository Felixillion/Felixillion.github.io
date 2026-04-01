#!/usr/bin/env python3
"""
compute_bessembinder.py
-----------------------
Bessembinder-style ASX wealth creation concentration analysis.

Bessembinder (2018, JFE): "Do Stocks Outperform Treasury Bills?"
Finding: 4% of US stocks account for all net wealth creation 1926–2016.

This script:
  1. Downloads price history for ASX 200 constituents via yfinance
  2. Computes total return (price appreciation + dividends) for each stock
  3. Computes "wealth created" = total return × approximate market cap at start
  4. Ranks stocks and computes Lorenz concentration curve
  5. Writes results to _data/bessembinder.json

IMPORTANT LIMITATION — SURVIVORSHIP BIAS:
  This script only captures CURRENT ASX 200 constituents, i.e. stocks that survived.
  The true Bessembinder analysis requires ALL stocks ever listed, including delisted
  failures (ABC Learning, HIH, Allco, Centro, etc.).
  With survivorship bias removed, the concentration effect is even more extreme.
  The script outputs a warning about this in the JSON metadata.

Run:
  pip install yfinance pandas requests --break-system-packages
  python3 compute_bessembinder.py

GitHub Actions: triggered by daily-update.yml (weekly on Mondays).
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

try:
    import yfinance as yf
    import pandas as pd
    import numpy as np
except ImportError:
    print("Missing dependencies: pip install yfinance pandas numpy --break-system-packages")
    sys.exit(1)

# ── Paths ──────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parents[3]
OUT_PATH  = REPO_ROOT / '_data' / 'bessembinder.json'

# ── ASX 200 constituents (approximate current list) ─────────────
# yfinance tickers need .AX suffix
ASX200_TICKERS = [
    'CBA.AX','BHP.AX','CSL.AX','NAB.AX','WBC.AX','ANZ.AX','WES.AX','MQG.AX',
    'RIO.AX','TLS.AX','GMG.AX','TCL.AX','FMG.AX','REA.AX','WDS.AX','ALL.AX',
    'COL.AX','NCM.AX','IAG.AX','QBE.AX','STO.AX','APA.AX','ORG.AX','AZJ.AX',
    'AMC.AX','SEK.AX','CPU.AX','MPL.AX','HLS.AX','BXB.AX','RMD.AX','LLC.AX',
    'ASX.AX','XRO.AX','JHX.AX','NST.AX','TWE.AX','MIN.AX','AGL.AX','WPR.AX',
    'DXS.AX','ALX.AX','SGP.AX','GPT.AX','VCX.AX','MGR.AX','ABP.AX','CHC.AX',
    'CWY.AX','IEL.AX','NXT.AX','WTC.AX','PME.AX','CAR.AX','APX.AX','HUB.AX',
    'NWS.AX','FOX.AX','SHL.AX','COH.AX','NHF.AX','EBO.AX','IFL.AX','PPT.AX',
    'MFG.AX','PTM.AX','GQG.AX','PDL.AX','AFI.AX','ARG.AX','WHC.AX','NIC.AX',
    'S32.AX','OZL.AX','IGO.AX','SFR.AX','LYC.AX','PLS.AX','AKE.AX','SQM.AX',
    'QAN.AX','CNU.AX','SKI.AX','DBO.AX','SUL.AX','HVN.AX','JBH.AX','KGN.AX',
    'LOV.AX','UNI.AX','APT.AX','Z1P.AX','ZIP.AX','AFT.AX','CRN.AX','GNC.AX',
    'NUF.AX','ILU.AX','ORI.AX','BSL.AX','BLD.AX','JHG.AX','EQT.AX','AMP.AX',
    'SUN.AX','QBE.AX','BOQ.AX','BEN.AX','MYS.AX','ANF.AX','TYR.AX','VEA.AX',
    'ALU.AX','TNE.AX','TYR.AX','PNI.AX','CIL.AX','SPK.AX','OFX.AX','GDI.AX',
    'DMP.AX','RFG.AX','CTX.AX','CVN.AX','WOR.AX','CIM.AX','CQR.AX','SCG.AX',
    'URW.AX','LEP.AX','GDC.AX','SCP.AX','VGH.AX','LLC.AX','EML.AX','LNK.AX',
    'WTC.AX','ALQ.AX','ALS.AX','ACL.AX','BGP.AX','BRG.AX','BWP.AX','CDA.AX',
    'DCN.AX','ELD.AX','FBU.AX','GEM.AX','HPI.AX','IPD.AX','JAN.AX','KAR.AX',
    'LGL.AX','MGX.AX','NCK.AX','OML.AX','PGH.AX','QUB.AX','RHC.AX','SBM.AX',
    'TGS.AX','UOS.AX','VHT.AX','WGN.AX','XF1.AX','YAL.AX','ZIM.AX','MLX.AX',
    'MCR.AX','MRR.AX','NBI.AX','OBL.AX','PPS.AX','PWH.AX','RGP.AX','SRG.AX',
]
# Deduplicate
ASX200_TICKERS = list(dict.fromkeys(ASX200_TICKERS))[:200]

# Risk-free rate proxy — RBA overnight cash rate approximation (avg 2000–2024 ~4%)
RISK_FREE_ANNUAL_PCT = 4.0

def fetch_stock_data(ticker, start='2000-01-01', end=None):
    """Download price + dividend history for one ticker."""
    end = end or datetime.now().strftime('%Y-%m-%d')
    try:
        data = yf.download(ticker, start=start, end=end, auto_adjust=True,
                           progress=False, threads=False, timeout=15)
        if data.empty:
            return None
        # Also get dividends
        tk = yf.Ticker(ticker)
        info = {}
        try:
            info = tk.info or {}
        except Exception:
            pass
        return {
            'close': data['Close'],
            'shares_outstanding': info.get('sharesOutstanding', None),
            'market_cap': info.get('marketCap', None),
            'name': info.get('longName', ticker.replace('.AX', '')),
        }
    except Exception as e:
        print(f"  ⚠ {ticker}: {e}")
        return None

def compute_total_return(close_series):
    """
    Total return = (final_price - initial_price) / initial_price
    (yfinance auto-adjust already folds in dividends via adjusted close)
    Returns as multiplier (1.0 = no change, 2.0 = doubled)
    """
    prices = close_series.dropna()
    if len(prices) < 252:  # need at least ~1 year
        return None
    first = float(prices.iloc[0])
    last  = float(prices.iloc[-1])
    if first <= 0:
        return None
    return last / first  # total return multiplier

def compute_wealth_created(total_return_mult, market_cap_start):
    """
    Wealth created = (total_return - 1) × starting market cap
    i.e., how many dollars of wealth were created for investors
    Returns in $B AUD
    """
    if total_return_mult is None or market_cap_start is None:
        return None
    gain = (total_return_mult - 1) * market_cap_start
    return gain / 1e9  # billions AUD

def run_analysis():
    print("=" * 60)
    print("Bessembinder ASX Analysis")
    print(f"Start: {datetime.now().isoformat()}")
    print(f"Tickers to analyse: {len(ASX200_TICKERS)}")
    print("=" * 60)

    results = []
    start_date = '2000-01-01'
    end_date   = datetime.now().strftime('%Y-%m-%d')

    for i, ticker in enumerate(ASX200_TICKERS):
        print(f"  [{i+1}/{len(ASX200_TICKERS)}] {ticker}...", end=' ', flush=True)
        data = fetch_stock_data(ticker, start=start_date)
        if data is None or data['close'] is None or len(data['close']) < 50:
            print("skip")
            time.sleep(0.3)
            continue

        tr_mult = compute_total_return(data['close'])
        if tr_mult is None:
            print("insufficient data")
            time.sleep(0.3)
            continue

        # Estimate starting market cap — use current shares × earliest price if no better data
        mcap = data['market_cap']
        shares = data['shares_outstanding']
        earliest_price = float(data['close'].dropna().iloc[0])
        if mcap and shares:
            # Rough start mcap: today's shares × earliest price (imprecise but directionally correct)
            mcap_start_aud = shares * earliest_price
        else:
            # Very rough: assume $500M start cap if unknown
            mcap_start_aud = 500e6

        wc_bn = compute_wealth_created(tr_mult, mcap_start_aud)

        results.append({
            'ticker': ticker,
            'name': data['name'],
            'total_return_x': round(tr_mult, 3),
            'wealth_created_bn': round(wc_bn, 2) if wc_bn else 0.0,
            'years_of_data': round(len(data['close'].dropna()) / 252, 1),
        })
        print(f"{tr_mult:.2f}× → ${wc_bn:.1f}B" if wc_bn else f"{tr_mult:.2f}× (no mcap)")
        time.sleep(0.4)  # be gentle with yfinance

    if not results:
        print("ERROR: No results obtained")
        sys.exit(1)

    # ── Sort by wealth created ──
    results.sort(key=lambda r: r['wealth_created_bn'], reverse=True)

    # ── Lorenz curve ──
    total_wealth = sum(r['wealth_created_bn'] for r in results)
    total_positive = sum(r['wealth_created_bn'] for r in results if r['wealth_created_bn'] > 0)
    n = len(results)

    # Sort ascending for Lorenz
    sorted_asc = sorted(results, key=lambda r: r['wealth_created_bn'])
    cumulative_wealth = 0.0
    lorenz = [[0, 0]]
    for i, r in enumerate(sorted_asc):
        cumulative_wealth += r['wealth_created_bn']
        pct_stocks = round((i + 1) / n * 100, 1)
        pct_wealth = round(cumulative_wealth / total_positive * 100, 1) if total_positive > 0 else 0
        if pct_stocks in [1,2,3,5,8,10,15,20,25,30,40,50,60,75,80,90,95,98,99,100] or i == n-1:
            lorenz.append([pct_stocks, pct_wealth])

    # ── Concentration stats ──
    def top_n_pct_share(pct):
        k = max(1, round(n * pct / 100))
        top_k = results[:k]  # already sorted desc by wealth
        share = sum(r['wealth_created_bn'] for r in top_k) / total_positive * 100 if total_positive else 0
        return round(share, 1)

    n_above_rf = sum(1 for r in results if r['total_return_x'] > (1 + RISK_FREE_ANNUAL_PCT/100)**r['years_of_data'])
    n_negative = sum(1 for r in results if r['total_return_x'] < 1.0)

    concentration = {
        'top1pct_share':  top_n_pct_share(1),
        'top5pct_share':  top_n_pct_share(5),
        'top10pct_share': top_n_pct_share(10),
        'top25pct_share': top_n_pct_share(25),
        'pct_stocks_above_tbill': round(n_above_rf / n * 100, 1),
        'pct_negative_absolute':  round(n_negative / n * 100, 1),
    }

    # ── Return distribution bins ──
    bin_edges = [float('-inf'), -0.9, -0.5, 0, 0.5, 2.0, 5.0, 10.0, float('inf')]
    bin_labels = ['<−90%','−90–50%','−50–0%','0–50%','50–200%','200–500%','500–1000%','>1000%']
    dist_bins = []
    for j, label in enumerate(bin_labels):
        lo = bin_edges[j] - 1  # convert return multiplier range
        hi = bin_edges[j+1] - 1
        count = sum(1 for r in results if lo < (r['total_return_x']-1) <= hi)
        dist_bins.append({'label': label, 'count': count})

    # ── Output ──
    top15 = [{
        'rank': i+1,
        'ticker': r['ticker'],
        'name': r['name'],
        'total_return_x': round(r['total_return_x'], 2),
        'wealth_created_bn': round(r['wealth_created_bn'], 1),
        'pct_total': round(r['wealth_created_bn'] / total_positive * 100, 1) if total_positive else 0,
    } for i,r in enumerate(results[:15])]

    output = {
        'meta': {
            'last_updated': datetime.now().strftime('%Y-%m-%d'),
            'period': f"{start_date} – {end_date}",
            'stocks_analysed': n,
            'total_wealth_created_bn': round(total_positive, 0),
            'survivorship_bias_warning': (
                'IMPORTANT: Analysis covers only CURRENT ASX 200 constituents — '
                'stocks that survived. True Bessembinder requires all delisted stocks '
                '(ABC Learning, HIH, Allco, Centro, etc.). '
                'With failures included, concentration effect would be even more extreme.'
            ),
            'methodology': (
                'Total return = adjusted close ratio (dividends folded via yfinance auto_adjust). '
                'Wealth created = (total_return - 1) × estimated starting market cap. '
                'Lorenz curve = cumulative wealth created vs % of stocks, sorted ascending.'
            ),
        },
        'concentration': concentration,
        'lorenz': lorenz,
        'top_stocks': top15,
        'dist_bins': dist_bins,
    }

    out_dir = OUT_PATH.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, 'w') as f:
        json.dump(output, f, indent=2)

    print("\n" + "="*60)
    print(f"✅ Written: {OUT_PATH}")
    print(f"   Stocks analysed: {n}")
    print(f"   Total wealth created: ${total_positive:.0f}B")
    print(f"   Top 5% share: {concentration['top5pct_share']}%")
    print(f"   % above risk-free: {concentration['pct_stocks_above_tbill']}%")
    print("="*60)

if __name__ == '__main__':
    run_analysis()
