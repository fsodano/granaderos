# Ubiquitous language

Status: accepted naming contract for the target architecture.

Decision date: 27 October 2026.

[Architecture plan](domain-architecture.md) · [Plan index](../README.md)

## Purpose

Use one term for each domain concept across classes, methods, requests, results,
repositories, tests, documentation, and player-facing translations. A term must
have a defined meaning and lifecycle. Similar names must indicate similar roles.

Code uses English. Player-facing text uses a consistent Spanish translation.
The table gives terminology, not a requirement to display technical session
names to players.

## Canonical terms

| Term | Meaning and ownership | Spanish term |
| --- | --- | --- |
| `Character` | A person with one persistent identity, health, abilities, and life status across the world. Recruitment or death does not create another identity. | Personaje |
| `CharacterAbilities` | The character's immutable ability value: validated ratings, traits, and named capabilities. It applies earned training and answers proficiency checks. Restoration derives it from the pinned definition and current progress; recruitment candidates reference the same value. | Aptitudes del personaje |
| `CharacterRating` | A numeric ability rating from 0 to 100, such as marksmanship or medical skill. Maximum health belongs to `Health`. | Atributo |
| `CharacterTrait` | A named specialty in the character's definition, such as expert riding or teaching. It remains part of the character's ability value across service and visits. | Especialidad |
| `CharacterCapability` | A named rule capability in the character's definition. The compatibility field `abilities` stores these identifiers; it does not store numeric ratings or mutable progress. | Habilidad |
| `RecruitmentCandidate` | A role of a character who can be evaluated for recruitment. | Candidato al reclutamiento |
| `Combatant` | A role of a character serving in a force. Allegiance and player control are explicit properties. | Combatiente |
| `RecruitCombatant` | Admit an eligible candidate into the player's force with immediate control, valid placement, and applicable service terms. | Reclutar |
| `RenewServiceContract` | Extend paid service from its exact existing expiry or the current game time, whichever is later, and charge once. | Renovar contrato |
| `ServiceRenewalService` | Coordinate renewal across the character, service contract, treasury, and accepted time. | Reglas de renovación |
| `ServiceContract` | The person's service terms, including any pay, start, renewal, and termination. | Contrato de servicio |
| `Squad` | A group of at most six combatants at one strategic location. Membership cannot change during a journey or an open sector visit. | Escuadra |
| `FormSquad` | Form or reorganize a squad from available combatants at the same location in one transaction. | Formar escuadra |
| `SquadFormationService` | Validate shared membership and move selected combatants between squads without changing their physical location. | Reglas de formación |
| `RecruitmentCatalogue` | A read-only collection of recruitment candidates with explicit availability, specialty, and ordering rules. | Lista de reclutamiento |
| `GetRecruitmentCandidates` | Read the filtered recruitment catalogue without changing time, funds, or service. | Consultar candidatos |
| `Journey` | Strategic movement along a route, with actual position, elapsed progress, destination, and movement purpose. | Viaje |
| `JourneyPurpose.Withdrawal` | A journey moving away from a hostile arrival. It remains eligible for redirection. | Retirada |
| `RedirectJourney` | Replace the intended route from the squad's actual position while preserving completed travel and costs. | Cambiar destino |
| `ArrivalDecision` | A required fight-or-withdraw choice when a squad reaches a hostile entry boundary. Campaign time pauses until it is resolved. | Decisión al llegar |
| `FightOnArrival` | Resolve an arrival decision by committing to sector entry and deployment. | Combatir |
| `WithdrawOnArrival` | Resolve an arrival decision by starting a withdrawal journey. | Retirarse |
| `Sector` | A persistent world location that owns environment bounds and current character, corpse, and object references. Admission, movement, and removal preserve identity and item custody. Character health and inventory retain their canonical owners. | Sector |
| `EnterSector` | The application use case that admits a valid sector-entry request and opens the sector visit. | Entrar al sector |
| `SectorEntryRequest` | Input to `EnterSector`. It identifies the sector, participants, and required entry authority. It is not an active visit. | Solicitud de entrada al sector |
| `SectorSession` | The active visit to one sector, including deployment, exploration, and any combat sessions. | Sesión de sector |
| `CombatSession` | A bounded episode of combat inside a sector session. It owns turn authority, AP, reactions, and the combat result. | Sesión de combate |
| `Deployment` | Placement of the authorized participants in valid entry positions. | Despliegue |
| `SectorParticipant` | A reference to a character participating in a sector session, with local position, stance, and other session-specific state. Persistent health and inventory retain their canonical owners. | Participante en el sector |
| `ExecuteSectorOrder` | Apply a player order inside the current sector visit through a bounded transaction. Preserve accepted partial work if world time reaches an arrival decision. | Dar una orden |
| `EndSectorTurn` | Yield current combat authority or spend a bounded rest interval during exploration. | Terminar turno / descansar |
| `ResumeSectorOperation` | Continue unfinished work inside the current visit from its accepted checkpoint. It does not activate another sector visit. | Continuar orden |
| `AdmitSectorReinforcements` | Admit newly arriving participants into an open sector visit with legal entry positions and fresh entry budgets only for those participants. | Incorporar refuerzos |
| `SectorDeployment` | Own the legal entry cells and exclusive participant placements until deployment is confirmed. | Despliegue del sector |
| `SectorTimeBudget` | Bound sector progression by the next campaign-time boundary. Reject an atomic effect that needs more time than remains. | Tiempo disponible |
| `SectorOperation` | Own accepted checkpoints and the unfinished intention for one sector operation. | Orden del sector |
| `SectorOperationContext` | Bind an operation and its result to the game session, sector visit, both revisions, and request identity. | Contexto de la orden |
| `ActionPoints` | A participant budget that refuses overspending and bounds unused carry into the next turn. | Puntos de acción |
| `ActionPointPolicy` | Derive a participant turn budget from health, energy, fatigue, environment, and protection. | Reglas de puntos de acción |
| `CombatTurn` | Own automatic participant order, bounded actions, and one-time budget issuance inside a combat phase. | Turno de combate |
| `ReactionPolicy` | Select eligible reactions from actual prior observations, initiative, remaining AP, and reaction history. | Reglas de reacción |
| `ReactionWindow` | Own the actors and automatic-action limits of an interrupt without granting new AP. | Interrupción |
| `ReactionStack` | Retain nested reaction progress and restore the exact parent authority after each reaction finishes. | Secuencia de interrupciones |
| `Firearm` | Own physical loaded charges, condition, and ignition failure for one firearm. | Arma de fuego |
| `IgnitionPolicy` | Calculate the chance of failed ignition from condition, weather, and reliability. | Reglas de encendido |
| `ReloadWork` | Preserve fractional loading progress and consume reserve ammunition only when a charge completes. | Trabajo de recarga |
| `ReprimeWork` | Admit complete ignition-pan work only when the current action budget can pay it. | Trabajo de cebado |
| `FirearmAccuracy` | Calculate shot accuracy from explicit actor, target, range, and environment inputs. | Precisión del disparo |
| `BodyRegion` | Own the accuracy and physical-injury modifiers for a targeted body region. | Zona del cuerpo |
| `CombatInjury` | Apply physical impact to the shared health owner and derive breath, balance, shock, and morale effects. | Herida de combate |
| `MeleeExchange` | Own parry and counterattack costs and damage modifiers within one melee exchange. | Intercambio cuerpo a cuerpo |
| `CombatOutcomePolicy` | Determine whether either side can remain on the field, including recoverable exhausted participants. | Resultado del combate |
| `RetreatFromCombat` | Leave an active combat session through its permitted retreat and exit rules. | Retirarse del combate |
| `GameSession` | The runtime consistency boundary for campaign progress, the active sector session, and shared identities. It coordinates commits without containing every game rule. | Partida en curso |
| `GameSnapshot` | A versioned representation of the game model for persistence and worker transport. | Estado guardado de la partida |
| `GameUnitOfWork` | Shared transaction mechanism that commits one use case's accepted changes together and rejects a stale revision. | Transacción de la partida |
| `GameSnapshotMapper` | Converts domain objects and their identity relationships to and from a versioned game snapshot. Restoration does not repeat creation effects. | Conversión del estado guardado |
| `Item` | An identified equipment instance or quantity-bearing stack, with its properties and condition. | Objeto |
| `Inventory` | A capacity-constrained holder of items. It protects valid quantities and placement within its scope. | Inventario |
| `ItemCustody` | The authoritative holder or location of an item: inventory, container, ground, or corpse. | Posesión o ubicación del objeto |
| `PocketLayout` | Personal inventory pocket allocation and exchange rules. Existing overfull inventories can still release items. | Distribución del inventario |
| `TransferItem` | Admit an atomic change of item custody through the use-case-specific repository. | Transferir objeto |
| `VisionObserver` | The character condition and posture that determine visual perception. | Observador |
| `FieldOfView` | Facing and angular limits for an observer's visual field. | Campo de visión |
| `VisibilityPolicy` | Range, posture, and environmental visibility rules. | Reglas de visibilidad |
| `IlluminationPolicy` | Ambient and local light contribution to visibility. | Reglas de iluminación |
| `GetVisibleCharacters` | Read characters visible to the observer without advancing time. | Consultar personajes visibles |
| `KnownSectorPolicy` | Limit observations and forecasts to sector facts the player can know. | Información conocida del sector |
| `ItemTransferService` | Coordinates an allowed change of item custody and capacity at both ends within one transaction. | Transferencia de objetos |
| `Treasury` | Owns the force's funds and valid financial operations. | Tesorería |
| `RecruitmentService` | Applies recruitment rules across character, contract, treasury, force membership, and placement within the caller's transaction. | Reglas de reclutamiento |
| `Corpse` | Physical remains linked to a dead character, with a removal lifecycle independent of death history. | Cuerpo |
| `WorldTimeline` | The monotonic game clock and deterministic scheduling of world changes. | Tiempo de campaña |
| `CampaignDefinition` | Immutable published campaign documents admitted by shared file schemas and reference checks. The game compiler adds runtime playability and supported-rule validation. | Definición de campaña |
| `CampaignPackage` | The portable published files and resources that encode a campaign definition. | Paquete de campaña |
| `CampaignProject` | An editable campaign-editor draft with project state, resources, and editing history. It can be incomplete. | Proyecto de campaña |
| `Health` | The character's current and maximum health, bleeding, and bandaged wounds. Injury and elapsed bleeding update the same owner. | Salud |
| `CreateGameSession` | Create a new game with a new stable session identity and initial domain state. | Nueva campaña |
| `RestoreGame` | Validate and restore a saved game and its domain relationships without repeating creation effects. | Recuperar partida |
| `SaveGame` | Persist an accepted versioned snapshot and report storage success or failure. | Guardar partida |
| `GetSaveStatus` | Read accepted and persisted revisions and the current storage status. | Estado del guardado |
| `CampaignProjectDocument` | The serialized editor draft envelope, including draft data and resources. | Archivo del proyecto |
| `GameTime` | An immutable accepted instant in game seconds. It validates clock values and derives hour and second fields. | Tiempo de juego |
| `Money` | An immutable nonnegative integer amount in pesos. It protects currency arithmetic. | Pesos |
| `ForceRoster` | Player force membership and active squad capacity and location. Recruitment into reserve remains player controlled. | Nómina de la fuerza |
| `ServicePricingPolicy` | Authored pay rules, experience increases, and currency rounding for service terms. | Reglas de paga |
| `ResumeSectorSession` | Activate an existing sector visit and preserve the current visit for later continuation. | Volver al sector |
| `ResidentRoutine` | The shared six-second resident behavior schedule in visible, retained, and suspended sectors. | Rutina del habitante |
| `ResidentSupplies` | Finite personal supply quantities owned by one resident. | Suministros del habitante |
| `GroundSupply` | A finite unattended supply quantity at a sector position. | Suministro en el suelo |
| `ScavengingPolicy` | Eligibility, interval, adjacency, and quantity rules for resident collection of unattended supplies. | Reglas de recolección |
| `CollectResidentSupply` | Transfer an eligible ground supply to one resident exactly once. | Recoger suministro |
| `TalkToCharacter` | Resolve a conversation with a present character and project its accepted effects in the same transaction. | Conversar |
| `CampaignProjectHistory` | Admitted editor project snapshots and undo/redo position. | Historial del proyecto |
| `EditCampaignProject` | Validate and admit a project editing operation and record its undo state. | Editar proyecto |
| `ValidateCampaignProject` | Inspect an editor project and report structural and publication problems without changing it. | Validar proyecto |
| `UndoCampaignProjectEdit` | Restore the previous admitted project snapshot through the editing repository. | Deshacer cambio del proyecto |
| `RedoCampaignProjectEdit` | Restore the next retained project snapshot through the editing repository. | Rehacer cambio del proyecto |
| `CampaignWorld` | The editor-owned world draft and its linked locality, district, place, road and reference invariants. | Mundo de la campaña |
| `CampaignMap` | A fixed-size map slot inside an editable campaign project; it admits a sector map with the slot's identity and dimensions. | Mapa de campaña |
| `SectorMap` | An editable physical map document with terrain, buildings, objects and revision-controlled authoring behavior. | Plano del sector |
| `SectorMapHistory` | Owned sector map snapshots and the current undo/redo position. | Historial del plano |
| `SectorMapCommand` | A typed editor intention inside an atomic map editing batch. The discriminant names the permitted map operation and determines its input fields. | Operación del plano |
| `CampaignRuleRefusal` | An infrastructure adapter for an expected retained campaign rule refusal. It preserves the typed domain code and keeps its detailed Spanish message outside the domain. | Orden rechazada |
| `CampaignEditorRefusal` | An expected editor rule or revision refusal with a stable code and structured details. The editor adapter translates the code into Spanish; schema validation retains explicit diagnostics. | Cambio rechazado |
| `EditSectorMap` | Admit one ordered sector map editing batch atomically at an expected revision. | Editar plano del sector |
| `CampaignContentSchema` | The shared file-contract owner for published character, equipment, placement, dialogue, objective, and campaign-setting records and references. It reports diagnostics without creating game progress. | Esquema de contenido de campaña |
| `campaign-format` | The shared package for campaign-file contracts, identifiers, structural validation, and conversion into campaign definitions. | Formato de campaña |
| `campaign-editor` | The independently packaged subsystem for editing, validating, testing, and exporting campaign projects. | Editor de campañas |

## Naming decisions

`SectorEntryRequest` and `SectorSession` share the sector concept. The request
describes an intention; the session describes the admitted, active visit.
`CombatSession` uses the same session suffix for the narrower combat lifecycle.
A sector visit can contain peaceful exploration and more than one combat episode.
Ending a combat session therefore does not necessarily end the sector session.
`SectorParticipant` names participation in the whole sector visit, including
exploration. A combat session refers to those same participant identities.

`Character`, `RecruitmentCandidate`, and `Combatant` describe identity and roles.
They do not imply separate copies of a person or an inheritance chain that must
replace the object whenever service changes. Use `RecruitCombatant` consistently
for the recruitment operation. Service payment belongs to `ServiceContract` and
the recruitment rules.

`WithdrawOnArrival` resolves a pending choice. `RedirectJourney` changes the
subsequent travel. `RetreatFromCombat` applies to an active combat session. These
names expose their different preconditions and physical consequences.

## Naming rules for implementation

- Name each use case after one domain intention. Use the same stem for its class,
  folder, request, response, repository, tests, and README. For example:
  `RecruitCombatantUseCase`, `RecruitCombatantRequest`,
  `RecruitCombatantResponse`, and `RecruitCombatantRepository` in
  `recruit-combatant/`.
- The canonical entry pair is `EnterSector` with `SectorEntryRequest`. This is
  an explicit grammatical exception: the use case names an action, and its
  request names sector entry. Use `EnterSectorUseCase`, `EnterSectorResponse`,
  and `EnterSectorRepository` in `enter-sector/`. The glossary must record any
  further exception with its reason before it is used.
- Give requests, active objects, results, and persisted representations distinct
  names. Do not infer a lifecycle from a vague variable such as `state`, `data`,
  `s`, or `next` when a domain name would be precise.
- Use named states and typed refusal codes. Boundary validation translates
  serialized values into domain types. UI adapters translate refusal codes into
  Spanish messages.
- Bind every domain value to a named value object, constant, or ruleset property
  when its meaning is not evident. External format keys belong to their format
  contract.
- Use one declared owner for each fact. Read models and session references must
  not become independent owners of character health, identity, or item custody.
- Use the same English concept and Spanish action across input routes. A button,
  shortcut, browser tool, and editor playtest that express the same intention
  must not acquire unrelated names or rules.

## Consistency procedure

Before introducing or renaming a concept, read this glossary and the affected
use-case contract. If a new term is required, define its scope, owner, lifecycle,
Spanish translation, and relationship to nearby terms here. Record the reason
for the distinction in the naming decisions section.

For each implementation slice, review all affected names together: public APIs,
requests/results, domain classes, repositories, test descriptions, UI copy,
documentation, save mappings, worker messages, and editor integration. Update
the relevant README and repository instructions if the rule itself changes.

Existing public and saved identifiers may remain at an explicit compatibility
boundary until migrated. Maintain a mapping and tests for them. Current-source
documentation must describe actual implementation accurately and link to this
target naming contract; it must not claim that a planned rename has shipped.

A naming review is complete when a first-time reader can identify each concept's
meaning and owner without knowing the conversation or an earlier implementation.

## Compatibility names

| Retained name | Canonical meaning and boundary |
| --- | --- |
| `pendingBattle` | Saved and compatibility request field for `SectorEntryRequest`. It can request a peaceful visit. |
| `battle` / `sectorState` | Existing serialized sector-view snapshot. Mapping restores `SectorSession` and its optional `CombatSession`; the field name does not imply active combat. |
| `recruitCivic` | Compatibility command alias for `recruitCombatant`, which executes `RecruitCombatantUseCase`. New callers use the canonical command. |
| `civicStatus` | Compatibility eligibility query used by recruitment adapters. It does not define a second category of recruit. |
| `beginAssault` | Compatibility resolution of the current hostile arrival decision. It cannot bypass the required decision or its identity. |
| `hiringArrivals` | Prepaid claims in supported older snapshots. Restoration admits them immediately at a legal site or preserves a refundable claim when no site is safe. New recruitment does not create a travel delay. |

These names remain at serialization and compatibility boundaries. Domain and
application contracts use the canonical vocabulary. Tests cover the command
aliases and save conversions.

## Editor map ownership

`SectorMap` is the authoring model for standalone and embedded map editors. It
exists while an author edits a physical map and produces an owned document.
`CampaignMap` is the campaign project's map slot: it checks a `SectorMap` document
against the campaign identity and fixed dimensions. This distinction permits
standalone map sizes without weakening campaign admission. Neither object owns
live characters, combat, or retained sector state; those belong to the game.
`CampaignWorld` owns the author's strategic world draft, not a live campaign.
Project and map histories end when the corresponding editing document closes.
Their undo/redo actions create accepted editing revisions without advancing game time.

## Package names and source paths

Canonical package names remain `game`, `campaign-editor`, and `campaign-format`.
Their repository paths are `packages/game`, `apps/campaign-editor`, and
`packages/campaign-format`. The player application is `apps/web`. Use the full
repository path when describing a source location. Use the canonical package or
domain name when describing responsibility.

`content/campaigns` holds published campaign packages. `content/assets` holds
source artwork and production recipes. These filesystem paths are distinct from
public URLs such as `/campaigns/`, `/campaign-editor/`, `/art/`, and `/models/`.
Browser URLs and domain vocabulary follow their own contracts.
