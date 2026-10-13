import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {expandSaveTerrain} from '../game/save-terrain.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

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

function declaredScenes(campaign,{sectors,scenes={},label='earned campaign'}){
 assert.deepEqual(Object.keys(campaign.sectorStates).sort(),[...sectors].sort(),`${label}: exact retained sector set`);
 assert.deepEqual(Object.keys(campaign.sceneStates??{}).sort(),Object.keys(scenes).sort(),`${label}: exact retained mission scene set`);
 return [...sectors.map(id=>{const battle=campaign.sectorStates[id];assert.equal(battle.sectorId,id);assert.equal(battle.sceneId??null,null);return [id,battle];}),
  ...Object.entries(scenes).map(([id,sector])=>{const battle=campaign.sceneStates[id];assert.equal(battle.sceneId,id);assert.equal(battle.sectorId,sector);return [id,battle];})];
}
function noClearance(battle,label){
 for(const person of [...battle.units,...(battle.npcs??[])].filter(p=>(p.hp??100)>0&&!p.departure&&!p.fled))
  assert.equal((battle.artillery??[]).some(g=>g.x===person.x&&g.y===person.y&&(g.tacticalLevel??0)===(person.tacticalLevel??0)),false,`${label}/${person.id}: no coordinate clearance is permitted`);
}
function addLegacyMarker(battle,label,{current=false}={}){
 noClearance(battle,label);
 if(current){assert.equal(battle.artilleryOccupancyVersion,1,`${label}: freshly constructed battle already has its current marker`);return;}
 assert.equal(Object.hasOwn(battle,'artilleryOccupancyVersion'),false,`${label}: exact legacy record`);
 battle.artilleryOccupancyVersion=1;
}
function expectedPair(pair,options){
 const expected=structuredClone(pair),label=options.label??'earned pair';
 for(const [id,battle]of declaredScenes(expected.campaign,options))addLegacyMarker(battle,`${label}/${id}`);
 const request=expected.campaign.pendingBattle;
 // The reviewed active inputs have no hidden resumed scene. Future fixtures
 // must state and check that extra scene explicitly before using this oracle.
 if(request){
  assert.equal(request.resumeSnapshot,undefined,`${label}: no resumed snapshot is omitted`);
  assert.ok(expected.battle,`${label}: active request retains its actual battle`);
  assert.equal(expected.battle.battleId,request.id);assert.equal(expected.battle.sectorId,request.sector);
  assert.equal(expected.battle.sceneId??null,request.sceneId??null);
  addLegacyMarker(expected.battle,`${label}/active`,{current:Boolean(options.currentBattle)});
 }else{assert.equal(request,null);assert.equal(expected.battle,null);}
 return expected;
}
function verifyPair(input,admitted,options){
 const expected=expectedPair(input,options),label=options.label??'earned pair';
 assert.deepEqual(admitted,expected,`${label}: only the declared occupancy markers change; full coordinates, custody, wounds, clocks, resources and request remain exact`);
 assert.deepEqual(decodeSave(encodeSave(admitted.campaign,admitted.battle)),admitted,`${label}: official paired admission is idempotent`);
 return admitted;
}

// Raw object inputs and freshly constructed native battles retain their exact
// values. No fixture is repaired and no captured native result is regenerated.
export function admitEarnedArtilleryPair(input,options){
 const before=structuredClone(input),admitted=decodeSave(encodeSave(input.campaign,input.battle));
 verifyPair(input,admitted,options);assert.deepEqual(input,before);return admitted;
}
export function admitEarnedArtillerySave(text,options){
 const value=JSON.parse(text);assert.equal(value.format,'granaderos');assert.ok([1,2].includes(value.schema));
 // Expand only the original serialization codecs before comparing full value
 // equality. These transformations add no campaign actions or tactical work.
 if(value.schema===2)expandSaveTerrain(value);
 for(const field of ['sectorStates','sceneStates'])for(const [id,battle]of Object.entries(value.campaign[field]??{}))value.campaign[field][id]=expandCellScene(battle,value.campaign);
 const input={campaign:value.campaign,battle:expandCellScene(value.battle,value.campaign)??null};
 return verifyPair(input,decodeSave(text),options);
}
export function admitEarnedArtilleryBattle(input,{label='earned native battle',context=null}={}){
 const before=structuredClone(input),expected=structuredClone(input);addLegacyMarker(expected,label);
 const admitted=validateBattleSnapshot(input,context);assert.deepEqual(admitted,expected,`${label}: only the occupancy marker changes`);
 assert.deepEqual(input,before);assert.deepEqual(validateBattleSnapshot(admitted,context),admitted);return admitted;
}
export function beforeEarnedArtilleryMarkers(input,options){
 assert.equal(input.pendingBattle,null,'A legacy campaign SHA cannot omit an active paired scene.');
 const before=structuredClone(input),legacy=structuredClone(input);
 for(const [id,battle]of declaredScenes(legacy,options)){
  assert.equal(battle.artilleryOccupancyVersion,1,`${options.label??'earned campaign'}/${id}: admitted marker`);
  noClearance(battle,id);delete battle.artilleryOccupancyVersion;
 }
 assert.deepEqual(input,before);return legacy;
}
