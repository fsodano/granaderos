import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {stageStaticDeployment} from '../tools/stage-static-deployment.mjs';

async function write(directory,path,data){
 const target=join(directory,path);
 await mkdir(join(target,'..'),{recursive:true});
 await writeFile(target,data);
}

async function snapshot(directory){
 const files={};
 async function visit(current){
  for(const entry of await readdir(current,{withFileTypes:true})){
   const path=join(current,entry.name);
   if(entry.isDirectory())await visit(path);
   else files[relative(directory,path)]=(await readFile(path)).toString('hex');
  }
 }
 await visit(directory);
 return files;
}

async function fixture(t,basePath=''){
 const folder=await mkdtemp(join(tmpdir(),'granaderos-static-deployment-'));
 t.after(()=>rm(folder,{recursive:true,force:true}));
 const source=join(folder,'source'),destination=join(folder,'destination');
 const physicalPrefix=basePath?`${basePath.slice(1)}/`:'';
 const browserPrefix=basePath||'';
 const script=`${physicalPrefix}_next/static/app.js`;
 const manifest={
  app:{file:script,css:[`${physicalPrefix}_next/static/app.css`],assets:[`${physicalPrefix}_next/static/icon.webp`,'art/portrait.webp'],imports:['shared']},
  shared:{file:'vendor/shared.js'},
 };
 const client={appBrowserEntry:script,otherMetadata:{version:1}};
 await write(source,'index.html',`<script src="${browserPrefix}/_next/static/app.js"></script><a href="${browserPrefix}/editor/">Editor</a>`);
 await write(source,'editor.html',`<h1>Editor</h1><img src="${browserPrefix}/art/portrait.webp">`);
 await write(source,'story.html','<h1>Story</h1>');
 await write(source,'editor.rsc','editor-rsc');
 await write(source,'story.rsc','story-rsc');
 await write(source,script,`const worker="${browserPrefix}/_next/static/save-worker.js";`);
 await write(source,`${physicalPrefix}_next/static/save-worker.js`,'postMessage("ready");');
 await write(source,`${physicalPrefix}_next/static/app.css`,'body { color: black; }');
 await write(source,`${physicalPrefix}_next/static/icon.webp`,Buffer.from([0,1,2,255]));
 await write(source,'art/portrait.webp',Buffer.from([5,6,7,254]));
 await write(source,'vendor/shared.js','export const shared=true;');
 await write(source,'.vite/manifest.json',JSON.stringify(manifest));
 await write(source,'vinext-client-entry-manifest.json',JSON.stringify(client));
 await write(destination,'previous-export.txt','replace this stale file');
 return {source,destination,manifest,client};
}

test('root hosting copies the complete export without changing source files or root routes',async t=>{
 const {source,destination}=await fixture(t);
 const before=await snapshot(source);
 await stageStaticDeployment(source,destination);
 assert.deepEqual(await snapshot(source),before);
 assert.deepEqual(await snapshot(destination),{...before,'.nojekyll':''});
});

for(const basePath of ['/granaderos','/games/granaderos']){
 test(`project hosting stages assets and reloadable routes for ${basePath} without changing deployed URLs`,async t=>{
  const {source,destination}=await fixture(t,basePath);
  const before=await snapshot(source);
  await stageStaticDeployment(source,destination,basePath);
  assert.deepEqual(await snapshot(source),before);
  const staged=await snapshot(destination);
  assert.equal(staged['previous-export.txt'],undefined);
  assert.ok(!Object.keys(staged).some(file=>file.startsWith(`${basePath.slice(1)}/`)));
  for(const file of ['app.js','save-worker.js','app.css','icon.webp']){
   assert.equal(staged[`_next/static/${file}`],before[`${basePath.slice(1)}/_next/static/${file}`]);
  }
  for(const file of ['index.html','editor.html','story.html','art/portrait.webp','vendor/shared.js']){
   assert.equal(staged[file],before[file]);
  }
  for(const route of ['editor','story']){
   assert.equal(staged[`${route}/index.html`],before[`${route}.html`]);
   assert.equal(staged[`${route}/index.rsc`],before[`${route}.rsc`]);
  }
  assert.equal(staged['.nojekyll'],'');
  assert.deepEqual(JSON.parse(await readFile(join(destination,'.vite/manifest.json'),'utf8')),{
   app:{file:'_next/static/app.js',css:['_next/static/app.css'],assets:['_next/static/icon.webp','art/portrait.webp'],imports:['shared']},
   shared:{file:'vendor/shared.js'},
  });
  assert.deepEqual(JSON.parse(await readFile(join(destination,'vinext-client-entry-manifest.json'),'utf8')),{
   appBrowserEntry:'_next/static/app.js',otherMetadata:{version:1},
  });
 });
}

test('project hosting supports editor and story pages without optional RSC companions',async t=>{
 const {source,destination}=await fixture(t,'/granaderos');
 for(const route of ['editor','story'])await rm(join(source,`${route}.rsc`));
 const before=await snapshot(source);
 await stageStaticDeployment(source,destination,'/granaderos');
 const staged=await snapshot(destination);
 for(const route of ['editor','story']){
  assert.equal(staged[`${route}/index.html`],before[`${route}.html`]);
  assert.equal(staged[`${route}/index.rsc`],undefined);
 }
 assert.deepEqual(await snapshot(source),before);
});

for(const route of ['editor','story']){
 test(`project hosting rejects a missing ${route} page and preserves the source export`,async t=>{
  const {source,destination}=await fixture(t,'/granaderos');
  await rm(join(source,`${route}.html`));
  const before=await snapshot(source);
  await assert.rejects(stageStaticDeployment(source,destination,'/granaderos'),{code:'ENOENT'});
  assert.deepEqual(await snapshot(source),before);
 });
}
