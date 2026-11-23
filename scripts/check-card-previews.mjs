import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/data.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { projects, portfolioWorks } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const cards = [...projects, ...portfolioWorks];
let total = 0;
for (const card of cards) {
    const { slug } = card;
    const image = readFileSync(new URL('../public/assets/cards/' + slug + '.webp', import.meta.url));
    const depth = readFileSync(new URL('../public/assets/cards/' + slug + '-depth.png', import.meta.url));
    assert.equal(image.toString('ascii', 0, 4), 'RIFF', slug + ': invalid color image');
    assert.equal(image.toString('ascii', 8, 12), 'WEBP');
    if (image.toString('ascii', 12, 16) === 'VP8X') assert.equal(image[20] & 16, 0, slug + ': transparent preview would expose black fringes in shaders');
    assert.equal(depth.toString('hex', 0, 8), '89504e470d0a1a0a', slug + ': invalid depth map');
    assert.equal(depth.readUInt32BE(16), 1000, slug + ': depth width');
    assert.equal(depth.readUInt32BE(20), 650, slug + ': depth height');
    assert(image.length > 1000 && depth.length > 1000, slug + ': empty image or depth');
    total += image.length + depth.length;
}
assert(total < 4_000_000, 'Card previews exceeded their download budget');
console.log('PASS: ' + cards.length + ' color/depth pairs, download budget ' + (total / 1024 / 1024).toFixed(2) + ' MiB.');
