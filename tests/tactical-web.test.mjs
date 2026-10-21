import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,getReachable,reloadCost,shotChance,misfireChance,actionCosts,canSee} from '../game/tactical.js';
import {automaticOrder,searchOrder} from '../game/autonomous-orders.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
const flat=()=>Array.from({length:80},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',blocked:false,cover:0}));
const battle=()=>createBattle([{id:0,name:'Cabral',x:1,y:1}],{width:10,height:8,tiles:flat(),enemies:[{id:'e',x:6,y:1}],seed:45});
test('movement spends AP and never mutates source',()=>{const s=battle();s.units[1].overwatch=false;const n=actBattle(s,{type:'move',unitId:0,x:3,y:1});assert.equal(n.units[0].ap,84);assert.equal(s.units[0].x,1);assert.equal(n.units[0].momentum,2);});
test('walls and occupied squares cannot be traversed',()=>{const s=battle();s.tiles.find(t=>t.x===2&&t.y===1).blocked=true;const p=getReachable(s,'0').find(p=>p.x===3&&p.y===1);assert.equal(p.cost,32);assert.ok(!getReachable(s,'0').some(p=>p.x===6&&p.y===1));});
test('prone reload multiplier and double-barrel partial reload',()=>{const u=battle().units[0];u.loaded=0;assert.equal(reloadCost(u),45);u.stance='prone';assert.equal(reloadCost(u),68);u.weapon=1808;setTestAmmunition(u,12);u.loaded=1;u.stance='standing';assert.equal(reloadCost(u),28);});
test('reload transfers rounds and enforces available AP',()=>{let s=battle();s.units[0].loaded=0;s.units[0].ap=44;let n=actBattle(s,{type:'reload',unitId:0});assert.equal(n.lastError,null);assert.equal(n.units[0].loaded,0);assert.equal(n.units[0].ammo,12);assert.equal(n.units[0].ap,0);assert.equal(reloadCost(n.units[0],n),1);s.units[0].ap=100;n=actBattle(s,{type:'reload',unitId:0});assert.equal(n.units[0].loaded,1);assert.equal(n.units[0].ammo,11);assert.equal(n.units[0].ap,55);});
test('weather misfire preserves charge and repriming costs 15',()=>{const s=battle();s.weather={rain:100,humidity:100};s.seed=1;const n=actBattle(s,{type:'fire',unitId:0,targetId:'e'});assert.equal(n.units[0].jammed,true);assert.equal(n.units[0].loaded,1);const p=actBattle(n,{type:'reprime',unitId:0});assert.equal(p.units[0].jammed,false);assert.equal(p.units[0].ap,n.units[0].ap-15);assert.equal(p.units[0].loaded,1);assert.ok(misfireChance(40,80,15)>misfireChance(100,0,0));});
test('powder smoke reduces accuracy and walls block shooting',()=>{const s=battle(),a=s.units[0],b=s.units[1],base=shotChance(s,a,b);s.smoke.push({x:3,y:1,radius:1,turns:3});assert.ok(shotChance(s,a,b)<base);s.tiles.find(t=>t.x===3&&t.y===1).blocked=true;assert.equal(shotChance(s,a,b),0);assert.ok(actBattle(s,{type:'fire',unitId:0,targetId:'e'}).lastError);});
test('healing pays for holding the kit, stops bleeding and consumes field supplies',()=>{const s=battle();s.units[0].hp=50;s.units[0].bleeding=4;const held=actBattle(s,{type:'weapon',unitId:0,slot:'medical'});assert.equal(held.lastError,null);assert.equal(held.units[0].ap,s.units[0].ap-4);const n=actBattle(held,{type:'useItem',unitId:0,targetId:0});assert.equal(n.lastError,null);assert.equal(n.units[0].ap,held.units[0].ap-25);assert.equal(n.units[0].bleeding,0);assert.equal(n.units[0].hp,50);assert.equal(n.units[0].medkits,1);});
test('straight movement increases melee damage and wins battle',()=>{let s=battle();s.units[0].blade=1811;s=actBattle(s,{type:'weapon',unitId:0,slot:'blade'});s.units[1].x=4;s.units[1].hp=20;s.units[1].overwatch=false;s=actBattle(s,{type:'move',unitId:0,x:3,y:1});s=actBattle(s,{type:'melee',unitId:0,targetId:'e'});assert.equal(s.status,'victory');assert.equal(s.units[1].hp,0);});
test('enemy turn is deterministic and serializable',()=>{const s=battle();s.units[1].weapon=1806;s.units[1].ap=actionCosts(s,s.units[1]).fire;const a=endTurn(s),b=endTurn(JSON.parse(JSON.stringify(s)));assert.deepEqual(a,b);assert.equal(a.turn,2);assert.equal(a.phase,'player');assert.ok(a.log.length>s.log.length);assert.equal(s.turn,1);});
test('militia investigate current allied sightings without gaining personal sight or bypassing guards',()=>{
 const width=14,height=9,tiles=Array.from({length:width*height},(_,i)=>{const x=i%width,y=Math.floor(i/width),wall=x===4&&y>0&&y<7;return {x,y,type:wall?'wall':'grass',blocked:wall,blocksSight:wall,cover:wall?40:0};});
 const s=createBattle([{id:'m',militia:true,x:2,y:4,facing:2,morale:100},{id:'observer',x:7,y:3,facing:2,morale:100}],{width,height,tiles,hour:12,seed:45,enemies:[{id:'enemy',x:10,y:3,facing:2,morale:100,patrol:false}]}),[m,observer,enemy]=s.units,before=structuredClone(s);
 assert.equal(canSee(s,m,enemy),false);assert.equal(canSee(s,observer,enemy),true);assert.equal(chooseEnemyAction(s,m),null);assert.equal(searchOrder(s,m),null);
 const order=automaticOrder(s,m);assert.equal(order.type,'move');assert.ok(!('targetId' in order));
 const route=getReachable(s,m).find(p=>p.x===order.x&&p.y===order.y);assert.ok(route.cost>0&&route.cost<=24&&route.path.length<=3);
 assert.equal(m.lastKnownEnemy,undefined);assert.equal(m.lastHeardNoise,undefined);assert.deepEqual(s,before);
 const next=endTurn(s);assert.equal(next.lastError,null);assert.notDeepEqual([next.units[0].x,next.units[0].y],[m.x,m.y]);assert.deepEqual(s,before);
 const originalFallback=(b,u)=>chooseEnemyAction(b,u)??searchOrder(b,u);
 for(const change of [b=>{b.units[0].militia=false;},b=>{b.phase='interrupt';},b=>{b.reactionStack=[{}];},b=>{b.mode='exploration';},
   b=>{b.units[0].routed=true;},b=>{b.units[0].unconscious=true;},b=>{b.units[0].knockedDown=true;},b=>{b.units[0].entangled=true;},
   b=>{b.units[0].hp=14;},b=>{b.units[0].energy=0;},b=>{b.units[2].side='player';},b=>{b.units[2].side='neutral';},b=>{b.units[2].routed=true;},
   b=>{b.units.push({...structuredClone(b.units[0]),id:'crew',x:3,y:4});b.artillery=[{id:'post',type:'bronze4',side:'player',x:2,y:5,loaded:true,ammo:3}];}]){
  const guarded=structuredClone(s);change(guarded);const snapshot=structuredClone(guarded);
  assert.deepEqual(automaticOrder(guarded,guarded.units[0]),originalFallback(guarded,guarded.units[0]));assert.deepEqual(guarded,snapshot);
 }
 const unseen=structuredClone(s);unseen.units[1].facing=6;assert.equal(canSee(unseen,unseen.units[1],unseen.units[2]),false);
 const sweep=automaticOrder(unseen,unseen.units[0]);assert.deepEqual(sweep,searchOrder(unseen,unseen.units[0]));
 unseen.units[2].x=11;unseen.units[2].y=7;assert.deepEqual(automaticOrder(unseen,unseen.units[0]),sweep,'hidden enemy position does not guide the search');
 const personal=structuredClone(s);personal.units[0].x=6;personal.units[0].y=3;assert.equal(canSee(personal,personal.units[0],personal.units[2]),true);
 const own=chooseEnemyAction(personal,personal.units[0]);assert.ok(own);assert.deepEqual(automaticOrder(personal,personal.units[0]),own);
 const blocked=structuredClone(s);for(const tile of blocked.tiles)if(Math.max(Math.abs(tile.x-m.x),Math.abs(tile.y-m.y))===1)tile.blocked=true;
 assert.equal(automaticOrder(blocked,blocked.units[0]),null);
});
test('outnumbered depleted player can lose to enemy melee',()=>{const s=battle();s.units[0].hp=1;s.units[1].x=2;assert.equal(endTurn(s).status,'defeat');});
test('lance units cannot fire an imaginary musket',()=>{const s=battle();s.units[0].weapon=1812;assert.ok(actBattle(s,{type:'fire',unitId:0,targetId:'e'}).lastError);assert.ok(actBattle(s,{type:'reload',unitId:0}).lastError);});
test('charge consumes remaining AP and requires a clear straight approach',()=>{let s=battle();s.units[1].overwatch=false;s.units[0].blade=1809;s.units[1].hp=100;s=actBattle(s,{type:'weapon',unitId:0,slot:'blade'});const n=actBattle(s,{type:'charge',unitId:0,targetId:'e'});assert.equal(n.units[0].ap,0);assert.equal(n.units[0].x,5);assert.ok(n.units[1].hp<54);s.units[1].y=3;assert.ok(actBattle(s,{type:'charge',unitId:0,targetId:'e'}).lastError);});
test('mounting requires assigned horse and reduces movement AP',()=>{const s=battle();assert.ok(actBattle(s,{type:'mount',unitId:0}).lastError);s.units[0].horse=true;const n=actBattle(s,{type:'mount',unitId:0});assert.equal(n.units[0].mounted,true);assert.equal(getReachable(n,'0').find(p=>p.x===2&&p.y===1).cost,4);assert.ok(actBattle(n,{type:'stance',unitId:0,stance:'prone'}).lastError);});
test('artillery requires actual crew AP and breaches walls',()=>{const s=battle();s.artillery=[{id:'g',type:'bronze4',side:'player',x:1,y:2,loaded:true,ammo:3}];assert.ok(actBattle(s,{type:'artillery',unitId:0,artilleryId:'g',x:4,y:2}).lastError);s.units.push({...s.units[0],id:'crew',x:2,y:2});s.tiles.find(t=>t.x===4&&t.y===2).blocked=true;const n=actBattle(s,{type:'artillery',unitId:0,artilleryId:'g',x:4,y:2});assert.equal(n.lastError,null);assert.equal(n.artillery[0].loaded,false);assert.equal(n.units[0].ap,70);assert.equal(n.units[2].ap,70);assert.equal(n.tiles.find(t=>t.x===4&&t.y===2).blocked,false);const r=actBattle(n,{type:'artilleryReload',unitId:0,artilleryId:'g'});assert.equal(r.artillery[0].loaded,true);assert.equal(r.artillery[0].ammo,2);assert.equal(r.units[0].ap,10);});
test('authored firearm and blade values retain explicit loose-bayonet tuning',async()=>{const {WEAPONS,BLADES,bladeFor}=await import('../game/tactical.js');for(const[id,damage,fireAP,aimAP,reloadAP,range]of[[1804,48,10,4,35,10],[1805,42,7,3,32,8],[1806,38,6,2,28,12],[1807,75,12,5,40,6],[1808,40,8,3,55,9]])assert.deepEqual([WEAPONS[id].damage,WEAPONS[id].fireAP,WEAPONS[id].aimAP,WEAPONS[id].reloadAP,WEAPONS[id].range],[damage,fireAP,aimAP,reloadAP,range]);for(const[id,ap,damage]of[[1809,12,46],[1810,14,42],[1811,16,50],[1812,18,56],[1813,8,32]])assert.deepEqual([BLADES[id].ap,BLADES[id].damage],[ap,damage]);assert.equal(bladeFor({activeSlot:'blade',blade:1811}).damage,24);});
test('enemy reaction interrupts an exposed charge and death prevents melee damage',()=>{const s=battle();Object.assign(s.units[0],{hp:20,blade:1809,activeSlot:'blade'});s.units[1].marksmanship=100;s.seed=45;const n=actBattle(s,{type:'charge',unitId:0,targetId:'e'});assert.equal(n.units[0].hp,0);assert.equal(n.units[1].hp,100);assert.equal(n.units[1].loaded,0);assert.ok(n.log.includes(`${s.units[1].name} interrumpe con sus PA restantes.`));assert.equal(n.status,'defeat');});
test('smoke and quiet movement prevent reaction; enemy AP is not replenished twice',()=>{const s=battle();s.units[0].stealthMode=true;s.units[0].stealth=100;s.units[0].movementMode='prone';s.units[0].stance='prone';s.units[1].x=8;s.smoke=[{x:4,y:1,radius:4,turns:3}];const n=actBattle(s,{type:'move',unitId:0,x:2,y:1});assert.equal(n.units[1].loaded,1);assert.ok(!n.log.some(t=>/interrumpe(?:n)? con sus PA restantes/.test(t)));const e=endTurn(battle());assert.ok(e.units.find(u=>u.side==='enemy').ap<100);});
test('exploration rests a ready firearm visually while deliberate aiming and combat stay ready',async()=>{
 const {register}=await import('node:module');register('./tactical-render-loader.mjs',import.meta.url);
 const {presentActors}=await import('../web/lib/three/presentation.ts');
 const s=battle(),actor=s.units[0],key=`unit:${actor.id}`;s.mode='exploration';actor.weaponReady=true;
 const present=(options={})=>{const before=structuredClone(s),visual=presentActors(s,[{key,kind:'unit',actor}],{},new Set(),options)[0];assert.deepEqual(s,before);return visual;};
 assert.equal(present().action,'idle');assert.equal(present().idleAction,'idle');assert.equal(actor.weaponReady,true);
 assert.equal(present({selected:actor.id,mode:'fire'}).action,'aim');
 assert.equal(present({cues:{[key]:{id:'deliberate-aim',action:'aim',startedAt:0}}}).action,'aim');
 s.mode='combat';assert.equal(present().action,'aim');assert.equal(present().idleAction,'aim');
 s.status='victory';assert.equal(present().action,'idle');assert.equal(present({selected:actor.id,mode:'fire'}).action,'aim');
 delete s.status;assert.equal(present().action,'aim');
});
