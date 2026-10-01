import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildIdentity} from '../tools/build-identity.mjs';
test('game, editor, tools and public art changes each produce a different source identity',async()=>{
 const root=await mkdtemp(join(tmpdir(),'granaderos-build-id-'));
 try{
  await writeFile(join(root,'package.json'),JSON.stringify({version:'test'}));
  for(const dir of ['game','web/app','web/public/art','tools','web/dist','web/node_modules'])await mkdir(join(root,dir),{recursive:true});
  let before=await buildIdentity(root);assert.equal(before.version,'test');assert.equal(before.revision,null);
  for(const file of ['game/rules.js','web/app/editor.tsx','tools/audit.mjs','web/public/art/building.png']){
   await writeFile(join(root,file),'changed source');const after=await buildIdentity(root);assert.notEqual(after.id,before.id);before=after;
  }
  await writeFile(join(root,'web/dist/output.js'),'compiled output');await writeFile(join(root,'web/node_modules/dependency.js'),'installed dependency');
  assert.deepEqual(await buildIdentity(root),before,'outputs and installed modules cannot make identity depend on prior builds');
  await writeFile(join(root,'web/next-env.d.ts'),'generated route declarations');
  assert.deepEqual(await buildIdentity(root),before,'a clean build can generate route declarations without changing its identity');
  await writeFile(join(root,'web/next-env.d.ts'),'updated generated declarations');
  assert.deepEqual(await buildIdentity(root),before);
  await rm(join(root,'web/next-env.d.ts'));
  assert.deepEqual(await buildIdentity(root),before);
 }finally{await rm(root,{recursive:true,force:true});}
});
