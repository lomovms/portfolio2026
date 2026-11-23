import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import * as THREE from 'three';
import { assetPath } from './assetPath';

const textureCache = new Map<string, Promise<THREE.Texture[]>>();
let renderer: THREE.WebGLRenderer | undefined, stopCurrent: (() => void) | undefined;
const scene = new THREE.Scene(), camera = new THREE.Camera();
const uniforms = {
    image: { value: null as THREE.Texture | null }, depthMap: { value: null as THREE.Texture | null },
    offset: { value: new THREE.Vector2() }, focus: { value: new THREE.Vector2() },
    cover: { value: new THREE.Vector2(1, 1) }, resolution: { value: new THREE.Vector2() }, strength: { value: 0 },
    background: { value: new THREE.Color() }, zoom: { value: 1.10 },
    depthStrength: { value: 1 }, invertDepth: { value: false }, focusEnabled: { value: true },
};
const material = new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform sampler2D image;uniform sampler2D depthMap;uniform vec2 offset;uniform vec2 focus;
        uniform vec2 cover;uniform vec2 resolution;uniform float strength;uniform vec3 background;uniform float zoom;
        uniform float depthStrength;uniform bool invertDepth;uniform bool focusEnabled;varying vec2 vUv;
        vec2 safeUv(vec2 uv){return clamp(uv,vec2(.001),vec2(.999));}
        vec2 frame(vec2 uv){return (uv-.5)*cover/zoom+.5;}
        vec2 warp(vec2 uv,float d){
            float displacement=invertDepth ? .5-d : d-.35;
            return safeUv(uv+offset*vec2(.030,.022)*displacement*strength*depthStrength);
        }
        vec2 traceDepth(vec2 uv){
            float travel=depthStrength*.045;
            vec2 shift=offset*travel;
            if(dot(shift,shift)<1e-10) return uv;
            vec2 margin=vec2(travel+.004);
            // Match the playground: trace from near to far and use the first visible surface.
            for(int i=0;i<48;i++){
                float plane=1.-float(i)/48.;
                vec2 candidate=clamp(uv-shift*pow(plane,1.2),margin,1.-margin);
                float d=textureLod(depthMap,candidate,0.).r;
                if((invertDepth ? 1.-d : d)>=plane) return candidate;
            }
            return uv;
        }
        vec3 colorAt(vec2 uv){vec4 texel=texture2D(image,uv);return mix(background,texel.rgb,texel.a);}
        void main(){
            vec2 uv=frame(vUv);
            if(!focusEnabled){
                gl_FragColor=vec4(colorAt(traceDepth(uv)),1.);
            } else {
            float d=texture2D(depthMap,uv).r;
            vec2 colorUv=warp(uv,d);
            vec3 color=colorAt(colorUv);float weight=1.;
              float focalDepth=texture2D(depthMap,frame(focus*.5+.5)).r;
              float radius=clamp((abs(d-focalDepth)-.012)*55.,0.,7.)*strength;
              for(int i=0;i<12;i++){float n=float(i)+.5;float angle=n*2.399963;
                vec2 disk=vec2(cos(angle),sin(angle))*sqrt(n/12.);
                vec2 sampleUv=safeUv(uv+disk*radius/resolution*cover/zoom);
                float sampleDepth=texture2D(depthMap,sampleUv).r;
                float w=1.-smoothstep(.015,.07,sampleDepth-d);
                color+=colorAt(warp(sampleUv,sampleDepth))*w;weight+=w;
              }
            gl_FragColor=vec4(color/weight,1.);
            }
            #include <colorspace_fragment>
        }` });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
quad.frustumCulled = false; scene.add(quad);

// A single small renderer moves between hovered cards; their ordinary images stay underneath.
function loadTextures(slug: string, portfolio: boolean) {
    let textures = textureCache.get(slug);
    if (!textures) {
        const loader = new THREE.TextureLoader();
        const depthUrl = `${assetPath(`assets/cards/${slug}-depth.png`)}${portfolio ? '?playground=1' : ''}`;
        textures = Promise.all([loader.loadAsync(assetPath(`assets/cards/${slug}.webp`)), loader.loadAsync(depthUrl)]).catch(error => {
            textureCache.delete(slug); throw error;
        });
        textureCache.set(slug, textures);
    }
    return textures;
}

const portfolioParallax = { depthStrength: .57, smoothness: .35, invertDepth: true };
function preview(surface: HTMLDivElement, slug: string, background: string, pointer: THREE.Vector2, hovering: { current: boolean }, portfolio: boolean, wake: { current: (() => void) | null }, onReplaced: () => void) {
    stopCurrent?.();
    try { renderer ??= new THREE.WebGLRenderer({ alpha: true, antialias: false }); } catch { return () => {}; }
    const gl = renderer, canvas = gl.domElement;
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '1', visibility: 'hidden' });
    canvas.setAttribute('aria-hidden', 'true'); surface.appendChild(canvas);
    let stopped = false, animation = 0, previous = performance.now();
    const resize = () => {
        const width = surface.clientWidth, height = surface.clientHeight;
        gl.setPixelRatio(portfolio ? 1 : Math.min(window.devicePixelRatio, 1.5));
        gl.setSize(Math.max(1, width), Math.max(1, height), false);
        const aspect = width / Math.max(1, height), imageAspect = 1000 / 650;
        uniforms.cover.value.set(Math.min(1, aspect / imageAspect), Math.min(1, imageAspect / aspect));
        uniforms.resolution.value.set(Math.max(1, width), Math.max(1, height));
        wake.current?.();
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(surface);
    const stop = () => {
        if (stopped) return; stopped = true; cancelAnimationFrame(animation); observer.disconnect();
        wake.current = null;
        if (canvas.parentElement === surface) canvas.remove();
        if (stopCurrent === release) stopCurrent = undefined;
    };
    const release = () => { stop(); onReplaced(); };
    stopCurrent = release;
    void loadTextures(slug, portfolio).then(([image, depth]) => {
        if (stopped) return;
        image.colorSpace = THREE.SRGBColorSpace; image.needsUpdate = true;
        if (portfolio) {
            image.minFilter = THREE.LinearFilter;
            depth.minFilter = THREE.LinearFilter;
        }
        uniforms.image.value = image; uniforms.depthMap.value = depth;
        uniforms.background.value.set(background);
        uniforms.zoom.value = portfolio ? 1.075 : 1.10;
        uniforms.depthStrength.value = portfolio ? (slug === 'barbershop_batya' ? .23 : portfolioParallax.depthStrength) : 1;
        uniforms.invertDepth.value = portfolio && portfolioParallax.invertDepth;
        uniforms.focusEnabled.value = !portfolio;
        uniforms.offset.value.set(0, 0); uniforms.focus.value.set(0, 0); uniforms.strength.value = portfolio ? 1 : 0;
        while (textureCache.size > 4) {
            const oldest = textureCache.keys().next().value!;
            if (oldest === slug) { const pair = textureCache.get(oldest)!; textureCache.delete(oldest); textureCache.set(oldest, pair); continue; }
            void textureCache.get(oldest)!.then(pair => pair.forEach(texture => texture.dispose())).catch(() => {});
            textureCache.delete(oldest);
        }
        const schedule = () => {
            if (!stopped && !animation) animation = requestAnimationFrame(draw);
        };
        const draw = (now: number) => {
            animation = 0;
            if (stopped) return;
            const dt = Math.min((now - previous) / 1000, .06); previous = now;
            const follow = 1 - Math.exp(-(portfolio ? portfolioParallax.smoothness : 1) * 12 * dt);
            uniforms.offset.value.lerp(pointer, follow);
            if (!portfolio) {
                uniforms.focus.value.lerp(pointer, 1 - Math.exp(-dt * 6));
                uniforms.strength.value = THREE.MathUtils.damp(uniforms.strength.value, hovering.current ? 1 : 0, 10, dt);
            }
            gl.render(scene, camera); canvas.style.visibility = 'visible';
            if (!portfolio || uniforms.offset.value.distanceToSquared(pointer) > .000004) schedule();
        };
        wake.current = schedule;
        schedule();
    }).catch(stop);
    return stop;
}

export function DepthPreview({ slug, background, portfolio = false }: { slug: string; background: string; portfolio?: boolean }) {
    const surface = useRef<HTMLDivElement>(null), pointer = useRef(new THREE.Vector2()), hovering = useRef(false);
    const wake = useRef<(() => void) | null>(null);
    const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [active, setActive] = useState(false), [visible, setVisible] = useState(false);
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            setVisible(entry.isIntersecting); if (!entry.isIntersecting) { hovering.current = false; setActive(false); }
        });
        if (surface.current) observer.observe(surface.current);
        return () => { observer.disconnect(); clearTimeout(timeout.current); };
    }, []);
    useEffect(() => {
        if (active && visible && surface.current) {
            return preview(surface.current, slug, background, pointer.current, hovering, portfolio, wake, () => setActive(false));
        }
    }, [active, visible, slug, background, portfolio]);
    useEffect(() => {
        if (portfolio && !window.matchMedia('(pointer: coarse), (prefers-reduced-motion: reduce)').matches) {
            void loadTextures(slug, true).catch(() => {});
        }
    }, [portfolio, slug]);
    const move = (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        clearTimeout(timeout.current);
        hovering.current = true;
        setActive(true);
        const rect = event.currentTarget.getBoundingClientRect();
        pointer.current.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
        wake.current?.();
    };
    const leave = () => { hovering.current = false; pointer.current.set(0, 0); wake.current?.(); clearTimeout(timeout.current); timeout.current = setTimeout(() => setActive(false), portfolio ? 1350 : 650); };
    return <div ref={surface} className="depth-preview" onPointerEnter={move} onPointerMove={move} onPointerLeave={leave} onPointerCancel={leave}>
        <img src={assetPath(`assets/cards/${slug}.webp`)} alt="" draggable={false} loading="lazy" decoding="async" width="1000" height="650" style={{ background, transform: portfolio ? 'scale(1.075)' : undefined }}/>
    </div>;
}
