# Firing and close-combat modes

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The gun in hand has two explicit modes, Disparo and Combate cercano, available beside its controls in the squad strip and inventory. This is the period replacement for a burst selector. It does not introduce automatic fire.

Firing is the default. Distance never silently changes a shot into a bayonet thrust. Close-combat mode uses the equipped gun: a compatible, serviceable fitted bayonet provides its existing thrust profile; otherwise the gun uses its existing stock-strike profile. A distant target uses the same paid approach and interruption rules as other contextual melee equipment. It never changes to firing while approaching. Existing blades and dressings keep their own contextual behavior.

Choosing the mode does not spend AP, time, energy, ammunition or random numbers. The mode is a soldier control preference, not another item record. It remains through tactical saves, campaign returns and subsequent deployments. Both save boundaries reject unsupported values. Selecting a mode requires the gun in hand and a valid actor control window. A depleted or jammed gun can still strike. A broken bayonet falls back to the shorter gun-strike reach.

Right-click or F enters deliberate aiming and permits a shot while close-combat mode remains selected. Escape returns to the selected contextual mode. Empty deliberate shots continue to use the existing reload attempt and no-ammunition indication.

## Verification

Eight new simulation/save tests cover default firing at short range, free selection, stock/bayonet approaches, ammunition preservation, explicit firing, rejection, known-state privacy and real campaign return/save/reentry. Two component tests cover the two choices, their selected state, the strike label and unavailable actors. Existing automatic-thrust fixtures were updated to select close-combat mode explicitly. The full suite passes 1,460 tests. Typecheck, build and diff checks pass; the final UI adjustment also passed its 26 focused checks.

A production Battlefield browser fixture verified a bayonet approach and strike: 100 to 76 AP, the prepared round and eight reserve cartridges retained, and bayonet condition 73 to 72. Saving/loading retained the mode and equipment. Explicit F and click then spent twelve AP and the prepared round. A separate unfitted gun approach/strike used 32 AP, retained all ammunition and dealt 22 damage in that deterministic fixture. These figures are scenario evidence, not universal damage or movement costs.

Visual inspection at an intermediate desktop width found a legacy 132-pixel pocket-container limit. It now expands to show all twelve pockets. The floating keyboard-help button is hidden while inventory is open so it does not cover pocket contents.

General two-hand equipment, dual small guns and an outfit/protection slot remain pending. These controls do not establish full inventory or JA2 parity.
