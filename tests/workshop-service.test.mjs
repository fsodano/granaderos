import test from 'node:test';import assert from 'node:assert/strict';
import {dispatchCampaign,operativeLocation,rosterFor} from '../game/campaign.js';
import {repairRate} from '../game/assignments.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {order,saved,visit} from './local-contract-fixture.mjs';
import {withCarriedRepairKit,assertTradeRejected} from './commerce-gear-fixture.mjs';
import {separatedWorkshop,returnToWorkshop,REMOTE,LOCAL} from './workshop-service-fixture.mjs';

const repair=(s,targetId=REMOTE)=>order(s,{type:'assignWork',operativeId:LOCAL,assignment:'repair',targetId});
const reject=(s,a)=>{const before=structuredClone(s),next=dispatchCampaign(s,a);assert.ok(next.lastError);assert.deepEqual({...next,lastError:s.lastError},before);assert.deepEqual(s,before);return next;};

test('retired workshop orders reject locally and remotely, while carried repair requires the actual owner in the same sector',()=>{
 const s=withCarriedRepairKit(separatedWorkshop(),LOCAL);assert.equal(s.location,'retiro');assert.equal(operativeLocation(s,REMOTE),'buenos_aires');
 for(const id of [REMOTE,LOCAL])for(const type of ['resupply','repairWeapon'])assertTradeRejected(s,{type,operativeId:id});
 const denied=reject(s,{type:'assignWork',operativeId:LOCAL,assignment:'repair',targetId:REMOTE});assert.match(denied.lastError,/presente en este sector/);assert.equal(s.operativeState[REMOTE].condition,40);assert.equal(repairMaterialPoints(s.operativeState[LOCAL]),100);assert.ok(saved({campaign:s}));
});

test('a real return permits repair over real hours with finite carried material and preserves the result on deployment',()=>{
 let s=returnToWorkshop(withCarriedRepairKit(separatedWorkshop(),LOCAL));const before=s.resources.treasury,ammo=s.operativeState[REMOTE].carriedAmmo,rate=repairRate(rosterFor(s).find(o=>o.id===LOCAL));
 for(const type of ['resupply','repairWeapon'])assertTradeRejected(s,{type,operativeId:REMOTE});
 s=repair(s);const started=s.hour;s=order(s,{type:'wait',hours:1});assert.equal(s.operativeState[REMOTE].condition,40+rate);assert.equal(repairMaterialPoints(s.operativeState[LOCAL]),100-rate);assert.equal(s.resources.treasury,before);assert.equal(s.operativeState[REMOTE].carriedAmmo,ammo);
 for(let n=0;s.operativeState[REMOTE].condition<100&&n<60;n++)s=order(s,{type:'wait',hours:1});
 assert.equal(s.operativeState[REMOTE].condition,100);assert.equal(repairMaterialPoints(s.operativeState[LOCAL]),40);assert.ok(s.hour>started);assert.equal(s.resources.treasury,before);assert.equal(s.operativeState[REMOTE].priming,undefined);reject(s,{type:'assignWork',operativeId:LOCAL,assignment:'repair',targetId:REMOTE});
 s=order(s,{type:'assignCare',operativeId:LOCAL,assignment:'active'});const p=visit(saved({campaign:s}).campaign),u=p.battle.units.find(u=>u.id===String(REMOTE));assert.equal(u.condition,100);assert.equal(u.priming,undefined);assert.equal(u.medkits,0);assert.equal(u.ammo+u.loaded,ammo);assert.ok(saved(p));
});

test('finite repair work rejects absent, unsafe and exhausted-material owners without requiring cash or a shop',()=>{
 const s=withCarriedRepairKit(separatedWorkshop(),LOCAL),action={type:'assignWork',operativeId:LOCAL,assignment:'repair',targetId:LOCAL};
 const poor=structuredClone(s);poor.resources.treasury=0;assert.equal(repair(poor,LOCAL).resources.treasury,0);
 for(const change of [n=>{n.recruited=n.recruited.filter(id=>id!==LOCAL);},n=>{n.sectors.retiro.owner='royalist';},n=>{delete n.operativeState[LOCAL].inventory['fixture:repair-kit'];},n=>{n.operativeState[LOCAL].asleep=true;}]){const before=structuredClone(s);change(before);reject(before,action);}
});
