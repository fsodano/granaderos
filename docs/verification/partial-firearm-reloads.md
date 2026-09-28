# Partial firearm loading and retained weapon work

Runtime/test source: `65a71ca1f3599a2b8b7e3723267a0a03f1078721`.

A firearm no longer requires its entire reload cost in one turn. The order spends
available AP and retains unfinished work as a fraction of one charge on that gun.
Only completed charges enter the weapon and leave its finite cartridge reserve.
A multi-barrel weapon can complete one barrel while retaining work on the next.
Standing/prone costs and loading support affect the remaining work. Both factions
use the same order. Existing authored reload costs up to 500 AP now have an
executable multi-turn path.

The advance belongs to the physical weapon. Switching active primary/secondary
slots, stowing, re-equipping, dropping and recovering a weapon preserve that
weapon's work rather than applying it to another gun. A looted or dropped carrier
clears its relinquished progress. Saved active actors, inventory records, dropped
weapons, retained casualties and named allies use the shared carrier validation.
An absent progress field remains valid for older saves; negative, full, invalid,
non-firearm or relinquished progress is rejected.

In exploration, completion costs actual time without spending combat AP. The
order advances through the ordinary six-second simulation phases and stops when
contact, incapacity or scene ending interrupts it. Only elapsed work is retained;
no unfinished charge becomes loaded. The ordinary reload button and keyboard
command share this execution. Controls show the current AP/time charge and the
work that will remain after that order.

The campaign's existing issue/return ammunition policy still unloads and returns
ordinary carried primary ammunition when settling deployment; this feature does
not replace it with a new strategic cartridge inventory. Stored recovered guns
keep their own physical records. Artillery, automatic loading of a second hand,
weapon readiness, typed cartridges and full physical pockets remain separate.

## Verification

Six new simulations cover a 250-AP authored weapon over actual turns, finite
multi-barrel loading, posture changes, actual swaps and corpse collection,
strict saved progress admission, unavailable orders, a paid campaign soldier's
active save and resumed loading, exploration time and interruption by actual
contact or bleeding collapse. Compact barrier geometry isolates save/loading
boundaries in the campaign case; it does not represent a full campaign route.
The real firing sequence keeps an initial ignition failure and uses normal
repriming before discharge.

One mounted battlefield test checks the pointer control, actual displayed cost,
disabled exhausted/full states, retained tactical snapshot and the ordinary
keyboard reload across turns. Three existing tests were updated to require
partial work with insufficient AP instead of the earlier all-or-nothing error;
loading support still distinguishes full completion from unfinished work.

The combined focused group passes 61 tests; the new seven-case group overlaps it.
The first diagnostic exploration fixture contained a visible enemy and exposed
that an atomic long load could finish before contact stopped its clock. The
corrected runtime retains only the actual six seconds of work. The campaign
fixture now retains its expected residents and real failed ignition. Full release
regression at this source passed 878/893 tests, with 15 failures and zero skips
(198,687.378 ms). Failures concern changed route tactics, fixed route outcomes
and casualty/care fixtures; this source is not accepted for publication. Types,
production export (722 files, 632 references) and all 36 baseline checks pass.
A subsequent controller adjustment prioritizes cover over unfinished loading,
then spends spare AP on partial work. The focused route group passes 9/11: the
local-only route still loses its commander, and the independent post fixture
requires medical work even when its current survivors are healthy. Further route
verification and exact-head GitHub CI remain pending.

## Limits

This record does not establish loaded-browser performance or full JA2 equipment
parity. The preserved advanced route failures remain identified separately.
