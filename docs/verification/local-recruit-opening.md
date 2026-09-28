# Fresh opening with a created officer and local recruits

Source: `6866d1d78bab58d9abc873eadcb028ad32e0f014`.

A fresh default story-package campaign, seed 8, completes Buenos Aires,
San Nicolás and San Lorenzo without a bulletin hire. It starts with Retiro alone,
3,200 pesos and no personnel. The player creates a free legal 550-point soldier,
meets Cabral in person and buys him a 230-peso Charleville. No territory, health,
supply, recruit or outcome is assigned directly by the fixture.

The initial force wins Buenos Aires. Its actual surviving interlocutor recruits
Dorrego and Paroissien through their adjacent local conversations. The force
returns to Retiro, pays 920 pesos for four muskets and 27 for available workshop
service, then uses doctor/patient assignments chosen from current survivors.
Nineteen treatment hours consume finite dressings; eighteen additional dressings
cost 180 pesos. Six hours of explicit rest and the return journey follow. At hour
67 second 69, all four are fully healed, treasury is 2,648 pesos, and no bulletin
contract or pending arrival exists.

| Engagement | Actions | Turns | Permanent military losses |
| --- | ---: | ---: | --- |
| Buenos Aires | 33 | 5 | None |
| San Nicolás | 32 | 3 | Created officer and Paroissien |
| San Lorenzo | 23 | 2 | Earlier losses remain |

Cabral and Dorrego finish with 96 and 41 health. The temporary commander retains
88 health. Saved mission settlement reaches phase 2 at hour 79 second 101 with
3,399 pesos. The campaign is still in progress. One further hour, a normal sector
visit and saved departure preserve the two losses, Dorrego's wounds, both current
squad members and funds, with no second conquest reward.

[Machine-readable checkpoint](../evidence/local-recruit-opening-2026-09-28.json).

## Method and verification

The existing cautious combat controller uses ordinary orders, visible targets,
remembered positions, cover, prone fire, reload and finite bandaging. It avoids
shots through visible residents. Each engagement is replayed through the actual
campaign clock, with a save/load halfway through; final units, random state and
elapsed time must agree. Battle reports cannot be applied twice, and dead people
cannot be rehired. Every strategic treatment hour is also saved and spends one
real dressing. Weapons, care and rest retain existing rules and prices.

Earlier diagnostic strategies lost San Nicolás or stalled. One departed at night
with an untreated surviving officer. Recovery of all current wounded soldiers,
ordinary rest and the resulting daylight approach form the accepted strategy.
No failed outcome was replaced by a victory or reused as the next checkpoint.

The initial three-route group passes for mixed, bulletin-only and local-only
forces. The extended local route also passes its saved post-opening visit.
These checks overlap. At the source above, the complete suite passes
**872/872** tests, zero failures or skips, in 207,189 ms. Browser types, production
export (722 files, 632 asset references), 36 baseline comparisons and the
documentation audit pass (218 requirements, all 50 original and 87 parity rows,
57 evidence records). GitHub publication and exact-head CI are recorded separately.

## Limits

This closes the missing local-recruit opening strategy for this seed and legal
profile. It is not a claim that one character can win alone, that all profiles or
seeds are balanced, or that this force has completed the northern and western
campaign. Other separately accepted historical routes retain their own forces
and paid support. The larger advanced medical, recapture and prisoner-rescue
failures remain recorded against their identified sources. No browser or loaded
combat performance acceptance is claimed.
