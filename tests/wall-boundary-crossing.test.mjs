import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,exitPreview} from '../game/tactical.js';
import {boundaryMatches,boundaryPassable} from '../game/tactical-exits.js';
import {entryTerrainCells} from '../game/sector-entry.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {prisonerCanExit} from '../game/prisoner-escape.js';
import {escortArrival} from '../game/quest-escort.js';

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
