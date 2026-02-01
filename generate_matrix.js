const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const matrix = {};

function getElement(sign) {
    if (['Aries', 'Leo', 'Sagittarius'].includes(sign)) return 'Fire';
    if (['Taurus', 'Virgo', 'Capricorn'].includes(sign)) return 'Earth';
    if (['Gemini', 'Libra', 'Aquarius'].includes(sign)) return 'Air';
    return 'Water';
}

function getScore(s1, s2) {
    const e1 = getElement(s1);
    const e2 = getElement(s2);
    if (s1 === s2) return 90;
    if (e1 === e2) return 95;
    if ((e1 === 'Fire' && e2 === 'Air') || (e1 === 'Air' && e2 === 'Fire')) return 85;
    if ((e1 === 'Water' && e2 === 'Earth') || (e1 === 'Earth' && e2 === 'Water')) return 85;
    return 50; // Clash
}

signs.forEach(s1 => {
    signs.forEach(s2 => {
        const key = `${s1}-${s2}`;
        const score = getScore(s1, s2);
        let level = score > 80 ? 'Harmonious' : (score > 60 ? 'Balanced' : 'Challenging');
        if (score > 90) level = 'Divine';

        matrix[key] = {
            score: score,
            level: level,
            synthesis: `Interaction between ${s1} and ${s2} analysis complete. ${level} binding affinity detected based on elemental properties (${getElement(s1)}+${getElement(s2)}).`,
            element_harmony: score
        };
    });
});

console.log(JSON.stringify(matrix, null, 2));
