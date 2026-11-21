# Critical first aid

On the tactical battlefield and strategic campaign ledger, equip bandages and click a living wounded ally or visible civilian. The medic approaches and uses one dressing. The cursor previews the treatment and combined movement cost. Exploration spends time and movement energy; combat also spends AP. If the treatment is partial, the preview and result say that more first aid is needed.

Below 15 HP, treatment first restores critical health toward `min(15,maxHp)`. Each restored HP uses two work points and reduces bleeding by one; remaining work reduces bleeding one point at a time. The medic's medical skill, dexterity and experience determine work per stroke. Dead patients cannot be treated. Normal wounds at or above 15 HP receive the existing bandage treatment without further HP restoration. Full recovery still needs strategic medical care or eligible rest.

The patient receives no AP, energy or fatigue recovery. Treatment retains posture and knockdown. The existing local consciousness rule is recomputed; it does not grant a free stand or turn budget. An interrupted or invalid approach spends no dressing. The actual treatment is checked again on arrival because wounds or contact can change while walking.

Automatic squad bandaging includes critical casualties even when bleeding has stopped. It repeats legal treatment orders while supplies and safe access permit. It stops for contact, blocked access, an incapacitated medic or exhausted dressings. Enemy and militia medics can also treat a visible critical ally with their own supplies.

## Persistence

Named civilians use the same maximum HP and health scale as their authored service record. New encounters retain existing service wounds, including after dismissal. Legacy 100-HP civilian records migrate once by preserving missing HP; living casualties stay at least 1 HP and corpses remain dead. Historical harm receipts are retained unchanged. Archived civilian bodies retain their original scale after a recruited soldier gains maximum health through training; a returning pristine contact uses the current service scale.

A separate medical receipt counts actual paid critical HP restoration. The campaign acknowledges only new restoration once. Repeated or stale reports cannot grant health again. Treatment does not clear player-harm history, repair reputation or overwrite an existing death. Generic civilians retain their 100-HP maximum. The public view exposes the observed treatment forecast, not the private medical or harm ledger.

## Reference and period adaptations

The reference is the JA2 Stracciatella source, [Soldier_Control.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Soldier_Control.cc#L6990-L7191). The critical threshold, two-work cost, bleed reduction and weighted skill are based on that implementation. Its [real-time effort constant](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/RT_Time_Defines.h#L11) supplies the 12-point work budget per local treatment stroke.

Local adaptations are explicit:

- One indivisible linen dressing is consumed per effective stroke. There are no classic medical-kit condition charges or medical-kit rate bonus.
- A stroke uses the existing 25/20/18 AP treatment cost. A skill-based AP discount never weakens treatment. Work is the same in exploration and combat; exploration deducts no AP.
- Ordinary noncritical bandaging retains its existing complete-wound treatment. Critical casualties with no bleeding remain treatable so older bandaged saves are not stranded.
- Local bleeding is a rate from 0 to 10, rather than the classic unbandaged wound amount. Stored bandaged HP stays within the remaining wound total. Partial treatment uses the shared world clock; an unfinished hemorrhage can tick between strokes. Classic continuous service suspends that patient's bleeding while service is active.
- Local unconsciousness remains HP below 15 or exhausted energy. Classic consciousness/get-up breath thresholds and continuous service animations remain open.

Critical stabilization is one part of medical parity. Authored NPC treatment responses, civilian automatic bandaging, and broader campaign balance remain open.
