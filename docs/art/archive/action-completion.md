> Historical recovery record. Counts and completion statements below describe the source task, not the current combined build. See ../sprite-families.md and ../../verification/latest-build-consolidation.md for current scope.

# Complete shared sprite actions

Status: in progress. The 328 atlases from PR #14 do not complete this goal.

All 19 shared appearances must have every required action in all eight
directions. Civilian is included without an exception. Existing approved art
remains in place while missing art is authored and reviewed.

`game/sprite-action-requirements.js` records the visual requirements from the
tactical commands in the current main branch. It includes crouched, prone and
mounted combat, utility actions, artillery crew work, stance changes, mounting,
and changes of life state. Commands that combine movement and an action need
both phases. Rest and explore retain the appropriate directional body stance.

The expanded audit reads this contract rather than treating the old 18-state
list as the scope. It also flags command names missing from the contract.
Future changes to accepted commands must receive a visual coverage review.

Completion requires all of the following:

- Every required appearance/action/direction has reviewed source art and frames.
- Each image depicts the required direction and action; names alone do not prove it.
- Body scale, ground anchors, complete silhouettes and animation timing are coherent.
- The editor lists the complete requirement matrix and explains missing work while it remains.
- Accepted gameplay actions select and play the corresponding animation, including
  compound movement/action sequences and life-state transitions.
- No missing action is hidden behind an idle pose or a civilian exemption.
- Packing, published assets, runtime selection and browser checks cover the full matrix.

New built-in image generation outputs and exact prompts are stored under
`assets/source/illustrated-sprites/complete-actions/`. Candidate sheets are not
coverage until their selected regions have been registered, packed and reviewed.

Initial batch: Granadero crouched firing. The north and south candidate sheets
need cardinal-direction corrections before registration. The first north
correction has been generated. No new atlas has been published yet.
