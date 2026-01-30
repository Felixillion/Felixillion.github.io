const { SIGN_CHARACTERISTICS } = require('./astrology_calculator');
const { fetchPlanetaryPositions } = require('./astronomy_fetcher');

// Element compatibility matrix (0-100 scale)
const ELEMENT_COMPATIBILITY = {
    fire: { fire: 80, earth: 55, air: 90, water: 45 },
    earth: { fire: 55, earth: 75, air: 60, water: 85 },
    air: { fire: 90, earth: 60, air: 75, water: 50 },
    water: { fire: 45, earth: 85, air: 50, water: 80 }
};

// Quality interaction modifiers
const QUALITY_MODIFIERS = {
    'cardinal-cardinal': { modifier: 1.1, description: 'High initiative, potential leadership conflicts' },
    'cardinal-fixed': { modifier: 1.0, description: 'Balance of initiation and stability' },
    'cardinal-mutable': { modifier: 0.95, description: 'Dynamic yet adaptable partnership' },
    'fixed-fixed': { modifier: 0.9, description: 'Stubborn but deeply stable bond' },
    'fixed-mutable': { modifier: 1.05, description: 'Grounding meets flexibility' },
    'mutable-mutable': { modifier: 0.85, description: 'Highly adaptable, low stability' }
};

// Lab-themed compatibility descriptors
const COMPATIBILITY_DESCRIPTORS = {
    90: {
        level: 'Exceptional',
        lab: 'Near-perfect cooperative binding with minimal energy barriers'
    },
    80: {
        level: 'Excellent',
        lab: 'Strong synergistic interactions with favorable thermodynamics'
    },
    70: {
        level: 'Very Good',
        lab: 'Stable complex formation with manageable activation energy'
    },
    60: {
        level: 'Good',
        lab: 'Functional protein-protein interactions requiring optimization'
    },
    50: {
        level: 'Moderate',
        lab: 'Mixed dynamics with competing pathways'
    },
    40: {
        level: 'Challenging',
        lab: 'High energy barriers requiring catalytic assistance'
    },
    30: {
        level: 'Difficult',
        lab: 'Unfavorable binding kinetics with repulsive forces'
    }
};

function getCompatibilityDescriptor(score) {
    const thresholds = [90, 80, 70, 60, 50, 40, 30];
    for (const threshold of thresholds) {
        if (score >= threshold) return COMPATIBILITY_DESCRIPTORS[threshold];
    }
    return COMPATIBILITY_DESCRIPTORS[30];
}

function calculateElementHarmony(sign1Data, sign2Data) {
    const element1 = sign1Data.element;
    const element2 = sign2Data.element;
    const baseScore = ELEMENT_COMPATIBILITY[element1][element2];

    // Element descriptions
    const descriptions = {
        'fire-fire': 'Dual combustion reactions create high-energy dynamics',
        'fire-earth': 'Heat-substrate interactions show partial activity',
        'fire-air': 'Oxygen-rich environment amplifies flame propagation',
        'fire-water': 'Phase opposition creates steam - volatile but transformative',
        'earth-earth': 'Solid-phase crystallization yields stable structures',
        'earth-air': 'Gas-solid interface shows moderate surface activity',
        'earth-water': 'Aqueous dissolution optimizes substrate utilization',
        'air-air': 'Gaseous diffusion maximizes molecular mobility',
        'air-water': 'Surface tension effects create boundary challenges',
        'water-water': 'Fluid dynamics enable seamless flow and mixing'
    };

    const key1 = `${element1}-${element2}`;
    const key2 = `${element2}-${element1}`;
    const description = descriptions[key1] || descriptions[key2] || 'Complex interaction patterns';

    return {
        score: baseScore,
        description,
        elements: [element1, element2]
    };
}

function calculateQualityInteraction(sign1Data, sign2Data) {
    const quality1 = sign1Data.quality;
    const quality2 = sign2Data.quality;

    // Normalize order (alphabetical)
    const qualities = [quality1, quality2].sort();
    const key = `${qualities[0]}-${qualities[1]}`;

    return QUALITY_MODIFIERS[key] || { modifier: 1.0, description: 'Balanced interaction' };
}

async function calculateAspectBonus(sign1, sign2, planetaryData) {
    let bonus = 0;
    let aspectDescription = '';

    // Check Venus-Mars aspect (love/passion planets)
    const venusAspect = planetaryData.aspects.find(a =>
        a.planets.includes('Venus') && a.planets.includes('Mars')
    );

    if (venusAspect) {
        if (venusAspect.type === 'trine' || venusAspect.type === 'sextile') {
            bonus += 15;
            aspectDescription = `Today's Venus-${venusAspect.type} enhances binding kinetics (+${bonus}%)`;
        } else if (venusAspect.type === 'square') {
            bonus -= 5;
            aspectDescription = `Venus-Mars square creates competing reaction pathways (-${Math.abs(bonus)}%)`;
        }
    }

    // Check if either sign's ruler is prominent today
    const sign1Ruler = sign1Data.ruler.toLowerCase();
    const sign2Ruler = sign2Data.ruler.toLowerCase();

    if (planetaryData.positions[sign1Ruler] && planetaryData.positions[sign2Ruler]) {
        const pos1 = planetaryData.positions[sign1Ruler];
        const pos2 = planetaryData.positions[sign2Ruler];

        // Same sign placement bonus
        if (pos1.sign === pos2.sign) {
            bonus += 5;
            if (aspectDescription) aspectDescription += '; ';
            aspectDescription += `Shared planetary substrate in ${pos1.sign}`;
        }
    }

    return { bonus, description: aspectDescription || 'Standard planetary conditions' };
}

async function calculateCompatibility(sign1, sign2, date = new Date()) {
    const sign1Data = SIGN_CHARACTERISTICS[sign1];
    const sign2Data = SIGN_CHARACTERISTICS[sign2];

    if (!sign1Data || !sign2Data) {
        throw new Error(`Invalid sign(s): ${sign1}, ${sign2}`);
    }

    // Get planetary data for today
    const planetaryData = await fetchPlanetaryPositions(date);

    // Calculate base compatibility
    const elementHarmony = calculateElementHarmony(sign1Data, sign2Data);
    const qualityInteraction = calculateQualityInteraction(sign1Data, sign2Data);
    const aspectBonus = await calculateAspectBonus(sign1Data, sign2Data, planetaryData);

    // Calculate final score
    let baseScore = elementHarmony.score * qualityInteraction.modifier;
    const finalScore = Math.min(100, Math.max(0, baseScore + aspectBonus.bonus));

    // Get descriptor
    const descriptor = getCompatibilityDescriptor(finalScore);

    // Generate strengths and challenges
    const strengths = [];
    const challenges = [];

    // Element-based strengths/challenges
    if (elementHarmony.score >= 80) {
        strengths.push(`${elementHarmony.elements[0]}-${elementHarmony.elements[1]} synergy optimizes energy transfer`);
    } else if (elementHarmony.score <= 50) {
        challenges.push(`${elementHarmony.elements[0]}-${elementHarmony.elements[1]} opposition requires buffering conditions`);
    }

    // Quality-based
    if (qualityInteraction.modifier >= 1.05) {
        strengths.push('Complementary catalytic mechanisms enhance overall throughput');
    } else if (qualityInteraction.modifier <= 0.9) {
        challenges.push('Similar kinetic profiles may lead to competitive inhibition');
    }

    // Theme overlap
    const sharedThemes = sign1Data.themes.filter(t => sign2Data.themes.includes(t));
    if (sharedThemes.length > 0) {
        strengths.push(`Shared ${sharedThemes[0]} pathway provides common substrate`);
    }

    // Generate synthesis
    const synthesis = `Your ${sign1}-${sign2} pairing demonstrates ${descriptor.level.toLowerCase()} compatibility (${finalScore.toFixed(0)}% binding affinity). ${descriptor.lab}. ${elementHarmony.description}. ${qualityInteraction.description}.`;

    // Add default strengths/challenges if none detected
    if (strengths.length === 0) {
        strengths.push('Moderate catalytic cooperation possible with optimization');
    }
    if (challenges.length === 0) {
        challenges.push('Minor pH and temperature adjustments may be required');
    }

    return {
        score: parseFloat(finalScore.toFixed(1)),
        level: descriptor.level,
        binding_affinity: `${descriptor.level} (${finalScore.toFixed(0)}% cooperative)`,
        synthesis,
        strengths,
        challenges,
        today_specific: aspectBonus.description,
        element_harmony: elementHarmony.score,
        quality_modifier: qualityInteraction.modifier,
        date: planetaryData.date
    };
}

// Generate compatibility matrix for all pairings
async function generateCompatibilityMatrix(date = new Date()) {
    const signs = Object.keys(SIGN_CHARACTERISTICS);
    const matrix = {};

    for (let i = 0; i < signs.length; i++) {
        for (let j = i; j < signs.length; j++) {
            const sign1 = signs[i];
            const sign2 = signs[j];
            const key = sign1 === sign2 ? sign1 : `${sign1}-${sign2}`;

            matrix[key] = await calculateCompatibility(sign1, sign2, date);
        }
    }

    return matrix;
}

module.exports = {
    calculateCompatibility,
    generateCompatibilityMatrix
};

// Test if run directly
if (require.main === module) {
    (async () => {
        console.log('Testing compatibility calculator...\n');

        const pairings = [
            ['Aries', 'Leo'],
            ['Taurus', 'Scorpio'],
            ['Gemini', 'Sagittarius'],
            ['Cancer', 'Capricorn']
        ];

        for (const [sign1, sign2] of pairings) {
            const compat = await calculateCompatibility(sign1, sign2);
            console.log(`\n${sign1} + ${sign2}:`);
            console.log(`  Score: ${compat.score}/100 (${compat.level})`);
            console.log(`  Synthesis: ${compat.synthesis.substring(0, 100)}...`);
            console.log(`  Today: ${compat.today_specific}`);
        }
    })();
}
