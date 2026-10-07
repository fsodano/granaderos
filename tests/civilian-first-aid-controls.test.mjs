import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {componentTree} from './component-tree.mjs';
import {createBattle,actBattle,itemUsePreview,medicalUsePreview,canSee} from '../game/tactical.js';
import {civilianMedicalInputAction,targetPreview,visibleHover,resolvedOrderType} from '../game/ja2-hud.js';
import {playerKnownBattle} from '../game/player-known-state.js';
const {default:Scene}=await import('../web/app/TacticalScene.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const noop=()=>{};
function field({exploration=true,...actor}={}){
 return createBattle([{id:'medic',name:'Sanitario',x:1,y:4,facing:2,activeSlot:'medical',medical:80,medkits:2,...actor}],{
  width:16,height:10,seed:45,exploration,enemies:exploration?[]:[{id:'enemy',x:15,y:9,facing:6,patrol:false}],tiles:Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),
  npcs:[{id:'civil',name:'Vecino',x:4,y:4,hp:70,energy:100,civilianWoundVersion:1,bleeding:2,bandaged:0,bleedSource:{attackerId:null,side:'unknown',militia:false,intentional:false},ai:{cycle:0,homeId:null,activity:'roaming',wait:100}}],
 });
}
function controls(s,{mode='move',onTile=noop,onTalk=noop,onHover=noop}={}){
 const u=s.units[0],tree=componentTree(Scene,{state:s,selected:u.id,unit:u,players:[u],units:s.units,positions:{},poses:{},directions:{},hover:null,mode,aim:0,hitLocation:'torso',reachable:[],showSight:false,sight:new Set(),revealed:new Set(),project:(x,y)=>({x:300+(x-y)*26,y:65+(x+y)*14}),onTile,onTalk,onHover,onCannon:noop,cannonId:''});
 const npc=nodes(tree).find(node=>node.type==='g'&&node.props['data-unit-id']==='civil');assert.ok(npc);
 return nodes(npc).find(node=>node.props?.['data-person-hit-target']);
}
const mouse={clientY:1,currentTarget:{getBoundingClientRect:()=>({top:0,height:100})}};

test('civilian mouse and keyboard actions use equipped bandages instead of dialogue',()=>{
 for(const input of ['mouse','Enter',' ']){
  const s=field();let talks=0,action,next,hover;
  const hit=controls(s,{onTalk:()=>talks++,onHover:point=>hover=point,onTile:point=>{action=civilianMedicalInputAction(s,s.units[0],point);next=actBattle(s,{unitId:'medic',...action});}});
  assert.equal(hit.props['aria-label'],'Vendar a Vecino');
  hit.props.onFocus();assert.equal(hover.targetKind,'npc');
  if(input==='mouse')hit.props.onClick(mouse);else hit.props.onKeyDown({key:input,preventDefault:noop});
  assert.equal(talks,0);assert.deepEqual(action,{type:'useItem',targetId:'civil',targetKind:'npc'});assert.equal(resolvedOrderType(s,s.units[0],action),'heal');
  assert.equal(next.lastError,null);assert.equal(next.units[0].medkits,1);assert.equal(next.units[0].ap,s.units[0].ap);assert.ok(next.units[0].energy<s.units[0].energy);
  assert.equal(next.npcs[0].bleeding,0);assert.ok(next.npcs[0].hp<=70);assert.equal(next.npcs[0].bandaged,100-next.npcs[0].hp);
 }
});

test('civilian treatment previews share the reducer costs and show no AP in exploration',()=>{
 for(const exploration of [true,false]){
  const s=field({exploration}),u=s.units[0],npc=s.npcs[0],before=structuredClone(s);
  const plan=itemUsePreview(s,u,npc,{targetKind:'npc'}),preview=targetPreview(s,u,npc,{mode:'move'});
  assert.equal(plan.valid,true);assert.equal(preview.valid,true);assert.equal(preview.actionLabel,'Acercarse y vendar');assert.equal(preview.pa,exploration?0:plan.pa);
  assert.match(preview.coverNote,/recuperación de salud requiere atención en campaña/);if(exploration)assert.doesNotMatch(preview.coverNote,/\d+(?:,\d+)? PA/);
  const local=medicalUsePreview(s,u,npc,{targetKind:'npc'}),direct=targetPreview(s,u,npc,{mode:'heal'});
  assert.equal(direct.valid,local.allowed);assert.equal(direct.reason,local.reason);assert.deepEqual(s,before);
 }
});

test('talk mode, other held items, hidden civilians and unrelated cells cannot become medical orders',()=>{
 const s=field(),u=s.units[0],npc=s.npcs[0];
 for(const mode of ['talk','fire','throwKnife','throwGrenade','loot','look','inventory'])assert.equal(civilianMedicalInputAction(s,u,npc,mode),null,mode);
 assert.equal(civilianMedicalInputAction(s,{...u,activeSlot:'unarmed'},npc),null);
 assert.equal(civilianMedicalInputAction(s,u,{...npc,x:12}),null);
 assert.equal(civilianMedicalInputAction(s,u,{...npc,id:'someone-else'}),null);
 const backwards={...u,facing:6};assert.equal(canSee(s,backwards,npc),false);assert.equal(civilianMedicalInputAction(s,backwards,npc),null);
 let talks=0;const hit=controls(s,{mode:'talk',onTalk:()=>talks++});hit.props.onClick(mouse);assert.equal(talks,1);assert.match(hit.props['aria-label'],/Hablar con/);
});

test('typed civilian hover and action cannot resolve to a soldier with the same ID',()=>{
 const s=field(),u=s.units[0],npc=s.npcs[0];s.units.push({...u,id:npc.id,name:'Otro',x:12,y:9});
 const point={...npc,targetKind:'npc'},hover=visibleHover(s,point);assert.equal(hover.name,'Vecino');assert.equal(hover.targetKind,'npc');
 const action=civilianMedicalInputAction(s,u,point);assert.equal(action.targetKind,'npc');
 const preview=targetPreview(s,u,point,{mode:'useItem'});assert.equal(preview.name,'Vecino');
});

test('public medical controls expose observed wounds without revealing harm attribution or hidden patients',()=>{
 const s=field(),npc=s.npcs[0];npc.bleedSource={attackerId:'private-source',side:'enemy',militia:false,intentional:true};
 npc.civilianHarm={version:1,incidents:[{sequence:1,kind:'wounded',attackerId:'private-player',side:'player',militia:false,intentional:true,hpBefore:100,hpAfter:70}]};
 s.npcs.push({...npc,id:'hidden-patient',name:'Hidden name',x:0,y:0});
 assert.equal(canSee(s,s.units[0],s.npcs[1]),false);
 const view=playerKnownBattle(s),known=view.npcs.find(n=>n.id==='civil');assert.equal(known.bleeding,2);assert.equal(known.bandaged,0);
 assert.deepEqual(view.orders[0].medicalTargets[0].action,{type:'useItem',targetId:'civil',targetKind:'npc'});
 assert.doesNotMatch(JSON.stringify(view),/private-source|private-player|hidden-patient|Hidden name|bleedSource|civilianHarm/);
 const other=structuredClone(s);other.npcs[1].hp=1;other.npcs[1].bleeding=8;assert.deepEqual(playerKnownBattle(other),view);
});

test('critical civilian previews show partial health and bleeding progress without promising full treatment',()=>{
 const s=field({exploration:false,medical:1,dexterity:0,experienceLevel:1});
 const u=s.units[0],npc=s.npcs[0];npc.x=2;npc.hp=3;npc.bleeding=8;
 const before=structuredClone(s),preview=targetPreview(s,u,npc,{mode:'useItem'});
 assert.equal(preview.valid,true);assert.equal(preview.treatment.partial,true);
 assert.equal(preview.treatment.hpAfter,6);assert.equal(preview.treatment.bleedingAfter,4);
 assert.match(preview.coverNote,/Salud: \+3, hasta 6/);assert.match(preview.coverNote,/Hemorragia restante: 4/);assert.match(preview.coverNote,/Tratamiento parcial/);
 assert.doesNotMatch(preview.coverNote,/Sin hemorragia|Estabilizado\./);
 const next=actBattle(s,{unitId:u.id,type:'useItem',targetId:npc.id,targetKind:'npc'});
 assert.equal(next.lastError,null);assert.equal(next.npcs[0].hp,preview.treatment.hpAfter);assert.equal(next.npcs[0].bleeding,preview.treatment.bleedingAfter);
 const view=playerKnownBattle(s),known=view.orders[0].medicalTargets[0];
 assert.equal(known.treatment.hpAfter,6);assert.equal(known.treatment.partial,true);assert.equal(known.treatment.dressingsUsed,1);
 assert.deepEqual(s,before);
});

test('critical allied and civilian target controls expose the same observed treatment forecast',()=>{
 const s=field({exploration:false,medical:80}),u=s.units[0],npc=s.npcs[0];npc.x=2;npc.hp=10;npc.bleeding=2;
 const ally={...u,id:'patient',name:'Herido',hp:10,bleeding:2,bandaged:0,maxHp:100,unconscious:true,ap:0,x:1,y:5};s.units.push(ally);
 const npcPreview=targetPreview(s,u,npc,{mode:'useItem'}),allyPreview=targetPreview(s,u,ally,{mode:'useItem'});
 for(const preview of [npcPreview,allyPreview]){assert.equal(preview.valid,true);assert.equal(preview.treatment.hpAfter,15);assert.match(preview.coverNote,/Estabilizado/);}
 const view=playerKnownBattle(s),order=view.orders.find(o=>o.unitId===u.id);
 const target=order.targets.find(t=>t.targetId===ally.id);assert.equal(target.treatment.hpAfter,15);assert.equal(target.treatment.complete,true);
 assert.equal(order.medicalTargets[0].treatment.hpAfter,15);
 npc.civilianFirstAid={version:1,hpRestored:35};assert.doesNotMatch(JSON.stringify(playerKnownBattle(s)),/civilianFirstAid|hpRestored/);
});
