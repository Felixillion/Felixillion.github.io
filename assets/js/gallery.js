// Spatial Gallery Implementation with JSON manifest
async function initGallery() {
    const galleryGrid = document.getElementById('gallery-grid');
    if (!galleryGrid) return;

    try {
        const response = await fetch('data/gallery.json');
        const images = await response.json();

        galleryGrid.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem;">
                ${images.map((img, i) => `
                    <div class="glass-card fade-in" style="padding: 1rem; cursor: pointer; border-color: ${img.color};">
                        <div style="height: 220px; background: url('${img.image}') center/cover no-repeat, linear-gradient(45deg, ${img.color}33, #111); border-radius: 12px; margin-bottom: 1rem; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden;">
                            <span style="font-size: 0.7rem; color: #fff; font-weight: bold; background: rgba(0,0,0,0.6); padding: 4px 10px; border-radius: 4px; position: absolute; top: 10px; left: 10px;">${img.type}</span>
                        </div>
                        <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem; color: #fff;">${img.title}</h3>
                        <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">${img.description}</p>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        console.error('Failed to load gallery data:', err);
        galleryGrid.innerHTML = '<p>To add images, place JSON in data/gallery.json and images in assets/gallery/</p>';
    }
}

initGallery();
