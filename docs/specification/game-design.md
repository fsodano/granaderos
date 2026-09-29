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

Residents with a character sheet carry the four current personal supply quantities
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

Observed automatic turns must show movement through the visible cells and attack
preparation before the resulting injury. The interface must not replace the
whole enemy turn with one final set of positions. An actor first seen inside the
field starts at its observed cell; its unseen approach remains private. Walking
cycles continue across consecutive cells. Input waits for the visible sequence,
and the campaign stores the authoritative result once, without saving transient
animation frames. See [the bounded implementation record](../verification/visible-enemy-turns.md).

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
and needs no separate ignition supplies. An unspecified secondary selection retains the role default.
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
supplies; mission allies keep their separate allotments. Broader care,
progression and economy rules remain separate authoring requirements.

Each catalogued character can author an initial allocation of rations, torches,
dressings and boleadoras (integer 0–1000 for each). The campaign
seeds it once; bulletin arrival or local incorporation receives the actual saved
amounts. Consumption, reload, renewal and rehire cannot grant another allocation.
Older packages retain the four remaining 2/2/2/1 defaults. Ignition kit is implicit. This is separate from paid
cartridge deployment and workshop refill targets. Civilian lootable belongings,
item custody and the player-created officer's own allocation remain separate work.

Each catalogued character can also author its living initial physical condition:
health, energy, fatigue, bleeding and bandaged wounds. The optional complete group
is validated against maximum health and assigned once at campaign creation.
Arrival and local recruitment retain it; later treatment, rest, service changes
and saved continuation retain the mutable condition instead of reapplying the
initial values. Omission preserves the original healthy defaults. This is not
initial death/capture authoring. A resident with zero energy cannot converse;
loaded phases restore breath under the civilian recovery rule. Civilian wounds advance from actual world appearance, including residents not
yet encountered, as described below.

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
or service. The four current personal supplies share this rule. Arbitrary inventory
and dialogue transfers remain separate work. See the
[verification record](../verification/story-supply-conditions.md).

### Partial firearm loading

An authored firearm's reload cost can span turns. Each order pays available work;
only completed charges consume reserve cartridges. Unfinished work belongs to
the specific gun through active saves, swaps, storage and recovery. Exploration
pays elapsed time and preserves partial work when contact or incapacity interrupts
it. Controls preview the current cost and remaining work using the same plan.
Artillery and full strategic ammunition custody are separate integration steps.
See the [verification record](../verification/partial-firearm-reloads.md).

### Authored firearm preparation

The authored first-shot AP total includes its optional preparation component.
A later shot from the retained firing position pays discharge and aim only.
Physical handling and incapacity lower the weapon; accepted shots establish the
position after payment, including failed ignition. Readiness belongs to the
actor and active scene, not to an inventory gun or a fresh deployment. Zero is
the existing default and remains the fallback for unconfigured older weapons.
See the [bounded acceptance record](../verification/authored-weapon-readiness.md);
directional turning and independent hands remain separate requirements.

### Authored cartridge price

A campaign can pin an optional shared cartridge unit price. An absent value
preserves one peso and older content identities. Deployment payment and finite
return credit use the same price while issued, held and returned cartridges
remain quantities. Actual spent/lost rounds are not refunded, and a settled
request cannot be credited twice. Zero price is an authored economic choice.
The [verification record](../verification/authored-cartridge-price.md) separates
this price from ammunition types, merchant pricing and strategic custody.

### Civilian wound continuity

An authored resident starts its initial bleeding clock when it actually appears
in the world, even before the first encounter. Dormant successors wait until
appearance; a loaded-cell guard postpones both appearance and the wound clock.
Daily moves carry the same wound to the new cell; a later corpse stays there.
Bulletin candidates remain outside this civilian clock. Older saves start unseen
wounds from their saved condition and time without retroactive damage. See
[unseen-resident verification](../verification/unseen-resident-wounds.md).

A civilian wound retains its unfinished six-second interval while its
sector is closed. Campaign time and loaded tactical time each process their own
actors once. Reentry and saving cannot stop bleeding; finite aid can. Off-screen
death is recorded at its actual minute, with one set of consequences and the
original successor delay. Bodies and successors remain separate identities.
See the [bounded acceptance record](../verification/unloaded-civilian-bleeding.md).
Strategic civilian care and off-screen recovery remain separate requirements.
Military service wounds use the hourly rule below.

### Return from military service

A known world resident leaving service resumes its current physical condition and
remaining personal supplies before its next civilian encounter. Its old civilian
cache cannot heal a service wound or restore an injury already treated. Placement
still controls its next appearance, and active scenes do not gain a duplicate.
Dead service actors remain military bodies. See the
[bounded verification](../verification/civilian-service-return.md) for legacy
conversion and the separate military-clock and custody requirements.

### Military wounds outside deployment

Untreated service wounds consume configured health at campaign hour boundaries
after local physician work. Waiting, travel and other-squad time share this
rule; deployed, arriving and out-of-service people do not receive a second clock.
The editor pins an optional percentage (default 25; zero disables it). Death
removes the person from marching squads without reviving or replenishing it.
A squad with no survivors stops at its last reached location. See the
[verification record](../verification/strategic-military-wounds.md) for the hourly
boundary and the remaining fractional-time, custody and strategic-remains scope.

### Local militia physicians

A serving physician can be assigned to existing local militia instead of the
recruited patients. Each effective hour spends one personal dressing using the
pinned care rates. Bleeding takes priority and each soldier is treated at most
once that hour. The loaded scene owns deployed garrison health. Treatment keeps
identity and finite equipment through saved reentry; it cannot recreate a
casualty. See the [bounded verification](../verification/strategic-militia-care.md)
for the separate unloaded-militia wound clock and custody requirements.

### Individual militia promotion

The campaign offers an explicit choice between three fresh cívicos and
promotion of three existing fit cívicos to montoneros. The selected quote shows
actual cost and duration; missing funds, space, supply or participants block
payment with a reason. See [course controls](../verification/militia-course-choice.md).
New paid promotion courses reserve the actual participants. Completion
changes their rank and training attributes without replacing their health,
weapons or finite supplies. Cancellation or instructor departure returns them
at the previous rank. Saved identities remain separate from a deployed garrison,
even if the course completes while another squad is inside the sector. Older
count-only courses and already-paid veteran courses retain their earlier contract. See the
[verification and compatibility limits](../verification/militia-training-identities.md).

### Militia wounds outside the active scene

Retained militia share the authored hourly bleeding rate after local physician
work. Actually deployed defenders use only their tactical clock. A separate mission
scene leaves the town garrison and its physician on their strategic clocks. A death reduces the
existing rank count once and retains the actual corpse and finite possessions
in the known saved scene. Older records without a scene cannot establish a body
position. See [wound and remains verification](../verification/unloaded-militia-wounds.md)
for real travel, remote tactical time, collection, saves and compatibility limits.

### Combat-earned militia rank

Surviving militia gain one rank on return when new combat credit reaches the
next threshold. A first eligible wound earns one point; an eligible kill upgrades
that opponent receipt to three. Stable opponent identities prevent repeated
credit across saved encounters. Civilians, allies and already helpless opponents
grant none. Thresholds default to two and five as Granaderos tuning. The editor can author
ordered cumulative thresholds and per-rank attribute gains, pinned to each new
campaign. Zero gains keep the current effective attribute.
New instruction can create cívicos or promote them to montoneros; veteran rank
requires combat. Promotion preserves the actual wounded soldier and finite
belongings. See [bounded combat verification](../verification/militia-combat-progression.md)
for prior paid-course compatibility and the separate allied-AI scope. See also
[authored promotion verification](../verification/authored-militia-progression.md).

### Autonomous local defenders

Local militia fight under automatic control, using their own remaining action
points and finite authored equipment. They act after enemies in a normal round,
or after the player's response in enemy-first contact. Reactions spend the same
budget; no extra points are issued for their phase. The squad and temporary
mission allies retain manual control. Garrison cards report status, and squad
members can still treat wounded defenders. Saved return retains identity, wounds,
casualties, supplies and combat credit. See [bounded combat and control checks](../verification/autonomous-militia-combat.md)
for the separate patrol, redistribution, artillery and advanced-AI requirements.

### Local militia exploration

During exploration, local militia follow fixed map waypoints with one legal step
per six-second ambient tick. The step spends energy and lowers a prepared gun,
without spending AP or refilling any supply. A tired defender rests to preserve
an authored energy reserve (50 by default). Actual sight contact stops the patrol and starts the existing
combat initiative. Pausing or hiding the game stops ambient time. Complete saved
continuation preserves patrol cadence and synchronized campaign time. The same
waypoints support paid movement after lost combat contact. See [verification](../verification/militia-exploration-patrols.md)
for prepared boundaries, real paid-garrison acceptance and remaining scope.

### City militia distribution

Manual rank/quantity transfers and a previewed automatic plan distribute militia
inside connected controlled sectors of the existing city area. Transfers preserve
actual people, wounds, earned ranks and finite equipment without advancing time
or charging money. Patients and trainees reserve capacity; each sector admits
60 defenders including instruction. A count-only cohort receives its authored
included kit once. Invalid or occupied routes and active deployments reject
atomically. Transferred people enter from their final city approach on connected
exterior ground; large groups can spread inward. Old source scenes cannot restore
the transferred people. These city boundaries, limits and approaches remain fixed
rules. See [verification](../verification/city-militia-distribution.md) for scope,
prepared boundaries and actual paid/wounded campaign sequences.

### Authored patrol settings

Optional campaign content controls militia patrol/search activity, intervals per
fixed waypoint, exploration energy reserve and rest recovery. Defaults retain
the existing behavior; older package identities do not gain a new field. New
deployments and saved tactical scenes carry the pinned campaign choice. Disabled
patrols retain combat and reactions. Strict report and save checks reject rule
drift. Fixed waypoint coordinates and combat search costs remain separate. See
[verification](../verification/authored-militia-patrols.md).

### Explicit battery choice

The effective automatic or named battery appears in the armory. Preparing three
empty slots records an explicit no-artillery choice; saves and later purchases
retain it. A subsequent valid named choice selects only the available quantities
of those actual models. An explicit empty tactical manifest cannot fall back to
a stock count. Selection spends no money, time or stock. See
[verification](../verification/explicit-artillery-selection.md) for actual paid
attack entry and the separate stationed-artillery integration.

### Physical artillery emplacements

New attack batteries consume unissued stock once. Each cannon then retains its
identity, model, position, facing, loaded shot and finite reserve in its sector.
Victory captures the pieces; withdrawal leaves them to surviving occupants.
Reentry and saved continuation do not refill or recreate them. Reports and saves
reject duplicate or missing pieces and ammunition increases. The armory shows
resident ownership and load separately from the next attack's stock selection.
Friendly stationed pieces count toward the historical army requirement. Legacy
stock projections migrate once, prioritizing the active battery and then the
latest retained scenes. [Verification and limits](../verification/stationed-artillery.md)
distinguish actual combat from prepared migration and separate-scene boundaries.

### Retained artillery crew work

Each cannon keeps unfinished loading across turns, replacement crews and saves.
All required artillerists pay the same step, limited by the least available
assigned AP. A completed load consumes one reserve shot. Authored specialist
modifiers affect remaining work. Shared crew checks govern controls and execution;
hired actors cannot commandeer militia AP. Peaceful work advances one simultaneous
duration without spending combat AP. See [verification](../verification/artillery-crew-loading.md)
for prepared tactical boundaries and actual paid-gun continuation.

### Authored artillery replenishment

An exact local friendly emplacement can receive one purchased reserve round in
a controlled, connected, cleared sector with an available squad. Payment uses
pesos and preserves position, identity, current load and unfinished work. The
story editor pins the permission, three model prices and purchase reserve limit.
The default prices are 20/30/10 pesos for four-pounder/eight-pounder/swivel rounds,
with a six-round limit; these are game tuning. A lower limit preserves existing
rounds and the initial purchased bundle. Old packages keep their identity. See
[verification](../verification/authored-artillery-supply.md) for paid depletion,
reload and saved UI continuation, and for prepared eligibility boundaries.


### Autonomous local artillery crews

Nearby capable enemies and militia use their own control-group crew, real AP,
finite shots and retained loading work. Short approaches and paid stance changes
assemble the local crew; adjacent operators wait for helpers. A close threat
returns them to ordinary combat. Quiet posts retain only their needed crew, and
depleted pieces release it. Shared enemy budgets are issued before any cannon
work, preventing a helper from receiving a second issue at its individual slot.
Visible-target selection and execution share penetrating and canister traces,
with known-friendly and visible-civilian checks. Hired soldiers retain manual
control. [Verification](../verification/autonomous-artillery-crews.md) separates
real paid-gun/cohort continuation from prepared geometry. Strategic transport,
gun authoring, remote assembly and advanced AI remain separate.


### Authored artillery models

The editor can change the three existing artillery families' names, images,
prices, crew sizes, action costs, range, damage, penetration, canister scale and
initial ammunition. Campaigns pin optional model definitions. Purchases and
physical deployment use those values once; later visits preserve actual load
and reserves. Shared player, enemy and militia rules consume the same profile.
Scene saves reference the pinned package to avoid repeated uploaded images;
inline definitions and references reject mismatches. See
[verification](../verification/authored-artillery-profiles.md) for field limits,
actual paid use and the separate transport/trade scope.


### Finite artillery transport and depots

A local friendly emplacement can travel by an organized cart or coastal flotilla
route with sufficient local crew. The armory quotes the actual eligibility and
arrival time. Dispatch, shipment, depot and subsequent attack carry one exact
piece with its remaining load, reserves and unfinished work. Local depot choices
refer to that identity. No new ammunition or generic gun appears on delivery.
Control loss, blockade, enemies at the destination or full storage delays arrival.
An occupied depot cannot supply a friendly battery. Default rates are
18 hours per cart link and five per flotilla link, with no dispatch fee after
organizing the network. Campaigns can now author these rates and dispatch fees. Mountain crossings by assembled guns, arbitrary-cell
routes, bulk capacity and convoy combat remain outside this delivery. See
[verification and prepared boundaries](../verification/finite-artillery-transport.md).


### Authored artillery transport

The story editor pins permission, hours per link and one dispatch fee for each
cart/flotilla mode. Defaults retain 18/5-hour links and free dispatch after network
organization. Fees are paid once; an interrupted route delays the same saved gun
without another charge. Invalid rates or schedules are rejected. The armory
shares the actual quote and insufficient-funds reason. Crew and geographical
restrictions remain in force. See [verification](../verification/authored-artillery-transport.md).


### Finite local artillery trading

A controlled supplied workshop buys local emplacements, depot pieces or one
unissued armory gun. Emplacements require their full available crew. Sales and
repurchases exchange finite pesos and one exact physical gun, retaining ammunition
and unfinished work. Each shop starts with 1,200 pesos, holds up to 100 guns and
keeps its balance and stock through saves. Default buying rates are 40% at Retiro
and other workshops, 30% in Córdoba and 50% in Mendoza; repurchase is 80%.
These are game tuning. Merchant-held guns do not count toward the army. Remote
sales, cash refresh, merchant authoring and equipment-wide
physical custody remain separate. [Verification](../verification/finite-artillery-trading.md).


### Forwarding depot artillery

A stored or repurchased piece can depart directly from its current local depot.
The same crew, route, fee, control and arrival rules used for field recovery
apply. The action explicitly selects field or depot custody and removes that
exact gun once. Full saves and later attack entry retain its finite load and
unfinished work. This permits returning a gun from headquarters to the front
without inventing an intermediate battle. [Verification](../verification/depot-artillery-transport.md).


### Authored artillery commerce

Campaigns can pin workshop starting cash, trade permission, general buying and
repurchase percentages and named-locality buying overrides. A shop's configured
cash is issued once and then preserved through transactions and saves. Zero rates
allow free transfers; a generous buying subsidy stops when the finite shop cash
cannot fund another offer. Integer-percent arithmetic gives exact peso rounding.
Editor overrides change prices at existing workshops and do not create new
facilities. The armory shows and executes the same actual rates. See
[verification](../verification/authored-artillery-trading.md).

### Finite secondary recovery

The ordinary body collection includes a soldier's actual secondary blade as
well as the primary weapon, supplies and stored items. The blade keeps its
pinned name, image, values and wear. It moves once into the collector's carried
inventory; the body or unconscious owner retains an empty secondary slot.
Equipping it stores the displaced weapon without recreating either piece.
Saved tactical return, later entry and surviving militia storage preserve the
empty slot. A later armory purchase provides a new piece through the normal paid
path. This does not add civilian weapons, stealth theft, armour, fitting rules
or complete inventory custody. See [secondary recovery](../verification/secondary-weapon-recovery.md).


### Leave recovered weapons on the field

A recovered firearm or blade can move from the backpack to the current cell,
one piece per order. The action costs four combat AP or one exploration second.
The normal collection control can recover a loose piece underneath a soldier.
Each piece keeps its authored definition, image, weight, wear, load and partial
reload through saves and sector return. Collection preserves other carried
pieces even when fields have overlapping local indices. The selected held
primary or secondary can also be left with the same cost and preservation rules.
Personal supplies use their exact-bundle controls. Throwing and full pocket
organization remain separate. See
[verification](../verification/drop-recovered-weapons.md).


### Hand recovered weapons to a companion

Stored recovered weapons can move directly to an adjacent conscious squad
member. Each order transfers one exact piece, costs the sender four combat AP
or one exploration second, and preserves the recipient's other equipment.
Walls, furniture and closed diagonal corners block handover. Authored identity,
image and mechanism follow the piece through saves and later sector entry.
The inventory shows actual eligibility before sending the order. Broader item
transfers, relays and throwing remain separate. See
[verification](../verification/adjacent-weapon-transfer.md).


### Empty hands and selected weapons

The inventory selects the primary, secondary or empty hands. Putting a weapon
away costs four combat AP or one exploration second and retains its actual
weight, load and mechanism. Saved active battles retain the selected mode.
Removing the primary weapon leaves any actual secondary available. Empty hands
use punches, with a twelve-AP attack, condition/attribute-dependent hit chance,
small injury and separate breath loss. Unconscious soldiers can provide only
their real remaining equipment. Empty hands cannot brace or execute a weapon
charge, and do not add weapon weight. Normal civilian consequences and injury
rules still apply. Physical fittings remain separate. Held firearms now use the stock behavior described below. See [verification](../verification/empty-hand-melee.md).


### Leave the held weapon

Primary and secondary hand slots can relinquish their actual piece to the
current field cell for four AP or one exploration second. Selecting an emptied
hand leaves fists; an inactive hand can be emptied without hiding the other
selected weapon. Mechanism and authored identity follow the actual piece.
Packed loaded charges and legacy secondary blades contribute their real carried
weight. Campaign loose-cartridge refunds remain separate from the charge kept
inside a grounded weapon. See [verification](../verification/drop-held-weapons.md).


### Give a held weapon directly

The selected primary or secondary can move directly into an adjacent conscious
companion's pack for four sender AP or one exploration second. It uses the same
obstacle and eligibility checks as stored-weapon handover. Emptying the selected
hand leaves fists; the recipient retains its own equipment and can equip the
received piece normally. Authored identity and mechanism survive saved campaign
return. The supply controls handle personal allocations; remote delivery remains
separate. See
[verification](../verification/held-weapon-transfer.md).


### Exact personal supply handover

An adjacent conscious squad member can receive an exact whole quantity of
compatible ammunition, rations, torches, dressings or bolas. The sender pays four AP
or one exploration second, and the recipient pays no action points. Supplies
move once between their actual holders; subsequent use and saved campaign return
retain the remainders. Invalid or unavailable quantities fail in full before
costs. Loose cartridges use the same handover controls with shared witnessed
settlement; physical pocket capacity remains separate. See
[verification](../verification/adjacent-supply-transfer.md).


### Ground supply bundles

An exact quantity of ammunition or the four authored personal supplies can move to the current
cell for four AP or one exploration second. The field picker chooses a bundle
and quantity with the ordinary eight-AP or one-second collection action. Another adjacent soldier can
collect it even while the owner occupies that cell. Source, ground and receiver
retain finite quantities across save and campaign reentry. Numerical limits
reject overflowing collection atomically; the selected quantity can be reduced.
Shared physical pocket capacity limits both dropping and collection. See
[verification](../verification/drop-personal-supplies.md).


### Shared deployment cartridge settlement

Loose cartridge reserves can move between adjacent conscious squad members
without moving either gun's loaded charge. Active saves and carried mass follow
the actual holders. A witnessed retreat report refunds the shared surviving
force total, capped by issued and actually recovered cartridges. Legacy reports
without a matching tactical holder keep their individual ceilings. The campaign
still issues and refunds deployment cartridges; independent physical custody
between deployments and typed rounds remain separate. See
[verification](../verification/adjacent-cartridge-transfer.md).


### Exact ground supply selection

Nearby loose personal supply bundles expose a field selector for one actual
bundle and exact whole quantity. Confirmation costs eight AP or one exploration
second and retains untouched stock. Choosing or canceling has no cost and pauses
the ambient exploration interval. Shared current eligibility handles obstacles,
AP, stock and receiving numeric bounds, so an excessive whole bundle can be
reduced to an accepted partial selection. Body/container inventories, batch
pickup and physical pockets remain separate. See
[verification](../verification/partial-ground-supply-pickup.md).


### Residents over loose equipment

Collection through a resident's figure uses loose-ground priority, matching the
cell and soldier controls. It can recover a dropped weapon or open the personal
supply picker without searching the resident. With no free item remaining, the
existing unconscious-resident supply action remains available. Held and container
records are excluded from loose stock. See
[verification](../verification/occupied-ground-collection.md).


### Close strikes with a held firearm

The normal melee order uses the selected firearm's stock at short contact range.
Its default profile is 16 AP, 18 base injury and 1.5-cell reach. It preserves the
same gun, loaded cartridges, reserves, partial reload, jam and wear. Existing
momentum, parries, counters and injury rules apply. The gun does not provide an
unowned bayonet. To charge or brace, select an actual suitable blade. Physical
fittings and separate stock accuracy/breath calculations remain open. See
[verification](../verification/held-firearm-buttstock.md).

### Authored stock profile

Each firearm can override stock AP, base injury and contact reach independently
in the normal story weapon editor. Omitted values use 16 AP, 18 injury and
1.5-cell reach without changing older pinned weapon definitions. AP and injury
are integers from 1 to 100; reach is between 1 and 1.5 cells. Blades reject these
fields. Undo, validation, launch, weapon custody and full saves retain the authored
profile. This extends stock contact configuration; physical fittings and separate
stock accuracy/breath rules remain open. See
[verification](../verification/authored-firearm-melee.md).


### Ammunition families and implicit ignition kit

User decision, 29 September 2026: do not track priming charges or flints as
inventory supplies. Assume each soldier has the kit needed to ignite and maintain
their firearm. Keep misfires, condition and action/time costs. This decision
supersedes older separate-kit requirements in the historical notes.

Use separate musket, rifle, pistol and shot ammunition, each with its own image
and stack. A firearm consumes only its compatible family. Keep existing ammunition
when a weapon changes; never convert incompatible reserves. Old saves migrate
carried generic rounds according to the primary weapon. Ground bundles keep their
family, quantity and identity through saved visits. Under the existing paid issue
and refund rules, only recovered stock from an earlier bundle can increase the
return allowance; dropping and picking up a new bundle cannot mint credit. See the bounded
[implementation and verification](../verification/typed-ammunition.md).

### Authored firearm ammunition family

Each firearm may select one of the four compatible ammunition families. Omitted
selection follows the original firearm template. The chosen family belongs to the
pinned weapon definition and survives issue, reload, drops, collection and saves.
Changing guns never converts the owner's reserve. Blades cannot select ammunition.
This is one family per firearm; alternative loads and new family definitions
remain separate requirements. See [verification](../verification/authored-ammunition-family.md).
