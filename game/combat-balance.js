// Edit this file to tune combat. Weapon-specific damage, range and AP live in
// firearm-definitions.js. Both sides use these same settings.
// These are Granaderos playtest settings, not claimed JA2 constants.
export const COMBAT_BALANCE=Object.freeze({
 firearmDamageMultiplier:1,
 firearmFlightRangeMultiplier:2, // Physical flight limit; effective aiming range is unchanged.
 shotLoadFlightRangeMultiplier:3, // Finite pellet travel; keeps a falling tail beyond the shared 2-range onset.
 firearmFarDropIncrement:.1, // Beyond 2 effective ranges, slope falls by this / (2*range) per cell; tactical tuning.
 firearmBodyResistance:Object.freeze({head:15,torso:30,legs:23}), // Lead-ball force spent passing through one body.
 firearmBodyPenetrationThreshold:20,
 firearmBodyPenetrationMaximumChance:95,
 shotLoadHorizontalSpread:.25, // Tangent of lateral pellet spread; explicit game tuning.
 shotLoadVerticalSpread:.08,
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
export function coveredFirearmDamage(amount,coverFactor=1,coverMultiplier=COMBAT_BALANCE.coverDamageReductionMultiplier){
 const factor=Math.max(0,Math.min(1,1-(1-coverFactor)*coverMultiplier));
 return amount*factor;
}
// Cover damage tuning cannot return force already spent passing through a body.
export function penetratingFirearmDamage(amount,impact,coverMultiplier=COMBAT_BALANCE.coverDamageReductionMultiplier){
 return Math.max(0,coveredFirearmDamage(amount,impact.coverDamageFactor??impact.damageFactor,coverMultiplier)-amount*(impact.bodyDamageReduction??0));
}
