import assert from 'node:assert/strict';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';

// Declare old-save merchant custody from one existing finite owner. There is
// no sale, purchase, payment or new-player-route grant in this fixture.
export function legacyMerchantGun(state,{kind='depot',sector=state.location,artilleryId,model}={}){
 const next=structuredClone(state);let gun;
 if(kind==='stock'){
  assert.ok(next.armory[model]>0);next.armory[model]--;
  const spec=artilleryProfile(next,model);
  gun={id:`piece-${next.nextArtilleryId++}`,type:model,side:'player',loaded:spec.initialLoaded,ammo:spec.initialAmmo};
 }else{
  const source=kind==='field'?next.sectorStates[sector].artillery:next.artilleryDepots[sector];
  const index=source.findIndex(gun=>gun.id===artilleryId);assert.ok(index>=0);
  gun=storedArtilleryRecord(source.splice(index,1)[0]);
 }
 next.artilleryMerchants??={};next.artilleryMerchants[sector]??={guns:[]};next.artilleryMerchants[sector].guns.push(gun);
 return next;
}
