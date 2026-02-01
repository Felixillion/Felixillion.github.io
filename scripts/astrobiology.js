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

// Valid "Experiments" and "Avoidances" (Medical Biology Themed)
const EXPERIMENTS = [
    { text: "Optimizing flow cytometry voltage settings", why: "Because spectral overlap is a myth created by big filter companies." },
    { text: "Performing Western Blot transfer", why: "The proteins align better when Mercury is in retrograde." },
    { text: "Sterile mouse harvesting", why: "The circadian rhythms of the colony match your coffee intake exactly." },
    { text: "Setting up a 384-well PCR plate", why: "Your pipetting thumb needs the workout and the data will be statistically significant... hopefully." },
    { text: "Thawing frozen PBMC samples", why: "Cell viability is predicted to be 98% due to favorable freezer feng shui." },
    { text: "Running a 24-hour timecourse assay", why: "Sleep is for the weak, and timepoints 18, 20, and 22 are critical." },
    { text: "Calibrating the confocal microscope", why: "The lasers are feeling particularly coherent this week." },
    { text: "Sorting rare T-cell populations", why: "Because finding a needle in a haystack is too easy; try finding a cell in a spleen." },
    { text: "Transfecting HEK293 cells", why: "They will eat anything you give them, unlike your reviewers." },
    { text: "Writing the Materials & Methods section", why: "Reflection is good for the soul, and for remembering what you actually did 6 months ago." }
];

const AVOIDANCES = [
    { text: "Touching the -80°C freezer handle without gloves", why: "Frostbite builds character, but losing fingerprints affects biometric security." },
    { text: "Using the communal water bath", why: "It has evolved its own ecosystem that is currently hostile to your samples." },
    { text: "Asking the PI for funding today", why: "Their grant score just came back. Do not approach." },
    { text: "Loading the last gel lane", why: "The smile effect will turn your bands into a tragic frown." },
    { text: "Trusting the 'autofocus' button", why: "The microscope lies. It always focuses on the dust, not the nucleus." },
    { text: "Opening the incubator during a CO2 calibration", why: "The alarm sound triggers a primal fear response in all lab personnel." },
    { text: "Using the 'good' scissors for paper", why: "The lab manager is watching. Always watching." },
    { text: "assuming the plate reader is empty", why: "Someone left their data in there. It's been there since 2019." }
];

// -----------------------------------------------------------------------------
// 2. Logic: Weekly Protocol (Synced with Week Number)
// -----------------------------------------------------------------------------

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { week: weekNo, year: d.getUTCFullYear() };
}

function generateDailyProtocol() {
    const today = new Date();
    const day = today.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = (day === 0 || day === 6);
    const { week, year } = getWeekNumber(today);

    const titleEl = document.getElementById('experiment-title');
    const descEl = document.getElementById('experiment-desc');
    const avoidContainer = document.getElementById('avoid-container');
    const avoidDescEl = document.getElementById('avoid-desc');

    if (!titleEl) return;

    // Seed based on Year + Week (Weekly update)
    const seed = year * 100 + week;
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

        titleEl.textContent = "Recommended Experiment (Weekly)";
        descEl.innerHTML = `<strong>${EXPERIMENTS[expIndex].text}</strong><br><em style="font-size: 0.9em; opacity: 0.8;">"${EXPERIMENTS[expIndex].why}"</em>`;

        avoidContainer.style.display = "block";
        avoidDescEl.innerHTML = `<strong>${AVOIDANCES[avoidIndex].text}</strong><br><em style="font-size: 0.9em; opacity: 0.8;">"${AVOIDANCES[avoidIndex].why}"</em>`;
    }

    const dateDisplay = document.getElementById('date-display');
    if (dateDisplay) {
        dateDisplay.textContent = `Week ${week}, ${year}`;
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
            const x = centerX + Math.cos(i + time * 0.002) * r;
            const y = centerY + Math.sin(i + time * 0.002) * r;
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
        Object.entries(positions).forEach(([planet, data], index) => {
            if (planet === 'sun') return;
            if (!ORGANELLES[planet]) return;

            const org = ORGANELLES[planet];

            // Organic, Elliptical Orbits
            // Scale orbits to strictly fit within the cell membrane (0.45 * minDimension)
            // Save 30px padding for the membrane edge
            const maxRadius = (Math.min(width, height) * 0.45) - 35;
            const minRadius = 50; // Clear the nucleus

            // Normalize index to 0-1 range for distribution
            const normalizedDist = (index + 1) / Object.keys(positions).length;

            // Calculate base distance
            const baseDist = minRadius + (normalizedDist * (maxRadius - minRadius));

            const eccentricity = 0.8 + (index % 3) * 0.1; // 0.8 - 1.0 (Varied flatness)
            const a = baseDist; // Semi-major axis
            const b = baseDist * eccentricity; // Semi-minor axis

            const orbitRotation = (index * Math.PI / 2.5); // Rotate the whole ellipse

            // Calculate position on the ellipse
            // Slower outer orbits
            const orbitSpeed = 0.0002 + (1 - normalizedDist) * 0.0008;
            const angle = (data.degree * Math.PI / 180) + (time * orbitSpeed);

            // Ellipse parametric equation with rotation
            const x0 = a * Math.cos(angle);
            const y0 = b * Math.sin(angle);

            const x = centerX + x0 * Math.cos(orbitRotation) - y0 * Math.sin(orbitRotation);
            const y = centerY + x0 * Math.sin(orbitRotation) + y0 * Math.cos(orbitRotation);

            drawInteractomeTrail(ctx, centerX, centerY, x, y);
            drawOrganelle(ctx, x, y, org, time);
        });

        time++;
        requestAnimationFrame(animate);
    }

    // Draw faint "filament" connections instead of perfect circular trails
    function drawInteractomeTrail(ctx, cx, cy, px, py) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px, py);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        ctx.stroke();
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

            let data = matrix[key];

            // Client-side fallback if data is missing
            if (!data) {
                const getElement = (s) => {
                    if (['Aries', 'Leo', 'Sagittarius'].includes(s)) return 'Fire';
                    if (['Taurus', 'Virgo', 'Capricorn'].includes(s)) return 'Earth';
                    if (['Gemini', 'Libra', 'Aquarius'].includes(s)) return 'Air';
                    return 'Water';
                };

                const e1 = getElement(sign1);
                const e2 = getElement(sign2);
                let score = 50;
                let synthesis = "Standard interaction.";

                if (sign1 === sign2) { score = 90; synthesis = "Perfect resonance (Self-similar)."; }
                else if (e1 === e2) { score = 95; synthesis = `High elemental affinity (${e1}).`; }
                else if ((e1 === 'Fire' && e2 === 'Air') || (e1 === 'Air' && e2 === 'Fire')) { score = 85; synthesis = "Combustion/Oxidation synergy."; }
                else if ((e1 === 'Water' && e2 === 'Earth') || (e1 === 'Earth' && e2 === 'Water')) { score = 85; synthesis = "Growth/Solubility synergy."; }
                else { score = 40; synthesis = "Phase separation likely. High energy barrier."; }

                data = {
                    score: score,
                    level: score > 80 ? 'Harmonious' : 'Challenging',
                    synthesis: synthesis + " (Calculated via local elemental rules)",
                    element_harmony: score
                };
            }

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
