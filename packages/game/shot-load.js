import {hasProjectileEnergy,projectileEnergyJ,projectileLaunchImpact,kineticNominalImpact} from './projectile-energy.js';
import {COMBAT_BALANCE} from './combat-balance.js';
import {projectileFlight} from './projectile-cover.js';
import {absoluteBodyHeight} from './sight-geometry.js';
import {getHitLocationProfile} from './targeted-combat.js';

// Nine finite rays share the configured load's force. These spread/weight
// values are Granaderos tuning, not measured historic buckshot ballistics.
export const SHOT_LOAD_PATTERN=Object.freeze([[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]].map(([side,up])=>Object.freeze({side,up,weight:1/9})));
export const isShotLoad=weapon=>weapon?.loadPattern==='cone';

export function shotLoadFlight(state,actor,target,weapon,hitLocation='torso',options={}){
 const dx=target.x-actor.x,dy=target.y-actor.y,distance=Math.hypot(dx,dy),height=options.destinationHeight??absoluteBodyHeight(state,target,hitLocation);
 const pellets=[],kinetic=hasProjectileEnergy(weapon),launch=projectileLaunchImpact(weapon),energy=kinetic?projectileEnergyJ(weapon.projectileEnergy):0;let spentWeight=0,spentForce=0,spentMass=0,spentEnergy=0;
 if(distance>0&&Number.isFinite(height))for(const [index,pattern] of SHOT_LOAD_PATTERN.entries()){
  const nx=dx/distance,ny=dy/distance,side=pattern.side*COMBAT_BALANCE.shotLoadHorizontalSpread;
  const vx=nx-ny*side,vy=ny+nx*side;
  const destination={...target,x:actor.x+vx*distance,y:actor.y+vy*distance};
  const weight=kinetic&&index===SHOT_LOAD_PATTERN.length-1?1-spentWeight:pattern.weight,force=kinetic?(index===SHOT_LOAD_PATTERN.length-1?launch-spentForce:launch*weight):weapon.damage*weight;
  const massGrams=kinetic?(index===SHOT_LOAD_PATTERN.length-1?weapon.projectileEnergy.massGrams-spentMass:weapon.projectileEnergy.massGrams*weight):0,energyJ=kinetic?(index===SHOT_LOAD_PATTERN.length-1?energy-spentEnergy:energy*weight):0;
  spentMass+=massGrams;spentEnergy+=energyJ;
  spentWeight+=weight;spentForce+=force;
  const flight=projectileFlight(state,actor,destination,{...weapon,damage:weapon.damage*weight,loadPattern:'single'},hitLocation,{...options,forceBudget:force,destinationHeight:height+pattern.up*COMBAT_BALANCE.shotLoadVerticalSpread*distance,maxDistance:weapon.range*COMBAT_BALANCE.shotLoadFlightRangeMultiplier,physicalHitLocation:true});
  pellets.push({index,weight,flight,...(kinetic?{massGrams,energyJ,launchImpact:force}:{})});
 }
 const bodyImpacts=pellets.flatMap(p=>p.flight.bodyImpacts.map(entry=>({...entry,pelletIndex:p.index,weight:p.weight})));
 return {shotLoad:true,pelletCount:SHOT_LOAD_PATTERN.length,totalForce:weapon.damage,pellets,bodyImpacts};
}

// The zero/zero scatter draw becomes +1/0 in ordinary firearm execution.
// Keep that outcome's double weight rather than silently making it uniform.
export function shotLoadScatter(actor,target){
 const radius=Math.min(4,Math.max(1,Math.ceil(Math.hypot(target.x-actor.x,target.y-actor.y)/8))),counts=new Map(),total=(radius*2+1)**2;
 for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++){
  const x=target.x+(dx||dy?dx:1),y=target.y+dy,key=`${x},${y}`,entry=counts.get(key)??{point:{...target,x,y},weight:0};
  entry.weight+=1/total;counts.set(key,entry);
 }
 return [...counts.values()];
}

function targetResult(flight,kind,target,weapon){
 let none=1,force=0;const regions=new Map();
 for(const pellet of flight.pellets){
  const entry=pellet.flight.bodyImpacts.find(body=>body.victimKind===kind&&body.victimId===target.id);
  if(entry){const incoming=(hasProjectileEnergy(weapon)?kineticNominalImpact(weapon,entry,pellet.weight,COMBAT_BALANCE.coverDamageReductionMultiplier):entry.incomingImpact)*entry.reachChance;none*=1-entry.reachChance;force+=incoming;regions.set(entry.hitLocation,(regions.get(entry.hitLocation)??0)+incoming);}
 }
 // Nominal region sums share the actual discharge's .8..1.2 force draw.
 // Integrate its injury rounding without adding preview RNG or pretending
 // that every pellet strikes the selected body region.
 let expectedDamage=0;
 for(const [location,incoming]of regions){
  const scaled=getHitLocationProfile(location).damageMultiplier*incoming*COMBAT_BALANCE.firearmDamageMultiplier;
  const low=scaled*.8,high=scaled*1.2;
  if(high>low)for(let injury=Math.floor(low+.5);injury<=Math.floor(high+.5);injury++)expectedDamage+=injury*Math.max(0,Math.min(high,injury+.5)-Math.max(low,injury-.5))/(high-low);
 }
 return {contact:1-none,force:Math.min(flight.totalForce,force),expectedDamage};
}

// Previews read the supplied observed-only scene and make no RNG draws. The
// same center intent and each possible scatter outcome serve every aim level.
export function shotLoadForecast(state,actor,target,weapon,hitLocation='torso',options={}){
 const kind=options.targetKind??((state.npcs??[]).includes(target)?'npc':'unit'),height=options.destinationHeight??absoluteBodyHeight(state,target,hitLocation);
 const direct=shotLoadFlight(state,actor,target,weapon,hitLocation,{...options,destinationHeight:height});
 const hit=targetResult(direct,kind,target,weapon),miss={contact:0,force:0,expectedDamage:0};
 const scatter=shotLoadScatter(actor,target).map(outcome=>{
  const flight=shotLoadFlight(state,actor,outcome.point,weapon,hitLocation,{...options,destinationHeight:height}),result=targetResult(flight,kind,target,weapon);
  miss.contact+=result.contact*outcome.weight;miss.force+=result.force*outcome.weight;miss.expectedDamage+=result.expectedDamage*outcome.weight;
  return {...outcome,flight};
 });
 const selected=hit.contact>0||miss.contact>0;
 return {...direct,blocked:!selected,damageFactor:hit.contact?Math.min(1,hit.force/(hit.contact*weapon.damage)):0,obstacles:direct.pellets.flatMap(p=>p.flight.obstacles),forecast:{hit,miss},scatter};
}

export function shotLoadChance(path,accuracy){
 const probability=Math.max(0,Math.min(100,accuracy))/100,contact=probability*path.forecast.hit.contact+(1-probability)*path.forecast.miss.contact;
 const expectedForce=Math.min(path.totalForce,probability*path.forecast.hit.force+(1-probability)*path.forecast.miss.force),raw=contact*100;
 const expectedDamage=probability*path.forecast.hit.expectedDamage+(1-probability)*path.forecast.miss.expectedDamage;
 const damageFactor=contact>0?Math.max(0,Math.min(1,expectedForce/(contact*path.totalForce))):0;
 return {shotLoad:true,pelletCount:path.pelletCount,chance:Math.round(raw)||raw,damageFactor,expectedForce,expectedDamage};
}
