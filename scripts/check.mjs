import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function loadModule(path){
 const source=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context={exports:{}};vm.runInNewContext(source,context);return context.exports;
}
const {projects,projectPath,expertise}=loadModule('../src/data.ts');
assert.equal(projects.length,19,'The complete reference catalogue must have 19 cases');
assert.equal(new Set(projects.map(p=>p.slug)).size,19,'Case URLs must be unique');
const scenes=readFileSync(new URL('../src/Scenes.tsx',import.meta.url),'utf8');
for(const project of projects){
 assert.match(project.slug,/^[a-z_]+[a-z0-9_]*$/);
 assert.equal(projectPath(project),`/projects/${project.slug}/`);
 assert(project.description.length>100,`${project.slug}: missing Russian case summary`);
 assert(/[а-яё]/i.test(project.description),`${project.slug}: Russian text is required`);
 assert(project.services.length>0);
 assert(scenes.includes(`'${project.scene}'`)||project.scene==='bear',`${project.slug}: missing procedural renderer`);
 if(project.url)assert.equal(new URL(project.url).protocol,'https:');
}
assert.equal(expertise.length,4);
const {seeded,terrainHeight}=loadModule('../src/procedural.ts');
const randomA=seeded(42),randomB=seeded(42),randomC=seeded(43);
let sameAsOtherSeed=true;
for(let i=0;i<10000;i++){
 const a=randomA(),b=randomB(),c=randomC();assert.equal(a,b,'Procedural scenes must be reproducible');assert(a>=0&&a<1);if(a!==c)sameAsOtherSeed=false;
}
assert(!sameAsOtherSeed,'Different seeds must generate different compositions');
for(let y=-10;y<=10;y+=.25){
 const centre=Math.sin(y*.4)*2;
 assert(Math.abs(terrainHeight(centre,y)+.25)<1e-8,'The river bed must remain below the water plane');
 for(let x=-10;x<=10;x+=.5)assert(Number.isFinite(terrainHeight(x,y)),'Terrain must contain no NaN vertices');
}
console.log('PASS: 19 unique cases, scene mapping, Russian descriptions, safe external URLs, 4 expertise groups, deterministic random streams, finite terrain and continuous river bed.');
