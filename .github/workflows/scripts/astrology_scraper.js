const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// Hugging Face API configuration
const HF_TOKEN = process.env.HF_TOKEN;
const HF_API = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

// Seeded random number generator for reproducible daily selection
function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function selectDailySites(sites, date) {
    const seed = new Date(date).getTime();
    const shuffled = [...sites];

    // Fisher-Yates shuffle with seeded random
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(seed + i) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, 10);
}

async function scrapeSite(site, sign) {
    try {
        let url = site.url;

        // Handle URL patterns (e.g., {sign} placeholder)
        if (site.urlPattern) {
            url = url.replace('{sign}', sign.toLowerCase());
        }

        console.log(`Scraping ${site.name} for ${sign}...`);

        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const $ = cheerio.load(response.data);
        let prediction = '';

        // Strategy 1: Try sign-specific selector
        if (site.selectors && site.selectors[sign.toLowerCase()]) {
            prediction = $(site.selectors[sign.toLowerCase()]).first().text().trim();
        }

        // Strategy 2: Try generic content selector
        if (!prediction && site.selectors && site.selectors.content) {
            prediction = $(site.selectors.content).first().text().trim();
        }

        // Strategy 3: Try common patterns
        if (!prediction) {
            const commonSelectors = [
                `[data-sign="${sign.toLowerCase()}"] p`,
                `.${sign.toLowerCase()} p`,
                `#${sign.toLowerCase()} p`,
                `.horoscope-content p`,
                `.daily-horoscope p`,
                'article p',
                '.content p'
            ];

            for (const selector of commonSelectors) {
                const text = $(selector).first().text().trim();
                if (text && text.length > 50) {
                    prediction = text;
                    break;
                }
            }
        }

        // Clean up the prediction
        if (prediction) {
            prediction = prediction
                .replace(/\s+/g, ' ')
                .replace(/[\r\n]+/g, ' ')
                .substring(0, 500);

            console.log(`✓ Got prediction from ${site.name} for ${sign} (${prediction.length} chars)`);
            return prediction;
        }

        console.log(`✗ No prediction found at ${site.name} for ${sign}`);
        return null;
    } catch (error) {
        console.error(`✗ Failed to scrape ${site.name} for ${sign}:`, error.message);
        return null;
    }
}

async function scrapeAllSites(selectedSites) {
    const predictions = {};

    for (const sign of SIGNS) {
        predictions[sign] = [];

        for (const site of selectedSites) {
            const prediction = await scrapeSite(site, sign);
            if (prediction) {
                predictions[sign].push({
                    site: site.name,
                    text: prediction
                });
            }
            // Rate limiting: wait 1s between requests to be respectful
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`${sign}: Got ${predictions[sign].length} predictions`);
    }

    return predictions;
}

async function generateEmbedding(text) {
    try {
        const response = await axios.post(
            'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
            { inputs: text },
            {
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Embedding generation failed:', error.message);
        return null;
    }
}

async function synthesizePrediction(sign, predictions) {
    if (predictions.length === 0) {
        return `Your ${sign} experimental data shows standard deviation today.`;
    }

    const predictionTexts = predictions.map(p => `- ${p.text.substring(0, 200)}`).join('\n');

    const prompt = `You are a bioinformatics researcher. Based on these astrology predictions for ${sign}, write ONE concise sentence (max 25 words) using lab/science terminology.

Predictions:
${predictionTexts}

Lab-themed prediction:`;

    try {
        console.log(`Synthesizing prediction for ${sign}...`);
        const response = await axios.post(
            HF_API,
            {
                inputs: prompt,
                parameters: {
                    max_new_tokens: 60,
                    temperature: 0.8,
                    return_full_text: false,
                    do_sample: true
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        let generated = response.data[0]?.generated_text || '';
        generated = generated.split('\n')[0].trim();

        if (generated && generated.length > 10 && !generated.includes('error')) {
            console.log(`✓ LLM generated for ${sign}: ${generated.substring(0, 50)}...`);
            return generated;
        }

        throw new Error('Invalid LLM response');
    } catch (error) {
        console.error(`✗ LLM synthesis failed for ${sign}:`, error.response?.data || error.message);
        // Use intelligent template-based fallback
        return generateTemplateBasedPrediction(sign, predictions);
    }
}

function generateTemplateBasedPrediction(sign, predictions) {
    // Sign characteristics for generating unique predictions
    const signTraits = {
        'Aries': { element: 'fire', quality: 'cardinal', themes: ['energy', 'initiative', 'action'] },
        'Taurus': { element: 'earth', quality: 'fixed', themes: ['stability', 'resources', 'cultivation'] },
        'Gemini': { element: 'air', quality: 'mutable', themes: ['communication', 'adaptability', 'analysis'] },
        'Cancer': { element: 'water', quality: 'cardinal', themes: ['sensitivity', 'protection', 'nurturing'] },
        'Leo': { element: 'fire', quality: 'fixed', themes: ['creativity', 'expression', 'leadership'] },
        'Virgo': { element: 'earth', quality: 'mutable', themes: ['precision', 'optimization', 'service'] },
        'Libra': { element: 'air', quality: 'cardinal', themes: ['balance', 'harmony', 'partnership'] },
        'Scorpio': { element: 'water', quality: 'fixed', themes: ['depth', 'transformation', 'intensity'] },
        'Sagittarius': { element: 'fire', quality: 'mutable', themes: ['exploration', 'expansion', 'philosophy'] },
        'Capricorn': { element: 'earth', quality: 'cardinal', themes: ['structure', 'achievement', 'discipline'] },
        'Aquarius': { element: 'air', quality: 'fixed', themes: ['innovation', 'collective', 'breakthrough'] },
        'Pisces': { element: 'water', quality: 'mutable', themes: ['intuition', 'dissolution', 'compassion'] }
    };

    const traits = signTraits[sign];

    // Create deterministic seed from sign name and date for reproducibility
    const today = new Date().toISOString().split('T')[0];
    const signSeed = (sign.charCodeAt(0) * 1000) + parseInt(today.replace(/-/g, ''));

    // Seeded random function
    function seededRandom(seed) {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    // Comprehensive lab-themed template bank (organized by sign characteristics)
    const templatesByElement = {
        fire: [
            `Your ${sign} kinetic energy reaches maximum catalytic efficiency today.`,
            `Rapid reaction rates detected in ${sign} enzymatic pathways.`,
            `High-temperature phase transitions activate ${sign} protocols.`,
            `Exothermic reactions accelerate ${sign} experimental throughput.`,
            `Your ${sign} system shows peak metabolic flux and ATP production.`
        ],
        earth: [
            `Stable baseline conditions optimize ${sign} experimental reproducibility.`,
            `Your ${sign} data demonstrates robust statistical power today.`,
            `Substrate accumulation enhances ${sign} biosynthetic pathways.`,
            `Crystallization conditions are ideal for ${sign} structural analysis.`,
            `Ground-state energy minimization favors ${sign} protocols.`
        ],
        air: [
            `Network topology analysis reveals optimal ${sign} connectivity.`,
            `Information transfer efficiency peaks in ${sign} signaling cascades.`,
            `Your ${sign} data shows high-dimensional clustering patterns.`,
            `Gas-phase reactions facilitate ${sign} analytical precision.`,
            `Signal propagation velocities maximize ${sign} throughput.`
        ],
        water: [
            `Aqueous solution dynamics favor ${sign} molecular interactions.`,
            `Your ${sign} system achieves optimal hydration equilibrium.`,
            `Fluid dynamics modeling predicts favorable ${sign} outcomes.`,
            `Solvent-accessible surface area increases for ${sign} binding.`,
            `Osmotic gradients drive ${sign} transport mechanisms efficiently.`
        ]
    };

    const templatesByTheme = {
        energy: [
            `ATP synthesis rates peak in your ${sign} mitochondrial assays.`,
            `Electrochemical gradients optimize ${sign} energy production.`
        ],
        initiative: [
            `De novo pathway activation initiates ${sign} biosynthesis.`,
            `Your ${sign} protocols show first-order kinetic advantages.`
        ],
        action: [
            `Active site accessibility maximizes ${sign} catalytic rates.`,
            `Immediate-early gene expression activates ${sign} responses.`
        ],
        stability: [
            `Thermodynamic stability ensures ${sign} experimental consistency.`,
            `Your ${sign} steady-state conditions minimize variance.`
        ],
        resources: [
            `Substrate concentrations are optimal for ${sign} reactions today.`,
            `Resource allocation efficiency maximizes ${sign} yield.`
        ],
        cultivation: [
            `Cell density reaches logarithmic growth phase in ${sign} cultures.`,
            `Your ${sign} expansion protocols show exponential kinetics.`
        ],
        communication: [
            `Intercellular signaling cascades enhance ${sign} coordination.`,
            `Your ${sign} transcriptional regulation shows optimal feedback.`
        ],
        adaptability: [
            `Conformational flexibility enables ${sign} substrate promiscuity.`,
            `Your ${sign} system demonstrates phenotypic plasticity.`
        ],
        analysis: [
            `High-resolution mass spectrometry reveals ${sign} complexities.`,
            `Multivariate analysis uncovers hidden ${sign} correlations.`
        ],
        sensitivity: [
            `Detection limits reach femtomolar range for ${sign} assays.`,
            `Your ${sign} sensors show exceptional signal sensitivity.`
        ],
        protection: [
            `Quality control checkpoints safeguard ${sign} data integrity.`,
            `Error-correction pathways protect ${sign} genomic stability.`
        ],
        nurturing: [
            `Growth factor supplementation optimizes ${sign} cell viability.`,
            `Your ${sign} culture conditions support robust proliferation.`
        ],
        creativity: [
            `Novel combinatorial approaches generate ${sign} diversity.`,
            `Your ${sign} design space exploration yields innovations.`
        ],
        expression: [
            `Transgene expression levels peak in ${sign} constructs today.`,
            `Protein production rates maximize ${sign} output.`
        ],
        leadership: [
            `Dominant clones emerge in ${sign} selective conditions.`,
            `Your ${sign} pathways show hierarchical regulation.`
        ],
        precision: [
            `Instrumental resolution enhances ${sign} measurement accuracy.`,
            `Your ${sign} quality metrics exceed three-sigma thresholds.`
        ],
        optimization: [
            `Parameter sweeps identify ${sign} optima across variables.`,
            `Gradient descent converges rapidly for ${sign} functions.`
        ],
        service: [
            `Helper T cell activation supports ${sign} immune responses.`,
            `Auxiliary pathways enhance ${sign} primary reactions.`
        ],
        balance: [
            `Homeostatic mechanisms maintain ${sign} equilibrium states.`,
            `Your ${sign} system achieves optimal pH buffering.`
        ],
        harmony: [
            `Cooperative binding kinetics synchronize ${sign} processes.`,
            `Allosteric regulation coordinates ${sign} enzyme activities.`
        ],
        partnership: [
            `Symbiotic interactions strengthen ${sign} co-culture systems.`,
            `Protein-protein docking energies favor ${sign} complexes.`
        ],
        depth: [
            `Deep sequencing reveals rare ${sign} variant populations.`,
            `Your ${sign} penetration depth enables subsurface analysis.`
        ],
        transformation: [
            `Epigenetic reprogramming transforms ${sign} cell states.`,
            `Your ${sign} transfection efficiency reaches maximum.`
        ],
        intensity: [
            `Laser power optimization increases ${sign} signal intensity.`,
            `Concentrated samples amplify ${sign} detection levels.`
        ],
        exploration: [
            `Unbiased screens discover novel ${sign} target space.`,
            `Your ${sign} exploratory analysis reveals new territories.`
        ],
        expansion: [
            `Library complexity increases ${sign} diversity exponentially.`,
            `Expansion microscopy reveals ${sign} nanoscale details.`
        ],
        philosophy: [
            `First-principles modeling elucidates ${sign} mechanisms.`,
            `Theoretical frameworks guide ${sign} hypothesis generation.`
        ],
        structure: [
            `Crystallographic refinement resolves ${sign} architecture.`,
            `Your ${sign} scaffolding maintains structural integrity.`
        ],
        achievement: [
            `Milestone endpoints are reached in ${sign} timelines today.`,
            `Your ${sign} objectives achieve statistical significance.`
        ],
        discipline: [
            `Rigorous controls validate ${sign} experimental design.`,
            `Systematic protocols ensure ${sign} reproducibility.`
        ],
        innovation: [
            `Breakthrough methodologies revolutionize ${sign} approaches.`,
            `Your ${sign} platform enables unprecedented capabilities.`
        ],
        collective: [
            `Population-level dynamics favor ${sign} group behaviors.`,
            `Ensemble averages converge for ${sign} measurements.`
        ],
        breakthrough: [
            `Paradigm-shifting discoveries emerge from ${sign} data.`,
            `Your ${sign} results exceed prior theoretical limits.`
        ],
        intuition: [
            `Bayesian priors incorporate ${sign} domain knowledge.`,
            `Pattern recognition reveals subtle ${sign} signatures.`
        ],
        dissolution: [
            `Solubilization improves ${sign} bioavailability profiles.`,
            `Your ${sign} disaggregation protocols enhance dispersion.`
        ],
        compassion: [
            `Gentle handling preserves ${sign} sample integrity.`,
            `Low-stress conditions maintain ${sign} viability.`
        ]
    };

    // Select templates based on sign's element and themes
    const elementTemplates = templatesByElement[traits.element] || [];
    const themeTemplates = [];

    for (const theme of traits.themes) {
        if (templatesByTheme[theme]) {
            themeTemplates.push(...templatesByTheme[theme]);
        }
    }

    // Combine all available templates
    const allTemplates = [...elementTemplates, ...themeTemplates];

    if (allTemplates.length > 0) {
        // Use seeded random to pick a template (deterministic per day+sign)
        const index = Math.floor(seededRandom(signSeed) * allTemplates.length);
        return allTemplates[index];
    }

    // Absolute fallback (should never reach here)
    return `Your ${sign} experimental data demonstrates ${traits.element}-phase characteristics today.`;
}

function calculateUMAP(embeddings) {
    // Simplified 2D projection (in production, would use actual UMAP library)
    // For now, create circular clusters by sign
    const points = [];
    let id = 0;

    SIGNS.forEach((sign, signIndex) => {
        const angle = (signIndex / SIGNS.length) * Math.PI * 2;
        const centerX = 0.5 + Math.cos(angle) * 0.35;
        const centerY = 0.5 + Math.sin(angle) * 0.35;

        // Create points for each prediction of this sign
        const signPredictions = embeddings.filter(e => e.sign === sign);
        signPredictions.forEach((pred, i) => {
            points.push({
                id: id++,
                x: centerX + (Math.random() - 0.5) * 0.15,
                y: centerY + (Math.random() - 0.5) * 0.15,
                sign: sign,
                site: pred.site,
                prediction: pred.text.substring(0, 100)
            });
        });
    });

    return points;
}

async function generateAstrologyData() {
    console.log('Starting astrology data generation...');

    // Load site configuration
    const sitesPath = path.join(__dirname, 'astrology_sites.json');
    const allSites = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));

    // Select 10 sites for today
    const today = new Date().toISOString().split('T')[0];
    const selectedSites = selectDailySites(allSites, today);
    console.log('Selected sites:', selectedSites.map(s => s.name).join(', '));

    // Scrape predictions
    console.log('Scraping predictions...');
    let predictions = await scrapeAllSites(selectedSites);

    // Check if we got any predictions at all
    const totalPredictions = Object.values(predictions).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`Total predictions scraped: ${totalPredictions}`);

    // If scraping completely failed, use mock data for testing
    if (totalPredictions === 0) {
        console.warn('WARNING: No predictions scraped. Generating mock data for testing...');
        predictions = generateMockPredictions(selectedSites);
    }

    // Generate embeddings and UMAP coordinates
    console.log('Generating UMAP coordinates...');
    const allPredictions = [];
    for (const sign of SIGNS) {
        for (const pred of predictions[sign]) {
            allPredictions.push({
                sign,
                site: pred.site,
                text: pred.text
            });
        }
    }

    const points = calculateUMAP(allPredictions);
    console.log(`Generated ${points.length} UMAP points`);

    // Generate centroids
    const centroids = {};
    SIGNS.forEach((sign, i) => {
        const angle = (i / SIGNS.length) * Math.PI * 2;
        centroids[sign] = {
            x: 0.5 + Math.cos(angle) * 0.35,
            y: 0.5 + Math.sin(angle) * 0.35
        };
    });

    // Synthesize lab-themed predictions
    console.log('Synthesizing predictions with LLM...');
    const readings = {};
    for (const sign of SIGNS) {
        if (predictions[sign].length > 0) {
            readings[sign] = await synthesizePrediction(sign, predictions[sign]);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
        } else {
            readings[sign] = `Your ${sign} experimental data shows standard deviation today.`;
        }
    }

    // Prepare output
    const output = {
        lastUpdated: today,
        sources: selectedSites.map(s => ({
            name: s.name,
            url: s.url
        })),
        centroids,
        points,
        readings
    };

    // Save to file
    const outputPath = path.join(__dirname, '../../../data/astrology_daily.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log('Astrology data saved to:', outputPath);
    console.log('Summary:');
    console.log(`  - Sources: ${selectedSites.length}`);
    console.log(`  - Predictions: ${allPredictions.length}`);
    console.log(`  - UMAP points: ${points.length}`);
}

// Generate mock predictions for testing when scraping fails
function generateMockPredictions(sites) {
    const mockTemplates = [
        "Today brings new opportunities for {sign}. Focus on communication and creative projects.",
        "Your energy is high today, {sign}. Take action on important goals and trust your instincts.",
        "Financial matters require attention for {sign}. Review your budget and plan ahead.",
        "Relationships are highlighted today, {sign}. Reach out to loved ones and strengthen bonds.",
        "Career advancement is possible for {sign}. Showcase your skills and take initiative.",
        "Health and wellness are priorities for {sign}. Make time for self-care and rest.",
        "Creative expression flows easily for {sign}. Pursue artistic endeavors with confidence.",
        "Unexpected changes may arise for {sign}. Stay flexible and adapt to new circumstances.",
        "Your intuition is strong today, {sign}. Trust your inner guidance in decision-making.",
        "Social connections bring joy to {sign}. Attend gatherings and network with others."
    ];

    const predictions = {};
    SIGNS.forEach(sign => {
        predictions[sign] = sites.slice(0, 5).map((site, i) => ({
            site: site.name,
            text: mockTemplates[i % mockTemplates.length].replace('{sign}', sign)
        }));
    });

    return predictions;
}

// Run if called directly
if (require.main === module) {
    generateAstrologyData().catch(console.error);
}

module.exports = { generateAstrologyData };
