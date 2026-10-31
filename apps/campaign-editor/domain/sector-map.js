import { CampaignEditorRefusal, CampaignEditorRefusalCode } from './campaign-editor-refusal.ts';
const MAP_EDIT_LIMITS = Object.freeze({
  commands: 10000,
  brushCells: 4096,
  minimumBuildingSize: 3,
  maximumBuildingSize: 64,
});

export class SectorMap {
  #document;
  #geometry;

  /** @param {import("../../../packages/campaign-format/types.ts").PhysicalMap} document */
  constructor(document, geometry) {
    this.#document = geometry.migrateMapDocument(document);
    this.#geometry = geometry;
  }

  get id() {
    return this.#document.id;
  }
  get revision() {
    return this.#document.revision;
  }
  /** @returns {import("../../../packages/campaign-format/types.ts").PhysicalMap} */
  snapshot() {
    return structuredClone(this.#document);
  }

  #makeBuilding({
    id,
    x,
    y,
    width = 5,
    height = 5,
    name = 'Casa',
    material = 'adobe',
    kind,
    architecture,
    roof,
    wallFinish,
    roofFinish,
    doorStyle,
    windowStyle,
  }) {
    const { buildBuilding } = this.#geometry;
    if (
      ![x, y, width, height].every(Number.isInteger) ||
      x < 0 ||
      y < 0 ||
      width < MAP_EDIT_LIMITS.minimumBuildingSize ||
      height < MAP_EDIT_LIMITS.minimumBuildingSize ||
      width > MAP_EDIT_LIMITS.maximumBuildingSize ||
      height > MAP_EDIT_LIMITS.maximumBuildingSize
    ) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidBuildingDimensions);
    }
    const { building } = buildBuilding({
      id,
      x,
      y,
      width,
      height,
      name,
      material,
      architecture,
      roof: roof ?? (architecture ? undefined : 'tile'),
      doors: [{ x: x + Math.floor(width / 2), y: y + height - 1 }],
    });
    // A template without an architecture uses its authored kind and profile.
    // Do not let the gameplay helper's default house override that choice.
    if (architecture === undefined) {
      delete building.architecture;
    }
    return {
      ...building,
      ...Object.fromEntries(
        Object.entries({ kind, wallFinish, roofFinish, doorStyle, windowStyle }).filter(
          ([, value]) => value !== undefined,
        ),
      ),
      walls: building.walls,
    };
  }
  #commandEdge(building, command) {
    const { x, y, axis } = command;
    if (axis !== undefined) {
      return { x, y, axis };
    }
    const existing = building.walls.filter((wall) => wall.x === x && wall.y === y);
    if (existing.length === 1) {
      return { x, y, axis: existing[0].axis };
    }
    if (y === building.y + building.height - 1) {
      return { x, y: y + 1, axis: 'x' };
    }
    if (y === building.y) {
      return { x, y, axis: 'x' };
    }
    if (x === building.x) {
      return { x, y, axis: 'y' };
    }
    if (x === building.x + building.width - 1) {
      return { x: x + 1, y, axis: 'y' };
    }
    const horizontal = building.walls.some(
      (wall) => wall.axis === 'x' && wall.y === y && Math.abs(wall.x - x) === 1,
    );
    return { x, y, axis: horizontal ? 'x' : 'y' };
  }
  #entity(document, id) {
    const { LAYERS } = this.#geometry;
    for (const layer of LAYERS) {
      const index = document[layer].findIndex((entity) => entity.id === id);
      if (index >= 0) {
        return { layer, index, object: document[layer][index] };
      }
    }
    throw new CampaignEditorRefusal(CampaignEditorRefusalCode.ObjectNotFound, { id });
  }
  #children(document, building) {
    const { LAYERS } = this.#geometry;
    return LAYERS.filter((layer) => layer !== 'buildings')
      .flatMap((layer) => document[layer])
      .filter(
        (entity) =>
          entity.x >= building.x &&
          entity.x < building.x + building.width &&
          entity.y >= building.y &&
          entity.y < building.y + building.height,
      );
  }
  #buildingLevels(document, building) {
    const surfaces = (document.upperSurfaces ?? []).filter((s) => s.buildingId === building.id);
    const contains = (point) =>
      surfaces.some(
        (s) =>
          s.x === point.x &&
          s.y === point.y &&
          (s.tacticalLevel ?? 0) === (point.tacticalLevel ?? 0),
      );
    return {
      surfaces,
      links: (document.climbLinks ?? []).filter(
        (layer) => contains(layer.from) || contains(layer.to),
      ),
    };
  }
  #appendLevels(document, template, id, horizontalOffset, verticalOffset) {
    const shift = (point) => ({
      ...point,
      x: point.x + horizontalOffset,
      y: point.y + verticalOffset,
    });
    if (template.upperSurfaces?.length) {
      document.upperSurfaces ??= [];
      document.upperSurfaces.push(
        ...template.upperSurfaces.map((s) => ({
          ...shift(s),
          id: `${id}:${s.id}`,
          buildingId: id,
          ...(s.roomId ? { roomId: `${id}:${s.roomId}` } : {}),
        })),
      );
    }
    if (template.climbLinks?.length) {
      document.climbLinks ??= [];
      document.climbLinks.push(
        ...template.climbLinks.map((layer) => ({
          ...layer,
          id: `${id}:${layer.id}`,
          from: shift(layer.from),
          to: shift(layer.to),
        })),
      );
    }
  }
  #transform(document, id, { x, y, rotate = false }) {
    const { object: entity, layer } = this.#entity(document, id),
      old = {
        x: entity.x,
        y: entity.y,
        width: entity.width ?? entity.footprint?.width ?? 1,
        height: entity.height ?? entity.footprint?.height ?? 1,
      };
    const inside = layer === 'buildings' ? this.#children(document, entity) : [];
    const point = (point) => {
      const horizontalOffset = point.x - old.x,
        verticalOffset = point.y - old.y;
      return rotate
        ? { x: old.x + old.height - 1 - verticalOffset, y: old.y + horizontalOffset }
        : { x: point.x + (x - old.x), y: point.y + (y - old.y) };
    };
    for (const child of inside) {
      const at = point(child);
      if (rotate && child.footprint) {
        at.x -= child.footprint.height - 1;
      }
      Object.assign(child, at);
      if (rotate && child.footprint) {
        [child.footprint.width, child.footprint.height] = [
          child.footprint.height,
          child.footprint.width,
        ];
        child.rotation = ((child.rotation ?? 0) + 90) % 360;
        if (!child.rotation) {
          delete child.rotation;
        }
      }
    }
    for (const item of document.items.filter((item) => item.containerId)) {
      const container = document.props.find((point) => point.id === item.containerId);
      if (container) {
        item.x = container.x;
        item.y = container.y;
      }
    }
    if (layer === 'buildings') {
      const levels = this.#buildingLevels(document, entity);
      for (const surface of levels.surfaces) {
        Object.assign(surface, point(surface));
      }
      for (const link of levels.links) {
        link.from = { ...link.from, ...point(link.from) };
        link.to = { ...link.to, ...point(link.to) };
      }
      entity.walls = entity.walls.map((wall) =>
        rotate
          ? {
              ...wall,
              x: old.x + old.height - (wall.y - old.y) - (wall.axis === 'y' ? 1 : 0),
              y: old.y + wall.x - old.x,
              axis: wall.axis === 'x' ? 'y' : 'x',
            }
          : { ...wall, ...point(wall) },
      );
      entity.rooms = entity.rooms.map((room) => ({ ...room, cells: room.cells.map(point) }));
      if (rotate) {
        [entity.width, entity.height] = [entity.height, entity.width];
      } else {
        entity.x = x;
        entity.y = y;
      }
    } else {
      if (rotate && entity.footprint) {
        [entity.footprint.width, entity.footprint.height] = [
          entity.footprint.height,
          entity.footprint.width,
        ];
        entity.rotation = ((entity.rotation ?? 0) + 90) % 360;
        if (!entity.rotation) {
          delete entity.rotation;
        }
      }
      if (!rotate) {
        const horizontalOffset = x - entity.x,
          verticalOffset = y - entity.y;
        entity.x = x;
        entity.y = y;
        for (const item of document.items.filter((item) => item.containerId === id)) {
          item.x += horizontalOffset;
          item.y += verticalOffset;
        }
      }
    }
  }
  /** @param {readonly string[]} ids @returns {import("./sector-map-command.ts").MapSelection[]} */
  selectionRoots(ids, document = this.#document) {
    const { LAYERS } = this.#geometry;
    const selected = LAYERS.flatMap((layer) =>
      document[layer].map((object) => ({ ...object, layer })),
    ).filter((entity) => ids.includes(entity.id));
    return selected.filter(
      (entity) =>
        !selected.some(
          (parent) =>
            parent.id !== entity.id &&
            (entity.containerId === parent.id ||
              (parent.layer === 'buildings' &&
                entity.layer !== 'buildings' &&
                entity.x >= parent.x &&
                entity.x < parent.x + parent.width &&
                entity.y >= parent.y &&
                entity.y < parent.y + parent.height)),
        ),
    );
  }
  /** @param {readonly import("./sector-map-command.ts").SectorMapCommand[]} commands @returns {import("./sector-map-command.ts").SectorMapEditResult} */
  edit(commands, { expectedRevision = this.#document.revision } = {}) {
    const original = this.#document;
    const { migrateMapDocument, validateMap, compileBuilding } = this.#geometry;
    if (expectedRevision !== original.revision) {
      return {
        document: this.snapshot(),
        errors: [],
        refusal: new CampaignEditorRefusal(CampaignEditorRefusalCode.StaleMapRevision).snapshot(),
        warnings: [],
      };
    }
    const document = migrateMapDocument(original);
    try {
      if (!Array.isArray(commands) || commands.length > MAP_EDIT_LIMITS.commands) {
        throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidMapCommandBatch);
      }
      for (const command of commands) {
        this.#applyCommand(document, command);
      }
      const preflight = validateMap(document);
      if (!preflight.valid) {
        return { document: this.snapshot(), ...preflight };
      }
      document.buildings = document.buildings.map((building) => compileBuilding(building).building);
      document.revision++;
      const checked = validateMap(document);
      if (!checked.valid) {
        return { document: this.snapshot(), ...checked };
      }
      this.#document = document;
      return { document: this.snapshot(), errors: [], warnings: checked.warnings };
    } catch (error) {
      if (!(error instanceof CampaignEditorRefusal)) {
        throw error;
      }
      return { document: this.snapshot(), errors: [], warnings: [], refusal: error.snapshot() };
    }
  }
  /** @param {string} id @returns {import("./sector-map-command.ts").MapBuildingTemplate} */
  buildingTemplate(id) {
    const document = this.#document;
    const { LAYERS } = this.#geometry;
    const building = this.#entity(document, id).object,
      content = new Set(this.#children(document, building).map((entity) => entity.id));
    return {
      version: 1,
      name: building.name ?? 'Edificio',
      building: structuredClone(building),
      ...Object.fromEntries(
        Object.entries(this.#buildingLevels(document, building)).map(([key, value]) => [
          key === 'surfaces' ? 'upperSurfaces' : 'climbLinks',
          structuredClone(value),
        ]),
      ),
      ...Object.fromEntries(
        LAYERS.filter((layer) => layer !== 'buildings').map((layer) => [
          layer,
          structuredClone(document[layer].filter((entity) => content.has(entity.id))),
        ]),
      ),
    };
  }
  #applyCommand(document, command) {
    if (!command || typeof command !== 'object') {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidMapCommandBatch);
    }
    switch (command.type) {
      case 'transformSelection':
        return this.#transformSelection(document, command);
      case 'paintTerrain':
        return this.#paintTerrain(document, command);
      case 'addBuilding':
        return this.#addBuilding(document, command);
      case 'addObject':
        return this.#addObject(document, command);
      case 'moveObject':
        return this.#moveObject(document, command);
      case 'rotateObject':
        return this.#rotateObject(document, command);
      case 'deleteObject':
        return this.#deleteObject(document, command);
      case 'setObject':
        return this.#setObject(document, command);
      case 'setMetadata':
        return this.#setMetadata(document, command);
      case 'setDoor':
        return this.#setDoor(document, command);
      case 'setOpeningStyle':
        return this.#setOpeningStyle(document, command);
      case 'setWall':
        return this.#setWall(document, command);
      case 'resizeBuilding':
        return this.#resizeBuilding(document, command);
      case 'duplicateObject':
        return this.#duplicateObject(document, command);
      case 'stampTemplate':
        return this.#stampTemplate(document, command);
      default:
        throw new CampaignEditorRefusal(CampaignEditorRefusalCode.UnsupportedMapCommand, {
          command: String(command.type),
        });
    }
  }

  #transformSelection(document, command) {
    if (!Array.isArray(command.ids)) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidMapSelection);
    }
    const roots = this.selectionRoots(command.ids, document);
    const left = Math.min(...roots.map((entity) => entity.x)),
      top = Math.min(...roots.map((entity) => entity.y));
    const height =
      Math.max(
        ...roots.map((entity) => entity.y + (entity.height ?? entity.footprint?.height ?? 1)),
      ) - top;
    for (const entity of roots) {
      if (command.rotate) {
        this.#transform(document, entity.id, { rotate: true });
        this.#transform(document, entity.id, {
          x: left + height - (entity.y - top) - (entity.height ?? entity.footprint?.height ?? 1),
          y: top + entity.x - left,
        });
      } else {
        this.#transform(document, entity.id, {
          x: entity.x + (command.dx ?? 0),
          y: entity.y + (command.dy ?? 0),
        });
      }
    }
  }

  #paintTerrain(document, command) {
    const { ground, cellKey, TERRAIN } = this.#geometry;

    if (
      !Object.hasOwn(TERRAIN, command.terrain) ||
      !Array.isArray(command.cells) ||
      command.cells.length > MAP_EDIT_LIMITS.brushCells
    ) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidTerrainBrush);
    }
    for (const point of command.cells) {
      const index = document.terrain.findIndex((t) => cellKey(t) === cellKey(point));
      if (index < 0) {
        throw new CampaignEditorRefusal(CampaignEditorRefusalCode.CellOutsideMap);
      }
      document.terrain[index] = ground(point.x, point.y, command.terrain);
    }
  }

  #addBuilding(document, command) {
    document.buildings.push(this.#makeBuilding(command.building));
  }

  #addObject(document, command) {
    const { FURNITURE, LAYERS } = this.#geometry;

    if (!LAYERS.includes(command.layer) || command.layer === 'buildings') {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidMapLayer);
    }
    const object = structuredClone(command.object);
    if (command.layer === 'props') {
      const spec = FURNITURE[object.type];
      if (!spec) {
        throw new CampaignEditorRefusal(CampaignEditorRefusalCode.FurnitureNotFound);
      }
      object.footprint ??= { width: spec.width, height: spec.height };
      object.blocksMovement ??= true;
    }
    document[command.layer].push(object);
  }

  #moveObject(document, command) {
    this.#transform(document, command.id, command);
  }

  #rotateObject(document, command) {
    this.#transform(document, command.id, { rotate: true });
  }

  #deleteObject(document, command) {
    const { LAYERS } = this.#geometry;

    const { layer, index, object } = this.#entity(document, command.id);
    if (layer === 'buildings') {
      const levels = this.#buildingLevels(document, object);
      if (document.upperSurfaces) {
        document.upperSurfaces = document.upperSurfaces.filter((s) => !levels.surfaces.includes(s));
      }
      if (document.climbLinks) {
        document.climbLinks = document.climbLinks.filter((layer) => !levels.links.includes(layer));
      }
      const ids = new Set(this.#children(document, object).map((entity) => entity.id));
      for (const layer of LAYERS) {
        if (layer !== 'buildings') {
          document[layer] = document[layer].filter((entity) => !ids.has(entity.id));
        }
      }
    }
    document[layer].splice(index, 1);
    document.items = document.items.filter((item) => item.containerId !== command.id);
  }

  #setObject(document, command) {
    const { BUILDING_TYPES } = this.#geometry;

    const { object, layer } = this.#entity(document, command.id);
    if (
      ['id', 'x', 'y', 'walls', 'rooms', 'width', 'height', 'footprint'].some(
        (k) => k in command.values,
      )
    ) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.MapGeometryOperationRequired);
    }
    if (layer === 'buildings' && 'kind' in command.values && !('architecture' in command.values)) {
      // A new editor type must not leave the former campaign silhouette.
      const previous = BUILDING_TYPES[object.architecture];
      if (previous) {
        const next = BUILDING_TYPES[command.values.kind];
        if (next) {
          object.architecture = command.values.kind;
        } else {
          delete object.architecture;
        }
        if (!('roof' in command.values) && object.roof === previous.roof) {
          object.roof = next?.roof ?? 'tile';
        }
      }
    }
    Object.assign(object, structuredClone(command.values));
    for (const key of ['wallFinish', 'roofFinish', 'doorStyle', 'windowStyle']) {
      if (command.values[key] === null) {
        delete object[key];
      }
    }
    if ('containerId' in command.values && object.containerId) {
      const container = this.#entity(document, object.containerId).object;
      object.x = container.x;
      object.y = container.y;
    }
    if (command.values.containerId === null) {
      delete object.containerId;
    }
  }

  #setMetadata(document, command) {
    Object.assign(document.metadata, command.values);
  }

  #setDoor(document, command) {
    const door = document.buildings
      .flatMap((building) => building.walls)
      .find((wall) => wall.doorId === command.id);
    if (!door) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.DoorNotFound);
    }
    if (command.open !== undefined) {
      door.open = command.open;
    }
    if (command.locked !== undefined) {
      door.locked = command.locked;
    }
  }

  #setOpeningStyle(document, command) {
    const { wallEdgeKey } = this.#geometry;

    const { object: building } = this.#entity(document, command.buildingId);
    const at = this.#commandEdge(building, command);
    const opening = building.walls?.find(
      (wall) => wallEdgeKey(wall) === wallEdgeKey(at) && ['door', 'window'].includes(wall.type),
    );
    if (!opening) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.OpeningRequired);
    }
    if (command.style === null) {
      delete opening.style;
    } else {
      opening.style = command.style;
    }
  }

  #setWall(document, command) {
    const { wallEdgeKey } = this.#geometry;

    const building = this.#entity(document, command.buildingId).object,
      at = this.#commandEdge(building, command);
    if (
      !building.walls ||
      !['x', 'y'].includes(at.axis) ||
      at.x < building.x ||
      at.x > building.x + building.width ||
      at.y < building.y ||
      at.y > building.y + building.height ||
      (at.axis === 'x' && at.x >= building.x + building.width) ||
      (at.axis === 'y' && at.y >= building.y + building.height)
    ) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidWallEdge);
    }
    const previous = building.walls.find((wall) => wallEdgeKey(wall) === wallEdgeKey(at));
    if (['door', 'window'].includes(command.wallType) && !previous) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.OpeningRequiresWall);
    }
    building.walls = building.walls.filter((wall) => wallEdgeKey(wall) !== wallEdgeKey(at));
    if (command.wallType !== 'floor') {
      building.walls.push({
        id: previous?.id ?? `${building.id}:wall:${at.axis}:${at.x}:${at.y}`,
        ...at,
        type: command.wallType,
        ...(command.style ? { style: command.style } : {}),
        ...(command.wallType === 'door'
          ? {
              doorId:
                command.doorId ??
                previous?.doorId ??
                `${building.id}:door:${at.axis}:${at.x}:${at.y}`,
              open: false,
              locked: false,
            }
          : {}),
      });
    }
  }

  #resizeBuilding(document, command) {
    const { wallEdgeKey } = this.#geometry;

    const { object: building } = this.#entity(document, command.id),
      fresh = this.#makeBuilding({
        ...building,
        width: command.width,
        height: command.height,
      });
    for (const wall of building.walls) {
      const perimeter =
        wall.axis === 'x'
          ? wall.y === building.y || wall.y === building.y + building.height
          : wall.x === building.x || wall.x === building.x + building.width;
      const at = { ...wall };
      if (wall.axis === 'x' && wall.y === building.y + building.height) {
        at.y = building.y + command.height;
      }
      if (wall.axis === 'y' && wall.x === building.x + building.width) {
        at.x = building.x + command.width;
      }
      const target = fresh.walls.find(
        (candidateWall) => wallEdgeKey(candidateWall) === wallEdgeKey(at),
      );
      if (perimeter && target && wall.type !== 'wall') {
        Object.assign(target, at);
      } else if (
        !perimeter &&
        at.x >= building.x &&
        at.x < building.x + command.width &&
        at.y >= building.y &&
        at.y < building.y + command.height
      ) {
        fresh.walls.push(at);
      }
    }
    Object.assign(building, fresh, { rooms: building.rooms });
  }

  #duplicateObject(document, command) {
    const { object, layer } = this.#entity(document, command.id),
      copy = structuredClone(object),
      oldId = copy.id;
    copy.id = command.newId;
    if (layer === 'buildings') {
      copy.walls = copy.walls.map((wall) => ({
        ...wall,
        id: `${copy.id}:${wall.id}`,
        ...(wall.doorId ? { doorId: `${copy.id}:${wall.doorId}` } : {}),
      }));
      copy.rooms = copy.rooms.map((room) => ({ ...room, id: `${copy.id}:${room.id}` }));
      const contents = this.#children(document, object).map((entity) => ({
        layer: this.#entity(document, entity.id).layer,
        object: structuredClone(entity),
      }));
      const horizontalOffset = command.x - object.x,
        verticalOffset = command.y - object.y;
      const levels = this.#buildingLevels(document, object);
      this.#appendLevels(
        document,
        { upperSurfaces: levels.surfaces, climbLinks: levels.links },
        copy.id,
        horizontalOffset,
        verticalOffset,
      );
      copy.x = command.x;
      copy.y = command.y;
      copy.walls = copy.walls.map((wall) => ({
        ...wall,
        x: wall.x + horizontalOffset,
        y: wall.y + verticalOffset,
      }));
      copy.rooms = copy.rooms.map((room) => ({
        ...room,
        cells: room.cells.map((point) => ({
          x: point.x + horizontalOffset,
          y: point.y + verticalOffset,
        })),
      }));
      for (const entry of contents) {
        const entity = entry.object;
        entity.id = `${copy.id}:${entity.id}`;
        entity.x += horizontalOffset;
        entity.y += verticalOffset;
        if (entity.containerId) {
          entity.containerId = `${copy.id}:${entity.containerId}`;
        }
        delete entity.roomId;
        delete entity.buildingId;
        document[entry.layer].push(entity);
      }
    } else {
      copy.x = command.x;
      copy.y = command.y;
      for (const item of document.items.filter((item) => item.containerId === oldId)) {
        document.items.push({
          ...item,
          id: `${copy.id}:${item.id}`,
          containerId: copy.id,
          x: command.x,
          y: command.y,
        });
      }
    }
    document[layer].push(copy);
  }

  #stampTemplate(document, command) {
    const { compileBuilding, LAYERS } = this.#geometry;

    const template = structuredClone(command.template);
    if (template.version !== 1) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.UnsupportedTemplateVersion);
    }
    const shape = template.building;
    if (
      !shape ||
      ![shape.x, shape.y, shape.width, shape.height].every(Number.isInteger) ||
      shape.width < MAP_EDIT_LIMITS.minimumBuildingSize ||
      shape.height < MAP_EDIT_LIMITS.minimumBuildingSize ||
      shape.width > MAP_EDIT_LIMITS.maximumBuildingSize ||
      shape.height > MAP_EDIT_LIMITS.maximumBuildingSize ||
      !Array.isArray(shape.walls) ||
      !Array.isArray(shape.rooms)
    ) {
      throw new CampaignEditorRefusal(CampaignEditorRefusalCode.InvalidTemplateDimensions);
    }
    const root = compileBuilding(shape).building,
      horizontalOffset = command.x - root.x,
      verticalOffset = command.y - root.y,
      building = { ...root, id: command.id, x: command.x, y: command.y };
    building.walls = root.walls.map((wall) => ({
      ...wall,
      id: `${command.id}:${wall.id}`,
      x: wall.x + horizontalOffset,
      y: wall.y + verticalOffset,
      ...(wall.doorId ? { doorId: `${command.id}:${wall.doorId}` } : {}),
    }));
    building.rooms = root.rooms.map((room) => ({
      ...room,
      id: `${command.id}:${room.id}`,
      cells: room.cells.map((point) => ({
        x: point.x + horizontalOffset,
        y: point.y + verticalOffset,
      })),
    }));
    document.buildings.push(building);
    this.#appendLevels(document, template, command.id, horizontalOffset, verticalOffset);
    for (const layer of LAYERS.filter((layer) => layer !== 'buildings')) {
      for (const entity of template[layer] ?? []) {
        document[layer].push({
          ...entity,
          id: `${command.id}:${entity.id}`,
          x: entity.x + horizontalOffset,
          y: entity.y + verticalOffset,
          ...(entity.containerId ? { containerId: `${command.id}:${entity.containerId}` } : {}),
        });
      }
    }
  }
}
