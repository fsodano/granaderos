import {actBattle} from '../game/tactical.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignProject,projectContent,validateCampaignProject} from '../game/campaign-editor-project.js';
import {addProjectLocality,moveProjectLocality,updateProjectLocality,updateProjectCell,setProjectDistrict,setProjectLocalityLink,deleteProjectLocality,setProjectMap,saveProjectBuildingTemplate,setProjectBuildingSlab} from '../game/campaign-editor-world.js';
import {applyMapCommands,buildingTemplate,makeBuilding} from '../game/map-commands.js';
import {validateMap,serializeMap,parseMap} from '../game/map-schema.js';
import {compileMap} from '../game/compile-map.js';
import {createMapPlaytest} from '../game/map-playtest.js';
import {buildTerrace} from '../game/buildings.js';
import {renderBuilding} from './campaign-building-render-fixture.mjs';
const project=()=>createCampaignProject('studio-world','Editor de frontera');
async function valid(p){const report=await validateCampaignProject(p);assert.deepEqual(report.issues,[]);}
const edited=(doc,commands)=>{const result=applyMapCommands(doc,commands);assert.deepEqual(result.errors,[]);return result.document;};
function withHouse(p,roof='thatch'){const next=structuredClone(p);next.maps.camp=edited(next.maps.camp,[{type:'addBuilding',building:{id:'house-1',x:7,y:4,width:5,height:5,architecture:'house',roof}}]);return next;}

test('grid authoring adds a playable indexed map, moves its anchor and preserves fixed identities',async()=>{
 const original=await project(),before=JSON.stringify(original);let p=addProjectLocality(original,{id:'market',name:'Mercado',cellId:'cell-17-17'});await valid(p);
 assert.throws(()=>addProjectLocality(original,{id:'cell-0-0',name:'Otra',cellId:'cell-17-17'}),/identidad/);assert.equal(JSON.stringify(original),before);assert.equal(p.maps.market.id,'market');assert.equal(p.maps.market.width,20);assert.ok(p.mapIndex.maps.some(m=>m.id==='market'));
 p=setProjectDistrict(p,'cell-17-18','market');p=moveProjectLocality(p,'market','cell-18-17');p=updateProjectLocality(p,'market',{name:'Mercado nuevo'});p=setProjectLocalityLink(p,'market','camp',true);await valid(p);
 const old=p.world.cells.find(c=>c.id==='cell-17-17'),anchor=p.world.cells.find(c=>c.id==='cell-18-17');assert.equal(old.location,old.id);assert.equal(anchor.location,'market');assert.equal(anchor.grid,'19,18');assert.equal(anchor.name,'Mercado nuevo');assert.equal(p.maps.market.metadata.title,'Mercado nuevo');assert.deepEqual(p.world.sectors.find(s=>s.id==='camp').neighbors,['watch-post','market']);
 assert.throws(()=>updateProjectCell(p,anchor.id,{land:false}),/distrito/);assert.throws(()=>moveProjectLocality(p,'market','cell-0-0'),/terrestre/);assert.throws(()=>updateProjectCell(p,old.id,{col:1}),/fijas/);
 p=deleteProjectLocality(p,'market');await valid(p);assert.equal(p.maps.market,undefined);assert.ok(!p.mapIndex.maps.some(m=>m.id==='market'));assert.ok(!p.world.cells.some(c=>c.locality==='market'));assert.ok(!p.world.sectors.find(s=>s.id==='camp').neighbors.includes('market'));
});
test('deletion reports authored references and prevents silent dangling quests, cities and headquarters',async()=>{
 let p=await project();assert.throws(()=>deleteProjectLocality(p,'camp'),/content.headquarters/);
 p=addProjectLocality(p,{id:'market',name:'Mercado',cellId:'cell-17-17'});p.content.placements=[{characterId:'guide',sector:'market'}];assert.throws(()=>deleteProjectLocality(p,'market'),/content.placements\[0\].sector/);
 p.content.placements=[];p.world.cities=[{id:'town',name:'Villa',sectors:['market']}];assert.throws(()=>deleteProjectLocality(p,'market'),/world.cities/);
});
test('map updates keep package dimensions and identity while retaining explicit finishes and undoable clears',async()=>{
 const p=withHouse(await project());assert.throws(()=>setProjectMap(p,'camp',{...p.maps.camp,id:'other'}),/identidad/);assert.throws(()=>setProjectMap(p,'camp',{...p.maps.camp,width:30}),/20/);
 const explicit=edited(p.maps.camp,[{type:'setObject',id:'house-1',values:{wallFinish:'limewash'}}]);const clear=edited(explicit,[{type:'setObject',id:'house-1',values:{wallFinish:null}}]);assert.equal(clear.buildings[0].wallFinish,undefined);assert.equal(explicit.buildings[0].wallFinish,'limewash');assert.equal(setProjectMap(p,'camp',clear).maps.camp.revision,clear.revision);
});
test('authored slabs compile, validate, survive template move/rotate/duplicate and enter real previews',async()=>{
 let p=withHouse(await project(),'terrace');const b=p.maps.camp.buildings[0];Object.assign(p.maps.camp,buildTerrace(b,{elevation:4,climbPoints:[{id:'west',from:{x:6,y:6},to:{x:7,y:6}}]}));
 assert.equal(validateMap(p.maps.camp).valid,true);const parsed=parseMap(serializeMap(p.maps.camp));assert.equal(compileMap(parsed).upperSurfaces[0].elevation,4);
 p=saveProjectBuildingTemplate(p,buildingTemplate(parsed,b.id));assert.ok(p.editor.buildingTemplates[0].climbLinks.length);assert.equal(p.content.editor,undefined);
 let doc=edited(parsed,[{type:'moveObject',id:b.id,x:8,y:4}]);assert.equal(doc.upperSurfaces[0].x,8);doc=edited(doc,[{type:'rotateObject',id:b.id}]);assert.ok(doc.climbLinks[0].to.tacticalLevel===1);
 const target=await project();target.maps.camp=edited(target.maps.camp,[{type:'stampTemplate',id:'copy',template:p.editor.buildingTemplates[0],x:7,y:4}]);const battle=createMapPlaytest(target.maps.camp,projectContent(target));assert.equal(battle.upperSurfaces[0].elevation,4);assert.equal(battle.climbLinks[0].from.x,6);assert.ok(battle.upperSurfaces.every(s=>s.buildingId==='copy'));const slabMesh=renderBuilding(battle,battle.buildings[0]);try{assert.equal(slabMesh.object.userData.height,4);assert.ok(slabMesh.meshes.length>0);}finally{slabMesh.dispose();}
 const bad=structuredClone(parsed);bad.upperSurfaces[0].elevation=-1;assert.equal(validateMap(bad).valid,false);
 const duplicate=edited(parsed,[{type:'duplicateObject',id:b.id,newId:'second',x:1,y:1}]);assert.equal(duplicate.upperSurfaces.length,50);assert.ok(duplicate.upperSurfaces.some(s=>s.buildingId==='second'));assert.equal(new Set(duplicate.climbLinks.map(l=>l.id)).size,2);
 const deleted=edited(parsed,[{type:'deleteObject',id:b.id}]);assert.deepEqual(deleted.upperSurfaces,[]);assert.deepEqual(deleted.climbLinks,[]);
});
test('selected preview renders actual authored and generated materials and applies finite physical sources',async()=>{
 const p=withHouse(await project());p.world.expansion.rural=[];p.world.ruralSectors=[];p.world.expansion.buildingTargets.camp=3;Object.assign(p.world.buildings.types.house,{wall:'#2457a3',trim:'#ffd34e',roof:'thatch',height:100});p.world.physical.environment.camp={doors:[],containers:[{selector:{id:'supply-chest',type:'chest'},configuration:{type:'chest',open:false,locked:true,keyId:'studio-key',contents:[]}}]};p.maps.camp=edited(p.maps.camp,[{type:'addObject',layer:'props',object:{id:'supply-chest',type:'chest',x:3,y:3}}]);
 const before=JSON.stringify(p),compact=createMapPlaytest(p.maps.camp,projectContent(p)),chest=compact.props.find(p=>p.id==='supply-chest');assert.equal(chest.locked,true);assert.equal(chest.keyId,'studio-key');assert.equal(compact.buildings[0].campaignStyle.wall,'#2457a3');assert.ok(!compact.upperSurfaces?.length);
 const mesh=renderBuilding(compact,compact.buildings[0]);try{assert.ok(mesh.colours.has('2457a3'));assert.ok(mesh.colours.has('ffd34e'));assert.ok(mesh.materialNames.has('world:thatch'));assert.ok(mesh.meshes.length>0);}finally{mesh.dispose();}
 const expanded=createMapPlaytest(p.maps.camp,projectContent(p),{expanded:true});assert.ok(expanded.width>20);assert.ok(expanded.buildings.length>compact.buildings.length);const generated=expanded.buildings.find(b=>b.id!=='house-1');assert.equal(generated.roof,'thatch');const roof=renderBuilding(expanded,generated);try{assert.ok(roof.colours.has('2457a3'));assert.ok(roof.materialNames.has('world:thatch'));}finally{roof.dispose();}
 assert.equal(JSON.stringify(p),before);
});

test('building slab authoring creates a valid real access and rejects invalid heights atomically',async()=>{
 const p=withHouse(await project()),before=JSON.stringify(p);const next=setProjectBuildingSlab(p,'camp','house-1',{elevation:4,slabThickness:.4});assert.equal(next.maps.camp.upperSurfaces.length,25);assert.equal(next.maps.camp.climbLinks.length,1);assert.equal(next.maps.camp.buildings[0].roof,'terrace');assert.equal(next.maps.camp.upperSurfaces[0].elevation,4);assert.equal(JSON.stringify(p),before);await valid(next);
 assert.throws(()=>setProjectBuildingSlab(p,'camp','house-1',{elevation:1,slabThickness:2}),/height/);const cleared=setProjectBuildingSlab(next,'camp','house-1',null);assert.deepEqual(cleared.maps.camp.upperSurfaces,[]);assert.deepEqual(cleared.maps.camp.climbLinks,[]);await valid(cleared);
});

test('playtest uses selected finite supplies and the real owned arsenal reveal path',async()=>{
 const p=await project();p.maps.camp=edited(p.maps.camp,[{type:'addObject',layer:'props',object:{id:'arsenal-chest',type:'chest',x:4,y:8}}]);
 p.maps.camp.wallEdges=[7,8,9].map(y=>({id:`screen-${y}`,axis:'y',x:10,y,type:'wall'}));p.world.physical.caches.camp={chest:'arsenal-chest',contents:[{item:'medkits',count:7,weight:.2}]};p.world.physical.arsenals.camp={version:1,sector:'camp',chest:'arsenal-chest',pieces:[{id:'arsenal:studio:1',type:'swivel',side:'player',loaded:false,ammo:2}]};p.world.physical.environment.camp={doors:[],containers:[{selector:{id:'arsenal-chest',type:'chest'},configuration:{type:'chest',open:false,locked:false}}]};await valid(p);
 let battle=createMapPlaytest(p.maps.camp,projectContent(p));battle=actBattle(battle,{type:'environment',unitId:battle.units.find(u=>u.side==='player').id,kind:'container',id:'arsenal-chest',verb:'open'});assert.equal(battle.lastError,null);const chest=battle.props.find(p=>p.id==='arsenal-chest');assert.equal(chest.contents[0].count,7);assert.equal(chest.knownToPlayer,true);assert.deepEqual(chest.artilleryRecovered,['arsenal:studio:1']);assert.equal(battle.artillery.find(g=>g.id==='arsenal:studio:1').ammo,2);assert.equal(p.maps.camp.props[0].contents,undefined);
});
