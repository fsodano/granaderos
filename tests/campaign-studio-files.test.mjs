import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {zipSync} from '../web/node_modules/fflate/esm/index.mjs';
import {createCampaignProject,validateCampaignProject,projectResourceBytes} from '../game/campaign-editor-project.js';
import {verifyCampaignFolder} from '../tools/campaign-export.mjs';
register('./tactical-render-loader.mjs',import.meta.url);
const {importCampaignFiles,importCampaignArchive,exportCampaignArchive,campaignProjectFiles,loadInstalledCampaignProject,campaignArchiveEntries}=await import('../web/lib/campaign-studio-files.ts');
const zip=(records,level=1)=>zipSync(Object.fromEntries(records.map(record=>[record.path,record.bytes])),{level});

test('complete browser ZIP exports are accepted by the existing folder/build validator',async()=>{
 const project=await createCampaignProject('studio-export'),bytes=await exportCampaignArchive(project),imported=await importCampaignArchive(bytes),root=await mkdtemp(join(tmpdir(),'studio-package-'));
 try{
  const folder=join(root,project.manifest.id);for(const record of await campaignProjectFiles(imported)){const path=join(folder,record.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,record.bytes);}
  const compiled=await verifyCampaignFolder(folder);assert.equal(compiled.id,'studio-export');assert.deepEqual(compiled,(await validateCampaignProject(project)).content);assert.deepEqual(imported,project);
  assert.deepEqual(projectResourceBytes(imported,'assets/guide.png'),projectResourceBytes(project,'assets/guide.png'));assert.ok(campaignArchiveEntries(bytes).every(entry=>entry.path.startsWith('studio-export/')));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('stored and deflated ZIPs, nested folders and directory file selections preserve exact project data',async()=>{
 const project=await createCampaignProject('studio-import'),records=await campaignProjectFiles(project);
 for(const level of [0,6])assert.deepEqual(await importCampaignArchive(zip(records.map(record=>({...record,path:`campaigns/studio-import/${record.path}`})),level)),project);
 assert.deepEqual(await importCampaignFiles(records.map(record=>({...record,path:`studio-import/${record.path}`}))),project);
});
test('semantic errors in imported drafts remain editable but installable export is blocked',async()=>{
 const project=await createCampaignProject('studio-draft'),records=await campaignProjectFiles(project),record=records.find(record=>record.path==='content.json'),content=JSON.parse(new TextDecoder().decode(record.bytes));content.characters[0].monthlyPay=-1;record.bytes=new TextEncoder().encode(JSON.stringify(content));
 const draft=await importCampaignFiles(records);assert.equal(draft.content.characters[0].monthlyPay,-1);assert.equal((await validateCampaignProject(draft)).valid,false);await assert.rejects(exportCampaignArchive(draft),/campaña inválida/);
});
test('directory import rejects traversal, duplicates, mixed roots and undisclosed extra files',async()=>{
 const records=await campaignProjectFiles(await createCampaignProject('studio-paths'));
 await assert.rejects(importCampaignFiles([...records,{path:'../outside.png',bytes:new Uint8Array()}]),/ruta/);
 await assert.rejects(importCampaignFiles([...records,records[0]]),/repetido/);
 await assert.rejects(importCampaignFiles(records.map((record,i)=>({...record,path:i?'other/'+record.path:'studio-paths/'+record.path}))),/otra carpeta/);
 await assert.rejects(importCampaignFiles([...records,{path:'script.js',bytes:new Uint8Array()}]),/tipo no admitido/);
 await assert.rejects(importCampaignFiles([...records,{path:'unknown.json',bytes:new Uint8Array([123,125])}]),/no pertenece/);
});
test('ZIP import rejects traversal, duplicate central names, symlinks, CRC corruption and false sizes',async()=>{
 const project=await createCampaignProject('studio-zip-safe'),records=await campaignProjectFiles(project);
 await assert.rejects(importCampaignArchive(zip([...records,{path:'../outside.json',bytes:new Uint8Array([123,125])}])),/ruta inválida/);
 const linked=zipSync({'link.png':[new Uint8Array([1]),{os:3,attrs:0xa1ff<<16}]});await assert.rejects(importCampaignArchive(linked),/enlace/);
 const normal=zip(records,0),entry=campaignArchiveEntries(normal)[0],corrupted=normal.slice();corrupted[entry.start]^=1;await assert.rejects(importCampaignArchive(corrupted),/cambió dentro del ZIP/);
 const deflated=zip(records,6),entries=campaignArchiveEntries(deflated),first=entries[0],forged=deflated.slice(),view=new DataView(forged.buffer);let central=-1;for(let i=0;i<forged.length-46;i++)if(view.getUint32(i,true)===0x02014b50){central=i;break;}
 view.setUint32(central+24,first.size-1,true);view.setUint32(22,first.size-1,true);await assert.rejects(importCampaignArchive(forged),/tamaño declarado|incompleto/);
 const dupe=zipSync({'a/manifest.json':new Uint8Array([123,125]),'b/manifest.json':new Uint8Array([123,125])},{level:0}),modified=dupe.slice();for(let i=0;i<modified.length-14;i++)if(new TextDecoder().decode(modified.subarray(i,i+15))==='b/manifest.json')modified[i]=97;
 await assert.rejects(importCampaignArchive(modified),/repetida/);
});
test('installed project loader retains all raw documents and actual image bytes',async()=>{
 const project=await createCampaignProject('studio-installed'),records=await campaignProjectFiles(project),files=new Map(records.map(record=>[`/campaigns/studio-installed/${record.path}`,record.bytes]));
 const reader=async path=>{const bytes=files.get(path);return {ok:Boolean(bytes),status:bytes?200:404,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
 const entry={id:project.manifest.id,name:project.manifest.name,revision:'1',manifest:'studio-installed/manifest.json'};
 assert.deepEqual(await loadInstalledCampaignProject(entry,{reader}),project);
 files.set('/campaigns/studio-installed/assets/guide.png',new Uint8Array([1,2,3]));await assert.rejects(loadInstalledCampaignProject(entry,{reader}),/suma de control/);
});
test('uncompressed archive sizes are bounded before extraction',async()=>{
 const project=await createCampaignProject('studio-limits'),bytes=await exportCampaignArchive(project),forged=bytes.slice(),view=new DataView(forged.buffer);let central=-1;for(let i=0;i<forged.length-46;i++)if(view.getUint32(i,true)===0x02014b50){central=i;break;}
 view.setUint32(central+24,17*1024*1024,true);assert.throws(()=>campaignArchiveEntries(forged),/excede los límites/);
});


test('installed Granaderos can be imported and downloaded with every authored field and all 208 resource files intact',async()=>{
 const root=resolve('campaigns/granaderos'),manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8')),index=JSON.parse(await readFile(join(root,manifest.maps),'utf8')),assets=JSON.parse(await readFile(join(root,manifest.assets),'utf8'));
 const paths=['manifest.json',manifest.content,manifest.world,manifest.presentation,manifest.maps,manifest.assets,...index.maps.map(map=>join(dirname(manifest.maps),map.path)),...assets.assets.map(asset=>asset.path)];
 const records=await Promise.all(paths.map(async path=>({path,bytes:new Uint8Array(await readFile(join(root,path)))})));
 const project=await importCampaignFiles(records),report=await validateCampaignProject(project);assert.equal(report.valid,true,JSON.stringify(report.issues));assert.equal(report.checks.resources,assets.assets.length);assert.equal(project.content.world,undefined);assert.equal(project.content.campaignOrigin,undefined);
 const loaded=await importCampaignArchive(await exportCampaignArchive(project));assert.deepEqual(loaded,project);assert.deepEqual((await validateCampaignProject(loaded)).content,await verifyCampaignFolder(root));
});
test('custom manifest document paths and nested map paths survive installable folder roundtrip',async()=>{
 const project=await createCampaignProject('studio-custom-paths');project.manifest.content='documents/actors.json';project.manifest.world='documents/territory.json';project.manifest.presentation='documents/menu.json';project.manifest.assets='documents/images.json';project.manifest.maps='scenes/list.json';project.mapIndex.maps[0].path='south/camp.json';project.mapIndex.maps[1].path='north/watch-post.json';
 const imported=await importCampaignArchive(await exportCampaignArchive(project));assert.deepEqual(imported,project);assert.equal((await validateCampaignProject(imported)).valid,true);
});
