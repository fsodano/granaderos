# Prone rifle reload sleeve support

The published male reload clips let the complete weighted left sleeve cross the floor. The early defect depends on the owned rifle length: 1803 reaches −4.151 mm and 1807 reaches −9.188 mm. A later dip affects the generic clip and all six item clips; the LOD1 minimum is −1.665 mm. The female clips already clear the floor.

This source cut selects exactly seven male clips: `prone.reload.long-gun` and its `1800`, `1801`, `1802`, `1803`, `1804`, and `1807` variants. It changes only `upperarm_l`, `lowerarm_l`, and `hand_l` rotation outputs and their input sampling. The published native arm defines the shoulder, wrist and bend plane. Two quintic elbow-plane transfers keep the original wrist position and hand orientation at each bake key. The first transfer fits the actual rifle length; the second fits the common supporting sleeve seam.

The three selected rotations use a 120 Hz grid plus every original rotation key time (721 stored times per clip). Their interpolation remains LINEAR. The original actual GLTF period, 4.800000190734863 s, remains exact. The nominal 4.8 s metadata, paid AP interval, partial loading progress, markers, grip offsets and rod timings remain exact. Densification changes interpolation slightly between keys: the dense maximum wrist change is 0.062 mm, and the hand angle change is 0.000386 rad. The actual held rifle matrix remains exact because its right-hand tracks remain exact. Existing native muzzle-palm and ramrod contact tests pass.

The source builder compares every named channel before it writes. All 1,092 other channels in the selected clips and all 327 other male clips retain exact input/output float bytes and interpolation. The entire female bank stays byte-identical. The native rig, meshes, skins, materials, bone offsets and scales stay exact. The manifest changes only seven support records and the male bank bytes/hash fields; the locomotion profile stays byte-identical. The PR #260 close-garment compatibility set and its support hashes stay exact because all Root, pelvis and lower-limb tracks remain exact.

On main `163b0476b6de27efef9fd390428ebf8dafeae53f`, the 42 native cases (seven clips, both anatomies and three LODs) have a complete weighted arm minimum of 2.457 mm. The 36 actual paid reload routes (six owned rifles, both anatomies and three LODs) have a minimum of 2.243 mm across idle entry, work and return. Existing complete-boot limits remain unchanged: no floor crossing, contact below 3 mm and no support motion. The all-LOD minimum boot surface is 0.963 mm, inherited exactly from the released native leg basis. The source cut adds no runtime fit, per-frame cost or gameplay state change.

The maximum elbow-plane change is 0.40 rad; the largest measured elbow displacement is 92.182 mm for the short 1807 rifle. Dense corrected elbow peak speed remains equal to the corresponding native source peak (3.996–6.024 m/s). These inherited fast work intervals and the raised working forearm are not a claim that the full loading body mechanics are final. Adjacent-patient healing, prone interaction reach, dynamic throws and complete visual review remain separate work.

Run the current-bank builder, not a copied old bank:

```sh
node tools/characters-3d/build-prone-rifle-arm-support.mjs --receipt /tmp/rifle-arm-receipt.json
node --test tests/characters-prone-rifle-arm-support.test.mjs tests/three-prone-rifle-arm-paid-blend.test.mjs tests/characters-rifle-loading.test.mjs tests/characters-prone-rifle-support.test.mjs
python3 tools/characters-3d/verify-library.py
node tools/characters-3d/compile-locomotion-profile.mjs --check
npm run typecheck
```

The general library builder runs this postpass after the prior prone leg/free-arm corrections and before long-cloth fitting. Repeat execution verifies the stored selected-track digests and leaves both banks and the manifest unchanged. A changed or unknown source recipe rejects the write.

## Current-main integration and ordinary reload review

Source commit `f4383acb` composes the current bank on main `db32676f`.
The exact preservation receipt confirms 21 changed channels, 1,092 retained
selected channels, 327 retained other male clips, unchanged female bank,
runtime and locomotion profile, and only seven support records plus the male
bank bytes/hash in the manifest. Repeated fitting changes no asset. The male
bank grows by 214,840 bytes. All close-garment support sets remain valid.

All 27 current rifle, garment, pistol, clock and fixture checks pass in 26.89
seconds, including all 36 paid rifle routes. Native verification, locomotion
calibration, TypeScript, documentation and 38 baseline checks pass. Production
export `c02e3814860c` verifies 1,245 files and 1,040 references.

The public prone-work selector now offers all six owned rifle reloads. Each
starts with an empty stable weapon instance and eight finite cartridges. The
Baker pays its actual full first-turn budget, retains 20/21 reload progress
without consuming a cartridge, then completes on the next turn for five
internal AP and one cartridge. The fixture test covers the saved partial and
completed states. The original incorrect one-order completion assumption is
retained as a failed local result; gameplay costs are unchanged.

Eight before and eight current normal HUD routes cover the six male rifle
choices and two unchanged female control choices. Each run has 65 captures,
including the Baker's next-turn completion. All paid/owned inventories, cells
and prone postures match. Ten source/model hashes remain exact through each
run; served banks, manifest and selected detailed bodies match. Browser errors
are empty. The source commits are `7946deda` before and `f4383acb` current.

The 240 ms early-pull views were visibly compared. At ordinary camera scale
this is a small sleeve correction; complete weighted geometry checks establish
its floor clearance. Some 940 ms captures straddle the prepare/result boundary
and are retained as timing-limited evidence. Final publication changes only
this review and the verification record after the captured source.

Local evidence is in `artifacts/three-prone-rifle-sleeve-current-review/`:
current original banks/source pins, immutable cut pins, preservation and repeat
receipts, focused checks/export and both normal HUD runs. This remains bounded
sleeve support, with the broader motion limits above still open.
