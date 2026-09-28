# Critical military condition and retained casualties

Source: `d320299472f9ac924d1c59e2217850661bc1607e`.

Living combatants below 15 health, or with zero energy, are unconscious. They
cannot act, mount, brace or maintain reaction fire; their current and maximum
action budgets are zero. Breath recovery can wake exhaustion but cannot heal
critical wounds. Finite first aid must reach 15 health to restore consciousness,
and that restoration grants no immediate action points or change of posture.
The normal next combat turn assigns the recovered actor's budget.

A force whose remaining members are dead, routed or critically wounded cannot
hold the field. Exhaustion alone does not settle a battle because those actors
can recover breath. Actual health loss selects the authored wounded speech;
incapacitation from an injury does not incorrectly select exhaustion speech.

An incapacitated enemy remains a living casualty after victory and saved reentry,
with its actual wounds and equipment. New occupation creates a distinct enemy
instead of healing or replacing that casualty. Ordinary adjacent looting transfers
only its remaining stock, including cartridge accounting on departure. Repeating
that collection cannot duplicate supplies. The actors remain targets for damage.
This is retained scene presence, not a prisoner capture or release system.

## Verification scope

Five new simulation cases cover prohibited actions and breath recovery, partial
first aid and deferred AP, defeat/victory versus exhaustion, actual damaging
orders followed by saved casualty presence and looting, legacy migration and
current-file rejection, and paid arrival of an authored critical hire. The last
route uses the ordinary Retiro scene and finite dressings without injected wounds.
The existing mounted first-aid test also checks disabled portraits and zero AP
before and after stabilization. Compact combat geometry, the initial opponent
wound and later reoccupation are declared prepared fixtures.

Older tactical records acquire the new condition version once. Migration retains
health and supplies while removing illegal action readiness. Current records must
match their actual health and energy; incompatible consciousness, AP, mount,
brace or reaction-fire state is rejected. Malformed wound values remain invalid.

## Campaign regression

The fresh Cuyo route now returns to controlled Mendoza after actual losses in
Uspallata. It pays for replacements, waits for their arrival, purchases muskets
and travels back before Los Patos. The regression does not alter difficulty,
resources or battle outcomes to accommodate the new critical-health rule.

The indispensable-engineer loss route now first wins Mendoza while protecting
both essential residents. It then uses ordinary movement and repeated fatal
orders against the engineer. The commander stays alive; active save, departure
and subsequent save preserve the separate engineer loss and campaign defeat.

The historical continuation recruits a paid replacement in controlled Buenos
Aires, travels to the actual Retiro workshop and gives actual battle casualties
36 hours of medical care. It buys 34 additional dressings for 340 pesos. It then
returns to Buenos Aires and pays 150 pesos for a second fortification level,
which withstands the later raid. The commander holds his entry position during
Ensenada and Humahuaca; he can still fire, reload and receive ordinary damage.
This changes the test's orders, not enemy behavior or combat rules.

Expired survivors are hired again at controlled Jujuy with their real remaining
condition. The force waits six hours so the twelve-hour final approach arrives
in daylight. The route wins all thirteen localities at hour **582**, second
**512**, with **5,564 pesos**, **22 permanent deaths** and a wounded commander at
**58 health**. No battle, supply loss, contract expiry or essential death is
bypassed. The ending still requires full control, living command and no blockade.
After another 48 campaign hours, paid service has expired and only the commander
remains in the current squad. The save retains all 22 deaths and the ending,
7,994 pesos and 68 commander health. A saved visit neither respawns the expired
hires nor grants a second ending.

[Recorded checkpoints](../evidence/critical-military-routes-2026-09-28.json)
retain these real costs, losses and continuations. The diagnostic recordings
resume their own campaign saves; release regression starts a new stock campaign.
The older finite-first-aid record remains evidence for its dated source, not the
costs or losses of this condition change. Release checks pass **854/854 tests**, zero failures or skips (203,301 ms),
including both fresh coastal starts, northern/Cuyo progression, the entire stock
ending, the independent post campaign and essential-character loss. The focused
post-victory settlement group passes 4/4 after correcting its prepared routed
enemy to remain conscious. Type checking, production export (722 files, 632
asset references) and 36 baseline checks pass at the runtime-identical parent
`d04cc684075da98e4afe1e54d61580d0e337799f`; the final source changes only that
prepared test health. The documentation audit retains 214 requirements, all 50
original and 87 parity rows, and 53 evidence records. Exact-head GitHub CI is
required before merge.

## Limits

The threshold and zero-energy rule are explicit current Granaderos behavior.
This delivery does not establish complete classic JA2 consciousness/breath
thresholds, wound-based AP penalties, shock, AP carryover, automatic bandaging,
held-kit targeting, physical kit custody, prisoner custody or transport of
incapacitated people. Strategic bleeding and civilian breath recovery are also
separate work. Scripted and mounted-DOM tests do not establish browser usability,
performance or balance across every seed and squad. Advanced integration remains
open in the requirement register.

[PR #76](https://github.com/fsodano/granaderos/pull/76) merged after
[GitHub CI](https://github.com/fsodano/granaderos/actions/runs/36431208186/job/108957557840)
passed at `7aefa528b519f4d058e9f92668618414d80f5b9c`.
