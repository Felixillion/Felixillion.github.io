// Homepage Interaction Script
document.addEventListener('DOMContentLoaded', () => {
    // Select the subheading spans
    const subheadings = document.querySelectorAll('.subheading');
    const heroSection = document.querySelector('.hero');

    // Define background images for each title (Placeholder URLs for now)
    // In a real scenario, these keys must match the text content or data attributes
    // Define backgrounds: Use CSS gradients as robust fallbacks, with images as enhancement
    const backgrounds = {
        'Bioinformagician': 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url("https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=2070&auto=format&fit=crop"), linear-gradient(45deg, var(--fitc-green), #000)',
        'Composer of Worlds': 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url("https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop"), linear-gradient(45deg, var(--dapi-blue), #000)',
        'Lover of Cats': 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url("https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=2043&auto=format&fit=crop"), linear-gradient(45deg, var(--cy5-magenta), #000)'
    };

    // Store original background
    const originalBg = window.getComputedStyle(heroSection).background;

    subheadings.forEach(el => {
        const text = el.textContent.trim();
        if (backgrounds[text]) {
            el.addEventListener('mouseenter', () => {
                // Apply new background directly (gradients included in string)
                heroSection.style.background = backgrounds[text];
                heroSection.style.backgroundSize = 'cover';
                heroSection.style.backgroundPosition = 'center';
                heroSection.style.transition = 'background 0.5s ease';
            });

            el.addEventListener('mouseleave', () => {
                heroSection.style.background = originalBg; // Revert to gradient
            });
        }
    });
});
