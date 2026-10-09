# Pending 3D source integration, 9 October 2026

Compared against main `8fcabf36`. The human dirty source/art/test allowlist is
saved in `d100b46e`. The source work is preserved separately from active runtime
selection. No old whole-library snapshot replaces the accepted current models.

## Existing integrations

Each of these 23 local branches has the same complete stable patch-id as the
listed main squash commit. This includes documentation and generated binaries.
The differing current files contain later main work. Replaying these older
branches would overwrite later changes; only their ancestry needs integration.

| Local branch | Existing main squash |
| --- | --- |
| `codex/chapel-source-front-piers` | `ec232db9` |
| `codex/chapel-supported-placement` | `b60735ba` |
| `codex/church-supported-shell-placement` | `5ef0da0e` |
| `codex/contact-scene-update-order` | `83b69a06` |
| `codex/farmhouse-gallery-exposure` | `ceee7415` |
| `codex/merged-architecture-finishes-source` | `f7847b82` |
| `codex/merged-farmhouse-shell-source` | `bd949510` |
| `codex/merged-house-front-source` | `7dafeeca` |
| `codex/merged-house-placement-source` | `26bb0cb8` |
| `codex/merged-pistol-contact-source` | `05309771` |
| `codex/merged-posta-exposure-source` | `419a40a7` |
| `codex/merged-prone-arm-source` | `4b07286b` |
| `codex/merged-stable-frame-source` | `807e43d9` |
| `codex/merged-stable-shell-source` | `8229184a` |
| `codex/merged-stable-ventilation-source` | `da42da23` |
| `codex/merged-standing-unarmed-sideways-source` | `b6a780e6` |
| `codex/merged-thatch-source` | `8930edbb` |
| `codex/merged-warehouse-volume-source` | `2123bd73` |
| `codex/merged-window-shutters-source` | `58cfaacf` |
| `codex/paid-melee-facing-continuity` | `f9fd6f23` |
| `codex/sabre-native-wrist-support` | `7d0faf38` |
| `codex/standing-equipment-sideways-support` | `4f7a994c` |
| `codex/standing-rifle-sideways-support` | `3ef1020d` |

## Human library and private studies

The [review-source archive](../../assets/source/characters-3d/review-variants/2026-10-09-native-library/README.md)
contains all 1,788 unique source/art/test/receipt blobs from the four human
checkpoint histories, selected private studies, and available temporary authored
source/art referenced by their receipts. Its manifest records exact
hashes, source branches/commits, all original paths and review status. Duplicate
private paths resolve to one blob. Existing main-history bytes are referenced
by their exact Git identity. Dependencies, caches and repeated rendered evidence
are excluded; the original local review directory is retained.

The external supplement records 17,761 available source/art paths and adds 480
unique blobs. It includes the formerly temporary rejected-stubble, coat-material
and other pilot source patches. No literal referenced source path was unavailable.
Where the temporary study did not record a Git branch, the manifest states that
limit and retains the exact original path and receipt reference. It does not
invent source ancestry.

The archive contains competing and rejected studies as labelled variants.
Their source remains editable and recoverable. They are not used by runtime
asset manifests, the build pipeline or the automatic test suite.

The new-looking Worker generated albedo is already active on main. Main's
accepted face manifest identifies the exact d100 Worker body hashes for all
three LODs and the four Granadero/Royalist LOD0/1 hashes. Face extraction retains
the generated texture, UV1 registration and neutral brow beds, while retaining
current main body/clothing and motion. Current-main skin tests already check
these contracts. An additional old Worker body or texture replacement is not
needed.

The older collar rim is a separate study. Main excludes donor collar geometry
from the face-only extraction and instead uses the later `collar_seam.py` repair
at all three LODs, with its current supported clothing and accepted face source.
Replacing it with the old four-body rim would remove newer source behavior.
Its source, private geometry and original limited review remain archived.

Other historical full-library body/motion versions cannot be enabled as one
patch: main already contains independently accepted sabre/palm, prone work,
sideways transitions, cloth depth, apparel surfaces and free-arm corrections.
The preserved variants retain their original tests and limits. No current test
is removed, weakened or silently redirected to older data.

## Local validation and integration limit

The preserved dirty candidate passes 40 generated-skin/PBR tests and 36
library/eye/coat-floor tests, with no skips. The three changed Python authoring
files pass syntax checks, and the staged diff passes whitespace checks. These
results validate the private candidate; they do not certify it as a replacement
for current main's accepted runtime library.

The current integration source also passes all 23 generated-skin and accepted-face
source/compositor tests with no skips. Its active Worker and Granadero material
contracts already cover the exact d100 generated texture and eyebrow refinement.

`verify.py` validates every archived blob against both its Git identity and
SHA-256 digest, plus every archived private-path alias. The archive patch adds
only review-source/documentation paths and is prepared against the current
integration base. Production models, animation banks, source authoring hooks,
current tests and runtime code remain exact.

## Final all-worktree ignored-source supplement

The independent audit compared 963 ignored authored script, patch and source-
model paths against integration `af952d7f`. It found 845 already reachable paths
and 118 aliases of 109 previously unpreserved blobs (17,201,539 bytes). Those
109 blobs are now inactive review-source variants. Exact absolute/relative
paths, SHA-256/Git identities, file modes and discovery checkout heads/branches
are retained in `worktree-source-overlaps.json` and `external-files.json`.
The branch names describe the discovery checkout; these ignored files had no
committed source branch, and the ledger does not invent one. The two early
primary-worktree human model sources account for 16,472,218 bytes.

This supplement includes QA scripts and old preparation/source patches from the
primary, tactical graphics, and detached gameplay/validation worktrees. It does
not enable them, overwrite accepted runtime files, copy dependencies, or copy
repeated render images/contact sheets. All original ignored files remain intact.
