import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,actionCosts,firearmVolleyPreview,shotChance,canSee} from '../game/tactical.js';
import {targetPreview,aimOptions,equippedItemHelp,tacticalInputAction,orderDescriptors} from '../game/ja2-hud.js';
import {rightClickAim} from '../game/aim-cursor.js';
import {pairedPistol} from '../game/paired-fire.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const pistol=(extra={})=>({weapon:1808,count:1,weight:1.3,loaded:2,condition:45,jammed:false,instanceId:'left-pistol',...extra});
function field(extra={},sector={}){
 const s=createBattle([{id:'p',name:'Patriota',x:2,y:2,facing:2,weapon:1805,weaponInstanceId:'right-pistol',loaded:1,condition:93,marksmanship:76,ammo:4,offHand:pistol(),...extra}],{
  width:22,height:12,seed:45,tiles:Array.from({length:264},(_,i)=>({x:i%22,y:Math.floor(i/22),type:'grass',cover:0,blocked:false})),
  enemies:[{id:'e',name:'Realista',x:7,y:2,hp:250,maxHp:250,morale:100,patrol:false,overwatch:false},{id:'reserve',x:20,y:10,patrol:false,overwatch:false}],...sector,
 });
 s.units[0].ap=extra.ap??100;for(const u of s.units.filter(u=>u.side==='enemy'))u.ap=0;return s;
}
const physical=s=>({...s,log:[],lastError:null});

test('paired target preview names both hands and the confirmed shot pays its shared displayed cost',()=>{
 const s=field(),u=s.units[0],target=s.units[1],before=structuredClone(s),aim=2;
 const p=targetPreview(s,u,target,{mode:'fire',aim,hitLocation:'torso'}),volley=firearmVolleyPreview(s,u,target,aim,'torso');
 assert.equal(volley.paired,true);assert.equal(volley.shots.length,2);assert.notEqual(volley.shots[0].chance,volley.shots[1].chance);
 assert.equal(p.actionLabel,'Disparar ambas pistolas');assert.equal(p.attackLabel,p.actionLabel);assert.equal(p.chanceLabel,'impacto (mano principal)');assert.equal(p.chance,volley.shots[0].chance);
 assert.ok(p.coverNote.includes(`Mano principal: ${volley.shots[0].chance}%`));assert.ok(p.coverNote.includes(`Segunda mano: ${volley.shots[1].chance}%`));assert.match(p.coverNote,/Un disparo por pistola/);
 assert.equal(p.pa,actionCosts(s,u,target).fire+aim*actionCosts(s,u,target).aim);assert.equal(p.remaining,u.ap-p.pa);assert.deepEqual(s,before);
 const next=actBattle(s,{type:'fire',unitId:'p',targetId:'e',aim,hitLocation:'torso'});assert.equal(next.lastError,null);assert.equal(next.units[0].ap,u.ap-p.pa);assert.equal(next.units[0].loaded,0);assert.equal(next.units[0].offHand.loaded,1);assert.equal(next.units[0].ammo,u.ammo);assert.doesNotThrow(()=>validateBattleSnapshot(next));
});

test('paired aim steps, exact AP rejection and body-region previews stay aligned with the normal cursor',()=>{
 const s=field(),u=s.units[0],target=s.units[1],cost=actionCosts(s,u,target);u.ap=cost.fire+2*cost.aim;
 const options=aimOptions(s,u,{target});assert.deepEqual(options.map(o=>o.disabled),[false,false,false,true,true]);
 let cursor=rightClickAim(s,u,{mode:'move',target});cursor=rightClickAim(s,u,{...cursor,target});cursor=rightClickAim(s,u,{...cursor,target});assert.equal(cursor.aim,2);assert.equal(rightClickAim(s,u,{...cursor,target}).aim,0);
 for(const hitLocation of ['head','torso','legs']){
  const p=targetPreview(s,u,target,{mode:'fire',aim:2,hitLocation});assert.equal(p.valid,true);assert.equal(p.pa,u.ap);assert.equal(p.chance,shotChance(s,u,target,2,hitLocation));assert.match(p.coverNote,/Segunda mano:/);
 }
 const head=targetPreview(s,u,target,{mode:'fire',aim:2,hitLocation:'head'});assert.equal(head.hitLocation,'Cabeza');
 const short=structuredClone(s);short.units[0].ap--;assert.equal(targetPreview(short,short.units[0],short.units[1],{mode:'fire',aim:2}).valid,false);
 const rejected=actBattle(short,{type:'fire',unitId:'p',targetId:'e',aim:2});assert.ok(rejected.lastError);assert.deepEqual(physical(rejected),physical(short));
 target.stance='prone';assert.equal(targetPreview(s,u,target,{mode:'fire',hitLocation:'head'}).valid,false);assert.equal(targetPreview(s,u,target,{mode:'fire',hitLocation:'torso'}).hitLocation,'Torso');
});

test('an empty, jammed or stowed second pistol leaves a normal primary-only preview and action',()=>{
 for(const extra of [{offHand:pistol({loaded:0,reloadProgress:.5})},{offHand:pistol({jammed:true})},{leftHandItem:null},{offHand:undefined}]){
  const s=field(extra),u=s.units[0],target=s.units[1],p=targetPreview(s,u,target,{mode:'fire'});assert.equal(pairedPistol(u),null);assert.notEqual(p.actionLabel,'Disparar ambas pistolas');assert.equal(p.chanceLabel,undefined);assert.doesNotMatch(p.coverNote,/Segunda mano:|Un disparo por pistola/);
  assert.doesNotMatch(equippedItemHelp(s,u,{mode:'fire',target}),/ambas pistolas/);
  const next=actBattle(s,{type:'fire',unitId:'p',targetId:'e'});assert.equal(next.lastError,null);assert.equal(next.units[0].loaded,0);assert.deepEqual(next.units[0].offHand,u.offHand);
 }
});

test('an empty main pistol still reloads once while a loaded second pistol and close-combat mode remain unchanged',()=>{
 const s=field({loaded:0,reloadProgress:.5}),u=s.units[0],target=s.units[1],a={type:'fire',targetId:'e',aim:4};
 const p=targetPreview(s,u,target,{mode:'fire',aim:4});assert.equal(p.attackType,'reload');assert.equal(p.chance,undefined);assert.doesNotMatch(p.coverNote??'',/Segunda mano:|ambas pistolas/);
 assert.equal(tacticalInputAction(s,u,a).type,'reload');const next=actBattle(s,{unitId:'p',...tacticalInputAction(s,u,a)});assert.equal(next.lastError,null);assert.equal(next.units[0].loaded,1);assert.equal(next.units[0].ammo,u.ammo-1);assert.deepEqual(next.units[0].offHand,u.offHand);assert.equal(next.units[1].hp,target.hp);
 const empty=field({loaded:0,ammo:0});assert.equal(targetPreview(empty,empty.units[0],empty.units[1],{mode:'fire'}).cursor,'empty');
 const melee=field({weaponMode:'melee'});melee.units[1].x=3;const m=targetPreview(melee,melee.units[0],melee.units[1],{mode:'useItem'});assert.equal(m.attackType,'melee');assert.equal(m.actionLabel,'Culatazo');assert.doesNotMatch(m.coverNote??'',/pistolas|Segunda mano/);
});

test('paired point shots disclose two discharges without revealing a hidden occupant or hit chances',()=>{
 const s=field();s.night=true;Object.assign(s.units[1],{x:19,y:8,stance:'prone',name:'Oculto privado',marksmanship:1});const u=s.units[0],point={x:19,y:8};assert.equal(canSee(s,u,s.units[1]),false);
 const empty=structuredClone(s);empty.units=empty.units.filter(v=>v.id!=='e');const p=targetPreview(s,u,point,{mode:'fire',aim:1});assert.deepEqual(targetPreview(empty,empty.units[0],point,{mode:'fire',aim:1}),p);
 assert.equal(p.actionLabel,'Disparar ambas pistolas a la casilla');assert.match(p.coverNote,/Un disparo por pistola/);assert.match(p.coverNote,/Sin objetivo confirmado/);assert.equal(p.chance,undefined);assert.equal(p.hitLocation,undefined);assert.doesNotMatch(JSON.stringify(p),/Oculto privado|Segunda mano:|Mano principal:/);
});

test('paired exploration preview hides AP expenditure and adds no separate fire-mode order',()=>{
 const s=field({ap:0},{exploration:true,enemies:[]}),u=s.units[0],point={x:7,y:2},p=targetPreview(s,u,point,{mode:'fire',aim:4});assert.equal(p.valid,true);assert.equal(p.pa,0);assert.equal(p.remaining,0);assert.match(p.actionLabel,/ambas pistolas/);assert.doesNotMatch(p.coverNote,/\d+ PA/);
 assert.match(equippedItemHelp(s,u,{mode:'fire',target:point}),/Disparar ambas pistolas · 0 PA/);
 const descriptors=orderDescriptors(s,u),single=orderDescriptors(s,{...u,leftHandItem:null});assert.equal(descriptors.filter(d=>d.id==='fire').length,1);assert.deepEqual(descriptors.map(d=>d.id),single.map(d=>d.id));
 const next=actBattle(s,{type:'firePoint',unitId:'p',...point,aim:4});assert.equal(next.lastError,null);assert.equal(next.units[0].ap,0);assert.ok(next.elapsedSeconds>0);assert.equal(next.units[0].loaded,0);assert.equal(next.units[0].offHand.loaded,1);
});

test('a paired preview distinguishes a blocked main shot from the second pistol penetrating the same cover',()=>{
 const s=field({weapon:1806,condition:100,offHand:pistol({weapon:1805,loaded:1,condition:100})});
 Object.assign(s.tiles.find(t=>t.x===6&&t.y===2),{type:'wall',blocked:true,blocksSight:false,obstacleHeight:3,projectileResistance:38});
 const p=targetPreview(s,s.units[0],s.units[1],{mode:'fire',aim:4});assert.equal(p.valid,true);assert.equal(p.chance,0);
 // The second pistol has 42 force. One crossed wall unit includes the
 // descending .3/5 slope, so its displayed loss rounds to 91 percent.
 const loss=Math.round(38*Math.hypot(1,.3/5)/42*100),volley=firearmVolleyPreview(s,s.units[0],s.units[1],4);
 assert.equal(volley.shots[1].damage,42);assert.equal(loss,91);assert.ok(Math.abs(volley.shots[1].damageFactor-(42-38*Math.hypot(1,.3/5))/42)<1e-10);
 assert.match(p.coverNote,/Mano principal: 0% \(la cobertura detiene el tiro\)/);assert.match(p.coverNote,new RegExp(`Segunda mano: \\d+% \\(daño reducido un ${loss}%\\)`));assert.doesNotMatch(p.coverNote,/La cobertura detiene este tiro/);
});

test('exploration permits an empty-main reload at zero AP with finite reserve and rejects an exhausted reserve',()=>{
 for(const offHand of [undefined,pistol()])for(const ap of [0,17]){
  const s=field({loaded:0,ammo:1,ap,offHand},{exploration:true,enemies:[]}),u=s.units[0],before=structuredClone(s);
  const p=targetPreview(s,u,null,{mode:'fire',aim:4});assert.equal(p.valid,true);assert.equal(p.reason,null);assert.equal(p.cursor,'reload');assert.equal(p.attackType,'reload');assert.equal(p.pa,0);assert.equal(p.remaining,ap);assert.equal(p.rounds,1);assert.equal(p.partial,false);assert.doesNotMatch(p.coverNote,/\d+ PA/);
  const order=tacticalInputAction(s,u,{type:'firePoint',unitId:'p',x:7,y:2,aim:4});assert.deepEqual(order,{type:'reload',unitId:'p',aim:0});
  const next=actBattle(s,order);assert.equal(next.lastError,null);assert.equal(next.units[0].ap,ap);assert.equal(next.units[0].loaded,1);assert.equal(next.units[0].ammo,0);assert.equal(next.units[0].condition,u.condition);assert.deepEqual(next.units[0].offHand,u.offHand);assert.deepEqual(next.smoke,s.smoke);assert.equal(next.elapsedSeconds-s.elapsedSeconds,2);assert.deepEqual(s,before);assert.doesNotThrow(()=>validateBattleSnapshot(next));
  const empty=field({loaded:0,ammo:0,ap,offHand},{exploration:true,enemies:[]}),v=empty.units[0],blocked=targetPreview(empty,v,null,{mode:'fire'});assert.equal(blocked.valid,false);assert.equal(blocked.cursor,'empty');assert.equal(blocked.pa,0);assert.equal(blocked.remaining,ap);assert.match(blocked.reason,/Sin munición/);
  const rejected=actBattle(empty,tacticalInputAction(empty,v,{type:'firePoint',unitId:'p',x:7,y:2,aim:4}));assert.ok(rejected.lastError);assert.deepEqual(physical(rejected),physical(empty));
 }
});
