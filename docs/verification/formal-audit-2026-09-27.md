# Formal implementation audit — 27 September 2026

## Conclusion

**The complete game and story editor are not accepted.** The published baseline
passes its smaller suite. Both larger local versions fail campaign acceptance.
There is useful working code in each version, but no single verified release
contains the complete design. Test totals are not completion percentages.

The active contract is [DESIGN.md](../specification/game-design.md). The active requirement
register is [requirements.json](requirements.json), rendered in
[PROGRESS.md](published-progress.md). This dated audit records evidence and does not
silently change when a later PR fixes a requirement.

## Method and scope

1. Read the supplied specification, later gameplay requirements, current editor
   plan, published PRs and local JA2 parity audit. Preserve all 50 broad original
   rows and all 87 parity rows, including their missing choices. Add bounded
   published deliveries, story integration, player/release acceptance and failures.
2. Identify each source tree separately. Record commit, dirty status, file hashes
   and pre/post aggregate hashes. A dirty HEAD is not an exact source revision.
3. Run both larger complete Node suites without editing their source. Run types
   and production builds. Use exact-head published CI and the already completed
   isolated presence run as separately labelled evidence.
4. Compare default runtime attributes and equipment values against the original
   numerical tables. Inspect initial ownership/resources and funded elite quotes
   in all three versions. Do not treat old documentation as runtime evidence.
5. Distinguish bounded regression evidence, source inspection, historical claims,
   failed acceptance and unperformed checks. Record closure conditions before
   promoting a requirement to VERIFIED.

This is a **source, automated regression and integration-readiness audit**. It is
not a fresh human playthrough, exhaustive visual inspection, historical research,
performance certification or mathematical proof. No new browser acceptance was
performed. The local parity file contains prior live checks; those remain
historical evidence. Passing a whole suite does not certify every sentence in an
old status row. Sources for the original G/M page references are identified in
[the preserved parity source](../evidence/formal-audit-2026-09-27/parity-source.json).

## Sources and results

| Source | Revision at audit | Tests | Types / production export | Acceptance |
|---|---|---|---|---|
| Published main | `490d5dde4914f7d1050f1901ddf783aa88bc95ed` (PR #28 merge) | 537 passed, 0 failed, 0 skipped | PASS; 721 files, 631 asset references | Bounded published regression only |
| Advanced original checkout | `eb39ef7e903fa33f1d463b2af0db2de3c66cf93c` **plus 290 dirty paths** | 3,040 passed, 4 failed, 3 skipped; 3,047 total | PASS; 962 files, 858 asset references | FAIL |
| Editor prototype | `390028896a4e95a325337763cb82d6e9114a5045`, clean | 2,895 passed, 1 failed, 0 skipped; 2,896 total | PASS; 965 files, 859 asset references | FAIL |
| Prepared presence delivery | `e2dff9662476cc5b7435a63c381840108beea5f9`, clean | 548 passed, 0 failed, 0 skipped | PASS; 721 files, 631 asset references | Local only; not published |

Published evidence is [PR #28 exact-head CI](https://github.com/fsodano/granaderos/actions/runs/36356017429/job/108723788789),
source `f6697ea022014410fbafc6080f6587c204647e7c`. PR #28 changes documentation,
not game behavior. PR #27 supplied the latest gameplay change at this baseline.
The prepared presence run is from earlier in this session, before the formal
read-only comparison; it was not rerun here or represented as merged.

[checks.json](../evidence/formal-audit-2026-09-27/checks.json) records totals, hashes and build counts. Full searchable
[test output for the advanced checkout](../evidence/formal-audit-2026-09-27/original-tests.txt),
[prototype](../evidence/formal-audit-2026-09-27/prototype-tests.txt) and [presence branch](../evidence/formal-audit-2026-09-27/presence-tests.txt) is
retained. Workstation path prefixes are replaced with `<repository>`; both raw
and stored log hashes are recorded. Type/build outputs are separate files in the evidence
directory. Both larger type checks were also rerun independently with exit code 0,
so a subsequent successful build cannot mask their exit status.

The larger test runs emitted React title/SVG casing warnings. They are not the
route assertion failures; they are UI cleanup work and cannot be treated as
visual acceptance. No test was disabled to obtain the reported results.

## Source stability and reproducibility

The advanced and prototype snapshots were captured at 22:48:33 UTC and again at
22:55:35 UTC. Their source and status digests were unchanged during verification.
See [snapshots.json](../evidence/formal-audit-2026-09-27/snapshots.json) and the three source manifests.

- Advanced source SHA-256: `b14503f4f5b70338c8c062832540185381c79eb99f2db98ba0a1c8bafa9438fe`.
- Prototype source SHA-256: `4fde8270b567aa984455423fae8b48eefd4e25912633aa7cc5badadad06b8eeb`.
- Prepared presence source SHA-256: `a7e3cdff4c9dbf708c80541497eaded7f30d74ab1b26215dade12a608562a75f`.

The manifest covers cached/untracked non-ignored files under `game`, `web`,
`tests`, `docs`, `tools`, `.github`, plus root package files. It excludes dependency
folders, ignored build artifacts and art sources outside these paths. It is not
a full disk or dependency lock attestation. The advanced source is uncommitted:
its hashes identify the tested files but do not make that checkout reproducible
from its HEAD alone. Publishing each preserved change is part of INTEGRATION-01.

To repeat on the corresponding source tree:

```sh
npm ci --prefix web
python3 tools/audit-snapshot.py /path/to/source /tmp/before.json
npm test
npm run typecheck
npm run build
node /path/to/audit/tools/audit-baseline.mjs /path/to/source
python3 tools/audit-snapshot.py /path/to/source /tmp/after.json
```

The snapshot tool belongs to this audit delivery; older trees will need its
absolute path. Compare both source and status digests before accepting a run.
Do not reset either local source or replace the prototype service on port 3107.

## Reproduced failures and closure conditions

The advanced suite reports four failures, but **three independent failure points**:
one failed child also fails its parent suite. Its three skips depend on the failed
recovery, so later milestones were not exercised in that run.

| ID | Reproduction point | Observed result | Required closure |
|---|---|---|---|
| FIX-01 | `fresh-campaign-recovery.test.mjs:113` → `fresh-northern-recovery.mjs:34` | No fit local medic (`assert.ok(medic)`) after the northern fighting | Obtain actual medical relief through surviving/hired personnel, travel and paid finite supplies; continue the entire fresh route |
| FIX-02 | `opening-playthrough.test.mjs:90` → `northern-route.mjs:236` | Persistent Córdoba garrison defeats the relief force; turn 4, 21 actions | Diagnose route policy, balance or simulation cause; complete recapture and stabilization with real losses |
| FIX-03 | `prisoner-rescue-route.test.mjs:5` → helper line 56 | `defeat` instead of required physical `retreat` | Release, escort and exit with actual survivors; retain wounds, service, captive identity and exact equipment |
| FIX-04 | Prototype `fresh-campaign-recovery.test.mjs:51` → `northern-route.mjs:211` | San Lorenzo defeat; turn 6, 75 actions, 36 elapsed seconds | Reconcile supported campaign rules and route policy; win or handle the intended failure legally and continue |

Skipped advanced milestones: medical courier/paid recovery, joint Salta assault,
and post-Salta care/Yatasto. Their dependency reasons are in the retained log.
Earlier successful route checkpoints do not close these fresh failures.

A failed controller does **not** prove that the game is impossible. Investigate
whether the cause is the engine, scenario balance, stale assumptions or inadequate
route tactics. A valid fix must preserve real costs and consequences. Removing an
assertion, injecting a victory, reviving a required doctor or adding free supplies
does not establish campaign acceptance.

## Runtime comparison and policy conflicts

[Published baseline](../evidence/formal-audit-2026-09-27/published-baseline.json): 36/36 numerical comparisons pass.
[Advanced baseline](../evidence/formal-audit-2026-09-27/original-baseline.json) and [prototype baseline](../evidence/formal-audit-2026-09-27/prototype-baseline.json):
37/37 pass after checking the actual fixed-bayonet profile separately from its
new loose-item profile. The loose bayonet's 24 damage/one-tile reach is an explicit
local adaptation; the healthy mounted profile retains 16 AP/50 damage/two tiles.
The first literal table comparison exposed that distinction. It was investigated,
not waived. This does not certify period accuracy or combat balance.

| Policy | Published main | Advanced local | Prototype | Consolidation rule |
|---|---|---|---|---|
| Strategic resources | `economyVersion: 2`, treasury only, 3,200 pesos | No version 2, 29 resource keys | Same older material model | Preserve pesos-only PR #12; retain tactical finite item custody |
| Funded elite terms | Day/week/month available; 1,600/11,200/48,000 | Same available terms/prices | Day 50; week/month refused | Preserve all three terms and the approved paid roster rules (PR #17) |
| Starting control | Buenos Aires, Retiro, Ensenada | Retiro only | Retiro only | Publish the later Retiro-only opening as its own accepted delivery |
| First character | Empty roster; custom/hire options; academy charge remains | Free first person, no extra academy charge | Older opening behavior requires consolidation | Publish the later free opening; do not import unrelated economy code |
| Contract candidates | Off-map until paid safe arrival | Different older integration surface | Preview/editor is not publication | Preserve separate hire-only and world-resident policies |

The first-person policy is established by local implementation/design review, not
by the empty-roster numerical probe alone. Starting ownership and contract prices
above are actual probe results. New campaign content must declare these settings;
unrelated file imports must not decide them accidentally.

## What the evidence does and does not close

- PRs #19–#27 provide nine bounded published capabilities: portraits, character
  sheets, controlled arrivals, firearm authoring, generated force equipment,
  replacement paid identities, presentation, abilities and exact land cells.
  They have separate VERIFIED entries; broader requirements remain open.
- All 50 original design rows and all 87 local parity rows are retained. The
  register distinguishes PARTIAL, LOCAL_ONLY, MISSING, FAILED, UNVERIFIED and
  SUPERSEDED. No automatic completion percentage is reported.
- The editor still lacks accepted general world identities/succession, authored
  branching quests, scripted movement, full rule/equipment/merchant authoring,
  campaign composition and a second complete campaign.
- Local gameplay adds substantial inventory, care, custody, movement, observation,
  AI and persistence code. Source claims and many passing checks are useful
  migration evidence, not proof that those systems already exist in main.
- Known parity gaps include consumable camouflage, contract compensation/insurance,
  authored relationships, protective clothing effects/repair, parts of traversal,
  cargo/passenger integration and broader quest consequences. Do not remove these
  choices merely because the current architecture lacks them.
- Active sprite coverage, full requested animation coverage and visual approval
  are different. No new complete art, audio, performance or human campaign
  acceptance was performed in this audit.

## Delivery and maintenance gate

Work from published main in isolated branches. Preserve the larger sources.
Import one functional slice with its state model, controls, migrations and tests;
then update the affected register rows and evidence. Keep approved policy changes
explicit. Run relevant checks and exact-head CI before each authorized merge.

`npm run audit:docs` checks requirement coverage, evidence references, stored log
integrity and the generated progress view. `npm run docs:progress` regenerates
that view. `npm run audit:baseline` rechecks declared numerical defaults; any
intentional adaptation needs explicit design and test evidence. The checker was also exercised with seven negative cases: duplicate ID, removed
original requirement, removed parity requirement, unknown evidence, incomplete
VERIFIED scope, missing test path and a stale progress view. Each was rejected.
Automation checks consistency, not the truth of a human completion claim.

A diagnostic repeat of the fresh route, with an observation-only loader that
wrote the state before recovery, reproduced FIX-01 in 112 seconds. At hour 200,
Armand Delatour was alone in Córdoba with 13 health and 4 bleeding; the surviving
medical staff were in Tucumán. The helper required a fit local medic before it
could issue any relief action. This identifies a route assumption to resolve;
it does not establish an engine fix or accepted rescue. See the
[diagnostic checkpoint summary](../evidence/formal-audit-2026-09-27/recovery-diagnostic.json).

Next work is ordered in the active register. Full completion requires the combined
suite, actual fresh campaign and defeat/recovery paths, all active parity choices,
the finished authoring workflow and a second distinct campaign. No overall goal
is marked complete by this documentation delivery.
