import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {doctorRate,careStatus,careAssignmentReason} from '../game/medical-care.js';
import {serviceReturnSources} from '../game/service-equipment-return.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {preparedCare,assignedCare,DOCTOR,PATIENT,OTHER_DOCTOR,OTHER_PATIENT} from './medical-care-fixture.mjs';
const op=(s,id)=>rosterFor(s).find(o=>o.id===id);

test('strategic doctors first stop bleeding, then heal with finite supplies, preserving work through active saves',()=>{
 let s=assignedCare(),hp=s.operativeState[PATIENT].hp;assert.equal(s.hour,0);assert.equal(s.operativeState[DOCTOR].medkits,4);
 s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[PATIENT].hp,hp);assert.equal(s.operativeState[PATIENT].bleeding,0);assert.equal(s.operativeState[DOCTOR].medkits,3);
 s=order(saved({campaign:s}).campaign,{type:'wait',hours:1});assert.equal(s.operativeState[PATIENT].hp,hp+doctorRate(op(s,DOCTOR)));assert.equal(s.operativeState[DOCTOR].energy,94);assert.equal(s.operativeState[DOCTOR].fatigue,4);
 s=order(s,{type:'wait',hours:3});assert.equal(s.operativeState[DOCTOR].medkits,0);assert.equal(s.operativeState[PATIENT].hp,hp+18);assert.match(careStatus(s,op(s,DOCTOR),rosterFor(s)),/no tiene vendas/);
 const money=s.resources.treasury;s=order(s,{type:'purchaseMedicalSupplies',id:DOCTOR,quantity:4});assert.equal(s.resources.treasury,money-40);s=order(s,{type:'wait',hours:3});assert.equal(s.operativeState[PATIENT].hp,op(s,PATIENT).maxHp);assert.equal(s.operativeState[DOCTOR].medkits,2,'complete patients consume no further supply');assert.match(careStatus(s,op(s,PATIENT),rosterFor(s)),/Recuperado/);
 for(const id of [DOCTOR,PATIENT])s=order(s,{type:'assignCare',id,assignment:'active'});const p=visit(saved({campaign:s}).campaign);assert.equal(p.battle.units.find(u=>u.id===String(PATIENT)).hp,op(s,PATIENT).maxHp);assert.equal(p.battle.units.find(u=>u.id===String(DOCTOR)).medkits,2);assert.ok(saved({campaign:leave(p)}));
});

test('medical work is local, prioritizes bleeding and cannot double-treat a patient in one hour',()=>{
 let s=assignedCare({twoPairs:true});s=order(s,{type:'assignCare',id:OTHER_DOCTOR,assignment:'doctor'});const before=s.operativeState[OTHER_DOCTOR].medkits;
 s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[OTHER_DOCTOR].medkits,before);assert.equal(s.operativeState[PATIENT].bleeding,0);
 s=order(s,{type:'assignCare',id:OTHER_PATIENT,assignment:'patient'});const a=s.operativeState[PATIENT].hp,b=s.operativeState[OTHER_PATIENT].hp;s=order(s,{type:'wait',hours:1});assert.ok(s.operativeState[PATIENT].hp>a);assert.ok(s.operativeState[OTHER_PATIENT].hp>b);assert.equal(s.operativeState[OTHER_DOCTOR].medkits,before-1);
 s=order(s,{type:'assignCare',id:OTHER_DOCTOR,assignment:'active'});s=order(s,{type:'assignCare',id:OTHER_PATIENT,assignment:'active'});s=order(s,{type:'purchaseMedicalSupplies',id:DOCTOR,quantity:10});s=order(s,{type:'createSquad',name:'Otra posta',ids:[OTHER_DOCTOR,OTHER_PATIENT]});s=order(s,{type:'travel',sector:'buenos_aires'});
 s=order(s,{type:'assignCare',id:OTHER_PATIENT,assignment:'patient'});const remote=s.operativeState[OTHER_PATIENT].hp,stock=s.operativeState[DOCTOR].medkits;assert.ok(stock>0);s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[OTHER_PATIENT].hp,remote);assert.equal(s.operativeState[DOCTOR].medkits,stock);assert.match(careStatus(s,op(s,OTHER_PATIENT),rosterFor(s)),/Sin médico/);
 const rejected=dispatchCampaign(s,{type:'purchaseMedicalSupplies',id:DOCTOR,quantity:2});assert.ok(rejected.lastError);assert.equal(rejected.resources.treasury,s.resources.treasury);
});

test('care assignments block deployment and competing militia work, and reject unqualified or unavailable doctors',()=>{
 let s=assignedCare();for(const action of [{type:'travel',sector:'buenos_aires'},{type:'attack',sector:'san_nicolas'},{type:'visitSector'}]){const n=dispatchCampaign(s,action);assert.match(n.lastError,/servicio/);assert.equal(n.hour,s.hour);}
 assert.ok(dispatchCampaign(s,{type:'assignCare',id:PATIENT,assignment:'doctor'}).lastError);assert.ok(dispatchCampaign(s,{type:'assignCare',id:99999,assignment:'doctor'}).lastError);assert.ok(dispatchCampaign(s,{type:'assignCare',id:DOCTOR,assignment:'unknown'}).lastError);
 assert.ok(dispatchCampaign(s,{type:'militia',sector:'retiro',rank:0,trainerId:DOCTOR}).lastError);
 s=order(s,{type:'assignCare',id:DOCTOR,assignment:'active'});s=order(s,{type:'militia',sector:'retiro',rank:0,trainerId:DOCTOR});assert.ok(dispatchCampaign(s,{type:'assignCare',id:DOCTOR,assignment:'doctor'}).lastError);s=order(s,{type:'cancelMilitia',sector:'retiro'});
 s=order(s,{type:'assignCare',id:PATIENT,assignment:'active'});const p=visit(s);assert.ok(dispatchCampaign(p.campaign,{type:'assignCare',id:DOCTOR,assignment:'doctor'}).lastError);
});

test('expired and dismissed medical staff leave no hidden work, free supply or invalid assignment',()=>{
 let s=assignedCare({term:'day'});s=advanceCampaignHours(s,s.contracts[DOCTOR].expiresAt-1-s.hour);assert.equal(s.hour,23);s=order(s,{type:'purchaseMedicalSupplies',id:DOCTOR,quantity:2});const hp=s.operativeState[PATIENT].hp;s=order(s,{type:'wait',hours:1});assert.ok(!s.recruited.includes(DOCTOR));assert.equal(s.operativeState[DOCTOR].assignment,'active');assert.equal(s.operativeState[DOCTOR].medkits,0);assert.equal(s.operativeState[PATIENT].hp,hp,'the expired doctor cannot treat and an unattended patient does not heal');
 const returned=serviceReturnSources(s,'retiro').filter(row=>row.stack?.item==='medkits');assert.equal(returned.length,1);assert.equal(returned[0].stack.count,2,'the two paid dressings stay in local return custody');
 s=saved({campaign:s}).campaign;assert.deepEqual(serviceReturnSources(s,'retiro').filter(row=>row.stack?.item==='medkits'),returned);
 s=order(s,{type:'recruitCivic',id:DOCTOR,term:'week'});assert.equal(s.operativeState[DOCTOR].assignment,'active');assert.equal(s.operativeState[DOCTOR].medkits,0,'rehiring cannot issue the returned dressings again');assert.match(dispatchCampaign(s,{type:'assignCare',id:DOCTOR,assignment:'doctor'}).lastError,/vendas/);
 s=order(s,{type:'assignCare',id:PATIENT,assignment:'active'});s=leave(visit(s));
 const rows=state=>sectorInventoryModel(state,'retiro',rosterFor(state),DOCTOR).entries.filter(row=>JSON.parse(row.expected).item==='medkits');
 const localTotal=rows(s).reduce((total,row)=>total+row.count,0),row=rows(s).find(row=>row.kind==='serviceReturn');assert.equal(row.count,2);assert.ok(row.reachable);
 const collect={type:'sectorInventory',sector:'retiro',operativeId:DOCTOR,direction:'take',sourceKey:row.key,expected:row.expected,count:2};s=order(s,collect);assert.equal(s.operativeState[DOCTOR].medkits,2);assert.equal(rows(s).reduce((total,item)=>total+item.count,0),localTotal-2);assert.ok(dispatchCampaign(s,collect).lastError);
 s=order(s,{type:'assignCare',id:DOCTOR,assignment:'doctor'});s=order(s,{type:'dismiss',id:DOCTOR});assert.equal(s.operativeState[DOCTOR].assignment,'active');assert.equal(s.operativeState[DOCTOR].medkits,0);
 s=saved({campaign:s}).campaign;assert.equal(rows(s).reduce((total,item)=>total+item.count,0),localTotal,'dismissal returns the two recovered dressings once');assert.ok(!rows(s).some(item=>item.key===row.key),'the consumed expiry source cannot be reused');
});

test('medical supply purchases and saved assignments reject invalid quantities, funds and forged roles',()=>{
 const s=preparedCare();for(const quantity of [0,-1,1.5,21,'2',null]){const n=dispatchCampaign(s,{type:'purchaseMedicalSupplies',id:DOCTOR,quantity});assert.ok(n.lastError);assert.equal(n.resources.treasury,s.resources.treasury);assert.equal(n.operativeState[DOCTOR].medkits,4);assert.deepEqual(n.merchants,s.merchants);}
 const one=order(s,{type:'purchaseMedicalSupplies',id:DOCTOR});assert.equal(one.operativeState[DOCTOR].medkits,5);assert.equal(one.resources.treasury,s.resources.treasury-10);assert.equal(one.merchants.retiro.supplies.medkits,s.merchants.retiro.supplies.medkits-1);
 const poor=structuredClone(s);poor.resources.treasury=5;assert.match(dispatchCampaign(poor,{type:'purchaseMedicalSupplies',id:DOCTOR,quantity:1}).lastError,/pesos/);
 for(const [id,assignment]of [[DOCTOR,'unknown'],[PATIENT,'doctor'],[108,'patient']]){const wire=JSON.parse(encodeSave(s));wire.campaign.operativeState[id].assignment=assignment;assert.throws(()=>decodeSave(JSON.stringify(wire)),/asignaci[oó]n|conocimientos/i);}
 assert.ok(careAssignmentReason(s,op(s,PATIENT),'doctor'));
});

test('a wounded world resident receives strategic care after real recruitment and returns with the recovered health',async()=>{
 const {localPackage,readyLocal,tactical,localNPC,hireLocal,localId}=await import('./local-contract-fixture.mjs');
 const d=localPackage({pay:0,service:'permanent'}),physician=d.characters.find(c=>c.id==='person-110');physician.attributes.medical=80;physician.startingSupplies={priming:50,flints:4,rations:2,torches:2,medkits:10,boleadoras:1};
 d.characters.at(-1).startingCondition={hp:60,energy:100,fatigue:0,bleeding:0,bandaged:0};
 let p=readyLocal(undefined,d);p=tactical(p,{type:'weapon',slot:'medical'});p=tactical(p,{type:'heal',targetId:localNPC(p.battle).id});const wounded=localNPC(p.battle).hp;assert.ok(wounded<localNPC(p.battle).maxHp);
 p=hireLocal(p);const id=localId(p.campaign);let s=order(leave(p),{type:'travel',sector:'retiro'});s=order(s,{type:'assignCare',id:110,assignment:'doctor'});s=order(s,{type:'assignCare',id,assignment:'patient'});const stock=s.operativeState[110].medkits;
 s=saved({campaign:order(s,{type:'wait',hours:2})}).campaign;const recovered=s.operativeState[id].hp;assert.ok(recovered>wounded);assert.ok(s.operativeState[110].medkits<stock);
 const tired=s.operativeState[110].energy,remaining=s.operativeState[110].medkits;s=order(s,{type:'assignCare',id:110,assignment:'rest'});s=advanceCampaignHours(s,1);assert.ok(s.operativeState[110].energy>tired);assert.equal(s.operativeState[110].medkits,remaining);assert.equal(s.operativeState[id].hp,recovered);s=saved({campaign:s}).campaign;
 s=order(s,{type:'dismiss',id});assert.equal(s.operativeState[id].assignment,'active');s=order(s,{type:'assignCare',id:110,assignment:'active'});s=order(s,{type:'travel',sector:'cell-27-27'});p=visit(saved({campaign:s}).campaign);assert.equal(localNPC(p.battle).hp,recovered);assert.ok(saved(p));
});
