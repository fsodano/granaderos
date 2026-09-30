import {refreshMilitaryCondition} from '../game/actor-condition.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {dialogueForNPC} from '../game/content-dialogue.js';
import {dialogueConditionsMet} from '../game/dialogue-conditions.js';
import {equipmentCatalog} from '../game/equipment.js';
import {approachNPC} from './approach-npc.mjs';
import {dialoguePackage} from './dialogue-fixture.mjs';
import {secureArea} from './controlled-area-fixture.mjs';
import {A,order,saved,localNPC,localId,readyLocal,talk,leave,visit,tactical,hireLocal,sync} from './local-contract-fixture.mjs';
const content=conditions=>{const d=dialoguePackage();d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions=conditions;return d;};
const ready=conditions=>readyLocal(undefined,content(conditions));
const visible=p=>dialogueForNPC(p.campaign,localNPC(p.battle),p.battle).choices.some(c=>c.id==='north');
const select=p=>dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'north'});
const approach=(p,npc)=>sync({campaign:p.campaign,battle:approachNPC(p.battle,p.battle.units.find(u=>u.side==='player').id,npc.id)});

test('day intervals hide a choice until the actual campaign day and close it after the final day',()=>{
 let p=ready([{type:'day',min:2,max:2}]);assert.equal(visible(p),false);assert.match(select(p).lastError,/no está disponible/);
 let s=order(leave(p),{type:'wait',hours:24-p.campaign.hour});p=visit(saved({campaign:s}).campaign);p=approach(p,localNPC(p.battle));assert.equal(visible(p),true);assert.equal(select(p).lastError,null);
 s=order(leave(p),{type:'wait',hours:24});p=visit(s);assert.equal(visible(p),false);assert.ok(saved(p));
});

test('treasury conditions use real paid purchases and are checked again when a hidden choice is requested',()=>{
 const cash=ready([]).campaign.resources.treasury;let p=ready([{type:'treasury',min:cash,max:cash}]);assert.equal(visible(p),true);
 let s=order(leave(p),{type:'travel',sector:'retiro'});const item=equipmentCatalog(s).find(w=>w.category==='blade'&&w.price>0);assert.ok(item);const beforePurchase=s.resources.treasury;s=order(s,{type:'purchaseEquipment',item:item.item,quantity:1});assert.equal(s.resources.treasury,beforePurchase-item.price);s=order(s,{type:'travel',sector:A});p=visit(saved({campaign:s}).campaign);p=approach(p,localNPC(p.battle));assert.equal(visible(p),false);
 const before=structuredClone(p.campaign.conversations);assert.match(select(p).lastError,/no está disponible/);assert.deepEqual(p.campaign.conversations,before);
});

test('all conditions must hold and ownership follows prepared, save-admitted locality control',()=>{
 const clauses=[{type:'day',min:1,max:null},{type:'treasury',min:0,max:null},{type:'sector',sector:'buenos_aires',owner:'patriot'},{type:'character',character:'person-110',state:'serving'}];
 let p=ready(clauses);assert.equal(visible(p),false);secureArea(p.campaign,'buenos_aires');p=saved(p);assert.equal(visible(p),true);
 p.campaign.sectors.retiro.owner='royalist';assert.equal(dialogueConditionsMet(p.campaign,[{type:'sector',sector:'retiro',owner:'patriot'}]),false);
});

test('confirmed civilian death opens a character-gated branch immediately without changing its owner identity',()=>{
 const d=content([{type:'character',character:'pablo-gate',state:'dead'}]),base=structuredClone(d.characters.at(-1));delete base.encounter.dialogue;d.characters.push({...base,id:'pablo-gate',name:'Pablo',attributes:{...base.attributes,maxHp:30}});d.placements.push({...structuredClone(d.placements.at(-1)),id:'pablo-place',character:'pablo-gate'});
 let p=readyLocal(undefined,d);assert.equal(visible(p),false);let npc=p.battle.npcs.find(n=>n.contentId==='pablo-gate');p=approach(p,npc);p=tactical(p,{type:'weapon',slot:'blade'});for(let i=0;i<3&&p.battle.npcs.find(n=>n.id===npc.id).hp>0;i++)p=tactical(p,{type:'melee',targetId:npc.id});assert.equal(p.battle.npcs.find(n=>n.id===npc.id).hp,0);p=approach(p,localNPC(p.battle));p=saved(p);assert.equal(visible(p),true);assert.equal(select(p).lastConversation.dialogueNode,'north');
});

test('character conditions distinguish presence, service and accepted deployed health',()=>{
 let p=ready([]),npc=localNPC(p.battle),id=localId(p.campaign),c=state=>[{type:'character',character:'alma-contract',state}];
 assert.equal(dialogueConditionsMet(p.campaign,c('present'),p.battle),true);assert.equal(dialogueConditionsMet(p.campaign,c('serving'),p.battle),false);
 p=hireLocal(p);assert.equal(dialogueConditionsMet(p.campaign,c('present'),p.battle),false);assert.equal(dialogueConditionsMet(p.campaign,c('serving'),p.battle),true);
 // A prepared active casualty precedes settlement of its service record.
 const casualty=p.battle.units.find(u=>u.id===String(id));casualty.hp=0;refreshMilitaryCondition(casualty);p=saved(p);assert.equal(p.campaign.operativeState[id].alive,true);assert.equal(dialogueConditionsMet(p.campaign,c('dead'),p.battle),true);assert.equal(dialogueConditionsMet(p.campaign,c('alive'),p.battle),false);assert.equal(dialogueConditionsMet(p.campaign,c('serving'),p.battle),false);
 assert.equal(dialogueForNPC(p.campaign,npc,p.battle).node,'start');
});

test('condition definitions reject unknown fields, invalid references, reversed bounds and excessive lists',()=>{
 for(const conditions of [[{type:'day',min:0,max:null}],[{type:'treasury',min:20,max:10}],[{type:'sector',sector:A,owner:'patriot'}],[{type:'character',character:'missing',state:'alive'}],[{type:'character',character:'person-110',state:'unknown'}],[{type:'day',min:1,max:null,reward:10}],Array.from({length:7},()=>({type:'day',min:1,max:null})),[{type:'unknown'}]])assert.throws(()=>initialCampaign(42,content(conditions)));
});
