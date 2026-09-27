# Coordinated attacks

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The JA2 manual, printed page 43, describes squads approaching one target from different adjacent sectors. The first arrival can wait for other squads before attacking. Granaderos now implements this choice with its existing campaign geography and hourly travel.

## Player flow

1. Put each squad in a sector adjacent to the target. Order the attack from the map or squad management. This schedules the approach without advancing time.
2. Advance time. The clock stops when the first squad reaches the target boundary. The route panel lists ready squads and the travel hours still needed by the others.
3. Advance again to wait, attack with all currently ready squads, or order an individual squad to return. A return takes the hours already travelled. Waiting does not add marching fatigue or provide local-sector work and recovery.
4. All ready squads enter one tactical battle through the edges determined by their actual origins. Each soldier has a separate position and retains personal fatigue, wounds and equipment. The portrait strip scrolls to expose more than six deployed soldiers.
5. A victory preserves each original squad. Physical tactical exits can send different squads back through different edges. Death, capture, finite ammunition and equipment use the existing individual return ledger.

## Authority and limits

A squad waiting at the boundary remains in transit. It cannot defend its departure sector, work there, receive local supplies, reorganize or sleep. Expired contracts stay with the pending approach and deployment until a physical arrival or battle return. Cancelling a staged attack always starts a timed return; it cannot teleport soldiers home or enter hostile territory without a battle.

The shared deployment includes an explicit squad/origin/member manifest. Save validation checks its membership against each campaign squad, the actual target location and each unit's approach edge. Each source depot contributes ammunition once; global stock pays the remainder, and one battle consumes the ordinary powder cost. Failed admission leaves the staged groups and clock unchanged.

If a player attacks before the other columns arrive, those late columns return when their route reaches an already active tactical sector. Joining a battle already in progress remains unimplemented. Enemy generation for a new coordinated engagement uses at most six soldiers in its existing difficulty calculation, so extra player squads do not each spawn matching enemy reinforcements. Existing occupation forces and unfinished tactical enemies retain their actual rosters. A full strategic garrison and reinforcement economy remains a separate parity gap.

A target that becomes friendly while columns wait can be entered without a battle or attack supplies. A squad already physically in an occupied sector can fight immediately. The direct `attack` API without `queue: true` keeps its blocking approach for campaign scripts and special missions.

## Evidence

`coordinated-assault.test.mjs` exercises concurrent and staggered arrivals, waiting, timed return, attack-now behavior, source-depot accounting, invalid saves, contract expiry, peaceful arrival and the eight-squad/48-person limit. It creates the actual tactical map, checks approach-edge placement and complete save/reload, and performs actual tactical exits for a two-column withdrawal. Its victory settlement check uses an explicitly scripted report; that does not prove a complete player-led conquest.

`coordinated-assault-render.test.mjs` checks the boundary decision panel and access to twelve tactical portraits. Validation on 11 September 2026 passed all 1,098 tests, type checking and the static build (278 files, 189 asset references). The preview route returned HTTP 200. Browser interaction and selected arrival positions were still pending at that checkpoint. See the newer arrival section below and the parity audit for their current status. Mid-stage exhaustion stops remain outside this implementation.

A separate engine run used the established-front twelve-person fixture and ordinary automatic tactical orders. It reached victory after 186 actions and 17 rounds, without a timeout or automatic withdrawal. Seven soldiers died. The campaign accepted the actual report, retained the two original squads (zero and five survivors), and restored the resulting save. This proves an engine-level engagement and return, not browser interaction or a complete new-game campaign.


## Selected arrival positions — 12 September 2026

The browser now opens an overhead placement screen for the actual arriving squads before a hostile encounter. Select one soldier or a whole squad on its own approach edge, or use automatic spread. Saved drafts retain the approach receipts and cost no tactical or campaign time. See [sector arrival placement](sector-arrival-placement.md) for current implementation and validation.
