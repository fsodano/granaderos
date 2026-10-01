import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,ARTILLERY,artilleryContact,artilleryCrewPlan,artilleryShotTrace,canSee,getReachable} from '../game/tactical.js';
import {chooseArtilleryAction,holdsArtilleryPost} from '../game/tactical-ai-artillery.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {artilleryField as field} from './artillery-autonomy-fixture.mjs';
const crewOf=b=>b.units.filter(u=>u.id.startsWith('crew-'));
const position=u=>({x:u.x,y:u.y});
const choose=(b,id='crew-1',targets)=>{const u=b.units.find(u=>u.id===id);return chooseArtilleryAction({...b,phase:u.side},u,targets??b.units.filter(v=>v.side!==u.side&&canSee(b,u,v)));};
const restored=b=>validateBattleSnapshot(JSON.parse(JSON.stringify(b)));

test('each enemy cannon model fires during a real turn and spends only its finite load and reserve',()=>{
 for(const type of Object.keys(ARTILLERY)){
  const b=field({type}),n=endTurn(b);assert.equal(n.lastError,null,type);assert.ok(n.units.find(u=>u.id==='target').hp<300,type);assert.ok(n.log.some(s=>s.includes('dispara una bala rasa')),type);
  assert.ok(Number(n.artillery[0].loaded)+n.artillery[0].ammo<3,type);assert.equal(n.artillery[0].side,'enemy');assert.ok(crewOf(n).every(u=>u.ap>=0&&u.ap<=100));assert.ok(restored(n));
 }
});

test('heavy helpers receive one AP issue per enemy phase and save partial work over real rounds',()=>{
 let b=field({loaded:false,hidden:true,crew:{fatigue:90}});const start=structuredClone(b);
 b=endTurn(b);assert.equal(b.artillery[0].ammo,2);assert.equal(b.artillery[0].loaded,false);assert.equal(b.artillery[0].reloadProgress,42/75);assert.ok(crewOf(b).every(u=>u.ap===0&&u.maxAP===42));
 const n=endTurn(b),saved=endTurn(restored(b));assert.deepEqual(saved,n);assert.equal(n.artillery[0].loaded,true);assert.equal(n.artillery[0].ammo,1);assert.equal(n.artillery[0].reloadProgress,undefined);assert.ok(crewOf(n).every(u=>u.ap===9));
 assert.ok(crewOf(n).every(u=>42+42-u.ap===75));assert.deepEqual(start.artillery[0],field({loaded:false,hidden:true,crew:{fatigue:90}}).artillery[0]);
 // Two rounds without contact return to exploration; resting does not issue a new enemy combat budget.
 assert.equal(n.mode,'exploration');const held=endTurn(n);assert.equal(held.artillery[0].ammo,1);assert.ok(crewOf(held).every(u=>u.ap===9));assert.deepEqual(crewOf(held).map(position),crewOf(start).map(position));
});

test('already spent reaction AP reduces every crew member before shared loading',()=>{
 const b=field({loaded:false,hidden:true});for(const u of crewOf(b)){u.reactionSpent=70;u.ap=30;}
 const n=endTurn(b);assert.equal(n.artillery[0].reloadProgress,30/75);assert.equal(n.artillery[0].ammo,2);assert.ok(crewOf(n).every(u=>u.ap===0&&u.reactionSpent===0));
});

test('militia operate their own crew without using a hired soldier and reject direct cannon orders',()=>{
 const b=field({side:'player',type:'bronze4'}),officer=b.units.find(u=>u.id==='officer'),original=structuredClone(officer);
 for(const type of ['artillery','artilleryReload','artilleryPivot','artilleryMove']){const denied=actBattle(b,{type,unitId:'crew-1',artilleryId:'gun',x:11,y:3});assert.match(denied.lastError,/milicia.*actúa/);assert.deepEqual(denied.artillery,b.artillery);assert.deepEqual(denied.units,b.units);}
 const n=endTurn(b);assert.equal(n.lastError,null);assert.ok(n.units.find(u=>u.id==='target').hp<300);assert.ok(n.log.some(s=>s.includes('dispara una bala rasa')));for(const key of ['hp','loaded','ammo','priming','x','y'])assert.equal(n.units.find(u=>u.id==='officer')[key],original[key],key);const nextOfficer=n.units.find(u=>u.id==='officer');assert.equal(nextOfficer.carriedAP,20);assert.equal(nextOfficer.ap,nextOfficer.maxAP+20);assert.ok(restored(n));
 const short=structuredClone(b);short.units.find(u=>u.id==='crew-2').militia=false;assert.equal(choose(short),null);assert.equal(choose(short,'crew-2'),null);
});

test('a militia crew uses remaining AP rather than receiving a second budget for its phase',()=>{
 const b=field({side:'player',loaded:false,hidden:true});for(const u of crewOf(b))u.ap=21;
 const n=endTurn(b);assert.equal(n.artillery[0].reloadProgress,21/75);assert.equal(n.artillery[0].ammo,2);assert.equal(n.artillery[0].loaded,false);assert.ok(crewOf(n).every(u=>u.ap===100),'normal next player round follows allied work');assert.deepEqual(endTurn(restored(n)),endTurn(n));
});

test('short local approaches use legal paths and a prone gunner pays to crouch before loading',()=>{
 const b=field({type:'swivel',hidden:true,loaded:false});const u=crewOf(b)[0];u.x=0;u.y=3;
 const action=choose(b);assert.equal(action.type,'move');const path=getReachable(b,u).find(p=>p.x===action.x&&p.y===action.y);assert.ok(path.cost<=24&&path.path.length<=3);
 const approached=endTurn(b);assert.ok(artilleryContact(approached,crewOf(approached)[0],approached.artillery[0]));assert.equal(approached.artillery[0].loaded,true);assert.ok(crewOf(approached)[0].ap<=100-path.cost-35);
 const prone=field({type:'swivel',hidden:true,loaded:false});crewOf(prone)[0].stance='prone';assert.equal(choose(prone).type,'stance');const n=endTurn(prone);assert.equal(crewOf(n)[0].stance,'crouched');assert.equal(crewOf(n)[0].ap,62);assert.equal(n.artillery[0].ammo,1);
 const remote=field({type:'swivel',hidden:true});crewOf(remote)[0].x=0;crewOf(remote)[0].y=10;assert.equal(choose(remote),null);
});

test('pivot requires a complete paid shot budget and actual enemy turns preserve the pivot cost',()=>{
 const b=field({type:'swivel',ammo:0});b.artillery[0].facing=Math.PI;crewOf(b)[0].ap=24;assert.equal(choose(b),null);crewOf(b)[0].ap=25;assert.equal(choose(b).type,'artilleryPivot');
 const n=endTurn(b);assert.ok(n.log.some(s=>s.includes('gira hacia')));assert.equal(n.artillery[0].loaded,false);assert.equal(n.artillery[0].ammo,0);assert.ok(crewOf(n)[0].ap<=75);assert.equal(n.artillery[0].facing,0);
});

test('incapable, mounted, bound or missing helpers cannot staff the gun',()=>{
 for(const patch of [{hp:14},{energy:0},{mounted:true},{entangled:true},{knockedDown:true},{surrendered:true},{routed:true},{departure:'north'}]){
  const b=field();Object.assign(crewOf(b)[1],patch);assert.equal(choose(b),null,JSON.stringify(patch));assert.equal(holdsArtilleryPost(b,crewOf(b)[0]),false);
  const plan=artilleryCrewPlan({...b,phase:'enemy'},crewOf(b)[0],b.artillery[0],40);assert.ok(plan.reason,JSON.stringify(patch));
 }
 const b=field();b.artillery[0].side='player';assert.equal(choose(b),null);
});

test('blocked diagonal contact and water never allow an operator to work through terrain',()=>{
 for(const mode of ['corner','water']){
  const b=field({type:'swivel',hidden:true,loaded:false});const u=crewOf(b)[0];if(mode==='corner')b.tiles.find(t=>t.x===u.x&&t.y===3).blocked=true;else b.tiles.find(t=>t.x===3&&t.y===3).type='water';
  assert.equal(artilleryContact(b,u,b.artillery[0]),false);assert.ok(artilleryCrewPlan({...b,phase:'enemy'},u,b.artillery[0],20).reason);assert.notEqual(choose(b)?.type,'artilleryReload');
 }
});

test('known friendly soldiers and visible civilians block the entire penetrating shot',()=>{
 for(const civilian of [false,true]){
  const b=field({type:'swivel'});b.units.find(u=>u.id==='target').x=12;
  if(civilian)b.npcs.push({id:'civilian',name:'Vecino',hp:100,x:9,y:3});else b.units.push({...crewOf(b)[0],id:'friend',x:9,y:3});
  assert.equal(choose(b),null);assert.equal(b.artillery[0].loaded,true);
 }
});

test('canister can hit several observed opponents but a bystander anywhere in the cone excludes that mode',()=>{
 const b=field({type:'field8'});b.units.find(u=>u.id==='target').x=7;b.units.push({...b.units.find(u=>u.id==='target'),id:'target-2',x:7,y:4},{...b.units.find(u=>u.id==='target'),id:'target-3',x:7,y:2});
 const action=choose(b);assert.equal(action.mode,'canister');const trace=artilleryShotTrace(b,crewOf(b)[0],b.artillery[0],action,'canister');assert.equal(trace.events.filter(e=>e.type==='impact').length,3);
 b.npcs.push({id:'bystander',hp:100,x:6,y:3});assert.notEqual(choose(b)?.mode,'canister');
});

test('unseen opponents and private enemy supplies do not change a gunner decision',()=>{
 const b=field({type:'swivel',hidden:true}),target=b.units.find(u=>u.id==='target');assert.equal(choose(b,'crew-1',[target]),null);
 const visible=field({type:'swivel'}),changed=structuredClone(visible),t=changed.units.find(u=>u.id==='target');t.ammo=999;t.medkits=999;t.priming=0;t.flints=0;t.rations=0;t.energy=42;assert.deepEqual(choose(changed),choose(visible));
 const behind=field({type:'swivel'});behind.tiles.find(t=>t.x===8&&t.y===3).blocksSight=true;assert.equal(choose(behind),null);
});

test('peaceful posts retain only their required crew and depleted guns release them to patrol',()=>{
 for(const side of ['enemy','player']){
  const b=field({side,type:'swivel',hidden:true,exploration:true});const u=crewOf(b)[0];u.patrol=true;
  const before=structuredClone(u),n=actBattle(b,{type:'ambient'});assert.equal(n.mode,'exploration');assert.deepEqual(position(crewOf(n)[0]),position(before));for(const key of ['ap','energy','ammo','loaded'])assert.equal(crewOf(n)[0][key],before[key]);
  const empty=structuredClone(b);empty.artillery[0].loaded=false;empty.artillery[0].ammo=0;assert.equal(holdsArtilleryPost(empty,crewOf(empty)[0]),false);const walked=actBattle(empty,{type:'ambient'});assert.notDeepEqual(position(crewOf(walked)[0]),position(before));assert.ok(restored(n));
 }
});

test('autonomous continuation after a full tactical save preserves finite shots, wounds, positions and seed',()=>{
 let b=field({type:'bronze4'}),saved=restored(b);for(let i=0;i<4&&b.status==='active';i++){b=endTurn(b);saved=endTurn(saved);assert.deepEqual(saved,b);saved=restored(saved);}assert.ok(b.units.find(u=>u.id==='target').hp<300);assert.ok(b.artillery[0].ammo<2);
});

test('a paid local cohort operates a purchased retained gun and full campaign saves preserve both',async()=>{
 const {wonBattery}=await import('./stationed-artillery-fixture.mjs'),{order,saved,sync,leave,visit}=await import('./local-contract-fixture.mjs');
 const {defaultContentPackage}=await import('../game/content-package.js'),{rosterFor}=await import('../game/campaign.js'),{finishMilitiaTraining}=await import('./campaign-wait-fixture.mjs');
 const d=defaultContentPackage();d.startingTerritory.san_nicolas={owner:'royalist',loyalty:65};
 let s=wonBattery(d),treasury=s.resources.treasury;const trainer=rosterFor(s).filter(o=>s.squad.includes(o.id)&&s.operativeState[o.id]?.alive&&o.leadership>=30).sort((a,b)=>b.leadership-a.leadership)[0];assert.ok(trainer);
 s=order(s,{type:'militia',trainerId:trainer.id,rank:0});assert.ok(s.resources.treasury<treasury);s=finishMilitiaTraining(s);s=order(s,{type:'visitSector'});
 const r=s.pendingBattle,gun=structuredClone(s.sectorStates.san_nicolas.artillery[0]);assert.equal(r.garrison.length,3);assert.equal(gun.side,'player');assert.equal(gun.loaded,true);
 // Prepared local ambush geometry around the actual retained emplacement.
 // All hired people, paid militia identities, gun stock and supplies come from
 // ordinary campaign orders; the result follows a real autonomous allied turn.
 const width=64,height=48,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:i%width===gun.x+2?'window':'grass',blocked:i%width===gun.x+2,blocksSight:false,cover:0}));
 r.enemies=createBattle([],{width,height,enemies:[{id:'battery-raider',x:gun.x+5,y:gun.y,weapon:1813,ammo:0,hp:30,maxHp:30,morale:100,patrol:false}]}).units;
 let battle=createBattle([...r.squad.map((u,i)=>({...u,x:1,y:30+i})),...r.garrison.map((u,i)=>({...u,x:i?1+i:gun.x-1,y:i?36:gun.y}))],{...r,hour:s.hour,secondOfHour:s.secondOfHour??0,exploration:false,width,height,tiles,props:[],npcs:r.npcs,artillery:[gun],enemies:r.enemies});
 const before=structuredClone(battle);battle=endTurn(battle);assert.equal(battle.lastError,null);assert.equal(battle.status,'victory');assert.ok(battle.log.some(line=>line.includes('dispara una bala rasa')));assert.equal(battle.artillery[0].loaded,false);assert.equal(battle.artillery[0].ammo,gun.ammo);
 const gunner=battle.units.find(u=>u.id===String(r.garrison[0].id));assert.ok(gunner.militiaExperience>0);for(const u of before.units.filter(u=>u.side==='player'&&!u.militia))assert.equal(battle.units.find(v=>v.id===u.id).hp,u.hp);
 const p=saved(sync({campaign:s,battle})),returned=visit(saved({campaign:leave(p)}).campaign);assert.equal(returned.battle.artillery[0].id,gun.id);assert.equal(returned.battle.artillery[0].loaded,false);assert.equal(returned.battle.artillery[0].ammo,gun.ammo);
 const retained=returned.battle.units.find(u=>u.id===gunner.id);for(const key of ['hp','loaded','ammo','condition','militiaExperience','militiaCombatCredit'])assert.deepEqual(retained[key],gunner[key],key);assert.equal(returned.campaign.armory.swivel??0,0);
});


test('a scattered heavy crew holds its post while helpers approach and then fires in a real phase',()=>{
 for(const side of ['enemy','player']){
  const b=field({side});crewOf(b)[1].x=0;crewOf(b)[2].x=1;crewOf(b)[2].y=5;
  const first=position(crewOf(b)[0]);let n=endTurn(b);assert.deepEqual(position(crewOf(n)[0]),first);
  if(n.phase==='interrupt'){assert.equal(n.artillery[0].loaded,true);const saved=restored(n);n=endTurn(n);assert.deepEqual(endTurn(saved),n);}
  assert.equal(n.lastError,null);assert.ok(n.log.some(line=>line.includes('dispara una bala rasa')),side);assert.ok(n.units.find(u=>u.id==='target').hp<300,side);assert.deepEqual(position(crewOf(n)[0]),first);assert.ok(crewOf(n).every(u=>artilleryContact(n,u,n.artillery[0])));
  for(const line of n.log.filter(s=>s.includes('avanza (')))assert.ok(Number(line.match(/\((\d+) PA/)[1])<=24,line);
 }
});

test('a standing heavy operator waits for prone helpers to pay their own posture cost',()=>{
 const b=field({hidden:true,loaded:false});for(const u of crewOf(b).slice(1))u.stance='prone';
 const n=endTurn(b);assert.equal(n.lastError,null);assert.equal(n.artillery[0].loaded,true);assert.equal(n.artillery[0].ammo,1);assert.deepEqual(crewOf(n).map(u=>u.ap),[25,22,22]);assert.equal(crewOf(n)[0].stance,'standing');assert.ok(crewOf(n).slice(1).every(u=>u.stance==='crouched'));assert.equal(n.log.filter(line=>line.includes('se agacha')).length,0,'hidden crew actions must not disclose enemy preparation');
});
