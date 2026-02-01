// Homepage Interaction Script
document.addEventListener('DOMContentLoaded', () => {
    // Select the subheading spans
    const subheadings = document.querySelectorAll('.subheading');
    const heroSection = document.querySelector('.hero');

    // Define background images for each title (Placeholder URLs for now)
    // In a real scenario, these keys must match the text content or data attributes
    const backgrounds = {
        'Bioinformagician': 'url("https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=2070&auto=format&fit=crop")', // Lab/DNA
        'Compose of Worlds': 'url("https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop")', // Space/World
        'Lover of Cats': 'url("https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=2043&auto=format&fit=crop")'  // Cat
    };

    // Store original background
    const originalBg = window.getComputedStyle(heroSection).background;

    subheadings.forEach(el => {
        const text = el.innerText;
        if (backgrounds[text]) {
            el.addEventListener('mouseenter', () => {
                // Apply new background with overlay to keep text readable
                heroSection.style.background = `linear-gradient(rgba(5,5,5,0.7), rgba(5,5,5,0.7)), ${backgrounds[text]}`;
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
