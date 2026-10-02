import assert from 'node:assert/strict';
import {artilleryCount} from '../game/economy.js';
import {enterSector} from '../game/world.js';
import {autoBandageBattle} from '../game/auto-bandage.js';
import {order,saved,visit,sync,leave} from './local-contract-fixture.mjs';
import {freshNorthernRoute} from './fresh-northern-fixture.mjs';
import {assembleCreatedCuyo,prepareCreatedMendozaAssault} from './created-cuyo-route.mjs';
import {startFreshFoundry,prepareFreshArmyFunding,completeFreshArmyFunding} from './fresh-cuyo-route.mjs';
import {prepareFreshUspallataAssault,recoverFreshUspallata,prepareFreshLosPatosAssault,completeFreshAndesPreparation} from './fresh-mountain-route.mjs';
import {coastalBatteryController} from './coastal-command-driver.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {extractItemQuantity} from '../game/tactical-inventory.js';
import {sectorDeploymentAction,sectorDeploymentModel} from '../game/sector-deployment.js';
import {actBattle,artilleryContact} from '../game/tactical.js';

const deaths=c=>Object.entries(c.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));

// Adjacent issued guns can share the same first available helpers. Open the
// leading crew's lane through real paid drags before the usual controller.
export function deployCuyoMountainBattery(start){
 let battle=start;const model=sectorDeploymentModel(battle);assert.ok(model);assert.equal(model.units.length,8);
 for(const arrival of model.units){
  const unit=battle.units.find(u=>u.id===arrival.id);assert.ok(unit);
  battle=sectorDeploymentAction(battle,{type:'placeDeployment',unitIds:[unit.id],x:unit.x,y:unit.y});assert.equal(battle.lastError,null,battle.lastError);
 }
 battle=sectorDeploymentAction(battle,{type:'confirmDeployment'});assert.equal(battle.lastError,null,battle.lastError);
 const before=structuredClone(battle),goal={x:Math.floor(battle.width*.65),y:Math.floor(battle.height*.5)};
 const guns=battle.artillery.filter(g=>g.side==='player').sort((a,b)=>Math.hypot(a.x-goal.x,a.y-goal.y)-Math.hypot(b.x-goal.x,b.y-goal.y)||String(a.id).localeCompare(String(b.id)));
 assert.equal(guns.length,2);const [frontId,rearId]=guns.map(g=>g.id);
 const shared=()=>{const front=battle.artillery.find(g=>g.id===frontId),rear=battle.artillery.find(g=>g.id===rearId);return battle.units.some(u=>u.side==='player'&&u.hp>=15&&artilleryContact(battle,u,front)&&artilleryContact(battle,u,rear));};
 let moves=0;
 for(;moves<6&&shared();moves++){
  const front=battle.artillery.find(g=>g.id===frontId),dx=Math.sign(goal.x-front.x);assert.notEqual(dx,0);
  const candidates=battle.units.filter(u=>u.side==='player'&&u.hp>=15&&artilleryContact(battle,u,front));
  const valid=candidates.map(u=>actBattle(battle,{type:'artilleryMove',unitId:u.id,artilleryId:front.id,x:front.x+dx,y:front.y})).find(next=>!next.lastError);
  assert.ok(valid,'an actual available crew must open the issued gun lane');battle=valid;
 }
 assert.equal(shared(),false,'the two paid crews must have separate gun lanes');
 if(moves)assert.ok(battle.elapsedSeconds>before.elapsedSeconds,'ordinary artillery moves charge tactical time');
 const gunCustody=({x,y,...gun})=>gun;
 assert.deepEqual(battle.artillery.map(gunCustody),before.artillery.map(gunCustody),'paid drags retain every physical gun record');
 for(const unit of battle.units){const old=before.units.find(u=>u.id===unit.id);for(const key of ['hp','maxHp','bleeding','ammo','loaded','ammunition','ammunitionVersion','medkits','weapon','weaponInstanceId','weaponMetadata','condition','weaponFittings','weaponFittingPattern','blade','bladeInstanceId','bladeMetadata','bladeCondition','bladeFittingPattern','inventory','headwear','outfit','legwear'])assert.deepEqual(unit[key],old[key]);assert.ok(unit.ap<=old.ap&&unit.energy<=old.energy,'ordinary gun drags cannot grant readiness');}
 return battle;
}

// Continue a real new campaign. Preparation pays for the survivors, finite
// supplies and physical journeys; every battle is replayed and saved in full.
export function freshCuyoRoute({onCheckpoint}={}){
 const prefix=freshNorthernRoute();let c=assembleCreatedCuyo(prefix.campaign);const notes=[];
 const checkpoint=(stage,extra={})=>{
  c=saved({campaign:c}).campaign;
  const record={stage,hour:c.hour,second:c.secondOfHour,funds:c.resources.treasury,phase:c.phase,squad:[...c.squad],deaths:deaths(c),engineerHp:c.operativeState[2].hp,commanderHp:c.operativeState[57].hp,...extra};
  notes.push(record);onCheckpoint?.(stage,c,notes);
 };
 const fight=sector=>{
  assert.ok(c.pendingBattle);assert.equal(c.pendingBattle.sector,sector);
  const deploy=sector==='los_patos'?deployCuyoMountainBattery:undefined,initial=enterSector(c.pendingBattle,c.sectorStates[sector],{placement:Boolean(deploy)});
  const result=fightNorthernSector(c,sector,{deploy,controller:coastalBatteryController(deploy?deploy(initial):initial,{sharedArtillerySight:true})});
  c=result.campaign;assert.equal(c.defeated,false);assert.equal(c.sectors[sector].owner,'patriot');assert.equal(c.completed,false);
  checkpoint(sector,{actions:result.summary.actions,turns:result.summary.turns});
 };
 c=prepareCreatedMendozaAssault(c);fight('mendoza');
 assert.equal(c.operativeState[2].alive,true);assert.equal(c.operativeState[57].alive,true);assert.ok(!c.recruited.includes(57));
 const survivors=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='mendoza');
 assert.ok(survivors.length>0);
 // Keep every actual survivor in a lawful local group. Treat the critical
 // group first, before foundry meetings or travel can advance the clock.
 const beforeFormation=structuredClone(c),groups=[];
 for(let offset=0;offset<survivors.length;offset+=6){
  const ids=survivors.slice(offset,offset+6);
  c=order(c,{type:'createSquad',name:'Socorro de Mendoza',ids,sector:'mendoza'});
  groups.push({id:c.activeSquadId,members:ids});
  assert.deepEqual(c.squads.find(q=>q.id===c.activeSquadId).members,ids);
  assert.ok(ids.length<=6);
 }
 assert.deepEqual(c.operativeState,beforeFormation.operativeState,'local formation keeps all wounds, health and locations');
 assert.deepEqual(c.loadouts,beforeFormation.loadouts);assert.deepEqual(c.contracts,beforeFormation.contracts);
 assert.equal(c.resources.treasury,beforeFormation.resources.treasury);assert.equal(c.hour,beforeFormation.hour);assert.equal(c.secondOfHour,beforeFormation.secondOfHour);
 const urgent=group=>group.members.some(id=>c.operativeState[id].hp<15||c.operativeState[id].bleeding>0);
 for(const group of [...groups].sort((a,b)=>Number(urgent(b))-Number(urgent(a)))){
  c=order(c,{type:'selectSquad',id:group.id});
  const p=visit(c),dressings=p.battle.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.medkits,0),aid=autoBandageBattle(p.battle);
  assert.equal(aid.battle.lastError,null);
  const treatments=aid.steps.filter(action=>action.type==='useItem').length;
  assert.equal(aid.battle.units.filter(u=>u.side==='player').reduce((n,u)=>n+u.medkits,0),dressings-treatments,'first aid consumes one existing dressing per treatment');
  c=leave(sync({campaign:p.campaign,battle:aid.battle}));
  for(const id of group.members){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].location,'mendoza');}
  c=saved({campaign:c}).campaign;
 }
 c=order(c,{type:'selectSquad',id:groups[0].id});
 for(const id of survivors)assert.equal(c.operativeState[id].alive,true,'recovery does not discard overflow survivors');
 // The elite was paid for this assault. End that costly service normally
 // before the foundry wait; his actual property remains here for collection.
 if(survivors.includes(142)){
  const before=structuredClone(c),collectorId=survivors.find(id=>id!==142&&c.operativeState[id].hp>=15&&!c.operativeState[id].asleep);
  assert.notEqual(collectorId,undefined);
  const model=sectorInventoryModel(c,'mendoza',rosterFor(c),142),kit=model.carried.map(row=>extractItemQuantity(model.personal,row.item,row.count).stack);
  const oldKeys=new Set(sectorInventoryModel(c,'mendoza',rosterFor(c),collectorId).entries.map(row=>row.key));
  assert.equal(c.contracts[142].kind,'paid');assert.equal(c.contracts[142].term,'day');
  c=order(c,{type:'dismiss',id:142});
  assert.equal(c.operativeState[142].alive,true);assert.ok(!c.recruited.includes(142));assert.equal(c.contracts[142],undefined);
  for(const key of ['hp','maxHp','bleeding','bandaged','energy','fatigue','morale','location'])assert.deepEqual(c.operativeState[142][key],before.operativeState[142][key],'ending service keeps the actual survivor condition');
  assert.equal(c.resources.treasury,before.resources.treasury);assert.equal(c.hour,before.hour);assert.equal(c.secondOfHour,before.secondOfHour);
  const returned=sectorInventoryModel(c,'mendoza',rosterFor(c),collectorId).entries.filter(row=>!oldKeys.has(row.key)).map(row=>JSON.parse(row.expected));
  const key=stack=>`${stack.item}:${stack.weapon??stack.outfit??stack.ammoType??''}`;
  const sorted=stacks=>[...stacks].sort((a,b)=>key(a).localeCompare(key(b)));
  assert.deepEqual(sorted(returned),sorted(kit),'every exact carried stack remains in the local return once');
  c=saved({campaign:c}).campaign;
 }
 c=startFreshFoundry(c);assert.equal(c.flags.foundry,true);assert.ok(c.recruited.includes(2)&&c.recruited.includes(7));
 c=completeFreshArmyFunding(prepareFreshArmyFunding(c));assert.equal(c.flags.armyFunded,true);assert.equal(artilleryCount(c),3);assert.equal(c.phase,3);checkpoint('funded',{artillery:artilleryCount(c)});
 c=prepareFreshUspallataAssault(c);fight('uspallata');
 c=prepareFreshLosPatosAssault(recoverFreshUspallata(c));fight('los_patos');
 assert.ok(!c.recruited.includes(57),'the commander joins through the subsequent physical meeting');
 c=completeFreshAndesPreparation(c);
 assert.equal(c.phase,4);assert.ok(c.recruited.includes(57));assert.equal(c.contracts[57].expiresAt,null);assert.equal(c.contracts[57].paid,0);assert.ok(c.squad.includes(57));assert.ok(c.operativeState[57].hp>0);
 for(const id of deaths(prefix.campaign))assert.equal(c.operativeState[id].alive,false);
 assert.ok(c.squad.every(id=>c.operativeState[id].alive));assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.equal(c.pendingBattle,null);assert.ok(c.resources.treasury>=0);
 checkpoint('commander');return {campaign:c,notes,prefix:prefix.notes};
}
