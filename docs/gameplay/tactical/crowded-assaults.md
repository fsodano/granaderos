# Crowded assault entrances

When a player launches a tactical sector assault from the strategic campaign map, the entry check verifies that the destination sector's tactical arrival edge has enough free boundary cells for every participating soldier and cannon before opening the tactical session. If the entrance cannot fit the force or its guns, the order returns the existing entry error and retains the previous campaign state. Ready squads stay staged; resources, cannon stock, personnel and the clock remain unchanged.

The player can save that staging state, withdraw one squad through normal travel controls, and start a smaller assault. The remaining force enters through its actual edge. A purchased cannon stays in reserve after rejection and is issued only when entry succeeds. No interior positions or extra boundary cells are granted.

## Limits

An assault that cannot open is rejected before it is committed. Deployment in
waves, later arrivals during a battle and the complete campaign remain outside
this rule.
