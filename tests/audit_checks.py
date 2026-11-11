#!/usr/bin/env python3
"""
Site data audit — runs in GitHub Actions (data-audit.yml) and locally:
    pip install ephem && python tests/audit_checks.py
Checks the site's numbers against independent references in
data/ground_truth/reference_series.json, checks the astronomy against PyEphem,
and checks that every auto-updating dataset is actually fresh.
FAIL = wrong data (exit code 1).  WARN = needs a human look (exit code 0).
"""
import json, math, os, random, re, subprocess, sys
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
GT = json.load(open(P('data', 'ground_truth', 'reference_series.json')))
fails, warns, oks = [], [], []
def ok(m): oks.append(m)
def warn(m): warns.append(m)
def fail(m): fails.append(m)

try:
    from zoneinfo import ZoneInfo
    TODAY = datetime.now(ZoneInfo('Australia/Sydney')).date()
except Exception:
    TODAY = date.today()

def age_days(s):
    return (TODAY - date.fromisoformat(s[:10])).days

def js_object(src, name):
    m = re.search(r'const ' + name + r'\s*=\s*\{(.*?)\};', src, re.S)
    return dict((int(k), float(v)) for k, v in re.findall(r'(\d{4})\s*:\s*(-?[\d.]+)', m.group(1))) if m else {}

# ── 1. Freshness of auto-updated data ──────────────────────────────────────
astro = json.load(open(P('data', 'astrology_daily.json')))
a = age_days(astro['lastUpdated'])
(ok if a <= 1 else fail)(f"Cosmic Lab data is {a} day(s) old (lastUpdated {astro['lastUpdated']})")
etf = json.load(open(P('data', 'etf_data.json')))
a = age_days(etf['meta']['lastUpdated'])
(ok if a <= 8 else fail)(f"ETF data is {a} day(s) old (meta.lastUpdated {etf['meta']['lastUpdated']})")
pidx_path = P('data', 'prices', 'index.json')
if os.path.exists(pidx_path):
    pidx = json.load(open(pidx_path))
    a = age_days(pidx['updated'])
    (ok if a <= 9 else fail)(f"Weekly prices are {a} day(s) old ({pidx['count']} tickers)")
    q = json.load(open(P('data', 'prices', '_quality.json')))
    missing = [c for c, v in q.items() if v and v[0].startswith('no data')]
    if missing: warn(f"Prices: no Yahoo data for {len(missing)} code(s): {', '.join(missing[:15])}")
    noted = [c for c, v in q.items() if v and not v[0].startswith('no data')]
    if noted: warn(f"Prices: data-quality notes for {len(noted)} code(s) (see data/prices/_quality.json): {', '.join(noted[:15])}")
else:
    fail("data/prices/index.json missing — run the Weekly Price Update workflow")
ff = json.load(open(P('_data', 'ff_weekly.json')))
for scheme in ('qantas', 'velocity'):
    for c in ff[scheme]:
        v = c.get('verified')
        if not v: warn(f"FF: {c['bank']} {c['name']} has never been verified")
        elif age_days(v) > 60: warn(f"FF: {c['bank']} {c['name']} last verified {v} ({age_days(v)} days ago)")
pr_path = P('_data', 'promos.json')
if os.path.exists(pr_path):
    pr = json.load(open(pr_path))
    a = age_days(pr.get('updated', '2000-01-01'))
    (ok if a <= 3 else warn)(f"Promo/news watcher last updated {a} day(s) ago")
    for k, items in pr.get('card_flags', {}).items():
        warn(f"FF: {k.replace('|', ' ')} has been in the news since it was verified — re-check: {items[0]['title']} ({items[0]['link']})")
net_path = P('_data', 'qf_network.json')
if os.path.exists(net_path):
    net = json.load(open(net_path))
    edges = {tuple(sorted((r['a'], r['b']))) for r in net['routes']}
    sc_src = open(P('pages/status-credits.html')).read()
    listed = set(tuple(sorted(m)) for m in re.findall(r"\['([A-Z]{3})','([A-Z]{3})',\s*\d", sc_src))
    dom = set(net['airports'])
    fake = sorted(e for e in listed if e[0] in dom and e[1] in dom and e not in edges)
    (fail if fake else ok)(f"Status Credits: {len(fake)} domestic route(s) listed that Qantas doesn't fly {fake[:6] if fake else ''}")
    a = age_days(net.get('updated', '2000-01-01'))
    if a > 45: warn(f"Qantas route network last refreshed {a} days ago")
fs_path = P('_data', 'explore_snapshot.json')
if os.path.exists(fs_path):
    a = age_days(json.load(open(fs_path)).get('taken', '2000-01-01'))
    (ok if a <= 10 else warn)(f"Ballpark fares (Status Credits page) updated {a} day(s) ago")
bil = json.load(open(P('_data', 'billionaires.json')))
ed = int(bil['_meta']['edition'])
expected = TODAY.year if TODAY >= date(TODAY.year, 6, 15) else TODAY.year - 1
(ok if ed >= expected else warn)(f"Legacy uses AFR Rich List {ed} (latest expected: {expected})")
for k, v in bil.get('_proposed', {}).items():
    warn(f"Legacy: auto-scraper proposes {k} = {v.get('value')} (seen {v.get('seen')}, {v.get('url')}) — verify, then copy into _stats")
stale_people = [b['name'] for b in bil['billionaires'] if b.get('wealth_year', ed) < ed]
if stale_people: warn("Legacy: wealth not updated to the current edition for " + ', '.join(stale_people))

# ── 2. CPI tables vs RBA ────────────────────────────────────────────────────
ref = {int(k): v for k, v in GT['au_cpi_annual_avg']['values'].items()}
for path, name in (('assets/js/etf_tools.js', 'AU_CPI_YR'), ('pages/au-investing.html', 'AU_CPI')):
    tbl = js_object(open(P(path)).read(), name)
    bad = [(y, tbl.get(y), v) for y, v in ref.items() if y in tbl and abs(tbl[y] - v) > 0.15]
    missing = [y for y in ref if y not in tbl]
    if bad: fail(f"{path} {name}: {len(bad)} years differ from RBA CPI, e.g. {bad[:4]}")
    else: ok(f"{path} {name}: matches RBA CPI ({len(ref)} years)")
    if missing: warn(f"{path} {name}: missing CPI years {missing[:6]}{'…' if len(missing) > 6 else ''}")

# ── 3. Asset-class returns vs references ────────────────────────────────────
ac = etf['assetClassReturns']
xa = {int(k): v for k, v in GT['au_shares_xaoa']['values'].items()}
diffs = [(y, ac['AU_SHARES'].get(str(y)), v) for y, v in xa.items()
         if str(y) in ac['AU_SHARES'] and abs(ac['AU_SHARES'][str(y)] - v) > (2.5 if y >= 2009 else 0.6)]
(fail if diffs else ok)(f"AU_SHARES vs All Ords Accumulation: {len(diffs)} year(s) out of tolerance {diffs[:5] if diffs else ''}")
cash = {int(k): v for k, v in GT['au_cash_rate_annual_avg']['values'].items()}
diffs = [(y, ac['CASH'].get(str(y)), v) for y, v in cash.items() if str(y) in ac['CASH'] and abs(ac['CASH'][str(y)] - v) > 0.3]
(fail if diffs else ok)(f"CASH vs RBA cash rate: {len(diffs)} year(s) out of tolerance {diffs[:5] if diffs else ''}")
last_full = TODAY.year - 1
for k in ('AU_SHARES', 'INTL_SHARES', 'AU_BONDS'):
    if str(last_full) not in ac[k]: warn(f"assetClassReturns.{k} has no {last_full} value yet")
# VAS total returns built by fetch_prices.py should track the All Ords Accumulation index (ASX 300 vs All Ords, minus 0.07% fee)
vas_p = P('data', 'prices', 'VAS.json')
if os.path.exists(vas_p):
    from datetime import date as _d, timedelta as _td
    r = json.load(open(vas_p)); st = _d.fromisoformat(r['s']); ye = {}
    for i, x in enumerate(r['x']): ye[(st + _td(days=7 * i)).year] = x
    xao = {int(k): v for k, v in GT['au_shares_xaoa']['values'].items()}
    off = [(y, round((ye[y] / ye[y - 1] - 1) * 100, 1), xao[y]) for y in ye if y - 1 in ye and y - 1 > st.year and y in xao and abs((ye[y] / ye[y - 1] - 1) * 100 - xao[y]) > 2.5]
    (fail if off else ok)(f"VAS weekly total returns vs All Ords Accumulation: {len(off)} year(s) off by >2.5 pts {off[:4] if off else ''}")

# ── 4. Tax rates ────────────────────────────────────────────────────────────
fy = f"{TODAY.year}-{str(TODAY.year + 1)[2:]}" if TODAY.month >= 7 else f"{TODAY.year - 1}-{str(TODAY.year)[2:]}"
rates = GT['au_resident_tax_rates'].get(fy)
src = open(P('pages/au-investing.html')).read()
m = re.search(r"ind_16:\s*\{\s*rate:\s*([\d.]+)", src)
if rates and m:
    want = rates['18201-45000']
    (ok if abs(float(m.group(1)) - want) < 1e-9 else fail)(f"Tax: second bracket in AU Investing = {m.group(1)}, ATO {fy} = {want}")
elif not rates:
    warn(f"No reference tax rates for FY {fy} — add them to reference_series.json")

# ── 5. Qantas Status Credits table ──────────────────────────────────────────
sc = open(P('pages/status-credits.html')).read()
q = GT['qantas_status_credits']
if 'SC_TABLE' not in sc:
    fail("status-credits.html has no SC_TABLE — Status Credits are not computed from the official Qantas table")
for tbl in (('dom', 'intl') if 'SC_TABLE' in sc else ()):
    blk = re.search(tbl + r':\s*\{(.*?)\}', sc, re.S).group(1)
    for k, arr in re.findall(r'(\w+):\[([\d,]+)\]', blk):
        refarr = q['domestic' if tbl == 'dom' else 'intl'].get(k)
        if refarr and [int(x) for x in arr.split(',')] != refarr:
            fail(f"Status credits {tbl}.{k} = [{arr}] but Qantas table = {refarr}")
tiers = dict(re.findall(r"name:'(Silver|Gold|Platinum|Platinum One)',\s*sc:(\d+)", sc))
for t, v in q['tiers_earn'].items():
    if t in tiers and int(tiers[t]) != v: fail(f"Status tier {t} = {tiers[t]} SC, Qantas = {v}")
for k, arr in re.findall(r"'([A-Z0-9]+-[A-Z]+)':\s*\[([\d,]+)\]", sc):
    ref = q.get('route_specific', {}).get(k)
    if ref and [int(x) for x in arr.split(',')] != ref:
        fail(f"Status credits route table {k} = [{arr}] but Qantas table = {ref}")
ok("Status credit tables checked against Qantas reference")
# Golden cases: run the page's own SC code against hand-checked answers
import shutil, subprocess
if shutil.which('node'):
    r = subprocess.run(['node', P('tests', 'sc_golden.js')], capture_output=True, text=True)
    for line in r.stdout.splitlines():
        if line.startswith('❌'): fail('Status credits golden case: ' + line[2:])
        elif line.startswith('⚠️'): warn('Status credits: ' + line[3:])
    if r.returncode == 0: ok("Status credits: golden route cases match Qantas tables")
    elif not any(l.startswith('❌') for l in r.stdout.splitlines()): fail("Status credits golden test crashed: " + (r.stderr or '')[-300:])

# ── 6. Astronomy vs PyEphem ─────────────────────────────────────────────────
try:
    import ephem
    rnd = random.Random(42)
    dates = [datetime(2000, 1, 1, tzinfo=timezone.utc) + timedelta(days=rnd.uniform(0, 365.25 * 50)) for _ in range(150)]
    js = ("const g=require(process.argv[1]);const ds=JSON.parse(process.argv[2]);"
          "console.log(JSON.stringify(ds.map(d=>g.planetaryLongitudes(new Date(d)))))")
    out = subprocess.run(['node', '-e', js, P('.github/workflows/scripts/generate_astrology_data.js'),
                          json.dumps([d.isoformat() for d in dates])], capture_output=True, text=True, check=True)
    ours = json.loads(out.stdout)
    bodies = dict(sun=ephem.Sun, moon=ephem.Moon, mercury=ephem.Mercury, venus=ephem.Venus, mars=ephem.Mars,
                  jupiter=ephem.Jupiter, saturn=ephem.Saturn, uranus=ephem.Uranus, neptune=ephem.Neptune)
    worst = {}
    for d, o in zip(dates, ours):
        ed = ephem.Date(d.strftime('%Y/%m/%d %H:%M:%S'))
        for n, cls in bodies.items():
            lon = math.degrees(ephem.Ecliptic(cls(ed), epoch=ed).lon)
            err = abs((o[n] - lon + 180) % 360 - 180)
            worst[n] = max(worst.get(n, 0), err)
    bad = {k: round(v, 2) for k, v in worst.items() if v > 0.5}
    (fail if bad else ok)(f"Planet positions vs PyEphem (150 dates 2000–2049): worst errors {({k: round(v, 2) for k, v in worst.items()})}")
except subprocess.CalledProcessError as e:
    fail("Could not load planetaryLongitudes() from generate_astrology_data.js: " + (e.stderr or '')[-200:])
except ImportError:
    warn("PyEphem not installed — astronomy check skipped (pip install ephem)")

# ── Report ──────────────────────────────────────────────────────────────────
lines = [f"# Site data audit — {TODAY}", ""]
lines += [f"- ❌ {m}" for m in fails] + [f"- ⚠️ {m}" for m in warns] + [f"- ✅ {m}" for m in oks]
report = "\n".join(lines)
print(report)
if os.environ.get('GITHUB_STEP_SUMMARY'):
    open(os.environ['GITHUB_STEP_SUMMARY'], 'a').write(report + "\n")
sys.exit(1 if fails else 0)
