#!/usr/bin/env python3
"""
fetch_prices.py — weekly price history for every ticker in data/universe.json (ETF Tools page).

For each ASX code it downloads the full daily history from Yahoo Finance (via yfinance) and writes
data/prices/<CODE>.json with WEEKLY data (Friday closes):
    p  closing price (split-adjusted, NOT dividend-adjusted) — what you'd see on the ASX
    x  total-return index (dividends reinvested at the ex-date close), built here from the price and the
       cash distributions rather than taken from Yahoo's "Adj Close", which is wrong for some funds/LICs
    d  cash distributions per unit, by ex-date (needed for "DRP off" and for income tracking)
Plus data/prices/index.json (search list + headline returns) and data/prices/_quality.json (what the
sanity checks found).

Usage:
    python fetch_prices.py                 # everything in the universe (+ 'requested')
    python fetch_prices.py --only VAS NDQ  # just these (used by the ticker-request workflow)
"""
import argparse, json, math, sys, time
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
UNIVERSE = ROOT / 'data' / 'universe.json'
OUT = ROOT / 'data' / 'prices'
CHUNK = 40

# ── sanity-check thresholds ───────────────────────────────────────────────
SPIKE = 0.40          # a one-day move of >40% that reverses within 3 days is treated as a bad tick
MAX_DIV = 0.50        # a single distribution > 50% of the price is treated as a data error
FLAG_DIV = 0.15       # >15% is kept but flagged (special distributions / capital returns do happen)


def sig(v, n=6):
    """Round to n significant figures (keeps files small without losing precision)."""
    if v is None or not math.isfinite(v) or v == 0:
        return 0
    return round(v, n - 1 - int(math.floor(math.log10(abs(v)))))


def clean_daily(rows, issues):
    """rows: list of [date, close, div] sorted by date. Removes bad ticks and bad distributions."""
    rows = [r for r in rows if r[1] and math.isfinite(r[1]) and r[1] > 0]
    # bad ticks: big jump that reverses within 3 trading days (e.g. a price reported in cents for one day)
    i = 1
    while i < len(rows) - 1:
        prev, cur = rows[i - 1][1], rows[i][1]
        jump = cur / prev - 1
        if abs(jump) > SPIKE:
            for k in range(i + 1, min(i + 4, len(rows))):
                if abs(rows[k][1] / prev - 1) < SPIKE / 3:      # came back to around the old level
                    for j in range(i, k):
                        issues.append(f"bad tick {rows[j][0]} {rows[j][1]:.4g} (prev {prev:.4g}) replaced")
                        rows[j][1] = prev
                    break
        i += 1
    for r in rows:
        if r[2]:
            base = r[1]
            if r[2] / base > MAX_DIV:
                issues.append(f"distribution {r[0]} {r[2]:.4g} is {r[2]/base:.0%} of price — dropped as a data error")
                r[2] = 0.0
            elif r[2] / base > FLAG_DIV:
                issues.append(f"large distribution {r[0]} {r[2]:.4g} ({r[2]/base:.0%} of price) — kept, please check")
    return rows


def build(code, rows, meta, adj_annual):
    """Turn cleaned daily rows into the weekly record + quality notes."""
    issues = []
    rows = clean_daily(rows, issues)
    if len(rows) < 10:
        return None, issues + ['too little data']
    # total-return index on daily data: dividends reinvested at the ex-date close
    tr = [1.0]
    for i in range(1, len(rows)):
        tr.append(tr[-1] * (rows[i][1] + rows[i][2]) / rows[i - 1][1])
    # weekly: last trading day of each week (Mon–Fri), keyed to that week's Friday
    weeks = {}
    for (d, c, _), t in zip(rows, tr):
        dt = date.fromisoformat(d)
        fri = dt + timedelta(days=(4 - dt.weekday()) % 7)
        weeks[fri] = (c, t)
    fridays = sorted(weeks)
    start, end = fridays[0], fridays[-1]
    p, x, last = [], [], None
    f = start
    while f <= end:                       # forward-fill weeks with no trading (suspensions, holidays)
        last = weeks.get(f, last)
        p.append(sig(last[0], 6))
        x.append(sig(last[1] / tr[0] * 100, 6))
        f += timedelta(days=7)
    divs = [[r[0], sig(r[2], 6)] for r in rows if r[2]]
    # compare our calendar-year total returns with Yahoo's Adj Close version (info only)
    ours = annual_from_daily(rows, tr)
    diffs = {y: round(ours[y] - adj_annual[y], 1) for y in ours if y in adj_annual and abs(ours[y] - adj_annual[y]) > 1.5}
    if diffs:
        issues.append(f"differs from Yahoo adjusted close by >1.5 pts in {len(diffs)} year(s): {diffs}")
    rec = {'c': code, 'n': meta.get('name') or code, 't': meta.get('type', ''), 'r': meta.get('region', ''),
           's': start.isoformat(), 'u': date.today().isoformat(), 'p': p, 'x': x, 'd': divs}
    return rec, issues


def annual_from_daily(rows, tr):
    ye = {}
    for (d, _, _), t in zip(rows, tr):
        ye[int(d[:4])] = t
    return {y: (ye[y] / ye[y - 1] - 1) * 100 for y in ye if y - 1 in ye and y < date.today().year}


def summary(rec):
    """Headline numbers for the search list: last price, trailing yield, annualised total returns."""
    x, p = rec['x'], rec['p']
    n = len(x)
    def ann(years):
        w = int(round(years * 52.1775))
        if n <= w:
            return None
        return round(((x[-1] / x[-1 - w]) ** (1 / years) - 1) * 100, 1)
    last = date.fromisoformat(rec['s']) + timedelta(days=7 * (n - 1))
    cutoff = (last - timedelta(days=365)).isoformat()
    yld = sum(a for d, a in rec['d'] if d > cutoff) / p[-1] * 100 if p[-1] else 0
    return {'c': rec['c'], 'n': rec['n'], 't': rec['t'], 'r': rec['r'], 's': rec['s'], 'e': last.isoformat(),
            'l': p[-1], 'y': round(yld, 1), 'r1': ann(1), 'r3': ann(3), 'r5': ann(5), 'r10': ann(10)}


def download(codes):
    import yfinance as yf
    out = {}
    for i in range(0, len(codes), CHUNK):
        chunk = codes[i:i + CHUNK]
        syms = [c + '.AX' for c in chunk]
        print(f"  downloading {i + 1}–{i + len(chunk)} of {len(codes)}", flush=True)
        try:
            df = yf.download(syms, period='max', interval='1d', auto_adjust=False, actions=True,
                             group_by='ticker', threads=True, progress=False)
        except Exception as e:
            print(f"    chunk failed: {e}")
            continue
        for c, s in zip(chunk, syms):
            try:
                sub = df[s] if getattr(df.columns, 'nlevels', 1) > 1 else df
                sub = sub.dropna(subset=['Close'])
                if sub.empty:
                    continue
                idx = [d.date().isoformat() for d in sub.index]
                close = sub['Close'].astype(float).tolist()
                adj = sub['Adj Close'].astype(float).tolist() if 'Adj Close' in sub else None
                div = sub['Dividends'].fillna(0).astype(float).tolist() if 'Dividends' in sub else [0.0] * len(idx)
                out[c] = {'rows': [[d, cl, dv] for d, cl, dv in zip(idx, close, div)], 'adj': adj, 'dates': idx}
            except Exception as e:
                print(f"    {c}: {e}")
        time.sleep(2)
    return out


def names_for(codes, known):
    """Fund/company names from Yahoo, only for codes we don't already have a name for."""
    import yfinance as yf
    out = {}
    for c in codes:
        if known.get(c):
            out[c] = known[c]; continue
        try:
            info = yf.Ticker(c + '.AX').info or {}
            out[c] = info.get('longName') or info.get('shortName') or c
        except Exception:
            out[c] = c
        time.sleep(0.4)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*')
    args = ap.parse_args()
    uni = json.load(open(UNIVERSE))
    tickers = dict(uni['tickers'])
    for c in uni.get('requested', []):
        tickers.setdefault(c, {'type': '', 'region': ''})
    codes = sorted(args.only) if args.only else sorted(tickers)
    OUT.mkdir(parents=True, exist_ok=True)
    idx_path, q_path = OUT / 'index.json', OUT / '_quality.json'
    old_idx = {r['c']: r for r in json.load(open(idx_path))['tickers']} if idx_path.exists() else {}
    quality = json.load(open(q_path)) if q_path.exists() else {}
    print(f"Fetching {len(codes)} tickers")
    raw = download(codes)
    names = names_for([c for c in codes if c in raw], {c: r.get('n') for c, r in old_idx.items() if r.get('n') != c})
    ok = 0
    for c in codes:
        if c not in raw:
            quality[c] = ['no data from Yahoo — delisted, renamed or not on Yahoo']
            continue
        r = raw[c]
        adj_annual = {}
        if r['adj']:
            ye = {}
            for d, a in zip(r['dates'], r['adj']):
                if a and math.isfinite(a):
                    ye[int(d[:4])] = a
            adj_annual = {y: (ye[y] / ye[y - 1] - 1) * 100 for y in ye if y - 1 in ye and y < date.today().year}
        meta = dict(tickers.get(c, {}), name=names.get(c, c))
        rec, issues = build(c, r['rows'], meta, adj_annual)
        if rec is None:
            quality[c] = issues
            continue
        json.dump(rec, open(OUT / f'{c}.json', 'w'), separators=(',', ':'))
        old_idx[c] = summary(rec)
        quality[c] = issues
        ok += 1
    json.dump({'updated': date.today().isoformat(), 'count': len(old_idx),
               'tickers': sorted(old_idx.values(), key=lambda r: r['c'])},
              open(idx_path, 'w'), separators=(',', ':'))
    json.dump(dict(sorted(quality.items())), open(q_path, 'w'), indent=1)
    flagged = sum(1 for v in quality.values() if v)
    print(f"Wrote {ok} of {len(codes)} tickers; {flagged} have notes in _quality.json")
    if ok == 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
