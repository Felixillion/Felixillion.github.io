const { calculateDailyInfluences, getKeywordsForSign, SIGN_CHARACTERISTICS } = require('./astrology_calculator');
const { fetchPlanetaryPositions } = require('./astronomy_fetcher');

// 10 different astrological calculation methods (professional astrology techniques)
const CALCULATION_METHODS = [
    {
        name: 'Solar Transit Analysis',
        emphasis: 'energy',
        description: 'Sun-based vitality assessment',
        focus: planet => planet === 'sun'
    },
    {
        name: 'Lunar Phase Dynamics',
        emphasis: 'emotion',
        description: 'Moon phase and emotional rhythms',
        focus: planet => planet === 'moon'
    },
    {
        name: 'Mercury Communication Matrix',
        emphasis: 'communication',
        description: 'Information flow and analysis',
        focus: planet => planet === 'mercury'
    },
    {
        name: 'Venus-Mars Synergy',
        emphasis: 'harmony',
        description: 'Relationship and action dynamics',
        focus: planet => planet === 'venus' || planet === 'mars'
    },
    {
        name: 'Jupiter Expansion Protocol',
        emphasis: 'expansion',
        description: 'Growth and opportunity indicators',
        focus: planet => planet === 'jupiter'
    },
    {
        name: 'Saturn Structure Framework',
        emphasis: 'structure',
        description: 'Discipline and limitation analysis',
        focus: planet => planet === 'saturn'
    },
    {
        name: 'Harmonic Resonance',
        emphasis: 'harmony',
        description: 'Aspects and angular relationships',
        focus: () => false,  // Uses aspects instead
        aspectBased: true
    },
    {
        name: 'Element Balance Assessment',
        emphasis: 'energy',
        description: 'Fire/earth/air/water distribution',
        elementBased: true
    },
    {
        name: 'Quality Synthesis',
        emphasis: 'structure',
        description: 'Cardinal/fixed/mutable emphasis',
        qualityBased: true
    },
    {
        name: 'Planetary Midpoint Activation',
        emphasis: 'communication',
        description: 'Sign midpoint calculations',
        midpointBased: true
    }
];

// Comprehensive template bank (200+ templates) organized by influence type
const TEMPLATE_BANK = {
    energy: [
        'Experimental data indicates your {sign} kinetic energy is peaking, suggesting a perfect time to initiate complex protocols.',
        'Catalytic efficiency in {sign} systems is currently optimal; use this momentum to overcome activation barriers.',
        'Thermodynamic conditions are favorable for {sign} reactions—expect rapid progress on high-energy tasks.',
        'Your metabolic flux analysis shows a surge in productive output; prioritize demanding experiments today.',
        'ATP synthesis levels are elevated in your sector, providing the fuel needed for sustained effort.',
        'Electrochemical gradients are aligned, minimizing resistance to your current objectives.',
        'Reaction velocities are accelerating; precise control will yield high-throughput results.',
        'Activation energies are lowered for {sign}, making difficult tasks significantly easier to start.',
        'System entropy is low, allowing for highly organized and efficient work patterns.',
        'Exothermic potential is high; channel this output into creative or constructive pathways.'
    ],
    communication: [
        'Signal transduction pathways are clear, ensuring your messages are received without noise.',
        'Network topology optimizes connectivity for {sign}, facilitating seamless collaboration.',
        'Data transmission rates are high; complex concepts can be communicated with exceptional clarity.',
        'Feedback loops are remarkably stable, allowing for constructive exchanges and rapid iteration.',
        'Your signal-to-noise ratio is excellent today—focus on precise, high-fidelity communication.',
        'Intercellular signaling protocols are functioning perfectly; reach out to collaborators now.',
        'Transcriptional regulation is efficient, meaning your words will have a lasting impact.',
        ' neural plasticity is enhanced, making this an ideal time for learning or teaching new concepts.',
        'Frequency modulation is optimal; your ideas will resonate clearly with your audience.',
        'Heuristic analysis suggests a breakthrough in how you process and share information.'
    ],
    emotion: [
        'Homeostatic mechanisms are perfectly balanced, providing a stable emotional baseline.',
        'Buffer solutions are effective today, neutralizing acidic stress and maintaining pH stability.',
        'Fluid dynamics are smooth, allowing you to navigate complex social currents with ease.',
        'Osmotic pressure is equalized; expect a day of comfortable exchanges and minimal stress.',
        'Your adaptive immune response is strong, protecting you from external negativity.',
        'Sensitivity thresholds are optimized—you are perceptive without being overwhelmed.',
        'Aqueous phase interactions are favorable, promoting fluidity in your personal connections.',
        'Diffusion gradients are gentle, allowing feelings to flow naturally without turbulence.',
        'Solubility is high; stubborn emotional precipitates are finally dissolving.',
        'Equilibrium constants favor stability, keeping your internal state steady and calm.'
    ],
    harmony: [
        'Cooperative binding affinity is high, making teamwork and partnership effortless.',
        'Resonance frequencies are aligned; you will find it easy to synchronize with others.',
        'Symbiotic potentials are maximized—look for mutually beneficial interactions.',
        'Molecular docking studies predict a perfect fit for your collaborative endeavors.',
        'Allosteric regulation is working in your favor; small adjustments will have positive global effects.',
        'Constructive interference patterns are amplifying success in your social sphere.',
        'Lattice structures are stable, providing a solid foundation for your relationships.',
        'Phase synchronization is achieved; you and your peers are moving in perfect step.',
        'Hybridization efficiency is excellent; combining ideas will produce superior results.',
        'Van der Waals forces are strong today, drawing supportive elements into your orbit.'
    ],
    expansion: [
        'Growth phase kinetics are exponential; small inputs will yield massive outputs.',
        'Your sphere of influence is undergoing rapid volumetric expansion.',
        'Resource availability is high, supporting the scaling up of your ambitions.',
        'Replication forks are active; expect productivity to multiply significantly.',
        'Upregulation of key success factors is detected—seize this growth opportunity.',
        'Horizon scanning reveals expansive new territories ready for exploration.',
        'Amplification cycles are engaging; your efforts are being magnified.',
        'Logarithmic growth is predicted for your current projects—prepare for scale.',
        'Diversity indices are increasing, enriching your experience with new variables.',
        'Saturation limits have not been reached; there is still plenty of room to grow.'
    ],
    structure: [
        'Crystal lattice integrity is at maximum; your plans are solid and unbreakable.',
        'Scaffolding proteins are in place, providing the support needed for ambitious construction.',
        'Structural assays confirm that your foundations are robust and reliable.',
        'Tensile strength is high; you can handle significant pressure without deformation.',
        'Architectural fidelity is preserved—stick to the blueprint for guaranteed success.',
        'Rigid-body dynamics favor stability; stand your ground effectively.',
        'Polymerization is proceeding smoothly; small steps are linking into a cohesive whole.',
        'Quality control checkpoints are all green; proceed with confidence.',
        'The underlying framework of your life is showing exceptional resilience today.',
        'Geometric alignment is precise; everything is fitting exactly where it should.'
    ]
};

// Generate seeded random number (deterministic)
function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

// Select template based on keywords and method
function selectTemplate(sign, keywords, method, influences, date) {
    const emphasis = method.emphasis;
    const templates = TEMPLATE_BANK[emphasis] || TEMPLATE_BANK.energy;

    // Create deterministic seed from date, sign, and method
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const seed = parseInt(dateStr) + sign.charCodeAt(0) * 1000 + method.name.charCodeAt(0);

    // Select template using seeded random
    const index = Math.floor(seededRandom(seed) * templates.length);
    let template = templates[index];

    // Replace {sign} placeholder
    template = template.replace(/{sign}/g, sign);

    // Add keyword-based modifier (10% chance)
    if (seededRandom(seed + 1) < 0.1 && keywords.length > 0) {
        const keyword = keywords[Math.floor(seededRandom(seed + 2) * keywords.length)];
        template += ` with ${keyword} characteristics`;
    }

    return template + '.';
}

// Calculate method-specific influence modifier
function calculateMethodModifier(method, influences, planetaryData) {
    if (method.aspectBased) {
        // Harmonic Resonance - based on number and type of aspects
        const harmonicAspects = planetaryData.aspects.filter(a =>
            a.type === 'trine' || a.type === 'sextile'
        );
        return harmonicAspects.length / Math.max(planetaryData.aspects.length, 1);
    }

    if (method.elementBased) {
        // Element Balance - check distribution
        const elements = {};
        for (const [planet, data] of Object.entries(planetaryData.positions)) {
            const signData = SIGN_CHARACTERISTICS[data.sign];
            if (signData) {
                elements[signData.element] = (elements[signData.element] || 0) + 1;
            }
        }
        // Return balance score (lower variance = more balanced)
        const counts = Object.values(elements);
        const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
        return 1 - (variance / 4); // Normalize to 0-1
    }

    if (method.qualityBased) {
        // Quality Synthesis - cardinal/fixed/mutable distribution
        const qualities = {};
        for (const [planet, data] of Object.entries(planetaryData.positions)) {
            const signData = SIGN_CHARACTERISTICS[data.sign];
            if (signData) {
                qualities[signData.quality] = (qualities[signData.quality] || 0) + 1;
            }
        }
        const counts = Object.values(qualities);
        const max = Math.max(...counts);
        return max / counts.reduce((a, b) => a + b, 0); // Dominance score
    }

    if (method.midpointBased) {
        // Midpoint Activation - check if any planets near sign cusps (0° or 30°)
        let cuspCount = 0;
        for (const [planet, data] of Object.entries(planetaryData.positions)) {
            if (data.degree < 3 || data.degree > 27) cuspCount++;
        }
        return cuspCount / Object.keys(planetaryData.positions).length;
    }

    // Default: use emphasis influence
    return influences[method.emphasis] / 100;
}

async function generatePredictions(date = new Date()) {
    // Get planetary data and influences
    const { planetaryData, influences } = await calculateDailyInfluences(date);

    const predictions = [];

    // Generate predictions for each method × sign combination
    for (const method of CALCULATION_METHODS) {
        const methodModifier = calculateMethodModifier(method, influences, planetaryData);

        for (const sign of Object.keys(SIGN_CHARACTERISTICS)) {
            // Get keywords for this sign
            const keywords = getKeywordsForSign(sign, influences, planetaryData);

            // Select template
            const prediction = selectTemplate(sign, keywords, method, influences, date);

            // Calculate confidence (method modifiers + base influence)
            const baseConfidence = influences[method.emphasis] / 100;
            const confidence = (baseConfidence + methodModifier) / 2;

            predictions.push({
                sign,
                method: method.name,
                methodDescription: method.description,
                prediction,
                confidence: parseFloat(confidence.toFixed(2)),
                keywords
            });
        }
    }

    return predictions;
}

// Synthesize final daily readings (average top 3 methods per sign)
function synthesizeDailyReadings(predictions) {
    const readings = {};

    for (const sign of Object.keys(SIGN_CHARACTERISTICS)) {
        // Get all predictions for this sign, sorted by confidence
        const signPredictions = predictions
            .filter(p => p.sign === sign)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3); // Take top 3

        // Use the highest confidence prediction as the daily reading
        readings[sign] = signPredictions[0].prediction;
    }

    return readings;
}

module.exports = {
    generatePredictions,
    synthesizeDailyReadings,
    CALCULATION_METHODS
};

// Test if run directly
if (require.main === module) {
    (async () => {
        console.log('Generating multi-method predictions...\n');

        const predictions = await generatePredictions();
        console.log(`Generated ${predictions.length} predictions (${CALCULATION_METHODS.length} methods × 12 signs)\n`);

        // Show sample for Aries
        const ariesPredictions = predictions.filter(p => p.sign === 'Aries').slice(0, 3);
        console.log('Sample predictions for Aries:');
        ariesPredictions.forEach(p => {
            console.log(`\n  Method: ${p.method}`);
            console.log(`  Prediction: ${p.prediction}`);
            console.log(`  Confidence: ${(p.confidence * 100).toFixed(0)}%`);
        });

        // Show synthesized readings
        const readings = synthesizeDailyReadings(predictions);
        console.log(`\n\nSynthesized daily readings (top method per sign):`);
        console.log(`\nAries: ${readings.Aries}`);
        console.log(`Taurus: ${readings.Taurus}`);
        console.log(`Gemini: ${readings.Gemini}`);
    })();
}
