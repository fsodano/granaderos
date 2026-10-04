import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {JSDOM} from '../web/node_modules/jsdom/lib/api.js';
import {createBattle,canSee} from '../game/tactical.js';
import {groundLootPiles} from '../game/ja2-hud.js';
import {roomDressings,roomDecorProfile} from '../game/room-dressing.js';
import {actorInteriorReadable,foregroundOccludesActor} from '../game/scene-readability.js';
import {tacticalMinimapLabel} from '../game/tactical-minimap-label.js';
import {worldCell} from '../game/world-cells.js';
import {loadSpriteImage,spriteContinuity} from '../web/lib/sprite-image-cache.js';
const {default:Scene}=await import('../web/app/TacticalScene.tsx');
const {buildPropObjects}=await import('../web/app/TacticalProps.tsx');
const project=(x,y)=>({x:200+(x-y)*26,y:60+(x+y)*14});
const scene=(state,extra={})=>render(h('svg',null,h(Scene,{state,players:state.units.filter(unit=>unit.side==='player'),units:state.units,positions:{},poses:{},directions:{},reachable:[],sight:new Set(),revealed:new Set(state.revealedRooms??[]),project,...extra})));
const room={id:'kitchen',cells:Array.from({length:20},(_,index)=>({x:1+index%5,y:1+Math.floor(index/5)}))};
const dressedState={tiles:[...room.cells,{x:3,y:0,type:'door'}],buildings:[{id:'home',kind:'farmhouse',x:0,y:0,width:7,height:6,rooms:[room]}],props:[{id:'table',type:'table',x:1,y:1,roomId:room.id}]};

test('a pending atlas switch retains the last decoded body, but death and unconsciousness take priority',async()=>{
 const idle={name:'granadero-idle',href:'/idle'},walk={name:'granadero-walk',href:'/walk'},dead={name:'granadero-dead-idle',href:'/dead'},faint={name:'granadero-unconscious-breathe',href:'/faint'};
 assert.equal(spriteContinuity(walk,idle,idle.href),idle);
 assert.equal(spriteContinuity(walk,idle,walk.href),walk);
 assert.equal(spriteContinuity(dead,idle,idle.href),dead);
 assert.equal(spriteContinuity(faint,idle,idle.href),faint);
 let instance,finishDecode,created=0;
 class FakeImage{constructor(){instance=this;created++;}decode(){return new Promise(resolve=>{finishDecode=resolve;});}}
 const pending=loadSpriteImage('/test-walk-continuity.png',FakeImage);
 assert.equal(loadSpriteImage('/test-walk-continuity.png',FakeImage),pending);assert.equal(created,1);
 let settled=false;pending.then(()=>{settled=true;});instance.onload();await Promise.resolve();assert.equal(settled,false);
 finishDecode();assert.equal(await pending,true);
 const failed=loadSpriteImage('/test-broken-atlas.png',FakeImage);instance.onerror();assert.equal(await failed,false);
});

test('known mercenaries stay present at a doorway and receive silhouettes under foreground walls',()=>{
 const s={tiles:[{x:2,y:2,type:'wall',buildingId:'home'},{x:1,y:1,roomId:'closed'}],buildings:[{id:'home',x:0,y:0,width:3,height:3,rooms:[{id:'closed',cells:[{x:1,y:1}]}]}]};
 assert.equal(actorInteriorReadable(s,{side:'player',x:1,y:1},null,new Set()),true);
 assert.equal(actorInteriorReadable(s,{side:'enemy',x:1,y:1},null,new Set()),false);
 assert.equal(foregroundOccludesActor(s,{x:1,y:1,hp:100},project),true);
 assert.equal(foregroundOccludesActor(s,{x:3,y:3,hp:100},project),false);
});

test('enemy outlines and ghost layers never admit a hidden enemy even when supplied all battle actors',()=>{
 const s=createBattle([{id:'known',x:1,y:1}],{width:10,height:10,night:true,enemies:[{id:'hidden',x:9,y:9}],exploration:true});
 s.tiles.forEach(tile=>Object.assign(tile,{type:'grass',blocked:false,blocksSight:false}));
 s.tiles.find(tile=>tile.x===9&&tile.y===9).type='forest';
 s.units.find(unit=>unit.id==='hidden').name='Unseen patrol captain';
 const html=scene(s);
 const trees=[...html.matchAll(/<image\b[^>]*scenery-(?:tree|poplar|shrub)-v1.webp[^>]*>/g)].map(([tag])=>tag).filter(tag=>/opacity="(?:1|0.48)"/.test(tag));
 assert.equal(trees.length,1);assert.match(trees[0],/opacity="1"/,'a hidden actor must not fade the foreground tree');
 assert.match(html,/data-unit-id="known"/);assert.doesNotMatch(html,/data-unit-id="hidden"|data-known-actor-silhouette="hidden"|data-enemy-highlight="true"/);
 assert.doesNotMatch(html,/Unseen patrol captain/,'the accessible tile label must not disclose a hidden actor');
 s.night=false;s.units.find(unit=>unit.id==='hidden').x=2;s.units.find(unit=>unit.id==='hidden').y=1;
 assert.match(scene(s),/data-enemy-highlight="true"/);
});

test('an admitted enemy behind foreground keeps its red outline outside the ghost tint without exposing a concealed enemy',()=>{
 const s=createBattle([{id:'known',x:1,y:1}],{width:10,height:10,night:true,enemies:[{id:'admitted',x:2,y:1},{id:'concealed',x:9,y:9}],exploration:true});
 s.tiles.forEach(tile=>Object.assign(tile,{type:'grass',blocked:false,blocksSight:false}));
 for(const [x,y] of [[2,2],[9,9]])s.tiles.find(tile=>tile.x===x&&tile.y===y).type='forest';
 const player=s.units.find(unit=>unit.id==='known'),enemy=s.units.find(unit=>unit.id==='admitted'),concealed=s.units.find(unit=>unit.id==='concealed');
 concealed.name='Concealed patrol captain';
 assert.equal(canSee(s,player,enemy),true,'the enemy is admitted by real tactical sight');
 assert.equal(canSee(s,player,concealed),false);
 assert.equal(foregroundOccludesActor(s,enemy,project),true,'the foreground tree covers the admitted enemy sprite');
 assert.equal(foregroundOccludesActor(s,concealed,project),true,'occlusion alone must not admit the concealed enemy');
 const dom=new JSDOM(scene(s)),doc=dom.window.document;
 try{
  const ghost=doc.querySelector('[data-known-actor-silhouette="admitted"]');
  assert.ok(ghost,'the admitted enemy receives the foreground overlay');
  assert.equal(ghost.getAttribute('data-enemy-highlight'),'true');
  const filterFor=node=>doc.getElementById(node.getAttribute('filter')?.match(/^url\(#(.+)\)$/)?.[1]);
  const outline=filterFor(ghost),tint=filterFor(ghost.firstElementChild);
  assert.equal(outline?.querySelector('feFlood')?.getAttribute('flood-color'),'#fa5546','the outer filter adds the enemy red outline');
  assert.ok(tint?.querySelector('feColorMatrix'),'the silhouette tint remains inside the outline so it cannot recolor the red border');
  const ownGhost=doc.querySelector('[data-known-actor-silhouette="known"]');
  assert.ok(ownGhost);assert.equal(ownGhost.hasAttribute('data-enemy-highlight'),false);assert.equal(ownGhost.hasAttribute('filter'),false);
  assert.equal(doc.querySelector('[data-unit-id="concealed"], [data-known-actor-silhouette="concealed"]'),null);
  assert.ok([...doc.querySelectorAll('[aria-label]')].every(node=>!node.getAttribute('aria-label').includes(concealed.name)),'accessible tile text also excludes the concealed enemy');
 }finally{dom.window.close();}
});

test('own walking sprites have no selection ring or white foreground highlight; idle selection and visible enemy outlines remain',()=>{
 const s=createBattle([{id:'p',x:1,y:1}],{width:10,height:10,night:true,enemies:[{id:'e',x:2,y:1},{id:'hidden',x:9,y:9}],exploration:true});
 s.tiles.forEach(tile=>Object.assign(tile,{type:'grass',blocked:false,blocksSight:false}));s.tiles.find(tile=>tile.x===2&&tile.y===2).type='forest';
 assert.equal(foregroundOccludesActor(s,s.units[0],project),true);
 const positions={p:{x:1.25,y:1,direction:3,frame:2,moving:true},e:{x:2.25,y:1,direction:3,frame:2,moving:true}};
 for(const moving of [true,false]){
  positions.p.moving=moving;const dom=new JSDOM(scene(s,{positions,selected:'p'})),doc=dom.window.document;
  try{
   const own=doc.querySelector('[data-unit-id="p"]');assert.ok(own);assert.equal(own.getAttribute('data-moving'),String(moving));
   assert.equal(Boolean(own.querySelector('ellipse[stroke="#dacb86"]')),!moving);
   assert.equal(Boolean(doc.querySelector('[data-known-actor-silhouette="p"]')),!moving);
   assert.ok(doc.querySelector('[data-unit-id="e"] [data-enemy-highlight="true"]'),'an admitted moving enemy keeps its red outline');
   assert.equal(doc.querySelector('[data-unit-id="hidden"], [data-known-actor-silhouette="hidden"]'),null);
  }finally{dom.window.close();}
 }
});

test('dead soldiers on both sides show blood and lying dead artwork, distinct from unconscious actors',()=>{
 const s=createBattle([{id:'fallen',x:1,y:1},{id:'faint',x:1,y:2}],{width:8,height:8,enemies:[{id:'enemy',x:2,y:1}],exploration:true});
 s.tiles.forEach(tile=>Object.assign(tile,{type:'grass',blocked:false,blocksSight:false}));
 s.units.find(unit=>unit.id==='fallen').hp=0;s.units.find(unit=>unit.id==='enemy').hp=0;s.units.find(unit=>unit.id==='faint').unconscious=true;
 const html=scene(s);
 assert.equal((html.match(/data-corpse-blood=/g)??[]).length,2);
 assert.match(html,/data-corpse-blood="player"/);assert.match(html,/data-corpse-blood="enemy"/);
 assert.match(html,/granadero-dead-idle/);assert.match(html,/royalist-dead-idle/);assert.match(html,/unconscious-breathe/);
});

test('room dressing respects authored props, door approaches, visibility and the underlying map',()=>{
 const before=structuredClone(dressedState),decor=roomDressings(dressedState);
 assert.deepEqual(dressedState,before);assert.ok(decor.length>=3);
 assert.ok(decor.every(prop=>prop.blocksMovement===false&&prop.decorative));
 assert.ok(decor.every(prop=>!(prop.x===1&&prop.y===1)&&Math.abs(prop.x-3)+Math.abs(prop.y)>1));
 const draw=revealed=>buildPropObjects({state:dressedState,revealed:new Set(revealed),project,light:()=>1}).map(object=>render(h('svg',null,object.node))).join('');
 assert.doesNotMatch(draw([]),/data-historical-dressing/);
 assert.match(draw(['kitchen']),/data-historical-dressing="hearth"/);assert.match(draw(['kitchen']),/data-historical-dressing="pottery"/);
 assert.equal(roomDecorProfile({kind:'house'},room,1).purpose,'washroom');
 assert.equal(roomDecorProfile({kind:'house',ruined:true},room).purpose,'ruin');
});

test('one ground loot marker represents each occupied cell without discarding stacked or adjacent items',()=>{
 const s=createBattle([{id:'p',x:1,y:1}],{width:8,height:8,enemies:[],exploration:true});
 s.tiles.forEach(tile=>Object.assign(tile,{type:'grass',blocked:false,blocksSight:false}));
 s.groundItems=[{id:'a',item:'medical',count:4,x:2,y:1},{id:'b',item:'ammunition',count:8,x:2,y:1},{id:'c',item:'food',count:1,x:3,y:1}];
 const before=structuredClone(s.groundItems),piles=groundLootPiles(s,s.units);
 assert.deepEqual(piles.map(pile=>[pile.x,pile.y,pile.count]),[[2,1,2],[3,1,1]]);
 assert.equal((scene(s).match(/data-ground-equipment="true"/g)??[]).length,2);assert.deepEqual(s.groundItems,before);
});

test('minimap metadata uses real campaign seconds across midnight and preserves sector identity',()=>{
 const label=tacticalMinimapLabel({sectorCode:'14,8',sectorName:'Posta',startSeconds:23*3600+59*60,elapsedSeconds:120});
 assert.deepEqual(label,{sectorCode:'14,8',sectorName:'Posta',day:2,time:'00:01'});
 assert.ok(tacticalMinimapLabel({sectorId:'buenos_aires'}).sectorCode.includes(','));
 const mission=tacticalMinimapLabel({sectorId:'san_lorenzo'});
 assert.equal(mission.sectorCode,worldCell('san_nicolas').grid);assert.equal(mission.sectorName,'Combate de San Lorenzo');
 assert.equal(tacticalMinimapLabel({sectorId:'unassociated-scene'}).sectorCode,'','an unknown scene must not invent a grid code from its slug');
});
