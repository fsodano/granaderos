# Slice 33: the game session owns the random source

**Intent:** Give `GameSession` ownership of the `RandomSource`, and make the
campaign's random draws go through it.

## Why this slice exists

`RandomSource` is a domain object in `packages/game/domain/shared/random-source.ts`,
but the game session does not own it. The campaign still draws a random value
through a procedural helper in `packages/game/campaign.js` that reads and
writes a bare `seed` field on the campaign snapshot.

The ubiquitous language says the game session owns the random source, and
that its state is part of the game snapshot. The saved `seed` field is that
state today. Giving the session the object makes the owner explicit without
changing the saved format.

## What it adds

`packages/game/domain/session/game-session.ts` gains a `RandomSource`:

- `GameSession.create(id, seed)` builds one with the campaign's seed,
- `GameSession.restore(snapshot)` rebuilds it from the snapshot,
- `GameSession.snapshot()` carries the source's state,
- a `randomSource` accessor exposes it.

A snapshot without the source's state is accepted for compatibility and uses
a zero seed.

## What it changes

- `packages/game/infrastructure/persistence/create-game-session.repository.js`
  and `packages/game/infrastructure/session/campaign-game-session-mapper.js`
  pass the campaign's seed into the session.
- `drawCampaignRandom(session, draft)` takes a `GameSession` and a campaign
  draft, draws through `session.randomSource`, and writes the advanced state
  back to `draft.seed`.
- `packages/game/campaign.js` builds the session at the start of a command and
  uses `drawCampaignRandom` for both random draws. The retained helper
  delegates to the session's source instead of implementing the sequence.

## What it does not change

The save format: `seed` stays where it is, with the same values. A game that
is saved and restored still repeats the same sequence. The two draws produce
exactly the numbers they produced before.

## Tests

- The session tests prove a restored session repeats its random sequence and
  that its snapshot carries the source's state.
- A test of the campaign's random path proves the sequence drawn through the
  session is identical to the sequence the old helper produced.
- Existing save and restoration tests cover the unchanged save format and
  restored sequence.
