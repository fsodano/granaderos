import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {actBattle,presentedActBattle,carriedWeight} from '../game/tactical.js';
import {fieldDressingsSource} from '../game/field-dressings.js';
import {ammoCount} from '../game/ammo-types.js';
import {order,saved,visit,sync,leave} from './local-contract-fixture.mjs';
import {takeFiniteCache} from './finite-cache-driver.mjs';

const ID=112,SHIRT='cache:retiro:linen-shirt';
const actor=p=>p.battle.units.find(unit=>unit.id===String(ID));
const keyFor=(unit,id)=>Object.entries(unit.inventory).find(([,record])=>record.instanceId===id)?.[0];
const chest=b=>b.props.find(prop=>prop.id==='retiro:armory-cache');
const stamp=s=>s.hour*3600+(s.secondOfHour??0);
function issue(p,action,history){
 const before=structuredClone(p),battle=actBattle(p.battle,action);assert.equal(battle.lastError,null,battle.lastError);
 assert.deepEqual(presentedActBattle(p.battle,action).state,battle);assert.deepEqual(p,before);
 history?.push(structuredClone(action));return saved(sync({campaign:p.campaign,battle}));
}

test('a paid native hire acquires one real cache shirt, pays to stow and craft it, and retains finite custody through full saved replay and reentry',t=>{
 let campaign=initialCampaign(45);const initialCash=campaign.resources.treasury,quote=contractQuote(campaign,rosterFor(campaign).find(op=>op.id===ID),'week');
 assert.ok(quote.available&&quote.price>0);campaign=order(campaign,{type:'recruitCivic',id:ID,term:'week'});campaign=order(campaign,{type:'wait',hours:6});
 assert.ok(campaign.recruited.includes(ID));assert.equal(campaign.contracts[ID].paid,quote.price);assert.equal(campaign.resources.treasury,initialCash-quote.price);
 let p=takeFiniteCache(visit(campaign),ID,[{kind:'outfit',outfit:'linen_shirt',count:1}]);const start=saved(p),cash=p.campaign.resources.treasury,initial=structuredClone(actor(p)),history=[];
 assert.equal(chest(p.battle).contents.some(item=>item.instanceId===SHIRT),false);const linenKey=keyFor(initial,SHIRT);assert.ok(linenKey);
 assert.equal(initial.inventory[linenKey].condition,100);assert.equal(initial.loaded+ammoCount(initial),10);assert.equal(initial.outfit.outfit,'poncho');
 p=issue(p,{type:'equipLoot',unitId:String(ID),inventoryKey:linenKey,slot:'outfit'},history);assert.equal(actor(p).outfit.instanceId,SHIRT);
 const refusal=actBattle(p.battle,{type:'craftDressings',unitId:String(ID),inventoryKey:'outfit'});assert.ok(refusal.lastError);assert.deepEqual(refusal.units,p.battle.units);assert.equal(refusal.elapsedSeconds,p.battle.elapsedSeconds);
 p=issue(p,{type:'equipLoot',unitId:String(ID),inventoryKey:null,slot:'outfit'},history);assert.equal(actor(p).outfit,null);
 const personal=Object.entries(actor(p).inventory).find(([,record])=>record.kind==='outfit'&&record.outfit==='poncho');assert.ok(personal);
 p=issue(p,{type:'equipLoot',unitId:String(ID),inventoryKey:personal[0],slot:'outfit'},history);assert.deepEqual(actor(p).outfit,initial.outfit);
 const key=keyFor(actor(p),SHIRT),before=structuredClone(p),weight=carriedWeight(actor(p)),action={type:'craftDressings',unitId:String(ID),inventoryKey:key,expectedSource:fieldDressingsSource(actor(p),key)};
 p=issue(p,action,history);assert.equal(actor(p).medkits,actor(before).medkits+3);assert.equal(keyFor(actor(p),SHIRT),undefined);assert.equal(carriedWeight(actor(p)),weight);
 assert.equal(p.battle.elapsedSeconds-before.battle.elapsedSeconds,2);assert.equal(stamp(p.campaign)-stamp(before.campaign),2);assert.equal(actor(p).ap,actor(before).ap);
 for(const key of ['hp','bleeding','bandaged','energy','loaded','condition'])assert.deepEqual(actor(p)[key],actor(before)[key],key);assert.equal(ammoCount(actor(p)),ammoCount(actor(before)));
 assert.equal(p.campaign.resources.treasury,cash);assert.deepEqual(p.campaign.contracts,before.campaign.contracts);
 const repeated=actBattle(p.battle,action);assert.ok(repeated.lastError);assert.deepEqual(repeated.units,p.battle.units);assert.equal(repeated.elapsedSeconds,p.battle.elapsedSeconds);assert.equal(repeated.seed,p.battle.seed);
 let replay=saved(start);for(const action of history)replay=issue(replay,action);assert.deepEqual(replay,p);
 const final=structuredClone(actor(p)),spent=p.battle.elapsedSeconds-start.battle.elapsedSeconds;campaign=saved({campaign:leave(p)}).campaign;
 assert.equal(campaign.operativeState[ID].medkits,final.medkits);assert.deepEqual(campaign.operativeState[ID].outfit,final.outfit);assert.equal(campaign.resources.treasury,cash);
 const returned=visit(campaign),u=actor(returned);assert.equal(u.medkits,initial.medkits+3);assert.equal(u.loaded+ammoCount(u),10);assert.equal(u.condition,initial.condition);assert.deepEqual(u.inventory,final.inventory);assert.deepEqual(u.outfit,initial.outfit);
 assert.equal(chest(returned.battle).contents.some(item=>item.instanceId===SHIRT),false);assert.equal(keyFor(u,SHIRT),undefined);assert.equal(returned.campaign.resources.treasury,cash);
 t.diagnostic(JSON.stringify({fixture:'fresh native paid service; real Retiro chest; no assigned wounds or equipment',operative:ID,price:quote.price,treasury:cash,orders:history.length,seconds:spent,craftSeconds:2,dressings:[initial.medkits,u.medkits],ownedRounds:u.loaded+ammoCount(u),shirtRemaining:0}));
});
