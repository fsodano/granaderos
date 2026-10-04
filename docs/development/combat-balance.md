# Combat tuning

The settings in [`game/combat-balance.js`](../../game/combat-balance.js) control tactical combat for both sides. Edit the numbers, restart the local game, and test a new encounter. Existing wounds remain in saved games.

The October 3 playtest reported that a shot could remove too much health and leave too few action points for a useful response. The earlier Brown Bess base damage was 58, before its random damage draw and body-location multiplier. The initial setting reduces the maximum wound deduction from 50 to 35 AP and reduces distance-based accuracy penalties by 2%. A wounded survivor therefore has more AP on the next turn. In the regression benchmark, an untreated 61-HP wound and 69 energy leave 71 AP: an aimed shot costs 18, one step behind an opaque wall costs 8, and a standing reload costs 45. All three real orders fit; the earlier wound setting left 62 AP. Firearm damage remains at its earlier value; head shots remain more dangerous. Grenades, artillery, knives, and melee retain their existing damage profiles.

| Setting | Effect | Current value |
| --- | --- | --- |
| `firearmDamageMultiplier` | Multiplies firearm impact damage. Lower values increase survival. | 1 |
| `rangePenaltyMultiplier` | Scales range-based accuracy penalties. Lower values help distant shooting. | 0.98 |
| `sightPenaltyMultiplier` | Scales negative aiming adjustments for apparent distance. It does not reveal hidden actors. | 1 |
| `outsideWeaponChanceFactor` | Multiplies accuracy outside the weapon's effective range. | 0.5 |
| `outsideSightChanceFactor` | Multiplies accuracy beyond personal sight. A teammate must still see a targeted enemy. | 0.5 |
| `woundAPMaximumPenalty` | Sets the maximum injury deduction from next-turn AP. Earlier value: 50. | 35 |
| `energyAPPenaltyPerPoint` | Deducts next-turn AP per missing energy point. Earlier value: 0.25. | 0.25 |
| `woundAccuracyPenaltyPerPoint` | Deducts shooting accuracy per effective wound point. Earlier value: 0.3. | 0.3 |
| `shockAccuracyPenaltyPerPoint` | Deducts shooting accuracy per shock point. Earlier value: 5. | 5 |
| `fireAPMultiplier` | Scales firearm discharge cost. Preparation and turning retain their own costs. | 1 |
| `reloadAPMultiplier` | Scales firearm loading work. Partial reloads use the same value. | 1 |
| `coverDamageReductionMultiplier` | Scales damage lost when a shot penetrates cover. 1 preserves current cover protection. Opaque barriers still block shots. | 1 |

Weapon-specific values are in [`game/firearm-definitions.js`](../../game/firearm-definitions.js). Authored campaign weapons can also have their own values. To test the shooting loop, compare a healthy mercenary and a wounded mercenary with the same gun: fire, move into cover, reload, and fire again. Check daytime and night conditions separately. These values are an initial playtest adjustment, not a completed campaign balance assessment. Controlled wet-weather and paid artillery battles retain real finite-stock victories at these settings. Campaign route tests and further manual playtests must also assess the effects on survivors, supplies and later battles.

Presentation timing is separate. [`game/battle-playback.js`](../../game/battle-playback.js) uses milliseconds for preparation, walking steps, impacts, and effects. A longer presentation does not consume more game time or change damage, AP, or visibility.

Field learning keeps the existing 40-credit threshold and ten earned-point cap. A skill strictly below 35 cannot earn practice credit. Eligible repeated actions provide chances to earn credit, with another chance on a real firearm hit. Actual strategic repairs and hourly medical treatment use the same Wisdom-dependent chances; idle or completed assignments give no attempt. The chance and Wisdom adjustment follow [`ProcessStatChange` in JA2-Stracciatella](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Tactical/Campaign.cc). The per-person saved `practiceSeed` provides a separate random stream, so learning rolls do not change shot hit/damage rolls. Strategic study retains its existing Wisdom-dependent rate. Neither the tactical UI nor the inventory treats skills as unlockable prerequisites.
