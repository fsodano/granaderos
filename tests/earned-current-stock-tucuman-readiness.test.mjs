import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {contractExpiresSeconds} from '../game/contracts.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {fight} from './opening-driver.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {prepareStockTucumanReadiness} from './stock-tucuman-readiness.mjs';

const clock=s=>s.hour*3600+(s.secondOfHour??0);
const save=pair=>decodeSave(encodeSave(pair.campaign,pair.battle??null));
const stackIdentity=expected=>JSON.stringify(Object.entries(JSON.parse(expected)).filter(([key])=>key!=='count').sort(([a],[b])=>a.localeCompare(b)));
const stackQuantity=(entries,expected)=>entries.filter(row=>stackIdentity(row.expected)===stackIdentity(expected)).reduce((total,row)=>total+row.count,0);

test('earned current-stock seed8 readiness joins five real hires and seven serving veterans for a native twelve-person Tucumán victory',t=>{
 const scenario={fixture:'earned-current-stock-tucuman-readiness',native:false};
 const raw=gunzipSync(readFileSync(new URL(`./fixtures/${scenario.fixture}.save.json.gz`,import.meta.url)));
 const metadata=JSON.parse(readFileSync(new URL(`./fixtures/${scenario.fixture}.provenance.json`,import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),metadata.sha256);
 const start=decodeSave(raw.toString()).campaign,input=structuredClone(start),checkpoints=[];
 const retained=[108,100,134,117,121,126,110,125,101,133],rear=[100,126,133];
 assert.equal(start.hour,669);assert.equal(start.secondOfHour,903);assert.deepEqual(start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured),retained);
 assert.equal(start.sectors.tucuman.owner,'royalist');assert.equal(start.pendingEncounter,null);assert.equal(start.pendingBattle,null);
 assert.equal(metadata.startingTreasury,3200);assert.equal(metadata.officialSaveRoundTripExact,true);
 const prepared=prepareStockTucumanReadiness(start,{onCheckpoint:(stage,campaign,battle)=>checkpoints.push({stage,campaign,battle})}),{campaign:ready,receipt}=prepared;
 assert.deepEqual(start,input);assert.deepEqual(receipt.rear,rear);assert.equal(receipt.paid.length,5);assert.equal(new Set(receipt.paid).size,5);assert.deepEqual(receipt.veterans,[110,134,125,101,117,108,121]);assert.equal(receipt.field.length,12);assert.equal(new Set(receipt.field).size,12);assert.deepEqual(receipt.retained,retained);assert.equal(receipt.columns.length,2);assert.ok(receipt.columns.every(ids=>ids.length===6));
 assert.ok(rosterFor(ready).find(op=>op.id===receipt.physician).medical>=70);assert.ok(rosterFor(ready).find(op=>op.id===receipt.backupPhysician).medical>=70);
 const booked=checkpoints.find(row=>row.stage==='stock-readiness-booked').campaign,arrived=checkpoints.find(row=>row.stage==='stock-readiness-arrived').campaign;
 assert.ok(receipt.paid.every(id=>booked.recruited.includes(id)&&!booked.hiringArrivals.some(a=>a.operativeId===id)));assert.equal(receipt.orders.some(row=>row.action?.type==='recruitCivic'&&receipt.veterans.includes(row.action.id)),false,'Serving veterans are never charged as new hires.');
 assert.equal(clock(arrived),clock(booked));assert.equal(receipt.paidHireCost,2856);
 for(const id of receipt.paid){const contract=arrived.contracts[id];assert.equal(contract.started,arrived.hour);assert.equal(contract.startedSecond,arrived.secondOfHour);assert.equal(contractExpiresSeconds(contract),clock(arrived)+168*3600);}
 const local=checkpoints.find(row=>row.stage==='stock-readiness-local-ready').campaign;
 for(const id of receipt.field){const record=local.operativeState[id],op=rosterFor(local).find(op=>op.id===id),load=carriedAmmunition(op,record),family=ammoTypeFor({...load,activeSlot:'primary'});assert.equal(op.weapon,1800);assert.ok(load.loaded+ammoCount(load,family)>=12);assert.equal(record.hp,record.maxHp);assert.equal(record.bleeding,0);assert.equal(record.energy,100);assert.equal(record.fatigue,0);assert.equal(record.asleep,false);assert.ok(record.morale>=30);}
 for(const id of receipt.veterans){assert.equal(ready.contracts[id].started,start.contracts[id].started);assert.equal(ready.contracts[id].startedSecond,start.contracts[id].startedSecond);assert.equal(ready.contracts[id].paid,start.contracts[id].paid);}
 for(const id of receipt.rear){assert.equal(ready.operativeState[id].alive,true);assert.equal(ready.operativeState[id].hp,start.operativeState[id].hp);assert.equal(ready.operativeState[id].location,'cordoba');assert.equal(ready.operativeState[id].assignment,'rest');assert.ok(contractExpiresSeconds(ready.contracts[id])>clock(ready));}
 assert.equal(ready.pendingBattle.sector,'tucuman');assert.equal(ready.pendingBattle.squad.length,12);assert.equal(artilleryProfile(ready,receipt.gun).crew,2);assert.ok(receipt.gun.loaded||receipt.gun.ammo>0);
 assert.equal(ready.operativeState[126].medkits,1);assert.equal(ready.operativeState[133].medkits,1);assert.equal(ready.operativeState[100].medkits,2,'The clinic keeps its actual carried finite dressings.');
 const initial=enterSector(ready.pendingBattle,ready.sectorStates.tucuman);
 const result=fight(ready.pendingBattle,ready.sectorStates.tucuman,{controller:coastalBatteryController(initial,{sharedArtillerySight:true})});
 assert.equal(result.battle.status,'victory','The unchanged native first assault must earn a real victory; there is no fallback defeat/rebuild branch.');
 assert.ok(result.actions>0&&result.orders.length>result.actions);
 let pair={campaign:start,battle:null},finiteDebits={};
 // Replay every preparation order, including real local reloads and their
 // elapsed clock, then the exact one native controller result.
 for(let i=0;i<receipt.orders.length;i++){
  const row=receipt.orders[i];
  if(row.kind==='campaign'){
   const action=row.action,before=pair.campaign;
   const inventoryBefore=action.type==='sectorInventory'&&action.direction==='take'?sectorInventoryModel(before,action.sector,rosterFor(before),action.operativeId):null;
   const physical=inventoryBefore?.entries.find(item=>item.key===action.sourceKey);
   const dropping=action.type==='sectorInventory'&&action.direction==='drop'?sectorInventoryModel(before,action.sector,rosterFor(before),action.operativeId):null;
   if(physical){assert.equal(physical.expected,action.expected);assert.ok(physical.reachable&&physical.count>=action.count);}
   pair.campaign=dispatchCampaign(before,action);assert.equal(pair.campaign.lastError,null);
   if(dropping){
    const source=dropping.carried.find(row=>row.item===action.item),keys=new Set(dropping.entries.map(row=>row.key)),after=sectorInventoryModel(pair.campaign,action.sector,rosterFor(pair.campaign),action.operativeId),added=after.entries.filter(row=>!keys.has(row.key));
    assert.ok(source&&source.count>=action.count);assert.equal(added.length,1);assert.equal(added[0].count,action.count);
    if(action.item==='primary'){
     assert.ok(source.store?.expected);assert.equal(added[0].expected,source.store.expected);assert.equal(after.personal.weaponDropped,true,'The released rifle or pistol cannot remain owned in the hand.');
    }else{
     assert.equal(action.item,'medkits');assert.deepEqual(JSON.parse(added[0].expected),{item:'medkits',count:action.count,weight:.2});
     assert.equal(after.carried.filter(row=>row.item===action.item).reduce((sum,row)=>sum+row.count,0),dropping.carried.filter(row=>row.item===action.item).reduce((sum,row)=>sum+row.count,0)-action.count,'The donated dressing leaves the real donor before pickup.');
     assert.equal(after.personal.loaded,dropping.personal.loaded);assert.equal(after.personal.weaponDropped,dropping.personal.weaponDropped);
    }
   }
   if(physical){
    const after=sectorInventoryModel(pair.campaign,action.sector,rosterFor(pair.campaign),action.operativeId).entries,remaining=physical.count-action.count;
    assert.equal(stackQuantity(after,action.expected),stackQuantity(inventoryBefore.entries,action.expected)-action.count,'Every actual physical stack must debit exactly the taken quantity.');
    if(remaining>0)assert.equal(after.find(item=>item.key===action.sourceKey)?.expected,JSON.stringify({...JSON.parse(action.expected),count:remaining}),'A partial source keeps the exact remaining stack.');
    const item=JSON.parse(action.expected),key=item.weapon?'weapon:'+item.weapon:item.ammoType?'ammo:'+item.ammoType:item.item;finiteDebits[key]=(finiteDebits[key]??0)+action.count;
   }
   if(row.quote)assert.equal(pair.campaign.resources.treasury,before.resources.treasury-(action.type==='recruitCivic'?row.quote.total:row.quote.price));
   if(action.type==='leaveSector')pair.battle=null;
  }else if(row.kind==='enterSector')pair.battle=enterSector(pair.campaign.pendingBattle,pair.campaign.sectorStates[pair.campaign.pendingBattle.sector]);
  else{const battle=actBattle(pair.battle,row.action);assert.equal(battle.lastError,null);const sync=syncBattleTime(pair.campaign,battle);assert.equal(sync.error,null);pair={campaign:sync.campaign,battle:sync.battle};}
  if(i===Math.floor(receipt.orders.length/2))pair=save(pair);
 }
 assert.deepEqual(pair.campaign,ready);assert.equal(pair.battle,null);
 pair={campaign:ready,battle:initial};
 for(let i=0;i<result.orders.length;i++){
  const order=result.orders[i],battle=order.type==='endTurn'?endTurn(pair.battle):actBattle(pair.battle,order);assert.equal(battle.lastError,null);
  const sync=syncBattleTime(pair.campaign,battle);assert.equal(sync.error,null);pair={campaign:sync.campaign,battle:sync.battle};if(i===Math.floor(result.orders.length/2))pair=save(pair);
 }
 const direct=syncBattleTime(ready,result.battle);assert.equal(direct.error,null);assert.deepEqual(pair.battle,direct.battle);assert.deepEqual(pair.campaign,direct.campaign);
 const settled=dispatchCampaign(pair.campaign,{type:'battleResult',battleId:ready.pendingBattle.id,outcome:pair.battle.status,survivors:pair.battle.units.filter(unit=>unit.side==='player'),sectorState:pair.battle});assert.equal(settled.lastError,null);assert.equal(settled.sectors.tucuman.owner,'patriot');assert.equal(settled.pendingBattle,null);assert.deepEqual(save({campaign:settled}).campaign,settled);
 for(const [id,record]of Object.entries(start.operativeState))if(!record.alive)assert.equal(settled.operativeState[id].alive,false);
 for(const unit of pair.battle.units.filter(unit=>unit.side==='player'&&unit.hp<=0))assert.equal(settled.operativeState[Number(unit.id)].alive,false,'Any actual new native loss remains permanent.');
 for(const id of receipt.rear){assert.equal(settled.operativeState[id].alive,true);assert.equal(settled.operativeState[id].location,'cordoba');}
 assert.deepEqual(start,input);
 t.diagnostic(JSON.stringify({inputClock:[start.hour,start.secondOfHour],readyClock:[ready.hour,ready.secondOfHour],settledClock:[settled.hour,settled.secondOfHour],rear:receipt.rear,paid:receipt.paid,veterans:receipt.veterans,field:receipt.field,columns:receipt.columns,physician:receipt.physician,hireCost:receipt.paidHireCost,renewalCost:receipt.renewalCost,finiteDebits,gun:receipt.gun,status:result.battle.status,turns:result.battle.turn,actions:result.actions,orders:result.orders.length,elapsedSeconds:result.battle.elapsedSeconds,treasury:settled.resources.treasury,deaths:pair.battle.units.filter(unit=>unit.side==='player'&&unit.hp<=0).map(unit=>unit.id),exactPreparationReplay:true,exactBattleReplay:true,officialMidpointSaves:true}));
});
