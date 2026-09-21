import {applyCivilianHarm} from '../game/civilian-harm.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {deliverPonchos} from './npc-gift-helpers.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign,serializeCampaign,questForNPC} from '../game/campaign.js';
import {enterSector} from '../game/world.js';import {actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
function meeting(){let s=order(initialCampaign(),{type:'createOfficer',name:'Juana del Sur',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});for(let i=0;i<2;i++)s=order(s,{type:'sectorInventory',sector:'retiro',operativeId:1000,direction:'issueOutfit'});s=order(s,{type:'visitSector'});let b=enterSector(s.pendingBattle);const npc=b.npcs.find(n=>n.id==='local-retiro');const neighbors=b.tiles.filter(t=>!t.blocked&&Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1);let next;for(const p of neighbors){next=actBattle(b,{type:'move',unitId:'1000',x:p.x,y:p.y});if(!next.lastError){b=next;break;}}assert.equal(b.lastError,null);return{s,b};}
const talk=(s,b)=>order(s,{type:'talkNPC',npcId:'local-retiro',approach:'quest',unitId:1000,sectorState:b});
test('physical NPC errand offers then pays exactly once and raises regional loyalty',()=>{
 let{s,b}=meeting();const textiles=s.resources.textiles,loyalty=s.sectors.buenos_aires.loyalty,retiroLoyalty=s.sectors.retiro.loyalty;s=talk(s,b);assert.equal(s.resources.textiles,textiles);assert.equal(s.quests['retiro-uniformes'].status,'offered');assert.ok(!s.lastConversation.options.includes('quest'));b=deliverPonchos(b);const synced=syncBattleTime(s,b);assert.equal(synced.error,null);s=synced.campaign;b=synced.battle;assert.equal(s.resources.textiles,textiles);assert.equal(s.sectors.buenos_aires.loyalty,loyalty+8);assert.equal(s.sectors.retiro.loyalty,retiroLoyalty+8);assert.equal(s.quests['retiro-uniformes'].status,'completed');assert.ok(!s.lastConversation.options.includes('quest'));const again=dispatchCampaign(s,{type:'talkNPC',npcId:'local-retiro',approach:'quest',unitId:1000,sectorState:b});assert.ok(again.lastError);assert.equal(again.resources.textiles,s.resources.textiles);assert.equal(again.cityLoyaltyEvents.length,s.cityLoyaltyEvents.length);assert.equal(restoreCampaign(serializeCampaign(s)).quests['retiro-uniformes'].status,'completed');
});
test('quest requests require adjacency and insufficient deliveries preserve the offered stage',()=>{
 let{s,b}=meeting();const far=structuredClone(b);far.units[0].x=0;far.units[0].y=0;assert.ok(dispatchCampaign(s,{type:'talkNPC',npcId:'local-retiro',approach:'quest',unitId:1000,sectorState:far}).lastError);s=talk(s,b);s.resources.textiles=0;const denied=dispatchCampaign(s,{type:'talkNPC',npcId:'local-retiro',approach:'quest',unitId:1000,sectorState:b});assert.ok(denied.lastError);assert.equal(denied.quests['retiro-uniformes'].status,'offered');assert.equal(denied.cityLoyaltyEvents.length,0);s.quests['retiro-uniformes'].completedAt=999;assert.throws(()=>restoreCampaign(serializeCampaign(s)));const old=initialCampaign();delete old.quests;assert.deepEqual(restoreCampaign(serializeCampaign(old)).quests,{});
});
test('each local errand has exact goods and northern route conditions',()=>{const s=initialCampaign();assert.deepEqual(questForNPC(s,'local-san_nicolas').cost,{powder:5});assert.equal(questForNPC(s,'macacha').conditionMet,false);s.sectors.salta.owner='patriot';s.sectors.jujuy.owner='patriot';assert.equal(questForNPC(s,'macacha').conditionMet,true);});

test('partial physical delivery stays with a dead contact and cannot earn the completion reward',()=>{
 let {s,b}=meeting();b=deliverPonchos(b,1);
 let pair=syncBattleTime(s,b);assert.equal(pair.error,null);s=pair.campaign;b=pair.battle;
 assert.equal(s.quests['retiro-uniformes'].status,'offered');
 const receipt=structuredClone(b.npcs.find(n=>n.id==='local-retiro').questGifts),stock=s.resources.ponchos;
 applyCivilianHarm(b,b.npcs.find(n=>n.id==='local-retiro'),{source:b.units.find(u=>u.id==='1000'),damage:100,breathLoss:0,intentional:true});
 pair=syncBattleTime(s,b);assert.equal(pair.error,null);s=pair.campaign;b=pair.battle;
 assert.equal(s.quests['retiro-uniformes'].status,'failed');
 const saved=decodeSave(encodeSave(s,b));s=saved.campaign;b=saved.battle;
 assert.deepEqual(b.npcs.find(n=>n.id==='local-retiro').questGifts,receipt);
 assert.equal(s.resources.ponchos,stock);assert.equal(s.conversations['local-retiro'].giftCount,1);
 assert.equal(s.cityLoyaltyEvents.filter(e=>e.kind==='quest').length,0);
 const rejected=dispatchCampaign(s,{type:'talkNPC',npcId:'local-retiro',approach:'quest',unitId:1000,sectorState:b});
 assert.ok(rejected.lastError);assert.deepEqual(rejected.quests,s.quests);
});
