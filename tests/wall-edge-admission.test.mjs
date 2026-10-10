import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,environmentTargetAt,environmentPreview,canSee} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {MAX_TACTICAL_LEVEL} from '../game/tactical-space.js';

const wall=(extra={})=>({id:'divider',x:5,y:4,axis:'y',type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40,...extra});
function field(edge=wall(),extra={}){
 const width=12,height=10,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
 return createBattle([{id:'p',x:4,y:4,facing:2,activeSlot:'tool',activeTool:'inventory:bar',inventory:{bar:{count:1,weight:2,itemType:'tool',toolKey:'crowbar',condition:100}}}],{width,height,tiles,wallEdges:[edge],enemies:[],exploration:true,...extra});
}
function atomicRefusal(before,action){
 const after=actBattle(before,action);assert.ok(after.lastError);
 for(const key of ['units','wallEdges','tiles','props','seed','elapsedSeconds','groundItems','smoke','lights'])assert.deepEqual(after[key],before[key],key);
}
test('edge targeting rejects mismatched lattice geometry before breach, tools or AP',()=>{
 const s=field(),edge=s.wallEdges[0],point={...edge,wallEdgeId:edge.id};
 for(const patch of [{x:10},{y:9},{axis:'x'},{tacticalLevel:1},{wallEdgeId:'absent'}]){
  assert.equal(environmentTargetAt(s,{...point,...patch}),null);
  atomicRefusal(s,{type:'breach',unitId:'p',...point,...patch});
  atomicRefusal(s,{type:'environment',unitId:'p',kind:'wall',...point,...patch,verb:'breach'});
 }
 const preview=environmentPreview(s,s.units[0],{kind:'wall',...point},'breach');
 assert.equal(preview.valid,true);assert.equal(preview.action.wallEdgeId,edge.id);assert.equal(preview.action.axis,'y');
 const after=actBattle(s,{type:'breach',unitId:'p',wallEdgeId:edge.id});
 assert.equal(after.lastError,null);assert.equal(after.wallEdges[0].id,edge.id);assert.equal(after.wallEdges[0].destroyed,true);assert.equal(after.units[0].inventory.bar.condition,97);
});
test('direct door commands retain optional edge geometry and refuse unrelated IDs atomically',()=>{
 const s=field(wall({type:'door',doorId:'leaf',open:false,locked:false,cover:0}));
 for(const patch of [{x:10},{y:9},{axis:'x'},{tacticalLevel:1},{wallEdgeId:'absent'}])atomicRefusal(s,{type:'door',unitId:'p',doorId:'leaf',wallEdgeId:'divider',x:5,y:4,axis:'y',tacticalLevel:0,open:true,...patch});
 const after=actBattle(s,{type:'door',unitId:'p',doorId:'leaf',wallEdgeId:'divider',x:5,y:4,axis:'y',tacticalLevel:0,open:true});
 assert.equal(after.lastError,null);assert.equal(after.wallEdges[0].open,true);assert.equal(after.wallEdges[0].id,'divider');
});
test('edge admission rejects malformed, duplicated and unsupported geometry',()=>{
 const s=field();assert.doesNotThrow(()=>validateBattleSnapshot(s));
 for(const patch of [{axis:'z'},{x:13},{x:-1},{y:10},{x:5.5},{tacticalLevel:-1},{tacticalLevel:MAX_TACTICAL_LEVEL+1},{elevation:-1},{elevation:1000},{elevation:'wrong'},{elevation:null},{elevation:3},{tacticalLevel:1}]){
  const invalid=structuredClone(s);Object.assign(invalid.wallEdges[0],patch);assert.throws(()=>validateBattleSnapshot(invalid),undefined,JSON.stringify(patch));
 }
 for(const edge of [wall({x:6}),wall({id:'other'})]){
  const duplicate=structuredClone(s);duplicate.wallEdges.push(edge);assert.throws(()=>validateBattleSnapshot(duplicate));
 }
 const unsafe=structuredClone(s);unsafe.wallEdges[0]={...unsafe.wallEdges[0],...JSON.parse('{"__proto__":{"blocked":false}}')};assert.throws(()=>validateBattleSnapshot(unsafe));
 assert.equal(canSee(s,s.units[0],{x:5,y:4}),false,'an admitted closed wall still blocks sight');
});
test('boundary and upper-level edges keep supported bases, including unequal adjacent heights',()=>{
 const boundary=field(wall({x:0,elevation:0}));assert.doesNotThrow(()=>validateBattleSnapshot(boundary));
 const upper=field(wall({tacticalLevel:1,elevation:3}),{upperSurfaces:[{id:'roof-left',x:4,y:4,tacticalLevel:1,elevation:3,kind:'roof',type:'floor',blocked:false,cover:0},{id:'roof-right',x:5,y:4,tacticalLevel:1,elevation:4,kind:'roof',type:'floor',blocked:false,cover:0}]});
 assert.doesNotThrow(()=>validateBattleSnapshot(upper));
 upper.wallEdges[0].elevation=4;assert.doesNotThrow(()=>validateBattleSnapshot(upper));
 upper.wallEdges[0].elevation=2;assert.throws(()=>validateBattleSnapshot(upper));
});
test('edge capacity includes every supported tactical level',()=>{
 const width=4,height=4,tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0})),upperSurfaces=[],wallEdges=[];
 for(let level=0;level<=MAX_TACTICAL_LEVEL;level++){
  if(level)for(const tile of tiles)upperSurfaces.push({...tile,id:`roof-${level}-${tile.x}-${tile.y}`,type:'floor',tacticalLevel:level,elevation:level*3,kind:'roof'});
  for(let y=0;y<=height;y++)for(let x=0;x<width;x++)wallEdges.push(wall({id:`edge-${level}-x-${x}-${y}`,x,y,axis:'x',tacticalLevel:level}));
  for(let y=0;y<height;y++)for(let x=0;x<=width;x++)wallEdges.push(wall({id:`edge-${level}-y-${x}-${y}`,x,y,axis:'y',tacticalLevel:level}));
 }
 const s=createBattle([{id:'p',x:1,y:1}],{width,height,tiles,wallEdges,upperSurfaces,enemies:[],exploration:true});
 assert.equal(s.wallEdges.length,(2*width*height+width+height)*(MAX_TACTICAL_LEVEL+1));assert.doesNotThrow(()=>validateBattleSnapshot(s));
});

test('a legacy standalone corner compiles unique edges with one door or window leaf',()=>{
 for(const type of ['door','window']){
  const s=field(),tiles=structuredClone(s.tiles);
  for(const [x,y]of [[5,4],[6,4],[5,5]])Object.assign(tiles.find(tile=>tile.x===x&&tile.y===y),{type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40});
  Object.assign(tiles.find(tile=>tile.x===5&&tile.y===4),{id:'legacy-corner',type,...(type==='door'?{doorId:'corner-leaf',open:false,locked:false}:{}),contents:[]});
  const converted=createBattle([{id:'p',x:3,y:3}],{width:s.width,height:s.height,tiles,enemies:[],exploration:true});
  const corner=converted.wallEdges.filter(edge=>edge.id.startsWith('legacy-corner'));
  assert.equal(corner.length,2);assert.equal(new Set(corner.map(edge=>edge.id)).size,2);assert.equal(corner.filter(edge=>edge.type===type).length,1);
  const solid=corner.find(edge=>edge.type==='wall');assert.equal(solid.doorId,undefined);assert.equal(solid.contents,undefined);assert.equal(solid.blocked,true);
  assert.doesNotThrow(()=>validateBattleSnapshot(converted));assert.ok(converted.tiles.every(tile=>!tile.blocked));
 }
});
