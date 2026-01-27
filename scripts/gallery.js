// Hero section animations and name styling
document.addEventListener('DOMContentLoaded', () => {
    // We could add dynamic color shifts or mouse-tracking glow here
});

// Spatial Gallery Implementation
const galleryImages = [
    { title: 'IMC Spleen', type: 'Imaging Mass Cytometry', color: 'var(--dapi-blue)' },
    { title: 'Xenium Breast Cancer', type: 'In Situ Hybridization', color: 'var(--fitc-green)' },
    { title: 'COMET Tonsil', type: 'Sequential Immunofluorescence', color: 'var(--cy5-magenta)' },
    { title: 'Spatial Transcriptomics', type: 'ST', color: 'var(--tritc-red)' }
];

const galleryGrid = document.getElementById('gallery-grid');

if (galleryGrid) {
    galleryGrid.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.5rem;">
            ${galleryImages.map((img, i) => `
                <div class="glass-card" style="padding: 1rem; cursor: pointer; border-color: ${img.color};">
                    <div style="height: 180px; background: linear-gradient(45deg, ${img.color}33, #111); border-radius: 12px; margin-bottom: 1rem; display: flex; align-items: center; justify-content: center;">
                        <span style="font-size: 0.8rem; color: ${img.color}; font-weight: bold;">[ ${img.type} ]</span>
                    </div>
                    <h3 style="font-size: 1rem; margin-bottom: 0.5rem;">${img.title}</h3>
                    <p style="font-size: 0.8rem; color: var(--text-secondary);">Click to view high-res dataset</p>
                </div>
            `).join('')}
        </div>
    `;
}
