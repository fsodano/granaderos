import {restForMarch} from './campaign-test-helpers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign as campaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
function initialCampaign(seed=42,cartridges=6){const d=defaultContentPackage();d.rules.startingTreasury=20000;d.rules.militiaCartridges=cartridges;for(const id of ['buenos_aires','retiro','ensenada'])d.startingTerritory[id]={owner:'patriot',loyalty:65};const s=dispatchCampaign(campaign(seed,d),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});s.enemyGroups=[];return s;}
import {dispatchCampaign} from '../game/campaign.js';
import {prepareGarrison} from '../game/garrison.js';
import {militiaDistributionPreview,militiaTransferPreview} from '../game/militia-distribution.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const transfer=(s,to='buenos_aires',rank=0,count=1)=>order(s,{type:'transferMilitia',from:'retiro',to,rank,count});
const save=s=>decodeSave(encodeSave(s)).campaign;
const ready=(counts=[6,3,3])=>{const s=initialCampaign();s.sectors.retiro.militia=counts;prepareGarrison(s,'retiro');return save(s);};
const ids=s=>Object.values(s.garrisons).flat().map(u=>u.id).sort((a,b)=>a-b);
test('manual city transfers preserve a wounded veteran and exact equipment without new supplies',()=>{
 let s=ready();const u=s.garrisons.retiro.find(u=>u.militiaRank===2);Object.assign(u,{hp:30,bleeding:0,bandaged:55,militiaExperience:8,militiaCombatCredit:[{id:"fixture-a",points:3},{id:"fixture-b",points:3},{id:"fixture-c",points:1},{id:"fixture-d",points:1}],energy:45});
 const original=structuredClone(u),resources=structuredClone(s.resources),all=ids(s),clock=s.hour;
 s=transfer(s,'buenos_aires',2,1);const moved=s.garrisons.buenos_aires[0];for(const key of Object.keys(original))assert.deepEqual(moved[key],original[key],key);
 assert.deepEqual(moved.militiaArrival,{from:'retiro',to:'buenos_aires'});assert.deepEqual(s.resources,resources);assert.deepEqual(ids(s),all);assert.equal(s.hour,clock);
 assert.deepEqual(s.sectors.retiro.militia,[6,3,2]);assert.deepEqual(s.sectors.buenos_aires.militia,[0,0,1]);assert.deepEqual(save(s),s);
});
test('count-only cohorts receive their finite ammunition once when transferred',()=>{
 let s=initialCampaign();s=order(s,{type:'militia',trainerId:1000});
 for(let n=0;s.militiaTraining.length&&n<8;n++)s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining});
 assert.equal(s.sectors.retiro.militia[0],3);assert.equal(s.garrisons.retiro?.length??0,0);
 const before=structuredClone(s.resources);s=transfer(s,'buenos_aires',0,3);assert.equal(s.garrisons.buenos_aires.reduce((n,u)=>n+u.loaded+u.ammo,0),18);assert.deepEqual(s.resources,before);const members=ids(s),gear=s.garrisons.buenos_aires.map(u=>[u.id,u.loaded,u.ammo,u.priming,u.condition]);
 s=order(s,{type:'transferMilitia',from:'buenos_aires',to:'retiro',rank:0,count:3});assert.deepEqual(ids(s),members);assert.deepEqual(s.resources,before);assert.deepEqual(s.garrisons.retiro.map(u=>[u.id,u.loaded,u.ammo,u.priming,u.condition]),gear);assert.deepEqual(save(s),s);
});
test('automatic distribution balances totals and experienced ranks and is idempotent',()=>{
 let s=ready(),all=ids(s),before=structuredClone(s.resources);s=order(s,{type:'distributeMilitia',sector:'retiro'});
 assert.deepEqual(s.sectors.retiro.militia,[3,1,2]);assert.deepEqual(s.sectors.buenos_aires.militia,[3,2,1]);assert.deepEqual(s.sectors.ensenada.militia,[0,0,0]);assert.deepEqual(ids(s),all);assert.deepEqual(s.resources,before);
 assert.equal(militiaDistributionPreview(s,'retiro').valid,false);const repeat=dispatchCampaign(s,{type:'distributeMilitia',sector:'retiro'});assert.ok(repeat.lastError);assert.deepEqual(repeat.garrisons,s.garrisons);assert.deepEqual(save(s),s);
});
test('critical and bleeding defenders stay local while stable wounded defenders can move',()=>{
 let s=ready([3,0,0]);Object.assign(s.garrisons.retiro[0],{hp:8,bleeding:0,unconscious:true});Object.assign(s.garrisons.retiro[1],{hp:40,bleeding:4});Object.assign(s.garrisons.retiro[2],{hp:40,bleeding:0,bandaged:20});
 const retained=structuredClone(s.garrisons.retiro.slice(0,2)),last=s.garrisons.retiro[2].id;
 const no=dispatchCampaign(s,{type:'transferMilitia',from:'retiro',to:'buenos_aires',rank:0,count:2});assert.ok(no.lastError);assert.deepEqual(no.garrisons,s.garrisons);
 s=transfer(s);assert.deepEqual(s.garrisons.retiro,retained);assert.equal(s.garrisons.buenos_aires[0].id,last);assert.equal(s.garrisons.buenos_aires[0].hp,40);assert.deepEqual(save(s),s);
});
test('automatic distribution holds patients and reserves capacity for active training',()=>{
 let s=ready([9,0,0]);s=order(s,{type:'militia',sector:'retiro',rank:1,trainerId:1000});const course=structuredClone(s.militiaTraining[0]);
 Object.assign(s.garrisons.retiro[0],{hp:8,bleeding:0,unconscious:true});const patient=s.garrisons.retiro[0].id;
 s=order(s,{type:'distributeMilitia',sector:'retiro'});assert.deepEqual(s.militiaTraining[0],course);assert.ok(s.garrisons.retiro.some(u=>u.id===patient));
 assert.deepEqual(s.sectors.retiro.militia,[2,0,0]);assert.equal(s.sectors.buenos_aires.militia[0],4);assert.deepEqual(save(s),s);
});
test('ownership, connected routes, town limits, active encounters and malformed quantities reject atomically',()=>{
 const base=ready();
 for(const change of [
  {action:{to:'ensenada'}},{action:{to:'cordoba'}},{action:{to:'retiro'}},{action:{to:'missing'}},{action:{rank:3}},{action:{rank:'0'}},{action:{count:0}},{action:{count:-1}},{action:{count:1.5}},{action:{count:61}},{action:{count:'1'}},
  {edit:s=>s.sectors.buenos_aires.owner='royalist',action:{to:'ensenada'}},
  {edit:s=>s.sectors.buenos_aires.militia=[60,0,0]},
  {edit:s=>s.pendingBattle={sector:'cordoba',squad:[]}},
  {edit:s=>s.pendingEncounter={groupId:'waiting'}},
  {edit:s=>s.enemyGroups.push({target:'buenos_aires',status:'stationed',units:[]})},
 ]){const s=structuredClone(base);change.edit?.(s);const before=structuredClone(s);const result=dispatchCampaign(s,{type:'transferMilitia',from:'retiro',to:'buenos_aires',rank:0,count:1,...change.action});assert.ok(result.lastError,JSON.stringify(change.action));assert.deepEqual(s,before);delete result.lastError;delete before.lastError;assert.deepEqual(result,before);}
});
test('a partially occupied city can redistribute only along its connected controlled sectors',()=>{
 let s=ready([4,0,0]);s.sectors.ensenada.owner='royalist';s=order(s,{type:'distributeMilitia',sector:'retiro'});assert.deepEqual(s.sectors.retiro.militia,[2,0,0]);assert.deepEqual(s.sectors.buenos_aires.militia,[2,0,0]);assert.deepEqual(s.sectors.ensenada.militia,[0,0,0]);
});
test('reserved training slots prevent destination overflow and count-only reserves can transfer',()=>{
 let s=ready([70,0,0]);assert.equal(s.garrisons.retiro.length,60);s.sectors.buenos_aires.militia=[57,0,0];s.militiaTraining=[{sector:'buenos_aires',count:3}];
 assert.equal(militiaTransferPreview(s,{from:'retiro',to:'buenos_aires',rank:0,count:1}).room,0);
 s.militiaTraining=[];s=transfer(s,'buenos_aires',0,3);assert.ok(dispatchCampaign(s,{type:'transferMilitia',from:'retiro',to:'buenos_aires',rank:0,count:1}).lastError);assert.equal(s.sectors.retiro.militia[0],67);assert.equal(s.garrisons.buenos_aires.length,3);assert.equal(s.sectors.buenos_aires.militia[0],60);assert.deepEqual(save(s),s);
});
test('a real old-sector return cannot resurrect transferred defenders on reentry',()=>{
 let s=ready([3,0,0]);s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
 const moved=s.garrisons.retiro[0].id;s=transfer(s);s=save(s);s=order(s,{type:'visitSector'});const revisit=enterSector(s.pendingBattle,s.sectorStates.retiro);assert.ok(!revisit.units.some(u=>u.id===String(moved)));
 s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:revisit,survivors:revisit.units.filter(u=>u.side==='player')});s=order(restForMarch(s),{type:'travel',sector:'buenos_aires'});s=order(s,{type:'visitSector'});const destination=enterSector(s.pendingBattle,s.sectorStates.buenos_aires);assert.equal(destination.units.filter(u=>u.id===String(moved)).length,1);assert.deepEqual(decodeSave(encodeSave(s,destination)).campaign,s);
});
test('distribution previews do not mutate and varied rank mixes reach a stable balanced result',()=>{
 for(let seed=1;seed<=12;seed++){
  let s=initialCampaign(seed);for(const [i,at] of ['buenos_aires','retiro','ensenada'].entries()){s.sectors[at].militia=[(seed*7+i*3)%19,(seed*5+i)%17,(seed*3+i*7)%13];prepareGarrison(s,at);}s=save(s);
  const original=structuredClone(s),all=ids(s);const plan=militiaDistributionPreview(s,'retiro');assert.deepEqual(s,original);
  if(plan.valid)s=order(s,{type:'distributeMilitia',sector:'retiro'});
  assert.deepEqual(s.garrisons.ensenada,original.garrisons.ensenada);const totals=['buenos_aires','retiro'].map(at=>s.sectors[at].militia.reduce((a,b)=>a+b,0));assert.ok(Math.max(...totals)-Math.min(...totals)<=1);assert.deepEqual(ids(s),all);assert.equal(militiaDistributionPreview(s,'retiro').valid,false);assert.deepEqual(save(s),s);
 }
});
test('automatic capacity refusal and an authored zero allocation cannot create free defenders or ammunition',()=>{
 let s=initialCampaign();s.sectors.retiro.militia=[181,0,0];const rejected=dispatchCampaign(s,{type:'distributeMilitia',sector:'retiro'});assert.ok(rejected.lastError);assert.deepEqual(rejected.garrisons,s.garrisons);
 s=initialCampaign(42,0);s.sectors.retiro.militia=[0,0,3];
 s=order(s,{type:'distributeMilitia',sector:'retiro'});assert.equal(ids(s).length,1,'two count-only defenders stay in their original sector');
 for(const units of Object.values(s.garrisons))for(const u of units)assert.equal(u.loaded+u.ammo,0);
 assert.deepEqual(save(s),s);
});


test('actual wounded combat promotion moves through valid city approaches and cannot reuse its old source post',async()=>{
 const {combatMilitia,militiaCombatReturn}=await import('./militia-combat-fixture.mjs'),{visit,saved,leave}=await import('./local-contract-fixture.mjs');
 const prepared=combatMilitia(),fought=militiaCombatReturn(prepared.s,prepared.id,{configureBattle:battle=>{
  // This compact firing range has a west gate for the actual road return.
  battle.wallEdges=battle.wallEdges.filter(edge=>!(edge.axis==='y'&&edge.x===4&&edge.y===8));
 }});let s=fought.s;const original=structuredClone(s.garrisons.retiro.find(u=>u.id===prepared.id)),treasury=s.resources.treasury,hour=s.hour,second=s.secondOfHour;
 s=transfer(s,'buenos_aires',1,1);assert.equal(s.resources.treasury,treasury);assert.equal(s.hour,hour);assert.equal(s.secondOfHour,second);assert.equal(s.garrisons.buenos_aires[0].hp,44);assert.equal(s.garrisons.buenos_aires[0].militiaExperience,3);
 let p=visit(save(s));assert.ok(!p.battle.units.some(u=>Number(u.id)===prepared.id));s=leave(p);s=order(restForMarch(s),{type:'travel',sector:'buenos_aires'});p=visit(restForMarch(s));let u=p.battle.units.find(u=>Number(u.id)===prepared.id);
 assert.equal(u.y,0);assert.equal(p.battle.tiles.find(t=>t.x===u.x&&t.y===u.y).blocked,false);assert.equal(u.militiaArrival,undefined);
 for(const key of ['hp','maxHp','loaded','ammo','condition','priming','militiaRank','militiaExperience','militiaCombatCredit','weaponMetadata','bladeMetadata','inventory'])assert.deepEqual(u[key],original[key],key);
 s=saved({campaign:leave(p)}).campaign;s=order(s,{type:'transferMilitia',from:'buenos_aires',to:'retiro',rank:1,count:1});s=order(restForMarch(s),{type:'travel',sector:'retiro'});p=visit(restForMarch(s));u=p.battle.units.find(u=>Number(u.id)===prepared.id);
 assert.equal(u.y,p.battle.height-1);assert.notEqual(u.y,original.y);assert.equal(u.loaded,original.loaded);assert.equal(u.hp,44);assert.equal(p.battle.units.filter(u=>Number(u.id)===prepared.id).length,1);
});

test('transferred arrival saves reject malformed routes and a blocked destination cannot put defenders indoors or in water',()=>{
 const moved=transfer(ready([3,0,0]),'buenos_aires');
 for(const arrival of [null,{},[],{from:['retiro'],to:'buenos_aires'},{from:'salta',to:'buenos_aires'},{from:'buenos_aires',to:'retiro'},{from:'retiro',to:'buenos_aires',extra:true}]){const invalid=structuredClone(moved);invalid.garrisons.buenos_aires[0].militiaArrival=arrival;assert.throws(()=>save(invalid));}
 let s=order(moved,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'visitSector'});const b=enterSector(s.pendingBattle);
 // A declared old scene with the complete north approach blocked has no legal
 // arrival fallback. Leave the request intact so entry can be retried later.
 for(const tile of b.tiles)if(tile.y===0)Object.assign(tile,{blocked:true,type:'water'});
 const before=structuredClone(s);assert.throws(()=>enterSector(s.pendingBattle,b),/espacio libre/);assert.deepEqual(s,before);
});

test('a full transferred garrison enters compact and expanded destinations through connected exterior ground',()=>{
 const key=p=>`${p.x},${p.y}`;
 for(const compactLayout of [true,false]){
  let s=transfer(ready([60,0,0]),'buenos_aires',0,60);
  s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'visitSector'});
  const b=enterSector({...s.pendingBattle,compactLayout}),all=b.units.filter(u=>u.hp>0),defenders=all.filter(u=>u.militia);
  assert.equal(defenders.length,60);assert.equal(new Set(all.map(key)).size,all.length);
  const walkable=new Set(b.tiles.filter(t=>!t.blocked&&!t.buildingId&&t.type!=='water').map(key)),seen=new Set(),queue=b.tiles.filter(t=>t.y===0&&walkable.has(key(t)));
  for(const p of queue)seen.add(key(p));
  for(let n=0;n<queue.length;n++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const p={x:queue[n].x+dx,y:queue[n].y+dy};if(walkable.has(key(p))&&!seen.has(key(p))){seen.add(key(p));queue.push(p);}}
  for(const u of defenders){assert.ok(seen.has(key(u)));assert.equal(u.militiaArrival,undefined);assert.equal(u.loaded+u.ammo,6);}
  assert.deepEqual(decodeSave(encodeSave(s,b)).battle,b);
 }
});
