import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,exitPreview} from '../game/tactical.js';
import {boundaryMatches,boundaryPassable} from '../game/tactical-exits.js';
import {entryTerrainCells} from '../game/sector-entry.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {prisonerCanExit} from '../game/prisoner-escape.js';
import {escortArrival} from '../game/quest-escort.js';
import {militiaArrivalEntry,militiaArrivalTerrain} from '../game/militia-arrival.js';

const ground=()=>Array.from({length:16},(_,i)=>({x:i%4,y:Math.floor(i/4),type:'grass',blocked:false,cover:0}));
const cases=[['N',{x:1,y:0},{x:1,y:0,axis:'x'}],['E',{x:3,y:1},{x:4,y:1,axis:'y'}],['S',{x:1,y:3},{x:1,y:4,axis:'x'}],['W',{x:0,y:1},{x:0,y:1,axis:'y'}]];
function field(edge,point,wall){
 const exit={id:'retiro:buenos_aires',edge,destination:'buenos_aires',entryEdge:'N',entryAnchor:{x:9,y:0}};
 return createBattle([{id:'p',...point,weapon:1800}],{width:4,height:4,tiles:ground(),wallEdges:[{id:'boundary-wall',...wall,type:'wall',material:'stone',blocked:true,blocksSight:true,cover:40}],enemies:[],exploration:true,exits:[exit]});
}

test('each closed outer wall keeps its boundary cell usable and rejects a paid exit atomically',()=>{
 for(const [edge,point,wall]of cases){
  const state=field(edge,point,wall),before=structuredClone(state);
  assert.equal(state.tiles.find(t=>t.x===point.x&&t.y===point.y).blocked,false);
  assert.equal(boundaryMatches(state,point,edge),true);assert.equal(boundaryPassable(state,point,edge),false);
  assert.equal(exitPreview(state,{unitIds:['p'],exitId:state.exits[0].id}).available,false);
  const next=actBattle(state,{type:'exit',unitIds:['p'],exitId:state.exits[0].id});assert.match(next.lastError,/bloqueado/);
  assert.deepEqual({...next,lastError:null,log:before.log},{...before,lastError:null});assert.deepEqual(state,before);
 }
});

test('an open outer door permits the actual crossing and closed geometry rejects a forged receipt',()=>{
 const state=field(...cases[2]);Object.assign(state.wallEdges[0],{type:'door',doorId:'south-door',open:true,locked:false,blocked:false,blocksSight:false});
 assert.equal(boundaryPassable(state,state.units[0],'S'),true);
 const next=actBattle(state,{type:'exit',unitIds:['p'],exitId:state.exits[0].id});assert.equal(next.lastError,null);assert.ok(next.units[0].departure);
 assert.equal(next.units[0].energy<state.units[0].energy,true);assert.ok(next.elapsedSeconds>0);
 const forged=structuredClone(next);Object.assign(forged.wallEdges[0],{open:false,blocked:true,blocksSight:true});
 assert.throws(()=>validateBattleSnapshot(forged),/paso de salida/);
});

test('arrival candidates exclude closed outer edges while preserving ordinary boundary geometry',()=>{
 const state=field(...cases[0]);
 for(let x=0;x<4;x++)if(x!==1)state.wallEdges.push({...state.wallEdges[0],id:`north-${x}`,x});
 assert.deepEqual(entryTerrainCells(state,state.units[0],'N'),[]);
 state.wallEdges[0].destroyed=true;
 assert.deepEqual(entryTerrainCells(state,state.units[0],'N').map(t=>[t.x,t.y]),[[1,0]]);
 assert.equal(boundaryPassable(state,{x:1,y:0,tacticalLevel:1},'N'),false);
});

test('prisoner and quest escorts require clear outer edges and clear contact between boundary participants',()=>{
 const state=field(...cases[2]),leader=state.units[0],npc={id:'resident',x:2,y:3,hp:100,energy:100,detention:{freed:true},escort:{leaderId:'p',waiting:false}};
 assert.equal(prisonerCanExit(state,npc,leader,state.exits[0]),false);
 const quest={sector:'retiro',escort:{destination:'buenos_aires',edge:'S'}},record={status:'offered',escortOrder:{leaderId:'p',waiting:false}};
 state.sectorId='retiro';assert.throws(()=>escortArrival(quest,record,state,npc,leader),/salida/);
 state.wallEdges[0].destroyed=true;assert.equal(prisonerCanExit(state,npc,leader,state.exits[0]),true);assert.doesNotThrow(()=>escortArrival(quest,record,state,npc,leader));
 state.wallEdges.push({id:'between-escorts',x:2,y:3,axis:'y',type:'wall',material:'stone',blocked:true,blocksSight:true});
 assert.equal(prisonerCanExit(state,npc,leader,state.exits[0]),false);assert.throws(()=>escortArrival(quest,record,state,npc,leader),/salida/);
});

const militiaRoutes=[['retiro','buenos_aires'],['buenos_aires','retiro'],['buenos_aires','ensenada'],['ensenada','buenos_aires']];
function militiaField(from,to,expanded=false){
 const width=expanded?44:20,height=expanded?36:16,{edge}=militiaArrivalEntry(from,to);
 const state={sectorId:to,width,height,tiles:Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false})),props:[],wallEdges:[]};
 const unit={militia:true,militiaArrival:{from,to}};
 for(let n=0;n<(edge==='N'||edge==='S'?width:height);n++)state.wallEdges.push({id:`outer-${n}`,x:edge==='W'?0:edge==='E'?width:n,y:edge==='N'?0:edge==='S'?height:n,axis:edge==='N'||edge==='S'?'x':'y',type:'wall',blocked:true,blocksSight:true});
 return {state,unit,edge};
}
function militiaGate(state,point,edge){
 const x=point.x+(edge==='E'?1:0),y=point.y+(edge==='S'?1:0),gate=state.wallEdges.find(w=>w.x===x&&w.y===y);
 Object.assign(gate,{type:'door',doorId:`door-${gate.id}`,open:false,locked:false,blocked:true,blocksSight:true});return gate;
}
test('distributed militia cannot arrive through closed outside edges in any direction or map size',()=>{
 for(const [from,to]of militiaRoutes)for(const expanded of [false,true]){
  const {state,unit,edge}=militiaField(from,to,expanded),before=structuredClone(state);
  const blocked=militiaArrivalTerrain(state,unit);assert.equal(blocked.cells.length,0,`${edge} solid outside wall`);assert.deepEqual(state,before);
  militiaGate(state,blocked.anchor,edge);assert.equal(militiaArrivalTerrain(state,unit).cells.length,0,`${edge} closed outside door`);
 }
});
test('an open outside militia door admits the boundary first and the connected interior cohort after it',()=>{
 for(const [from,to]of militiaRoutes)for(const expanded of [false,true]){
  const {state,unit,edge}=militiaField(from,to,expanded),{anchor}=militiaArrivalTerrain(state,unit),gate=militiaGate(state,anchor,edge);
  Object.assign(gate,{open:true,blocked:false,blocksSight:false});
  const {cells}=militiaArrivalTerrain(state,unit);assert.deepEqual([cells[0].x,cells[0].y],[anchor.x,anchor.y]);assert.equal(boundaryPassable(state,cells[0],edge),true);
  assert.equal(cells.length,state.width*state.height);assert.ok(cells.slice(0,60).some(cell=>!boundaryMatches(state,cell,edge)),`${edge} cohort extends into the interior`);
  Object.assign(gate,{destroyed:true,broken:true,open:true,blocked:false,blocksSight:false});assert.equal(militiaArrivalTerrain(state,unit).cells.length,state.width*state.height,`${edge} breached outside door`);
 }
});
test('militia entry also requires a clear first inward shared edge',()=>{
 for(const [from,to]of militiaRoutes){
  const {state,unit,edge}=militiaField(from,to),{anchor}=militiaArrivalTerrain(state,unit),gate=militiaGate(state,anchor,edge);
  Object.assign(gate,{open:true,blocked:false,blocksSight:false});
  const inward={id:'inward-divider',doorId:'inward-door',x:anchor.x+(edge==='W'?1:0),y:anchor.y+(edge==='N'?1:0),axis:edge==='N'||edge==='S'?'x':'y',type:'door',open:false,locked:false,blocked:true,blocksSight:true};state.wallEdges.push(inward);
  assert.equal(militiaArrivalTerrain(state,unit).cells.length,0,`${edge} blocked inward door`);
  Object.assign(inward,{open:true,blocked:false,blocksSight:false});assert.equal(militiaArrivalTerrain(state,unit).cells.length,state.width*state.height,`${edge} open inward door`);
 }
});
