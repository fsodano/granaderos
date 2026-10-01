import test from 'node:test';
import assert from 'node:assert/strict';
import {approachNPC} from './approach-npc.mjs';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {dialogueForNPC} from '../game/content-dialogue.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {dialoguePackage} from './dialogue-fixture.mjs';
import {order,saved,localNPC,readyLocal,talk,leave,visit,hireLocal,localId,tactical,sync} from './local-contract-fixture.mjs';
const definition=(amount=175)=>{const d=dialoguePackage();d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].effects=[{type:'treasury',operation:amount<0?'pay':'receive',amount:Math.abs(amount)}];return d;};
const choose=(p,node='start',id='north')=>({...p,campaign:order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:node,dialogueChoice:id})});
const again=p=>choose(choose(p,'north','back'));
const receipts=p=>p.campaign.conversations[localNPC(p.battle).id].dialogueReceipts;

test('a dialogue reward is paid once through a loop, save, departure and local service changes',()=>{
 let p=readyLocal(undefined,definition()),cash=p.campaign.resources.treasury;p=saved(choose(p));assert.equal(p.campaign.resources.treasury,cash+175);assert.equal(p.campaign.lastConversation.dialogueEffect.applied,true);assert.equal(receipts(p).length,1);
 p=saved(again(p));assert.equal(p.campaign.resources.treasury,cash+175);assert.equal(p.campaign.lastConversation.dialogueEffect.applied,false);assert.equal(receipts(p).length,1);
 p=hireLocal(p);let s=leave(p);s=order(s,{type:'dismiss',id:localId(s)});p=visit(saved({campaign:s}).campaign);
 const npc=localNPC(p.battle),unit=p.battle.units.find(u=>u.side==='player');p=sync({campaign:p.campaign,battle:approachNPC(p.battle,unit.id,npc.id)});
 cash=p.campaign.resources.treasury;p=saved(again(p));assert.equal(p.campaign.resources.treasury,cash);assert.equal(receipts(p).length,1);
});

test('a paid choice charges once and an unaffordable choice rejects atomically',()=>{
 let p=readyLocal(undefined,definition(-175)),cash=p.campaign.resources.treasury;p=saved(choose(p));assert.equal(p.campaign.resources.treasury,cash-175);p=saved(again(p));assert.equal(p.campaign.resources.treasury,cash-175);
 const expensive=readyLocal(undefined,definition(-1000000)),q=dialogueForNPC(expensive.campaign,localNPC(expensive.battle)).choices[0];assert.equal(q.available,false);assert.match(q.reason,/Faltan/);assert.match(q.effectLabel,/Pagar 1000000/);
 const result=dispatchCampaign(expensive.campaign,{...talk(expensive,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'north'});assert.match(result.lastError,/Faltan/);assert.deepEqual({...result,lastError:null},expensive.campaign);
});

test('conditions and stale inputs cannot apply a payment, while a self-loop remains once-only',()=>{
 const d=definition();d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions=[{type:'day',min:2,max:null}];let p=readyLocal(undefined,d);
 let rejected=dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'north'});assert.match(rejected.lastError,/disponible/);assert.deepEqual({...rejected,lastError:null},p.campaign);
 p=choose(readyLocal(undefined,definition()));rejected=dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'north'});assert.match(rejected.lastError,/cambió/);assert.deepEqual({...rejected,lastError:null},p.campaign);
 const loop=definition();loop.characters.at(-1).encounter.dialogue.nodes[0].choices[0].next='start';p=readyLocal(undefined,loop);const cash=p.campaign.resources.treasury;p=saved(choose(choose(p)));assert.equal(p.campaign.resources.treasury,cash+175);assert.equal(receipts(p).length,1);
});

test('separate character identities retain separate reward receipts',()=>{
 const d=definition(),original=d.characters.at(-1),copy={...structuredClone(original),id:'alma-copy',name:'Otra Alma'};d.characters.push(copy);d.placements.push({...structuredClone(d.placements.at(-1)),id:'copy-place',character:copy.id});
 let p=readyLocal(undefined,d),cash=p.campaign.resources.treasury;p=choose(p);assert.equal(p.campaign.resources.treasury,cash+175);
 const npc=p.battle.npcs.find(n=>n.contentId===copy.id),unit=p.battle.units.find(u=>u.side==='player');p=sync({campaign:p.campaign,battle:approachNPC(p.battle,unit.id,npc.id)});
 cash=p.campaign.resources.treasury;p.campaign=order(p.campaign,{...talk(p,undefined,'dialogue'),npcId:npc.id,dialogueNode:'start',dialogueChoice:'north'});p=saved(p);assert.equal(p.campaign.resources.treasury,cash+175);assert.equal(Object.values(p.campaign.conversations).filter(c=>c.dialogueReceipts?.length===1).length,2);
});

test('invalid effects and inconsistent saved receipts are rejected',()=>{
 for(const effect of [{type:'treasury',amount:5},{type:'treasury',operation:'receive',amount:0},{type:'treasury',operation:'pay',amount:-5},{type:'treasury',operation:'receive',amount:1.5},{type:'treasury',operation:'receive',amount:1000001},{type:'treasury',operation:'give',amount:5},{type:'treasury',operation:'receive',amount:5,unknown:true},{type:'weapon',operation:'receive',amount:5}]){const d=definition();d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].effects=[effect];assert.throws(()=>initialCampaign(42,d));}
 const d=definition();d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].effects.push({type:'treasury',operation:'pay',amount:5});assert.throws(()=>initialCampaign(42,d));
 const p=choose(readyLocal(undefined,definition())),wire=encodeSave(p.campaign,p.battle),id=localNPC(p.battle).id;
 for(const mutate of [s=>s.conversations[id].dialogueReceipts.push(structuredClone(s.conversations[id].dialogueReceipts[0])),s=>s.conversations[id].dialogueReceipts[0].amount++,s=>s.conversations[id].dialogueReceipts[0].choice='river',s=>s.conversations[id].dialogueReceipts[0].hour=s.hour+1,s=>s.conversations[id].dialogueReceipts[0].extra=true,s=>s.conversations[id].dialogueReceipts=[],s=>s.lastConversation.dialogueEffect.amount++,s=>s.lastConversation.dialogueEffect.applied='yes']){const v=JSON.parse(wire);mutate(v.campaign);assert.throws(()=>decodeSave(JSON.stringify(v)),/operaci|registro/);}
 const legacy=readyLocal(undefined,dialoguePackage());assert.ok(saved(legacy));
});

test('prepared treasury ceiling cannot be exceeded by a reward or leave a partial receipt',()=>{
 const p=readyLocal(undefined,definition());p.campaign.resources.treasury=999999999;const admitted=saved(p),q=dialogueForNPC(admitted.campaign,localNPC(admitted.battle)).choices[0];assert.equal(q.available,false);
 const result=dispatchCampaign(admitted.campaign,{...talk(admitted,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'north'});assert.match(result.lastError,/tesorería/);assert.deepEqual({...result,lastError:null},admitted.campaign);
});
