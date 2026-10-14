import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup} from '../web/node_modules/react-dom/server.js';
import {createBattle,actBattle,canSee,teamCanSee,artilleryCosts,artilleryCrewPlan,artilleryReloadPreview} from '../game/tactical.js';
import {targetPreview,civilianMedicalInputAction,unitCanAct} from '../game/ja2-hud.js';
import {contextActionCursorModel} from '../game/context-action-cursor.js';
import {makeGrenadeStack} from '../game/grenades.js';
const {default:ContextActionCursor}=await import('../web/app/ContextActionCursor.tsx');

// Fresh declared presentation arenas. No campaign or earned outcome.
function arena({actor={},ally={},npc={},enemies=true,floor=true,floorPoint={x:4,y:3},exploration=true,extra={}}={}){
 return createBattle([{id:'p',x:2,y:3,hp:80,maxHp:80,medical:91,medkits:2,weapon:1800,loaded:1,ammo:3,facing:2,...actor},{id:'ally',x:2,y:4,hp:60,maxHp:80,bleeding:3,facing:2,...ally}],{
  id:'declared-context-cursor',width:12,height:10,seed:36,exploration,deferContact:true,
  tiles:Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0})),
  npcs:[{id:'n',name:'Vecino',x:3,y:3,hp:80,maxHp:80,mission:'declared-conversation',...npc}],
  enemies:enemies?[{id:'e',x:7,y:3,hp:80,maxHp:80,weapon:1800,loaded:0,ammo:0,patrol:false}]:[],
  groundItems:floor?[{id:'linen',...floorPoint,item:'medkits',count:2}]:[],
  ...extra,
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

const markup=(s,hover,ctx={})=>renderToStaticMarkup(createElement('svg',null,createElement(ContextActionCursor,{state:s,unit:actor(s),hover,preview:ctx.preview??targetPreview(s,actor(s),hover,{...ctx,reachable:[]}),point:{x:100,y:100},...ctx})));
const tool=(key,extra={})=>({count:1,weight:.5,itemType:'tool',toolKey:key,condition:100,...extra});

test('visible environment locks and containers retain their actual native verb, finite action cost and refusal',()=>{
 const tiles=Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0}));
 const wallEdges=[{id:'store-edge',doorId:'store',x:3,y:3,axis:'y',type:'door',open:false,locked:true,keyId:'store-key',lockIntegrity:100,blocked:true,blocksSight:true}];
 const s=arena({exploration:false,npc:{x:11,y:9},floor:false,actor:{activeSlot:'tool',activeTool:'inventory:key',inventory:{key:tool('key',{keyId:'store-key'})}},extra:{tiles,wallEdges}}),before=structuredClone(s),door={...s.wallEdges[0],wallEdgeId:'store-edge'},preview=targetPreview(s,actor(s),door,{reachable:[]});
 assert.equal(preview.valid,true);assert.ok(preview.pa>0);assert.deepEqual(model(s,door),{icon:'hand',label:preview.actionLabel,valid:true,reason:null,pa:preview.pa});
 const after=actBattle(s,{type:'useItem',unitId:'p',environment:{kind:'door',id:'store'}});assert.equal(after.lastError,null);assert.equal(after.wallEdges[0].locked,false);assert.equal(actor(after).ap,actor(s).ap-preview.pa);assert.deepEqual(actor(after).inventory,actor(s).inventory);
 assert.equal(model(s,door,{mode:'look'}),null,'The actual wall hit handler only admits environment use in move/useItem modes.');
 const wrong=arena({exploration:false,npc:{x:11,y:9},floor:false,actor:{activeSlot:'tool',activeTool:'inventory:key',inventory:{key:tool('key',{keyId:'other'})}},extra:{tiles,wallEdges}}),wrongBefore=structuredClone(wrong),point={...wrong.wallEdges[0],wallEdgeId:'store-edge'},blocked=targetPreview(wrong,actor(wrong),point,{reachable:[]}),cursor=model(wrong,point);
 assert.equal(blocked.valid,false);assert.equal(cursor.reason,blocked.reason);assert.equal(cursor.pa,undefined);assert.equal(cursor.valid,false);assert.match(markup(wrong,point),/data-context-action-cursor="hand"/);assert.ok(markup(wrong,point).includes(blocked.reason));
 const refused=actBattle(wrong,{type:'useItem',unitId:'p',environment:{kind:'door',id:'store'}});assert.ok(refused.lastError);for(const key of ['units','tiles','wallEdges','seed','elapsedSeconds'])assert.deepEqual(refused[key],wrong[key]);
 const chest=arena({exploration:false,npc:{x:11,y:9},floor:false,extra:{props:[{id:'cache',type:'chest',x:3,y:3,open:false,locked:false,blocksMovement:true,contents:[{item:'medkits',count:2,weight:.12}]}]}}),cache=chest.props[0],cp=targetPreview(chest,actor(chest),cache,{reachable:[]});assert.equal(cp.valid,true);assert.equal(model(chest,cache).label,cp.actionLabel);
 const opened=actBattle(chest,{type:'useItem',unitId:'p',environment:{kind:'container',id:'cache'}});assert.equal(opened.lastError,null);assert.equal(opened.props[0].open,true);assert.deepEqual(opened.props[0].contents,cache.contents);assert.equal(actor(opened).ap,actor(chest).ap-cp.pa);
 assert.deepEqual(s,before);assert.deepEqual(wrong,wrongBefore);
});

test('explicit look, torch and bolas reuse their native preview and paid stock without replacing NPC conversation',()=>{
 for(const mode of ['look','torch','bolas']){
  const s=arena({exploration:false,npc:{x:11,y:9},floor:false,actor:{torches:2,boleadoras:2,...(mode==='look'?{}:{activeSlot:'supply',activeSupply:mode==='torch'?'torches':'boleadoras'})}}),before=structuredClone(s),point={x:4,y:3},preview=targetPreview(s,actor(s),point,{mode,reachable:[]}),cursor=model(s,point,{mode});
  assert.equal(preview.valid,true,mode);assert.equal(cursor.label,preview.actionLabel);assert.equal(cursor.pa,preview.pa);assert.equal(cursor.icon,mode==='look'?'look':'hand');
  const action={type:({look:'look',torch:'throwTorch',bolas:'boleadoras'})[mode],unitId:'p',...point},after=actBattle(s,action);assert.equal(after.lastError,null,mode);assert.equal(actor(after).ap,actor(s).ap-preview.pa);assert.ok(after.elapsedSeconds>s.elapsedSeconds);
  if(mode!=='look')assert.equal(actor(after)[mode==='torch'?'torches':'boleadoras'],actor(s)[mode==='torch'?'torches':'boleadoras']-1);else assert.equal(actor(after).loaded,actor(s).loaded);
  assert.deepEqual(s,before);
 }
 const noStock=arena({exploration:false,actor:{torches:0,boleadoras:0},npc:{x:11,y:9},floor:false});for(const mode of ['torch','bolas']){const point={x:4,y:3},p=targetPreview(noStock,actor(noStock),point,{mode});assert.equal(p.valid,false);assert.equal(model(noStock,point,{mode}).reason,p.reason);assert.equal(model(noStock,point,{mode}).pa,undefined);}
 const npc=arena({enemies:false});for(const mode of ['look','torch','bolas'])assert.equal(model(npc,npc.npcs[0],{mode}).icon,'lips','The actual NPC hit handler keeps its conversation precedence.');
});

test('explicit artillery intent stays compact and supplied native crew and reload previews retain real costs and refusals',()=>{
 const s=arena({exploration:false,actor:{x:1,y:2},ally:{x:2,y:2,hp:80,bleeding:0},npc:{x:11,y:9},floor:false,extra:{artillery:[{id:'gun',type:'bronze4',side:'player',x:2,y:3,loaded:false,ammo:3}]}}),before=structuredClone(s),gun=s.artillery[0],point={x:3,y:3},costs=artilleryCosts(s,actor(s),gun);
 for(const mode of ['artilleryMove','artilleryPivot','artilleryReload','artillery']){
  const native=mode==='artilleryReload'?artilleryReloadPreview(s,actor(s),gun):artilleryCrewPlan(s,actor(s),gun,costs[({artilleryMove:'move',artilleryPivot:'pivot',artillery:'fire'})[mode]]),pa=mode==='artilleryReload'?native.pa:costs[({artilleryMove:'move',artilleryPivot:'pivot',artillery:'fire'})[mode]],actionLabel=({artilleryMove:'Mover cañón',artilleryPivot:'Girar cañón',artilleryReload:'Recargar cañón',artillery:'Disparar cañón'})[mode],preview={...native,pa,actionLabel,valid:!native.reason};
  const cursor=contextActionCursorModel(s,actor(s),point,{mode,preview});assert.equal(cursor.label,actionLabel);assert.equal(cursor.pa,pa);assert.equal(cursor.valid,true);assert.equal(cursor.icon,mode==='artilleryReload'?'reload':mode==='artillery'?'aim':'hand');
  const without=contextActionCursorModel(s,actor(s),point,{mode});assert.equal(without.label,actionLabel);assert.equal(without.pa,undefined,'The pointer does not fabricate a cannon route or crew cost.');
 }
 const move=actBattle(s,{type:'artilleryMove',unitId:'p',artilleryId:'gun',...point});assert.equal(move.lastError,null);assert.equal(move.artillery[0].x,3);for(const id of ['p','ally'])assert.equal(move.units.find(u=>u.id===id).ap,s.units.find(u=>u.id===id).ap-costs.move);assert.equal(move.artillery[0].ammo,3);
 const loaded=actBattle(s,{type:'artilleryReload',unitId:'p',artilleryId:'gun'}),plan=artilleryReloadPreview(s,actor(s),gun);assert.equal(loaded.lastError,null);for(const id of plan.crew)assert.equal(loaded.units.find(u=>u.id===id).ap,s.units.find(u=>u.id===id).ap-plan.pa);assert.equal(loaded.artillery[0].loaded,true);assert.equal(loaded.artillery[0].ammo,2);
 const short=arena({exploration:false,actor:{x:1,y:2},ally:{x:2,y:2,hp:80,bleeding:0,stance:'prone'},npc:{x:11,y:9},floor:false,extra:{artillery:[{id:'gun',type:'bronze4',side:'player',x:2,y:3,loaded:false,ammo:3}]}}),refusal=artilleryReloadPreview(short,actor(short),short.artillery[0]),preview={...refusal,actionLabel:'Recargar cañón'},cursor=contextActionCursorModel(short,actor(short),point,{mode:'artilleryReload',preview});assert.equal(cursor.valid,false);assert.equal(cursor.reason,refusal.reason);assert.equal(cursor.pa,undefined);assert.deepEqual(s,before);
});

test('compact labels append only a real available combat PA cost and keep refusal feedback without a second panel',()=>{
 const point={x:4,y:3},s=arena({exploration:false,floor:false,npc:{x:11,y:9}}),before=structuredClone(s),p=targetPreview(s,actor(s),point,{mode:'look'}),html=markup(s,point,{mode:'look'});
 assert.ok(p.pa>0);assert.match(html,/data-context-action-cursor="look"/);assert.match(html,/ PA/);assert.equal((html.match(/<text/g)??[]).length,1);assert.ok(!html.includes('<aside'));
 const peaceful=arena({enemies:false,floor:false,npc:{x:11,y:9}});assert.ok(!markup(peaceful,point,{mode:'look'}).includes(' PA'));
 const empty=arena({exploration:false,actor:{torches:0},floor:false,npc:{x:11,y:9}}),blocked=markup(empty,point,{mode:'torch'});assert.equal((blocked.match(/<text/g)??[]).length,2);assert.ok(!blocked.includes(' PA'));assert.match(blocked,/pointer-events="none"/);assert.deepEqual(s,before);
});
