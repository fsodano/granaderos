import {validProjectileEnergy} from './projectile-energy.js';

// Range-normalized Granaderos tuning, not a measured drag coefficient. Arc
// length and selected effective range share abstract tactical distance units.
export const PROJECTILE_AIR_DRAG_MODEL='range-energy-retention-v1';
export function validProjectileAirDrag(value,energy){
 return Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===2&&Object.hasOwn(value,'model')&&Object.hasOwn(value,'retentionAtRange')&&value.model===PROJECTILE_AIR_DRAG_MODEL&&Number.isFinite(value.retentionAtRange)&&value.retentionAtRange>0&&value.retentionAtRange<=1&&validProjectileEnergy(energy));
}
export const hasProjectileAirDrag=weapon=>validProjectileAirDrag(weapon.projectileAirDrag,weapon.projectileEnergy)&&weapon.projectileAirDrag.retentionAtRange<1&&Number.isFinite(weapon.range)&&weapon.range>0;
export function projectileAirRetention(weapon,distance){
 const profile=weapon.projectileAirDrag;
 if(!hasProjectileAirDrag(weapon)||distance<=0)return 1;
 return Math.exp(Math.log(profile.retentionAtRange)*distance/weapon.range);
}
