import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

async function load(path) {
    const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const { createFlight, scrollFlight, advanceFlight, orbitFlight, flightDuration, astronautChoreography } = await load('../src/astronautFlight.ts');
const flight = createFlight();
scrollFlight(flight, .4, false);
for (let i = 0; i < 1200; i++) advanceFlight(flight, 1 / 60);
assert(flight.progress > .45 && flight.progress < .75, 'Flight must advance for 20 seconds without more scrolling');
const beforeScroll = flight.progress;
const lowFps = createFlight(); scrollFlight(lowFps, .4, false);
for (let i = 0; i < 200; i++) advanceFlight(lowFps, .1);
assert(Math.abs(lowFps.progress - beforeScroll) < .00001, 'Low frame rates must preserve flight duration');
scrollFlight(flight, .8, false);
assert.equal(flight.progress, beforeScroll, 'Scrolling must not seek through the flight');
for (let i = 0; i < flightDuration * 60; i++) advanceFlight(flight, 1 / 60);
assert.equal(flight.progress, 1, 'The automatic flight must reach the complete return');
scrollFlight(flight, .01, false);
assert(!flight.started && flight.elapsed === 0, 'Returning to the tablet must reset the journey');
scrollFlight(flight, .6, true);
assert.equal(flight.progress, .6, 'Reduced motion must retain manual access to every phase');

const boost = seconds => {
    const state = createFlight(); scrollFlight(state, .4, false);
    for (let i = 1; i <= 32; i++) {
        const from = (i - 1) * Math.PI / 16, to = i * Math.PI / 16;
        orbitFlight(state, Math.cos(from) * .7, Math.sin(from) * .7, Math.cos(to) * .7, Math.sin(to) * .7, seconds);
    }
    return state;
};
const fast = boost(.016), slow = boost(.1);
assert(fast.boost > slow.boost && fast.spin !== 0, 'Fast circular gestures must add more speed and rotation');
const boostBefore = fast.boost;
for (let i = 0; i < 120; i++) advanceFlight(fast, 1 / 60);
assert(fast.elapsed > 2 && fast.boost < boostBefore, 'Acceleration must increase travel and then decay');
const still = createFlight(); scrollFlight(still, .4, false);
orbitFlight(still, 0, 0, 1, 1, .016);
assert.equal(still.boost, 0, 'Entering or crossing the centre must not create a boost');
for (let p = .34; p < .72; p += .001) {
    const pose = astronautChoreography(p, p * 60);
    assert(pose.frame < 88, 'All outward tunnels must use floating poses, never the greeting clip');
}
assert(astronautChoreography(.8, 40).corridorZ < astronautChoreography(.72, 38).corridorZ, 'The corridor must move backwards during the fall');
assert(astronautChoreography(.77, 42).echoes > .8, 'Falling must activate the ghost trail');
assert(astronautChoreography(.835, 48).frame === 120, 'The impact must start with the tucked launch pose');
for (let p = .835; p <= 1; p += .001) {
    const pose = astronautChoreography(p, 50);
    assert(pose.cameraZ - pose.jumpZ > 2, 'The jump must remain in front of the camera, without disappearing behind it');
    if (pose.jump > .25) assert((pose.cameraZ - pose.jumpZ) * Math.tan(21 * Math.PI / 180) > pose.jumpY + 1.25, 'The camera must leave headroom through the extended jump');
    if (pose.frame >= 168) assert(pose.outside, 'Greeting must only happen outside the tablet');
}
assert(astronautChoreography(1, 60).jumpZ > .52, 'The astronaut must remain outside the glass after the jump');

const manifest = JSON.parse(readFileSync(new URL('../public/assets/astronaut/audio/SOURCES.json', import.meta.url)));
assert.equal(manifest.files.length, 6);
for (const file of manifest.files) {
    const bytes = readFileSync(new URL(`../public/assets/astronaut/audio/${file.file}`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'OggS');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    assert(file.durationSeconds > 1 && file.durationSeconds < 60);
}

const { AstronautAudio } = await load('../src/astronautAudio.ts');
const sources = [], gains = [];
const parameter = () => ({ value: 0, setTargetAtTime(value) { this.value = value; } });
const context = {
    currentTime: 0, destination: {},
    createGain() { const gain = { gain: parameter(), connect() {}, disconnect() {} }; gains.push(gain); return gain; },
    createBufferSource() { const source = { playbackRate: parameter(), connect() {}, disconnect() {}, start() { this.started = true; }, stop() { this.stopped = true; } }; sources.push(source); return source; },
    async decodeAudioData() { return {}; },
};
const realFetch = globalThis.fetch;
try {
    globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
    const audio = new AstronautAudio(context, () => assert.fail('Valid audio should load'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sources.length, 5, 'The five background layers must be loaded');
    assert(sources.every(source => !source.started), 'Musical cues must wait for their scene, not run silently from page load');
    audio.update(.34, 1, true);
    assert(sources[1].started && !sources[3].started, 'The falling cue must not start in the first tunnel');
    audio.update(.83, 2, true); audio.update(.84, 2, true); audio.update(.85, 2, true);
    assert.equal(sources.length, 6, 'Glass must play exactly once when crossing impact');
    assert(sources[0].playbackRate.value >= 1.5, 'Boost must audibly affect the sound of travel');
    audio.update(.86, 1, false);
    assert.equal(gains[0].gain.value, 0, 'Pause or mute must silence every flight layer');
    audio.update(.2, 1, true); audio.update(.84, 1, true);
    assert.equal(sources.filter(source => !source.loop).length, 2, 'Replay must rearm the glass sound');
    audio.dispose();
    assert(sources.every(source => !source.started || source.stopped), 'Unmount must stop all started audio sources');
} finally { globalThis.fetch = realFetch; }
console.log('PASS: automatic journey, circular boost, tunnel pose isolation, backwards fall, ghost envelope, visible jump and headroom, greeting outside the glass, verified Ogg files, stage-aligned music, audible tempo boost, impact, mute and cleanup.');
