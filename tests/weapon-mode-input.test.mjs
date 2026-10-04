import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createElement as h,act} from '../web/node_modules/react/index.js';
import {createRoot} from '../web/node_modules/react-dom/client.js';
import {createBattle,actBattle,meleePreview,meleePointPreview,getMeleeAttackResult} from '../game/tactical.js';
import {attackCursorMode,retainedAttackCursor,targetItemAction,targetPreview,tacticalInputAction,resolvedOrderType,targetingHelp} from '../game/ja2-hud.js';
import {rightClickAim} from '../game/aim-cursor.js';
import {componentTree} from './component-tree.mjs';
import {battleTimers} from './battle-timers-fixture.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {default:JA2Conversation}=await import('../web/app/JA2Conversation.tsx');

const fitted={weapon:1800,weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'input-bayonet',condition:80}}};
const variants=[
 ['loaded jammed pistol',{weapon:1805,loaded:1,ammo:5,jammed:true,priming:0,flints:0}],
 ['empty pistol with reserve',{weapon:1805,loaded:0,ammo:5,jammed:false}],
 ['empty jammed gun without reserve',{weapon:1800,loaded:0,ammo:0,jammed:true,priming:0,flints:0}],
 ['fitted bayonet on a jammed gun',{...fitted,loaded:1,ammo:5,jammed:true,priming:0,flints:0}],
];
function field(patch={},targetX=5){
 const battle=createBattle([{id:'p',name:'Granadero',x:2,y:3,facing:2,hp:100,energy:100,strength:100,dexterity:100,agility:100,experienceLevel:10,condition:100,activeSlot:'primary',...patch}],{
  id:'weapon-mode-input',width:14,height:9,seed:45,
  tiles:Array.from({length:126},(_,i)=>({x:i%14,y:Math.floor(i/14),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'e',name:'Realista',x:targetX,y:3,hp:100,maxHp:100,agility:0,dexterity:0,experienceLevel:1,morale:100,patrol:false,overwatch:false},{id:'reserve',x:12,y:7,patrol:false,overwatch:false}],
 });
 battle.units[0].ap=100;for(const enemy of battle.units.filter(u=>u.side==='enemy'))enemy.ap=0;return battle;
}
const actor=b=>b.units.find(u=>u.id==='p'),enemy=b=>b.units.find(u=>u.id==='e');
const ammunition=u=>Object.fromEntries(['loaded','ammo','ammunition','jammed','priming','flints','reloadProgress'].map(key=>[key,u[key]]));
const physicalState=({lastKnownEnemy,lastHeardNoise,...state})=>state;
const order=(b,action)=>{const next=actBattle(b,{unitId:'p',...action});assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).flatMap(nodes)];

// Mount the actual Battlefield hook controller and equipment provider while
// inspecting child props. This works with both synchronous and worker-backed
// map builds; this regression does not deliver or require worker movement.
async function mountController(t,props){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{pretendToBeVisual:true});
 let frameTime=0,frameId=0;const frames=new Map();
 class Worker{postMessage(){}terminate(){this.closed=true;}}
 const globals={window:dom.window,document:dom.window.document,Worker,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:callback=>{frames.set(++frameId,callback);return frameId;},cancelAnimationFrame:id=>frames.delete(id),performance:new Proxy(performance,{get(target,key){if(key==='now')return()=>frameTime;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}})};
 const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 let tree;const wrapper=Battlefield(props),content=wrapper.props.children;let current=content.props;
 function Capture(){tree=content.type(current);return null;}
 const timers=battleTimers(act),root=createRoot(dom.window.document.getElementById('root'));
 t.after(async()=>{try{await act(async()=>root.unmount());}finally{timers.restore();dom.window.close();for(const [key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
 const render=async props=>{current=props;await act(async()=>root.render(h(wrapper.type,null,h(Capture))));};
 await render(current);return {tree:()=>tree,act,render,settle:observe=>timers.until(()=>!nodes(tree).some(n=>n.props?.['data-enemy-frame']),observe),async frame(ms){frameTime+=ms;const callbacks=[...frames.values()];frames.clear();await act(async()=>{for(const callback of callbacks)callback(frameTime);});}};
}

for(const [name,patch]of variants)for(const prone of [false,true])test(`${name}: F and repeated right-click retain melee and pay ${prone?'crawl, standing and strike':'approach and strike'} costs`,()=>{
 const start=field({...patch,...(prone?{stance:'prone',movementMode:'prone'}:{})});
 const battle=order(start,{type:'weaponMode',mode:'melee'}),unit=actor(battle),target=enemy(battle),before=structuredClone(battle);
 assert.equal(unit.ap,actor(start).ap);assert.equal(battle.elapsedSeconds,start.elapsedSeconds);assert.equal(battle.seed,start.seed);
 assert.equal(attackCursorMode(unit),'useItem');
 let cursor=rightClickAim(battle,unit,{mode:'fire',aim:4,target});
 for(let i=0;i<5;i++){assert.deepEqual(cursor,{mode:'useItem',aim:0});cursor=rightClickAim(battle,unit,{...cursor,target});}
 assert.deepEqual(battle,before,'selection and right-click do not pay an action or touch equipment');
 const action={unitId:unit.id,...targetItemAction(cursor.mode,target.id,unit)},input=tacticalInputAction(battle,unit,action),plan=meleePreview(battle,unit,target,{approach:true});
 assert.deepEqual(input,action);assert.equal(input.type,'useItem');assert.equal(resolvedOrderType(battle,unit,input),'melee');
 const preview=targetPreview(battle,unit,target,cursor);assert.equal(preview.valid,true);assert.equal(preview.attackType,'melee');assert.match(preview.attackLabel,patch.weaponFittings?/bayoneta/:/Culatazo/);assert.equal(preview.pa,plan.pa);assert.ok(plan.movePa>0);assert.equal(plan.stancePa,prone?6:0);
 const next=order(battle,input);assert.ok(enemy(next).hp<target.hp,'the accepted input performs a real melee strike');assert.equal(actor(next).ap,unit.ap-plan.pa);assert.equal(actor(next).stance,'standing');assert.deepEqual(ammunition(actor(next)),ammunition(unit));assert.deepEqual(next.smoke,battle.smoke);
 assert.deepEqual({x:actor(next).x,y:actor(next).y},{x:plan.destination.x,y:plan.destination.y});
 if(patch.weaponFittings)assert.equal(actor(next).weaponFittings.bayonet.condition,unit.weaponFittings.bayonet.condition-1);
 const short=structuredClone(battle);actor(short).ap=plan.pa-1;const rejected=actBattle(short,input);assert.ok(rejected.lastError);assert.deepEqual(rejected.units,short.units,'a short approach cannot spend a partial melee order');
});

test('a stale fire cursor normalizes to the selected gun mode and B restores firearm warnings',()=>{
 for(const [name,patch]of variants){
  const melee=order(field(patch),{type:'weaponMode',mode:'melee'}),u=actor(melee);
  assert.equal(retainedAttackCursor(u,'fire'),'useItem',name);assert.match(targetingHelp('useItem',u),/B: volver a Disparo/);
  const restored=order(melee,{type:'weaponMode',mode:'fire'}),gun=actor(restored),cursor=rightClickAim(restored,gun,{mode:'move',target:enemy(restored)});
  assert.equal(attackCursorMode(gun),'fire');assert.equal(retainedAttackCursor(gun,'fire'),'fire');assert.deepEqual(cursor,{mode:'fire',aim:0});assert.deepEqual(ammunition(gun),ammunition(u));
  const preview=targetPreview(restored,gun,enemy(restored),cursor);
  if(gun.jammed){assert.equal(preview.valid,false);assert.match(preview.reason,/Cebá|Sin munición/);}
  else{assert.equal(preview.attackType,'reload');assert.equal(preview.valid,true);assert.equal(tacticalInputAction(restored,gun,{unitId:gun.id,...targetItemAction('fire','e',gun)}).type,'reload');}
 }
});

async function controller(t,patch,{npc=false,setup}={}){
 let battle=field(patch,3);if(npc)battle.npcs=[{id:'civilian',name:'Paisano',dialogue:'special',x:3,y:4,hp:100,maxHp:100,stance:'standing'}];
 if(setup)setup(battle);
 const commits=[],props=()=>({battle,onChange:next=>{battle=next;commits.push(next);return next;},onFinish(){},onTalk(){}});
 const mounted=await mountController(t,props()),find=type=>nodes(mounted.tree()).find(node=>node.type===type),scene=()=>find(TacticalScene),svg=()=>nodes(mounted.tree()).find(node=>node.props?.className?.startsWith('tactical-field'));
 const render=()=>mounted.render(props());
 const presented=[];
 return {mounted,scene,find,commits,presented,battle:()=>battle,
  async key(key){await mounted.act(async()=>document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true})));await render();},
  async rightClick(id='e'){
   const person=document.createElement('div');person.setAttribute('data-unit-id',id);const hit=document.createElement('span');hit.setAttribute('data-person-hit-target','true');person.append(hit);
   await mounted.act(async()=>svg().props.onContextMenu({preventDefault(){},target:hit,currentTarget:{getScreenCTM:()=>null},clientX:0,clientY:0}));
  },
  async tile(point){await mounted.act(async()=>scene().props.onTile(point));await mounted.settle(()=>presented.push({frame:svg().props['data-enemy-frame'],pose:scene().props.poses.p,position:scene().props.positions.p,commits:commits.length}));await render();},
 };
}

for(const [name,patch]of [variants[0],variants[1],[variants[3][0],{...variants[3][1],stance:'prone',movementMode:'prone'}]])test(`mounted Battlefield B, F, right-click and target-click use ${name} for melee`,async t=>{
 const c=await controller(t,patch);await c.key('b');assert.equal(actor(c.battle()).weaponMode,'melee');
 await c.key('f');assert.equal(c.scene().props.mode,'useItem');assert.equal(c.scene().props.aim,0);
 const before=structuredClone(c.battle()),count=c.commits.length;
 for(let i=0;i<3;i++){await c.rightClick();assert.equal(c.scene().props.mode,'useItem');assert.equal(c.scene().props.aim,0);}
 assert.equal(c.commits.length,count);assert.deepEqual(c.battle(),before);
 const cost=meleePreview(before,actor(before),enemy(before),{approach:true}).pa;
 await c.tile(enemy(c.battle()));assert.equal(c.battle().lastError,null);assert.ok(enemy(c.battle()).hp<enemy(before).hp);assert.equal(actor(c.battle()).ap,actor(before).ap-cost);assert.deepEqual(ammunition(actor(c.battle())),ammunition(actor(before)));assert.deepEqual(c.battle().smoke,before.smoke);
 await c.key('b');assert.equal(actor(c.battle()).weaponMode,'fire');await c.key('f');assert.equal(c.scene().props.mode,'fire');
 const preview=targetPreview(c.battle(),actor(c.battle()),enemy(c.battle()),{mode:'fire'});
 if(actor(c.battle()).jammed){assert.equal(preview.valid,false);assert.match(preview.reason,/Cebá/);}else assert.equal(preview.attackType,'reload');
});

for(const [name,patch,point,input]of [
 ['adjacent jammed pistol',variants[0][1],{x:2,y:4},'f'],
 ['distant jammed pistol',variants[0][1],{x:6,y:5},'right-click'],
 ['adjacent empty pistol',variants[1][1],{x:2,y:4},'right-click'],
 ['distant empty pistol',variants[1][1],{x:6,y:5},'f'],
 ['prone bayonet approach',{...variants[3][1],stance:'prone',movementMode:'prone'},{x:6,y:5},'f'],
])test(`mounted ${name}: B and ${input} prepare a real empty-ground swing and strike pose`,async t=>{
 const c=await controller(t,patch);await c.key('b');if(input==='f')await c.key('f');else await c.rightClick();assert.equal(c.scene().props.mode,'useItem');assert.equal(c.scene().props.aim,0);
 const before=c.battle(),copy=structuredClone(before),p=meleePointPreview(before,actor(before),point),preview=targetPreview(before,actor(before),point,{mode:'useItem'}),count=c.commits.length;
 assert.equal(p.valid,true);assert.equal(preview.valid,true);assert.equal(preview.attackType,'meleePoint');assert.equal(preview.pa,p.pa);assert.equal(preview.chance,undefined);assert.equal(preview.hitLocation,undefined);
 await c.tile(point);assert.equal(c.commits.length,count+1);assert.equal(c.battle().lastError,null);assert.equal(actor(c.battle()).ap,actor(before).ap-p.pa);assert.equal(getMeleeAttackResult(before,c.battle(),'p'),true);
 if(p.movePa){assert.ok(c.presented.some(frame=>frame.frame.includes(':step:')));assert.ok(c.presented.filter(frame=>frame.frame.includes(':step:')).every(frame=>frame.pose!=='strike'));}
 assert.ok(c.presented.some(frame=>frame.pose==='strike'));assert.equal(c.scene().props.aim,0);assert.deepEqual(ammunition(actor(c.battle())),ammunition(actor(before)));assert.deepEqual(c.battle().smoke,before.smoke);assert.deepEqual(c.battle().units.filter(u=>u.id!=='p').map(physicalState),before.units.filter(u=>u.id!=='p').map(physicalState),'walking and swinging may reveal noise, but cannot damage or move another actor');assert.equal(c.battle().seed,before.seed);assert.deepEqual(before,copy);
 if(p.destination)assert.deepEqual([actor(c.battle()).x,actor(c.battle()).y],[p.destination.x,p.destination.y]);else assert.deepEqual([actor(c.battle()).x,actor(c.battle()).y],[actor(before).x,actor(before).y]);
 if(p.stancePa)assert.equal(actor(c.battle()).stance,'standing');
 if(actor(before).weaponFittings)assert.deepEqual(actor(c.battle()).weaponFittings,actor(before).weaponFittings,'an empty swing causes no impact wear');
});

test('mounted long empty-ground approach presents every paid step before the strike and final commit',async t=>{
 const c=await controller(t,variants[0][1]);await c.key('b');assert.equal(c.scene().props.mode,'useItem','B alone prepares the selected close attack');const point={x:10,y:6},before=c.battle(),p=meleePointPreview(before,actor(before),point);assert.equal(p.valid,true);assert.ok(p.path.length*240>1200);
 const count=c.commits.length;await c.tile(point);assert.equal(getMeleeAttackResult(before,c.battle(),'p'),true);
 const steps=c.presented.filter(frame=>frame.frame.includes(':step:'));assert.ok(steps.length>=p.path.length-1);assert.ok(steps.every(frame=>frame.pose!=='strike'));
 const strike=c.presented.findIndex(frame=>frame.pose==='strike'),lastStep=c.presented.findLastIndex(frame=>frame.frame.includes(':step:'));
 assert.ok(strike>lastStep,'the actual strike is shown after the recorded approach');assert.ok(c.presented.every(frame=>frame.commits===count));assert.equal(c.commits.length,count+1);
 assert.notEqual(c.scene().props.poses.p,'strike','the completed presentation releases its strike pose');
});

test('mounted reaction-cancelled approach never plays a strike after the reached tile settles',async t=>{
 const c=await controller(t,{...variants[0][1],agility:30,experienceLevel:1},{setup:s=>Object.assign(enemy(s),{x:5,y:5,facing:0,weapon:1806,marksmanship:70,agility:100,experienceLevel:10,overwatch:true,ap:6})});await c.key('b');await c.key('f');const before=c.battle();await c.tile({x:6,y:3});
 assert.equal(c.battle().lastError,null);assert.equal(enemy(c.battle()).reactionTurn,before.turn);assert.equal(getMeleeAttackResult(before,c.battle(),'p'),false);assert.notEqual(c.scene().props.poses.p,'strike');await c.mounted.frame(10000);assert.equal(c.scene().props.positions.p.moving,false);assert.notEqual(c.scene().props.poses.p,'strike');assert.deepEqual(ammunition(actor(c.battle())),ammunition(actor(before)));
});

test('mounted close-combat targeting retains civilian conversation without an attack',async t=>{
 const c=await controller(t,variants[0][1],{npc:true});await c.key('b');await c.key('f');const before=structuredClone(c.battle()),count=c.commits.length;
 await c.rightClick('civilian');assert.equal(c.scene().props.mode,'useItem');assert.equal(c.scene().props.aim,0);
 const sceneTree=componentTree(TacticalScene,c.scene().props),talk=nodes(sceneTree).find(node=>node.type==='rect'&&node.props['aria-label']?.startsWith('Hablar con Paisano ·'));assert.ok(talk,'a civilian keeps its conversation affordance');
 await c.mounted.act(async()=>talk.props.onClick({}));assert.equal(c.find(JA2Conversation)?.props.npc.id,'civilian');assert.equal(c.commits.length,count);assert.deepEqual(c.battle(),before);
});
