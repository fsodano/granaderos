# Equipped crouched side-step support

This source cut supports the ten left/right loops for long gun, short gun,
sabre, knife and lance, in both native anatomies. The owned items retain their
original hands, sockets and upper-body channels. Free hands, medical supplies,
tools and inventory objects already select the supported unarmed movement.

The five equipped categories have byte-identical native Root/pelvis and lower
limb source paths per anatomy/direction. Their periods and native speeds also
match the released supported unarmed loops. The builder uses those current
native support outputs. It replaces only eight named thigh/calf/foot/ball
rotation channels per selected clip. All 151 other channels per clip and all
324 other clips per bank remain exact. Native geometry, skin weights, joint
offsets, scale and hierarchy stay exact. PR234 rifle guards, PR237 lance guards,
prone, climb and all standing loops are outside this cut.

The original stored GLTF periods remain 1.600000023841858 seconds (left) and
1.3666666746139526 seconds (right). The older nominal manifest duration fields
remain 1.61666 and 1.399994. Only the eight lower-limb key arrays become the
already released 60 Hz support path. A prototype retaining their old 30 Hz
input keys cleared the floor but failed the existing planted skin peak-speed
gate; it was rejected. All non-leg input arrays remain exact. No gameplay AP,
saved route, position, stride speed, playback rate or locomotion profile field
changes.

Local validation on main 5f8c77edf0e3492d609967eb361e1bc59dce2943:

- 60 source checks cover both directions, five owned categories, both anatomies
  and all three native LODs. Every complete boot point stays above 0.5 mm; at
  least one boot supports the body within 3.5 mm. Recovery rises 35–105 mm.
- The actual distance-driven lateral clock remains 0.8 of each retained native
  stride speed. Planted skin RMS stays below 12 mm/s, with peaks below 90 mm/s.
- 60 normal idle → two-cell side-step → idle runtime paths retain complete boot
  clearance, strict native reach, upper rotations, held equipment and wrapper
  placement. Raw old equipped routes reached 43.117 mm below the floor.
- Named bank/manifest proof lists each changed channel, every retained channel
  and all unrelated clip names. A repeated builder run is asset-idempotent.

This loop cut does not certify aim/brace entry or return. Current crouched
native aim/brace guards have a separate resting boot defect (5.543 mm male,
13.117 mm female), and the current transition consumer only admits idle.
The measured dependent guard source and admission fixes must be reviewed as
separate cuts before claiming complete equipped guard transitions.

Rebuild the current complete banks with:

```sh
python3 tools/characters-3d/build-equipped-crouch-support.py --receipt /tmp/equipped-crouch-receipt.json
node --test tests/characters-equipped-crouched-sideways-support.test.mjs
```

The builder rejects changed native parents, periods, pace or unaudited lower
source outputs. It reads and retains the current banks; copying a stale whole
bank is not the integration procedure.

The current integration includes this source cut together with its dependent
source and transition consumer. See the
[integrated entry/return review](equipped-crouch-transition-admission-review-2026-10-07.md#integrated-current-gameplay-review)
for current-main preservation, local checks and normal browser evidence.
