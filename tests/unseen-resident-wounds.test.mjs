import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {encountersFor} from '../game/encounters.js';
import {civilianIncidents} from '../game/civilian-harm.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {synchronizeCampaignPresence} from '../game/campaign-presence.js';
import {localPackage,order,saved,visit,leave,tactical,A} from './local-contract-fixture.mjs';
const B='cell-28-27',patient='alma-contract';
const condition=(hp=12,bleeding=1)=>({hp,energy:100,fatigue:0,bleeding,bandaged:0});
const id=(s,c=patient)=>operativeIdForCharacter(s.contentCampaign.package,c);
const record=(s,c=patient)=>s.operativeState[id(s,c)];
const ledger=(s,c=patient)=>s.civilianState.people[`person-${id(s,c)}`];
function content(hp=12){const d=localPackage({pay:0,service:'permanent'});d.characters.find(c=>c.id===patient).startingCondition=condition(hp);return d;}
function successor(d,{name='successor',after=patient,hp=10,delay=2,sectors=[A],mode='fixed'}={}){
 const c=structuredClone(d.characters.find(c=>c.id===patient));c.id=name;c.name=name;c.nickname=name;c.startingCondition=condition(hp);d.characters.push(c);
 d.placements.push({id:`place-${name}`,character:name,mode,sectors,moveChance:100,afterDeath:after,delayMin:delay,delayMax:delay,...(mode==='daily'?{selection:'alternate',loadedGuard:'current'}:{})});return d;
}
const ready=d=>order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'month'});
const sync=(s,battle)=>{const p=syncBattleTime(s,battle);assert.equal(p.error,null,p.error);return {campaign:p.campaign,battle:p.battle};};

test('an unseen authored wound runs from campaign start, leaves one body and never attributes its death to the player',()=>{
 let s=ready(content()),loyalty=structuredClone(s.cityLoyaltyEvents);assert.equal(ledger(s).health.hp,12);assert.equal(ledger(s).sector,A);
 s=order(saved({campaign:s}).campaign,{type:'wait',hours:1});assert.equal(record(s).hp,0);assert.equal(record(s).deathMinute,1);assert.equal(ledger(s).health.bleeding,0);assert.equal(ledger(s).sector,A);
 assert.deepEqual(s.cityLoyaltyEvents,loyalty);assert.equal(civilianIncidents(ledger(s).health).length,1);assert.equal(civilianIncidents(ledger(s).health)[0].side,'unknown');assert.equal(s.log.filter(l=>l.text.includes('Alma Contratada murió por sus heridas')).length,1);
 s=order(saved({campaign:s}).campaign,{type:'travel',sector:A});let p=visit(s);const body=p.battle.npcs.find(n=>n.contentId===patient);assert.equal(body.hp,0);assert.equal(p.battle.npcs.filter(n=>n.contentId===patient).length,1);
 s=order(leave(saved(p)),{type:'wait',hours:24});p=visit(s);assert.equal(p.battle.npcs.find(n=>n.contentId===patient).hp,0);assert.equal(civilianIncidents(ledger(s).health).length,1);assert.ok(saved(p));
});

test('unhired bulletin candidates and dormant residents do not acquire a civilian wound clock',()=>{
 const d=content();d.placements.find(p=>p.character===patient).afterDeath='person-3';d.characters.find(c=>c.id==='person-110').startingCondition=condition();
 let s=initialCampaign(42,d);s=order(s,{type:'wait',hours:24});assert.equal(record(s).hp,12);assert.equal(ledger(s),undefined);assert.equal(s.contentPresence.people[patient].appeared,false);assert.equal(s.operativeState[110].hp,12);assert.equal(s.civilianState.people['person-110'],undefined);
 assert.ok(!encountersFor(s,'retiro').some(n=>n.operativeId===110));assert.ok(saved({campaign:s}));
});

test('a batched wait starts and kills wounded successors at their actual appearance and records each trigger once',()=>{
 const d=successor(successor(content()),{name:'third',after:'successor',hp:6,delay:0});let s=initialCampaign(42,d);assert.equal(ledger(s,'successor'),undefined);
 s=order(s,{type:'wait',hours:1});assert.equal(record(s).deathMinute,1);assert.equal(record(s,'successor').deathMinute,4);assert.equal(record(s,'third').deathMinute,4);
 assert.deepEqual(s.contentPresence.receipts.map(r=>[r.trigger,r.minute,r.at]),[[patient,1,3],['successor',4,4]]);assert.equal(s.contentPresence.events.length,0);
 for(const name of [patient,'successor','third']){assert.equal(ledger(s,name).health.hp,0);assert.equal(civilianIncidents(ledger(s,name).health).length,1);}
 const receipts=structuredClone(s.contentPresence.receipts);s=order(saved({campaign:s}).campaign,{type:'wait',hours:1});assert.deepEqual(s.contentPresence.receipts,receipts);assert.ok(saved({campaign:s}));
});

test('a successor protected by a loaded cell begins bleeding only when that scene closes',()=>{
 const d=successor(content(2),{hp:2,delay:1,sectors:['retiro']});let p=visit(ready(d));p=tactical(p,{type:'rest'});assert.equal(p.campaign.hour,0);assert.equal(p.campaign.secondOfHour,600);
 assert.equal(record(p.campaign).hp,0);assert.equal(record(p.campaign,'successor').hp,2);assert.equal(p.campaign.contentPresence.people.successor.appeared,false);assert.equal(ledger(p.campaign,'successor'),undefined);assert.equal(p.campaign.contentPresence.events.length,1);assert.ok(!p.battle.npcs.some(n=>n.contentId==='successor'));
 let s=leave(saved(p));assert.equal(s.contentPresence.people.successor.appeared,true);assert.equal(ledger(s,'successor').health.hp,2);assert.equal(s.contentPresence.events.length,0);
 s=order(saved({campaign:s}).campaign,{type:'wait',hours:1});assert.equal(record(s,'successor').deathMinute,10);assert.equal(ledger(s,'successor').sector,'retiro');p=visit(s);assert.equal(p.battle.npcs.find(n=>n.contentId==='successor').hp,0);assert.ok(saved(p));
});

test('daily relocation carries the same wound to the actual new cell before an off-screen death',()=>{
 const d=successor(content(),{hp:94,delay:238,sectors:[A,B],mode:'daily'}),start=initialCampaign(42,d);let s=order(start,{type:'wait',hours:4});
 const person=s.contentPresence.people.successor,sector=person.sector;assert.equal(person.revision,2);assert.equal(ledger(s,'successor').sector,sector);assert.equal(record(s,'successor').hp,84);
 s=order(saved({campaign:s}).campaign,{type:'wait',hours:1});assert.equal(record(s,'successor').deathMinute,248);assert.equal(ledger(s,'successor').sector,sector);assert.equal(ledger(s,'successor').health.hp,0);
 const batch=order(start,{type:'wait',hours:5});assert.deepEqual(batch.contentPresence,s.contentPresence);assert.deepEqual(batch.civilianState,s.civilianState);assert.ok(encountersFor(s,sector).some(n=>n.contentId==='successor'&&n.hp===0));assert.ok(!encountersFor(s,sector===A?B:A).some(n=>n.contentId==='successor'));assert.ok(saved({campaign:s}));
});

test('incremental and batched remote tactical time agree across an unseen successor deadline and retain partial seconds',()=>{
 const d=successor(content(),{hp:60,delay:1});const initial=visit(ready(d));let immediate=saved(initial),battle=initial.battle;
 for(let i=0;i<100;i++){battle=actBattle(battle,{type:'ambient'});assert.equal(battle.lastError,null);immediate=sync(immediate.campaign,battle);if(i===20||i===49)immediate=saved(immediate);}
 const batch=sync(initial.campaign,battle);assert.deepEqual(batch.campaign.civilianState,immediate.campaign.civilianState);assert.deepEqual(batch.campaign.contentPresence,immediate.campaign.contentPresence);assert.equal(record(batch.campaign).deathMinute,1);assert.equal(record(batch.campaign,'successor').deathMinute,8);assert.ok(saved(batch));assert.ok(saved(immediate));
});

test('older unseen wounds start at their saved time; current saves reject a missing clock or a false living location',()=>{
 const legacy=initialCampaign(42,content());
 // Declared old-format snapshot: the former version kept the unseen starting
 // health through these three hours. Migration must not invent past damage.
 legacy.hour=3;synchronizeCampaignPresence(legacy);legacy.civilianState={version:1,people:{}};
 let s=saved({campaign:legacy}).campaign;assert.equal(s.hour,3);assert.equal(record(s).hp,12);assert.equal(s.civilianState.version,2);assert.equal(ledger(s).health.hp,12);
 const wire=JSON.parse(encodeSave(s)),key=`person-${id(s)}`;
 for(const change of [v=>delete v.campaign.civilianState.people[key],v=>v.campaign.civilianState.people[key].sector=B,v=>v.campaign.civilianState.version=3]){const bad=structuredClone(wire);change(bad);assert.throws(()=>decodeSave(JSON.stringify(bad)));}
 s=order(s,{type:'wait',hours:1});assert.equal(record(s).deathMinute,181);assert.ok(saved({campaign:s}));
});

test('first aid in the opening sector stops a newly seeded wound and does not reset it after saving or departure',()=>{
 const d=content(30);d.placements.find(p=>p.character===patient).sectors=['retiro'];d.characters.find(c=>c.id==='person-110').attributes.medical=80;let p=visit(ready(d));
 const n=p.battle.npcs.find(n=>n.contentId===patient),u=p.battle.units.find(u=>u.side==='player'),spot=getReachable(p.battle,u.id).find(t=>Math.abs(t.x-n.x)+Math.abs(t.y-n.y)===1);assert.ok(spot);if(spot.cost)p=tactical(p,{type:'move',x:spot.x,y:spot.y});
 const supplies=p.battle.units.find(u=>u.side==='player').medkits;p=tactical(p,{type:'weapon',slot:'medical'});p=tactical(p,{type:'heal',targetId:n.id});const hp=p.battle.npcs.find(n=>n.contentId===patient).hp;assert.equal(ledger(p.campaign).health.bleeding,0);assert.ok(p.battle.units.find(u=>u.side==='player').medkits<supplies);
 let s=order(leave(saved(p)),{type:'wait',hours:24});assert.equal(record(s).hp,hp);assert.equal(record(s).alive,true);assert.equal(ledger(s).health.bleeding,0);p=visit(s);assert.equal(p.battle.npcs.find(n=>n.contentId===patient).hp,hp);assert.ok(saved(p));
});
