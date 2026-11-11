#!/usr/bin/env python3
"""
update_etf_data.py — keeps data/etf_data.json current, using the weekly price files.

Runs after fetch_prices.py (see .github/workflows/weekly-prices.yml). No internet needed.
  * Adds any newly COMPLETED calendar year to assetClassReturns (used by the AU Investing
    withdrawal-rate tool), from ETF total returns built in data/prices:
        AU_SHARES ← VAS, INTL_SHARES ← VGS, US_SHARES ← IVV, AU_BONDS ← VAF, GLOBAL_BONDS ← VBND
    Earlier years come from index data (data/ground_truth/build_asset_classes.py) and are never
    overwritten. ETF returns are after the fund's fee, so these new years are slightly
    conservative (by 0.04–0.2% a year).
  * Stamps meta.lastUpdated.
The curated fund details in etf_data.json (fees, sectors, top holdings) are edited by hand.
"""
import json
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ETF = ROOT / 'data' / 'etf_data.json'
PRICES = ROOT / 'data' / 'prices'
PROXIES = {'AU_SHARES': 'VAS', 'INTL_SHARES': 'VGS', 'US_SHARES': 'IVV',
           'AU_BONDS': 'VAF', 'GLOBAL_BONDS': 'VBND'}


def year_end_returns(code):
    """Calendar-year total returns (%) from a weekly price file, completed years only."""
    p = PRICES / f'{code}.json'
    if not p.exists():
        return {}
    r = json.load(open(p))
    start = date.fromisoformat(r['s'])
    ye = {}
    for i, x in enumerate(r['x']):
        ye[(start + timedelta(days=7 * i)).year] = x       # last week of each year wins
    this_year = date.today().year
    first = start.year
    return {y: round((ye[y] / ye[y - 1] - 1) * 100, 2) for y in ye
            if y - 1 in ye and y - 1 > first and y < this_year}   # skip the partial first year


def main():
    d = json.load(open(ETF))
    added = []
    for cls, code in PROXIES.items():
        series = d['assetClassReturns'].setdefault(cls, {})
        for y, v in year_end_returns(code).items():
            if str(y) not in series:
                series[str(y)] = v
                added.append(f'{cls} {y}={v}')
    d['meta']['lastUpdated'] = date.today().isoformat()
    d['meta']['partialYear'] = str(date.today().year)
    json.dump(d, open(ETF, 'w'), indent=2)
    print('Asset-class years added:', ', '.join(added) or 'none')


if __name__ == '__main__':
    main()
