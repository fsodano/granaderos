# Give a held weapon to a companion

Runtime/test source: `cfa459db97c64c5cb0b1b5479fb1888ad9c64748`.

The production inventory can give the selected held primary or secondary to an
adjacent conscious squad member. Four sender AP or one exploration second moves
the actual piece into the recipient's pack. The recipient pays no AP and keeps
all existing equipment. The selected source hand becomes empty hands; giving
an inactive primary keeps its selected secondary usable. Readiness and bracing
clear. The exact authored definition, image, weight, loaded charge, unfinished
reload, wear and jam survive full saves, campaign return and later equip.

The preview and execution share eligibility checks. Missing or ambiguous sources,
unavailable companions, closed cells/corners/furniture and insufficient AP
reject before costs or custody change. Previously received entries cannot be
overwritten by another handover from the same slot. The existing 1000 stored
record limit remains a save-format bound, not complete physical pocket capacity.

## Verification

Five simulations and two mounted production-game cases pass **7/7**; the related
held/stored weapon handover and ground placement group passes **27/27**. Complete
regression passes **1176/1176**, zero failures or skips, in 268,600 ms. Types,
production export (722 files, 632 asset references), 36 reference comparisons
and documentation audit (255 requirements, 94 evidence records) pass.

The paid campaign fixture buys two actual hires, enters combat and uses declared
compact opening positions. It selects and gives the issued loaded gun, verifies
sender/recipient AP and total weight, saves, retreats, returns and equips the
same received gun while storing the recipient's displaced piece. An authored
secondary uses declared independent wear. A separate prepared primary retains
partial loading, jam and wear while the donor's blade remains selected. The
initial fixture also marked that inactive gun as ready to fire, which the real
save validator correctly rejected; it now keeps the valid unready state.

Legacy exploration checks one-second cost, actual mass and an existing recipient
key. Invalid source, recipient, geometry and AP checks confirm read-only preview
and unchanged custody on rejection. The mounted Home flow uses the hand and
recipient controls, checks the saved empty source, selects the recipient, reads
the received image and equips the piece. A second mounted case exposes blocked
adjacency and verifies that the registered order cannot bypass it.

Supplies, remote relay, throwing/catching, complete pocket capacity and broad
campaign acceptance remain open. These are simulations and mounted DOM checks,
not live-browser or performance acceptance. Exact-head CI remains required
before publication.
