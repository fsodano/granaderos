# Preparing failed pistol pans — 27 September 2026

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The existing R key and weapon order control can now service a failed second
pistol without a hand swap. Only pistols physically held in both hands join the
order. A pocketed, broken or non-pistol second weapon is excluded.

The main pan is prepared first. Each failed pan costs the existing 15 AP, or
10 AP for a gunsmith, and one dose of priming powder. If only one pan is
affordable, that gun is completed and the second stays failed. Another order
must pay for the remaining pan. Insufficient AP or powder for even one pan
rejects the order without changing either gun.

Loaded charges, compatible cartridge reserves, flints, condition, fittings and
gun identity remain intact. Exploration uses the same work cost to advance
tactical time, with no combat AP charge. Ordinary action reaction and campaign
time handling still applies.

The weapon control shows **Cebar**, **Cebar segunda mano**, or **Cebar ambas
pistolas**, with the actual affordable AP cost. R first loads an empty usable
main gun when possible. A failed spare with no priming supply does not prevent
that loading. Preparing a pan never fires a shot. The existing empty-fire click
contract is unchanged.

AI maintenance can prepare a failed spare outside visible contact. With a ready
main gun and a visible target, it retains its existing firing decision. Both
failed guns use the same player cost and supply plan.

Validation includes exact AP/powder boundaries, finite supplies, retained gun
metadata, exploration time, specialist costs, invalid held items, save/replay,
real enemy turns, order-panel actions, and mounted Battlefield R input with
the ordinary text-input guard. See `tests/paired-reprime.test.mjs` and
`tests/paired-reprime-ui.test.mjs`.
