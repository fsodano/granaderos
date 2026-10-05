import assert from 'node:assert/strict';
import {enterSector} from '../game/world.js';
import {earnNervousIsolation,nervousActor,nervousSaved,nervousOrder,nervousStep} from './nervous-isolation-fixture.mjs';

export {nervousActor as renewalActor};
export const renewalSaved=nervousSaved;
export const renewalStamp=campaign=>campaign.hour*3600+(campaign.secondOfHour??0);
export function renewalStep(pair,event){
 if(event.kind==='tactical')return nervousStep(pair,event.action);
 const action=event.kind==='settle'?{type:'battleResult',battleId:pair.campaign.pendingBattle.id,outcome:pair.battle.status,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')}:
  event.kind==='leave'?{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')}:event.action;
 const campaign=nervousOrder(pair.campaign,action);
 return nervousSaved({campaign,...(campaign.pendingBattle?{battle:enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.pendingBattle.sector])}:{})});
}

// The inherited clinical arena declares seed42, native people/kit and the
// original pre-kinetic Brown Bess load before its first official admission.
// Weekly fees buy the real time needed for isolation and subsequent rest.
export function earnLowMoraleRenewal({oldRenewal=false}={}){
 const fixture=earnNervousIsolation({oldRenewal,term:'week'}),route={...fixture,events:fixture.history.map(action=>({kind:'tactical',action}))};
 const perform=event=>{route.pair=renewalStep(route.pair,event);route.events.push(structuredClone(event));};
 for(const action of [{type:'weapon',unitId:'130',slot:'primary'},{type:'reload',unitId:'130'},
  {type:'fire',unitId:'130',targetId:'enemy-0',aim:1},{type:'move',unitId:'130',x:6,y:0}])perform({kind:'tactical',action});
 const exit=route.pair.battle.exits.find(e=>e.destination==='retiro');perform({kind:'tactical',action:{type:'exit',unitIds:['130'],exitId:exit.id}});
 assert.equal(route.pair.battle.status,'retreat');perform({kind:'settle'});
 assert.equal(route.pair.campaign.operativeState[130].morale,43.7);assert.equal(route.pair.campaign.operativeState[130].hp,30);assert.equal(route.pair.campaign.operativeState[130].bleeding,0);
 assert.equal(route.pair.campaign.operativeState[110].captured,true);assert.equal(route.pair.campaign.resources.treasury,2528);
 for(let i=0;i<14;i++)perform({kind:'campaign',action:{type:'wait',hours:1}});
 assert.equal(route.pair.campaign.operativeState[130].morale,29.700000000000003);
 assert.equal(route.pair.campaign.operativeState[130].strategicIsolation.loss,14);
 return route;
}

export function recoverLowMoraleRenewal(route){
 const perform=event=>{route.pair=renewalStep(route.pair,event);route.events.push(structuredClone(event));};
 perform({kind:'campaign',action:{type:'recruitCivic',id:100,term:'week'}});
 for(let i=0;i<6;i++)perform({kind:'campaign',action:{type:'wait',hours:1}});
 route.regroup=structuredClone(route.pair);
 assert.equal(route.pair.campaign.operativeState[130].morale,24.700000000000003);
 assert.equal(route.pair.campaign.operativeState[130].strategicIsolation,undefined,'actual arrival supplies capable same-sector support');
 perform({kind:'campaign',action:{type:'assignCare',operativeId:130,assignment:'rest'}});
 for(let i=0;i<36;i++){
  if(i===30)route.beforeRecovery=structuredClone(route.pair);
  perform({kind:'campaign',action:{type:'wait',hours:1}});
 }
 assert.equal(route.beforeRecovery.campaign.operativeState[130].morale,29.700000000000003);
 assert.equal(route.pair.campaign.operativeState[130].morale,30.700000000000003);
 route.recovered=structuredClone(route.pair);
 return route;
}
