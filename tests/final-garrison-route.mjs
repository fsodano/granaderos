import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {collectRouteItems} from './finite-route-equipment.mjs';

// Rebuild an actual local defense while the wounded veteran receives paid
// care with actual carried dressings. Strategic threats continue during every wait.
export function prepareTucumanGarrison(start,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const field=[1000,139,144];
 const order=action=>{
  if(action.type==='wait')for(const id of field){const contract=c.contracts[id];if(contract?.expiresAt!==null&&contract?.expiresAt<=c.hour+1){const n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});assert.equal(n.lastError,null,n.lastError);c=n;}}
  const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);c=next;
 };
 assert.equal(c.sectors.tucuman.owner,'patriot');
 order({type:'createSquad',name:'Instrucción de Tucumán',ids:[1000],sector:'tucuman'});const garrison=c.activeSquadId;
 order({type:'militia',sector:'tucuman',rank:0,trainerId:1000});
 order({type:'createSquad',name:'Evacuación a Córdoba',ids:[139,144],sector:'tucuman'});const hospital=c.activeSquadId;
 order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});
 order({type:'assignCare',operativeId:57,assignment:'rest'});
 for(let h=0;h<48&&c.squads.find(q=>q.id===hospital).journey;h++){
  assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});
 }
 assert.equal(c.location,'cordoba');
 order({type:'assignCare',operativeId:139,assignment:'patient'});
 let returning=false;
 for(let h=0;h<144;h++){
  if(c.pendingEncounter)break;
  const healed=c.operativeState[139].hp===c.operativeState[139].maxHp;
  if(!returning){
   if(!healed){
    const doctors=[144,...(c.operativeState[57].energy>=80&&c.operativeState[57].fatigue<=20?[57]:[])];
    for(const operativeId of doctors){if(!c.operativeState[operativeId].medkits)c=collectRouteItems(c,operativeId,{item:'medkits'},1).campaign;order({type:'assignCare',operativeId,assignment:'doctor'});}
   }else{
    for(const operativeId of [139,144])order({type:'assignCare',operativeId,assignment:'rest'});
    if([139,144].every(id=>c.operativeState[id].fatigue===0)){
     for(const operativeId of [139,144])order({type:'assignCare',operativeId,assignment:'active'});
     order({type:'travel',sector:'tucuman',queue:true,mode:'posta'});returning=true;
    }
   }
  }
  const total=c.sectors.tucuman.militia.reduce((a,b)=>a+b,0);
  if(total<6&&!c.militiaTraining.some(t=>t.sector==='tucuman'))order({type:'militia',sector:'tucuman',rank:0,trainerId:1000});
  if(total>=6&&returning&&!c.squads.find(q=>q.id===hospital).journey)break;
  order({type:'wait',hours:1});
 }
 if(!c.pendingEncounter){assert.equal(c.operativeState[139].hp,c.operativeState[139].maxHp);assert.ok(c.sectors.tucuman.militia.reduce((a,b)=>a+b,0)>=6);assert.equal(c.operativeState[139].location,'tucuman');order({type:'selectSquad',id:garrison});}
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);
 report({hour:c.hour,treasury:c.resources.treasury,militia:c.sectors.tucuman.militia,patient:c.operativeState[139].hp,maxHp:c.operativeState[139].maxHp,pendingEncounter:c.pendingEncounter});return c;
}

export function prepareTucumanDefense(start){
 let c=decodeSave(encodeSave(start)).campaign;const ids=[1000,139,144];
 const order=action=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);c=next;};
 order({type:'squad',ids});
 const heavy=c.sectorStates.tucuman.artillery.find(g=>g.side==='player'&&g.type==='bronze4');assert.ok(heavy);
 assert.ok(heavy.loaded||heavy.ammo>0,'the actual stationed battery needs remaining finite ammunition');
 for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<48&&!c.pendingEncounter;h++){
  for(const id of ids){const contract=c.contracts[id];if(contract?.expiresAt!==null&&contract?.expiresAt<=c.hour+1)order({type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt});}
  order({type:'wait',hours:1});
 }
 assert.equal(c.pendingEncounter?.sector,'tucuman');
 order({type:'respondToEncounter',groupId:c.pendingEncounter.groupId,choice:'tactical'});
 assert.ok(c.pendingBattle);assert.ok(c.pendingBattle.squad.length>=3);return c;
}
