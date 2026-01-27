// Bioinformatic Astrology with Data Fetching and Sign Selector
const height = 500;
const width = 800;
const margin = { top: 20, right: 20, bottom: 20, left: 20 };

async function initAstrology() {
    try {
        const response = await fetch('data/astrology_daily.json');
        const data = await response.json();

        document.getElementById('last-updated-astrology').textContent = data.lastUpdated;

        renderUMAP(data.points);
        setupSignSelector(data.readings);
    } catch (err) {
        console.error('Failed to load astrology data:', err);
        document.getElementById('umap-plot').innerHTML = '<p style="color:red">Data temporarily drifting in space...</p>';
    }
}

function setupSignSelector(readings) {
    const select = document.getElementById('zodiac-select');
    const readingDisplay = document.getElementById('personal-reading');

    select?.addEventListener('change', (e) => {
        const sign = e.target.value;
        if (sign && readings[sign]) {
            readingDisplay.style.opacity = 0;
            setTimeout(() => {
                readingDisplay.textContent = `"${readings[sign]}"`;
                readingDisplay.style.opacity = 1;
                readingDisplay.style.transition = 'opacity 0.5s ease';
            }, 200);
        } else {
            readingDisplay.textContent = 'Choose your sign to see the cosmos align with your research.';
        }
    });
}

function renderUMAP(points) {
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

    const tooltip = d3.select('body').append('div')
        .style('position', 'absolute')
        .style('background', 'var(--glass-bg)')
        .style('backdrop-filter', 'var(--glass-blur)')
        .style('border', '1px solid var(--glass-border)')
        .style('padding', '10px')
        .style('border-radius', '8px')
        .style('color', '#fff')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', '1000');

    svg.selectAll('circle')
        .data(points)
        .enter()
        .append('circle')
        .attr('cx', d => x(d.x))
        .attr('cy', d => y(d.y))
        .attr('r', 6)
        .attr('fill', d => colors[d.id % colors.length])
        .attr('fill-opacity', 0.6)
        .style('cursor', 'pointer')
        .on('mouseover', (event, d) => {
            d3.select(event.currentTarget).attr('r', 10).attr('fill-opacity', 1);
            tooltip.transition().duration(200).style('opacity', 1);
            tooltip.html(`<strong>${d.site}</strong><br>${d.prediction}`)
                .style('left', (event.pageX + 15) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', (event) => {
            d3.select(event.currentTarget).attr('r', 6).attr('fill-opacity', 0.6);
            tooltip.transition().duration(500).style('opacity', 0);
        });

    svg.append('text')
        .attr('x', width - 20)
        .attr('y', height - 10)
        .attr('text-anchor', 'end')
        .attr('fill', 'var(--text-secondary)')
        .style('font-size', '10px')
        .text('Dim 1 / Dim 2 (Pre-calculated UMAP Proj.)');
}

initAstrology();
window.addEventListener('resize', () => {
    // Optionally re-render on resize if using absolute dimensions
});
