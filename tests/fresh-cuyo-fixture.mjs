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

const deaths=c=>Object.entries(c.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));

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
  const result=fightNorthernSector(c,sector,{controller:coastalBatteryController(enterSector(c.pendingBattle,c.sectorStates[sector]),{sharedArtillerySight:true})});
  c=result.campaign;assert.equal(c.defeated,false);assert.equal(c.sectors[sector].owner,'patriot');assert.equal(c.completed,false);
  checkpoint(sector,{actions:result.summary.actions,turns:result.summary.turns});
 };
 c=prepareCreatedMendozaAssault(c);fight('mendoza');
 assert.equal(c.operativeState[2].alive,true);assert.equal(c.operativeState[57].alive,true);assert.ok(!c.recruited.includes(57));
 const survivors=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured&&c.operativeState[id].location==='mendoza');
 assert.ok(survivors.length>0&&survivors.length<=6);c=order(c,{type:'squad',ids:survivors});
 const p=visit(c),aid=autoBandageBattle(p.battle);assert.ok(!aid.error);c=leave(sync({campaign:p.campaign,battle:aid.battle}));
 for(const id of survivors){assert.ok(c.operativeState[id].hp>=15);assert.equal(c.operativeState[id].bleeding,0);}
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
