import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/astronautBuffer.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
export const { decodeAstronautBuffer, astronautBones, astronautFrames } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
export const assetDirectory = new URL('../public/assets/astronaut/', import.meta.url);
export const readAsset = name => readFileSync(new URL(name, assetDirectory));
export function readBuffer(name) {
    const bytes = readAsset(name + '.buf');
    return decodeAstronautBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
