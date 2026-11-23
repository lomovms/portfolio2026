import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const bundle = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const directory = new URL('../public/assets/cards/', import.meta.url);
assert.equal(Object.keys(bundle).length, 19);
mkdirSync(directory, { recursive: true });
for (const [slug, pair] of Object.entries(bundle)) {
    assert(/^[a-z0-9_]+$/.test(slug));
    for (const [key, suffix, mime] of [['image', '.webp', 'image/webp'], ['depth', '-depth.png', 'image/png']]) {
        const prefix = 'data:' + mime + ';base64,';
        assert(pair[key]?.startsWith(prefix), slug + ': missing ' + key);
        const bytes = Buffer.from(pair[key].slice(prefix.length), 'base64');
        assert(bytes.length > 500 && bytes.length < 2_000_000);
        writeFileSync(new URL(slug + suffix, directory), bytes);
    }
}
console.log('Saved 19 image/depth pairs.');
