// Australian Credit Card Points Tracker - Automated Ingest
let cardData = null;
let currentScheme = 'qantas';

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

function calculatePointsPerDollar(bonus, fee) {
    if (!fee) return "N/A";
    return (bonus / fee).toFixed(2);
}

function renderTable() {
    const container = document.getElementById('card-table-container');
    if (!container || !cardData) return;

    const data = cardData[currentScheme];

    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 1rem; min-width: 600px;">
            <thead>
                <tr style="text-align: left; border-bottom: 2px solid var(--glass-border);">
                    <th style="padding: 1.2rem;">Bank / Tier</th>
                    <th style="padding: 1.2rem;">Bonus Points</th>
                    <th style="padding: 1.2rem;">Annual Fee</th>
                    <th style="padding: 1.2rem;">Points/$</th>
                    <th style="padding: 1.2rem;">Min Spend</th>
                    <th style="padding: 1.2rem;">Lounge Passes</th>
                    <th style="padding: 1.2rem; text-align: right;">View Offer</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(card => `
                    <tr style="border-bottom: 1px solid var(--glass-border); transition: background 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 1.5rem 1rem;">
                            <div style="font-weight: 600; color: white;">${card.bank}</div>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">${card.name}</div>
                        </td>
                        <td style="padding: 1rem; color: var(--fitc-green); font-weight: bold; font-size: 1.1rem;">${card.bonus.toLocaleString()}</td>
                        <td style="padding: 1rem;">$${card.fee}</td>
                        <td style="padding: 1rem; color: var(--dapi-blue); font-weight: 600;">${calculatePointsPerDollar(card.bonus, card.fee)}</td>
                        <td style="padding: 1rem;">$${card.minSpend.toLocaleString()}</td>
                        <td style="padding: 1rem; font-size: 0.85rem;">${card.loungePasses || 'N/A'}</td>
                        <td style="padding: 1rem; text-align: right;"><a href="${card.link}" target="_blank" class="subheading" style="font-size: 0.8rem; text-decoration: none; display: inline-block;">Source</a></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

document.getElementById('toggle-qantas')?.addEventListener('click', (e) => {
    currentScheme = 'qantas';
    document.querySelectorAll('.card-controls button').forEach(b => b.style.opacity = '0.5');
    e.target.style.opacity = '1';
    renderTable();
});

document.getElementById('toggle-velocity')?.addEventListener('click', (e) => {
    currentScheme = 'velocity';
    document.querySelectorAll('.card-controls button').forEach(b => b.style.opacity = '0.5');
    e.target.style.opacity = '1';
    renderTable();
});

initFF();
