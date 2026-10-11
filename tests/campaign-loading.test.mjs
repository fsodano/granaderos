import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {blankMap} from '../game/map-schema.js';
import {campaignDocuments,campaignFetch,campaignResponse} from './campaign-library-fixture.mjs';
import {isCampaignAssetReference} from '../game/campaign-assets.js';
import {campaignStorageKey,campaignStorageCandidates,campaignLaunchSearch} from '../game/content-launch.js';
import {initialCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {stageCampaigns,verifyCampaignFolder,campaignFilesPlugin} from '../tools/campaign-export.mjs';
register('./tactical-render-loader.mjs',import.meta.url);
const {loadCampaignRegistry,loadInstalledCampaign,verifyCampaignResources}=await import('../web/lib/campaign-library.ts');
const {portraitFor}=await import('../web/lib/portraits.ts');
const asset=Buffer.from('portable campaign image'),sha256=createHash('sha256').update(asset).digest('hex');
function documents(){
 const docs=new Map([...campaignDocuments].map(([path,value])=>[path,structuredClone(value)])),entry={id:'another',name:'Otra campaña',revision:'1',manifest:'another/manifest.json'};
 for(const [path,value]of campaignDocuments)if(path.startsWith('/campaigns/granaderos/'))docs.set(path.replace('/granaderos/','/another/'),structuredClone(value));
 for(const [path,map]of docs)if(/^\/campaigns\/another\/maps\/(?!index\.json$)[^/]+\.json$/.test(path)){const next=blankMap({id:map.id,title:map.metadata.title});next.spawns=[{id:'player-entry',side:'player',x:3,y:8},{id:'enemy-entry',side:'enemy',x:16,y:8}];docs.set(path,next);}
 const manifest=docs.get('/campaigns/another/manifest.json');Object.assign(manifest,entry,{format:'granaderos-campaign',version:1,scenario:'generic-v1'});delete manifest.manifest;
 const content=docs.get('/campaigns/another/content.json');content.id='another';content.name=entry.name;content.characters=[content.characters.find(character=>character.id==='person-100')];content.placements=[];content.errands=[];content.quests=[];content.includeOriginalResidents=false;content.campaignRoles={foundryEngineer:null,marchCommander:null};content.characters[0].portrait='/campaigns/another/assets/portraits/actor.png';content.characters[0].skinTone='dark';for(const weapon of content.weapons)weapon.art='/campaigns/another/assets/portraits/actor.png';
 docs.set('/campaigns/another/presentation.json',{version:1,title:entry.name,menuArt:'/campaigns/another/assets/portraits/actor.png'});
 const world=docs.get('/campaigns/another/world.json');world.cells.find(cell=>cell.location==='retiro').name='La guardia';world.sectors.find(sector=>sector.id==='retiro').name='La guardia';
 docs.set('/campaigns/another/assets.json',{version:1,assets:[{id:'actor',path:'assets/portraits/actor.png',sha256,type:'image/png'}]});
 docs.get('/campaigns/index.json').campaigns.push(entry);
 const bytes=new Map([['/campaigns/another/assets/portraits/actor.png',asset]]);
 return {docs,entry,bytes,reader:async(path)=>campaignResponse(docs,path,bytes)};
}
test('browser discovers campaigns, loads the selected pinned package, and restores its asset and world data',async()=>{
 const {reader,entry}=documents(),entries=await loadCampaignRegistry({reader});assert.equal(entries.length,2);
 const loaded=await loadInstalledCampaign(entry,{reader}),state=initialCampaign(1,loaded.content),restored=decodeSave(encodeSave(state)).campaign;
 assert.equal(loaded.presentation.title,'Otra campaña');assert.equal(restored.campaignOrigin.id,'another');assert.equal(restored.contentCampaign.package.world.cells.find(cell=>cell.location==='retiro').name,'La guardia');
 assert.equal(restored.contentCampaign.package.characters[0].skinTone,'dark');assert.equal(portraitFor(restored.contentCampaign.package.characters[0].portrait),'/campaigns/another/assets/portraits/actor.png');
 assert.notEqual(campaignStorageKey(state),campaignStorageKey(initialCampaign(1,(await loadInstalledCampaign(entries[0],{reader})).content)));
 assert.equal(campaignStorageKey(state,'?qa=1'),campaignStorageKey(state)+'.qa');assert.deepEqual(campaignStorageCandidates(state),[campaignStorageKey(state)]);
 assert.equal(new URLSearchParams(campaignLaunchSearch(state,'?qa=1&content=1')).get('campaign'),'another');
});
test('loader rejects mismatched manifests, duplicate map ids and traversal before reading outside a campaign',async()=>{
 const fixture=documents();fixture.docs.get('/campaigns/another/manifest.json').revision='2';await assert.rejects(loadInstalledCampaign(fixture.entry,{reader:fixture.reader}),/no coinciden/);
 fixture.docs.get('/campaigns/another/manifest.json').revision='1';const index=fixture.docs.get('/campaigns/another/maps/index.json');index.maps.push(index.maps[0]);await assert.rejects(loadInstalledCampaign(fixture.entry,{reader:fixture.reader}),/repetido/);
 index.maps.pop();index.maps[0].path='../../outside.json';await assert.rejects(loadInstalledCampaign(fixture.entry,{reader:fixture.reader}),/ruta de archivo/);
 for(const path of ['/campaigns/another/assets/../actor.png','/campaigns/another/assets/actor.png?x=1','https://elsewhere/actor.png','/campaigns/another/assets/actor.svg'])assert.equal(isCampaignAssetReference(path),false);
});
test('saved resource verification detects changed or missing bytes without replacing its pinned package',async()=>{
 const fixture=documents(),loaded=await loadInstalledCampaign(fixture.entry,{reader:fixture.reader}),saved=initialCampaign(3,loaded.content),original=structuredClone(saved.contentCampaign.package);
 fixture.bytes.set('/campaigns/another/assets/portraits/actor.png',Buffer.from('different image'));
 await assert.rejects(verifyCampaignResources(saved,{reader:fixture.reader,refresh:true}),/El recurso cambió.*actor.png.*Instalá la revisión 1 usada/);
 assert.deepEqual(saved.contentCampaign.package,original);
 fixture.bytes.delete('/campaigns/another/assets/portraits/actor.png');
 await assert.rejects(verifyCampaignResources(saved,{reader:fixture.reader,refresh:true}),/Falta un recurso.*actor.png.*Instalá la revisión 1 usada/);
 const editor=structuredClone(saved);delete editor.campaignOrigin;delete editor.contentCampaign.package.campaignOrigin;
 await assert.rejects(verifyCampaignResources(editor,{reader:fixture.reader,refresh:true}),/Falta un recurso.*actor.png.*Instalá la revisión usada por esta partida/);
});
test('static export discovers a second local campaign, preserves nested assets, and verifies their checksums',async()=>{
 const root=await mkdtemp(join(tmpdir(),'campaign-export-'));try{
  const {docs}=documents();for(const [path,value]of docs){const file=join(root,path.slice(1));await mkdir(join(file,'..'),{recursive:true});await writeFile(file,JSON.stringify(value));}
  for(const item of campaignDocuments.get('/campaigns/granaderos/assets.json').assets){const file=join(root,'campaigns/granaderos',item.path);await mkdir(join(file,'..'),{recursive:true});await writeFile(file,await readFile(new URL(`../campaigns/granaderos/${item.path}`,import.meta.url)));}
  await mkdir(join(root,'campaigns/another/assets/portraits'),{recursive:true});await writeFile(join(root,'campaigns/another/assets/portraits/actor.png'),asset);
  await mkdir(join(root,'dist/campaigns'),{recursive:true});await writeFile(join(root,'dist/campaigns/editor-example.json'),'{}');
  const registry=await stageCampaigns(root,join(root,'dist'));assert.equal(registry.campaigns.length,2);assert.deepEqual(await readFile(join(root,'dist/campaigns/another/assets/portraits/actor.png')),asset);
  assert.equal(await readFile(join(root,'dist/campaigns/editor-example.json'),'utf8'),'{}');
  assert.equal(JSON.parse(await readFile(join(root,'dist/campaigns/index.json'))).campaigns.length,2);
  await writeFile(join(root,'campaigns/another/assets/portraits/actor.png'),'changed');await assert.rejects(verifyCampaignFolder(join(root,'campaigns/another')),/checksum mismatch/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('development middleware serves prefixed campaign documents and blocks traversal',async()=>{
 let prefix,handler;campaignFilesPlugin(new URL('..',import.meta.url).pathname,'/granaderos').configureServer({middlewares:{use(path,fn){prefix=path;handler=fn;}}});assert.equal(prefix,'/granaderos/campaigns');
 const request=async(path)=>{let body,statusCode=200;const response={setHeader(){},set statusCode(value){statusCode=value;},end(value){body=value;}};await handler({url:path},response,()=>{});return {body,statusCode};};
 assert.equal(JSON.parse((await request('/index.json')).body).campaigns[0].id,'granaderos');assert.equal(JSON.parse((await request('/granaderos/manifest.json')).body).id,'granaderos');assert.equal((await request('/../package.json')).statusCode,400);
});
