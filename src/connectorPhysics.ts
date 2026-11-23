import RAPIER from '@dimforge/rapier3d-compat';

export const connectorPhysicsReady = RAPIER.init();
export type ConnectorAnchor = { position: { x: number; y: number; z: number }; rotation: [number, number, number]; scale: number; phase: number };

export class ConnectorPhysics {
    world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    bodies: RAPIER.RigidBody[];
    private accumulator = 0;
    constructor(private anchors: ConnectorAnchor[]) {
        this.world.timestep = 1 / 120;
        this.world.numSolverIterations = 8;
        this.world.integrationParameters.maxCcdSubsteps = 4;
        this.bodies = anchors.map(item => {
            const [x, y, z] = item.rotation.map(v => v / 2);
            const sx = Math.sin(x), cx = Math.cos(x), sy = Math.sin(y), cy = Math.cos(y), sz = Math.sin(z), cz = Math.cos(z);
            const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(item.position.x, item.position.y, item.position.z)
                .setRotation({ x: sx * cy * cz + cx * sy * sz, y: cx * sy * cz - sx * cy * sz, z: cx * cy * sz + sx * sy * cz, w: cx * cy * cz - sx * sy * sz })
                .setLinearDamping(1.65).setAngularDamping(1.8).setCcdEnabled(true));
            const s = item.scale, q = Math.SQRT1_2;
            // Three solid arms plus the central hub enclose the visible connector, including its hollow tips.
            for (const rotation of [{ x: 0, y: 0, z: 0, w: 1 }, { x: q, y: 0, z: 0, w: q }, { x: 0, y: 0, z: q, w: q }]) {
                this.world.createCollider(RAPIER.ColliderDesc.cylinder(1.065 * s, .445 * s)
                    .setRotation(rotation).setMass(.3).setContactSkin(.025 * s).setFriction(.15).setRestitution(.55), body);
            }
            this.world.createCollider(RAPIER.ColliderDesc.ball(.49 * s).setMass(.1).setContactSkin(.025 * s).setFriction(.15).setRestitution(.55), body);
            return body;
        });
        // Resolve the original random composition's overlaps before its first rendered frame.
        for (let i = 0; i < 240; i++) this.integrate(0);
    }
    private integrate(time: number) {
        this.bodies.forEach((body, i) => {
            const p = body.translation(), home = this.anchors[i];
            body.resetForces(false);
            body.addForce({ x: (home.position.x - p.x) * 4, y: (home.position.y + Math.sin(time * .5 + home.phase) * .2 - p.y) * 4, z: (home.position.z - p.z) * 4 }, true);
            body.resetTorques(false);
            body.addTorque({ x: .035 * Math.sin(home.phase), y: .045, z: .025 * Math.cos(home.phase) }, true);
        });
        this.world.step();
    }
    step(delta: number, time: number) {
        this.accumulator += Math.min(delta, .05);
        while (this.accumulator >= this.world.timestep) {
            this.integrate(time);
            this.accumulator -= this.world.timestep;
        }
    }
    free() { this.world.free(); }
}
