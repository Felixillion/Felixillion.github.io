const fs = require('fs');
const path = require('path');

// Simplified planetary position calculator using Keplerian elements
// More accurate than templates but doesn't require external API calls

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

// Approximate orbital elements (simplified for daily horoscopes)
const ORBITAL_ELEMENTS = {
    Sun: { period: 365.25, basePosition: 280.46, speed: 0.9856 },
    Moon: { period: 27.32, basePosition: 134.96, speed: 13.1764 },
    Mercury: { period: 87.97, basePosition: 174.79, speed: 4.0923 },
    Venus: { period: 224.70, basePosition: 50.42, speed: 1.6021 },
    Mars: { period: 686.98, basePosition: 355.45, speed: 0.5240 },
    Jupiter: { period: 4332.59, basePosition: 34.40, speed: 0.0831 },
    Saturn: { period: 10759.22, basePosition: 50.08, speed: 0.0335 }
};

function calculatePlanetPosition(planet, julianDay) {
    const elements = ORBITAL_ELEMENTS[planet];
    const daysSinceEpoch = julianDay - 2451545.0; // J2000.0 epoch

    // Calculate mean longitude
    const meanLongitude = (elements.basePosition + elements.speed * daysSinceEpoch) % 360;

    // Normalize to 0-360
    const normalizedLong = meanLongitude < 0 ? meanLongitude + 360 : meanLongitude;

    // Determine zodiac sign (30 degrees per sign)
    const signIndex = Math.floor(normalizedLong / 30);
    const degree = normalizedLong % 30;

    return {
        sign: SIGNS[signIndex],
        degree: parseFloat(degree.toFixed(1)),
        longitude: parseFloat(normalizedLong.toFixed(1))
    };
}

function dateToJulianDay(date) {
    const a = Math.floor((14 - (date.getMonth() + 1)) / 12);
    const y = date.getFullYear() + 4800 - a;
    const m = (date.getMonth() + 1) + 12 * a - 3;

    let jd = date.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y +
        Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

    // Add time of day
    jd += (date.getHours() - 12) / 24 + date.getMinutes() / 1440 + date.getSeconds() / 86400;

    return jd;
}

function calculateMoonPhase(julianDay) {
    const daysSinceNewMoon = (julianDay - 2451550.1) % 29.53;
    const phase = (daysSinceNewMoon / 29.53);

    if (phase < 0.0625 || phase >= 0.9375) return 'New Moon';
    if (phase < 0.1875) return 'Waxing Crescent';
    if (phase < 0.3125) return 'First Quarter';
    if (phase < 0.4375) return 'Waxing Gibbous';
    if (phase < 0.5625) return 'Full Moon';
    if (phase < 0.6875) return 'Waning Gibbous';
    if (phase < 0.8125) return 'Last Quarter';
    return 'Waning Crescent';
}

function calculateAspect(pos1, pos2) {
    const diff = Math.abs(pos1.longitude - pos2.longitude);
    const angle = diff > 180 ? 360 - diff : diff;

    // Major aspects (with 8-degree orb)
    if (Math.abs(angle - 0) < 8) return { type: 'conjunction', angle: 0, orb: angle };
    if (Math.abs(angle - 60) < 6) return { type: 'sextile', angle: 60, orb: Math.abs(angle - 60) };
    if (Math.abs(angle - 90) < 8) return { type: 'square', angle: 90, orb: Math.abs(angle - 90) };
    if (Math.abs(angle - 120) < 8) return { type: 'trine', angle: 120, orb: Math.abs(angle - 120) };
    if (Math.abs(angle - 180) < 8) return { type: 'opposition', angle: 180, orb: Math.abs(angle - 180) };

    return null;
}

function isRetrograde(planet, julianDay) {
    // Simplified retrograde detection (Mercury retrogrades ~3x/year, Venus ~every 18mo)
    if (planet === 'Mercury') {
        const period = julianDay % 116; // ~88 day orbit + 28 day retrograde cycle
        return period > 88 && period < 110; // ~3 weeks retrograde
    }
    if (planet === 'Venus') {
        const period = julianDay % 584; // Synodic period
        return period > 540 && period < 584; // ~6 weeks retrograde
    }
    if (planet === 'Mars') {
        const period = julianDay % 780; // Synodic period
        return period > 700 && period < 780; // ~10 weeks retrograde
    }
    return false;
}

async function fetchPlanetaryPositions(date = new Date()) {
    const jd = dateToJulianDay(date);

    const positions = {};
    for (const planet of Object.keys(ORBITAL_ELEMENTS)) {
        positions[planet.toLowerCase()] = {
            ...calculatePlanetPosition(planet, jd),
            retrograde: isRetrograde(planet, jd)
        };
    }

    // Calculate moon phase
    positions.moon.phase = calculateMoonPhase(jd);

    // Calculate major aspects
    const aspects = [];
    const planets = Object.keys(ORBITAL_ELEMENTS);

    for (let i = 0; i < planets.length; i++) {
        for (let j = i + 1; j < planets.length; j++) {
            const aspect = calculateAspect(
                calculatePlanetPosition(planets[i], jd),
                calculatePlanetPosition(planets[j], jd)
            );
            if (aspect) {
                aspects.push({
                    planets: [planets[i], planets[j]],
                    ...aspect
                });
            }
        }
    }

    return {
        date: date.toISOString().split('T')[0],
        julianDay: jd,
        positions,
        aspects
    };
}

// Export for use in other scripts
module.exports = {
    fetchPlanetaryPositions,
    calculatePlanetPosition,
    calculateMoonPhase,
    calculateAspect,
    isRetrograde,
    SIGNS
};

// Test function (run if called directly)
if (require.main === module) {
    (async () => {
        console.log('Calculating planetary positions for today...\n');
        const data = await fetchPlanetaryPositions();

        console.log(`Date: ${data.date}`);
        console.log(`Julian Day: ${data.julianDay.toFixed(2)}\n`);

        console.log('Planetary Positions:');
        for (const [planet, pos] of Object.entries(data.positions)) {
            const retro = pos.retrograde ? ' (R)' : '';
            const phase = pos.phase ? ` - ${pos.phase}` : '';
            console.log(`  ${planet.charAt(0).toUpperCase() + planet.slice(1)}: ${pos.sign} ${pos.degree}°${retro}${phase}`);
        }

        console.log('\nMajor Aspects:');
        if (data.aspects.length > 0) {
            data.aspects.forEach(aspect => {
                console.log(`  ${aspect.planets[0]}-${aspect.planets[1]}: ${aspect.type} (orb: ${aspect.orb.toFixed(1)}°)`);
            });
        } else {
            console.log('  None detected');
        }
    })();
}
