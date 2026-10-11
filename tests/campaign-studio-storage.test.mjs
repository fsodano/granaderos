import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB as testIndexedDB} from '../web/node_modules/fake-indexeddb/build/esm/index.js';
import {createCampaignProject,projectResourceBytes,encodeCampaignProject} from '../game/campaign-editor-project.js';
register('./tactical-render-loader.mjs',import.meta.url);
const {saveStudioProject,loadStudioProjects,deleteStudioProject}=await import('../web/lib/campaign-studio-storage.ts');

test('IndexedDB stores complete independent projects with durable binary resources and editor metadata',async()=>{
 const original=globalThis.indexedDB;globalThis.indexedDB=testIndexedDB;
 try{
  const one=await createCampaignProject('studio-storage-one'),two=await createCampaignProject('studio-storage-two');one.editor={buildingTemplates:[{id:'own-template',name:'Casa'}]};
  await saveStudioProject(one);await saveStudioProject(two);
  assert.deepEqual(await loadStudioProjects(),[one,two]);
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('granaderos.campaign-studio.v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const stored=await new Promise((resolve,reject)=>{const request=db.transaction('projects').objectStore('projects').get(one.manifest.id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();
  assert.ok(stored.resources['assets/guide.png'].bytes instanceof Blob);assert.equal(stored.resources['assets/guide.png'].base64,undefined);
  one.content.characters[0].name='Cambio propio';await saveStudioProject(one);const loaded=await loadStudioProjects();assert.equal(loaded[0].content.characters[0].name,'Cambio propio');assert.equal(loaded[1].content.characters[0].name,two.content.characters[0].name);
  assert.deepEqual(projectResourceBytes(loaded[0],'assets/guide.png'),projectResourceBytes(one,'assets/guide.png'));
  await deleteStudioProject(one.manifest.id);assert.deepEqual(await loadStudioProjects(),[two]);await deleteStudioProject(two.manifest.id);
 }finally{if(original===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=original;}
});
test('invalid semantic drafts can be stored while malformed resource bytes cannot replace a good record',async()=>{
 const original=globalThis.indexedDB;globalThis.indexedDB=testIndexedDB;
 try{
  const project=await createCampaignProject('studio-storage-invalid');project.content.characters[0].monthlyPay=-5;await saveStudioProject(project);
  const malformed=structuredClone(project);malformed.resources['assets/guide.png'].base64='invalid';await assert.rejects(saveStudioProject(malformed),/bytes codificados/);
  assert.equal(encodeCampaignProject((await loadStudioProjects())[0]),encodeCampaignProject(project));await deleteStudioProject(project.manifest.id);
 }finally{if(original===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=original;}
});
test('storage unavailable errors preserve the downloadable project',async()=>{
 const original=globalThis.indexedDB;delete globalThis.indexedDB;
 try{const project=await createCampaignProject('studio-storage-unavailable');await assert.rejects(saveStudioProject(project),/Descargá una copia/);assert.ok(encodeCampaignProject(project));}
 finally{if(original!==undefined)globalThis.indexedDB=original;}
});
