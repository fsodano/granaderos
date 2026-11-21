# Approach an environment target with the held item

During tactical exploration and turn-based combat, selecting a visible door, container, or breachable adobe/wood wall with a held key or tool moves the acting soldier into contact range and performs the contextual interaction in one order. The [classic JA2 manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf), printed page 25 ([M25](../../requirements/ja2-parity.md#scope-and-evidence)), describes a hand-cursor selection moving a mercenary into range before manipulating a door, crate or item. Pages 26–27 ([M26–27](../../requirements/ja2-parity.md#scope-and-evidence)) describe keys, lock picks, crowbars, examination and traps. Granaderos supports that approach for ordinary door and container targeting.

## Interaction

Select a visible door or chest. The held key or tool determines the existing contextual action. An unlocked closed object opens; an open object closes. A locked object with no applicable tool uses examination. Pliers require an identified active trap. The equipment panel retains the explicit local alternatives.

`environmentUsePreview` combines the cheapest reachable contact route with the local `environmentPreview` cost. The target must be visible to the acting soldier. The planner uses the whole chest footprint, rejects unavailable tools and occupied closing space before movement, and reports unaffordable total AP without spending anything. Hidden traps produce the same unknown-target preview as an untrapped object. Hidden opposing positions do not change route choice.

The shared approach executor runs ordinary movement and checks the resulting state before use. Contact, reactions, collapse and obstruction stop the order; completed movement remains paid. A stopped order does not wear the tool, roll against the lock or trigger a trap remotely. No pending order is saved. A subsequent selection starts from the actual state.

Unlocking does not also open the door. Disarming does not unlock it. Existing finite contents, lock integrity, RNG, tool wear and damage rules remain authoritative. Direct `environment`, `door` and `containerLoot` API actions remain local. Ground equipment has its own [approach and quantity picker](loot-approach.md). Transfers and weapon theft remain local.

Map tiles show their normal target preview on keyboard focus and clear it on blur, matching pointer targeting. Enter and Space retain the existing activation behavior. No additional action button is required.

## Manual passages

An equipped, carried barreta can open a visible ground-level wall made of adobe or wood. The wall must be adjacent at the moment of use. Selecting it through the ordinary held-item command can pay for a known approach first, with the same interruption and revalidation rules as door use. The nearby environment panel also exposes the local action and its actual cost.

Turn-based work retains the existing 45-AP cost, or 25 AP with the breaching ability, and spends up to three condition points on the selected crowbar. Exploration spends the corresponding work time, without deducting AP. An older stack splits only the used tool; its other members retain their original condition. A last usable tool remains owned at zero condition. Missing or broken tools, stone, doors, windows, floors, roofs and other unsupported targets cannot open a passage. Repeating the command on an already opened wall cannot charge again. Work uses manual impact noise rather than an explosion.

The result is a traversable rubble tile with the original wall's blocking and ballistic overrides removed. Actual tool custody and the changed tile persist through official saves and sector return. This is explicit Granaderos tool and AP tuning. It does not claim that classic JA2 uses a crowbar to demolish walls; explosive entry and structural collapse are not part of this rule.

## Limits

Mounted map input and the actual environment panel button use the same action;
unavailable tools disable the button. AP and chance values remain Granaderos
tuning; broader parity is tracked in the
[JA2 parity requirements](../../requirements/ja2-parity.md).
