import { writeFileSync } from 'node:fs';
import { assetDirectory, readAsset, readBuffer, astronautBones, astronautFrames } from './astronaut-data.mjs';

// Independent conversion of self-described public binary data to standard glTF 2.0.
let gltf = {
    asset: { version: '2.0', generator: 'Independent educational buffer converter', copyright: 'Original model, texture and animation data: Lusion. Source: https://lusion.co/. No reuse license is granted by this conversion.' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Lusion astronaut — local study', children: [] }],
    meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [], images: [], textures: [],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    skins: [], animations: [], extensionsUsed: ['EXT_texture_webp'], extensionsRequired: ['EXT_texture_webp'],
};
let binaryLength = 0;
const chunks = [];
function addBytes(bytes, target) {
    const padding = (4 - binaryLength % 4) % 4;
    if (padding) { chunks.push(Buffer.alloc(padding)); binaryLength += padding; }
    const view = { buffer: 0, byteOffset: binaryLength, byteLength: bytes.byteLength };
    if (target) view.target = target;
    chunks.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)); binaryLength += bytes.byteLength;
    return gltf.bufferViews.push(view) - 1;
}
function accessor(array, size, target, bounds = false) {
    const componentType = array instanceof Uint16Array ? 5123 : 5126;
    const result = { bufferView: addBytes(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), target), componentType, count: array.length / size, type: ['SCALAR', 'VEC2', 'VEC3', 'VEC4'][size - 1] };
    if (bounds) {
        result.min = Array(size).fill(Infinity); result.max = Array(size).fill(-Infinity);
        array.forEach((value, i) => { result.min[i % size] = Math.min(value, result.min[i % size]); result.max[i % size] = Math.max(value, result.max[i % size]); });
    }
    return gltf.accessors.push(result) - 1;
}
function texture(name) {
    const image = gltf.images.push({ name, bufferView: addBytes(readAsset(name)), mimeType: 'image/webp' }) - 1;
    return gltf.textures.push({ sampler: 0, extensions: { EXT_texture_webp: { source: image } } }) - 1;
}
const parts = ['astronaut_helmet', 'astronaut_glove_shoes', 'astronaut_wearpack', 'astronaut_helmet_glass'];
for (const [part, name] of parts.entries()) {
    const data = readBuffer(name), attributes = {};
    for (const [source, semantic] of [['position', 'POSITION'], ['normal', 'NORMAL'], ['uv', 'TEXCOORD_0']]) {
        const { size, array } = data.attributes[source];
        const copy = array.slice();
        if (source === 'uv') for (let i = 1; i < copy.length; i += 2) copy[i] = 1 - copy[i];
        attributes[semantic] = accessor(copy, size, 34962, source === 'position');
    }
    const joints = new Uint16Array(data.vertexCount * 4), weights = new Float32Array(data.vertexCount * 4);
    for (let i = 0; i < data.vertexCount; i++) {
        joints[i * 4] = data.attributes.boneIndices.array[i * 2]; joints[i * 4 + 1] = data.attributes.boneIndices.array[i * 2 + 1];
        const a = data.attributes.boneWeights.array[i * 2], b = data.attributes.boneWeights.array[i * 2 + 1];
        weights[i * 4] = a / (a + b); weights[i * 4 + 1] = b / (a + b);
    }
    attributes.JOINTS_0 = accessor(joints, 4, 34962); attributes.WEIGHTS_0 = accessor(weights, 4, 34962);
    const material = { name, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: .75, roughnessFactor: .8 } };
    if (part < 3) {
        const base = texture(name + '_base.webp'), arm = texture(name + '_arm.webp'), normal = texture(name + '_nor.webp');
        material.pbrMetallicRoughness.baseColorTexture = { index: base };
        material.pbrMetallicRoughness.metallicRoughnessTexture = { index: arm };
        material.normalTexture = { index: normal, scale: .65 }; material.occlusionTexture = { index: arm, strength: .7 };
    } else {
        material.pbrMetallicRoughness = { baseColorFactor: [.015, .025, .03, 1], metallicFactor: 1, roughnessFactor: .065 };
    }
    gltf.materials.push(material);
    gltf.meshes.push({ name, primitives: [{ attributes, indices: accessor(new Uint16Array(data.attributes.indices.array), 1, 34963), material: part }] });
    gltf.nodes[0].children.push(gltf.nodes.length);
    gltf.nodes.push({ name, mesh: part, skin: 0 });
}
const animation = readBuffer('astronaut_animations').attributes;
const joints = [], samplers = [], channels = [];
const times = Float32Array.from({ length: astronautFrames }, (_, i) => i / 30);
const input = accessor(times, 1, undefined, true);
for (let bone = 0; bone < astronautBones; bone++) {
    const node = gltf.nodes.length; joints.push(node); gltf.nodes[0].children.push(node);
    gltf.nodes.push({ name: `flight_${bone}`, translation: Array.from(animation.position.array.slice(bone * 3, bone * 3 + 3)), rotation: Array.from(animation.orient.array.slice(bone * 4, bone * 4 + 4)) });
    for (const [source, path, size] of [['position', 'translation', 3], ['orient', 'rotation', 4]]) {
        const values = new Float32Array(astronautFrames * size);
        for (let frame = 0; frame < astronautFrames; frame++) {
            const offset = (frame * astronautBones + bone) * size;
            values.set(animation[source].array.subarray(offset, offset + size), frame * size);
            if (size === 4) {
                const length = Math.hypot(...values.subarray(frame * 4, frame * 4 + 4));
                for (let axis = 0; axis < 4; axis++) values[frame * 4 + axis] /= length;
            }
        }
        const sampler = samplers.push({ input, output: accessor(values, size), interpolation: 'LINEAR' }) - 1;
        channels.push({ sampler, target: { node, path } });
    }
}
gltf.skins.push({ name: '53 baked affine bones', joints });
gltf.animations.push({ name: 'Baked flight — 288 samples at assumed 30 fps', samplers, channels });
function saveGLB(name) {
    gltf.buffers.push({ byteLength: binaryLength });
    let json = Buffer.from(JSON.stringify(gltf));
    json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
    const binary = Buffer.concat([...chunks, Buffer.alloc((4 - binaryLength % 4) % 4)]);
    const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8);
    header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + json.length + 8 + binary.length, 8);
    jsonHeader.writeUInt32LE(json.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
    binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4);
    writeFileSync(new URL(name, assetDirectory), Buffer.concat([header, jsonHeader, json, binHeader, binary]));
    console.log(`Exported ${name}: ${gltf.meshes.length} meshes, ${gltf.skins[0].joints.length} bones, ${gltf.animations[0].channels.length} animation channels.`);
}
saveGLB('astronaut.glb');

// Glass vertices are local to each shard; their poses form a 16:9 pane at frame zero.
const glass = readBuffer('broken_glass'), glassAnimation = readBuffer('broken_glass_animation').attributes;
const shardCount = Math.max(...glass.attributes.piece.array) + 1;
const frameCount = glassAnimation.orient.array.length / 4 / shardCount;
gltf = {
    asset: { version: '2.0', generator: 'Independent educational buffer converter', copyright: 'Original geometry and recorded destruction: Lusion. Local study only.' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Recorded glass destruction', children: [1] }, { name: '946 glass shards', mesh: 0, skin: 0 }],
    meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [], skins: [], animations: [],
    extensionsUsed: ['KHR_materials_transmission', 'KHR_materials_ior', 'KHR_materials_volume'],
};
chunks.length = 0; binaryLength = 0;
const skinIndices = new Uint16Array(glass.vertexCount * 4), skinWeights = new Float32Array(glass.vertexCount * 4);
for (let i = 0; i < glass.vertexCount; i++) { skinIndices[i * 4] = glass.attributes.piece.array[i]; skinWeights[i * 4] = 1; }
gltf.meshes.push({ primitives: [{
    attributes: {
        POSITION: accessor(glass.attributes.position.array, 3, 34962, true),
        JOINTS_0: accessor(skinIndices, 4, 34962), WEIGHTS_0: accessor(skinWeights, 4, 34962),
    },
    indices: accessor(new Uint16Array(glass.attributes.indices.array), 1, 34963), material: 0,
}] });
gltf.materials.push({ name: 'Independent physical glass', pbrMetallicRoughness: { baseColorFactor: [.94, .98, 1, 1], metallicFactor: 0, roughnessFactor: .045 }, doubleSided: true,
    extensions: { KHR_materials_transmission: { transmissionFactor: 1 }, KHR_materials_ior: { ior: 1.48 }, KHR_materials_volume: { thicknessFactor: .018 } },
});
const glassJoints = [], glassSamplers = [], glassChannels = [];
const glassInput = accessor(Float32Array.from({ length: frameCount }, (_, i) => i / 30), 1, undefined, true);
for (let shard = 0; shard < shardCount; shard++) {
    const node = gltf.nodes.length; glassJoints.push(node); gltf.nodes[0].children.push(node);
    gltf.nodes.push({ name: `shard_${shard}`, translation: Array.from(glassAnimation.position.array.slice(shard * 3, shard * 3 + 3)), rotation: Array.from(glassAnimation.orient.array.slice(shard * 4, shard * 4 + 4)) });
    for (const [source, path, size] of [['position', 'translation', 3], ['orient', 'rotation', 4]]) {
        const values = new Float32Array(frameCount * size);
        for (let frame = 0; frame < frameCount; frame++) {
            const offset = (frame * shardCount + shard) * size;
            values.set(glassAnimation[source].array.subarray(offset, offset + size), frame * size);
        }
        const sampler = glassSamplers.push({ input: glassInput, output: accessor(values, size), interpolation: 'LINEAR' }) - 1;
        glassChannels.push({ sampler, target: { node, path } });
    }
}
gltf.skins.push({ joints: glassJoints });
gltf.animations.push({ name: 'Glass impact — 15 samples at assumed 30 fps', samplers: glassSamplers, channels: glassChannels });
saveGLB('glass-break.glb');
