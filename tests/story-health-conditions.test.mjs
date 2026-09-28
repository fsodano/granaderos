import test from 'node:test';import assert from 'node:assert/strict';
import {defaultContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {contentIdentity} from '../game/content-identity.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {dialogueConditionsMet,DIALOGUE_PERSON_STATES} from '../game/dialogue-conditions.js';
import {dialogueForNPC} from '../game/content-dialogue.js';
import {secureArea} from './controlled-area-fixture.mjs';
import {enterSector} from '../game/world.js';
import {refreshMilitaryCondition} from '../game/actor-condition.js';
import {dialoguePackage} from './dialogue-fixture.mjs';
import {order,saved,visit,leave,tactical,talk,localNPC,readyLocal} from './local-contract-fixture.mjs';
const gate=(character,state)=>[{type:'character',character,state}];
const condition=(s,character,state,battle)=>dialogueConditionsMet(s,gate(character,state),battle);
const healthStates=['conscious','unconscious','wounded','bleeding','stable','healthy'];
const person=(d,id)=>d.characters.find(c=>c.id===`person-${id}`);

test('physical character conditions validate, retain older content identities and distinguish health from presence or service',()=>{
 const d=dialoguePackage(),identity=contentIdentity(d);assert.deepEqual(contentIdentity(parseContentPackage(encodeContentPackage(d))),identity);
 for(const state of healthStates){assert.ok(DIALOGUE_PERSON_STATES.includes(state));d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions=gate('person-110',state);assert.deepEqual(parseContentPackage(encodeContentPackage(d)).characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions,gate('person-110',state));assert.ok(initialCampaign(42,d));}
 for(const state of ['healed',null,{},1]){d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions=gate('person-110',state);assert.throws(()=>initialCampaign(42,d));}
 delete d.characters.at(-1).encounter.dialogue.nodes[0].choices[0].conditions;
 const s=initialCampaign(42,d);assert.equal(condition(s,'person-110','healthy'),true);assert.equal(condition(s,'person-110','stable'),true);assert.equal(condition(s,'person-110','present'),false);assert.equal(condition(s,'person-110','serving'),false);
});

test('conditions see an actually deployed critical patient before settlement and reject unrelated scene health',()=>{
 const d=defaultContentPackage();person(d,110).attributes.medical=80;for(const id of [110,112])person(d,id).arrivalHours=0;person(d,112).startingCondition={hp:1,energy:100,fatigue:0,bleeding:0,bandaged:0};
 let s=initialCampaign(42,d);for(const id of [110,112])s=order(s,{type:'recruitCivic',id,term:'week'});let p=visit(s);
 assert.equal(condition(p.campaign,'person-112','unconscious',p.battle),true);assert.equal(condition(p.campaign,'person-112','stable',p.battle),false);
 p=tactical(p,{type:'heal',targetId:'112'});assert.equal(condition(p.campaign,'person-112','unconscious',p.battle),true);p=tactical(saved(p),{type:'heal',targetId:'112'});assert.equal(p.battle.units.find(u=>u.id==='112').hp,15);assert.equal(p.campaign.operativeState[112].hp,1);
 for(const state of ['conscious','wounded','stable'])assert.equal(condition(p.campaign,'person-112',state,p.battle),true,state);for(const state of ['unconscious','bleeding','healthy'])assert.equal(condition(p.campaign,'person-112',state,p.battle),false,state);
 for(const patch of [{battleId:'another-battle'},{sectorId:'cordoba'},{sceneId:'yatasto'}])assert.equal(condition(p.campaign,'person-112','stable',{...p.battle,...patch}),false);
 s=saved({campaign:leave(p)}).campaign;assert.equal(condition(s,'person-112','stable'),true);assert.equal(condition(s,'person-112','healthy'),false);
 p=visit(s);const victim=p.battle.units.find(u=>u.id==='112');victim.hp=0;refreshMilitaryCondition(victim); // Prepared death isolates the pre-settlement query.
 for(const state of healthStates)assert.equal(condition(p.campaign,'person-112',state,p.battle),false,state);assert.equal(condition(p.campaign,'person-112','dead',p.battle),true);
});

test('actual finite treatment opens an authored response and completes a rescue chapter only on saved departure',()=>{
 const d=dialoguePackage(),resident=d.characters.at(-1);resident.startingCondition={hp:1,energy:100,fatigue:0,bleeding:0,bandaged:0};person(d,110).attributes.medical=80;resident.encounter.dialogue.nodes[0].choices[0].conditions=gate(resident.id,'stable');resident.encounter.dialogue.nodes[1].text='Ya puedo seguir. Gracias por las vendas.';
 d.campaignStory={introduction:'Encontrá a Alma.',victory:'Alma está estabilizada.',defeat:'Se perdió el rescate.',chapters:[{id:'rescate',name:'Estabilizar a Alma',objective:'Encontrala y prestale primeros auxilios.',conditions:gate(resident.id,'stable')}],failureConditions:gate(resident.id,'dead')};
 let p=readyLocal(undefined,d),npc=localNPC(p.battle),visible=()=>dialogueForNPC(p.campaign,localNPC(p.battle),p.battle).choices.some(c=>c.id==='north');assert.equal(visible(),false);assert.equal(p.campaign.completed,false);
 p=tactical(p,{type:'heal',targetId:npc.id});assert.equal(visible(),false);p=tactical(saved(p),{type:'heal',targetId:npc.id});assert.equal(visible(),true);assert.equal(p.campaign.completed,false);assert.equal(p.battle.units[0].medkits,0);assert.equal(condition(p.campaign,resident.id,'wounded',p.battle),true);assert.equal(condition(p.campaign,resident.id,'healthy',p.battle),false);
 p={...p,campaign:order(p.campaign,{...talk(p,undefined,'dialogue'),dialogueNode:'start',dialogueChoice:'north'})};assert.equal(p.campaign.lastConversation.text,'Ya puedo seguir. Gracias por las vendas.');
 const s=saved({campaign:leave(saved(p))}).campaign;assert.equal(s.completed,true);assert.equal(s.defeated,false);assert.equal(s.campaignProgress.completed.length,1);assert.equal(condition(s,resident.id,'stable'),true);assert.equal(condition(s,resident.id,'healthy'),false);assert.ok(saved({campaign:s}));
});

test('health predicates distinguish bleeding and exhaustion and use the current experience-adjusted maximum instead of the starting maximum',()=>{
 const d=defaultContentPackage(),c=person(d,110);c.startingCondition={hp:30,energy:0,fatigue:0,bleeding:2,bandaged:0};let s=initialCampaign(42,d);
 assert.equal(condition(s,c.id,'wounded'),true);assert.equal(condition(s,c.id,'bleeding'),true);assert.equal(condition(s,c.id,'unconscious'),true);assert.equal(condition(s,c.id,'conscious'),false);assert.equal(condition(s,c.id,'stable'),false);assert.equal(condition(s,c.id,'healthy'),false);
 // Prepared experience isolates an existing maximum-health growth boundary.
 s=initialCampaign(42,defaultContentPackage());const before=rosterFor(s).find(o=>o.id===110).maxHp;assert.equal(condition(s,'person-110','healthy'),true);s.operativeState[110].xp=100;assert.ok(rosterFor(s).find(o=>o.id===110).maxHp>before);assert.equal(condition(s,'person-110','wounded'),true);assert.equal(condition(s,'person-110','healthy'),false);assert.ok(saved({campaign:s}));
});


test('a named mission ally uses its current tactical condition before the civilian service record is acknowledged',()=>{
 // Prepared controlled approach and wound isolate the active ally boundary.
 let s=order(secureArea(initialCampaign(8,defaultContentPackage()),'buenos_aires','san_nicolas'),{type:'createOfficer',name:'Isabel',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});s=order(s,{type:'travel',sector:'san_nicolas'});s=order(s,{type:'attack',sector:'san_lorenzo'});
 const b=enterSector({...s.pendingBattle,hour:s.hour}),ally=b.units.find(u=>u.missionAlly&&u.id==='57');assert.ok(ally);assert.ok(s.operativeState[57].hp>=15);ally.hp=14;refreshMilitaryCondition(ally);
 assert.equal(condition(s,'person-57','unconscious',b),true);assert.equal(condition(s,'person-57','wounded',b),true);assert.equal(condition(s,'person-57','stable',b),false);assert.equal(condition(s,'person-57','unconscious',{...b,battleId:'other'}),false);
});
