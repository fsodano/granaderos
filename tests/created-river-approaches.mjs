import {completeQueuedAssault,stageAssaultDeparture} from './assault-fixture.mjs';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {contractExpiresSeconds} from '../game/contracts.js';

// A later infantry squad uses the real friendly southern road. The first
// ready squad remains at the western gun depot when the attack is issued.
export function prepareCreatedRiverApproaches(start,field,{report=()=>{}}={}){
 let c=decodeSave(encodeSave(start)).campaign;
 const roster=rosterFor(c),rank=ids=>ids.slice().sort((a,b)=>roster.find(u=>u.id===b).marksmanship-roster.find(u=>u.id===a).marksmanship||a-b);
 const doctor=roster.filter(u=>field.includes(u.id)&&u.id!==57).sort((a,b)=>b.medical-a.medical||a.id-b.id)[0].id;
 const south=[57,doctor,...rank(field.filter(id=>id!==57&&id!==doctor)).slice(0,4)],west=field.filter(id=>!south.includes(id));
 assert.ok(west.length>=2);assert.equal(new Set([...west,...south]).size,field.length);
 const order=action=>{
  if(action.type==='wait')for(const id of field){let contract=c.contracts[id];while(contractExpiresSeconds(contract)!==null&&contractExpiresSeconds(contract)<=c.hour*3600+(c.secondOfHour??0)+action.hours*3600){
   const next=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(next.lastError,null);c=next;contract=c.contracts[id];
  }}
  const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);c=next;
 };
 const groups=[];
 for(const [origin,ids]of [['cordoba',west],['san_nicolas',south]])for(let offset=0;offset<ids.length;offset+=6){
  order({type:'createSquad',name:'Frente del río',ids:ids.slice(offset,offset+6),sector:'cordoba'});groups.push({id:c.activeSquadId,origin});
  if(origin!=='cordoba')order({type:'travel',sector:origin,queue:true,mode:'posta'});
 }
 for(let h=0;h<48&&groups.some(g=>c.squads.find(q=>q.id===g.id).journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const g of groups){const squad=c.squads.find(q=>q.id===g.id);assert.equal(squad.location,g.origin);assert.ok(!squad.journey);}
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 for(let h=0;h<48&&field.some(id=>{const u=c.operativeState[id];return u.energy<100||u.fatigue||u.asleep;});h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const operativeId of field){const u=c.operativeState[operativeId];assert.ok(u.hp===u.maxHp&&!u.bleeding&&u.energy===100&&!u.fatigue&&!u.asleep);order({type:'assignCare',operativeId,assignment:'active'});}
c=stageAssaultDeparture(c,groups.map(group=>group.id).map(id=>({id,mode:'posta'})),'santa_fe',{earliestHour:6,latestHour:10,execute:request=>{order(request);return c;}});
 for(const g of groups){order({type:'selectSquad',id:g.id});order({type:'attack',sector:'santa_fe',queue:true,mode:'posta'});}
 c=completeQueuedAssault(c,groups.map(group=>group.id),'santa_fe',{execute:request=>{order(request);return c;}});
 assert.equal(c.pendingBattle.origin,'cordoba');assert.deepEqual(c.pendingBattle.squad.map(u=>u.id).sort((a,b)=>a-b),field.slice().sort((a,b)=>a-b));
 assert.deepEqual([...new Set(c.pendingBattle.squad.map(u=>u.entryEdge))].sort(),['S','W']);
 report({event:'createdRiverApproachesReady',west,south,groups,hour:c.hour,secondOfHour:c.secondOfHour,campaign:c});
 return c;
}
