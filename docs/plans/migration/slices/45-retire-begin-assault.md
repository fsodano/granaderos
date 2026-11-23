# Slice 45: resolve hostile arrivals per squad

`Journey` tracks one squad's route. When it reaches a hostile boundary, its
`ArrivalDecision` is the squad's pending fight-or-withdraw choice.
`fightOnArrival` resolves that choice for one squad. The campaign order
identifies the squad;
[`FightOnArrivalUseCase`](../../../../packages/game/application/journeys/fight-on-arrival/fight-on-arrival.use-case.ts)
loads its `Journey`, resolves its `ArrivalDecision`, and commits that journey.
The dispatcher does not accept a multi-squad fight order or a `beginAssault`
alias.

## Order contract

A caller that wants every ready squad at a boundary to fight sends one
`fightOnArrival` order for each squad, with that squad's own arrival decision.
For example, if squads A and B are both ready, the caller sends a fight order
for A and then a separate fight order for B. Resolving A does not resolve B.
`withdrawOnArrival` likewise resolves one squad's decision.

Each order preserves that squad's decision identity, arrival checks, campaign
pause, and resulting notices. A command with `type: 'beginAssault'` is unknown
to the dispatcher and is refused.

## Behavior covered

[`strategic-route.test.ts`](../../../../tests/strategic-route.test.ts) records
the per-squad order shape and the dispatcher's refusal of `beginAssault`.
[`CampaignAction`](../../../../packages/game/public/campaign-types.ts) exposes
`fightOnArrival`, not `beginAssault`.
