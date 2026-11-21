# Equipped knife throws

During tactical exploration and turn-based combat, a combatant holding the facón (1813) in the active hand can aim and throw it at a person or ground cell as a physical, recoverable projectile. See [parity requirements](../../requirements/ja2-parity.md) row C09 (blades and thrown knives support quiet attacks and short-range tradeoffs). A facón in a pocket, a
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

Patusco's JA2 Strategy Guide 1.3, pp. 28–29 and 63 ([G28–29, G63](../../requirements/ja2-parity.md#scope-and-evidence)), describes knife attacks,
aiming and stealth tradeoffs. JA2 Stracciatella at pinned revision
`a06f4896c43c76396529e415a29a8ca26b00f9f1` describes:

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
adaptations. They are not exact classic behavior.
