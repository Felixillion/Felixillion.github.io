#!/usr/bin/env python3
"""
fetch_explore.py — ballpark Qantas return fares for the Status Credits planner's "Where to go" tab.

Source: Google Travel Explore, via SerpApi (https://serpapi.com/google-travel-explore-api).
One search returns the cheapest Qantas return fare to every destination in an area (e.g. all of
Australia) for a whole month, with Google's suggested best dates. So a full refresh is small:
    origins × areas × months × cabins   (default 1 × 2 × 6 × 2 = 24 searches)
Run weekly that's ~105 searches a month — well inside SerpApi's free 250.

Needs a SerpApi key in SERPAPI_KEY (a GitHub Actions secret). Without one it does nothing and the
page shows a link to Google Flights Explore instead.

Writes:
  _data/explore_snapshot.json — the latest results (what the page shows)
  _data/explore_history.json  — a compact running history of prices, used to judge whether a
                                fare is below or above what's usual (builds up over the weeks)
  explore_debug/              — the first raw response, uploaded as a workflow artifact for checking
"""
import json, os, sys, time
from datetime import date
from pathlib import Path

try:
    import requests
except ImportError:
    print("requests not installed — skipping"); sys.exit(0)

ROOT = Path(__file__).resolve().parents[3]
CFG = ROOT / "_data" / "fare_watch.json"
OUT = ROOT / "_data" / "explore_snapshot.json"
HIST = ROOT / "_data" / "explore_history.json"
DEBUG = ROOT / "explore_debug"
API = "https://serpapi.com/search.json"
CABINS = {"economy": 1, "business": 3}


def months_ahead(n):
    """The current month and the next n-1 (Google Explore only covers the next 6 months)."""
    t = date.today()
    return [((t.month - 1 + i) % 12 + 1, t.year + (t.month - 1 + i) // 12) for i in range(n)]


def parse(res):
    out = []
    for d in res.get("destinations") or []:
        code = (d.get("destination_airport") or {}).get("code")
        price = d.get("flight_price")
        if not code or not isinstance(price, (int, float)):
            continue
        airline = d.get("airline") or ""
        out.append({
            "code": code, "name": d.get("name"), "price": price,
            "stops": d.get("number_of_stops"), "minutes": d.get("flight_duration"),
            "start": d.get("start_date"), "end": d.get("end_date"),
            "airline": airline, "qantas": airline.strip().lower() == "qantas",
        })
    return sorted(out, key=lambda x: x["price"])


def main():
    key = os.environ.get("SERPAPI_KEY", "").strip()
    if not key:
        print("SERPAPI_KEY not set — skipping"); return
    cfg = json.load(open(CFG))
    months = months_ahead(cfg.get("months", 6))
    jobs = [(o, area, m, y, c)
            for o in cfg["origins"]
            for area in cfg["areas"]
            for (m, y) in months
            for c in cfg.get("cabins", ["economy", "business"])]
    cap = cfg.get("max_searches_per_run", 40)
    if len(jobs) > cap:
        print(f"{len(jobs)} searches configured; cap is {cap} — running the first {cap}")
        jobs = jobs[:cap]
    results, fails = [], 0
    for n, (o, area, m, y, c) in enumerate(jobs, 1):
        params = {
            "engine": "google_travel_explore", "api_key": key,
            "departure_id": o, "arrival_area_id": cfg["areas"][area],
            "type": 1, "month": m, "travel_duration": cfg.get("travel_duration", 2),
            "travel_class": CABINS[c], "include_airlines": "QF", "stops": cfg.get("stops", 0),
            "currency": "AUD", "gl": "au", "hl": "en",
        }
        try:
            r = requests.get(API, params=params, timeout=90)
            r.raise_for_status()
            res = r.json()
            if res.get("error"):
                raise RuntimeError(res["error"])
            if n == 1:
                DEBUG.mkdir(exist_ok=True)
                json.dump(res, open(DEBUG / "first_response.json", "w"), indent=1)
            dests = parse(res)
            results.append({"from": o, "area": area, "month": f"{y}-{m:02d}", "cabin": c, "destinations": dests})
            print(f"[{n}/{len(jobs)}] {o} → {area}, {y}-{m:02d}, {c}: {len(dests)} destinations"
                  + (f", cheapest {dests[0]['code']} ${dests[0]['price']}" if dests else ""))
        except Exception as e:
            fails += 1
            print(f"[{n}/{len(jobs)}] {o} → {area}, {y}-{m:02d}, {c}: failed ({e})")
            if fails >= 4 and fails > n / 2:
                print("Too many failures — stopping (quota used up or key invalid?)"); break
        time.sleep(cfg.get("seconds_between_searches", 10))
    if not any(r["destinations"] for r in results):
        print("No results — keeping the previous snapshot"); return
    today = date.today().isoformat()
    json.dump({
        "_source": "Google Travel Explore via SerpApi: cheapest Qantas-marketed return fare per destination "
                   "for each month (Google's suggested dates). Ballpark only — fares change constantly.",
        "taken": today,
        "trip_length": {1: "weekend", 2: "about a week", 3: "about two weeks"}.get(cfg.get("travel_duration", 2)),
        "results": results,
    }, open(OUT, "w"), indent=1)
    # running history: one compact row per (search, destination); keep ~1 year
    hist = json.load(open(HIST)) if HIST.exists() else {"rows": []}
    for r in results:
        for d in r["destinations"]:
            hist["rows"].append([today, r["from"], r["month"], r["cabin"], d["code"], d["price"]])
    cutoff = date.fromordinal(date.today().toordinal() - 370).isoformat()
    hist["rows"] = [x for x in hist["rows"] if x[0] >= cutoff]
    hist["_fields"] = ["taken", "from", "month", "cabin", "dest", "price"]
    json.dump(hist, open(HIST, "w"), separators=(",", ":"))
    print(f"Wrote {OUT.name} ({len(results)} searches, {fails} failed) and {len(hist['rows'])} history rows")


if __name__ == "__main__":
    main()
