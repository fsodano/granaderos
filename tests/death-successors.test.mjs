import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {operativeIdForCharacter} from '../game/content-character-ids.js';
import {encountersFor,encounterContacts} from '../game/encounters.js';
import {createContentSession,advancePlacementState,changePlacementStatus} from '../game/content-placement.js';
import {actBattle,createBattle,endTurn,getReachable} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {secureArea} from './controlled-area-fixture.mjs';
const A='cell-27-27',B='cell-26-27',C='cell-25-27';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const save=({campaign,battle=null})=>decodeSave(encodeSave(campaign,battle));
const person=(s,id)=>s.contentPresence.people[id];
const numeric=(s,id)=>operativeIdForCharacter(s.contentCampaign.package,id);
const resident=(b,id)=>b.npcs.find(n=>n.contentId===id);
function authored(patch={}){
 const d=defaultContentPackage(),base=structuredClone(d.characters.find(c=>c.id==='person-100'));delete base.arrivalHours;
 for(const [id,name,maxHp,weapon]of [['pablo','Pablo',30,null],['sal','Sal',61,'firearm-1802']])d.characters.push({...structuredClone(base),id,name,nickname:name,monthlyPay:0,recruitmentSource:'encounter',service:'permanent',attributes:{...base.attributes,maxHp},weapon,abilities:[],traits:[],encounter:{recruitable:true,greeting:`Soy ${name}.`,requiredLeadership:0,requiredLiberated:0,requiredSector:null}});
 d.placements.push({id:'pablo-location',character:'pablo',mode:'fixed',sectors:[A],moveChance:100,afterDeath:null,delayMin:0,delayMax:0});
 d.placements.push({id:'sal-location',character:'sal',mode:'once',sectors:[B,C],moveChance:100,afterDeath:'pablo',delayMin:60,delayMax:120,...patch});
 d.characters.find(c=>c.id==='person-110').arrivalHours=0;return d;
}
function ready(d=authored()) {let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'month'});return order(s,{type:'travel',sector:A});}
const visit=s=>{const campaign=order(s,{type:'visitSector'});return {campaign,battle:enterSector({...campaign.pendingBattle,hour:campaign.hour},campaign.sectorStates[campaign.location])};};
const synced=p=>{const n=syncBattleTime(p.campaign,p.battle);assert.equal(n.error,null);return n;};
function act(p,action){p.battle=actBattle(p.battle,{unitId:'110',...action});assert.equal(p.battle.lastError,null);return synced(p);}
function approach(p,id='pablo'){const n=resident(p.battle,id),spot=getReachable(p.battle,'110').find(t=>Math.abs(t.x-n.x)+Math.abs(t.y-n.y)===1);assert.ok(spot);return spot.cost?act(p,{type:'move',x:spot.x,y:spot.y}):p;}
function kill(p,id='pablo'){p=approach(p,id);for(let i=0;i<6&&resident(p.battle,id).hp>0;i++)p=act(p,{type:'melee',targetId:resident(p.battle,id).id});assert.equal(resident(p.battle,id).hp,0);return p;}
const leave=p=>{p=synced(p);return order(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});};
const talk=(p,id)=>({type:'talkNPC',npcId:resident(p.battle,id).id,unitId:110,approach:'recruit',sectorState:p.battle});
function recruit(p,id){
 p=approach(p,id);const n=resident(p.battle,id),opId=numeric(p.campaign,id);p.campaign=order(p.campaign,talk(p,id));const op=p.campaign.pendingBattle.squad.find(o=>o.id===opId);
 p.battle.npcs=p.battle.npcs.filter(v=>v.id!==n.id);p.battle.units.push({...createBattle([op],{width:8,height:8,exploration:true,enemies:[]}).units[0],x:n.x,y:n.y});return save(p);
}

test('a real civilian death schedules one distinct successor and preserves the delay and draw through saves',()=>{
 let p=visit(ready());assert.equal(person(p.campaign,'sal').appeared,false);assert.ok(!encounterContacts(p.campaign).some(n=>n.contentId==='sal'));assert.ok(save(p));
 p=kill(p);const r=structuredClone(p.campaign.contentPresence),receipt=r.receipts[0];assert.equal(receipt.trigger,'pablo');assert.equal(receipt.placement,'sal-location');assert.ok(receipt.at-receipt.minute>=60&&receipt.at-receipt.minute<=120);
 assert.equal(r.events[0].at,receipt.at);assert.equal(person(p.campaign,'sal').hp,61);p=save(p);p=synced(p);assert.deepEqual(p.campaign.contentPresence,r);
 let replay=createContentSession(p.campaign.contentCampaign.package,42);replay=advancePlacementState(replay,receipt.minute,A);replay=changePlacementStatus(replay,'pablo','dead',A);assert.deepEqual(replay.events,r.events);assert.deepEqual(replay.receipts,r.receipts);assert.equal(replay.rng,r.rng);
 let s=leave(p);s=order(s,{type:'wait',hours:Math.ceil((receipt.at-s.contentPresence.minute)/60)});assert.equal(s.contentPresence.events.length,0);assert.equal(s.contentPresence.receipts.length,1);
 const at=person(s,'sal').sector;assert.ok([B,C].includes(at));s=save({campaign:s}).campaign;p=visit(order(s,{type:'travel',sector:at}));assert.equal(resident(p.battle,'sal').hp,61);assert.equal(resident(p.battle,'pablo'),undefined);
 p=recruit(p,'sal');const u=p.battle.units.find(u=>u.id===String(numeric(p.campaign,'sal')));assert.equal(u.hp,61);assert.equal(u.weaponMetadata.contentWeapon.id,'firearm-1802');assert.ok(!u.civilianHarm);assert.equal(p.campaign.civilianState.people[`person-${numeric(p.campaign,'pablo')}`].health.hp,0);assert.ok(save(p));
});

test('an immediate successor waits outside the loaded cell without rerolling and keeps the original body on entry',()=>{
 let p=kill(visit(ready(authored({mode:'fixed',sectors:[A],delayMin:0,delayMax:0}))));
 const r=structuredClone(p.campaign.contentPresence);assert.equal(r.events[0].destination,A);assert.equal(person(p.campaign,'sal').appeared,false);assert.equal(resident(p.battle,'sal'),undefined);
 p=save(p);p=act(p,{type:'ambient'});assert.equal(p.campaign.contentPresence.rng,r.rng);assert.deepEqual(p.campaign.contentPresence.events,r.events);
 let s=leave(p);assert.equal(person(s,'sal').appeared,true);assert.equal(s.contentPresence.events.length,0);p=visit(save({campaign:s}).campaign);
 assert.equal(resident(p.battle,'pablo').hp,0);assert.equal(resident(p.battle,'sal').hp,61);p=kill(p,'sal');s=leave(p);s=order(s,{type:'wait',hours:24});p=visit(save({campaign:s}).campaign);
 assert.equal(resident(p.battle,'pablo').hp,0);assert.equal(resident(p.battle,'sal').hp,0);assert.equal(p.campaign.contentPresence.receipts.length,1);assert.equal(p.campaign.contentPresence.events.length,0);assert.ok(save(p));
});

test('a daily successor starts its own routine after activation and carries its wounds into later cells',()=>{
 let p=kill(visit(ready(authored({mode:'daily',sectors:[B,C],selection:'alternate',delayMin:0,delayMax:0}))));
 let s=leave(p);s=order(s,{type:'travel',sector:person(s,'sal').sector});if(s.location!==person(s,'sal').sector)s=order(s,{type:'travel',sector:person(s,'sal').sector});const first=s.location;p=approach(visit(s),'sal');
 p=act(p,{type:'melee',targetId:resident(p.battle,'sal').id});p=act(p,{type:'heal',targetId:resident(p.battle,'sal').id});const hp=resident(p.battle,'sal').hp;assert.ok(hp>0&&hp<61);
 s=leave(p);s=order(s,{type:'wait',hours:Math.ceil((s.contentPresence.nextDaily-s.contentPresence.minute)/60)});const next=person(s,'sal').sector;assert.notEqual(next,first);assert.ok(!s.sectorStates[first].npcs.some(n=>n.contentId==='sal'));
 p=visit(order(save({campaign:s}).campaign,{type:'travel',sector:next}));assert.equal(resident(p.battle,'sal').hp,hp);assert.equal(p.campaign.contentPresence.receipts.length,1);assert.ok(save(p));
});

test('successor admission rejects missing or forged receipts, timers, destinations and premature appearances',()=>{
 const p=kill(visit(ready())),wire=encodeSave(p.campaign,p.battle);
 for(const mutate of [v=>v.campaign.contentPresence.receipts=[],v=>v.campaign.contentPresence.receipts.push(v.campaign.contentPresence.receipts[0]),v=>v.campaign.contentPresence.receipts[0].trigger='person-3',v=>v.campaign.contentPresence.receipts[0].minute++,v=>v.campaign.operativeState[numeric(v.campaign,'pablo')].deathMinute++,v=>v.campaign.contentPresence.events[0].at++,v=>v.campaign.contentPresence.events[0].destination=A,v=>v.campaign.contentPresence.events=[],v=>v.campaign.contentPresence.people.sal.appeared=true]){const v=JSON.parse(wire);mutate(v);assert.throws(()=>decodeSave(JSON.stringify(v)));}
 const initial=initialCampaign(42,authored());initial.contentPresence.people.sal.appeared=true;initial.contentPresence.people.sal.revision=1;initial.contentPresence.people.sal.sector=B;assert.throws(()=>save({campaign:initial}));
 const cycle=authored();cycle.placements.find(p=>p.character==='pablo').afterDeath='sal';assert.throws(()=>initialCampaign(42,cycle),/ciclo/);
});

test('death during military service activates the same successor without restoring the former NPC',()=>{
 let p=recruit(visit(ready(authored({delayMin:0,delayMax:0}))), 'pablo'),s=leave(p),id=numeric(s,'pablo');secureArea(s,'buenos_aires');
 s=order(s,{type:'travel',sector:'retiro'});s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});const request=s.pendingBattle;
 let b=createBattle(request.squad.map(u=>({...u,x:1,y:u.id===id?1:6})),{width:12,height:8,id:request.id,sector:request.sector,npcs:request.npcs,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),enemies:[{id:'guard',x:7,y:1,weapon:1802,ammo:0,fatigue:100,marksmanship:100}]});
 b=endTurn(b);assert.equal(b.units.find(u=>u.id===String(id)).hp,0);p=synced({campaign:s,battle:b});assert.equal(person(p.campaign,'sal').appeared,true);p=save(p);assert.equal(p.campaign.operativeState[id].alive,false);
 const forged=JSON.parse(encodeSave(p.campaign,p.battle));forged.battle.units.find(u=>u.id===String(id)).hp=1;assert.throws(()=>decodeSave(JSON.stringify(forged)));
 const revived=p.battle.units.filter(u=>u.side==='player').map(u=>u.id===String(id)?{...u,hp:1}:u);assert.match(dispatchCampaign(p.campaign,{type:'battleResult',battleId:request.id,outcome:'retreat',sectorState:p.battle,survivors:revived}).lastError,/muerte confirmada/);
 s=order(p.campaign,{type:'battleResult',battleId:request.id,outcome:'retreat',sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')});assert.equal(s.operativeState[id].alive,false);assert.equal(person(s,'sal').appeared,true);assert.equal(s.contentPresence.receipts.length,1);assert.ok(!encountersFor(s,A).some(n=>n.contentId==='pablo'));assert.ok(save({campaign:s}));
});

test('a batched tactical checkpoint starts the delay at confirmed death time, after its elapsed hours',()=>{
 let p=approach(visit(ready())),n=resident(p.battle,'pablo');
 p.battle=actBattle(p.battle,{type:'melee',unitId:'110',targetId:n.id});assert.equal(p.battle.lastError,null);assert.equal(resident(p.battle,'pablo').hp,0);
 for(let i=0;i<12;i++){p.battle=actBattle(p.battle,{type:'rest',unitId:'110'});assert.equal(p.battle.lastError,null);}
 p=synced(p);const r=p.campaign.contentPresence,receipt=r.receipts[0];assert.equal(receipt.minute,r.minute);assert.ok(receipt.at>=r.minute+60);assert.equal(person(p.campaign,'sal').appeared,false);assert.ok(save(p));
});

test('a successor chain activates each new identity once and preserves both earlier bodies',()=>{
 const d=authored({mode:'fixed',sectors:[B],delayMin:0,delayMax:0}),sal=d.characters.find(c=>c.id==='sal');
 d.characters.push({...structuredClone(sal),id:'carlos',name:'Carlos',nickname:'Carlos',attributes:{...sal.attributes,maxHp:83},encounter:{...sal.encounter,greeting:'Soy Carlos.'}});
 d.placements.push({id:'carlos-location',character:'carlos',mode:'fixed',sectors:[A],moveChance:100,afterDeath:'sal',delayMin:0,delayMax:0});
 let p=kill(visit(ready(d))),s=leave(p);assert.equal(person(s,'sal').appeared,true);assert.equal(person(s,'carlos').appeared,false);
 p=kill(visit(order(s,{type:'travel',sector:B})),'sal');assert.equal(person(p.campaign,'carlos').appeared,true);s=leave(save(p));p=visit(order(s,{type:'travel',sector:A}));
 assert.equal(resident(p.battle,'pablo').hp,0);assert.equal(resident(p.battle,'carlos').hp,83);assert.equal(p.campaign.sectorStates[B].npcs.find(n=>n.contentId==='sal').hp,0);assert.equal(p.campaign.contentPresence.receipts.length,2);assert.equal(p.campaign.contentPresence.events.length,0);assert.ok(save(p));
});
