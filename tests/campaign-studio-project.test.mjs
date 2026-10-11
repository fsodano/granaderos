import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignProject,projectContent,updateProjectContent,renameCampaignProject,validateCampaignProject,setProjectResource,removeProjectResource,projectResourceBytes,encodeCampaignProject,decodeCampaignProject} from '../game/campaign-editor-project.js';
import {scaffoldDocuments} from '../tools/campaign-authoring.mjs';

test('browser project scaffold uses the same complete folder documents and neutral image as the CLI',async()=>{
 const project=await createCampaignProject('studio-frontier'),documents=scaffoldDocuments('studio-frontier');
 for(const field of ['manifest','content','world','presentation','maps','assets'])assert.deepEqual(project[field],documents[field]);
 assert.deepEqual(projectResourceBytes(project,'assets/guide.png'),documents.image);
 const report=await validateCampaignProject(project);assert.equal(report.valid,true,JSON.stringify(report.issues));assert.equal(report.checks.maps,2);assert.equal(report.checks.resources,1);
 assert.equal(report.content.campaignOrigin.id,'studio-frontier');assert.equal(projectContent(project).campaignOrigin,undefined);
 assert.equal(JSON.stringify(project).includes('/campaigns/granaderos/'),false);
});
test('all admitted authored optional data survives controlled editing and project roundtrip',async()=>{
 const project=await createCampaignProject('studio-preserve');project.editor={buildingTemplates:[{id:'own-house',name:'Casa propia'}]};
 project.content.campaignEvents=[{id:'payment',atHour:1,conditions:[],text:'Fondos recibidos.',effects:[{type:'treasury',operation:'receive',amount:1}]}];
 project.content.characters[0].abilities=['scout'];
 const next=projectContent(project);next.name='Nombre cambiado';next.world.buildings.types.house.wall='#2457a3';next.presentation.subtitle='Presentación propia';next.campaignOrigin={id:'fake',revision:'9'};
 const changed=updateProjectContent(project,next);assert.equal(changed.content.campaignOrigin,undefined);assert.equal(changed.content.world,undefined);assert.equal(changed.content.name,'Nombre cambiado');
 assert.equal(changed.world.buildings.types.house.wall,'#2457a3');assert.deepEqual(changed.content.campaignEvents,project.content.campaignEvents);assert.deepEqual(changed.editor,project.editor);
 assert.deepEqual(decodeCampaignProject(encodeCampaignProject(changed)),changed);assert.equal(project.world.buildings.types.house.wall,'#b5ac91');
});
test('forking identity rewrites only own portable URLs atomically and preserves authored fields',async()=>{
 const project=await createCampaignProject('studio-before','Antes');project.presentation.menuArt='/campaigns/studio-before/assets/guide.png';project.presentation.manual={note:'Texto propio'};project.editor={external:'/campaigns/other/assets/elsewhere.png'};
 const changed=renameCampaignProject(project,'studio-after','Después');assert.equal(changed.manifest.id,'studio-after');assert.equal(changed.content.id,'studio-after');assert.equal(changed.presentation.title,'Después');
 assert.equal(changed.content.characters[0].portrait,'/campaigns/studio-after/assets/guide.png');assert.equal(changed.presentation.menuArt,'/campaigns/studio-after/assets/guide.png');assert.equal(changed.editor.external,project.editor.external);assert.equal(project.manifest.id,'studio-before');
 assert.equal((await validateCampaignProject(changed)).valid,true);assert.throws(()=>renameCampaignProject(project,'../bad'),/identificador/);
});
test('invalid semantic drafts persist but validation blocks missing files, indexes and resources',async()=>{
 const project=await createCampaignProject('studio-invalid');project.world.sectors[0].name='';project.maps.camp.spawns=[];project.mapIndex.maps[1].path='../../outside.json';project.resources['assets/guide.png'].base64=btoa('changed');
 assert.deepEqual(decodeCampaignProject(encodeCampaignProject(project)),project);
 const report=await validateCampaignProject(project);assert.equal(report.valid,false);for(const section of ['world','maps','assets'])assert.ok(report.issues.some(issue=>issue.section===section),section);
 assert.ok(report.issues.some(issue=>/suma de control/.test(issue.message)));
});
test('resource replacement hashes actual bytes and preserves asset identity',async()=>{
 const project=await createCampaignProject('studio-resources'),bytes=projectResourceBytes(project,'assets/guide.png'),changedBytes=new Uint8Array([...bytes,1]);
 const changed=await setProjectResource(project,'assets/guide.png',changedBytes,'image/png');assert.equal(changed.assets.assets[0].id,'guide');assert.notEqual(changed.assets.assets[0].sha256,project.assets.assets[0].sha256);
 assert.equal((await validateCampaignProject(changed)).valid,true);assert.deepEqual(projectResourceBytes(changed,'assets/guide.png'),changedBytes);
 const removed=removeProjectResource(changed,'assets/guide.png');assert.equal((await validateCampaignProject(removed)).valid,false);assert.ok(project.resources['assets/guide.png']);
 await assert.rejects(setProjectResource(project,'assets/../outside.png',bytes,'image/png'),/ruta/);await assert.rejects(setProjectResource(project,'assets/guide.png',bytes,'image/jpeg'),/tipo/);
});
test('project decoding rejects unsafe keys, malformed binary and cyclic draft values',async()=>{
 const project=await createCampaignProject('studio-safe');assert.throws(()=>decodeCampaignProject(JSON.stringify(project).replace('"resources":{','"resources":{"__proto__":{},')),/clave no permitida/);
 project.resources['assets/guide.png'].base64='not base64';assert.throws(()=>encodeCampaignProject(project),/bytes codificados/);
 const cyclic=await createCampaignProject('studio-cycle');cyclic.content.self=cyclic.content;assert.throws(()=>encodeCampaignProject(cyclic),/sin ciclos/);
});
