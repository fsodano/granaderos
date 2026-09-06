# Web Port Series 09 — Dialogue, Quests, and NPC Systems

> **Audience:** an agent with zero prior JA2 knowledge who must port engine behavior into the
> browser clone (`game/` + `web/`). This document maps the engine's **dialogue**, **quest**,
> **fact**, **NPC scripting**, and **email/briefing** systems onto the existing Granaderos web
> implementation, and proposes a JSON dialogue-runner schema plus a trigger graph for the port.
> Read-only analysis with `file:line` citations. No engine/game/web code is modified.

---

## 1. What the engine does (one paragraph)

JA2 v1.13 drives all narrative through a **fact/quest state machine** plus **per-NPC quote
records**. A `FACT_*` is a single boolean (or small integer) flag stored in a global array
(`gubFact[NUM_FACTS]`, `engine/Strategic/Quests.h:694`). A `QUEST_*` is a 3-state machine
(not-started / in-progress / done) stored in `gubQuest[MAX_QUESTS]` (`Quests.h:693`). NPC
dialogue is authored as **quote records** (`NPCQuoteInfo`, `engine/TacticalAI/NPC.h:79`) that
declare *conditions* (facts, quests, items, day range, approach) and *actions* (say a quote,
set a fact, start/end a quest, trigger another NPC, give an item). The dialogue *player* is a
queue-based system in `engine/Tactical/Dialogue Control.cpp` that shows a face, plays a sound,
and fires "special events" (give item, trigger NPC, go to gridno, etc.). Lua scripts
(`engine/gamedir/Data-1.13/Scripts/*.lua`) wrap these primitives so modders can author quest
logic without touching C++.

---

## 2. File map

| Concern | File | Key symbols |
|---|---|---|
| Dialogue queue / player | `engine/Tactical/Dialogue Control.h` / `.cpp` | `CharacterDialogue()`, `TacticalCharacterDialogue()`, `HandleDialogue()`, `DialogQuoteIDs`, `DIALOGUE_SPECIAL_EVENT_*` |
| Merc one-liners | `engine/Tactical/Dialogue Control.h:10-208` | `enum DialogQuoteIDs` (`QUOTE_SEE_ENEMY` … `QUOTE_HATED_5_ON_TEAM_LONGTIMETOHATE`) |
| Ambient NPC chatter | `engine/Tactical/Civ Quotes.h` / `.cpp` | `CIV_QUOTE_*` enum, `StartCivQuote()`, `HandleCivQuote()`, `GetCivType()`, `TAUNTTYPE` |
| Facts + quests | `engine/Strategic/Quests.h` / `.cpp` | `enum Quests`, `enum Facts`, `SetFactTrue/False`, `CheckFact()`, `StartQuest()`, `EndQuest()`, `CheckForQuests()` |
| NPC quote records | `engine/TacticalAI/NPC.h` / `.cpp` | `class NPCQuoteInfo`, `TriggerNPCRecord()`, `TriggerNPCRecordImmediately()`, `NPCTriggerNPC()` |
| Lua bindings | `engine/Strategic/LuaInitNPCs.cpp` | `lua_register(L, "SetFact", …)`, `"CheckFact"`, `"StartQuest"`, `"EndQuest"`, `"TriggerNPCRecord"`, `"AddEmail"`, `"StartDialogueMessageBox"` |
| Lua runtime | `engine/lua/` | `lua_strategic.cpp`, `lua_tactical.cpp`, `lua_state.cpp`, `lua_function.cpp` |
| Lua globals | `engine/Strategic/Luaglobal.cpp` / `.h` | `IniGlobalGameSetting()` — pushes `guiDay`, `gWorldSectorX/Y`, `difficultyLevel`, etc. |
| Authored Lua scripts | `engine/gamedir/Data-1.13/Scripts/` | `Quests.lua`, `InterfaceDialogue.lua`, `GameInit.lua`, `HourlyUpdate.lua`, `StrategicEventHandler.lua`, `StrategicTownLoyalty.lua`, `strategicmap.lua` |
| Profile fields | `engine/Tactical/soldier profile type.h` | `class MERCPROFILESTRUCT` (dialogue fields listed in §7) |
| Email | `engine/Laptop/email.h` | `AddEmail()`, `AddEmailFromXML()`, `AddEmailWithSpecialData()` |
| Briefing room | `engine/Strategic/BriefingRoom_Data.h` | `SetStartMission`, `SetEndMission`, `CheckMission` (Lua hooks) |

---

## 3. Tactical / Dialogue Control

### 3.1 The dialogue queue

`Dialogue Control.cpp` implements a FIFO queue of "speech + face + special event" items.
Public entry points (`Dialogue Control.h:309-395`):

- `CharacterDialogue(ubCharacterNum, usQuoteNum, iFaceIndex, bUIHandlerID, fFromSoldier, fDelayed)`
  — lowest-level: enqueue one quote for a profile.
- `TacticalCharacterDialogue(pSoldier, usQuoteNum)` — wrapper for in-sector soldiers.
- `TacticalCharacterDialogueWithSpecialEvent(pSoldier, usQuoteNum, uiFlag, uiData1, uiData2)`
  — enqueue a quote **plus** a side-effect flag.
- `HandleDialogue()` — pump called every frame; advances the queue, plays sound, shows text.
- `DialogueDataFileExistsForProfile(ubCharacterNum, usQuoteNum, fWavFile, &str)` — checks
  whether a `.EDT`/`.wav` exists for a profile+quote pair (used to skip missing audio).

### 3.2 Special events (side effects attached to a quote)

Bitmask constants in `Dialogue Control.h:223-260`. The ones a web port must model:

| Flag | Meaning |
|---|---|
| `DIALOGUE_SPECIAL_EVENT_GIVE_ITEM` | NPC gives an item to the player |
| `DIALOGUE_SPECIAL_EVENT_TRIGGER_NPC` | fire `TriggerNPCRecord()` on another NPC |
| `DIALOGUE_SPECIAL_EVENT_GOTO_GRIDNO` | NPC walks to a gridno |
| `DIALOGUE_SPECIAL_EVENT_DO_ACTION` | generic action (data-driven) |
| `DIALOGUE_SPECIAL_EVENT_CLOSE_PANEL` | end the conversation UI |
| `DIALOGUE_SPECIAL_EVENT_PCTRIGGERNPC` | player triggers the NPC |
| `DIALOGUE_SPECIAL_EVENT_BEGINPREBATTLEINTERFACE` | start a battle |
| `DIALOGUE_SPECIAL_EVENT_SHOPKEEPER` | open shop UI |
| `DIALOGUE_SPECIAL_EVENT_REMOVE_EPC` | escort character leaves the squad |
| `DIALOGUE_SPECIAL_EVENT_CONTRACT_*` | merc contract hire/renewal |

### 3.3 Merc one-liner quotes (`DialogQuoteIDs`)

`Dialogue Control.h:10-208` enumerates ~150 canned quotes keyed by *situation*, not by NPC:
`QUOTE_SEE_ENEMY`, `QUOTE_KILLED_AN_ENEMY`, `QUOTE_SECTOR_SAFE`, `QUOTE_SERIOUSLY_WOUNDED`,
`QUOTE_BUDDY_1_KILLED`, `QUOTE_HEADSHOT`, `QUOTE_REFUSING_ORDER`, `QUOTE_GREETING`,
`QUOTE_CONTRACT_ACCEPTANCE`, etc. Many IDs are aliased for AIM vs non-AIM mercs (e.g.
`QUOTE_AIM_KILLED_MIKE = QUOTE_MERC_QUIT_LEARN_TO_HATE`, line 52). The web equivalent is
`SPEECH_EVENTS` in `game/characters.js:28` (`hired, contact, cleared, wounded, exhausted,
death, ending`) — a much smaller situation set, but the same *idea*: situation → line.

### 3.4 Lua-driven additional dialogue

`AdditionalTacticalCharacterDialogue_CallsLua(pSoldier, usEventNr, aData1..3)`
(`Dialogue Control.h:373`) lets a Lua script decide *whether and what* a merc says for an
event. The event catalog is `enum AdditionalDialogEvents` (`Dialogue Control.h:339-368`):
`ADE_MERC_ARRIVES`, `ADE_SECTOR_COMMENTARY`, `ADE_MERCHANT_CHAT`, `ADE_DIALOGUE_NPC_FRIENDLY`,
`ADE_DIALOGUE_NPC_THREATEN`, `ADE_DIALOGUE_NPC_RECRUIT`, `ADE_DIALOGUE_RPC_RECRUIT_SUCCESS`,
`ADE_NPC_DEATH`, `ADE_WEATHERCHANGE`, `ADE_SNIPERWARNING`, … This is the closest engine analog
to `game/character-events.js` `characterEventLines()` (see §9.2).

---

## 4. Civ Quotes (ambient NPC chatter)

`engine/Tactical/Civ Quotes.h:12-75` defines `CIV_QUOTE_*` — ambient lines for generic
(non-profile) civilians, keyed by civ type and world state:

- `CIV_QUOTE_ADULTS_BEGGING`, `CIV_QUOTE_KIDS_BEGGING`
- `CIV_QUOTE_ADULTS_LIBREATED_FIRST_TIME`, `CIV_QUOTE_ADULTS_TOWN_TAKEN_BACK`
- `CIV_QUOTE_ADULTS_HIGH_LOYALTY`, `CIV_QUOTE_ADULTS_EXTREMLY_LOW_LOYALTY`
- `CIV_QUOTE_GREEN_MILITIA` / `MEDIUM_MILITIA` / `ELITE_MILITIA`
- `CIV_QUOTE_ADULTS_REBELS`, `CIV_QUOTE_KIDS_REBELS`
- `CIV_QUOTE_DEIDRANNA_DEAD` (world-state reaction)

API (`Civ Quotes.h:164-180`): `InitCivQuoteSystem()`, `StartCivQuote(pCiv)`,
`HandleCivQuote()`, `GetCivType(pCiv)` (returns `CIV_TYPE_NA/ADULT/KID/MARRIED_PC/ENEMY`,
lines 6-10), `BeginCivQuote(pCiv, ubCivQuoteID, ubEntryID, x, y)`. Enemy taunts are a
separate enum `TAUNTTYPE` (`Civ Quotes.h:77-155`) — combat-only, out of scope for this doc.

**Port note:** the web game's `civilians` map in `game/encounters.js:19` (one greeting per
sector, e.g. `san_nicolas:['Maestra de posta','Los desembarcos amenazan…']`) is the current
stand-in for civ quotes. A fuller port would key lines by `(sector owner, loyalty band,
liberated-first-time)` exactly like `CIV_QUOTE_ADULTS_LIBREATED_FIRST_TIME`.

---

## 5. Fact system

### 5.1 Storage and API (`engine/Strategic/Quests.h`)

- `gubFact[NUM_FACTS]` (`Quests.h:694`), `NUM_FACTS = 500` (`Quests.h:16`), `MAX_FACTS = 65536`.
- `SetFactTrue(usFact)` / `SetFactFalse(usFact)` (`Quests.h:696-697`, impl `Quests.cpp:68,84`).
- `CheckFact(usFact, ubProfileID)` (`Quests.h:698`, impl `Quests.cpp:670`) — the **profile
  parameter is a hook**: some facts are evaluated *per-NPC* (e.g. `FACT_NPC_WOUNDED` checks the
  profile's health), not read from the array.
- `SetFact(usFact, aVal)` / `GetFact(usFact)` (`Quests.h:700-701`, impl `Quests.cpp:1366,1372`)
  — facts can hold small integers, not just booleans.

### 5.2 Fact categories (from `enum Facts`, `Quests.h:214-667`)

| Range | Category | Examples |
|---|---|---|
| 0–11 | City liberation | `FACT_OMERTA_LIBERATED` … `FACT_MEDUNA_LIBERATED` |
| 12–40 | Rebel storyline | `FACT_MIGUEL_FOUND`, `FACT_LETTER_DELIVERED`, `FACT_FOOD_ROUTE_EXISTS`, `FACT_REBELS_HATE_PLAYER`, `FACT_MIGUEL_AND_ALL_REBELS_CAN_BE_RECRUITED` |
| 41–125 | San Mona / Kingpin / brothel | `FACT_PABLOS_BRIBED`, `FACT_KINGPIN_KNOWS_MONEY_GONE`, `FACT_PLAYER_REPAID_KINGPIN`, `FACT_MARIA_ESCORTED`, `FACT_JOEY_ESCORTED`, `FACT_PLAYER_USED_BROTHEL` |
| 126–170 | Helicopter / Waldo / Vince / Slay | `FACT_HELICOPTER_IN_PERFECT_CONDITION`, `FACT_HELICOPTER_LOST`, `FACT_VINCE_RECRUITABLE`, `FACT_ALL_TERRORISTS_KILLED`, `FACT_QUEEN_DEAD` |
| 171–220 | Mines / loyalty / Madlab | `FACT_MINE_EMPTY`, `FACT_MINE_RUNNING_OUT`, `FACT_CREATURES_IN_MINE`, `FACT_LOYALTY_LOW/HIGH`, `FACT_ROBOT_READY`, `FACT_MADLAB_EXPECTING_FIREARM` |
| 223–340 | Misc quest flags | `FACT_FIRST_BATTLE_WON`, `FACT_PLAYER_DOING_WELL`, `FACT_KIDS_ARE_FREE`, `FACT_PLAYER_SPOKE_TO_*_MINER`, `FACT_ENOUGH_LOYALTY_TO_TRAIN_MILITIA` |
| 350–430 | Late-game / UB | `FACT_KINGPIN_WILL_LEARN_OF_MONEY_GONE`, `FACT_BOUNTYHUNTER_*`, `FACT_TERRORIST_LOCATION_KNOWN_*`, `FACT_CONVO_MANUEL` |

**Port note:** the web game already has a `flags` object in campaign state
(`game/campaign.js:56`: `flags:{academy, sanLorenzo, northPact, partisanSupply, foundry,
parliament, emancipation, commission, mentoring}`) plus `s.reputation`, `s.sectors[*].loyalty`,
`cityLoyaltyEvents`. These are the natural home for a `FACT_*`-style bit store. The engine's
`CheckFact(usFact, ubProfileID)` per-NPC evaluation maps to web functions like
`questForNPC(state, npcId)` (`game/quests.js:7`) which compute per-NPC status from state.

---

## 6. Quest system

### 6.1 Quest state machine (`engine/Strategic/Quests.h:8-11`)

```
QUESTNOTSTARTED = 0, QUESTINPROGRESS = 1, QUESTDONE = 2, QUESTCANNOTSTART = 255
```

API: `StartQuest(ubQuest, sSectorX, sSectorY)` / `EndQuest(...)` (`Quests.h:703-704`,
impl `Quests.cpp:1377,1406`), `InternalStartQuest/InternalEndQuest` (with history-update flag),
`CheckForQuests(uiDay)` (`Quests.h:710`) — the daily hook that advances time-based quests,
`InitQuestEngine()` (`Quests.h:712`), and `GiveQuestRewardPoint(...)` (`Quests.h:725`).

### 6.2 Quest IDs (`enum Quests`, `Quests.h:45-86`)

| ID | Quest | ID | Quest |
|---|---|---|---|
| 0 | `QUEST_DELIVER_LETTER` | 13 | `QUEST_BLOODCATS` |
| 1 | `QUEST_FOOD_ROUTE` | 14 | `QUEST_FIND_HERMIT` |
| 2 | `QUEST_KILL_TERRORISTS` | 15 | `QUEST_CREATURES` |
| 3 | `QUEST_KINGPIN_IDOL` | 16 | `QUEST_CHOPPER_PILOT` |
| 4 | `QUEST_KINGPIN_MONEY` | 17 | `QUEST_ESCORT_SKYRIDER` |
| 5 | `QUEST_RUNAWAY_JOEY` | 18 | `QUEST_FREE_DYNAMO` |
| 6 | `QUEST_RESCUE_MARIA` | 19 | `QUEST_ESCORT_TOURISTS` |
| 7 | `QUEST_CHITZENA_IDOL` | 20 | `QUEST_FREE_CHILDREN` |
| 8 | `QUEST_HELD_IN_ALMA` | 21 | `QUEST_LEATHER_SHOP_DREAM` |
| 9 | `QUEST_INTERROGATION` | 22 | `QUEST_ESCORT_SHANK` |
| 10 | `QUEST_ARMY_FARM` | 25 | `QUEST_KILL_DEIDRANNA` |
| 11 | `QUEST_FIND_SCIENTIST` | 26 | `QUEST_KINGPIN_ANGEL_MARIA` |
| 12 | `QUEST_DELIVER_VIDEO_CAMERA` | 27 | `QUEST_HELD_IN_TIXA` |

The Lua mirror lives in `engine/gamedir/Data-1.13/Scripts/Quests.lua` (`nQuests` table) with
`qStatus` matching the C++ constants. `Quests.lua` also maps each quest to `QUESTS.EDT` text
records (start/end messages) and defines `Profiles` (e.g. `DYNAMO = 66, KINGPIN = 86`) and
`nHistory` (`HISTORY_QUEST_STARTED = 15`, `HISTORY_QUEST_FINISHED = 16`).

### 6.3 Per-NPC condition helpers (`Quests.h:727-757`)

`CheckNPCWounded`, `CheckNPCInOkayHealth`, `CheckNPCBleeding`, `CheckNPCWithin`,
`CheckGuyVisible`, `CheckNPCAt`, `CheckNPCIsEnemy`, `CheckIfMercIsNearNPC`,
`NumWoundedMercsNearby`, `NumMercsNear`, `CheckNPCIsEPC`, `CheckNPCIsRPC`, `NPCInRoom`,
`NPCInRoomRange`, `PCInSameRoom`, `NumMalesPresent`, `FemalePresent`, `CheckNPCSector`,
`CheckNPCCowering`, `CheckNPCIsUnderFire`, `NPCHeardShot`, `CheckTalkerStrong`,
`CheckTalkerFemale`, `CheckTalkerUnpropositionedFemale`. These are the *predicates* a quote
record can use — the web port's equivalent is `questForNPC().conditionMet`
(`game/quests.js:7`: `q.requiredSectors.every(id => state.sectors[id]?.owner==='patriot')`).

---

## 7. NPC scripting hooks (Lua)

### 7.1 The Lua bridge

`engine/Strategic/LuaInitNPCs.cpp` (11,907 lines) registers ~200 C functions into the Lua
state. The dialogue/quest-relevant registrations:

| Lua name | C function | Purpose |
|---|---|---|
| `SetFact` / `SetFactTrue` / `SetFactFalse` | `l_SetFact` (line 884) | write facts |
| `CheckFact` | `l_CheckFact` (line 292) | read facts |
| `StartQuest` / `EndQuest` | `l_StartQuest` (313) / `l_EndQuest` (314) | quest state |
| `TriggerNPCRecord` / `TriggerNPCRecordImmediately` | `l_TriggerNPCRecord` (322) / `l_TriggerNPCRecordImmediately` (323) | fire an NPC quote record |
| `TriggerNPCWithIHateYouQuote` | `l_TriggerNPCWithIHateYouQuote` (499) | hostile reaction |
| `AddEmail` / `AddEmailFromXML` / `AddEmailMercAvailableXML` / `AddEmailLevelUpXML` | `l_AddEmail` (405) etc. | send emails |
| `AddHistoryToPlayersLog` | `l_AddHistoryToPlayersLog` (631) | journal entry |
| `StartDialogueMessageBox` | `l_StartDialogueMessageBox` (850) | modal text box |
| `HireMerc` | `l_HireMerc` (104) | recruit a merc |
| `SetStartMission` / `SetEndMission` / `CheckMission` | lines 109-111 | briefing-room missions |
| `InitProfile` / `InitMapProfil` | lines 121, 134 | place NPCs on maps |

### 7.2 Lua globals (`engine/Strategic/Luaglobal.cpp`)

`IniGlobalGameSetting(L)` pushes world state into Lua globals: `guiDay`, `guiHour`, `guiMin`,
`gWorldSectorX/Y`, `gbWorldSectorZ`, `difficultyLevel`, `gameStyle`, `gubSrcSoldierProfile`,
`guiHelicopterSkyriderTalkState`, plus `ini*` settings from `ja2_options.ini` and `Mod
Setting.ini` (e.g. `iniHIDEOUT_SECTOR_X`, `iniKINGPIN_MONEY_SECTOR_X`). Feature switches in
`Luaglobal.h:15-25` enable per-script hooks: `LUA_QUESTS`, `LUA_INTERFACE_DIALOGUE`,
`LUA_HANDLE_QUEST_CODE_ON_SECTOR`, `LUA_GAME_INIT_NPCS`, `LUA_HOURLY_QUEST_UPDATE`,
`LUA_STRATEGY_EVENT_HANDLER`, `LUA_STRATEGY_TOWN_LOYALTY`.

### 7.3 Authored scripts (`engine/gamedir/Data-1.13/Scripts/`)

- `Quests.lua` — quest ID tables, `Profiles`, `nHistory`; the canonical quest catalog.
- `InterfaceDialogue.lua` — `Profil` (profile IDs), `Group` (civilian groups:
  `REBEL_CIV_GROUP=1`, `KINGPIN_CIV_GROUP=2`, …), `StatusGroup` (hostility ladder:
  `CIV_GROUP_NEUTRAL=0` … `CIV_GROUP_HOSTILE=3`), `qStatus`.
- `GameInit.lua` — `InitNewGame`, `InitNPCs` (spawns NPCs per profile).
- `HourlyUpdate.lua` — time-based quest checks (mirrors `CheckForQuests(uiDay)`).
- `StrategicEventHandler.lua`, `StrategicTownLoyalty.lua`, `strategicmap.lua` — event and
  loyalty hooks.

---

## 8. Profile dialogue fields (`engine/Tactical/soldier profile type.h`)

`class MERCPROFILESTRUCT` (line 770) is the per-NPC record. Dialogue-relevant fields:

| Field | Line | Meaning |
|---|---|---|
| `ubQuoteRecord` | 830 | which quote file/record set this NPC uses |
| `ubQuoteActionID` | 924 | default action when talked to |
| `ubLastQuoteSaid` / `bLastQuoteSaidWasSpecial` | 941 / 976 | anti-repeat state |
| `bAttitude` | 955 | NPC disposition (friendly/direct/threaten…) |
| `bApproached` | 967 | has the player approached this NPC |
| `bMercOpinion[NUMBER_OF_OPINIONS]` | 966 | per-player opinion (drives `ubOpinionRequired`) |
| `bBuddy[5]` / `bHated[5]` / `bLearnToLike` / `bLearnToHate` | 906-907 / 960 | relationship graph |
| `bHatedTime[5]` / `bLearnToLikeTime` / `bLearnToHateTime` | 969-971 | relationship timers |
| `bFriendlyOrDirectDefaultResponseUsedRecently` / `bRecruitDefaultResponseUsedRecently` / `bThreatenDefaultResponseUsedRecently` | 979-981 | approach cooldowns |
| `ubLastDateSpokenTo` | 975 | daily repeat gate |
| `usApproachFactor[4]` / `ubApproachVal[4]` / `ubApproachMod[3][4]` | 916 / 961-962 | approach weighting |
| `bTown` / `bTownAttachment` | 963-964 | town loyalty link |
| `ubCivilianGroup` | 985 | civ group membership |
| `bNPCData` / `bNPCData2` | 982 / 988 | NPC-specific scratch |
| `uiPrecedentQuoteSaid` | 996 | "repeating yourself" gate for contract quotes |
| `bMercStatus` | 968 | hired/available/away state |

**Port note:** the web equivalent is `operativeState` in `game/campaign.js:56`
(`{hp, fatigue, alive, xp, priming, flints, rations, torches, condition}`) plus
`recruited[]`, `conversations[npcId] = {met, lastApproach, hour}` (`campaign.js:238`), and
`lastConversation` (`campaign.js:238`). The engine's `bApproached`/`ubLastDateSpokenTo` map to
`conversations[npcId].met`/`.hour`; `bMercOpinion` maps to `s.reputation[faction]`.

---

## 9. Email / briefing hooks

- **Email:** `engine/Laptop/email.h:783-792` — `AddEmail(iMessageOffset, iMessageLength,
  ubSender, iDate, iCurrentIMPPosition, iCurrentShipmentDestinationID, EmailType,
  EnumEmailXML)`, `AddEmailFromXML(...)`, `AddEmailWithSpecialData(...)`. Emails are
  data-driven from `TableData/Email/*.xml` (e.g. `EmailMercAvailable.xml`,
  `EmailMercLevelUp.xml`). Lua can send them via `AddEmail`/`AddEmailFromXML`
  (`LuaInitNPCs.cpp:1025-1028`).
- **Briefing room:** `engine/Strategic/BriefingRoom_Data.h` + Lua `SetStartMission`,
  `SetEndMission`, `CheckMission` (`LuaInitNPCs.cpp:109-111`) — mission briefing screens
  gated by `ENABLE_BRIEFINGROOM` (see `docs/web-port/00-overview.md` §2.2).

**Port note:** the web game's journal is `s.log` (array of `{hour, text}`) rendered as
"DESPACHOS RECIBIDOS" in `web/app/CampaignOffice.tsx` (journal section), and `mentorDispatch(s)`
in `game/narrative.js:15` produces the San Martín dispatch. `AddHistoryToPlayersLog` ↔
`note(s, …)` / `s.log.push`; `AddEmail` ↔ a future `s.inbox` array.

---

## 10. Mapping to the existing web implementation

| Engine concept | Web implementation | File |
|---|---|---|
| `DialogQuoteIDs` (situation quotes) | `SPEECH_EVENTS` + `speechFor(operative, event)` | `game/characters.js:28-31` |
| `AdditionalDialogEvents` / `ADE_*` | `characterEventLines(before, after)` (death/exhausted/wounded/cleared/contact) | `game/character-events.js:6-18` |
| `withCharacterSpeech` (queue append) | `withCharacterSpeech(before, after)` appends lines to `after.log` | `game/character-events.js:19-22` |
| `enum Facts` / `SetFact` | `s.flags.*`, `s.reputation.*`, `s.sectors[*].loyalty`, `s.quests` | `game/campaign.js:56` |
| `enum Quests` + `StartQuest/EndQuest` | `NPC_QUESTS` with `status: unoffered/offered/completed` | `game/quests.js:2-7` |
| `CheckFact(usFact, ubProfileID)` | `questForNPC(state, npcId)` → `conditionMet` | `game/quests.js:7` |
| `NPCQuoteInfo` conditions+actions | `talkNPC` reducer case: greeting + offer/delivery + `pay()` + `recordCityLoyalty()` | `game/campaign.js:222-238` |
| `TriggerNPCRecord` (chain) | `s.lastConversation` + `options[]` (friendly/direct/recruit/quest/mission) | `game/campaign.js:238` |
| `CIV_QUOTE_*` ambient lines | `civilians` map (one greeting per sector) | `game/encounters.js:19` |
| `SetStartMission/CheckMission` | `MISSION_SCENES` + `missionStatus(s, id)` + `talkMission(s, npcId, supplied)` | `game/missions.js:2-12` |
| `mentorDispatch` / journal | `mentorDispatch(s)` + `s.log` | `game/narrative.js:15-24` |
| Conversation UI | `Battlefield.tsx` `talking` panel + `conversation` prop | `web/app/Battlefield.tsx:81` |
| `AddEmail` | (not yet ported) → propose `s.inbox` | — |

---

## 11. Proposed web dialogue-runner JSON schema

The engine's `NPCQuoteInfo` (conditions + actions) is the right shape to port. A web
`dialogue-runner` would consume records like this:

```jsonc
{
  "schema": "granaderos/dialogue-record/v1",
  "npcId": "local-san_nicolas",
  "records": [
    {
      "id": "greet-1",
      "conditions": {
        "factTrue": ["sector_liberated:san_nicolas"],
        "factFalse": ["quest:posta-polvora:completed"],
        "quest": null,            // {id, status: "inprogress"} or null
        "dayRange": [0, 999],
        "approach": ["friendly", "direct"],
        "opinionMin": 0,          // maps to s.reputation[faction]
        "requiredItem": null,     // item id or null
        "requiredSector": "san_nicolas"
      },
      "speech": {
        "text": "La guardia de la posta necesita cinco cargas de pólvora…",
        "speaker": "Maestra de posta",
        "face": "portrait-local-san_nicolas"
      },
      "actions": [
        { "type": "setFact", "fact": "quest:posta-polvora:offered", "value": true },
        { "type": "startQuest", "quest": "posta-polvora" },
        { "type": "log", "text": "Encargo ofrecido: Pólvora para la guardia de la posta." }
      ],
      "next": ["deliver-1"]       // record ids reachable after this one
    },
    {
      "id": "deliver-1",
      "conditions": {
        "factTrue": ["quest:posta-polvora:offered"],
        "factFalse": ["quest:posta-polvora:completed"],
        "inventory": { "powder": 5 }          // cost check
      },
      "speech": { "text": "La guardia recibe las cinco cargas…", "speaker": "Maestra de posta" },
      "actions": [
        { "type": "consume", "inventory": { "powder": 5 } },
        { "type": "endQuest", "quest": "posta-polvora" },
        { "type": "setFact", "fact": "quest:posta-polvora:completed", "value": true },
        { "type": "loyalty", "sector": "san_nicolas", "delta": 8 }
      ],
      "next": []
    }
  ]
}
```

**Runner rules (mirroring `NPC.cpp` `TriggerNPCRecord`):**
1. Evaluate `conditions` against state; if any fail, the record is skipped (engine:
   `NPCConsiderQuote`, `NPC.cpp:2785`).
2. If `speech.text` exists, append to the conversation panel and to `s.log`.
3. Execute `actions` in order — these are the only state mutations (engine: quote actions
   like `usSetFactTrue`, `ubStartQuest`, `usGiftItem`, `NPC.h:100-109`).
4. `next` lists candidate follow-up records; the runner picks the first whose conditions pass.
5. Persist `conversations[npcId].lastRecord` so re-talking resumes, not restarts.

---

## 12. Trigger graph (how records chain)

```
                    ┌────────────────────────────────────────────┐
                    │  player enters sector / clicks NPC         │
                    └──────────────┬─────────────────────────────┘
                                   ▼
                    ┌──────────────────────────────┐
                    │  greeting record (approach)  │
                    │  cond: sector owned, quest   │
                    │  not completed               │
                    └──────────────┬───────────────┘
                                   │ actions: setFact(met), log
                                   ▼
        ┌──────────────────────────┴──────────────────────────┐
        ▼                                                     ▼
┌──────────────────┐                                 ┌──────────────────┐
│ quest offer rec  │◄── approach=quest ──────────────┤ recruit record   │
│ cond: unoffered  │                                 │ cond: leadership │
│ act: startQuest  │                                 │ ≥ required,      │
└────────┬─────────┘                                 │ liberated ≥ n    │
         │                                            └────────┬─────────┘
         ▼                                                    ▼
┌──────────────────┐   approach=quest (deliver)     ┌──────────────────┐
│ delivery record  │◄───────────────────────────────│ recruit success  │
│ cond: offered +  │                                │ act: add to      │
│ inventory cost   │                                │ recruited[]      │
│ act: consume,    │                                └──────────────────┘
│ endQuest, loyalty│
└────────┬─────────┘
         ▼
┌──────────────────┐   approach=mission (yatasto)   ┌──────────────────┐
│ mission records  │◄───────────────────────────────│ talkMission()    │
│ (reports →       │                                │ stage machine    │
│  assessment →    │                                │ (arrival→ready)  │
│  frontier)       │                                └──────────────────┘
└──────────────────┘
```

Side-effect edges (engine `DIALOGUE_SPECIAL_EVENT_*`): a record may also fire
`triggerNPC` (chain to another NPC's records), `giveItem`, `startBattle`
(`BEGINPREBATTLEINTERFACE`), `openShop` (`SHOPKEEPER`), or `removeEPC`. In the web port these
become action types `triggerNpc`, `grantItem`, `startBattle`, `openShop`, `dismissAlly`.

---

## 13. Reproduction checklist (for the web-port agent)

1. **Facts store** — add a `facts` map to campaign state (or reuse `flags` + `quests` +
   `reputation` + `sectors[*].loyalty`). Provide `setFact(id, value)` / `checkFact(id)` helpers
   mirroring `SetFact`/`CheckFact` (`Quests.h:696-701`).
2. **Quest store** — model `NPC_QUESTS` status as `unoffered → offered → completed` with
   `offeredAt`/`completedAt` (already done in `game/quests.js:7`; keep `validateQuests`).
3. **Dialogue runner** — implement §11 schema: a pure function
   `runDialogue(state, npcId, approach) → {state, conversation}` that evaluates conditions,
   appends speech, executes actions, and returns `next` records. Wire it into the `talkNPC`
   reducer (`game/campaign.js:222-238`) replacing the hardcoded greeting/offer/delivery chain.
4. **Situation quotes** — extend `SPEECH_EVENTS` (`game/characters.js:28`) with
   `sectorCleared`, `enemyContact`, `questStarted`, `questCompleted` if richer feedback is
   wanted; keep `characterEventLines` as the pure derivation layer.
5. **Ambient civ lines** — replace the single `civilians` greeting (`game/encounters.js:19`)
   with a `CIV_QUOTE_*`-style table keyed by `(sector, owner, loyaltyBand, firstLiberation)`.
6. **Mission scenes** — keep `MISSION_SCENES`/`missionStatus`/`talkMission`
   (`game/missions.js:2-12`); add a `briefing` field per scene for the `SetStartMission` analog.
7. **Email/journal** — add `s.inbox` (array of `{from, subject, body, hour, read}`) and a
   `sendEmail()` action; render in the journal section of `CampaignOffice.tsx` alongside
   `mentorDispatch`.
8. **Conversation UI** — extend `Battlefield.tsx:81` panel to render `conversation.options`
   from the runner's `next` records instead of the hardcoded approach buttons.
9. **Validation** — extend `validateQuests` (`game/quests.js:8`) and the campaign validator
   (`campaign.js:374-377`) to cover `facts`, `inbox`, and `conversations.lastRecord`.
10. **Tests** — add `tests/` cases: fact gating, quest lifecycle, dialogue record chaining,
    and a full `talkNPC` offer→deliver cycle for `posta-polvora`.

---

## 14. Key takeaways

- **Facts are the source of truth; dialogue is a pure function of facts.** The engine never
  stores "which dialogue was shown" — it stores facts, and quote records re-evaluate every
  time. The web port should do the same: `conversations[npcId]` is only for anti-repeat UX,
  never for logic.
- **Quests are 3-state machines** (`Quests.h:8-11`) driven by `StartQuest`/`EndQuest`; the
  web `NPC_QUESTS` already matches this shape.
- **The `NPCQuoteInfo` record (conditions + actions) is the single most portable engine
  concept** — §11's JSON schema is a direct transcription of `NPC.h:79-118`.
- **Lua is the engine's modding layer**, not a runtime the web needs; the web equivalent is
  authored JSON + pure reducer functions.