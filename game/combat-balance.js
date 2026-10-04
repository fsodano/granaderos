// Edit this file to tune combat. Weapon-specific damage, range and AP live in
// firearm-definitions.js. Both sides use these same settings.
// These are Granaderos playtest settings, not claimed JA2 constants.
export const COMBAT_BALANCE=Object.freeze({
 firearmDamageMultiplier:1,
 rangePenaltyMultiplier:.98,
 sightPenaltyMultiplier:1,
 outsideWeaponChanceFactor:.5,
 outsideSightChanceFactor:.5,
 woundAPMaximumPenalty:35,
 energyAPPenaltyPerPoint:.25,
 runningExcessEnergyMultiplier:.5, // 0 = walking effort; 1 = earlier running effort.
 woundAccuracyPenaltyPerPoint:.3,
 shockAccuracyPenaltyPerPoint:5,
 fireAPMultiplier:1,
 reloadAPMultiplier:1,
 coverDamageReductionMultiplier:1, // 1 preserves current physical cover.
});
export function coveredFirearmDamage(amount,coverFactor=1){
 const factor=Math.max(0,Math.min(1,1-(1-coverFactor)*COMBAT_BALANCE.coverDamageReductionMultiplier));
 return amount*factor;
}
