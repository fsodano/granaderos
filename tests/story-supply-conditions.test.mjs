import test from 'node:test';import assert from 'node:assert/strict';
import {defaultContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {contentIdentity} from '../game/content-identity.js';
import {initialCampaign} from '../game/campaign.js';
import {dialogueConditionsMet} from '../game/dialogue-conditions.js';
import {dialogueForNPC} from '../game/content-dialogue.js';
import {storyReferences} from '../game/campaign-story.js';
import {CHARACTER_SUPPLY_LABELS,DEFAULT_CHARACTER_SUPPLIES} from '../game/character-supplies.js';
import {dialoguePackage} from './dialogue-fixture.mjs';
import {order,saved,visit,leave,tactical,talk,localNPC,readyLocal,localId,sync} from './local-contract-fixture.mjs';
const gate=(character,item,min,max=null)=>[{type:'supply',character,item,min,max}];
const met=(p,character,item,min,max=null,battle=p.battle)=>dialogueConditionsMet(p.campaign,gate(character,item,min,max),battle);
const person=(d,id)=>d.characters.find(c=>c.id===`person-${id}`);
function patientPackage(){const d=defaultContentPackage();for(const id of [110,112])person(d,id).arrivalHours=0;person(d,110).attributes.medical=80;person(d,112).startingCondition={hp:1,energy:100,fatigue:0,bleeding:0,bandaged:0};return d;}
function patients(d=patientPackage()){let s=initialCampaign(42,d);for(const id of [110,112])s=order(s,{type:'recruitCivic',id,term:'week'});return tactical(visit(s),{type:'weapon',unitId:'110',slot:'medical'});}

test('supply ranges validate six real personal quantities and preserve older package identities',()=>{
 const d=dialoguePackage(),identity=contentIdentity(d),choice=d.characters.at(-1).encounter.dialogue.nodes[0].choices[0];assert.deepEqual(contentIdentity(parseContentPackage(encodeContentPackage(d))),identity);
 for(const item of Object.keys(CHARACTER_SUPPLY_LABELS)){choice.conditions=gate('person-110',item,0,item==='medkits'?1000000:100000);assert.deepEqual(parseContentPackage(encodeContentPackage(d)).characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions,choice.conditions);assert.ok(initialCampaign(42,d));}
 const valid=gate('person-110','medkits',1)[0];for(const patch of [{character:'missing'},{item:'weapon'},{item:'ammo'},{min:-1},{min:0.5},{min:'1'},{min:1000001},{max:0},{max:1000001},{max:'2'},{extra:true},{item:'rations',max:100001}]){choice.conditions=[{...valid,...patch}];assert.throws(()=>initialCampaign(42,d));}
 delete choice.conditions;const p={campaign:initialCampaign(42,d)};for(const [item,count]of Object.entries(DEFAULT_CHARACTER_SUPPLIES)){assert.equal(met(p,'person-110',item,count,count),true);assert.equal(met(p,'person-110',item,count+1),false);assert.equal(met(p,'person-110',item,0,count-1),false);}
 assert.equal(dialogueConditionsMet(p.campaign,[{type:'character',character:'person-110',state:'present'}]),false,'allocated stocks do not imply world presence');
});

test('actual tactical spending uses current deployed quantities rather than stale service stock, including after save and settlement',()=>{
 let p=patients();assert.equal(met(p,'person-110','medkits',2,2),true);p=tactical(p,{type:'heal',targetId:'112'});assert.equal(p.campaign.operativeState[110].medkits,2);assert.equal(met(p,'person-110','medkits',1,1),true);assert.equal(met(p,'person-110','medkits',2),false);p=saved(p);
 for(const battle of [null,{...p.battle,battleId:'other'},{...p.battle,sectorId:'cordoba'},{...p.battle,sceneId:'yatasto'}]){assert.equal(met(p,'person-110','medkits',0,null,battle),false);assert.equal(met(p,'person-110','medkits',0,0,battle),false,'unknown is not empty');}
 p=tactical(p,{type:'heal',targetId:'112'});assert.equal(met(p,'person-110','medkits',0,0),true);p=saved(p);assert.equal(met(p,'person-110','medkits',0,0),true);p=saved({campaign:leave(p)});assert.equal(met(p,'person-110','medkits',0,0),true);p.campaign=order(p.campaign,{type:'purchaseMedicalSupplies',id:110,quantity:3});assert.equal(met(p,'person-110','medkits',3,3),true);assert.equal(met(p,'person-110','medkits',0,0),false);assert.ok(saved(p));
});

test('actual resident collection and finite care open a stock-gated response and settle a saved chapter without granting supplies',()=>{
 const d=dialoguePackage(),resident=d.characters.at(-1);resident.startingSupplies={...DEFAULT_CHARACTER_SUPPLIES,medkits:7};resident.startingCondition={hp:1,energy:100,fatigue:0,bleeding:0,bandaged:0};person(d,110).startingSupplies={...DEFAULT_CHARACTER_SUPPLIES,medkits:0};person(d,110).attributes.medical=80;
 const clauses=[...gate(resident.id,'medkits',0,0),...gate('person-110','medkits',5,5),{type:'character',character:resident.id,state:'stable'}];resident.encounter.dialogue.nodes[0].choices[0].conditions=clauses;resident.encounter.dialogue.nodes[1].text='Las vendas alcanzaron. Podemos seguir.';d.campaignStory={introduction:'Buscá a Alma.',victory:'Rescate cumplido.',defeat:'Rescate perdido.',chapters:[{id:'aid',name:'Vendas para el rescate',objective:'Recogé sus vendas y estabilizala.',conditions:clauses}],failureConditions:[]};
 let p=readyLocal(undefined,d),visible=()=>dialogueForNPC(p.campaign,localNPC(p.battle),p.battle).choices.some(c=>c.id==='north');assert.equal(visible(),false);p=tactical(p,{type:'loot',targetId:localNPC(p.battle).id,item:'medkits',count:2});assert.equal(met(p,resident.id,'medkits',5,5),true);assert.equal(met(p,'person-110','medkits',2,2),true);p=saved(p);p=tactical(p,{type:'loot',targetId:localNPC(p.battle).id,item:'medkits'});assert.equal(visible(),false);
 p=tactical(p,{type:'weapon',unitId:'110',slot:'medical'});for(let i=0;i<2;i++)p=tactical(saved(p),{type:'heal',targetId:localNPC(p.battle).id});assert.equal(visible(),true);assert.equal(p.campaign.completed,false);p={...p,campaign:order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'north'})};assert.equal(p.campaign.lastConversation.text,'Las vendas alcanzaron. Podemos seguir.');assert.equal(p.battle.units[0].medkits,5);assert.equal(localNPC(p.battle).civilianSupplies.medkits,0);p=saved({campaign:leave(saved(p))});assert.equal(p.campaign.completed,true);assert.equal(p.campaign.operativeState[110].medkits,5);assert.equal(p.campaign.operativeState[localId(p.campaign)].medkits,0);assert.equal(dialogueConditionsMet(p.campaign,clauses),true);assert.ok(saved(p));
});

test('stock failure conditions read actual in-scene consumption immediately and references protect their character',()=>{
 const d=patientPackage(),clauses=gate('person-110','medkits',0,0);d.campaignStory={introduction:'Inicio',victory:'Final',defeat:'No quedan vendas.',chapters:[{id:'later',name:'Después',objective:'Esperá.',conditions:[{type:'day',min:1000,max:null}]}],failureConditions:clauses};assert.equal(storyReferences(d.campaignStory,'character','person-110'),true);assert.equal(storyReferences(d.campaignStory,'character','person-112'),false);
 let p=patients(d);assert.equal(p.campaign.defeated,false);p=tactical(p,{type:'heal',targetId:'112'});assert.equal(p.campaign.defeated,false);p=tactical(p,{type:'heal',targetId:'112'});assert.equal(p.campaign.defeated,true);assert.equal(p.campaign.completed,false);assert.equal(p.campaign.operativeState[110].medkits,2);p=saved(p);assert.equal(p.battle.units[0].medkits,0);assert.equal(p.campaign.campaignProgress.outcome.type,'defeat');
});

test('a named mission ally condition reads its actually spent ration before the service record is acknowledged',async()=>{
 const {secureArea}=await import('./controlled-area-fixture.mjs'),{enterSector}=await import('../game/world.js'),{actBattle,getReachable}=await import('../game/tactical.js');
 // Prepared territorial approach isolates the existing mission ally, not a full campaign route.
 let s=order(secureArea(initialCampaign(8,defaultContentPackage()),'buenos_aires','san_nicolas'),{type:'createOfficer',name:'Isabel',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});s=order(s,{type:'travel',sector:'san_nicolas'});s=order(s,{type:'attack',sector:'san_lorenzo'});let p={campaign:s,battle:enterSector({...s.pendingBattle,hour:s.hour})};const ally=p.battle.units.find(u=>u.missionAlly&&u.id==='57');assert.equal(met(p,'person-57','rations',1,1),true);assert.equal(met(p,'person-57','medkits',0,0),true);assert.equal(s.operativeState[57].medkits,2);
 const step=getReachable(p.battle,ally).find(t=>t.cost>0);assert.ok(step);p.battle=actBattle(p.battle,{type:'move',unitId:'57',x:step.x,y:step.y});assert.equal(p.battle.lastError,null);p.battle=actBattle(p.battle,{type:'weapon',unitId:'57',slot:'supply',supplyKey:'rations'});assert.equal(p.battle.lastError,null);p.battle=actBattle(p.battle,{type:'ration',unitId:'57'});assert.equal(p.battle.lastError,null);assert.equal(met(p,'person-57','rations',0,0),true);assert.equal(s.operativeState[57].rations,2);assert.equal(met(p,'person-57','rations',0,0,null),false);p=saved(sync(p));assert.equal(met(p,'person-57','rations',0,0),true);
});
