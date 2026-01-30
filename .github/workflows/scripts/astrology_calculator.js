const { fetchPlanetaryPositions } = require('./astronomy_fetcher');

// Map planetary positions to thematic influences (professional astrology methodology)

const PLANET_INFLUENCES = {
    sun: {
        primary: 'identity',
        themes: ['core-energy', 'vitality', 'self-expression', 'consciousness'],
        labTerms: ['primary signal', 'core pathway', 'foundational mechanism', 'dominant process']
    },
    moon: {
        primary: 'emotion',
        themes: ['intuition', 'instinct', 'sensitivity', 'subconscious'],
        labTerms: ['dynamic fluctuation', 'responsive system', 'adaptive mechanism', 'cyclic process']
    },
    mercury: {
        primary: 'communication',
        themes: ['analysis', 'information', 'exchange', 'processing'],
        labTerms: ['signal transduction', 'information transfer', 'network communication', 'data processing']
    },
    venus: {
        primary: 'harmony',
        themes: ['relationships', 'attraction', 'balance', 'aesthetic'],
        labTerms: ['binding affinity', 'molecular recognition', 'equilibrium state', 'optimal conditions']
    },
    mars: {
        primary: 'action',
        themes: ['energy', 'initiative', 'drive', 'assertion'],
        labTerms: ['catalytic activity', 'kinetic energy', 'activation potential', 'reaction velocity']
    },
    jupiter: {
        primary: 'expansion',
        themes: ['growth', 'opportunity', 'abundance', 'philosophy'],
        labTerms: ['amplification', 'upregulation', 'proliferation', 'exponential growth']
    },
    saturn: {
        primary: 'structure',
        themes: ['discipline', 'limitation', 'responsibility', 'mastery'],
        labTerms: ['structural integrity', 'checkpoint control', 'selective pressure', 'quality assurance']
    }
};

const ASPECT_INFLUENCES = {
    conjunction: { strength: 1.0, nature: 'intense', effect: 'fusion' },
    sextile: { strength: 0.6, nature: 'harmonious', effect: 'opportunity' },
    square: { strength: 0.8, nature: 'challenging', effect: 'tension' },
    trine: { strength: 0.9, nature: 'flowing', effect: 'ease' },
    opposition: { strength: 0.85, nature: 'polarizing', effect: 'awareness' }
};

const SIGN_CHARACTERISTICS = {
    Aries: { element: 'fire', quality: 'cardinal', ruler: 'mars', themes: ['initiative', 'action', 'courage'] },
    Taurus: { element: 'earth', quality: 'fixed', ruler: 'venus', themes: ['stability', 'value', 'cultivation'] },
    Gemini: { element: 'air', quality: 'mutable', ruler: 'mercury', themes: ['communication', 'duality', 'curiosity'] },
    Cancer: { element: 'water', quality: 'cardinal', ruler: 'moon', themes: ['nurturing', 'protection', 'emotion'] },
    Leo: { element: 'fire', quality: 'fixed', ruler: 'sun', themes: ['creativity', 'expression', 'leadership'] },
    Virgo: { element: 'earth', quality: 'mutable', ruler: 'mercury', themes: ['precision', 'service', 'analysis'] },
    Libra: { element: 'air', quality: 'cardinal', ruler: 'venus', themes: ['balance', 'partnership', 'harmony'] },
    Scorpio: { element: 'water', quality: 'fixed', ruler: 'mars', themes: ['intensity', 'transformation', 'depth'] },
    Sagittarius: { element: 'fire', quality: 'mutable', ruler: 'jupiter', themes: ['expansion', 'philosophy', 'adventure'] },
    Capricorn: { element: 'earth', quality: 'cardinal', ruler: 'saturn', themes: ['achievement', 'structure', 'ambition'] },
    Aquarius: { element: 'air', quality: 'fixed', ruler: 'saturn', themes: ['innovation', 'community', 'uniqueness'] },
    Pisces: { element: 'water', quality: 'mutable', ruler: 'jupiter', themes: ['intuition', 'compassion', 'transcendence'] }
};

function calculatePlanetaryInfluences(planetaryData) {
    const influences = {
        energy: 0,
        communication: 0,
        emotion: 0,
        harmony: 0,
        expansion: 0,
        structure: 0
    };

    // Base influence from planetary positions
    for (const [planet, data] of Object.entries(planetaryData.positions)) {
        const planetData = PLANET_INFLUENCES[planet];
        if (!planetData) continue;

        const signData = SIGN_CHARACTERISTICS[data.sign];
        if (!signData) continue;

        // Map planet to influence category
        switch (planetData.primary) {
            case 'action':
                influences.energy += 30;
                break;
            case 'communication':
                influences.communication += 30;
                break;
            case 'emotion':
                influences.emotion += 30;
                break;
            case 'harmony':
                influences.harmony += 30;
                break;
            case 'expansion':
                influences.expansion += 30;
                break;
            case 'structure':
                influences.structure += 30;
                break;
        }

        // Element modifiers
        if (signData.element === 'fire') influences.energy += 10;
        if (signData.element === 'air') influences.communication += 10;
        if (signData.element === 'water') influences.emotion += 10;
        if (signData.element === 'earth') influences.structure += 10;
    }

    // Aspect modifiers
    planetaryData.aspects.forEach(aspect => {
        const aspectData = ASPECT_INFLUENCES[aspect.type];
        if (!aspectData) return;

        const strength = aspectData.strength * (1 - aspect.orb / 8); // Reduce strength with wider orb

        if (aspect.planets.includes('Mars')) influences.energy += 15 * strength;
        if (aspect.planets.includes('Mercury')) influences.communication += 15 * strength;
        if (aspect.planets.includes('Moon')) influences.emotion += 15 * strength;
        if (aspect.planets.includes('Venus')) influences.harmony += 15 * strength;
        if (aspect.planets.includes('Jupiter')) influences.expansion += 15 * strength;
        if (aspect.planets.includes('Saturn')) influences.structure += 15 * strength;
    });

    // Normalize to 0-100 scale
    const max = Math.max(...Object.values(influences));
    if (max > 0) {
        for (const key of Object.keys(influences)) {
            influences[key] = (influences[key] / max) * 100;
        }
    }

    return influences;
}

function getKeywordsForSign(sign, influences, planetaryData) {
    const signData = SIGN_CHARACTERISTICS[sign];
    const keywords = [];

    // Get top 2 influences
    const sortedInfluences = Object.entries(influences)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([key]) => key);

    // Map influences to lab keywords
    const influenceKeywords = {
        energy: ['kinetic', 'catalytic', 'activation', 'exothermic', 'ATP'],
        communication: ['transduction', 'network', 'signaling', 'information', 'feedback'],
        emotion: ['dynamic', 'responsive', 'adaptive', 'fluctuation', 'sensitivity'],
        harmony: ['equilibrium', 'binding', 'affinity', 'coordination', 'balance'],
        expansion: ['amplification', 'proliferation', 'upregulation', 'growth', 'scaling'],
        structure: ['architecture', 'scaffolding', 'checkpoint', 'integrity', 'assembly']
    };

    // Get element keywords
    const elementKeywords = {
        fire: ['high-temperature', 'rapid', 'energetic', 'combustion'],
        earth: ['stable', 'crystalline', 'solid-phase', 'substrate'],
        air: ['gaseous', 'volatile', 'diffusion', 'dispersion'],
        water: ['aqueous', 'soluble', 'fluid', 'hydration']
    };

    // Combine keywords
    sortedInfluences.forEach(inf => {
        keywords.push(...(influenceKeywords[inf] || []).slice(0, 2));
    });
    keywords.push(...(elementKeywords[signData.element] || []).slice(0, 1));

    // Add moon phase keywords if applicable
    if (planetaryData.positions.moon && planetaryData.positions.moon.phase) {
        const phase = planetaryData.positions.moon.phase;
        if (phase.includes('Full')) keywords.push('maximum', 'peak');
        if (phase.includes('New')) keywords.push('initiation', 'minimal');
        if (phase.includes('Waxing')) keywords.push('increasing', 'accumulation');
        if (phase.includes('Waning')) keywords.push('decreasing', 'depletion');
    }

    return keywords.slice(0, 5); // Return top 5 keywords
}

async function calculateDailyInfluences(date = new Date()) {
    const planetaryData = await fetchPlanetaryPositions(date);
    const influences = calculatePlanetaryInfluences(planetaryData);

    return {
        planetaryData,
        influences,
        date: planetaryData.date
    };
}

module.exports = {
    calculatePlanetaryInfluences,
    getKeywordsForSign,
    calculateDailyInfluences,
    SIGN_CHARACTERISTICS,
    PLANET_INFLUENCES
};

// Test if run directly
if (require.main === module) {
    (async () => {
        console.log('Calculating daily astrological influences...\n');
        const { planetaryData, influences } = await calculateDailyInfluences();

        console.log('Influence Scores (0-100):');
        for (const [influence, score] of Object.entries(influences)) {
            const bar = '█'.repeat(Math.floor(score / 5));
            console.log(`  ${influence.padEnd(15)}: ${score.toFixed(1).padStart(5)} ${bar}`);
        }

        console.log('\nSample Keywords for Aries:');
        const keywords = getKeywordsForSign('Aries', influences, planetaryData);
        console.log(`  ${keywords.join(', ')}`);
    })();
}
