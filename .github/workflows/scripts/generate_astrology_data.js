const fs = require('fs');
const path = require('path');
const { fetchPlanetaryPositions } = require('./astronomy_fetcher');
const { calculateDailyInfluences } = require('./astrology_calculator');
const { generatePredictions, synthesizeDailyReadings, CALCULATION_METHODS } = require('./prediction_generator');
const { generateCompatibilityMatrix } = require('./compatibility_calculator');

// Simple UMAP simulation (circular projection with method-based variation)
function calculateUMAP(predictions) {
    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

    const points = predictions.map((pred, idx) => {
        const signIndex = signs.indexOf(pred.sign);
        const methodIndex = CALCULATION_METHODS.findIndex(m => m.name === pred.method);

        // Calculate centroid for this sign (circle layout)
        const angle = (signIndex / 12) * 2 * Math.PI;
        const centroidX = 0.5 + 0.35 * Math.cos(angle);
        const centroidY = 0.5 + 0.35 * Math.sin(angle);

        // Add variation based on method (inner/outer ring)
        const methodRadius = 0.05 + (pred.confidence * 0.08);
        const methodAngle = (methodIndex / CALCULATION_METHODS.length) * 2 * Math.PI;

        const x = centroidX + methodRadius * Math.cos(methodAngle + angle);
        const y = centroidY + methodRadius * Math.sin(methodAngle + angle);

        return {
            id: idx,
            x: parseFloat(Math.max(0.05, Math.min(0.95, x)).toFixed(3)),
            y: parseFloat(Math.max(0.05, Math.min(0.95, y)).toFixed(3)),
            sign: pred.sign,
            method: pred.method,
            prediction: pred.prediction.substring(0, 120) + '...'
        };
    });

    return points;
}

// Calculate centroids for each sign
function calculateCentroids() {
    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
        'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

    const centroids = {};
    signs.forEach((sign, i) => {
        const angle = (i / 12) * 2 * Math.PI;
        centroids[sign] = {
            x: parseFloat((0.5 + 0.35 * Math.cos(angle)).toFixed(3)),
            y: parseFloat((0.5 + 0.35 * Math.sin(angle)).toFixed(3))
        };
    });

    return centroids;
}

async function generateAstrologyData() {
    console.log('🌌 Starting astronomy-powered astrology data generation...\n');

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    try {
        // Step 1: Fetch planetary positions
        console.log('📡 Calculating planetary positions...');
        const planetaryData = await fetchPlanetaryPositions(today);
        console.log(`✓ Positions calculated for ${dateStr}`);
        console.log(`  Sun: ${planetaryData.positions.sun.sign} ${planetaryData.positions.sun.degree}°`);
        console.log(`  Moon: ${planetaryData.positions.moon.sign} ${planetaryData.positions.moon.degree}° (${planetaryData.positions.moon.phase})`);
        console.log(`  Mercury: ${planetaryData.positions.mercury.sign} ${planetaryData.positions.mercury.degree}°${planetaryData.positions.mercury.retrograde ? ' (R)' : ''}`);
        console.log(`  Venus: ${planetaryData.positions.venus.sign} ${planetaryData.positions.venus.degree}°`);
        console.log(`  Mars: ${planetaryData.positions.mars.sign} ${planetaryData.positions.mars.degree}°`);
        console.log(`  Aspects: ${planetaryData.aspects.length} major aspects detected\n`);

        // Step 2: Calculate astrological influences
        console.log('🔮 Analyzing astrological influences...');
        const { influences } = await calculateDailyInfluences(today);
        const topInfluences = Object.entries(influences)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        console.log('✓ Top influences:');
        topInfluences.forEach(([name, score]) => {
            console.log(`  ${name}: ${score.toFixed(1)}/100`);
        });
        console.log();

        // Step 3: Generate predictions using 10 methods
        console.log('🧪 Generating multi-method predictions...');
        const predictions = await generatePredictions(today);
        console.log(`✓ Generated ${predictions.length} predictions (${CALCULATION_METHODS.length} methods × 12 signs)\n`);

        // Step 4: Synthesize daily readings
        console.log('📝 Synthesizing daily readings...');
        const readings = synthesizeDailyReadings(predictions);
        console.log(`✓ Created 12 unique daily readings\n`);

        // Step 5: Calculate compatibility matrix
        console.log('💕 Calculating compatibility matrix...');
        const compatibilityMatrix = await generateCompatibilityMatrix(today);
        const pairings = Object.keys(compatibilityMatrix).length;
        console.log(`✓ Calculated ${pairings} sign pairings\n`);

        // Step 6: Generate UMAP coordinates
        console.log('🗺️  Generating UMAP visualization...');
        const points = calculateUMAP(predictions);
        const centroids = calculateCentroids();
        console.log(`✓ Generated ${points.length} UMAP data points\n`);

        // Step 7: Compile final output
        const output = {
            lastUpdated: dateStr,
            planetary_positions: planetaryData.positions,
            major_aspects: planetaryData.aspects,
            influences: influences,
            calculation_methods: CALCULATION_METHODS.map(m => ({
                name: m.name,
                description: m.description,
                emphasis: m.emphasis
            })),
            centroids: centroids,
            points: points,
            readings: readings,
            compatibility_matrix: compatibilityMatrix
        };

        // Step 8: Save to file
        const outputPath = path.join(__dirname, '../../../data/astrology_daily.json');
        const dataDir = path.dirname(outputPath);

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`✅ Data saved to ${outputPath}\n`);

        // Display sample output
        console.log('📊 Sample Output:');
        console.log(`\nAries Reading: ${readings.Aries}`);
        console.log(`\nAries-Leo Compatibility: ${compatibilityMatrix['Aries-Leo'].score}/100 (${compatibilityMatrix['Aries-Leo'].level})`);
        console.log(`  ${compatibilityMatrix['Aries-Leo'].synthesis.substring(0, 120)}...\n`);

        console.log('🎉 Astrology data generation complete!');

    } catch (error) {
        console.error('❌ Error generating astrology data:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    generateAstrologyData()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { generateAstrologyData };
