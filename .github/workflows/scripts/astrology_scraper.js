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

        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AstrologyBot/1.0; +https://felixillion.github.io)'
            }
        });

        const $ = cheerio.load(response.data);
        let prediction = '';

        // Try sign-specific selector first
        if (site.selectors && site.selectors[sign.toLowerCase()]) {
            prediction = $(site.selectors[sign.toLowerCase()]).first().text().trim();
        }
        // Try generic content selector
        else if (site.selectors && site.selectors.content) {
            prediction = $(site.selectors.content).first().text().trim();
        }

        // Clean up the prediction
        prediction = prediction
            .replace(/\s+/g, ' ')
            .replace(/[\r\n]+/g, ' ')
            .substring(0, 500); // Limit length

        return prediction || null;
    } catch (error) {
        console.error(`Failed to scrape ${site.name} for ${sign}:`, error.message);
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
            // Rate limiting: wait 500ms between requests
            await new Promise(resolve => setTimeout(resolve, 500));
        }
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
    const predictionTexts = predictions.map(p => `- ${p.text.substring(0, 200)}`).join('\n');

    const prompt = `You are a bioinformatics researcher. Based on these astrology predictions for ${sign}, write ONE concise sentence (max 25 words) using lab/science terminology.

Predictions:
${predictionTexts}

Lab-themed prediction:`;

    try {
        const response = await axios.post(
            HF_API,
            {
                inputs: prompt,
                parameters: {
                    max_new_tokens: 50,
                    temperature: 0.7,
                    return_full_text: false
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let generated = response.data[0]?.generated_text || '';
        generated = generated.split('\n')[0].trim(); // Take first line only

        return generated || `Your ${sign} data clusters show optimal alignment today.`;
    } catch (error) {
        console.error(`LLM synthesis failed for ${sign}:`, error.message);
        // Fallback to template
        return `Your experimental pipeline shows promising ${sign} characteristics today.`;
    }
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
    const predictions = await scrapeAllSites(selectedSites);

    // Generate embeddings and UMAP coordinates
    console.log('Generating embeddings...');
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
    console.log('Total predictions:', allPredictions.length);
}

// Run if called directly
if (require.main === module) {
    generateAstrologyData().catch(console.error);
}

module.exports = { generateAstrologyData };
