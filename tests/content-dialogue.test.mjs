import test from 'node:test';
import {getReachable} from '../game/tactical.js';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {dialogueForNPC} from '../game/content-dialogue.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {dialoguePackage} from './dialogue-fixture.mjs';
import {order,saved,localNPC,readyLocal,talk,leave,visit,hireLocal,localId,tactical} from './local-contract-fixture.mjs';
const begin=p=>({...p,campaign:order(p.campaign,talk(p,undefined,'dialogue'))});
const choose=(p,node,id)=>({...p,campaign:order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:node,dialogueChoice:id})});

test('authored choices follow both branches, permit an explicit loop and preserve the actual saved conversation',()=>{
 let p=readyLocal(undefined,dialoguePackage());assert.equal(localNPC(p.battle).dialogue,undefined);p=begin(p);assert.match(p.campaign.lastConversation.text,/dos salidas/);
 p=saved(choose(p,'start','north'));assert.equal(p.campaign.lastConversation.dialogueNode,'north');assert.equal(p.campaign.lastConversation.text,'La posta está al norte.');assert.deepEqual(dialogueForNPC(p.campaign,localNPC(p.battle)).choices,[{id:'back',label:'Volvamos a las opciones.'}]);
 p=choose(p,'north','back');assert.equal(p.campaign.lastConversation.dialogueNode,'start');p=saved(choose(p,'start','river'));assert.equal(p.campaign.lastConversation.text,'Seguí la ribera al amanecer.');assert.deepEqual(dialogueForNPC(p.campaign,localNPC(p.battle)).choices,[]);
 assert.equal(p.campaign.resources.treasury,readyLocal(undefined,dialoguePackage()).campaign.resources.treasury);
});

test('dialogue progress survives other approaches, leaving, recruitment, dismissal and return',()=>{
 let p=choose(begin(readyLocal(undefined,dialoguePackage())),'start','north');p.campaign=order(p.campaign,talk(p,undefined,'friendly'));assert.equal(p.campaign.conversations[localNPC(p.battle).id].dialogueNode,'north');
 p=visit(saved({campaign:leave(p)}).campaign);assert.equal(dialogueForNPC(p.campaign,localNPC(p.battle)).node,'north');
 // Resume beside the resident using the actual tactical approach helper.
 const npc=localNPC(p.battle),unit=p.battle.units.find(u=>u.side==='player'),tile=getReachable(p.battle,unit.id).find(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1);assert.ok(tile);if(tile.cost)p=tactical(p,{type:'move',x:tile.x,y:tile.y});
 p=begin(p);assert.equal(p.campaign.lastConversation.dialogueNode,'north');p=hireLocal(p);const id=localId(p.campaign);let s=leave(p);s=order(s,{type:'dismiss',id});p=visit(saved({campaign:s}).campaign);assert.equal(dialogueForNPC(p.campaign,localNPC(p.battle)).node,'north');assert.ok(saved(p));
});

test('invalid or stale choices cannot change the conversation and still require a present interlocutor',()=>{
 const p=choose(begin(readyLocal(undefined,dialoguePackage())),'start','north');
 for(const change of [{dialogueNode:'start',dialogueChoice:'river'},{dialogueNode:'north',dialogueChoice:'unknown'},{dialogueChoice:'back'},{unitId:'missing',dialogueNode:'north',dialogueChoice:'back'}]){
  const n=dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),...change});assert.ok(n.lastError);assert.deepEqual(n.conversations,p.campaign.conversations);assert.deepEqual(n.resources,p.campaign.resources);assert.equal(n.hour,p.campaign.hour);
 }
});

test('dialogue admission rejects duplicate, dangling and unsupported graph data',()=>{
 for(const mutate of [g=>g.entry='missing',g=>g.nodes.push(structuredClone(g.nodes[0])),g=>g.nodes[0].choices[0].next='missing',g=>g.nodes[0].choices.push(structuredClone(g.nodes[0].choices[0])),g=>g.nodes[0].choices[0].reward=100,g=>g.nodes[0].text='',g=>g.nodes[0].choices[0].label='x'.repeat(161),g=>g.nodes[0].id='constructor']){
  const d=dialoguePackage();mutate(d.characters.at(-1).encounter.dialogue);assert.throws(()=>initialCampaign(42,d));
 }
});

test('saved dialogue rejects missing or foreign cursors and text that differs from the pinned graph',()=>{
 const p=choose(begin(readyLocal(undefined,dialoguePackage())),'start','north'),wire=encodeSave(p.campaign,p.battle),id=localNPC(p.battle).id;
 for(const mutate of [s=>s.conversations[id].dialogueNode='missing',s=>delete s.conversations[id].dialogueNode,s=>s.lastConversation.text='Un texto distinto',s=>s.lastConversation.dialogueNode='river']){const copy=JSON.parse(wire);mutate(copy.campaign);assert.throws(()=>decodeSave(JSON.stringify(copy)),/diálogo|pasaje|texto/i);}
});
