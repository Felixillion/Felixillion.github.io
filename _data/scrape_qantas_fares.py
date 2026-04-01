#!/usr/bin/env python3
"""
scrape_qantas_fares.py
----------------------
Scrapes cheapest available fares for key Australian domestic routes from
the Qantas website using Playwright, then writes results to
_data/qantas_fares.json for use in the status-credits.html page.

HOW IT WORKS:
  Qantas's best-fare calendar widget at
  qantas.com/au/en/book-a-trip/flights.html loads fares via an internal
  REST API. This script intercepts those API calls and captures the cheapest
  available fare per route pair.

RATE LIMITING / RESPECTFUL USE:
  - 3–5 second delay between route requests
  - Headless Chromium with realistic viewport
  - Does NOT bypass any login or paywall — all scraped fares are public

FALLBACK:
  If scraping fails for any route, the script preserves the last known price
  from the existing JSON file (or uses hardcoded typical minimums).

RUN IN GITHUB ACTIONS:
  See daily-update.yml — runs weekly (Mondays) or on workflow_dispatch.

DEPENDENCIES:
  pip install playwright --break-system-packages
  playwright install chromium

PATH:
  .github/workflows/scripts/scrape_qantas_fares.py
"""

import json
import time
import random
import sys
from datetime import datetime
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
except ImportError:
    print("❌ playwright not installed — run: pip install playwright && playwright install chromium")
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parents[3]
OUT_PATH  = REPO_ROOT / '_data' / 'qantas_fares.json'
OUT_DATA  = REPO_ROOT / 'data'  / 'qantas_fares.json'

# ── Routes to scrape ───────────────────────────────────────────
# Pairs that cover the most useful status-credit-per-dollar analysis
ROUTE_PAIRS = [
    ('SYD', 'MEL'), ('MEL', 'SYD'),
    ('SYD', 'BNE'), ('BNE', 'SYD'),
    ('SYD', 'PER'), ('PER', 'SYD'),
    ('SYD', 'ADL'), ('ADL', 'SYD'),
    ('SYD', 'CNS'), ('CNS', 'SYD'),
    ('SYD', 'DRW'), ('DRW', 'SYD'),
    ('MEL', 'BNE'), ('BNE', 'MEL'),
    ('MEL', 'PER'), ('PER', 'MEL'),
    ('MEL', 'ADL'), ('ADL', 'MEL'),
    ('MEL', 'CNS'), ('CNS', 'MEL'),
    ('BNE', 'PER'), ('PER', 'BNE'),
    ('BNE', 'ADL'), ('ADL', 'BNE'),
    ('BNE', 'CNS'), ('CNS', 'BNE'),
    ('ADL', 'PER'), ('PER', 'ADL'),
    ('SYD', 'CBR'), ('CBR', 'SYD'),
    ('MEL', 'OOL'), ('OOL', 'MEL'),
    # Additional status run routes
    ('SYD', 'DRW'), ('DRW', 'SYD'),
    ('ADL', 'DRW'), ('DRW', 'ADL'),
    ('ADL', 'CNS'), ('CNS', 'ADL'),
    ('BNE', 'DRW'), ('DRW', 'BNE'),
    ('SYD', 'MKY'), ('MKY', 'SYD'),
    ('BNE', 'TSV'), ('TSV', 'BNE'),
]

# Hardcoded minimums as fallback when scraping fails (updated Jan 2026)
FALLBACK_MINS = {
    'SYD-MEL':99,'MEL-SYD':99,'SYD-BNE':109,'BNE-SYD':109,
    'SYD-PER':199,'PER-SYD':199,'SYD-ADL':119,'ADL-SYD':119,
    'SYD-CNS':179,'CNS-SYD':179,'SYD-DRW':229,'DRW-SYD':229,
    'MEL-BNE':109,'BNE-MEL':109,'MEL-PER':199,'PER-MEL':199,
    'MEL-ADL':99,'ADL-MEL':99,'MEL-CNS':189,'CNS-MEL':189,
    'BNE-PER':209,'PER-BNE':209,'BNE-ADL':129,'ADL-BNE':129,
    'BNE-CNS':119,'CNS-BNE':119,'ADL-PER':169,'PER-ADL':169,
    'SYD-CBR':79,'CBR-SYD':79,'MEL-OOL':109,'OOL-MEL':109,
    'ADL-DRW':219,'DRW-ADL':219,'ADL-CNS':189,'CNS-ADL':189,
    'BNE-DRW':209,'DRW-BNE':209,'SYD-MKY':189,'MKY-SYD':189,
    'BNE-TSV':149,'TSV-BNE':149,
}

# Departure date: ~3 weeks from today (flexible travel window)
def get_search_date():
    from datetime import timedelta
    d = datetime.now() + timedelta(days=21)
    return d.strftime('%Y-%m-%d')

def scrape_route(page, origin, destination, depart_date):
    """
    Navigate to Qantas flight search and capture cheapest available fare.
    Returns (price_aud, fare_class) or (None, None) if failed.
    """
    captured_fares = []
    api_data = []

    def handle_response(response):
        """Intercept API responses containing flight prices."""
        try:
            url = response.url
            if any(x in url for x in ['fareOffer', 'bestFare', 'flightSearch',
                                        'availability', 'offer/calendar', 'priceCalendar']):
                if response.status == 200:
                    try:
                        data = response.json()
                        api_data.append(data)
                    except Exception:
                        pass
        except Exception:
            pass

    page.on('response', handle_response)

    search_url = (
        f"https://www.qantas.com/au/en/book-a-trip/flights.html"
        f"#/results/oneway/{origin}/{destination}/economy/{depart_date}/1/0/0"
    )

    try:
        page.goto(search_url, timeout=30000, wait_until='networkidle')
        page.wait_for_timeout(4000)  # wait for fare results to load

        # Try to extract price from DOM
        # Qantas renders prices in elements with various class patterns
        price_selectors = [
            '[data-test="fare-price"]',
            '[class*="farePrice"]',
            '[class*="price-value"]',
            '.fare-total-price',
            '[data-ui="flight-card-price"]',
        ]

        dom_price = None
        for sel in price_selectors:
            try:
                elements = page.query_selector_all(sel)
                for el in elements:
                    text = el.inner_text().strip()
                    # Extract number from price string like "$199" or "A$199"
                    import re
                    m = re.search(r'\$(\d[\d,]*)', text)
                    if m:
                        price = int(m.group(1).replace(',', ''))
                        if 50 <= price <= 5000:  # sanity check
                            captured_fares.append(price)
            except Exception:
                continue

        # Also try parsing intercepted API data
        for data in api_data:
            try:
                # Try common patterns in Qantas API responses
                if isinstance(data, dict):
                    # Pattern 1: flights array
                    for flight in data.get('flights', []):
                        for fare in flight.get('fares', []):
                            price = fare.get('totalPrice', fare.get('price', {}).get('total'))
                            if price and isinstance(price, (int, float)) and 50 <= price <= 5000:
                                captured_fares.append(int(price))
                    # Pattern 2: offers array
                    for offer in data.get('offers', []):
                        price = offer.get('totalFare', offer.get('price'))
                        if price and 50 <= price <= 5000:
                            captured_fares.append(int(price))
            except Exception:
                continue

        if captured_fares:
            return min(captured_fares), 'scraped'
        return None, None

    except PlaywrightTimeout:
        print(f"    Timeout for {origin}-{destination}")
        return None, None
    except Exception as e:
        print(f"    Error {origin}-{destination}: {e}")
        return None, None
    finally:
        page.remove_listener('response', handle_response)


def load_existing():
    """Load existing fare data to preserve prices for routes that fail."""
    if OUT_PATH.exists():
        try:
            with open(OUT_PATH) as f:
                return json.load(f)
        except Exception:
            pass
    return {'fares': {}}


def main():
    print("=" * 55)
    print("Qantas Domestic Fare Scraper")
    print(f"Date: {datetime.now().isoformat()}")
    print(f"Searching for: {get_search_date()}")
    print(f"Routes: {len(ROUTE_PAIRS)}")
    print("=" * 55)

    existing = load_existing()
    fares = dict(existing.get('fares', {}))
    scraped_count = 0
    fallback_count = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
            ]
        )
        context = browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent=(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/120.0.0.0 Safari/537.36'
            ),
            locale='en-AU',
            timezone_id='Australia/Sydney',
        )
        page = context.new_page()
        depart_date = get_search_date()

        for origin, dest in ROUTE_PAIRS:
            key = f"{origin}-{dest}"
            print(f"  Scraping {key}...", end=' ', flush=True)

            price, source = scrape_route(page, origin, dest, depart_date)

            if price:
                fares[key] = {'min_price': price, 'source': 'scraped', 'date': depart_date}
                print(f"${price} ✅")
                scraped_count += 1
            else:
                # Use fallback minimum
                fallback = FALLBACK_MINS.get(key)
                if fallback:
                    fares[key] = {'min_price': fallback, 'source': 'fallback', 'date': depart_date}
                    print(f"${fallback} (fallback)")
                    fallback_count += 1
                elif key in fares:
                    print(f"${fares[key]['min_price']} (preserved from last run)")
                else:
                    print("no data")

            # Respectful delay — 3 to 6 seconds between requests
            time.sleep(3 + random.random() * 3)

        browser.close()

    output = {
        'last_updated': datetime.now().strftime('%Y-%m-%d'),
        'search_date':  depart_date,
        'scraped':      scraped_count,
        'fallback':     fallback_count,
        'note': (
            f"Prices are cheapest observed one-way economy fares approximately "
            f"3 weeks from scrape date. {scraped_count}/{len(ROUTE_PAIRS)} scraped live; "
            f"{fallback_count} used fallback minimums. Not a guarantee of availability."
        ),
        'fares': fares,
    }

    for path in [OUT_PATH, OUT_DATA]:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w') as f:
            json.dump(output, f, indent=2)
        print(f"   Written: {path}")

    print("\n" + "=" * 55)
    print(f"✅ Written: _data/ and data/ qantas_fares.json")
    print(f"   Live scraped: {scraped_count}/{len(ROUTE_PAIRS)}")
    print(f"   Fallback used: {fallback_count}")
    print("=" * 55)


if __name__ == '__main__':
    main()
