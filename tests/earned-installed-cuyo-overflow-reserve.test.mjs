import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeSave,encodeSave} from '../game/save.js';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoCount} from '../game/ammo-types.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {handRecord} from '../game/tactical-inventory.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {enterSector} from '../game/world.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {spaceKey,sameCell} from '../game/tactical-space.js';
import {stockCuyoBatteryReservePosts,prepareStockCuyoBatteryReserve} from './stock-cuyo-reserve-readiness.mjs';
import {stockAmmunitionLedger,prepareCreatedMendozaAssault} from './created-cuyo-route.mjs';
import {admitEarnedArtillerySave,beforeEarnedArtilleryMarkers} from './earned-artillery-admission-fixture.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const markerScenes={sectors:['retiro','buenos_aires','san_nicolas','san_lorenzo','cordoba','tucuman','salta'],scenes:{yatasto:'tucuman'},weaponReferences:{count:326,ids:['firearm-1800','firearm-1801','firearm-1802','firearm-1803','firearm-1804','firearm-1805','firearm-1806','firearm-1807','firearm-1808','blade-1809','blade-1810','blade-1811','blade-1811-loose','blade-1812','blade-1813']},label:'installed Cuyo reserve input'};
function input(){
 const stem='./fixtures/earned-installed-cuyo-overflow-reserve',proof=JSON.parse(readFileSync(new URL(stem+'.provenance.json',import.meta.url))),packed=readFileSync(new URL(stem+'.save.json.gz',import.meta.url)),raw=gunzipSync(packed);
 assert.equal(sha(packed),proof.gzipSha256);assert.equal(sha(raw),proof.rawSha256);assert.equal(raw.length,proof.rawBytes);assert.equal(JSON.parse(raw).savedAt,proof.savedAt);
 const campaign=admitEarnedArtillerySave(raw.toString(),markerScenes).campaign;
 assert.equal(sha(JSON.stringify(beforeEarnedArtilleryMarkers(campaign,markerScenes))),proof.decodedCampaignSha256,'The original decoded-value hash stays exact after only the validated marker fields are removed from a copy.');
 assert.deepEqual([campaign.hour,campaign.secondOfHour,campaign.resources.treasury],[...proof.clock,proof.treasury]);return {campaign,proof};
}
const guns=c=>({depots:c.artilleryDepots,transfers:c.artilleryTransfers,stores:c.artilleryStores,field:Object.fromEntries(Object.entries(c.sectorStates).map(([id,s])=>[id,s.artillery]))});
function replay(preparation){
 let supplied=structuredClone(preparation.equipmentStart);const ledger=stockAmmunitionLedger(supplied);
 for(const [index,action]of preparation.supplyOrders.entries()){
  supplied=dispatchCampaign(supplied,action);assert.equal(supplied.lastError,null);assert.deepEqual(stockAmmunitionLedger(supplied),ledger);
  if(index===Math.floor(preparation.supplyOrders.length/2))supplied=decodeSave(encodeSave(supplied)).campaign;
 }
 assert.deepEqual(supplied,preparation.equipmentReady,'Every physical donation and allocation replays before reserve movement.');
 let pair={campaign:structuredClone(preparation.equipmentReady),battle:null};const posture=new Map(),crossings=[];
 for(const [index,step]of preparation.journal.entries()){
  if(step.kind==='campaign'){pair.campaign=dispatchCampaign(pair.campaign,step.action);assert.equal(pair.campaign.lastError,null);}
  else if(step.kind==='enter'){pair.battle=enterSector(pair.campaign.pendingBattle,pair.campaign.sectorStates.cordoba);for(const id of pair.campaign.squad)posture.set(String(id),pair.battle.units.find(u=>u.id===String(id)).stance);}
  else if(step.kind==='battle'){
   const before=pair.battle.units.find(u=>u.id===step.action.unitId);
   if(step.action.type==='move'){
    const path=getReachable(pair.battle,before,{stopAt:p=>sameCell(p,step.action)}).find(p=>sameCell(p,step.action));assert.ok(path);
    if(path.path.some(p=>p.kind==='climb')){assert.equal(before.stance,'standing');assert.equal(path.path.filter(p=>p.kind==='climb').length,2);crossings.push({id:Number(before.id),energyBefore:before.energy,elapsedBefore:pair.battle.elapsedSeconds});}
   }
   pair.battle=actBattle(pair.battle,step.action);assert.equal(pair.battle.lastError,null);
   const crossing=crossings.findLast(row=>row.id===Number(step.action.unitId)&&row.energyAfter===undefined);if(crossing){const after=pair.battle.units.find(u=>u.id===step.action.unitId);crossing.energyAfter=after.energy;crossing.elapsedAfter=pair.battle.elapsedSeconds;assert.ok(crossing.energyAfter<crossing.energyBefore);assert.ok(crossing.elapsedAfter>crossing.elapsedBefore);}
  }else if(step.kind==='sync'){const next=syncBattleTime(pair.campaign,pair.battle);assert.equal(next.error,null);pair={campaign:next.campaign,battle:next.battle};}
  else if(step.kind==='leave'){
   for(const id of pair.campaign.squad)assert.equal(pair.battle.units.find(u=>u.id===String(id)).stance,posture.get(String(id)),'A native crossing restores the actual initial posture.');
   pair.campaign=dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:step.battleId,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});assert.equal(pair.campaign.lastError,null);pair.battle=null;
  }else assert.fail('Unknown native reserve preparation step.');
  if(index===Math.floor(preparation.journal.length/2)){
   // Official paired saves require the real tactical clock to be synchronized.
   // The later journal sync remains idempotent and must replay exactly.
   if(pair.battle){const next=syncBattleTime(pair.campaign,pair.battle);assert.equal(next.error,null);pair={campaign:next.campaign,battle:next.battle};}
   pair=decodeSave(encodeSave(pair.campaign,pair.battle));
  }
 }
 return {campaign:decodeSave(encodeSave(pair.campaign)).campaign,crossings,enteredPostures:[...posture].map(([id,stance])=>({id:Number(id),stance}))};
}

test('the genuine twenty-one reserves retain all priority posts and use unique authored cells instead of dropping overflow residents',()=>{
 const {campaign:c,proof}=input(),before=structuredClone(c),scene=expandCellScene(c.sectorStates.cordoba,c),posts=stockCuyoBatteryReservePosts(c);
 assert.deepEqual(posts.map(p=>p.id),proof.reserveIds);assert.equal(posts.length,21);assert.equal(new Set(posts.map(spaceKey)).size,21);
 const preferred=scene.upperSurfaces.filter(p=>p.buildingId===proof.originalRoofId&&!p.blocked&&p.kind==='roof').sort((a,b)=>b.x-a.x||b.y-a.y);assert.equal(preferred.length,19);
 assert.deepEqual(posts.slice(0,19).map(({id,...point})=>point),preferred.map(({x,y,tacticalLevel})=>({x,y,tacticalLevel})));
 for(const post of posts){const cell=scene.upperSurfaces.find(p=>sameCell(p,post));assert.ok(cell&&!cell.blocked&&cell.kind==='roof');assert.ok(!c.squad.includes(post.id));assert.equal(c.operativeState[post.id].residentSector,'cordoba');}
 assert.deepEqual(posts.slice(19).map(p=>p.id),[129,122]);assert.ok(posts.slice(19).every(p=>scene.upperSurfaces.find(q=>sameCell(p,q)).buildingId!==proof.originalRoofId));assert.deepEqual(c,before);
 const insufficient=structuredClone(c);insufficient.sectorStates.cordoba.upperSurfaces=insufficient.sectorStates.cordoba.upperSurfaces.filter(p=>p.buildingId===proof.originalRoofId);assert.throws(()=>stockCuyoBatteryReservePosts(insufficient),/enough distinct authored roof cells/);
 assert.throws(()=>prepareStockCuyoBatteryReserve(c,[posts[0],{...posts[0],id:posts[1].id}]),/distinct post/);
});

test('all twenty-one actual reserves reach their paid posts with finite equipment, exact native journal replay and official midpoint saves',t=>{
 const {campaign:start,proof}=input(),before=structuredClone(start),posts=stockCuyoBatteryReservePosts(start),ledger=stockAmmunitionLedger(start),oldGuns=structuredClone(guns(start)),result=prepareStockCuyoBatteryReserve(start,posts),{campaign:c,preparation}=result,replayed=replay(preparation);
 assert.deepEqual(start,before);assert.deepEqual(c.recruited,start.recruited);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.squad,proof.fieldCrew);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(guns(c),oldGuns);assert.deepEqual(stockAmmunitionLedger(c),ledger);
 assert.deepEqual(preparation.positions,posts);assert.equal(preparation.positions.length,21);assert.equal(new Set(preparation.positions.map(spaceKey)).size,21);assert.deepEqual(replayed.campaign,c);assert.deepEqual(replayed.crossings.map(row=>row.id),[129,122]);
 // A later visit can replace the earlier scene unit record. The independent
 // journal checks each real entered posture immediately before its own leave.
 assert.deepEqual(replayed.enteredPostures,preparation.enteredPostures);
 assert.deepEqual(preparation.donations.map(({donor,family,count})=>({donor,family,count})),[{donor:119,family:'ammoMusket',count:11},{donor:139,family:'ammoMusket',count:4}]);
 assert.deepEqual(stockAmmunitionLedger(preparation.equipmentStart),ledger);assert.deepEqual(stockAmmunitionLedger(preparation.equipmentReady),ledger);
 for(const id of [119,139]){
  const a=sectorInventoryModel(preparation.equipmentStart,'cordoba',rosterFor(preparation.equipmentStart),id).personal,b=sectorInventoryModel(preparation.equipmentReady,'cordoba',rosterFor(preparation.equipmentReady),id).personal;
  assert.deepEqual(handRecord(b,'primary'),handRecord(a,'primary'),'Off-family donation preserves the exact held pistol.');
  const old=carriedAmmunition(rosterFor(preparation.equipmentStart).find(op=>op.id===id),preparation.equipmentStart.operativeState[id]),now=carriedAmmunition(rosterFor(preparation.equipmentReady).find(op=>op.id===id),preparation.equipmentReady.operativeState[id]);
  assert.ok(now.loaded+ammoCount(now,'ammoPistol')>=old.loaded+ammoCount(old,'ammoPistol'));assert.equal(ammoCount(now,'ammoMusket'),ammoCount(old,'ammoMusket')-preparation.donations.find(row=>row.donor===id).count);
 }
 assert.ok(preparation.elapsedSeconds>0);assert.equal(c.hour*3600+c.secondOfHour-start.hour*3600-start.secondOfHour,preparation.elapsedSeconds);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);
 for(const [id,r]of Object.entries(start.operativeState))for(const key of ['alive','hp','maxHp','bleeding','bandaged','medkits','captured','morale','deathMinute','headwear','outfit','legwear'])assert.deepEqual(c.operativeState[id][key],r[key],id+'.'+key+' remains physical and unchanged');
 for(const post of posts){assert.deepEqual(c.operativeState[post.id].residentPosition,{x:post.x,y:post.y,tacticalLevel:post.tacticalLevel});assert.equal(c.operativeState[post.id].assignment,start.operativeState[post.id].assignment);}
 t.diagnostic(JSON.stringify({scope:'Earned complete reserve formation and paid native cross-roof placement only; battery raid, Mendoza victory and full ending remain separate',inputRaw:proof.rawSha256,reserves:posts.length,fieldCrew:c.squad,crossings:replayed.crossings,clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury,elapsedSeconds:preparation.elapsedSeconds,ammunitionTransactions:preparation.ammunition}));
});

test('an old crouched scene copy does not replace the actual entered posture during paid overflow descent and ascent',()=>{
 const {campaign:start}=input(),post=stockCuyoBatteryReservePosts(start).find(p=>p.id===122),old=expandCellScene(start.sectorStates.cordoba,start).units.find(u=>u.id==='122');assert.equal(old.stance,'crouched');
 const {campaign:c,preparation}=prepareStockCuyoBatteryReserve(start,[post]),replayed=replay(preparation);
 assert.deepEqual(replayed.campaign,c);assert.deepEqual(replayed.crossings.map(row=>row.id),[122]);assert.deepEqual(preparation.enteredPostures,[{id:122,stance:'standing'}]);assert.deepEqual(replayed.enteredPostures,preparation.enteredPostures);assert.deepEqual(preparation.journal.filter(row=>row.kind==='battle'&&row.action.type==='stance'),[]);assert.equal(c.sectorStates.cordoba.units.find(u=>u.id==='122').stance,preparation.enteredPostures[0].stance);
});

test('the unchanged paid stock Mendoza caller finishes real reserve preparation and booking before its original battery operation',t=>{
 const {campaign:start,proof}=input(),before=structuredClone(start),events=[],stop=new Error('complete actual pre-battery preparation'),posts=stockCuyoBatteryReservePosts(start);let ready;
 assert.throws(()=>prepareCreatedMendozaAssault(start,{routeKind:'stock',report:e=>{events.push(e);if(e.event==='stockCuyoPreBatteryReady'){ready=e;throw stop;}}}),e=>e===stop);
 assert.ok(ready);assert.deepEqual(start,before);assert.deepEqual(ready.posts,posts);const c=ready.campaign,p=events.find(e=>e.event==='stockCuyoReserveReady');assert.ok(p);assert.deepEqual(p.positions,posts);
 // The unchanged caller hires114 before it snapshots the stock crew. This
 // actual paid immediate arrival occupies the one remaining public squad slot.
 assert.deepEqual(c.squad,[...proof.fieldCrew,114]);assert.equal(c.squad.length,6);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(events.some(e=>e.event==='routeBatteryPrepared'),false);
 const hired=c.recruited.filter(id=>!start.recruited.includes(id));for(const id of start.recruited){assert.ok(c.recruited.includes(id));for(const key of ['alive','hp','bleeding','medkits','captured','morale'])assert.deepEqual(c.operativeState[id][key],start.operativeState[id][key]);}
 const hireCost=hired.reduce((sum,id)=>sum+c.contracts[id].paid,0),renewals=events.filter(e=>e.event==='stockCuyoRenewal'),renewalCost=renewals.reduce((sum,e)=>sum+e.price,0);assert.ok(hired.includes(114));assert.equal(c.hour,start.hour,'This preparation has no midnight income.');assert.equal(start.resources.treasury-c.resources.treasury,hireCost+renewalCost);
 for(const id of hired){const op=rosterFor(c).find(o=>o.id===id),q=contractQuote(start,op,c.contracts[id].term);assert.equal(c.contracts[id].paid,q.price);assert.ok(c.contracts[id].expiresAt>c.hour);assert.equal(c.operativeState[id].location,'cordoba');}
 for(const e of renewals){const q=contractQuote(start,rosterFor(start).find(o=>o.id===e.id),'day');assert.equal(e.price,q.price);}
 for(const id of start.recruited){const old=start.contracts[id],count=renewals.filter(e=>e.id===id).length;assert.equal(c.contracts[id].expiresAt,old.expiresAt===null?null:old.expiresAt+24*count);assert.equal(c.contracts[id].expiresSecond??0,old.expiresSecond??0);}
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);t.diagnostic(JSON.stringify({scope:'Earned complete paid reserve and booking preparation only; no battery delivery, native rear battle, Mendoza victory or ending claim',inputRaw:proof.rawSha256,reserves:ready.posts.length,field:c.squad,hired,hireCost,renewalCost,renewals,clock:[c.hour,c.secondOfHour],treasury:c.resources.treasury}));
});
