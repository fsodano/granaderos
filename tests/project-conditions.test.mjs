import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultCampaignStory} from '../game/campaign-story.js';
import {dialogueForNPC} from '../game/content-dialogue.js';
import {dialogueConditionsMet,validateDialogueConditions} from '../game/dialogue-conditions.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {getReachable} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {foundryPackage} from './foundry-project-fixture.mjs';
import {questPackage} from './content-quest-fixture.mjs';
import {order,saved,readyLocal,localNPC,talk,leave,visit,tactical} from './local-contract-fixture.mjs';
const project=(id,completed=true)=>({type:'project',project:id,completed});
const chapter=(id,conditions)=>({id,name:id,objective:`Completá ${id}.`,conditions});
const choose=(p,node,id)=>({...p,campaign:order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:node,dialogueChoice:id})});

test('real preparation and funding complete ordered authored chapters once and survive the engineer contract expiry',()=>{
 const d=foundryPackage();d.campaignStory.chapters=[chapter('taller',[project('foundry')]),chapter('tropa',[project('army')])];const id=operativeIdForCharacter(d,'engineer');let s=order(initialCampaign(42,d),{type:'recruitCivic',id,term:'day'});assert.equal(s.campaignProgress.completed.length,0);s=order(s,{type:'wait',hours:6});assert.equal(s.campaignProgress.completed.length,0);s=order(s,{type:'foundry'});assert.deepEqual(s.campaignProgress.completed.map(c=>c.chapter),['taller']);const receipt=structuredClone(s.campaignProgress.completed[0]);s=order(s,{type:'wait',hours:24});assert.equal(s.recruited.includes(id),false);assert.equal(dialogueConditionsMet(s,[project('foundry')]),true);assert.equal(s.completed,false);s=order(saved({campaign:s}).campaign,{type:'fundArmy'});assert.equal(s.completed,true);assert.deepEqual(s.campaignProgress.completed.map(c=>c.chapter),['taller','tropa']);assert.deepEqual(s.campaignProgress.completed[0],receipt);const ending=structuredClone(s.campaignProgress.outcome);s=order(saved({campaign:s}).campaign,{type:'wait',hours:1});assert.deepEqual(s.campaignProgress.outcome,ending);
 const forged=JSON.parse(encodeSave(s));forged.campaign.contentCampaign.package.campaignStory.chapters[0].conditions[0].completed=false;assert.throws(()=>decodeSave(JSON.stringify(forged)),/identidad/);
});

test('a project-gated dialogue hides premature rewards and settles a real saved quest after actual funding',()=>{
 const d=questPackage();d.rules.startingTreasury=10000;d.campaignRoles={foundryEngineer:'person-110',marchCommander:null};d.foundry={...foundryPackage().foundry,sector:'retiro'};d.campaignStory={...defaultCampaignStory(),chapters:[chapter('taller',[project('foundry')]),chapter('parte',[{type:'quest',quest:'river-post',status:'completed'}])]};const dialogue=d.characters.at(-1).encounter.dialogue;dialogue.nodes[0].choices[0].conditions=[project('foundry',false)];dialogue.nodes[1].choices[0].conditions.push(project('army'));
 let p=choose(readyLocal(undefined,d),'start','accept');assert.ok(!dialogueForNPC(p.campaign,localNPC(p.battle),p.battle).choices.some(c=>c.id==='complete'));const premature=dispatchCampaign(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'active',dialogueChoice:'complete'});assert.ok(premature.lastError);assert.equal(premature.resources.treasury,p.campaign.resources.treasury);
 let s=order(leave(p),{type:'foundry'});assert.equal(s.campaignProgress.completed.length,1);s=order(s,{type:'fundArmy'});assert.equal(s.completed,false);p=visit(saved({campaign:s}).campaign);const npc=localNPC(p.battle),unit=p.battle.units.find(u=>u.side==='player'),spot=getReachable(p.battle,unit.id).find(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1);assert.ok(spot);if(spot.cost)p=tactical(p,{type:'move',x:spot.x,y:spot.y});assert.ok(dialogueForNPC(p.campaign,localNPC(p.battle),p.battle).choices.some(c=>c.id==='complete'));const before=p.campaign.resources.treasury;p=choose(p,'active','complete');assert.equal(p.campaign.resources.treasury,before+175);assert.equal(p.campaign.completed,false);s=saved({campaign:leave(saved(p))}).campaign;assert.equal(s.completed,true);assert.equal(s.campaignProgress.completed.length,2);
});

test('project conditions validate exact fields and booleans and failure takes precedence over the same completed project',()=>{
 assert.equal(dialogueConditionsMet(initialCampaign(),[project('missing',false)]),false);
 for(const c of [{type:'project',project:'missing',completed:true},{type:'project',project:'foundry',completed:'true'},{type:'project',project:'army'},{type:'project',project:'army',completed:true,reward:1}]){assert.throws(()=>validateDialogueConditions([c],new Set(),new Set()),/proyecto/);const d=foundryPackage();d.campaignStory.chapters[0].conditions=[c];assert.throws(()=>initialCampaign(42,d),/proyecto/);}
 const d=foundryPackage();d.campaignStory.chapters=[chapter('taller',[project('foundry')])];d.campaignStory.failureConditions=[project('foundry')];const id=operativeIdForCharacter(d,'engineer');let s=order(initialCampaign(42,d),{type:'recruitCivic',id,term:'week'});assert.equal(dialogueConditionsMet(s,[project('foundry',false),project('army',false)]),true);s=order(s,{type:'wait',hours:6});s=order(s,{type:'foundry'});assert.equal(s.flags.foundry,true);assert.equal(s.defeated,true);assert.equal(s.completed,false);assert.deepEqual(s.campaignProgress.completed,[]);assert.equal(saved({campaign:s}).campaign.campaignProgress.outcome.type,'defeat');
});
