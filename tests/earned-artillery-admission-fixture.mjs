import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';

// These specifically pinned old earned records have no living gun-cell
// overlaps. Their only admitted change is the new version marker. This oracle
// permits no coordinate migration and preserves every other campaign field.
export function admitEarnedArtilleryMarkers(input,{sectors,scenes={},label='earned campaign'}){
 const before=structuredClone(input),expected=structuredClone(input);
 assert.equal(input.pendingBattle,null,`${label}: no active snapshot is omitted by the expected scene set`);
 assert.deepEqual(Object.keys(input.sectorStates).sort(),[...sectors].sort(),`${label}: exact retained sector set`);
 assert.deepEqual(Object.keys(input.sceneStates??{}).sort(),Object.keys(scenes).sort(),`${label}: exact retained mission scene set`);
 const mark=(battle,identity)=>{
  assert.equal(Object.hasOwn(battle,'artilleryOccupancyVersion'),false,`${label}: ${identity} is the unchanged legacy record`);
  for(const person of [...battle.units,...(battle.npcs??[])].filter(p=>(p.hp??100)>0&&!p.departure&&!p.fled)){
   assert.equal((battle.artillery??[]).some(g=>g.x===person.x&&g.y===person.y&&(g.tacticalLevel??0)===(person.tacticalLevel??0)),false,`${label}: ${identity}/${person.id} needs no coordinate clearance`);
  }
  battle.artilleryOccupancyVersion=1;
 };
 for(const id of sectors){assert.equal(input.sectorStates[id].sectorId,id);assert.equal(input.sectorStates[id].sceneId??null,null);mark(expected.sectorStates[id],id);}
 for(const [id,sector]of Object.entries(scenes)){assert.equal(input.sceneStates[id].sceneId,id);assert.equal(input.sceneStates[id].sectorId,sector);mark(expected.sceneStates[id],id);}
 const admitted=decodeSave(encodeSave(input)).campaign;
 assert.deepEqual(admitted,expected,`${label}: official admission adds only the exact scene version markers; every coordinate, physical stock, wound, death, clock and resource stays exact`);
 assert.deepEqual(input,before,`${label}: admission does not mutate the raw earned input`);
 assert.deepEqual(decodeSave(encodeSave(admitted)).campaign,admitted,`${label}: marker admission is idempotent`);
 return admitted;
}
