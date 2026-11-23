import { useMemo, useRef, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { projects } from './data';
import type { SceneKind } from './data';
import { CardBakeWorld } from './Scenes';

const stills = new URLSearchParams(location.search).has('stills');
const automatic = new URLSearchParams(location.search).has('auto');
const sectionFrames: [string, SceneKind, string, string, number][] = [
    ['hero', 'connectors', '#1616ef', '#15161c', 0],
    ['about', 'particles', '#1616ef', '#090c10', 0],
    ['team-0', 'human', '#b7bac4', '#17191e', 0],
    ['team-1', 'human', '#b7bac4', '#17191e', 1],
    ['contact', 'confetti', '#1616ef', '#2026f6', 0],
];
const framesToBake = stills ? [
    ...sectionFrames.map(([slug, scene, color, background, variant]) => ({ slug, scene, color, background, variant, title: slug })),
    ...projects.flatMap(project => [1, 2, 3].map(variant => ({ ...project, slug: project.slug + '-' + variant, variant }))),
] : projects.map(project => ({ ...project, variant: 0 }));

type Images = Record<string, { image: string; depth?: string }>;
function Capture({ done }: { done: (image: string, depth?: string) => void }) {
    const frames = useRef(0), finished = useRef(false);
    const advance = useThree(state => state.advance);
    useEffect(() => {
        if (!automatic) return;
        const timer = setInterval(() => { if (!finished.current) advance(performance.now()); }, 50);
        return () => clearInterval(timer);
    }, [advance]);
    const depth = useMemo(() => {
        const material = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking });
        material.onBeforeCompile = shader => {
            shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', 'gl_PointSize = 5.;\n#include <project_vertex>');
            shader.fragmentShader = shader.fragmentShader.replace('vec3( 1.0 - fragCoordZ )', 'vec3( clamp((18. + perspectiveDepthToViewZ(fragCoordZ, .05, 100.)) / 16., 0., 1.) )');
        };
        return material;
    }, []);
    useEffect(() => () => depth.dispose(), [depth]);
    useFrame(({ gl, scene, camera }) => {
        if (finished.current) return;
        gl.render(scene, camera);
        if (++frames.current < (stills ? 2 : 6)) return;
        const image = gl.domElement.toDataURL('image/webp', .88);
        if (stills) { finished.current = true; done(image); return; }
        const background = scene.background, override = scene.overrideMaterial;
        scene.background = new THREE.Color('black'); scene.overrideMaterial = depth;
        gl.render(scene, camera);
        const map = gl.domElement.toDataURL('image/png');
        scene.background = background; scene.overrideMaterial = override;
        gl.render(scene, camera); finished.current = true; done(image, map);
    }, 1);
    return null;
}
function Bake() {
    const [index, setIndex] = useState(automatic ? 0 : -1), [url, setUrl] = useState('');
    const images = useRef<Images>({}), project = framesToBake[index], count = framesToBake.length;
    const done = (image: string, depth?: string) => {
        images.current[project.slug] = { image, depth };
        if (index + 1 < count) setIndex(index + 1);
        else {
            if (!automatic) setUrl(URL.createObjectURL(new Blob([JSON.stringify(images.current)], { type: 'application/json' })));
            setIndex(-2);
        }
    };
    return <><h1>Изображения и карты глубины наших сцен</h1>
        <p role="status">{index === -1 ? `Готов к подготовке: ${count}` : index === -2 ? `Готово: ${count}` : `${index + 1}/${count} — ${project.title}`}</p>
        {index === -1 && <button onClick={() => setIndex(0)}>Подготовить превью</button>}
        {url && <a href={url} download={stills ? 'portfolio-stills.json' : 'card-textures.json'}>Скачать ресурсы</a>}
        {automatic && index === -2 && <script id="baked-assets" type="application/json">{JSON.stringify(images.current)}</script>}
        <div style={{ width: 1000, height: 650, maxWidth: '100%' }}><Canvas dpr={1} shadows frameloop={automatic ? 'never' : 'always'} gl={{ antialias: true, preserveDrawingBuffer: true }}>
            {project && <group key={project.slug}><CardBakeWorld project={project} variant={project.variant}/><Capture done={done}/></group>}
        </Canvas></div></>;
}
createRoot(document.getElementById('root')!).render(<Bake/>);
