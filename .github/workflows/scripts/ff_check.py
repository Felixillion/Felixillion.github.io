#!/usr/bin/env python3
"""
ff_check.py — weekly automatic check of the credit card offers on the FF Points page.

Card figures live in _data/ff_cards.json and are edited by hand (banks don't offer a feed, and
their pages change layout often, so nothing is auto-updated). Every week this script:
  1. loads each card's official page and records whether the link works;
  2. looks for the bonus-point numbers we show (e.g. "90,000" / "90K") in the page text, so an
     offer that has changed or ended is spotted quickly;
  3. flags offers past their end date and cards not re-checked for 45+ days;
  4. adds a new entry to _data/ff_history.json whenever a card's figures in ff_cards.json changed
     (so the page can show past offers);
  5. writes _data/ff_checks.json (shown on the page) and ff_report.md (the workflow turns it into a
     GitHub issue when something needs a human).
Some banks block automated visitors; those show as "couldn't check" and don't raise an issue.
"""
import json, re, sys
from datetime import date
from html import unescape
from pathlib import Path

try:
    import requests
except ImportError:
    print('requests not installed'); sys.exit(0)

ROOT = Path(__file__).resolve().parents[3]
CARDS, HIST, CHECKS, REPORT = (ROOT / '_data' / 'ff_cards.json', ROOT / '_data' / 'ff_history.json',
                               ROOT / '_data' / 'ff_checks.json', ROOT / 'ff_report.md')
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
      'Accept-Language': 'en-AU,en;q=0.9'}
NUM = re.compile(r'(\d{1,3}(?:,\d{3})+|\d{2,3}\s?[kK])\b')


def numbers(text):
    out = set()
    for m in NUM.finditer(text):
        s = m.group(1).replace(',', '').replace(' ', '')
        out.add(int(s[:-1]) * 1000 if s[-1] in 'kK' else int(s))
    return out


def page_text(html):
    html = re.sub(r'(?is)<(script|style|noscript)\b.*?</\1>', ' ', html)
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', html)))


def signature(c):
    return {'total': sum(s['pts'] for s in c['stages']), 'y1': sum(s['pts'] for s in c['stages'] if s['year'] == 1),
            'fee': c['fees']['y1'], 'sc': c.get('statusCredits', 0)}


def main():
    data = json.load(open(CARDS))
    today = date.today().isoformat()
    results, problems, blocked = {}, [], []
    for c in data['cards']:
        sig = signature(c)
        expected = {s['pts'] for s in c['stages']} | {sig['total'], sig['y1']}
        r = {'checked': today}
        try:
            resp = requests.get(c['link'], headers=UA, timeout=30, allow_redirects=True)
            r['http'] = resp.status_code
            if resp.status_code in (404, 410):
                problems.append(f"**{c['issuer']} {c['name']}** — link is broken ({resp.status_code}): {c['link']}")
                r['status'] = 'broken'
            elif resp.status_code >= 400:
                r['status'] = 'blocked'; blocked.append(c['id'])
            else:
                found = numbers(page_text(resp.text))
                hit = sorted(expected & found)
                r['found'] = hit
                if hit:
                    r['status'] = 'match'
                else:
                    near = sorted(n for n in found if 5000 <= n <= 400000)[:8]
                    r['status'] = 'differs'
                    problems.append(f"**{c['issuer']} {c['name']}** — the page no longer shows {', '.join(f'{n:,}' for n in sorted(expected))}"
                                    f" (numbers on the page: {', '.join(f'{n:,}' for n in near) or 'none'}). Check {c['link']}")
        except Exception as e:
            r['status'] = 'blocked'; r['error'] = str(e)[:120]; blocked.append(c['id'])
        if c.get('offerEnds') and c['offerEnds'] < today:
            problems.append(f"**{c['issuer']} {c['name']}** — offer end date {c['offerEnds']} has passed.")
            r['ended'] = True
        if (date.today() - date.fromisoformat(c.get('verified', '2000-01-01'))).days > 45:
            problems.append(f"**{c['issuer']} {c['name']}** — not re-checked by hand since {c.get('verified')}.")
        results[c['id']] = r
    # history: new entry whenever a card's figures changed since its last entry
    hist = json.load(open(HIST)) if HIST.exists() else {'entries': []}
    last = {}
    for e in hist['entries']:
        if e['id'] not in last or e['from'] >= last[e['id']]['from']:
            last[e['id']] = e
    for c in data['cards']:
        sig, prev = signature(c), last.get(c['id'])
        if not prev or any(prev.get(k, 0) != v for k, v in sig.items()):
            if prev and not prev.get('to'):
                prev['to'] = c.get('verified', today)
            hist['entries'].append({'id': c['id'], 'from': c.get('verified', today), **sig, 'source': f"issuer page (checked {c.get('verified', today)})"})
    json.dump(hist, open(HIST, 'w'), indent=1, ensure_ascii=False)
    json.dump({'checked': today, 'results': results}, open(CHECKS, 'w'), indent=1)
    if problems:
        REPORT.write_text("The weekly check of the FF Points page found offers to re-check by hand "
                          "(update `_data/ff_cards.json`, including each card's `verified` date):\n\n- " + '\n- '.join(problems) +
                          (f"\n\nCouldn't check automatically (the bank blocks automated visitors): {', '.join(blocked)}." if blocked else ''))
    print(f"{sum(1 for r in results.values() if r['status'] == 'match')} match, {len(problems)} to re-check, {len(blocked)} couldn't be checked")


if __name__ == '__main__':
    main()
