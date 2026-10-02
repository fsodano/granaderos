# Alpha service-equipment return — local acceptance

Updated 2026-10-02. Included in this alpha PR; accepted locally at **`67f6c7b5195d0cf946bf8c4c3134a84cabcf3702`**. This dated record does not assert alpha CI or merge. [PR #139 publication](../evidence/pr139-published-2026-10-01.json) remains an immutable published-baseline snapshot. The PR body and final delivery report record actual new publication after the single verified push.

## Accepted bounded behavior

Ordinary dismissal or contract expiry returns current equipment once at the actual locality: weapons, loaded and loose ammunition, finite pockets, outfit, consumable supplies and repair stock. Equipment remains physical and collectable through the sector inventory. Collection consumes that source; it cannot refill, duplicate or teleport gear. Rehire grants no replacement allocation: equip a compatible carried or returned weapon, or purchase finite local stock. Wounds and spent supplies remain current. Complete campaign preparation uses actual returned kit, paid recruitment and rest, legal squads, paid gun-lane moves and the current living survivors and physician roles. These actions conserve resources and permanent losses; they do not grant replacement actors or equipment.

An expiry during a loaded battle waits for normal settlement. In-transit expiry follows actual arrival. Bounded local cache/full-map fallback preserves one owner and blocks duplicate rehire custody. Capture and death keep their separate existing custody rules; horses remain independent. Broader civilian armour, arbitrary belongings and explicit role/stock transfer remain open.

## Complete local evidence

All **4,251/4,251 tests** pass with **zero failures, skips, cancellations or TODOs**, across all **600 files** in **4,556.1 seconds**. All **9,324 frozen executing inputs** remained unchanged during that complete run, and the pinned native engine stays clean. Every required gate passes: partition coverage, documentation, **38 reference comparisons**, types, production export, Python, strict native compilation/execution, local links and whitespace. The complete uncached ending/recovery remain part of this full run; real losses, finite supply, costs, replay/save, all 13 localities and saved 48-hour continuation are retained. See the [local receipt](../evidence/alpha-service-equipment-local-2026-10-01.json) and [compact source delta](../evidence/alpha-source-inputs-delta-2026-10-01.json).

The delta has **30 changed / 14 added / 0 removed inputs** over the retained PR139 manifest; **9,280 inputs** are unchanged. It reconstructs exact target manifest SHA-256 `4a274f6645ac6107f6834cfd869506b812202f3d200359d9bec074077c425457`. The complete command ran at the tested commit above. Later pre-push documentation/evidence is audited separately; a later documentation commit does not imply a repeated long test run.

## Final CI timeout adjustment

After the complete local run, only the test-job timeout in `.github/workflows/web.yml` increases from **90 to 120 minutes**. The ending test measured **2,910.7 seconds** locally. A conservative route-only estimate of **1.8 × that duration + 360 seconds** is **5,599.3 seconds**, already above the former limit before other shard work. This estimate is a planning allowance, not measured CI performance. The web-job timeout, four groups, two workers, Node version, test command and workflow triggers stay unchanged.

The compact manifest delta remains the exact executed snapshot above, including the former workflow hash. **All 9,323 other frozen inputs remain byte-identical**, including every game, test and tool source. Final workflow and documentation checks are recorded separately; no later full local rerun or completed CI is asserted. The one-line limit change prevents an avoidable timeout without changing test coverage.

## Bounded browser and save checks

Game, story and sector editor share build **`59bdba25a3bb`**, source `59bdba25a3bbd5e7e00fd5d2105ee3bf76f531244b168fa7f349cfb92244d0cf`. Browser QA ran at `2035fa7702858123b454141ca0c9d26b00fb10fe` on the private origin `http://127.0.0.1:3137`. The exact reviewed test-only preparation and expectation paths changed before the final complete run; the refreshed browser relationship proves that game/tools/UI source stayed identical. Both full bounded browser receipts are copied into the local evidence record.

Paid dismissal and actual hour **23 → 24** expiry return **10 physical stacks**. Those stacks are collected once, while **5 unrelated local sources** remain untouched. Repair points advance **0 → 35 → 100**, consuming the real return reserve **100 → 65 → 0**. Collection retains treasury and elapsed time. Actual autosave reload retains the identical campaign. Both editors report the same build; checked game/editor consoles contain **zero warnings or errors**.

## Alpha readiness and open work

The bounded implementation and scripted routes are ready for user alpha testing after the single PR passes required matching-head CI and merges. Then stop implementation for the user's issue session. Extensive manual play, wider forces/seeds and balance, full JA2 parity, release art/audio and sustained loaded **60 FPS** remain open. The checked private UI/save sequence does not certify those broader requirements. The existing original-origin PR139 campaign/editor handover remains separate history; an actual new published handover must be recorded externally.
