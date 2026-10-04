// Classic range terms, converted from ten world units per tile to tiles.
// The caller maps this game's light, smoke and concealment to apparent distance.
export function shotRangeModifiers({distance,weaponRange,apparentRange=distance,visibleRange}){
 for(const value of [distance,weaponRange,apparentRange,visibleRange])if(!Number.isFinite(value)||value<0)throw Error('Invalid shot range.');
 const beyondSight=apparentRange>visibleRange,beyondWeapon=distance>weaponRange;
 const effectiveSightRange=apparentRange+Math.max(0,apparentRange-visibleRange);
 return {distance,weaponRange,visibleRange,apparentRange,effectiveSightRange,beyondSight,beyondWeapon,
  weaponPenalty:Math.max(0,Math.trunc((3*distance-weaponRange)*10/17)),
  sightAdjustment:Math.trunc(3*(9-effectiveSightRange)),
  chanceFactor:(beyondSight?.5:1)*(beyondWeapon?.5:1)};
}
export function shotRangeText(profile){
 const n=value=>Number(value.toFixed(1));
 return `Distancia: ${n(profile.distance)} casillas · alcance del arma: ${n(profile.weaponRange)}.${profile.beyondWeapon?` Fuera del alcance eficaz: probabilidad al ${Math.round((profile.weaponChanceFactor??.5)*100)}%.`:''}${profile.beyondSight?` Visión difícil: probabilidad al ${Math.round((profile.sightChanceFactor??.5)*100)}%.`:''}`;
}
