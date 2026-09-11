# AI shot selection

The enemy now compares torso, head and leg shots before it fires. Each candidate uses the same accuracy, projectile cover, body-region effects and AP costs as a player order. This implements the choices described by Patusco's guide on pages 13 and 47; the scoring below is Granaderos tuning, not a reconstruction of JA2's AI.

## Decisions

`firearmShotOptions` traces each body region once per call and reuses that result for its affordable aim increments. A new call reads current geometry. There is no persistent path cache that can survive a breach or movement.

The AI rejects stopped paths and accounts for damage lost through penetrable material. It values injury, breath loss and a possible knockdown or unhorsing. It does not value a balance effect when the nominal injury already incapacitates the target. A nearly incapacitated target remains worth shooting at; the AI can prefer a reliable torso hit over an unnecessary head penalty. Exact ties retain torso first, and equal useful aim preserves AP.

The score uses nominal weapon damage after cover and the common body-region effects. Injury value is capped at current target HP; secondary value adds 0.15 per breath point, 10 for knockdown and 20 for unhorsing. Effectiveness is hit chance times that value divided by the smaller of target HP and base weapon damage, with a minimum denominator of one. Candidate score subtracts 0.2 per AP. Immediate and fallback fire thresholds are 45 and 25 effectiveness. These values are explicit game tuning.

Only observed opponents enter shot selection. Hidden positions, private target energy, supplies and future intentions do not affect it. Decisions are pure; the ordinary tactical reducer spends the charge, AP and condition and resolves damage, sound and reactions. The selected region is also used during enemy reactions.

## Evidence and limits

Eight tests in `tests/tactical-ai-targeting.test.mjs` cover fresh path results, exposed heads, mounted and prone targets, nearly incapacitated targets, partial penetration, private information, actual enemy turns and critical reaction hits. Existing AP-retention tests use noncritical pistol fixtures so critical injury and remaining-AP behavior are tested separately.

At the shot-selection checkpoint, the legal seed-8 opening campaign passed both expanded battles: San Nicolás in 12 turns and 132 orders; San Lorenzo in nine turns and 129 orders. Four actual deaths persisted. The subsequent [AI field-equipment checkpoint](ai-field-equipment.md) supersedes those exact battle outcomes. Neither run injects victory, troop statistics or free ammunition.

The verified automated checkpoint is 912 passing logic tests, excluding only the unchanged illustrated-sprite packing suite. Typecheck and production build pass, with 607 static files and 518 asset references. See the [live verification record](ja2-live-verification.md) for the controlled browser case.

Incoming exposure still estimates torso hit chance. It does not yet compare all incoming body regions or penetration damage. Specialist tool use, inventory transfers, a full equipment choice policy and exact classic AI parity remain incomplete. A nominal damage score also does not predict the random outcome of the next shot.
