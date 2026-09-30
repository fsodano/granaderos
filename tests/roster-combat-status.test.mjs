import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,bladeFor,contextualAttack} from '../game/tactical.js';
import {rosterHands} from '../game/roster-hands.js';
import {BUTTSTOCK} from '../game/unarmed-combat.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

// The same finite matched bayonet and flat contact fixture used by the fitting
// regressions. All changes to mode, fittings and damage use actual orders.
const field=(extra={})=>createBattle([{id:'p',name:'Portador',x:1,y:3,weapon:1800,weaponInstanceId:'roster-gun',condition:66,loaded:1,jammed:true,blade:1811,bladeCondition:73,bladeInstanceId:'roster-socket',bladeFittingPattern:'india_socket',ammo:0,medkits:0,rations:0,priming:0,flints:0,torches:0,boleadoras:0,...extra}],{
 id:'roster-combat',width:12,height:8,seed:127,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false})),
 enemies:[{id:'e',x:2,y:3,weapon:1800,morale:100,overwatch:false,patrol:false},{id:'reserve',x:10,y:7,overwatch:false,patrol:false}],
});
const actor=s=>s.units.find(u=>u.id==='p');
const enemy=s=>s.units.find(u=>u.id==='e');
const order=(s,a)=>{const next=actBattle(s,{unitId:'p',...a});assert.equal(next.lastError,null,next.lastError);return next;};
function status(s,{red,green}){
 const before=structuredClone(s),hands=rosterHands(actor(s));
 assert.equal(hands.length,2);assert.deepEqual(hands.map(h=>h.side),['right','left']);
 assert.equal(hands[0].weapon,1800);assert.equal(hands[0].closeCombat,red);assert.equal(hands[0].attached,green);
 assert.equal(hands[1].blocked,true);assert.equal(hands[1].item,null);assert.equal(hands[1].weapon,null);assert.equal(hands[1].closeCombat,false);assert.equal(hands[1].attached,false);
 assert.deepEqual(s,before,'reading status cannot change combat or ownership');return hands[0];
}

test('actual fire-to-melee-to-fire mode orders update the red marker and preserve the loaded gun until a shot',()=>{
 let s=field({jammed:false}),u=actor(s);const ap=u.ap,time=s.elapsedSeconds,rounds=u.loaded+u.ammo;
 status(s,{red:false,green:false});assert.equal(contextualAttack(s,u,enemy(s)).type,'fire');
 s=order(s,{type:'weaponMode',mode:'melee'});status(s,{red:true,green:false});assert.equal(contextualAttack(s,actor(s),enemy(s)).profile.id,BUTTSTOCK.id);
 s=order(s,{type:'weaponMode',mode:'fire'});status(s,{red:false,green:false});assert.equal(contextualAttack(s,actor(s),enemy(s)).type,'fire');
 assert.equal(actor(s).ap,ap);assert.equal(s.elapsedSeconds,time);assert.equal(actor(s).loaded+actor(s).ammo,rounds);
 s=order(s,{type:'useItem',targetId:'e'});assert.equal(actor(s).loaded,0);assert.equal(actor(s).ammo,0);assert.ok(actor(s).ap<ap);assert.equal(status(s,{red:false,green:false}).loaded,0);
});

test('paid fitting and removal update only the green marker while preserving the exact detached blade',()=>{
 let s=field();const original=structuredClone(actor(s)),ap=original.ap;
 status(s,{red:false,green:false});
 s=order(s,{type:'fitBayonet',item:'blade'});let hand=status(s,{red:false,green:true});assert.equal(hand.attachments.length,1);assert.equal(hand.attachments[0].condition,original.bladeCondition);
 assert.equal(actor(s).weaponFittings.bayonet.instanceId,original.bladeInstanceId);assert.equal(actor(s).blade,undefined);assert.ok(actor(s).ap<ap);
 s=order(s,{type:'weaponMode',mode:'melee'});status(s,{red:true,green:true});
 s=order(s,{type:'removeBayonet',destination:'blade'});status(s,{red:true,green:false});assert.equal(actor(s).bladeInstanceId,original.bladeInstanceId);assert.equal(actor(s).bladeCondition,original.bladeCondition);assert.equal(actor(s).weaponFittings.bayonet,undefined);
 assert.equal(bladeFor(actor(s)).id,BUTTSTOCK.id,'the detached blade stays stowed behind a two-handed gun');
 const hp=enemy(s).hp,beforeStrike=structuredClone(actor(s));s=order(s,{type:'useItem',targetId:'e'});status(s,{red:true,green:false});
 assert.ok(enemy(s).hp<hp);assert.equal(actor(s).bladeCondition,beforeStrike.bladeCondition);assert.equal(actor(s).bladeInstanceId,beforeStrike.bladeInstanceId);assert.equal(actor(s).loaded,1);assert.equal(actor(s).condition,original.condition);assert.equal(actor(s).jammed,true);
 assert.doesNotThrow(()=>validateBattleSnapshot(s));
});

test('markers follow the real thrust and bare-gun strike while both preserve their loaded charge',()=>{
 const bare=order(field(),{type:'weaponMode',mode:'melee'}),fitted=order(order(field(),{type:'fitBayonet',item:'blade'}),{type:'weaponMode',mode:'melee'});
 status(bare,{red:true,green:false});status(fitted,{red:true,green:true});
 const bareAttack=contextualAttack(bare,actor(bare),enemy(bare)),thrust=contextualAttack(fitted,actor(fitted),enemy(fitted));
 assert.equal(bareAttack.profile.id,BUTTSTOCK.id);assert.equal(thrust.profile.id,1811);assert.equal(thrust.profile.fitting,true);assert.ok(thrust.profile.reach>bareAttack.profile.reach);
 const struck=order(bare,{type:'useItem',targetId:'e'}),stabbed=order(fitted,{type:'useItem',targetId:'e'});
 assert.ok(enemy(stabbed).hp<enemy(struck).hp);assert.ok(enemy(struck).hp<enemy(bare).hp);
 for(const [before,after]of [[bare,struck],[fitted,stabbed]]){assert.equal(actor(after).loaded,actor(before).loaded);assert.equal(actor(after).ammo,actor(before).ammo);assert.equal(actor(after).jammed,actor(before).jammed);assert.equal(actor(after).condition,actor(before).condition);assert.ok(actor(after).ap<actor(before).ap);assert.equal(after.smoke.length,before.smoke.length);}
 assert.equal(actor(stabbed).weaponFittings.bayonet.condition,actor(fitted).weaponFittings.bayonet.condition-1);assert.equal(actor(struck).bladeCondition,actor(bare).bladeCondition);
 status(struck,{red:true,green:false});status(stabbed,{red:true,green:true});
});

test('a bayonet broken by a real thrust stays green but the next attack is a buttstock strike',()=>{
 let s=order(order(field({bladeCondition:1}),{type:'fitBayonet',item:'blade'}),{type:'weaponMode',mode:'melee'});
 assert.equal(status(s,{red:true,green:true}).attachments[0].condition,1);assert.equal(bladeFor(actor(s)).id,1811);
 s=order(s,{type:'useItem',targetId:'e'});const hand=status(s,{red:true,green:true});assert.equal(hand.attachments[0].condition,0);assert.equal(actor(s).weaponFittings.bayonet.instanceId,'roster-socket');assert.equal(bladeFor(actor(s)).id,BUTTSTOCK.id);
 const hp=enemy(s).hp;s=order(s,{type:'useItem',targetId:'e'});assert.ok(enemy(s).hp<hp);assert.equal(actor(s).weaponFittings.bayonet.condition,0);assert.equal(actor(s).loaded,1);status(s,{red:true,green:true});
 s=order(s,{type:'removeBayonet',destination:'inventory'});status(s,{red:true,green:false});const removed=Object.values(actor(s).inventory).find(item=>item.instanceId==='roster-socket');assert.ok(removed);assert.equal(removed.condition,0);assert.equal(removed.count,1);
 assert.doesNotThrow(()=>validateBattleSnapshot(s));
});
