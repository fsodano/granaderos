import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {componentTree} from './component-tree.mjs';
import {createBattle,actBattle,getGrenadeThrowVisual} from '../game/tactical.js';
import {makeGrenadeStack} from '../game/grenades.js';
import {targetPreview,grenadeThrowInputAction} from '../game/ja2-hud.js';
import {initialCampaign,dispatchCampaign,rosterFor,isSupplied} from '../game/campaign.js';
import {grenadeOffer} from '../game/equipment.js';
const {default:AimCursor}=await import('../web/app/AimCursor.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {default:GrenadeThrowEffect,GRENADE_EFFECT_DURATION}=await import('../web/app/GrenadeThrowEffect.tsx');
const {default:GrenadeSupplies}=await import('../web/app/GrenadeSupplies.tsx');
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const {BattleAudio}=await import('../web/lib/battle-audio.ts');
const hosts=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(hosts):[node,...hosts(node.props?.children)];
const field=()=>createBattle([{id:'p',name:'Lanzador',x:1,y:1,facing:2,strength:85,dexterity:85,marksmanship:85,weapon:1800,activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack()}}],{width:12,height:8,seed:45,tiles:Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',cover:0,blocked:false})),enemies:[{id:'e',name:'Guardia',x:6,y:1,morale:100,patrol:false,overwatch:false}],npcs:[{id:'civil',name:'Vecino',x:5,y:2,stance:'standing'}]});
const project=(x,y)=>({x:300+(x-y)*26,y:70+(x+y)*14});
const pointer=fraction=>({clientY:100+200*fraction,currentTarget:{getBoundingClientRect:()=>({top:100,height:200})}});

test('grenade reticle shows area and cost without body parts or aim refinement',()=>{
 const s=field();for(const exploring of [false,true]){
  s.mode=exploring?'exploration':'combat';const target=s.units[1],preview=targetPreview(s,s.units[0],target,{mode:'throwGrenade',aim:4,hitLocation:'head'});
  const markup=render(h('svg',null,h(AimCursor,{point:{x:80,y:90},aim:4,preview,target,exploring})));
  assert.match(markup,/Granada · Área/);assert.ok(markup.includes(`Radio ${preview.blastRadius} casillas`));assert.doesNotMatch(markup,/Cabeza|Torso|Piernas|Puntería|aim-step|cartuchos|Recargar|recarga/);
  if(exploring)assert.doesNotMatch(markup,/\bPA\b/);else assert.ok(markup.includes(`${preview.pa} PA`));
 }
});
test('a blocked grenade reticle uses the warning color and names the actual near-side landing',()=>{
 const s=field();Object.assign(s.tiles.find(tile=>tile.x===4&&tile.y===1),{type:'wall',blocked:true,obstacleHeight:6});
 const target={x:6,y:1},preview=targetPreview(s,s.units[0],target,{mode:'throwGrenade'});assert.equal(preview.valid,true);assert.equal(preview.blocked,true);
 const markup=render(h('svg',null,h(AimCursor,{point:{x:80,y:90},aim:0,preview,target})));
 assert.match(markup,/aim-cursor invalid/);assert.match(markup,/Granada · Obstáculo/);assert.ok(markup.includes(`Caída prevista: ${preview.landingLabel}`));assert.ok(markup.includes(`Caída ${preview.landingLabel}`));assert.doesNotMatch(markup,/Granada · Área/);
});
test('grenade sprite hit frames use one ground point and route NPC mouse and keyboard activation to throwing',()=>{
 const s=field();for(const mode of ['useItem','throwGrenade'])for(const id of ['e','civil']){
  let hovered,clicked,talked=false;
  const tree=componentTree(TacticalScene,{state:s,selected:'p',unit:s.units[0],players:[s.units[0]],units:s.units,positions:{},poses:{},directions:{},hover:s.units[1],mode,aim:4,hitLocation:'head',reachable:[],showSight:false,sight:new Set(),revealed:new Set(),project,onTile:t=>clicked=t,onHover:t=>hovered=t,onTalk:()=>talked=true,onCannon(){},cannonId:''});
  const person=hosts(tree).find(node=>node.props?.['data-unit-id']===id),frame=hosts(person).find(node=>node.props?.['data-person-hit-target']);assert.ok(frame);assert.match(frame.props['aria-label'],/Lanzar granada a la casilla/);
  for(const fraction of [.1,.5,.9]){frame.props.onMouseMove(pointer(fraction));assert.equal(hovered.aimLocation,'torso');frame.props.onClick(pointer(fraction));assert.equal(clicked.aimLocation,'torso');assert.equal(talked,false);}
  frame.props.onFocus();assert.equal(hovered.aimLocation,'torso');frame.props.onKeyDown({key:'ArrowDown',preventDefault(){}});assert.equal(hovered.aimLocation,'torso');
  for(const key of ['Enter',' ']){frame.props.onKeyDown({key,preventDefault(){}});assert.equal(talked,false);const action=grenadeThrowInputAction(s,s.units[0],clicked);assert.equal(action.targetId,undefined);assert.equal(action.hitLocation,undefined);assert.equal(action.aim,0);}
 }
});
test('Battlefield movement after cursor cancellation keeps the grenade and moves to the chosen ground',()=>{
 const s=field();s.mode='exploration';s.units=s.units.filter(unit=>unit.side==='player');let next,tree;
 const wrapper=Battlefield({battle:s,onChange:b=>{next=b;return b;},onFinish(){}}),content=wrapper.props.children;
 function Capture(){tree=content.type(content.props);return null;}
 render(h(wrapper.type,null,h(Capture)));const scene=hosts(tree).find(node=>node.type===TacticalScene);assert.ok(scene);assert.equal(scene.props.mode,'move');
 scene.props.onTile({x:2,y:2});assert.ok(next);assert.equal(next.lastError,null);assert.equal(next.units[0].inventory.grenade.count,1);assert.equal(next.units[0].x,2);assert.equal(next.units[0].y,2);assert.equal(getGrenadeThrowVisual(s,next),null);
});
test('Battlefield movement-mode clicks on allies and NPCs never fall through to a grenade useItem order',()=>{
 for(const pointKind of ['ally','npc']){
  const s=field();s.units.push({...structuredClone(s.units[0]),id:'ally',name:'Compañero',x:6,y:2});let next,tree;
  const wrapper=Battlefield({battle:s,onChange:b=>{next=b;return b;},onFinish(){}}),content=wrapper.props.children;
  function Capture(){tree=content.type(content.props);return null;}
  render(h(wrapper.type,null,h(Capture)));const scene=hosts(tree).find(node=>node.type===TacticalScene);
  if(pointKind==='npc')scene.props.onTalk(s.npcs[0]);else scene.props.onTile(s.units.find(unit=>unit.id==='ally'));
  assert.equal(next,undefined);assert.equal(s.units[0].inventory.grenade.count,1);
 }
});
test('ending the turn presents a visible enemy grenade only when the next battle is accepted',t=>{
 let scheduled;t.mock.method(globalThis,'setTimeout',(callback,delay)=>{assert.equal(delay,450);scheduled=callback;return 1;});
 for(const accepted of [true,false]){
  const s=createBattle([{id:'p',name:'Objetivo',x:7,y:4,facing:6,weapon:1813,loaded:0,ammo:0,blade:0,medical:0,medkits:0,patrol:false,overwatch:false}],{
   width:24,height:12,seed:45,tiles:Array.from({length:288},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),
   enemies:[{id:'e',name:'Lanzador',x:1,y:4,facing:2,weapon:1800,loaded:0,ammo:0,blade:0,priming:0,flints:0,rations:0,medkits:0,boleadoras:0,torches:0,marksmanship:100,dexterity:100,strength:100,medical:0,morale:100,patrol:false,overwatch:false,activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack()}}]
  });
  s.units[0].ap=0;s.units[1].ap=100;let next,tree,invoked=false;
  const wrapper=Battlefield({battle:s,onChange:b=>{next=b;return accepted?b:null;},onFinish(){}}),content=wrapper.props.children;
  function Capture(){tree=content.type(content.props);if(!invoked){invoked=true;hosts(tree).find(node=>node.props?.onEndTurn).props.onEndTurn();assert.equal(next,undefined);scheduled();}return null;}
  render(h(wrapper.type,null,h(Capture)));assert.equal(next.lastError,null);const visual=getGrenadeThrowVisual(s,next);assert.ok(visual?.visible);
  const effect=hosts(tree).find(node=>node.type===GrenadeThrowEffect);assert.equal(Boolean(effect),accepted);if(effect)assert.deepEqual(effect.props.visual,visual);
 }
});
test('grenade flight and blast use only the observed arc and expire after a finite animation',()=>{
 const s=field(),next=actBattle(s,{type:'throwGrenade',unitId:'p',x:6,y:2}),visual=getGrenadeThrowVisual(s,next);assert.equal(next.lastError,null);assert.ok(visual);
 const draw=v=>render(h('svg',null,h(GrenadeThrowEffect,{state:s,visual:v,project}))),markup=draw(visual);
 assert.match(markup,/data-grenade-flight/);assert.match(markup,/data-grenade-shadow/);assert.match(markup,/animateMotion/);assert.match(markup,/dur="0.45s"/);assert.match(markup,/aria-hidden="true"/);assert.doesNotMatch(markup,/Guardia|Lanzador|NaN|Infinity/);assert.ok(GRENADE_EFFECT_DURATION>=1150&&GRENADE_EFFECT_DURATION<2000);
 if(visual.detonated)assert.match(markup,/data-grenade-blast/);
 s.units.push({id:'hidden',name:'Oculto',x:4,y:1,hp:100});assert.equal(draw(visual),markup);
 assert.doesNotMatch(draw({...visual,visible:false}),/data-grenade-flight/);assert.doesNotMatch(draw({...visual,detonated:false}),/data-grenade-blast/);assert.doesNotMatch(draw({...visual,points:[{x:NaN,y:1,height:1},visual.impact]}),/data-grenade-flight/);assert.doesNotMatch(draw(null),/data-grenade-flight/);
});
test('observed grenade explosions use the existing synthesized blast and muted or repeated states remain silent',()=>{
 const sound=new BattleAudio(),calls=[];sound.enabled=true;sound.context={currentTime:12};sound.noise=(...args)=>calls.push(['noise',...args]);sound.drum=(...args)=>calls.push(['drum',...args]);
 const before={log:[],status:'active',smoke:[]},after={log:['Lanzador: explosión de granada.'],status:'active',smoke:[],lastError:null};sound.play(before,after);assert.deepEqual(calls,[['noise',.9,.28,1500],['drum',12,.28]]);
 calls.length=0;sound.play(after,after);sound.play(before,{...after,lastError:'Orden rechazada'});sound.enabled=false;sound.play(before,after);assert.deepEqual(calls,[]);
});
function supplyState(){
 let state=initialCampaign(8);state.phase=3;for(const id of ['buenos_aires','cordoba','mendoza'])state.sectors[id].owner='patriot';
 for(const action of [{type:'recruitCivic',id:110,term:'week'},{type:'travel',sector:'mendoza'}]){state=dispatchCampaign(state,action);assert.equal(state.lastError,null);}
 return state;
}
test('the arsenal row buys one grenade for the selected present operative using the real offer',()=>{
 let state=supplyState(),action;const operative=rosterFor(state).find(person=>person.id===110),offer=grenadeOffer(state,operative,isSupplied),before=structuredClone(state);assert.equal(offer.available,true);
 const tree=componentTree(GrenadeSupplies,{state,operative,dispatch:a=>{action=a;state=dispatchCampaign(state,a);}}),button=hosts(tree).find(node=>node.type==='button');assert.equal(button.props.disabled,false);button.props.onClick();
 assert.deepEqual(action,offer.action);assert.equal(state.lastError,null);assert.equal(state.resources.treasury,before.resources.treasury-offer.price);assert.equal(state.merchants.mendoza.grenades.arsenal,before.merchants.mendoza.grenades.arsenal-1);assert.equal(state.operativeState[110].inventory['grenade:arsenal'].count,1);
 const markup=render(h(GrenadeSupplies,{state,operative,dispatch(){}}));assert.ok(markup.includes(operative.name));assert.match(markup,/no se reponen/);assert.match(markup,/mano principal/);
});
test('unavailable arsenal offers show the reason and cannot submit purchases',()=>{
 const ready=supplyState();for(const change of [s=>s.phase=2,s=>s.resources.treasury=0,s=>s.merchants.mendoza.grenades.arsenal=0,s=>s.pendingBattle={}]){
  const state=structuredClone(ready);change(state);const operative=rosterFor(state).find(person=>person.id===110),offer=grenadeOffer(state,operative,isSupplied);let count=0;
  const tree=componentTree(GrenadeSupplies,{state,operative,dispatch:()=>count++}),button=hosts(tree).find(node=>node.type==='button');assert.equal(button.props.disabled,true);assert.equal(button.props.title,offer.reason);button.props.onClick();assert.equal(count,0);
 }
});
