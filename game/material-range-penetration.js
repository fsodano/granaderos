// Granaderos tuning in tactical distance units, not measured projectile speed.
// Each selected load opts in; omitted older definitions keep their resistance.
export const DEFAULT_MATERIAL_RANGE_SLOPE=.25;
export const validMaterialRangeSlope=value=>Number.isFinite(value)&&value>=0&&value<=1;
export function materialRangeResistanceFactor(weapon,distance){
 const slope=weapon.materialRangeSlope;
 if(!validMaterialRangeSlope(slope)||!Number.isFinite(weapon.range)||weapon.range<=0||!Number.isFinite(distance)||distance<0)return 1;
 return 1+slope*Math.max(0,distance/weapon.range-1);
}
