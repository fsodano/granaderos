import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateCampaignDefinitionFields,validateCampaignWorld} from '../game/campaign-definition.js';
import {validateCampaignPresentation} from '../game/campaign-presentation-validation.js';
import {scaffoldDocuments} from '../tools/campaign-authoring.mjs';

const generic=scaffoldDocuments('validation-fixture');
const fixture=()=>structuredClone(generic);
const compile=value=>compileCampaignPackage(value.manifest,value);
const rejects=(mutate,pattern)=>{const value=fixture();mutate(value);assert.throws(()=>compile(value),pattern);};
const read=async path=>JSON.parse(await readFile(new URL(`../campaigns/granaderos/${path}`,import.meta.url),'utf8'));
const manifest=await read('manifest.json'),stock={manifest};
for(const key of ['content','world','presentation','assets'])stock[key]=await read(manifest[key]);
const index=await read(manifest.maps);stock.maps=Object.fromEntries(await Promise.all(index.maps.map(async entry=>[entry.id,await read(`maps/${entry.path}`)])));
const weather=()=>({version:1,seed:42,climates:{mild:{name:'Templado',terrain:'Pradera',humidity:[20,30,40,50],rain:[10,20,30,40]}},regions:{camp:'mild'},fallbacks:{default:'mild',biomes:{plains:'mild'},theaters:{frontier:'mild'}}});

test('stock and independent generic package pass structural admission',()=>{
 for(const value of [stock,generic]){
  assert.deepEqual(validateCampaignWorld(value.world),[]);
  assert.deepEqual(validateCampaignPresentation(value.presentation,{...value.content,scenario:value.manifest.scenario,world:value.world,maps:value.maps}),[]);
  const compiled=compile(value);assert.equal(compiled.id,value.manifest.id);assert.ok(Object.isFrozen(compiled.world.cells));assert.ok(Object.isFrozen(compiled.maps));
 }
});

test('malformed world structures return errors without throwing',async t=>{
 const cases={
  'null world':value=>value.world=null,
  'null sector':value=>value.world.sectors[0]=null,
  'numeric neighbors':value=>value.world.sectors[0].neighbors=1,
  'null cell':value=>value.world.cells[10]=null,
  'non-list districts':value=>value.world.districts.camp=42,
  'non-list geography':value=>value.world.geography.land=42,
  'null building catalogue':value=>value.world.buildings=null,
  'null building style':value=>value.world.buildings.types.house=null,
  'non-list building selection':value=>value.world.expansion.defaultBuildingSelection=42,
  'non-object expansion':value=>value.world.expansion=[],
  'null transport':value=>value.world.travel=null,
  'invalid weather profiles':value=>value.world.weather={climates:42},
  'non-list scene entries':value=>value.world.sceneEntries=42,
  'non-list scene exits':value=>value.world.sceneExits={post:{sector:'camp',exits:42}},
  'null merchant policy':value=>value.world.merchantPolicies=null,
  'undefined nested value':value=>value.world.extra=undefined,
  'non-finite position':value=>value.world.cells[0].x=Infinity,
  'executable value':value=>value.world.extra=()=>true,
  'cyclic world':value=>value.world.extra=value.world,
 };
 for(const [name,mutate]of Object.entries(cases))await t.test(name,()=>{
  const value=fixture();mutate(value);let errors;
  assert.doesNotThrow(()=>{errors=validateCampaignWorld(value.world);});assert.ok(errors.length,name);
  assert.throws(()=>compile(value));
 });
});

test('world semantic errors cannot enter an installed package',async t=>{
 const cases={
  'wrong strategic dimensions':v=>v.world.columns=35,
  'unknown theater':v=>v.world.sectors[0].theater='missing',
  'unknown biome':v=>v.world.cells[0].biome='desert',
  'incorrect grid label':v=>v.world.cells[0].grid='2,1',
  'duplicate cell coordinates':v=>v.world.cells[1]={...v.world.cells[0]},
  'district with no record':v=>delete v.world.districts.camp,
  'district in wrong locality':v=>v.world.districts.camp[0].sectorId='watch-post',
  'nonreciprocal road':v=>v.world.sectors[1].neighbors=[],
  'road across disconnected land':v=>{for(const c of v.world.cells)if(c.col===17&&c.land){c.land=false;c.biome='water';}},
  'invalid tactical road anchor':v=>v.world.exitLinks=[['camp','E',4,8,'watch-post','W',0,8]],
  'unknown tactical destination':v=>v.world.sceneExits={post:{sector:'camp',exits:[{id:'exit',edge:'W',destination:'missing',entryEdge:'E',entryAnchor:{x:19,y:8}}]}},
  'tactical entry off edge':v=>v.world.sceneEntries=[{from:'camp',to:'watch-post',scene:null,entryEdge:'W',entryAnchor:{x:2,y:8}}],
  'invalid main headquarters':v=>v.world.defaultHeadquarters='missing',
  'headquarters lacks barracks':v=>v.world.arrivalFacilities.camp=['post'],
  'missing foundry defaults':v=>delete v.world.defaultFoundry,
  'foundry in unknown locality':v=>v.world.defaultFoundry.sector='missing',
  'missing default roles':v=>delete v.world.defaultRoles,
  'malformed default role':v=>v.world.defaultRoles.marchCommander=57,
  'unknown effective role character':v=>{delete v.content.campaignRoles;v.world.defaultRoles.marchCommander='missing';},
  'missing income sources':v=>delete v.world.incomeSources,
  'invalid income source':v=>v.world.incomeSources=[{id:'pay',name:'Ingreso',source:'Trabajo',sectorId:'camp',requiredSectors:['camp'],dailyAmount:50,representative:{npcId:'clerk',name:'Responsable',sectorId:'missing'}}],
  'unknown architecture':v=>v.world.buildings.types.palace={...v.world.buildings.types.house},
  'invalid building color':v=>v.world.buildings.types.house.wall='red',
  'invalid building footprint':v=>v.world.buildings.footprints.house=[0,4],
  'unknown paved street locality':v=>v.world.expansion.pavedStreets=['missing'],
  'invalid deployment position':v=>v.world.defaultDeployment={playerAnchors:[{x:20,y:4}]},
  'zero projection scale':v=>v.world.projection.longitudeScale=0,
  'out of range longitude':v=>v.world.projection.minLongitude=181,
  'out of range latitude':v=>v.world.projection.maxLatitude=-91,
  'excessive projection scale':v=>v.world.projection.latitudeScale=10001,
  'unknown projection field':v=>v.world.projection.extra=1,
  'unknown flotilla theater':v=>v.world.travel={flotillaTheaters:['missing']},
  'weather unknown climate':v=>{v.world.weather=weather();v.world.weather.regions.camp='missing';},
  'weather invalid humidity':v=>{v.world.weather=weather();v.world.weather.climates.mild.humidity[0]=100;},
  'weather unknown theater':v=>{v.world.weather=weather();v.world.weather.fallbacks.theaters={missing:'mild'};},
  'invalid polygon ring':v=>v.world.geography.land=[{type:'Polygon',coordinates:[[[1,1],[2,2]]]}],
  'invalid physical locality':v=>v.world.physical.environment.missing={doors:[],containers:[]},
  'invalid merchant percentage':v=>v.world.merchantPolicies={preferences:{camp:{name:'Responsable',description:'Recibe equipo.',buyPercent:100,preferredPercent:50,preferredItems:[],minimumWeaponCondition:0,weaponRefusal:null}},legacyAmmunitionLimits:{},defaultLegacyAmmunitionLimit:60},
  'merchant in unknown locality':v=>v.world.merchantPolicies={preferences:{},legacyAmmunitionLimits:{missing:50},defaultLegacyAmmunitionLimit:60},
 };
 for(const [name,mutate]of Object.entries(cases))await t.test(name,()=>rejects(mutate));
});

test('optional projection, navigation, weather and merchant policies admit valid data',()=>{
 const v=fixture();v.world.weather=weather();v.world.travel={flotillaTheaters:['frontier']};v.world.merchantPolicies={preferences:{},legacyAmmunitionLimits:{camp:50},defaultLegacyAmmunitionLimit:60};
 assert.equal(compile(v).world.weather.seed,42);
 delete v.world.projection;assert.deepEqual(validateCampaignWorld(v.world),[]);
 delete v.content.campaignRoles;v.world.defaultRoles.marchCommander='guide';assert.equal(compile(v).world.defaultRoles.marchCommander,'guide');
 v.world.defaultRoles.marchCommander='missing';v.content.campaignRoles={foundryEngineer:null,marchCommander:null};assert.equal(compile(v).campaignRoles.marchCommander,null);
});

test('map admission requires complete playable generic maps',async t=>{
 const cases={
  'missing locality map':[v=>delete v.maps['watch-post'],/Falta el mapa/],
  'missing scene map':[v=>v.world.sceneExits.post={sector:'camp',exits:[]},/Falta el mapa de la escena/],
  'wrong map identity':[v=>v.maps.camp.id='other',/otra identidad/],
  'unsupported tactical grid':[v=>v.maps.camp.width=21,/20 columnas y 16 filas/],
  'missing player spawn':[v=>v.maps.camp.spawns=v.maps.camp.spawns.filter(s=>s.side!=='player'),/aparición del jugador/],
  'missing enemy spawn':[v=>v.maps.camp.spawns=v.maps.camp.spawns.filter(s=>s.side!=='enemy'),/aparición adversaria/],
  'blocked player entry':[v=>v.maps.camp.terrain.find(c=>c.x===3&&c.y===8).blocked=true,/bloqueada/],
  'unreachable enemy spawn':[v=>{for(const c of v.maps.camp.terrain)if(c.x===10)c.blocked=true;},/sin ruta/],
  'unavailable selected building style':[v=>{delete v.world.buildings.types.warehouse;delete v.world.buildings.footprints.warehouse;v.maps.camp.buildings.push({id:'warehouse',x:5,y:3,width:3,height:3,material:'adobe',roof:'tile',architecture:'warehouse',walls:[],rooms:[]});},/necesita el estilo/],
 };
 for(const [name,[mutate,pattern]]of Object.entries(cases))await t.test(name,()=>rejects(mutate,pattern));
});

test('selected asset references require matching files, image types and checksums',async t=>{
 const cases={
  'missing asset catalogue version':v=>delete v.assets.version,
  'missing checksum':v=>delete v.assets.assets[0].sha256,
  'invalid checksum':v=>v.assets.assets[0].sha256='changed',
  'wrong image MIME':v=>v.assets.assets[0].type='image/jpeg',
  'null image MIME':v=>v.assets.assets[0].type=null,
  'missing declared image':v=>v.assets.assets=[],
  'duplicate asset':v=>v.assets.assets.push({...v.assets.assets[0]}),
  'path traversal':v=>v.assets.assets[0].path='assets/../guide.png',
  'foreign content image':v=>v.content.characters[0].portrait='/campaigns/other/assets/guide.png',
  'foreign world image':v=>v.world.places.camp.image='/campaigns/other/assets/guide.png',
  'foreign map image':v=>v.maps.camp.metadata.image='/campaigns/other/assets/guide.png',
  'foreign presentation image':v=>v.presentation.menuArt='/campaigns/other/assets/guide.png',
  'unbundled legacy image':v=>v.content.characters[0].portrait='/art/portrait-0.webp',
  'unbundled map resource':v=>v.maps.camp.metadata.image='/art/convent.png',
  'JSON asset used as portrait':v=>{v.assets.assets.push({id:'data',path:'assets/data.json',sha256:'0'.repeat(64),type:'application/json'});v.content.characters[0].portrait='/campaigns/validation-fixture/assets/data.json';},
  'remote image URL':v=>v.presentation.menuArt='https://example.test/face.png',
 };
 for(const [name,mutate]of Object.entries(cases))await t.test(name,()=>rejects(mutate));
 const v=fixture();v.content.characters[0].portrait=`data:image/png;base64,${Buffer.from(v.image).toString('base64')}`;assert.equal(compile(v).id,v.manifest.id);
});

test('presentation admission rejects invalid calendar, portraits and optional renderer data',async t=>{
 const cases={
  'invalid month':v=>v.presentation.calendar.month=13,
  'invalid day':v=>v.presentation.calendar.day=31,
  'null calendar':v=>v.presentation.calendar=null,
  'duplicate local portrait':v=>v.presentation.characterPortraits.push({...v.presentation.characterPortraits[0]}),
  'unknown portrait appearance':v=>v.presentation.characterPortraits[0].spriteAppearance='missing',
  'unknown portrait skin tone':v=>v.presentation.characterPortraits[0].skinTone='blue',
  'missing default local portrait':v=>v.presentation.officerCreation={defaults:{portraitId:'missing'}},
  'unselectable default local portrait':v=>{v.presentation.characterPortraits[0].selectable=false;v.presentation.officerCreation={defaults:{portraitId:'guide-face'}};},
  'malformed creator classes':v=>v.presentation.officerCreation={classes:null,defaults:{classId:'gaucho'}},
  'malformed introduction labels':v=>v.presentation.introduction={scenes:[{id:'start',title:'Inicio',text:'Inicio.',visual:'map',durationMs:0}],chart:{labels:42}},
  'invalid introduction path':v=>v.presentation.introduction={scenes:[{id:'start',title:'Inicio',text:'Inicio.',visual:'map',durationMs:0}],chart:{land:'<script>'}},
  'unknown atlas site':v=>v.presentation.atlas={sites:[{id:'missing',label:'Sitio',lon:1,lat:1}]},
  'invalid atlas coordinates':v=>v.presentation.atlas={longitudes:[181]},
  'malformed atlas labels':v=>v.presentation.atlas={labels:[{x:1,y:null,text:'Sitio'}]},
  'invalid manual value':v=>v.presentation.manual={campaign:42},
  'unknown skirmish map':v=>v.presentation.skirmish={label:'Encuentro',operativeIds:[2000],horse:false,request:{id:'missing',name:'Encuentro',biome:'plains',seed:1,enemyCount:1}},
  'unknown skirmish character':v=>v.presentation.skirmish={label:'Encuentro',operativeIds:[99999],horse:false,request:{id:'camp',name:'Encuentro',biome:'plains',seed:1,enemyCount:1}},
 };
 for(const [name,mutate]of Object.entries(cases))await t.test(name,()=>{
  const value=fixture();mutate(value);let errors;assert.doesNotThrow(()=>{errors=validateCampaignPresentation(value.presentation,{...value.content,scenario:value.manifest.scenario,world:value.world,maps:value.maps});});assert.ok(errors.length);assert.throws(()=>compile(value));
 });
});

test('pinned-definition admission also checks resource integrity and invalid shapes',()=>{
 const compiled=compile(fixture()),copy=structuredClone(compiled);copy.assets.assets[0].type='application/json';assert.ok(validateCampaignDefinitionFields(copy).length);
 const foreign=structuredClone(compiled);foreign.maps.camp.metadata.image='/campaigns/other/assets/guide.png';assert.match(validateCampaignDefinitionFields(foreign).join('\n'),/no pertenece/);
 assert.doesNotThrow(()=>validateCampaignDefinitionFields(null));assert.ok(validateCampaignDefinitionFields(null).length);
 for(const key of ['world','maps','presentation','assets']){const missing=structuredClone(compiled);delete missing[key];assert.match(validateCampaignDefinitionFields(missing).join('\n'),/faltan definiciones/);}
 const map=structuredClone(compiled);map.maps.camp.terrain=null;assert.match(validateCampaignDefinitionFields(map).join('\n'),/definición táctica/);
});
