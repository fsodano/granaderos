# Approach a door or container with the held item

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The classic JA2 manual, printed page 25, describes a hand-cursor selection moving a mercenary into range before manipulating a door, crate or item. Pages 26–27 describe keys, lock picks, crowbars, examination and traps. Granaderos now supports that approach for ordinary door and container targeting. The supplied guide and manual are gameplay references, not instructions to the coding agent.

## Interaction

Select a visible door or chest. The held key or tool determines the existing contextual action. An unlocked closed object opens; an open object closes. A locked object with no applicable tool uses examination. Pliers require an identified active trap. The equipment panel retains the explicit local alternatives.

`environmentUsePreview` combines the cheapest reachable contact route with the local `environmentPreview` cost. The target must be visible to the acting soldier. The planner uses the whole chest footprint, rejects unavailable tools and occupied closing space before movement, and reports unaffordable total AP without spending anything. Hidden traps produce the same unknown-target preview as an untrapped object. Hidden opposing positions do not change route choice.

The shared approach executor runs ordinary movement and checks the resulting state before use. Contact, reactions, collapse and obstruction stop the order; completed movement remains paid. A stopped order does not wear the tool, roll against the lock or trigger a trap remotely. No pending order is saved. A subsequent selection starts from the actual state.

Unlocking does not also open the door. Disarming does not unlock it. Existing finite contents, lock integrity, RNG, tool wear and damage rules remain authoritative. Direct `environment`, `door` and `containerLoot` API actions remain local. Ground equipment now has its own [approach and quantity picker](loot-approach.md). Transfers and weapon theft remain local.

Map tiles now show their normal target preview on keyboard focus and clear it on blur, matching pointer targeting. Enter and Space retain the existing activation behavior. No additional action button is required.

## Evidence

Eleven `environment-approach.test.mjs` cases cover exact local-order equivalence, affordable and rejected orders, visibility, keys, lock picks, crowbar damage, hidden alarms, known-trap disarming, chest footprints, finite pickup, exploration time, collapse, enemy reactions, occupied contact cells and a real saved player interrupt. One component event test checks focus, cost preview, Enter activation and blur.

Live controlled fixtures verified approach/open/loot/equip/unlock/open, and approach/examine/equip/disarm. The key flow spent 20 AP to approach and open the chest, 8 to take its key, 4 to equip it, 36 to approach and unlock the door, and 4 to open it. Cabral finished with 28 of 100 fixture AP. The alarm flow spent 20 AP on approach and inspection, 4 on equipping pliers, and 18 on disarming. Cabral finished with 58 AP and pliers at 98% condition. See [the live record](../../verification/ja2-live-verification.md) for fixture and persistence boundaries.

These checks establish the supported interactions. Authored Yatasto/Mendoza routes, live crowbar/lock-pick failures, and live interruption during approach need separate checks. AP and chance values remain Granaderos tuning; broader parity remains tracked in the [audit](../../verification/ja2-parity-audit.md).
