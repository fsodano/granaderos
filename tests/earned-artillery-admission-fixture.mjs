import assert from 'node:assert/strict';
import {decodeSave,encodeSave} from '../game/save.js';
import {expandSaveTerrain} from '../game/save-terrain.js';
import {expandCellScene} from '../game/cell-scene-storage.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {restoreWeaponReferences} from '../game/weapon-definition.js';

// These specifically pinned old earned records have no living gun-cell
// overlaps. Admission adds the new version marker and only explicitly listed
// missing empty wall arrays. No coordinate or physical state may change.
export function admitEarnedArtilleryMarkers(input,{sectors,scenes={},missingWallEdges,label='earned campaign'}){
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
 addDeclaredEmptyWalls(expected,{sectors,scenes,missingWallEdges,label});
 const admitted=decodeSave(encodeSave(input)).campaign;
 assert.deepEqual(admitted,expected,`${label}: official admission adds only the exact scene version markers and declared empty wall arrays; every coordinate, physical stock, wound, death, clock and resource stays exact`);
 assert.deepEqual(input,before,`${label}: admission does not mutate the raw earned input`);
 assert.deepEqual(decodeSave(encodeSave(admitted)).campaign,admitted,`${label}: marker admission is idempotent`);
 return admitted;
}

function addDeclaredEmptyWalls(campaign,{sectors,scenes={},missingWallEdges,label='earned campaign'}){
 if(missingWallEdges===undefined)return;
 assert.deepEqual(Object.keys(missingWallEdges).sort(),['scenes','sectors'],`${label}: exact empty-wall declaration fields`);
 for(const [field,kind,declared]of [['sectorStates','sectors',sectors],['sceneStates','scenes',Object.keys(scenes)]]){
  const ids=missingWallEdges[kind];assert.ok(Array.isArray(ids));assert.equal(new Set(ids).size,ids.length);
  const missing=Object.entries(campaign[field]??{}).filter(([,battle])=>!Object.hasOwn(battle,'wallEdges')).map(([id])=>id);
  assert.deepEqual(missing.sort(),[...ids].sort(),`${label}: exact legacy scenes lacking wallEdges`);
  for(const id of ids){assert.ok(declared.includes(id));assert.equal(Object.hasOwn(campaign[field][id],'wallEdges'),false);campaign[field][id].wallEdges=[];}
 }
}
function expandDeclaredWeaponReferences(value,{weaponReferences,label='earned save'}){
 const ids=[];
 const visit=node=>{
  if(!node||typeof node!=='object')return;
  if(node.contentWeapon&&Object.hasOwn(node.contentWeapon,'definitionRef')){
   assert.deepEqual(Object.keys(node.contentWeapon),['definitionRef'],`${label}: exact compact weapon reference`);ids.push(node.contentWeapon.definitionRef);
  }
  for(const [key,child]of Object.entries(node))if(key!=='contentCampaign'&&key!=='contentWeapon')visit(child);
 };
 visit(value);
 if(weaponReferences===undefined){assert.equal(ids.length,0,`${label}: compact weapon references need an explicit fixture declaration`);return;}
 assert.deepEqual(Object.keys(weaponReferences).sort(),['count','ids']);assert.equal(ids.length,weaponReferences.count);
 assert.equal(new Set(weaponReferences.ids).size,weaponReferences.ids.length);
 assert.deepEqual([...new Set(ids)].sort(),[...weaponReferences.ids].sort(),`${label}: exact compact weapon ID set`);
 const embedded=new Set(value.campaign.contentCampaign.package.weapons.map(weapon=>weapon.id));
 for(const id of ids)assert.ok(embedded.has(id),`${label}: the raw embedded package owns ${id}`);
 restoreWeaponReferences(value.campaign,value);
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
 addDeclaredEmptyWalls(expected.campaign,options);
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
 expandDeclaredWeaponReferences(value,options);
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
