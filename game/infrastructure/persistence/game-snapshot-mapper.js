import { decodeSave, encodeSave } from '../../save.js';
import { rosterFor } from '../../recruitment.js';
import { restoreGameSession, projectGameSession } from '../session/campaign-game-session-mapper.js';
import { DomainIdentityMap } from './domain-identity-map.ts';
import { CanonicalPersonnelMapper } from './canonical-personnel-mapper.ts';
import { CanonicalWorldMapper } from './canonical-world-mapper.js';
import { JourneySnapshotMapper } from '../journeys/journey-snapshot-mapper.js';
import {
  readSectorSession,
  writeSectorSession,
  participantOf,
  writeParticipant,
} from '../sector-sessions/sector-session-mapper.js';
import { createGameSessionId } from './game-session-id.js';
import { RetainedSectorPresence } from '../world/retained-sector-presence.js';
import { ActiveSectorCharacterMapper } from './active-sector-character-mapper.js';

export class RestoredGame {
  #campaign;
  #battle;
  #journeys = new Map();
  #sectorSessions = new Map();
  #participants = new Map();
  #journeyMapper = new JourneySnapshotMapper();
  #identities;
  #personnel;
  #world;
  #session;

  constructor(campaign, battle, identities = new DomainIdentityMap()) {
    this.#campaign = campaign;
    this.#battle = battle;
    this.#identities = identities;
    this.#session = identities.obtain('GameSession', campaign.gameSessionId, () =>
      restoreGameSession(campaign),
    );
    this.#personnel = new CanonicalPersonnelMapper(campaign, identities);
    const activeFields = [
      ...(campaign.suspendedSectorSessions ?? []).map((entry) => entry.snapshot),
      ...(battle ? [battle] : []),
    ];
    const activeCharacters = new Map(
      activeFields.flatMap((field) =>
        field.units.filter((unit) => unit.side === 'player').map((unit) => [String(unit.id), unit]),
      ),
    );
    for (const definition of rosterFor(campaign))
      this.#personnel.restoreCharacter(definition, activeCharacters.get(String(definition.id)));
    const now = campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
    for (const squad of campaign.squads ?? []) {
      if (!squad.journey) continue;
      const restored = this.#journeyMapper.restore(squad, now);
      const journey = identities.obtain('Journey', restored.snapshot().id, () => restored);
      this.#journeys.set(squad.id, {
        squad,
        journey,
        original: JSON.stringify(journey.snapshot()),
      });
    }
    this.#world = new CanonicalWorldMapper(identities);
    const liveRequests = [
      ...(campaign.suspendedSectorSessions ?? []).map((entry) => entry.request),
      ...(campaign.pendingBattle ? [campaign.pendingBattle] : []),
    ];
    const liveFields = new Set(
      liveRequests.map((request) =>
        request.sceneId ? `scene:${request.sceneId}` : `sector:${request.sector}`,
      ),
    );
    const fields = [
      ...Object.entries(campaign.sectorStates ?? {})
        .filter(([id]) => !liveFields.has(`sector:${id}`))
        .map(([id, field]) => ({ id: `sector:${id}`, field })),
      ...Object.entries(campaign.sceneStates ?? {})
        .filter(([id]) => !liveFields.has(`scene:${id}`))
        .map(([id, field]) => ({ id: `scene:${id}`, field })),
      ...(campaign.suspendedSectorSessions ?? []).map((entry) => ({
        id: entry.request.id,
        field: entry.snapshot,
      })),
      ...(battle ? [{ id: campaign.pendingBattle.id, field: battle }] : []),
    ];
    const retainedPresence = new RetainedSectorPresence(campaign);
    const activeCharactersMapper = new ActiveSectorCharacterMapper(
      campaign,
      this.#personnel,
      identities,
    );
    for (const { id, field } of fields) {
      const active = activeFields.includes(field);
      this.#world.restoreField(
        field,
        id,
        (unit) => active || retainedPresence.includes(unit, field),
      );
      if (!active || !field.sectorSession) continue;
      const restored = readSectorSession(field);
      const sectorSession = identities.obtain('SectorSession', restored.id, () => restored);
      this.#sectorSessions.set(restored.id, {
        field,
        sectorSession,
        original: JSON.stringify(sectorSession.snapshot()),
      });
      for (const unit of field.units ?? []) {
        if (unit.side !== 'player' || !activeFields.includes(field)) continue;
        const key = `${restored.id}:${unit.id}`;
        const participant = identities.obtain('SectorParticipant', key, () => participantOf(unit));
        const character = activeCharactersMapper.restore(unit, field.sectorId);
        this.#participants.set(key, {
          unit,
          character,
          participant,
          original: JSON.stringify(participant.snapshot()),
          originalHealth: JSON.stringify(character.health.toSnapshot()),
        });
      }
    }
  }

  get identities() {
    return this.#identities;
  }
  get session() {
    return this.#session;
  }
  get personnel() {
    return this.#personnel;
  }
  get world() {
    return this.#world;
  }

  inventory(sectorSessionId, characterId) {
    return this.#world.inventory(sectorSessionId, characterId);
  }

  journey(squadId) {
    const entry = this.#journeys.get(squadId);
    if (!entry) throw new Error('La escuadra no tiene un viaje cargado.');
    return entry.journey;
  }

  sectorSession(id) {
    const entry = this.#sectorSessions.get(id);
    if (!entry) throw new Error('El sector no tiene una sesión cargada.');
    return entry.sectorSession;
  }

  participant(sectorSessionId, characterId) {
    const entry = this.#participants.get(`${sectorSessionId}:${characterId}`);
    if (!entry) throw new Error('El personaje no participa en esta visita.');
    return Object.freeze({ character: entry.character, participant: entry.participant });
  }

  snapshot() {
    this.#personnel.apply(this.#campaign);
    this.#world.apply();
    projectGameSession(this.#campaign, this.#session);
    for (const { squad, journey, original } of this.#journeys.values()) {
      if (JSON.stringify(journey.snapshot()) !== original)
        squad.journey = this.#journeyMapper.serialize(journey);
    }
    for (const { field, sectorSession, original } of this.#sectorSessions.values()) {
      if (JSON.stringify(sectorSession.snapshot()) !== original)
        writeSectorSession(field, sectorSession);
    }
    for (const {
      unit,
      character,
      participant,
      original,
      originalHealth,
    } of this.#participants.values()) {
      if (JSON.stringify(participant.snapshot()) !== original) writeParticipant(unit, participant);
      const health = character.health.toSnapshot();
      if (JSON.stringify(health) !== originalHealth) {
        unit.hp = health.current;
        unit.maxHp = health.maximum;
        unit.bleeding = health.bleeding;
        unit.bandaged = health.bandaged;
      }
    }
    return structuredClone({ campaign: this.#campaign, battle: this.#battle });
  }
}

export class GameSnapshotMapper {
  #newSessionId;

  constructor(newSessionId = createGameSessionId) {
    this.#newSessionId = newSessionId;
  }

  restore(text) {
    const pair = decodeSave(text);
    pair.campaign.gameSessionId ??= this.#newSessionId();
    pair.campaign.gameRevision ??= 0;
    return new RestoredGame(pair.campaign, pair.battle);
  }

  serialize(game) {
    const pair = game.snapshot();
    const text = encodeSave(pair.campaign, pair.battle);
    decodeSave(text);
    return text;
  }
}
