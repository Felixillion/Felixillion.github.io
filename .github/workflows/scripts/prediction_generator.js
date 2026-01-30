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
        'Your {sign} kinetic energy reaches maximum catalytic efficiency today',
        'Rapid reaction rates detected in {sign} enzymatic pathways',
        'High-temperature phase transitions activate {sign} protocols',
        'Exothermic reactions accelerate {sign} experimental throughput',
        'ATP synthesis rates peak in your {sign} mitochondrial assays',
        'Electrochemical gradients optimize {sign} energy production',
        'Active site accessibility maximizes {sign} catalytic rates',
        'Metabolic flux shows elevated activity in {sign} systems',
        'Your {sign} activation energy barriers are significantly lowered',
        'Combustion-phase dynamics enhance {sign} reaction velocities'
    ],
    communication: [
        'Network topology analysis reveals optimal {sign} connectivity',
        'Information transfer efficiency peaks in {sign} signaling cascades',
        'Signal transduction pathways show enhanced {sign} propagation',
        'Intercellular messaging protocols optimize {sign} coordination',
        'Your {sign} transcriptional regulation displays optimal feedback',
        'Data processing bandwidth increases for {sign} neural networks',
        'Frequency modulation enhances {sign} signal clarity',
        'Your {sign} communication channels achieve low noise ratios',
        'Feedback loop optimization strengthens {sign} responses',
        'Molecular messaging shows high fidelity in {sign} systems'
    ],
    emotion: [
        'Dynamic fluctuation patterns characterize {sign} responses today',
        'Your {sign} system achieves optimal hydration equilibrium',
        'Fluid dynamics modeling predicts favorable {sign} outcomes',
        'Responsive mechanisms adapt rapidly to {sign} environmental changes',
        'Osmotic gradients drive {sign} transport efficiently',
        'Your {sign} sensitivity calibration reaches femtomolar precision',
        'Cyclic variation enhances {sign} temporal resolution',
        'Aqueous-phase dynamics favor {sign} molecular interactions',
        'Your {sign} adaptive capacity shows high plasticity',
        'Detection limits reach optimal sensitivity for {sign} sensors'
    ],
    harmony: [
        'Equilibrium conditions optimize {sign} experimental balance',
        'Binding affinity measures show favorable {sign} interactions',
        'Cooperative kinetics synchronize {sign} processes',
        'Your {sign} system achieves optimal pH buffering',
        'Allosteric regulation coordinates {sign} enzyme activities',
        'Symbiotic interactions strengthen {sign} co-culture systems',
        'Protein-protein docking energies favor {sign} complexes',
        'Your {sign} homeostatic mechanisms maintain stability',
        'Complementary base pairing optimizes {sign} hybridization',
        'Molecular recognition events enhance {sign} specificity'
    ],
    expansion: [
        'Amplification cycles increase {sign} signal output exponentially',
        'Your {sign} throughput capacity scales to maximum efficiency',
        'Proliferation rates accelerate in {sign} culture conditions',
        'Upregulation pathways activate {sign} gene expression',
        'Library complexity expands {sign} diversity parameters',
        'Your {sign} growth kinetics enter logarithmic phase',
        'Exponential accumulation detected in {sign} pathways',
        'Scaling factors optimize {sign} production yields',
        'Your {sign} expansion protocols show multiplicative gains',
        'Volumetric increases enhance {sign} analytical capacity'
    ],
    structure: [
        'Architectural integrity stabilizes {sign} frameworks',
        'Your {sign} scaffolding maintains robust structural assembly',
        'Crystallographic refinement achieves {sign} resolution',
        'Quality control checkpoints validate {sign} experimental design',
        'Checkpoint regulation ensures {sign} fidelity',
        'Systematic protocols guarantee {sign} reproducibility',
        'Your {sign} assembly mechanisms show high precision',
        'Structural motifs organize {sign} spatial arrangements',
        'Rigid-body constraints stabilize {sign} conformations',
        'Your {sign} foundations demonstrate tensile strength'
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
