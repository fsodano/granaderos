import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle} from '../game/tactical.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];

for(const delivery of ['early','late'])test(`real map input redirects and runs with ${delivery} speculative worker delivery`,async t=>{
 let now=1000,sequence=0;const frames=new Map(),commits=[];
 const clock={now:()=>now,request:callback=>{frames.set(++sequence,callback);return sequence;},cancel:id=>frames.delete(id)};
 let battle=createBattle([{id:'p',name:'Caminante',x:1,y:1}],{width:16,height:8,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[]});
 const props=()=>({battle,onChange:next=>{battle=next;commits.push(next);return next;},onFinish(){}});
 const mounted=await mountBattlefield(t,Battlefield,props(),{clock});
 const get=type=>nodes(mounted.tree()).find(node=>node.type===type),svg=()=>nodes(mounted.tree()).find(node=>node.props?.className?.startsWith('tactical-field'));
 const click=async(point,detail=1)=>mounted.act(async()=>{svg().props.onClickCapture({detail,shiftKey:false,altKey:false,ctrlKey:false,metaKey:false});get(TacticalScene).props.onTile(point);});
 const frame=async elapsed=>{now+=elapsed;const callbacks=[...frames.values()];frames.clear();await mounted.act(async()=>{for(const callback of callbacks)callback(now);});};
 const jobs=()=>mounted.jobs().filter(message=>message.job.kind==='movement-step');
 await click({x:7,y:1});assert.equal(jobs().length,1,'the first click starts immediately');
 assert.equal(jobs()[0].job.action.x,7);
 await mounted.deliver('movement-step');await mounted.render(props());
 assert.equal(commits.length,1);assert.equal(battle.units[0].x,2);assert.equal(battle.elapsedSeconds,3);
 assert.equal(jobs().length,1);assert.equal(jobs()[0].job.battle,battle,'the next pure calculation uses the accepted paid state');
 await frame(120);assert.equal(get(TacticalScene).props.positions.p.x,1.5);assert.equal(get(TacticalScene).props.positions.p.moving,true);
 await click({x:2,y:6});assert.equal(jobs().length,1,'a redirect never starts a second simultaneous worker');
 await click({x:2,y:6},2);await click({x:2,y:6},3);
 await mounted.deliver('movement-step');assert.equal(commits.length,1,'the abandoned speculative result has no effect');assert.equal(jobs().length,1);
 assert.equal(jobs()[0].job.action.x,2);assert.equal(jobs()[0].job.action.y,6);assert.equal(jobs()[0].job.action.movement,'run');
 assert.equal(jobs()[0].job.continuation,undefined,'the abandoned destination cannot supply the next route');
 if(delivery==='early'){await mounted.deliver('movement-step');assert.equal(commits.length,1,'a prepared result cannot spend the next step before the endpoint');}
 await frame(120);
 assert.equal(get(TacticalScene).props.positions.p.moving,true,'the sprite keeps its gait between committed cells');
 if(delivery==='late'){assert.equal(commits.length,1);await frame(50);assert.equal(get(TacticalScene).props.positions.p.x,2);await mounted.deliver('movement-step');}
 else assert.equal(commits.length,2,'the prepared step commits at the endpoint without waiting for a worker');
 await mounted.render(props());
 assert.equal(battle.units[0].x,2);assert.equal(battle.units[0].y,2);assert.equal(battle.elapsedSeconds,4);assert.equal(battle.units[0].movementMode,'run');
 await frame(75);assert.equal(get(TacticalScene).props.positions.p.y,1.5);assert.equal(get(TacticalScene).props.positions.p.elapsedMs,delivery==='late'?365:315);
 await mounted.act(async()=>document.body.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 await frame(75);assert.equal(get(TacticalScene).props.positions.p.y,2);assert.equal(get(TacticalScene).props.positions.p.moving,false);
 assert.equal(jobs().length,1);await mounted.deliver('movement-step');assert.equal(jobs().length,0);
 assert.equal(commits.length,2,'cancelled future steps never spend time or energy');
});
