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

const READING_POOLS = {
  Aries: [
    "Kinetic output at maximum. Initiate reaction sequence — catalyst required for full yield.",
    "Activation energy barrier low. First-mover advantage confirmed. Begin the experiment.",
    "High-velocity particle detected. Collision imminent — harness the momentum before decay.",
    "Combustion parameters optimal. Controlled burn yields maximum thermal output today.",
    "Action potential firing. Synaptic chain reaction propagates — strike while the dendrite is receptive.",
    "Red-shift detected. You are moving fast — ensure trajectory aligns with target coordinates.",
    "Exothermic process underway. Channel the energy release; unchecked, it scorches the substrate.",
  ],
  Taurus: [
    "Stable baseline established. Ideal conditions for long-term incubation of slow-growth cultures.",
    "Crystal lattice integrity verified. Structural persistence exceeds all stress-test parameters.",
    "Low activation energy required. Conserve reagents; patience is the superior catalyst.",
    "Homeostatic equilibrium achieved. Maintain current setpoint — deviation carries high cost.",
    "Dense substrate detected. Dissolution requires prolonged exposure; resist premature agitation.",
    "Ground-state energy confirmed. The lowest energy configuration is also the most stable.",
    "Tectonic patience rewarded. Slow-moving plates reshape continents; results will be continental.",
  ],
  Gemini: [
    "High-throughput data stream incoming. Activate dual-channel processing; filter signal from noise.",
    "Bifurcation event detected. Two viable reaction pathways — simultaneous exploration recommended.",
    "Frequency modulation optimal. Transmit on multiple bands; one signal will penetrate the medium.",
    "Quantum superposition active. Commit to one eigenstate before decoherence collapses the function.",
    "Synaptic cross-talk elevated. Reduce cognitive load; parallel processing exceeds bandwidth.",
    "Rapid prototyping phase. Iterate fast — convergence emerges from many failed hypotheses.",
    "Binary system detected. Both components are equally luminous; focus determines which dominates.",
  ],
  Cancer: [
    "Cellular membrane permeability reduced. Protective protocols engaged — selective transport only.",
    "Osmotic pressure gradient high. Maintain semipermeable boundary; allow beneficial ions through.",
    "Nesting behaviour observed in subject. Optimal microenvironment supports maximum proliferation.",
    "pH buffer capacity exceeded. Internal chemistry stabilised by homeostatic feedback loop.",
    "Bioluminescent signal: warmth detected in proximity. Signal reciprocated — binding affinity high.",
    "Circadian rhythm aligned with lunar cycle. Tidal biology governs the experiment today.",
    "Immune response primed. Threat neutralised at the boundary before reaching the core.",
  ],
  Leo: [
    "Luminescence far exceeding standard curve. Fluorescence off-scale — recalibrate the detector.",
    "Stellar output at peak main-sequence luminosity. Energy radiated across all wavelengths.",
    "Autocrine signalling loop active. Self-amplification proceeding — monitor for runaway cascade.",
    "Chromatin fully open. Every gene available for transcription; expression is unrestricted.",
    "Solar flare probability: high. Coronal mass ejection forecast — shield sensitive instruments.",
    "Photosynthetic efficiency maximum. All incoming photons converted to chemical potential.",
    "Signal-to-noise ratio excellent. The sample stands out from background — no amplification needed.",
  ],
  Virgo: [
    "QC protocols running at optimal parameters. Error rate at statistical minimum — data trustworthy.",
    "Precision pipetting mode engaged. Coefficient of variation < 2%; reproducibility confirmed.",
    "Systematic review complete. Meta-analysis yields high-confidence conclusion. Proceed with publication.",
    "Contaminant eliminated by rigorous decontamination protocol. Sample purity: >99.9%.",
    "Algorithm convergence achieved. Local minimum confirmed as global minimum after exhaustive search.",
    "Calibration curve linear across five orders of magnitude. Measurement uncertainty negligible.",
    "Peer review feedback incorporated. Methodology now bulletproof. Submit with confidence.",
  ],
  Libra: [
    "Equilibrium achieved. Chemical potential equal on both sides of the membrane — no net flux.",
    "Balanced equation confirmed. Reactants and products in perfect stoichiometric ratio.",
    "Phase diagram intersection: triple point. All three states coexist — a rare stability window.",
    "Titration endpoint reached. Indicator colour change observed — neutralisation complete.",
    "Cooperative binding detected. Hill coefficient > 1; allosteric symmetry drives efficiency.",
    "Symmetric crystal structure resolved by X-ray diffraction. Elegant lattice, low defect density.",
    "Feedback loop balanced. Neither positive nor negative dominates — ideal regulatory state.",
  ],
  Scorpio: [
    "Deep tissue penetration achieved. Probe accessing hidden substrates below the surface matrix.",
    "Dark matter density elevated. Invisible forces governing observable behaviour — map the field.",
    "Enzymatic cleavage at the restriction site. Expose the sequence concealed within the vector.",
    "Redox potential maximally negative. Strong reductant active — old bonds will be broken today.",
    "Electron transfer chain uncoupled. Power diverted to internal reserve — regeneration underway.",
    "X-ray crystallography resolves the binding pocket. Hidden active site now fully exposed.",
    "Apoptotic signal pathway activated — selective elimination clears the way for renewal.",
  ],
  Sagittarius: [
    "Sampling range extended to maximum field radius. Novel variants detected in unexplored territory.",
    "Hypothesis expansion warranted. Current model insufficient — seek data from the periphery.",
    "Projectile motion: optimal launch angle confirmed at 45°. Maximum range achieved.",
    "Long-read sequencing initiated. Full-length transcript reveals structure invisible to short reads.",
    "Telescope field of view widened. Faint objects at the survey limit now within detection threshold.",
    "Migratory behaviour confirmed. Long-distance dispersal carries adaptive payload to new habitat.",
    "Extrapolation beyond training domain. Model generalises — confidence interval acceptable at range.",
  ],
  Capricorn: [
    "Structural integrity: 100%. Scaffold construction proceeding on schedule, under budget.",
    "Rock-solid substrate detected. Sedimentary record encodes millions of years of information.",
    "Long-term experiment endpoint approaching. Controls held steady; results will be definitive.",
    "Compression test passed at maximum load. Material yields precisely at the theoretical limit.",
    "Geological timescale perspective engaged. Short-term variance is noise; the trend is your data.",
    "Crystallisation from supersaturated solution. Patience yields the largest, purest crystal.",
    "Cold laboratory conditions favourable. Slow kinetics allow precise control of product formation.",
  ],
  Aquarius: [
    "Novel mutation observed at conserved locus. Breaking established paradigms — verify with sequencing.",
    "Phase transition to superconducting state. Resistance drops to zero; current flows without loss.",
    "Emergent behaviour detected in complex system. Individual rules insufficient to predict the whole.",
    "Atmospheric anomaly recorded. Standard model fails — new physics required to explain the signal.",
    "Network topology shift: small-world regime. Information propagates with unexpected efficiency.",
    "Rare isotope detected. Half-life inconsistent with known decay series — update the chart.",
    "Open-source release imminent. Methodology distributed to all nodes — collective intelligence activated.",
  ],
  Pisces: [
    "Fluid dynamics enter turbulent regime. Permeability increased — boundaries are now negotiable.",
    "Diffusion coefficient elevated. Solute dispersing freely through the medium without direction.",
    "Bioluminescence observed in aphotic zone. Life persists in conditions previously deemed hostile.",
    "Osmotic flux bidirectional. Water follows its own gradient — do not resist the natural direction.",
    "Quantum tunnelling probability non-negligible. The barrier is penetrable without classical energy.",
    "Tidal mixing event underway. Deep water upwells, cold nutrients reach the photic zone.",
    "Chaotic attractor detected. Sensitivity to initial conditions extreme — small inputs, large effects.",
  ],
};

// ── Compatibility matrix builder ───────────────────────────────────────────────
const COMPAT_SYNTH = {
  'Fire-Fire':   ["Exothermic cascade — self-sustaining combustion reaction.", "Thermal runaway risk. Regulate heat exchange or the reaction overshoots."],
  'Earth-Earth': ["Crystal lattice formation perfect. Highly reproducible, long-duration results.", "Compressive force builds — pressure either forges diamonds or fractures the substrate."],
  'Air-Air':     ["Laminar flow achieved. Rapid diffusion of ideas across the shared medium.", "Turbulence possible at high Reynolds number. Ground the system before resonance builds."],
  'Water-Water': ["Perfect miscibility. Solution becomes homogeneous — merged into a single phase.", "Dilution without limit. Maintain concentration; boundaryless diffusion loses potency."],
  'Fire-Earth':  ["Magma interface: creative heat meets resistant substrate — transformation possible.", "Cooling rate mismatch. Rapid quench produces amorphous glass; slow cool yields crystal."],
  'Fire-Air':    ["Oxygen-fed combustion — air accelerates the fire's reach and intensity.", "Fuel-air ratio must be monitored. Excess oxidiser without fuel produces nothing but heat loss."],
  'Fire-Water':  ["Phase separation likely. Requires surfactant or emulsifier for stable suspension.", "Steam generated at interface. Energy converts but both phases are changed by contact."],
  'Earth-Air':   ["Dust suspension in gas phase. Settled earth needs air movement to reach its potential.", "Erosion possible. Persistent airflow reshapes even the most resistant substrate over time."],
  'Earth-Water': ["Saturated matrix supports life. Water activates nutrients locked in terrestrial substrate.", "Over-saturation leads to anoxic conditions. Drainage required to prevent root rot."],
  'Air-Water':   ["Gas exchange at liquid surface. Oxygen transfer drives the aerobic metabolism.", "Evaporation without containment. Volatile pairing — powerful but requires sealed vessel."],
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
