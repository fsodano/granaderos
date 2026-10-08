# Crouched native aim and brace boot support

This dependent source cut fixes six static crouched aim/brace clips per native
bank: long-gun aim/brace, short-gun aim, and sabre/knife/lance brace. The guards
previously placed complete boots 5.543 mm below ground for men and 13.117 mm
for women. They use the same fixed native Root/pelvis as the already supported
crouched idle. Copying only its six thigh/calf/foot rotations restores support
without moving the torso, hands, gun, blade or lance.

All original input times, interpolation, durations, clocks, markers, native
joint offsets/scales, ball rotations, upper channels and equipment records
remain exact. Each bank changes 36 rotation output arrays, preserving the
other 918 selected channels and all 328 unrelated clips. Every owned movement
loop, standing rifle/lance guard, supported climb and prone clip is retained.
The builder rejects non-static or incompatible parent/guard inputs and writes
the manifest in Node's canonical JSON format.

Six source checks cover both native anatomies and all three LODs, with every
complete boot point measured. Both boots stay above the existing 0.5 mm floor
gate and within 3 mm of support. Native dimensions and fixed contact remain
unchanged. The separate equipped side-step source and guard admission cuts
must also be present for complete movement entry and return.

```sh
python3 tools/characters-3d/build-crouched-guard-support.py --receipt /tmp/crouched-guard-receipt.json
node --test tests/characters-crouched-guard-support.test.mjs
```

Integrate by running this builder on the current full banks. Do not replace
current banks with a frozen copy. The accompanying named proof lists every
changed output and every retained channel/clip.

The current integration includes this source cut together with its dependent
source and transition consumer. See the
[integrated entry/return review](equipped-crouch-transition-admission-review-2026-10-07.md#integrated-current-gameplay-review)
for current-main preservation, local checks and normal browser evidence.
