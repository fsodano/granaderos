import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {componentTree} from './component-tree.mjs';
import {createBattle,actBattle,canSee,pointFirePreview} from '../game/tactical.js';
import {pointFireInputAction,targetPreview,shotLocationOptions,aimOptions,knifeThrowInputAction,grenadeThrowInputAction,tacticalInputAction} from '../game/ja2-hud.js';
import {dialogueReason,dialogueAvailability,ambientReply,hasAuthoredDialogue} from '../game/npc-dialogue.js';
import {civilianWoundedByPlayer} from '../game/civilian-harm.js';
import {makeGrenadeStack} from '../game/grenades.js';
const {default:Scene}=await import('../web/app/TacticalScene.tsx');
const {default:Conversation}=await import('../web/app/JA2Conversation.tsx');
const {default:AimCursor}=await import('../web/app/AimCursor.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const noop=()=>{};
const wounded={version:1,incidents:[{sequence:1,kind:'wounded',attackerId:'p',side:'player',militia:false,intentional:false,hpBefore:100,hpAfter:80}]};
function field(patch={}){
 return createBattle([{id:'p',name:'Tirador',x:1,y:4,facing:2,marksmanship:100,weapon:1800,loaded:1,condition:100,blade:0,...patch}],{
  width:16,height:10,seed:45,exploration:true,tiles:Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),
  enemies:[],npcs:[{id:'civil',name:'Vecino',x:7,y:4,hp:100,energy:100,stance:'standing'}],
 });
}
function controls(s,{mode='fire',aim=2,onTile=noop,onTalk=noop,onHover=noop}={}){
 const u=s.units[0],tree=componentTree(Scene,{state:s,selected:u.id,unit:u,players:[u],units:s.units,positions:{},poses:{},directions:{},hover:null,mode,aim,hitLocation:'head',reachable:[],showSight:false,sight:new Set(),revealed:new Set(),project:(x,y)=>({x:300+(x-y)*26,y:65+(x+y)*14}),onTile,onTalk,onHover,onCannon:noop,cannonId:''});
 const civilian=nodes(tree).find(node=>node.type==='g'&&node.props['data-unit-id']==='civil');assert.ok(civilian,'the observed civilian is rendered');
 const hit=nodes(civilian).find(node=>node.props?.['data-person-hit-target']);assert.ok(hit);return {tree,hit};
}
const mouse={clientY:1,currentTarget:{getBoundingClientRect:()=>({top:0,height:100})}};

test('the real civilian mouse callback fires at its ground point and never opens dialogue',()=>{
 const s=field();s.mode='combat';let next,action,talks=0;
 const ui=controls(s,{onTalk:()=>talks++,onTile:point=>{action=pointFireInputAction(point,{aim:2});next=actBattle(s,{unitId:'p',...action});}});
 assert.match(ui.hit.props['aria-label'],/^Disparar a la casilla de Vecino$/);ui.hit.props.onClick(mouse);
 assert.equal(talks,0);assert.deepEqual(action,{type:'firePoint',x:7,y:4,tacticalLevel:0,hitLocation:'torso',aim:2});
 assert.equal(next.lastError,null);assert.equal(next.units[0].loaded,0);assert.equal(next.units[0].ap,s.units[0].ap-pointFirePreview(s,s.units[0],s.npcs[0],2).pa);
 assert.ok(next.npcs[0].hp<s.npcs[0].hp);assert.equal(next.units[0].lastTargetId,undefined);
});

test('keyboard activation and hover keep civilian aim on a fixed ground point',()=>{
 const s=field(),points=[],hovers=[];let talks=0,prevented=0;const ui=controls(s,{onTile:point=>points.push(point),onHover:point=>hovers.push(point),onTalk:()=>talks++});
 ui.hit.props.onMouseEnter(mouse);ui.hit.props.onMouseMove({...mouse,clientY:95});ui.hit.props.onFocus();
 for(const hover of hovers){assert.equal(hover.id,undefined);assert.equal(hover.aimLocation,'torso');assert.equal(hover.anonymous,true);}
 const before=hovers.length;ui.hit.props.onKeyDown({key:'ArrowUp',preventDefault:()=>prevented++});ui.hit.props.onKeyDown({key:'ArrowDown',preventDefault:()=>prevented++});assert.equal(hovers.length,before);
 for(const key of ['Enter',' '])ui.hit.props.onKeyDown({key,preventDefault:()=>prevented++});
 assert.equal(talks,0);assert.equal(points.length,2);assert.equal(prevented,2);assert.deepEqual(points[0],points[1]);assert.equal(points[0].aimLocation,'torso');
});

test('civilian point previews share firearm aim costs and omit body regions and target hit chance',()=>{
 const s=field(),u=s.units[0],npc=s.npcs[0];s.mode='combat';
 for(const aim of [0,2,4]){
  const preview=targetPreview(s,u,npc,{mode:'fire',aim,hitLocation:'head'}),ordinary=pointFirePreview(s,u,{x:npc.x,y:npc.y},aim);
  assert.equal(preview.valid,true);assert.equal(preview.pa,ordinary.pa);assert.equal(preview.hitLocation,undefined);assert.equal(preview.chance,undefined);assert.match(preview.actionLabel,/Disparar.*casilla/);
  assert.deepEqual(shotLocationOptions(s,u,{mode:'fire',target:npc,hitLocation:'head'}),[]);
  assert.deepEqual(shotLocationOptions(s,u,{mode:'fire',target:{x:7,y:4,anonymous:true}}),[]);
  const option=aimOptions(s,u,{mode:'fire',target:npc}).find(option=>option.level===aim);assert.equal(option.pa,ordinary.pa);
  const cursor=render(h('svg',null,h(AimCursor,{point:{x:120,y:120},aim,preview,target:npc,scale:1,bounds:{x:0,y:0,width:500,height:300}})));
  assert.match(cursor,/Casilla/);assert.doesNotMatch(cursor,/Cabeza|Piernas|Torso|[0-9]+%/);
 }
});

test('a civilian click stays a point shot even when a visible enemy shares that cell',()=>{
 const s=field(),u=s.units[0];s.mode='combat';s.units.push({...structuredClone(u),id:'enemy',side:'enemy',x:7,y:4,facing:6,overwatch:false});
 const ui=controls(s),preview=targetPreview(s,u,s.npcs[0],{mode:'fire',aim:2,hitLocation:'head'});
 assert.equal(preview.hitLocation,undefined);assert.equal(preview.chance,undefined);assert.match(preview.actionLabel,/casilla/);
 let hovered;controls(s,{onHover:point=>hovered=point}).hit.props.onFocus();assert.equal(hovered.anonymous,true);assert.equal(targetPreview(s,u,hovered,{mode:'fire',hitLocation:'legs'}).hitLocation,undefined);
 assert.match(ui.hit.props['aria-label'],/Disparar/);
});

test('unseen occupants cannot change the public civilian point preview',()=>{
 const s=field(),u=s.units[0],baseline=targetPreview(s,u,s.npcs[0],{mode:'fire',aim:2});
 const hidden={...structuredClone(u),id:'hidden',side:'enemy',x:0,y:9,hp:17};s.units.push(hidden);assert.equal(canSee(s,u,hidden),false);
 assert.deepEqual(targetPreview(s,u,s.npcs[0],{mode:'fire',aim:2}),baseline);
 const low={...s.npcs[0],hp:10,unconscious:true,stance:'prone',civilianHarm:wounded};s.npcs=[low];assert.deepEqual(targetPreview(s,u,low,{mode:'fire',aim:2}),baseline);
});

test('a hidden civilian sharing a soldier ID cannot change that soldier’s firearm controls',()=>{
 const s=field(),u=s.units[0],enemy={...structuredClone(u),id:'enemy',side:'enemy',x:9,y:4,facing:6};s.units.push(enemy);
 const ctx={mode:'fire',aim:2,hitLocation:'head',target:enemy},preview=targetPreview(s,u,enemy,ctx),locations=shotLocationOptions(s,u,ctx);
 const hidden={id:'enemy',name:'No observado',x:0,y:9,hp:100};s.npcs.push(hidden);assert.equal(canSee(s,u,hidden),false);
 assert.deepEqual(targetPreview(s,u,enemy,ctx),preview);assert.deepEqual(shotLocationOptions(s,u,ctx),locations);assert.equal(locations.length,3);
});

test('movement and talk keep innocent civilian conversation callbacks',()=>{
 for(const mode of ['move','talk']){
  const s=field();s.npcs[0].x=2;let talks=0,tiles=0;const ui=controls(s,{mode,onTalk:()=>talks++,onTile:()=>tiles++});
  assert.match(ui.hit.props['aria-label'],/Hablar con Vecino/);ui.hit.props.onClick(mouse);ui.hit.props.onKeyDown({key:'Enter',preventDefault:noop});
  assert.equal(talks,2);assert.equal(tiles,0);assert.equal(dialogueReason(s,s.units[0],s.npcs[0]),null);
 }
});

test('knife and grenade clicks on civilians retain their existing point actions',()=>{
 for(const mode of ['throwKnife','throwGrenade']){
  const patch=mode==='throwKnife'?{weapon:1813,loaded:0}:{activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack('arsenal',1)}};
  const s=field(patch);let point,talks=0;const ui=controls(s,{mode,onTalk:()=>talks++,onTile:value=>point=value});ui.hit.props.onClick(mouse);assert.equal(talks,0);
  const order=mode==='throwKnife'?knifeThrowInputAction(s,s.units[0],point,{aim:2,hitLocation:'head'}):grenadeThrowInputAction(s,s.units[0],point);
  assert.equal(order.type,mode);assert.equal(order.targetId,undefined);assert.equal(order.x,s.npcs[0].x);assert.equal(order.y,s.npcs[0].y);if(mode==='throwKnife')assert.equal(order.hitLocation,'torso');
 }
});

test('direct knife and grenade helpers keep civilian coordinates across soldier ID collisions',()=>{
 for(const mode of ['throwKnife','throwGrenade']){
  const patch=mode==='throwKnife'?{weapon:1813,loaded:0}:{activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack('arsenal',1)}};
  const s=field(patch),u=s.units[0],npc=s.npcs[0],ctx={mode,aim:2,hitLocation:'head',target:npc};
  const base=targetPreview(s,u,npc,ctx),aims=aimOptions(s,u,ctx);
  s.units.push({...structuredClone(u),id:npc.id,side:'enemy',x:9,y:4,facing:6,overwatch:false});
  const action=mode==='throwKnife'?knifeThrowInputAction(s,u,npc,ctx):grenadeThrowInputAction(s,u,npc);
  assert.equal(action.targetId,undefined);assert.equal(action.x,npc.x);assert.equal(action.y,npc.y);if(mode==='throwKnife')assert.equal(action.hitLocation,'torso');
  assert.deepEqual(targetPreview(s,u,npc,ctx),base);assert.deepEqual(aimOptions(s,u,ctx),aims);assert.deepEqual(shotLocationOptions(s,u,ctx),[]);
 }
});

test('civilian throwable callbacks pass anonymous points that never acquire a soldier in the same cell',()=>{
 for(const mode of ['throwKnife','throwGrenade']){
  const patch=mode==='throwKnife'?{weapon:1813,loaded:0}:{activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack('arsenal',1)}};
  const s=field(patch),u=s.units[0],npc=s.npcs[0];let hovered,clicked;
  const ui=controls(s,{mode,onTile:point=>clicked=point,onHover:point=>hovered=point});ui.hit.props.onFocus();ui.hit.props.onClick(mouse);
  assert.equal(hovered.anonymous,true);assert.equal(clicked.anonymous,true);assert.equal(clicked.id,undefined);assert.equal(clicked.aimLocation,'torso');
  s.units.push({...structuredClone(u),id:npc.id,side:'enemy',x:npc.x,y:npc.y,facing:6,overwatch:false});
  const action=mode==='throwKnife'?knifeThrowInputAction(s,u,clicked,{hitLocation:'head'}):grenadeThrowInputAction(s,u,clicked);
  assert.equal(action.targetId,undefined);assert.equal(action.x,npc.x);assert.equal(action.y,npc.y);if(mode==='throwKnife')assert.equal(action.hitLocation,'torso');
  assert.deepEqual(shotLocationOptions(s,u,{mode,target:hovered}),[]);
 }
});

test('an empty gun reloads once on the same point-click route instead of opening dialogue',()=>{
 const s=field({loaded:0});let action,talks=0;const ui=controls(s,{onTalk:()=>talks++,onTile:point=>action=tacticalInputAction(s,s.units[0],pointFireInputAction(point,{aim:2}))});
 ui.hit.props.onClick(mouse);assert.equal(talks,0);assert.deepEqual(action,{type:'reload',aim:0});
});

test('directly wounded surviving civilians refuse only after normal conversation availability checks',()=>{
 const s=field();const u=s.units[0],npc={...s.npcs[0],x:2,hp:80,civilianHarm:wounded,dialogue:'special'};s.npcs=[npc];
 assert.equal(civilianWoundedByPlayer(npc),true);assert.equal(dialogueReason(s,u,npc),'Me heriste. No voy a ayudarte.');
 assert.match(dialogueReason(s,u,npc,{visible:false}),/no está disponible/);assert.match(dialogueReason(s,u,{...npc,x:7}),/Acercate/);assert.match(dialogueReason(s,u,{...npc,hp:0}),/no está disponible/);
 assert.match(dialogueReason(s,{...u,unconscious:true},npc),/no puede conversar/);
 const legacy={...npc,civilianHarm:undefined};assert.equal(dialogueReason(s,u,legacy),null,'legacy unattributed wounds do not invent player blame');
 assert.equal(dialogueReason(s,u,{...legacy,hp:100}),null);
});

test('hurt ambient replies and authored conversation controls consistently refuse cooperation',()=>{
 const s=field(),npc={...s.npcs[0],x:2,hp:80,civilianHarm:wounded,dialogue:'special',greeting:'Buen día.'};
 const replies=new Set(Array.from({length:6},(_,i)=>ambientReply(npc,i)));assert.equal(replies.size,3);for(const reply of replies)assert.match(reply,/heriste|Alejate|No voy a ayudarte/);
 assert.equal(ambientReply(npc,1),ambientReply(JSON.parse(JSON.stringify(npc)),1));assert.equal(hasAuthoredDialogue(npc),true);
 const availability=dialogueAvailability(s,s.units[0],npc),reason=availability.reason,tree=componentTree(Conversation,{npc,conversation:{npcId:npc.id,text:'Estoy dispuesto a servir.'},quest:null,reason,availability,canApproach:true,onApproach:noop,onTalk:noop,onClose:noop});
 const options=nodes(tree).filter(node=>node.type==='button'&&node.props.children!=='Listo');assert.ok(options.length>0);assert.ok(options.every(node=>node.props.disabled));
 const html=render(tree);assert.match(html,/«Me heriste. No voy a ayudarte.»/);assert.doesNotMatch(html,/Buen día|Estoy dispuesto|Acercarse para conversar/);assert.equal((html.match(/Me heriste/g)??[]).length,1);
});

test('typed conversation blockers preserve real approach callbacks and suppress unavailable ones',()=>{
 const s=field(),u=s.units[0],npc={...s.npcs[0],hp:80,civilianHarm:wounded,dialogue:'special'};
 for(const patch of [{},{tacticalLevel:1}]){
  const target={...npc,...patch},availability=dialogueAvailability(s,u,target);assert.equal(availability.canApproach,true);assert.ok(['range','level'].includes(availability.code));
  let approached=0;const tree=componentTree(Conversation,{npc:target,conversation:null,quest:null,reason:availability.reason,availability,canApproach:true,onApproach:()=>approached++,onTalk:noop,onClose:noop});
  const button=nodes(tree).find(node=>node.type==='button'&&node.props.children==='Acercarse para conversar');assert.ok(button);button.props.onClick();assert.equal(approached,1);
 }
 for(const [target,options]of [[npc,{visible:false}],[{...npc,hp:0},{}],[{...npc,unconscious:true},{}],[npc,{busy:true}]]){
  const availability=dialogueAvailability(s,u,target,options);assert.equal(availability.canApproach,false);
  const html=render(h(Conversation,{npc:target,conversation:null,quest:null,reason:availability.reason,availability,canApproach:true,onApproach:noop,onTalk:noop,onClose:noop}));assert.doesNotMatch(html,/Acercarse para conversar/);assert.match(html,/no (puede conversar|está disponible)/);
 }
});
