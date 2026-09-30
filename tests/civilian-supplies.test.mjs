import test from 'node:test';import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {createBattle,actBattle,getReachable} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {civilianSuppliesFor} from '../game/civilian-supplies.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {missionContacts,sanLorenzoAlly} from '../game/missions.js';
import {enterSector} from '../game/world.js';
import {secureArea} from './controlled-area-fixture.mjs';
import {order,saved,visit,leave,tactical,localPackage,localNPC,localId,hireLocal,sync,A} from './local-contract-fixture.mjs';
const B='cell-26-27',person=(d,id)=>d.characters.find(c=>c.id===`person-${id}`);
const stock={rations:3,torches:2,medkits:7,boleadoras:1};
function content({daily=false,critical=true}={}){const d=localPackage();d.characters.at(-1).startingSupplies={...stock};if(critical)d.characters.at(-1).startingCondition={hp:1,energy:100,fatigue:0,bleeding:0,bandaged:0};person(d,110).attributes.medical=80;person(d,110).startingSupplies=Object.fromEntries(Object.keys(stock).map(k=>[k,0]));if(daily)Object.assign(d.placements.at(-1),{mode:'daily',sectors:[A,B],selection:'alternate'});return d;}
function approach(p){const n=localNPC(p.battle),u=p.battle.units.find(u=>u.side==='player'),spot=getReachable(p.battle,u).find(t=>Math.abs(t.x-n.x)+Math.abs(t.y-n.y)===1);assert.ok(spot);return spot.cost?tactical(p,{type:'move',unitId:u.id,x:spot.x,y:spot.y}):p;}
function ready(d=content()){let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'month'});s=order(s,{type:'travel',sector:s.contentPresence.people['alma-contract'].sector});return approach(visit(s));}
const loot=(p,extra={})=>tactical(p,{type:'loot',targetId:localNPC(p.battle).id,...extra});

test('actual recovery transfers finite authored supplies, funds first aid and persists through daily movement, recruitment and return',()=>{
 let p=ready(content({daily:true})),id=localId(p.campaign);assert.deepEqual(localNPC(p.battle).civilianSupplies,{version:1,...stock});assert.equal(p.battle.units[0].medkits,0);
 p=loot(p,{item:'medkits',count:2});assert.equal(localNPC(p.battle).civilianSupplies.medkits,5);assert.equal(p.battle.units[0].medkits,2);p=saved(p);assert.equal(p.campaign.operativeState[id].medkits,5);
 p=loot(p);assert.equal(p.battle.units[0].medkits,7);assert.ok(Object.entries(localNPC(p.battle).civilianSupplies).every(([k,v])=>k==='version'||v===0));
 const failed=actBattle(p.battle,{type:'loot',unitId:'110',targetId:localNPC(p.battle).id});assert.ok(failed.lastError);assert.deepEqual(failed.units,p.battle.units);
 for(let i=0;i<2;i++)p=tactical(saved(p),{type:'heal',targetId:localNPC(p.battle).id});assert.equal(localNPC(p.battle).hp,15);assert.equal(p.battle.units[0].medkits,5);
 let s=leave(p),old=s.location;s=order(s,{type:'wait',hours:Math.ceil((s.contentPresence.nextDaily-s.contentPresence.minute)/60)});const next=s.contentPresence.people['alma-contract'].sector;assert.notEqual(next,old);s=order(saved({campaign:s}).campaign,{type:'travel',sector:next});p=approach(visit(s));assert.equal(localNPC(p.battle).civilianSupplies.medkits,0);assert.equal(p.battle.units[0].medkits,5);
 p=hireLocal(p);assert.equal(p.battle.units.find(u=>Number(u.id)===id).medkits,0);s=order(leave(p),{type:'dismiss',id});p=visit(saved({campaign:s}).campaign);assert.deepEqual(localNPC(p.battle).civilianSupplies,civilianSuppliesFor(Object.fromEntries(Object.keys(stock).map(k=>[k,0]))));assert.equal(p.battle.units[0].medkits,5);assert.ok(saved(p));
});

test('a looted body keeps its empty stock while a death successor receives only its own distinct allocation',()=>{
 const d=content(),successor=structuredClone(d.characters.at(-1));successor.id='alma-successor';successor.name='Sucesora';successor.startingSupplies={...stock,medkits:3};delete successor.startingCondition;d.characters.push(successor);d.placements.push({...d.placements[0],id:'successor-place',character:successor.id,mode:'fixed',sectors:[A],afterDeath:'alma-contract',delayMin:0,delayMax:0});
 let p=ready(d);p=tactical(p,{type:'melee',targetId:localNPC(p.battle).id});assert.equal(localNPC(p.battle).hp,0);p=loot(p);assert.equal(p.battle.units[0].medkits,7);assert.equal(localNPC(p.battle).civilianSupplies.medkits,0);p=saved(p);let s=leave(p);p=visit(saved({campaign:s}).campaign);
 const next=p.battle.npcs.find(n=>n.contentId===successor.id);assert.ok(next);assert.equal(next.civilianSupplies.medkits,3);assert.equal(localNPC(p.battle).hp,0);assert.equal(localNPC(p.battle).civilianSupplies.medkits,0);assert.equal(p.battle.units[0].medkits,7);assert.ok(saved(p));
});

test('saved stocks reject grants and malformed quantities, while missing legacy projections use remaining canonical stock',()=>{
 let p=loot(ready(),{item:'medkits',count:2});p=saved(p);const wire=encodeSave(p.campaign,p.battle);
 for(const mutate of [n=>n.civilianSupplies.medkits++,n=>n.civilianSupplies.medkits=-1,n=>n.civilianSupplies.medkits='5',n=>n.civilianSupplies.version=2,n=>delete n.civilianSupplies.torches,n=>n.civilianSupplies.weapon=1801]){const v=JSON.parse(wire);mutate(localNPC(v.battle));assert.throws(()=>decodeSave(JSON.stringify(v)));}
 const forged=structuredClone(p.battle);localNPC(forged).civilianSupplies.medkits++;assert.ok(dispatchCampaign(p.campaign,{type:'syncTacticalTime',battleId:p.campaign.pendingBattle.id,elapsedSeconds:forged.elapsedSeconds,sectorState:forged}).lastError);
 const old=JSON.parse(wire);for(const scene of [...Object.values(old.campaign.sectorStates),...Object.values(old.campaign.sceneStates),old.campaign.pendingBattle,old.battle])for(const n of scene.npcs??[])delete n.civilianSupplies;
 p=decodeSave(JSON.stringify(old));assert.equal(localNPC(p.battle).civilianSupplies.medkits,5);assert.equal(p.battle.units[0].medkits,2);assert.equal(p.campaign.operativeState[localId(p.campaign)].medkits,5);assert.ok(saved(p));
});

const field=(npc={},doctor={})=>createBattle([{id:'doc',x:1,y:1,medkits:0,...doctor}],{width:8,height:8,enemies:[{id:'enemy',x:7,y:7,patrol:false,overwatch:false}],npcs:[{id:'resident',name:'Vecina',x:2,y:1,hp:1,energy:100,civilianSupplies:{version:1,...stock},...npc}]});
const take=(b,a={})=>actBattle(b,{type:'loot',unitId:'doc',targetId:'resident',...a});
test('civilian looting uses ordinary range and AP, validates quantity, preserves capacity and rejects conscious or departed residents',()=>{
 const b=field(),n=take(b,{item:'medkits',count:2});assert.equal(n.lastError,null);assert.equal(n.units[0].ap,b.units[0].ap-8);assert.equal(n.units[0].medkits,2);assert.equal(n.npcs[0].civilianSupplies.medkits,5);assert.ok(validateBattleSnapshot(n));
 for(const a of [{count:-1},{count:1.5},{count:0},{item:'weapon'},{item:'ammo'}]){const denied=take(b,a);assert.ok(denied.lastError);assert.deepEqual(denied.units,b.units);assert.deepEqual(denied.npcs,b.npcs);}
 for(const before of [field({hp:100}),field({departure:true}),field({x:5,y:5}),field({civilianSupplies:undefined}),field({}, {medkits:1000000})]){const denied=take(before,{item:'medkits'});assert.ok(denied.lastError);assert.deepEqual(denied.units,before.units);assert.deepEqual(denied.npcs,before.npcs);}
 const low=field();low.units[0].ap=7;assert.ok(take(low).lastError);assert.equal(low.npcs[0].civilianSupplies.medkits,7);
 const capped=take(field({}, {medkits:999999}),{item:'medkits'});assert.match(capped.lastError,/bolsillo/);assert.equal(capped.units[0].medkits,999999);assert.equal(capped.npcs[0].civilianSupplies.medkits,7);assert.ok(validateBattleSnapshot(capped));
});

test('the real temporary commander stock reaches its shared identity and later mission contact without a default refill',()=>{
 // Prepared controlled approach isolates the existing named mission ally.
 let s=order(secureArea(initialCampaign(8,defaultContentPackage()),'buenos_aires','san_nicolas'),{type:'createOfficer',name:'Isabel',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});s=order(s,{type:'travel',sector:'san_nicolas'});s=order(s,{type:'attack',sector:'san_lorenzo'});
 let p=saved(sync({campaign:s,battle:enterSector({...s.pendingBattle,hour:s.hour})})),u=p.battle.units.find(u=>u.missionAlly&&u.id==='57');assert.equal(u.medkits,0);assert.equal(p.campaign.operativeState[57].medkits,0);assert.equal(p.campaign.operativeState[57].missionSuppliesVersion,1);
 const step=getReachable(p.battle,u).find(t=>t.cost>0);assert.ok(step);p=tactical(p,{type:'move',unitId:'57',x:step.x,y:step.y});p=tactical(p,{type:'ration',unitId:'57'});p=saved(p);assert.equal(p.battle.units.find(u=>u.id==='57').rations,0);assert.equal(p.campaign.operativeState[57].rations,0);
 const contact=missionContacts(p.campaign).find(n=>n.id==='yatasto-san-martin');assert.equal(contact.civilianSupplies.medkits,0);assert.equal(contact.civilianSupplies.rations,0);assert.ok(saved(p));
});

test('authored and previously collected resident supplies remain finite when that identity becomes the mission ally',()=>{
 const d=defaultContentPackage(),c=person(d,57);c.startingSupplies={...stock};c.startingCondition={hp:1,energy:100,fatigue:0,bleeding:0,bandaged:0};Object.assign(d.placements.find(p=>p.character===c.id),{mode:'fixed',sectors:['retiro']});person(d,110).arrivalHours=0;person(d,110).attributes.medical=80;person(d,110).startingSupplies=Object.fromEntries(Object.keys(stock).map(k=>[k,0]));
 let s=initialCampaign(42,d);assert.equal(sanLorenzoAlly(s).medkits,7);s=order(s,{type:'recruitCivic',id:110,term:'month'});let p=visit(s);const n=p.battle.npcs.find(n=>n.operativeId===57);for(let i=0;i<12;i++){const target=p.battle.npcs.find(x=>x.id===n.id),u=p.battle.units[0];if(Math.hypot(u.x-target.x,u.y-target.y)<=1.5)break;const spot=getReachable(p.battle,u).filter(t=>Math.abs(t.x-target.x)+Math.abs(t.y-target.y)===1).sort((a,b)=>a.cost-b.cost)[0];assert.ok(spot);p=tactical(p,{type:'move',x:spot.x,y:spot.y});}p=tactical(p,{type:'loot',targetId:n.id});
 for(let i=0;i<2;i++)p=tactical(p,{type:'heal',targetId:n.id});s=saved({campaign:leave(p)}).campaign;for(const k of Object.keys(stock))assert.equal(sanLorenzoAlly(s)[k],0,k);assert.equal(sanLorenzoAlly(s).weapon,0);assert.equal(sanLorenzoAlly(s).blade,0);
 // Prepared territorial approach isolates the actual subsequent role transition.
 s=secureArea(s,'buenos_aires','san_nicolas');s=order(s,{type:'travel',sector:'san_nicolas'});s=order(s,{type:'attack',sector:'san_lorenzo'});p=saved(sync({campaign:s,battle:enterSector({...s.pendingBattle,hour:s.hour})}));const ally=p.battle.units.find(u=>u.missionAlly&&u.id==='57');assert.ok(ally);assert.equal(ally.weapon,0);assert.equal(ally.blade,0);for(const k of Object.keys(stock))assert.equal(ally[k],0,k);assert.ok(saved(p));
});
