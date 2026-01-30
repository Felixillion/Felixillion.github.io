// Bioinformatic Astrology with Cluster Highlighting
const height = 500;
const width = 800;
const margin = { top: 40, right: 40, bottom: 40, left: 40 };
let currentSign = null;
let allPoints = [];
let centroids = {};

async function initAstrology() {
    try {
        const response = await fetch('data/astrology_daily.json');
        const data = await response.json();

        allPoints = data.points;
        centroids = data.centroids;
        document.getElementById('last-updated-astrology').textContent = data.lastUpdated;

        // Render Planetary Positions
        if (data.planetary_positions) {
            renderPlanetaryPositions(data.planetary_positions);
        }

        // Display Calculation Methods
        if (data.calculation_methods) {
            const sourcesList = document.getElementById('sources-list');
            if (sourcesList) {
                sourcesList.innerHTML = `
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${data.calculation_methods.map(m => `
                            <span style="color: var(--dapi-blue); padding: 0.3rem 0.6rem; 
                                      background: rgba(100, 149, 237, 0.1); border-radius: 4px; font-size: 0.8rem;"
                                      title="${m.description}">
                                ${m.name}
                            </span>
                        `).join('')}
                    </div>
                `;
            }
        }

        renderUMAP();
        setupSignSelector(data.readings);
        setupCompatibility(data.compatibility_matrix);
        
    } catch (err) {
        console.error('Failed to load astrology data:', err);
        // Fallback or error state could be added here
    }
}

function renderPlanetaryPositions(positions) {
    const container = document.getElementById('planetary-positions');
    const moonPhase = document.getElementById('moon-phase');
    
    if (container) {
        const symbols = { sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂' };
        
        container.innerHTML = Object.entries(positions)
            .filter(([planet]) => symbols[planet]) // Only show main 5
            .map(([planet, data]) => `
                <span title="${data.degree}°">
                    <span style="color: var(--fitc-green)">${symbols[planet]}</span> 
                    ${data.sign} ${Math.floor(data.degree)}°${data.retrograde ? ' R' : ''}
                </span>
            `).join('');
    }
    
    if (moonPhase && positions.moon && positions.moon.phase) {
        const phases = {
            'New Moon': '🌑', 'Waxing Crescent': '🌒', 'First Quarter': '🌓', 'Waxing Gibbous': '🌔',
            'Full Moon': '🌕', 'Waning Gibbous': '🌖', 'Last Quarter': '🌗', 'Waning Crescent': '🌘'
        };
        const icon = phases[positions.moon.phase] || '🌑';
        moonPhase.textContent = `${icon} ${positions.moon.phase}`;
    }
}

function setupSignSelector(readings) {
    const select = document.getElementById('zodiac-select');
    const readingDisplay = document.getElementById('personal-reading');

    select?.addEventListener('change', (e) => {
        currentSign = e.target.value;
        renderUMAP(); // Re-render to show glow

        if (currentSign && readings[currentSign]) {
            readingDisplay.style.opacity = 0;
            setTimeout(() => {
                readingDisplay.innerHTML = `"${readings[currentSign]}"`;
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
            // Key handles both orders (Aries-Taurus or Taurus-Aries)
            let key = sign1 === sign2 ? sign1 : `${sign1}-${sign2}`;
            if (!matrix[key]) key = `${sign2}-${sign1}`;
            
            const data = matrix[key];
            if (data) {
                resultDiv.style.display = 'block';
                scoreDiv.textContent = `${data.score}%`;
                levelDiv.textContent = data.level;
                textDiv.textContent = `"${data.synthesis}"`;
                
                // Color scaling
                const color = data.score > 75 ? 'var(--fitc-green)' : 
                             data.score > 50 ? 'var(--dapi-blue)' : 'var(--cy5-magenta)';
                scoreDiv.style.color = color;
                scoreDiv.style.textShadow = `0 0 15px ${color}`;
                
                // Details
                detailsDiv.innerHTML = `
                    <div style="background: rgba(255,255,255,0.05); padding: 0.5rem 1rem; border-radius: 4px;">
                        Element Harmony: ${data.element_harmony}%
                    </div>
                `;
                
                if (data.today_specific) {
                    detailsDiv.innerHTML += `
                        <div style="background: rgba(255,255,255,0.05); padding: 0.5rem 1rem; border-radius: 4px;">
                            ${data.today_specific}
                        </div>
                    `;
                }
            }
        } else {
            resultDiv.style.display = 'none';
        }
    };

    s1?.addEventListener('change', updateCompatibility);
    s2?.addEventListener('change', updateCompatibility);
}

function renderUMAP() {
    const container = document.getElementById('umap-plot');
    if (!container) return;

    container.innerHTML = '';
    const svg = d3.select('#umap-plot')
        .append('svg')
        .attr('width', '100%')
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`);

    const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([0, 1]).range([height - margin.bottom, margin.top]);

    const colors = ['var(--dapi-blue)', 'var(--fitc-green)', 'var(--cy5-magenta)'];

    // 1. Render all source dots
    console.log('Rendering', allPoints.length, 'points for', currentSign);
    svg.selectAll('.source-dot')
        .data(allPoints)
        .enter()
        .append('circle')
        .attr('class', 'source-dot')
        .attr('cx', d => x(d.x))
        .attr('cy', d => y(d.y))
        .attr('r', 4.5) // Slightly larger
        .attr('fill', d => d.sign === currentSign ? 'var(--fitc-green)' : '#666')
        .attr('fill-opacity', d => d.sign === currentSign ? 1.0 : 0.6)
        .style('filter', d => d.sign === currentSign ? 'drop-shadow(0 0 8px var(--fitc-green))' : 'none')
        .attr('stroke', d => d.sign === currentSign ? '#fff' : 'none')
        .attr('stroke-width', 0.5);

    // 2. Render Centroid (Sign Average) if selected
    if (currentSign && centroids[currentSign]) {
        const center = centroids[currentSign];

        // Centroid Glow
        svg.append('circle')
            .attr('cx', x(center.x))
            .attr('cy', y(center.y))
            .attr('r', 15)
            .attr('fill', 'var(--fitc-green)')
            .attr('fill-opacity', 0.2)
            .attr('class', 'centroid-pulse');

        svg.append('circle')
            .attr('cx', x(center.x))
            .attr('cy', y(center.y))
            .attr('r', 8)
            .attr('fill', '#fff')
            .attr('stroke', 'var(--fitc-green)')
            .attr('stroke-width', 3)
            .style('filter', 'drop-shadow(0 0 10px var(--fitc-green))');

        svg.append('text')
            .attr('x', x(center.x))
            .attr('y', y(center.y) - 20)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .style('font-weight', 'bold')
            .style('font-size', '12px')
            .text(`${currentSign} Centroid`);
    }

    // Legend
    svg.append('text')
        .attr('x', 20)
        .attr('y', 20)
        .attr('fill', 'var(--text-secondary)')
        .style('font-size', '10px')
        .text('● High-confidence source | ○ Low-confidence source');
}

initAstrology();
