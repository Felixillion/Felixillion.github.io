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
    { text: "Writing the Materials & Methods section", why: "Reflection is good for the soul, and for remembering what you actually did 6 months ago." },
    { text: "Running a UMAP dimensionality reduction", why: "The cosmos is itself an n-dimensional dataset, and you are close to understanding both." },
    { text: "Validating a new antibody clone", why: "Trust but verify — especially when the catalogue number has been discontinued." },
    { text: "Designing a multiplexed IMC panel", why: "More markers, more problems, more papers. The trade-off is celestially favourable today." },
    { text: "Extracting RNA from FFPE tissue", why: "Degraded RNA is still RNA, and your RIN score is spiritually non-zero." },
    { text: "Performing Seurat clustering on sc-RNAseq data", why: "Leiden resolution 0.8 is cosmically aligned. Trust the clusters." },
    { text: "Running a CyTOF acquisition", why: "Metal isotopes don't lie, and neither does the universe on a day like today." },
    { text: "Optimising antigen retrieval conditions", why: "The epitopes are buried but not gone. So is the truth." },
    { text: "Plating a limiting dilution assay", why: "Poisson statistics are simply the universe admitting it works in probability, like everything else." },
    { text: "Annotating cell clusters in Scanpy", why: "You know these cells better than they know themselves. Name them." },
    { text: "Running a flow cytometry compensation matrix", why: "Spectral spillover is not a failure. It is an opportunity to do maths." },
    { text: "Establishing a new cell line from primary tissue", why: "Passage 1 is always hopeful. Passage 12 is wisdom. Today is passage 1." },
    { text: "Imaging a tissue section on the Xenium platform", why: "Spatial context is everything. The neighbourhood defines the cell." },
    { text: "Processing a CITE-seq library", why: "Surface proteins and transcriptomics together — why would you measure only half the truth?" },
    { text: "Performing a cytokine bead array", why: "Thirty-seven analytes from one tube is efficient science, and efficiency is cosmically favoured." },
    { text: "Designing a pooled CRISPR screen", why: "The library contains the answer. You are simply the selection pressure." },
    { text: "Running a FRET-based binding assay", why: "Energy transfer between molecules works better when the molecules are emotionally compatible." },
    { text: "Annotating a spatial transcriptomics dataset", why: "Geography matters in science as in life. Where a gene is expressed is half the story." },
    { text: "Running your PI's favourite assay that you think is outdated", why: "Perspective is relative. ELISA still has its uses, and so does your PI." },
    { text: "Setting up overnight cell culture for tomorrow's assay", why: "Preparation is nine-tenths of the experiment. Your cells will be ready if you are." },
    { text: "Analysing spectral flow cytometry data with SpectroFlo", why: "Unmixing is not just a technical step. It is a philosophy of separating what does not belong together." },
];

const AVOIDANCES = [
    { text: "Touching the -80°C freezer handle without gloves", why: "Frostbite builds character, but losing fingerprints affects biometric security." },
    { text: "Using the communal water bath", why: "It has evolved its own ecosystem that is currently hostile to your samples." },
    { text: "Asking the PI for funding today", why: "Their grant score just came back. Do not approach." },
    { text: "Loading the last gel lane", why: "The smile effect will turn your bands into a tragic frown." },
    { text: "Trusting the 'autofocus' button", why: "The microscope lies. It always focuses on the dust, not the nucleus." },
    { text: "Opening the incubator during a CO2 calibration", why: "The alarm sound triggers a primal fear response in all lab personnel." },
    { text: "Using the 'good' scissors for paper", why: "The lab manager is watching. Always watching." },
    { text: "Assuming the plate reader is empty", why: "Someone left their data in there. It's been there since 2019." },
    { text: "Vortexing your primary antibody at maximum speed", why: "You will aggregate it. You know you will. Yet every time." },
    { text: "Running a western blot without a molecular weight marker", why: "Your band is at an 'unexpected' size and you have no reference point. Cosmically speaking, you are lost." },
    { text: "Starting a new experiment on a Friday afternoon", why: "The cells do not observe the weekend. You will." },
    { text: "Defrosting the -80 samples labelled only with tape and a Sharpie", why: "The tape fell off in 2021. The Sharpie faded in 2022. The mystery is now the experiment." },
    { text: "Telling anyone you 'just need to run one quick gel'", why: "The universe has heard this before. It has prepared a six-hour obstacle course in your honour." },
    { text: "Borrowing reagents from the neighbouring lab without asking", why: "Their buffer is at pH 7.3, not 7.4. Your assay will wonder why everything is slightly wrong." },
    { text: "Assuming the cell counter is accurately calibrated", why: "The count says 98% viability. The microscope is already laughing." },
    { text: "Using the incubator with the flickering temperature light", why: "It's fine. It's always fine. Until it is distinctly not fine." },
    { text: "Clicking 'Run' on the pipeline without checking your file paths first", why: "The error message will say FileNotFoundError. The file is in a folder called 'final_FINAL_v3'." },
    { text: "Starting single-cell library prep after 2pm", why: "The protocol is eleven hours long. Your future self is already in the lab at 1am." },
    { text: "Telling yourself you'll document this experiment properly later", why: "Later is a country no one has successfully visited. The lab notebook awaits." },
    { text: "Relying on the autoclave that 'should be done by now'", why: "It is not done. It was never going to be done. You needed it two hours ago." },
    { text: "Thawing your only remaining aliquot without a backup plan", why: "If this aliquot has been through three freeze-thaw cycles, the universe requests you reconsider." },
    { text: "Submitting a manuscript to a journal without reading the author guidelines", why: "The references must be numbered, not alphabetised. You will find this out on revision request 2." },
    { text: "Trusting the Nanodrop reading for your RNA without also running a gel", why: "Protein contamination elevates A260 in ways the Nanodrop finds charming and you will not." },
    { text: "Adding DMSO stock straight to the cells without pre-warming", why: "They were happy. They were proliferating. They had plans." },
    { text: "Scheduling two staining panels for the same day to 'save time'", why: "Time is not saved. It is redistributed into a single, spectacular crunch." },
    { text: "Not labelling your tubes before you start", why: "There will be twelve unlabelled tubes. They will all look identical. One of them is your positive control." },
    { text: "Assuming the software update won't break anything mid-experiment", why: "It will update at 4pm. Your acquisition is scheduled for 3:55pm." },
    { text: "Eating at the lab bench today", why: "The stars indicate a 100% chance of spilling something onto something irreplaceable." },
    { text: "Asking for peer review feedback from a colleague who 'isn't busy'", why: "They are busy. They will say yes. The feedback will arrive at 11:47pm the night before the deadline." },
    { text: "Accidentally picking up the phenol-saturated TE instead of regular TE", why: "The bottles are the same colour. The smell is the only difference. Today is not your day to guess." },
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
        const data = window.ASTROLOGY_DATA;
        if (!data) throw new Error("No data available from Jekyll.");
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
