import test from 'node:test';
import assert from 'node:assert/strict';
import {compactSaveTerrain,expandSaveTerrain} from '../game/save-terrain.js';
import {compactCellScene,expandCellScene,cellSceneExpandedBytes} from '../game/cell-scene-storage.js';
import {saveByteLength} from '../game/save-limits.js';

const field=(cell=false,memo='á')=>({width:cell?64:20,height:cell?48:16,
 sectorId:cell?'cell-27-27':'retiro',...(cell?{sourceMapId:'cell-27-27'}:{}),
 tiles:Array.from({length:cell?3072:320},(_,i)=>({x:i%(cell?64:20),y:Math.floor(i/(cell?64:20)),type:'grass',blocked:false,cover:0,memo:{marks:[memo]}}))});
const mixed=()=>({battle:field(),campaign:{sectorStates:{'cell-27-27':compactCellScene(field(true))}}});

test('a large save can mix palette terrain with retained world-cell terrain and restore independent tile metadata',()=>{
 const value=mixed(),before=structuredClone(value),cell=value.campaign.sectorStates['cell-27-27'];
 assert.equal(cellSceneExpandedBytes(cell),saveByteLength(JSON.stringify(field(true).tiles)));
 assert.equal(compactSaveTerrain(value),true);assert.equal(value.battle.tiles.encoding,'palette-v1');assert.equal(cell.tiles.format,'cell-tiles-v1');
 expandSaveTerrain(value);assert.deepEqual(value,before);
 const expanded=expandCellScene(cell);assert.deepEqual(expanded,field(true));
 expanded.tiles[0].memo.marks.push('changed');assert.deepEqual(expanded.tiles[1].memo.marks,['á']);assert.deepEqual(cell.tiles.palette[0].memo.marks,['á']);
});

test('malformed cell terrain rejects before another map is expanded',()=>{
 for(const mutate of [m=>m.tiles.runs[1]--,m=>m.tiles.runs[0]=-1,m=>m.tiles.extra=true,m=>m.width=128,m=>m.sourceMapId='retiro',m=>m.sectorId='retiro',m=>m.tiles.format='unknown']){
  const value=mixed();compactSaveTerrain(value);mutate(value.campaign.sectorStates['cell-27-27']);
  assert.throws(()=>expandSaveTerrain(value),/terreno/);assert.equal(value.battle.tiles.encoding,'palette-v1');
 }
});

test('both terrain formats share the total expansion cap before any palette is allocated',()=>{
 const value=mixed(),cell=compactCellScene(field(true,'x'.repeat(700)));
 for(let i=0;i<10;i++)value.campaign.sectorStates[`retained-${i}`]=structuredClone(cell);
 compactSaveTerrain(value);assert.ok(saveByteLength(JSON.stringify(value))<1_000_000);
 assert.throws(()=>expandSaveTerrain(value),/20 MB/);assert.equal(value.battle.tiles.encoding,'palette-v1');
});
