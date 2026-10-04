import assert from 'node:assert/strict';
import {artilleryProfile} from '../game/artillery-definitions.js';
import {sectorDeploymentModel,sectorDeploymentAction} from '../game/sector-deployment.js';
import {coastalBatteryController} from './coastal-command-driver.mjs';

// Place real arrivals beside owned pieces. Existing crew-aware orders choose
// which guns the surviving people can operate; placement supplies no crew,
// health, ammunition, time or equipment.
export function finiteBatteryDriver(initial,{gunIds=null,reserveIds=[],report=()=>{}}={}){
 const guns=initial.artillery.filter(gun=>gun.side==='player'&&(gunIds?gunIds.includes(gun.id):!gun.stationed));
 assert.ok(guns.length&&new Set(guns.map(gun=>gun.id)).size===guns.length,'The finite battery requires distinct actual guns.');
 const model=sectorDeploymentModel(initial);
 const arrivals=new Set((model?.units??initial.units.filter(unit=>unit.entryReason==='arrival')).map(unit=>unit.id)),reserved=new Set(reserveIds.map(String));
 const field=initial.units.filter(unit=>arrivals.has(unit.id)&&unit.side==='player'&&unit.hp>=15&&!unit.unconscious&&!unit.routed&&!unit.departure&&!reserved.has(unit.id));
 assert.ok(field.length>=Math.max(...guns.map(gun=>artilleryProfile(initial,gun).crew)),'Actual capable arrivals must meet each selected gun type’s crew requirement.');
 const assignments=new Map(),remaining=[...field];
 for(const gun of [...guns].sort((a,b)=>artilleryProfile(initial,a).crew-artilleryProfile(initial,b).crew||a.id.localeCompare(b.id))){
  const required=artilleryProfile(initial,gun).crew;
  if(remaining.length<required)continue;
  for(const unit of remaining.splice(0,required))assignments.set(unit.id,gun);
 }
 for(const unit of remaining)assignments.set(unit.id,guns[0]);
 const deploy=start=>{
  const before=structuredClone(start),current=sectorDeploymentModel(start);assert.ok(current);let battle=start;const occupied=new Set();
  for(const arrival of current.units){
   const gun=assignments.get(arrival.id)??guns[0],options=current.entryCells[arrival.edge].filter(point=>!occupied.has(`${point.x},${point.y}`));
   const distance=point=>Math.hypot(point.x-gun.x,point.y-gun.y);
   options.sort((a,b)=>(reserved.has(arrival.id)?distance(b)-distance(a):distance(a)-distance(b))||a.y-b.y||a.x-b.x);
   const point=options[0];assert.ok(point,'The actual arrival requires a legal entry cell.');
   battle=sectorDeploymentAction(battle,{type:'placeDeployment',unitIds:[arrival.id],x:point.x,y:point.y});assert.equal(battle.lastError,null,battle.lastError);occupied.add(`${point.x},${point.y}`);
  }
  battle=sectorDeploymentAction(battle,{type:'confirmDeployment'});assert.equal(battle.lastError,null,battle.lastError);
  assert.deepEqual(battle.artillery,before.artillery,'Entry placement preserves all finite gun records.');
  for(const unit of before.units){const actual=battle.units.find(next=>next.id===unit.id);for(const key of ['hp','maxHp','bleeding','ammo','loaded','condition','inventory','medkits','energy','ap'])assert.deepEqual(actual[key],unit[key]);}
  report({event:'finiteBatteryDeployment',guns:guns.map(gun=>({id:gun.id,type:gun.type,loaded:gun.loaded,ammo:gun.ammo,requiredCrew:artilleryProfile(battle,gun).crew})),field:field.map(unit=>unit.id)});
  return battle;
 };
 const policy=coastalBatteryController({...initial,units:initial.units.filter(unit=>!reserved.has(unit.id))},{sharedArtillerySight:true});
 return {deploy,controller:(battle,unit)=>reserved.has(unit.id)?null:policy(battle,unit)};
}
