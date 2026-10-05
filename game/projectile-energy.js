import {AMMUNITION_WEIGHT} from './ammunition-types.js';

// Versioned Granaderos balance: energy is measured in joules, but these impact
// points, body/material costs and injury caps are game tuning, not SI forces.
export const PROJECTILE_ENERGY_MODEL='kinetic-energy-v1';
export const PROJECTILE_ENERGY_JOULES_PER_IMPACT=20;
export function validProjectileEnergy(value){
 return Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===3&&['model','massGrams','muzzleVelocityMps'].every(key=>Object.hasOwn(value,key))&&value.model===PROJECTILE_ENERGY_MODEL&&Number.isFinite(value.massGrams)&&value.massGrams>=.1&&value.massGrams<=40&&value.massGrams<=AMMUNITION_WEIGHT*1000&&Number.isFinite(value.muzzleVelocityMps)&&value.muzzleVelocityMps>=25&&value.muzzleVelocityMps<=600);
}
export const projectileEnergyJ=profile=>.5*(profile.massGrams/1000)*profile.muzzleVelocityMps**2;
export const hasProjectileEnergy=weapon=>weapon?.projectileEnergy!==undefined;
export function projectileLaunchImpact(weapon){
 return hasProjectileEnergy(weapon)?projectileEnergyJ(weapon.projectileEnergy)/PROJECTILE_ENERGY_JOULES_PER_IMPACT:Math.max(1,weapon.damage??1);
}
export function projectileDamageFactor(remaining,weapon,power){
 return hasProjectileEnergy(weapon)?Math.max(0,Math.min(1,remaining/weapon.damage)):remaining/power;
}
// The injury denominator remains authored damage. An energetic ball may carry
// more penetration, while a weak contact cannot receive a full damage draw.
export function kineticNominalImpact(weapon,impact,share=1,coverMultiplier=1){
 const launch=projectileLaunchImpact(weapon)*share,cap=weapon.damage*share;
 const coverLoss=launch*(1-(impact.coverDamageFactor??1));
 const incoming=impact.incomingImpact??Math.max(0,launch-coverLoss-launch*((impact.bodyDamageReduction??0)+(impact.ricochetDamageReduction??0)+(impact.airDamageReduction??0)));
 return Math.max(0,Math.min(cap,incoming+(1-coverMultiplier)*coverLoss));
}
