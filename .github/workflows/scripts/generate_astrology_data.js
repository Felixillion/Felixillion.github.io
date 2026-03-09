#!/usr/bin/env node
/**
 * generate_astrology_data.js
 * --------------------------
 * Self-contained script — NO external dependencies, no require() of other local files.
 * Run with: node generate_astrology_data.js
 *
 * What it does:
 *   1. Calculates real planetary positions using simplified Jean Meeus formulas
 *      (accuracy ~1°, sufficient for astrological purposes)
 *   2. Derives major aspects between planet pairs
 *   3. Generates daily science-themed horoscope readings seeded by today's date
 *      (so they are reproducible for the day but change each day)
 *   4. Builds a compatibility matrix for all 78 sign pairs using element/modality rules
 *   5. Writes data/astrology_daily.json
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Output paths ────────────────────────────────────────────────────────────────
// The file is written to TWO locations:
//   data/astrology_daily.json   → served as a static file, fetched by JS (fetch('/data/...'))
//   _data/astrology_daily.json  → read by Jekyll at build time as site.data.astrology_daily
// Both are committed by the GitHub Action so Jekyll re-builds with fresh data on push.
const REPO_ROOT  = path.join(__dirname, '..', '..', '..');
const OUT_DATA   = path.join(REPO_ROOT, 'data',  'astrology_daily.json');
const OUT_JDATA  = path.join(REPO_ROOT, '_data', 'astrology_daily.json');

// ── Zodiac reference data ──────────────────────────────────────────────────────
const SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'
];

const ELEMENTS = {
  Aries:'Fire', Leo:'Fire', Sagittarius:'Fire',
  Taurus:'Earth', Virgo:'Earth', Capricorn:'Earth',
  Gemini:'Air', Libra:'Air', Aquarius:'Air',
  Cancer:'Water', Scorpio:'Water', Pisces:'Water',
};

const MODALITIES = {
  Aries:'Cardinal', Cancer:'Cardinal', Libra:'Cardinal', Capricorn:'Cardinal',
  Taurus:'Fixed', Leo:'Fixed', Scorpio:'Fixed', Aquarius:'Fixed',
  Gemini:'Mutable', Virgo:'Mutable', Sagittarius:'Mutable', Pisces:'Mutable',
};

// ── Astronomy helpers ──────────────────────────────────────────────────────────

/** Julian Day Number for a JS Date */
function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Normalise degrees to [0, 360) */
function norm360(deg) {
  return ((deg % 360) + 360) % 360;
}

/** Degrees → radians */
const rad = d => d * Math.PI / 180;

/**
 * Simplified planetary longitude calculations.
 * Source: Jean Meeus "Astronomical Algorithms", ch. 31-33 (low-precision formulae).
 * T = Julian centuries since J2000.0
 * All results in degrees [0,360).
 */
function planetaryLongitudes(date) {
  const jd = julianDay(date);
  const T  = (jd - 2451545.0) / 36525;   // Julian centuries since J2000.0

  // Sun (apparent longitude)
  const L0 = norm360(280.46646 + 36000.76983 * T);
  const M  = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const C  = (1.914602 - 0.004817*T - 0.000014*T*T) * Math.sin(rad(M))
           + (0.019993 - 0.000101*T) * Math.sin(rad(2*M))
           +  0.000289 * Math.sin(rad(3*M));
  const sun = norm360(L0 + C);

  // Moon (simplified, ~1° accuracy)
  const Lm = norm360(218.3165 + 481267.8813 * T);
  const Mm = norm360(134.9634 + 477198.8676 * T);
  const D  = norm360(297.8502 + 445267.1115 * T);
  const F  = norm360(93.2721  + 483202.0175 * T);
  const moon = norm360(Lm
    + 6.2888 * Math.sin(rad(Mm))
    + 1.2740 * Math.sin(rad(2*D - Mm))
    + 0.6583 * Math.sin(rad(2*D))
    + 0.2136 * Math.sin(rad(2*Mm))
    - 0.1851 * Math.sin(rad(D))
    + 0.1144 * Math.sin(rad(2*F))
    - 0.0588 * Math.sin(rad(2*D - 2*Mm)));

  // Mercury (low-precision VSOP87-derived)
  const mercury = norm360(252.2509 + 149472.6742 * T
    + 23.4400 * Math.sin(rad(168.6 + 87654.0 * T))
    +  2.9818 * Math.sin(rad(337.2 + 175308.1 * T)));

  // Venus
  const venus = norm360(181.9798 + 58517.8156 * T
    + 0.7758 * Math.sin(rad(238.0 + 36000.8 * T))
    + 0.0033 * Math.sin(rad(116.0 + 72001.6 * T)));

  // Mars
  const mars = norm360(355.4330 + 19140.2993 * T
    + 0.4439 * Math.sin(rad(297.3 + 19036.4 * T))
    + 0.3246 * Math.sin(rad(243.0 + 38015.6 * T)));

  // Jupiter
  const jupiter = norm360(34.3515 + 3034.9057 * T
    + 0.3300 * Math.sin(rad(178.6 + 1159.8 * T))
    + 0.1003 * Math.sin(rad(342.0 + 2319.9 * T)));

  // Saturn
  const saturn = norm360(50.0774 + 1222.1138 * T
    + 0.3400 * Math.sin(rad(234.8 + 1222.1 * T))
    + 0.0323 * Math.sin(rad(104.2 + 2444.2 * T)));

  // Uranus
  const uranus = norm360(314.0550 + 428.4669 * T
    + 0.0977 * Math.sin(rad(141.7 + 428.5 * T)));

  // Neptune
  const neptune = norm360(304.3487 + 218.4610 * T
    + 0.0134 * Math.sin(rad(347.0 + 218.5 * T)));

  return { sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune };
}

/** Longitude in degrees → zodiac sign + degree within sign */
function toZodiac(lon) {
  const idx  = Math.floor(norm360(lon) / 30) % 12;
  const deg  = norm360(lon) % 30;
  return { sign: SIGNS[idx], degree: Math.round(deg * 10) / 10 };
}

/** Moon phase name from moon-sun angular separation */
function moonPhase(moonLon, sunLon) {
  const diff = norm360(moonLon - sunLon);
  if (diff < 22.5)   return 'New Moon';
  if (diff < 67.5)   return 'Waxing Crescent';
  if (diff < 112.5)  return 'First Quarter';
  if (diff < 157.5)  return 'Waxing Gibbous';
  if (diff < 202.5)  return 'Full Moon';
  if (diff < 247.5)  return 'Waning Gibbous';
  if (diff < 292.5)  return 'Last Quarter';
  if (diff < 337.5)  return 'Waning Crescent';
  return 'New Moon';
}

/** Detect retrograde using yesterday's position vs today's.
 *  A planet is retrograde if its longitude decreased overnight. */
function isRetrograde(todayLon, yesterdayLon) {
  // Handle wrap-around at 0°/360°
  let diff = todayLon - yesterdayLon;
  if (diff > 180)  diff -= 360;
  if (diff < -180) diff += 360;
  return diff < 0;
}

/** Major aspects between two planets (orb ≤ 8°) */
const ASPECT_ANGLES = [
  { type: 'conjunction',  angle: 0,   orb: 8 },
  { type: 'sextile',      angle: 60,  orb: 6 },
  { type: 'square',       angle: 90,  orb: 8 },
  { type: 'trine',        angle: 120, orb: 8 },
  { type: 'opposition',   angle: 180, orb: 8 },
  { type: 'quincunx',     angle: 150, orb: 3 },
];

function findAspects(lons) {
  const names = Object.keys(lons);
  const aspects = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j];
      let diff = Math.abs(lons[a] - lons[b]);
      if (diff > 180) diff = 360 - diff;
      for (const asp of ASPECT_ANGLES) {
        const orb = Math.abs(diff - asp.angle);
        if (orb <= asp.orb) {
          aspects.push({
            planets: [cap(a), cap(b)],
            type: asp.type,
            orb: Math.round(orb * 10) / 10,
          });
        }
      }
    }
  }
  // Sort by tightness
  return aspects.sort((a, b) => a.orb - b.orb).slice(0, 8);
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ── Deterministic date-seeded PRNG ────────────────────────────────────────────
// Mulberry32 — fast, good quality, seeded by today's date integer
function makePRNG(seed) {
  let s = seed >>> 0;
  return function() {
    s += 0x6D2B79F5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return y * 10000 + m * 100 + d;  // e.g. 20260307
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// ── Daily reading templates ────────────────────────────────────────────────────
// Keyed by zodiac sign. Each sign has a pool of science-themed readings.
// The PRNG picks one per day, so it changes daily but is consistent within the day.
// 30+ readings per sign → ~30 days before any repeat (longer with multi-sign combos).

const READING_POOLS = {
  Aries: [
    "Something is beginning. You felt it before you understood it. Don't wait for the signal — you are the signal.",
    "You want to move faster than the situation allows. The friction is informative. Read it.",
    "Your anger is data. What it's pointing at is worth examining before you act on it.",
    "The thing you started and didn't finish is still there. Still waiting. So are you.",
    "Everyone in the room can feel you deciding. Make the decision.",
    "You've been patient long enough. What you were waiting for has already arrived.",
    "There's a difference between courage and combustion. Today the line is thinner than usual.",
    "You are not too much. You are, however, misdirected. Adjust the trajectory.",
    "The relationship that costs you the most energy might be telling you something about your own threshold.",
    "Your instincts are correct. Your timing needs work.",
    "Not every battle is yours. Choosing which ones to enter is the actual skill.",
    "You have more capacity for tenderness than you show. Today someone needs to see it.",
    "The first idea is rarely the best one. The energy behind it is what matters — redirect it.",
    "Something you called a mistake was actually a divergence. The new path is better.",
    "You function best when there is something to push against. Right now, push gently.",
    "Your half-life in any comfortable situation is shorter than you'd like to admit.",
    "The person who doubted you is still in your head. Evict them.",
    "Leadership is not volume. Today, the quieter approach covers more ground.",
    "You are already past the point of hesitation. You just haven't caught up to yourself yet.",
    "Rest is not retreat. Your system needs to cycle before it can perform at capacity again.",
    "The desire you've been intellectualising has a body. Let it.",
    "Someone is ready to follow your lead. Be worth following.",
    "You carry momentum the way charged particles carry a field — it surrounds you, invisible, real.",
    "The wound you keep reopening has something to teach. You've been treating the symptom.",
    "What you call impatience is actually high sensitivity to wasted potential. Channel it.",
    "There is a version of this situation that doesn't require you to fight. Try to find it.",
    "You know what you want. The uncertainty is about whether you're allowed to want it. You are.",
    "Your energy is a resource, not a personality trait. Spend it deliberately today.",
    "The thing standing between you and the outcome is not the obstacle. It's your interpretation of it.",
    "Action is your native language. But some of the most important things can only be said quietly.",
  ],
  Taurus: [
    "Something is asking you to change. Your resistance is understandable. It is also, right now, the problem.",
    "You know what you need. You have always known. The difficulty is in asking for it directly.",
    "Comfort is not the same as safety. The distinction matters today.",
    "There is something beautiful in your immediate environment that you've stopped seeing. Look again.",
    "Your loyalty is not the issue. The question is whether it's being returned in kind.",
    "The thing you've been protecting might not need protecting anymore. Consider letting it breathe.",
    "Slowness is a form of intelligence. The world will argue otherwise. You are correct.",
    "You accumulate experiences the way sediment accumulates — quietly, completely, permanently.",
    "Someone is waiting for you to say what you mean. The long way around is costing you both.",
    "The pleasure you've been deferring has a half-life. Enjoy it before it changes.",
    "Your body knows something your mind is still processing. Listen to it today.",
    "The tension you're feeling is between what you have and what you want. They are not mutually exclusive.",
    "Stubbornness and consistency are the same trait in different lighting. Today, which one is it?",
    "You are more afraid of loss than you are excited by gain. This shapes every choice you make.",
    "There is a conversation you've been delaying. The longer it waits, the harder it becomes.",
    "Security is not something you find. It is something you construct, slowly, from trustworthy materials.",
    "Your patience is remarkable. Your patience is also a place you sometimes hide.",
    "Something you made with your hands or your time is more significant than you're giving it credit for.",
    "The people who depend on you know you're reliable. Make sure you know it too.",
    "You have been generous with your time. You are allowed to reclaim some of it.",
    "The appetite you're ignoring is not going away. Give it something real.",
    "Your instinct to stay is correct. The reason you're staying is worth examining.",
    "Beauty is not frivolous to you — it's structural. Without it, you cannot function well.",
    "The thing you won't let go of has become part of your identity. Is it still serving you?",
    "Your threshold for chaos is lower than most people's. This is a feature, not a flaw.",
    "Something needs to be finished before you can start what's next. You know what it is.",
    "The quality of your attention is the quality of your life. Pay it to the right things today.",
    "You are not inflexible. You require more evidence before you change. There is a difference.",
    "Your relationship with pleasure is complicated in a way that has nothing to do with pleasure.",
    "What feels like stability might be stagnation. It is worth sitting with the discomfort of not knowing.",
  ],
  Gemini: [
    "You are in the middle of two things you haven't admitted are contradictory. They are.",
    "Your mind is faster than your life. This is both your gift and your primary source of boredom.",
    "The idea you abandoned is still good. Pick it up again.",
    "There is a version of the conversation you keep starting that would actually end it. Try that one.",
    "You contain multitudes and you know it. Today, pick one and inhabit it fully.",
    "Someone is taking your adaptability for granted. You have noticed. It's worth mentioning.",
    "The restlessness you feel is signal, not noise. What is it pointing at?",
    "You have been agreeable. You are allowed to have a position.",
    "The information you need exists. You have to stop seeking it and let it arrive.",
    "Your attention is the most valuable thing you have. Right now, it's scattered. Collect it.",
    "There are two kinds of curiosity — the kind that opens doors and the kind that avoids commitment. Know which you're using.",
    "You've told the story of yourself differently to different people. Which version is closest to true?",
    "The connection you're afraid of losing is already changing. Let it become what it needs to become.",
    "You are more tired than you look. Let someone see it.",
    "Not every thought needs to be shared. Some of them are just thoughts.",
    "You learn by talking. Today, learn by listening.",
    "The two things you want are not incompatible. You've been treating them as if they were.",
    "Your wit is a gift. It's also where you go when you don't want to be known.",
    "There's a feeling underneath the thinking. Stop analysing it long enough to feel it.",
    "You've been circling the truth. Land.",
    "The decision you can't make is not about the options. It's about what committing would mean.",
    "Your nervous system processes faster than most. Give yourself time to integrate before you act.",
    "Something you said lightly is being taken seriously. Check in.",
    "You are not who you were six months ago. Update your self-concept accordingly.",
    "The idea you dismissed too quickly deserves another look.",
    "Your flexibility is a gift to others and sometimes a burden to yourself. Draw a line.",
    "There is someone in your life who needs your full attention, not your cleverness. Give it to them.",
    "The question you keep asking is really a different question underneath. Find it.",
    "You process everything through language. Today, there is something language can't quite reach.",
    "Your cross-talk with the world is high. Reduce cognitive load; something important is trying to get through.",
  ],
  Cancer: [
    "Something that happened long ago is affecting today in ways you haven't fully mapped. Start mapping.",
    "You are allowed to need things. You are not required to justify the need first.",
    "Your intuition is more accurate than your analysis right now. Trust the feeling.",
    "The shell is not the whole organism. Let someone see the rest.",
    "You absorb the emotional state of every room you enter. This is information. It's also exhausting.",
    "The person you're worried about knows you're worried. Say it out loud instead.",
    "Home is not a place you go — it's a state you create. What would it take to feel it now?",
    "Something you're protecting doesn't need protection anymore. It needs release.",
    "Your memory is long and your feelings longer. Not everything from before applies to now.",
    "You give more than you receive and you've normalised this. It's worth re-examining.",
    "The mood that arrived without explanation is responding to something real. What is it?",
    "You know things about people that they haven't told you. This is a gift. Carry it carefully.",
    "The relationship that costs you the most emotionally might be where you're needed most. Or not. Check.",
    "Your body is keeping score of everything your mind has processed and not processed. Listen to it.",
    "You have been protecting others from your feelings. Consider the cost of that protection.",
    "Something is asking to be mourned before it can be moved past. Let it.",
    "The boundary you're reluctant to draw is the one you most need.",
    "Safety is the precondition for everything you do best. Build it deliberately.",
    "You have tended to others through their cycles. Who tends to yours?",
    "The pull toward the past is strong today. Visit it briefly. Come back.",
    "Your sensitivity is precision, not weakness. The readings it gives are accurate.",
    "Someone needs your care. You need rest. Both things are true simultaneously.",
    "What you call being cautious is sometimes waiting to feel safe enough to begin. You may never feel safe enough. Begin anyway.",
    "The thing you've outgrown is still in your possession. It's okay to let it go.",
    "You are not responsible for managing the feelings of everyone around you. Just your own.",
    "There is love in your life that is waiting to be acknowledged. Notice it.",
    "The dream you're not taking seriously is the dream you should take seriously.",
    "You've been carrying this longer than is reasonable. Set it down. Someone can help you.",
    "Your emotional intelligence is exceptional. Your willingness to apply it to yourself needs work.",
    "The tide moves regardless of whether you're watching. What you feel today will shift. Let it.",
  ],
  Leo: [
    "You are visible whether you try to be or not. Make what you're broadcasting intentional.",
    "The validation you're seeking is available from yourself. It's more durable there.",
    "Someone who loves you is asking for something small. Giving it would cost you almost nothing.",
    "Your warmth is your superpower. Don't let the performance crowd it out.",
    "The thing you're proud of deserves to be shared. Not to impress — because it's genuinely good.",
    "Someone in your orbit needs to feel seen. You're unusually good at this. Use it.",
    "Your loyalty is total and it's not being matched. This is worth acknowledging.",
    "There's a difference between confidence and armour. Check which one you're wearing today.",
    "You require appreciation the way cells require oxygen. Name this without shame.",
    "The drama unfolding around you is partly your own creation. What would quiet look like?",
    "Your instinct to lead is correct. Your instinct to control the entire outcome needs recalibrating.",
    "What you perform eventually becomes what you are. Choose your performance carefully.",
    "Someone underestimated you recently. The most satisfying response is excellence, delivered quietly.",
    "You contain more generosity than you sometimes access. Today, go deeper.",
    "Your radiance is not depleted by giving — it's amplified. Give more.",
    "The story you tell about yourself shapes what you allow yourself to experience. Is it generous enough?",
    "You want the room. You also sometimes want to be unknown. Both are real.",
    "There is a project that deserves your full flame. Stop parcelling it out in careful doses.",
    "The person you're becoming requires a different audience than the person you were. Update accordingly.",
    "Rest is not a failure of productivity. For you specifically, this requires repeating.",
    "You see yourself most clearly through the eyes of people who love you. Choose those mirrors.",
    "Something you dismissed as vanity is actually self-knowledge. Let yourself have it.",
    "The performance you're giving is excellent. There is something you're not saying behind it.",
    "Your creativity needs an outlet or it will find one you didn't choose. Give it space.",
    "Someone needs to hear what you think. Say it clearly and without hedging.",
    "The applause you remember most is the one that surprised you. Aim for that.",
    "You radiate energy that others orient toward. Use this for good today — including your own good.",
    "There's a fear underneath the pride. Name it privately, even if only to yourself.",
    "Your relationships are better when you are being yourself rather than the best version of yourself.",
    "What you love, you love completely. This is both your most beautiful quality and your most difficult one.",
  ],
  Virgo: [
    "The flaw you keep returning to is not the problem. The returning is the problem.",
    "You have been useful to everyone except yourself today. Correct this.",
    "Your standards are high because you know what's possible. Most people don't. This is lonely sometimes.",
    "The system you've built is working. You are allowed to stop improving it for one day.",
    "Something is good enough. Let it be good enough.",
    "You notice what others miss. This is a gift. It is also an exhausting way to move through the world.",
    "The criticism forming in your mind — apply it to the problem, not the person.",
    "Your body is communicating something your mind has been too busy to register. Listen.",
    "You have spent considerable energy on a detail that no longer matters. Redirect.",
    "The help you offer is useful. The help you need is harder to ask for.",
    "Not every disorder requires your intervention. Some things are allowed to be chaotic.",
    "The pursuit of precision is a form of care. Let it be received as such today.",
    "You are harder on yourself than on anyone you love. Apply the same standard in both directions.",
    "Something small is adding up to something significant. Your instinct to track it is correct.",
    "The version of events in your head is detailed and accurate and still missing something. Ask questions.",
    "Your willingness to work harder than necessary has served you. It has also cost you things.",
    "There is a relationship you've been analysing instead of experiencing. Enter it.",
    "The worry is not the same as the problem. Distinguish between them.",
    "You know exactly what needs to happen. The difficulty is in accepting that you can't control all of it.",
    "Your care for the people around you is expressed in actions, not words. Make sure they know it.",
    "Something you fixed is broken again. This is not a reflection of the quality of the fixing.",
    "The gap between your ideal and the reality is where growth lives. Stop trying to close it and start working in it.",
    "You process experience through refinement. The raw material is already good. Trust it.",
    "Something you've categorised as not-your-problem is actually exactly your problem.",
    "Routine is not limitation. For you, it is the condition under which everything else becomes possible.",
    "The thing you're not saying is specific enough to be said. Say it that specifically.",
    "You have helped enough people today. The next person to help is you.",
    "Your analytical nature is a form of love — you take things seriously enough to understand them.",
    "The project is not finished. Finishing it is more important than perfecting it.",
    "There is order inside the disorder. You will find it. Give yourself the time.",
  ],
  Libra: [
    "The decision is waiting for you. Not because more information is needed — because deciding feels like loss.",
    "You want harmony. You also want honesty. Today they are in conflict. Choose honesty.",
    "Someone has been telling you what you want to hear. You already know this.",
    "You are allowed to have a preference. Having one does not make you unfair.",
    "The peace you've been keeping has a cost that's being charged somewhere else.",
    "There is a relationship in your life that is beautifully curated and increasingly hollow. Look at it.",
    "You see all sides. You also avoid standing on any of them. Today, pick a side.",
    "The aesthetic sense that guides your environment also guides your emotional life. What needs rebalancing?",
    "You are so good at seeing others' perspectives that you have temporarily misplaced your own. Find it.",
    "Your desire for fairness is genuine. In this situation, fairness and kindness are not the same thing.",
    "There is something you find beautiful about someone that you haven't told them. Tell them.",
    "The compromise you made is not sitting well. This is information.",
    "You process conflict by distancing from it. Right now, proximity would serve you better.",
    "The thing you've been putting off deciding has already been decided by your inaction. Notice this.",
    "Other people's approval has weight in your emotional system. Today, your own approval matters more.",
    "You are diplomatic to a fault. The fault is visible to others even when you don't intend it.",
    "There is beauty in the asymmetry you've been trying to correct. Let it be.",
    "The relationship that looks perfect from the outside is not being perceived from the inside. Which is true?",
    "You manage the emotional temperature of every room you're in. Take a break from that responsibility.",
    "The injustice that bothers you is not abstract. Name the specific thing.",
    "Your need for balance is not weakness — it's an accurate reading of what makes systems work.",
    "The person you've been gentle with needs something less gentle today. You can do that.",
    "There is a conversation you've been softening. Try the direct version.",
    "Not everything can be fair. Some things are just what they are.",
    "The mirror you hold up to others reflects you too. What do you see?",
    "You are most fully yourself when you are in good company. Today you need your own company.",
    "The beauty you seek in your environment is also something you create in everyone around you.",
    "There is indecision, and then there is gathering information. Know which you're doing.",
    "You've been seeing both sides so long you've forgotten which one you were on originally.",
    "Something in your life has drifted out of alignment. Your instinct for it is excellent. Trust it.",
  ],
  Scorpio: [
    "You see through things. What you're seeing right now — trust it.",
    "The obsession is information. What is it telling you about what you actually want?",
    "There is power in what you're not saying. There is also cost. Calculate both.",
    "You have survived every version of this before. You are going to survive this one too.",
    "The transformation you're in the middle of is not comfortable. It's not supposed to be.",
    "Something ended. You don't have to perform recovery for anyone.",
    "The loyalty you give is total. The loyalty you require is reasonable. Don't lower the bar.",
    "You know something about someone that they don't know you know. Decide what to do with it carefully.",
    "Your intensity is not too much for the right people. The wrong people will tell you otherwise.",
    "The wound is real. It is also not the whole story about you.",
    "You have been in the dark long enough to know it. The light is coming and you will be ready.",
    "What you call jealousy is a diagnostic tool for what you care about most. Use it accordingly.",
    "You do not give second chances easily. In this case, one more data point might be warranted.",
    "The secret you're keeping is protecting someone. Including, in some ways, yourself.",
    "You are drawn to what frightens you. This is why you understand things others don't.",
    "The feeling that something is not what it appears to be is correct. Investigate quietly.",
    "Your capacity for depth is a gift. Not everyone can go there with you. That's okay.",
    "There is something you need to grieve before you can desire again. Let yourself.",
    "The power you gave away — take it back. Slowly and without announcement.",
    "You are more forgiving than your reputation suggests. One person knows this. Let a second.",
    "What looked like an ending was a shedding. The new layer is already forming.",
    "The thing you're afraid of knowing is probably already known to some part of you.",
    "Your instinct for what people really mean is almost always correct. It's protecting you today.",
    "There is something you want that you haven't admitted wanting. Admit it to yourself first.",
    "The past is not gone — it's metabolised. What has your history made you capable of?",
    "Someone is trying to understand you. Let them try.",
    "The threshold you're standing on is a real threshold. Cross it or turn back. Both are valid.",
    "You process everything through transformation. Even rest, in you, becomes power.",
    "What you love, you love completely, and you never fully stop. This is a fact of your chemistry.",
    "You contain multitudes of darkness and light and you've learned not to be afraid of either. Teach someone.",
  ],
  Sagittarius: [
    "The horizon is real. It is also not the point. What is between here and there?",
    "You said the true thing. Consider also the timing and the delivery.",
    "The freedom you're seeking is available now, in this constraint. Find it.",
    "You've outgrown something. The exit is available. Give it a moment of ceremony.",
    "Your optimism is accurate. It is also sometimes premature. Check the current conditions.",
    "The adventure you need does not require travel. Change the frame of what's in front of you.",
    "Someone took your bluntness as cruelty. Revisit the conversation with more care for landing.",
    "You are drawn to the idea of a thing more than the thing itself. Make sure this one is different.",
    "The philosophy you've been living by is due for an update. What do you actually believe now?",
    "Your restlessness is valid. Right now, it is also the thing keeping you from what you want.",
    "Commitment is not the same as confinement. The distinction matters for what's in front of you.",
    "The truth you're telling is true. It is not the whole truth. Find the rest of it.",
    "You are more certain than the situation warrants. A little less certainty opens more options.",
    "The distance you put between yourself and difficult feelings is getting to be quite a distance.",
    "Something you believed absolutely is no longer something you believe absolutely. That's growth.",
    "The person who challenged you was right. You don't have to tell them. Incorporate the data.",
    "You are looking for meaning at the wrong scale. Shrink the lens.",
    "Your enthusiasm is contagious. Apply it deliberately today.",
    "The question you're asking is good. The answer you're expecting is limiting the search.",
    "You have a gift for making things feel possible. Use it on yourself today.",
    "Not every truth needs to be said. Ask yourself who benefits from this particular one.",
    "The journey you're on has been lonely at points. The loneliness is not a flaw in the journey.",
    "Something you said to yourself about your limitations is not accurate. Recalibrate.",
    "Your intuition about a place or situation you haven't experienced yet is probably correct. Trust it.",
    "The fire in you is generative and occasionally destructive. Today, mind the surroundings.",
    "You are better at starting than finishing. This particular thing deserves to be finished.",
    "There is wisdom in staying. Not because leaving is wrong — because the lesson is here.",
    "The arrow is already in flight. Aim it at something worthy.",
    "You hold ideas loosely, which is beautiful. Hold the people in your life a little less loosely.",
    "What you're searching for is real. It is also closer than the direction you're searching in.",
  ],
  Capricorn: [
    "You are further along than you think. The metric you're using is incorrect.",
    "The thing you're working toward is real. The price you're paying for it deserves examination.",
    "You have been responsible for long enough. Someone else can carry this today.",
    "The ambition is not the problem. The sacrifice it's requiring is worth looking at honestly.",
    "Your patience is a form of power. Today, deploy it on yourself.",
    "Something you built is worth protecting. Make sure you're protecting the right parts of it.",
    "You are more than your output. This requires repeating.",
    "The relationship you've been treating like a project is actually a relationship. Adjust accordingly.",
    "Your standards for yourself are borrowed from somewhere. Examine the source.",
    "The authority you carry was earned. Use it with care today.",
    "There is something in your past you carry as evidence of who you are. Is the evidence still current?",
    "You process emotions through action. Today, the emotion needs to be felt, not solved.",
    "The goal is real. The version of you who needs to achieve it at the cost of everything else — reconsider.",
    "Someone you respect is watching and taking notes. Good. You know what you're doing.",
    "Your ability to delay gratification is extraordinary. Some gratification is not supposed to be delayed.",
    "You control more than most people and less than you'd like. Make peace with the second part.",
    "There is warmth in you that your efficiency sometimes buries. Let it surface.",
    "The legacy you're building is real. Make sure it looks the way you actually want it to look.",
    "You've been serious for a long time. Levity is not the same as not taking things seriously.",
    "Something you dismissed as soft is actually what's needed right now. Recalibrate.",
    "The plan is good. The plan will need adjustment. Plan for that too.",
    "You are carrying more than is yours to carry. Redistribution is not failure.",
    "There is a difference between discipline and punishment. Make sure you know which you're practising.",
    "The mountain is real. The view at the top will be real. Don't forget to look at the path you've made.",
    "Your relationship with time is complex. You are either far ahead of it or burdened by its passage. Today: present tense.",
    "You have given the work everything. The work has given back. Notice what it hasn't given.",
    "There's a version of rest you can access without losing anything. Find it.",
    "The coldness others perceive is not who you are. It is how you move through uncertain terrain. Let someone know.",
    "Something you've built together with someone else is worth tending to. Not as a project. As a relationship.",
    "You are becoming what you intended. Check whether the intention still fits.",
  ],
  Aquarius: [
    "The future you see is real. The path there runs through the present, which is inconvenient.",
    "You care about humanity in aggregate and sometimes miss the individual in front of you. Look closer.",
    "Your detachment is a skill. Right now, it's also a defence mechanism. Know the difference.",
    "The idea is genuinely good. The execution requires other people. Let them in.",
    "You have been right about this for a long time. It is not yet time to say 'I told you so.'",
    "The relationship that doesn't fit your system is the one that's teaching you something important.",
    "Your independence is real and it is also sometimes used to avoid being vulnerable. Notice that today.",
    "You are ahead of the moment you're in. Come back and meet it.",
    "Something you've intellectualised needs to be felt. The feeling is safe.",
    "The collective matters to you more than most. Don't let that abstract away from the specific.",
    "You are loyal to your ideas in the way others are loyal to people. Someone needs you to be loyal to them instead.",
    "Your eccentricity is not a performance. Don't let anyone try to convince you to normalise it.",
    "The revolution you believe in is needed. The cost of it, for the people around you, is worth acknowledging.",
    "You need more freedom than average. This is not a flaw. It is a condition that needs to be communicated.",
    "There is something you've observed in others that you haven't yet observed in yourself. Look.",
    "The community you're part of is drawing on your resources. Replenish.",
    "Your vision of how things could be is accurate and inspiring. Today, things are how they are. Work with that.",
    "Something you dismissed as conventional might contain what you need. Examine it without prejudice.",
    "You are most difficult when you're most certain. Today, hold your certainty lightly.",
    "The friendship that's evolved into something complicated deserves direct attention. Give it.",
    "You process the world through systems. There is one person who doesn't fit the system and you keep thinking about them. That's data.",
    "Your ability to see the long arc is a gift. Today requires seeing the next five minutes.",
    "Something about the way you've been living is about to change. You've known this for a while.",
    "Your originality is not a strategy — it's your nature. Trust it even when it confuses people.",
    "The cause you've committed to is real. Make sure the commitment hasn't become an identity without a practice.",
    "There's loneliness in always being slightly ahead. Acknowledge it. It doesn't make you less visionary.",
    "You are building something. Make sure there's room in it for you to be a person, not just a builder.",
    "Someone is trying to reach you through the systems you've put up. Let them.",
    "Your idealism is not naïveté. It is a choice. Keep choosing it, but with your eyes open.",
    "The future belongs to what you're becoming. The present belongs to who you already are. Don't lose track.",
  ],
  Pisces: [
    "The feeling that's been following you is real. It belongs to you, not to the situation it attached to.",
    "Your empathy absorbs what others discard. Check what you've been holding that isn't yours.",
    "The dream you had — not the sleeping one — hasn't been attended to in some time. Return to it.",
    "You know the answer. You're waiting to know it more certainly. You won't. Trust what you already know.",
    "The boundary you haven't drawn is costing you in ways that are becoming harder to ignore.",
    "There is beauty in what's in front of you that you've been too inside it to see. Step back.",
    "Your sensitivity is a precision instrument. It is currently tuned to everyone else's signal.",
    "Something is ending and it is right for it to end and you are sad and both of those things are true.",
    "The escape you're planning will not be there when you return. What would it mean to be here instead?",
    "You have given people the version of yourself they could handle. Show someone the rest.",
    "The art you've been carrying in your chest needs to leave your chest. Make something.",
    "Your instinct for when something is wrong is almost never incorrect. Trust it today specifically.",
    "There is love available to you right now in a form you haven't fully accepted. Receive it.",
    "You dissolve into the spaces you inhabit. Make sure the space deserves you.",
    "Someone's pain has become your pain. This is your nature. Also: you are allowed to put it down.",
    "The boundary between you and other people is more permeable than average. This is your gift and your difficulty.",
    "What you're calling chaos is actually pattern — you can see it if you look from further away.",
    "The sacrifice you made was real and it was meaningful and it is done. You don't have to keep paying.",
    "You are more resilient than the softness suggests. Remind yourself.",
    "Something you're avoiding is actually not as bad as what avoiding it costs you.",
    "Your imagination is the realest thing about you. Don't let the practical world convince you otherwise.",
    "There is a person in your life who is grounding and steadying and you take them for granted. Don't.",
    "The mood that comes in like water recedes like water too. Stay with it until it does.",
    "You've been generous with your understanding of others. Apply some to yourself.",
    "The spiritual dimension of what you're experiencing is real. Trust that frame alongside the practical one.",
    "Something that felt like intuition was actually projection. Distinguish between them carefully.",
    "Your relationship with reality is flexible by nature. Today, anchor to something concrete.",
    "The grief hasn't finished moving through you. Let it continue.",
    "You see people at their most essential. Let someone see you that way too.",
    "The current is strong today. You can swim with it and choose your direction within it.",
  ],
};
// ── Compatibility matrix builder ───────────────────────────────────────────────
const COMPAT_SYNTH = {
  'Fire-Fire': [
    "You recognised each other immediately. Whether that's good news depends entirely on what you recognised.",
    "There is enough heat between you to forge something remarkable or burn it all down. Usually both.",
    "The competition is never stated and never absent. You perform for each other even when you don't mean to.",
    "Together you are louder, brighter, and harder to ignore. Whether that's what you need is a different question.",
    "You both arrived wanting to lead. The negotiation of who does is where most of the energy goes.",
    "You give each other permission to be more yourselves. Sometimes that permission is exactly the problem.",
    "The warmth is real. So is the risk that you start competing over it rather than sharing it.",
    "Neither of you knows how to be small around the other. Decide if that's exhilarating or just exhausting.",
  ],
  'Earth-Earth': [
    "You recognise each other's methods. Whether that familiarity breeds trust or contempt is up to you.",
    "You build things that last. The slower the construction, the less you talk about what might be missing.",
    "Reliability offered freely in both directions. What neither of you is good at is saying what you actually want.",
    "The practical language between you is fluent and efficient. The emotional one takes more effort from both.",
    "You anchor each other well. Make sure neither of you has quietly agreed to stop moving entirely.",
    "Shared values make for comfort. They also make it easier to avoid the conversation you keep not having.",
    "Neither of you wastes anything. The question is whether you're saving the relationship or just managing it.",
    "The security you build together is real. Real security sometimes disguises the need for something more.",
  ],
  'Air-Air': [
    "The conversation never stops. Decide if what you're talking around is more interesting than what you'd find if you arrived.",
    "You make each other sharper. You also make each other better at avoiding the things words can't fix.",
    "Intellectually, this is effortless. Emotionally, you're both still waiting for the other to go first.",
    "Together you can analyse anything. The one thing neither of you wants to analyse is this.",
    "You understand each other at a speed that feels like recognition. Familiarity this fast always hides something.",
    "You're rarely bored together. Occasionally you're frustrated by the inability to just be still.",
    "The ideas between you breed more ideas. At some point one of them needs to become something real.",
    "You both live a little inside your heads. When you're together, the heads get very crowded.",
  ],
  'Water-Water': [
    "You feel each other before you know each other. Whether that's intimacy or projection is worth examining.",
    "The depth here is real and a little unnerving to both of you.",
    "Nobody outside this pairing fully understands what happens inside it. That's exactly how you want it.",
    "You absorb each other's moods completely. Make sure the current is flowing in a direction you chose.",
    "The emotional fluency here is extraordinary. The risk is drowning in it before finding solid ground.",
    "You both know how to hold pain without speaking. Decide if that's strength or evasion.",
    "The bond forms quietly and completely. What you've bonded over — desire, or need — is worth knowing.",
    "You see each other clearly enough to hurt each other precisely. That's not a warning. It's just the truth.",
  ],
  'Earth-Fire': [
    "One of you wants to move before it's ready. One of you wants to wait until it's certain. Neither will be satisfied.",
    "Something transformative is possible here — if neither of you insists on doing it alone.",
    "The heat is useful when the earth channels it. The earth is useful when the fire can wait long enough.",
    "In theory you stabilise each other. In practice, one of you always feels slightly extinguished.",
    "There's something genuinely generative in the friction. Whether either of you can tolerate friction is the question.",
    "You work well when one agrees to be the foundation and the other agrees to be the spark. Agreement is the hard part.",
    "Your natural speeds are different. Finding the pace that doesn't frustrate either of you is the whole project.",
    "The slow materials and the fast energy can build something neither could alone. Patience is required from the fire.",
  ],
  'Fire-Air': [
    "You make each other more — more energised, more expansive, occasionally more than either of you can contain.",
    "You accelerate each other. The direction you're heading is worth establishing before you reach full speed.",
    "There's real joy between you when you're moving. The stillness is harder for both of you, and necessary.",
    "You're both good at starting things. One of you will have to become better at finishing them.",
    "The energy is contagious. People feel it from the outside. Make sure you both still feel it from the inside.",
    "Something about this combination feels irresistible to both of you. That irresistibility is worth examining.",
    "You bring out ambition in each other. Whose ambition you're actually serving is a fair question.",
    "The air feeds the fire, the fire warms the air. You both tend to enjoy this too much to notice when it tips.",
  ],
  'Fire-Water': [
    "You want incompatible things from closeness. That tension is generative until it isn't.",
    "The intensity is real. Whether it's connection or pressure depends on which day you're asking.",
    "You affect each other immediately and completely. That's not always comfortable and not always harmful.",
    "The attraction was always obvious. The sustainability is the question neither of you has fully answered.",
    "One of you runs toward; one guards the door. The dance is interesting until someone gets tired.",
    "You challenge each other's default mode — which is either exactly what you needed or what you weren't ready for.",
    "The heat and the depth exist in real tension. That tension is the most honest thing between you.",
    "You are changed by proximity to each other. This is not neutral, and it was never going to be.",
  ],
  'Air-Earth': [
    "One of you is always explaining why it should move. One of you is quietly proving why it works as it is.",
    "You need each other more than you'll admit, and you both demonstrate this through argument.",
    "The ideas need grounding. The ground needs ideas. Neither of you finds this as obvious as it sounds.",
    "What you bring each other is exactly what the other struggles to generate alone. This should be easy. It isn't.",
    "Your different relationships with time are either the most useful thing about this or the most exhausting.",
    "The friction between you is productive until the day one of you decides it isn't worth it. Don't let it go that long.",
    "You complement each other in ways neither fully acknowledges. The acknowledgment is the missing piece.",
    "You each think the other is slightly impractical, and you're both right about each other, and wrong.",
  ],
  'Earth-Water': [
    "You offer each other what you each struggle most to give yourself: one of you offers ground, one of you offers feeling.",
    "This tends to become quietly necessary to both people before either admits it.",
    "The support here is genuine and sometimes suffocating. The line between them is worth watching.",
    "You care for each other in ways that are practical and non-intrusive. Neither says much. Both notice everything.",
    "The stability and the depth work well together — until they work too well and nobody grows.",
    "One of you protects, one of you nourishes. At some point both of you need to be taken care of.",
    "The foundation feels natural because it is. What gets built on top of it requires more deliberate attention.",
    "You move at similar speeds, value similar things. That similarity is either comfort or camouflage.",
  ],
  'Air-Water': [
    "You reach each other through completely different routes. The meeting place is interesting and unstable.",
    "One of you explains. One of you feels. At some point the explaining stops helping.",
    "The connection is real and confusing to both of you. You're not sure how it works. It works anyway.",
    "You make each other think differently — one about the world, one about themselves. That's not nothing.",
    "The mismatch in how you process things is a feature in good times and a fault line in bad ones.",
    "You're both drawn to what the other has access to. Whether you can access it in each other is the question.",
    "The emotional and the intellectual are in conversation here. When it works, it's singular. When it doesn't, it's lonely.",
    "You each feel slightly alien to the other. That's either the draw or the obstacle. Often both.",
  ],
};

const MODALITY_BONUS = {
  'Cardinal-Cardinal': -8,
  'Cardinal-Fixed':     0,
  'Cardinal-Mutable':   5,
  'Fixed-Fixed':       -5,
  'Fixed-Mutable':      8,
  'Mutable-Mutable':   10,
};

function compatibilityLevel(score) {
  if (score >= 90) return 'Exceptional';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 60) return 'Compatible';
  if (score >= 50) return 'Moderate';
  if (score >= 40) return 'Challenging';
  if (score >= 30) return 'Volatile';
  return 'Difficult';
}

function buildCompatibilityMatrix(rng) {
  const matrix = {};

  for (let i = 0; i < SIGNS.length; i++) {
    for (let j = i; j < SIGNS.length; j++) {
      const a = SIGNS[i], b = SIGNS[j];
      const key = `${a}-${b}`;

      const elemA = ELEMENTS[a], elemB = ELEMENTS[b];
      const modA  = MODALITIES[a], modB  = MODALITIES[b];

      // Base element harmony score
      const elemKey = [elemA, elemB].sort().join('-');
      const elementHarmony = {
        'Fire-Fire': 88, 'Earth-Earth': 90, 'Air-Air': 87, 'Water-Water': 92,
        'Earth-Fire': 55, 'Air-Fire': 82,   'Fire-Water': 35, 'Air-Earth': 60,
        'Earth-Water': 78, 'Air-Water': 68,
      }[elemKey] ?? 60;

      // Modality adjustment
      const modKey = [modA, modB].sort().join('-');
      const modBonus = MODALITY_BONUS[modKey] ?? 0;

      // Same-sign bonus
      const sameSign = a === b ? 5 : 0;

      // Small seeded variance (±5) so pairs don't all have round numbers
      const variance = Math.round((rng() - 0.5) * 10);

      const score = Math.min(99, Math.max(20,
        Math.round(elementHarmony * 0.6 + 50 * 0.4 + modBonus + sameSign + variance)
      ));

      // Pick synthesis from the element-pair pool
      const synthPool = COMPAT_SYNTH[elemKey] || COMPAT_SYNTH[[elemB,elemA].join('-')] || ["Unique compound formed. Properties unpredictable — explore with caution."];
      const synthesis = pick(synthPool, rng);

      matrix[key] = {
        score,
        level: compatibilityLevel(score),
        synthesis,
        element_harmony: elementHarmony,
      };
    }
  }

  return matrix;
}

// ── Main ───────────────────────────────────────────────────────────────────────
function main() {
  const today     = new Date();
  const yesterday = new Date(today.getTime() - 86400000);

  // Format date as YYYY-MM-DD using UTC
  const dateStr = today.toISOString().slice(0, 10);

  // Calculate planetary longitudes
  const lons      = planetaryLongitudes(today);
  const lonsYest  = planetaryLongitudes(yesterday);

  // Build planetary_positions object
  const planetNames = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune'];
  const positions   = {};

  for (const p of planetNames) {
    const { sign, degree } = toZodiac(lons[p]);
    const retro = isRetrograde(lons[p], lonsYest[p]);
    const entry = { sign, degree, retrograde: retro };
    if (p === 'moon') {
      entry.phase = moonPhase(lons.moon, lons.sun);
    }
    positions[p] = entry;
  }

  // Major aspects (use all planets)
  const lonMap = {};
  for (const p of planetNames) lonMap[p] = lons[p];
  const aspects = findAspects(lonMap);

  // Seeded daily readings — seed is today's date so every run today gives same output
  const rng = makePRNG(dateSeed(today));

  // Pick one reading per sign from its pool (advances the rng state)
  const readings = {};
  for (const sign of SIGNS) {
    readings[sign] = pick(READING_POOLS[sign], rng);
  }

  // Build compatibility matrix (uses rng for variance — called after readings
  // so the variance seed position is stable regardless of reading pool sizes)
  const compatibilityMatrix = buildCompatibilityMatrix(rng);

  // Assemble output
  const output = {
    lastUpdated: dateStr,
    planetary_positions: positions,
    major_aspects: aspects,
    readings,
    compatibility_matrix: compatibilityMatrix,
    calculation_methods: [
      "Planetary longitudes: Jean Meeus 'Astronomical Algorithms' low-precision formulae (±1° accuracy)",
      "Retrograde: computed from direction of longitude change vs previous day",
      "Aspects: angular separation with standard orbs (conjunction 8°, sextile 6°, square/trine/opposition 8°, quincunx 3°)",
      "Compatibility: element harmony base score + modality adjustment + date-seeded variance",
      "Daily readings: deterministic date-seed (PRNG) selects from per-sign reading pools; changes each day",
    ],
  };

  // Write to both data/ (static fetch) and _data/ (Jekyll site.data)
  for (const outPath of [OUT_DATA, OUT_JDATA]) {
    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`✅ Wrote ${outPath}`);
  }
  console.log(`   Date: ${dateStr}`);
  console.log(`   Sun: ${positions.sun.sign} ${positions.sun.degree}°`);
  console.log(`   Moon: ${positions.moon.sign} ${positions.moon.degree}° (${positions.moon.phase})`);
  console.log(`   Mercury: ${positions.mercury.sign}${positions.mercury.retrograde ? ' ℞' : ''}`);
  console.log(`   Venus: ${positions.venus.sign}${positions.venus.retrograde ? ' ℞' : ''}`);
  console.log(`   Mars: ${positions.mars.sign}${positions.mars.retrograde ? ' ℞' : ''}`);
  console.log(`   Aspects found: ${aspects.length}`);
  console.log(`   Compatibility pairs: ${Object.keys(compatibilityMatrix).length}`);
}

main();
