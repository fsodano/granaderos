# 10 — Save / Load & Persistence

**Scope:** How the JA2 v1.13 engine persists a campaign (saved-game file, per-sector temp files, INI settings) and how the web port (`game/save.js`, `web/app/page.tsx`) maps that model to `localStorage` + a portable JSON export ("Guardar"). Ends with a proposed versioned web JSON save schema, migration strategy, parity tests, and a reproduction checklist.

**Companion docs:** [00-overview](00-overview.md), [02-tile-engine](02-tile-engine.md), [04-soldiers-stats](04-soldiers-stats.md), [05-weapons-items](05-weapons-items.md).

---

## 1. Engine architecture: three persistence layers

The engine persists state in three distinct places, each with its own lifetime:

| Layer | Location | Lifetime | Contents |
|---|---|---|---|
| Saved-game file | `SavedGames\*.sav` | Per save slot | Header + serialized strategic/tactical state (see §2) |
| Sector temp files | `Temp\` (per sector) | While a sector is unloaded | Map modifications, world items, rotting corpses, enemy/civilian soldiers, revealed status |
| INI settings | `ja2.ini`, `Language.ini` | Machine-wide | Game options, external options, language |

The saved-game file is the *only* cross-session artifact; temp files are flushed into it on save and re-materialized on load.

---

## 2. The saved-game file

### 2.1 Entry points

- `engine/Ja2/SaveLoadGame.h:SaveGame()` — `BOOLEAN SaveGame( int ubSaveGameID, STR16 pGameDesc )`
- `engine/Ja2/SaveLoadGame.h:LoadSavedGame()` — `BOOLEAN LoadSavedGame( int ubSavedGameID )`
- `engine/Ja2/SaveLoadGame.h:CreateSavedGameFileNameFromNumber()` — maps slot number → `SavedGames\*.sav`
- `engine/Ja2/SaveLoadGame.h:SaveFilesToSavedGame()` / `LoadFilesFromSavedGame()` — generic file-in-file embedding (used for temp files and externalized data)

### 2.2 Header (`SAVED_GAME_HEADER`)

Defined in `engine/Ja2/SaveLoadGame.h:SAVED_GAME_HEADER`:

- `uiSavedGameVersion` — the save version (see §4)
- `zGameVersionNumber[16]` — engine version string
- `sSavedGameDesc[128]` — player description
- `uiFlags`, `uiDay`, `ubHour`, `ubMin` — clock snapshot for the load screen
- `sSectorX/Y`, `bSectorZ`, `fWorldLoaded`, `ubLoadScreenID` — where the player was
- `ubNumOfMercsOnPlayersTeam`, `iCurrentBalance` — quick stats for the load screen
- `sInitialGameOptions` (`GAME_OPTIONS`) — options snapshot, needed *before* the body is read
- `uiRandom` — RNG seed
- `ubFiller[494]` — explicit padding; the header is a fixed-size POD

The header is written first in `SaveLoadGame.cpp:SaveGame()` (line ~3484: `SaveGameHeader.uiSavedGameVersion = SAVE_GAME_VERSION;`), and the encryption set is derived from it via `SaveLoadGame.cpp:CalcJA2EncryptionSet()` before the body is written — so the version must be known before decrypting the rest.

### 2.3 Save sequence (order matters)

`SaveGame()` in `engine/Ja2/SaveLoadGame.cpp` (line 3377) writes, in order:

1. `SaveCurrentSectorsInformationToTempItemFile()` — flush current sector items/corpses to temp files first (line 3540)
2. `NewWayOfSavingEnemyAndCivliansToTempFile(..., TRUE, TRUE)` then `(..., FALSE, TRUE)` — flush enemies then civilians (lines 3617–3618)
3. `SaveTacticalStatusToSavedGame()` (line 3707)
4. `SaveGameClock()` — `engine/Strategic/Game Clock.cpp:865`
5. `SaveStrategicEventsToSavedGame()` — `engine/Strategic/Game Events.h:36`
6. `SaveSoldierStructure()` (line 3781) — all `TOTAL_SOLDIERS` slots (see §3)
7. `SaveStrategicMovementGroupsToSaveGameFile()` — `engine/Strategic/Strategic Movement.h:272`
8. `SaveMapScreenMessagesToSaveGameFile()` (line 3951)
9. `SavePreRandomNumbersToSaveGameFile()` (line 3998)
10. `SaveMineStatusToSaveGameFile()` — `engine/Strategic/Strategic Mines.cpp:905`
11. `SaveStrategicTownLoyaltyToSaveGameFile()` — `engine/Strategic/Strategic Town Loyalty.h:176`
12. `SaveMilitiaMovementInformationToSaveGameFile()` — `engine/Strategic/MilitiaSquads.h:43`
13. `SaveStrategicAI()` — `engine/Strategic/Strategic AI.cpp:3616`
14. `SaveMeanwhileDefsFromSaveGameFile()` (line 4220)
15. `SaveContractRenewalDataToSaveGameFile()` — `engine/Strategic/Merc Contract.cpp:86`
16. `SaveJa25SaveInfoToSaveGame()` — `engine/Strategic/Ja25 Strategic Ai.cpp:1058`
17. `SaveLuaGlobalToSaveGameFile()` — `engine/Strategic/LuaInitNPCs.h:79`
18. `SaveHiddenTownToSaveGameFile()` — `engine/Strategic/Map Screen Interface Map.cpp:7902`
19. Sector temp files embedded via `SaveFilesToSavedGame()` (map mods, items, corpses, enemy/civilian soldiers)

`LoadSavedGame()` (line 4568) mirrors this order and branches on `guiCurrentSaveGameVersion` for backward compatibility (see §4).

---

## 3. Tactical persistence

### 3.1 Tactical Save module

`engine/Tactical/Tactical Save.h` is the tactical persistence hub. Key functions:

- `InitTacticalSave( BOOLEAN fCreateTempDir )` — creates/clears the `Temp\` directory
- `SaveCurrentSectorsInformationToTempItemFile()` / `LoadCurrentSectorsInformationFromTempItemsFile()` — world items + rotting corpses for the current sector
- `SaveMapTempFilesToSavedGameFile()` / `LoadMapTempFilesFromSavedGameFile()` — embed/restore all temp files in the `.sav`
- `AddItemsToUnLoadedSector()` / `AddWorldItemsToUnLoadedSector()` — write items into an unloaded sector's temp file
- `AddDeadSoldierToUnLoadedSector()` — persist a dead soldier (corpse + dropped items) to an unloaded sector
- `AddRottingCorpseToUnloadedSectorsRottingCorpseFile()` — corpse persistence
- `GetMapTempFileName()` — temp file naming scheme (`Temp\` + sector coords + type)
- `JA2EncryptedFileRead/Write` + `NewJA2EncryptedFileRead/Write` — the save-file I/O primitives (encryption wrapper)
- `MercChecksum()` / `ProfileChecksum()` / `LBENODEChecksum()` — anti-tamper checksums
- `InitExitGameDialogBecauseFileHackDetected()` — final line of defense against modified save files

### 3.2 Enemy / civilian soldiers

`engine/Tactical/Enemy Soldier Save.h`:

- `SaveEnemySoldiersToTempFile( sSectorX, sSectorY, bSectorZ, ubFirstIdTeam, ubLastIdTeam, fAppendToFile )` — legacy path
- `NewWayOfSavingEnemyAndCivliansToTempFile( sSectorX, sSectorY, bSectorZ, fEnemy, fValidateOnly )` — current path; enemies go to `e_*` temp files, civilians to `c_*` temp files
- `NewWayOfLoadingEnemySoldiersFromTempFile()` / `NewWayOfLoadingCiviliansFromTempFile()` — loaders
- `LoadEnemySoldiersFromTempFile()` — legacy loader, "now only used to load old saves"
- `gfRestoringEnemySoldiersFromTempFile` — global flag set during restore

### 3.3 Map modifications

`engine/TileEngine/SaveLoadMap.h` persists per-sector map edits so unloaded sectors remember player damage:

- `MODIFY_MAP` struct — `usGridNo`, `usImageType`, `usSubImageIndex`, `ubType` (layer), `ubExtra`, `usHiExitGridNo`
- `ubType` enum — `SLM_LAND`, `SLM_OBJECT`, `SLM_STRUCT`, `SLM_SHADOW`, `SLM_ROOF`, `SLM_ONROOF`, `SLM_TOPMOST`, removal variants, `SLM_BLOOD_SMELL`, `SLM_DAMAGED_STRUCT`, `SLM_EXIT_GRIDS`, `SLM_OPENABLE_STRUCT`, `SLM_WINDOW_HIT`, `SLM_MINE_PRESENT`, `SLM_DECAL`
- `SaveModifiedMapStructToMapTempFile()` / `LoadAllMapChangesFromMapTempFileAndApplyThem()` — round-trip
- `AddStructToMapTempFile()` / `AddObjectToMapTempFile()` / `RemoveStructFromMapTempFile()` / `RemoveRoofFromMapTempFile()` / `AddRemoveObjectToMapTempFile()` — incremental edits
- `SaveBloodSmellAndRevealedStatesFromMapToTempFile()` + `SaveRevealedStatusArrayToRevealedTempFile()` / `LoadRevealedStatusArrayFromRevealedTempFile()` — fog-of-war persistence
- `AddExitGridToMapTempFile()` / `SetOpenableStructStatusFromMapTempFile()` / `AddWindowHitToMapTempFile()` — doors, windows, exits
- `ApplyMapChangesToMapTempFile( BOOLEAN fAddToMap )` — master switch: whether live map edits are recorded

---

## 4. Soldier & item serialization order + versioning

### 4.1 Soldier serialization

`SaveSoldierStructure()` in `engine/Ja2/SaveLoadGame.cpp:6802` iterates all `TOTAL_SOLDIERS` slots; for each active soldier it writes:

1. **1 byte active flag** (`ubOne`/`ubZero`)
2. **`SOLDIERTYPE::Save(hFile)`** (`SaveLoadGame.cpp:1830`), which writes in order:
   - `SIZEOF_SOLDIERTYPE_POD` raw POD block (with `uiMercChecksum` computed first via `GetChecksum()`)
   - `inv.Save(hFile, FALSE)` — the `Inventory` (see §4.2)
   - `aiData` (`STRUCT_AIData`)
   - `flags` (`STRUCT_Flags`)
   - `timeChanges` (`STRUCT_TimeChanges`)
   - `timeCounters` (`STRUCT_TimeCounters`)
   - `newdrugs` (`DRUGS`)
   - `stats` (`STRUCT_Statistics`)
   - `pathing` (`STRUCT_Pathing`)
3. **`SaveMercPathFromSoldierStruct()`** — the merc's path
4. **1 byte key-ring presence flag** + `NUM_KEYS * sizeof(KEY_ON_RING)` if present

`SOLDIERTYPE::Load()` (`SaveLoadGame.cpp:1907`) mirrors this. `CopySavedSoldierInfoToNewSoldier()` (`SaveLoadGame.h:78`) is used when re-hydrating soldiers into the live `Menptr` array.

### 4.2 Item serialization

- `OBJECTTYPE::Save( hFile, fSavingMap )` / `OBJECTTYPE::Load( hFile )` — `SaveLoadGame.cpp:3226` / `:3089`; per-item data (status, quantity, attachments, LBE nodes)
- `Inventory::Save( hFile, fSavingMap )` / `Inventory::Load( hFile )` — `SaveLoadGame.cpp:3330` / `:3266`; the soldier's inventory container
- `StackedObjectData::Save/Load` — `SaveLoadGame.cpp:3054` / `:3026`
- `WORLDITEM::Load( hFile, dMajorMapVersion, ubMinorMapVersion )` — `SaveLoadGame.cpp:2910`; world items carry their own map-version tag
- `LBENODE::Save( hFile, fSavingMap )` / `LBENODE::Load( hFile )` — `SaveLoadGame.cpp:643` / `:585`; LBE (load-bearing equipment) nodes

### 4.3 Versioning

- `engine/Ja2/GameVersion.h:116` — `#define SAVE_GAME_VERSION INCREASED_TEAMSIZES`
- The version is a **monotonic counter of feature bumps** (each `#define` in `GameVersion.h` is a named save-format change, e.g. `LUA_SAVEGAME_CHANGE 114`, `CAMPAIGNSTATS 150`, `INCREASED_TEAMSIZES` = current)
- `guiCurrentSaveGameVersion` (`SaveLoadGame.h:68`) is set from the header on load; `LoadSavedGame()` branches on it to apply per-version migrations (old saves read field-by-field via `ReadFieldByField()` at `SaveLoadGame.cpp:1884`, which recomputes struct padding)
- `SAVED_GAME_HEADER.uiSavedGameVersion` is written before the body so the encryption set (`CalcJA2EncryptionSet`) can be derived from it

**Web-port implication:** the engine's versioning is a single global integer with branching migrations. The web port should adopt the same pattern (see §8).

---

## 5. INI persistence

### 5.1 Game settings

- `engine/Ja2/GameSettings.h:2783` — `BOOLEAN SaveGameSettings();`
- `engine/Ja2/GameSettings.h:2784` — `BOOLEAN LoadGameSettings();`
- `engine/Ja2/GameSettings.h:14` — `constexpr std::string_view LANGUAGE_INI_FILE{"Language.ini"};`
- Globals: `gGameSettings` (`GameSettings.h:2755`), `gGameOptions` (`:2758`), `gGameExternalOptions` (`:2761`)
- `SaveGameSettings()` (`GameSettings.cpp:503`) writes a human-readable, comment-heavy INI (volumes, last save slot, options). The header comment at `GameSettings.h:17` states the contract: *"define its initialization and add its load/save to INI lines in: InitGameSettings(), SaveGameSettings(), LoadGameSettings()"* — every new option must be wired into all three.

### 5.2 INI reader

`engine/Utils/INIReader.h` — `class CIniReader`:

- `ReadInteger/ReadUINT32/ReadUINT16/ReadUINT8/ReadDouble/ReadFloat/ReadBoolean/ReadString` — typed reads with `(default, min, max)` range validation
- `ReadFloatArray/ReadINT32Array` — array reads
- `RegisterFileForMerging()` — INI merging support
- `iniErrorMessages` — queued parse errors (screen not ready at init time)

**Web-port implication:** the engine reads dozens of INI keys at startup. The web port has no INI layer; equivalent options must become part of the save schema or a settings object (see §8).

---

## 6. i18n runtime selection

- Language is chosen **at runtime**, not compile time (per `engine/README.md` build notes)
- `engine/Ja2/GameSettings.h:14` — `LANGUAGE_INI_FILE` = `Language.ini`; the language is read from INI
- `engine/Ja2/Init.cpp:113` — `AddLanguagePrefix( fileName, GetLanguagePrefix() )` — data files are resolved with a language prefix
- `g_lang` (`i18n::Lang`) gates behavior throughout the engine (e.g. `engine/Utils/WordWrap.cpp` branches on `g_lang == i18n::Lang::zh` for CJK wrapping)
- The engine ships per-language string tables and per-language data files

**Web-port implication:** the web port is **hardcoded Spanish** — `web/app/layout.tsx:4` sets `<html lang="es-AR">`, and UI strings are inline Spanish (e.g. `web/app/Desk.tsx:17`, `web/app/Logistics.tsx:23`). There is no runtime language switch. Save data must therefore be **language-neutral** (IDs, not display strings) so a future i18n layer can be added without migrating saves.

---

## 7. Web port mapping

### 7.1 `game/save.js` — the save codec

`game/save.js` (16 lines) is the entire web save layer:

- `SAVE_KEY = 'granaderos.campaign.v1'` — localStorage key
- `encodeSave(campaign, battle=null)` — `JSON.stringify({format:'granaderos', schema:1, savedAt:ISO, campaign, battle})`
- `decodeSave(text)` — validation pipeline:
  1. size guard (`> 5,000,000` chars rejected)
  2. `JSON.parse` with Spanish error messages
  3. `format === 'granaderos'` and `schema === 1` check
  4. `restoreCampaign(JSON.stringify(value.campaign))` — rehydrates the campaign object
  5. battle/campaign consistency checks: `pendingBattle` presence must match `battle`; `sceneId`, `syncedSeconds`, `elapsedSeconds`, `battleId`, `sectorId`, and squad membership must all agree

### 7.2 `web/app/page.tsx` — persistence wiring

- `storageKey()` — `SAVE_KEY` or `SAVE_KEY + '.qa'` when `?qa=1` (test isolation)
- Autosave: `useEffect` writes `localStorage.setItem(storageKey(), encodeSave(campaign, battle))` on every campaign/battle change; on failure shows *"No se pudo guardar en este navegador. Exportá la partida para conservarla."*
- `resume()` — `decodeSave(localStorage.getItem(storageKey()) || '')`, then routes to `battle` / `campaign` / `desk` screen
- `exportSave()` — **Guardar**: builds a `Blob([encodeSave(...)], {type:'application/json'})`, downloads `granaderos-dia-{N}.json`, revokes the URL
- `importSave(e)` — reads a `.json` file (≤ 5 MB), `decodeSave`, restores, routes

### 7.3 Mapping table

| Engine concept | Web equivalent |
|---|---|
| `.sav` file + `SAVED_GAME_HEADER` | `encodeSave` JSON envelope (`format`, `schema`, `savedAt`) |
| `SaveGame()` / `LoadSavedGame()` | `encodeSave` / `decodeSave` |
| Save slots | Single `localStorage` slot (`SAVE_KEY`) + portable file export |
| `SAVE_GAME_VERSION` | `schema: 1` |
| `SaveSoldierStructure()` | `campaign` object (soldiers/recruits) |
| `SaveTacticalStatusToSavedGame()` | `battle` snapshot (`validateBattleSnapshot`) |
| `SaveGameClock()` | `campaign.hour`, `secondOfHour`, `battle.startSeconds/elapsedSeconds/syncedSeconds` |
| `SaveStrategicEventsToSavedGame()` | `campaign.pendingBattle` + campaign state |
| Sector temp files / `SaveLoadMap` | Not yet ported (single-sector tactical maps; map edits are not persisted) |
| INI settings (`GameSettings`, `INIReader`) | Not yet ported (no settings object) |
| `Language.ini` / `g_lang` | Hardcoded `es-AR`; save data is language-neutral |

---

## 8. Proposed versioned web JSON save schema

### 8.1 Schema v2 (proposal)

```json
{
  "format": "granaderos",
  "schema": 2,
  "savedAt": "2026-09-06T12:00:00.000Z",
  "appVersion": "0.9.0",
  "settings": {
    "language": "es-AR",
    "qa": false
  },
  "campaign": {
    "hour": 0,
    "secondOfHour": 0,
    "officer": null,
    "recruited": [],
    "resources": { "treasury": 0 },
    "provinces": {},
    "pendingBattle": null
  },
  "battle": null
}
```

Rules:

1. **`schema` is a monotonic integer** (mirrors `SAVE_GAME_VERSION`). Bump it on any breaking shape change; never reuse numbers.
2. **`appVersion`** records the producing build for diagnostics (like `zGameVersionNumber`).
3. **`settings`** is the future home of INI-equivalent options (language, difficulty, QA flags) — the web port's answer to `GameSettings`/`INIReader`.
4. **Language-neutral data**: store IDs (`officer: "guemes"`), never display strings.
5. **Battle snapshot** stays a sibling of `campaign` (as today) so `decodeSave` can cross-check clocks and squad membership.

### 8.2 Migration strategy

- Keep `decodeSave` as a **version dispatcher**: `switch (value.schema)` with one migration function per version, each returning the next version's shape (mirrors `LoadSavedGame()` branching on `guiCurrentSaveGameVersion`).
- Migrations must be **pure and idempotent** (no RNG, no I/O) so they are unit-testable.
- On any migration failure, surface the Spanish error and keep the original text untouched (never partially overwrite `localStorage`).
- `schema: 1 → 2` example migration: add `settings` with defaults, add `appVersion`, keep everything else.

### 8.3 Parity tests (proposed)

| Test | Engine reference | Web assertion |
|---|---|---|
| Round-trip | `SaveGame` → `LoadSavedGame` | `decodeSave(encodeSave(c))` deep-equals `c` |
| Version gate | `SAVE_GAME_VERSION` check | `schema !== 1` throws *"Esta versión de la partida no es compatible."* |
| Clock parity | `SaveGameClock` | `battle.elapsedSeconds === battle.syncedSeconds` invariant |
| Squad parity | `SaveSoldierStructure` active-flag loop | every `pendingBattle.squad` member exists in `battle.units` (player side) |
| Sector parity | `SaveTacticalStatusToSavedGame` | `battle.sectorId === campaign.pendingBattle.sector` |
| Size guard | `REQUIRED_FREE_SPACE` | `> 5,000,000` chars rejected |
| Migration | `ReadFieldByField` padding logic | v1 → v2 migration preserves all v1 fields |
| Tamper | `MercChecksum` / `InitExitGameDialogBecauseFileHackDetected` | (future) checksum field in envelope |

---

## 9. Reproduction checklist

Manual verification for the web save/load feature:

1. **Fresh start** — clear `localStorage`, load the app, confirm no save banner.
2. **Autosave** — start a campaign, advance the clock, reload the page; `resume()` restores the same screen (`desk`/`campaign`/`battle`).
3. **Guardar export** — click **Guardar**; confirm `granaderos-dia-{N}.json` downloads and contains `format: "granaderos"`, `schema: 1`, `savedAt`.
4. **Import** — re-import the exported file; confirm state matches pre-export state exactly (treasury, recruits, hour).
5. **Battle continuity** — start a battle, save mid-battle, reload; confirm `battle` screen restores with matching `elapsedSeconds`/`syncedSeconds` and the same squad.
6. **Corrupt file** — import a truncated/renamed file; confirm the Spanish error and no state change.
7. **Wrong version** — hand-edit `schema` to `2`; confirm *"Esta versión de la partida no es compatible."*
8. **Oversized file** — import a > 5 MB file; confirm the size error.
9. **QA isolation** — load with `?qa=1`, save, confirm `granaderos.campaign.v1.qa` key is used and the normal key is untouched.
10. **Storage failure** — simulate `localStorage.setItem` throwing (private mode); confirm the *"No se pudo guardar…"* notice and that export still works.

---

## 10. Gaps & recommendations

1. **No settings persistence** — engine options (`GameSettings`/`INIReader`) have no web equivalent; introduce `settings` in schema v2 (§8.1).
2. **No map-edit persistence** — `SaveLoadMap`/`MODIFY_MAP` have no web counterpart; tactical maps are static. If destructible terrain ships, add a `mapEdits` array to the battle snapshot.
3. **No per-sector temp files** — the web port has no unloaded-sector simulation; sector state must live entirely in `campaign`/`battle`.
4. **Single slot** — engine has 18+ slots + autosaves; web has one `localStorage` slot. Consider slotting if multiple campaigns are desired.
5. **No checksum** — engine has `MercChecksum`/encryption; web saves are plain JSON. Acceptable for a single-player browser game, but a `checksum` field would catch hand-edited saves.
6. **i18n** — hardcoded `es-AR`; keep save data language-neutral so a runtime language switch (engine's `g_lang` model) can be added later without a save migration.