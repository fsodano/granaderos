# 02 — Tile Engine: Pixel-Faithful Isometric Rendering Reference

**Audience:** a web engineer with **no Jagged Alliance 2 experience** who must build a browser
isometric renderer that reproduces the JA2 v1.13 tactical viewport. This document is a
translation guide from the C++ engine (`engine/TileEngine/`) to Canvas/WebGL. It covers
**rendering and world data only** — combat/tactical rules are owned by another agent and are
out of scope.

**Source of truth:** `engine/TileEngine/` (headers `.h` declare the data structures and
constants; `.cpp` files implement them). The web game already has a working SVG isometric
renderer (`web/app/Battlefield.tsx`, `web/app/TacticalScene.tsx`) and authored maps
(`game/maps.js`); this document maps the C++ engine onto that existing surface so the web
renderer can be pushed toward pixel fidelity.

---

## 1. Big picture: how JA2 draws a sector

A sector is a rectangular grid of **cells**. Each cell has a stack of **layers** (land,
objects, structures, shadows, mercs, roofs, on-roof, topmost). Every layer is a linked list
of **level nodes**; each node references one entry in the **tile database** (a 16-bit index
into `gTileDatabase[]`). The renderer walks the grid in **diamond (isometric) order** and
blits each tile's 8-bit sprite into a 16-bit frame buffer, using a **16-bit z-buffer** to
decide which pixels win when sprites overlap. Lighting is applied per-tile by selecting one
of **16 precomputed shade tables** (palette remaps) for the sprite.

The whole pipeline is CPU blitting of 8bpp sprites with palette lookup — there is no 3D
geometry. A WebGL port can either (a) reproduce the z-buffer painter's algorithm exactly, or
(b) keep the same layer/depth semantics and let the GPU sort. The constants below make both
possible.

---

## 2. Coordinate systems and tile dimensions

All constants live in `engine/TileEngine/worlddef.h` unless noted.

| Constant | Value | Meaning |
|---|---|---|
| `WORLD_TILE_X` | `40` | On-screen width of one map tile (px) |
| `WORLD_TILE_Y` | `20` | On-screen height of one map tile (px) |
| `CELL_X_SIZE` | `10` | World-unit width of one cell |
| `CELL_Y_SIZE` | `10` | World-unit height of one cell |
| `WORLD_COLS` / `WORLD_ROWS` | `guiWorldCols` / `guiWorldRows` (default `160×160`) | Grid size; `WORLD_MAX = COLS*ROWS` = 25600 |
| `WORLD_COORD_COLS` | `WORLD_COLS*CELL_X_SIZE` | World-coordinate width |
| `WORLD_COORD_ROWS` | `WORLD_ROWS*CELL_Y_SIZE` | World-coordinate height |
| `WORLD_BASE_HEIGHT` | `0` | Ground elevation |
| `WORLD_CLIFF_HEIGHT` | `80` | One "cliff step" in world units |
| `WALL_HEIGHT` | `50` | Wall sprite height (in `tiledef.h`) |

### 2.1 GridNo — the single map index

Every cell is addressed by a flat integer **GridNo**:

```
gridno = row * WORLD_COLS + col          // MAPROWCOLTOPOS(r,c) in Isometric Utils.h
row    = gridno / WORLD_COLS             // ConvertGridNoToXY() in Isometric Utils.cpp
col    = gridno - row * WORLD_COLS
```

`NOWHERE = -1` marks "no tile". `TileIsOutOfBounds(g)` is `g < 0 || g >= WORLD_MAX`.
Neighbouring cells are reached by adding a direction increment (`DirIncrementer[8]` in
`Isometric Utils.cpp`):

```
N:-WORLD_COLS  NE:1-WORLD_COLS  E:1  SE:1+WORLD_COLS
S:+WORLD_COLS  SW:WORLD_COLS-1  W:-1  NW:-WORLD_COLS-1
```

### 2.2 World coordinates (cell units)

`ConvertGridNoToCellXY()` gives the cell's top-left in world units; `ConvertGridNoToCenterCellXY()`
adds `CELL_X_SIZE/2` to reach the cell center. World coords are what soldiers, items and
physics objects use (`dXPos`, `dYPos`).

### 2.3 Screen projection (the core formula)

`FromCellToScreenCoordinates()` in `Isometric Utils.cpp`:

```
screenX =  2*cellX - 2*cellY
screenY =  cellX + cellY
```

Inverse, `FromScreenToCellCoordinates()`:

```
cellX = (screenX + 2*screenY + 2) / 4
cellY = (2*screenY - screenX + 2) / 4
```

These are **cell-space** (10-unit) formulas. To place a tile on screen, the engine computes
the offset from the render center in world units, projects it, and adds the viewport center:

```
// GetWorldXYAbsoluteScreenXY() in Isometric Utils.cpp
distX = worldCellX*CELL_X_SIZE - gCenterWorldX
distY = worldCellY*CELL_Y_SIZE - gCenterWorldY
screenX = (2*distX - 2*distY) + gsCX - gsTLX
screenY = (distX + distY) + gsCY - gsTLY
```

**Web equivalent (already implemented):** `web/app/Battlefield.tsx` line 60 uses
`project=(x,y)=>({x:origin+(x-y)*hw, y:65+(x+y)*hh})` with `hw=26`, `hh=14`. That is the
same diamond projection scaled by 0.65 (26/40, 14/20). For pixel fidelity, `hw=40`, `hh=20`
(or any uniform scale) reproduces JA2 exactly. The tile diamond polygon is
`(x, y-hh) (x+hw, y) (x, y+hh) (x-hw, y)` — see `diamond()` in `TacticalScene.tsx`.

### 2.4 Mouse → cell

`GetMouseWorldCoords()` converts a screen point to world coords by subtracting the viewport
center, running `FromScreenToCellCoordinates()`, and adding `gsRenderCenterX/Y`. Then
`GetMouseXY()` divides by `CELL_X_SIZE`/`CELL_Y_SIZE` to get the cell, and
`GetMouseMapPos()` → `MAPROWCOLTOPOS` yields the GridNo. `GetMouseXYWithRemainder()` also
returns the sub-cell remainder (used for precise cursor placement).

---

## 3. World data model

### 3.1 `MAP_ELEMENT` — one per cell (`worlddef.h`)

```c
typedef struct {
    LEVELNODE *pLevelNodes[9];   // layer heads (see stack below)
    STRUCTURE *pStructureHead;   // structures occupying this cell
    STRUCTURE *pStructureTail;
    UINT16     uiFlags;          // MAPELEMENT_* flags
    UINT16     ubExtFlags[2];    // smoke/gas/door flags (MAPELEMENT_EXT_*)
    UINT16     sSumRealLights[1];
    UINT8      sHeight;          // terrain elevation (cliff steps of 80)
    UINT8      ubAdjacentSoldierCnt;
    UINT8      ubTerrainID;
    UINT16     ubReservedSoldierID;
    UINT8      ubBloodInfo;      // blood decal level (see Smell.h)
    UINT8      ubSmellInfo;      // smell strength/type (see Smell.h)
} MAP_ELEMENT;                   // gpWorldLevelData[WORLD_MAX]
```

Key `MAPELEMENT_*` flags: `MAPELEMENT_REVEALED` (fog-of-war), `MAPELEMENT_REVEALED_ROOF`,
`MAPELEMENT_REDUNDENT` (tile fully hidden behind z-buffer — skip blit), `MAPELEMENT_REDRAW`
(marked dirty), `MAPELEMENT_INTERACTIVETILE`, `MAPELEMENT_ITEMPOOL_PRESENT`,
`MAPELEMENT_STRUCTURE_DAMAGED`. `MAPELEMENT_EXT_*` flags track smoke/gas presence per cell
(`MAPELEMENT_EXT_SMOKE`, `_TEARGAS`, `_MUSTARDGAS`, `_CREATUREGAS`, `_BURNABLEGAS`, …).

### 3.2 `LEVELNODE` — one entry in a layer list (`worlddef.h`)

```c
typedef struct LEVELNODE {
    struct LEVELNODE *pNext;
    UINT32  uiFlags;              // LEVELNODE_* flags
    UINT8   ubSumLights, ubMaxLights;
    union { LEVELNODE *pPrevNode; STRUCTURE *pStructureData;
            INT32 iPhysicsObjectID; INT32 uiAPCost; };   // 4-byte union
    union { struct { UINT16 usIndex; INT16 sCurrentFrame; };  // tile DB index + anim frame
            SOLDIERTYPE *pSoldier; };
    union { struct { INT16 sRelativeX; INT16 sRelativeY; };
            INT32 iCorpseID; struct TAG_anitile *pAniTile; ITEM_POOL *pItemPool; };
    INT16  sRelativeZ;            // height offset for z-buffer
    UINT8  ubShadeLevel;          // current lighting shade (0..15)
    UINT8  ubNaturalShadeLevel;
    UINT8  ubFakeShadeLevel;
} LEVELNODE;
```

`usIndex` is the index into `gTileDatabase[]`; `sCurrentFrame` selects the animation frame
for doors/explosions. `LEVELNODE_*` flags that matter for rendering: `LEVELNODE_HIDDEN`,
`LEVELNODE_REVEAL` (fogged tile — pixelate), `LEVELNODE_REVEALTREES`, `LEVELNODE_USEZ`
(participates in z-buffer), `LEVELNODE_DYNAMIC`/`LEVELNODE_LASTDYNAMIC` (animated/dynamic),
`LEVELNODE_ANIMATION`, `LEVELNODE_ITEM`, `LEVELNODE_ROTTINGCORPSE`, `LEVELNODE_CACHEDANITILE`,
`LEVELNODE_EXITGRID`, `LEVELNODE_SHOW_THROUGH` (obscured pass), `LEVELNODE_NOZBLITTER`.

### 3.3 The layer stack (ASCII)

Layer indices are `LAND_START_INDEX=1 … TOPMOST_START_INDEX=8` (`worlddef.h`); index 0 is the
land list head. `pLandHead`/`pLandStart`/`pObjectHead`/`pStructHead`/`pShadowHead`/
`pMercHead`/`pRoofHead`/`pOnRoofHead`/`pTopmostHead` are aliases for `pLevelNodes[0..8]`.

```
        TOPMOST  (8)  UI markers, wireframes, cursor ghosts      ┐
        ONROOF   (7)  objects standing on roofs                  │
        ROOF     (6)  roof tiles (hidden when inside)            │  drawn
        MERC     (5)  soldiers, corpses                          │  back-to-front
        SHADOW   (4)  blob shadows, exit-grid markers            │  per layer pass
        STRUCT   (3)  walls, furniture, trees, doors             │
        OBJECT   (2)  debris, rocks, small props                 │
        LAND     (0/1) ground tiles, stacked by height           ┘
```

Per-cell layer manipulation lives in `worldman.h` (`AddLandToTail`, `AddObjectToTail`,
`AddStructToTail`, `AddRoofToTail`, `AddShadowToTail`, `AddMercToHead`, `AddTopmostToTail`,
and matching `Remove*`/`TypeExistsIn*Layer` helpers).

### 3.4 Tile database

`gTileDatabase[NUMBEROFTILES]` (`tiledef.h`) holds one `TILE_ELEMENT` per tile:

```c
typedef struct {
    UINT16 fType;                 // tile category (see TileDat.h enum)
    HVOBJECT hTileSurface;        // video object (sprite sheet)
    DB_STRUCTURE_REF *pDBStructureRef;  // collision/HP data
    UINT32 uiFlags;               // TILE_* flags
    RelTileLoc *pTileLocData;     // per-frame sub-image rects
    UINT16 usRegionIndex;         // sub-image index into the surface
    INT16  sBuddyNum;             // paired shadow tile
    UINT8  ubTerrainID;
    UINT8  ubNumberOfTiles;
    UINT8  bZOffsetX, bZOffsetY;  // z-buffer anchor offset
    INT16  sOffsetHeight;         // land height offset
    UINT16 usWallOrientation;
    UINT8  ubFullTile;
    TILE_ANIMATION_DATA *pAnimData;  // frame list for animated tiles
    ...camo/sound/stealth modifiers...
} TILE_ELEMENT;
```

Tile categories are the giant enum in `TileDat.h` (`FIRSTTEXTURE1…`, `FIRSTWALL1…`,
`FIRSTDOOR1…`, `FIRSTROOF1…`, `FIRSTSLANTROOF1…`, `FIRSTONROOF1…`, `FIRSTSHADOW1…`,
`ROADPIECES001…400`, `FIRSTDECORATIONS1…`, `FIRSTFLOOR1…`, `FIRSTISTRUCT1…`, `FIRSTCISTRUCT1…`,
`FIRSTEXPLDEBRIS1…`, `FIRSTVEHICLE1…`, etc.). `gTileTypeStartIndex[]`/`gNumTilesPerType[]`
map category → contiguous index range. `TILE_*` flags: `WALL_TILE`, `ANIMATED_TILE`,
`DYNAMIC_TILE`, `ROAD_TILE`, `FULL3D_TILE`, `ROOF_TILE`, `TRANSLUCENT_TILE`,
`HAS_SHADOW_BUDDY`, `AFRAME_TILE`, `HIDDEN_TILE`, `CLIFFHANG_TILE`, `MULTI_Z_TILE`.

`TILE_IMAGERY` (`tiledef.h`) is the loaded sprite sheet for a whole tile *type* (one per
`.sti` file): `HVOBJECT vo`, `fType`, `pAuxData`, `pTileLocData`, `pStructureFileRef`,
`ubTerrainID`. Loaded by `LoadTileSurface()` (`Tile Surface.cpp`). The **tile cache**
(`Tile Cache.h`, `TILE_CACHE_START_INDEX=36000`) lazily loads dynamic tiles (explosions,
smoke, corpses) by filename via `GetCachedTile()`.

---

## 4. Render pipeline

### 4.1 Call chain from the game loop

```
Game loop (Overhead.cpp)
 └─ RenderWorld()                       renderworld.cpp:3139
     ├─ advance gTileDatabase anim frames (ANIMATETILES counter)
     ├─ if RENDER_FLAG_FULL:
     │    ├─ ApplyScrolling(renderCenter, force)
     │    ├─ ResetLayerOptimizing()
     │    ├─ RenderStaticWorld()        renderworld.cpp:3439   (z-buffer pass)
     │    │    ├─ CalcRenderParameters(viewport)
     │    │    ├─ memset(gpZBuffer, LAND_Z_LEVEL, ...)
     │    │    ├─ RenderTiles(LAND)     → RENDER_STATIC_LAND
     │    │    ├─ RenderTiles(OBJECTS)  → RENDER_STATIC_OBJECTS
     │    │    ├─ RenderTiles(SHADOWS)  → RENDER_STATIC_SHADOWS (if RENDER_FLAG_SHADOWS)
     │    │    ├─ RenderTiles(STRUCT+ROOF+ONROOF+TOPMOST)  (4 levels, one pass)
     │    │    └─ RenderTiles(TILES_OBSCURED: STRUCT+ONROOF)  (show-through pass)
     │    └─ UpdateSaveBuffer()         (background rect save)
     ├─ RenderDynamicWorld()            renderworld.cpp:3551   (animated/merc pass)
     │    ├─ RestoreBackgroundRects()
     │    └─ RenderTiles(OBJECTS→SHADOWS→STRUCT_MERCS→MERCS→STRUCTURES→
     │                   HIGHMERCS→ROOF→ONROOF→TOPMOST)  (TILES_DYNAMIC_*)
     ├─ RenderDirty / ExecuteBaseDirtyRectQueue()   (Render Dirty.cpp)
     └─ ExecuteVideoOverlays()          (topmost UI text)
```

`RenderStaticWorldRect()` (renderworld.cpp:3334) is the same but clipped to a dirty rect and
used for partial redraws; `RenderMarkedWorld()` (3499) redraws only cells with
`MAPELEMENT_REDRAW`. `DirtyWorldRender()`/`MarkWorldDirty()` (`Simple Render Utils.cpp`)
flag the whole viewport for a full pass.

### 4.2 `RenderTiles()` — the diamond walk (renderworld.cpp:1186)

The core loop iterates the visible grid in **diamond order** so that tiles closer to the
camera are drawn later (painter's algorithm baseline):

```
row:  start at anchor (iAnchorPosX_M, iAnchorPosY_M)
      step: X_M+1, Y_M-1, screenX += 40   (build iTileMapPos[] for the row)
      blit each tile's level-node list for each requested level
between rows:
      alternate: if bXOddFlag → anchor Y_M++  else anchor X_M++
      screenY += 10 ; toggle bXOddFlag
```

Per tile, per node, the loop:
1. Looks up `TileElem = &gTileDatabase[pNode->usIndex]` (or the animation frame).
2. Computes `sTileHeight = gpWorldLevelData[gridno].sHeight` and clamps it to cliff steps
   (`sModifiedTileHeight = ((sTileHeight/80)-1)*80`, min 0).
3. Computes the z value via the `StructZLevel`/`SoldierZLevel` macros (`Render Z.h`):
   `zLevel = worldY * Z_SUBLAYERS + layerLevel` where `worldY` is the projected screen Y of
   the tile's anchor (plus `sRelativeZ` for floating objects).
4. Selects a blitter based on the level's `RenderFX` profile (z-write? shadow? translucent?
   obscured?) and blits the 8bpp sprite into the 16bpp frame buffer, testing/writing
   `gpZBuffer` per pixel.

### 4.3 Z-buffer semantics (`Render Z.h`, `renderworld.h`)

```
Z_SUBLAYERS = 8
LAND_Z_LEVEL=0  OBJECT_Z_LEVEL=1  SHADOW_Z_LEVEL=2  MERC_Z_LEVEL=3
STRUCT_Z_LEVEL=4  ROOF_Z_LEVEL=5  ONROOF_Z_LEVEL=6  FOG_Z_LEVEL=7
TOPMOST_Z_LEVEL=32767
```

A pixel is written only if its `zLevel` is **greater than or equal to** the current z-buffer
value (equal z "burns through" for same-layer tiles). `TOPMOST_Z_LEVEL` is a sentinel that
always wins. `gpZBuffer` is `UINT16[SCREEN_WIDTH*VIEWPORT_END_Y]`, cleared to `LAND_Z_LEVEL`
each full frame. `IsTileRedundent()` (renderworld.cpp:8861) skips blitting a tile whose
entire rect is already covered by a nearer z — this is the `MAPELEMENT_REDUNDENT` optimization.

**Web recipe:** in WebGL, encode `zLevel` into the fragment depth (e.g. `depth = zLevel/65535`)
and draw all sprites with `depthTest: true`; or keep the JS painter's algorithm and sort by
`depth = x + y` (what `TacticalScene.tsx` already does with `objects.sort((a,b)=>a.depth-b.depth)`).
For pixel fidelity, reproduce the *layer* ordering exactly: land → objects → shadows →
structures → roofs → on-roof → topmost, with soldiers interleaved by their `worldY`.

### 4.4 Render FX profiles

`RenderFX[]`/`RenderFXStartIndex[]` (defined in `renderworld.cpp`) map each `RENDER_STATIC_*`
/ `RENDER_DYNAMIC_*` level ID to a blitter profile: `fObscured`, `fDynamic`, `fMerc`,
`fZWrite`, `fZBlitter`, `fShadowBlitter`, `fLinkedListDirection`, `fCheckForRedundency`,
`fMultiZBlitter`, `fConvertTo16`. The blitters themselves are the
`Blt8BPPDataTo16BPPBufferTransZ*` family (renderworld.cpp:4822+): they copy 8bpp pixels,
apply the shade-table palette, test the z-buffer, and clip to a rect. `Blt8BPPDataTo16BPPBufferTransZTransShadowIncClip` is the workhorse for structures (z + shadow + translucency).

---

## 5. Render Dirty vs Render Z

Two complementary systems (`Render Dirty.h`/`Render Dirty.cpp`):

- **Dirty rectangles** (`AddBaseDirtyRect`, `ExecuteBaseDirtyRectQueue`, `EmptyDirtyRectQueue`)
  accumulate screen rects that changed this frame; the engine only uploads those regions to
  the visible surface. Queue capacity: `DIRTY_QUEUES=200`.
- **Background rects** (`RegisterBackgroundRect`, `SaveBackgroundRects`,
  `RestoreBackgroundRects`, `InvalidateBackgroundRects`, `UpdateSaveBuffer`) snapshot the
  static world behind moving objects. When a soldier moves, the engine restores the saved
  background under him, then re-blits him at the new position — this is how the dynamic pass
  avoids re-rendering the whole static world. `BACKGROUND_BUFFERS=1500` slots.
  Flags: `BGND_FLAG_PERMANENT`, `BGND_FLAG_SINGLE`, `BGND_FLAG_SAVE_Z`, `BGND_FLAG_MERC`,
  `BGND_FLAG_SAVERECT`, `BGND_FLAG_TOPMOST`, `BGND_FLAG_ANIMATED`.
- **Video overlays** (`RegisterVideoOverlay`, `ExecuteVideoOverlays`, `VIDEO_OVERLAYS=100`)
  are topmost text/UI blitters (soldier names, AP costs) drawn after the world.

**Web recipe:** the SVG renderer already gets this for free (React re-renders only changed
nodes). For Canvas, keep an offscreen "static layer" canvas (land+objects+structures+roofs)
and blit it under a dynamic layer (units, smoke, explosions) each frame — the exact analogue
of `SaveBackgroundRects`/`RestoreBackgroundRects`. For WebGL, render the static world to a
texture once per camera move and composite dynamic sprites over it.

---

## 6. Structures and Structure Internals

### 6.1 Data model (`Structure Internals.h`)

A large object (building, tree, vehicle) is split into **DB_STRUCTURE_TILE** sections, one
per map tile. Each section is a separate `STRUCTURE` instance in the world; only the **base
tile** (`STRUCTURE_BASE_TILE`) carries hit points.

```c
typedef struct {                    // DB_STRUCTURE_TILE — 32 bytes
    INT16  sPosRelToBase;           // "single-axis" offset
    INT8   bXPosRelToBase, bYPosRelToBase;   // tile offset from base
    PROFILE Shape;                  // UINT8[5][5] LOS/cover profile
    UINT8  fFlags;                  // TILE_ON_ROOF | TILE_PASSABLE
    UINT8  ubVehicleHitLocation;
} DB_STRUCTURE_TILE;

typedef struct {                    // DB_STRUCTURE — 16 bytes
    UINT8  ubArmour;  UINT8  ubHitPoints;  UINT8  ubDensity;  UINT8  ubNumberOfTiles;
    UINT32 fFlags;    UINT16 usStructureNumber;  UINT8  ubWallOrientation;
    INT8   bDestructionPartner;     // >0 debris, <0 partner graphic
    INT8   bPartnerDelta;           // opened/closed partner
    INT8   bZTileOffsetX, bZTileOffsetY;   // z-anchor offset for multi-tile
} DB_STRUCTURE;

typedef struct {                    // STRUCTURE — 36 bytes, one per occupied tile
    struct TAG_STRUCTURE *pPrev, *pNext;
    DB_STRUCTURE_REF *pDBStructureRef;
    PROFILE *pShape;
    UINT32  fFlags;                 // STRUCTURE_* flags
    INT32   sGridNo;
    union { struct { UINT8 ubHitPoints; UINT8 ubLockStrength; }; INT32 sBaseGridNo; };
    UINT16  usStructureID;
    INT16   sCubeOffset;            // bottom height in profile cubes
    UINT8   ubWallOrientation;
    UINT8   ubVehicleHitLocation;
    UINT8   ubStructureHeight;
    UINT8   ubDecalFlag;
} STRUCTURE;
```

`AddPosRelToBase(base, tile)` = `base + bXPosRelToBase + bYPosRelToBase*WORLD_COLS`.
Structures are stored in `.JSD` files (`STRUCTURE_FILE_ID "J2SD"`, header
`STRUCTURE_FILE_HEADER` in `Structure Internals.h`), loaded by `LoadStructureFile()`.

### 6.2 Physics / hit-test flags (`structure.h`)

Blocking values returned by `GetBlockingStructureInfo()`:

```
NOTHING_BLOCKING=0  BLOCKING_REDUCE_RANGE=1  BLOCKING_NEXT_TILE=10
BLOCKING_TOPLEFT_WINDOW=30  BLOCKING_TOPRIGHT_WINDOW=40
BLOCKING_TOPLEFT_DOOR=50  BLOCKING_TOPRIGHT_DOOR=60  FULL_BLOCKING=70
BLOCKING_TOPLEFT_OPEN_WINDOW=90  BLOCKING_TOPRIGHT_OPEN_WINDOW=100
```

`STRUCTURE_*` flags (`Structure Internals.h`): `STRUCTURE_BASE_TILE`, `STRUCTURE_OPEN`,
`STRUCTURE_OPENABLE` (=`CLOSEABLE`=`SEARCHABLE`), `STRUCTURE_HIDDEN`, `STRUCTURE_MOBILE`,
`STRUCTURE_PASSABLE`, `STRUCTURE_EXPLOSIVE`, `STRUCTURE_TRANSPARENT`, `STRUCTURE_GENERIC`,
`STRUCTURE_TREE`, `STRUCTURE_FENCE`, `STRUCTURE_WIREFENCE`, `STRUCTURE_HASITEMONTOP`,
`STRUCTURE_SPECIAL`, `STRUCTURE_LIGHTSOURCE`, `STRUCTURE_VEHICLE`, `STRUCTURE_WALL`,
`STRUCTURE_WALLNWINDOW`, `STRUCTURE_SLIDINGDOOR`, `STRUCTURE_DOOR`, `STRUCTURE_MULTI`,
`STRUCTURE_CAVEWALL`, `STRUCTURE_DDOOR_LEFT/RIGHT`, `STRUCTURE_NORMAL_ROOF`,
`STRUCTURE_SLANTED_ROOF`, `STRUCTURE_TALL_ROOF`, `STRUCTURE_SWITCH`,
`STRUCTURE_ON_LEFT_WALL`, `STRUCTURE_ON_RIGHT_WALL`, `STRUCTURE_CORPSE`, `STRUCTURE_PERSON`.
Combos: `STRUCTURE_ANYFENCE`, `STRUCTURE_ANYDOOR`, `STRUCTURE_OBSTACLE`, `STRUCTURE_WALLSTUFF`,
`STRUCTURE_BLOCKSMOVES`, `STRUCTURE_ROOF`.

The **LOS profile** is a `PROFILE[5][5]` per tile (5×5 horizontal × 4 vertical "cubes",
`PROFILE_X_SIZE=5, PROFILE_Y_SIZE=5, PROFILE_Z_SIZE=4`). `STRUCTURE_ON_GROUND=0`,
`STRUCTURE_ON_ROOF=4`. `AtHeight[4]` maps cube index → world height.

### 6.3 Hit-testing

`FindStructure(gridno, flags)` walks `MAP_ELEMENT.pStructureHead`; `FindStructureByID()`,
`FindBaseStructure()`, `GetBaseTile()`, `StructureHeight()`, `StructureDensity()` support
targeting and cover. `DamageStructure()` (`structure.h`) applies damage with a material
armour type from the `MATERIAL_*` enum (`MATERIAL_WOOD_WALL`, `MATERIAL_STONE`,
`MATERIAL_CONCRETE1/2`, `MATERIAL_ROCK`, `MATERIAL_SANDBAG`, `MATERIAL_LIGHT_METAL`,
`MATERIAL_THICKER_METAL`, `MATERIAL_HEAVY_METAL`, `MATERIAL_INDESTRUCTABLE_*`, …).
`OkayToAddStructureToWorld()` validates a placement against existing structures before
`AddStructureToWorld()`.

**Web recipe:** `game/buildings.js` already models the equivalent: `buildBuilding()` emits
per-tile `{type:'wall'|'floor'|'door'|'window', blocked, blocksSight, cover, material,
buildingId, roomId}` and `placeBuilding()` splices them over the ground tiles. The C++
`STRUCTURE`/`DB_STRUCTURE` maps to `building` + per-tile `buildingId`; `blocksSight` maps to
the `PROFILE`; `cover` maps to `ubDensity`. Doors map to `STRUCTURE_DOOR` +
`bPartnerDelta` (open/closed partner graphic).

---

## 7. Buildings (`Buildings.h`)

```c
typedef struct BUILDING {
    INT32 sUpClimbSpots[MAX_CLIMBSPOTS_PER_BUILDING];    // 255
    INT32 sDownClimbSpots[MAX_CLIMBSPOTS_PER_BUILDING];  // 255
    UINT8 ubNumClimbSpots;
} BUILDING;
```

`gubBuildingInfo[WORLD_MAX]` maps each cell to a building index (`NO_BUILDING=0`,
`MAX_BUILDINGS=255`). `GenerateBuildings()` scans the world for roofed structures and builds
climb-spot lists; `InBuilding(gridno)`, `FindBuilding(gridno)`, `SameBuilding(a,b)`,
`FindClosestClimbPoint()` support roof access. Rooms are tracked separately in
`Render Fun.cpp`: `gubWorldRoomHidden[MAX_ROOMS]` (hidden-room flags) and
`gusWorldRoomInfo[WORLD_MAX]` (room number per cell, `MAX_ROOMS=65530`). `RemoveRoomRoof()`
hides a room's roof tiles when a soldier enters; `InARoom()`/`InAHiddenRoom()` query it.

**Web recipe:** `web/app/TacticalScene.tsx` + `TacticalBuildings.tsx` already implement the
room-roof mechanic: each building has `rooms:[{id, cells}]`, and a room's roof polygon is
only drawn when `revealed.has(room.id)` (driven by `visibleRooms()` in `game/tactical.js`).
The C++ `RemoveRoomRoof`/`gubWorldRoomHidden` is the same concept.

---

## 8. Interactive Tiles (`Interactive Tiles.h`)

Interactive tiles are doors, windows, switches and other clickable structures. Constants:
`INTTILE_DOOR_TILE_ONE=1`, `INTTILE_DOOR_OPENSPEED=70` (animation speed),
`INTILE_CHECK_FULL=1`, `INTILE_CHECK_SELECTIVE=2`.

Flow: `AddInteractiveTile(gridno, levelnode, flags, type)` registers a node;
`CompileInteractiveTiles()` rebuilds the list; each frame the dynamic render pass calls
`BeginCurInteractiveTileCheck()` → `LogMouseOverInteractiveTile(gridno)` (only when
`ShouldCheckForMouseDetections()`) → `EndCurInteractiveTileCheck()`. The hovered node is
retrieved with `GetCurInteractiveTileGridNoAndStructure()`. Interaction:
`StartInteractiveObject()` / `InteractWithInteractiveObject()` animate the door via
`SwapStructureForPartner()` (`structure.h`), which swaps the closed graphic for the open
partner (`bPartnerDelta`). `GetLevelNodeScreenRect()` computes the clickable screen rect of
a node (used for cursor hit-testing).

**Web recipe:** `web/app/Battlefield.tsx` `tileClick()` handles `t.type==='door'` by
dispatching `{type:'door', doorId}`; `game/tactical.js` flips `tile.blocked` and the
`open` flag. The C++ `SwapStructureForPartner` is the same state flip plus a graphic swap.

---

## 9. Exit Grids and Map Edgepoints

### 9.1 Exit Grids (`Exit Grids.h`)

```c
class EXITGRID {
    INT32 iMapIndex;        // gridno of the exit marker
    INT32 usGridNo;         // "sweet spot" where mercs appear in the destination sector
    UINT8 ubGotoSectorX, ubGotoSectorY, ubGotoSectorZ;
};
```

Exit grids are stored as `LEVELNODE`s with `LEVELNODE_EXITGRID` in the **shadow layer** of
the source cell. `AddExitGridToWorld()`, `RemoveExitGridFromWorld()`, `GetExitGrid()`,
`ExitGridAtGridNo()`. `SaveExitGrids()`/`LoadExitGrids()` serialize them (see §14).
`FindGridNoFromSweetSpotCloseToExitGrid()` finds a valid spawn near the destination.

### 9.2 Map Edgepoints (`Map Edgepoints.h`)

Edgepoints are precomputed valid spawn cells along each map edge, used by the tactical
placement GUI and strategic insertion.

```c
typedef struct MAPEDGEPOINTINFO {
    UINT8 ubNumPoints;
    UINT8 ubStrategicInsertionCode;
    INT32 sGridNo[LARGEST_NUMBER_IN_ANY_GROUP];
} MAPEDGEPOINTINFO;
```

`GenerateMapEdgepoints()` fills dynamic arrays per edge: `gps1stNorth/East/South/WestEdgepointArray`
(primary, easily accessible) and `gps2nd*` (secondary, isolated), plus a center array.
Each has a `*Size` and a `*MiddleIndex` (start of the inner row). Insertion codes:
`INSERTION_CODE_NORTH/EAST/SOUTH/WEST/CENTER/CHOPPER/GRIDNO/PRIMARY_EDGEINDEX/SECONDARY_EDGEINDEX`.
`ChooseMapEdgepoint()` picks a random valid point; `SearchForClosestPrimaryMapEdgepoint()`
finds the nearest to a gridno. `CalcMapEdgepointClassInsertionCode()` decides primary vs
secondary. Hardcoded screen rects for the placement GUI: `CENTERENTRYPTS_*` and
`AIRDROPENTRYPTS_*` (634×320 tactical screen).

**Web recipe:** `game/maps.js` `buildSectorMap()` already computes spawns via `choose()`
(preferred side + nearest-to-preferred + not-reserved), which is the web analogue of
`ChooseMapEdgepoints` + `SearchForClosestPrimaryMapEdgepoint`. The `squad`/`enemies`/
`artillery` arrays are the edgepoint consumers.

---

## 10. Explosion Control (`Explosion Control.h`)

```c
typedef struct {
    UINT32 uiFlags;      // EXPLOSION_FLAG_USEABSPOS | EXPLOSION_FLAG_DISPLAYONLY
    SoldierID ubOwner;
    INT8  ubTypeID;      // index into gExpAniData[]
    UINT16 usItem;       // explosive item
    INT16 sX, sY, sZ;    // world position (optional)
    INT32 sGridNo;
    BOOLEAN fLocate;
    INT8  bLevel;        // ground or roof level
} EXPLOSION_PARAMS;

typedef struct {
    EXPLOSION_PARAMS Params;
    BOOLEAN fAllocated;
    INT16  sCurrentFrame;
    INT32  iID;
    INT32  iLightID;     // attached light sprite
} EXPLOSIONTYPE;         // gExplosionData[NUM_EXPLOSION_SLOTS=100]
```

Explosion types (`EXPLOSION_TYPES`): `NO_BLAST`, `BLAST_1..3`, `STUN_BLAST`, `WATER_BLAST`,
`TARGAS_EXP`, `SMOKE_EXP`, `MUSTARD_EXP`, `BURN_EXP`, `THERMOBARIC_EXP`, `FLASHBANG_EXP`,
`ROOF_COLLAPSE`, `ROOF_COLLAPSE_SMOKE`, `NUM_EXP_TYPES=50`. Each type has an
`EXPLOSION_DATA` entry: `ubTransKeyFrame` (translucency starts), `ubDamageKeyFrame`
(damage applied), sound IDs, `zBlastFilename[70]` (the `.sti` animation), `sBlastSpeed`.

Flow: `IgniteExplosion()` → `InternalIgniteExplosion()` → `GenerateExplosion()` allocates a
slot, creates an `ANITILE` (`ANITILE_EXPLOSION`) for the blast animation, and creates a
light. `UpdateExplosionFrame()` advances the animation; `RemoveExplosionData()` frees it.
`SpreadEffect()` creates smoke/gas clouds (see §11). `ExplosiveDamageGridNo()` damages
structures within `MAX_DISTANCE_EXPLOSIVE_CAN_DESTROY_STRUCTURES=2`. `RoofDestruction()` /
`HandleRoofDestruction()` collapse roofs. `AddBombToQueue()`/`DecayBombTimers()` handle
timed bombs.

**Web recipe:** the web game has no explosion animation yet — `game/tactical.js` applies
damage directly. To port: spawn a transient sprite object with `sCurrentFrame` advancing on
a timer, keyframe hooks for damage (`ubDamageKeyFrame`) and translucency
(`ubTransKeyFrame`), and a light that fades with the blast. The `ANITILE` machinery in
`Tile Animation.h` (`CreateAnimationTile`, `UpdateAniTiles`, `SetAniTileFrame`) is the
generic animated-tile system that drives explosions, smoke, doors and fire.

---

## 11. Smoke, Smell, and Light Effects

### 11.1 SmokeEffects (`SmokeEffects.h`)

```c
typedef struct TAG_SMOKE_EFFECT {
    INT32 sGridNo;          // cloud center
    UINT8 ubDuration;       // turns remaining
    UINT8 ubRadius;         // cloud radius in tiles
    UINT8 bFlags;           // SMOKE_EFFECT_INDOORS | SMOKE_EFFECT_ON_ROOF | SMOKE_EFFECT_MARK_FOR_UPDATE
    UINT8 bAge;
    BOOLEAN fAllocated;
    INT8  bType;            // NORMAL/TEARGAS/MUSTARDGAS/CREATURE/BURNABLEGAS/SIGNAL/DEBRIS/FIRERETARDANT
    UINT16 usItem;
    SoldierID ubOwner;
    UINT8 ubGeneration;
    UINT32 uiTimeOfLastUpdate;
} SMOKEEFFECT;              // gSmokeEffectData[NUM_SMOKE_EFFECT_SLOTS=25]
```

`NewSmokeEffect()` allocates a cloud; `AddSmokeEffectToTile()` stamps the cell's
`MAPELEMENT_EXT_*` flags; `DecaySmokeEffects()` shrinks/expires clouds over time;
`UpdateSmokeEffectGraphics()` re-renders the animated smoke tiles (`ANITILE_SMOKE_EFFECT`).
`GetSmokeEffectOnTile()` queries. Smoke is drawn as an animated translucent tile at
`OBJECT_Z_LEVEL` (see `StructZLevel` macro in `Render Z.h`).

### 11.2 Smell (`Smell.h`)

Smell and blood are packed into `MAP_ELEMENT.ubSmellInfo` / `ubBloodInfo`:

```
SMELL_TYPE_NUM_BITS=2
SMELL_TYPE(s)     = s & 0x01          // HUMAN=0, CREATURE_ON_FLOOR=1, CREATURE_ON_ROOF=2
SMELL_STRENGTH(s) = (s & 0xFC) >> 2
NORMAL_HUMAN_SMELL_STRENGTH=10  COW_SMELL_STRENGTH=15  NORMAL_CREATURE_SMELL_STRENGTH=20
MAXBLOODQUANTITY=7  BLOODDIVISOR=10
```

`DropSmell()`/`DropBlood()` write the cell; `DecayBloodAndSmells()` decays over time;
`UpdateBloodGraphics()` swaps the blood decal tile. Blood is a decal on the land layer.

### 11.3 LightEffects (`LightEffects.h`)

```c
typedef struct {
    INT32 sGridNo;
    UINT8 ubDuration;  UINT8 bRadius;  UINT8 bAge;
    BOOLEAN fAllocated;  INT8 bType;
    INT32 iLight;       // light sprite id
    UINT32 uiTimeOfLastUpdate;
    INT32 flags;        // LIGHTEFFECT_FLASHLIGHT
    SoldierID ubOwner;
} LIGHTEFFECT;
```

`NewLightEffect()` creates a temporary light (flares, explosions); `AddLightEffectToTile()`,
`DecayLightEffects()`, `RemoveLightEffectFromTile()`. `CreatePersonalLight()`/`RemovePersonalLights()`
attach lights to soldiers (torches, flashlights).

### 11.4 The lighting system itself (`lighting.h`)

Tile-based, ray-cast lighting. Each light template (`LTO1.LHT`…`LTO8.LHT`,
`MAX_LIGHT_TEMPLATES=32`) is a precomputed linked list of `LIGHT_NODE {iDX, iDY, uiFlags,
ubLight}` offsets with `LIGHT_NEW_RAY` markers. At runtime `LightDraw()` walks the list,
skipping rays blocked by opaque tiles, and adds `ubLight` to each cell's shade level.
`LIGHT_DECAY=0.9` shade per tile distance; `DISTANCE_SCALE=4`. `LIGHT_SPRITE` instances
(`MAX_LIGHT_SPRITES=4096`) are positioned with `LightSpritePosition()` and rendered by
`LightSpriteRenderAll()`. `LightSetBaseLevel()` sets the ambient; `ubAmbientLightLevel` is
the global ambient (day `NORMAL_LIGHTLEVEL_DAY=3`, night `NORMAL_LIGHTLEVEL_NIGHT=12` —
higher is darker). `LightTrueLevel()` returns the effective shade at a tile.

**Web recipe:** `game/tactical.js` `tileIllumination()` already computes per-tile light
(used by `TacticalScene.tsx` as `light(x,y)` brightness filters and the night overlay).
The C++ shade-level model (0..15, `SHADE_MIN=15` darkest, `SHADE_MAX=1` lightest) maps
directly to a brightness multiplier; `DEFAULT_SHADE_LEVEL=4` is daytime ground truth.

---

## 12. Fog of War (`Fog Of War.h` / `Fog Of War.cpp`)

The header is tiny: `RemoveFogFromGridNo(gridno)` — when line of sight reaches a cell, any
light sprite there is powered on and drawn (used in caves). The real fog state lives in the
`MAPELEMENT_REVEALED` / `MAPELEMENT_REVEALED_ROOF` flags and the revealed-map array
(`gpRevealedMap`, `NUM_REVEALED_BYTES`, saved by `SaveRevealedStatusArrayToRevealedTempFile()`
in `SaveLoadMap.cpp`). Hidden tiles are rendered with `LEVELNODE_REVEAL` → the "pixelate"
effect (`fPixelate` in `RenderTiles`). `SetGridNoRevealedFlag()` (`Render Fun.cpp`) marks a
cell revealed; `SetRecalculateWireFrameFlagRadius()` triggers wireframe (roof-outline)
recomputation. `CalculateWorldWireFrameTiles()` (`worlddef.cpp`) builds the roof wireframe
tiles that show building outlines through fog.

**Web recipe:** `web/app/TacticalScene.tsx` renders fog as a dark overlay per tile
(`s.night` + `tileIllumination`), and `showSight` toggles a sight overlay from
`visibleTiles()` in `game/tactical.js`. The C++ `MAPELEMENT_REVEALED` + wireframe-roof
system is the fidelity target: revealed-but-not-visible tiles should show a roof outline,
not full detail.

---

## 13. Radar Screen (`Radar Screen.h` / `Radar Screen.cpp`)

The radar is a small top-down minimap of the sector. Constants (computed at init):

```
RADAR_WINDOW_WIDTH=88   RADAR_WINDOW_HEIGHT=44
RADAR_WINDOW_TM_X = xResOffset + (xResSize-97) + 223   // tactical mode
RADAR_WINDOW_SM_X = xResOffset + (xResSize-97)         // strategic mode
RADAR_WINDOW_TM_Y = INTERFACE_START_Y + 13
RADAR_WINDOW_SM_Y = INV_INTERFACE_START_Y + 33 (or +116 with new inventory)
```

`LoadRadarScreenBitmap()` loads the pre-rendered terrain bitmap; `RenderRadarScreen()`
blits it and draws soldier dots; `RadarRegionMoveCallback()`/`RadarRegionButtonCallback()`
convert radar clicks to world scrolls (`sRadarX = RelativeXPos - WIDTH/2` scaled by
`WORLD_COLS/WIDTH`). `fRenderRadarScreen` toggles radar vs squad list.

**Web recipe:** `web/app/TacticalMinimap.tsx` is the existing equivalent — an SVG that
projects every tile with the same `project()` function and draws unit dots + a camera
viewport rect. It already supports click-to-center and arrow-key panning. The C++ radar's
88×44 aspect (2:1) matches the isometric diamond; the web minimap uses the full projected
canvas instead, which is strictly more informative.

---

## 14. SaveLoadMap.dat format (`worlddef.cpp` `SaveWorld()`)

The `.dat` map file is a flat binary stream. Order of fields (all little-endian):

| # | Field | Type | Notes |
|---|---|---|---|
| 1 | `dMajorMapVersion` | `FLOAT` | `MAJOR_MAP_VERSION=8.0` |
| 2 | `ubMinorMapVersion` | `UINT8` | `MINOR_MAP_VERSION=31` (only if major ≥ 4.00) |
| 3 | `WORLD_ROWS`, `WORLD_COLS` | `INT32` ×2 | skipped for vanilla 5.00/25 |
| 4 | `uiFlags` | `INT32` | `MAP_FULLSOLDIER_SAVED \| MAP_EXITGRIDS_SAVED \| MAP_WORLDLIGHTS_SAVED \| MAP_DOORTABLE_SAVED \| MAP_WORLDITEMS_SAVED \| MAP_EDGEPOINTS_SAVED \| MAP_AMBIENTLIGHTLEVEL_SAVED \| MAP_NPCSCHEDULES_SAVED` |
| 5 | `giCurrentTilesetID` | `INT32` | tileset index |
| 6 | `uiSoldierSize` | `INT32` | `SIZEOF_SOLDIERTYPE_POD` |
| 7 | heights | `INT16` × `WORLD_MAX` | per-cell `sHeight` |
| 8 | land/flag combo | `UINT8` × `WORLD_MAX` | `(landCount&0xf) \| ((uiFlags&0xf)<<4)` |
| 9 | object/struct combo | `UINT8` × `WORLD_MAX` | `(objectCount&0xf) \| ((structCount&0xf)<<4)` |
| 10 | shadow/roof combo | `UINT8` × `WORLD_MAX` | `(shadowCount&0xf) \| ((roofCount&0xf)<<4)` |
| 11 | onroof combo | `UINT8` × `WORLD_MAX` | `onroofCount&0xf` |
| 12 | land layers | `(UINT8 type, UINT8 subIndex)` × count | written **backwards** (tail→head) |
| 13 | object layers | `(UINT8 type, UINT16 subIndex)` × count | 16-bit subindex (ROADPIECES >256) |
| 14 | struct layers | `(UINT8 type, UINT8 subIndex)` × count | |
| 15 | shadow layers | `(UINT8 type, UINT8 subIndex)` × count | |
| 16 | roof layers | `(UINT8 type, UINT8 subIndex)` × count | `SLANTROOFCEILING1` skipped |
| 17 | onroof layers | `(UINT8 type, UINT8 subIndex)` × count | |
| 18 | room info | `UINT16` × `WORLD_MAX` | `UINT8` if minor < 29 |
| 19 | items | `SaveWorldItemsToMap()` | if `MAP_WORLDITEMS_SAVED` |
| 20 | ambient | `gfBasement, gfCaves, ubAmbientLightLevel` (1 byte each) | if `MAP_AMBIENTLIGHTLEVEL_SAVED` |
| 21 | map lights | `SaveMapLights()` | if `MAP_WORLDLIGHTS_SAVED` |
| 22 | map info | `SaveMapInformation()` | sector coords, name, etc. |
| 23 | soldiers | `SaveSoldiersToMap()` | if `MAP_FULLSOLDIER_SAVED` |
| 24 | exit grids | `SaveExitGrids()` | if `MAP_EXITGRIDS_SAVED` |
| 25 | door table | `SaveDoorTableToMap()` | if `MAP_DOORTABLE_SAVED` |
| 26 | edgepoints | `SaveMapEdgepoints()` | if `MAP_EDGEPOINTS_SAVED` |
| 27 | NPC schedules | `SaveSchedules()` | if `MAP_NPCSCHEDULES_SAVED` |

`LoadWorld()` (`worlddef.cpp:2807`) reads the same stream in order, using the count nibbles
to know how many `(type, subIndex)` pairs to read per cell per layer. `SaveMapLights()` writes
`ubNumColors` + palette entries, then `usNumLights` + `LIGHT_SPRITE` structs + template name
strings. `SaveExitGrids()` writes `usNumExitGrids` then `EXITGRID` records.

**Web recipe:** the web game does **not** load `.dat` files — `game/maps.js` authors maps
procedurally as `{width, height, tiles:[{x,y,type,blocked,cover,...}], buildings, lights,
decor}`. If `.dat` loading is ever needed, the tile `type` byte + `subIndex` pair maps to
`gTileTypeStartIndex[type] + subIndex` → `gTileDatabase` index → sprite. The count-nibble
scheme means a parser must read the four combo arrays first, then skip to each layer's data
section.

---

## 15. Tactical Placement GUI (`Tactical Placement GUI.h` / `.cpp`)

The pre-battle screen where the player positions mercs on the map. State:
`gfTacticalPlacementGUIActive`, `gfEnterTacticalPlacementGUI`, `gfTacticalPlacementGUIDirty`,
`gpTacticalPlacementSelectedSoldier`, `gpTacticalPlacementHilightedSoldier`,
`gubDefaultButton` (remembers last choice). Functions: `InitTacticalPlacementGUI()`,
`RenderTacticalPlacementGUI()`, `TacticalPlacementHandle()`, `KillTacticalPlacementGUI()`.

Behavior:
- Mercs are placed by **insertion code** (`INSERTION_CODE_NORTH/EAST/SOUTH/WEST/CENTER/CHOPPER/GRIDNO`).
  `FindValidInsertionCode()`/`CheckForValidMapEdge()` validate the chosen edge against the
  map; `GetValidInsertionDirectionForMP()` picks the next valid direction.
- `ChooseRandomEdgepoints()` assigns random edgepoints; `PlaceMercs()` commits positions.
- `PLACEMENT_OFFSET=150` px keeps placements inside the map bounds.
- `HandleTacticalPlacementClicksInOverheadMap()` lets the player click the radar/overhead
  map to place a merc at a specific gridno (`INSERTION_CODE_GRIDNO`).
- `SpreadPlacementsCallback`/`GroupPlacementsCallback`/`ClearPlacementsCallback` are the
  auto-arrange buttons.

**Web recipe:** the web game currently auto-deploys via `buildSectorMap()`'s `choose()`
function. A placement GUI would reuse `game/maps.js` spawn logic + `TacticalMinimap.tsx`
click-to-place, with the insertion-code enum as the data model.

---

## 16. Shade Table Util — palette lighting (`Shade Table Util.h` / `.cpp`)

The 8bpp sprites are shaded by **palette remapping**, not alpha. Each tile surface gets 16
shade tables (`pObj->pShades[16]`), each a 512-byte lookup (`256 entries × UINT16` 16bpp
color). `ubShadeLevel` (0..15) on the `LEVELNODE` selects the table. `DEFAULT_SHADE_LEVEL=4`
is the unshaded daytime level; higher = darker (`SHADE_MIN=15` darkest, `SHADE_MAX=1`
lightest in `lighting.h`).

- `BuildTileShadeTables()` (`worlddef.cpp:626`) generates tables for all loaded surfaces.
- `LoadShadeTable()`/`SaveShadeTable()` persist them as `.sha` files in `ShadeTables/`
  (one per tile surface, 16×512 bytes).
- `DetermineRGBDistributionSettings()` stores the display's RGB bit masks in `RGBDist.dat`
  and wipes tables if the display mode changed.
- `CreateTilePaletteTables()` (`lighting.h`) is the per-tile entry point.

**Web recipe:** the web renderer uses CSS `filter: brightness()` per sprite group
(`TacticalScene.tsx` `light(x,y)`). For pixel fidelity, precompute 16 brightness/color
variants of each sprite atlas (or a WebGL palette-texture lookup) and select by shade level.
The shade level per tile = ambient + sum of light contributions, clamped to 1..15.

---

## 17. Web implementation recipes (summary)

| C++ system | File | Web equivalent | Fidelity gap |
|---|---|---|---|
| Diamond projection | `Isometric Utils.cpp` | `Battlefield.tsx` `project()` (hw=26,hh=14) | Use hw=40,hh=20 scale |
| Layer stack | `worlddef.h` `pLevelNodes[9]` | `TacticalScene.tsx` `objects[]` + `depth=x+y+bias` | Add explicit layer bias per C++ order |
| Z-buffer | `renderworld.cpp` `gpZBuffer` | painter's sort | WebGL depth = `worldY*8+layer` |
| Static/dynamic split | `Render Dirty.cpp` background rects | offscreen static canvas | none (React re-render ok) |
| Structures | `Structure Internals.h` | `game/buildings.js` | add `blocksSight`/`cover` per tile (done) |
| Roof hiding | `Render Fun.cpp` `RemoveRoomRoof` | `TacticalBuildings.tsx` `revealed` | done |
| Interactive tiles | `Interactive Tiles.h` | `Battlefield.tsx` `tileClick` door | done |
| Exit grids | `Exit Grids.h` | `buildSectorMap` spawns | add explicit exit-grid objects |
| Edgepoints | `Map Edgepoints.h` | `choose()` in `maps.js` | done |
| Explosions | `Explosion Control.h` | none | add ANITILE-style animation |
| Smoke | `SmokeEffects.h` | `s.smoke` ellipses in `TacticalScene.tsx` | add decay + radius growth |
| Smell/blood | `Smell.h` | none | add blood decals |
| Light effects | `LightEffects.h` | `s.lights` lanterns | add flares |
| Lighting | `lighting.h` | `tileIllumination()` | add shade-level palette |
| Fog of war | `Fog Of War.cpp` | night overlay + `showSight` | add revealed-roof wireframes |
| Radar | `Radar Screen.cpp` | `TacticalMinimap.tsx` | done |
| Map format | `worlddef.cpp` `SaveWorld` | `game/maps.js` authored | add `.dat` parser if needed |
| Placement GUI | `Tactical Placement GUI.cpp` | auto-deploy | add click-to-place |
| Shade tables | `Shade Table Util.cpp` | CSS brightness | precompute 16 palettes |

---

## 18. Existing web map coverage (reference)

- **`game/maps.js`** — `buildSectorMap()` authors 15 deterministic maps (`MAP_IDS`), each
  `WIDTH=20 × HEIGHT=16` = 320 tiles. Tile shape: `{x, y, type, blocked, cover}` with types
  `grass, stone, road, mud, water, forest, wall, door, window, floor`. Buildings via
  `placeBuilding()` (`game/buildings.js`): per-tile `buildingId`/`roomId`, `doors[]`,
  `windows[]`, `material`, `roof`. Also emits `decor`, `lights`, `squad`, `enemies`,
  `artillery`.
- **`web/app/Battlefield.tsx`** — the tactical screen: `project()`, camera pan/zoom,
  `diamond()` polygon, unit motion, HUD.
- **`web/app/TacticalScene.tsx`** — SVG scene: terrain patterns, walls/doors/windows,
  roofs, trees, units, smoke ellipses, lights, depth-sorted `objects[]`.
- **`web/app/TacticalBuildings.tsx`** — wall segments + roof polygons with room cutaways.
- **`web/app/TacticalMinimap.tsx`** — radar equivalent.
- **`web/app/TacticalProps.tsx`** — `buildPropObjects()` scenery props.
- **`web/app/SpriteFigure.tsx`** + **`useUnitMotion.ts`** — articulated unit sprites.
- **Tests:** `tests/maps-web.test.mjs` (15 unique deterministic maps, collision-free
  connected spawns, San Lorenzo convent interior/doors/windows, river sectors, Andean
  cliffs, unknown-map rejection, tactical-engine consumption); `tests/buildings.test.mjs`
  (walkable interiors, independent double doors, window sight, night roof hiding);
  `tests/lighting.test.mjs` (night illumination); `tests/save-web.test.mjs` (malformed
  tiles rejected before rendering); `tests/world-web.test.mjs` (tile mutation persistence).
- **Assets:** `docs/TACTICAL-VISUALS.md` documents the terrain/scenery/unit art pipeline
  (`terrain-{name}-v1.webp` patterns, `scenery-*-v1.webp` sprites, `SpriteFigure` rigs).

---

## 19. Reproduction checklist

Use this to verify a pixel-faithful web isometric renderer:

1. **Projection:** a tile at cell (0,0) renders as a 40×20 diamond; cell (1,0) is 40px right
   and 20px down; cell (0,1) is 40px left and 20px down. Verify against
   `FromCellToScreenCoordinates`.
2. **GridNo math:** `MAPROWCOLTOPOS(5,3)` = `5*WORLD_COLS+3`; `ConvertGridNoToXY` round-trips.
3. **Layer order:** land → objects → shadows → structures → roofs → on-roof → topmost.
   A wall tile must occlude a soldier behind it; a roof must occlude the room below until
   the room is revealed.
4. **Z-buffer:** two structures on the same cell — the one with the larger `worldY` (further
   south) draws on top; equal z "burns through" for same-layer tiles.
5. **Height:** a cell with `sHeight=80` (one cliff) draws its tiles 80 world-units higher;
   `sModifiedTileHeight` clamps correctly.
6. **Animation:** doors animate through `sCurrentFrame` frames at `INTTILE_DOOR_OPENSPEED`;
   explosions advance `sCurrentFrame` and trigger damage at `ubDamageKeyFrame`.
7. **Lighting:** daytime ambient = shade 4; night = 12; a lantern adds light with
   `LIGHT_DECAY=0.9` per tile; shade selects one of 16 palette tables.
8. **Fog:** unrevealed tiles render pixelated; revealed-but-unseen buildings show roof
   wireframes; `RemoveFogFromGridNo` powers on cave lights.
9. **Radar:** 88×44 minimap (or web equivalent) shows terrain + unit dots; clicking it
   scrolls the main viewport.
10. **Map load:** a `.dat` parser (if built) reads the §14 field order and count-nibble
    scheme; the web `buildSectorMap()` output must remain the primary map source.
11. **Placement:** insertion codes N/E/S/W/CENTER/CHOPPER/GRIDNO all produce valid,
    collision-free, connected spawns (asserted by `tests/maps-web.test.mjs`).
12. **Dirty rects:** moving a unit does not re-render the whole static world — only the
    unit's old and new rects change (background-rect restore semantics).

---

## 20. Glossary

- **GridNo** — flat cell index `row*WORLD_COLS+col`.
- **Cell** — 10×10 world-unit logical tile; **map tile** — the 40×20 screen diamond.
- **LEVELNODE** — one sprite instance in a cell's layer list.
- **TILE_ELEMENT** — one entry in the tile database (sprite + flags + structure ref).
- **TILE_IMAGERY** — a loaded sprite sheet for a tile type.
- **Shade level** — 0..15 palette index; 4 = default day, 15 = darkest.
- **Z-buffer** — 16-bit per-pixel depth; `worldY*8 + layerLevel`.
- **RenderFX** — per-layer blitter profile (z-write, shadow, translucent, obscured).
- **ANITILE** — animated tile instance (doors, explosions, smoke, fire).
- **Insertion code** — strategic spawn edge (N/E/S/W/CENTER/CHOPPER/GRIDNO).
- **Edgepoint** — precomputed valid spawn cell on a map edge.
- **Exit grid** — a marker that teleports units to another sector.
- **Shade table** — 512-byte 16bpp palette remap for one shade level of one surface.