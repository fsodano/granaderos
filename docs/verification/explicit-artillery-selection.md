# Explicit artillery selection

Runtime/test source: `f18756ca8104b7c827599404d7c78d14bac9e19a`.

Preparing a battery with every slot set to **Sin pieza** now keeps that choice
through full saves and actual attack deployment. The initial automatic selection
still applies to older campaigns that never made an explicit choice. A saved
nonempty selection keeps its selected models. Purchasing another piece does not
override an explicit empty selection.

The armory initially displays the actual effective deployment, including the
older automatic choice. User edits form the pending choice; preparing it saves
the selection. The same model/quantity validation drives the controls and the
campaign order. Insufficient stock disables preparation and explains why. A
later valid selection enables the owned pieces again, without charging money,
spending stock or advancing time just to choose.

Deployment resolves selected models against their real available counts. A stale
selection cannot turn stock of another model into a gun or use one piece twice.
The request's count matches its actual manifest. Tactical creation respects an
explicit empty manifest instead of falling back to an aggregate cannon count.
Older count-only tactical requests remain supported. Invalid saved explicit-choice
markers reject during campaign loading.

## Verification

Four new simulations and one mounted production-game check pass **5/5** within
an **18/18** overlapping group covering equipment, cannon actions and workshop
controls. Complete regression passes **1021/1021**, zero failures or skips
(239,150.789 ms), on the source above. Types and production export pass with
722 files and 632 asset references. All 36 baseline comparisons pass. The
documentation audit passes with 237 requirements and 76 evidence records,
retaining all 50 original and 87 parity rows. Published in [PR #99](https://github.com/fsodano/granaderos/pull/99). Exact-head CI passed on
`49b9e899a500c54b0119c806621c0ceaa3fe60ac` on 2026-09-28 at 21:23:21 UTC
([run](https://github.com/fsodano/granaderos/actions/runs/36483713161)).
Merge commit: `4ca7494087ebd5392cb07a520f3e6cd96f24ab8d`, 21:27:06 UTC.

An actual free officer purchases a swivel for 400 pesos, selects no artillery,
saves, attacks Buenos Aires and enters with no guns while keeping its paid stock.
Another purchase retains that empty choice. Selecting actual owned models later
produces those models in an attack and complete paired save. Prepared stale-stock
and malformed-save boundaries verify rejection/conservation and compatibility.
An isolated tactical boundary confirms that an explicit empty list takes
precedence over a legacy aggregate count.

The mounted game returns from a real visit, opens the desk and treasury, and
uses the actual armory controls. It displays the purchased automatic swivel,
saves an empty choice, retains it after remounting the armory, rejects an unowned
model and a duplicate quantity, then saves a valid choice used in an actual
attack request and map entry. This is a mounted DOM check, not live-browser or
campaign-victory acceptance.

## Remaining work

This delivery fixes selection. Deployed gun identity, retained position, finite
ammunition across repeated reports and visits, capture, transport and autonomous
crews still need integration from the separate development source. The broad
artillery and equipment requirements remain partial. The dated
[stationed artillery record](../gameplay/campaign/stationed-artillery.md) is not
acceptance of those larger systems in this published engine.
