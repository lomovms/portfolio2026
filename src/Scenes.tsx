import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { View, PerspectiveCamera, Environment, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RootState } from '@react-three/fiber';
import type { SceneKind } from './data';
import type { Project } from './data';
import { seeded, terrainHeight } from './procedural';
import type { ConnectorPhysics } from './connectorPhysics';
const sceneNames: Record<SceneKind, string> = { connectors: 'объёмные соединители', confetti: 'волна белых фигур', particles: 'облако частиц', cork: 'мастерская и пробковая подставка', motor: 'облака и механизм', devin: 'цифровой помощник', tree: 'дерево', terrain: 'речной ландшафт', car: 'автомобиль', human: 'цифровой портрет', ribbon: 'пластичная форма', space: 'космос', train: 'игрушечная железная дорога', zero: 'абстрактная архитектура', fusion: 'пространственное слияние', globe: 'глобус', labs: 'экспериментальная скульптура', book: 'ожившая книга', soda: 'бутылка и пузырьки', fashion: 'виртуальный подиум', screw: 'таинственный коридор', bear: 'медведь с подарком', portal: 'пространственный портал' };
const MotionContext = createContext(false);
type MotionState = Omit<RootState, 'clock'> & {
    clock: {
        elapsedTime: number;
    };
};
function useMotionFrame(callback: (state: MotionState, delta: number) => void) {
    const paused = useContext(MotionContext), time = useRef(0);
    const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
    useFrame((state, delta) => {
        const step = paused || reduced ? 0 : Math.min(delta, .05);
        time.current += step;
        callback({ ...state, clock: { elapsedTime: time.current } }, step);
    });
}
const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();
function Lighting({ dark = false }: {
    dark?: boolean;
}) {
    const gl = useThree(s => s.gl);
    const map = useMemo(() => {
        if (envCache.has(gl))
            return envCache.get(gl)!;
        const room = new RoomEnvironment();
        const pmrem = new THREE.PMREMGenerator(gl);
        const target = pmrem.fromScene(room, .04);
        room.dispose();
        pmrem.dispose();
        envCache.set(gl, target.texture);
        return target.texture;
    }, [gl]);
    return <><Environment map={map} environmentIntensity={dark ? .45 : .65}/><ambientLight intensity={dark ? .15 : .25}/><directionalLight castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={.035} position={[-4, 7, 6]} intensity={dark ? 1.7 : 2.5} color="#f0f3ff"/><directionalLight position={[5, 1, -2]} intensity={dark ? .4 : .5} color="#c2c9ff"/></>;
}
export function HeroScene() {
    return <Scene kind="connectors"/>;
}

export function Scene({ kind, color = '#1616ef', background = '#15161c', variant = 0, className = '', interactive = true, paused = false }: {
    kind: SceneKind;
    color?: string;
    background?: string;
    variant?: number;
    className?: string;
    interactive?: boolean;
    paused?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);
    const [fallback, setFallback] = useState(false);
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '280px' });
        if (ref.current)
            observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);
    return <div ref={ref} className={`scene ${className}`} role="group" aria-label={`Интерактивная 3D-сцена: ${sceneNames[kind]}`}>
    <View className="scene-view" aria-hidden="true" visible={visible}>
      {visible && <><color attach="background" args={[background]}/><PerspectiveCamera makeDefault position={[0, 0, ['connectors', 'particles', 'human'].includes(kind) ? 10 : 8.6]} fov={42} near={.05} far={100}/><Lighting dark={['connectors', 'particles', 'human', 'globe', 'portal', 'tree', 'space', 'cork'].includes(kind)}/><MotionContext.Provider value={paused}><World kind={kind} color={color} variant={variant} interactive={interactive} surface={ref}/></MotionContext.Provider></>}
    </View>
    {fallback && <span className="scene-help">Перемещайте указатель · касайтесь и перетаскивайте</span>}
    {interactive && <button className="scene-info" aria-label="Как управлять сценой" onClick={() => setFallback(!fallback)}>↗</button>}
  </div>;
}
function World({ kind, color, variant, interactive, surface }: {
    surface: RefObject<HTMLDivElement | null>;
    kind: SceneKind;
    color: string;
    variant: number;
    interactive: boolean;
}) {
    const group = useRef<THREE.Group>(null);
    const { gl, scene } = useThree();
    const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
    useEffect(() => { group.current?.traverse(object => { if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
    } }); }, [kind]);
    useEffect(() => {
        if (kind === 'terrain')
            scene.fog = new THREE.Fog('#597d63', 18, 40);
        if (kind === 'screw' || kind === 'particles')
            scene.fog = new THREE.Fog('#10151c', 10, 45);
        return () => { scene.fog = null; };
    }, [kind, scene]);
    useMotionFrame(({ clock, pointer }) => {
        if (!group.current)
            return;
        const t = reduced ? 0 : clock.elapsedTime;
        const turn = interactive ? pointer.x : 0;
        group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, turn * .14 + variant * .22, 4, .016);
        group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -(interactive ? pointer.y : 0) * .08, 4, .016);
        group.current.position.y = Math.sin(t * .4) * .045;
        gl.domElement.dataset.ready = 'true';
    });
    return <group ref={group} rotation-y={variant * .22} scale={variant === 2 ? 1.4 : 1}>
    {kind === 'connectors' ? <Connectors surface={surface} interactive={interactive}/> : kind === 'confetti' ? <Confetti /> :
            kind === 'particles' ? <AboutWorld /> :
                kind === 'human' ? <Particles human color={color} variant={variant}/> :
                    kind === 'cork' ? <Cork variant={variant}/> :
                        kind === 'motor' ? (variant === 0 ? <Clouds /> : <Motor variant={variant}/>) :
                            kind === 'devin' ? <Devin /> :
                                kind === 'tree' ? <Tree /> :
                                    kind === 'terrain' ? <Terrain variant={variant}/> :
                                        kind === 'car' ? <Car /> :
                                            kind === 'ribbon' ? <Ribbon color={color}/> :
                                                kind === 'space' || kind === 'fusion' ? <Space fusion={kind === 'fusion'}/> :
                                                    kind === 'train' ? <Train /> :
                                                        kind === 'zero' || kind === 'portal' ? <Portal color={color} variant={variant}/> :
                                                            kind === 'globe' ? <Globe /> :
                                                                kind === 'labs' ? <Labs /> :
                                                                    kind === 'book' ? <Book /> :
                                                                        kind === 'soda' ? <Soda /> :
                                                                            kind === 'fashion' ? <Fashion /> :
                                                                                kind === 'screw' ? <Screw /> : <Bear />}
  </group>;
}
export function CardBakeWorld({ project, variant = 0 }: { project: Pick<Project, 'scene' | 'background' | 'color'>; variant?: number }) {
    const surface = useRef<HTMLDivElement>(null);
    const scene = useThree(state => state.scene);
    useLayoutEffect(() => {
        const previous = scene.background; scene.background = new THREE.Color(project.background);
        return () => { scene.background = previous; };
    }, [project.background, scene]);
    return <>
        <PerspectiveCamera makeDefault position={[0, 0, ['connectors','particles','human'].includes(project.scene) ? 10 : 8.6]} fov={42} near={.05} far={100}/>
        <Lighting dark={['connectors','particles','human','globe','portal','tree','space','cork'].includes(project.scene)}/>
        <MotionContext.Provider value={true}><World kind={project.scene} color={project.color} variant={variant} interactive={false} surface={surface}/></MotionContext.Provider></>;
}
let connectorGeometry: THREE.BufferGeometry;
function makeConnector() {
    if (connectorGeometry)
        return connectorGeometry;
    const profile = [[0, 0], [.38, 0], [.43, .15], [.43, .98], [.415, 1.04], [.39, 1.065], [.16, 1.065], [.13, 1.035], [.13, .78], [0, .78]].map(([x, y]) => new THREE.Vector2(x, y));
    const arm = new THREE.LatheGeometry(profile, 40);
    const pieces: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
        const part = arm.clone();
        if (i === 1)
            part.rotateX(Math.PI);
        if (i === 2)
            part.rotateZ(Math.PI / 2);
        if (i === 3)
            part.rotateZ(-Math.PI / 2);
        if (i === 4)
            part.rotateX(Math.PI / 2);
        if (i === 5)
            part.rotateX(-Math.PI / 2);
        pieces.push(part.toNonIndexed());
        part.dispose();
    }
    pieces.push(new THREE.SphereGeometry(.48, 24, 16).toNonIndexed());
    connectorGeometry = mergeGeometries(pieces);
    pieces.forEach(g => g.dispose());
    arm.dispose();
    return connectorGeometry;
}
function Connectors({ surface, interactive }: { surface: RefObject<HTMLDivElement | null>; interactive: boolean }) {
    const ref = useRef<THREE.Group>(null);
    const physics = useRef<ConnectorPhysics | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const strokes = useRef<{ from: THREE.Vector2; to: THREE.Vector2; seconds: number }[]>([]);
    const scratch = useMemo(() => ({ raycaster: new THREE.Raycaster(), inverse: new THREE.Matrix4(), startRay: new THREE.Ray(), endRay: new THREE.Ray(), plane: new THREE.Plane(), start: new THREE.Vector3(), end: new THREE.Vector3(), segment: new THREE.Vector3(), nearest: new THREE.Vector3(), outward: new THREE.Vector3(), impulse: new THREE.Vector3() }), []);
    const items = useMemo(() => { const rand = seeded(42); return Array.from({ length: 34 }, (_, i) => ({ position: new THREE.Vector3((rand() - .5) * 8, (rand() - .5) * 8, (rand() - .5) * 4), rotation: [rand() * 6, rand() * 6, rand() * 6] as [
            number,
            number,
            number
        ], scale: 1.05 + rand() * .45, color: ['#020207', '#0303c9', '#9b9da4', '#0303c0', '#676aa4'][i % 5], phase: rand() * 6 })); }, []);
    useEffect(() => {
        let cancelled = false;
        import('./connectorPhysics').then(async module => {
            await module.connectorPhysicsReady;
            if (!cancelled) physics.current = new module.ConnectorPhysics(items);
        }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason : new Error(String(reason))); });
        return () => { cancelled = true; physics.current?.free(); physics.current = null; };
    }, [items]);
    useEffect(() => {
        let previous: { point: THREE.Vector2; time: number } | null = null;
        const reset = () => { previous = null; strokes.current.length = 0; };
        const move = (event: PointerEvent) => {
            const rect = surface.current?.getBoundingClientRect();
            if (!interactive || !rect || !rect.width || !rect.height || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { previous = null; return; }
            const point = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
            if (previous && event.timeStamp - previous.time < 150) {
                strokes.current.push({ from: previous.point, to: point, seconds: Math.max((event.timeStamp - previous.time) / 1000, .004) });
                if (strokes.current.length > 32) strokes.current.shift();
            }
            previous = { point, time: event.timeStamp };
        };
        window.addEventListener('pointermove', move, { passive: true });
        window.addEventListener('blur', reset);
        window.addEventListener('pointercancel', reset);
        window.addEventListener('scroll', reset, { passive: true });
        return () => { window.removeEventListener('pointermove', move); window.removeEventListener('blur', reset); window.removeEventListener('pointercancel', reset); window.removeEventListener('scroll', reset); };
    }, [surface, interactive]);
    useMotionFrame(({ clock, camera }, delta) => {
        if (!ref.current || !physics.current) return;
        const simulation = physics.current, t = clock.elapsedTime;
        ref.current.rotation.z = Math.sin(t * .08) * .18;
        ref.current.rotation.y = Math.sin(t * .12) * .23;
        ref.current.updateWorldMatrix(true, false);
        scratch.inverse.copy(ref.current.matrixWorld).invert();
        if (delta > 0) for (const stroke of strokes.current) {
            scratch.raycaster.setFromCamera(stroke.from, camera);
            scratch.startRay.copy(scratch.raycaster.ray).applyMatrix4(scratch.inverse);
            scratch.raycaster.setFromCamera(stroke.to, camera);
            scratch.endRay.copy(scratch.raycaster.ray).applyMatrix4(scratch.inverse);
            simulation.bodies.forEach((body, i) => {
                const position = body.translation();
                scratch.plane.normal.set(0, 0, 1);
                scratch.plane.constant = -position.z;
                if (!scratch.startRay.intersectPlane(scratch.plane, scratch.start) || !scratch.endRay.intersectPlane(scratch.plane, scratch.end)) return;
                scratch.segment.subVectors(scratch.end, scratch.start);
                const lengthSquared = scratch.segment.lengthSq();
                if (lengthSquared < 1e-10) return;
                scratch.outward.copy(position).sub(scratch.start);
                const fraction = THREE.MathUtils.clamp(scratch.outward.dot(scratch.segment) / lengthSquared, 0, 1);
                scratch.nearest.copy(scratch.start).addScaledVector(scratch.segment, fraction);
                scratch.outward.copy(position).sub(scratch.nearest);
                const distance = scratch.outward.length(), radius = items[i].scale * 1.15 + .35;
                if (distance >= radius) return;
                const speed = Math.min(Math.sqrt(lengthSquared) / stroke.seconds, 35);
                const strength = Math.min(Math.sqrt(lengthSquared) * (1.5 + speed * .65), 10) * (1 - distance / radius);
                scratch.impulse.copy(scratch.segment).normalize().multiplyScalar(.65);
                if (distance > .001) scratch.impulse.addScaledVector(scratch.outward, .85 / distance);
                scratch.impulse.z -= .12;
                scratch.impulse.multiplyScalar(strength);
                body.applyImpulseAtPoint(scratch.impulse, scratch.nearest, true);
            });
        }
        strokes.current.length = 0;
        simulation.step(delta, t);
        ref.current.children.forEach((child, i) => {
            const body = simulation.bodies[i];
            child.position.copy(body.translation());
            child.quaternion.copy(body.rotation());
        });
    });
    if (error) throw error;
    return <group ref={ref} scale={1.2} rotation={[0, 0, -.15]}>{items.map((item, i) => <mesh key={i} geometry={makeConnector()} position={item.position} rotation={item.rotation} scale={item.scale}><meshPhysicalMaterial color={item.color} roughness={i % 3 === 0 ? .17 : .32} metalness={.08} clearcoat={.8} clearcoatRoughness={.15} envMapIntensity={.6}/></mesh>)}</group>;
}
const particleVertex = `uniform float uTime;uniform float uMorph;uniform float uRatio;uniform vec2 uMouse;attribute float aSeed;varying float vLight;void main(){vec3 p=position;float t=uTime*.16;p.x+=sin(p.y*1.6+t+aSeed*6.)*.13;p.z+=cos(p.x*2.+t)*.16;float d=distance(p.xy,uMouse*4.);p.z+=exp(-d*d*.8)*.7;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((.045+aSeed*.12)*uRatio*600./-mv.z,1.,28.);vLight=.25+aSeed*.75;}`;
const particleFragment = `uniform vec3 uColor;varying float vLight;void main(){vec2 uv=gl_PointCoord*2.-1.;float d=dot(uv,uv);if(d>1.)discard;vec3 n=vec3(uv,sqrt(1.-d));float light=.22+.78*max(0.,dot(n,normalize(vec3(-.5,.8,1.))));vec3 col=uColor*light*vLight;if(vLight>.998)col=vec3(1.5,1.65,1.7)*(1.-d*.45);gl_FragColor=vec4(col,1.);}`;
function Particles({ human = false, color, variant }: {
    human?: boolean;
    color: string;
    variant: number;
}) {
    const ref = useRef<THREE.Points>(null);
    const { gl } = useThree();
    const [pos, seeds] = useMemo(() => {
        const rand = seeded(719);
        const n = human ? 15000 : 22000;
        const p = new Float32Array(n * 3), s = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const phi = rand() * Math.PI * 2, theta = Math.acos(2 * rand() - 1), r = human ? 1 : Math.pow(rand(), .5);
            let x = Math.sin(theta) * Math.cos(phi), y = Math.cos(theta), z = Math.sin(theta) * Math.sin(phi);
            if (human) {
                x *= 1.6 * (.65 + .35 * (y + 1) / 2);
                y *= 2.5;
                z *= 1.4;
                if (z > 0) {
                    z += Math.exp(-x * x * 20 - y * y * 2) * .5;
                    z -= Math.exp(-Math.pow(Math.abs(x) - .55, 2) * 25 - Math.pow(y - .35, 2) * 30) * .25;
                }
            }
            else {
                const f = 1 + .27 * Math.sin(phi * 4 + theta * 5) + .15 * Math.cos(theta * 9);
                x *= r * f * 3;
                y *= r * f * 3;
                z *= r * f * 2.5;
            }
            p.set([x, y, z], i * 3);
            s[i] = rand();
        }
        return [p, s];
    }, [human]);
    const uniforms = useMemo(() => ({ uTime: { value: 0 }, uMorph: { value: 0 }, uRatio: { value: gl.getPixelRatio() }, uMouse: { value: new THREE.Vector2() }, uColor: { value: new THREE.Color(color) } }), [gl, color]);
    useMotionFrame(({ clock, pointer }) => {
        const t = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : clock.elapsedTime;
        uniforms.uTime.value = t;
        uniforms.uMouse.value.lerp(pointer, .04);
        if (ref.current) {
            ref.current.rotation.y = Math.sin(t * .13) * .28 + (human ? -.3 : 0);
            ref.current.rotation.z = Math.sin(t * .09) * .08;
        }
    });
    return <points ref={ref} scale={variant === 1 ? .85 : 1}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[pos, 3]}/><bufferAttribute attach="attributes-aSeed" args={[seeds, 1]}/></bufferGeometry>
    <shaderMaterial vertexShader={particleVertex} fragmentShader={particleFragment} uniforms={uniforms}/>
  </points>;
}
function AboutWorld() {
    const cloud = useRef<THREE.Group>(null), ground = useRef<THREE.Group>(null);
    const geometry = useMemo(() => {
        const g = new THREE.PlaneGeometry(45, 65, 150, 150), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), ridge = Math.abs(Math.sin(x * .9 + y * .38) + Math.cos(x * 1.8 - y * .8) * .35);
            const h = Math.pow(Math.abs(x) * .12, 1.7) * (1 + ridge * .6) + Math.sin(y * .5) * .15 + Math.sin(x * 5 + y * 3) * .05;
            p.setZ(i, h);
        }
        g.computeVertexNormals();
        return g;
    }, []);
    useEffect(() => () => geometry.dispose(), [geometry]);
    useMotionFrame(({ camera }) => {
        const p = THREE.MathUtils.clamp(window.scrollY / (window.innerHeight * 2.1), 0, 1);
        if (cloud.current) {
            cloud.current.scale.setScalar(1 - p * .89);
            cloud.current.position.y = p * .1;
        }
        if (ground.current)
            { ground.current.position.y = -4; ground.current.scale.y=.05+p*.95; }
        camera.position.z = 10 + p * 12;
        camera.position.y = p * 4;
        camera.lookAt(0, -p * 2, 0);
    });
    return <><group ref={cloud}><Particles color="#b6c6cf" variant={0}/></group><group ref={ground} position={[0, -4, 0]}>
  <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.3, -10]}><meshStandardMaterial color="#2b353c" roughness={.82} metalness={.25}/></mesh>
  <group position={[0, .12, 0]} scale={.3}><mesh position={[0, .95, 0]}><sphereGeometry args={[.18, 16, 12]}/><meshStandardMaterial color="#cad5d8" metalness={.4} roughness={.3}/></mesh><mesh position={[0, .5, 0]}><capsuleGeometry args={[.18, .45, 4, 12]}/><meshStandardMaterial color="#aeb9bc" metalness={.5}/></mesh>{[-1, 1].map(x => <group key={x}><mesh position={[x * .11, .05, 0]} rotation={[0, 0, -x * .08]}><capsuleGeometry args={[.07, .45, 3, 8]}/><meshStandardMaterial color="#abb5bc"/></mesh><mesh position={[x * .25, .5, 0]} rotation={[0, 0, x * .25]}><capsuleGeometry args={[.065, .4, 3, 8]}/><meshStandardMaterial color="#abb5bc"/></mesh></group>)}</group>
  <spotLight position={[0, 13, 0]} target-position={[0, 0, 0]} color="#d5f3fc" intensity={400} angle={.38} penumbra={1} distance={25}/>
  <mesh position={[0, 6, 0]}><coneGeometry args={[3.4, 13, 48, 1, true]}/><meshBasicMaterial color="#b7e3f3" transparent opacity={.035} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false}/></mesh>
  <mesh position={[0, 12.4, 0]}><sphereGeometry args={[.11, 16, 12]}/><meshBasicMaterial color="#e0f7ff"/></mesh>
 </group></>;
}
function Box({ position = [0, 0, 0], scale = [1, 1, 1], color = '#eee', radius = .08, rotation = [0, 0, 0] }: {
    position?: [
        number,
        number,
        number
    ];
    scale?: [
        number,
        number,
        number
    ];
    color?: string;
    radius?: number;
    rotation?: [
        number,
        number,
        number
    ];
}) {
    return <RoundedBox args={scale} radius={radius} smoothness={3} position={position} rotation={rotation}><meshStandardMaterial color={color} roughness={.35} metalness={.12}/></RoundedBox>;
}
function Cork({ variant }: {
    variant: number;
}) {
    const ref = useRef<THREE.Group>(null);
    const textures = useMemo(() => {
        const rand = seeded(18), cork = new Uint8Array(128 * 128 * 4), wall = new Uint8Array(256 * 256 * 4), wood = new Uint8Array(256 * 256 * 4);
        for (let i = 0; i < 128 * 128; i++) {
            const v = rand();
            cork.set([110 + v * 65, 66 + v * 50, 31 + v * 28, 255], i * 4);
        }
        for (let y = 0; y < 256; y++)
            for (let x = 0; x < 256; x++) {
                const dx = ((x + 16) % 32) - 16, dy = ((y + 16) % 32) - 16;
                const hole = Math.abs(dx) < 2.3 && Math.abs(dy) < 6.8;
                const v = rand() * 9;
                wall.set(hole ? [30 + v, 34 + v, 27 + v, 255] : [126 + v, 137 + v, 116 + v, 255], (y * 256 + x) * 4);
                const grain = Math.sin(y * .32 + Math.sin(x * .009) * 2) * 9 + Math.sin(y * 1.7) * 4 + rand() * 8;
                wood.set([84 + grain, 61 + grain * .7, 38 + grain * .4, 255], (y * 256 + x) * 4);
            }
        return [cork, wall, wood].map((data, i) => { const n = i ? 256 : 128; const tex = new THREE.DataTexture(data, n, n); tex.needsUpdate = true; tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(i === 1 ? 3 : 1, i === 1 ? 1.5 : 1); return tex; });
    }, []);
    useEffect(() => () => textures.forEach(t => t.dispose()), [textures]);
    useMotionFrame(({ clock }) => { if (ref.current)
        ref.current.rotation.y = Math.sin(clock.elapsedTime * .13) * .045; });
    return <group ref={ref} position={[0, -.15, 0]} rotation={[.08, -.08, 0]}>
  <mesh position={[0, -1.7, 0]}><boxGeometry args={[45, .6, 15]}/><meshStandardMaterial map={textures[2]} roughness={.68}/></mesh>
  <Box scale={[5, .025, 2.8]} position={[0, -1.38, .4]} color="#285447" radius={.02}/>
  {Array.from({ length: 16 }, (_, i) => <mesh key={i} position={[-2.3 + i * .3, -1.361, .4]}><boxGeometry args={[.006, .002, 2.7]}/><meshBasicMaterial color="#7c9e81"/></mesh>)}
  <mesh position={[0, -1.24, 0]}><cylinderGeometry args={[.8, .77, .21, 80]}/><meshStandardMaterial map={textures[0]} roughness={.95}/></mesh>
  <group position={[0, variant === 1 ? .35 : -.3, 0]} rotation={[0, 0, variant === 1 ? -.1 : 0]}>
   <mesh><cylinderGeometry args={[.69, .5, 1.7, 64]}/><meshStandardMaterial color="#d9d4c5" roughness={.8}/></mesh>
   <mesh position={[0, .1, 0]}><cylinderGeometry args={[.721, .638, .66, 64]}/><meshStandardMaterial color="#202520" roughness={.85}/></mesh>
   <mesh position={[0, .9, 0]}><cylinderGeometry args={[.75, .73, .17, 64]}/><meshStandardMaterial color="#141916" roughness={.32}/></mesh>
   <mesh position={[0, 1.01, 0]}><cylinderGeometry args={[.62, .74, .09, 64]}/><meshStandardMaterial color="#0e1311"/></mesh>
   <mesh position={[0, .16, .71]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.18, .035, 12, 40]}/><meshStandardMaterial color="#d5dfc3"/></mesh>
   <Box scale={[.07, .28, .02]} position={[0, .16, .75]} color="#d5dfc3" radius={.01}/>
  </group>
  <mesh position={[0, 1, -2.4]}><boxGeometry args={[45, 14, .2]}/><meshStandardMaterial map={textures[1]} roughness={1}/></mesh>
  <group position={[2.1, .2, -2.18]} rotation={[.03, 0, 0]}>
   <Box scale={[3, 1.15, .15]} color="#1c3021" radius={.07}/>
   {Array.from({ length: 36 }, (_, i) => <Box key={i} scale={[.23, .2, .12]} position={[(i % 12) * .24 - 1.32, Math.floor(i / 12) * .28 - .3, .12]} color={i % 4 === 0 ? '#546c3d' : '#3d5130'} radius={.025}/>)}
  </group>
  <group position={[-2.8, -.2, -1.9]}>
   <Box scale={[1.3, .1, .8]} color="#707969"/>
   <mesh position={[0, -.35, .2]}><cylinderGeometry args={[.45, .37, .6, 32]}/><meshPhysicalMaterial color="#b0ba9f" transparent opacity={.35} roughness={.1} metalness={.1}/></mesh>
   {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[(i % 3) * .17 - .17, -.3, Math.floor(i / 3) * .12 + .07]} rotation={[.4 + i * .1, 0, i * .3]}><capsuleGeometry args={[.035, .4, 3, 6]}/><meshStandardMaterial color={['#cad2af', '#6c7e5a', '#a99859'][i % 3]}/></mesh>)}
  </group>
  {[0, 1, 2].map(i => <mesh key={i} position={[1.4, -1.33, .8 + i * .19]} rotation={[0, 0, Math.PI / 2 - .07]}><cylinderGeometry args={[.025, .025, 2, 8]}/><meshStandardMaterial color={i === 0 ? '#b47a23' : i === 1 ? '#364c35' : '#a9ac8a'}/></mesh>)}
  <pointLight position={[-3, 3, 2]} color="#ffe0a0" intensity={13} distance={10}/>
 </group>;
}
const cloudVertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const cloudFragment = `varying vec2 vUv;uniform float uTime;uniform float uAspect;
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float field(vec3 p){float f=noise(p*1.1)*.57+noise(p*2.5)*.28+noise(p*5.7)*.15;float shape=sin(p.x*.7+p.y*.4)*.15+cos(p.y*.8-p.z*.3)*.13;return clamp((f+shape-.49)*2.6,0.,1.);}
void main(){vec2 uv=(vUv-.5)*vec2(uAspect,1.);vec3 origin=vec3(uv*6.,5.);vec3 dir=normalize(vec3(uv*.18,-1.));vec4 sum=vec4(0.);float t=uTime*.065;
for(int i=0;i<32;i++){vec3 p=origin+dir*(float(i)*.24);p.x+=t;p.z+=t*.4;float den=field(p);if(den>.01){float sun=field(p+vec3(-.25,.4,.2));float lighting=clamp((den-sun)*1.8+.5,0.,1.);vec3 col=mix(vec3(.26,.36,.49),vec3(1.,.76,.53),lighting);float a=den*.21;sum.rgb+=(1.-sum.a)*col*a;sum.a+=(1.-sum.a)*a;}if(sum.a>.98)break;}vec3 sky=vec3(.34,.53,.6);gl_FragColor=vec4(sum.rgb+sky*(1.-sum.a),1.);}`;
function Clouds() {
    const size = useThree(s => s.size);
    const uniforms = useMemo(() => ({ uTime: { value: 0 }, uAspect: { value: size.width / size.height } }), [size.width, size.height]);
    useMotionFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime; });
    return <mesh frustumCulled={false}><planeGeometry args={[2, 2]}/><shaderMaterial uniforms={uniforms} vertexShader={cloudVertex} fragmentShader={cloudFragment} depthWrite={false}/></mesh>;
}
function Motor({ variant }: {
    variant: number;
}) {
    const ref = useRef<THREE.Group>(null);
    useMotionFrame(({ clock }) => { if (ref.current)
        ref.current.rotation.y = clock.elapsedTime * .2; });
    return <group rotation={[.4, 0, .35]} scale={1.2}>
  <group ref={ref}>
   {[0, 1, 2, 3, 4, 5].map(i => <mesh key={i} position={[0, (i - 2.5) * .32, 0]}><cylinderGeometry args={[i === 0 || i === 5 ? 1.13 : 1.02, i === 0 || i === 5 ? 1.13 : 1.02, .18, 80]}/><meshStandardMaterial color={i % 2 ? '#202329' : '#a6aeb7'} metalness={.9} roughness={.24}/></mesh>)}
   <mesh><cylinderGeometry args={[.28, .28, variant === 1 ? 4 : 3.1, 40]}/><meshStandardMaterial color="#dadde1" roughness={.17} metalness={1}/></mesh>
   {Array.from({ length: 32 }, (_, i) => <mesh key={i} rotation={[0, i / 32 * Math.PI * 2, 0]}><Box scale={[.07, 1.2, .18]} position={[0, 0, 1.04]} color="#ac9f82" radius={.02}/></mesh>)}
  </group>
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.4, -.6]}><planeGeometry args={[30, 30]}/><meshStandardMaterial color="#b2b5b9" roughness={.8}/></mesh>
 </group>;
}
function Devin() {
    const ref = useRef<THREE.Group>(null);
    useMotionFrame(({ clock }) => { if (ref.current)
        ref.current.position.y = Math.sin(clock.elapsedTime * .6) * .15; });
    return <group ref={ref} rotation={[.12, -.3, 0]}>
  <Box scale={[3.7, 2.6, .45]} color="#ecf3f6" radius={.2}/>
  <Box scale={[3.25, 2.08, .08]} position={[0, .1, .25]} color="#142631" radius={.11}/>
  <Box scale={[4, .2, 2.3]} position={[0, -1.48, .8]} color="#d5e1e6" radius={.08}/>
  <mesh position={[0, .07, .32]}><sphereGeometry args={[.58, 40, 32]}/><meshPhysicalMaterial color="#e9fbff" metalness={.65} roughness={.12}/></mesh>
  {[-.19, .19].map(x => <mesh key={x} position={[x, .14, .87]}><sphereGeometry args={[.048, 12, 10]}/><meshBasicMaterial color="#1d3c52"/></mesh>)}
  {Array.from({ length: 12 }, (_, i) => <Box key={i} position={[-1.4 + i * .25, -1.34, 1]} scale={[.17, .03, .35]} color="#a6bccb" radius={.01}/>)}
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.7, 0]}><planeGeometry args={[60, 60]}/><meshStandardMaterial color="#b7d8ec"/></mesh>
 </group>;
}
function Tree() {
    const [geometry, leaves] = useMemo(() => {
        const rand = seeded(142), pieces: THREE.BufferGeometry[] = [], leafPositions: number[] = [];
        const branch = (start: THREE.Vector3, dir: THREE.Vector3, len: number, radius: number, depth: number) => {
            const end = start.clone().addScaledVector(dir, len), mid = start.clone().lerp(end, .5).add(new THREE.Vector3((rand() - .5) * len * .2, 0, (rand() - .5) * len * .2));
            const curve = new THREE.CatmullRomCurve3([start, mid, end]);
            const g = new THREE.TubeGeometry(curve, 5, radius, 8, false);
            const p = g.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const n = Math.sin(p.getY(i) * 37 + p.getX(i) * 63) * radius * .09;
                p.setXYZ(i, p.getX(i) + n, p.getY(i), p.getZ(i) + n);
            }
            g.computeVertexNormals();
            pieces.push(g.toNonIndexed());
            g.dispose();
            if (depth > 0)
                for (let i = 0; i < 3; i++) {
                    const d = dir.clone().add(new THREE.Vector3((rand() - .5) * 2.7, rand() * .4 - .1, (rand() - .5) * 2.7)).normalize();
                    branch(end, d, len * (.57 + rand() * .17), radius * .61, depth - 1);
                }
            else
                for (let i = 0; i < 13; i++)
                    leafPositions.push(end.x + (rand() - .5) * .7, end.y + (rand() - .5) * .45, end.z + (rand() - .5) * .7);
        };
        branch(new THREE.Vector3(0, -2.7, 0), new THREE.Vector3(.1, 1, 0).normalize(), 2.6, .37, 5);
        const merged = mergeGeometries(pieces);
        pieces.forEach(p => p.dispose());
        return [merged, new Float32Array(leafPositions)];
    }, []);
    const bark = useMemo(() => {
        const data = new Uint8Array(128 * 256 * 4), rand = seeded(734);
        for (let y = 0; y < 256; y++)
            for (let x = 0; x < 128; x++) {
                const n = Math.abs(Math.sin(x * .65 + Math.sin(y * .11) * .5)) * 30 + rand() * 18;
                data.set([60 + n, 68 + n, 52 + n * .7, 255], (y * 128 + x) * 4);
            }
        const texture = new THREE.DataTexture(data, 128, 256);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(3, 2);
        texture.needsUpdate = true;
        return texture;
    }, []);
    useEffect(() => () => { geometry.dispose(); bark.dispose(); }, [geometry, bark]);
    return <group rotation={[0, .4, 0]} scale={1.13}><mesh geometry={geometry}><meshStandardMaterial map={bark} bumpMap={bark} bumpScale={.16} roughness={.95}/></mesh><points><bufferGeometry><bufferAttribute attach="attributes-position" args={[leaves, 3]}/></bufferGeometry><pointsMaterial color="#427952" size={.09} sizeAttenuation alphaTest={.5}/></points><pointLight color="#b2e3bd" intensity={12} position={[-2, 4, 2]}/><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.7, 0]}><circleGeometry args={[18, 80]}/><meshStandardMaterial color="#16261b" roughness={1}/></mesh><Dust color="#d3ffa5"/></group>;
}
function Terrain({ variant }: {
    variant: number;
}) {
    const geometry = useMemo(() => {
        const g = new THREE.PlaneGeometry(22, 22, 150, 150);
        const p = g.attributes.position;
        const colors = [];
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i);
            const z = terrainHeight(x, y);
            p.setZ(i, z + .035 * Math.sin(x * 13) * Math.cos(y * 12));
            const c = new THREE.Color().setHSL(.29, .26, THREE.MathUtils.clamp(.12 + z * .08, .09, .35));
            colors.push(c.r, c.g, c.b);
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        g.computeVertexNormals();
        return g;
    }, []);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return <group rotation={[.45, variant === 1 ? .4 : -.35, 0]} position={[0, -1.2, 0]}><mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}><meshStandardMaterial vertexColors roughness={.95} envMapIntensity={.25}/></mesh><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .03, 0]}><planeGeometry args={[22, 22]}/><meshPhysicalMaterial color="#447b6e" metalness={.4} roughness={.15} clearcoat={1} envMapIntensity={.4}/></mesh></group>;
}
function Car() {
    const ref = useRef<THREE.Group>(null);
    const body = useMemo(() => {
        const positions: number[] = [], indices: number[] = [];
        const steps = 64, rings = 40;
        for (let i = 0; i <= rings; i++) {
            const x = i / rings * 5.5 - 2.75, t = i / rings;
            const width = .68 + Math.sin(t * Math.PI) * .45, height = .18 + Math.sin(t * Math.PI) * .16;
            for (let j = 0; j <= steps; j++) {
                const a = j / steps * Math.PI * 2;
                positions.push(x, Math.sin(a) * height + .05 + Math.sin(t * Math.PI) * .04, Math.cos(a) * width);
            }
        }
        for (let i = 0; i < rings; i++)
            for (let j = 0; j < steps; j++) {
                const a = i * (steps + 1) + j, b = a + steps + 1;
                indices.push(a, b, a + 1, a + 1, b, b + 1);
            }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        g.setIndex(indices);
        g.computeVertexNormals();
        return g;
    }, []);
    useEffect(() => () => body.dispose(), [body]);
    useMotionFrame(({ clock }) => { if (ref.current)
        ref.current.rotation.y = Math.sin(clock.elapsedTime * .2) * .3 - .5; });
    return <group ref={ref} position={[0, -.5, 0]} rotation={[.18, -.5, 0]}>
  <mesh geometry={body}><meshPhysicalMaterial color="#d74b32" metalness={.7} roughness={.22} clearcoat={1}/></mesh>
  <mesh position={[-.35, .17, 0]} scale={[1.5, .82, .89]}><sphereGeometry args={[1, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]}/><meshPhysicalMaterial color="#171e27" metalness={.6} roughness={.1} clearcoat={1}/></mesh>
  <mesh position={[-.55, .8, 0]} scale={[.82, .17, .88]}><sphereGeometry args={[1, 48, 20]}/><meshPhysicalMaterial color="#d74b32" metalness={.7} roughness={.22} clearcoat={1}/></mesh>
  <Box scale={[4.5, .16, 1.97]} position={[0, -.18, 0]} color="#222128" radius={.06}/>
  {[-1.65, 1.65].flatMap(x => [-1.02, 1.02].map(z => <group key={`${x}${z}`} position={[x, -.28, z]}>
   <mesh><torusGeometry args={[.4, .14, 20, 60]}/><meshStandardMaterial color="#101114" roughness={.85}/></mesh>
   <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.31, .31, .11, 48]}/><meshStandardMaterial color="#34363c" metalness={1} roughness={.25}/></mesh>
   {Array.from({ length: 10 }, (_, i) => <Box key={i} scale={[.045, .58, .025]} position={[0, 0, Math.sign(z) * .07]} rotation={[0, 0, i / 10 * Math.PI]} color="#adb2b7" radius={.01}/>)}
   <mesh position={[0, 0, Math.sign(z) * .09]}><circleGeometry args={[.1, 24]}/><meshStandardMaterial color="#20252a" metalness={.8}/></mesh>
  </group>))}
  {[-.63, .63].map(z => <mesh key={z} position={[2.57, .25, z]} rotation={[0, Math.PI / 2 - .2, 0]}><circleGeometry args={[.16, 40]}/><meshBasicMaterial color="#faf1d9"/></mesh>)}
  <Box scale={[.04, .04, 1.6]} position={[-2.67, .12, 0]} color="#f23c2c" radius={.015}/>
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.85, 0]}><planeGeometry args={[40, 40]}/><meshStandardMaterial color="#10121c" roughness={.22} metalness={.6}/></mesh>
  {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[-8 + i * 2.3, 2, -5]} rotation={[0, 0, -.2]}><boxGeometry args={[.03, 8, .03]}/><meshBasicMaterial color={i % 2 ? '#f69f52' : '#e8462e'}/></mesh>)}
  <pointLight position={[0, 2, -4]} intensity={40} color="#ff6a25"/>
 </group>;
}
function Ribbon({ color }: {
    color: string;
}) {
    const ref = useRef<THREE.Mesh>(null);
    useMotionFrame(({ clock }) => { if (ref.current) {
        ref.current.rotation.x = clock.elapsedTime * .08;
        ref.current.rotation.z = clock.elapsedTime * .12;
    } });
    return <mesh ref={ref} rotation={[.3, .5, 0]}><torusKnotGeometry args={[1.75, .53, 230, 32, 2, 3]}/><meshPhysicalMaterial color={color} metalness={.3} roughness={.2} clearcoat={1}/></mesh>;
}
function Space({ fusion }: {
    fusion: boolean;
}) {
    const ref = useRef<THREE.Group>(null);
    useMotionFrame(({ clock }) => { if (ref.current)
        ref.current.rotation.y = clock.elapsedTime * .08; });
    return <group ref={ref}>
  <mesh position={[fusion ? -1 : 0, 0, 0]}><sphereGeometry args={[1.5, 64, 48]}/><meshPhysicalMaterial color={fusion ? '#ecc5aa' : '#b6a5ea'} metalness={.6} roughness={.25} clearcoat={1}/></mesh>
  {[0, 1, 2].map(i => <mesh key={i} rotation={[.8 + i * .7, .4 + i * .4, .5]}><torusGeometry args={[2.3 + i * .3, .025, 10, 140]}/><meshStandardMaterial color={fusion ? '#f3dec9' : '#cab7f2'} metalness={.65}/></mesh>)}
  <mesh position={[2, 1.1, 1]}><icosahedronGeometry args={[.65, 1]}/><meshPhysicalMaterial color="#ffe1a3" metalness={.3} roughness={.2}/></mesh><Dust color="#d3c6ff"/>
 </group>;
}
function Train() {
    const ref = useRef<THREE.Group>(null);
    useMotionFrame(({ clock }) => { if (ref.current) {
        const t = clock.elapsedTime * .25;
        ref.current.position.set(Math.sin(t) * 3.13, -.35, Math.cos(t) * 2.25);
        ref.current.rotation.y = Math.atan2(Math.sin(t) * 2.25, Math.cos(t) * 3.13);
    } });
    return <group rotation={[.38, -.45, 0]} position={[0, -.8, 0]}>
  <Box scale={[9, .5, 7]} position={[0, -1.15, 0]} color="#97bba0" radius={.3}/>
  {[2, 2.5].map(r => <mesh key={r} rotation={[Math.PI / 2, 0, 0]} position={[0, -.83, 0]} scale={[1.4, 1, 1]}><torusGeometry args={[r, .045, 8, 100]}/><meshStandardMaterial color="#514736"/></mesh>)}
  {Array.from({ length: 38 }, (_, i) => <Box key={i} scale={[.1, .1, .8]} position={[Math.sin(i / 38 * Math.PI * 2) * 3.13, -.85, Math.cos(i / 38 * Math.PI * 2) * 2.25]} rotation={[0, i / 38 * Math.PI * 2, 0]} color="#6b5741" radius={.01}/>)}
  <group ref={ref}>
   <Box scale={[1.5, .55, .7]} color="#e95832"/>
   <Box scale={[.6, .65, .75]} position={[-.45, .5, 0]} color="#e8af54"/>
   <Box scale={[.8, .12, .95]} position={[-.45, .86, 0]} color="#304d49"/>
   <mesh position={[.4, .4, 0]}><cylinderGeometry args={[.12, .14, .8, 20]}/><meshStandardMaterial color="#364c40"/></mesh>
   {[-.5, .5].flatMap(x => [-.4, .4].map(z => <mesh key={`${x}${z}`} position={[x, -.3, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.23, .23, .12, 20]}/><meshStandardMaterial color="#2e4640"/></mesh>))}
  </group>
  {[-1, 1].map((x, i) => <group key={x} position={[x * 3, -.7, i ? 2.4 : -1.7]}><mesh position={[0, .6, 0]}><coneGeometry args={[.6, 1.7, 12]}/><meshStandardMaterial color="#305f40"/></mesh><mesh><cylinderGeometry args={[.08, .1, .5, 8]}/><meshStandardMaterial color="#6f5842"/></mesh></group>)}
 </group>;
}
function Portal({ color, variant }: {
    color: string;
    variant: number;
}) {
    const ref = useRef<THREE.Group>(null);
    useMotionFrame(({ clock, pointer }) => { if (ref.current) {
        ref.current.rotation.z = Math.sin(clock.elapsedTime * .12) * .12;
        ref.current.position.x = pointer.x * .15;
    } });
    return <group ref={ref} rotation={[.12, .25, 0]}>
  {Array.from({ length: 18 }, (_, i) => <mesh key={i} position={[0, 0, -i * .5 + 2]} rotation={[0, 0, i * .025 + variant * .1]}><torusGeometry args={[2.6 - i * .06, .08, 8, 4]}/><meshStandardMaterial color={i % 3 === 0 ? '#232546' : color} metalness={.6} roughness={.3}/></mesh>)}
  <pointLight position={[0, 0, -3]} intensity={30} color="#4141ff"/>
 </group>;
}
function Globe() {
    const ref = useRef<THREE.Points>(null);
    const positions = useMemo(() => {
        const rand = seeded(64), p = [];
        for (let i = 0; i < 12000; i++) {
            const y = 1 - 2 * i / 12000, angle = i * 2.399963, x = Math.cos(angle) * Math.sqrt(1 - y * y), z = Math.sin(angle) * Math.sqrt(1 - y * y);
            const lat = Math.asin(y), lon = Math.atan2(z, x);
            const land = Math.sin(lon * 3 + Math.cos(lat * 4)) + Math.cos(lon * 5 - lat * 3) + Math.sin(lat * 8);
            if (land > .15 || rand() > .96)
                p.push(x * 2.45, y * 2.45, z * 2.45);
        }
        return new Float32Array(p);
    }, []);
    useMotionFrame(({ clock }) => { if (ref.current)
        ref.current.rotation.y = clock.elapsedTime * .08; });
    return <group rotation={[.2, 0, -.15]}>
  <mesh><sphereGeometry args={[2.38, 64, 48]}/><meshStandardMaterial color="#15253c" roughness={.3} metalness={.3}/></mesh>
  <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]}/></bufferGeometry><pointsMaterial color="#b4dcff" size={.026} sizeAttenuation/></points>
  {[0, 1, 2, 3].map(i => <mesh key={i} rotation={[Math.PI / 2 + i * .4, .3 + i, 0]}><torusGeometry args={[2.7 + i * .12, .009, 6, 160, 4]}/><meshBasicMaterial color="#678edb"/></mesh>)}
 </group>;
}
function Labs() {
    const ref = useRef<THREE.Group>(null);
    useMotionFrame(({ clock }) => { if (ref.current)
        ref.current.rotation.y = clock.elapsedTime * .1; });
    return <group ref={ref} rotation={[.5, 0, .2]}>{Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[0, (i - 3) * .52, 0]} rotation={[Math.PI / 2, 0, i * .23]}><torusGeometry args={[1.5 + Math.sin(i) * .25, .23, 24, 90]}/><meshPhysicalMaterial color={i % 2 ? '#8282d1' : '#e3e3fa'} metalness={.85} roughness={.14} clearcoat={1}/></mesh>)}</group>;
}
function Book() {
    const ref = useRef<THREE.Group>(null);
    useMotionFrame(({ clock }) => { if (ref.current)
        ref.current.rotation.y = Math.sin(clock.elapsedTime * .3) * .13; });
    return <group ref={ref} rotation={[.55, -.3, 0]} position={[0, -.5, 0]}>
  <Box scale={[5.5, .18, 3.8]} color="#694b3c"/>
  {[-1, 1].map(x => <group key={x} position={[x * 1.35, .18, 0]} rotation={[0, 0, -x * .07]}><Box scale={[2.62, .23, 3.55]} color="#f1dfb5" radius={.02}/>{Array.from({ length: 9 }, (_, i) => <Box key={i} scale={[2, .006, .01]} color="#c8b789" position={[0, .13, -1.2 + i * .3]} radius={.001}/>)}</group>)}
  <group position={[.7, .45, 0]}><Box scale={[.9, 1.1, .9]} position={[0, .5, 0]} color="#e1b889"/><mesh position={[0, 1.4, 0]} rotation={[0, .8, 0]}><coneGeometry args={[.85, .8, 4]}/><meshStandardMaterial color="#a85d48"/></mesh><Box scale={[.23, .5, .03]} position={[0, .2, .47]} color="#664a35" radius={.01}/></group>
  <mesh position={[-1, 1.3, -.7]}><sphereGeometry args={[.43, 20, 20]}/><meshStandardMaterial color="#b89d60"/></mesh><mesh position={[-1, .6, -.7]}><cylinderGeometry args={[.06, .1, 1, 8]}/><meshStandardMaterial color="#705039"/></mesh>
 </group>;
}
function Soda() {
    const ref = useRef<THREE.Group>(null);
    useMotionFrame(({ clock }) => { if (ref.current)
        ref.current.rotation.y = clock.elapsedTime * .15; });
    const profile = useMemo(() => [[0, -2], [.55, -2], [.62, -1.8], [.58, -.5], [.49, .1], [.32, .7], [.24, 1.4], [.25, 1.7], [0, 1.7]].map(([x, y]) => new THREE.Vector2(x, y)), []);
    return <group rotation={[.15, 0, -.18]}>
  <group ref={ref}><mesh><latheGeometry args={[profile, 64]}/><meshPhysicalMaterial color="#421d17" roughness={.17} metalness={.4} clearcoat={1}/></mesh><mesh position={[0, -.5, 0]}><cylinderGeometry args={[.584, .6, .9, 64]}/><meshStandardMaterial color="#e73523" roughness={.35}/></mesh><mesh position={[0, 1.72, 0]}><cylinderGeometry args={[.28, .28, .12, 32]}/><meshStandardMaterial color="#ee3225" metalness={.8} roughness={.3}/></mesh></group><Dust color="#ffe9cb" bubbles/>
 </group>;
}
function Fashion() {
    const ref = useRef<THREE.Group>(null), cloth = useRef<THREE.Mesh>(null), legs = useRef<THREE.Group>(null);
    const geometry = useMemo(() => {
        const g = new THREE.CylinderGeometry(.3, .92, 1.8, 90, 45, true), a = g.attributes.position;
        for (let i = 0; i < a.count; i++) {
            const x = a.getX(i), y = a.getY(i), z = a.getZ(i), theta = Math.atan2(z, x), ripple = 1 + Math.sin(theta * 13) * .08 * (1 - y);
            a.setXYZ(i, x * ripple, y, z * ripple);
        }
        g.computeVertexNormals();
        return g;
    }, []);
    useEffect(() => () => geometry.dispose(), [geometry]);
    useMotionFrame(({ clock }) => { const t = clock.elapsedTime; if (ref.current)
        ref.current.position.y = Math.cos(t * 3) * .025; if (cloth.current) {
        cloth.current.rotation.z = Math.sin(t * 1.5) * .05;
        cloth.current.rotation.y = Math.sin(t) * .04;
    } if (legs.current)
        legs.current.children.forEach((child, i) => child.rotation.x = Math.sin(t * 2.5 + i * Math.PI) * .3); });
    return <group rotation={[0, -.3, 0]}><group ref={ref} position={[0, .1, 0]}>
  <mesh position={[0, 2, 0]} scale={[.27, .36, .28]}><sphereGeometry args={[1, 32, 24]}/><meshStandardMaterial color="#c2a48f" roughness={.7}/></mesh>
  <mesh position={[0, 1.35, 0]} scale={[.4, .55, .25]}><sphereGeometry args={[1, 32, 24]}/><meshPhysicalMaterial color="#e3a4b9" roughness={.5} sheen={1} sheenColor="#f8ebf0"/></mesh>
  <mesh ref={cloth} geometry={geometry} position={[0, -.05, 0]}><meshPhysicalMaterial color="#e3a4b9" side={THREE.DoubleSide} roughness={.42} metalness={.1} sheen={1} sheenColor="#f8ebf0"/></mesh>
  {[-1, 1].map(x => <mesh key={x} position={[x * .46, .84, 0]} rotation={[0, 0, x * .12]}><capsuleGeometry args={[.09, .9, 4, 16]}/><meshStandardMaterial color="#c2a48f" roughness={.7}/></mesh>)}
  <group ref={legs} position={[0, -.55, 0]}>{[-1, 1].map(x => <group key={x} position={[x * .2, 0, 0]}><mesh position={[0, -.7, 0]}><capsuleGeometry args={[.11, 1.2, 4, 16]}/><meshStandardMaterial color="#c2a48f" roughness={.6}/></mesh><Box scale={[.25, .18, .5]} position={[0, -1.4, .12]} color="#474251" radius={.07}/></group>)}</group>
 </group><Box scale={[2.8, .2, 25]} position={[0, -2.1, -5]} color="#d6dbe1"/><mesh position={[0, -2.3, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[40, 40]}/><meshStandardMaterial color="#afbdc4" roughness={.4}/></mesh></group>;
}
function Screw() {
    return <group rotation={[.1, -.3, 0]}><fog attach="fog" args={['#121b20', 5, 18]}/>{Array.from({ length: 12 }, (_, i) => <group key={i} position={[0, 0, -i * 1.5 + 2]}><Box scale={[.2, 5, .2]} position={[-2.1, 0, 0]} color="#536369"/><Box scale={[.2, 5, .2]} position={[2.1, 0, 0]} color="#536369"/><mesh position={[0, 2.4, 0]}><torusGeometry args={[2.1, .13, 8, 50, Math.PI]}/><meshStandardMaterial color="#536369"/></mesh></group>)}<mesh position={[0, -2.5, -4]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[5, 30]}/><meshStandardMaterial color="#34444a" roughness={.3} metalness={.5}/></mesh><pointLight position={[0, 0, -5]} color="#b4ded4" intensity={25}/></group>;
}
function Bear() {
    const ref = useRef<THREE.Group>(null);
    useMotionFrame(({ clock }) => { if (ref.current)
        ref.current.rotation.z = Math.sin(clock.elapsedTime * .8) * .045; });
    return <group rotation={[.1, -.2, 0]} position={[0, -.3, 0]}>
  <group ref={ref}>{[[0, -.4, 0, .95, 1.15, .7], [0, 1.05, 0, .85, .8, .75], [-.65, 1.65, 0, .33, .36, .25], [.65, 1.65, 0, .33, .36, .25], [-1, -.3, 0, .35, .75, .35], [1, -.3, 0, .35, .75, .35], [-.55, -1.4, .2, .4, .5, .5], [.55, -1.4, .2, .4, .5, .5]].map(([x, y, z, sx, sy, sz], i) => <mesh key={i} position={[x, y, z]} scale={[sx, sy, sz]}><sphereGeometry args={[1, 28, 20]}/><meshStandardMaterial color="#ae8050" roughness={1}/></mesh>)}<mesh position={[0, .85, .7]} scale={[.43, .32, .2]}><sphereGeometry args={[1, 24, 16]}/><meshStandardMaterial color="#d5b080"/></mesh>{[-.27, .27].map(x => <mesh key={x} position={[x, 1.18, .7]}><sphereGeometry args={[.067, 16, 12]}/><meshStandardMaterial color="#211b15"/></mesh>)}<mesh position={[0, .96, .9]}><sphereGeometry args={[.1, 16, 12]}/><meshStandardMaterial color="#2c2118"/></mesh></group>
  <Box scale={[1.3, 1.2, 1.3]} color="#bc4c3b" position={[2, -1.3, 0]}/><Box scale={[.15, 1.24, 1.33]} color="#eed6a1" position={[2, -1.3, 0]} radius={.01}/>
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}><planeGeometry args={[40, 40]}/><meshStandardMaterial color="#e9cd9b"/></mesh>
 </group>;
}
function Dust({ color, bubbles = false }: {
    color: string;
    bubbles?: boolean;
}) {
    const ref = useRef<THREE.Points>(null);
    const p = useMemo(() => { const rand = seeded(53); return new Float32Array(Array.from({ length: bubbles ? 240 : 900 }, () => (rand() - .5) * 12)); }, [bubbles]);
    useMotionFrame(({ clock }) => { if (ref.current) {
        ref.current.rotation.y = clock.elapsedTime * .025;
        ref.current.position.y = Math.sin(clock.elapsedTime * .1) * .2;
    } });
    return <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[p, 3]}/></bufferGeometry><pointsMaterial color={color} size={bubbles ? .09 : .026} transparent opacity={.6} depthWrite={false} sizeAttenuation/></points>;
}

const confettiVertex=`uniform float uTime;uniform vec2 uMouse;uniform float uRatio;attribute float aSeed;varying float vSeed;void main(){vec3 p=position;float wave=sin(p.x*.9+uTime*.5)*.14+sin(p.x*2.3-uTime*.3)*.06;p.y+=wave;vec2 d=p.xy-uMouse*vec2(8.,4.);p.xy+=normalize(d+.001)*exp(-dot(d,d)*.8)*.35;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(4.+aSeed*5.)*uRatio;vSeed=aSeed;}`;
const confettiFragment=`uniform float uTime;varying float vSeed;void main(){vec2 uv=gl_PointCoord*2.-1.;float a=vSeed*6.28+uTime*(vSeed-.5)*.2;uv=mat2(cos(a),-sin(a),sin(a),cos(a))*uv;float kind=floor(vSeed*4.);bool visible=false;if(kind<1.)visible=dot(uv,uv)<.48;else if(kind<2.)visible=max(abs(uv.x),abs(uv.y))<.65;else if(kind<3.)visible=uv.y>-.6&&uv.y<.7&&abs(uv.x)<(.7-uv.y)*.6;else visible=(abs(uv.x)<.14&&abs(uv.y)<.7)||(abs(uv.y)<.14&&abs(uv.x)<.7);if(!visible)discard;gl_FragColor=vec4(vec3(.92+vSeed*.08),1.);}`;
function Confetti(){
 const ratio=useThree(state=>state.gl.getPixelRatio());
 const [positions,seeds]=useMemo(()=>{
  const random=seeded(784),count=6500,positions=new Float32Array(count*3),seeds=new Float32Array(count);
  for(let i=0;i<count;i++){positions.set([(random()-.5)*19,-.45-random()*5,(random()-.5)*1.5],i*3);seeds[i]=random();}
  return [positions,seeds];
 },[]);
 const uniforms=useMemo(()=>({uTime:{value:0},uMouse:{value:new THREE.Vector2()},uRatio:{value:ratio}}),[ratio]);
 useMotionFrame(({clock,pointer})=>{uniforms.uTime.value=clock.elapsedTime;uniforms.uMouse.value.lerp(pointer,.06);});
 return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/><bufferAttribute attach="attributes-aSeed" args={[seeds,1]}/></bufferGeometry><shaderMaterial vertexShader={confettiVertex} fragmentShader={confettiFragment} uniforms={uniforms}/></points>;
}
