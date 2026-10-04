import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign as freshCampaign,dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {defaultProfile} from '../game/character-profile.js';
import {actBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {ownedArtilleryCount} from '../game/campaign-artillery.js';
import {FINITE_ARTILLERY_ARSENALS} from '../game/finite-artillery-arsenals.js';
import {artilleryTransportQuote,artilleryStorageQuote,storedArtilleryRecord} from '../game/artillery-transport.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {order,visit,saved,leave} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';

// Existing territorial control isolates normal arsenal discovery and custody.
// The stock opening acceptance test earns Buenos Aires through real combat.
function atArsenal(sector='buenos_aires'){
 let s=initialCampaign();if(sector==='cordoba')Object.assign(s.sectors.cordoba,{owner:'patriot',loyalty:65});
 return order(s,{type:'travel',sector});
}
function recovered(sector='buenos_aires'){
 const start=atArsenal(sector),before=structuredClone(start),pair=takeFiniteCache(visit(start),sector==='buenos_aires'?4:3,[]),state=leaveFiniteCache(pair);
 assert.deepEqual(start,before);return {state,pair};
}
const reject=(state,action)=>{const before=structuredClone(state),next=dispatchCampaign(state,action);assert.ok(next.lastError);assert.deepEqual({...next,lastError:null},before);assert.deepEqual(state,before);};

test('a stock hostile opening has no arsenal guns and cannot manufacture a friendly discovery request',()=>{
 let s=order(freshCampaign(8),{type:'createOfficer',name:'Isabel del Norte',profile:defaultProfile(),answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}});
 assert.equal(ownedArtilleryCount(s),0);s=order(s,{type:'attack',sector:'buenos_aires'});
 assert.equal(s.pendingBattle.finiteArtilleryArsenal,undefined);assert.deepEqual(s.pendingBattle.artillery,[]);
 const b=enterSector(s.pendingBattle);assert.deepEqual(b.artillery,[]);assert.equal(b.finiteArtilleryArsenal,undefined);
 const forged=structuredClone(s);forged.pendingBattle.finiteArtilleryArsenal=structuredClone(FINITE_ARTILLERY_ARSENALS.buenos_aires);
 assert.throws(()=>restoreCampaign(serializeCampaign(forged)),/arsenal/);
});

test('a local soldier must discover and open the conquered arsenal before its finite gun becomes owned',()=>{
 const start=atArsenal(),p=visit(start),source=FINITE_ARTILLERY_ARSENALS.buenos_aires;
 assert.deepEqual(p.battle.artillery,[]);assert.deepEqual(p.campaign.artilleryArsenalRecoveries,{});
 const remote=actBattle(p.battle,{type:'environment',unitId:'4',kind:'container',id:source.chest,verb:'open'});assert.ok(remote.lastError);assert.deepEqual(remote.artillery,[]);
 const pair=takeFiniteCache(p,4,[]),gun=pair.battle.artillery[0];
 assert.equal(gun.id,source.pieces[0].id);assert.equal(gun.type,'bronze4');assert.equal(gun.loaded,true);assert.equal(gun.ammo,6);
 assert.equal(pair.campaign.resources.treasury,start.resources.treasury);assert.ok(pair.battle.elapsedSeconds>0);
 assert.deepEqual(saved(pair),pair,'an active discovery retains its trusted request and exact finite piece');
 const state=leaveFiniteCache(pair);assert.equal(ownedArtilleryCount(state),1);
 assert.equal(state.artilleryArsenalRecoveries.buenos_aires.battleId,p.campaign.pendingBattle.id);
 assert.deepEqual(state.sectorStates.buenos_aires.artillery,pair.battle.artillery);assert.deepEqual(saved({campaign:state}).campaign,state);
});

test('discovery rejects forged identities, added shots, hidden or orphan source metadata atomically',()=>{
 const p=takeFiniteCache(visit(atArsenal()),4,[]);
 for(const alter of [b=>b.artillery[0].id='arsenal:unknown:1',b=>b.artillery[0].type='field8',b=>b.artillery[0].ammo=7,b=>delete b.props.find(prop=>prop.id===FINITE_ARTILLERY_ARSENALS.buenos_aires.chest).artilleryRecovered,b=>b.props.find(prop=>prop.id===FINITE_ARTILLERY_ARSENALS.buenos_aires.chest).knownToPlayer=false,b=>delete b.finiteArtilleryArsenal]){
  const battle=structuredClone(p.battle);alter(battle);
  assert.throws(()=>decodeSave(encodeSave(p.campaign,battle)),/arsenal|despliegue/);
  reject(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:battle,survivors:battle.units.filter(unit=>unit.side==='player')});
 }
});

test('transport, old-save admission and reopening keep one canonical gun and never refill the arsenal',()=>{
 let {state:s}=recovered();const source=FINITE_ARTILLERY_ARSENALS.buenos_aires,gun=structuredClone(s.sectorStates.buenos_aires.artillery[0]);
 s=order(s,{type:'transport',mode:'carts'});const quote=artilleryTransportQuote(s,'buenos_aires',gun.id,'retiro','carts');assert.equal(quote.available,true,quote.reason);
 s=order(s,{type:'transportArtillery',sector:'buenos_aires',artilleryId:gun.id,to:'retiro',mode:'carts'});
 assert.deepEqual(s.sectorStates.buenos_aires.artillery,[]);assert.deepEqual(s.artilleryTransfers[0].gun,storedArtilleryRecord(gun));
 s=saved({campaign:s}).campaign;const reopened=visit(s);assert.equal(reopened.campaign.pendingBattle.finiteArtilleryArsenal,undefined);assert.deepEqual(reopened.battle.artillery,[]);
 let battle=actBattle(reopened.battle,{type:'useItem',unitId:'4',environment:{kind:'container',id:source.chest,verb:'close'}});assert.equal(battle.lastError,null,battle.lastError);
 battle=actBattle(battle,{type:'useItem',unitId:'4',environment:{kind:'container',id:source.chest,verb:'open'}});assert.equal(battle.lastError,null,battle.lastError);assert.deepEqual(battle.artillery,[]);
 s=leave({campaign:reopened.campaign,battle});s=advanceCampaignHours(s,quote.hours);
 assert.deepEqual(s.artilleryDepots.retiro,[storedArtilleryRecord(gun)]);assert.equal(ownedArtilleryCount(s),1);
 const before=structuredClone(s),nextVisit=visit(s);assert.deepEqual(nextVisit.battle.artillery,[]);s=leave(nextVisit);assert.equal(ownedArtilleryCount(s),1);
 assert.deepEqual(s.artilleryArsenalRecoveries,before.artilleryArsenalRecoveries);
 const legacy=initialCampaign();delete legacy.artilleryArsenalVersion;delete legacy.artilleryArsenalRecoveries;
 const migrated=restoreCampaign(serializeCampaign(legacy));assert.deepEqual(migrated.artilleryArsenalRecoveries,{});assert.equal(ownedArtilleryCount(migrated),0);
});

test('unknown, future, missing and orphan saved recovery ledgers are rejected',()=>{
 const {state}=recovered(),source=FINITE_ARTILLERY_ARSENALS.buenos_aires;
 for(const alter of [s=>s.artilleryArsenalRecoveries.unknown={battleId:'fake',hour:0,second:0},s=>s.artilleryArsenalRecoveries.buenos_aires.hour=s.hour+1,s=>s.artilleryArsenalRecoveries.buenos_aires.second=3600,s=>delete s.artilleryArsenalRecoveries.buenos_aires,s=>s.sectorStates.buenos_aires.artillery=[],s=>{s.artilleryArsenalRecoveries={};s.sectorStates.buenos_aires.artillery=[];},s=>delete s.sectorStates.buenos_aires.props.find(prop=>prop.id===source.chest).artilleryRecovered,s=>s.artilleryArsenalVersion=2,s=>s.artilleryArsenalRecoveries.buenos_aires.extra=true,s=>s.sectorStates.buenos_aires.artillery[0].id='arsenal:unknown:1']){
  const bad=structuredClone(state);alter(bad);assert.throws(()=>restoreCampaign(serializeCampaign(bad)),/arsenal/);
 }
 assert.equal(state.sectorStates.buenos_aires.artillery[0].id,source.pieces[0].id);
});

test('local storage requires real available crew and preserves the recovered gun exactly once',()=>{
 let {state}=recovered(),gun=structuredClone(state.sectorStates.buenos_aires.artillery[0]);
 const action={type:'storeArtillery',sector:'buenos_aires',artilleryId:gun.id},before=structuredClone(state);
 assert.equal(artilleryStorageQuote(state,action.sector,gun.id).available,true);
 for(const alter of [s=>s.location='retiro',s=>s.sectors.buenos_aires.owner='royalist',s=>s.sectorStates.buenos_aires.artillery[0].side='enemy',s=>s.squad.forEach(id=>s.operativeState[id].asleep=true),s=>s.squad=s.squad.slice(0,1)]){const bad=structuredClone(state);alter(bad);assert.equal(artilleryStorageQuote(bad,action.sector,gun.id).available,false);assert.ok(dispatchCampaign(bad,action).lastError);}
 const visitPair=visit(state);reject(visitPair.campaign,action);
 state=order(state,action);assert.deepEqual(state.sectorStates.buenos_aires.artillery,[]);assert.deepEqual(state.artilleryDepots.buenos_aires,[storedArtilleryRecord(gun)]);assert.equal(ownedArtilleryCount(state),1);
 assert.equal(state.resources.treasury,before.resources.treasury);assert.equal(state.hour,before.hour);assert.equal(state.secondOfHour,before.secondOfHour);assert.deepEqual(state.artilleryArsenalRecoveries,before.artilleryArsenalRecoveries);reject(state,action);
 state=saved({campaign:state}).campaign;state=order(state,{type:'configureArtillery',types:[`depot:${gun.id}`]});
 assert.equal(visit(state).battle.artillery.length,0,'an ordinary visit does not automatically issue a stored gun');
 assert.deepEqual(state.artilleryDepots.buenos_aires,[storedArtilleryRecord(gun)]);
});

test('Córdoba and Ensenada each expose only their own finite canonical inventory',()=>{
 for(const sector of ['cordoba','ensenada']){
  const {state}=recovered(sector),source=FINITE_ARTILLERY_ARSENALS[sector];
  assert.deepEqual(state.sectorStates[sector].artillery.map(storedArtilleryRecord),source.pieces);
  assert.equal(ownedArtilleryCount(state),2);assert.deepEqual(saved({campaign:state}).campaign,state);
 }
});
