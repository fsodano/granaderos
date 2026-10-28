import { restoreSector, sectorCharacterId } from '../world/sector-mapper.js';

function objectRecords(field) {
  return [
    ...(field.props ?? []).map((object) => [`container:${object.id}`, object]),
    ...(field.groundItems ?? []).map((object) => [`ground:${object.id}`, object]),
    ...(field.droppedWeapons ?? []).map((object, index) => [
      `dropped-weapon:${object.id ?? index}`,
      object,
    ]),
    ...(field.artillery ?? []).map((object) => [`artillery:${object.id}`, object]),
  ];
}

function projectPosition(actor, position) {
  const projected = { ...actor, x: position.x, y: position.y };
  if (position.level || Object.hasOwn(actor, 'tacticalLevel'))
    projected.tacticalLevel = position.level;
  return projected;
}

export class CanonicalSectorMapper {
  #entries = new Map();
  #identities;

  constructor(identities) {
    this.#identities = identities;
  }

  restoreField(field, ownerId) {
    const restored = restoreSector({
      ...field,
      sectorId:
        field.sectorId ?? field.sectorSession?.sectorId ?? ownerId.replace(/^(sector|scene):/, ''),
    });
    if (this.#entries.has(restored.id)) throw Error('El sector ya pertenece al contexto cargado.');
    const sector = this.#identities.obtain('Sector', restored.id, () => restored);
    this.#entries.set(sector.id, { sector, field, original: sector.toSnapshot() });
  }

  object(id) {
    return this.#entries.get(id)?.sector;
  }

  apply() {
    const actors = new Map();
    for (const { field } of this.#entries.values()) {
      for (const actor of [...(field.npcs ?? []), ...(field.units ?? [])]) {
        if (actor.departure || actor.fled) continue;
        const key = `${sectorCharacterId(actor)}:${actor.id}`;
        actors.set(key, [...(actors.get(key) ?? []), actor]);
      }
    }
    const projections = [];
    for (const { sector, field, original } of this.#entries.values()) {
      const snapshot = sector.toSnapshot();
      if (JSON.stringify(snapshot) === JSON.stringify(original)) continue;
      const physicalObjects = new Map(objectRecords(field));
      for (const object of snapshot.objects) {
        if (!physicalObjects.has(object.id))
          throw Error('El objeto del sector necesita su contenido físico antes de guardar.');
      }
      for (const corpse of original.corpses) {
        if (
          !snapshot.corpses.some((current) => current.id === corpse.id) &&
          !(field.deathHistory ?? []).some((death) => death.corpse.id === corpse.id)
        )
          throw Error('La retirada del cuerpo necesita su registro y la entrega de sus objetos.');
      }
      const localActors = new Map(
        [...(field.npcs ?? []), ...(field.units ?? [])].map((actor) => [
          `${sectorCharacterId(actor)}:${actor.id}`,
          actor,
        ]),
      );
      const actorPositions = [];
      const projectActors = (references) =>
        references.map((reference) => {
          const key = `${reference.characterId}:${reference.localId}`;
          const candidates = actors.get(key) ?? [];
          const actor = localActors.get(key) ?? (candidates.length === 1 ? candidates[0] : null);
          if (!actor)
            throw Error('La presencia del sector necesita un personaje físico existente y único.');
          if ((actor.hp ?? 100) > 0 !== reference.alive)
            throw Error('La salud pertenece al personaje y no a su referencia de sector.');
          actorPositions.push({ object: actor, position: reference.position });
          return actor;
        });
      const npcs = [
        ...(field.npcs ?? []).filter((actor) => actor.departure || actor.fled),
        ...projectActors(snapshot.residents),
      ];
      const units = [
        ...(field.units ?? []).filter((actor) => actor.departure || actor.fled),
        ...projectActors(snapshot.participants),
      ];
      const positions = [
        ...actorPositions,
        ...snapshot.objects.map((reference) => ({
          object: physicalObjects.get(reference.id),
          position: reference.position,
        })),
      ];
      projections.push({ field, npcs, units, positions });
    }
    for (const { field, npcs, units, positions } of projections) {
      if (field.npcs || npcs.length) field.npcs = npcs;
      if (field.units || units.length) field.units = units;
      for (const { object, position } of positions)
        Object.assign(object, projectPosition(object, position));
    }
  }
}
