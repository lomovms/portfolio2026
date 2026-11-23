type Storage = 'Float32Array' | 'Uint16Array' | 'Int16Array' | 'Uint8Array';
interface AttributeHeader {
    id: string;
    componentSize: number;
    storageType: Storage;
    needsPack: boolean;
    packedComponents?: { from: number; delta: number }[];
}
export interface AstronautBuffer {
    vertexCount: number;
    indexCount: number;
    attributes: Record<string, { size: number; array: Float32Array }>;
}
// The public files describe their own layout: uint32 JSON length, JSON, typed arrays.
// Signed packing covers the complete integer range, including -32768.
export function decodeAstronautBuffer(buffer: ArrayBuffer): AstronautBuffer {
    const view = new DataView(buffer);
    if (buffer.byteLength < 4) throw new Error('Astronaut buffer: missing header');
    const headerLength = view.getUint32(0, true);
    if (headerLength > 65536 || headerLength + 4 > buffer.byteLength) throw new Error('Astronaut buffer: invalid header length');
    const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength))) as {
        vertexCount: number; indexCount: number; attributes: AttributeHeader[];
    };
    if (!Number.isSafeInteger(header.vertexCount) || header.vertexCount < 1 || header.vertexCount > 1e6 ||
        !Number.isSafeInteger(header.indexCount) || header.indexCount < 0 || !Array.isArray(header.attributes)) {
        throw new Error('Astronaut buffer: invalid counts');
    }
    const storage = {
        Float32Array: { bytes: 4, read: (offset: number) => view.getFloat32(offset, true), min: 0, range: 1 },
        Uint16Array: { bytes: 2, read: (offset: number) => view.getUint16(offset, true), min: 0, range: 65535 },
        Int16Array: { bytes: 2, read: (offset: number) => view.getInt16(offset, true), min: -32768, range: 65535 },
        Uint8Array: { bytes: 1, read: (offset: number) => view.getUint8(offset), min: 0, range: 255 },
    };
    let offset = 4 + headerLength;
    const attributes: AstronautBuffer['attributes'] = Object.create(null);
    for (const attribute of header.attributes) {
        const type = storage[attribute.storageType];
        const size = attribute.componentSize;
        if (!type || !Number.isInteger(size) || size < 1 || size > 4 || Object.hasOwn(attributes, attribute.id)) throw new Error('Astronaut buffer: invalid attribute');
        const length = (attribute.id === 'indices' ? header.indexCount : header.vertexCount) * size;
        if (offset + length * type.bytes > buffer.byteLength) throw new Error('Astronaut buffer: truncated attribute');
        if (attribute.needsPack && (attribute.packedComponents?.length !== size || attribute.packedComponents.some(p => !Number.isFinite(p.from) || !Number.isFinite(p.delta)))) throw new Error('Astronaut buffer: invalid packing');
        const array = new Float32Array(length);
        for (let i = 0; i < length; i++, offset += type.bytes) {
            let value = type.read(offset);
            if (attribute.needsPack) {
                const pack = attribute.packedComponents![i % size];
                value = pack.from + (value - type.min) / type.range * pack.delta;
            }
            if (!Number.isFinite(value)) throw new Error('Astronaut buffer: non-finite attribute');
            array[i] = value;
        }
        attributes[attribute.id] = { size, array };
    }
    if (offset !== buffer.byteLength) throw new Error('Astronaut buffer: unexpected trailing bytes');
    return { vertexCount: header.vertexCount, indexCount: header.indexCount, attributes };
}

export const astronautBones = 53;
export const astronautFrames = 288;
