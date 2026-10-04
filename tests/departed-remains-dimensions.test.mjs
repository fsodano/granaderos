import {withStoredGear,withCarriedAmmo} from './commerce-gear-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {createBattle,actBattle,endTurn} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {validateDeploymentReturnState} from '../game/deployment-return.js';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const act=(b,a)=>{const next=actBattle(b,a);assert.equal(next.lastError,null,next.lastError);return next;};
const report=(s,b)=>({type:'leaveSector',battleId:s.pendingBattle.id,outcome:b.status,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
function departedBody(){
 let campaign=withStoredGear(initialCampaign(),1801);
 campaign=order(campaign,{type:'equip',operativeId:3,itemId:1801,slot:'weapon'});campaign=withCarriedAmmo(campaign,3,'ammoMusket',10);
 campaign=order(campaign,{type:'visitSector'});
 const request=campaign.pendingBattle,width=64,height=48;
 // A full-size boundary and an existing bleeding wound isolate return custody.
 // Departure, elapsed time, death and the report all use the real reducers.
 let battle=createBattle(request.squad.map((u,i)=>({...u,x:42+i,y:47,...(u.id===3?{hp:16,bleeding:3,bandaged:0,condition:27}:{})})),{
  ...request,width,height,enemies:[],npcs:request.npcs,props:[],
  tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',cover:0,blocked:false})),
 });
 battle=act(battle,{type:'exit',unitIds:['3'],exitId:battle.exits.find(e=>e.destination==='buenos_aires').id});
 battle=endTurn(battle);
 const corpse=structuredClone(battle.units.find(u=>u.id==='3'));
 assert.equal(corpse.hp,0);assert.deepEqual({x:corpse.x,y:corpse.y},{x:42,y:47});
 assert.ok(battle.elapsedSeconds>0);assert.equal(corpse.departure.edge,'S');
 campaign=order(campaign,report(campaign,battle));
 return {campaign,corpse};
}

test('a corpse at the full-size sector boundary keeps its exact equipment through report, save and destination entry',()=>{
 let {campaign,corpse}=departedBody();
 const expected=structuredClone(corpse);delete expected.entryEdge;delete expected.entryAnchor;delete expected.entryReason;
 assert.equal(campaign.sectorRemains.buenos_aires.length,1);
 assert.deepEqual(campaign.sectorRemains.buenos_aires[0].unit,expected);
 assert.equal(expected.weapon,1801);assert.equal(expected.condition,27);assert.ok(expected.ammo>0);
 campaign=restoreCampaign(serializeCampaign(campaign));
 assert.deepEqual(decodeSave(encodeSave(campaign)).campaign,campaign);
 // Revisiting the source replaces its battle ID while the pending body still
 // belongs to the destination. The saved source dimensions remain authoritative.
 const oldBattleId=campaign.sectorStates.retiro.battleId;
 campaign=order(campaign,{type:'wait',hours:1});
 campaign=order(campaign,{type:'visitSector'});
 let battle=enterSector(campaign.pendingBattle,campaign.sectorStates.retiro);
 campaign=order(campaign,report(campaign,battle));
 assert.notEqual(campaign.sectorStates.retiro.battleId,oldBattleId);
 assert.deepEqual(campaign.sectorRemains.buenos_aires[0].unit,expected);
 campaign=restoreCampaign(serializeCampaign(campaign));
 campaign=order(campaign,{type:'travel',sector:'buenos_aires'});
 campaign=order(campaign,{type:'visitSector'});
 battle=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 const body=battle.units.find(u=>u.id==='3');
 assert.equal(body.hp,0);assert.equal(body.y,0);
 for(const key of ['weapon','blade','condition','loaded','ammo','inventory','weaponFittings','medkits'])assert.deepEqual(body[key],expected[key]);
 const rounds=body.ammo;
 battle=act(battle,{type:'loot',unitId:'4',targetId:'3',item:'inventory:ammo:musket_75',count:rounds});
 assert.equal(battle.units.find(u=>u.id==='3').ammo,0);
 campaign=order(campaign,report(campaign,battle));
 assert.deepEqual(campaign.sectorRemains.buenos_aires,[]);
 campaign=restoreCampaign(serializeCampaign(campaign));
 campaign=order(campaign,{type:'visitSector'});
 battle=enterSector(campaign.pendingBattle,campaign.sectorStates.buenos_aires);
 assert.equal(battle.units.filter(u=>u.id==='3').length,1);
 assert.equal(battle.units.find(u=>u.id==='3').ammo,0);
});

test('corpse validation uses source or requested dimensions and still rejects coordinates and equipment outside their bounds',()=>{
 const {campaign}=departedBody();
 for(const edit of [
  s=>s.sectorRemains.buenos_aires[0].unit.x=64,
  s=>s.sectorRemains.buenos_aires[0].unit.y=48,
  s=>s.sectorRemains.buenos_aires[0].unit.ammo=-1,
  s=>s.sectorStates.retiro.width=129,
 ]){const bad=structuredClone(campaign);edit(bad);assert.throws(()=>validateDeploymentReturnState(bad));}
 const requested=structuredClone(campaign);
 delete requested.sectorStates.retiro;
 requested.pendingBattle={sector:'retiro',width:64,height:48};
 assert.doesNotThrow(()=>validateDeploymentReturnState(requested));
 requested.pendingBattle.width=20;
 assert.throws(()=>validateDeploymentReturnState(requested));
});
