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
  A pending hire must arrive first. See [opening acceptance](../verification/retiro-opening.md)
  and the [verified local-recruit route](../verification/local-recruit-opening.md).
  The local route requires ordinary paid equipment and finite care; it does not
  guarantee solo or all-profile victory.
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
Ensenada begin occupied. Existing saves keep their territory. Authored campaigns
can explicitly set each of the thirteen localities' starting owner and loyalty
(0–100), and select a headquarters from the eleven compatible non-pass localities.
The selected headquarters must start patriot. It determines the empty squad's
initial location, supply origin, formation presentation, local armory/workshop
access and loss condition. Scheduled raids retain the stock headquarters protection.
Districts share locality control; open land remains neutral. Initial choices grant
no capture reward, forces or completed missions and never reset later saved control.
Changing headquarters does not remap historical contacts or their role rules.
Authored chapter progression is a separate choice, described below.

Imported firearm families use an authored reception port and inclusive delivery
window of 1–720 hours, or an explicit disabled setting. Defaults remain Ensenada
and 72–120 hours. Only the four compatible river ports are eligible. The paid
order stores its sampled due time; reload never rerolls it. Actual control and
blockade govern delivery, after resolving same-hour raids. Delayed orders remain
pending without another payment or duplicate stock. Authored weapon instances
retain their definition on delivery. Physical port depots, transport and choosing
imported families remain separate requirements from these published supply rules.

## Authored campaign progression

Authors can replace the original progression with one to twelve ordered chapters,
an introduction and victory/defeat text. Every chapter requires all of its one to
six campaign conditions: time, money, locality control, character state or quest
state. Completed chapters are recorded once and remain completed. Tactical meeting
conditions feed a quest first; campaign completion waits until the scene settles.
Paid candidates satisfy service conditions only after actual arrival.

Optional failure conditions are conjunctive. Headquarters loss and total deployed
force loss remain core failures. Failure takes precedence over simultaneous
victory, including actual quest expiry and confirmed tactical deaths. An ending
during an attack approach prevents deployment; defeat during travel preserves the
last reached position. Saves pin definitions and validate ordered progress and the
terminal result. UI objectives and endings follow the chosen progression.

Original San Lorenzo/Yatasto missions and their implicit essential-character
failures belong to the historical progression. Authored chapter indexes cannot
unlock them. Original contacts, recruitment gates, economic roles, factions,
calendar raids and world geography still need separate composition. This does not
establish an independent second full campaign or change the original design's
historical acceptance requirements.

The bundled [post campaign](../development/example-post-campaign.md) demonstrates
a complete independent three-chapter scenario with paid arrivals, new contacts,
two actual battles, a timed objective and a saved ending. It uses the existing
world and opposition; it does not close their separate authoring requirements.

## Authored campaign cast

Authored progression may remove any historical character, subject to content
references. Removed characters have no fallback encounter, contact or service
record in a new campaign. Original progression still requires its essential cast.
Authors may copy a historical profile into an independent resident, retaining the
editable sheet, presentation, equipment, abilities and placement but no implicit
strategic role. The copy starts with permanent local service, experience growth
and no historical recruitment gate. Empty casts support the normal free player
creation path. New editor identities never reuse reserved original slots.

Generic original map residents can be included or excluded independently; older
packages retain them. Saves pin this choice and the cast. Foundry UI uses the assigned engineer and is absent when no engineer exists and
preparation has not been completed. Replacing the cast does not reassign campaign
functions or compose factions, opposition commanders, diplomacy and world events.
Those remain separate work from selecting who can appear in a new campaign.

## Strategic role assignment

Campaign content can assign the foundry and global marching privileges to any
catalogue identity or disable either. Omitted configuration keeps the original
identity only if that identity remains in the cast. Explicit role references
protect deletion. Definitions stay pinned in the campaign save.

A role requires actual incorporation, life, freedom and valid service. Paid
travel does not count as service; death, custody or expiry removes the privilege.
The marching privilege suppresses travel fatigue for all squads. Preparing the
foundry is a one-time payment; completion persists after its engineer leaves.
The treasury displays the assigned character and the actual availability reason.
Foundry location, names and costs are authored separately. March effect strength,
other mission roles and succession transfer remain separate contracts.

## Authored foundry project

The foundry project selects one of the supported existing land localities, names
its project and army and defines organization/funding prices in whole pesos from
zero to one million. Original values remain defaults. Preparation requires the
assigned engineer's valid service and control of the chosen locality. It charges
once and records its local loyalty reward there; funding charges once afterward.
Pinned saves retain configuration and completed steps.

The prepared locality supplies actual repair and resupply while controlled and
connected to headquarters. Existing workshops remain. Occupation and supply cuts
block the service without deleting preparation. Treasury, logs and historical
preparation text reflect configured names/prices. This does not move tactical
buildings, change the map geography or replace the original Cuyo mission gates.

## Project conditions

Dialogue and authored campaign conditions can require foundry preparation or army
funding to be complete or pending. They read the actual persistent step; hiring or
elapsed time is not completion. Conditions do not apply or pay for projects.
Completed steps remain true after the responsible character leaves or the locality
changes control. Authors can combine separate service and control conditions when
needed. Dialogue eligibility is rechecked at selection; ordered chapter history,
scene settlement and failure precedence retain their existing rules.

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
For the original progression, confirmed death of San Martín before victory ends
the campaign. Confirmed death of the assigned foundry engineer also ends it while
the foundry remains unprepared. The loss reason names the actor and blocked task.
The death does not undo a completed foundry or an established victory. Authored
chapter campaigns use their own failure conditions instead.

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

The default doctor/patient integration assigns serving personnel in the same
safe controlled cell. Doctors need medicine 20, health 15, no bleeding, energy
over 10 and a personal dressing. Each actual working hour spends one dressing,
three energy and adds two fatigue. It stops bleeding first; later hours restore
`2 + floor(medicine / 20)` health. A patient receives at most one treatment per
hour. Assigned staff cannot march, deploy or instruct militia. Supplies can be
purchased locally at a supplied workshop in quantities of 1–20 for ten pesos each.
Assignments and quantities persist; service changes cannot grant new stock.
Workshop replenishment and weapon repair also require the recipient to be at
the exact selected workshop. Selecting another squad cannot service someone
remotely. The armory shows the actual person location and unavailable-service
reason; the campaign rechecks it before charging.
These are declared tuning values, not a claim of exact JA2 numerical behavior.
Advanced care, strategic bleeding, automatic sleep and physical kit custody retain
separate acceptance requirements. See [care verification](../verification/strategic-medical-care.md).

Explicit rest uses safe serving personnel and real campaign hours. It restores
energy and reduces fatigue; patients receive the same recovery while waiting for
care. Stable, nonbleeding rest wounds receive one health point per six continuous
hours. Saves preserve partial hours, while assignment changes and unsafe presence
clear them without a grant. Rest blocks travel, deployment and militia work until
service resumes. Contract expiry stops recovery before that hour's work. Rates
use an eight-hour reference adjusted by wounds and the authored night-vision
trait; no historical-ID profile is implied. The existing supplied daily recovery
is retained. Automatic sleep/wake, collapse, configurable sleep needs, global
fatigue capacity and advanced marching remain separate integrations. See
[rest acceptance](../verification/strategic-rest.md).

An optional authored care group configures minimum medicine, base healing and
skill interval, dressing price, treatment energy/fatigue costs, base rest recovery
and the stable-rest healing interval. Bounded whole values are pinned per campaign;
legacy packages omit the group and retain their identity/defaults. Both dressing
purchase paths use the same price. Free supplies still require actual missing
stock or an explicit quantity purchase; reissuing completed refill work cannot
grant another charge or allocation. Saved partial rest hours use the pinned
interval. Core safe-presence, critical-threshold and finite-dressing rules remain.
See [care-rule acceptance](../verification/authored-care-rules.md).

Manual field first aid uses finite local strokes. It stops ordinary bleeding
without restoring ordinary lost health. Critical care restores living patients
only toward 15 HP (or a smaller personal maximum), with partial work based on the
medic's skill. Each effective stroke consumes one dressing and the existing
18/20/25 action-point cost; exploration spends time instead. Care does not grant
patient energy, AP or posture. Bandaged wounds persist through campaign return,
recruitment and saved deployment, and strategic recovery reduces those wounds.
Automatic service remains a separate integration. Living military actors below
15 health or with zero energy cannot act. Breath recovery cannot heal critical
wounds; stabilization grants no immediate AP. Critical casualties cannot hold the
field, but exhaustion alone does not settle a battle. Incapacitated enemy wounds
and finite equipment persist across visits and a distinct new occupation.
Complete shock, wound/AP, custody and transport behavior retain separate work.
See [critical condition acceptance](../verification/critical-military-condition.md).
Living, present civilians recover ten energy after each loaded civilian phase:
once per completed combat round or six exploration seconds. Waking grants no
movement in that same phase, health, AP or cleared wound history. Critical health
still requires care, corpses remain dead and unloaded scenes do not recover.
Saved partial intervals and identity preserve recovery through visits and service
changes. See [civilian breath recovery](../verification/civilian-breath-recovery.md).

Authored character conditions can query consciousness, unconsciousness, wounds,
bleeding, stable consciousness or full health in dialogue and campaign rules.
They use the current maximum and matching active actor, including mission allies.
A deployed actor without its matching scene has unknown physical condition, not
an inferred result from an older service sheet. Validated tactical checkpoints
resolve failure rules; chapter success still waits for settlement. Health does
not imply presence, service, automatic speech or rewards. See
[story health conditions](../verification/story-health-conditions.md).
An optional authored first-aid response belongs to the patient and is emitted
only after an accepted, paid tactical stroke by another person, while the patient
is conscious. A later recovery tick, self-care, rejected order or saved reload
cannot emit it. Blank or omitted text stays silent, and older packages retain
their identity. See [treatment responses](../verification/authored-treatment-speech.md).
These stroke and indivisible-dressing rules are explicit
Granaderos adaptations. See [manual care](../gameplay/characters/field-first-aid.md).

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

Residents with a character sheet carry the six current personal supply quantities
from their shared identity. Adjacent dead or unconscious residents can be looted
through ordinary paid orders. Collection reduces the original holder; movement,
service changes, saves and distinct successors cannot replenish or duplicate it.
The temporary mission ally retains actual supplies in later contacts. Complete
weapons, pockets, gifts and merchant custody remain separate. See
[finite civilian supplies](../verification/civilian-finite-supplies.md).

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
handling rules. An authored blade retains its identity, image, damage, attack
cost, reach, weight and price across equipped slots, storage and campaign returns.
Its family selects the existing melee techniques; technique authoring is separate.
Older content without a blade assignment retains the original character loadout.
Enemy roles and militia ranks can select primary weapons and secondary blades
independently. Only newly issued soldiers receive those selections; retained
soldiers keep their actual gear. A blade primary receives no firearm cartridges
or priming powder. An unspecified secondary selection retains the role default.
Merchant stock, prices, buyback and replenishment are authored
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

The authored supply rules set initial treasury and cartridge allotments for each
player firearm deployment, new enemy and new militiaman. Defaults remain 3200
pesos and 10/13/6 cartridges. Initial funds are delivered once; loading a save
never restores them. Each player cartridge costs one peso under the existing
return/refund rules. Zero is valid. Capacity caps the loaded portion and the rest
remains in reserve. Blade primaries receive none. Existing troops retain spent
supplies; mission allies keep their separate allotments. Broader care, priming,
progression and economy rules remain separate authoring requirements.

Each catalogued character can author an initial allocation of priming, flints,
rations, torches, dressings and boleadoras (integer 0–1000 for each). The campaign
seeds it once; bulletin arrival or local incorporation receives the actual saved
amounts. Consumption, reload, renewal and rehire cannot grant another allocation.
Older packages retain the original 50/4/2/2/2/1 defaults. This is separate from paid
cartridge deployment and workshop refill targets. Civilian lootable belongings,
item custody and the player-created officer's own allocation remain separate work.

Each catalogued character can also author its living initial physical condition:
health, energy, fatigue, bleeding and bandaged wounds. The optional complete group
is validated against maximum health and assigned once at campaign creation.
Arrival and local recruitment retain it; later treatment, rest, service changes
and saved continuation retain the mutable condition instead of reapplying the
initial values. Omission preserves the original healthy defaults. This is not
initial death/capture authoring or unloaded civilian bleeding. A resident with
zero energy cannot converse; civilian breath recovery remains separate work.

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
A dialogue can end the commanded meeting and return that resident to its routine,
including the speaker itself. Release and optional quest/money changes are atomic.
A consumed release cannot cancel a later distinct meeting. Save/re-entry preserves
the released state; ordinary danger and conversation pauses still control motion.
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

### Personal supply conditions

Dialogue choices, authored chapters and campaign failure may require a named
character to retain an inclusive supply quantity range. Current tactical stock
overrides the deployed service snapshot; absent tactical state is unknown, not
empty. The check does not grant or consume goods and does not imply life, presence
or service. Existing six personal supplies share this rule. Arbitrary inventory
and dialogue transfers remain separate work. See the
[verification record](../verification/story-supply-conditions.md).
