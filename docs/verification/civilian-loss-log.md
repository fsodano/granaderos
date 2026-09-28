# Saved essential-character loss with a full diary

Source: `f203f74dc49b8f0f9ea6f212e91e7b31450240a8`.

An essential civilian's death appended a notice without enforcing the campaign
journal's 80-entry limit. If the journal was full, ordinary tactical synchronization
created 81 entries and the next saved continuation failed validation. The failure
was exposed while replaying the changed Mendoza route for finite first aid.

Death notices now enter at the front, like ordinary campaign notices, and retain
only the most recent 80 entries. The confirmed death, campaign defeat, wound
history and current tactical scene remain intact. Reacknowledging that same death
cannot duplicate the entry. Save validation keeps its existing bounds.

## Acceptance

The new regression fails before the fix: **81 entries instead of 80**. It prepares
the northern chapter and a full diary, but uses actual paid recruitment, travel,
approach, repeated fatal melee actions, campaign clock synchronization and scene
exit. It verifies the new notice, removal of the oldest entry, active save/load,
repeated acknowledgement, final departure and saved permanent defeat.

The focused civilian/loss group passes **18/18** checks, including the existing
fresh Mendoza loss and serving-role death routes. The regression's prepared
chapter and journal isolate the save boundary; they are not a fresh campaign win
or a UI/performance measurement.

Release checks: **834/834 tests**, zero failures or skips (200,996 ms); type
check; production export (722 files, 632 asset references); 36 baseline checks;
documentation audit (211 requirements, all 50 original and 87 parity rows,
50 evidence records). Exact-head GitHub CI is required before merge.

## Limits

This corrects the runtime diary transaction. It does not expand the journal,
revive an essential character, change campaign failure conditions or relax file
validation. Previously invalid oversized files are not silently accepted. The
broader advanced integration remains open.

[PR #73](https://github.com/fsodano/granaderos/pull/73) merged after
[GitHub CI](https://github.com/fsodano/granaderos/actions/runs/36424710104/job/108935711518)
passed at `e4ce17444d2a581c8492c88856698c2d3190bfc0`.
