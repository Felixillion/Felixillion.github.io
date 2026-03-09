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
    "Kinetic output at maximum. Initiate reaction sequence — catalyst required for full yield.",
    "Activation energy barrier low. First-mover advantage confirmed. Begin the experiment.",
    "High-velocity particle detected. Collision imminent — harness the momentum before decay.",
    "Combustion parameters optimal. Controlled burn yields maximum thermal output today.",
    "Action potential firing. Synaptic chain reaction propagates — strike while the dendrite is receptive.",
    "Red-shift detected. You are moving fast — ensure trajectory aligns with target coordinates.",
    "Exothermic process underway. Channel the energy release; unchecked, it scorches the substrate.",
    "Spontaneous ignition risk elevated. Pre-warm the reaction vessel; cold starts cause incomplete combustion.",
    "Free radical cascade initiated. Antioxidant buffer recommended before downstream damage occurs.",
    "Impulse response sharp and immediate. Latency at zero — but consider second-order effects before committing.",
    "Fission event imminent. Enormous energy released from a small nucleus — chain reaction self-sustaining.",
    "Velocity vector confirmed: forward. Reverse thrust requires 3× the energy expenditure — commit.",
    "Plasma state achieved. Too hot for liquid, too energised for solid — a unique phase of matter.",
    "Cortisol spike detected. Fight-or-flight response primed; redirect to productive experimental output.",
    "Brownian motion elevated. Random thermal collisions producing net directional displacement today.",
    "Deflagration, not detonation — controlled burn rather than explosive release yields better data.",
    "Zero-point energy nonzero. Even at rest, you radiate. The vacuum state is never truly empty.",
    "Reaction rate constant k elevated. Arrhenius equation confirms: temperature increase accelerates all kinetics.",
    "Combustion chamber pressure nominal. Ignition sequence confirmed — thrust vectoring aligned.",
    "Mitotic spindle tensioned to maximum. Division proceeds at maximum fidelity and speed.",
    "Resting membrane potential discharged. Full depolarisation propagates — the signal is irreversible.",
    "Explosive crystallisation: supersaturation exceeds nucleation threshold. Rapid growth erupts from the seed.",
    "Endothermic plateau broken. Activation energy finally overcome — spontaneous reaction now self-sustaining.",
    "Ground-to-excited state transition: absorb the photon, do not re-emit before work is done.",
    "Particle beam collimated and targeted. Precision impact delivers maximum energy to the selected substrate.",
    "Adrenaline homologue detected in pathway. Receptor saturation imminent — act before the feedback loop closes.",
    "Hypersonic entry angle confirmed. Burn bright through the atmosphere; trajectory locked.",
    "Autocatalytic loop engaged. Each product generates more catalyst — exponential acceleration ahead.",
    "Threshold potential reached. All-or-nothing principle invoked — there is no partial action today.",
    "Supersonic shock wave propagating. The sonic boom follows only after you have already arrived.",
  ],
  Taurus: [
    "Stable baseline established. Ideal conditions for long-term incubation of slow-growth cultures.",
    "Crystal lattice integrity verified. Structural persistence exceeds all stress-test parameters.",
    "Low activation energy required. Conserve reagents; patience is the superior catalyst.",
    "Homeostatic equilibrium achieved. Maintain current setpoint — deviation carries high cost.",
    "Dense substrate detected. Dissolution requires prolonged exposure; resist premature agitation.",
    "Ground-state energy confirmed. The lowest energy configuration is also the most stable.",
    "Tectonic patience rewarded. Slow-moving plates reshape continents; results will be continental.",
    "Van der Waals interactions accumulating. Individually weak, collectively they hold everything in place.",
    "Sedimentary record being laid down. Each lamination encodes the conditions of its exact moment.",
    "Ossification process progressing. Flexible cartilage mineralises into permanent supporting structure.",
    "Bulk modulus high — this system resists compression. External pressure redistributed, structure holds.",
    "Fermentation kinetics: slow steady-state conversion. Yeasts don't rush; the product improves with time.",
    "Phase-locked oscillator detected. Frequency stable. Drift minimised. Reliability maximised.",
    "Mineral precipitation from saturated solution. Slow cooling yields pure crystals of exceptional quality.",
    "Photosynthetic biomass accumulation underway. Energy stored methodically, gram by gram, for future use.",
    "Hardness Mohs 9: approaches diamond. Resistant to scratching by anything of lesser resolve.",
    "Entropy locally reversed by metabolic work. Order maintained against the thermodynamic gradient — costly but worthy.",
    "Hydrogen bond network intact. Many weak interactions produce a surprisingly strong and stable matrix.",
    "Geological compression history reads: patient deposition → lithification → mountain formation. Process confirmed.",
    "Thermal mass elevated. Slow to heat, slow to cool — buffering the extremes, stabilising the mean.",
    "Cellular wall reinforced with lignin. Rigidity conferred; flexible youth has converted to structural strength.",
    "Dendritic growth proceeding at minimal undercooling. The slowest crystal is the most perfect.",
    "Peristaltic transport confirmed — methodical, rhythmic propulsion. No bolus left behind.",
    "Binding affinity Kd in nanomolar range. Lock-and-key specificity achieved through patient optimisation.",
    "Biofilm matrix fully established. Community protected beneath polysaccharide armour — stable for the season.",
    "Signal transduction cascade slow but irreversible. Once committed, the conformational change is permanent.",
    "Resting metabolic rate optimised. Basal consumption minimal; reserves accumulate for long-duration task.",
    "Compressive strength test: passed at 400 MPa. This substrate will not yield before the applied load does.",
    "Protein folding complete. Thermodynamically favoured conformation achieved; native state fully populated.",
    "Fossil record unambiguous. Persistence across geological epochs is the only meaningful measure of success.",
  ],
  Gemini: [
    "High-throughput data stream incoming. Activate dual-channel processing; filter signal from noise.",
    "Bifurcation event detected. Two viable reaction pathways — simultaneous exploration recommended.",
    "Frequency modulation optimal. Transmit on multiple bands; one signal will penetrate the medium.",
    "Quantum superposition active. Commit to one eigenstate before decoherence collapses the function.",
    "Synaptic cross-talk elevated. Reduce cognitive load; parallel processing exceeds bandwidth.",
    "Rapid prototyping phase. Iterate fast — convergence emerges from many failed hypotheses.",
    "Binary system detected. Both components are equally luminous; focus determines which dominates.",
    "Multiplex assay configuration enabled. Twelve analytes measured simultaneously from a single sample.",
    "Information entropy elevated. Reduce redundancy in signal; compress before transmission.",
    "Flip-flop logic gate oscillating. Both stable states valid — output determined by most recent input.",
    "RNA alternative splicing event. Same pre-mRNA, entirely different protein — context rewrites meaning.",
    "Double-stranded helix: two antiparallel strands, one coherent message. Complementarity enables function.",
    "Wave-particle duality active. Behave like a wave when unobserved, a particle when measured.",
    "Polymorphism in the codebase. Same interface, multiple implementations — elegance through abstraction.",
    "Axon branching coefficient high. One signal distributed to many downstream targets simultaneously.",
    "Allelic heterozygosity confirmed. Both variants expressed; phenotypic range maximised.",
    "Recombination event detected at crossover hotspot. Novel combination assembled from available parts.",
    "Dual-wavelength excitation available. Switch between channels to reveal what single-band misses.",
    "Signal multiplexed across two carriers. Demodulate carefully to recover both independent messages.",
    "Neurotransmitter reuptake rapid. Recovery between thoughts faster than average — process more cycles.",
    "Lateral gene transfer confirmed. Knowledge acquired from unexpected source; integration successful.",
    "Chimeric transcript produced. Two separate genes fused at the junction — unprecedented protein results.",
    "Spectral unmixing required. Multiple fluorochromes overlap — mathematical separation reveals the truth.",
    "Decision tree branching at every node. Each path valid; outcome space expansive and well-mapped.",
    "Network packet switched, not circuit switched. No fixed path — data finds its own optimal route.",
    "Cerebral lateralisation ambiguous. Left and right hemispheres both claiming jurisdiction — negotiate.",
    "Cross-correlation between two signals: high. The datasets mirror each other — shared origin suspected.",
    "Parallax measurement possible. Two independent viewpoints triangulate the true position precisely.",
    "Mirror neuron activation: simultaneously simulating observer and observed perspectives.",
    "Duplexed probe hybridised. Both targets captured — single experiment yields twice the insight.",
  ],
  Cancer: [
    "Cellular membrane permeability reduced. Protective protocols engaged — selective transport only.",
    "Osmotic pressure gradient high. Maintain semipermeable boundary; allow beneficial ions through.",
    "Nesting behaviour observed in subject. Optimal microenvironment supports maximum proliferation.",
    "pH buffer capacity exceeded. Internal chemistry stabilised by homeostatic feedback loop.",
    "Bioluminescent signal: warmth detected in proximity. Signal reciprocated — binding affinity high.",
    "Circadian rhythm aligned with lunar cycle. Tidal biology governs the experiment today.",
    "Immune response primed. Threat neutralised at the boundary before reaching the core.",
    "Dendritic cell maturation complete. Antigen presented; adaptive immune arm now fully briefed.",
    "Wound healing cascade initiated. Platelet plug, clot, then tissue remodelling — sequential and precise.",
    "Chemoreceptor sensitivity elevated. Trace signal concentrations detectable at the femtomolar level.",
    "Interleukin signalling network active. Cytokine gradient communicates distress to distant responders.",
    "Uterine implantation window open. The receptive phase is time-limited — act within it.",
    "Oxytocin receptor density elevated. Prosocial binding behaviour strongly favoured in current conditions.",
    "Mucus barrier thickness optimal. Pathogens excluded; commensal microbiome protected and thriving.",
    "Maternal immune tolerance established. Self and non-self distinguished with precision and mercy.",
    "G-protein coupled receptor conformational change: slow, deliberate, deeply allosteric.",
    "Endoplasmic reticulum stress response: chaperone proteins mobilised to rescue misfolded cargo.",
    "Phagocytic engulfment confirmed. Threat internalised, neutralised, and digested — no trace remains.",
    "Amygdala activation noted. Emotional salience encoded for long-term retrieval — this matters.",
    "Caretaking behaviour pattern confirmed in model organism. Inclusive fitness maximised.",
    "Innate immune pattern recognition: TLR engagement at the perimeter — first-responder alert issued.",
    "Tight junction integrity verified. Epithelial barrier closed; paracellular leakage = zero.",
    "Cortisol suppressed, DHEA elevated. Nurturing hormonal milieu favours connection over competition.",
    "Apical membrane specialised for absorption. Microvilli increase surface area — efficient and caring.",
    "Mast cell degranulation restrained. Hypersensitivity response modulated — reaction proportionate to threat.",
    "Circadian gene expression peaks. CLOCK-BMAL1 complex drives the tidal rhythm of cellular life.",
    "Passive transport favoured. Energy conserved by following the gradient rather than fighting it.",
    "Exosome release detected. Membrane vesicles carry molecular messages to distant cellular neighbours.",
    "Regulatory T-cell expansion confirmed. Tolerance enforced; inflammatory excess suppressed with precision.",
    "The basement membrane holds. Structural anchor of the epithelium — unseen, essential, permanent.",
  ],
  Leo: [
    "Luminescence far exceeding standard curve. Fluorescence off-scale — recalibrate the detector.",
    "Stellar output at peak main-sequence luminosity. Energy radiated across all wavelengths.",
    "Autocrine signalling loop active. Self-amplification proceeding — monitor for runaway cascade.",
    "Chromatin fully open. Every gene available for transcription; expression is unrestricted.",
    "Solar flare probability: high. Coronal mass ejection forecast — shield sensitive instruments.",
    "Photosynthetic efficiency maximum. All incoming photons converted to chemical potential.",
    "Signal-to-noise ratio excellent. The sample stands out from background — no amplification needed.",
    "Quantum yield at theoretical maximum. Every absorbed photon produces an emitted one — perfect fluorophore.",
    "Absolute magnitude superior to surrounding objects by 2.5 magnitudes. Luminosity speaks for itself.",
    "T-cell cytotoxic activity: maximal. Perforin and granzyme deployed with theatrical precision.",
    "Transcription factor binding domain occupied. Gene expression cascades outward from a single master regulator.",
    "Carotenoid display pigmentation optimal. Colouration signals fitness — honest advertising confirmed.",
    "Alpha helix conformation dominant. The backbone coils with authority; secondary structure impeccable.",
    "Bioluminescence confirmed in deep environment. The only light source in the vicinity — commanding.",
    "Nuclear pore complex fully patent. Cargo exported without restriction; presence felt in every compartment.",
    "Photoreceptor saturation by abundant photons. The signal cannot be brighter — detector at maximum.",
    "Chromogenic substrate fully converted. Colour intensity exceeds the standard — off-chart performance.",
    "Heat shock protein expression induced. The cell's emergency response, marshalled and spectacular.",
    "Centralised genome regulatory hub active. All chromosomes converging on the same transcription factory.",
    "Stellar nucleosynthesis: carbon, oxygen, iron forged at core under extreme conditions.",
    "Viral capsid self-assembly complete. Symmetrical icosahedral perfection — architecture of nature.",
    "Positive feedback cascade: the more output produced, the more pathway is activated. Glorious amplification.",
    "Stage IV presentation confirmed. Full systemic involvement — no longer local, now operating everywhere.",
    "Maximum power transfer theorem: impedance matched. Every last watt delivered to the intended recipient.",
    "Western blot band intensity saturated. Too much protein — even diluted 1:100 it dominates the lane.",
    "Dominant allele confirmed. Single copy sufficient to determine the entire phenotype unambiguously.",
    "Luminosity class I: supergiant. All other stellar categories are simply scaled-down comparisons.",
    "FRET efficiency 98%. Donor and acceptor so close the energy transfer is essentially instantaneous.",
    "Expression construct driven by CMV promoter — maximum constitutive transcription. Always on, always high.",
    "Coronary vasodilation confirmed. Increased perfusion to the core ensures sustained high-output performance.",
  ],
  Virgo: [
    "QC protocols running at optimal parameters. Error rate at statistical minimum — data trustworthy.",
    "Precision pipetting mode engaged. Coefficient of variation < 2%; reproducibility confirmed.",
    "Systematic review complete. Meta-analysis yields high-confidence conclusion. Proceed with publication.",
    "Contaminant eliminated by rigorous decontamination protocol. Sample purity: >99.9%.",
    "Algorithm convergence achieved. Local minimum confirmed as global minimum after exhaustive search.",
    "Calibration curve linear across five orders of magnitude. Measurement uncertainty negligible.",
    "Peer review feedback incorporated. Methodology now bulletproof. Submit with confidence.",
    "Proofreading exonuclease engaged. Each inserted nucleotide verified before chain elongation continues.",
    "Dimensional analysis complete. All units cancel correctly — equations physically consistent.",
    "Limit of detection calculated: 0.3 pg/mL. Sensitivity exceeds the clinical requirement by an order of magnitude.",
    "Standard operating procedure version-controlled and audited. Nothing left to chance or memory.",
    "Mass spectrometry fragmentation pattern confirmed. Every peak assigned; no unexplained signals remain.",
    "Batch-to-batch coefficient of variation: 1.8%. Interassay precision exceptional — industry-grade.",
    "Internal standard recovery: 98.6%. Matrix effects negligible. Result reliable without further correction.",
    "Histological section thickness: 4 µm ± 0.3. Microtome blade honed to optimal sharpness.",
    "Alignment score perfect. Reads map unambiguously; no multi-mapping contaminates the quantification.",
    "Sterility test negative at 14 days. No contamination detected — aseptic technique confirmed.",
    "pH 7.40 ± 0.01. Physiological precision achieved. Buffer capacity sufficient for the entire experiment.",
    "Chi-squared goodness-of-fit: p = 0.94. Observed distribution matches expected model — excellent.",
    "Residual sum of squares minimised. Best-fit parameters obtained; confidence intervals narrow.",
    "Footnote corrected. Reference citation format now consistent with journal house style.",
    "All reagents within expiry. Cold chain maintained throughout. Audit trail complete and signed.",
    "Gel image contrast adjusted without manipulation. COPE guidelines satisfied — ethics preserved.",
    "Protein sequence confirmed by Edman degradation. Every residue identified in order — no ambiguity.",
    "Cell line identity verified by STR profiling. No cross-contamination; this is what it claims to be.",
    "Blinding maintained throughout analysis. Confirmation bias excluded by design, not by willpower.",
    "Inter-rater reliability κ = 0.91. Two independent observers agree — scoring criteria are airtight.",
    "Flow cytometer PMT voltage optimised using reference beads. Compensation matrix calculated analytically.",
    "Negative control reads zero. Background subtracted cleanly. Only signal remains.",
    "Final report formatted in accordance with STROBE checklist. Transparent, complete, and replicable.",
  ],
  Libra: [
    "Equilibrium achieved. Chemical potential equal on both sides of the membrane — no net flux.",
    "Balanced equation confirmed. Reactants and products in perfect stoichiometric ratio.",
    "Phase diagram intersection: triple point. All three states coexist — a rare stability window.",
    "Titration endpoint reached. Indicator colour change observed — neutralisation complete.",
    "Cooperative binding detected. Hill coefficient > 1; allosteric symmetry drives efficiency.",
    "Symmetric crystal structure resolved by X-ray diffraction. Elegant lattice, low defect density.",
    "Feedback loop balanced. Neither positive nor negative dominates — ideal regulatory state.",
    "Nash equilibrium identified in game-theoretic model. No player benefits from unilateral deviation.",
    "Bilateral symmetry verified. Left and right halves superimposable — developmental precision confirmed.",
    "Coulombic forces balanced. Net charge across interface zero — no electrostatic driving force remains.",
    "Two-body problem solved analytically. Relative orbit determined; both masses accounted for.",
    "Hardy-Weinberg equilibrium maintained. Allele frequencies stable — no selection, drift, or migration.",
    "Electromagnetic spectrum split by prism. White light revealed as the sum of all balanced wavelengths.",
    "Yin-yang topology: one state defines the other. Neither meaningful in isolation.",
    "Lever fulcrum positioned optimally. Mechanical advantage distributed equally on both sides.",
    "Concentration gradient abolished. Active transport has equalised both compartments — energy well spent.",
    "Double-blind design confirmed. Neither operator nor subject introduces bias — balance preserved by protocol.",
    "Achiral molecule detected. Superimposable on its mirror image — no handedness, no preference.",
    "Legal principle: audi alteram partem. Both sides heard before verdict. Due process honoured.",
    "Ecological trophic balance stable. Producer-consumer ratio within sustainable range.",
    "Seesaw potential: symmetric double-well. Both minima equally populated at thermal equilibrium.",
    "Ionic strength matched between sample and standard. Systematic error due to matrix effect eliminated.",
    "Paired t-test: no significant difference between matched groups. The two conditions are equivalent.",
    "Receptor occupancy 50%. Half-maximal response — exactly at EC50. The definition of a fair comparison.",
    "Two-component regulatory system: sensor and response regulator in calibrated communication.",
    "Tension and compression balanced in the truss. No net bending moment — elegant structural harmony.",
    "Retinal ganglion centre-surround antagonism: on and off pathways in precise opposition.",
    "Lyapunov stability confirmed. Small perturbations decay — the equilibrium point is attracting.",
    "Redox potential at mid-point. Electron donor and acceptor at equal concentration — electrochemical fairness.",
    "The null hypothesis retained. Neither result is significant — the data offers no unfair advantage.",
  ],
  Scorpio: [
    "Deep tissue penetration achieved. Probe accessing hidden substrates below the surface matrix.",
    "Dark matter density elevated. Invisible forces governing observable behaviour — map the field.",
    "Enzymatic cleavage at the restriction site. Expose the sequence concealed within the vector.",
    "Redox potential maximally negative. Strong reductant active — old bonds will be broken today.",
    "Electron transfer chain uncoupled. Power diverted to internal reserve — regeneration underway.",
    "X-ray crystallography resolves the binding pocket. Hidden active site now fully exposed.",
    "Apoptotic signal pathway activated — selective elimination clears the way for renewal.",
    "Cryptic transcription factor binding site revealed by ATAC-seq. Open chromatin exposes the truth.",
    "Subsurface geothermal vent detected. Life thrives where light never reaches — resilience confirmed.",
    "Phase contrast imaging: internal structure resolved without staining. Nothing hidden from careful eyes.",
    "Silent mutation identified in open reading frame. The sequence changed; the function remains altered.",
    "Autophagy pathway engaged. Cellular self-digestion converts old structures into raw materials for renewal.",
    "CRISPR excision event confirmed. Target sequence removed — no trace of the original remains.",
    "Proteolytic cascade activated. Each cleavage event activates the next enzyme — amplified termination.",
    "Endocytosis confirmed. Target internalised. Studied from within the very thing being investigated.",
    "Transposon mobilisation event. Genetic elements jumping to new loci — the genome editing itself.",
    "Prion conformation spreading. One misfolded protein converts neighbours — propagation is the mechanism.",
    "Hydrothermal vent chemistry: sulfur-oxidising chemolithotrophs thrive in toxic, scalding darkness.",
    "Tandem mass spectrometry: precursor selected, fragmented, fragments re-fragmented. Depth of analysis total.",
    "Sub-threshold depolarisation event. Just below firing threshold — but accumulating with each stimulus.",
    "Lysosomal acid phosphatase activity: maximum. The cellular recycling centre operating at full capacity.",
    "Black hole event horizon analogy: information enters, transformation is guaranteed, return is irreversible.",
    "Retroviral integrase active. Foreign sequence written permanently into the host genome.",
    "Coiled-coil domain locked in. Two alpha-helices wound together — extremely stable, hard to unwind.",
    "Necroptosis pathway: programmed cell death that deliberately ruptures the membrane — inflammatory signal.",
    "Methyl-CpG binding protein engaged. Silenced loci locked by epigenetic mark. Deeply buried memory.",
    "SNP at a regulatory element. A single nucleotide change reshaping the expression of an entire gene network.",
    "Endolysosomal escape confirmed. Probe evaded degradation, accessing the cytoplasm — the real target.",
    "Two-photon excitation: only at the focal plane, nowhere else. Precision in the third dimension.",
    "Voltage-gated calcium channel opened. Slow, powerful, and irreversible — once open, the cascade begins.",
  ],
  Sagittarius: [
    "Sampling range extended to maximum field radius. Novel variants detected in unexplored territory.",
    "Hypothesis expansion warranted. Current model insufficient — seek data from the periphery.",
    "Projectile motion: optimal launch angle confirmed at 45°. Maximum range achieved.",
    "Long-read sequencing initiated. Full-length transcript reveals structure invisible to short reads.",
    "Telescope field of view widened. Faint objects at the survey limit now within detection threshold.",
    "Migratory behaviour confirmed. Long-distance dispersal carries adaptive payload to new habitat.",
    "Extrapolation beyond training domain. Model generalises — confidence interval acceptable at range.",
    "Escape velocity reached. Gravitational well of prior assumptions no longer holds the trajectory.",
    "Animal tracking data: individual dispersed 840 km. Long-range philopatry overridden by curiosity.",
    "All-sky survey initiated. Systematic tiling covers the full sphere — no region unsampled.",
    "Cosmic ray origin traced to extragalactic source. The signal came from further than expected.",
    "Phylogeographic analysis: divergence event 60 million years ago, across a now-absent land bridge.",
    "High-altitude atmospheric sample collected. Composition markedly different from ground level.",
    "Deep-space probe telemetry received. Signal delay 22 hours — the frontier is genuinely far away.",
    "GWAS identifies locus on novel chromosome region. The answer was always outside the candidate gene list.",
    "Zoonotic spillover event modelled. The pathogen crossed the species barrier — it was always capable.",
    "Scatter plot shows clear trend only when zoomed out. The big picture reveals what close-up obscures.",
    "Bayesian prior too conservative. Likelihood function forces a dramatic posterior update — revise.",
    "Cross-cultural study reveals universal pattern. The phenomenon transcends geography, language, context.",
    "Palaeontology record: first appearance datum earlier than assumed. The lineage predates its presumed origin.",
    "Phase space trajectory unbounded. The system is not periodic — it escapes to new configurations.",
    "Protein structure from distant taxon reveals unexpected conservation. Function preserved across a billion years.",
    "Fermi estimation approach: order-of-magnitude answer achieved without complete data. Good enough to act.",
    "Volunteer explorer phenotype confirmed. Dopamine receptor polymorphism associated with novelty-seeking.",
    "Comet long-period orbit: 15,000 years between visits. Rare data point — maximise the measurement opportunity.",
    "Foreign correspondent sampling strategy: find the edge cases first; they reveal what the centre hides.",
    "Map projection chosen: conformal over equal-area. Shape preserved at the cost of accurate size.",
    "Metaphysical note: the question 'why here?' resolves only by going somewhere else and looking back.",
    "Statistical power analysis: sample size insufficient for local sub-group — extend recruitment globally.",
    "Centrifugal instability at the boundary — the model only holds near the centre; edges need new theory.",
  ],
  Capricorn: [
    "Structural integrity: 100%. Scaffold construction proceeding on schedule, under budget.",
    "Rock-solid substrate detected. Sedimentary record encodes millions of years of information.",
    "Long-term experiment endpoint approaching. Controls held steady; results will be definitive.",
    "Compression test passed at maximum load. Material yields precisely at the theoretical limit.",
    "Geological timescale perspective engaged. Short-term variance is noise; the trend is your data.",
    "Crystallisation from supersaturated solution. Patience yields the largest, purest crystal.",
    "Cold laboratory conditions favourable. Slow kinetics allow precise control of product formation.",
    "Tensile strength tested: 980 MPa. Fracture mechanics analysis confirms design will outlast the application.",
    "Five-year longitudinal cohort still intact. Retention rate 94% — infrastructure held the experiment together.",
    "Protein half-life: 14 hours. Turnover slow; each molecule earns its synthesis cost before degradation.",
    "Granite intrusion dated at 300 million years. Still load-bearing. Achievement measured in geological epochs.",
    "Bioaccumulation factor high. Patience amplifies concentration in tissues beyond what the environment contains.",
    "Hierarchical protein assembly: monomers → dimers → tetramers → filaments → cables. Structure scales up.",
    "RNA stability enhanced by 5' cap and poly-A tail. Message preserved long enough to complete the task.",
    "Permafrost record: 50,000-year climate signal preserved intact. Cold storage is the ultimate archive.",
    "Inorganic mineral matrix: apatite and collagen — hard tissue engineering at its most durable.",
    "Activation energy for decomposition: high. This compound does not degrade without extreme provocation.",
    "Compressive trabecular architecture: load directed along lines of force. Efficiency through engineered geometry.",
    "Institutional memory encoded in written SOPs. The protocol survives the departure of the individual.",
    "Ecological climax community established. Succession complete — the most stable ecosystem state reached.",
    "Silyl ether protecting group in place. The reactive functionality shielded until exactly the right moment.",
    "Phylogenetic root confirmed at basal node. This lineage is older than most branches on the tree.",
    "Annual ring count: 342. Dendrochronology reveals a history that predates the institution studying it.",
    "Iron metabolism tightly regulated. Storage protein ferritin ensures long-term supply stability.",
    "Frost-resistance pathway activated. Antifreeze proteins prevent ice crystal nucleation — winter survived.",
    "Scaffold polymer degradation rate: <1% per year. Structural function maintained across the intended lifetime.",
    "Exoskeleton moulted and re-hardened. The new shell is initially soft — patience required for full strength.",
    "Energy storage glycogen granule fully loaded. Resources banked for the dark months — foresight confirmed.",
    "Circuit board trace width calculated for 20-year service life at continuous rated current. Overengineered. Good.",
    "Data archived in triplicate to three geographically separate storage systems. The work will not be lost.",
  ],
  Aquarius: [
    "Novel mutation observed at conserved locus. Breaking established paradigms — verify with sequencing.",
    "Phase transition to superconducting state. Resistance drops to zero; current flows without loss.",
    "Emergent behaviour detected in complex system. Individual rules insufficient to predict the whole.",
    "Atmospheric anomaly recorded. Standard model fails — new physics required to explain the signal.",
    "Network topology shift: small-world regime. Information propagates with unexpected efficiency.",
    "Rare isotope detected. Half-life inconsistent with known decay series — update the chart.",
    "Open-source release imminent. Methodology distributed to all nodes — collective intelligence activated.",
    "Bose-Einstein condensate formed. Particles merge into a single quantum state — collective identity.",
    "Xenobiotic compound detected in metabolic pathway. The cell adapted before the textbook described it.",
    "Horizontal gene transfer from distant kingdom. A bacterium taught the cell something eukaryotes forgot.",
    "Error-correcting code in the mitochondrial genome. Redundancy inserted by evolution for exactly this scenario.",
    "Citizen science dataset: 2.3 million observations triangulated to single anomalous event. Distributed sensing.",
    "Unconventional splicing event produces circular RNA. The transcript loops — defying the linear dogma.",
    "Non-equilibrium thermodynamics: dissipative structure self-organising far from equilibrium — life-like.",
    "Quasicrystal symmetry confirmed. Fivefold rotational symmetry in solid state — forbidden by old theory.",
    "Mutant phenotype stable after 200 generations. The unusual has become the new normal — paradigm shifted.",
    "Crowdsourced protein folding solution. Distributed human intuition solved what algorithms could not.",
    "Antibiotic resistance mechanism: novel efflux pump, never before characterised. The bacterium innovated.",
    "Post-translational modification: unprecedented cross-link between cysteine and FAD. Novel chemistry confirmed.",
    "Quantum coherence in biological photosynthesis. Evolution exploited quantum mechanics before physics named it.",
    "Laboratory-evolved enzyme catalyses reaction previously deemed chemically impossible. The rule was wrong.",
    "Self-replicating RNA system in vitro. Life-like behaviour emerges from chemistry alone — origin hypothesis.",
    "Epigenetic inheritance across four generations. The grandparental environment encoded into the great-grandchild.",
    "Topology change in protein folding: knotted backbone. Threading the chain through itself — no textbook predicted.",
    "Neutrino oscillation detected. Mass confirmed; standard model expanded. The universe required this update.",
    "Distributed ledger consensus: no central authority, yet the network agrees. Emergence from peer interaction.",
    "Synthetic biology construct assembled from 13 incompatible species' parts — functions better than native.",
    "Phase separation without membranes: liquid-liquid demixing creates organelles ex nihilo. Rules rewritten.",
    "Programmable RNA therapeutic: sequence-specific silencing of a previously undruggable target. New category.",
    "Ultracold atom lattice simulates condensed matter physics impossible to replicate any other way. Analogue computing.",
  ],
  Pisces: [
    "Fluid dynamics enter turbulent regime. Permeability increased — boundaries are now negotiable.",
    "Diffusion coefficient elevated. Solute dispersing freely through the medium without direction.",
    "Bioluminescence observed in aphotic zone. Life persists in conditions previously deemed hostile.",
    "Osmotic flux bidirectional. Water follows its own gradient — do not resist the natural direction.",
    "Quantum tunnelling probability non-negligible. The barrier is penetrable without classical energy.",
    "Tidal mixing event underway. Deep water upwells, cold nutrients reach the photic zone.",
    "Chaotic attractor detected. Sensitivity to initial conditions extreme — small inputs, large effects.",
    "Sol-gel transition approaching. The boundary between fluid and solid dissolves under current conditions.",
    "Fluorescence lifetime extended. The excited state lingers — signal decays slowly, beautifully.",
    "Subconscious processing confirmed by network analysis. Majority of computation below detection threshold.",
    "Mucilage secretion elevated. The interface between organism and environment deliberately blurred.",
    "Percolation threshold reached. Connected pathways suddenly span the entire system — transport enabled.",
    "Passive diffusion across 7-log concentration gradient. The solute goes where it must, not where it is told.",
    "Soft matter physics: viscoelastic response dominant. Simultaneously liquid and solid — state ambiguous.",
    "Neural oscillation in theta band (4–8 Hz). Dream-state processing — memory consolidation underway.",
    "Hydrogel network equilibrating. Water content adjusting to ambient conditions — porous, adaptive.",
    "Morphogen gradient shapes field without clear boundaries. Pattern emerges from continuous spatial signal.",
    "Chemotaxis: movement up gradient without explicit instruction. The cell simply goes where conditions improve.",
    "Fog computing: processing distributed throughout the network with no centralised locus. Everywhere and nowhere.",
    "Solvent shell reorganisation detected. The hydration sphere reshaping around the solute — context changes all.",
    "Open conformational sampling: protein exploring all accessible states. Function selected from ensemble.",
    "Signal from beyond the classical noise floor. Detected by averaging — statistical truth through repetition.",
    "Interstitial fluid flowing through connective tissue. The space between cells more active than the cells.",
    "Action spectrum spans the full visible range. Absorption everywhere — indiscriminate, total, diffuse.",
    "Lyotropic liquid crystal phase: order emerges from flow, not temperature. Motion itself imposes structure.",
    "Planktonic dispersal confirmed. The organism drifts with the current and colonises whatever it contacts.",
    "Stochastic resonance: a noise floor that improves signal detection rather than degrading it. Paradox resolved.",
    "Immunological tolerance: the immune system learning to leave alone what it once would have attacked.",
    "Tidal estuary: mixing of fresh and salt water neither one nor the other. A third thing, rich in life.",
    "Morphic resonance of the experimental system — prior data from all previous attempts guides the next.",
  ],
};

// ── Compatibility matrix builder ───────────────────────────────────────────────
const COMPAT_SYNTH = {
  'Fire-Fire': [
    "Exothermic cascade — self-sustaining combustion reaction.",
    "Thermal runaway risk. Regulate heat exchange or the reaction overshoots.",
    "Chain branching reaction: each step produces two new radical species. Explosive growth.",
    "Two plasma arcs in proximity — electromagnetic pinch effect draws them together.",
    "Deflagration front accelerates. Positive feedback: heat accelerates combustion accelerates heat.",
    "Incandescent pairing. Both emit at peak luminosity — the combined spectrum blinds the detector.",
    "Autocatalytic ignition. The presence of the second flame lowers activation energy for both.",
    "Thermite reaction: iron oxide meets aluminium. Produces molten iron and blinding light.",
  ],
  'Earth-Earth': [
    "Crystal lattice formation perfect. Highly reproducible, long-duration results.",
    "Compressive force builds — pressure either forges diamonds or fractures the substrate.",
    "Mineral intergrowth: two phases precipitate simultaneously, each templating the other's growth.",
    "Tectonic compression: two plates collide, neither subducts — mountain range generated instead.",
    "Cementation of sediment: grains locked by calcite cement — a durable rock from loose material.",
    "Biofilm co-culture: two slow-growing species build a robust matrix neither could form alone.",
    "Alloy formation: two metals mixed produce hardness exceeding either component. Bronze logic.",
    "Double fertilisation event in angiosperms: two sperm, two products, one highly stable seed.",
  ],
  'Air-Air': [
    "Laminar flow achieved. Rapid diffusion of ideas across the shared medium.",
    "Turbulence possible at high Reynolds number. Ground the system before resonance builds.",
    "Resonant coupling between two atmospheric waves — amplitudes add constructively.",
    "Gas-phase reaction: two reactive species in the vapour phase, no liquid barrier to slow them.",
    "Combinatorial explosion of states: two independent bits generate four possible configurations.",
    "Vortex pair: two counter-rotating vortices propagate forward — more coherent than either alone.",
    "Syngas mixture: hydrogen and carbon monoxide, each combustible, together more versatile.",
    "Acoustic standing wave established between two resonators. Node and antinode map perfectly.",
  ],
  'Water-Water': [
    "Perfect miscibility. Solution becomes homogeneous — merged into a single phase.",
    "Dilution without limit. Maintain concentration; boundaryless diffusion loses potency.",
    "Confluent streams merge to form a river — flow increases, erosive power amplified.",
    "Osmotic equilibration complete. The boundary dissolved; the two solutions are now indistinguishable.",
    "Hydrophobic effect drives phase separation when a third party intrudes — united against the foreign.",
    "Marine chemocline: two water masses of different salinity in stable stratified coexistence.",
    "Solvation shells merge. Ions from both solutions redistributed into a single coordinated network.",
    "Interfacial tension between two aqueous phases drops to zero — spontaneous emulsification occurs.",
  ],
  'Earth-Fire': [
    "Magma interface: creative heat meets resistant substrate — transformation possible.",
    "Cooling rate mismatch. Rapid quench produces amorphous glass; slow cool yields crystal.",
    "Endothermic dissolution: fire supplies the energy the earth needs to release its minerals.",
    "Pyroclastic flow — solid particles entrained in superheated gas. Earth and fire travel together.",
    "Smelting: ore reduced by coke combustion. Fire extracts the metal earth has stored for aeons.",
    "Wildfires leave nutrient-rich ash. Destruction by fire enables geological regeneration.",
    "Geothermal gradient: deep heat drives surface productivity. The fire below feeds the earth above.",
    "Basalt formation: magma meets ocean floor, quenches rapidly, solidifies as new crust.",
  ],
  'Fire-Air': [
    "Oxygen-fed combustion — air accelerates the fire's reach and intensity.",
    "Fuel-air ratio must be monitored. Excess oxidiser without fuel produces nothing but heat loss.",
    "Bellows effect: increased airflow raises combustion temperature above iron-melting point.",
    "Fire whirl: thermal updraft induces rotational air flow — fire becomes a vortex of itself.",
    "Stoichiometric mix: precisely the ratio for complete combustion. No waste, maximum energy release.",
    "Oxy-fuel cutting torch: enriched oxygen concentrates heat to 3,500°C — cleaves steel.",
    "Explosive limits: fuel-air ratio in the flammable range. Detonation possible. Proceed carefully.",
    "Jet engine thermodynamics: air compressed, fuel ignited, thrust generated. Sustained by the pairing.",
  ],
  'Fire-Water': [
    "Phase separation likely. Requires surfactant or emulsifier for stable suspension.",
    "Steam generated at interface. Energy converts but both phases are changed by contact.",
    "Steam explosion: superheated water flashes to vapour — enormous volume expansion in microseconds.",
    "Emulsification under high shear: droplets stabilised by interfacial surfactant. Uneasy but possible.",
    "Hydrothermal chemistry: water under pressure, heated by magma — extreme chemistry at the interface.",
    "Distillation: fire below, condenser above. The volatile fraction rises; the residue concentrates.",
    "Biphasic reaction: fire-driven catalyst in organic layer, substrate in aqueous layer. Interface productive.",
    "Fire suppression: water absorbs latent heat of vaporisation, extinguishing — water ultimately wins.",
  ],
  'Air-Earth': [
    "Dust suspension in gas phase. Settled earth needs air movement to reach its potential.",
    "Erosion possible. Persistent airflow reshapes even the most resistant substrate over time.",
    "Aeolian transport: wind carries sediment across continents, deposits it as loess — slow geography.",
    "Pneumatic soil aeration: roots benefit from oxygen-charged pore spaces. Earth breathes through air.",
    "Desert varnish: windborne minerals coat rock surfaces over centuries. Air leaves its mark on earth.",
    "Fluidised bed reactor: air blown upward suspends solid particles. Efficient contact between phases.",
    "Sand dune dynamics: air and sand enter feedback — dunes migrate, shape, and reproduce.",
    "Volcanic ash plume: earth shattered by pressure, lifted by air, dispersed globally.",
  ],
  'Earth-Water': [
    "Saturated matrix supports life. Water activates nutrients locked in terrestrial substrate.",
    "Over-saturation leads to anoxic conditions. Drainage required to prevent root rot.",
    "Soil weathering: water infiltrates cracks, expands on freezing — mechanical breakdown of rock.",
    "Mineral dissolution: water carries ions from the rock into solution — geochemical mobilisation.",
    "Alluvial deposition: slowing water drops its sediment load. Delta formed from continental erosion.",
    "Microbial mat at sediment-water interface — most productive zone in the aquatic ecosystem.",
    "Hydraulic fracturing: water pressure exceeds tensile strength — the earth yields.",
    "Peat formation: waterlogged conditions slow decomposition — organic matter accumulates as carbon archive.",
  ],
  'Air-Water': [
    "Gas exchange at liquid surface. Oxygen transfer drives the aerobic metabolism.",
    "Evaporation without containment. Volatile pairing — powerful but requires sealed vessel.",
    "Henry's law: gas solubility proportional to partial pressure. The ocean breathes with the atmosphere.",
    "Bubble nucleation: dissolved gas released at depressurisation — champagne physics.",
    "Atmospheric deposition: dissolved aerosols deposited by rain — chemical bridge between air and ocean.",
    "Wave action oxygenates surface water — interface turbulence maximises gas exchange.",
    "Cloud formation: water vapour condensed by lifted air parcel — the pairing produces weather.",
    "Spray coating: liquid droplets entrained in air, deposited as uniform film. Air delivers water to surface.",
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
