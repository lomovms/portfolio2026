import assert from 'node:assert/strict';
import { AnimationMixer, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readBuffer, readAsset, decodeAstronautBuffer, astronautBones, astronautFrames } from './astronaut-data.mjs';

let vertices = 0, triangles = 0;
for (const name of ['astronaut_helmet', 'astronaut_glove_shoes', 'astronaut_wearpack', 'astronaut_helmet_glass']) {
    const data = readBuffer(name), a = data.attributes;
    vertices += data.vertexCount; triangles += data.indexCount / 3;
    for (const index of a.indices.array) assert(Number.isInteger(index) && index >= 0 && index < data.vertexCount, 'Invalid triangle index');
    for (const index of a.boneIndices.array) assert(Number.isInteger(index) && index >= 0 && index < astronautBones, 'Invalid bone index');
    for (let i = 0; i < data.vertexCount; i++) {
        assert(Math.abs(a.boneWeights.array[i * 2] + a.boneWeights.array[i * 2 + 1] - 1) < 2e-5, 'Weights must sum to one');
        const normal = a.normal.array.subarray(i * 3, i * 3 + 3);
        assert(Math.abs(Math.hypot(...normal) - 1) < .002, 'Signed packed normal was decoded incorrectly');
    }
}
const animation = readBuffer('astronaut_animations');
assert.equal(animation.vertexCount, astronautBones * astronautFrames);
for (let i = 0; i < animation.vertexCount; i++) assert(Math.abs(Math.hypot(...animation.attributes.orient.array.subarray(i * 4, i * 4 + 4)) - 1) < 1e-5, 'Invalid quaternion');
for (const name of ['astronaut_in_animation', 'astronaut_out_animation']) assert.equal(readBuffer(name).vertexCount, 100);
assert.throws(() => decodeAstronautBuffer(new ArrayBuffer(3)), /missing header/);
const truncated = readAsset('astronaut_helmet.buf');
assert.throws(() => decodeAstronautBuffer(truncated.buffer.slice(truncated.byteOffset, truncated.byteOffset + truncated.byteLength - 1)), /truncated attribute/);
const glb = readAsset('astronaut.glb');
assert.equal(glb.readUInt32LE(0), 0x46546c67); assert.equal(glb.readUInt32LE(8), glb.length);
const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)));
assert.equal(gltf.skins[0].joints.length, 53); assert.equal(gltf.meshes.length, 4); assert.equal(gltf.images.length, 9);
assert.equal(gltf.animations[0].channels.length, 106);
for (const accessor of gltf.accessors) assert(accessor.count > 0 && Number.isInteger(accessor.count));
const glass = readBuffer('broken_glass'), destruction = readBuffer('broken_glass_animation');
assert.equal(Math.max(...glass.attributes.piece.array) + 1, 946);
assert.equal(destruction.vertexCount / 946, 15);
for (const index of glass.attributes.indices.array) assert(index < glass.vertexCount);
for (let i = 0; i < destruction.vertexCount; i++) assert(Math.abs(Math.hypot(...destruction.attributes.orient.array.subarray(i * 4, i * 4 + 4)) - 1) < 1e-5);
for (const [name, meshCount, boneCount] of [['astronaut.glb', 4, 53], ['glass-break.glb', 1, 946]]) {
    const bytes = readAsset(name);
    const loader = new GLTFLoader();
    // Node has no image decoder; browser QA separately verifies the real textures.
    loader.register(() => ({ name: 'EXT_texture_webp', loadTexture: () => Promise.resolve(new Texture()) }));
    const loaded = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const meshes = []; loaded.scene.traverse(object => { if (object.isSkinnedMesh) meshes.push(object); });
    assert.equal(meshes.length, meshCount); assert.equal(meshes[0].skeleton.bones.length, boneCount);
    assert.equal(loaded.animations.length, 1);
    const mixer = new AnimationMixer(loaded.scene); mixer.clipAction(loaded.animations[0]).play(); mixer.setTime(.2); loaded.scene.updateMatrixWorld(true);
    for (const mesh of meshes) {
        mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i += 101) assert(mesh.getVertexPosition(i, new Vector3()).toArray().every(Number.isFinite), `${name}: invalid animated vertex`);
    }
}
console.log(`PASS: ${vertices} vertices, ${triangles} triangles, signed normals and skin weights, 53 × 288 bone poses, 2 camera tracks, 946 × 15 shard poses, malformed data rejection, both GLBs load and animate with Three.js.`);
