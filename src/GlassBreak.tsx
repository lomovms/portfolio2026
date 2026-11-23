import { useEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { assetPath } from './assetPath';
import { AstronautBufferLoader } from './AstronautModel';
import type { AstronautMotion } from './AstronautModel';

export function GlassBreak({ motion }: { motion: MutableRefObject<AstronautMotion> }) {
    const [data, animation] = useLoader(AstronautBufferLoader, [assetPath('assets/astronaut/broken_glass.buf'), assetPath('assets/astronaut/broken_glass_animation.buf')]);
    const glass = useMemo(() => {
        const group = new THREE.Group(), geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(data.attributes.position.array, 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(data.attributes.indices.array), 1));
        geometry.computeVertexNormals();
        const count = Math.max(...data.attributes.piece.array) + 1;
        const bones = Array.from({ length: count }, () => { const bone = new THREE.Bone(); group.add(bone); return bone; });
        const skeleton = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
        const indices = new Uint16Array(data.vertexCount * 4), weights = new Float32Array(data.vertexCount * 4);
        for (let i = 0; i < data.vertexCount; i++) { indices[i * 4] = data.attributes.piece.array[i]; weights[i * 4] = 1; }
        geometry.setAttribute('skinIndex', new THREE.BufferAttribute(indices, 4));
        geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4));
        // Shade the shards in one pass, without rendering the scene again for refraction.
        const material = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
            uniforms: { burst: { value: 0 } },
            vertexShader: `
                #include <common>
                #include <skinning_pars_vertex>
                varying vec3 glassNormal;
                varying vec3 toCamera;
                void main() {
                    #include <beginnormal_vertex>
                    #include <skinbase_vertex>
                    #include <skinnormal_vertex>
                    #include <begin_vertex>
                    #include <skinning_vertex>
                    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
                    glassNormal = normalMatrix * objectNormal;
                    toCamera = -viewPosition.xyz;
                    gl_Position = projectionMatrix * viewPosition;
                }
            `,
            fragmentShader: `
                uniform float burst;
                varying vec3 glassNormal;
                varying vec3 toCamera;
                void main() {
                    vec3 normal = normalize(glassNormal);
                    vec3 view = normalize(toCamera);
                    float facing = dot(normal, view);
                    normal *= facing < 0.0 ? -1.0 : 1.0;
                    float rim = pow(1.0 - abs(facing), 3.0);
                    vec3 reflected = reflect(-view, normal);
                    float highlight = pow(max(0.0, dot(reflected, normalize(vec3(-.55, .8, .5)))), 18.0);
                    float cool = pow(max(0.0, dot(reflected, normalize(vec3(.8, -.3, .4)))), 9.0);
                    vec3 tint = mix(vec3(.22, .48, .64), vec3(.88, .98, 1.0), max(rim, highlight));
                    float alpha = .012 + burst * (.06 + rim * .44 + highlight * .55 + cool * .19);
                    gl_FragColor = vec4(tint, min(alpha, .78));
                    #include <colorspace_fragment>
                }
            `,
        });
        const mesh = new THREE.SkinnedMesh(geometry, material); mesh.bind(skeleton, new THREE.Matrix4()); mesh.frustumCulled = false; group.add(mesh);
        const cracks = new THREE.MeshBasicMaterial({ wireframe: true, color: '#d7f6ff', transparent: true, opacity: 0, depthWrite: false });
        const lines = new THREE.SkinnedMesh(geometry, cracks); lines.bind(skeleton, new THREE.Matrix4()); lines.frustumCulled = false; group.add(lines);
        group.visible = false;
        return { group, geometry, bones, skeleton, material, cracks, lines, frames: animation.vertexCount / count, previousFrame: -1 };
    }, [data, animation]);
    const qa = useMemo(() => new THREE.Quaternion(), []), qb = useMemo(() => new THREE.Quaternion(), []);
    useFrame(({ camera, size }) => {
        const p = motion.current.progress;
        glass.group.visible = p > .80 && p < .93;
        if (!glass.group.visible) return;
        const impact = THREE.MathUtils.clamp((p - .835) / .065, 0, 1);
        const frame = impact * (glass.frames - 1), first = Math.floor(frame), next = Math.min(first + 1, glass.frames - 1), mix = frame - first;
        const positions = animation.attributes.position.array, rotations = animation.attributes.orient.array;
        const perspective = camera as THREE.PerspectiveCamera;
        const height = (perspective.position.z - .52) * 2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2));
        const scale = height * Math.max(1, size.width / size.height / (16 / 9));
        glass.group.scale.setScalar(scale); glass.group.position.set(0, 0, .52);
        glass.material.uniforms.burst.value = THREE.MathUtils.smoothstep(impact, 0, .09) * (1 - THREE.MathUtils.smoothstep(p, .902, .93));
        glass.cracks.opacity = THREE.MathUtils.smoothstep(impact, 0, .08) * (1 - THREE.MathUtils.smoothstep(impact, .16, .38)) * .12;
        glass.lines.visible = glass.cracks.opacity > .001;
        if (glass.previousFrame === frame) return;
        glass.previousFrame = frame;
        for (let i = 0; i < glass.bones.length; i++) {
            const a = first * glass.bones.length + i, b = next * glass.bones.length + i;
            qa.fromArray(rotations, a * 4).normalize(); qb.fromArray(rotations, b * 4).normalize();
            glass.bones[i].quaternion.copy(qa).slerp(qb, mix);
            glass.bones[i].position.set(
                THREE.MathUtils.lerp(positions[a * 3], positions[b * 3], mix),
                THREE.MathUtils.lerp(positions[a * 3 + 1], positions[b * 3 + 1], mix),
                THREE.MathUtils.lerp(positions[a * 3 + 2], positions[b * 3 + 2], mix),
            );
        }
    });
    useEffect(() => () => { glass.geometry.dispose(); glass.skeleton.dispose(); glass.material.dispose(); glass.cracks.dispose(); }, [glass]);
    return <primitive object={glass.group} dispose={null}/>;
}
