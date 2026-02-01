// Astrobiology: The Intersection of Cytology and Celestial Mechanics

// -----------------------------------------------------------------------------
// 1. Data & Config
// -----------------------------------------------------------------------------

// Organelle Mappings (Planet -> Cell Part)
const ORGANELLES = {
    sun: { name: 'Nucleus', color: '#ffcc00', radius: 40, type: 'center' },
    moon: { name: 'Vesicle', color: '#f0f0f0', radius: 10, type: 'orbit' },
    mercury: { name: 'Ribosome', color: '#00ff66', radius: 6, type: 'orbit' }, // FITC Green
    venus: { name: 'Golgi', color: '#ff00ff', radius: 12, type: 'orbit' },    // CY5 Magenta
    mars: { name: 'Mitochondria', color: '#ff3300', radius: 14, type: 'orbit' }, // TRITC Red
    jupiter: { name: 'Vacuole', color: '#ffaa00', radius: 25, type: 'orbit' },
    saturn: { name: 'Cytoskeleton', color: '#0066ff', radius: 20, type: 'orbit', ring: true }, // DAPI Blue
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

    document.getElementById('date-display').textContent = today.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// -----------------------------------------------------------------------------
// 3. Logic: Canvas Visualization
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

        // Handle window resize
        window.addEventListener('resize', () => {
            initCanvas(planetaryData);
        });

    } catch (err) {
        console.error("Failed to load astrology data:", err);
        // Fallback to mock positions if file missing
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
                    <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${org.color}; box-shadow: 0 0 5px ${org.color};"></div>
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

    // Animation Loop
    let time = 0;

    function animate() {
        ctx.clearRect(0, 0, width, height);

        // Draw Cell Membrane (Background Boundary)
        ctx.beginPath();
        ctx.arc(centerX, centerY, Math.min(width, height) * 0.45, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Cytoplasm (Subtle noise/texture could go here)

        // Draw Sun (Nucleus)
        drawOrganelle(ctx, centerX, centerY, ORGANELLES.sun, 0);

        // Draw Planets (Organelles)
        Object.entries(positions).forEach(([planet, data]) => {
            if (planet === 'sun') return; // Handled separately
            if (!ORGANELLES[planet]) return;

            const org = ORGANELLES[planet];

            // Map 0-360 degrees to radians (Astrology charts start 0 at left/Aries usually, but we can just map directly)
            // Adjust radius based on planet 'distance' roughly
            let orbitRadius;
            switch (planet) {
                case 'mercury': orbitRadius = 70; break;
                case 'venus': orbitRadius = 100; break;
                case 'moon': orbitRadius = 130; break; // Moon is technically orbiting Earth, but for this viz we center Sun
                case 'mars': orbitRadius = 160; break;
                case 'jupiter': orbitRadius = 200; break;
                case 'saturn': orbitRadius = 240; break;
                default: orbitRadius = 100;
            }

            // Scale orbit radius to canvas size
            const scale = Math.min(width, height) / 600;
            orbitRadius *= scale;

            // Calculate position
            // Add slight rotation over time for "aliveness"
            const angle = (data.degree * Math.PI / 180) + (time * 0.0005 * (300 / orbitRadius));

            const x = centerX + Math.cos(angle) * orbitRadius;
            const y = centerY + Math.sin(angle) * orbitRadius;

            drawOrbitTrail(ctx, centerX, centerY, orbitRadius);
            drawOrganelle(ctx, x, y, org, time);
        });

        time++;
        requestAnimationFrame(animate);
    }

    animate();
}

function drawOrbitTrail(ctx, cx, cy, radius) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.stroke();
}

function drawOrganelle(ctx, x, y, type, time) {
    // Glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, type.radius * 2);
    gradient.addColorStop(0, type.color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, type.radius * 2, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, type.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Pulse effect
    if (type.name === 'Mitochondria') {
        const pulse = 1 + Math.sin(time * 0.05) * 0.2;
        ctx.strokeStyle = type.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, type.radius * pulse, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Ring for Saturn
    if (type.ring) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y, type.radius * 2, type.radius * 0.5, Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initAstrobiology);
