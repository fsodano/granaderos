# NPC routines and civilian turns

NPC decisions use deterministic local rules. They do not call an LLM or a network service.

## Exploration

The active tactical view advances six game seconds every six real seconds. Residents walk, enter and leave houses, work, and visit a pulpería. Enemies patrol short routes around their posts. A patrol that discovers the squad starts combat at that contact.

Use **Pausar exploración** to stop the automatic clock. Explicit orders still cost their normal time. The automatic clock also pauses during movement animation, conversation, inventory use, and while the tab is hidden. Wounds and temporary lights use the same clock; they continue when exploration runs.

## Civilian decisions

- Each resident retains a home, destination, routine cycle, and waiting period. NPC IDs provide stable differences between residents.
- Daytime routines alternate outdoor walks, work, social visits, and home visits. At night, new destinations favor home.
- Buildings with `purpose: 'bar'` are social destinations. `workBuildingId` can assign a workplace. Other accessible buildings can serve as homes. Maps without buildings use outdoor destinations.
- A cardinal route search respects walls, locked doors, furniture footprints, soldiers, and other residents. An unlocked door takes part of the movement budget to open. Traps trigger instead of being bypassed.
- Residents wait beside a player soldier so that a conversation can take place. The conversation panel follows the NPC's current position.
- Gunshots, explosions, and alarms interrupt routines. Hearing range and intervening walls determine who reacts. Nearby shots and explosions cause a prone response; more distant shots cause a crouch.
- Residents seek walls, interiors, cover, and distance from the remembered sound area. They retain an anonymous sound report, not a live reference to the shooter. A quiet period of 24–42 game seconds allows the routine to resume.
- Dead, unconscious, and departed residents do not act. Rotation of the civilian queue reduces repeated priority at narrow passages.

The current civilian artwork supplies a low standing pose for crouching and the existing ground pose for prone shelter. A prone resident remains conscious and available for dialogue. Dedicated crouch and crawl atlases can replace these visual approximations later.

## Combat order

The faction that gains contact initiative acts first for that engagement:

1. Player, then enemy, then civilians; or
2. Enemy, then player, then civilians.

The civilian phase is atomic and runs once after both combat factions. It does not issue soldier AP, advance the clock again, or create a combat interruption. A civilian log entry marks the phase. Automatic reaction fire retains its existing AP costs.

Enemies without visible contact patrol one short bound per round and retain AP for combat. Reaction fire retains its existing AP rules. Authored sentries can use `patrol: false`.

## Persistence and checks

Civilian positions and routine progress survive JSON save/load and sector re-entry. Re-entry clears old fear reports because the new encounter has a new clock. New fields are optional for older saves and validated when present.

`tests/npc-ai.test.mjs` covers routes through doors, home/bar visits, collision, hearing and recovery, real gunfire, conversation waiting, fixed time cadence, both initiative orders, patrols, persistence, wounds/lights, interrupted rest, and traps. The published movement, time, campaign, and render tests cover integration.

The original shared-workspace implementation was checked in a live browser for automatic movement, house entry, shot reactions, shelter movement, and pause/resume. This isolated port is covered by the automated checks above; that browser check was not repeated for this port.
