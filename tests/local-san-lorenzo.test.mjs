import test from 'node:test';
import assert from 'node:assert/strict';
import {fight} from './local-san-lorenzo-driver.mjs';
import {enterSector} from '../game/world.js';
import {actBattle,endTurn,teamCanSee} from '../game/tactical.js';
import {unitAmmunitionByType} from '../game/physical-ammunition.js';
import {ammunitionByType} from '../game/ammunition-types.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {defaultProfile} from '../game/character-profile.js';
import {dispatchCampaign} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {withStoredGear,withCarriedAmmo} from './commerce-gear-fixture.mjs';
import {secureArea} from './controlled-area-fixture.mjs';
import {order,saved,visit,leave,tactical,sync} from './local-contract-fixture.mjs';

const ammunition=b=>b.units.filter(u=>u.side==='player').reduce((total,u)=>total+Object.values(unitAmmunitionByType(u)).reduce((sum,count)=>sum+count,0),0);

function preparedSanLorenzoMission(){
 // Established control and existing local infantry isolate this mission.
 // This fixture does not claim an earned fresh two-person campaign opening.
 let s=secureArea(initialCampaign(8),'buenos_aires','san_nicolas');
 const profile={...defaultProfile(),classId:'soldado',attributes:{maxHp:85,agility:75,dexterity:75,strength:40,leadership:50,wisdom:35,marksmanship:85,mechanical:35,explosives:35,medical:35}};
 s=order(s,{type:'createOfficer',name:'Isabel del Norte',profile,answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally',specialty:'teacher',temperament:'steady'}});
 // An existing moderate wound makes post-time finite treatment and settlement
 // deterministic without requiring this particular battle to hit the commander.
 Object.assign(s.operativeState[57],{hp:s.operativeState[57].hp-28,bleeding:3,bandaged:25});
 // Three finite preexisting rifles and ten loose rounds per recipient, including
 // any existing stock. Only production orders run after this setup; no fixture
 // grant occurs during combat. Normal one-time service issue rules remain active.
 for(const id of [3,4,10]){s=withStoredGear(s,1801);s=order(s,{type:'equip',operativeId:id,itemId:1801,slot:'weapon'});const missing=10-(ammunitionByType(s.operativeState[id]).musket_75??0);if(missing>0)s=withCarriedAmmo(s,id,'ammoMusket',missing);}
 s.hour=12;s.phase=1;s.flags.academy=true;s.location='san_nicolas';s.squads[0].location='san_nicolas';for(const id of s.squad)s.operativeState[id].location='san_nicolas';
 let p=visit(saved({campaign:s}).campaign);for(const id of [3,4,10])p=tactical(p,{type:'reload',unitId:String(id)});
 return order(leave(p),{type:'attack',sector:'san_lorenzo'});
}

test('prepared local infantry regroup with the wounded commander and earn the authored San Lorenzo mission with visible targets, finite ammunition and saved replay',t=>{
 const deployment=preparedSanLorenzoMission(),request=structuredClone(deployment.pendingBattle),previous=deployment.sectorStates.san_lorenzo;
 const original=structuredClone(deployment),result=fight(request,previous);
 let replay=enterSector(request,previous),attacks=0,p={campaign:deployment,battle:replay};const before=ammunition(replay),dressingsBefore=replay.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+u.medkits,0);
 const entry=replay.units.find(u=>u.id==='57'),firstCommanderOrder=result.orders.find(order=>order.unitId==='57');
 assert.equal(firstCommanderOrder.type,'move');
 const infantry=replay.units.filter(u=>u.side==='player'&&!u.missionAlly),distanceToInfantry=point=>Math.min(...infantry.map(u=>Math.hypot(u.x-point.x,u.y-point.y)));
 assert.ok(distanceToInfantry(firstCommanderOrder)<distanceToInfantry(entry),'the commander reunites with existing infantry before contact');
 for(const [index,action]of result.orders.entries()){
  if(['fire','melee','charge'].includes(action.type)){
   const target=replay.units.find(u=>u.id===action.targetId);assert.ok(target);assert.equal(target.side,'enemy');
   assert.equal(teamCanSee(replay,'player',target),true,'hidden positions cannot choose an attack');attacks++;
  }
  replay=action.type==='endTurn'?endTurn(replay):actBattle(replay,action);assert.equal(replay.lastError,null,JSON.stringify(action));
  p=sync({campaign:p.campaign,battle:replay});replay=p.battle;
  if(index===Math.floor(result.orders.length/2)){p=saved(p);replay=p.battle;}
 }
 assert.ok(attacks>0);assert.deepEqual(replay.units,result.battle.units);assert.equal(replay.seed,result.battle.seed);assert.equal(replay.elapsedSeconds,result.battle.elapsedSeconds);
 assert.ok(ammunition(replay)<before,'the real battle spends finite rounds');
 assert.equal(result.battle.status,'victory');
 const commander=result.battle.units.find(u=>u.id==='57');assert.ok(commander.missionAlly&&commander.hp>0&&commander.hp<commander.maxHp);
 p=tactical(saved(p),{type:'explore'});
 const aid=autoBandageBattle(p.battle);for(const action of aid.steps)p=tactical(p,action);
 assert.deepEqual(p.battle.units,aid.battle.units);
 const aidedCommander=structuredClone(p.battle.units.find(u=>u.id==='57'));
 assert.ok(aidedCommander.hp>0,'finite care must keep the wounded commander alive');
 assert.equal(aidedCommander.bleeding,0,'the surviving commander receives actual finite field aid before settlement');
 const dressingsAfter=p.battle.units.filter(u=>u.side==='player').reduce((sum,u)=>sum+u.medkits,0);assert.ok(dressingsAfter<dressingsBefore,'combat and field aid spend only the existing carried dressings');
 const report={type:'battleResult',battleId:request.id,outcome:'victory',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')};
 const campaign=saved({campaign:order(p.campaign,report)}).campaign;
 assert.equal(campaign.phase,2);assert.equal(campaign.missions.san_lorenzo.completed,true);assert.equal(campaign.pendingBattle,null);
 const settledCommander=campaign.sectorStates.san_lorenzo.units.find(u=>u.id==='57'&&u.missionAlly);
 assert.ok(settledCommander.hp>0&&settledCommander.hp<=aidedCommander.hp,'post-time settlement retains the actual wounded state after finite critical aid');
 assert.ok(settledCommander.hp<settledCommander.maxHp,'field stabilization does not erase the commander’s injury');
 assert.equal(settledCommander.bleeding,0,'the surviving commander is stabilized before strategic settlement');
 assert.equal(campaign.missionAllies.san_lorenzo.hp,settledCommander.hp);
 assert.equal(campaign.missionAllies.san_lorenzo.bleeding,settledCommander.bleeding);
 assert.ok(campaign.squad.some(id=>campaign.operativeState[id].alive&&campaign.operativeState[id].hp>=15),'the actual local force can continue after settlement');
 const locals=result.battle.units.filter(u=>u.side==='player'&&!u.missionAlly),fallen=locals.filter(u=>u.hp===0).map(u=>Number(u.id));
 const recordedFallen=locals.filter(u=>campaign.operativeState[Number(u.id)].alive===false).map(u=>Number(u.id));
 assert.deepEqual(recordedFallen,fallen,'settlement retains exactly the actual local casualties');
 for(const id of fallen){assert.equal(campaign.operativeState[id].hp,0);assert.equal(campaign.operativeState[id].alive,false);assert.ok(!campaign.squad.includes(id));}
 assert.ok(dispatchCampaign(campaign,report).lastError,'the completed mission cannot settle or reward its report twice');
 assert.deepEqual(deployment,original);
 t.diagnostic(JSON.stringify({turns:result.battle.turn,orders:result.orders.length,fallen,commander:{before:entry.hp,afterCombat:commander.hp,afterCare:aidedCommander.hp,settled:settledCommander.hp},ammunition:{before,after:ammunition(result.battle)},dressings:{before:dressingsBefore,after:dressingsAfter}}));
});
