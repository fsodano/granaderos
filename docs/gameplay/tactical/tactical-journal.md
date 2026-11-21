# Observation and the combat journal

During tactical exploration and turn-based combat, enemy names and personal actions enter the player-visible combat journal only when the player's squad can see the event at the moment it occurs. This uses the same facing, range, light, smoke and obstruction rules as current squad sight. It extends the player-knowledge contract in parity row [V01](../../requirements/ja2-parity.md) (the player sees current enemies only through squad observation); it does not change the simulation's AP, supplies, injuries or enemy decisions.

Equipment selection, loading, medical aid, stance, fatigue, inventory, movement, rout and exit messages identify their subjects explicitly. Every named enemy subject must be observed when the message is created. Later contact does not restore suppressed messages. The saved journal remains a list of strings, with no new save fields.

A wound to your soldier still produces an injury message when the attacker is unseen. That message uses an anonymous source. Injury visibility is captured before applying damage so a fatal hit does not erase the final observer's report. A protecting guard is checked independently; seeing the intended target does not reveal an unseen guard's identity or injuries. Trap injury messages retain their environmental source.

Hearing retains the existing approximate, anonymous sound report. An unseen enemy interrupt uses a generic message; only visible interrupters are named. Observed enemy advances omit total route length and AP cost because the route may have started outside sight. Player movement retains its full cost summary.

## Limits

Generic contact, turn and battle-result announcements remain. Old save files can
retain journal messages written under earlier rules; they are not rewritten.
