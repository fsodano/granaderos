import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_MILITIA_PATROL,MILITIA_PATROL_FIELDS,militiaPatrolRules} from '../game/militia-patrol-rules.js';
import {defaultContentPackage,validateContentPackage,encodeContentPackage,parseContentPackage} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {createBattle,actBattle,endTurn,movementEnergy} from '../game/tactical.js';
import {militiaPatrolOrder} from '../game/militia-patrol.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {order,saved,visit,sync,leave} from './local-contract-fixture.mjs';
const rules=values=>({...DEFAULT_MILITIA_PATROL,...values}),position=u=>[u.x,u.y];
function paid(config){const d=defaultContentPackage();d.rules.startingTreasury=20000;d.militiaPatrol=structuredClone(config);for(const at of ['buenos_aires','ensenada'])d.startingTerritory[at]={owner:'patriot',loyalty:65};let s=order(initialCampaign(42,d),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});s=order(s,{type:'militia',trainerId:1000,rank:0});s=order(s,{type:'wait',hours:s.militiaTraining[0].remaining});return {s,d};}
const field=(config,unit={})=>createBattle([{id:'m',militia:true,x:2,y:4,hp:40,maxHp:60,bandaged:20,energy:40,ap:100,weapon:1800,loaded:1,ammo:3,...unit}],{width:32,height:12,exploration:true,militiaPatrol:config,enemies:[],tiles:Array.from({length:384},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0}))});

test('patrol rules are strict optional portable data and preserve older campaign content identities',()=>{
 const d=defaultContentPackage(),old=initialCampaign(42,d),identity=old.contentCampaign.identity;assert.equal(d.militiaPatrol,undefined);assert.equal(saved({campaign:old}).campaign.contentCampaign.package.militiaPatrol,undefined);assert.deepEqual(saved({campaign:old}).campaign.contentCampaign.identity,identity);assert.deepEqual(militiaPatrolRules(old),DEFAULT_MILITIA_PATROL);
 d.militiaPatrol=rules({enabled:false,waypointTicks:60,energyReserve:0,restEnergy:100});assert.deepEqual(parseContentPackage(encodeContentPackage(d)),d);assert.deepEqual(campaignContentReport(d).blocked,[]);
 const invalid=[null,[],{}, {...d.militiaPatrol,extra:1},rules({enabled:0}),rules({enabled:'false'})];for(const [key,,min,max]of MILITIA_PATROL_FIELDS)for(const value of [min-1,max+1,1.5,'2',NaN,null])invalid.push(rules({[key]:value}));
 for(const value of invalid){const bad={...d,militiaPatrol:value};assert.ok(validateContentPackage(bad).length);assert.throws(()=>initialCampaign(42,bad));const b=field(value);assert.throws(()=>validateBattleSnapshot(b));}
});

test('authored reserve and recovery change actual patrol steps without healing, AP spending or ammunition refill',()=>{
 const b=field(rules({energyReserve:80,restEnergy:3})),n=actBattle(b,{type:'ambient'});assert.equal(n.lastError,null);assert.deepEqual(position(n.units[0]),position(b.units[0]));assert.equal(n.units[0].energy,43);assert.equal(n.elapsedSeconds,6);
 for(const key of ['hp','bandaged','ap','loaded','ammo','priming','condition','fatigue'])assert.equal(n.units[0][key],b.units[0][key],key);
 const low=field(rules({energyReserve:0,restEnergy:1})),moved=actBattle(low,{type:'ambient'});assert.notDeepEqual(position(moved.units[0]),position(low.units[0]));assert.equal(moved.units[0].energy,40-movementEnergy(low.units[0],moved.tiles.find(t=>t.x===moved.units[0].x&&t.y===moved.units[0].y)));
 assert.equal(actBattle(field(rules({energyReserve:95,restEnergy:100})),{type:'ambient'}).units[0].energy,100);
 assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(n))),{type:'ambient'}),actBattle(n,{type:'ambient'}));
});

test('authored waypoint intervals and disabled search govern ordinary decisions without hidden enemy input',()=>{
 const slow=field(rules({waypointTicks:60}),{x:17,y:5,energy:100});slow.turn=9;assert.equal(militiaPatrolOrder(slow,slow.units[0]),null);
 const fast=structuredClone(slow);fast.militiaPatrol.waypointTicks=8;assert.ok(militiaPatrolOrder(fast,fast.units[0]));fast.militiaPatrol.enabled=false;assert.equal(militiaPatrolOrder(fast,fast.units[0]),null);
 let b=field(rules({enabled:false}));const before=structuredClone(b.units);for(let i=0;i<12;i++)b=actBattle(b,{type:'ambient'});assert.deepEqual(b.units,before);assert.equal(b.elapsedSeconds,72);
});

test('actual paid garrisons retain authored stationary orders through normal visits, clock saves, return and new attack deployment',()=>{
 const config=rules({enabled:false,waypointTicks:11,energyReserve:70,restEnergy:4}),{s,d}=paid(config);let p=visit(s);assert.equal(p.battle.units.filter(u=>u.militia).length,3);assert.deepEqual(p.campaign.pendingBattle.militiaPatrol,config);assert.deepEqual(p.battle.militiaPatrol,config);d.militiaPatrol.enabled=true;d.militiaPatrol.restEnergy=99;
 const before=structuredClone(p.battle.units.filter(u=>u.militia));for(let i=0;i<8;i++){p.battle=actBattle(p.battle,{type:'ambient'});p=saved(sync(p));}
 assert.deepEqual(p.battle.units.filter(u=>u.militia),before);assert.equal(p.battle.elapsedSeconds,48);const returned=saved({campaign:leave(p)}).campaign;assert.deepEqual(returned.sectorStates.retiro.militiaPatrol,config);const next=visit(returned);assert.deepEqual(next.battle.militiaPatrol,config);
 let attack=order(returned,{type:'travel',sector:'buenos_aires'});attack=order(attack,{type:'attack',sector:'san_nicolas'});const entered=enterSector({...attack.pendingBattle,hour:attack.hour,secondOfHour:attack.secondOfHour??0});assert.deepEqual(saved({campaign:attack,battle:entered}).battle.militiaPatrol,config);
});

test('campaign reports and active or retained saves reject changed, removed and malformed patrol rules atomically',()=>{
 const {s}=paid(rules({energyReserve:70})),p=visit(s),original=structuredClone(p);
 for(const change of [b=>b.militiaPatrol.energyReserve=60,b=>delete b.militiaPatrol,b=>b.militiaPatrol={enabled:false}]){
  const wire=JSON.parse(encodeSave(p.campaign,p.battle));change(wire.battle);assert.throws(()=>decodeSave(JSON.stringify(wire)),/patrulla/);
  const request=JSON.parse(encodeSave(p.campaign,p.battle));change(request.campaign.pendingBattle);assert.throws(()=>decodeSave(JSON.stringify(request)),/patrulla/);
  const altered=structuredClone(p.battle);change(altered);const rejected=dispatchCampaign(p.campaign,{type:'leaveSector',battleId:p.campaign.pendingBattle.id,sectorState:altered,survivors:altered.units.filter(u=>u.side==='player')});assert.match(rejected.lastError,/patrulla/);delete rejected.lastError;const unchanged=structuredClone(p.campaign);delete unchanged.lastError;assert.deepEqual(rejected,unchanged);
  const retained=JSON.parse(encodeSave(leave(p)));change(retained.campaign.sectorStates.retiro);assert.throws(()=>decodeSave(JSON.stringify(retained)),/patrulla/);
 }
 assert.deepEqual(p,original);
});

test('disabling patrols keeps actual paid militia combat and finite reactions available',()=>{
 const {s}=paid(rules({enabled:false})),p=visit(s),r=p.campaign.pendingBattle;
 // Declared flat combat boundary using the actual issued people and weapons.
 const b=createBattle([...r.squad.map(u=>({...u,x:1,y:7})),...r.garrison.map((u,i)=>({...u,x:2,y:1+i}))],{...r,exploration:false,width:20,height:10,hour:12,props:[],tiles:Array.from({length:200},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:[{id:'raider',x:8,y:2,hp:100,maxHp:100,weapon:1813,blade:1813,patrol:false}]});
 const before=b.units.filter(u=>u.militia).reduce((n,u)=>n+u.loaded+u.ammo,0),next=endTurn(b);assert.equal(next.lastError,null);assert.ok(next.units.filter(u=>u.militia).reduce((n,u)=>n+u.loaded+u.ammo,0)<before,JSON.stringify(next.log));assert.equal(next.militiaPatrol.enabled,false);assert.ok(saved(sync({campaign:p.campaign,battle:next})));
});
