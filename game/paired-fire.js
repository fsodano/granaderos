import {handLayout} from './hand-layout.js';

const pistol = id => [1805,1806,1808].includes(id);
export function secondHeldPistol(unit) {
 if(!unit||unit.weaponDropped||(unit.activeSlot??'primary')!=='primary'||!pistol(unit.weapon))return null;
 const hands=handLayout(unit),other=unit.offHand;
 return hands.right==='primary'&&hands.left==='offhand'&&other?.count===1&&pistol(other.weapon)?other:null;
}
// Ownership alone is insufficient: a gun in a pocket never joins a shot.
// An empty main hand keeps the existing deliberate reload-click contract.
export function pairedPistol(unit) {
 if(!unit||unit.weaponDropped||(unit.activeSlot??'primary')!=='primary'||!pistol(unit.weapon)||!(unit.loaded>0)||unit.jammed)return null;
 const other=secondHeldPistol(unit);
 return other&&other.loaded>0&&!other.jammed&&(other.condition??100)>0?other:null;
}
export const pistolPairPenalty = unit => unit.traits?.includes('ambidextrous')?0:20;

// Read-only shot geometry/skill view. Damage and experience always credit the
// real soldier, and only mutable gun state are written to its item.
export function secondaryPistolView(unit,record=unit.offHand) {
 return {...unit,weapon:record.weapon,loaded:record.loaded,condition:record.condition??100,jammed:Boolean(record.jammed),
  weaponInstanceId:record.instanceId,weaponFittings:record.fittings,contentWeapon:record.contentWeapon,weaponMetadata:record.weaponMetadata,ammunitionChoice:record.ammunitionChoice,reloadProgress:record.reloadProgress,
  offHand:undefined,leftHandItem:null};
}
