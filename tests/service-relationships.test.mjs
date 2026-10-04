import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,civicStatus} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds,contractStatus} from '../game/contracts.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {serviceRelationshipRefusal,preferredCompanions} from '../game/service-relationships.js';
import {encodeSave,decodeSave} from '../game/save.js';

const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
const save=s=>decodeSave(encodeSave(s)).campaign;
const op=(s,id)=>rosterFor(s).find(o=>o.id===id);
const now=s=>s.hour*3600+(s.secondOfHour??0);
const advanceTo=(s,target)=>{for(let i=0;i<100&&now(s)<target;i++)s=order(s,{type:'advanceStrategicTime',seconds:Math.min(3600,target-now(s))});assert.equal(now(s),target);return s;};
const paidPair=()=>order(order(order(initialCampaign(),{type:'advanceStrategicTime',seconds:17}),{type:'recruitCivic',id:107,term:'day'}),{type:'recruitCivic',id:112,term:'week'});

test('a named fictional refusal blocks actual hiring atomically before any payment or equipment issue',()=>{
 const s=save(order(initialCampaign(),{type:'recruitCivic',id:112,term:'week'})),before=structuredClone(s),quote=contractQuote(s,op(s,107));
 assert.equal(quote.available,false);assert.match(quote.reason,/Inés Aguirre.*Gaspar Villalba.*trato a los pacientes/);assert.equal(civicStatus(s,107).reason,quote.reason);
 const rejected=dispatchCampaign(s,{type:'recruitCivic',id:107,term:'day'});
 assert.equal(rejected.lastError,quote.reason);assert.deepEqual({...rejected,lastError:null},s);assert.deepEqual(s,before);
 assert.equal(rejected.operativeState[107].startingCartridgesIssued,false);assert.equal(rejected.contracts[107],undefined);
 assert.deepEqual(preferredCompanions(s,op(s,107)),[{character:'person-116',reason:'Confía en su ayuda para atender heridos.',companionId:116,companionName:'Petrona Lagos'}]);
});

test('refused renewal preserves all forty remaining paid seconds and expires through the ordinary public clock',()=>{
 let s=paidPair();const expiry=contractExpiresSeconds(s.contracts[107]);assert.equal(expiry,24*3600+17);
 s=save(advanceTo(s,expiry-40));const before=structuredClone(s),quoted=contractQuote(s,op(s,107),'day');
 assert.equal(contractStatus(s,107).remaining,40/3600);assert.equal(quoted.available,false);
 const rejected=dispatchCampaign(s,{type:'renewContract',id:107,term:'day',expectedExpiresAt:24,expectedExpiresSecond:17});
 assert.deepEqual({...rejected,lastError:null},s);assert.deepEqual(s,before);assert.equal(contractExpiresSeconds(rejected.contracts[107]),expiry);
 s=save(advanceTo(s,expiry-1));assert.ok(s.recruited.includes(107));assert.equal(contractStatus(s,107).remaining,1/3600);
 s=save(advanceTo(s,expiry));assert.equal(s.recruited.includes(107),false);assert.ok(s.recruited.includes(112));assert.equal(s.operativeState[107].alive,true);assert.equal(s.contracts[107],undefined);
});

test('real dismissal removes only the rival and permits an exactly paid renewal after save and reload',()=>{
 let s=save(paidPair());const expiry=contractExpiresSeconds(s.contracts[107]),patient=structuredClone(s.operativeState[107]),cash=s.resources.treasury;
 s=order(s,{type:'dismiss',id:112});assert.ok(!s.recruited.includes(112));assert.equal(s.contracts[112],undefined);assert.deepEqual(s.operativeState[107],patient);assert.equal(contractExpiresSeconds(s.contracts[107]),expiry);
 s=save(s);const quote=contractQuote(s,op(s,107));assert.equal(quote.available,true);assert.equal(s.resources.treasury,cash,'this ordinary dismissal has no deposit to refund');
 const renewed=order(s,{type:'renewContract',id:107,term:'day',expectedExpiresAt:24,expectedExpiresSecond:17});
 assert.equal(renewed.resources.treasury,s.resources.treasury-quote.price);assert.equal(contractExpiresSeconds(renewed.contracts[107]),expiry+24*3600);
 assert.equal(renewed.operativeState[107].hp,patient.hp);assert.deepEqual(renewed.operativeState[107].inventory,patient.inventory);assert.deepEqual(save(renewed),renewed);
});

test('only a living currently serving rival blocks, including the last fractional paid second',()=>{
 const base=paidPair();
 for(const alter of [s=>{s.operativeState[112].alive=false;s.operativeState[112].hp=0;},s=>s.operativeState[112].captured=true,s=>s.recruited=s.recruited.filter(id=>id!==112),s=>delete s.contracts[112]]){
  const s=structuredClone(base);alter(s);const before=structuredClone(s);assert.equal(serviceRelationshipRefusal(s,op(s,107)),null);assert.deepEqual(s,before);
 }
 const s=structuredClone(base);s.hour=168;s.secondOfHour=16;assert.ok(serviceRelationshipRefusal(s,op(s,107)));
 s.secondOfHour=17;s.contracts[112].departurePending=true;assert.equal(serviceRelationshipRefusal(s,op(s,107)),null);
});

test('another squad or a real march does not hide a currently serving rival',()=>{
 let s=paidPair();s=order(s,{type:'createSquad',name:'Reserva sanitaria',ids:[112]});s=order(s,{type:'attack',sector:'buenos_aires',queue:true});
 assert.ok(s.squads.find(q=>q.members.includes(112)).journey);assert.equal(contractQuote(s,op(s,107)).available,false);assert.ok(save(s));
});

test('an already accepted paid arrival is honoured when a rival enters service before it arrives',()=>{
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-112').arrivalHours=0;
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:107,term:'day'});const receipt=structuredClone(s.hiringArrivals[0]),cash=s.resources.treasury;
 s=order(s,{type:'recruitCivic',id:112,term:'day'});assert.equal(contractQuote(s,op(s,107)).available,false);s=save(s);
 const afterRival=s.resources.treasury;s=save(advanceTo(s,6*3600));assert.ok(s.recruited.includes(107));assert.equal(s.hiringArrivals.length,0);
 assert.equal(s.contracts[107].started,6);assert.equal(s.contracts[107].expiresAt,30);assert.equal(s.contracts[107].paid,receipt.paid);assert.equal(s.resources.treasury,afterRival);assert.ok(cash>afterRival);
});

test('stable authored identities carry the rule through saved content, while older packages remain neutral',()=>{
 const d=defaultContentPackage(),template=d.characters.find(c=>c.id==='person-107');
 d.characters.push({...structuredClone(template),id:'alma-doctor',name:'Alma Nueva',nickname:'Alma',arrivalHours:0,serviceRefusals:[{character:'bea-doctor',reason:'Una disputa profesional.'}],preferredCompanions:[{character:'cara-doctor',reason:'Confía en su trabajo.'}]},{...structuredClone(template),id:'bea-doctor',name:'Bea Nueva',nickname:'Bea',arrivalHours:0,serviceRefusals:[],preferredCompanions:[]},{...structuredClone(template),id:'cara-doctor',name:'Cara Nueva',nickname:'Cara',arrivalHours:0,serviceRefusals:[],preferredCompanions:[]});
 let s=initialCampaign(42,d);const a=operativeIdForCharacter(d,'alma-doctor'),b=operativeIdForCharacter(d,'bea-doctor'),c=operativeIdForCharacter(d,'cara-doctor');
 s=order(s,{type:'recruitCivic',id:b,term:'day'});s=save(s);assert.equal(contractQuote(s,op(s,a)).serviceRefusal.rivalId,b);assert.match(contractQuote(s,op(s,a)).reason,/Alma Nueva.*Bea Nueva/);
 assert.deepEqual(preferredCompanions(s,op(s,a)),[{character:'cara-doctor',reason:'Confía en su trabajo.',companionId:c,companionName:'Cara Nueva'}]);
 d.characters.find(c=>c.id==='alma-doctor').serviceRefusals=[];d.characters.find(c=>c.id==='alma-doctor').preferredCompanions=[];assert.equal(contractQuote(s,op(s,a)).available,false,'the running campaign keeps its pinned rule');assert.equal(preferredCompanions(s,op(s,a))[0].companionId,c);
 const old=defaultContentPackage();for(const c of old.characters){delete c.serviceRefusals;delete c.preferredCompanions;}old.characters.find(c=>c.id==='person-112').arrivalHours=0;
 const neutral=save(order(initialCampaign(42,old),{type:'recruitCivic',id:112,term:'day'}));assert.equal(contractQuote(neutral,op(neutral,107)).available,true);assert.deepEqual(op(neutral,107).serviceRefusals,[]);assert.deepEqual(op(neutral,107).preferredCompanions,[]);assert.deepEqual(preferredCompanions(neutral,op(neutral,107)),[]);
});

test('relationship definitions reject unknown self duplicate and malformed references without restricting authored history',()=>{
 const invalid=[c=>c.serviceRefusals=null,c=>c.serviceRefusals=[{character:'missing',reason:'Motivo'}],c=>c.serviceRefusals=[{character:c.id,reason:'Motivo'}],c=>c.serviceRefusals=[...c.serviceRefusals,...c.serviceRefusals],c=>c.serviceRefusals[0].reason='',c=>c.serviceRefusals[0].reason='x'.repeat(301),c=>c.serviceRefusals[0].unexpected=true,c=>c.serviceRefusals=['person-112'],c=>c.serviceRefusals=['person-100','person-101','person-102','person-103'].map(character=>({character,reason:'Motivo'}))];
 for(const change of invalid){const d=defaultContentPackage();change(d.characters.find(c=>c.id==='person-107'));assert.ok(validateContentPackage(d).length,change.toString());assert.throws(()=>initialCampaign(42,d));}
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-3').serviceRefusals=[{character:'person-112',reason:'Relación dramatizada por el autor.\nMotivo escrito en el editor.'}];
 assert.deepEqual(validateContentPackage(d),[]);assert.deepEqual(campaignContentReport(d).blocked,[]);assert.ok(save(initialCampaign(42,d)));
 const s=initialCampaign(42,d),bad=structuredClone(s);bad.contentCampaign.package.characters.find(c=>c.id==='person-3').serviceRefusals[0].reason='Un motivo reemplazado';assert.throws(()=>save(bad),/identidad/);
});

test('preferred companion definitions reject contradictory or malformed references and protect their pinned identity',()=>{
 const invalid=[c=>c.preferredCompanions=null,c=>c.preferredCompanions=[{character:'missing',reason:'Motivo'}],c=>c.preferredCompanions=[{character:c.id,reason:'Motivo'}],c=>c.preferredCompanions=[...c.preferredCompanions,...c.preferredCompanions],c=>c.preferredCompanions[0].reason='',c=>c.preferredCompanions[0].reason='   ',c=>c.preferredCompanions[0].reason='x'.repeat(301),c=>c.preferredCompanions[0].reason='<b>Motivo</b>',c=>c.preferredCompanions[0].reason=42,c=>c.preferredCompanions[0].unexpected=true,c=>c.preferredCompanions=['person-116'],c=>c.preferredCompanions=['person-100','person-101','person-102','person-103'].map(character=>({character,reason:'Motivo'})),c=>c.preferredCompanions=[{character:'person-112',reason:'También lo prefiere.'}]];
 for(const change of invalid){const d=defaultContentPackage();change(d.characters.find(c=>c.id==='person-107'));assert.ok(validateContentPackage(d).length,change.toString());assert.throws(()=>initialCampaign(42,d));}
 const d=defaultContentPackage();d.characters.find(c=>c.id==='person-107').preferredCompanions=[{character:'person-3',reason:'Apoyo dramatizado por el autor.\nPuede elegir un mando permanente.'}];
 assert.deepEqual(validateContentPackage(d),[]);assert.deepEqual(campaignContentReport(d).blocked,[]);const s=save(initialCampaign(42,d));assert.equal(preferredCompanions(s,op(s,107))[0].companionId,3);
 const bad=structuredClone(s);bad.contentCampaign.package.characters.find(c=>c.id==='person-107').preferredCompanions[0].reason='Un motivo reemplazado';assert.throws(()=>save(bad),/identidad/);
 const fresh=initialCampaign(),quote=contractQuote(fresh,op(fresh,107)),empty=defaultContentPackage();delete empty.characters.find(c=>c.id==='person-107').preferredCompanions;const old=initialCampaign(42,empty);assert.deepEqual(contractQuote(old,op(old,107)),quote,'a favorable preference does not change the quoted paid service');
});
