# Finite roadside discovery

New stock campaigns have one optional chest beside the road in cell `24,27`. It holds one used crowbar at 60% condition and one linen shirt at 75% condition. These contents and conditions are fictional game tuning. They are not an inventory from a historical event.

Travel gives no equipment reward. A soldier must enter the cell, find and approach the actual chest, open it, and select what to take. Closed contents remain hidden. Opening and pickup use the existing action costs and carrying limits. A failed pickup spends nothing and changes neither the chest nor the soldier.

Each object has one stable identity. Pickup removes that object from the chest. Leaving, saving, returning later or visiting with another squad cannot replenish it. A delayed selection also keeps its original source: if the stack changes or its index now points to another item, the player must select again.

The crowbar can be kept or equipped for existing tool actions. The shirt can be worn or kept in a pocket. Preparing field dressings consumes the packed shirt through the existing paid recipe; it does not heal anyone or leave a second shirt. See [field dressings](../equipment/field-dressings.md).

## Pinned content and old campaigns

The optional content field `roadsideDiscoveries` admits an empty list or this one versioned record:

```json
{
  "version": 1,
  "id": "roadside-clothing-tools",
  "cell": "cell-24-27",
  "x": 10,
  "y": 7,
  "crowbarCondition": 60,
  "linenShirtCondition": 75
}
```

Coordinates use the compact tactical plan. The expanded map places the same chest at `(32,23)`. Each condition admits an integer from 1 to 100. Other locations, objects, quantities, traps and versions are outside this bounded definition.

Fresh default packages pin the record in their saved content identity. Fresh campaigns without a package keep a detached `roadsideDiscoveryDefinitions` snapshot. Old packages and plain saves that omit the optional field remain disabled; restore does not add it. An explicit package takes priority over a plain-state snapshot. Existing visited cell props restore exactly, without a new chest or replacement contents.

Deployment requests receive the effective definitions before their map and finite-stock baseline are built. Active scenes, retained scenes and pending requests must match the campaign's pinned definitions on official save admission and return.

## Acceptance scope

`tests/roadside-discovery-content.test.mjs` covers strict import, content identity, context substitution, old-save neutrality and both map sizes. `tests/roadside-discovery-integration.test.mjs` covers ordinary paid travel, pickup, practical use and persistent custody. Existing container transaction and mounted inventory tests cover hidden contents, carrying refusal and stale selections.

This is one optional discovery. Wider travel encounters, local opportunities and the complete campaign remain open under V12 and V13 in the [video requirement map](../../verification/ja2-video-review-2026-10-03.md). Door-mounted explosives are not part of this content. Future tactical equipment must fit 1810–1820 and have reliable period support. Cannon, map artwork and 3D presentation remain with the separate asset work.
