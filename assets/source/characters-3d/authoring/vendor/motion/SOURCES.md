# Human motion sources

Recorded body movement comes from the [CMU Graphics Lab Motion Capture Database](https://mocap.cs.cmu.edu/). Files use Bruce Hahne's 2010 MotionBuilder BVH conversion, from the pinned mirror commit in `source-manifest.json`. The complete converter notice is `READMEFIRST.txt`.

CMU permits research use and use in commercially sold products. It does not permit selling the motion data itself, including converted raw data. The converter adds no restrictions. These are custom terms, not CC0. This source directory is authoring provenance; the game ships short retargeted animation clips with its characters.

| Recipe | Capture | Selected source frames | Use |
|---|---|---|---|
| Idle | 111_28 | 120–360 | Standing still |
| Walk | 07_01 | 100–230 | Forward walk |
| Run | 02_03 | 40–131 | Jog/run |
| Crouch walk | 136_09 | 430–614 | Forward crouch walk |
| Prone crawl timing | 111_03 | 450–686 | Recorded alternating knee travel, adapted to a low forearm crawl |
| Climb up | 143_37 | 48–232 | Ladder ascent |
| Climb down | 143_37 | 296–465 | Ladder descent |
| Recover | 140_01 | 130–536 | Face-down get-up; reversed for voluntary descent |
| Fall | 90_18 | 58–212 | Backward fall from a rug pull |

Official subject catalogues: [111](https://mocap.cs.cmu.edu/search.php?subjectnumber=111), [7](https://mocap.cs.cmu.edu/search.php?subjectnumber=7), [2](https://mocap.cs.cmu.edu/search.php?subjectnumber=2), [136](https://mocap.cs.cmu.edu/search.php?subjectnumber=136), [143](https://mocap.cs.cmu.edu/search.php?subjectnumber=143), [140](https://mocap.cs.cmu.edu/search.php?subjectnumber=140), [90](https://mocap.cs.cmu.edu/search.php?subjectnumber=90).

The source skeleton is used for movement, not for replacement anatomy. Retargeting preserves native character bone lengths. BVH hand/toe channels contain marker noise, and fingers are not captured. Finger curl, trigger contact, rifle support, short-gun holds, blade grip, period reload manipulation, item gestures, and rider seating are native authored constraints. Crawl is an adaptation of the recorded hands-and-knees motion, not an untouched military crawl recording. Climb uses a ladder recording; the game supplies actual ledge height and actor travel.

The animation bank is a presentation asset. Markers identify visible shot/contact/release phases. They never fire weapons, apply damage, alter AP, change collision or body height, or move game coordinates. Asset clips remain separate from authoritative rule events.
