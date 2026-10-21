import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,getReachable} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {sectorExits,adjacentExitIdsFor,boundaryPassable} from '../game/tactical-exits.js';
import {adjacentCells} from '../game/world-cells.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';

const remote='cordoba:buenos_aires',adjacent='cordoba:cell-15-20';
const selectedExits=(context=null,near=adjacent)=>sectorExits('cordoba',null,context).filter(exit=>[remote,near].includes(exit.id));
const router=s=>s.units.find(u=>u.id==='131');
const legacy=s=>{const copy=structuredClone(s);delete copy.adjacentExitIds;return copy;};
const geometry=s=>({x:router(s).x,y:router(s).y,path:router(s).fleePath,ap:router(s).ap,energy:router(s).energy,hp:router(s).hp,loaded:router(s).loaded,ammo:router(s).ammo,elapsedSeconds:s.elapsedSeconds,seed:s.seed});
function issued({context=null,near=adjacent,patch={},exits=selectedExits(context,near)}={}){
 return enterSector({id:'declared-cordoba-rout',sector:'cordoba',hour:12,exploration:true,enemies:[],exits,
  ...(context?{campaignPackage:context}:{}),
  squad:[{id:'131',name:'Retirado',hp:20,energy:100,routed:true,weaponDropped:true,loaded:0,entryReason:'arrival',entryEdge:'E',entryAnchor:{x:19,y:8},...patch},{id:'guard',name:'Guardia',hp:100}],
 });
}

test('a routed Córdoba operative takes the adjacent east cell on the same paid escape path instead of Buenos Aires',()=>{
 const before=issued(),original=structuredClone(before);assert.deepEqual(before.adjacentExitIds,[adjacent]);
 assert.equal(before.width,64);assert.equal(router(before).x,63,'the real expanded map places the declared east arrival on its east boundary');
 const old=endTurn(legacy(before)),next=endTurn(before);
 assert.equal(router(old).departure.destination,'buenos_aires','the legacy alphabetical tie reproduces the observed remote destination');
 assert.equal(router(next).departure.destination,'cell-15-20');assert.equal(router(next).departure.exitId,adjacent);assert.equal(router(next).departure.edge,'E');
 assert.deepEqual(geometry(next),geometry(old),'changing the destination never changes the route, finite crossing costs, wounds or RNG');
 assert.ok(router(next).energy<router(before).energy);assert.ok(next.elapsedSeconds>before.elapsedSeconds);
 assert.deepEqual(next.units.find(u=>u.id==='guard'),old.units.find(u=>u.id==='guard'));assert.deepEqual(before,original);
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(before)));assert.deepEqual(endTurn(saved),next);assert.deepEqual(validateBattleSnapshot(next),next);
});

test('manual east road selection and legacy snapshots keep their explicit and established destinations',()=>{
 const before=issued({patch:{routed:false}}),next=actBattle(before,{type:'exit',unitIds:['131'],exitId:remote});
 assert.equal(next.lastError,null);assert.equal(router(next).departure.destination,'buenos_aires');
 const old=legacy(issued()),saved=validateBattleSnapshot(JSON.parse(JSON.stringify(old)));
 assert.equal(Object.hasOwn(saved,'adjacentExitIds'),false);assert.equal(router(endTurn(saved)).departure.destination,'buenos_aires');
 const onlyRoad=issued({exits:selectedExits().filter(exit=>exit.id===remote)});assert.deepEqual(onlyRoad.adjacentExitIds,[]);
 assert.equal(router(endTurn(onlyRoad)).departure.destination,'buenos_aires','an unavailable adjacent route cannot be added by the tie-break');
});

function flat({x,y,patch={},exits=sectorExits('cordoba').filter(exit=>[remote,'cordoba:cell-14-19'].includes(exit.id))}={}){
 return createBattle([{id:'131',x,y,routed:true,hp:60,loaded:0,weaponDropped:true,...patch},{id:'guard',x:1,y:14}],{
  id:'declared-exit-costs',sector:'cordoba',width:20,height:16,hour:12,exploration:true,enemies:[],exits,
  adjacentExitIds:adjacentExitIdsFor('cordoba',null,exits),
  tiles:Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),
 });
}
test('the adjacent destination uses the same nonempty escape path and pays the same movement and crossing costs',()=>{
 const before=flat({x:12,y:8,exits:selectedExits()}),old=endTurn(legacy(before)),next=endTurn(before);
 assert.equal(router(old).departure.destination,'buenos_aires');assert.equal(router(next).departure.destination,'cell-15-20');
 assert.ok(router(next).fleePath.length>1);assert.equal(router(next).x,19);assert.equal(router(next).y,8);
 assert.deepEqual(geometry(next),geometry(old));assert.ok(router(next).energy<router(before).energy);assert.ok(next.elapsedSeconds>before.elapsedSeconds);
});
test('shorter remote paths and existing ties between different physical edges keep priority',()=>{
 for(const y of [8,1]){
  const before=flat({x:18,y}),routes=getReachable({...before,mode:'exploration'},{...router(before),routed:false});
  const cost=edge=>Math.min(...routes.filter(p=>boundaryPassable(before,p,edge)).map(p=>p.cost));
  if(y===8)assert.ok(cost('E')<cost('N'));else assert.equal(cost('E'),cost('N'));
  const old=endTurn(legacy(before)),next=endTurn(before);
  assert.equal(router(next).departure.destination,'buenos_aires');assert.equal(router(next).departure.edge,'E');
  assert.deepEqual(geometry(next),geometry(old));
 }
});

test('militia, mission allies and enemy routing do not gain the operative preference',()=>{
 for(const patch of [{militia:true,militiaRank:0},{missionAlly:true}]){
  const before=flat({x:18,y:8,patch,exits:selectedExits()}),old=endTurn(legacy(before)),next=endTurn(before);
  assert.equal(router(next).departure.destination,'buenos_aires');assert.deepEqual(geometry(next),geometry(old));
 }
 const before=createBattle([{id:'guard',x:1,y:14,facing:6}],{id:'enemy-rout-unchanged',sector:'cordoba',width:20,height:16,hour:12,exits:selectedExits(),adjacentExitIds:[adjacent],
  tiles:Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'131',x:18,y:2,routed:true,weaponDropped:true,loaded:0,overwatch:false}],
 });
 const old=endTurn(legacy(before)),next=endTurn(before);assert.ok(router(next).departure);assert.equal(router(next).departure.destination,'__offmap_enemy__');
 assert.deepEqual(legacy(next),old);
});

test('a custom campaign with remapped stock names supplies its own adjacency without the stock map',()=>{
 const documents=scaffoldDocuments('rout-destination-context');
 for(const key of ['content','world','maps'])documents[key]=JSON.parse(JSON.stringify(documents[key]).replaceAll('"camp"','"cordoba"').replaceAll('camp:','cordoba:').replaceAll('"watch-post"','"buenos_aires"').replaceAll('watch-post:','buenos_aires:'));
 documents.world.exitLinks=[['cordoba','E',19,8,'buenos_aires','W',0,8]];
 const context=compileCampaignPackage(documents.manifest,documents);assert.deepEqual(validateContentPackage(context),[]);
 const near='cordoba:cell-16-16';assert.equal(adjacentCells('cordoba','cell-16-16',context),true);assert.equal(adjacentCells('cordoba','cell-16-16'),false);
 const before=issued({context,near});assert.equal(before.campaignPackage,undefined);assert.equal(before.world,undefined);assert.deepEqual(before.adjacentExitIds,[near]);
 assert.equal(router(endTurn(before)).departure.destination,'cell-16-16');assert.equal(router(endTurn(legacy(before))).departure.destination,'buenos_aires');
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(before)));assert.deepEqual(endTurn(saved),endTurn(before));
});

test('mission scenes keep authored exits and adjacency metadata rejects duplicate or unknown routes',()=>{
 for(const [sector,scene] of [['san_lorenzo',null],['tucuman','yatasto']]){
  const exits=sectorExits(sector,scene);assert.ok(exits.length);assert.deepEqual(adjacentExitIdsFor(sector,scene,exits),[]);
  const battle=enterSector({id:'declared-scene-rout',sector,sceneId:scene,exits,hour:12,exploration:true,enemies:[],squad:[{id:'guard'}]});
  assert.deepEqual(battle.adjacentExitIds,[]);assert.deepEqual(battle.exits,exits);
 }
 const before=issued();
 for(const invalid of [null,{},[adjacent,adjacent],['missing-exit'],[123]]){
  const bad={...before,adjacentExitIds:invalid};assert.throws(()=>validateBattleSnapshot(bad),/salida adyacentes/);
 }
});
