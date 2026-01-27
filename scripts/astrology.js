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

        renderUMAP();
        setupSignSelector(data.readings);
    } catch (err) {
        console.error('Failed to load astrology data:', err);
    }
}

function setupSignSelector(readings) {
    const select = document.getElementById('zodiac-select');
    const readingDisplay = document.getElementById('personal-reading');

    select?.addEventListener('change', (e) => {
        currentSign = e.target.value;
        renderUMAP(); // Re-render to show glow

        if (currentSign && readings[currentSign]) {
            readingDisplay.textContent = `"${readings[currentSign]}"`;
            readingDisplay.style.opacity = 1;
        } else {
            readingDisplay.textContent = 'Choose your sign to see the cosmos align.';
        }
    });
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
        .attr('r', 4) // Slightly larger
        .attr('fill', d => d.sign === currentSign ? 'var(--fitc-green)' : '#444')
        .attr('fill-opacity', d => d.sign === currentSign ? 1.0 : 0.3)
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
