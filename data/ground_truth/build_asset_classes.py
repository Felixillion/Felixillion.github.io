#!/usr/bin/env python3
"""Rebuild the 1970+ international, US and bond series in data/etf_data.json (assetClassReturns)
from the sourced inputs in asset_class_sources.json. Run from the repo root:
    python3 data/ground_truth/build_asset_classes.py
Method (all returns in A$, before fees — the planners deduct each fund's MER themselves):
  INTL_SHARES  MSCI World gross (US$) converted to A$ with year-end exchange rates (unhedged, like VGS).
               MSCI World includes Australia (~2%); VGS excludes it — a small difference.
  US_SHARES    S&P 500 total return (US$) converted to A$ (unhedged, like IVV).
  AU_BONDS     1970–1989 built from the 10-year yield: one year's return on a 6-year par bond (similar
               duration to the Bloomberg AusBond Composite). 1990+ keeps the existing composite-index figures.
  GLOBAL_BONDS Hedged to A$: A$ cash + (return on a 6-year US Treasury par bond − US T-bill), i.e. the
               bond's excess return plus the hedging carry. A proxy for the Bloomberg Global Aggregate
               (A$ hedged), which only exists from the 1990s.
  US_SHARES_USD / US_TBOND_USD  S&P 500 and 10-year Treasury total returns in US$, 1928+ (Damodaran),
               used only for the US 60/40 'Trinity study' comparison with US inflation.
"""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
S = json.load(open(ROOT / 'data/ground_truth/asset_class_sources.json'))
ETF = ROOT / 'data/etf_data.json'
d = json.load(open(ETF))
A = d['assetClassReturns']
v = lambda k: {int(y): x for y, x in S[k]['values'].items()}
fx, msci, sp, bill = v('audusd_year_end'), v('msci_world_gross_usd'), v('sp500_tr_usd'), v('us_tbill')
us10, au10 = v('us_10y_yield_year_end'), v('au_10y_yield_december')

def par_bond(y0, y1, m=6):
    c, r = y0 / 100, y1 / 100
    return (sum(c / (1 + r) ** t for t in range(1, m)) + 1 / (1 + r) ** (m - 1) + c - 1) * 100

to_aud = lambda r, y: ((1 + r / 100) * fx[y - 1] / fx[y] - 1) * 100
for y in range(1970, max(fx) + 1):
    k = str(y)
    if y in msci: A['INTL_SHARES'][k] = round(to_aud(msci[y], y), 2)
    if y in sp:   A['US_SHARES'][k] = round(to_aud(sp[y], y), 2)
    if y < 1990 and y in au10 and y - 1 in au10: A['AU_BONDS'][k] = round(par_bond(au10[y - 1], au10[y]), 2)
    if y in us10 and y - 1 in us10 and k in A['CASH']:
        A['GLOBAL_BONDS'][k] = round(A['CASH'][k] + par_bond(us10[y - 1], us10[y]) - bill[y], 2)
# US-dollar series for the "Trinity" control portfolio (US stocks/bonds measured with US inflation)
tb = {int(y): x for y, x in S['us_tbond10_tr_usd']['values'].items()}
A['US_SHARES_USD'] = {str(y): sp[y] for y in sorted(sp)}
A['US_TBOND_USD'] = {str(y): tb[y] for y in sorted(tb)}
json.dump(d, open(ETF, 'w'), indent=2)
print('updated', ETF)
