import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {lowMoraleRenewalStatus,lowMoraleRenewalReason} from '../game/morale-renewal.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {nervousStep} from './nervous-isolation-fixture.mjs';
import {localPackage} from './local-contract-fixture.mjs';

const person=s=>rosterFor(s).find(o=>o.id===130),stamp=s=>s.hour*3600+(s.secondOfHour??0);
const saved=s=>decodeSave(encodeSave(s)).campaign;
const order=(s,a)=>{const input=structuredClone(s),next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);assert.deepEqual(s,input);return saved(next);};
// Declared personal morale/cohesion boundary. No earned combat is claimed here;
// the separate paid integration earns and recovers morale through real orders.
function prepared({morale=29.7,oldPinned=false,second=17}={}){
 const content=defaultContentPackage();
 if(oldPinned)content.characters.find(c=>c.id==='person-130').abilities=content.characters.find(c=>c.id==='person-130').abilities.filter(a=>a!=='low_morale_refusal');
 let s=initialCampaign(42,content);s.operativeState[130].morale=morale;s.cohesion['110:130']=120;
 s=order(s,{type:'advanceStrategicTime',seconds:second});
 s=order(s,{type:'recruitCivic',id:130,term:'day'});s=order(s,{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'wait',hours:6});
 return s;
}
const rejection=(s,action,reason)=>{const input=structuredClone(s),next=dispatchCampaign(s,action);assert.match(next.lastError,reason);assert.deepEqual({...next,lastError:null},s);assert.deepEqual(s,input);return next;};

test('pinned paid ability uses exact personal morale, leaves hiring neutral and ignores temporary support or runtime copies',()=>{
 const s=prepared(),op=person(s),input=structuredClone(s);
 assert.equal(lowMoraleRenewalStatus(s,op).blocked,true);assert.equal(lowMoraleRenewalStatus(s,op).morale,29.7);
 assert.equal(contractRenewalQuote(s,op).available,false);assert.equal(contractQuote(s,op).available,true);
 const visited=dispatchCampaign(s,{type:'visitSector'});assert.equal(visited.lastError,null);
 const battle=enterSector(visited.pendingBattle),pair=decodeSave(encodeSave(visited,battle)),issued=pair.battle.units.find(u=>u.id==='130');
 assert.equal(issued.cohesionBonus,5);assert.equal(issued.morale,34.7);assert.equal(lowMoraleRenewalStatus(pair.campaign,issued).blocked,true);
 rejection(pair.campaign,{type:'renewContract',id:130,term:'day'},/batalla pendiente/);
 assert.equal(lowMoraleRenewalStatus(s,{...op,abilities:[]}).blocked,true,'runtime omission cannot override pinned authority');
 const old=prepared({oldPinned:true});assert.equal(lowMoraleRenewalStatus(old,{...person(old),abilities:['low_morale_refusal']}).eligible,false);
 assert.equal(contractRenewalQuote(old,person(old)).available,true);
 const contentless={...s};delete contentless.contentCampaign;assert.equal(lowMoraleRenewalStatus(contentless,op).eligible,false);
 assert.equal(lowMoraleRenewalReason(undefined,op),null);assert.equal(lowMoraleRenewalReason(s,undefined),null);assert.deepEqual(s,input);
});

test('atomic renewal refusal preserves precedence, exact contract and pay clock; thirty permits ordinary paid extensions once per reward day',()=>{
 const low=prepared(),expiry=contractExpiresSeconds(low.contracts[130]);
 rejection(low,{type:'renewContract',id:130,term:'day',expectedExpiresAt:30,expectedExpiresSecond:18},/contrato cambió/);
 rejection(low,{type:'renewContract',id:130,term:'year'},/plazos de contrato/);
 rejection(low,{type:'renewContract',id:130,term:'day',expectedExpiresAt:30,expectedExpiresSecond:17},/moral personal menor que 30/);
 assert.equal(low.operativeState[130].lastMoralePayAt,null);assert.equal(contractExpiresSeconds(low.contracts[130]),expiry);
 let s=prepared({morale:30}),q=contractRenewalQuote(s,person(s)),cash=s.resources.treasury;
 assert.equal(lowMoraleRenewalStatus(s,person(s)).blocked,false);assert.equal(q.available,true);
 s=order(s,{type:'renewContract',id:130,term:'day',expectedExpiresAt:30,expectedExpiresSecond:17});
 assert.equal(s.resources.treasury,cash-q.price);assert.equal(contractExpiresSeconds(s.contracts[130]),expiry+86400);
 assert.equal(s.operativeState[130].morale,32);assert.equal(s.operativeState[130].lastMoralePayAt,6);assert.equal(s.operativeState[130].lastMoralePaySecond,17);
 const record=structuredClone(s.operativeState[130]);s=order(s,{type:'renewContract',id:130,term:'day'});
 assert.equal(s.operativeState[130].morale,32);assert.deepEqual(s.operativeState[130],record);assert.equal(contractExpiresSeconds(s.contracts[130]),expiry+172800);
 // A rival refusal keeps its existing reason ahead of the reversible morale condition.
 const authored=defaultContentPackage();const cejas=authored.characters.find(c=>c.id==='person-130');cejas.serviceRefusals=[{character:'person-110',reason:'No acepta servir con esta persona.'}];
 let rival=initialCampaign(42,authored);rival.operativeState[130].morale=20;rival=order(rival,{type:'recruitCivic',id:130,term:'day'});rival=order(rival,{type:'recruitCivic',id:110,term:'week'});rival=order(rival,{type:'wait',hours:6});
 assert.equal(contractRenewalQuote(rival,person(rival)).reason,contractQuote(rival,person(rival)).reason);assert.match(contractRenewalQuote(rival,person(rival)).reason,/No acepta servir/);
});

test('the exact paid deadline defers departure in deployment without bypassing refusal or destroying finite returned gear',()=>{
 let s=prepared(),target=contractExpiresSeconds(s.contracts[130])-3600;
 while(stamp(s)<target)s=order(s,{type:'advanceStrategicTime',seconds:Math.min(3600,target-stamp(s))});
 s=dispatchCampaign(s,{type:'visitSector'});assert.equal(s.lastError,null);
 let pair=decodeSave(encodeSave(s,enterSector(s.pendingBattle))),before=structuredClone(pair),deadline=contractExpiresSeconds(s.contracts[130]);
 pair=nervousStep(pair,{type:'rest'});assert.equal(pair.campaign.recruited.includes(130),true);assert.equal(pair.campaign.contracts[130].departurePending,undefined);
 for(let i=0;i<5;i++)pair=nervousStep(pair,{type:'rest'});
 assert.equal(stamp(pair.campaign),deadline);assert.equal(pair.campaign.recruited.includes(130),true);assert.equal(pair.campaign.contracts[130].departurePending,true);
 assert.equal(contractRenewalQuote(pair.campaign,person(pair.campaign)).available,false);
 rejection(pair.campaign,{type:'renewContract',id:130,term:'day'},/batalla pendiente/);
 const retired=dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});assert.equal(retired.lastError,null);
 const final=saved(retired);assert.equal(final.recruited.includes(130),false);assert.equal(final.contracts[130],undefined);assert.equal(final.operativeState[130].hp,before.campaign.operativeState[130].hp);assert.equal(final.resources.treasury,before.campaign.resources.treasury);
 assert.equal(final.operativeState[130].morale,29.7);assert.equal(lowMoraleRenewalReason(final,person(final)),null);
 const cache=final.sectorStates.retiro.groundItems.filter(item=>item.id?.startsWith('service-return-'));
 assert.ok(cache.length>0||final.serviceEquipmentReturns.entries.some(entry=>entry.operativeId===130),'the ordinary expiry must retain finite returned equipment');
 assert.notEqual(contractQuote(final,person(final)).reason?.includes('moral personal'),true,'rehiring retains only the existing custody/admission reasons');
 // The same real expiry during a queued march permits the renewal dispatcher
 // to reach this rule, while departure remains deferred to actual arrival.
 let marching=prepared();while(stamp(marching)<target)marching=order(marching,{type:'advanceStrategicTime',seconds:Math.min(3600,target-stamp(marching))});
 marching=order(marching,{type:'attack',sector:'buenos_aires',queue:true});marching=order(marching,{type:'advanceStrategicTime',seconds:3600});
 assert.equal(stamp(marching),deadline);assert.equal(marching.contracts[130].departurePending,true);assert.equal(marching.squads.find(q=>q.members.includes(130)).journey.status,'moving');
 rejection(marching,{type:'renewContract',id:130,term:'day'},/moral personal menor que 30/);
});

test('paid authoring includes local contract residents but excludes permanent, ambiguous and legacy definitions',()=>{
 const d=localPackage({pay:0});d.characters.find(c=>c.id==='alma-contract').abilities=['low_morale_refusal'];assert.deepEqual(validateContentPackage(d),[]);
 const id=operativeIdForCharacter(d,'alma-contract'),s=initialCampaign(42,d),op=rosterFor(s).find(o=>o.id===id);
 // Pure selector control before official admission: a serving local paid identity
 // has the same rule even when the authored price is zero.
 s.operativeState[id].morale=29;s.recruited.push(id);s.contracts[id]={kind:'paid',term:'day',started:0,expiresAt:24,paid:0};
 assert.equal(lowMoraleRenewalStatus(s,op).blocked,true);assert.equal(contractQuote(s,op).available,true);
 for(const mutation of [c=>c.service='permanent',c=>delete c.service,c=>c.recruitmentSource='invalid']){
  const bad=structuredClone(d);mutation(bad.characters.find(c=>c.id==='alma-contract'));assert.ok(validateContentPackage(bad).length>0);
 }
 const historical=defaultContentPackage();historical.characters.find(c=>c.id==='person-0').abilities=['low_morale_refusal'];assert.ok(validateContentPackage(historical).some(error=>error.includes('servicio pagado explícito')));
});
