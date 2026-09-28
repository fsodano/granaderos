# Finite field first aid and persistent bandaged wounds

Source: `6708cc15e0d947d38c2d3569cca73ea1c7fae020`.

Manual field care now separates stabilization from ordinary health recovery.
The same work plan treats soldiers and civilians. A living patient below 15 HP
(or a smaller personal maximum) receives limited work based on the medic's
medicine, dexterity and experience. Multiple strokes may be required. Each
effective stroke spends one indivisible dressing and the existing 18/20/25 AP
cost. Exploration spends time with the same work and supplies, preserving AP.
Ordinary field bandaging stops bleeding without restoring ordinary lost health.

Care requires medical knowledge, a dressing, an adjacent living target and enough
AP in combat. It cannot target an enemy soldier, revive a body, consume supplies
on a missing target, or repeatedly heal a fully bandaged wound. It grants no
patient energy, AP, fatigue relief or posture. Partial civilian treatment retains
wound attribution and records only the health actually restored.

Bandaged military wounds now survive campaign return and reentry. A recruited
resident retains already bandaged wounds instead of receiving a fresh untreated
record. Strategic care and daily recovery reduce bandaged wounds as health returns.
Malformed saved quantities are rejected; older records remain loadable. The
ordinary field control is labelled **Vendar** and reports when treatment must
continue or recovery must take place in campaign care.

## Acceptance

Two pure planning tests and seven simulation cases cover partial skill-based
work, finite supplies, exact AP, exhausted patients, civilians, exploration,
invalid targets, repeated orders, campaign return, strategic recovery and saved
quantities. Prepared wounds and compact geometry are declared fixtures. The
mounted field screen applies one stroke by click and a second by Enter, shows
the new condition, consumes both dressings and rejects a further use. This is
mounted DOM verification, not a live-browser or performance test.

The actual injured-resident route also recruits, treats in campaign, dismisses
and revisits its patient without losing either the wound or its recovery.

[Recorded route checkpoints](../evidence/finite-first-aid-routes-2026-09-28.json)
retain real costs, elapsed time, losses and victories under these rules. The
previous source-dated route records remain historical evidence; their exact
casualties and costs are not claims about this new source.

- Both fresh coastal routes and the fresh northern route pass. No field health
  injection replaces ordinary care.
- The independent post campaign treats actual battle wounds for eight hours in
  Córdoba, buys five additional dressings for 50 pesos, buys six muskets and
  waits ten hours so the next approach reaches Salta in daylight. Its two real
  battles, local conversations and ending finish at hour 102, second 99, with
  5,506 pesos, five current squad members and two permanent deaths. Its separate
  seven-day deadline failure remains covered.
- The full stock historical route starts from Retiro, not a saved checkpoint.
  Mountain losses leave two squad members after Cuyo. Four paid replacements
  arrive in controlled Mendoza and receive purchased muskets. Later replacements
  arrive in controlled Salta and Jujuy. The force wins all thirteen localities
  with nineteen permanent deaths, at hour 450, second 517, with 2,081 pesos.
  San Martín remains alive at 88 HP. The test advances another 48 campaign hours,
  retains the win and deaths, expires paid service and revisits without spawning
  an expired hire or granting a second ending.

Every tested battle uses ordinary orders, replays with the normal campaign clock
and saves midway. No money, health, territory, personnel or victory is injected.
The independent route uses the downloadable authored package; the historical
route uses untouched default content. Their tactics and replacements changed
because ordinary wounds now persist. Enemy rules and difficulty were not weakened.

Release checks are in progress. This record will receive their final results
before publication; it is not yet an exact-head GitHub acceptance record.

## Limits

This delivery does not implement automatic bandaging, held-item medical targeting,
physical kit custody, military critical unconsciousness, continuous-service bleed
protection, strategic bleeding or authored civilian treatment responses. The
existing military condition rules remain separate work. The AP scale, discrete
work strokes and indivisible period dressings are explicit Granaderos adaptations,
not exact classic JA2 numerical parity. These accepted routes do not establish
balance for all parties/seeds or sustained browser frame rate. The combined
advanced integration and performance requirements remain open.
