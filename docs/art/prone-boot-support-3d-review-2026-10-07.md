# Prone boot support review — 7 October 2026

The original published prone idle/crawl put part of the toe or fitted boot through the floor. The source now fits the complete footwear surface after loop closure at the actual 30 Hz export grid. It changes only eight native leg rotation channels in each of the 12 prone idle/crawl clips per anatomy. Native joint offsets, scale and segment lengths remain.

The actual published LOD0 boot surfaces were checked at 121 phases per clip. Worst support is +1.992 mm male and +1.651 mm female; idle stays at +2.156 mm male and +1.982 mm female. Both boots remain between 1 and 3 mm above the contact floor. This checks the complete sole, toe cap and fitted boot, including points that a lower sole-ring check misses.

A binary preservation comparison confirms all 322 other clips per bank, all 1,812 non-leg tracks in the affected clips, meshes, rigs, skin bindings and bind matrices are exact. All unrelated manifest records and the locomotion calibration file remain exact. The crouched correction and both climbing clips remain intact.

The clean committed cut passed 74 affected checks: complete crouched/prone boots, current climb contacts, native rifle/pistol loading, retained sabre contact, actor runtime and the concurrent rider transition. Type/docs/baseline checks, native asset and locomotion verification, and the production export pass (1,244 files; 1,039 asset references; build `6302fd090f6f`).

Fourteen final clean idle, crawl and completion frames at `artifacts/three-prone-cut-review/` completed both ordinary one-cell movements and verified the saved destination cells without game/browser errors (the missing favicon is excluded). The male idle/completion and female crawl-3 frames were visually compared with the current illustrated armed-prone sprites. They retain the low body silhouette, bent knees, visible boots and the original rifle hold. Exposed unarmed fingers and cuffs, sideways motion, braking and the wider posture bank remain separate work. This accepts the measured prone boot correction, not complete body polish.
