# Observation and the combat journal

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

Enemy names and personal actions enter the journal only when the squad can see the event. This uses the same facing, range, light, smoke and obstruction rules as current squad sight. It extends the player-knowledge contract in parity row V01; it does not change the simulation's AP, supplies, injuries or enemy decisions.

Equipment selection, loading, medical aid, stance, fatigue, inventory, movement, rout and exit messages now identify their subjects explicitly. Every named enemy subject must be observed when the message is created. Later contact does not restore suppressed messages. The saved journal remains a list of strings, with no new save fields.

A wound to your soldier still produces an injury message when the attacker is unseen. That message uses an anonymous source. Injury visibility is captured before applying damage so a fatal hit does not erase the final observer's report. A protecting guard is checked independently; seeing the intended target does not reveal an unseen guard's identity or injuries. Trap injury messages retain their environmental source.

Hearing retains the existing approximate, anonymous sound report. An unseen enemy interrupt uses a generic message; only visible interrupters are named. Observed enemy advances omit total route length and AP cost because the route may have started outside sight. Player movement retains its full cost summary.

## Verification and limits

Nine journal integration tests cover hidden and visible medical aid, equipment changes, later revelation, save restoration, anonymous rear attacks, fatal witnessed attacks, reload sounds, visible and hearing-only interrupts, unseen guards and movement into night sight. Existing enemy-care tests verify medical resources and wounds directly instead of treating a leaked message as proof of treatment. The isolated gameplay snapshot passed 1012/1012 tests, type checking, production build and whitespace validation, separately from unfinished art and recruitment changes.

A live QA import repeated the blind-fire scenario: Cabral fired toward D8 for 36 AP; the opponent remained absent from public state. After the enemy turn, the journal contained only Cabral's location-fire message and the turn announcement. Reload and Continue restored the exact journal. Browser warning/error logs were empty. A separate simulation replay of the same fixture confirmed that the hidden opponent used one dressing and stopped bleeding; this private outcome was not exposed through the browser read.

The browser check covers hidden self-treatment after a location shot. Other journal branches have simulation coverage, not individual live demonstrations. Generic contact, turn and battle-result announcements remain. Old save files can retain messages written before this change; they are not rewritten. This is progress on the wider parity audit, not full JA2 parity.
