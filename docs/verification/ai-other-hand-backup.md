# AI: loaded other-hand backup

T07 now includes a ready firearm owned in the soldier's other-hand record. An empty or jammed main gun can use the existing paid `swapHands` order, then a separate shot. The AI checks the same swap preview, item plan, pocket capacity, observed target and affordable useful shot as the existing equipment paths. It does not create a weapon or grant ammunition.

The swap costs 4 internal AP in combat. It lowers the incoming gun before the shot, so the shot pays its actual preparation and firing cost. The old gun retains its identity, load, condition, fittings, partial reload work and item metadata. Typed reserves and finite supplies remain owned. A ready main gun and an immediate legal blade attack retain their priority. Empty, jammed or broken backups, blocked shots, insufficient AP and capacity-breaking swaps are rejected. The existing scoring still compares prepared pack weapons.

The deterministic regression has an empty owned 1805, one loaded owned 1806, no reserve ammunition and 14 AP. Before this correction the enemy takes no action: AP stays 14, the backup stays loaded and the target remains at 100 HP. After the correction it swaps once and fires once: AP becomes 2, the backup becomes the empty primary, the original empty gun remains in the other hand, and the target has 36 HP. The six-second enemy turn is unchanged. Save restoration and a nested player interruption do not repeat the swap or shot.

The focused gate passes 126 checks. It covers real enemy turns, shared previews and plans, full pockets, single and paired firearm maintenance, hidden target and supply invariance, friendly obstruction, authored weapon metadata, owned bayonets, readiness, typed ammunition and saved reaction resumption.

```sh
node --test tests/tactical-ai-other-hand-backup.test.mjs tests/tactical-ai-equipment.test.mjs tests/paired-pistols-ai.test.mjs tests/paired-pistol-fire.test.mjs tests/paired-reload.test.mjs tests/paired-reload-ai.test.mjs tests/paired-reprime.test.mjs tests/two-hands.test.mjs tests/weapon-readiness.test.mjs tests/weapon-fittings.test.mjs tests/fitting-item-metadata.test.mjs tests/content-weapons.test.mjs
```

The cause was in [`backupWeapon`](../../game/tactical-ai.js): its candidate list included the holstered primary gun and prepared pack weapons, but omitted the owned other-hand gun. The correction uses [`planSwapHands` and `swapHandsPreview`](../../game/tactical.js). [`The dedicated regression`](../../tests/tactical-ai-other-hand-backup.test.mjs) checks the exact paid result. [`Paired AI tests`](../../tests/paired-pistols-ai.test.mjs) retain maintenance when the second gun is unavailable and select the paid backup when it is useful. Wider coordinated AI decisions remain open in the [parity audit](ja2-parity-audit.md); this increment does not complete T07.
