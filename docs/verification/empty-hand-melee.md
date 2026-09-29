# Empty hands and retained secondary weapons

Runtime/test source: `cfc605fc3645cf7e08407241c6e8d8116e395789`.

A dropped/recovered primary no longer hides a retained selected secondary.
The secondary keeps its actual authored definition and picture. An empty
selected hand resolves as **Puños**, with no invented bayonet or weapon weight.
The normal melee control names the empty-hand action and shows twelve AP.
Unarmed charge and bracing reject before cost, movement or random rolls.

A punch uses the existing development design's bounded attribute/condition and
awareness formula. A hit causes small health damage and a separate breath loss;
a miss still spends the attack AP. Military unconsciousness clears combat AP
and mounted state. Breath loss does not spend a horse's stamina. Civilian hits
use the existing physical injury and intentional responsibility model. Existing
wound rules still apply; a punch is not guaranteed to spare a critically wounded
target. Authored injuries, care, saved return and finite equipment keep their
normal campaign semantics.

## Verification

Seven simulations and one mounted production-game case pass **8/8**. The related
HUD, recovery, equip and military-condition group passes **28/28**. Complete
regression passes **1159/1159**, zero failures or skips, in 269,357 ms. Types,
production export (722 files, 632 asset references), 36 baseline comparisons and
documentation audit (253 requirements, 92 evidence records) pass.

Prepared combat fields check a seeded hit and miss, twelve-AP payment, health
and breath separation, unconsciousness, preserved horse stamina, actual finite
recovery of the fallen opponent's gun, unavailable attacks, awareness/attribute
responses and intentional civilian attribution. These fields are declared
boundary fixtures, not a complete combat route.

The campaign case configures a critical paid arrival, hires both actual
soldiers, uses declared adjacent opening positions, physically collects the
primary and provides finite first aid. The stabilized soldier can select the
retained authored blade, save, leave and return. A separate actual collection of
both slots leaves empty hands. The mounted Home check selects the soldier in
the roster, reads the actual empty-hand control and pictures, then selects the
secondary through the inventory and checks the normal persisted save.

The first return assertion expected the transient dropped-primary flag; campaign
settlement correctly stores an empty primary as weapon zero. The check now
asserts the actual empty slot and inability to fire. The civilian boundary fixture
now uses the real health initializer with explicit breath. No engine restrictions
were relaxed for either correction.

This does not add a deliberate put-away/unarmed hand selector, blunt firearm
strikes, physical bayonet fitting, conscious theft, specialized counters or
complete contact-combat parity. Held firearm melee retains the prior bayonet
fallback until fitting is integrated. The bounded fix removes the unowned blade
only when the selected hand is actually empty. There is no live-browser,
performance or full-campaign acceptance. Exact-head CI remains required before
publication.
