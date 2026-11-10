#!/usr/bin/env python3
"""
update_qf_network.py — refresh the Qantas route network (Australian domestic +
trans-Tasman) used by the Status Credits planner (_data/qf_network.json).

Source: FlightsFrom.com's per-airport Qantas route pages (the route data is
embedded as JSON in the page). If the site can't be reached, or returns far
fewer routes than before (e.g. a layout change), the existing file is kept.
"""
import json, re, sys
from datetime import date
from pathlib import Path

try:
    import requests
except ImportError:
    print("requests not installed — skipping"); sys.exit(0)

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "_data" / "qf_network.json"
AIRPORTS = ['SYD', 'MEL', 'BNE', 'ADL', 'PER', 'CBR', 'OOL', 'NTL', 'HBA', 'LST',
            'MKY', 'ROK', 'TSV', 'CNS', 'DRW']
NZ = ['AKL', 'WLG', 'CHC', 'ZQN']          # trans-Tasman: Qantas flies these to/from Australia only
PAT = re.compile(r'"miles":(\d+),"domestic":(?:true|false),"airport":\{.*?"IATA":"([A-Z]{3})"', re.S)
UA = {"User-Agent": "Mozilla/5.0 (compatible; felixillion-site-bot; +https://felixillion.github.io)"}

def main():
    old = json.load(open(OUT))
    edges = {}
    for a in AIRPORTS + NZ:
        try:
            html = requests.get(f"https://www.flightsfrom.com/{a}/QF", headers=UA, timeout=30).text
        except Exception as e:
            print(f"  {a}: fetch failed ({e})"); continue
        found = {(b, int(mi)) for mi, b in PAT.findall(html)
                 if b != a and (b in AIRPORTS or (b in NZ and a in AIRPORTS) or (a in NZ and b in AIRPORTS))}
        print(f"  {a}: {len(found)} QF routes to Australia/NZ")
        for b, mi in found:
            edges['-'.join(sorted([a, b]))] = mi
    if len(edges) < 0.8 * len(old['routes']):
        print(f"Only {len(edges)} routes found (had {len(old['routes'])}) — keeping existing file")
        return
    routes = []
    for k, v in sorted(edges.items()):
        r = {"a": k[:3], "b": k[4:], "miles": v}
        if r["a"] in NZ or r["b"] in NZ: r["intl"] = True
        routes.append(r)
    if routes == old['routes']:
        print("No network changes"); return
    old.update(routes=routes, updated=str(date.today()), airports=AIRPORTS + NZ, nz_airports=NZ)
    json.dump(old, open(OUT, 'w'), indent=1)
    print(f"Updated network: {len(routes)} routes")

if __name__ == '__main__':
    main()
