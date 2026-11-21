# Exploration patrols and the battle opening clock

During real-time tactical exploration, local militia patrol along map search waypoints at one step per six-second ambient tick, and when a tactical battle opens with immediate enemy sight, the campaign and tactical clocks synchronize before the initial state is published.

The existing map search waypoints serve both combat autonomy and exploration. Each six-second ambient tick permits one legal movement step. Planning uses a bounded movement budget; the actual step spends energy and time, without spending AP. Movement lowers a prepared firearm. It does not reload, repair, change ammunition or give manual control of militia to the player. Hidden enemy coordinates do not select the waypoint. Incapacitated and bound militia cannot scout.

Sight is checked before patrols and after each step. Contact stops ambient movement and starts the existing initiative rules. The ordinary exploration pause, hidden-tab suspension, inventory and dialogue pause remain in effect. Patrol cadence, positions, energy and current contact survive a saved tactical snapshot.

Campaign battle opening publishes a synchronized campaign/battle pair. An enemy that alone sees the arriving squad can act immediately and advance the battle clock before the first player input. `prepareCampaignBattle` therefore synchronizes both clocks before either state is published, so the first autosave loads normally; an exact resumed snapshot is not initialized or charged a second time.

## Remaining work

Exploration-first assaults follow the
[hostile-sector entry](../campaign/hostile-sector-entry.md) rules. Patrol waypoints
and cadence are Granaderos tuning. Tactical militia command choices and strategic
militia medical assignments remain open.
