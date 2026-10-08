# Accepted faces in gameplay — 8 October 2026

[PR #284](https://github.com/fsodano/granaderos/pull/284) merged the accepted
faces into main `37fdbf8fd2524f2d83340583af4987076086deb6`. The live battlefield
uses these released bodies through the normal actor runtime. It does not need
a separate lab asset or a new saved-character format.

## Checked paths

The independent local pass created two new campaigns through the normal UI:
`Mateo Revisión` used portrait `123`, and `Inés Revisión` used
`avatar-woman-civilian`. Both selected the soldier job and entered Retiro with
their issued equipment. The gameplay adapters selected `granadero` and
`woman-shawl`, respectively, with the brown skin palette. Standing, crouched
and prone controls completed, and returning to the menu and reloading retained
portrait, job, weapons, blade and issued clothing.

Normal San Lorenzo combat used Barcala's owned Charleville. One shot changed
loaded rounds from 1 to 0 and internal AP from 100 to 89. Reload changed loaded
rounds from 0 to 1, reserve cartridges from 12 to 11 and internal AP from 89 to
47. The UI showed the matching 25 → 22.25 → 11.75 PA values. This shot missed;
the check establishes ammunition and paid action execution, not hit damage.

The public 100-character scene loaded all eight body families at LOD0, LOD1
and LOD2. Each captured detail level had 100 loaded actors and zero pending
actors. Network body, bank and texture bytes matched the local source hashes;
page and asset error lists were empty.

The face change retained both 334-clip gameplay banks exactly:

| Bank | SHA-256 |
| --- | --- |
| Male | `624915277f2f4f842c0f2b8c251e91aee7b5436319612e327ecbb174fe1f8cda` |
| Female | `aa8cc1381835de19c1ffa747020d50225f92f3f8c1eb807e31c4a04007e2f37a` |

The runtime applies the selected skin palette to the face material's declared
skin role and albedo reference. The local selection passed 106 face, eye,
skin and actor-runtime tests, plus type checking and the animation metadata
check. Production export `dd52f15fc9d9` passed with 1,304 files and 1,041 checked
asset references. No GitHub Actions build was started for this review.

## Reproduce

Start the web development server, then run:

```sh
GRANADEROS_REVIEW_ORIGIN=http://127.0.0.1:3150 \
node tools/verify-three-character-gameplay.mjs
```

Use `PLAYWRIGHT_MODULE` for an existing Playwright installation and
`CHROMIUM_EXECUTABLE` for an installed browser when necessary. Output defaults
to ignored `artifacts/three-character-gameplay-review/`; override it with
`GRANADEROS_REVIEW_OUTPUT`. The script uses fresh browser contexts and normal
controls. It reads only its own newly created saves and does not inject saved
state or renderer poses.

The [source and gameplay receipt](../art/reviews/accepted-faces-gameplay/receipt.json)
records the exact reviewed source, served asset hashes, appearance selection,
posture/save checks and combat HUD results. Screenshots were reviewed at the
normal tactical camera:

- [Male character in Retiro](../art/reviews/accepted-faces-gameplay/male-battle.png)
- [Female character in Retiro](../art/reviews/accepted-faces-gameplay/female-battle.png)
- [Finite reload in San Lorenzo](../art/reviews/accepted-faces-gameplay/san-lorenzo-finite-reload.png)
- [Eight families at LOD2](../art/reviews/accepted-faces-gameplay/all-appearances-zoom-1.png)
- [Eight families at LOD0](../art/reviews/accepted-faces-gameplay/all-appearances-zoom-3.png)

## Limits

Tactical faces are small, and Retiro's night lighting limits fine face review.
These captures verify integrated assets and the stated gameplay paths. They
do not establish every motion, exact weapon/patient contact, complete clothing
clearance, likeness to every portrait or sustained frame performance. Body,
clothing and building polish remain separate work.
