# Explicit loss of an indispensable historical actor

A fresh continuation won the tactical battle for Mendoza but killed Beltrán.
The old campaign remained open even though its required foundry could no longer
be prepared. This delivery turns that confirmed loss into an explicit, saved
campaign defeat and shows the responsible character and unfinished project on
the strategic screen.

Source: `b3dfa12cf81948db95eaabf35e98ad91a2da3a04`.
[Recorded route result](../evidence/historical-mendoza-loss-2026-09-28.json).

## Rules and verification

- The original progression requires its assigned foundry engineer until the
  foundry is prepared. This follows the editor's assigned identity and project
  name. A completed foundry persists after its organizer dies.
- San Martín remains indispensable to the original campaign until victory,
  including when he has joined military service. Confirmed military deaths are
  acknowledged at the tactical checkpoint, before result settlement.
- Authored chapter progressions retain their own failure conditions. The original
  roles do not impose extra terminal rules on those campaigns. Completed campaigns
  keep their established post-victory continuation.
- Terminal campaigns can settle the open scene and retain the actual victory,
  losses and saved terrain. They cannot begin further strategic work. Older saves
  with a confirmed indispensable death and a missing defeat flag receive the
  terminal state once, without healing, charging money or repeating the log entry.

`tests/historical-loss.test.mjs` reproduces the actual stock seed-8 mixed route
from Retiro through the accepted coast and north. It then pays for six locality
fortifications, one replacement, workshop service and five Charleville muskets.
Actual Mendoza combat ends in tactical victory with Beltrán dead. Every order is
replayed with the campaign clock; saves include the first death checkpoint and
midpoint. The original regression failed before the runtime change.

Separate compact engagements use explicitly prepared territory, role assignment
and a late commander service/injury fixture. Actual enemy shots verify immediate
military death, active-save rejection of a revived actor, result settlement,
completed-foundry continuation and custom-chapter continuation. The renderer check
uses the actual assigned-engineer casualty and displays its specific loss reason.
These compact cases are subsystem evidence, not fresh campaign routes.

Release checks: **798/798 tests**, zero failures or skips (197,543 ms); type
check; production export (721 files, 631 asset references); 36 baseline checks;
documentation audit (201 requirements, all 50 original and 87 parity rows,
40 evidence records). The five new focused tests pass.
[PR #63](https://github.com/fsodano/granaderos/pull/63) merged after
[exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36397601446/job/108847600598)
passed on `a19cc38254a1ce90164de1aef38190185cff1015`.

## Limits

This is a verified loss route. It does not accept a successful Mendoza/Cuyo route,
funding the complete army, the historical ending, a second authored campaign or
live-browser/performance behavior. The route controller uses ordinary orders and
one strategy; it does not establish that every preparation or battle is winnable.
No actor is revived, made invulnerable or replaced. Explicit successor transfer of
roles remains separate work. The larger advanced medical/recapture/rescue failures
keep their original records.
