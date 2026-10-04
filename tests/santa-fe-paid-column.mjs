import {collectReturnedServiceKit} from './returned-service-kit.mjs';
import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {baseMorale} from '../game/morale.js';
import {routeHiringCeiling} from './funded-route-fixture.mjs';

// Pay for the actual available survivors before resting a replacement column.
// Fresh elite day terms begin after the returning veterans finish paid rest.
export function prepareSantaFePaidColumn(start,{report=()=>{},count=6,reserve=10000,maxSavingHours=40000,extraRestIds=[],restAtSourceIds=[]}={}){
 let c=structuredClone(start),protectedIds=[];
 const restLocations=new Map(restAtSourceIds.map(id=>[id,c.operativeState[id].location]));
 assert.ok(restAtSourceIds.every(id=>extraRestIds.includes(id)),'only the separately prepared rear guard may remain at its actual source');
 const order=action=>{
  if(action.type==='wait')for(const id of protectedIds){const contract=c.contracts[id];if(contract?.expiresAt!=null&&contract.expiresAt<=c.hour+action.hours){const term='week',cash=c.resources.treasury;const next=dispatchCampaign(c,{type:'renewContract',id,term,expectedExpiresAt:contract.expiresAt});assert.equal(next.lastError,null,next.lastError);c=next;report({event:'santaFePaidRestRenewal',id,price:cash-c.resources.treasury,hour:c.hour,expiresAt:c.contracts[id].expiresAt});}}
  const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+next.lastError);c=next;
 };
 const healthy=op=>{const unit=c.operativeState[op.id];return unit.alive&&!unit.captured&&unit.hp===unit.maxHp&&!unit.bleeding;};
 const permanent=rosterFor(c).filter(op=>healthy(op)&&c.recruited.includes(op.id)&&c.contracts[op.id]?.kind==='patriot'&&c.operativeState[op.id].location==='cordoba').sort((a,b)=>Number(b.id===57)-Number(a.id===57)||b.marksmanship-a.marksmanship).slice(0,count).map(op=>op.id);
 assert.ok(permanent.includes(57),'the actual living command leads the river column');
 order({type:'squad',ids:permanent});
 const cheap=rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&healthy(op)&&c.operativeState[op.id].location==='cordoba'&&contractQuote(c,op,'day').available&&contractQuote(c,op,'day').price<=routeHiringCeiling(c,100)).sort((a,b)=>b.marksmanship-a.marksmanship).slice(0,count-permanent.length);
 for(const op of cheap)if(!c.recruited.includes(op.id)){const quote=contractQuote(c,op,'week'),cash=c.resources.treasury;order({type:'recruitCivic',id:op.id,term:'week',destination:'cordoba'});assert.equal(c.resources.treasury,cash-quote.price);report({event:'santaFeSupportHired',id:op.id,price:quote.price,term:'week',treasuryBefore:cash,treasuryAfter:c.resources.treasury,hour:c.hour});}
 const base=[...permanent,...cheap.map(op=>op.id)];protectedIds=cheap.map(op=>op.id);
 order({type:'squad',ids:base});for(const operativeId of base)order({type:'assignCare',operativeId,assignment:'rest'});
 const collectReturns=()=>{c=collectReturnedServiceKit(c,'cordoba',base,{report});};
 collectReturns();
 const candidates=()=>rosterFor(c).filter(op=>op.id>=100&&op.id<1000&&!base.includes(op.id)&&healthy(op)&&contractQuote(c,op,'day').available&&(!c.recruited.includes(op.id)||c.operativeState[op.id].location==='cordoba')).sort((a,b)=>b.marksmanship-a.marksmanship||contractQuote(c,a,'day').price-contractQuote(c,b,'day').price).slice(0,count-base.length);
 const extras=()=>extraRestIds.map(id=>rosterFor(c).find(op=>op.id===id)).filter(op=>!base.includes(op.id)&&healthy(op)&&contractQuote(c,op,'day').available);
 const funds=()=>{const replacements=[...candidates(),...extras()],restHours=Math.max(0,...replacements.map(op=>(baseMorale(op)-c.operativeState[op.id].morale)*6))+48;return reserve+replacements.reduce((sum,op)=>sum+(c.operativeState[op.id].morale<baseMorale(op)?Math.ceil(restHours/168)*contractQuote(c,op,'week').price:2*contractQuote(c,op,'day').price),0);};
 for(let hours=0;hours<maxSavingHours&&(candidates().length<count-base.length||extras().length<extraRestIds.length||c.resources.treasury<funds());hours+=24){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:24});collectReturns();if(hours%2400===0)report({event:'santaFeIncomeSaved',campaign:c,hour:c.hour,treasury:c.resources.treasury,required:funds()});}
 assert.equal(extras().length,extraRestIds.length);assert.equal(candidates().length,count-base.length);assert.ok(c.resources.treasury>=funds(),'ordinary income pays the complete current-quote column and its finite supplies');
 const replacements=candidates().map(op=>op.id),resting=[...replacements,...extraRestIds].filter(id=>c.operativeState[id].morale<baseMorale(rosterFor(c).find(op=>op.id===id)));
 report({event:'santaFePaidColumnFunded',campaign:c,hour:c.hour,treasury:c.resources.treasury,required:funds(),base,replacements,resting,extraRestIds});
 const hire=(id,term)=>{const op=rosterFor(c).find(op=>op.id===id),quote=contractQuote(c,op,term),cash=c.resources.treasury,source=c.operativeState[id].location,destination=c.sectors[source]?.owner==='patriot'?source:'cordoba';order(c.recruited.includes(id)?{type:'renewContract',id,term,expectedExpiresAt:c.contracts[id].expiresAt}:{type:'recruitCivic',id,term,destination});assert.equal(c.resources.treasury,cash-quote.price);report({event:'santaFeSupportHired',id,price:quote.price,term,source,destination,treasuryBefore:cash,treasuryAfter:c.resources.treasury,hour:c.hour});return destination;};
 const groups=[];
 for(const id of resting){
  const source=hire(id,'week');assert.ok(c.recruited.includes(id),'the actual hire must arrive before resting or marching');
  order({type:'createSquad',name:'Veteranos de Santa Fe',ids:[id],sector:source});groups.push(c.activeSquadId);order({type:'assignCare',operativeId:id,assignment:source==='cordoba'||restLocations.has(id)?'rest':'active'});if(source!=='cordoba'&&!restLocations.has(id))order({type:'travel',sector:'cordoba',mode:'posta',queue:true});
 }
 protectedIds=[...new Set([...protectedIds,...resting])];
 for(let h=0;h<48&&groups.some(id=>c.squads.find(group=>group.id===id)?.journey);h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 for(const id of resting){assert.equal(c.operativeState[id].location,restLocations.get(id)??'cordoba');order({type:'assignCare',operativeId:id,assignment:'rest'});}
 for(let hours=0;hours<600&&[...base,...resting].some(id=>c.operativeState[id].morale<baseMorale(rosterFor(c).find(op=>op.id===id)));hours+=6){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:6});}
 for(const id of [...base,...resting]){assert.ok(c.operativeState[id].alive);assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.ok(c.operativeState[id].morale>=baseMorale(rosterFor(c).find(op=>op.id===id)));}
 const selectBase=()=>{const group=c.squads.find(q=>q.location==='cordoba'&&q.members.some(id=>base.includes(id)));assert.ok(group);order({type:'selectSquad',id:group.id});};
 selectBase();order({type:'squad',ids:[...base,...resting.filter(id=>!restLocations.has(id))].slice(0,6)});
 for(const id of [...replacements,...extraRestIds].filter(id=>!resting.includes(id))){const destination=hire(id,'day');if(destination!=='cordoba'&&!restLocations.has(id)){order({type:'createSquad',name:'Refuerzo de Santa Fe',ids:[id],sector:destination});const group=c.activeSquadId;order({type:'travel',sector:'cordoba',mode:'posta',queue:true});protectedIds.push(id);for(let h=0;h<48&&c.squads.find(q=>q.id===group)?.journey;h++)order({type:'wait',hours:1});}}
 const field=[...base,...replacements];for(const id of field){assert.ok(c.recruited.includes(id));assert.equal(c.operativeState[id].location,'cordoba');}
 selectBase();order({type:'squad',ids:field});assert.equal(field.length,count);
 report({event:'santaFePaidColumnReady',campaign:c,hour:c.hour,treasury:c.resources.treasury,field:field.map(id=>({id,morale:c.operativeState[id].morale,hp:c.operativeState[id].hp,expiresAt:c.contracts[id].expiresAt}))});
 for(const [id,unit]of Object.entries(start.operativeState))if(!unit.alive)assert.equal(c.operativeState[id].alive,false);
 return c;
}
