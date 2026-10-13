import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.js';
import {createBattle,actBattle,canSee,teamCanSee} from '../game/tactical.js';
import {targetPreview,civilianMedicalInputAction,unitCanAct} from '../game/ja2-hud.js';
import {contextActionCursorModel} from '../game/context-action-cursor.js';
import {makeGrenadeStack} from '../game/grenades.js';
const {default:ContextActionCursor}=await import('../web/app/ContextActionCursor.tsx');

// Fresh declared presentation arenas. No campaign or earned outcome.
function arena({actor={},ally={},npc={},enemies=true,floor=true,floorPoint={x:4,y:3}}={}){
 return createBattle([{id:'p',x:2,y:3,hp:80,maxHp:80,medical:91,medkits:2,weapon:1800,loaded:1,ammo:3,facing:2,...actor},{id:'ally',x:2,y:4,hp:60,maxHp:80,bleeding:3,facing:2,...ally}],{
  id:'declared-context-cursor',width:12,height:10,seed:36,exploration:true,deferContact:true,
  tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),
  npcs:[{id:'n',name:'Vecino',x:3,y:3,hp:80,maxHp:80,mission:'declared-conversation',...npc}],
  enemies:enemies?[{id:'e',x:7,y:3,hp:80,maxHp:80,weapon:1800,loaded:0,ammo:0,patrol:false}]:[],
  groundItems:floor?[{id:'linen',...floorPoint,item:'medkits',count:2}]:[],
 });
}
const actor=s=>s.units.find(u=>u.id==='p');
const model=(s,hover,ctx={})=>contextActionCursorModel(s,actor(s),hover,{...ctx,preview:ctx.preview??targetPreview(s,actor(s),hover,{...ctx,reachable:[]})});

test('the default visible NPC cursor is lips, but native medical work takes precedence',()=>{
 const s=arena({enemies:false}),before=structuredClone(s),npc=s.npcs[0];assert.equal(canSee(s,actor(s),npc),true);
 assert.deepEqual(model(s,npc),{icon:'lips',label:'Hablar',valid:true,reason:null});assert.deepEqual(s,before);
 const wounded=arena({actor:{activeSlot:'medical'},npc:{hp:10,bleeding:3,unconscious:true},enemies:false}),snapshot=structuredClone(wounded),action=civilianMedicalInputAction(wounded,actor(wounded),wounded.npcs[0]);
 assert.ok(action);const cursor=model(wounded,wounded.npcs[0]);assert.equal(cursor.icon,'medical');assert.equal(cursor.valid,true);
 const after=actBattle(wounded,{...action,unitId:'p'});assert.equal(after.lastError,null);assert.equal(actor(after).medkits,actor(wounded).medkits-1);assert.ok(after.elapsedSeconds>wounded.elapsedSeconds);assert.deepEqual(wounded,snapshot);
});

test('a collapsed civilian follows the actual body-search hit target instead of conversation',()=>{
 const s=arena({npc:{hp:0,bleeding:0},enemies:false}),before=structuredClone(s),n=s.npcs[0],point={x:n.x,y:n.y,anonymous:true,loot:true};
 const cursor=model(s,point);assert.equal(cursor.icon,'hand');assert.notEqual(cursor.label,'Hablar');assert.deepEqual(s,before);
 assert.equal(model(s,point,{itemIntent:'moveOnly'}),null,'Shift follows the ground-only click before body pickup');
});

test('a visible enemy gets one small attack or reload cursor from the authoritative preview',()=>{
 const s=arena(),before=structuredClone(s),enemy=s.units.find(u=>u.id==='e'),cursor=model(s,enemy);assert.equal(cursor.icon,'aim');
 const empty=arena({actor:{loaded:0}}),reload=model(empty,empty.units.find(u=>u.id==='e'));assert.equal(reload.icon,'reload');assert.equal(reload.label,targetPreview(empty,actor(empty),empty.units.find(u=>u.id==='e')).actionLabel);
 assert.deepEqual(s,before);assert.equal(actor(s).loaded,1);assert.equal(actor(empty).loaded,0);
});

test('a healthy friendly default hit selects a native-capable player despite its occupied movement preview',()=>{
 const s=arena({ally:{hp:80,bleeding:0},enemies:false}),before=structuredClone(s),friend=s.units.find(u=>u.id==='ally');
 assert.equal(unitCanAct(s,friend),true);
 assert.equal(targetPreview(s,actor(s),friend,{reachable:[]}),null,'the native default preview yields to friendly selection');
 const blocked=actBattle(s,{type:'move',unitId:'p',x:friend.x,y:friend.y});assert.ok(blocked.lastError);
 const preview={valid:false,actionLabel:'Moverse',reason:blocked.lastError};
 assert.deepEqual(contextActionCursorModel(s,actor(s),friend,{preview}),{icon:'select',label:'Seleccionar',valid:true,reason:null});
 const moved=actBattle(s,{type:'look',unitId:friend.id,x:2,y:1});assert.equal(moved.lastError,null);assert.ok(moved.elapsedSeconds>s.elapsedSeconds);assert.deepEqual(s,before);
 const grenade=arena({actor:{activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack('arsenal',1)}},ally:{hp:80,bleeding:0},enemies:false});
 assert.equal(model(grenade,grenade.units.find(u=>u.id==='ally')).icon,'select','a held grenade default click still selects a friendly player');
 const militia=arena({ally:{militia:true,hp:80,bleeding:0},enemies:false});assert.equal(unitCanAct(militia,militia.units.find(u=>u.id==='ally')),false);assert.equal(model(militia,militia.units.find(u=>u.id==='ally')),null);
});

test('only actual visible floor items get the pickup hand and movement modifiers suppress it',()=>{
 const s=arena(),before=structuredClone(s),point={x:4,y:3,loot:true},cursor=model(s,point);assert.equal(cursor.icon,'hand');
 assert.equal(model(s,point,{itemIntent:'moveOnly'}),null);assert.equal(model(s,point,{movementIntent:'preserveFacing'}),null);
 const empty=arena({floor:false});assert.equal(contextActionCursorModel(empty,actor(empty),point),null,'a stale loot flag does not invent an item');
 assert.deepEqual(s,before);
});

test('equipped medicine, rations and Ctrl stealing retain their own native contextual intent',()=>{
 const medical=arena({actor:{activeSlot:'medical'},enemies:false}),patient=medical.units.find(u=>u.id==='ally');assert.equal(model(medical,patient).icon,'medical');
 const supply=arena({actor:{activeSlot:'supply',activeSupply:'rations',rations:2}}),recipient=supply.units.find(u=>u.id==='ally');assert.equal(model(supply,recipient).icon,'hand');assert.equal(model(supply,recipient).label,targetPreview(supply,actor(supply),recipient).actionLabel);
 const s=arena(),target=s.units.find(u=>u.id==='e');assert.equal(model(s,target,{itemIntent:'steal'}).icon,'hand');assert.equal(model(s,target,{itemIntent:'steal'}).label,'Quitar arma');
 const torch=arena({actor:{activeSlot:'supply',activeSupply:'torches',torches:2}});assert.equal(model(torch,{x:4,y:3,loot:true}).label,'Arrojar antorcha','a floor pile does not replace the equipped supply action');
 const grenade=arena({actor:{activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack('arsenal',1)}}});assert.equal(model(grenade,grenade.npcs[0]).icon,'lips','an equipped grenade is not a conversation gift');assert.equal(model(grenade,grenade.units.find(unit=>unit.id==='e')),null,'default movement does not invent a throw');assert.equal(model(grenade,grenade.units.find(unit=>unit.id==='e'),{mode:'useItem'}).icon,'aim','explicit grenade use retains its ordinary targeting intent');
});

test('a hidden person or item cannot disclose its presence through the cursor',()=>{
 const s=arena({actor:{facing:6},ally:{facing:6},npc:{x:9,y:8},floorPoint:{x:10,y:8}});const before=structuredClone(s),enemy=s.units.find(u=>u.id==='e');assert.equal(canSee(s,actor(s),enemy),false);assert.equal(teamCanSee(s,'player',enemy),false);
 assert.equal(contextActionCursorModel(s,actor(s),enemy),null);assert.equal(contextActionCursorModel(s,actor(s),s.npcs[0]),null);
 const point={x:10,y:8,loot:true};assert.equal(contextActionCursorModel(s,actor(s),point),null);assert.deepEqual(s,before);
});

test('native blocked-action reasons stay small and visible without another preview computation',()=>{
 const s=arena(),enemy=s.units.find(u=>u.id==='e'),before=structuredClone(s),preview={valid:false,attackType:'fire',actionLabel:'Disparar',reason:'PA insuficientes.'};
 const cursor=contextActionCursorModel(s,actor(s),enemy,{preview});assert.deepEqual(cursor,{icon:'aim',label:'Disparar',valid:false,reason:'PA insuficientes.'});assert.deepEqual(s,before);
});

test('the SVG is a passive16px pointer glyph with one current action label',()=>{
 const s=arena(),before=structuredClone(s),markup=renderToStaticMarkup(createElement('svg',null,createElement(ContextActionCursor,{state:s,unit:actor(s),hover:s.npcs[0],point:{x:100,y:100},scale:1})));assert.match(markup,/data-context-action-cursor="lips"/);assert.match(markup,/data-context-icon-size="16"/);assert.match(markup,/pointer-events="none"/);assert.equal((markup.match(/<text/g)??[]).length,1);assert.ok(!markup.includes('<button'));assert.deepEqual(s,before);
});
