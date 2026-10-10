import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {ammoCount,ammoStock,ammoTypeFor} from '../game/ammo-types.js';
import {AMMUNITION_FAMILIES} from '../game/ammunition-families.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {handRecord,applyItemQuantity} from '../game/tactical-inventory.js';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {supplyFreshMountainAmmunition} from './fresh-mountain-route.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';

const fixture=name=>readFileSync(new URL(`./fixtures/${name}`,import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const provenance=JSON.parse(fixture('los-patos-earned-ammunition-shortage.provenance.json'));
const inputGzip=fixture(provenance.inputFixture.path),inputRaw=gunzipSync(inputGzip);
const replayGzip=fixture(provenance.replayFixture.path),replayRaw=gunzipSync(replayGzip);
assert.equal(sha(inputGzip),provenance.inputFixture.gzipSHA256);
assert.equal(sha(inputRaw),provenance.inputFixture.rawSHA256);
assert.equal(sha(replayGzip),provenance.replayFixture.gzipSHA256);
assert.equal(sha(replayRaw),provenance.replayFixture.rawSHA256);
const tape=JSON.parse(replayRaw),start=()=>decodeSave(inputRaw.toString()).campaign;
const official=c=>decodeSave(encodeSave(c)).campaign;
const carried=(c,id)=>carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]);
const known=c=>sectorInventoryModel(c,'mendoza',rosterFor(c),11).entries.map(row=>({...JSON.parse(row.expected),count:row.count}));

// Count loose rounds and every actual gun charge, including stowed primaries.
// A compatible replacement moves custody; it cannot create a gun or cartridge.
function finitePool(c){
 const rounds=Object.fromEntries(Object.keys(AMMUNITION_FAMILIES).map(key=>[key,0]));let guns=0;
 const addGun=gun=>{
  if(![1800,1801,1802,1803,1804,1805,1806,1807,1808].includes(gun?.weapon))return;
  guns+=gun.count??1;const family=ammoTypeFor(gun);
  if(family)rounds[family]+=(gun.loaded??0)*(gun.count??1);
 };
 for(const stack of known(c)){
  if(stack.kind==='ammunition')rounds[Object.keys(rounds).find(key=>AMMUNITION_FAMILIES[key].type===stack.ammoType)]+=stack.count;
  else addGun(stack);
 }
 for(const id of c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='mendoza')){
  const unit=carried(c,id);
  for(const [key,count]of Object.entries(ammoStock(unit)))rounds[key]+=count;
  if(!unit.weaponDropped)addGun({weapon:unit.weapon,loaded:unit.loaded,ammunitionChoice:unit.ammunitionChoice,weaponMetadata:unit.weaponMetadata});
  for(const stack of Object.values(unit.inventory))addGun(stack);
 }
 for(const [key,count]of Object.entries(c.ammunitionStores.mendoza??{}))rounds[key]+=count;
 return {guns,rounds};
}

test('the earned post-Uspallata input exposes the original finite rifle shortage without changing history',()=>{
 const c=start(),before=structuredClone(c);
 assert.equal(c.sectors.uspallata.owner,'patriot');assert.equal(c.sectors.los_patos.owner,'royalist');
 assert.equal(c.operativeState[147].alive,false);
 assert.deepEqual([c.hour,c.secondOfHour,c.resources.treasury],[1040,2369,213094]);
 assert.throws(()=>supplyRouteAmmunition(c,tape.field,{target:tape.target}),/Finite ammunition shortage for 128 at mendoza: 2 ammoRifle rounds are missing/);
 assert.deepEqual(c,before);
});

test('known finite long guns retain the twelve-round target and exact saved inventory order replay',t=>{
 const c=start(),before=structuredClone(c),events=[];
 const result=supplyFreshMountainAmmunition(c,tape.field,{target:tape.target,report:event=>events.push(event)});
 assert.deepEqual(c,before);assert.deepEqual(result,decodeSave(tape.officialFinal).campaign);
 assert.deepEqual(finitePool(result),finitePool(before));assert.deepEqual(finitePool(result),tape.receipt.poolAfter);
 assert.deepEqual(result.contracts,before.contracts);assert.deepEqual(result.squads,before.squads);
 for(const key of ['hour','secondOfHour','resources','activeSquadId','squad'])assert.deepEqual(result[key],before[key]);
 for(const [id,record]of Object.entries(before.operativeState))for(const key of ['alive','captured','hp','maxHp','bleeding','bandaged','energy','fatigue','morale','asleep','assignment','location'])assert.deepEqual(result.operativeState[id][key],record[key],`${id} ${key}`);
 const replacements=events.filter(event=>event.event==='mountainFiniteArmament');
 assert.deepEqual(replacements,tape.receipt.replacements);assert.equal(replacements.length,2);
 for(const {operativeId}of replacements){
  const oldGun=handRecord(sectorInventoryModel(before,'mendoza',rosterFor(before),operativeId).personal,'primary');
  assert.ok(Object.values(result.operativeState[operativeId].inventory).some(item=>Object.entries(oldGun).every(([key,value])=>JSON.stringify(item[key])===JSON.stringify(value))));
  assert.equal(ammoCount(carried(result,operativeId),'ammoRifle'),ammoCount(carried(before,operativeId),'ammoRifle'));
 }
 for(const id of tape.field){const unit=carried(result,id);assert.ok(unit.loaded+ammoCount(unit)>=tape.target,`${id} retains twelve compatible rounds`);}
 const actions=events.filter(event=>event.action).map(event=>event.action);assert.deepEqual(actions,tape.orders);
 let replay=official(before);
 for(let i=0;i<actions.length;i++){
  replay=dispatchCampaign(replay,actions[i]);assert.equal(replay.lastError,null,replay.lastError);
  if(i+1===Math.floor(actions.length/2))replay=official(replay);
 }
 assert.deepEqual(replay,result);assert.deepEqual(official(result),result);
 const repeated=[];assert.deepEqual(supplyFreshMountainAmmunition(official(result),tape.field,{report:event=>repeated.push(event)}),result);assert.deepEqual(repeated,[]);
 t.diagnostic(JSON.stringify({inputRawSHA256:provenance.inputFixture.rawSHA256,nativeOrders:actions.length,finitePool:finitePool(result),replacements,officialMidpointReplay:true,scope:'earned finite preparation; no Los Patos battle or victory claim'}));
});

test('ordinary reloads finish the compatible Los Patos weapons with paid time and all prior deaths held',()=>{
 let c=decodeSave(tape.officialFinal).campaign;const before=structuredClone(c),support=c.activeSquadId,main=c.squads.find(q=>q.members.includes(11)&&q.members.length===6).id,events=[];
 for(const id of [main,support]){
  c=dispatchCampaign(c,{type:'selectSquad',id});assert.equal(c.lastError,null);
  for(const operativeId of c.squad){c=dispatchCampaign(c,{type:'assignCare',operativeId,assignment:'active'});assert.equal(c.lastError,null);}
  c=finishReloadsBeforeMarch(c,{report:event=>events.push(event)});
 }
 assert.deepEqual(c,decodeSave(tape.ordinaryReloaded).campaign);assert.deepEqual(finitePool(c),finitePool(before));
 assert.equal((c.hour-before.hour)*3600+c.secondOfHour-before.secondOfHour,11);
 assert.equal(c.resources.treasury,before.resources.treasury);assert.deepEqual(c.contracts,before.contracts);
 for(const id of tape.field){const unit=carried(c,id);assert.equal(unit.loaded,1);assert.ok(unit.loaded+ammoCount(unit)>=tape.target);}
 for(const [id,record]of Object.entries(before.operativeState))if(!record.alive)assert.equal(c.operativeState[id].alive,false);
 assert.equal(events.filter(event=>event.event==='finishedReload').length,3);assert.deepEqual(official(c),c);
});

// Absence control derived only through ordinary inventory transactions from
// the earned Los Patos input. It is not the unretained Uspallata116 input.
test('finite mountain readiness refuses twelve rounds when compatible cartridges belong to other living owners',t=>{
 const initial=start();let c=official(initial);const orders=[];
 const order=action=>{c=dispatchCampaign(c,action);assert.equal(c.lastError,null,c.lastError);orders.push(action);};
 // Replay only the witnessed allocations before the first rifle replacement.
 for(const action of tape.orders.slice(0,7))order(action);
 assert.equal(c.ammunitionStores.mendoza?.ammoMusket??0,0);assert.equal(c.ammunitionStores.mendoza?.ammoRifle??0,0);
 const knownRows=()=>sectorInventoryModel(c,'mendoza',rosterFor(c),128).entries.filter(row=>row.reachable&&row.count>0&&['musket_75','rifle_62'].includes(JSON.parse(row.expected).ammoType));
 for(let step=0;knownRows().length&&step<100;step++){
  const source=knownRows()[0];let admitted;
  for(const id of tape.field.filter(id=>id!==128)){
   const model=sectorInventoryModel(c,'mendoza',rosterFor(c),id),row=model.entries.find(row=>row.key===source.key&&row.expected===source.expected&&row.reachable);
   if(!row||model.reason)continue;
   for(let count=row.count;count>0;count--){
    try{applyItemQuantity(model.personal,{...JSON.parse(row.expected),count});}catch{continue;}
    admitted={id,row,count};break;
   }
   if(admitted)break;
  }
  assert.ok(admitted,'another real local owner has room for the actual finite cartridges');
  order({type:'sectorInventory',sector:'mendoza',operativeId:admitted.id,direction:'take',sourceKey:admitted.row.key,expected:admitted.row.expected,count:admitted.count});
 }
 assert.deepEqual(knownRows(),[],'no admitted known loose cartridge source remains for the undersupplied rifle owner');
 assert.deepEqual(finitePool(c),finitePool(initial));
 for(const key of ['hour','secondOfHour','resources','contracts','squads','activeSquadId','squad','recruited'])assert.deepEqual(c[key],initial[key]);
 for(const [id,record]of Object.entries(initial.operativeState))for(const key of ['alive','captured','hp','maxHp','bleeding','bandaged','energy','fatigue','morale','asleep','assignment','location'])assert.deepEqual(c.operativeState[id][key],record[key],`${id} ${key}`);
 let replay=official(initial);
 for(let i=0;i<orders.length;i++){replay=dispatchCampaign(replay,orders[i]);assert.equal(replay.lastError,null);if(i+1===Math.floor(orders.length/2))replay=official(replay);}
 assert.deepEqual(replay,c);assert.deepEqual(official(c),c);
 const before=structuredClone(c),events=[],unit=carried(c,128),missing=12-unit.loaded-ammoCount(unit,'ammoRifle');
 assert.ok(missing>0,'the original rifle remains below twelve actual compatible rounds');
 assert.throws(()=>supplyFreshMountainAmmunition(c,tape.field,{target:12,report:event=>events.push(event)}),new RegExp(`Finite ammunition shortage for 128 at mendoza: ${missing} ammoRifle rounds are missing`));
 assert.deepEqual(c,before,'a failed preparation cannot change the caller input');
 assert.deepEqual(events.filter(event=>event.event==='mountainFiniteArmament'),[],"other living owners' cartridges are not free local stock");
 assert.equal(events.at(-1).event,'ammunitionShortage');assert.equal(events.at(-1).target,12);
 t.diagnostic(JSON.stringify({scope:'native LosPatos-derived inventory absence control; no Uspallata input or battle claim',orders:orders.length,pool:finitePool(c),officialMidpointReplay:true,refusedTarget:12,missing}));
});
