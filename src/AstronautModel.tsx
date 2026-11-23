import { useEffect, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { MutableRefObject } from 'react';
import { astronautBones, astronautFrames, decodeAstronautBuffer } from './astronautBuffer';
import type { AstronautBuffer } from './astronautBuffer';

const assetRoot = `${import.meta.env.BASE_URL}assets/astronaut/`;
export class AstronautBufferLoader extends THREE.Loader<AstronautBuffer> {
    load(url: string, onLoad: (data: AstronautBuffer) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void) {
        const loader = new THREE.FileLoader(this.manager).setResponseType('arraybuffer');
        loader.load(url, data => {
            try { onLoad(decodeAstronautBuffer(data as ArrayBuffer)); }
            catch (error) { onError?.(error); }
        }, onProgress, onError);
    }
}
const parts = ['astronaut_helmet', 'astronaut_glove_shoes', 'astronaut_wearpack', 'astronaut_helmet_glass'];

function makeGeometry(data: AstronautBuffer) {
    const geometry = new THREE.BufferGeometry();
    for (const key of ['position', 'normal', 'uv', 'tangent']) {
        const attribute = data.attributes[key];
        geometry.setAttribute(key, new THREE.BufferAttribute(attribute.array, attribute.size));
    }
    geometry.setAttribute('uv1', geometry.getAttribute('uv'));
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(data.attributes.indices.array), 1));
    const indices = new Uint16Array(data.vertexCount * 4), weights = new Float32Array(data.vertexCount * 4);
    for (let i = 0; i < data.vertexCount; i++) {
        indices[i * 4] = data.attributes.boneIndices.array[i * 2];
        indices[i * 4 + 1] = data.attributes.boneIndices.array[i * 2 + 1];
        const a = data.attributes.boneWeights.array[i * 2], b = data.attributes.boneWeights.array[i * 2 + 1];
        weights[i * 4] = a / (a + b);
        weights[i * 4 + 1] = b / (a + b);
    }
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4));
    return geometry;
}

export interface AstronautMotion { progress: number; time: number; frame: number; speed: number }
export function AstronautModel({ motion, ghost = false }: { motion: MutableRefObject<AstronautMotion>; ghost?: boolean }) {
    const data = useLoader(AstronautBufferLoader, [...parts, 'astronaut_animations'].map(name => assetRoot + name + '.buf'));
    const textures = useTexture(parts.slice(0, 3).flatMap(name => ['base', 'arm', 'nor'].map(map => `${assetRoot}${name}_${map}.webp`)));
    const earth = useTexture(assetRoot + 'earth_landscape.jpg');
    const model = useMemo(() => {
        const group = new THREE.Group();
        const bones = Array.from({ length: astronautBones }, (_, i) => { const bone = new THREE.Bone(); bone.name = `flight_${i}`; group.add(bone); return bone; });
        // Poses are already multiplied by the inverse bind transform in the data.
        const skeleton = new THREE.Skeleton(bones, bones.map(() => new THREE.Matrix4()));
        earth.mapping = THREE.EquirectangularReflectionMapping;
        earth.colorSpace = THREE.SRGBColorSpace;
        const materials = parts.map((_, index) => {
            if (ghost) return new THREE.MeshBasicMaterial({ color: '#69ffc2', transparent: true, opacity: .13, blending: THREE.AdditiveBlending, depthWrite: false });
            if (index === 3) {
                const material = new THREE.MeshPhysicalMaterial({ color: '#172126', metalness: 1, roughness: .065, clearcoat: 1, clearcoatRoughness: .025, envMap: earth, envMapIntensity: 1.8 });
                // Independent visor shader: curved Earth reflection, Fresnel rim, sun glint.
                material.onBeforeCompile = shader => {
                    shader.uniforms.visorEarth = { value: earth };
                    shader.fragmentShader = 'uniform sampler2D visorEarth;\n' + shader.fragmentShader;
                    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
                        vec3 viewN = normalize(geometryNormal);
                        vec2 earthUV = vec2(viewN.x * .52 + .5, viewN.y * .62 + .75);
                        vec3 earthReflection = texture2D(visorEarth, clamp(earthUV, .001, .999)).rgb;
                        float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
                        float glint = pow(max(dot(viewN, normalize(vec3(-.65,.6,1.0))), 0.0), 180.0);
                        outgoingLight = outgoingLight * .32 + earthReflection * .43 + vec3(.18,.35,.4) * rim + vec3(1.0) * glint * 2.0;
                        #include <opaque_fragment>
                    `);
                };
                material.customProgramCacheKey = () => 'independent-earth-visor-v1';
                return material;
            }
            const [base, arm, normal] = textures.slice(index * 3, index * 3 + 3);
            base.colorSpace = THREE.SRGBColorSpace;
            for (const texture of [base, arm, normal]) { texture.flipY = true; texture.anisotropy = 8; texture.needsUpdate = true; }
            arm.channel = 1;
            return new THREE.MeshStandardMaterial({ map: base, aoMap: arm, aoMapIntensity: .7, metalnessMap: arm, roughnessMap: arm, normalMap: normal, normalScale: new THREE.Vector2(.65, .65), metalness: .75, roughness: .8, envMapIntensity: .7 });
        });
        const meshes = parts.map((name, i) => {
            const mesh = new THREE.SkinnedMesh(makeGeometry(data[i]), materials[i]);
            mesh.name = name;
            mesh.bind(skeleton, new THREE.Matrix4());
            mesh.frustumCulled = false;
            group.add(mesh);
            return mesh;
        });
        return { group, bones, skeleton, meshes, materials };
    }, [data, textures, earth, ghost]);
    const q0 = useMemo(() => new THREE.Quaternion(), []), q1 = useMemo(() => new THREE.Quaternion(), []);
    useFrame(() => {
        const frame = ((motion.current.frame % astronautFrames) + astronautFrames) % astronautFrames;
        const first = Math.floor(frame), next = (first + 1) % astronautFrames, mix = frame - first;
        const animation = data[4].attributes;
        for (let bone = 0; bone < astronautBones; bone++) {
            const a = first * astronautBones + bone, b = next * astronautBones + bone;
            q0.fromArray(animation.orient.array, a * 4).normalize();
            q1.fromArray(animation.orient.array, b * 4).normalize();
            model.bones[bone].quaternion.copy(q0).slerp(q1, mix);
            const positions = animation.position.array;
            model.bones[bone].position.set(
                THREE.MathUtils.lerp(positions[a * 3], positions[b * 3], mix),
                THREE.MathUtils.lerp(positions[a * 3 + 1], positions[b * 3 + 1], mix),
                THREE.MathUtils.lerp(positions[a * 3 + 2], positions[b * 3 + 2], mix),
            );
        }
    });
    useEffect(() => () => {
        model.meshes.forEach(mesh => mesh.geometry.dispose());
        model.materials.forEach(material => material.dispose());
        model.skeleton.dispose();
    }, [model]);
    return <primitive object={model.group} dispose={null} />;
}


