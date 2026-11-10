/**
 * .github/workflows/scripts/ff_scraper.js
 *
 * ── What this script does ──────────────────────────────────────────────────
 * This is NOT an actual web scraper. Bank card pages use heavy JS, CAPTCHAs,
 * and WAFs that block automated access. Instead, this script maintains a
 * manually-curated dataset of current offers and writes it to _data/ff_weekly.json
 * so the Jekyll site can serve it.
 *
 * ── How to update ─────────────────────────────────────────────────────────
 * When a bank changes a bonus/fee, edit the relevant card object below and
 * commit. The GitHub Actions workflow will then write this to _data/ on next run.
 *
 * ── Affiliate links ───────────────────────────────────────────────────────
 * To earn a referral commission, set affiliateLink to your referral URL.
 * Leave as "" to use the official bank link. The JS falls back to link when
 * affiliateLink is falsy (empty string counts as falsy).
 *
 * ── Removed cards (and why) ───────────────────────────────────────────────
 * Citi Qantas Prestige     — Citi Australia exited retail banking (sold to NAB 2022); product closed
 * Citi Velocity Platinum   — same reason; citibank.com.au now redirects to NAB
 * Bankwest Halo Platinum   — Bankwest stopped issuing all new credit cards December 2022
 * Coles Rewards Mastercard — earns Flybuys, NOT Velocity points; wrong category
 * HSBC Platinum Qantas, CBA Ultimate Awards, Amex Qantas Premium, Amex Velocity Platinum,
 * Virgin Money Velocity Flyer, BOM Amplify — not in the Oct 2026 comparison lists; re-add
 * once their current offers are verified.
 *
 * ── Path note ─────────────────────────────────────────────────────────────
 * __dirname = .github/workflows/scripts/
 * '../../../_data/ff_weekly.json' resolves to <repo_root>/_data/ff_weekly.json ✓
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');

// ── Card data ─────────────────────────────────────────────────────────────
// Field guide:
//   signupBonus   points for meeting the first min-spend (year 1)
//   year1Bonus    (legacy name) EXTRA points offered in year 2 / at 12 months
//   fee           ongoing annual fee (incl. any separate rewards-program fee)
//   firstYearFee  fee actually charged in year 1 (defaults to fee)
//   cashback      $ statement credit in year 1 (0 if none)
//   minSpend / spendDays   spend requirement for the year-1 bonus
//   verified      date a human last checked the offer (YYYY-MM-DD) — the page
//                 warns when this is > 45 days old. null = not re-verified.
//   source        where the figures were checked
//
// NB: figures below were re-checked on 2026-11-04 against Point Hacks
// (Qantas list updated 6 Oct 2026) and Australian Frequent Flyer (Velocity
// list, July 2026). Always confirm on the issuer's page before applying.
const PH_Q   = 'Point Hacks — Best Qantas cards (updated 6 Oct 2026)';
const AFF_V  = 'Australian Frequent Flyer — Best Velocity offers (Jul 2026)';

const data = {
  _comment_affiliate: "To add an affiliate link, set 'affiliateLink' to your referral URL. Leave empty to use the official bank link.",
  // lastUpdated = when the DATA was last verified by a human, not when the job ran
  lastUpdated: "2026-11-04",

  qantas: [
    {
      bank: "Westpac", name: "Altitude Qantas Black",
      signupBonus: 90000, year1Bonus: 60000, fee: 450, firstYearFee: 450, cashback: 0,
      minSpend: 6000, spendDays: 90,
      link: "https://www.westpac.com.au/personal-banking/credit-cards/reward/altitude-black-qantas/",
      affiliateLink: "", loungePasses: "2 Qantas Club invitations / yr",
      notes: "Fee = $295 card + $155 Qantas Rewards fee. Year-2 bonus needs another $6k spend in 90 days of anniversary. Also 50 Status Credits.",
      verified: "2026-11-04", source: PH_Q,
    },
    {
      bank: "AMEX", name: "Qantas Ultimate",
      signupBonus: 70000, year1Bonus: 50000, fee: 450, firstYearFee: 450, cashback: 0,
      minSpend: 5000, spendDays: 90,
      link: "https://www.americanexpress.com/en-au/credit-cards/qantas-ultimate-card/",
      affiliateLink: "", loungePasses: "2 Qantas Club invitations + Amex lounges",
      notes: "Includes a $450 Qantas Travel Credit each year, which can offset the fee if you'd fly Qantas anyway.",
      verified: "2026-11-04", source: PH_Q,
    },
    {
      bank: "ANZ", name: "Frequent Flyer Black",
      signupBonus: 50000, year1Bonus: 50000, fee: 425, firstYearFee: 425, cashback: 0,
      minSpend: 6000, spendDays: 90,
      link: "https://www.anz.com.au/personal/credit-cards/frequent-flyer-black/",
      affiliateLink: "", loungePasses: "2 Qantas Club invitations / yr",
      notes: "Second 50k awarded at 12 months. No points on spend above $50k per statement period.",
      verified: "2026-11-04", source: PH_Q,
    },
    {
      bank: "ANZ", name: "Frequent Flyer Platinum",
      signupBonus: 25000, year1Bonus: 25000, fee: 295, firstYearFee: 295, cashback: 0,
      minSpend: 3500, spendDays: 120,
      link: "https://www.anz.com.au/personal/credit-cards/frequent-flyer-platinum/",
      affiliateLink: "", loungePasses: "None",
      verified: "2026-11-04", source: PH_Q,
    },
    {
      bank: "NAB", name: "Qantas Rewards Signature",
      signupBonus: 40000, year1Bonus: 20000, fee: 449, firstYearFee: 449, cashback: 200,
      minSpend: 5000, spendDays: 90,
      link: "https://www.nab.com.au/personal/credit-cards/nab-qantas-rewards-signature-card",
      affiliateLink: "", loungePasses: "None",
      notes: "Includes $200 cashback in year 1.",
      verified: "2026-11-04", source: PH_Q,
    },
    {
      bank: "NAB", name: "Qantas Rewards Premium",
      signupBonus: 25000, year1Bonus: 15000, fee: 295, firstYearFee: 295, cashback: 150,
      minSpend: 3000, spendDays: 90,
      link: "https://www.nab.com.au/personal/credit-cards/nab-qantas-rewards-premium-card",
      affiliateLink: "", loungePasses: "None",
      notes: "Includes $150 cashback in year 1.",
      verified: "2026-11-04", source: PH_Q,
    },
    {
      bank: "Qantas Money", name: "Qantas Money Titanium",
      signupBonus: 120000, year1Bonus: 0, fee: 1200, firstYearFee: 1200, cashback: 0,
      minSpend: 5000, spendDays: 90,
      link: "https://www.qantasmoney.com/credit-cards",
      affiliateLink: "", loungePasses: "2 Qantas First Lounge passes / yr",
      verified: "2026-11-04", source: PH_Q,
    },
    {
      bank: "Qantas Money", name: "Qantas Money Platinum",
      signupBonus: 80000, year1Bonus: 0, fee: 399, firstYearFee: 349, cashback: 0,
      minSpend: 5000, spendDays: 90,
      link: "https://www.qantasmoney.com/credit-cards",
      affiliateLink: "", loungePasses: "None",
      verified: "2026-11-04", source: PH_Q,
    },
    {
      bank: "MyCard", name: "Premier (Qantas)",
      signupBonus: 40000, year1Bonus: 40000, fee: 350, firstYearFee: 350, cashback: 0,
      minSpend: 7000, spendDays: 90,
      link: "https://www.mycard.com.au/",
      affiliateLink: "", loungePasses: "None",
      notes: "MyCard is the former Citi cards business (now owned by NAB). Points capped at 100k per 12 months.",
      verified: "2026-11-04", source: PH_Q,
    },
    {
      bank: "St.George", name: "Amplify Qantas Signature",
      signupBonus: 0, year1Bonus: 0, fee: 450, firstYearFee: 450, cashback: 0,
      minSpend: 0, spendDays: 0,
      link: "https://www.stgeorge.com.au/personal/credit-cards/qantas/amplify-signature",
      affiliateLink: "", loungePasses: "—",
      notes: "No bonus offer currently available (Point Hacks, Oct 2026). Fee = $295 + $155 Qantas Rewards fee.",
      verified: "2026-11-04", source: PH_Q,
    },
  ],

  velocity: [
    {
      bank: "Westpac", name: "Altitude Velocity Black",
      signupBonus: 90000, year1Bonus: 60000, fee: 370, firstYearFee: 370, cashback: 0,
      minSpend: 6000, spendDays: 90,
      link: "https://www.westpac.com.au/personal-banking/credit-cards/reward/altitude-black-velocity/",
      affiliateLink: "", loungePasses: "2 Virgin lounge passes / yr",
      notes: "First-year fee $275 for existing Westpac customers.",
      verified: "2026-07-06", source: AFF_V,
    },
    {
      bank: "Westpac", name: "Altitude Velocity Platinum",
      signupBonus: 70000, year1Bonus: 30000, fee: 250, firstYearFee: 250, cashback: 0,
      minSpend: 4000, spendDays: 90,
      link: "https://www.westpac.com.au/personal-banking/credit-cards/reward/",
      affiliateLink: "", loungePasses: "None",
      notes: "First-year fee $174 for existing Westpac customers.",
      verified: "2026-07-06", source: AFF_V,
    },
    {
      bank: "Virgin Money", name: "Velocity High Flyer",
      signupBonus: 80000, year1Bonus: 20000, fee: 329, firstYearFee: 329, cashback: 0,
      minSpend: 7000, spendDays: 60,
      link: "https://virginmoney.com.au/credit-cards/velocity-high-flyer",
      affiliateLink: "", loungePasses: "2 Virgin lounge passes / yr",
      notes: "40k for each of the first two months with $3,500 spend per month; 20k more on renewal.",
      verified: "2026-07-06", source: AFF_V,
    },
    {
      bank: "NAB", name: "Rewards Platinum (Velocity)",
      signupBonus: 70000, year1Bonus: 20000, fee: 195, firstYearFee: 195, cashback: 0,
      minSpend: 4000, spendDays: 90,
      link: "https://www.nab.com.au/personal/credit-cards",
      affiliateLink: "", loungePasses: "None",
      verified: "2026-07-06", source: AFF_V,
    },
    {
      bank: "NAB", name: "Rewards Signature (Velocity)",
      signupBonus: 60000, year1Bonus: 20000, fee: 420, firstYearFee: 420, cashback: 0,
      minSpend: 5000, spendDays: 90,
      link: "https://www.nab.com.au/personal/credit-cards",
      affiliateLink: "", loungePasses: "None",
      verified: "2026-07-06", source: AFF_V,
    },
    {
      bank: "ANZ", name: "Rewards Platinum (→ Velocity)",
      signupBonus: 60000, year1Bonus: 20000, fee: 149, firstYearFee: 99, cashback: 0,
      minSpend: 3500, spendDays: 90,
      link: "https://www.anz.com.au/personal/credit-cards/",
      affiliateLink: "", loungePasses: "None",
      notes: "Bonus quoted in Velocity points via auto-redemption (must be enabled within 3 months).",
      verified: "2026-07-06", source: AFF_V,
    },
  ],
};

const outPath = path.join(REPO_ROOT, '_data', 'ff_weekly.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
console.log(`✅ Wrote ${outPath} (${data.qantas.length} Qantas, ${data.velocity.length} Velocity)`);
