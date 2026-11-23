import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AstronautModel } from './AstronautModel';
import type { AstronautMotion } from './AstronautModel';
import { astronautChoreography } from './astronautFlight';

export function AstronautAfterimages({ subject, motion }: { subject: RefObject<THREE.Group | null>; motion: MutableRefObject<AstronautMotion> }) {
    const group = useRef<THREE.Group>(null), cursor = useRef(0);
    const history = useMemo(() => Array.from({ length: 80 }, () => ({ time: -100, position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(), frame: 0 })), []);
    const poses = useMemo(() => Array.from({ length: 4 }, () => ({ current: { progress: 0, time: 0, frame: 0, speed: 1 } })), []);
    useFrame(() => {
        if (!subject.current || !group.current) return;
        const sample = history[cursor.current++ % history.length], { progress, time, frame } = motion.current;
        sample.time = time; sample.frame = frame;
        sample.position.copy(subject.current.position); sample.quaternion.copy(subject.current.quaternion); sample.scale.copy(subject.current.scale);
        const amount = astronautChoreography(progress, time).echoes;
        group.current.visible = amount > .001;
        if (!group.current.visible) return;
        group.current.children.forEach((echo, i) => {
            const target = time - (i + 1) * .18;
            let nearest = sample;
            for (const record of history) if (Math.abs(record.time - target) < Math.abs(nearest.time - target)) nearest = record;
            echo.position.copy(nearest.position);
            echo.position.x += Math.sin(time * 1.7 + i) * (i + 1) * .42;
            echo.position.y += Math.cos(time * 1.4 + i) * (i + 1) * .32;
            echo.position.z -= (i + 1) * .35;
            echo.quaternion.copy(nearest.quaternion); echo.scale.copy(nearest.scale);
            poses[i].current.frame = nearest.frame;
            echo.traverse(object => { if (object instanceof THREE.Mesh) (object.material as THREE.MeshBasicMaterial).opacity = amount * (.16 - i * .025); });
        });
    });
    return <group ref={group} visible={false}>{poses.map((pose, i) => <group key={i}><AstronautModel motion={pose} ghost/></group>)}</group>;
}

export function FlightOptics({ motion, surface }: { motion: MutableRefObject<AstronautMotion>; surface: RefObject<HTMLDivElement | null> }) {
    const { gl, size } = useThree();
    const target = useMemo(() => new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true }), []);
    const scratch = useMemo(() => ({ viewport: new THREE.Vector4(), scissor: new THREE.Vector4(), color: new THREE.Color() }), []);
    const uniforms = useMemo(() => ({ image: { value: target.texture }, amount: { value: 0 }, aspect: { value: 1 }, time: { value: 0 } }), [target]);
    useEffect(() => {
        const ratio = Math.min(gl.getPixelRatio(), 1.3) * .75;
        target.setSize(Math.max(1, Math.round(gl.domElement.clientWidth * ratio)), Math.max(1, Math.round(gl.domElement.clientHeight * ratio)));
    }, [gl, size.width, size.height, target]);
    const post = useMemo(() => {
        const scene = new THREE.Scene(), camera = new THREE.Camera();
        const material = new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false, toneMapped: false,
            vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
            fragmentShader: `uniform sampler2D image;uniform float amount;uniform float aspect;uniform float time;varying vec2 vUv;
                void main(){vec2 radial=vUv-.5;float edge=smoothstep(.05,.7,length(radial*vec2(aspect,1.)));
                    vec2 shift=radial*(.006+edge*.010)*amount;
                    vec3 color=vec3(texture2D(image,clamp(vUv+shift,0.,1.)).r,texture2D(image,vUv).g,texture2D(image,clamp(vUv-shift,0.,1.)).b);
                    vec3 streak=vec3(0.);for(int i=1;i<=4;i++){float f=float(i);streak+=texture2D(image,clamp(.5+radial*(1.+f*.009*amount),0.,1.)).rgb*.25;}
                    color=mix(color,streak,.18*amount*edge);color*=mix(vec3(1.),vec3(.62,1.15,.85),amount*.65);
                    float fringe=sin(length(radial*vec2(aspect,1.))*30.+time*.4)*.5+.5;
                    color+=amount*pow(edge,6.)*.012*vec3(fringe,.4,1.-fringe);
                    gl_FragColor=vec4(color,1.);
                    #include <colorspace_fragment>
                }` });
        const geometry = new THREE.PlaneGeometry(2, 2), quad = new THREE.Mesh(geometry, material); quad.frustumCulled = false; scene.add(quad);
        return { scene, camera, geometry, material };
    }, [uniforms]);
    useEffect(() => () => { target.dispose(); post.geometry.dispose(); post.material.dispose(); }, [target, post]);
    // Run after skeleton updates and before Drei View's render, preserving the shared renderer's scissor state.
    useFrame(({ scene, camera }) => {
        const { progress, time, speed } = motion.current;
        const falling = astronautChoreography(progress, time).echoes;
        const boost = progress > .3 && progress < .82 ? Math.min((speed - 1) * .12, .3) : 0;
        const amount = Math.max(falling, boost) * (1 - THREE.MathUtils.smoothstep(progress, .785, .80));
        uniforms.amount.value = amount;
        if (amount < .001) return;
        const oldTarget = gl.getRenderTarget(), autoClear = gl.autoClear, scissorTest = gl.getScissorTest(), alpha = gl.getClearAlpha();
        gl.getViewport(scratch.viewport); gl.getScissor(scratch.scissor); gl.getClearColor(scratch.color);
        gl.setRenderTarget(target); gl.setScissorTest(false); gl.setViewport(0, 0, target.width, target.height);
        gl.autoClear = true; gl.render(scene, camera);
        gl.setRenderTarget(oldTarget); gl.setViewport(scratch.viewport); gl.setScissor(scratch.scissor); gl.setScissorTest(scissorTest);
        gl.setClearColor(scratch.color, alpha); gl.autoClear = autoClear;
        uniforms.aspect.value = gl.domElement.clientWidth / gl.domElement.clientHeight; uniforms.time.value = time;
    }, .5);
    useFrame(() => {
        if (uniforms.amount.value < .001) return;
        const rect = surface.current?.getBoundingClientRect();
        if (!rect || rect.bottom <= 0 || rect.top >= gl.domElement.clientHeight) return;
        const autoClear = gl.autoClear, scissorTest = gl.getScissorTest();
        gl.getViewport(scratch.viewport); gl.getScissor(scratch.scissor);
        const bottom = gl.domElement.clientHeight - rect.bottom;
        gl.setViewport(rect.left, bottom, rect.width, rect.height); gl.setScissor(rect.left, bottom, rect.width, rect.height);
        gl.autoClear = false; gl.setScissorTest(true); gl.render(post.scene, post.camera);
        gl.setViewport(scratch.viewport); gl.setScissor(scratch.scissor);
        gl.autoClear = autoClear; gl.setScissorTest(scissorTest);
    }, 1.25);
    return null;
}
