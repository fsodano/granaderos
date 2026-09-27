# Exploration patrols and the battle opening clock

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

Local militia now scout during exploration. Previously they only acted during the allied combat phase. If both sides lost contact, militia could stand still while hostile guards remained close to their own posts.

The existing map search waypoints now serve both combat autonomy and exploration. Each six-second ambient tick permits one legal movement step. Planning uses a bounded movement budget; the actual step spends energy and time, without spending AP. Movement lowers a prepared firearm. It does not reload, repair, change ammunition or give manual control of militia to the player. Hidden enemy coordinates do not select the waypoint. Incapacitated and bound militia cannot scout.

Sight is checked before patrols and after each step. Contact stops ambient movement and starts the existing initiative rules. The ordinary exploration pause, hidden-tab suspension, inventory and dialogue pause remain in effect. Patrol cadence, positions, energy and current contact survive a saved tactical snapshot.

Campaign battle opening now publishes a synchronized campaign/battle pair. An enemy can act immediately when it alone sees the arriving squad. That can advance the battle clock before the first player input. The UI previously published the old campaign clock with this advanced battle, so its first autosave could be rejected on load. `prepareCampaignBattle` synchronizes before either state is published; an exact resumed snapshot is not initialized or charged a second time.

## Verification

- Five militia exploration tests cover legal steps, AP/energy/ammunition, actual visual contact, hidden-position independence, saved continuation and incapacity.
- Three opening tests cover immediate enemy initiative and a loadable first save, exact resume, peaceful opening without clock advancement, and missing deployment rejection.
- All 1,484 repository tests pass. Type checks and production build pass; static export verifies 278 files and 189 asset references.
- Live production Battlefield preview: at six seconds the militia moved from (2, 4) to (3, 4), retained 100 AP, one loaded charge and three reserve cartridges, and used one energy. At eighteen seconds it reached (5, 4), exposed one enemy, and entered combat. Its new combat budget was 99 AP at 97 energy. Save/load retained the complete visible state. No further ambient movement occurred in combat.

## Remaining work

The subsequent [hostile-sector entry change](../campaign/hostile-sector-entry.md) enables exploration-first assaults and verifies the revised northern campaign route. The route follows the actual survivors and equipment; its earlier casualty and recovery counts no longer describe the current simulation.

Patrol waypoints and cadence are Granaderos tuning. Tactical militia command choices and strategic militia medical assignments remain open.
