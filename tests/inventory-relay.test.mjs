import test from 'node:test';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
const AMMO='inventory:ammo:musket_75';
import assert from 'node:assert/strict';
import {createBattle,actBattle,transferPreview} from '../game/tactical.js';
import {inventoryHandlingModel} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const fullPack=()=>Object.fromEntries(Array.from({length:12},(_,i)=>[`slot${i}`,{count:1,weight:1}]));
const tiles=()=>Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0}));
const field=(length=4,exploration=false)=>{
 const s=createBattle(Array.from({length},(_,i)=>({id:`p${i}`,name:`Soldado ${i}`,x:1+i,y:2})),{width:24,height:10,tiles:tiles(),seed:45,exploration,enemies:exploration?[]:[{id:'guard',x:22,y:8,overwatch:false}]});
 for(const u of s.units.filter(u=>u.side==='player')){Object.assign(u,{ap:100,medkits:0,rations:0,boleadoras:0,torches:0});setTestAmmunition(u,0);}
 setTestAmmunition(s.units[0],12);return s;
};
const plan=(s,item=AMMO,count=3)=>inventoryHandlingModel(s,s.units[0],{item,count,targetId:s.units.filter(u=>u.side==='player').at(-1).id}).transfer;
const execute=(s,p=plan(s))=>actBattle(s,{unitId:s.units[0].id,...p.action});
const physical=s=>({units:s.units,ground:s.groundItems,dropped:s.droppedWeapons,seed:s.seed,time:s.elapsedSeconds});
const reject=(s,p)=>{const n=execute(s,p);assert.ok(n.lastError);assert.deepEqual(physical(n),physical(s));};

test('a chain beyond throw range delivers the exact quantity and splits AP across every sender',()=>{
 const s=field(9),before=structuredClone(s),p=plan(s);
 assert.equal(p.kind,'relay');assert.equal(p.pa,4);assert.equal(p.totalPA,32);assert.equal(p.chance,100);
 assert.deepEqual(p.route.map(v=>v.id),Array.from({length:9},(_,i)=>`p${i}`));
 const n=execute(s,p);assert.equal(n.lastError,null);assert.equal(n.units[0].ammo,9);assert.equal(n.units[8].ammo,3);
 for(let i=0;i<9;i++){assert.equal(n.units[i].ap,i===8?100:96);if(i>0&&i<8)assert.equal(n.units[i].ammo,0);}
 assert.equal(n.seed,s.seed);assert.deepEqual(n.groundItems,[]);assert.deepEqual(s,before);validateBattleSnapshot(n);
});
test('direct handover wins over a chain and a disconnected ally retains the explicit throw',()=>{
 const s=field(2);assert.equal(plan(s).kind,'give');assert.equal(plan(s).totalPA,4);
 s.units[1].x=5;const p=plan(s);assert.equal(p.kind,'throw');assert.equal(p.pa,8);assert.match(p.detail,/recepción/);
 const n=execute(s,p);assert.equal(n.lastError,null);assert.equal(n.units[0].ammo,9);assert.equal(n.units[0].ap,92);
});
test('relay route is stable across unit ordering and chooses the fewest handovers',()=>{
 const s=field(4);s.units[3].x=3;s.units[1].x=2;s.units[1].y=1;s.units[2].x=2;s.units[2].y=2;
 const route=transferPreview(s,s.units[0],s.units[3],AMMO,1).route.map(v=>v.id);assert.deepEqual(route,['p0','p1','p3']);
 s.units.reverse();assert.deepEqual(transferPreview(s,s.units.find(u=>u.id==='p0'),s.units.find(u=>u.id==='p3'),AMMO,1).route.map(v=>v.id),route);
});
test('a chain can go around a wall but cannot pass through a blocked handover',()=>{
 const s=field(4);Object.assign(s.units[0],{x:1,y:1});Object.assign(s.units[1],{x:1,y:2});Object.assign(s.units[2],{x:2,y:2});Object.assign(s.units[3],{x:3,y:2});
 Object.assign(s.tiles.find(t=>t.x===2&&t.y===1),{type:'wall',blocked:true,cover:100});
 assert.equal(plan(s).kind,'relay');
 Object.assign(s.tiles.find(t=>t.x===1&&t.y===2),{type:'wall',blocked:true,cover:100});
 assert.notEqual(plan(s).kind,'relay');
});
test('incapable, autonomous, exhausted or full-pack soldiers cannot forward an item',()=>{
 for(const patch of [{unconscious:true,energy:0,ap:0,maxAP:0},{knockedDown:true},{routed:true},{surrendered:true},{hp:0},{fled:true},{departure:{exitId:'test'}},{militia:true},{ap:3},{inventory:fullPack()}]){
  const s=field(3),p=plan(s);Object.assign(s.units[1],patch);assert.notEqual(plan(s).kind,'relay',JSON.stringify(patch));reject(s,p);
 }
});
test('only soldiers in the active interrupt window may forward items',()=>{
 const s=field(3);s.phase='interrupt';s.interrupt={unitIds:['p0'],enemyId:'guard'};
 assert.equal(plan(s).kind,'throw');s.interrupt.unitIds.push('p1');assert.equal(plan(s).kind,'relay');
});
test('changed route, AP, recipient capacity or item quantity rejects the confirmed order atomically',()=>{
 for(const change of [s=>s.units[1].x=10,s=>s.units[1].ap=3,s=>s.units[2].inventory=fullPack(),s=>setTestAmmunition(s.units[0],2)]){
  const s=field(3),p=plan(s);change(s);reject(s,p);
 }
 const s=field(3),p=plan(s);p.action.transferRoute=['p0','p2'];reject(s,p);
});
test('relay preserves an identified fitted gun and never forwards a helper own similar gun',()=>{
 const s=field(3),u=s.units[0];Object.assign(u,{weapon:1800,loaded:1,condition:43,jammed:true,weaponInstanceId:'relay-gun',weaponFittings:{bayonet:{weapon:1811,condition:61,instanceId:'relay-bayonet',fittingPattern:'india_socket'}}});
 s.units[1].inventory.other={weapon:1800,loaded:0,condition:90,jammed:false,count:1,weight:4,instanceId:'helper-gun'};
 const own=structuredClone(s.units[1].inventory),p=plan(s,'primary',1),n=execute(s,p);assert.equal(p.kind,'relay');assert.equal(n.lastError,null);
 assert.deepEqual(n.units[1].inventory,own);assert.equal(n.units[0].weaponDropped,true);assert.equal(n.units[0].ammo,12);
 const gun=Object.values(n.units[2].inventory).find(v=>v.instanceId==='relay-gun');assert.ok(gun);assert.equal(gun.loaded,1);assert.equal(gun.condition,43);assert.equal(gun.jammed,true);assert.deepEqual(gun.fittings,u.weaponFittings);validateBattleSnapshot(n);
});
test('partial loading work follows the exact relayed gun through save validation',()=>{
 const s=field(3);Object.assign(s.units[0],{weapon:1802,loaded:0,reloadProgress:.4,weaponInstanceId:'partial-relay'});
 const n=execute(s,plan(s,'primary',1));assert.equal(n.lastError,null);assert.equal(n.units[0].reloadProgress,undefined);
 const gun=Object.values(n.units[2].inventory).find(v=>v.instanceId==='partial-relay');assert.equal(gun.reloadProgress,.4);validateBattleSnapshot(JSON.parse(JSON.stringify(n)));
});
test('exploration spends one second per handover, keeps AP and consumes finite supplies once',()=>{
 const s=field(5,true);for(const u of s.units)u.ap=0;const p=plan(s),n=execute(s,p);assert.equal(n.lastError,null);assert.equal(p.kind,'relay');
 assert.equal(n.elapsedSeconds-s.elapsedSeconds,4);assert.ok(n.units.every(u=>u.ap===0));assert.equal(n.units[0].ammo,9);assert.equal(n.units[4].ammo,3);
});
test('inventory preview identifies each participant, total cost and guarded confirmation',()=>{
 const s=field(4),p=plan(s);assert.equal(p.label,'Pasar por aliados');assert.match(p.detail,/Soldado 0 \(1 PA\).*Soldado 3 \(0 PA\)/);assert.match(p.detail,/3 PA en total/);assert.equal(p.disabled,false);
 assert.deepEqual(p.action.transferRoute,p.route.map(v=>v.id));assert.equal(p.action.transferKind,'relay');
 assert.equal(inventoryHandlingModel(s,s.units[0],{item:AMMO,count:3,targetId:'p3',busy:true}).transfer.disabled,true);
});
test('a full campaign save retains the recipient ownership and all relay AP costs',()=>{
 let c=dispatchCampaign(initialCampaign(),{type:'travel',sector:'buenos_aires'});c=dispatchCampaign(c,{type:'attack',sector:'san_nicolas'});assert.equal(c.lastError,null);
 const request=c.pendingBattle;const squad=[request.squad[1],request.squad[0],...request.squad.slice(2)];let b=createBattle(squad.map((u,i)=>({...u,x:1+i,y:2})),{...request,width:24,height:10,tiles:tiles(),seed:45,enemies:[{id:'guard',x:22,y:8,overwatch:false}]});
 const allies=b.units.filter(u=>u.side==='player');assert.ok(allies.length>=3);const target=allies[2];
 const source=Object.entries(allies[0].inventory).find(([,stack])=>stack.kind==='ammunition'&&stack.count>0);assert.ok(source);const p=inventoryHandlingModel(b,allies[0],{item:`inventory:${source[0]}`,count:1,targetId:target.id}).transfer;assert.equal(p.kind,'relay');
 b=actBattle(b,{unitId:allies[0].id,...p.action});assert.equal(b.lastError,null);const synced=syncBattleTime(c,b);assert.equal(synced.error,null);
 const saved=decodeSave(encodeSave(synced.campaign,synced.battle));assert.deepEqual(saved.battle.units,b.units);assert.deepEqual(saved.battle.groundItems,b.groundItems);
});
