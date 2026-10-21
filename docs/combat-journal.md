# Diario de combate

The tactical toolbar contains a collapsed **Diario de combate** panel. It shows
up to 80 recent observations, newest first, with their turn numbers. The panel
remains available during enemy playback, a player interruption, and defeat.

The journal uses `battle.publicJournal`, a versioned event-time record. The
legacy `battle.log` remains internal. The UI and the WebMCP battle projection
both read the same entries through `publicCombatJournal`; the public projection
calls this field `journal`.

The reducer admits each event when it happens. Own orders can report the
squad's costs and supplies. Observed enemy actions use separate general text
without private AP, ammunition, reload progress, or hit chance. Observed wounds
and deaths remain in history after contact is lost. An unseen attacker stays
anonymous. Artillery structure messages require sight of the structure before
the shot changes it. Hidden civilian phases and unreviewed internal messages
are not copied into the public record.

Old saves do not gain reconstructed history. They show the empty-journal text
until a new public event occurs. The optional record survives tactical and
sector snapshot validation; malformed versions, entries, and excess history
are rejected. This presentation metadata does not change combat outcomes,
randomness, costs, or visibility.
