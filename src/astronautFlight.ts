export const flightDuration = 60;
const stages = [[0, .19], [6, .34], [38, .72], [48, .835], [52, .89], [56, .94], [flightDuration, 1]];
const smooth = (from: number, to: number, value: number) => {
    const x = Math.max(0, Math.min(1, (value - from) / (to - from)));
    return x * x * (3 - 2 * x);
};

export function astronautChoreography(progress: number, time: number) {
    const retreat = smooth(.72, .835, progress), jump = smooth(.835, .89, progress), settle = smooth(.89, .94, progress);
    let frame = 22 + Math.sin(time * .55) * 20;
    if (progress >= .72 && progress < .82) frame = 88 + smooth(.72, .82, progress) * 24;
    else if (progress >= .82 && progress < .835) frame = 112 + smooth(.82, .835, progress) * 8;
    else if (progress >= .835 && progress < .89) frame = 120 + jump * 24;
    else if (progress >= .89 && progress < .94) frame = 144 + settle * 24;
    else if (progress >= .94) frame = 168 + (1 - Math.cos((time * 1.5) % (Math.PI * 2))) * 34 * smooth(.94, .96, progress);
    return {
        frame, retreat, jump, settle,
        corridorZ: smooth(.29, .72, progress) * 115 - retreat * 48,
        cameraZ: 2.7 + jump * 3.1 + Math.sin(jump * Math.PI) * 1.1,
        jumpX: -Math.sin(jump * Math.PI) * .45 + settle * 1.2,
        jumpY: -.15 + Math.sin(jump * Math.PI) * .45 - settle * .2,
        jumpZ: .06 + jump * 1.6 - settle * .3,
        outside: .06 + jump * 1.6 > .52,
        echoes: smooth(.70, .745, progress) * (1 - smooth(.81, .84, progress)),
    };
}
export const createFlight = () => ({ elapsed: 0, progress: 0, scroll: 0, boost: 0, roll: 0, spin: 0, started: false });
export type Flight = ReturnType<typeof createFlight>;

export function flightProgressAt(seconds: number) {
    for (let i = 1; i < stages.length; i++) {
        const [end, to] = stages[i], [start, from] = stages[i - 1];
        if (seconds <= end) return from + (to - from) * Math.max(0, (seconds - start) / (end - start));
    }
    return 1;
}
export function scrollFlight(flight: Flight, progress: number, reduced: boolean) {
    flight.scroll = progress;
    if (reduced) { flight.progress = progress; return; }
    if (progress < .12) Object.assign(flight, createFlight(), { scroll: progress });
    if (!flight.started) {
        flight.progress = Math.min(progress / .32, 1) * .19;
        flight.started = progress >= .32;
    }
}
export function orbitFlight(flight: Flight, fromX: number, fromY: number, toX: number, toY: number, seconds: number) {
    if (!flight.started || flight.progress >= .835 || seconds <= 0 || seconds > .15 || Math.hypot(fromX, fromY) < .15 || Math.hypot(toX, toY) < .15) return;
    const angle = Math.atan2(fromX * toY - fromY * toX, fromX * toX + fromY * toY);
    if (Math.abs(angle) > .65) return;
    const effort = Math.abs(angle) * Math.min(Math.abs(angle) / seconds / 4, 1);
    flight.boost = Math.min(2.5, flight.boost + effort * .6);
    flight.spin = Math.max(-5, Math.min(5, flight.spin + angle * 1.1));
}
export function advanceFlight(flight: Flight, delta: number) {
    const step = Math.min(Math.max(delta, 0), .25), speed = flight.progress < .82 ? 1 + flight.boost * 1.3 : 1;
    if (flight.started && flight.elapsed < flightDuration) {
        flight.elapsed = Math.min(flightDuration, flight.elapsed + step * speed);
        flight.progress = flightProgressAt(flight.elapsed);
    }
    flight.roll += flight.spin * step;
    flight.spin *= Math.exp(-step * 1.6);
    flight.boost *= Math.exp(-step * .8);
    return speed;
}
