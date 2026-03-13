#!/usr/bin/env python3
"""
update_billionaire_data.py
──────────────────────────
GitHub Actions script that updates _data/billionaires.json with:
  • Live ASX / NASDAQ prices for billionaires with listed equity (wealth_auto_update: true)
  • ABS median salary (quarterly Employee Earnings release)
  • AEC political donation totals (annual, ~February)
  • Budget-paper figures for NHMRC / ARC / MRFF (annual, ~May)
  • Fossil fuel subsidy figure (Australia Institute, annual ~March)

Run schedule (suggested):
  • Daily:   stock price updates
  • Monthly: ABS wage check, AEC donation check
  • Manual:  AFR Rich List numbers (paywalled — update billionaires.json by hand each May)

Usage: python .github/workflows/scripts/update_billionaire_data.py
Writes: _data/billionaires.json  (committed by GHA)
"""

import json
import os
import re
import sys
import time
from datetime import date, datetime
from pathlib import Path

# ── Dependencies: yfinance (already in requirements.txt), requests ──────────
try:
    import yfinance as yf
except ImportError:
    print("yfinance not installed — skipping stock updates")
    yf = None

try:
    import requests
except ImportError:
    print("requests not installed — skipping web fetches")
    requests = None

# ── Path setup ───────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parents[3]   # scripts/ → workflows/ → .github/ → repo root
DATA_FILE  = REPO_ROOT / "_data" / "billionaires.json"

def load_data():
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)
    print(f"✓ Saved {DATA_FILE}")

def today_str():
    return date.today().isoformat()

# ── 1. Update listed-equity wealth estimates ─────────────────────────────────
# For each billionaire with wealth_auto_update=true, fetch the current stock
# price and compute an estimated total wealth.
#   estimated_wealth_B = (shares_held × price_AUD) / 1e9  ÷ equity_pct × 100
# equity_pct is the first asset entry's pct field (e.g. 90 for Atlassian).

AUD_USD_TICKER = "AUDUSD=X"   # forex rate for NASDAQ → AUD conversion

def fetch_aud_usd():
    if not yf:
        return 0.65   # fallback
    try:
        rate = yf.Ticker(AUD_USD_TICKER).fast_info.get("last_price") or 0.65
        return float(rate)
    except Exception as e:
        print(f"  AUD/USD fetch failed: {e}")
        return 0.65

def update_listed_wealth(data):
    aud_usd = fetch_aud_usd()
    print(f"  AUD/USD rate: {aud_usd:.4f}")
    changed = False
    for b in data["billionaires"]:
        if not b.get("wealth_auto_update"):
            continue
        ticker_raw = b.get("wealth_ticker", "")
        shares     = b.get("wealth_shares_held", 0)
        exchange   = b.get("wealth_ticker_exchange", "ASX")
        equity_pct = b["assets"][0]["pct"] / 100.0  # fraction of wealth in this stock

        if not ticker_raw or not shares or not yf:
            continue

        ticker = ticker_raw if ticker_raw.endswith(".AX") else ticker_raw
        try:
            info   = yf.Ticker(ticker).fast_info
            price  = float(info.get("last_price") or 0)
            if price <= 0:
                print(f"  {ticker}: price = 0, skipping")
                continue

            # Convert NASDAQ prices (USD) to AUD
            if exchange == "NASDAQ":
                price = price / aud_usd

            equity_value_B = (shares * price) / 1e9
            total_wealth_B = round(equity_value_B / equity_pct, 2)

            old = b["wealth"]
            b["wealth"] = total_wealth_B
            b["wealth_as_of"] = today_str()
            b["wealth_price_used"] = round(price, 2)
            print(f"  {b['name']}: ${old}B → ${total_wealth_B}B  ({ticker} @ A${price:.2f})")
            changed = True
        except Exception as e:
            print(f"  {ticker} fetch failed: {e}")

    return changed

# ── 2. ABS Median Salary ─────────────────────────────────────────────────────
# ABS Employee Earnings is released ~quarterly.  We parse the ABS API for the
# latest seasonally-adjusted median weekly ordinary earnings (full time adults)
# and annualise it (× 52).
# Endpoint: https://api.data.abs.gov.au/data/EEH/...
# If fetch fails we leave the existing value unchanged.

ABS_EEH_URL = (
    "https://api.data.abs.gov.au/data/ABS,EEH,1.0.0/"
    "M1.3.10.AUS.Q"   # Median weekly ordinary earnings, FT adults, Australia, quarterly
    "?detail=Full&startPeriod=2020-Q1&format=jsondata"
)

def update_abs_salary(data):
    if not requests:
        return False
    try:
        r = requests.get(ABS_EEH_URL, timeout=15)
        r.raise_for_status()
        j = r.json()
        # Navigate to the most recent observation
        obs = j["data"]["dataSets"][0]["series"]
        series_key = list(obs.keys())[0]
        observations = obs[series_key]["observations"]
        # observations is a dict keyed by index string; get the last (most recent)
        last_idx = max(observations.keys(), key=int)
        weekly = float(observations[last_idx][0])
        annual = round(weekly * 52)
        old = data["_stats"]["abs_median_salary"]
        data["_stats"]["abs_median_salary"] = annual
        data["_stats"]["abs_median_salary_updated"] = today_str()
        print(f"  ABS median salary: ${old:,} → ${annual:,}/yr  (weekly ${weekly:.0f})")
        return True
    except Exception as e:
        print(f"  ABS salary fetch failed: {e} — keeping ${data['_stats']['abs_median_salary']:,}")
        return False

# ── 3. NHMRC / ARC / MRFF Budget Figures ─────────────────────────────────────
# Budget papers are released each May.  We check the NHMRC website for any
# updated budget figures in their news pages.
# This is a best-effort fetch; if it fails, the existing figure is kept.

def update_research_budgets(data):
    """Very light-touch: check NHMRC budget page for any announced figure."""
    if not requests:
        return False
    try:
        url = "https://www.nhmrc.gov.au/about-us/news-centre/budget"
        r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        # Look for patterns like "$940 million" or "$940M" in the page
        matches = re.findall(r"\$(\d[\d,]*)\s*(?:million|M)\b", r.text)
        if matches:
            # Take the first plausible value (100–2000 million range = likely NHMRC budget)
            for m in matches:
                val = int(m.replace(",", ""))
                if 100 <= val <= 2000:
                    old = data["_stats"]["nhmrc_budget_m"]
                    if val != old:
                        data["_stats"]["nhmrc_budget_m"] = val
                        data["_stats"]["nhmrc_budget_updated"] = today_str()
                        print(f"  NHMRC budget: ${old}M → ${val}M")
                        return True
    except Exception as e:
        print(f"  NHMRC budget fetch failed: {e}")
    return False

# ── 4. Fossil Fuel Subsidies (Australia Institute) ───────────────────────────
# The Australia Institute publishes an annual fossil fuel subsidy estimate
# (usually March).  We look for a press release mentioning the figure.

def update_fossil_fuel_subsidies(data):
    if not requests:
        return False
    try:
        url = "https://australiainstitute.org.au/report/fossil-fuel-subsidies-in-australia/"
        r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        # Look for "$X.X billion" or "$XX billion"
        matches = re.findall(r"\$(\d+\.?\d*)\s*billion", r.text, re.IGNORECASE)
        if matches:
            val = float(matches[0])
            if 5 <= val <= 50:   # sanity range
                old = data["_stats"]["fossil_fuel_subsidies_bn"]
                if abs(val - old) > 0.05:
                    data["_stats"]["fossil_fuel_subsidies_bn"] = val
                    data["_stats"]["fossil_fuel_subsidies_updated"] = today_str()
                    print(f"  Fossil fuel subsidies: ${old}B → ${val}B")
                    return True
    except Exception as e:
        print(f"  Fossil fuel subsidy fetch failed: {e}")
    return False

# ── 5. Stamp _meta with last_auto_update ────────────────────────────────────

def stamp_meta(data):
    data["_meta"]["last_auto_update"] = today_str()

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not DATA_FILE.exists():
        print(f"ERROR: {DATA_FILE} not found — cannot proceed")
        sys.exit(1)

    print(f"Loading {DATA_FILE}...")
    data = load_data()

    changed = False
    print("\n── Stock prices ────────────────────────────────────────────────")
    changed |= update_listed_wealth(data)

    print("\n── ABS salary ──────────────────────────────────────────────────")
    changed |= update_abs_salary(data)

    print("\n── NHMRC budget ────────────────────────────────────────────────")
    changed |= update_research_budgets(data)

    print("\n── Fossil fuel subsidies ───────────────────────────────────────")
    changed |= update_fossil_fuel_subsidies(data)

    stamp_meta(data)
    save_data(data)
    print(f"\n{'Changes detected — file updated.' if changed else 'No numeric changes — timestamps updated.'}")

if __name__ == "__main__":
    main()
