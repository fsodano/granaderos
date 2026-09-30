import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,canSee,initializeBattlePerception} from '../game/tactical.js';
import {beginSectorDeployment,sectorDeploymentModel,validateSectorDeployment} from '../game/sector-deployment.js';
import {enterSector} from '../game/world.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {unitCanAct} from '../game/ja2-hud.js';
import {boundaryMatches} from '../game/tactical-exits.js';

const grid=(width,height)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
function staged(count=2,extra={}){
 const squad=Array.from({length:count},(_,i)=>({id:`p${i}`,name:`Soldado ${i}`,x:0,y:2+i,weapon:1805,loaded:1,ammo:3,entryReason:'arrival',entryEdge:'W',entryAnchor:{x:0,y:8},...extra.unit}));
 const request={squad,...extra.request};
 const b=createBattle(squad,{width:24,height:16,tiles:grid(24,16),seed:45,exploration:true,deferContact:true,enemies:[{id:'e',name:'Nombre secreto',x:22,y:10,patrol:false,overwatch:false}],...extra.sector});
 assert.equal(beginSectorDeployment(b,request),true);return b;
}
const act=(s,a)=>{const n=actBattle(s,a);assert.equal(n.lastError,null,n.lastError);assert.doesNotThrow(()=>validateBattleSnapshot(n));return n;};
const place=(s,ids,x=0,y=5)=>act(s,{type:'placeDeployment',unitIds:ids,x,y});
const restore=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
const unchanged=(s,n)=>assert.deepEqual({...n,lastError:null},{...s,lastError:null});

test('arrival markers are drafts: placement, clearing and spreading never move actors or spend time, supplies or RNG',()=>{
 const s=staged(),before=structuredClone(s);assert.equal(sectorDeploymentModel(s).remaining,2);
 let n=place(s,['p0','p1']);assert.deepEqual(n.deployment.placements,{p0:{x:0,y:5},p1:{x:0,y:4}});assert.deepEqual(n.units,s.units);
 n=act(n,{type:'clearDeployment',unitIds:['p0']});assert.deepEqual(n.deployment.placements,{p1:{x:0,y:4}});
 n=act(n,{type:'spreadDeployment'});assert.equal(sectorDeploymentModel(n).ready,true);assert.notEqual(n.deployment.placements.p0.y,n.deployment.placements.p1.y);
 assert.deepEqual({...n,deployment:s.deployment},s);assert.deepEqual(s,before);
});

test('only the real approach edge is legal and a failed group placement rolls back every marker',()=>{
 const s=place(staged(),['p0']);
 for(const a of [{unitIds:['p1'],x:23,y:5},{unitIds:['p1'],x:4,y:5},{unitIds:['e'],x:0,y:5},{unitIds:['p0','p0'],x:0,y:5},{unitIds:[],x:0,y:5},{unitIds:['p1'],x:0,y:5.5}]){
  const rejected=actBattle(s,{type:'placeDeployment',...a});assert.ok(rejected.lastError);unchanged(s,rejected);
 }
 const blocked=staged();Object.assign(blocked.tiles.find(t=>t.x===0&&t.y===5),{blocked:true,type:'water'});const rejected=actBattle(blocked,{type:'placeDeployment',unitIds:['p0','p1'],x:0,y:5});assert.ok(rejected.lastError);unchanged(blocked,rejected);
});

test('garrison, residents, mission allies and corpses are fixed and never appear among arrivals',()=>{
 const s=staged();
 for(const patch of [{id:'resident',entryReason:'resident'},{id:'militia',militia:true},{id:'commander',missionAlly:true},{id:'body',hp:0,unconscious:true}])s.units.push({...structuredClone(s.units[0]),...patch,x:8+s.units.length,y:12});
 const model=sectorDeploymentModel(s);assert.deepEqual(model.units.map(u=>u.id),['p0','p1']);
 for(const id of ['resident','militia','commander','body']){const n=actBattle(s,{type:'placeDeployment',unitIds:[id],x:0,y:5});assert.ok(n.lastError);unchanged(s,n);}
});

test('combat, inventory, end-turn and time orders stay blocked throughout placement',()=>{
 const s=staged();
 for(const type of ['move','fire','firePoint','reload','rest','explore','advanceExploration','weapon','pickupEquipment','exit']){
  const n=actBattle(s,{type,unitId:'p0',x:1,y:2,targetId:'e'});assert.ok(n.lastError);unchanged(s,n);
 }
 assert.ok(endTurn(s).lastError);unchanged(s,endTurn(s));assert.equal(unitCanAct(s,s.units[0]),false);assert.equal(canSee(s,s.units[0],s.units[1]),false);assert.equal(initializeBattlePerception(s),s);
 const early=actBattle(s,{type:'confirmDeployment'});assert.ok(early.lastError);unchanged(s,early);
});

test('preview and placement results do not reveal hidden occupants, supplies, identities or current sight',()=>{
 const s=staged(),other=structuredClone(s);Object.assign(other.units[2],{x:0,y:5,name:'Otro secreto',ammo:999,inventory:{secret:{count:1,weight:1}}});
 other.npcs=[{id:'private',name:'Vecino secreto',x:0,y:6}];
 assert.deepEqual(sectorDeploymentModel(s),sectorDeploymentModel(other));assert.deepEqual(playerKnownBattle(s),playerKnownBattle(other));
 const a=place(s,['p0','p1']),b=place(other,['p0','p1']);assert.deepEqual(a.deployment,b.deployment);assert.deepEqual(playerKnownBattle(a),playerKnownBattle(b));
 assert.doesNotMatch(JSON.stringify(playerKnownBattle(b)),/secreto|"ammo"|lastKnownEnemy|"seed"/);assert.deepEqual(playerKnownBattle(b).orders,[]);
});

test('final commitment resolves hidden occupancy once on the correct edge and cannot be reopened',()=>{
 let s=staged();Object.assign(s.units[2],{x:0,y:5,stance:'prone',movementMode:'prone',facing:2,ap:0});s=place(s,['p0','p1']);
 const n=act(s,{type:'confirmDeployment'});assert.equal(n.deployment,undefined);assert.equal(n.deploymentComplete,true);
 assert.equal(n.units[0].x,0);assert.notEqual(n.units[0].y,5);assert.equal(new Set(n.units.map(u=>`${u.x},${u.y}`)).size,n.units.length);
 assert.equal(beginSectorDeployment(n,{squad:n.units.filter(u=>u.side==='player')}),false);
 const moved=actBattle(n,{type:'placeDeployment',unitIds:['p0'],x:0,y:10});assert.ok(moved.lastError);assert.deepEqual(moved.units,n.units);
});

test('complete and partial marker sets survive JSON restoration and produce identical committed encounters',()=>{
 let s=place(staged(),['p0']);const partial=restore(s);assert.deepEqual(partial,s);s=place(s,['p1'],0,12);
 const n=act(s,{type:'confirmDeployment'}),r=act(place(partial,['p1'],0,12),{type:'confirmDeployment'});assert.deepEqual(r,n);assert.deepEqual(n.units.filter(u=>u.side==='player').map(u=>({x:u.x,y:u.y})),[{x:0,y:5},{x:0,y:12}]);
});

test('invalid saved placements reject wrong edges, duplicate cells, missing participants, stale clocks and role changes',()=>{
 const s=place(staged(),['p0','p1']);
 for(const alter of [b=>b.deployment.placements.p0.x=2,b=>b.deployment.placements.p1={...b.deployment.placements.p0},b=>b.deployment.units.pop(),b=>b.deployment.units[0].edge='N',b=>b.deployment.placements.e={x:0,y:2},b=>b.elapsedSeconds=1,b=>b.turn=2,b=>b.phase='enemy',b=>b.mode='combat',b=>b.deploymentComplete=true,b=>b.units[0].militia=true,b=>b.deployment.extra=true]){
  const bad=structuredClone(s);alter(bad);assert.throws(()=>restore(bad));
 }
});

test('spread supports all 48 arriving soldiers and preserves separate authorized edges',()=>{
 const squad=Array.from({length:48},(_,i)=>({id:`p${i}`,name:`Soldado ${i}`,x:i%24,y:Math.floor(i/24),entryReason:'arrival',entryEdge:i<24?'N':'S',entryAnchor:{x:8,y:i<24?0:15}}));
 const b=createBattle(squad,{width:64,height:48,tiles:grid(64,48),exploration:true,deferContact:true,enemies:[]});assert.equal(beginSectorDeployment(b,{squad}),true);
 const s=act(b,{type:'spreadDeployment'});assert.equal(sectorDeploymentModel(s).remaining,0);assert.equal(new Set(Object.values(s.deployment.placements).map(p=>`${p.x},${p.y}`)).size,48);
 for(const row of s.deployment.units)assert.ok(boundaryMatches(s,s.deployment.placements[row.id],row.edge));
 const mixed=actBattle(s,{type:'placeDeployment',unitIds:['p0','p24'],x:0,y:0});assert.ok(mixed.lastError);unchanged(s,mixed);
});

test('defense cover follows confirmed arrivals, preserves residents and binds the saved fort value to its request',()=>{
 const squad=[{id:'arriving',name:'Defensor que llega',weapon:1805,entryReason:'arrival',entryEdge:'W',entryAnchor:{x:0,y:8}},{id:'resident',name:'Defensor residente',weapon:1805,entryReason:'resident'}];
 const request={id:'defense-placement',sector:'cordoba',name:'Defensa de Córdoba',seed:17,defenseGroupId:'fort-review',defenseFort:3,squad,enemies:[]};
 const previous=createBattle(squad.map((u,i)=>({...u,x:i?5:0,y:i?5:8})),{width:20,height:16,tiles:grid(20,16),exploration:true,deferContact:true,enemies:[]});
 previous.tiles.find(t=>t.x===5&&t.y===5).cover=40;
 const initial=enterSector(request,previous,{placement:true}),old=initial.units.find(u=>u.id==='arriving'),oldPoint={x:old.x,y:old.y},cover=(b,p)=>b.tiles.find(t=>t.x===p.x&&t.y===p.y).cover;
 assert.equal(initial.deployment.defenseFort,3);assert.equal(cover(initial,oldPoint),0);assert.equal(cover(initial,{x:5,y:5}),40);
 let draft=act(initial,{type:'placeDeployment',unitIds:['arriving'],x:0,y:1});assert.equal(cover(draft,{x:0,y:1}),0);assert.equal(cover(draft,oldPoint),0);
 draft=restore(draft);assert.doesNotThrow(()=>validateSectorDeployment(draft,request));
 for(const change of [b=>b.deployment.defenseFort=2,b=>delete b.deployment.defenseFort]){const bad=structuredClone(draft);change(bad);assert.throws(()=>validateSectorDeployment(bad,request),/fortificación/);}
 assert.throws(()=>validateSectorDeployment(draft,{...request,defenseFort:0}),/fortificación/);assert.throws(()=>validateSectorDeployment(draft,{...request,defenseGroupId:undefined}),/fortificación/);
 const invalid=structuredClone(draft);invalid.deployment.defenseFort=4;assert.throws(()=>restore(invalid));
 const final=act(draft,{type:'confirmDeployment'});assert.equal(cover(final,{x:0,y:1}),30);assert.equal(cover(final,oldPoint),0);assert.equal(cover(final,{x:5,y:5}),40);assert.equal(final.deployment,undefined);
 const ordinary=enterSector(request,previous);assert.equal(ordinary.deployment,undefined);assert.equal(cover(ordinary,oldPoint),30);assert.equal(cover(ordinary,{x:5,y:5}),40);
});
