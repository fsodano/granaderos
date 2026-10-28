# CreateGameSession

The player starts a fresh campaign from a definition and seed.
`CreateGameSessionUseCase` validates the seed and asks its repository to create
the campaign. The infrastructure adapter assigns a new `GameSession` identity
once. The deterministic campaign factory remains the compatibility engine.

A session starts at revision zero. The same seed can create distinct sessions.
Creating a session is separate from restoring a saved session.

An invalid seed is refused with `DomainRefusalCode.InvalidGameSeed` before the
repository creates a session. Browser composition translates the code.
