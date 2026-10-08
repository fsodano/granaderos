# Prone interaction native boot support — 7 October 2026

This cut repairs the complete footwear floor for twelve static prone interaction clips. It retains their body, hands, item sockets, markers and ordinary paid clocks. It does not certify the inherited upper poses.

## Scope and source

Both native anatomy banks change only the rotation outputs of thigh, calf and foot on each side for heal, pickup, equip, offer, grab, door, tool, breach, free, ration, signal and fitting. The source is the already supported `prone.idle.long-gun` lower pose. Its static Root/pelvis channels match each target exactly. The unarmed idle has equivalent support but one male quaternion bake range is 1.013279e-6; it fails the retained 1e-6 source guard. The builder uses the certified rifle reference instead of relaxing that guard.

The current-bank builder refuses changed parents, nonstatic poses, unknown prior lower rotations or concurrent bank/manifest changes. It runs after the prior prone rifle and remaining firearm support postpasses in the complete library build. It emits the canonical Node JSON format. It does not write the locomotion profile.

## Measured evidence

At base main `043603b54a8730e6afb6307e39de83d4d7a8dc59` plus the pending nineteen firearm-work source cut, each anatomy changes 72 named rotation outputs. The 1,836 other selected channels and 322 unrelated clips per bank retain exact decoded values, clocks and interpolation. Actual GLTF periods, manifest nominal periods/markers, native rig/mesh/skin dimensions and every unrelated manifest record remain exact. Manifest changes are 24 selected support records plus four bank bytes/hash fields. A repeated build keeps all three asset hashes and the profile hash exact.

Six native test groups sample all twelve clips at 121 phases for both anatomies/all three LODs. Fifty-four ordinary paid presentation routes sample entry, work and idle return for self aid, self release, owned equip, supply drop/pickup, adjacent door, chest inspection, ration and bayonet fitting. Lowest complete boot is 0.963264 mm; both boot minima remain below 2.271493 mm; maximum complete boot point speed is 0.017872 mm/s. This retains the prior lower-LOD floor precision. Saved wrapper placement and native offsets/scales stay exact. The nine orders retain their exact ordinary combat AP payments and preserve owned rifle ammunition.

Eight normal browser routes, with 32 before/after captures, compare male/female self aid and owned weapon cycling at the same camera. The local review fixture starts only finite medical supplies or the unarmed slot; the actions use ordinary actor targeting and W. All routes retain prone saved placement, load five actors and report no render errors. The medical UI captures still show the inherited hand-floor defect described below.

Focused native/loading/runtime checks: 34 passed. Native asset verifier, locomotion-profile check and typecheck passed. The durable evidence package has the named channel/field proof, input pin, builder/idempotence receipts, actual paid-route log and normal UI script/captures. No gameplay, runtime consumer, geometry, outfit, equipment or profile change is included.

## Explicit limits and next source work

Prone theft and prisoner release/escort reject this posture; their raw grab/signal native clips are checked without claiming an accepted gameplay route. Brace also rejects prone. Dynamic throw and bolas clips retain different moving Root/pelvis curves and are excluded.

The unchanged upper surface probe finds hands below the floor by up to 42.322 mm for heal/free/pickup, 47.351 mm for offer and 3.662 mm for several other interactions. Offer forearm reaches -59.991 mm, breach -19.776 mm, door -12.951 mm and tool/fitting about -7.019 mm. Prone pistol idle left hand reaches -6.885 mm. The next separate source work must fit actual weighted palm, finger, sleeve and forearm surfaces and actual held items through natural prone reach, with Root/pelvis/spine, native dimensions, paid clocks and ownership preserved. The nineteen firearm-work motions also need that full upper/item audit. Long garments remain a separate open visual check.

## Current integration

The named builder was applied to main after PR 253 (`07053253598ad0760622fdc8aa21d681d95bce5d`). It retains the preceding nineteen firearm work clips and all earlier movement, guard, bayonet and gesture fixes. Per anatomy, current-bank preservation confirms 72 changed lower rotation outputs, 1,836 exact other selected channels and 322 unrelated clips. Current bank SHA256 is male `d75355af7f86c0f6840399c83092bf4e72f1036218621432cbe6762ab1cf0a85`, female `aef5ad3949c2282e55cda6d116f8dc895f5a4aabd64a184c8dcabf827838de8d`.

The public `Vendas, recogida y liberación` scene now has a standing/prone selector. It creates fresh valid battle state with finite medical and ground supplies and actual held entanglement. Both postures use the same ordinary paid orders; the snapshot tests check body posture, owned gun identity, ammunition, unchanged cells, supply consumption and immutability. An initial local selector implementation used an invalid standing value. Snapshot validation caught it; the corrected implementation passes before publication. The failed local fixture log is retained separately.

The 52 focused native/presentation/loading/clock checks pass in 16.665 s. All 16 combined fixture checks pass in 0.988 s. Native library/calibration, TypeScript, documentation and 38 baseline checks pass. Combined production export `c4f3f60be5fe` verifies 1,244 files and 1,039 asset references.

Current compiled-page source `4765cbafd34142eca02c618c286e8d8831e2ddf9` passes all twelve before/after male/female healing, pickup and release routes in 144 captures. Each normal order pays exactly once: 100 internal AP becomes 75/92/85. Owned gun hands and charge/reserve stay exact; saved cells E7/I7/M7 and Q7/U7/Y7 stay prone. No browser error occurs. Nine source/runtime/model hashes remain exact across the run, and served bank/manifest bytes match the explicit baseline substitution or corrected current source. Selected male aid/release and female pickup views were inspected against the baseline and prior prone sprite references. Those views retain the visible upper-floor and ally-contact limitations.

The final documentation commit leaves all nine captured source/runtime/model paths exact. The publication bridge and source/served asset reports are in `artifacts/three-prone-interaction-current-review/`. Final upper-floor, adjacent-patient hand contact and garment acceptance remain open.
