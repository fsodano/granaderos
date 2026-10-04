import {withStoredGear} from './commerce-gear-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {ownedArtilleryCount,prepareSectorArtillery,validateArtilleryReport} from '../game/campaign-artillery.js';
import {deployedArtillery} from '../game/equipment.js';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,getReachable} from '../game/tactical.js';
import {order,visit,leave,saved,sync} from './local-contract-fixture.mjs';
import {issuedBattery,wonBattery,fireStationed,wakeBatteryCrew} from './stationed-artillery-fixture.mjs';
import {fight} from './opening-driver.mjs';
import {northernCombatOrder} from './northern-route.mjs';
import {secondaryRetreat} from './secondary-loot-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {propBlocksAt} from '../game/props.js';

test('declared finite stock is issued once and real victory retains the same owned physical cannon',()=>{
 const s=issuedBattery();assert.equal(s.armory.swivel,0);assert.deepEqual(deployedArtillery(s),[]);assert.equal(s.pendingBattle.artillery.length,1);assert.equal(s.pendingBattle.artillery[0].id,'piece-1');assert.equal(ownedArtilleryCount(s),1);
 const current=structuredClone(s);prepareSectorArtillery(s,s.pendingBattle);assert.deepEqual(s,current);
 const won=wonBattery();assert.equal(won.armory.swivel,0);assert.equal(ownedArtilleryCount(won),1);assert.equal(won.sectorStates.san_nicolas.artillery[0].id,'piece-1');assert.deepEqual(saved({campaign:won}).campaign,won);
});
test('actual firing, return, full saves and repeated visits retain the unloaded gun, finite reserve and full-map position',()=>{
 let p=fireStationed(visit(wonBattery())),gun=structuredClone(p.battle.artillery[0]);assert.equal(gun.loaded,false);assert.equal(gun.ammo,0);assert.ok(gun.x>=20||gun.y>=16);
 let s=leave(p);for(let i=0;i<3;i++){p=visit(saved({campaign:s}).campaign);assert.equal(p.battle.artillery.length,1);for(const key of ['id','type','x','y','loaded','ammo','facing'])assert.deepEqual(p.battle.artillery[0][key],gun[key],key);assert.equal(p.campaign.armory.swivel,0);s=leave(p);}
 assert.equal(ownedArtilleryCount(s),1);
});
test('invalid reports and forged active artillery saves cannot remove, duplicate, swap or refill owned guns',()=>{
 const s=issuedBattery(),b=enterSector(s.pendingBattle);
 for(const edit of [v=>v.artillery=[],v=>v.artillery.push({...v.artillery[0]}),v=>v.artillery[0].type='field8',v=>v.artillery[0].side='enemy',v=>v.artillery[0].ammo++,v=>v.artillery[0].id='forged']){
  const altered=structuredClone(b);edit(altered);assert.throws(()=>validateArtilleryReport(s.pendingBattle,altered));assert.throws(()=>saved({campaign:s,battle:altered}));const no=dispatchCampaign(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',sectorState:altered,survivors:altered.units.filter(u=>u.side==='player')});assert.ok(no.lastError);assert.deepEqual(no.armory,s.armory);assert.deepEqual(no.sectorStates,s.sectorStates);
 }
 assert.ok(dispatchCampaign(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',survivors:b.units.filter(u=>u.side==='player')}).lastError);
});
test('actual withdrawal leaves the issued gun to the occupation and a real return victory recaptures its exact reserve',()=>{
 let s=issuedBattery(),p=saved(sync({campaign:s,battle:enterSector(s.pendingBattle)})),gun=structuredClone(p.battle.artillery[0]);
 p=secondaryRetreat(p);s=order(p.campaign,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});s=saved({campaign:s}).campaign;assert.equal(s.armory.swivel,0);assert.equal(ownedArtilleryCount(s),0);assert.equal(s.sectorStates.san_nicolas.artillery[0].side,'enemy');
 for(const id of s.squad)s=order(s,{type:'assignCare',id,assignment:'rest'});s=advanceCampaignHours(s,10);for(const id of s.squad)s=order(s,{type:'assignCare',id,assignment:'active'});
 s=order(s,{type:'attack',sector:'san_nicolas'});const previous=s.sectorStates.san_nicolas,request={...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0};
 // Coordinate ordinary cover, body-region shots and aid against the unchanged
 // saved force. The abandoned gun remains enemy-owned until actual victory.
 const result=fight(request,previous,{controller:northernCombatOrder});assert.equal(result.battle.status,'victory');
 const replay=result.orders.reduce((battle,action)=>{const next=action.type==='endTurn'?endTurn(battle):actBattle(battle,action);assert.equal(next.lastError,null);return next;},enterSector(request,previous));assert.deepEqual(replay,result.battle);
 p=saved(sync({campaign:s,battle:result.battle}));s=saved({campaign:order(p.campaign,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')})}).campaign;
 const recovered=s.sectorStates.san_nicolas.artillery[0];assert.equal(recovered.side,'player');assert.equal(recovered.id,gun.id);assert.ok(recovered.ammo+Number(recovered.loaded)<=gun.ammo+Number(gun.loaded));for(const key of ['type','x','y','loaded','ammo'])assert.deepEqual(recovered[key],result.battle.artillery.find(g=>g.id===gun.id)[key],key);assert.equal(ownedArtilleryCount(s),1);
});
test('legacy repeated projections are reconciled against legacy paid stock once and retain the latest actual load',()=>{
 const original=leave(fireStationed(visit(wonBattery()))),old=structuredClone(original);delete old.artilleryVersion;delete old.nextArtilleryId;old.armory.swivel=1;
 const latest=old.sectorStates.san_nicolas;latest.artillery[0].id='gun-0';latest.savedHour=old.hour;const previous=structuredClone(latest);previous.sectorId='buenos_aires';delete previous.returnLedger;previous.savedHour=0;previous.artillery[0].loaded=true;old.sectorStates.buenos_aires=previous;
 const restored=restoreCampaign(serializeCampaign(old));assert.equal(restored.artilleryVersion,1);assert.equal(restored.armory.swivel,0);assert.equal(restored.sectorStates.buenos_aires.artillery.length,0);assert.equal(restored.sectorStates.san_nicolas.artillery.length,1);assert.equal(restored.sectorStates.san_nicolas.artillery[0].loaded,false);assert.equal(ownedArtilleryCount(restored),1);assert.deepEqual(saved({campaign:restored}).campaign,restored);
});

test('an actual reload spends reserve once and an empty battery choice leaves that saved emplacement in place',()=>{
 let p=visit(wonBattery());const gun=p.battle.artillery[0];assert.equal(gun.loaded,false);assert.equal(gun.ammo,1);
 const approach=p.battle.units.filter(u=>u.side==='player'&&u.hp>=15&&!u.unconscious&&!u.routed).flatMap(actor=>getReachable(p.battle,actor).filter(spot=>Math.hypot(spot.x-gun.x,spot.y-gun.y)<=1.5).map(spot=>({actor,spot}))).sort((a,b)=>a.spot.cost-b.spot.cost)[0];assert.ok(approach);
 let battle=p.battle;if(approach.spot.cost)battle=actBattle(battle,{type:'move',unitId:approach.actor.id,x:approach.spot.x,y:approach.spot.y});assert.equal(battle.lastError,null);
 battle=actBattle(battle,{type:'artilleryReload',unitId:approach.actor.id,artilleryId:gun.id});assert.equal(battle.lastError,null);assert.equal(battle.artillery[0].loaded,true);assert.equal(battle.artillery[0].ammo,0);assert.equal(battle.artillery[0].ammo+Number(battle.artillery[0].loaded),gun.ammo+Number(gun.loaded));
 p=saved(sync({campaign:p.campaign,battle}));let s=order(leave(p),{type:'configureArtillery',types:[]});p=visit(saved({campaign:s}).campaign);assert.equal(p.battle.artillery.length,1);assert.equal(p.battle.artillery[0].id,gun.id);assert.equal(p.battle.artillery[0].loaded,true);assert.equal(p.battle.artillery[0].ammo,0);assert.deepEqual(deployedArtillery(p.campaign),[]);
});

test('a second declared finite piece joins the returned battlefield without replacing or overlapping the captured gun',()=>{
 let s=issuedBattery(),p=saved(sync({campaign:s,battle:enterSector(s.pendingBattle)}));const first=structuredClone(p.battle.artillery[0]);
 p=secondaryRetreat(p);s=order(p.campaign,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});s=order(s,{type:'travel',sector:'retiro'});s=wakeBatteryCrew(s);const funds=s.resources.treasury;s=withStoredGear(s,'swivel');assert.equal(s.resources.treasury,funds);s=order(s,{type:'travel',sector:'buenos_aires'});s=wakeBatteryCrew(s);s=order(s,{type:'attack',sector:'san_nicolas'});
 p=saved({campaign:s,battle:enterSector(s.pendingBattle,s.sectorStates.san_nicolas)});const guns=p.battle.artillery;assert.equal(guns.length,2);assert.equal(s.armory.swivel,0);assert.equal(ownedArtilleryCount(s),1);assert.deepEqual(guns.map(g=>g.id),['piece-1','piece-2']);assert.equal(guns[0].side,'enemy');assert.equal(guns[1].side,'player');assert.equal(guns[0].x,first.x);assert.equal(guns[0].y,first.y);assert.notDeepEqual([guns[0].x,guns[0].y],[guns[1].x,guns[1].y]);
 for(const g of guns){const tile=p.battle.tiles.find(t=>t.x===g.x&&t.y===g.y);assert.ok(tile&&!tile.blocked&&!tile.buildingId&&tile.type!=='water'&&!propBlocksAt(p.battle,g.x,g.y));}
});

test('legacy active batteries retain their tactical identities and consume their old reusable stock only once',()=>{
 const s=issuedBattery(),battle=enterSector(s.pendingBattle);delete s.artilleryVersion;delete s.nextArtilleryId;delete s.pendingBattle.artilleryDeployment;s.armory.swivel=1;s.pendingBattle.artillery[0].id='gun-0';battle.artillery[0].id='gun-0';
 const p=saved({campaign:s,battle});assert.equal(p.campaign.armory.swivel,0);assert.equal(p.campaign.pendingBattle.artillery[0].id,'gun-0');assert.equal(p.battle.artillery[0].id,'gun-0');assert.deepEqual(saved(p),p);assert.equal(ownedArtilleryCount(p.campaign),1);
});

test('current full saves reject duplicate physical ownership, missing receipts and invalid serials or tactical identities',()=>{
 const won=wonBattery();
 for(const edit of [s=>s.nextArtilleryId=1,s=>s.artilleryVersion=2,s=>s.sectorStates.buenos_aires=structuredClone(s.sectorStates.san_nicolas)]){const bad=structuredClone(won);edit(bad);assert.throws(()=>saved({campaign:bad}),/pieza|artillería/);}
 const p=visit(won);
 for(const edit of [s=>delete s.pendingBattle.artilleryDeployment,s=>s.pendingBattle.artillery[0].ammo++,s=>s.pendingBattle.artillery=[],s=>s.pendingBattle.artilleryDeployment.issued.push(s.pendingBattle.artillery[0].id)]){const bad=structuredClone(p.campaign);edit(bad);assert.throws(()=>saved({campaign:bad,battle:p.battle}));}
 const bad=structuredClone(p.battle);bad.artillery.push({...bad.artillery[0]});assert.throws(()=>validateBattleSnapshot(bad),/artillería/);
});

test('the separate Yatasto conference does not copy stationed town artillery into its mission scene',()=>{
 // Prepared northern story boundary, reusing the actual issued, fired and
 // returned piece. This checks scene separation, not a northern conquest route.
 let s=leave(fireStationed(visit(wonBattery())));s.phase=2;s.flags.sanLorenzo=true;s.flags.northPact=true;for(const id of ['cordoba','tucuman','salta'])s.sectors[id].owner='patriot';
 const town=structuredClone(s.sectorStates.san_nicolas);s.sectorStates.san_nicolas.artillery=[];town.sectorId='tucuman';for(const e of town.returnLedger?.entries??[])e.sector='tucuman';s.sectorStates.tucuman=town;s=order(s,{type:'travel',sector:'tucuman'});s=wakeBatteryCrew(s);s=saved({campaign:s}).campaign;const before=structuredClone(s.sectorStates.tucuman.artillery);
 s=order(s,{type:'visitMission',mission:'yatasto'});let p=saved({campaign:s,battle:enterSector({...s.pendingBattle,hour:s.hour})});assert.deepEqual(p.battle.artillery,[]);assert.deepEqual(p.campaign.sectorStates.tucuman.artillery,before);s=leave(p);p=visit(saved({campaign:s}).campaign);assert.equal(p.battle.artillery.length,1);for(const key of ['id','loaded','ammo','x','y'])assert.equal(p.battle.artillery[0][key],before[0][key]);
});
