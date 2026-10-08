# Native bayonet boot support review — 7 October 2026

The released standing bayonet thrust inherited the previous rifle guard's raised and tilted boots. This source cut fits the actual bayonet Root and pelvis poses with native leg rotations. The source keeps its exact weapon pose, native dimensions, one-second cycle, 0.42-second contact marker and approved 1.25 playback rate.

The basis is commit `63a2c99fa948b9ac6b244d49b6428593bf3b681f`. The current guard and butt corrections remain exact. The bayonet's interior Root, pelvis and six leg rotations differ from the butt, so its lower tracks are solved from its own source rather than copied from another strike.

## Native support correction

The existing measured guard primitives retain actual native joint lengths, complete boot skin weights and the lower sole outline. The bayonet fitter retains the Root, pelvis and all upper channels. It levels the boot and ball together, preserves the actual authored right-foot lift, and permits a bounded forefoot roll when the retained pelvis requires it.

The complete sole bounds the roll to 6.5 mm during source fitting. When that would consume the native leg's 2 mm reach reserve, the fitter measures the smallest horizontal ankle correction toward the actual hip. A one-micrometre reserve buffer protects the measured threshold from native float rounding. The exporter measures this demand over the full 240 Hz native path, then uses separate C2 roll and correction envelopes. The maximum measured correction remains below 5 mm; both endpoints have zero planar correction.

| Native anatomy | Maximum C2 planar correction (mm) | Maximum heel roll (degrees) | Minimum fitted key reserve (mm) |
| --- | ---: | ---: | ---: |
| male | 0.000000 | 0.120586 | 2.003359 |
| female | 1.323615 | 1.233034 | 2.001873 |

The female left correction envelope begins at 0.395833 s, peaks at 0.5 s and ends at 0.616667 s. The male needs no planar correction. A rolling support sole has a planted forefoot and a bounded raised heel; it is fully level at the initial and final guard endpoints.

## Preservation and finite behavior

Each complete bank retains all 334 clip names. Exactly eight lower quaternion tracks change in `stand.bayonet.long-gun`: thigh, calf, foot and ball on both sides. All 333 other clips, all 151 retained channels in the selected clip, native nodes/rest transforms, meshes/weights/triangles and inverse binds remain byte-exact by the selected transplant gate. Equipment assets and item ownership remain unchanged. The generated locomotion profile remains byte-exact.

The normal legal fitting order attaches the owned India socket bayonet to rifle 1800. Source blend tests derive their finite strike from the real paid order and preserve the same result as the ordinary reducer. The normal 0.12-second idle entry and return fades keep complete boot support at 24, 60 and 240 Hz for both anatomies and all three detail levels. Each source cue completes once and returns to native idle.

## Local validation

All 36 focused checks pass in 4.55 seconds. They cover the six source/detail combinations, 18 actual idle↔bayonet crossfades, and the existing rifle guard and butt source/fade regressions. The profile compiler check and Python source compilation pass. All source/bank/fixture pins are retained in the temporary cut's receipts.

The independent audit checks both anatomies and all three detail levels at 240 Hz, plus the exact 0.42-second contact. All 22 pinned source and asset hashes pass before and after. The actual leg reserve stays at least 2.001902 mm; the complete sole span stays at most 6.498450 mm. The nearest native boot minimum stays between 1.949961 and 2.000334 mm, within the existing 2 mm support baseline tolerance. Guard endpoints agree within 0.001370 mm. The actual right lift keeps both 0.104167–0.329167 s and 0.612500–0.929167 s windows above 0.1 mm; its maximum is 35.161788 mm.

## Motion limits at the same interval

The table compares every actual weighted boot vertex on the original and corrected banks at the same 240 Hz native samples and approved playback rate. All source acceleration peaks occur at native 0.1375 s, and speed peaks at 0.170833 s.

| Anatomy / detail | Old speed (m/s) | New speed (m/s) | Old acceleration (m/s²) | New acceleration (m/s²) |
| --- | ---: | ---: | ---: | ---: |
| Male / 0 | 1.552387 | 1.549114 | 245.035552 | 258.115127 |
| Male / 1 | 1.552355 | 1.549114 | 245.086644 | 258.115127 |
| Male / 2 | 1.552568 | 1.549078 | 244.973568 | 257.271530 |
| Female / 0 | 1.555009 | 1.550405 | 245.244093 | 258.836296 |
| Female / 1 | 1.554976 | 1.550436 | 245.242593 | 257.230395 |
| Female / 2 | 1.554796 | 1.550436 | 245.225851 | 256.856214 |

The independent before/after normal fades cover 36 replays. Each cue completes once, reads zero target models, preserves its paid simulation snapshots, and returns every final boot point exactly to the native guard. Corrected fade support minima stay between 1.933610 and 2.000312 mm.

| Actual fade cadence | Old speed (m/s) | New speed (m/s) | Old acceleration (m/s²) | New acceleration (m/s²) |
| --- | ---: | ---: | ---: | ---: |
| 24 Hz | 1.429102 | 1.425435 | 21.422842 | 23.194287 |
| 60 Hz | 1.550460 | 1.546180 | 39.722706 | 45.132561 |
| 240 Hz | 1.863173 | 1.560903 | 160.704103 | 203.399328 |

The retained native motion has acceleration corners, and the lower support solve amplifies some of them. This remains a separate motion correction. The current source cut establishes bounded native fallback support. Paired bayonet contact fitting, source acceleration correction, upper-body review and ordinary browser screenshot acceptance remain separate; the complete thrust is not claimed as finished body polish.

## Root current-bank integration and gameplay review

Root transplanted only the eight lower rotations of the one accepted bayonet clip into each current complete bank from main `3e51e1a3f1b67e814ac52e1ca0f531d6374cae40`. It first checked that every retained selected Root/pelvis/body/weapon channel matched the frozen source basis. The corrected selected clip then matches the frozen native output exactly. All 333 other clips and native payload remain exact, preserving current prone and unarmed movement work. The default guard exporter is unchanged; its new optional bayonet branch and full-builder call are composed with the current prone/gait postpasses. No stale complete bank was copied.

Native source commit `6c2d3dcc` is followed by playable review source `d8addee80c980d23c6d594030441c0bcdf6a1033`. All thirteen integrated source paths remain exact after Cabildo PR #248 in combined source `a4da954693782b8548cc875996c95a7e02042763`. The original source velocity/acceleration and contact-fitting limits above remain unchanged.

The new normal Bayonetas scene prepares two separately identified owned Brown Bess/socket assemblies through the ordinary paid fitting action. The ordinary melee action spends 16 internal AP (four displayed PA), keeps each charge, reserve and firearm condition, and wears the same bayonet once. No private renderer pose or injected saved state is used.

Root ran 36 native/source/fade/guard checks in 4.857 seconds and eleven review-fixture checks. The actual fixture contact, 12 internal AP fitting cost, finite attack, identities, ammunition and immutable/valid snapshots are checked. Native library, locomotion profile, Python/type/docs and all 38 baseline audits pass. Initial export `96d9fd3eba08` and combined export `717eec4ee75d` pass with 1,244 files and 1,039 asset references.

Two ordinary browser cases pass with four loaded actors and no errors. Forty-four source-pinned captures show owned equipment, readiness, prepare/contact/impact, finite completion and retained equipment. Both targets take one 50-point damage result; displayed PA changes from 22 to 18, loaded charge stays one and reserve stays twelve. Saved cell controls remain at G7/M7. Served native model bytes match the recorded source files, and source/asset hashes remain exact before/after capture. Root viewed male/female strike frames against the current Granadero southeast strike sprite: the weapon, stance and supported boots are visible; native target overlap remains a separate contact-fitting review.

Receipts and captures remain in `artifacts/three-bayonet-native-source-cut-review/`. The 3D native support and ordinary browser acceptance requested above are now recorded. Paired fitted contact, retained acceleration corners and complete body polish still need the separate corrections stated above.
