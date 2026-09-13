import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {componentTree} from './component-tree.mjs';
import {createBattle,actBattle,reloadPlan} from '../game/tactical.js';
import {targetPreview,emptyGunPreview,orderDescriptors,orderAction,tacticalInputAction} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {WEAPONS} from '../game/data.js';
import {addAmmunition,ammunitionByType,totalReserveAmmunition,weaponAmmoType} from '../game/ammunition-types.js';
import {syncUnitAmmunition} from '../game/tactical-ammunition.js';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
const {default:AimCursor}=await import('../web/app/AimCursor.tsx');
const {JA2OrdersPanel}=await import('../web/app/JA2OrdersMenu.tsx');
const second=(patch={})=>({weapon:1808,count:1,weight:1.3,loaded:0,condition:63,jammed:false,instanceId:'left-pistol',name:'Segunda de familia',...patch});
function field(patch={},extra={}){
 const s=createBattle([{id:'p',x:2,y:2,facing:2,weapon:1805,weaponInstanceId:'right-pistol',loaded:0,ammo:3,condition:91,offHand:second(),...patch}],{width:16,height:8,seed:45,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',x:7,y:2,overwatch:false,patrol:false}],...extra});
 const u=s.units[0],count=patch.ammo??3,other=weaponAmmoType(u.offHand?.weapon);
 // Keep the original finite reserve: one prepared main-pistol load, then
 // distinct cartridges for the two barrels of the secondary pistol.
 const main=other?Math.min(count,Math.max(0,WEAPONS[u.weapon].capacity-u.loaded)):count;
 setTestAmmunition(u,main);if(count-main)addAmmunition(u,other,count-main);syncUnitAmmunition(u);
 u.ap=patch.ap??100;for(const enemy of s.units.slice(1))enemy.ap=0;return s;
}
const reload=s=>orderDescriptors(s,s.units[0]).find(d=>d.id==='reload');
const click=s=>actBattle(s,tacticalInputAction(s,s.units[0],{type:'firePoint',unitId:'p',x:8,y:2,aim:4}));
const pressReload=s=>actBattle(s,{unitId:'p',...orderAction(s,s.units[0],{},'reload')});
const physical=s=>({...s,lastError:null,log:[]});
const restore=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).flatMap(nodes)];
function panel(s,onOrder=()=>{}){return {battle:s,unit:s.units[0],mode:'fire',aim:4,firearm:true,cannonId:'',shotType:'solid',artillery:[],busy:false,onOrder,onMode(){},onToggleSight(){},onEndTurn(){},onOpenInventory(){},onCannonChange(){},onShotTypeChange(){}};}

test('empty-pistol preview shows one reload order with exact rounds and AP for each hand',()=>{
 const s=field(),u=s.units[0],before=structuredClone(s),p=targetPreview(s,u,s.units[1],{mode:'fire',aim:4,hitLocation:'head'});
 assert.deepEqual(ammunitionByType(u),{pistol_69:1,pistol_54:2});assert.equal(u.ammo,1,'the main-pistol projection excludes the secondary prepared load');
 assert.equal(p.valid,true);assert.equal(p.actionLabel,'Recargar ambas pistolas');assert.equal(p.attackType,'reload');assert.equal(p.cursor,'reload');assert.equal(p.pa,87);assert.equal(p.rounds,3);assert.equal(p.remaining,13);
 assert.match(p.coverNote,/Mano principal: carga 1 cartucho \(32 PA\)/);assert.match(p.coverNote,/Segunda mano: carga 2 cartuchos \(55 PA\)/);assert.match(p.coverNote,/Quedan 0 cartuchos de reserva/);assert.equal(reload(s).disabled,false);assert.equal(reload(s).pa,p.pa);
 const html=render(h('svg',null,h(AimCursor,{point:{x:80,y:80},aim:4,preview:p,target:s.units[1]})));assert.match(html,/Recargar ambas pistolas · 87 PA/);assert.match(html,/13 PA restantes/);assert.match(html,/aim-reload/);assert.doesNotMatch(html,/aim-step|Cabeza/);
 const next=click(s);assert.equal(next.lastError,null);assert.equal(next.units[0].loaded,1);assert.equal(next.units[0].offHand.loaded,2);assert.equal(totalReserveAmmunition(next.units[0]),0);assert.equal(next.units[0].ap,13);assert.equal(next.units[0].condition,u.condition);assert.equal(next.units[0].offHand.condition,u.offHand.condition);assert.equal(next.units[1].hp,s.units[1].hp);assert.deepEqual(next.smoke,s.smoke);assert.deepEqual(s,before);assert.deepEqual(next,click(restore(s)));assert.doesNotThrow(()=>restore(next));
});

test('finite reserve goes to the main gun first and the preview never promises unavailable rounds',()=>{
 for(const [ammo,cost,left] of [[1,32,0],[2,60,1],[3,87,2]]){
  const s=field({ammo}),p=emptyGunPreview(s,s.units[0]);assert.equal(p.valid,true);assert.equal(p.pa,cost);assert.equal(p.rounds,ammo);assert.doesNotMatch(p.coverNote,/queda pendiente/);
  if(left)assert.match(p.coverNote,new RegExp(`Segunda mano: carga ${left} cartucho`));else assert.doesNotMatch(p.coverNote,/Segunda mano: carga|ambas pistolas/);
  const next=click(s);assert.equal(next.lastError,null);assert.equal(next.units[0].loaded,1);assert.equal(next.units[0].offHand.loaded,left);assert.equal(totalReserveAmmunition(next.units[0]),0);assert.equal(next.units[0].ap,100-cost);
 }
 const empty=field({ammo:0}),p=emptyGunPreview(empty,empty.units[0]);assert.equal(p.cursor,'empty');assert.equal(p.valid,false);assert.equal(reload(empty).disabled,true);assert.match(p.reason,/Sin munición/);assert.deepEqual(physical(click(empty)),physical(empty));
});

test('one AP short of both reloads spends only main-hand work and reports the second hand pending',()=>{
 const s=field({ap:86}),u=s.units[0],p=emptyGunPreview(s,u);assert.equal(reloadPlan(u,s).offhandPending,true);assert.equal(p.actionLabel,'Recargar');assert.equal(p.pa,32);assert.equal(p.rounds,1);assert.equal(p.remaining,54);assert.equal(p.partial,false);assert.match(p.coverNote,/segunda mano queda pendiente/i);assert.doesNotMatch(p.coverNote,/Segunda mano: carga|Recargar ambas/);
 const next=click(s);assert.equal(next.lastError,null);assert.equal(next.units[0].loaded,1);assert.deepEqual(next.units[0].offHand,u.offHand);assert.equal(totalReserveAmmunition(next.units[0]),2);assert.equal(next.units[0].ap,54);assert.doesNotThrow(()=>restore(next));
});

test('unfinished main loading shows only paid progress and leaves both reserve and offhand untouched',()=>{
 const s=field({ap:20}),u=s.units[0],p=emptyGunPreview(s,u);assert.equal(p.actionLabel,'Recarga parcial');assert.equal(p.partial,true);assert.equal(p.pa,20);assert.equal(p.rounds,0);assert.equal(p.remainingReloadPA,12);assert.match(p.coverNote,/Mano principal: recarga parcial, carga 0 cartuchos \(20 PA\)/);assert.match(p.coverNote,/Faltan 12 PA/);assert.doesNotMatch(p.coverNote,/Segunda mano: carga/);
 const next=click(s);assert.equal(next.lastError,null);assert.equal(next.units[0].loaded,0);assert.equal(next.units[0].reloadProgress,.625);assert.equal(totalReserveAmmunition(next.units[0]),3);assert.equal(next.units[0].ap,0);assert.deepEqual(next.units[0].offHand,u.offHand);assert.doesNotThrow(()=>restore(next));
});

test('a full main gun enables the actual second-hand reload button and lets injured soldiers pay partial work',()=>{
 const s=field({loaded:1,ap:20}),u=s.units[0],d=reload(s);assert.equal(d.disabled,false);assert.equal(d.label,'Recarga parcial: segunda mano');assert.equal(d.pa,20);assert.equal(emptyGunPreview(s,u),null);
 let sent;const button=nodes(componentTree(JA2OrdersPanel,panel(s,a=>sent=a))).find(n=>n.type==='button'&&n.props['aria-label']===d.label);assert.ok(button);assert.equal(button.props.disabled,false);button.props.onClick();assert.deepEqual(sent,{type:'reload'});
 const next=actBattle(s,{unitId:'p',...sent});assert.equal(next.lastError,null);assert.equal(next.units[0].loaded,1);assert.equal(next.units[0].reloadProgress,undefined);assert.equal(next.units[0].offHand.loaded,0);assert.equal(next.units[0].offHand.reloadProgress,20/27.5);assert.equal(totalReserveAmmunition(next.units[0]),3);assert.equal(next.units[0].ap,0);assert.doesNotThrow(()=>restore(next));
 const continued=restore(next);continued.units[0].ap=35;assert.equal(reload(continued).label,'Recargar segunda mano');assert.equal(reload(continued).pa,35);const done=pressReload(continued);assert.equal(done.lastError,null);assert.equal(done.units[0].loaded,1);assert.equal(done.units[0].offHand.loaded,2);assert.equal(done.units[0].offHand.reloadProgress,undefined);assert.equal(totalReserveAmmunition(done.units[0]),1);assert.equal(done.units[0].ap,0);
});

test('exploration reloads both hands at zero AP and advances only their actual work time',()=>{
 const s=field({ap:0,ammo:2},{exploration:true,enemies:[]}),p=emptyGunPreview(s,s.units[0]);assert.equal(p.valid,true);assert.equal(p.pa,0);assert.equal(p.remaining,0);assert.match(p.coverNote,/Mano principal: carga 1 cartucho/);assert.match(p.coverNote,/Segunda mano: carga 1 cartucho/);assert.doesNotMatch(p.coverNote,/\d+ PA|queda pendiente/);assert.equal(reload(s).disabled,false);assert.equal(reload(s).pa,0);
 const next=click(s);assert.equal(next.lastError,null);assert.equal(next.units[0].ap,0);assert.equal(next.units[0].loaded,1);assert.equal(next.units[0].offHand.loaded,1);assert.equal(totalReserveAmmunition(next.units[0]),0);assert.equal(next.elapsedSeconds,4);
 const full=field({loaded:1,ap:0,ammo:2},{exploration:true,enemies:[]});assert.equal(reload(full).disabled,false);assert.equal(reload(full).label,'Recargar segunda mano');assert.equal(reload(full).pa,0);const done=pressReload(full);assert.equal(done.lastError,null);assert.equal(done.units[0].ap,0);assert.equal(done.units[0].offHand.loaded,2);assert.equal(totalReserveAmmunition(done.units[0]),0);
});

test('stowed or unserviceable secondary guns stay out of reload controls, and primary jams retain reprime',()=>{
 for(const patch of [{leftHandItem:null},{offHand:second({jammed:true})},{offHand:second({condition:0})},{offHand:undefined}]){
  const s=field(patch),p=emptyGunPreview(s,s.units[0]);assert.equal(p.actionLabel,'Recargar');assert.equal(p.pa,32);assert.doesNotMatch(p.coverNote,/Segunda mano|ambas pistolas/);s.units[0].loaded=1;assert.equal(reload(s).disabled,true);
 }
 const jammed=field({jammed:true,priming:4}),u=jammed.units[0];assert.equal(reload(jammed).disabled,true);assert.equal(emptyGunPreview(jammed,u).valid,false);assert.match(emptyGunPreview(jammed,u).reason,/Cebá el arma/);
 let sent;const tree=componentTree(JA2OrdersPanel,panel(jammed,a=>sent=a)),buttons=nodes(tree).filter(n=>n.type==='button');assert.ok(!buttons.some(n=>n.props['aria-label']?.startsWith('Recargar')));const reprime=buttons.find(n=>n.props['aria-label']==='Cebar');assert.ok(reprime);assert.equal(reprime.props.disabled,false);reprime.props.onClick();assert.deepEqual(sent,{type:'reprime'});
 const next=actBattle(jammed,{unitId:'p',...sent});assert.equal(next.lastError,null);assert.equal(next.units[0].jammed,false);assert.equal(next.units[0].loaded,u.loaded);assert.deepEqual(next.units[0].offHand,u.offHand);assert.equal(totalReserveAmmunition(next.units[0]),totalReserveAmmunition(u));assert.equal(next.units[0].priming,3);
});

test('empty-pistol reload information is independent of unseen people at the selected coordinates',()=>{
 const s=field(),hidden=s.units[1];s.night=true;Object.assign(hidden,{x:15,y:7,stance:'prone',name:'Nombre privado',hp:20});const empty=structuredClone(s);empty.units=empty.units.filter(u=>u.id!==hidden.id);
 const p=targetPreview(s,s.units[0],hidden,{mode:'fire',aim:4,hitLocation:'head'});assert.deepEqual(p,targetPreview(empty,empty.units[0],hidden,{mode:'fire',aim:4,hitLocation:'head'}));assert.equal(p.chance,undefined);assert.equal(p.hitLocation,undefined);assert.doesNotMatch(JSON.stringify(p),/Nombre privado/);
});
