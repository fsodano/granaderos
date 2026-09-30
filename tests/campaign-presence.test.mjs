import {secureArea} from './controlled-area-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {encountersFor,encounterContacts} from '../game/encounters.js';
import {createContentSession,advancePlacementState} from '../game/content-placement.js';
import {enterSector} from '../game/world.js';
import {createBattle,actBattle,getReachable} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {contentIdentity} from '../game/content-identity.js';
const A='cell-27-27',B='cell-26-27';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);return next;};
const saved=(s,b=null)=>decodeSave(encodeSave(s,b));
const placement=d=>d.placements.find(p=>p.character==='person-3');
const definition=(patch={})=>{const d=defaultContentPackage();Object.assign(placement(d),{sectors:[A],...patch});const officer=d.characters.find(c=>c.id==='person-110');officer.arrivalHours=0;officer.attributes.leadership=100;return d;};
const ready=(d=definition(),seed=42)=>order(initialCampaign(seed,d),{type:'recruitCivic',id:110,term:'month'});
const travel=(s,sector)=>order(s,{type:'travel',sector});
const visit=s=>{const campaign=order(s,{type:'visitSector'});return {campaign,battle:enterSector({...campaign.pendingBattle,hour:campaign.hour,secondOfHour:campaign.secondOfHour},campaign.sectorStates[campaign.location])};};
const synced=pair=>{const next=syncBattleTime(pair.campaign,pair.battle);assert.equal(next.error,null);return next;};
const leave=pair=>{pair=synced(pair);return order(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});};
const person=s=>s.contentPresence.people['person-3'];
const contact=b=>b.npcs.find(n=>n.operativeId===3);
function approach(pair){
 const npc=contact(pair.battle),spot=getReachable(pair.battle,'110').find(p=>Math.abs(p.x-npc.x)+Math.abs(p.y-npc.y)===1);assert.ok(spot);
 if(spot.cost>0)pair.battle=actBattle(pair.battle,{type:'move',unitId:'110',x:spot.x,y:spot.y});assert.equal(pair.battle.lastError,null);return synced(pair);
}

test('authored fixed cell is the real encounter, with conversation, local hiring and no duplicate after save or reentry',()=>{
 let s=ready();assert.ok(!encountersFor(s,'retiro').some(n=>n.operativeId===3));assert.equal(encountersFor(s,A).length,1);
 let pair=approach(visit(travel(s,A))),npc=contact(pair.battle);
 s=order(pair.campaign,{type:'talkNPC',npcId:npc.id,unitId:110,approach:'friendly',sectorState:pair.battle});
 assert.equal(s.conversations.cabral.sector,A);assert.match(encounterContacts(s).find(n=>n.id==='cabral').locationLabel,/Último encuentro/);
 pair=saved(s,pair.battle);s=leave(pair);pair=approach(visit(saved(s).campaign));
 s=order(pair.campaign,{type:'talkNPC',npcId:npc.id,unitId:110,approach:'recruit',sectorState:pair.battle});assert.ok(s.recruited.includes(3));assert.equal(person(s).recruited,true);
 // Apply the same local NPC-to-squad transition as page.tsx.
 pair.battle.npcs=pair.battle.npcs.filter(n=>n.id!==npc.id);const record=s.pendingBattle.squad.find(u=>u.id===3);
 const unit=createBattle([record],{width:pair.battle.width,height:pair.battle.height,enemies:[],exploration:true}).units[0];pair.battle.units.push({...unit,x:npc.x,y:npc.y});
 pair=saved(s,pair.battle);s=leave(pair);assert.ok(!contact(visit(saved(s).campaign).battle));assert.equal(encountersFor(s,A).length,0);
});

test('initial random choice is permanent, survives active and campaign saves and does not disclose the draw in correspondence',()=>{
 const d=definition({mode:'once',sectors:[A,B]});let s=ready(d,919),at=person(s).sector;
 assert.equal(encounterContacts(s).find(n=>n.id==='cabral').locationLabel,'Ubicación por descubrir');
 const replay=createContentSession(d,919);assert.equal(replay.people['person-3'].sector,at);
 for(let i=0;i<3;i++){s=order(saved(s).campaign,{type:'wait',hours:24});assert.equal(person(s).sector,at);}
 const pair=saved(...Object.values(visit(travel(s,at))));assert.equal(contact(pair.battle).contentId,'person-3');
});

test('daily relocation clears old scene residents and local routines, while correspondence keeps the last encounter',()=>{
 let s=ready(definition({mode:'daily',sectors:[A,B],selection:'alternate'}));const first=person(s).sector;
 let pair=approach(visit(travel(s,first)));
 s=order(pair.campaign,{type:'talkNPC',npcId:'cabral',unitId:110,approach:'friendly',sectorState:pair.battle});
 const npc=contact(pair.battle);npc.ai={cycle:17,homeId:'old-home',activity:'home',wait:2,destination:{x:npc.x,y:npc.y}};npc.facing=6;
 s=leave({campaign:s,battle:pair.battle});pair=visit(s);assert.equal(contact(pair.battle).ai.cycle,17);s=leave(pair);
 const nextHour=Math.ceil((s.contentPresence.nextDaily-s.contentPresence.minute)/60);s=order(s,{type:'wait',hours:nextHour});
 const second=person(s).sector;assert.notEqual(first,second);assert.equal(s.sectorStates[first].npcs.length,0);
 assert.equal(s.conversations.cabral.sector,first);s=saved(s).campaign;
 pair=visit(travel(s,second));assert.ok(contact(pair.battle));assert.notEqual(contact(pair.battle).ai?.homeId,'old-home');assert.equal(contact(pair.battle).presenceRevision,person(pair.campaign).revision);
 s=leave(pair);const seen=new Set(Object.values(s.sectorStates).flatMap(scene=>scene.npcs.filter(n=>n.operativeId===3).map(n=>n.id)));assert.equal(seen.size,1);
 s=order(s,{type:'wait',hours:Math.ceil((s.contentPresence.nextDaily-s.contentPresence.minute)/60)});assert.equal(person(s).sector,first);assert.equal(s.sectorStates[second].npcs.length,0);
 pair=visit(travel(saved(s).campaign,first));assert.ok(contact(pair.battle));assert.notEqual(contact(pair.battle).ai?.cycle,17);
});

test('04:00 tactical time cannot move a resident out of a loaded cell or introduce one into it',()=>{
 for(const loadDestination of [false,true]){
  let s=ready(definition({mode:'daily',sectors:['retiro',A],selection:'alternate'}),42);
  const at=person(s).sector,other=at==='retiro'?A:'retiro',loaded=loadDestination?other:at;
  if(s.location!==loaded)s=travel(s,loaded);
  let pair=visit(s),before=structuredClone(person(s));pair.battle.elapsedSeconds=(4-s.hour)*3600;
  pair=synced(pair);assert.equal(pair.campaign.hour,4);assert.equal(person(pair.campaign).sector,before.sector);assert.equal(person(pair.campaign).revision,before.revision);
  pair=saved(pair.campaign,pair.battle);s=leave(pair);assert.equal(person(s).sector,before.sector);
  s=order(s,{type:'wait',hours:24});assert.notEqual(person(s).sector,before.sector);
 }
});

test('range guard protects an entire candidate range, and destination protection never redraws the random decision',()=>{
 const d=definition({mode:'daily',sectors:['retiro',A,B],loadedGuard:'range'});let s=ready(d),pair=visit(s);const before=structuredClone(s.contentPresence);
 pair.battle.elapsedSeconds=4*3600;pair=synced(pair);assert.equal(pair.campaign.contentPresence.rng,before.rng);assert.equal(person(pair.campaign).sector,person(s).sector);
 const random=definition({mode:'daily',sectors:[A,B]});
 const start=createContentSession(random,42),unloaded=advancePlacementState(start,240),loaded=advancePlacementState(start,240,unloaded.people['person-3'].sector);
 assert.equal(loaded.people['person-3'].sector,start.people['person-3'].sector);
 if(unloaded.people['person-3'].sector!==start.people['person-3'].sector)assert.equal(loaded.rng,unloaded.rng);
});

test('campaign and editor simulation make identical daily decisions and reading scenes cannot consume randomness',()=>{
 const d=definition({mode:'daily',sectors:[A,B,'cell-25-27']});let s=ready(d,929),runtime=createContentSession(d,929);
 for(let i=0;i<5;i++){s=order(s,{type:'wait',hours:24});runtime=advancePlacementState(runtime,s.hour*60);assert.equal(person(s).sector,runtime.people['person-3'].sector);assert.equal(s.contentPresence.rng,runtime.rng);s=saved(s).campaign;}
 const rng=s.contentPresence.rng;for(let i=0;i<5;i++){encountersFor(s,A);encountersFor(s,B);encounterContacts(s);}assert.equal(s.contentPresence.rng,rng);
});

test('omitted placements mean no encounter, contract placements and unimplemented death successors cannot launch',()=>{
 const d=definition();d.placements=d.placements.filter(p=>p.character!=='person-3');let s=ready(d);for(const at of ['retiro',A,B])assert.ok(!encountersFor(s,at).some(n=>n.operativeId===3));assert.ok(!encounterContacts(s).some(n=>n.id==='cabral'));assert.ok(saved(s));
 for(const patch of [{character:'person-100'},{afterDeath:'person-4'},{unknownRule:true},{sectors:['cell-0-0']}]){
  const bad=definition(patch);assert.ok(campaignContentReport(bad).blocked.length);assert.throws(()=>initialCampaign(42,bad));
 }
 for(const patch of [{selection:'alternate',mode:'daily',sectors:[A]},{loadedGuard:'invalid'},{sectors:['retiro','cell-27-28'],mode:'once'}])assert.ok(validateContentPackage(definition(patch)).length);
});

test('contract candidates remain off-map before, during and after arrival',()=>{
 const d=definition({mode:'daily',sectors:[A,B]});d.characters.find(c=>c.id==='person-100').arrivalHours=6;
 let s=ready(d);s=order(s,{type:'recruitCivic',id:100,term:'week'});
 for(let i=0;i<=6;i++){
  assert.equal(s.contentPresence.people['person-100'].sector,null);assert.equal(s.contentPresence.people['person-100'].appeared,false);
  for(const at of ['retiro',A,B])assert.ok(!encountersFor(s,at).some(n=>n.operativeId===100));
  if(i<6)s=order(s,{type:'wait',hours:1});
 }
 assert.ok(s.recruited.includes(100));assert.ok(saved(s));
});

test('save admission rejects invalid clock, status, placement revision and duplicated or forged scene residents',()=>{
 const pair=visit(travel(ready(),A)),wire=encodeSave(pair.campaign,pair.battle);
 for(const mutate of [
  v=>delete v.campaign.contentPresence,v=>v.campaign.contentPresence.minute++,v=>v.campaign.contentPresence.nextDaily++,
  v=>v.campaign.contentPresence.people['person-3'].sector=B,v=>v.campaign.contentPresence.people['person-3'].hp--,
  v=>v.campaign.contentPresence.people['person-3'].recruited=true,v=>v.campaign.contentPresence.people['person-100'].sector=A,
  v=>v.battle.npcs[0].presenceRevision++,v=>delete v.battle.npcs[0].operativeId,
  v=>v.campaign.pendingBattle.npcs[0].presenceRevision++,v=>v.campaign.contentPresence.receipts.push('not-a-trigger'),
 ]){const bad=JSON.parse(wire);mutate(bad);assert.throws(()=>decodeSave(JSON.stringify(bad)));}
 let s=leave(pair);const stale=structuredClone(s.sectorStates[A]);stale.sectorId=B;stale.sourceMapId=B;s.sectorStates[B]=stale;assert.throws(()=>saved(s),/apariciones|residencia del parte/);
});

test('older authored saves retain their original fixed behavior; edited locations cannot bypass presence through an old adapter',()=>{
 const d=defaultContentPackage(),s=initialCampaign(42,d);s.contentCampaign.adapter='character-weapons-v2';delete s.contentPresence;
 assert.ok(encountersFor(saved(s).campaign,'retiro').some(n=>n.operativeId===3));
 const bad=JSON.parse(encodeSave(s));placement(bad.campaign.contentCampaign.package).sectors=[A];bad.campaign.contentCampaign.identity=contentIdentity(bad.campaign.contentCampaign.package);assert.throws(()=>decodeSave(JSON.stringify(bad)),/presencia/);
});

test('an actual hostile-sector assault deploys its authored resident and preserves it in a full active save',()=>{
 let s=ready(definition({sectors:['san_nicolas']}));
 secureArea(s,'buenos_aires');s=travel(s,'buenos_aires');
 s=order(s,{type:'attack',sector:'san_nicolas'});
 assert.equal(s.pendingBattle.wasRoyalist,true);
 assert.equal(s.pendingBattle.npcs.filter(n=>n.operativeId===3).length,1);
 const battle=enterSector(s.pendingBattle,s.sectorStates.san_nicolas);
 assert.ok(battle.units.some(u=>u.side==='enemy'&&u.hp>0),'the assault has actual hostile defenders');
 assert.equal(battle.npcs.filter(n=>n.operativeId===3).length,1);
 const restored=saved(s,battle);
 assert.equal(contact(restored.battle).contentId,'person-3');
 assert.equal(contact(restored.battle).presenceRevision,person(restored.campaign).revision);
 assert.equal(encountersFor(restored.campaign,'retiro').some(n=>n.operativeId===3),false);
});
