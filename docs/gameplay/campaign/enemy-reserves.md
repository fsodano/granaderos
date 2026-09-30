# Finite enemy reinforcement reserves

New attack groups now draw from a saved reserve for their command. Northern forces start with 120 troops, the coastal command with 80, and interior partisans with 40. These are Granaderos campaign-scale balancing values, not historical army sizes or JA2 constants.

The existing time-based requested strength, routes, target priorities and launch schedule still apply. A group takes at most the troops remaining in its command's reserve. Fewer than three available troops cannot form a group. A refused launch does not consume troops or a group identity. Other commands keep their own reserves.

Once issued, each soldier belongs to the persistent group. Arrival, occupation, wounds, capture, victory, defeat and retirement of old history do not refund troops. Saving and loading cannot replenish the reserve. This gives repeated successful defenses a lasting effect on the enemy's ability to launch new attacks. It does not remove existing occupying forces or grant a campaign victory.

The primary reference is the saved reinforcement pool and reinforcement allocation in [JA2 Stracciatella's Strategic_AI.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Strategic_AI.cc). Granaderos uses separate commands because its off-map northern, naval and interior forces already have distinct routes and targets. This implementation does not reproduce JA2's complete garrison request/priority system.

## Save compatibility

New campaigns initialize all three reserves. A save without `enemyReserves` receives the base reserve minus the initial strength of every retained group from that command, including defeated groups, clamped to zero. Existing groups and casualties stay unchanged. This calculation happens once. Old groups already removed from a legacy save's bounded history cannot be reconstructed, so migration cannot deduct those missing records. A present but malformed reserve is rejected rather than replaced with fresh troops.

## Verification and remaining work

The reserve tests cover actual scheduled dispatch, independent commands, partial final groups, exhausted launch rejection, identity preservation, history trimming, saved continuation, legacy migration and malformed saves. Existing enemy-group and opposing-route tests cover persistent travel and encounters. The corrected full suite passes 2,699 tests with no failures or skips; type checking and production build pass. The real Humahuaca and staged final-blockade saves also round-trip with their existing enemy forces intact.

These reserves are not an income or recruitment economy. Territorial recruitment, garrison transfers, command priorities based on force needs, uncertain intelligence and full-campaign balance remain open. No hidden reserve totals are added to the player interface. The campaign ending remains unverified.
