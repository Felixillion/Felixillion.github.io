// assets/js/gallery.js
// Reads from window.GALLERY_DATA (injected by Jekyll via site.data.gallery)
// To add images: edit _data/gallery.json and place files in assets/gallery/

function initGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  const images = window.GALLERY_DATA;

  if (!images || !images.length) {
    grid.innerHTML = `
      <div style="text-align:center;padding:4rem;color:var(--text-secondary);">
        <p style="font-size:1.1rem;margin-bottom:1rem;">Gallery coming soon.</p>
        <p style="font-size:.85rem;">
          To add images, edit <code>_data/gallery.json</code> and
          place image files in <code>assets/gallery/</code>.
        </p>
      </div>`;
    return;
  }

  grid.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:2rem;">
      ${images.map(img => `
        <div class="glass-card" style="padding:1rem;cursor:pointer;border-color:${img.color || 'var(--glass-border)'};
             transition:transform .25s,box-shadow .25s;"
             onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 40px rgba(0,0,0,.4)'"
             onmouseout="this.style.transform='';this.style.boxShadow=''">
          <div style="height:220px;
               background:url('${img.image}') center/cover no-repeat,
                 linear-gradient(135deg,${img.color || '#38bdf8'}22 0%,#111 100%);
               border-radius:10px;margin-bottom:1rem;
               display:flex;align-items:flex-start;justify-content:flex-start;
               position:relative;overflow:hidden;">
            <span style="font-size:.68rem;color:#fff;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
                 background:rgba(0,0,0,.55);padding:.3rem .7rem;border-radius:0 0 6px 0;
                 backdrop-filter:blur(4px);">
              ${img.type || ''}
            </span>
          </div>
          <h3 style="font-size:1rem;margin-bottom:.4rem;color:#fff;">${img.title}</h3>
          <p style="font-size:.82rem;color:var(--text-secondary);line-height:1.5;">
            ${img.description}
          </p>
        </div>
      `).join('')}
    </div>
  `;
}

initGallery();
