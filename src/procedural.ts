// Seeded randomness keeps the same composition across reloads and devices.
export function seeded(seed: number) {
    return () => {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
        value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}
export function terrainHeight(x: number, y: number) {
    const river = Math.exp(-Math.pow(x - Math.sin(y * .4) * 2, 2) * .4);
    const hills = (Math.sin(x * .6 + y * .3) + Math.cos(y * .45 - x * .3) + .3 * Math.sin(x * 2.2) * Math.cos(y * 1.7)) * .6;
    return (hills + 1.2) * (1 - river) - .25;
}
