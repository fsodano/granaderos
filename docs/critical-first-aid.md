# Critical first aid

Equip bandages and click a living wounded ally or visible civilian. The medic approaches and uses one dressing. The cursor previews the treatment and combined movement cost. Exploration spends time and movement energy; combat also spends AP. If the treatment is partial, the preview and result say that more first aid is needed.

Below 15 HP, treatment first restores critical health toward `min(15,maxHp)`. Each restored HP uses two work points and reduces bleeding by one; remaining work reduces bleeding one point at a time. The medic's medical skill, dexterity and experience determine work per stroke. Dead patients cannot be treated. Normal wounds at or above 15 HP receive the existing bandage treatment without further HP restoration. Full recovery still needs strategic medical care or eligible rest.

The patient receives no AP, energy or fatigue recovery. Treatment retains posture and knockdown. The existing local consciousness rule is recomputed; it does not grant a free stand or turn budget. An interrupted or invalid approach spends no dressing. The actual treatment is checked again on arrival because wounds or contact can change while walking.

Automatic squad bandaging includes critical casualties even when bleeding has stopped. It repeats legal treatment orders while supplies and safe access permit. It stops for contact, blocked access, an incapacitated medic or exhausted dressings. Enemy and militia medics can also treat a visible critical ally with their own supplies.

## Persistence

Named civilians use the same maximum HP and health scale as their authored service record. New encounters retain existing service wounds, including after dismissal. Legacy 100-HP civilian records migrate once by preserving missing HP; living casualties stay at least 1 HP and corpses remain dead. Historical harm receipts are retained unchanged. Archived civilian bodies retain their original scale after a recruited soldier gains maximum health through training; a returning pristine contact uses the current service scale.

A separate medical receipt counts actual paid critical HP restoration. The campaign acknowledges only new restoration once. Repeated or stale reports cannot grant health again. Treatment does not clear player-harm history, repair reputation or overwrite an existing death. Generic civilians retain their 100-HP maximum. The public view exposes the observed treatment forecast, not the private medical or harm ledger.

## Reference and period adaptations

The reference is Stracciatella commit `a06f4896c43c76396529e415a29a8ca26b00f9f1`, [Soldier_Control.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Soldier_Control.cc#L6990-L7191). The critical threshold, two-work cost, bleed reduction and weighted skill are based on that implementation. Its [real-time effort constant](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/RT_Time_Defines.h#L11) supplies the 12-point work budget per local treatment stroke.

Local adaptations are explicit:

- One indivisible linen dressing is consumed per effective stroke. There are no classic medical-kit condition charges or medical-kit rate bonus.
- A stroke uses the existing 25/20/18 AP treatment cost. A skill-based AP discount never weakens treatment. Work is the same in exploration and combat; exploration deducts no AP.
- Ordinary noncritical bandaging retains its existing complete-wound treatment. Critical casualties with no bleeding remain treatable so older bandaged saves are not stranded.
- Local bleeding is a rate from 0 to 10, rather than the classic unbandaged wound amount. Stored bandaged HP stays within the remaining wound total. Partial treatment uses the shared world clock; an unfinished hemorrhage can tick between strokes. Classic continuous service suspends that patient's bleeding while service is active.
- Local unconsciousness remains HP below 15 or exhausted energy. Classic consciousness/get-up breath thresholds and continuous service animations are not implemented by this change.

This closes the critical stabilization gap, not all medical or JA2 parity. Authored NPC treatment responses, civilian automatic bandaging, and broader campaign balance remain incomplete.

## Verification

The live Retiro test used a compact open field, paid Acosta recruitment, and a prepared already-bandaged critical Cabral at 3 HP. Mouse treatment raised him to 9 HP; Enter applied the second dressing and reached 15 HP. Dressings fell 2→1→0. Acosta retained 91 AP and 100 energy. Cabral remained prone. Reload and Continue preserved 15 HP, 81 bandaged wounds and exhausted dressings.

A second prepared squad test used paid Villalba and Acosta hires. The optional **Vendar escuadra** control equipped Villalba's own dressings, applied two strokes, and brought Acosta from 3 to 15 HP in five tactical seconds. The patient retained zero AP, 100 energy, prone posture and knockdown; Villalba spent two dressings and kept his 90 AP. The fixtures supplied the injury and compact geometry, not free medical resources or skills.

The general suite passed 2,510 checks with no skips. A later 92-check health, training and save group passed, including eight critical persistence tests that cover fractional legacy HP and the later training of recruited contacts. A further 30 equipment/reload/fitting checks cover captive release, including a soldier who left his gun behind: release retains his loose rounds without inventing a personal loaded-gun record. This repairs an existing save error exposed by the revised campaign route.

Final TypeScript and production build checks passed; the static export verified 960 files and 856 asset references. The complete artillery suite passed 12 checks, including the paid rescue with its original squad and finite equipment. A repeated general run after the final save fixes was interrupted by agent process cleanup before completion; it is not counted as a pass. The focused groups above cover those final fixes.

The complete campaign route passed all eight checks with no skips. Its controller uses critical care, actual targeted shots, a paid medical supply trip, a coastal rescue and a paid Córdoba reserve. It reaches Yatasto at phase 3, hour 306, second 2677, with 2,085 pesos, 15 permanent deaths and no remaining captives. Every accepted battle replays deterministically and passes save/return validation. This verifies the established southern scenario in the isolated gameplay checkout, not a complete Retiro-only campaign or overall balance. See [the current route record](northern-route.md).
