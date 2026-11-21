# Loading a gun with selected ammunition

A cartridge stack placed onto a firearm now loads that specific gun. This works
with a click or drag, in either hand or in a pocket. The gun stays in its slot.
The same interaction works in tactical and campaign inventories.

Only the selected physical stack and quantity can supply the load. Existing
chamber loads, condition, identity, fittings and unfinished work remain on the
gun. Other stacks and the other pistol cannot supply ammunition or be loaded by
this action. Any unused cartridges remain on the cursor. Esc returns the cursor
through ordinary inventory placement; it does not trigger loading.

Combat uses the same per-charge AP cost, stance, gunsmith and nearby-helper
modifiers as R. Work can continue across turns. A cartridge and a portion of
available priming powder are consumed only when a charge finishes. Depleted
powder held in a hand is removed before the hand layout is rebuilt. Exploration
spends elapsed time and no AP. Loading uses ordinary noise, contact, reaction,
wound and clock processing. Campaign inventory preserves its existing free
arrangement/attachment time contract and records the changed gun for deployment.

A full, failed, broken or incompatible gun rejects the load. Stale source or
destination fingerprints, unavailable actors, invalid quantities and zero combat
AP also reject without changing custody or charging time. Moving ammunition to
an empty hand or pocket remains free.

## Reference and period adaptation

The [pinned JA2 ReloadGun implementation](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Items.cc#L1082-L1312)
uses the supplied ammunition object and the target gun. The
[placement path](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Items.cc#L2000-L2048)
permits pocket and hand hosts. The
[cursor path](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Interface_Panels.cc#L1536-L1590)
retains an unconsumed object. The bundled manual PDF pages 22, 29 and 54 describe
selection, loading and compatibility; Patusco's JA2 Strategy Guide 1.3 (cited as **G** in [the JA2 parity requirements](../../requirements/ja2-parity.md#scope-and-evidence)), printed page 49, describes calibers.

Classic JA2 also exchanges detachable magazines and can exchange incompatible
items through ordinary placement. Granaderos instead fills missing chambers from
loose prepared cartridges, rejects full/incompatible loading attempts, and keeps
its existing black-powder loading progress. These are explicit period adaptations.
Modern magazine swapping and alternative AP/HP ammunition are not part of the period adaptation.
