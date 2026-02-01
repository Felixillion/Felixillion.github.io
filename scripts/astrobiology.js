// Astrobiology: The Intersection of Cytology and Celestial Mechanics

// -----------------------------------------------------------------------------
// 1. Data & Config
// -----------------------------------------------------------------------------

// Organelle Mappings (Planet -> Cell Part)
const ORGANELLES = {
    sun: { name: 'Nucleus', color: '#0066ff', radius: 45, type: 'center', glow: '#00ccff' }, // DAPI Blue Nucleus
    moon: { name: 'Vesicle', color: '#ffffff', radius: 8, type: 'orbit', glow: '#ffffff' },
    mercury: { name: 'Ribosome', color: '#00ff66', radius: 4, type: 'orbit', glow: '#00ff66' }, // FITC Green
    venus: { name: 'Golgi', color: '#ff00ff', radius: 15, type: 'orbit', glow: '#ff00ff', shape: 'irregular' },    // CY5 Magenta
    mars: { name: 'Mitochondria', color: '#ff3300', radius: 12, type: 'orbit', glow: '#ff5500', shape: 'pill' }, // TRITC Red
    jupiter: { name: 'Vacuole', color: '#ffaa00', radius: 28, type: 'orbit', glow: '#ffaa00' },
    saturn: { name: 'Cytoskeleton', color: '#00ffcc', radius: 22, type: 'orbit', ring: true, glow: '#00ffcc' },
};

// Valid "Experiments" and "Avoidances"
const EXPERIMENTS = [
    "Optimizing caffeine intake via serial titration",
    "Observing the effects of deadline pressure on cortisol synthesis",
    "Calibrating the pipette of destiny",
    "Sequencing the genome of the office plant",
    "Quantifying the viscosity of lab coffee",
    "Extracting DNA from a strawberry for the 100th time",
    "Debugging code by explaining it to a rubber duck",
    "Training the AI to appreciate cat memes",
    "Synthesizing a new playlist for late-night data analysis",
    "Measuring the half-life of motivation on a Monday"
];

const AVOIDANCES = [
    "Opening the -80°C freezer without gloves",
    "Trusting the 'label soon' pile",
    "Updating R just before a deadline",
    "Looking directly into the laser (metaphorically or literally)",
    "Asking 'what smell is that?'",
    "Assuming the backup worked",
    "Touching the communal keyboard",
    "Eating lunch at the bench",
    "Replying 'Reply All' to the departmental list",
    "Believing the p-value without the effect size"
];

// -----------------------------------------------------------------------------
// 2. Logic: Daily Protocol
// -----------------------------------------------------------------------------

function generateDailyProtocol() {
    const today = new Date();
    const day = today.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = (day === 0 || day === 6);

    const titleEl = document.getElementById('experiment-title');
    const descEl = document.getElementById('experiment-desc');
    const avoidContainer = document.getElementById('avoid-container');
    const avoidDescEl = document.getElementById('avoid-desc');

    if (!titleEl) return;

    // Deterministic random implementation (Seeded by Date)
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const seededRandom = () => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    };

    if (isWeekend) {
        titleEl.textContent = "Lab Safety Warning (Weekend Protocol)";
        descEl.innerHTML = "<strong>DO NOT ENTER THE LAB.</strong><br>The incubators require personal space. Your cells are judging you for working overtime.";
        avoidContainer.style.display = "none";
    } else {
        const expIndex = Math.floor(seededRandom() * EXPERIMENTS.length);
        const avoidIndex = Math.floor((seededRandom() + 0.5) * AVOIDANCES.length) % AVOIDANCES.length;

        titleEl.textContent = "Recommended Protocol";
        descEl.textContent = EXPERIMENTS[expIndex] + ".";

        avoidContainer.style.display = "block";
        avoidDescEl.textContent = AVOIDANCES[avoidIndex] + ".";
    }

    const dateDisplay = document.getElementById('date-display');
    if (dateDisplay) {
        dateDisplay.textContent = today.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
}

// -----------------------------------------------------------------------------
// 3. Logic: Canvas Visualization (Fluorochrome Style)
// -----------------------------------------------------------------------------

let planetaryData = null;

async function initAstrobiology() {
    generateDailyProtocol();

    try {
        const response = await fetch('data/astrology_daily.json');
        const data = await response.json();
        planetaryData = data.planetary_positions;

        renderPlanetaryData(planetaryData);
        initCanvas(planetaryData);

        // Setup Restored Widgets
        if (data.readings) setupSignSelector(data.readings);
        if (data.compatibility_matrix) setupCompatibility(data.compatibility_matrix);

        // Handle window resize
        window.addEventListener('resize', () => {
            initCanvas(planetaryData);
        });

    } catch (err) {
        console.error("Failed to load astrology data:", err);
        // Fallback to mock positions
        const mockData = {
            sun: { degree: 0 },
            moon: { degree: 45 },
            mercury: { degree: 90 },
            venus: { degree: 135 },
            mars: { degree: 180 },
            jupiter: { degree: 225 },
            saturn: { degree: 270 }
        };
        initCanvas(mockData);
    }
}

function renderPlanetaryData(positions) {
    const container = document.getElementById('planetary-data');
    if (!container) return;

    container.innerHTML = Object.entries(positions)
        .filter(([planet]) => ORGANELLES[planet])
        .map(([planet, data]) => {
            const org = ORGANELLES[planet];
            return `
                <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary);">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${org.color}; box-shadow: 0 0 8px ${org.glow};"></div>
                    <div>
                        <div style="font-weight: bold; color: #fff;">${org.name}</div>
                        <div style="font-size: 0.75rem;">${planet.charAt(0).toUpperCase() + planet.slice(1)} (${Math.floor(data.degree)}°)</div>
                    </div>
                </div>
            `;
        }).join('');
}

function initCanvas(positions) {
    const canvas = document.getElementById('astro-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.clientWidth; // Use container width
    const height = 600;

    canvas.width = width;
    canvas.height = height;

    const centerX = width / 2;
    const centerY = height / 2;

    let time = 0;

    function animate() {
        // Clear with slight trail for motion blur feel? No, standard clear is cleaner for cells
        ctx.clearRect(0, 0, width, height);

        // 1. Draw Cell Boundary (Membrane)
        ctx.beginPath();
        // Slightly organic shape (wobbling circle)
        const radius = Math.min(width, height) * 0.45;
        for (let i = 0; i <= Math.PI * 2; i += 0.1) {
            const wobble = Math.sin(i * 5 + time * 0.01) * 5;
            const r = radius + wobble;
            const x = centerX + Math.cos(i) * r;
            const y = centerY + Math.sin(i) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 2. Draw Sun (Nucleus) - DAPI Blue style
        drawOrganelle(ctx, centerX, centerY, ORGANELLES.sun, time);

        // 3. Draw Planets (Organelles)
        Object.entries(positions).forEach(([planet, data]) => {
            if (planet === 'sun') return;
            if (!ORGANELLES[planet]) return;

            const org = ORGANELLES[planet];

            // Orbit Radius
            let orbitRadius;
            switch (planet) {
                case 'mercury': orbitRadius = 70; break;
                case 'venus': orbitRadius = 100; break;
                case 'moon': orbitRadius = 130; break;
                case 'mars': orbitRadius = 160; break;
                case 'jupiter': orbitRadius = 200; break;
                case 'saturn': orbitRadius = 240; break;
                default: orbitRadius = 100;
            }
            const scale = Math.min(width, height) / 600;
            orbitRadius *= scale;

            // Position with slow rotation
            const angle = (data.degree * Math.PI / 180) + (time * 0.0005 * (300 / orbitRadius));
            const x = centerX + Math.cos(angle) * orbitRadius;
            const y = centerY + Math.sin(angle) * orbitRadius;

            drawOrganelle(ctx, x, y, org, time);
        });

        time++;
        requestAnimationFrame(animate);
    }

    animate();
}

function drawOrganelle(ctx, x, y, type, time) {
    ctx.save();

    // Blur effect for fluorescence look
    ctx.shadowBlur = 15;
    ctx.shadowColor = type.glow;

    if (type.shape === 'pill') {
        // Mitochondria (Pill shape)
        ctx.translate(x, y);
        ctx.rotate(time * 0.02);

        ctx.fillStyle = type.color;
        ctx.beginPath();
        const w = type.radius * 2;
        const h = type.radius * 0.8;
        ctx.roundRect(-w / 2, -h / 2, w, h, 10);
        ctx.fill();

        // Inner cristae lines
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-w / 4, 0); ctx.lineTo(w / 4, 0);
        ctx.stroke();

    } else if (type.shape === 'irregular') {
        // Golgi (Wobbly blobs)
        ctx.translate(x, y);
        ctx.fillStyle = type.color;
        ctx.beginPath();
        // Stack of sacs
        for (let j = 0; j < 3; j++) {
            ctx.ellipse(0, (j - 1) * 5, type.radius, type.radius * 0.4, Math.sin(time * 0.05 + j) * 0.5, 0, Math.PI * 2);
        }
        ctx.fill();

    } else {
        // Standard Spherical Organelles (Vacuoles, Vesicles, Nucleus)
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, type.radius);
        gradient.addColorStop(0, '#fff'); // Bright center
        gradient.addColorStop(0.4, type.color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)'); // Fade out

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, type.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// -----------------------------------------------------------------------------
// 4. Logic: Restored Interactive Widgets
// -----------------------------------------------------------------------------

function setupSignSelector(readings) {
    const select = document.getElementById('zodiac-select');
    const readingDisplay = document.getElementById('personal-reading');

    select?.addEventListener('change', (e) => {
        const sign = e.target.value;
        if (sign && readings[sign]) {
            readingDisplay.style.opacity = 0;
            setTimeout(() => {
                readingDisplay.innerHTML = `"${readings[sign]}"`;
                readingDisplay.style.opacity = 1;
            }, 200);
        } else {
            readingDisplay.textContent = 'Select your sign to analyze today\'s experimental conditions.';
        }
    });
}

function setupCompatibility(matrix) {
    const s1 = document.getElementById('sign1-select');
    const s2 = document.getElementById('sign2-select');
    const resultDiv = document.getElementById('compatibility-result');
    const scoreDiv = document.getElementById('compat-score');
    const levelDiv = document.getElementById('compat-level');
    const textDiv = document.getElementById('compat-text');
    const detailsDiv = document.getElementById('compat-details');

    const updateCompatibility = () => {
        const sign1 = s1.value;
        const sign2 = s2.value;

        if (sign1 && sign2 && matrix) {
            let key = sign1 === sign2 ? sign1 : `${sign1}-${sign2}`;
            if (!matrix[key]) key = `${sign2}-${sign1}`;

            const data = matrix[key];
            if (data) {
                resultDiv.style.display = 'block';
                scoreDiv.textContent = `${data.score}%`;
                levelDiv.textContent = data.level;
                textDiv.textContent = `"${data.synthesis}"`;

                const color = data.score > 75 ? 'var(--fitc-green)' :
                    data.score > 50 ? 'var(--dapi-blue)' : 'var(--cy5-magenta)';
                scoreDiv.style.color = color;
                scoreDiv.style.textShadow = `0 0 15px ${color}`;

                detailsDiv.innerHTML = `
                    <div style="background: rgba(255,255,255,0.05); padding: 0.5rem 1rem; border-radius: 4px;">
                        Element Harmony: ${data.element_harmony}%
                    </div>
                `;
            }
        } else {
            resultDiv.style.display = 'none';
        }
    };

    s1?.addEventListener('change', updateCompatibility);
    s2?.addEventListener('change', updateCompatibility);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initAstrobiology);
