# Supported prone self-care arm path

The current native prone heal pose put right fingertips 42.3 mm below ground in the male rig and 35.1 mm below ground in the female rig. The ordinary paid entry fade reached −59.4/−86.6 mm. Raising the source wrists alone retained the bad entry fade. This cut repairs only `prone.gesture.heal` in the two current native banks.

The left arm and fingers use the actual current unarmed prone guard. Its complete forearm stays planted while the right arm moves to the self-care position and back. The right wrist follows one smooth native reach path, with its own existing working hand orientation at the work centre. The working wrist has 3 mm clearance at admission/return and 60 mm lift at the original low work point. Both hand orientations and finger curls return through the current native guard. This removes the inherited downward finger curl during the idle fade. The native body, shoulder parents, limb offsets/scales and bone lengths remain exact; no wrapper, Root, pelvis, spine, leg or runtime fitter is changed.

Each selected clip changes 36 arm/finger rotation outputs. Eighteen left constant STEP channels retain their exact input bytes and STEP interpolation. The three right arm channels retain LINEAR interpolation; their inputs use 120 Hz samples plus every old native key. The fifteen right finger channels change from constant STEP to LINEAR over that same sampled path. There are 182 right keys. Each selected clip retains all other 123 channels, including all translations/scales, Root/body/legs, with exact time/value/interpolation bytes. All other 333 clips per anatomy and all native mesh/skin/rig/material payloads stay exact. The actual stored duration stays `1.399999976158142` s; the nominal manifest duration stays 1.4 s. Loop settings, markers, paid clocks, rifle/pistol contacts and prior support records stay exact.

The manifest adds one support record per anatomy and updates only the two bank hashes/byte counts. The complete locomotion profile stays byte-exact. The builder reads current banks and performs named channel replacement; it never copies a whole old bank. The normal library build runs the new postpass after the existing rifle/pistol/prone support passes. Both the builder and the installer are idempotent and preserve Node JSON numeric formatting.

Actual complete weighted hands, fingers, forearms and sleeves pass the ordinary paid prepare/result and return through idle for all eight appearances and three LODs. Minimum skin clearance is 1.702 mm. The opposite forearm remains within 4.590 mm of the floor; its work-interval world speed is zero. Peak wrist speed is 0.849 m/s. The complete result equals the ordinary `actBattle` result: doctor/patient cells, AP, finite dressings, weapons, ammunition and wound results retain the same authoritative behavior. The eight appearance checks cover 24 runtime cases and pass in 34.2 s. A separate 1,248-state held-entry/return native blend probe also stays above 1.5 mm. Native verification, profile idempotence and types pass.

Four ordinary HUD routes also pass: standing/prone × male/female, using the public reach fixture, normal `1`/`5` doctor selection and adjacent patient Enter. The 24 images have no browser errors. Saved doctor/patient cells stay E7/E8 and Q7/Q8; each doctor pays 6.25 PA. Standing motion is unchanged. The new prone arms clear the floor and retain supported self-care mechanics. They still use the generic native self-care gesture when an ally is selected: admitted patient reach/contact remains the next separate correction. No adjacent-patient contact claim is made here.

```sh
node --test tests/three-prone-heal-arm-support.test.mjs
python3 tools/characters-3d/verify-library.py
node tools/characters-3d/compile-locomotion-profile.mjs --check
npm run typecheck
node tools/characters-3d/build-prone-heal-arm-support.mjs --receipt /tmp/heal-support.json
```
