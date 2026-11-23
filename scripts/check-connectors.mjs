import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/connectorPhysics.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace("'@dimforge/rapier3d-compat'", JSON.stringify(import.meta.resolve('@dimforge/rapier3d-compat')));
const { ConnectorPhysics, connectorPhysicsReady } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
await connectorPhysicsReady;
const anchor = x => ({ position: { x, y: 0, z: 0 }, rotation: [0, 0, 0], scale: 1, phase: 0 });

const single = new ConnectorPhysics([anchor(0)]);
single.bodies[0].applyImpulseAtPoint({ x: 10, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, true);
let peak = 0, spin = 0;
for (let i = 0; i < 960; i++) {
    single.step(1 / 120, 0);
    peak = Math.max(peak, Math.abs(single.bodies[0].translation().x));
    spin = Math.max(spin, Math.abs(single.bodies[0].angvel().z));
}
assert(peak > 1, 'A swipe must cause inertial displacement');
assert(spin > .5, 'An off-centre swipe must cause rotation');
assert(Math.abs(single.bodies[0].translation().x) < .03, 'The spring must bring the body back');
single.free();

const pair = new ConnectorPhysics([anchor(-1.8), anchor(1.8)]);
pair.bodies[0].applyImpulse({ x: 25, y: 0, z: 0 }, true);
let neighbourMotion = 0, deepestContact = 0;
for (let i = 0; i < 360; i++) {
    pair.step(1 / 120, 0);
    neighbourMotion = Math.max(neighbourMotion, pair.bodies[1].translation().x - 1.8);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        const contact = pair.bodies[0].collider(a).contactCollider(pair.bodies[1].collider(b), 0);
        if (contact) deepestContact = Math.min(deepestContact, contact.distance);
    }
    for (const body of pair.bodies) assert(Object.values(body.translation()).every(Number.isFinite));
}
assert(neighbourMotion > .3, 'Collisions must transfer momentum to a neighbouring object');
assert(deepestContact > -.06, `Contacts must prevent visible penetration; observed ${deepestContact}`);
pair.step(20, 0);
for (const body of pair.bodies) assert(Object.values(body.translation()).every(Number.isFinite), 'A resumed tab must remain stable');
pair.free();
const procedural = ts.transpileModule(readFileSync(new URL('../src/procedural.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { seeded } = await import(`data:text/javascript;base64,${Buffer.from(procedural).toString('base64')}`);
const random = seeded(42);
const anchors = Array.from({ length: 34 }, () => ({ position: { x: (random() - .5) * 8, y: (random() - .5) * 8, z: (random() - .5) * 4 }, rotation: [random() * 6, random() * 6, random() * 6], scale: 1.05 + random() * .45, phase: random() * 6 }));
const crowd = new ConnectorPhysics(anchors);
for (let i = 0; i < 360; i++) {
    if (i % 60 === 0) crowd.bodies[i / 60].applyImpulse({ x: 20, y: -10, z: -5 }, true);
    crowd.step(1 / 120, i / 120);
    for (const body of crowd.bodies) assert(Object.values(body.translation()).every(Number.isFinite));
    if (i % 12 === 0) crowd.world.forEachCollider(collider => {
        crowd.world.contactPairsWith(collider, other => {
            if (collider.parent().handle === other.parent().handle) return;
            const contact = collider.contactCollider(other, 0);
            if (contact) deepestContact = Math.min(deepestContact, contact.distance);
        });
    });
}
assert(deepestContact > -.06, `The full 34-body scene must resist penetration; observed ${deepestContact}`);
crowd.free();
console.log(`PASS: inertial swipe, angular impulse, spring return, neighbour collision, CCD and bounded timestep (deepest contact ${deepestContact.toFixed(4)}).`);
