# Authored initial character condition

Source: `605e39c2c53f382f3b74dddcbdcb758e7871a794`.
[Editor guide](../development/story-editor.md#estado-inicial-de-cada-personaje).

Each character can define health, energy, fatigue, bleeding and bandaged wounds
in an optional complete `startingCondition`. Health is an integer from 1 to the
authored maximum; energy and fatigue are 0–100; bleeding is 0–10; bandaged wounds
cannot exceed missing health. Bleeding requires an unbandaged wound. Unknown,
missing, nonfinite, fractional and inconsistent values reject import or launch.
Reducing maximum health does not silently rewrite the authored condition.

The campaign assigns it once, before world presence begins. Mutable health and
supplies then belong to the saved identity. Arrival, renewal, dismissal, rehire
and reload do not reapply the starting state. Optional omission preserves older
content identities and original full-health defaults. Bulletin candidates remain
off the map until actual arrival at an allowed controlled reception site.

## Acceptance

Four simulation cases cover strict validation and accepted limits, legacy
identity, import and save, paid arrival, actual rest, renewal and rehire; an
authored one-health resident and real bleeding death. The critical resident is
encountered through ordinary paid recruitment and travel, cannot converse before
stabilization, consumes both carried dressings, joins locally at 15 health, then
receives two hours of strategic care using two purchased dressings. It returns
as a civilian at 27 health with 68 bandaged wounds and can join again without a
reset. There are no prepared campaign wounds in these routes: wounds come from
the imported authoring document. Original damage attribution is unknown, and an
untreated authored bleed cannot invent player responsibility.

The mounted editor changes all five controls, undoes/redoes, duplicates, rejects
an invalid bandaged amount, restores full health, undoes the reset and launches.
The new candidate is actually paid and arrives at Retiro with its authored wounds.
A later draft change leaves that saved campaign and the ordinary save untouched.

The focused character/editor group passes **59/59** checks. Release checks pass
**849/849 tests**, zero failures or skips (202,025 ms); type checking; production
export (722 files, 632 asset references); 36 baseline checks; and the documentation
audit (213 requirements, all 50 original and 87 parity rows, 52 evidence records).
Exact-head GitHub CI is required before merge.

## Limits

This defines living starting actors, not initially dead or captured characters.
NPC bleeding advances only in loaded tactical scenes. Unloaded bleeding and
strategic civilian care remain separate integrations. A zero-energy resident
cannot converse and currently has no civilian breath-recovery action; authors
must give a resident positive energy if it must later converse. The editor calls
out that constraint. Critical military incapacitation, automatic first aid,
physical kit custody and complete advanced gameplay acceptance remain open.
Simulation and mounted-DOM checks do not establish live-browser usability or FPS.
