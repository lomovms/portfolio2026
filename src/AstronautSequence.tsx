import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject, RefObject, ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { Environment, PerspectiveCamera, View, useTexture } from '@react-three/drei';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AstronautBufferLoader, AstronautModel } from './AstronautModel';
import type { AstronautMotion } from './AstronautModel';
import type { AstronautBuffer } from './astronautBuffer';
import { GlassBreak } from './GlassBreak';
import { seeded } from './procedural';
import { advanceFlight, astronautChoreography, createFlight, orbitFlight, scrollFlight } from './astronautFlight';
import type { Flight } from './astronautFlight';
import { assetPath } from './assetPath';
import { AstronautAudio } from './astronautAudio';
import { useSound } from './Sound';
import { AstronautAfterimages, FlightOptics } from './AstronautEffects';
import './astronaut.css';

gsap.registerPlugin(ScrollTrigger);
const smooth = (start: number, end: number, value: number) => THREE.MathUtils.smoothstep(value, start, end);

class AssetBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch() { this.props.onError(); }
    render() { return this.state.failed ? null : this.props.children; }
}

export default function AstronautSequence({ standalone = false, inspectionProgress }: { standalone?: boolean; inspectionProgress?: number }) {
    const section = useRef<HTMLElement>(null), device = useRef<HTMLDivElement>(null), screen = useRef<HTMLDivElement>(null);
    const motion = useRef<AstronautMotion>({ progress: 0, time: 0, frame: 0, speed: 1 });
    const flight = useRef(createFlight()), updatePresentation = useRef<() => void>(() => {});
    const paused = useRef(inspectionProgress !== undefined), [stopped, setStopped] = useState(inspectionProgress !== undefined);
    const audio = useRef<AstronautAudio | null>(null), [audioError, setAudioError] = useState(false);
    const { enabled, toggle, context } = useSound();
    const previousPointer = useRef<{ x: number; y: number; time: number } | null>(null);
    const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
    const [visible, setVisible] = useState(false), [ready, setReady] = useState(false);
    const [assetError, setAssetError] = useState(false);
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '300px' });
        if (section.current) observer.observe(section.current);
        const release = () => { previousPointer.current = null; if (document.hidden) audio.current?.update(motion.current.progress, 1, false); };
        window.addEventListener('pointercancel', release);
        window.addEventListener('blur', release);
        document.addEventListener('visibilitychange', release);
        return () => { observer.disconnect(); window.removeEventListener('pointercancel', release); window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', release); };
    }, []);
    useEffect(() => {
        if (enabled && context.current && !audio.current) audio.current = new AstronautAudio(context.current, () => setAudioError(true));
    }, [enabled, context]);
    useEffect(() => () => { audio.current?.dispose(); audio.current = null; }, []);
    const orbit = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (paused.current || reduced || document.hidden) { previousPointer.current = null; return; }
        const rect = event.currentTarget.getBoundingClientRect(), radius = Math.min(rect.width, rect.height) / 2;
        if (radius <= 0) return;
        const x = (event.clientX - rect.left - rect.width / 2) / radius, y = (rect.top + rect.height / 2 - event.clientY) / radius;
        const previous = previousPointer.current;
        if (previous) orbitFlight(flight.current, previous.x, previous.y, x, y, (event.timeStamp - previous.time) / 1000);
        previousPointer.current = { x, y, time: event.timeStamp };
    };
    useLayoutEffect(() => {
        if (inspectionProgress !== undefined) {
            motion.current.progress = inspectionProgress; motion.current.time = inspectionProgress * 60;
            flight.current.progress = inspectionProgress; paused.current = true; setStopped(true);
        }
        const ctx = gsap.context(() => {
            const mobile = window.matchMedia('(max-width: 700px)');
            let lastProgress = -1;
            const update = () => {
                const p = motion.current.progress;
                const expand = smooth(.035, .18, p) * (1 - smooth(.86, .94, p));
                section.current?.classList.toggle('astro-immersed', p > .16 && p < .91 && flight.current.scroll > 0 && flight.current.scroll < 1);
                if (Math.abs(lastProgress - p) < .000001) return;
                lastProgress = p;
                const w = window.innerWidth, h = window.innerHeight;
                const width = mobile.matches ? w * .9 : w * .46;
                const height = width / 1.385;
                const top = mobile.matches ? h * .22 : h * .21;
                const deviceLeft = THREE.MathUtils.lerp(w * .05, -26, expand), deviceTop = THREE.MathUtils.lerp(top, -26, expand);
                const deviceWidth = THREE.MathUtils.lerp(width, w + 52, expand), deviceHeight = THREE.MathUtils.lerp(height, h + 52, expand);
                gsap.set(device.current, {
                    left: deviceLeft, top: deviceTop, width: deviceWidth, height: deviceHeight,
                    borderRadius: THREE.MathUtils.lerp(36, 0, expand),
                    '--screen-radius': `${THREE.MathUtils.lerp(19, 0, expand)}px`,
                    boxShadow: `0 7px ${48 * (1 - expand)}px rgba(0,0,0,${.24 * (1 - expand)})`,
                });
                gsap.set('.astro-heading,.astro-copy', { opacity: 1 - smooth(.025, .105, p), y: -expand * 110 });
                // The shared WebGL canvas sits below DOM decoration; cut out the device.
                gsap.set('.astro-scribble', { opacity: 1 - smooth(.025, .105, p), y: 0,
                    clipPath: `polygon(evenodd,0px 0px,${w}px 0px,${w}px ${h}px,0px ${h}px,0px 0px,${deviceLeft}px ${deviceTop}px,${deviceLeft}px ${deviceTop + deviceHeight}px,${deviceLeft + deviceWidth}px ${deviceTop + deviceHeight}px,${deviceLeft + deviceWidth}px ${deviceTop}px,${deviceLeft}px ${deviceTop}px)`,
                });
                gsap.set('.astro-hint', { autoAlpha: smooth(.18, .24, p) * (1 - smooth(.92, 1, p)) });
                gsap.set('.astro-finale', { autoAlpha: smooth(.88, .96, p), y: 40 * (1 - smooth(.88, .96, p)) });
                section.current?.setAttribute('data-progress', p.toFixed(4));
            };
            updatePresentation.current = update;
            const onScroll = (progress: number) => {
                if (inspectionProgress !== undefined) { flight.current.scroll = .4; update(); return; }
                scrollFlight(flight.current, progress, reduced);
                motion.current.progress = flight.current.progress;
                update();
            };
            const trigger = ScrollTrigger.create({
                trigger: section.current, start: 'top top', end: 'bottom bottom',
                onUpdate: self => onScroll(self.progress),
                onRefresh: self => { lastProgress = -1; onScroll(self.progress); },
            });
            update();
            return () => trigger.kill();
        }, section);
        const resize = () => ScrollTrigger.refresh();
        window.addEventListener('resize', resize);
        return () => { ctx.revert(); window.removeEventListener('resize', resize); };
    }, [inspectionProgress]);
    return <section ref={section} id="astronaut" className={`astronaut-sequence ${standalone ? 'astro-standalone' : ''}`} aria-label="Космическое путешествие астронавта">
        <div className="astro-sticky">
            <div className="astro-scribble" aria-hidden="true"><svg viewBox="0 0 1280 720" fill="none"><path d="M310 -95C680 130 1000 -50 820 -110C720 -150 510 -100 620 -25C850 100 1070 -50 1010 50C750 330 875 425 1370 285" stroke="#83f6f4" strokeWidth="25"/></svg></div>
            <h2 className="astro-heading">Полёт</h2>
            <div className="astro-copy"><p>Интерактивный этюд для браузера. Прокрутите страницу, чтобы приблизить планшет и запустить полёт.</p><p>В этой сцене я собрал камеру, свет, эффекты и управление движением в одну последовательность.</p></div>
            <div className="astro-device" ref={device}>
                <i className="astro-device-camera" aria-hidden="true"/>
                <div className="astro-screen" ref={screen} onPointerMove={orbit} onPointerLeave={() => { previousPointer.current = null; }}>
                    <View className="astro-view" visible={visible} aria-hidden="true">
                        {visible && <AssetBoundary onError={() => setAssetError(true)}><Suspense fallback={null}><AstronautWorld motion={motion} flight={flight} paused={paused} audio={audio} soundEnabled={enabled} updatePresentation={updatePresentation} surface={screen} onReady={() => setReady(true)}/></Suspense></AssetBoundary>}
                    </View>
                    {(!ready || assetError) && <div className="astro-loading" role="status">{assetError ? 'Не удалось загрузить 3D-сцену. Перезагрузите страницу.' : <>ЗАГРУЖАЕМ СКАФАНДР<span>◌</span></>}</div>}
                </div>
            </div>
            <View className="astro-exit-view" visible={visible} index={2} aria-hidden="true">
                {visible && <AssetBoundary onError={() => setAssetError(true)}><Suspense fallback={null}><AstronautExit motion={motion}/></Suspense></AssetBoundary>}
            </View>
            <div className="astro-hint"><span>ПОЛЁТ ПРОДОЛЖАЕТСЯ АВТОМАТИЧЕСКИ<br/>ВЕДИТЕ КУРСОР ПО КРУГУ, ЧТОБЫ УСКОРИТЬСЯ</span><div className="astro-controls"><button className="astro-sound" onClick={toggle} aria-label={enabled ? 'Выключить звук полёта' : 'Включить звук полёта'} aria-pressed={enabled}>{enabled ? 'ЗВУК ВКЛ.' : 'ЗВУК ВЫКЛ.'}</button><button onClick={() => { paused.current = !paused.current; setStopped(paused.current); }} aria-label={stopped ? 'Продолжить анимацию астронавта' : 'Приостановить анимацию астронавта'}>{stopped ? '▶' : 'Ⅱ'}</button></div></div>
            {audioError && <p className="astro-audio-error" role="status">Не удалось загрузить звук. Перезагрузите страницу.</p>}
            <div className="astro-finale"><small>ЗА ПРЕДЕЛАМИ ПРИВЫЧНОГО</small><h2>Воображение<br/>не знает границ.</h2><a href="#contact">Обсудить проект ↗</a><button onClick={() => { Object.assign(flight.current, createFlight(), { scroll: flight.current.scroll, started: true, progress: .19 }); paused.current = false; setStopped(false); }}>Повторить полёт ↻</button></div>
            {standalone && <a className="astro-back" href={assetPath('')}>← НА ГЛАВНУЮ</a>}
            <a className="astro-skip" href="#contact">Пропустить полёт ↓</a>
        </div>
    </section>;
}

export function AstronautReview() {
    const [progress, setProgress] = useState(.77);
    const stages: [string, number][] = [['Первый туннель', .45], ['Спираль', .59], ['Синий коридор', .675], ['Падение и шлейф', .77], ['Удар', .848], ['Прыжок наружу', .87], ['Приветствие', .99]];
    return <div className="astro-review"><div className="astro-review-controls" aria-label="Проверка фаз анимации">
        {stages.map(([name, value]) => <button key={name} onClick={() => setProgress(value)} aria-pressed={progress === value}>{name}</button>)}
        <label>Фаза <input aria-label="Фаза анимации" type="range" min="0" max="1" step=".001" value={progress} onChange={event => setProgress(Number(event.target.value))}/>{progress.toFixed(3)}</label>
        <a href={assetPath('astronaut/')}>Автоматический полёт ↗</a>
    </div><AstronautSequence standalone inspectionProgress={progress}/></div>;
}

function AstronautWorld({ motion, flight, paused, audio, soundEnabled, updatePresentation, surface, onReady }: {
    motion: MutableRefObject<AstronautMotion>; flight: MutableRefObject<Flight>; paused: MutableRefObject<boolean>;
    audio: MutableRefObject<AstronautAudio | null>; soundEnabled: boolean; updatePresentation: MutableRefObject<() => void>; onReady: () => void;
    surface: RefObject<HTMLDivElement | null>;
}) {
    const figure = useRef<THREE.Group>(null), earthMesh = useRef<THREE.Mesh>(null), corridor = useRef<THREE.Group>(null);
    const { gl } = useThree();
    const [entryTrack, exitTrack] = useLoader(AstronautBufferLoader, [assetPath('assets/astronaut/astronaut_in_animation.buf'), assetPath('assets/astronaut/astronaut_out_animation.buf')]);
    const qa = useMemo(() => new THREE.Quaternion(), []), qb = useMemo(() => new THREE.Quaternion(), []);
    const basePosition = useMemo(() => new THREE.Vector3(), []), baseRotation = useMemo(() => new THREE.Quaternion(), []);
    const applyTrack = (track: AstronautBuffer, progress: number, weight: number) => {
        basePosition.copy(figure.current!.position); baseRotation.copy(figure.current!.quaternion);
        const frame = THREE.MathUtils.clamp(progress, 0, 1) * (track.vertexCount - 1), a = Math.floor(frame), b = Math.min(a + 1, track.vertexCount - 1), mix = frame - a;
        const positions = track.attributes.position.array, rotations = track.attributes.orient.array;
        qa.fromArray(rotations, a * 4).normalize(); qb.fromArray(rotations, b * 4).normalize();
        figure.current!.quaternion.copy(qa).slerp(qb, mix);
        figure.current!.position.set(
            THREE.MathUtils.lerp(positions[a * 3], positions[b * 3], mix) * 1.45,
            THREE.MathUtils.lerp(positions[a * 3 + 1], positions[b * 3 + 1], mix) * 1.45,
            (THREE.MathUtils.lerp(positions[a * 3 + 2], positions[b * 3 + 2], mix) - 23) * .6,
        );
        figure.current!.position.lerp(basePosition, 1 - weight);
        figure.current!.quaternion.slerp(baseRotation, 1 - weight);
    };
    const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
    const earth = useTexture(assetPath('assets/astronaut/earth_landscape.jpg'));
    const [environment, setEnvironment] = useState<THREE.WebGLRenderTarget | null>(null);
    useEffect(() => {
        const room = new RoomEnvironment(), generator = new THREE.PMREMGenerator(gl);
        const target = generator.fromScene(room, .04);
        room.dispose(); generator.dispose(); setEnvironment(target);
        return () => target.dispose();
    }, [gl]);
    useEffect(() => { onReady(); gl.domElement.dataset.ready = 'true'; }, []);
    useEffect(() => () => { audio.current?.update(motion.current.progress, 1, false); }, [audio, motion]);
    useFrame(({ camera, pointer }, delta) => {
        const playing = !paused.current && !document.hidden && flight.current.scroll > 0 && flight.current.scroll < 1;
        if (playing && !reduced) {
            motion.current.speed = advanceFlight(flight.current, delta);
            motion.current.progress = flight.current.progress;
        }
        if (!paused.current && !reduced && !document.hidden) motion.current.time += Math.min(delta, .25) * motion.current.speed;
        const p = motion.current.progress;
        audio.current?.update(p, motion.current.speed, playing && soundEnabled);
        updatePresentation.current();
        const t = motion.current.time;
        const choreography = astronautChoreography(p, t);
        motion.current.frame = choreography.frame;
        figure.current!.visible = !choreography.outside;
        const departure = smooth(.19, .34, p);
        figure.current!.position.set(Math.sin(p * 15) * departure * .35, -1.08 * (1 - departure) + Math.sin(t * .45) * .035, -6 * departure);
        figure.current!.scale.setScalar(1.45 - departure * .45);
        figure.current!.rotation.set(Math.sin(p * 13) * departure * .25, departure * (Math.PI * 2 * smooth(.25, .88, p)) + pointer.x * .05, Math.sin(p * 20) * departure * .22);
        if (p >= .19 && p < .34) applyTrack(entryTrack, smooth(.19, .34, p), smooth(.19, .205, p) * (1 - smooth(.325, .34, p)));
        if (p >= .72 && p < .84) {
            const returning = choreography.retreat;
            figure.current!.position.z += returning * 6.06;
            figure.current!.position.y = THREE.MathUtils.lerp(figure.current!.position.y, -.15, returning);
            figure.current!.rotation.x *= 1 - returning; figure.current!.rotation.y *= 1 - returning; figure.current!.rotation.z *= 1 - returning;
            applyTrack(exitTrack, returning, smooth(.72, .735, p) * (1 - smooth(.825, .84, p)));
        }
        if (p >= .84) {
            figure.current!.position.set(choreography.jumpX, choreography.jumpY, choreography.jumpZ);
            figure.current!.rotation.set(-Math.sin(choreography.jump * Math.PI) * .5, 0, 0);
            figure.current!.scale.setScalar(1 + choreography.settle * .12);
        }
        const roll = flight.current.roll * departure * (1 - smooth(.72, .835, p));
        figure.current!.rotation.z += roll;
        earthMesh.current!.visible = p < .35;
        earthMesh.current!.position.set(0, -1.8 - departure * 8, -8 - departure * 25);
        earthMesh.current!.scale.setScalar(1 + departure * 3);
        corridor.current!.visible = p > .275 && p < .88;
        corridor.current!.rotation.z = Math.sin(p * 12) * .28 * departure + roll * .22;
        corridor.current!.position.z = choreography.corridorZ;
        camera.position.z = choreography.cameraZ;
        camera.position.x = pointer.x * .06 * departure;
        const shock = Math.sin((p - .835) * 5500) * Math.exp(-Math.max(0, p - .835) * 150) * (p > .835 && p < .87 ? .04 : 0);
        camera.position.y = pointer.y * .035 * departure + shock;
        camera.rotation.z = Math.sin(p * 14) * .04 * departure + Math.sin(choreography.retreat * Math.PI) * .32;
    }, -1);
    return <>
        <color attach="background" args={['#000302']}/>
        <PerspectiveCamera makeDefault position={[0, 0, 2.7]} fov={42} near={.05} far={300}/>
        {environment && <Environment map={environment.texture} environmentIntensity={.5}/>}
        <ambientLight intensity={.3} color="#c9deec"/>
        <directionalLight position={[-3, 4, 4]} intensity={3.1} color="#e0f5ff"/>
        <directionalLight position={[2, -2, -4]} intensity={2.2} color="#8acde8"/>
        <pointLight position={[0, 2, -8]} intensity={35} distance={15} color="#a6ffee"/>
        <mesh ref={earthMesh} position={[0, -.5, -8]} renderOrder={-1}>
            <planeGeometry args={[20.5, 10.25]}/><meshBasicMaterial map={earth} toneMapped={false}/>
        </mesh>
        <StarField motion={motion}/>
        <group ref={corridor}><SpaceCorridor motion={motion}/><SpiralTunnel motion={motion}/><BlueCorridor motion={motion}/></group>
        <group ref={figure}><AstronautModel motion={motion}/></group>
        <AstronautAfterimages subject={figure} motion={motion}/>
        <GlassBreak motion={motion}/>
        <LensHalo motion={motion}/>
        <FlightOptics motion={motion} surface={surface}/>
    </>;
}

function AstronautExit({ motion }: { motion: MutableRefObject<AstronautMotion> }) {
    const figure = useRef<THREE.Group>(null), gl = useThree(state => state.gl);
    const environment = useMemo(() => {
        const room = new RoomEnvironment(), generator = new THREE.PMREMGenerator(gl), target = generator.fromScene(room, .04);
        room.dispose(); generator.dispose(); return target;
    }, [gl]);
    useEffect(() => () => environment.dispose(), [environment]);
    useFrame(({ camera, size }) => {
        const p = motion.current.progress, pose = astronautChoreography(p, motion.current.time);
        figure.current!.visible = pose.outside;
        if (!pose.outside) return;
        const jumpArc = Math.sin(pose.jump * Math.PI);
        const mobile = size.width / size.height < .7;
        camera.position.set(0, 0, pose.cameraZ + (mobile ? pose.settle * 1.4 : 0)); camera.rotation.set(0, 0, 0);
        figure.current!.position.set(mobile ? 0 : pose.jumpX, pose.jumpY, pose.jumpZ);
        figure.current!.rotation.set(-jumpArc * .5, jumpArc * .16, jumpArc * -.12);
        figure.current!.scale.setScalar(1 + pose.settle * .12);
    });
    useFrame(() => { if (astronautChoreography(motion.current.progress, motion.current.time).outside) gl.clearDepth(); }, 1.5);
    return <><PerspectiveCamera makeDefault position={[0, 0, 2.7]} fov={42} near={.05} far={100}/>
        <Environment map={environment.texture} environmentIntensity={.5}/><ambientLight intensity={.4}/>
        <directionalLight position={[-3, 4, 4]} intensity={3} color="#e0f5ff"/>
        <directionalLight position={[2, -2, -4]} intensity={1.5} color="#8acde8"/>
        <group ref={figure} visible={false}><AstronautModel motion={motion}/></group></>;
}

function BlueCorridor({ motion }: { motion: MutableRefObject<AstronautMotion> }) {
    const group = useRef<THREE.Group>(null), arches = useRef<THREE.InstancedMesh>(null), pillars = useRef<THREE.InstancedMesh>(null);
    useLayoutEffect(() => {
        const object = new THREE.Object3D();
        for (let i = 0; i < 32; i++) {
            object.position.set(0, .65, -12 - i * 6.5); object.scale.set(1, 1, 1); object.updateMatrix(); arches.current!.setMatrixAt(i, object.matrix);
            for (let side = 0; side < 2; side++) {
                object.position.set((side ? 1 : -1) * 2.9, -1.65, -12 - i * 6.5); object.scale.set(.32, 4.6, .5); object.updateMatrix(); pillars.current!.setMatrixAt(i * 2 + side, object.matrix);
            }
        }
        arches.current!.instanceMatrix.needsUpdate = true; pillars.current!.instanceMatrix.needsUpdate = true;
    }, []);
    useFrame(() => { group.current!.visible = motion.current.progress >= .63 && motion.current.progress < .72; });
    return <group ref={group}>
        <mesh position={[0, 0, -100]}><boxGeometry args={[7.8, 7.8, 220]}/><shaderMaterial side={THREE.BackSide}
            vertexShader="varying vec3 p;varying vec3 n;varying float depth;void main(){p=position;n=normal;vec4 mv=modelViewMatrix*vec4(position,1.);depth=-mv.z;gl_Position=projectionMatrix*mv;}"
            fragmentShader={`varying vec3 p;varying vec3 n;varying float depth;void main(){vec2 uv=abs(n.y)>.5?p.xz:abs(n.x)>.5?p.yz:p.xy;
                vec2 tile=fract(uv/4.)*2.-1.;float ring=1.-smoothstep(.10,.14,abs(length(tile-vec2(.25,-.15))-.63));
                vec3 color=mix(vec3(.025,.045,.72),vec3(.72,.74,.86),ring);color*=exp(-max(depth,0.)*.005);
                gl_FragColor=vec4(color,1.);
                #include <colorspace_fragment>
            }`}/></mesh>
        <instancedMesh ref={arches} args={[undefined, undefined, 32]} frustumCulled={false}><torusGeometry args={[2.9, .16, 8, 36, Math.PI]}/><meshBasicMaterial color="#e9efff"/></instancedMesh>
        <instancedMesh ref={pillars} args={[undefined, undefined, 64]} frustumCulled={false}><boxGeometry/><meshStandardMaterial color="#abbcff" emissive="#5a7dff" emissiveIntensity={1.3} roughness={.2}/></instancedMesh>
    </group>;
}

function SpaceCorridor({ motion }: { motion: MutableRefObject<AstronautMotion> }) {
    const tunnel = useRef<THREE.Mesh>(null);
    const material = useMemo(() => new THREE.ShaderMaterial({
        depthWrite: false, uniforms: { uTime: { value: 0 }, uProgress: { value: 0 }, uRetreat: { value: 0 } },
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `varying vec2 vUv;uniform float uTime;uniform float uProgress;uniform float uRetreat;
            float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
            float grid(vec2 p,float scale){vec2 f=abs(fract(p*scale)-.5);return min(f.x,f.y);}
            void main(){
                vec2 screen=(vUv-.5)*2.;
                vec3 ray=normalize(vec3(screen.x*1.77778*.384,screen.y*.384,-1.));
                float side=max(abs(ray.x),abs(ray.y));
                float wall=3.82/max(side,.0001);
                float t=min(wall,88.);
                vec3 p=ray*t;float wallHit=step(wall,88.);
                vec2 face=abs(ray.x)>abs(ray.y)?p.zy:p.xz;
                float travel=uProgress*180.-uRetreat*94.;
                face.y+=travel;
                vec2 cell=fract(face*.5)-.5;
                vec2 id=floor(face*.5);
                float nested=min(grid(face,1.),min(grid(face,2.)*.62,grid(face,4.)*.34));
                float rails=1.-smoothstep(.018,.055,nested);
                float ring=1.-smoothstep(.025,.09,abs(fract((face.y+travel*.25)/3.2)-.5));
                float panelHash=hash(id+floor((face.y+travel*.25)/3.2)*13.);
                float panel=max(0.,step(.77,panelHash))*step(abs(cell.x),.42)*step(abs(cell.y),.38);
                float pixels=step(.965,hash(floor(face*vec2(12.,7.))+floor(uTime*3.)));
                float edge=exp(-abs(p.x)*.18-abs(p.y)*.18);
                vec3 teal=vec3(.02,.83,.78),red=vec3(1.,.16,.075),blue=vec3(.16,.45,.62);
                float sideMix=smoothstep(-3.,3.,p.x)*.65+.15*sin(p.y*.3+uTime*.2);
                vec3 neon=mix(teal,red,clamp(sideMix,0.,1.));
                vec3 color=vec3(.003,.009,.012)+blue*(rails*.15+ring*.08);
                color+=neon*(panel*.38+rails*.1+pixels*.22);
                color+=mix(teal,vec3(1.,.42,.12),panelHash)*panel*panelHash*1.7;
                color+=vec3(.2,.75,.68)*ring*.55;
                color*=wallHit*(.32+edge*.68)*exp(-t*.0035);
                color+=neon*panel*exp(-abs(p.x)*.28-abs(p.y)*.28)*.22;
                float centerFade=smoothstep(.02,.45,side);
                color*=centerFade;
                float vignette=1.-smoothstep(.52,1.05,length(screen*vec2(.82,1.)));
                gl_FragColor=vec4(color*(.35+vignette*.65),1.);
                #include <colorspace_fragment>
            }`
    }), []);
    useEffect(() => () => material.dispose(), [material]);
    useFrame(({ camera }) => {
        if (!tunnel.current) return;
        const p = motion.current.progress, pose = astronautChoreography(p, motion.current.time);
        const visible = p < .54 || p >= .72;
        tunnel.current.visible = visible;
        if (!visible) return;
        const direction = camera.getWorldDirection(new THREE.Vector3());
        tunnel.current.position.copy(camera.position).addScaledVector(direction, 145);
        tunnel.current.quaternion.copy(camera.quaternion);
        const distance = 145, halfHeight = distance * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2));
        tunnel.current.scale.set(halfHeight * (camera as THREE.PerspectiveCamera).aspect, halfHeight, 1);
        material.uniforms.uTime.value = motion.current.time;
        material.uniforms.uProgress.value = p;
        material.uniforms.uRetreat.value = pose.retreat;
    });
    return <mesh ref={tunnel} renderOrder={-10} frustumCulled={false}>
        <planeGeometry args={[2, 2]}/><primitive object={material} attach="material"/>
    </mesh>;
}

function SpiralTunnel({ motion }: { motion: MutableRefObject<AstronautMotion> }) {
    const group = useRef<THREE.Group>(null), beams = useRef<THREE.InstancedMesh>(null);
    const structure = useMemo(() => {
        const random = seeded(281), matrices: THREE.Matrix4[] = [], colors: THREE.Color[] = [];
        const spots: number[] = [], spotColors: number[] = [], object = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
        const palette = ['#ff95f4', '#c9fcff', '#ffb7df', '#7df2ff'].map(color => new THREE.Color(color));
        const point = (ring: number, side: number) => {
            const angle = side / 8 * Math.PI * 2 + ring * .19;
            return new THREE.Vector3(Math.cos(angle) * 3.9, Math.sin(angle) * 3.9, -75 - ring * 2.6);
        };
        const bar = (a: THREE.Vector3, b: THREE.Vector3, color: THREE.Color, width = .045) => {
            object.position.copy(a).lerp(b, .5); object.scale.set(width, a.distanceTo(b), width);
            object.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize()); object.updateMatrix();
            matrices.push(object.matrix.clone()); colors.push(color);
        };
        for (let ring = 0; ring < 48; ring++) for (let side = 0; side < 8; side++) {
            const a = point(ring, side), b = point(ring, side + 1), color = palette[(ring + side) % palette.length];
            bar(a, b, color); bar(a, point(ring + 1, side), color);
            if (ring % 2 === 0) bar(a, point(ring + 1, side + 1), palette[(side + 1) % palette.length], .025);
            for (let panel = 0; panel < 2; panel++) {
                const c = a.clone().lerp(b, random()); c.z += random() * .4;
                const d = c.clone().add(new THREE.Vector3(random() * .3, random() * .3, .15 + random() * .5));
                bar(c, d, color, .06 + random() * .08);
            }
            if ((side + ring) % 3 === 0) { spots.push(a.x, a.y, a.z); spotColors.push(color.r, color.g, color.b); }
        }
        const lights = new THREE.BufferGeometry(); lights.setAttribute('position', new THREE.Float32BufferAttribute(spots, 3)); lights.setAttribute('color', new THREE.Float32BufferAttribute(spotColors, 3));
        return { matrices, colors, lights };
    }, []);
    useLayoutEffect(() => {
        structure.matrices.forEach((matrix, i) => { beams.current!.setMatrixAt(i, matrix); beams.current!.setColorAt(i, structure.colors[i]); });
        beams.current!.instanceMatrix.needsUpdate = true;
        beams.current!.instanceColor!.needsUpdate = true;
    }, [structure]);
    useFrame(() => { group.current!.visible = motion.current.progress > .53 && motion.current.progress < .64; group.current!.rotation.z = motion.current.progress * -5; });
    useEffect(() => () => structure.lights.dispose(), [structure]);
    return <group ref={group}>
        <instancedMesh ref={beams} args={[undefined, undefined, structure.matrices.length]} frustumCulled={false}>
            <boxGeometry/><meshStandardMaterial color="white" metalness={.7} roughness={.18} emissive="#dc93bd" emissiveIntensity={.3} envMapIntensity={1.8}/>
        </instancedMesh>
        <points geometry={structure.lights} frustumCulled={false}>
            <shaderMaterial transparent depthWrite={false} vertexColors blending={THREE.AdditiveBlending}
                vertexShader="varying vec3 lightColor;void main(){lightColor=color;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(1600.0/-p.z,1.0,180.0);}"
                fragmentShader="varying vec3 lightColor;void main(){float d=length(gl_PointCoord-.5);float glow=exp(-d*d*35.0)*.45+exp(-d*d*400.0);gl_FragColor=vec4(lightColor*glow,glow*.8);}"/>
        </points>
    </group>;
}

function StarField({ motion }: { motion: MutableRefObject<AstronautMotion> }) {
    const geometry = useMemo(() => {
        const random = seeded(282), positions = new Float32Array(2600 * 3), seeds = new Float32Array(2600);
        for (let i = 0; i < seeds.length; i++) {
            positions.set([(random() - .5) * 90, (random() - .5) * 60, random() * 130], i * 3); seeds[i] = random();
        }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1)); return geo;
    }, []);
    const uniforms = useMemo(() => ({ travel: { value: 0 }, visibility: { value: 0 }, speed: { value: 0 } }), []);
    useFrame(() => { const p = motion.current.progress; uniforms.travel.value = p * 180 + motion.current.time * .2; uniforms.visibility.value = smooth(.18, .32, p) * (1 - smooth(.88, .96, p)); uniforms.speed.value = smooth(.3, .5, p); });
    useEffect(() => () => geometry.dispose(), [geometry]);
    return <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={uniforms} vertexShader={`
            attribute float seed; uniform float travel; uniform float speed; varying float intensity;
            void main(){vec3 p=position;p.z=mod(p.z+travel,130.0)-120.0;
                vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;
                gl_PointSize=clamp((1.0+seed*2.0)*15.0/-mv.z,0.6,3.0);intensity=(.2+seed*.8)*smoothstep(0.0,10.0,-mv.z);}
        `} fragmentShader={`uniform float visibility; varying float intensity;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.08,d)*intensity*visibility;gl_FragColor=vec4(.76,.88,1.0,a);}`}/>
    </points>;
}

function LensHalo({ motion }: { motion: MutableRefObject<AstronautMotion> }) {
    const uniforms = useMemo(() => ({ amount: { value: 0 }, aspect: { value: 1 } }), []);
    useFrame(({ size }) => { uniforms.amount.value = smooth(.22, .35, motion.current.progress) * (1 - smooth(.85, .95, motion.current.progress)); uniforms.aspect.value = size.width / size.height; });
    return <mesh position={[0, 0, 2.5]} frustumCulled={false} renderOrder={10}>
        <planeGeometry args={[2, 2]}/><shaderMaterial uniforms={uniforms} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending}
            vertexShader="varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.0,1.0);}"
            fragmentShader={`varying vec2 uvScreen;uniform float amount;uniform float aspect;
                void main(){vec2 p=(uvScreen-.5)*vec2(aspect,1.0);float r=length(p);float ring=exp(-pow((r-.49)*29.0,2.0));
                vec3 rainbow=.5+.5*cos(6.2831*(r*9.0+vec3(0.0,.32,.65)));float arc=.22+.78*pow(abs(p.x+p.y),2.0);
                gl_FragColor=vec4(rainbow*ring*arc*.09,amount);}`}/>
    </mesh>;
}


