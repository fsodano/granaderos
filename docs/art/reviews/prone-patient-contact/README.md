# Prone patient contact review

The current paid care pose puts the medic's working palm on the visible patient thigh. The predecessor kept that hand on the medic. The owned medkit stays visible on the existing hip socket and returns to the hand. This review covers the adjacent prone patient turned southeast, for both native anatomies. Other legal care arrangements remain open.

| Review | Male | Female |
| --- | --- | --- |
| Main before this change | [Before](before-male-work.png) | [Before](before-female-work.png) |
| Current normal paid care | [Current](current-male-work.png) | [Current](current-female-work.png) |
| Current 2D sprite reference | [Sprite](current-sprite-male.png) | [Sprite](current-sprite-female.png) |

Root inspected all six images. The actual sprite renderer uses prone idle art for this care action. These direct sprite references use the same paid reducer state, decoded atlas images and southeast patient direction. They are art comparisons, not a separate live 2D gameplay acceptance. Root also inspected supplied reference images 002 and 014. Reference 002 informs body readability and scene density; its modern equipment does not define the historical art direction.

Patient contact is visibly improved. The current 3D prone legs remain much wider and more bent than the sprite silhouettes. Clothing and equipment still have flat detail at this zoom. Those defects remain open. These images do not certify final body or art polish. Screenshots show ordinary public HUD controls and can differ slightly in animation phase. Separate dense geometry and cancellation proofs measure physical contact.

The root gate passed 201 affected checks in 22.5 seconds, typecheck, native verification, locomotion profile verification, documentation audit, all 38 baseline checks and production build. Build source is `577e42340cdf854ba4b3c6ae900b9ce4a4813ca12d1a1945417fd3f07dbb924e`. All nine code/test hashes and 406 protected inputs matched before and after the build. Documentation-only review additions retain that build source.

The root live run passed both ordinary paid routes with 12 screenshots, 122 unchanged source/native pins, 300 exact native responses and all three new clinical modules actually served. Contact was ready at native time zero. First apply costs were 4.3 ms male and 3.5 ms female; these are observed client calls, not whole-scene FPS. Patient turn costs 4 raw AP, 86 to 82. Care costs 25 raw AP, 100 to 75. Bleeding stops, wounds become bandaged, supplies drop from 2 to 1 and saved cells stay E7/E8 and Q7/Q8.

[Source and UI receipt](root-source-and-ui.json) records protected inputs, baseline/current hashes, served modules and screenshot hashes. [Implementation and limits](../../../verification/prone-patient-contact.md) records geometry, lease, cancellation and worker checks. Raw local proof scripts, frozen inputs and diagnostics remain in integration artifacts and the immutable review cut; they are not all shipped in this public folder.
