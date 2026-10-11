import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileCampaignPackage,validateCampaignManifest} from '../game/campaign-library.js';
import {campaignPlace,worldCell,worldContext} from '../game/world-cells.js';
import {buildSectorMap} from '../game/maps.js';
import {initialCampaign,restoreCampaign,serializeCampaign,rosterFor} from '../game/campaign.js';
import {contentIdentity} from '../game/content-identity.js';
import {discoverCampaigns,verifyCampaignFolder} from '../tools/campaign-export.mjs';
import {addPlayableSpawns} from './campaign-playable-fixture.mjs';

const root=new URL('../',import.meta.url).pathname;
const stock=await verifyCampaignFolder(`${root}campaigns/granaderos`);
const manifest=JSON.parse(await readFile(new URL('../campaigns/granaderos/manifest.json',import.meta.url),'utf8'));
function alternate(){
 const content=structuredClone(stock);
 for(const key of ['world','maps','presentation','assets','campaignOrigin','scenario'])delete content[key];
 content.id='frontier';content.name='Frontera';
 const rewrite=value=>typeof value==='string'?value.replaceAll('/campaigns/granaderos/','/campaigns/frontier/'):Array.isArray(value)?value.map(rewrite):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,rewrite(v)])):value;
 Object.assign(content,rewrite(content));
 content.characters=content.characters.filter(c=>c.id==='person-110').map(c=>({...c,traits:[],recruitmentSource:'contract',service:'contract',progression:'experience'}));
 content.placements=[];content.quests=[];delete content.errands;delete content.roadsideDiscoveries;
 content.campaignRoles={foundryEngineer:null,marchCommander:null};
 content.campaignStory={introduction:'Una campaña distinta.',victory:'Objetivo cumplido.',defeat:'La expedición terminó.',chapters:[{id:'first',name:'Primer día',objective:'Llegá al segundo día.',conditions:[{type:'day',min:2,max:null}]}],failureConditions:[]};
 const world=rewrite(structuredClone(stock.world)),maps=rewrite(structuredClone(stock.maps));
 for(const map of Object.values(maps))addPlayableSpawns(map);
 world.sectors.find(s=>s.id==='retiro').name='Fortín del Este';
 world.cells.find(c=>c.location==='retiro').name='Fortín del Este';
 world.buildings.types.barracks.wall='#24304a';
 maps.retiro.metadata.title='Cuartel de la frontera';
 const selected={...manifest,id:'frontier',name:'Frontera',scenario:'generic-v1',revision:'test-1'};
 return {manifest:selected,documents:{content,world,maps,presentation:{version:1,title:'Frontera',calendar:{year:1830,month:1,day:1}},assets:structuredClone(stock.assets)}};
}

test('discovery ships only the current campaign and compiles all referenced maps',async()=>{
 const registry=await discoverCampaigns(root);
 assert.deepEqual(registry.campaigns.map(c=>c.id),['granaderos']);
 assert.equal(stock.world.cells.length,36*33);assert.equal(Object.keys(stock.maps).length,15);
 assert.deepEqual(stock.campaignOrigin,{version:1,id:'granaderos',revision:manifest.revision});
 assert.ok(Object.isFrozen(stock.world.cells));
});

test('two campaign worlds and building styles remain independent in the same engine',()=>{
 const fixture=alternate(),custom=compileCampaignPackage(fixture.manifest,fixture.documents);
 const original=initialCampaign(7,stock),second=initialCampaign(7,custom);
 assert.equal(campaignPlace('retiro',original).name,stock.world.sectors.find(s=>s.id==='retiro').name);
 assert.equal(campaignPlace('retiro',second).name,'Fortín del Este');
 assert.equal(worldCell('retiro',second).name,'Fortín del Este');
 assert.notEqual(worldContext(original),worldContext(second));
 const map=buildSectorMap({sector:'retiro',squad:[],enemies:[],campaignPackage:custom});
 assert.equal(map.mapTitle,'Cuartel de la frontera');
 assert.equal(map.buildings.find(b=>b.architecture==='barracks').campaignStyle.wall,'#24304a');
 assert.equal(original.contentCampaign.package.world.buildings.types.barracks.wall,stock.world.buildings.types.barracks.wall);
 assert.equal(second.errandDefinitions.length,0);assert.equal(second.roadsideDiscoveryDefinitions.length,0);
 assert.deepEqual(restoreCampaign(serializeCampaign(second)).contentCampaign.identity,contentIdentity(custom));
 assert.equal(rosterFor(second).length,1);
});

test('campaign world edits change identity and cannot replace pinned saved definitions',()=>{
 const fixture=alternate(),custom=compileCampaignPackage(fixture.manifest,fixture.documents);
 const saved=serializeCampaign(initialCampaign(7,custom));
 fixture.documents.world.sectors[0].name='Otra localidad';
 const updated=compileCampaignPackage(fixture.manifest,fixture.documents);
 assert.notEqual(contentIdentity(custom).hash,contentIdentity(updated).hash);
 const restored=restoreCampaign(saved);
 assert.equal(restored.contentCampaign.identity.hash,contentIdentity(custom).hash);
 const altered=JSON.parse(saved);altered.contentCampaign.package.world.sectors[0].name='Alterado';
 assert.throws(()=>restoreCampaign(JSON.stringify(altered)),/identidad guardada/);
});

test('folder escape, changed grid and nested foreign campaign assets fail admission',()=>{
 assert.throws(()=>validateCampaignManifest({...manifest,content:'../content.json'}),/referencia/);
 const fixture=alternate();fixture.documents.world.columns=35;
 assert.throws(()=>compileCampaignPackage(fixture.manifest,fixture.documents),/36 columnas/);
 fixture.documents.world.columns=36;
 fixture.documents.presentation.introduction={scenes:[{portrait:'/campaigns/other/assets/face.png'}]};
 assert.throws(()=>compileCampaignPackage(fixture.manifest,fixture.documents),/no pertenece/);
});
