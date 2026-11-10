#!/usr/bin/env python3
"""
promo_watch.py — free, automatic news watcher for the FF Points and Status
Credits pages. Writes _data/promos.json.

It reads the public RSS feeds of Australian frequent-flyer news sites and keeps
(headline, link, date, source) for:
  • Qantas Status Credit promotions (double / triple / bonus SC), and
  • credit-card points offers,
and flags any card on the FF page that has been in the news since its offer
was last verified, so you know exactly which card to re-check.

Only headlines + links are stored (no article text). Nothing on the site is
changed automatically except this news list and the "check this card" flags.
"""
import json, re, sys
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
import xml.etree.ElementTree as ET

try:
    import requests
except ImportError:
    print("requests not installed — skipping"); sys.exit(0)

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "_data" / "promos.json"
FF = ROOT / "_data" / "ff_weekly.json"

FEEDS = {
    "Australian Frequent Flyer": "https://www.australianfrequentflyer.com.au/feed/",
    "Point Hacks": "https://www.pointhacks.com.au/feed/",
    "The Milelion": "https://milelion.com/feed/",
}
# Qantas's own offer pages live under these paths (e.g. /frequent-flyer/member-offers/twice-as-rewarding.html)
QF_OFFER_RE = re.compile(r'https?://(?:www\.)?qantas\.com/[^"\'\s<>]*(?:member-offers|member-specials)[^"\'\s<>]*', re.I)
UA = {"User-Agent": "Mozilla/5.0 (compatible; felixillion-site-bot; +https://felixillion.github.io)"}
KEEP_DAYS = 180

SC_RE = re.compile(r"\b(double|triple|quadruple|2x|3x|4x|bonus|extra)\b.{0,25}\bstatus credits?\b|\bstatus credits?\b.{0,20}\b(sale|offer|promo|promotion|bonus)\b", re.I)
CARD_RE = re.compile(r"credit card|card offer|sign[- ]?up bonus|bonus points|\bpoints card\b|\bamex\b|american express|altitude|amplify|\bmycard\b|qantas money|frequent flyer (black|platinum)", re.I)
POINTS_RE = re.compile(r"qantas|velocity|points", re.I)

def fetch(name, url):
    try:
        r = requests.get(url, headers=UA, timeout=30)
        r.raise_for_status()
        root = ET.fromstring(r.content)
    except Exception as e:
        print(f"  {name}: failed ({e})")
        return []
    items = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        try:
            dt = parsedate_to_datetime(it.findtext("pubDate"))
        except Exception:
            continue
        items.append({"title": title, "link": link, "date": dt.date().isoformat(), "source": name})
    print(f"  {name}: {len(items)} items")
    return items

def qantas_offer_link(article_url):
    """Return the first qantas.com member-offer link found in a news article, if any."""
    try:
        html = requests.get(article_url, headers=UA, timeout=30).text
    except Exception as e:
        print(f"  could not read {article_url}: {e}")
        return None
    m = QF_OFFER_RE.search(html)
    return m.group(0).rstrip('.,)') if m else None

def card_tokens(card):
    generic = {"qantas", "velocity", "card", "rewards", "the", "with", "→", "(qantas)", "(velocity)", "(→", "velocity)"}
    words = [w.strip("()").lower() for w in card["name"].split()]
    return [w for w in words if w and w not in generic and len(w) > 2]

def main():
    old = json.load(open(OUT)) if OUT.exists() else {"sc": [], "cards": []}
    fresh = []
    for name, url in FEEDS.items():
        fresh += fetch(name, url)
    if not fresh:
        print("No feeds reachable — keeping existing file"); return

    cutoff = (datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)).date().isoformat()
    def merge(existing, new):
        seen = {x["link"] for x in existing}
        allx = existing + [x for x in new if x["link"] not in seen]
        return sorted([x for x in allx if x["date"] >= cutoff], key=lambda x: x["date"], reverse=True)

    sc = merge(old.get("sc", []), [i for i in fresh if SC_RE.search(i["title"])
                                   and re.search(r"qantas", i["title"], re.I)
                                   and not re.search(r"velocity|virgin", i["title"], re.I)])
    # For the newest few promo stories, look for a link to Qantas's own offer page
    for item in sc[:3]:
        if "qantas_link" not in item:
            item["qantas_link"] = qantas_offer_link(item["link"])
    cards = merge(old.get("cards", []), [i for i in fresh if CARD_RE.search(i["title"]) and POINTS_RE.search(i["title"])])

    # Flag FF cards mentioned in card news published after the card was last verified
    flags = {}
    ff = json.load(open(FF))
    for scheme in ("qantas", "velocity"):
        for c in ff.get(scheme, []):
            toks = card_tokens(c)
            bank = c["bank"].lower().replace("amex", "amex|american express")
            for n in cards:
                t = n["title"].lower()
                if re.search(bank, t) and any(tok in t for tok in toks) and n["date"] > (c.get("verified") or "0000"):
                    flags.setdefault(f'{c["bank"]}|{c["name"]}', []).append(n)

    out = {"updated": datetime.now(timezone.utc).date().isoformat(),
           "_source": "Headlines from public RSS feeds: " + ", ".join(FEEDS),
           "sc": sc[:15], "cards": cards[:20], "card_flags": flags}
    if {k: v for k, v in out.items() if k != "updated"} == {k: v for k, v in old.items() if k != "updated"}:
        print("No new items"); return
    json.dump(out, open(OUT, "w"), indent=1)
    print(f"Wrote {OUT}: {len(sc)} SC promo items, {len(cards)} card items, {len(flags)} flagged cards")

if __name__ == "__main__":
    main()
