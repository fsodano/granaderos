import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {rosterFor,dispatchCampaign,contractQuote,civicStatus} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {handRecord} from '../game/tactical-inventory.js';
import {ammoCount} from '../game/ammo-types.js';
import {supplyCoastalAmmunition} from './coastal-ammunition.mjs';
import {finishCreatedCoast} from './created-ending-route.mjs';
import {supplyCoastalDressings} from './coastal-dressings.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {prepareCoastalReinforcements} from './coastal-reinforcements.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(name){
 const proof=JSON.parse(readFileSync(new URL(`./fixtures/${name}.provenance.json`,import.meta.url))),gzip=readFileSync(new URL(`./fixtures/${name}.save.json.gz`,import.meta.url)),raw=gunzipSync(gzip);
 assert.equal(sha(gzip),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);return {campaign:decodeSave(raw.toString()).campaign,proof};
}

test('the actual Retiro physician equips one finite musket, preserves his exact pistol and retains the sixteen-round supply target',()=>{
 const {campaign:start,proof}=fixture('earned-stock-coast-retiro-supply'),before=structuredClone(start),model=sectorInventoryModel(start,'retiro',rosterFor(start),10),oldHand=handRecord(model.personal,'primary');
 assert.deepEqual([start.hour,start.secondOfHour],proof.clock);assert.equal(start.resources.treasury,proof.treasury);assert.equal(oldHand.weapon,1806);
 const musket=model.entries.find(row=>JSON.parse(row.expected).instanceId==='cache:retiro:gun:0');assert.ok(musket.reachable);assert.equal(musket.count,1);
 const quantity=(m,type)=>m.entries.filter(row=>JSON.parse(row.expected).kind==='ammunition'&&JSON.parse(row.expected).ammoType===type).reduce((sum,row)=>sum+row.count,0);
 assert.equal(quantity(model,'musket_75'),54);assert.equal(quantity(model,'pistol_69'),4);
 const result=supplyCoastalAmmunition(start,[10]),end=result.campaign,after=sectorInventoryModel(end,'retiro',rosterFor(end),10);
 assert.equal(after.personal.weapon,1800);assert.equal(after.personal.weaponInstanceId,'cache:retiro:gun:0');assert.equal(after.personal.loaded,0);assert.equal(ammoCount(after.personal,'ammoMusket'),16);
 assert.ok(after.carried.some(row=>row.expected&&row.inventoryKey&&JSON.parse(row.expected).weapon===1806));
 assert.deepEqual(JSON.parse(after.carried.find(row=>row.expected&&row.inventoryKey&&JSON.parse(row.expected).weapon===1806).expected),oldHand);
 assert.equal(after.entries.some(row=>JSON.parse(row.expected).instanceId==='cache:retiro:gun:0'),false);assert.equal(quantity(after,'musket_75'),38);assert.equal(quantity(after,'pistol_69'),4);
 assert.deepEqual([end.hour,end.secondOfHour,end.resources.treasury],[start.hour,start.secondOfHour,start.resources.treasury]);assert.deepEqual(start,before);
 assert.equal(result.changes.length,1);assert.equal(result.changes[0].target,16);assert.equal(result.transactions.reduce((sum,t)=>sum+t.quantity,0),16);
 assert.deepEqual(supplyCoastalAmmunition(decodeSave(encodeSave(start)).campaign,[10]),result);
 const repeated=supplyCoastalAmmunition(end,[10]);assert.deepEqual(repeated.campaign,end);assert.deepEqual(repeated.changes,[]);assert.deepEqual(repeated.transactions,[]);
 assert.deepEqual(decodeSave(encodeSave(end)).campaign,end);
});

test('the real physician carries only the two-dressing deficit from known capital bodies, keeps the other doctor reserve and replays his paid return',()=>{
 let c=fixture('earned-stock-coast-retiro-supply').campaign;
 c=finishReloadsBeforeMarch(supplyCoastalAmmunition(c,[10]).campaign);
 c=supplyRouteDressings(c,10,10,{reserves:{10:10,146:10}});const start=c,before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour,start.resources.treasury],[1456,3474,33648]);assert.equal(start.operativeState[10].medkits,10);assert.equal(start.operativeState[146].medkits,2);
 const end=supplyCoastalDressings(start,146,10,{reserves:{10:10,146:10},report:e=>events.push(e)}),trip=events.find(e=>e.event==='coastalDressingCourier');assert.ok(trip);
 assert.equal(trip.missing,2);assert.deepEqual(trip.sources.map(row=>[JSON.parse(row.key),row.count]),[[['body','enemy-0','medkits'],1],[['body','enemy-1','medkits'],1]]);assert.deepEqual(trip.renewals,[]);
 assert.equal(trip.endSeconds-trip.startSeconds,4*3600);assert.equal(trip.cashBefore-trip.cashAfter,20);
 assert.deepEqual([end.hour,end.secondOfHour,end.resources.treasury],[1460,3474,33628]);assert.equal(end.operativeState[10].medkits,10);assert.equal(end.operativeState[146].medkits,10);assert.equal(end.operativeState[4].medkits,0);
 const medical=sectorInventoryModel(end,'retiro',rosterFor(end),146).entries.filter(row=>JSON.parse(row.expected).item==='medkits');assert.deepEqual(medical,[]);
 const body=(state,id)=>state.sectorStates.buenos_aires.units.find(u=>u.id===id);
 assert.equal(body(start,'enemy-0').medkits-body(end,'enemy-0').medkits,1);assert.equal(body(start,'enemy-1').medkits-body(end,'enemy-1').medkits,1);assert.deepEqual(body(end,'8'),body(start,'8'),'Macacha\'s undiscovered body and stock remain untouched.');
 assert.deepEqual(end.squads,start.squads);assert.equal(end.activeSquadId,start.activeSquadId);assert.deepEqual(end.contracts,start.contracts);
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(end.operativeState[id].alive,false);assert.equal(end.operativeState[id].deathMinute,r.deathMinute);}
 assert.deepEqual(supplyCoastalDressings(decodeSave(encodeSave(start)).campaign,146,10,{reserves:{10:10,146:10}}),end);assert.deepEqual(decodeSave(encodeSave(end)).campaign,end);assert.deepEqual(start,before);
});

test('a serving local engineer collects the exact retired veteran kit before an ordinary paid coastal rehire',()=>{
 const start=fixture('earned-stock-coast-retiro-supply').campaign,before=structuredClone(start),quote=id=>contractQuote(start,rosterFor(start).find(op=>op.id===id),'day');
 assert.equal(quote(134).available,false);assert.ok(start.operativeState[134].serviceEquipmentReturn);assert.equal(start.operativeState[2].location,'mendoza');
 const result=prepareCoastalReinforcements(start),end=result.campaign;assert.deepEqual(result.reinforcements,[134]);assert.equal(result.receipts.length,1);
 const receipt=result.receipts[0];assert.equal(receipt.collectorId,2);assert.equal(receipt.site,'mendoza');assert.equal(receipt.marker.id,'service-return-9');assert.equal(receipt.items.length,9);assert.equal(receipt.orders.length,9);
 assert.equal(end.operativeState[134].serviceEquipmentReturn,undefined);assert.equal(civicStatus(end,134).available,true);assert.equal(contractQuote(end,rosterFor(end).find(op=>op.id===134),'day').total,86);
 const model=sectorInventoryModel(end,'mendoza',rosterFor(end),2);assert.ok(!model.entries.some(row=>row.key.includes('service-return-9')));assert.equal(Number(model.personal.id),2);
 const originalModel=sectorInventoryModel(start,'mendoza',rosterFor(start),2),gun=receipt.items.find(row=>row.record.item==='weapon'&&row.record.weapon===1800).record;
 const {item,...record}=gun;assert.ok(model.carried.some(row=>row.inventoryKey&&row.expected&&JSON.stringify(JSON.parse(row.expected))===JSON.stringify(record)),'The actual returned musket keeps its complete load, wear and authored metadata.');
 assert.deepEqual(handRecord(model.personal,'primary'),handRecord(originalModel.personal,'primary'));
 for(const field of ['alive','hp','maxHp','bleeding','morale','energy','fatigue','location'])assert.deepEqual(end.operativeState[134][field],start.operativeState[134][field]);
 assert.deepEqual([end.hour,end.secondOfHour,end.resources.treasury],[start.hour,start.secondOfHour,start.resources.treasury]);assert.deepEqual(end.contracts,start.contracts);assert.deepEqual(end.squads,start.squads);
 let replay=decodeSave(encodeSave(start)).campaign;for(const action of receipt.orders){replay=dispatchCampaign(replay,action);assert.equal(replay.lastError,null);}assert.deepEqual(replay,end);
 const paid=dispatchCampaign(end,{type:'recruitCivic',id:134,term:'day',destination:'retiro'});assert.equal(paid.lastError,null);assert.equal(paid.resources.treasury,end.resources.treasury-86);assert.ok(paid.recruited.includes(134));assert.equal(paid.operativeState[134].location,'retiro');
 assert.deepEqual(decodeSave(encodeSave(paid)).campaign,paid);assert.deepEqual(start,before);
});

test('the unchanged earned default commander prepares the complete paid coastal force and its actual ensuing capital defense',t=>{
 const {campaign:start}=fixture('earned-stock-post-andes-coastal-clinic'),{proof}=fixture('earned-stock-coast-retiro-supply'),before=structuredClone(start),events=[];
 assert.deepEqual([start.hour,start.secondOfHour,start.resources.treasury],[1025,747,62713]);
 const boundary=Error('The actual complete coastal preparation boundary was reached');let captured;
 assert.throws(()=>finishCreatedCoast({campaign:start,notes:[{stage:'ensenada',...proof.earlierPortVictory}],prefix:[]},{report:event=>{const{campaign,battle,...receipt}=event;events.push(receipt);},onCheckpoint:(stage,campaign,notes)=>{
  assert.equal(stage,'coastal-preparation');captured={campaign,notes};throw boundary;
 },reinforcementCount:1}),error=>error===boundary);
 assert.ok(captured);const {campaign:end,notes}=captured,ready=events.find(e=>e.event==='createdCoastalAssaultReady');assert.ok(ready);
 assert.deepEqual([end.hour,end.secondOfHour],[1520,3477]);assert.equal(end.location,'buenos_aires');assert.equal(end.pendingEncounter,null);assert.equal(end.blockade,false);assert.equal(end.sectors.ensenada.owner,'patriot');assert.equal(end.pendingBattle.sector,'buenos_aires');assert.equal(end.pendingBattle.defenseGroupId,'enemy-group-5');assert.ok(!events.some(e=>e.event==='controlledPortArrival'),'A pending actual defense cannot be reported as a friendly-port arrival.');
 assert.equal(end.enemyGroups.find(g=>g.id==='enemy-group-5').status,'engaged');assert.equal(end.pendingBattle.enemies.length,21);assert.deepEqual(end.pendingBattle.squad.map(op=>Number(op.id)).sort((a,b)=>a-b),ready.field.slice().sort((a,b)=>a-b));
 const guard=events.find(e=>e.event==='createdCoastalGuardStage');assert.ok(guard);assert.equal(guard.endSeconds-guard.startSeconds,7200);assert.ok(guard.orders.some(order=>order.from===order.to&&order.attention.assignment),'The actual rest-completion notice must not replace a real elapsed guard hour.');
 const capital=notes.find(n=>n.stage==='buenos_aires');assert.ok(capital);assert.equal(capital.status,'victory');assert.equal(capital.turns,10);assert.equal(capital.actions,422);assert.equal(capital.elapsedSeconds,2335);assert.deepEqual(capital.losses.sort((a,b)=>a-b),[0,1,7,8,11,103,140]);
 assert.deepEqual(notes.find(n=>n.stage==='ensenada'),{stage:'ensenada',...proof.earlierPortVictory});
 const bookings=ready.events.filter(e=>e.action?.type==='recruitCivic');assert.equal(bookings.length,1,'The default coast increment books exactly its one ordinary new relief hire.');assert.equal(bookings[0].action.destination,'retiro');assert.equal(bookings[0].action.term,'day');assert.ok(bookings[0].cost>0);
 assert.equal(bookings[0].action.id,134);assert.equal(bookings[0].cost,86);assert.ok(events.some(e=>e.event==='routeBatteryRenewal'&&e.id===134&&e.price===86),'The actual off-crew reinforcement keeps his paid term during the real battery journey.');assert.ok(end.contracts[134].expiresAt*3600+(end.contracts[134].expiresSecond??0)>end.hour*3600+end.secondOfHour);
 assert.equal(ready.field.length,8);assert.ok(ready.field.includes(57)&&ready.field.includes(4)&&ready.field.includes(10));
 for(const id of ready.field){const r=end.operativeState[id];assert.equal(r.alive,true);assert.equal(r.bleeding,0);assert.ok(r.hp>=15);assert.ok(end.recruited.includes(id));assert.equal(r.location,'buenos_aires');}
 for(const id of [10,146])assert.ok(end.operativeState[id].medkits>=10);
 assert.ok(events.some(e=>e.event==='coastalCompatiblePrimary'&&e.operativeId===10&&e.weapon===1800&&e.instanceId==='cache:retiro:gun:0'&&e.target===16));
 const courier=events.find(e=>e.event==='coastalDressingCourier');assert.ok(courier);assert.equal(courier.missing,2);assert.equal(courier.endSeconds-courier.startSeconds,4*3600);
 const guns=c=>[...new Map([...Object.values(c.artilleryDepots).flat(),...Object.values(c.sectorStates).flatMap(scene=>scene.artillery??[]),...(c.pendingBattle?.artillery??[])].filter(g=>g.side==='player').map(g=>[g.id,g])).values()].sort((a,b)=>a.id.localeCompare(b.id));
 assert.deepEqual(guns(end).map(g=>[g.id,g.type]),guns(start).map(g=>[g.id,g.type]));assert.equal(guns(start).reduce((sum,g)=>sum+g.ammo+Number(g.loaded),0)-guns(end).reduce((sum,g)=>sum+g.ammo+Number(g.loaded),0),4);
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(end.operativeState[id].alive,false);assert.equal(end.operativeState[id].deathMinute,r.deathMinute);}
 for(const id of capital.losses)assert.equal(end.operativeState[id].alive,false);assert.equal(end.operativeState[57].alive,true);assert.equal(end.operativeState[2].alive,true);assert.equal(end.operativeState[2].location,'mendoza');
 const battle=enterSector(end.pendingBattle,end.sectorStates.buenos_aires);
 assert.equal(end.completed,false);assert.equal(end.defeated,false);assert.deepEqual(decodeSave(encodeSave(end,battle)),{campaign:end,battle});assert.deepEqual(start,before);
 t.diagnostic(JSON.stringify({scope:'Earned1025 commander through complete paid coastal force and native defense readiness only. This later defense, port arrival, ending and48h are not won or claimed.',clock:[end.hour,end.secondOfHour],treasury:end.resources.treasury,field:ready.field,newPaidRelief:bookings[0],capital:{turns:10,actions:422,seconds:2335,deaths:capital.losses},earlierPortVictoryPreserved:true,controlledPortArrival:false,pendingNativeDefense:end.pendingBattle.defenseGroupId,finiteChargesSpent:4,strictOfficialSave:true}));
});
