import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../tools/campaign-authoring.mjs';
import {verifyCampaignFolder} from '../tools/campaign-export.mjs';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {buildSectorMap} from '../game/maps.js';
import {applyMapCommands} from '../game/map-commands.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {validateCampaignSceneDefinitions} from '../game/campaign-scene-definitions.js';
import {renderBuilding,tileMetres} from './campaign-building-render-fixture.mjs';
const {WorldGeometry,disposeWorldNode}=await import('../web/lib/three/world-geometry.ts');
const {WorldMaterials}=await import('../web/lib/three/world-materials.ts');
const {buildUpperSurfaces}=await import('../web/lib/three/world-terrain.ts');
const {Box3}=await import('../web/node_modules/three/build/three.module.js');

const V=25.066666666666666;
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
function fixture(style={},architecture='house',authored={}){
 const documents=scaffoldDocuments('building-style');
 documents.world.ruralSectors=[];documents.world.expansion.rural=[];
 documents.world.expansion.defaultBuildingSelection=[architecture];
 Object.assign(documents.world.buildings.types[architecture],{wall:'#2457a3',trim:'#ffd34e',roof:'thatch',height:90},style);
 documents.content.campaignStory.chapters[0].conditions[0].min=100;
 if(authored.kind){
  const result=applyMapCommands(documents.maps.camp,[{type:'addBuilding',building:{id:'authored-house',x:7,y:2,width:6,height:5,...authored}}]);
  assert.deepEqual(result.errors,[]);documents.maps.camp=result.document;
 }
 const definitions=compileCampaignPackage(documents.manifest,documents),map=buildSectorMap({sector:'camp',squad:[],enemies:[],campaignPackage:definitions});
 return {documents,definitions,map,building:map.buildings[0]};
}
function roofRange(render,material){
 const positions=render.meshes.filter(mesh=>mesh.materials.some(m=>m.name===material)).flatMap(mesh=>mesh.attributes.position.filter((_,i)=>i%3===1));
 assert.ok(positions.length,`the real mesh must contain ${material}`);return [Math.min(...positions),Math.max(...positions)];
}

test('selected generic wall, trim and height change real generated meshes without renderer mutation',()=>{
 const f=fixture(),before=JSON.stringify(f.map),render=renderBuilding(f.map,f.building);
 assert.equal(f.building.roof,'thatch');assert.ok(render.colours.has('2457a3'));assert.ok(render.colours.has('ffd34e'));
 assert.equal(render.object.userData.height,90/V);assert.equal((f.map.upperSurfaces??[]).length,0);
 const range=roofRange(render,'world:thatch');assert.ok(range[1]-range[0]>.5,'the selected thatch roof has pitched panels');
 assert.equal(JSON.stringify(f.map),before,'rendering preserves all simulation records');
 const other=fixture({wall:'#702030',trim:'#aabbcc',height:120}),different=renderBuilding(other.map,other.building);
 assert.ok(different.colours.has('702030'));assert.ok(different.colours.has('aabbcc'));assert.equal(different.object.userData.height,120/V);
 assert.notEqual(render.hash,different.hash);render.dispose();different.dispose();
});

test('generated tile, thatch and terrace roofs use their actual materials and tactical slab geometry',()=>{
 for(const roof of ['tile','thatch','terrace']){
  const f=fixture({roof}),render=renderBuilding(f.map,f.building);
  assert.equal(f.building.roof,roof);
  if(roof==='terrace'){
   assert.ok(f.map.upperSurfaces.length>0);assert.ok(f.map.climbLinks.length>0);assert.equal(render.object.userData.height,3,'metric slab elevation wins over style height');
   assert.ok(!render.materialNames.has('world:thatch')&&!render.materialNames.has('world:clay'));
   const geometry=new WorldGeometry(),materials=new WorldMaterials({tileMetres,assetUrl:p=>p}),input={terrain:{...f.map},revealedRooms:[]};
   const slab=buildUpperSurfaces(f.map.upperSurfaces,input,tileMetres,geometry,materials),deck=slab.children.find(mesh=>mesh.material?.name==='world:upper-roof'),bounds=new Box3().setFromObject(deck);
   assert.ok(deck,'the terrace must generate rendered slab meshes');assert.ok(bounds.max.y>=3&&bounds.max.y<3.05);assert.ok(bounds.max.y-bounds.min.y<.5,'the roof deck is flat; the parapets remain separate');
   disposeWorldNode(slab);geometry.dispose();materials.dispose();
  }else{
   assert.equal((f.map.upperSurfaces??[]).length,0);assert.equal((f.map.climbLinks??[]).length,0);
   assert.ok(render.materialNames.has(roof==='tile'?'world:clay':'world:thatch'));
   assert.ok(!render.materialNames.has(roof==='tile'?'world:thatch':'world:clay'));
   const range=roofRange(render,roof==='tile'?'world:clay':'world:thatch');assert.ok(range[1]-range[0]>.5);
  }
  render.dispose();
 }
});

test('explicit authored map roof and finishes win over selected building defaults',()=>{
 const f=fixture({},'house',{kind:'house',architecture:'house',roof:'tile',wallFinish:'stone',roofFinish:'aged'}),render=renderBuilding(f.map,f.building);
 assert.equal(f.building.roof,'tile');assert.ok(render.materialNames.has('world:aged'));assert.ok(!render.materialNames.has('world:thatch'));
 assert.ok(render.materialNames.has('world:stone'));assert.ok(!render.colours.has('2457a3'),'explicit stone is not recoloured by the world default');
 assert.ok(render.colours.has('ffd34e'),'selected trim still applies');assert.equal((f.map.upperSurfaces??[]).length,0);
 render.dispose();
 const terrace=fixture({},'house',{kind:'house',architecture:'house',roof:'terrace',roofFinish:'aged'}),flat=renderBuilding(terrace.map,terrace.building);
 assert.ok(terrace.map.upperSurfaces.length);assert.equal(flat.object.userData.height,3);assert.ok(!flat.materialNames.has('world:thatch'));flat.dispose();
});

test('generated world-grid district houses use their selected roof and real mesh pigments',()=>{
 for(const roof of ['thatch','tile','terrace']){
  const f=fixture({roof}),cell=f.documents.world.cells.find(c=>c.id==='cell-14-16');
  Object.assign(cell,{district:true,locality:'camp'});
  f.documents.world.districts.camp.push({id:'camp:1',sectorId:'camp',col:cell.col,row:cell.row,name:'Barrio propio',x:cell.x,y:cell.y,urban:true});
  const definitions=compileCampaignPackage(f.documents.manifest,f.documents),map=buildSectorMap({sector:cell.id,squad:[],enemies:[],campaignPackage:definitions});
  assert.equal(map.worldCell,true);assert.equal(map.buildings.length,2);
  for(const building of map.buildings){
   assert.equal(building.roof,roof);const before=JSON.stringify(map),render=renderBuilding(map,building);
   assert.ok(render.colours.has('2457a3'));assert.ok(render.colours.has('ffd34e'));
   if(roof==='terrace'){assert.equal(render.object.userData.height,3);assert.ok(map.upperSurfaces.some(s=>s.buildingId===building.id));}
   else{assert.ok(render.materialNames.has(roof==='tile'?'world:clay':'world:thatch'));assert.equal((map.upperSurfaces??[]).length,0);}
   assert.equal(JSON.stringify(map),before);render.dispose();
  }
 }
});

test('selected optional gallery, awning, tower, arcade and upper-storey fields change visible geometry',()=>{
 const cases=[
  {architecture:'farmhouse',flag:'gallery',feature:'farmhouse-gallery'},
  {architecture:'pulperia',flag:'awning',feature:'gallery'},
  {architecture:'church',flag:'tower',feature:'bell-tower'},
  {architecture:'cabildo',flag:'arcade',feature:'civic-ground-arcade'},
  {architecture:'mansion',flag:'upper',feature:'palace-upper-windows'},
 ];
 for(const {architecture,flag,feature}of cases){
  const yes=fixture({height:130,[flag]:true},architecture),no=fixture({height:130,[flag]:false},architecture),shown=renderBuilding(yes.map,yes.building),hidden=renderBuilding(no.map,no.building);
  const named=root=>root.object.getObjectByName(`building-detail:${yes.building.id}:${feature}`);
  const visibleMeshes=object=>{let count=0;object?.traverseVisible(child=>{if(child.isMesh)count++;});return count;};
  assert.ok(visibleMeshes(named(shown))>0,`${architecture}.${flag} must render its supported detail`);
  assert.equal(visibleMeshes(named(hidden)),0,`${architecture}.${flag}=false must omit that visible geometry`);
  assert.notEqual(shown.hash,hidden.hash);shown.dispose();hidden.dispose();
 }
});

test('selected styles survive actual active-save, departure and saved re-entry; forged styles fail admission',()=>{
 const f=fixture();let campaign=initialCampaign(29,f.definitions),guide=rosterFor(campaign).find(c=>c.contentId==='guide');
 campaign=order(campaign,{type:'recruitCivic',id:guide.id,term:'week',destination:'camp'});
 campaign=order(campaign,{type:'visitSector'});const battle=enterSector(campaign.pendingBattle),before=renderBuilding(battle,battle.buildings[0]);
 const wire=encodeSave(campaign,battle),pair=decodeSave(wire),saved=renderBuilding(pair.battle,pair.battle.buildings[0]);assert.equal(saved.hash,before.hash);
 for(const tamper of [b=>{b.campaignStyle.wall='#ff0000';},b=>{b.campaignStyleMode='stock';}]){
  const raw=JSON.parse(wire);tamper(raw.battle.buildings[0]);assert.throws(()=>decodeSave(JSON.stringify(raw)),/estilo táctico/);
 }
 let returned=order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});
 const retainedRaw=JSON.parse(encodeSave(returned));retainedRaw.campaign.sectorStates.camp.buildings[0].campaignStyle.trim='#ff0000';assert.throws(()=>decodeSave(JSON.stringify(retainedRaw)),/estilo táctico/);
 returned=decodeSave(encodeSave(returned)).campaign;const previous=returned.sectorStates.camp;
 returned=order(returned,{type:'visitSector'});const reentered=enterSector(returned.pendingBattle,previous),after=renderBuilding(reentered,reentered.buildings[0]);assert.equal(after.hash,before.hash);
 const old=structuredClone(pair.battle);delete old.buildings[0].campaignStyleMode;delete old.buildings[0].campaignStyle;validateCampaignSceneDefinitions(pair.campaign,old);
 const migrated=renderBuilding(old,old.buildings[0]);assert.equal(migrated.hash,before.hash);
 before.dispose();saved.dispose();after.dispose();migrated.dispose();
});

test('six stock authored and generated mesh signatures remain exact, ordinary and installed',async()=>{
 const stock=await verifyCampaignFolder(new URL('../campaigns/granaderos',import.meta.url).pathname);
 // Captured before this style fix, in a separate Node process using the unchanged
 // feature renderer. Hashes cover real mesh attributes/indices/transforms,
 // material names/pigments and visual height; they are not style metadata hashes.
 const reference=[
  ['retiro','barracks','9fb84017ad898faa3fe4088b7f6a541b67927a78af63794ee58453df12ecc609'],
  ['buenos_aires','house','1abe8c937aa645468b16596c3b5fd6c1466d0a3a9b21c9218d714f2f3e7b5bb0'],
  ['buenos_aires','church','9055da1dfcecc26fede23cbb3c47d53dd637788d748f76e5531155a9d5ca6687'],
  ['buenos_aires','cabildo','28c0ddf77c0e1b4965d2e5987e49dcb07ffd3f4a01860fa045676d8c8aa61699'],
  ['cordoba','house','9a95c563a8e67884f99815fdad34b64fc8c63a1a10ae47afd16e5c128f54d32a'],
  ['cordoba','church','5f03cd6ed93257c6df9365a6f4a237c5f3e1db3561964c63c58241448d1d0244'],
 ];
 for(const campaignPackage of [undefined,stock])for(const [sector,architecture,hash]of reference){
  const map=buildSectorMap({sector,squad:[],enemies:[],...(campaignPackage?{campaignPackage}:{})}),building=map.buildings.find(b=>b.architecture===architecture),render=renderBuilding(map,building);
  assert.equal(render.hash,hash,`${sector}/${architecture}: pre-fix mesh attributes and material pigments must be preserved`);render.dispose();
 }
});
