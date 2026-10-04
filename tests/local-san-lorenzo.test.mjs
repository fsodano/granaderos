import test from 'node:test';
import assert from 'node:assert/strict';
import {freshCoastalRoute} from './fresh-coastal-fixture.mjs';
import {fight} from './local-san-lorenzo-driver.mjs';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,teamCanSee} from '../game/tactical.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';

const ammunition=b=>b.units.filter(u=>u.side==='player').reduce((total,u)=>total+Object.values(unitAmmunitionByType(u)).reduce((sum,count)=>sum+count,0),0);
test('stock local survivors regroup with the commander and earn San Lorenzo with visible targets, finite ammunition and saved replay',()=>{
 let request,previous,result;
 const {campaign,notes}=freshCoastalRoute('local',{
  fightFinal:(deployment,prior)=>{request=structuredClone(deployment);previous=prior;return result=fight(deployment,prior);},
 });
 assert.equal(notes[0].funds,3200,'the actual 3200-peso start finds Cabral’s opening rifle in the finite arsenal');
 assert.deepEqual(notes[0].squad,[1000,3]);assert.ok(notes.every(note=>note.funds>=0));
 assert.equal(campaign.phase,2);assert.equal(campaign.missions.san_lorenzo.completed,true);assert.equal(campaign.pendingBattle,null);
 assert.equal(result.battle.status,'victory');
 const commander=result.battle.units.find(u=>u.id==='57');assert.ok(commander.missionAlly&&commander.hp>0&&commander.hp<commander.maxHp);
 const settledCommander=campaign.sectorStates.san_lorenzo.units.find(u=>u.id==='57'&&u.missionAlly);
 assert.ok(settledCommander.hp>0&&settledCommander.hp<=commander.hp,'real post-battle movement and finite aid retain all intervening wound loss');
 assert.equal(settledCommander.bleeding,0,'the surviving commander is stabilized before strategic settlement');
 assert.equal(campaign.missionAllies.san_lorenzo.hp,settledCommander.hp);
 assert.equal(campaign.missionAllies.san_lorenzo.bleeding,settledCommander.bleeding);
 assert.ok(campaign.squad.some(id=>campaign.operativeState[id].alive&&campaign.operativeState[id].hp>=15),'the actual local force can continue after settlement');
 const fallen=notes.at(-1).deaths;assert.ok(fallen.length>0);
 for(const id of fallen){assert.equal(campaign.operativeState[id].hp,0);assert.equal(campaign.operativeState[id].alive,false);assert.ok(!campaign.squad.includes(id));}
 let replay=enterSector(request,previous),attacks=0;const before=ammunition(replay);
 const entry=replay.units.find(u=>u.id==='57'),firstCommanderOrder=result.orders.find(order=>order.unitId==='57');
 assert.equal(firstCommanderOrder.type,'move');
 const infantry=replay.units.filter(u=>u.side==='player'&&!u.missionAlly),distanceToInfantry=p=>Math.min(...infantry.map(u=>Math.hypot(u.x-p.x,u.y-p.y)));
 assert.ok(distanceToInfantry(firstCommanderOrder)<distanceToInfantry(entry),'the commander reunites with existing riflemen before contact');
 for(const order of result.orders){
  if(['fire','melee','charge'].includes(order.type)){
   const target=replay.units.find(u=>u.id===order.targetId);assert.ok(target);assert.equal(target.side,'enemy');
   assert.equal(teamCanSee(replay,'player',target),true,'hidden positions cannot choose an attack');attacks++;
  }
  replay=order.type==='endTurn'?endTurn(replay):actBattle(replay,order);assert.equal(replay.lastError,null,JSON.stringify(order));
 }
 assert.ok(attacks>0);assert.deepEqual(replay.units,result.battle.units);assert.equal(replay.seed,result.battle.seed);assert.equal(replay.elapsedSeconds,result.battle.elapsedSeconds);
 assert.ok(ammunition(replay)<before,'the real battle spends finite rounds');
});
