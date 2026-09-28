# Granaderos: current game design

Updated 2026-09-28. This is the product contract. Implementation and acceptance
status live in [PROGRESS.md](../verification/published-progress.md), with evidence in [the audit](../verification/formal-audit-2026-09-27.md).
A capability described here can still be missing from the published game.

## Purpose and platform

Granaderos is a Spanish-language browser strategy and tactical game set in the
Argentine independence period, 1810–1820. It adapts JA2's campaign, personnel,
combat and persistent-world ideas to period weapons, institutions and geography.
The browser engine is the delivery platform; the supplied native engine and JA2
references guide behavior. Modern agencies, weapons and science-fiction content
are not part of the historical scenario.

The player must be able to learn and finish the campaign through normal controls.
Historical names and settings are part of the default campaign. Dialogue,
personalities, prices and tactical tuning are authored gameplay, not authenticated
historical quotations, wages or surveyed geography.

Gameplay systems and campaign content must be separate. The same tested mechanics
must run a replacement cast, equipment catalogue, dialogue, rules and campaign
without editing engine code. A second distinct playable campaign created through
the editor is a release requirement.

## Decisions that override earlier documents

- The game is a web game, not a required native JA2 installation.
- The strategic economy uses pesos. Raw-material recipes, resource convoys,
  infantry manufacturing and individual horse breeding/care from the original
  specification were removed in [PR #12](https://github.com/fsodano/granaderos/pull/12).
  Tactical carried equipment, finite ammunition, care and transport restrictions
  remain required. They must not reintroduce an unwanted material-management game.
- Paid candidates permit day, week and month contracts when affordable, including
  elites ([PR #17](https://github.com/fsodano/granaderos/pull/17)). A local prototype
  that restricts elites to one day does not change this decision.
- A new game has no pre-hired historical squad. The player can create one free
  personal character or hire a paid candidate. The formation chapter advances
  with that first person in service, without an extra academy funding charge.
  A pending hire must arrive first. See [opening acceptance](../verification/retiro-opening.md).
- A bulletin candidate exists off-map until hired and delivered. A dossier is not
  an NPC encounter. Arrival requires a controlled, suitable reception location;
  an arbitrary river, sea cell or mountain pass is not a reception facility.
- An appearance range is a set of exact cells anywhere on the actual map. It can
  cross regions and include open land. It is not a locality plus invented outskirts.
- Existing state is conserved. A location update must not heal, clone, resurrect,
  rearm or erase a character. Reloading must not reroll world decisions.
- Equipped objects drive contextual use. Avoid redundant dedicated Charge/Heal
  controls where the held weapon or medical item already defines the action.

The stock campaign and default story-package launch start with Retiro as the only
controlled sector. Retiro is the supply origin and headquarters. Buenos Aires and
Ensenada begin occupied. Existing saves keep their territory. Starting ownership
is still a required explicit setting in the campaign package; that authoring
capability is not yet connected.

## Player flow

The title offers a new campaign, continuation, import/export, help and editor
access. New-game presentation introduces the setting and objective and can be
skipped or replayed without replacing a save. Reduced-motion controls are required.

The campaign desk contains the personal-character creator, hiring dossiers,
correspondence, treasury, diplomacy and journal. The strategic map contains
personnel, independent squads, exact locations, assignments, known intelligence,
travel, sector entry, time and militia orders. The tactical view contains direct
selection, movement, observation, contextual equipment use and conversation.

Every important action must show its cost, requirements, result and failure
reason. Invalid orders leave the campaign unchanged. Keyboard, pointer and
camera controls must work without exposing developer state or requiring console
commands. Save failures must be visible and must not discard the active campaign.

## Campaign and historical scenario

The stock scenario retains five linked chapters: formation at Retiro; San Lorenzo;
the northern campaign and Yatasto handover; Cuyo and El Plumerillo preparation;
and San Martín's field deployment and final liberation. His early mentor/mission
role is distinct from the late recruitable field role. Required participants,
chapter gates, defeat, victory and post-victory continuation need explicit rules.

The political model includes the Directory, northern gauchos, Pardos y Morenos,
foreign volunteers, Indigenous allies and permanently hostile Royalists. Decisions
must affect recruitment, civic support, trade and territorial consequences.
Opposition has northern, coastal and interior objectives, with actual forces,
reported threats, defense, retreat and losses. Merely changing ownership on a timer
does not complete strategic warfare.

The strategic map retains the thirteen named historical locations and four
regional theaters within the larger cell grid. Cells have independent tactical
scenes and persistent objects. Roads, ownership, blockades, terrain and winter
closures constrain travel. Foot travel, postas, carts, mules and river transport
need distinct declared capacities, costs and routes. Water traversal requires
its own supported rules; selecting a water cell does not authorize walking there.

Captured territory funds the campaign. Treasury entries, recurring income,
blockades, damage, purchases, wages and rewards must agree with the UI and saves.
Rewards and retrieved objects cannot be collected twice through reentry or reload.
Militia requires local support, a qualified instructor, time and money. Ranks,
combat experience, casualties and local defense must remain persistent.

## Personnel, contracts and world residents

Each person has a stable identity, portrait, appearance, biography, attributes,
traits, abilities, personality, event speech and service policy. Campaign roles
such as commander, contact or merchant bind to identities; changing a person's
name must not change their abilities or silently move a campaign role.

Bulletin hiring has a complete quote, advance payment, journey, controlled destination,
arrival, service start, expiry, renewal, cancellation and death policy. Delayed
arrivals remain off-map when a location becomes unsafe or is currently loaded.
World residents require actual presence, conversation and authored conditions.
An authored resident can offer permanent unpaid service or local day, week and
month contracts with a visible price. Local service starts in place; it has no
bulletin arrival. Historical encounter roles retain their original service policy. Independent squads have at most six members; reassignment requires
real co-location. The player officer has one persistent identity.

Health, bleeding, breath, fatigue, morale, experience, learned skills, inventory,
relationships, custody and service are separate state. Dead, unconscious, routed,
captured, dismissed and off-map are not interchangeable statuses. Care, rest,
repair, training and rescue consume real time and available resources. A route
must adapt to actual survivors; it cannot revive an expected doctor or give free
supplies to reach a scripted checkpoint.

The editor supports these appearance rules:

- A fixed cell.
- One cell drawn from an authored set at campaign creation, then kept permanently.
- A persistent initial placement with eligible daily movement within an authored
  set. The default update is 04:00, with an explicit probability and destination
  policy, including random selection or alternation between two cells.
- Conditional activation, including a different successor after confirmed death.

Initial generation and later scheduled decisions use saved, versioned random
state independent of combat. Future daily locations are decided when their event
runs, not rerolled when opening the map. Loaded scenes are protected under a
visible policy. A movement changes the existing resident's location and local
routine; it does not create another person. The player sees discovered/reported
locations and the time of the report, not private random state.

Successors are distinct people. Confirm the triggering death once, retain the
chosen delay and destination, and hold blocked arrivals without rerolling.
Transfer only the explicitly assigned service role, stock or responsibility.
Do not copy the predecessor's wounds, corpse items, identity or completed receipts.

## Tactical play

Exploration runs without turn-by-turn AP management. Actual hostile contact enters
individual turns; disengagement can return to exploration without pretending that
unseen enemies are dead. Time, wounds, lights, fatigue, schedules and saves use one
consistent clock. Contact, interrupted turns and reentry must not grant extra AP.

The 100-AP framework supports walking, running, crouching, crawling, facing,
diagonal movement, stance costs, encumbrance and legal pathfinding. Group orders,
route replacement and interruption must preserve each completed step and cost.
Walls, doors, windows, height, cover, light and sound affect observation and fire.
Private enemy positions must not leak through paths, previews, logs or selection.

Weapons require owned, compatible ammunition and equipment. Aiming, readying,
firing, partial reloads, misfires, priming, wear and hand changes must conserve
charges and condition. Smoke spreads and dissipates with actual sight consequences.
Melee uses the held blade or fitting, reach, posture, momentum, parry and reactions.
Thrown weapons and explosives have finite custody, paths, effects and recovery.
Cannons require actual crews, ammunition, movement/pivot costs and valid targets.

Wounds, incapacitation, bleeding, shock, rout and death use the same rules for
relevant actors. First aid stabilizes; longer care heals. Corpses, unconscious
actors, dropped weapons, ground stock and civilian consequences remain accessible
and persistent. NPC and enemy movement uses real walkability and observation.
Enemies and militia obey the same costs and resource constraints as comparable
player actions.

The detailed parity register retains all 87 gameplay requirements from the local
JA2 audit, including inventory, assignments, relationships, custody, rescue,
transport and world persistence. Its missing or unverified parts are not removed
by this summary. Numerical adaptations must be recorded with tests, not described
as exact JA2 equivalence without evidence.

## Story editor and authoring

The story editor uses searchable character and weapon catalogues. Portraits and
weapon images are visible in the editor and game. Character appearance rules are
inside each character's sheet. Authors mark exact cells with an X on a map and
can inspect fixed and randomized results through a seeded preview.

Character identity and campaign role are separate. Authors can replace the paid
roster and create encounter characters without borrowing a historical numeric ID.
Weapons include compatible ammunition, melee, artillery, attachments and supported
handling rules. Merchant stock, prices, buyback and replenishment are authored
rules, not uncontrolled duplication of owned items.

Dialogue is a graph of authored text, conditions, choices and effects. Quests
track explicit state, participants, receipts and completion/failure consequences.
Authored quests begin unstarted, become active and then complete or fail. Terminal
states do not reopen. Dialogue conditions define the requirements; an accepted
choice applies its quest change, optional treasury operation and optional local
movement atomically. An ordered event record persists progress and supplies the
player journal. An optional
deadline starts at acceptance with campaign-second precision. Tactical actions,
travel and waiting advance the same limit; expiration fails an active quest once.
Unstarted quests have no running timer and completed quests keep their result.
Quests can require specific characters to survive. Confirmed death fails an active
quest, including death during military service; wounds, unconsciousness and service
changes do not. Dead requirements block acceptance. Completed quests keep their
result. Escort and item objectives require their own authored rules.
A scene can order an existing actor to walk to a marker, approach, face, wait and
speak. It uses ordinary movement, doors, time, combat interruptions and saved
continuation. Arrival is an actual reached location, never a teleport or timer-only
claim. Role changes and recruitment cannot silently redirect a running scene.

Campaign composition defines starting resources and ownership, cast, roles,
locations, chapters, objectives, opposition and endings. Rules are validated
settings or a supported typed condition/effect vocabulary, not arbitrary code
embedded in content. Unsupported options must block launch with a useful reason.

Drafts have validation, undo/redo, import/export and recovery. A campaign pins an
immutable content version and assets. Editing a draft cannot alter an active save.
Random results, pending events, exact item custody and all actor identities survive
save/load. Assets and references must travel with a portable package or produce a
clear missing-dependency error. The map/sector constructor and story editor have
separate responsibilities but must form one usable workflow.

### Local dialogue meeting policy

An authored dialogue may call another available world resident in the loaded
sector to a reachable square beside its speaker. The square is fixed when the
order is accepted. It is not a teleport or a following behavior. Arrival holds
position; blocked routes and danger pause the order. A later accepted order can
replace it. Repeating a consumed choice cannot repeat or restore a previous order.
Death stops movement, and changing the resident's sector/presence ends the old
local order. Unloaded scenes do not simulate this route. A dialogue condition may
require actual conscious, safe presence at the latest commanded destination in the
active sector before its quest or money effects are accepted. This is a current
physical condition, not an elapsed-time or permanent completion flag.
Map-marker destinations,
arrival effects and multi-actor story sequences remain part of the target design;
see the separate status and evidence in [local meetings](../verification/dialogue-movements.md).

## Presentation and release acceptance

The default campaign needs legible Spanish UI, recognizable period characters,
distinct Royalists, proportionate buildings and original art/audio with provenance.
Movement, posture, equipment, injury and death must match the actual action.
Walking frames, sprite-family coverage and the complete requested animation set
are different acceptance scopes. Static atlas coverage is not visual approval.

Performance acceptance covers cold entry, travel, long exploration, larger fights,
lighting, room reveals, groups, inventory and repeated save/load on recorded
hardware. A fast helper or one smooth walk does not establish universal 60 FPS.

Completion requires all active requirements to have usable controls, tested rules,
persistence and integration evidence; a complete fresh campaign with real battles,
losses and purchases; defeat and rescue/recovery routes; and a second authored
campaign without engine edits. A test fixture that injects victory proves only a
state transition. A local feature or passing subset is not a published release.

## Sources and maintenance

The supplied [original specification](original.txt),
[gameplay clarifications](gameplay-expansion.md), merged scope changes
and this conversation supply the requirements. The formal audit preserves the
additional local parity requirements and identifies conflicting implementations.
Legacy design documents remain available for provenance, with current-status
banners. Every feature PR must update its requirement entries, design decisions
when needed, verification evidence and the generated progress view.
