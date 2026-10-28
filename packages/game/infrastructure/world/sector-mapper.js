import { Sector } from '../../domain/world/sector.ts';

export const sectorPosition = (actor) => ({
  x: actor.x,
  y: actor.y,
  level: actor.tacticalLevel ?? 0,
});
export const sectorCharacterId = (actor) => `character:${String(actor.operativeId ?? actor.id)}`;
export const sectorCharacterReference = (actor) => ({
  characterId: sectorCharacterId(actor),
  localId: String(actor.id),
  custodianId: sectorCharacterId(actor),
  position: sectorPosition(actor),
  alive: (actor.hp ?? 100) > 0,
});
const present = (actor) => !actor.departure && !actor.fled;

export function restoreSector(field, { corpseEquipment = new Map(), corpses = [] } = {}) {
  const actors = [...(field.npcs ?? []).filter(present), ...(field.units ?? []).filter(present)];
  const objects = [
    ...(field.props ?? []).map((object) => ({ object, kind: 'container' })),
    ...(field.groundItems ?? []).map((object) => ({ object, kind: 'ground' })),
    ...(field.droppedWeapons ?? []).map((object, index) => ({
      object: { ...object, id: object.id ?? index },
      kind: 'dropped-weapon',
    })),
    ...(field.artillery ?? []).map((object) => ({ object, kind: 'artillery' })),
  ];
  const points = [...actors, ...objects.map(({ object }) => object)];
  const sectorId = field.sceneId ?? field.sectorId ?? field.sector ?? field.battleId ?? field.id;
  const scheduledCorpses = new Map(
    corpses.map((corpse) => [corpse.characterId, corpse.toSnapshot()]),
  );
  return new Sector({
    id: sectorId,
    environment: {
      width: field.width ?? Math.max(1, ...points.map((point) => point.x + 1)),
      height: field.height ?? Math.max(1, ...points.map((point) => point.y + 1)),
    },
    residents: (field.npcs ?? []).filter(present).map(sectorCharacterReference),
    participants: (field.units ?? []).filter(present).map(sectorCharacterReference),
    corpses: actors.flatMap((actor) => {
      const corpse = actor.corpse ?? scheduledCorpses.get(String(actor.originalUnitId ?? actor.id));
      return corpse
        ? [
            {
              id: corpse.id,
              characterId: sectorCharacterId(actor),
              localId: String(actor.id),
              position: sectorPosition(actor),
              itemIds: (corpseEquipment.get(corpse.id) ?? []).map((item) => item.itemId),
            },
          ]
        : [];
    }),
    objects: objects.map(({ object, kind }) => ({
      id: `${kind}:${object.id}`,
      position: sectorPosition(object),
      custodianId: `${kind}:${object.id}`,
      itemIds: object.instanceId ? [object.instanceId] : [],
    })),
    removedCharacterIds: (field.deathHistory ?? [])
      .filter(
        (death) =>
          death.kind === 'resident' ||
          (death.actor.side === 'player' && typeof death.actor.id === 'number'),
      )
      .map((death) => sectorCharacterId(death.actor)),
  });
}
