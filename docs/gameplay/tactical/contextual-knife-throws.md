# Equipped knife throws

This implements the missing thrown-knife part of audit C09. The existing facón
(1813) can be thrown when it is in the active hand. A facón in a pocket, a
fixed bayonet, a sabre, a gun butt and empty hands do not qualify. Character
identity does not grant a weapon or a spare.

## Controls and costs

An ordinary hostile click still approaches for a melee attack. Right-click or
F selects the throw cursor while the facón is held. Right-click on a visible
person adds an affordable aim level; after the last level it returns to zero.
Right-click without a character returns to movement. Left-click confirms the
throw. Head, torso and legs use the existing pointed body frame; a prone target
has one zone. A ground throw uses a fixed height and can strike an ally.

The preview includes standing, turning, the attack and up to four additional
aim levels. Preparation uses ordinary stance/look actions. New contact or a
reaction can stop preparation before the knife leaves the hand. Insufficient
AP, energy, reach, an unavailable target or an unsupported destination rejects
the order before preparation. During exploration there is no AP debit; action
time and energy still advance.

A throw costs six energy. Attack AP depends on dexterity and agility; aim adds
three AP per level. Strength, breath and actual item weight determine useful
reach. Accuracy uses dexterity, marksmanship, condition, aim, range, wounds,
shock, morale, breath and fatigue. Beyond useful reach, accuracy is halved;
twice that reach is the physical limit. These numbers are Granaderos tuning,
not a literal conversion of a universal JA2 seven-AP action.

## Flight and ownership

The direct physical ray stops at the first body, wall, furniture or floor
slab. Knives do not penetrate cover. Ground-to-roof and roof-to-ground throws
use physical height; a descending top-slab impact stays on the roof. Misses
use seeded scatter and retain the original aiming height. Public previews
exclude unseen bodies; actual flight can hit an unseen or friendly body.

A launch extracts one actual item from the hand. Condition, identity and item
metadata stay with it. A hit places the knife in the actual injured person's
inventory, including a bodyguard who intercepts the attack. A full inventory
leaves the same knife on a supported nearby cell. A miss also leaves a real
recoverable ground item. Throwing never debits cartridges, reload progress or
priming powder, and creates no gun smoke or muzzle flash. The remaining item
in the other hand can become active under the existing hand rules. Another
knife in a pocket must be equipped through the normal inventory.

The throw emits a quiet, anonymous two-cell sound. It uses ordinary damage,
bleeding, balance and inventory/save rules. There is no automatic stealth kill.
AI uses the same owned-item and preview rules, keeps melee at contact distance,
and requires a clear observed target with at least 65% chance within useful
reach before it spends a knife. Each preparation action is a separate decision.

The flight visual is transient, bounded to the returned battle state and absent
from saves. Its path excludes unseen bodies. It shows a knife and ground shadow
without a firing effect. The actor uses the existing strike pose as a fallback;
a dedicated illustrated knife-throw pose remains an art task.

## Reference and period adaptation

Patusco's JA2 Strategy Guide 1.3, pp. 28–29 and 63, describes knife attacks,
aiming and stealth tradeoffs. The implementation also checked JA2 Stracciatella
at pinned revision `a06f4896c43c76396529e415a29a8ca26b00f9f1`:

- [Target cursor and aim refinement](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/UI_Cursors.cc#L170).
- [Standing, turning and attack AP](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Points.cc#L993).
- [Throw accuracy and range](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Weapons.cc#L3530).
- [Removal of the actual held knife](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Weapons.cc#L800).
- [Hit recovery](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/LOS.cc#L1829) and [direct projectile flight](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/LOS.cc#L3329).

This is an improvised use of an existing period knife. The available
[period-equipment evidence](../../reference/period-equipment-evidence.md) does not establish
facón throwing as standard military doctrine. The guaranteed supported recovery
fallback, hard physical range limit, numerical tuning, separate equip of a
pocket spare and ordinary damage instead of a special instant kill are explicit
adaptations. They must not be reported as exact classic behavior.

## Verification

The committed implementation and final labels at `3ec50fa` pass the complete
**1,887/1,887-test suite**, with no skips. Typecheck and the production build pass;
the static export validates 960 files and 856 asset references. These results
come from the isolated committed source, before integration with concurrent
uncommitted work in the shared checkout.

The new geometry, statistics, cursor, rendering, reducer and campaign checks
cover exact item identity, damage-recipient custody, full packs, roof support,
friend/hidden-body interception, failed-order rollback, interruption during
preparation, finite ammunition, and deterministic save/reentry. The campaign
case uses a fresh Retiro start, paid hiring, purchase, a real throw, pickup,
return and reentry. It does not inject a replacement blade or a victory report.

Existing movement/interrupt fixtures that required an approaching enemy now use
a melee-only sabre. Their original AP, route and continuation assertions remain.
Separate tests prove that an equipped facón can choose a finite ranged attack.

Live browser checks on the isolated practice scene at port 3033:

- Right-click: torso, 12 AP, aim 0. Two refinements: 18 AP, aim 2, 88% chance.
  Selection alone leaves AP and energy unchanged. Right-click on empty ground
  cancels the cursor.
- F and ArrowUp select the head. Pointing at the head also selects it. A confirmed
  aim-1 head throw spends 15 AP and six energy: Dorrego ends at 85 AP / 94 energy;
  the target ends at 58 health. The pistol retains two loads and six reserve
  cartridges. The transient knife and shadow both appear, then clear.
- A prone target remains the single body zone after ArrowUp.
- Exploration ground throw: no AP counter in the reticle, six energy spent,
  one ground knife at D6. The ordinary two-cell approach and pickup recover that
  knife at 87% condition. Dragging it from the pocket into the main hand equips
  it; the pistol moves to the freed pocket with its contents retained.
- The pickup dialog shows energy/time in exploration, and AP costs in combat.
  The browser reported no warning/error entries in the checked scene.

The practice scene uses explicit test equipment and enemies; it does not read or
write a player's saved campaign. The dedicated throw-pose art and full JA2/campaign
parity remain open work.
