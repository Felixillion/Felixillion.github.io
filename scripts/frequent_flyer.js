// Australian Credit Card Points Tracker - Automated Ingest
let cardData = null;
let currentScheme = 'qantas';
let sortConfig = { key: 'centsPoint', direction: 'asc' };

async function initFF() {
    try {
        const response = await fetch('data/ff_weekly.json');
        cardData = await response.json();
        renderTable();
    } catch (err) {
        console.error('Failed to load card data:', err);
        document.getElementById('card-table-container').innerHTML = '<p style="color:var(--tritc-red)">Bank data feed currently offline. Please check back next Monday.</p>';
    }
}

function calculateCentsPerPoint(card, annual = false) {
    const feeTotal = annual ? card.fee * 2 : card.fee;
    const pointsTotal = annual ? (card.signupBonus + (card.year1Bonus || 0)) : card.signupBonus;
    if (!pointsTotal) return "N/A";
    return ((feeTotal * 100) / pointsTotal).toFixed(2);
}

function renderTable() {
    const container = document.getElementById('card-table-container');
    if (!container || !cardData) return;

    let data = [...cardData[currentScheme]];

    // Post-process metrics for sorting
    data = data.map(card => ({
        ...card,
        centsPoint: parseFloat(calculateCentsPerPoint(card)),
        annualCentsPoint: parseFloat(calculateCentsPerPoint(card, true))
    }));

    // Sorting logic
    data.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    container.innerHTML = `
        <div class="scroll-wrapper" style="overflow-x: auto; background: var(--glass-bg); border-radius: 12px; margin-top: 2rem;">
            <table style="width: 100%; border-collapse: collapse; min-width: 900px;">
                <thead>
                    <tr style="text-align: left; border-bottom: 2px solid var(--glass-border);">
                        <th style="padding: 1.2rem;">Bank / Card</th>
                        <th style="padding: 1.2rem; cursor: pointer;" onclick="toggleSort('signupBonus')">Signup Pts ${sortConfig.key === 'signupBonus' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                        <th style="padding: 1.2rem; cursor: pointer;" onclick="toggleSort('centsPoint')">cents/pt [ANNUAL] ${sortConfig.key === 'centsPoint' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                        <th style="padding: 1.2rem;">Annual Fee</th>
                        <th style="padding: 1.2rem;">Min Spend</th>
                        <th style="padding: 1.2rem;">Lounge Passes</th>
                        <th style="padding: 1.2rem; text-align: right;">View</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(card => `
                        <tr style="border-bottom: 1px solid var(--glass-border); transition: background 0.3s;">
                            <td style="padding: 1.5rem 1rem;">
                                <div style="font-weight: 600; color: white;">${card.bank}</div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary);">${card.name}</div>
                            </td>
                            <td style="padding: 1rem;">
                                <div style="color: var(--fitc-green); font-weight: bold;">${card.signupBonus.toLocaleString()}</div>
                                ${card.year1Bonus ? `<div style="font-size: 0.7rem; color: var(--text-secondary);">+ ${card.year1Bonus.toLocaleString()} (Yr 2)</div>` : ''}
                            </td>
                            <td style="padding: 1rem;">
                                <span style="color: var(--dapi-blue); font-weight: 600;">${card.centsPoint}</span>
                                <span style="font-size: 0.8rem; color: var(--text-secondary);"> [${card.annualCentsPoint}]</span>
                            </td>
                            <td style="padding: 1rem;">$${card.fee}</td>
                            <td style="padding: 1rem;">$${card.minSpend.toLocaleString()}</td>
                            <td style="padding: 1rem; font-size: 0.8rem;">${card.loungePasses}</td>
                            <td style="padding: 1rem; text-align: right;"><a href="${card.affiliateLink || card.link}" target="_blank" class="subheading" style="font-size: 0.7rem; text-decoration: none; padding: 0.4rem 0.8rem;">Apply</a></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

window.toggleSort = (key) => {
    if (sortConfig.key === key) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.key = key;
        sortConfig.direction = 'asc';
    }
    renderTable();
};

document.getElementById('toggle-qantas')?.addEventListener('click', (e) => {
    currentScheme = 'qantas';
    document.querySelectorAll('.card-controls button').forEach(b => {
        b.classList.remove('active');
        b.style.opacity = '0.5';
    });
    e.target.classList.add('active');
    e.target.style.opacity = '1';
    renderTable();
});

document.getElementById('toggle-velocity')?.addEventListener('click', (e) => {
    currentScheme = 'velocity';
    document.querySelectorAll('.card-controls button').forEach(b => {
        b.classList.remove('active');
        b.style.opacity = '0.5';
    });
    e.target.classList.add('active');
    e.target.style.opacity = '1';
    renderTable();
});

initFF();
