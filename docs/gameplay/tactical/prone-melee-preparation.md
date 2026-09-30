# Standing before close combat

A conscious fighter who is prone now stands before using a sabre, loose blade, fists, a fitted bayonet or a gun stock. Crouched and mounted melee keep their established posture. Prone firearm shooting does not change.

The target preview includes the complete cost before confirmation: crawl approach, 6 AP to stand and the actual weapon's strike cost. For example, a Sable Corvo attack beside its target costs 18 AP (6 + 12), while a bayonet thrust or gun strike costs 22 AP (6 + 16). An unaffordable order preserves position, stance, AP, items, time and random state.

A contextual click keeps the fighter's crawl route until reaching the target. At contact, the ordinary stance action runs before the attack. Standing can expose the fighter to contact or an interrupt. If that happens, the paid movement and stance remain, but the pending strike stops. The player must assess the new situation and give another order. The UI does not play a strike pose for an interrupted preparation or approach.

Exploration retains its normal time and energy rules. Standing and attacking consume their ordinary action time without spending or refilling AP. Crawling also consumes energy. If standing reveals an active threat, normal combat entry occurs and cancels the queued attack. An already knocked-down fighter still needs an explicit recovery order.

Enemy and militia attacks use the same preparation and cost checks. A prone rifleman in shooting mode prefers a useful loaded shot over standing for an adjacent gun strike; explicit close-combat mode retains the melee choice. Automatic counterattacks and bayonet interceptions require an upright defender; they cannot cause a free stand during another person's attack. The legacy charge and brace commands require standing first when prone. These changes use the existing bayonet and do not add a new attachment type.

No character artwork changes are part of this fix. Equipment-specific sprite work remains separate.

## Verification

The complete suite passes **2,119/2,119 tests**, with no failures or skips. Typecheck and the production build pass. The static export verifies 960 files and 856 asset references.

Sixteen new model/integration tests cover the four attack profiles, exact and insufficient AP, actual crawl routes, interrupted preparation, saved continuation, exploration, AI, crouched/mounted attacks, prone gunfire and automatic defenses. A separate review also exercised an exact-budget militia attack and collapse from bleeding during standing.

The established southern campaign regression continues through Córdoba, the real Tucumán defeat and capture, paid rescue and recovery, Salta and Yatasto. Its Salta preparation waits for the actual wounds to heal and transfers existing dressings through ordinary sector inventory orders when a doctor runs out. In this run, 18 initial doctor dressings plus four donated dressings cover 21 consumed dressings and one remaining dressing. Treatment, contracts and the twelve-hour march retain their actual costs. Fallen fighters stay dead; captives return only through the normal rescue rules. This route does not establish a complete winning campaign from the Retiro-only start.

Live practice checks:

- Güemes: preview 18 AP, stands and strikes for 46 damage, finishes with 82 AP.
- With only 17 AP: the same order fails; Güemes stays prone with 17 AP and the target takes no damage.
- Azurduy: preview 22 AP, completes a bayonet thrust, finishes with 78 AP; fitting condition becomes 99%, while the loaded round and eight reserve cartridges remain.
- Brown: a 12 AP shot keeps him prone, consumes one loaded round and preserves all eight reserve cartridges.

The temporary practice screen uses a disposable battle without campaign storage. Its six cards retain the hand and red/green indicators from [the roster milestone](roster-hand-status.md).
