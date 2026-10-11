import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_WORLD,DEFAULT_MAPS} from '../campaigns/default.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {initialCampaign,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {applyCivilianHarm} from '../game/civilian-harm.js';
import {refreshMilitaryCondition} from '../game/actor-condition.js';
import {enterSector} from '../game/world.js';
import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {syncBattleTime} from '../game/time.js';
import {order,visit,saved,leave} from './local-contract-fixture.mjs';
import {detentionManifest} from '../game/detention.js';
import {advanceCivilianBleeding} from '../game/civilian-harm.js';

export function renamedCivilianPackage(){
 const names=new Map(DEFAULT_WORLD.sectors.map((sector,index)=>[sector.id,`post-${index}`]));
 const rename=value=>Array.isArray(value)?value.map(rename):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[names.get(key)??key,rename(v)])):names.get(value)??value;
 const d=rename(defaultContentPackage());Object.assign(d,{id:'post-world',name:'Las postas',scenario:'generic-v1',includeOriginalResidents:false,world:rename(DEFAULT_WORLD),errands:[],roadsideDiscoveries:[],placements:[],quests:[],campaignRoles:{foundryEngineer:null,marchCommander:null}});
 delete d.world.physical;delete d.world.sceneExits;delete d.world.sceneEntries;delete d.world.sceneExitAnchors;
 // Historical mission maps are not scenes in this generic campaign.
 const scenes=new Set(['san_lorenzo','yatasto']),withoutScenes=value=>Array.isArray(value)?value.filter(v=>!scenes.has(v)).map(withoutScenes):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!scenes.has(key)).map(([key,v])=>[key,withoutScenes(v)])):value;d.world=withoutScenes(d.world);
 d.maps=Object.fromEntries(Object.entries(DEFAULT_MAPS).filter(([id])=>names.has(id)).map(([id,map])=>{const doc=rename(map);doc.id=names.get(id);doc.metadata.title=`Mapa de ${doc.id}`;return [doc.id,doc];}));
 for(const sector of d.world.sectors)sector.name=`La posta ${sector.id.slice(5)}`;
 d.characters=d.characters.filter(c=>['person-110','person-112','person-103'].includes(c.id));
 for(const c of d.characters)Object.assign(c,{traits:[],abilities:[],recruitmentSource:c.id==='person-103'?'encounter':'contract',service:c.id==='person-103'?'permanent':'contract',progression:c.id==='person-103'?'fixed':'experience',arrivalHours:0});
 const npc=d.characters.find(c=>c.id==='person-103');Object.assign(npc,{name:'Alma de la posta',weapon:null,monthlyPay:0,encounter:{recruitable:false,greeting:'La posta está abierta.',requiredLeadership:0,requiredLiberated:0,requiredSector:null}});delete npc.arrivalHours;delete npc.blade;
 d.placements=[{id:'post-resident',character:npc.id,mode:'fixed',sectors:[d.headquarters],moveChance:100,afterDeath:null,delayMin:0,delayMax:0}];
 return d;
}
const sync=(campaign,battle)=>{const next=syncBattleTime(campaign,battle);assert.equal(next.error,null,next.error);return next;};

test('a real NPC wound and death in a renamed world retain service health and one civic effect through full save',()=>{
 const d=renamedCivilianPackage();assert.deepEqual(validateContentPackage(d),[]);
 const merc=operativeIdForCharacter(d,'person-110'),resident=operativeIdForCharacter(d,'person-103');let p=visit(order(initialCampaign(8,d),{type:'recruitCivic',id:merc,term:'week'}));
 const npc=p.battle.npcs.find(n=>n.contentId==='person-103'),source=p.battle.units.find(u=>Number(u.id)===merc);assert.ok(npc);const originalHp=npc.hp,loyalty=p.campaign.sectors[d.headquarters].loyalty;
 applyCivilianHarm(p.battle,npc,{source,damage:10,intentional:true});p=sync(p.campaign,p.battle);assert.equal(p.campaign.operativeState[resident].hp,originalHp-10);
 p=saved(p);const wounded=p.battle.npcs.find(n=>n.contentId==='person-103');applyCivilianHarm(p.battle,wounded,{source:p.battle.units.find(u=>Number(u.id)===merc),damage:wounded.hp,intentional:true});p=sync(p.campaign,p.battle);
 assert.equal(p.campaign.operativeState[resident].alive,false);assert.equal(p.campaign.sectors[d.headquarters].loyalty,loyalty-10);assert.equal(p.campaign.cityLoyaltyEvents.filter(e=>e.kind==='civilianPlayerIntentional').length,1);
 p=saved(p);assert.deepEqual(sync(p.campaign,p.battle).campaign,p.campaign);
 p=visit(saved({campaign:leave(p)}).campaign);assert.equal(p.battle.npcs.find(n=>n.contentId==='person-103').hp,0);assert.equal(p.campaign.cityLoyaltyEvents.filter(e=>e.kind==='civilianPlayerIntentional').length,1);
 const forged=structuredClone(p.campaign);Object.values(forged.civilianState.people).find(r=>r.npcId===npc.id).sector='retiro';assert.throws(()=>restoreCampaign(serializeCampaign(forged)),/habitantes|ubicación|sector|campaña/i);
});

test('actual battle capture in a renamed world issues equipment-free prisoners and admits saved wound receipts',()=>{
 const d=renamedCivilianPackage(),capturedId=operativeIdForCharacter(d,'person-110'),rescuerId=operativeIdForCharacter(d,'person-112'),target=d.world.sectors.find(s=>d.world.sectors.find(home=>home.id===d.headquarters).neighbors.includes(s.id)).id;
 let campaign=order(initialCampaign(8,d),{type:'recruitCivic',id:capturedId,term:'week'});campaign=order(campaign,{type:'attack',sector:target});let battle=enterSector(campaign.pendingBattle);
 const captive=battle.units.find(u=>Number(u.id)===capturedId);Object.assign(captive,{hp:11,bleeding:2,bandaged:10,surrendered:true,ap:0});refreshMilitaryCondition(captive);battle.status='defeat';
 campaign=order(campaign,{type:'battleResult',battleId:battle.battleId,outcome:'defeat',sectorState:battle,survivors:battle.units.filter(u=>u.side==='player')});
 assert.equal(campaign.operativeState[capturedId].captured,true);assert.equal(campaign.operativeState[capturedId].capturedSector,target);assert.equal(detentionManifest(campaign,rosterFor(campaign),target)[0].detention.sector,target);
 campaign=restoreCampaign(serializeCampaign(campaign));campaign=order(campaign,{type:'recruitCivic',id:rescuerId,term:'week'});campaign=order(campaign,{type:'attack',sector:target});
 let p=prepareCampaignBattle(campaign);assert.equal(p.error,null,p.error);const prisoner=p.battle.npcs.find(n=>n.detention?.operativeId===capturedId);assert.ok(prisoner);assert.equal(prisoner.weapon,undefined);assert.equal(prisoner.inventory,undefined);assert.equal(prisoner.hp,p.campaign.operativeState[capturedId].hp);
 // Campaign time can provide recorded captivity care before this rescue.
 // Advance the wounds which actually remain in the admitted prisoner scene.
 const afterBleeding=prisoner.hp-(prisoner.bleeding??0)*2;advanceCivilianBleeding(p.battle,prisoner,2);p=sync(p.campaign,p.battle);assert.equal(p.campaign.operativeState[capturedId].hp,afterBleeding);assert.equal(saved(p).battle.npcs.find(n=>n.id===prisoner.id).hp,afterBleeding);
 const forged=structuredClone(p.campaign);forged.detentionRecords[prisoner.id].npc.detention.sector='retiro';assert.throws(()=>restoreCampaign(serializeCampaign(forged)),/prisionero|custodia/i);
});
