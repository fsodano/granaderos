import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {orderDescriptors} from '../game/ja2-hud.js';
import {componentTree} from './component-tree.mjs';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {JA2OrdersPanel}=await import('../web/app/JA2OrdersMenu.tsx');
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const nodes=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).flatMap(nodes)];
function field(patch={}){
 const s=createBattle([{id:'p',x:2,y:2,weapon:1805,loaded:1,ammo:2,jammed:false,priming:3,
  offHand:{weapon:1806,loaded:1,condition:80,jammed:true,count:1,weight:1.2,instanceId:'left-reprime-ui'},...patch}],
 {width:16,height:8,seed:45,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',x:14,y:6,patrol:false,overwatch:false}]});s.units[0].ap=patch.ap??100;return s;
}
function panel(battle,onOrder){return {battle,unit:battle.units[0],mode:'move',aim:0,firearm:true,cannonId:'',shotType:'solid',artillery:[],busy:false,onOrder,onMode(){},onToggleSight(){},onEndTurn(){},onOpenInventory(){},onCannonChange(){},onShotTypeChange(){}};}

test('the existing order panel exposes the second pan and both pans with actual affordable costs',()=>{
 for(const [patch,label,pa] of [[{},'Cebar segunda mano',15],[{jammed:true},'Cebar ambas pistolas',30],[{jammed:true,ap:15},'Cebar',15]]){
  const s=field(patch),descriptor=orderDescriptors(s,s.units[0]).find(d=>d.id==='reprime');
  assert.equal(descriptor.label,label);assert.equal(descriptor.pa,pa);assert.equal(descriptor.disabled,false);
  let sent;const buttons=nodes(componentTree(JA2OrdersPanel,panel(s,a=>sent=a))).filter(n=>n.type==='button');
  const button=buttons.find(n=>n.props['aria-label']===label);assert.ok(button);assert.equal(button.props.disabled,false);
  assert.ok(!buttons.some(n=>n.props['aria-label']?.startsWith('Recargar')));button.props.onClick();assert.deepEqual(sent,{type:'reprime'});
  const n=actBattle(s,{unitId:'p',...sent});assert.equal(n.lastError,null);assert.equal(n.units[0].ap,s.units[0].ap-pa);
 }
 const empty=field({priming:0});assert.equal(orderDescriptors(empty,empty.units[0]).find(d=>d.id==='reprime').disabled,false);
});

test('actual R input prepares the held second pistol and a later R resumes ordinary loading',async t=>{
 let battle=field(),commits=[];
 const props=()=>({battle,onChange:next=>{battle=next;commits.push(next);return next;},onFinish(){}});
 const mounted=await mountBattlefield(t,Battlefield,props(),{virtualTimers:true});
 const pressR=async()=>{await mounted.act(async()=>document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key:'r',bubbles:true})));await mounted.settle();};
 await pressR();assert.equal(commits.length,1);assert.equal(battle.units[0].offHand.jammed,false);assert.equal(battle.units[0].jammed,false);
 assert.equal(battle.units[0].priming,undefined);assert.equal(battle.units[0].ap,85);assert.equal(battle.units[0].loaded,1);assert.equal(battle.units[0].offHand.loaded,1);
 await mounted.render(props());await pressR();assert.equal(commits.length,2);assert.match(battle.lastError,/No falta carga/);
 assert.equal(battle.units[0].priming,undefined);assert.equal(battle.units[0].ap,85,'a full pair cannot consume extra AP');
});

test('R cannot service a hidden pocket pistol or act while editing text',async t=>{
 let battle=field({leftHandItem:null}),commits=[];
 const mounted=await mountBattlefield(t,Battlefield,{battle,onChange:next=>{battle=next;commits.push(next);return next;},onFinish(){}},{virtualTimers:true});
 const input=document.createElement('input');document.body.append(input);
 await mounted.act(async()=>input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'r',bubbles:true})));assert.equal(commits.length,0);
 await mounted.act(async()=>document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key:'r',bubbles:true})));assert.equal(commits.length,1);
 assert.match(battle.lastError,/No falta carga/);assert.equal(battle.units[0].offHand.jammed,true);assert.equal(battle.units[0].priming,undefined);
});

test('a failed spare with no priming does not block R or the control from loading the main gun',async t=>{
 let battle=field({loaded:0,priming:0}),commits=[];
 const buttons=nodes(componentTree(JA2OrdersPanel,panel(battle,()=>{}))).filter(n=>n.type==='button');
 assert.ok(buttons.some(n=>n.props['aria-label']==='Recargar'&&!n.props.disabled));
 const mounted=await mountBattlefield(t,Battlefield,{battle,onChange:next=>{battle=next;commits.push(next);return next;},onFinish(){}},{virtualTimers:true});
 await mounted.act(async()=>document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key:'r',bubbles:true})));
 await mounted.settle();
 assert.equal(commits.length,1);assert.equal(battle.lastError,null);assert.equal(battle.units[0].loaded,1);
 assert.equal(battle.units[0].offHand.jammed,true);assert.equal(battle.units[0].offHand.loaded,1);assert.equal(battle.units[0].priming,undefined);
});
