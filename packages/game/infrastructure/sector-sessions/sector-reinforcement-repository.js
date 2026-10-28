import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import { nextRevision } from '../shared/revision.js';
import { createSectorParticipant, initializeBattlePerception } from '../../tactical.js';
import { SectorDeployment } from '../../domain/sector-sessions/sector-deployment.ts';
import { readSectorSession, writeSectorSession } from './sector-session-mapper.js';
import { entryTerrainCells, exteriorComponent } from '../../sector-entry.js';
import { physicalEntryAnchor } from '../../sector-expansion.js';
import { validEntry } from '../../tactical-exits.js';
import { tacticalLevel } from '../../tactical-space.js';
import { addIssuedGriefParticipant } from '../../companion-grief.js';
import { addIssuedConductObserver } from '../../service-objections.js';
export class SnapshotAdmitSectorReinforcementsRepository {
  #snapshot;
  #request;
  #placements;
  #incoming = [];
  #revision = 0;
  #result;
  constructor(snapshot, request, placements = {}) {
    this.#snapshot = structuredClone(snapshot);
    this.#revision = snapshot.sectorRevision ?? 0;
    this.#request = structuredClone(request);
    this.#placements = structuredClone(placements);
  }
  loadReinforcementAdmission() {
    nextRevision(this.#revision);
    const state = this.#snapshot,
      request = this.#request;
    if (request.sector !== state.sectorId)
      throw Error('Los refuerzos deben entrar al mismo sector.');
    this.#incoming = (request.squad ?? []).map((raw) => {
      if (raw.entryReason !== 'arrival' || !validEntry(raw.entryEdge, raw.entryAnchor))
        throw Error('Los refuerzos necesitan un borde de llegada válido.');
      return createSectorParticipant(raw, state);
    });
    if (!this.#incoming.length) throw Error('La llegada necesita combatientes.');
    const component = exteriorComponent(state, this.#incoming[0]);
    const cells = Object.fromEntries(
      ['N', 'E', 'S', 'W'].map((edge) => [
        edge,
        entryTerrainCells(state, this.#incoming[0], edge, component).map(({ x, y }) => ({ x, y })),
      ]),
    );
    return {
      session: readSectorSession(state),
      deployment: SectorDeployment.restore(
        {
          participants: this.#incoming.map((unit) => ({
            characterId: unit.id,
            entryEdge: unit.entryEdge,
          })),
          placements: {},
        },
        cells,
      ),
      preferences: this.#incoming.map((unit) => ({
        characterId: unit.id,
        point:
          this.#placements[unit.id] ??
          physicalEntryAnchor(
            unit.entryEdge,
            unit.entryAnchor,
            state.width,
            state.height,
            state.sceneId ?? state.sectorId,
          ),
      })),
      occupiedPoints: [
        ...state.units.filter((unit) => !unit.departure && !unit.fled),
        ...(state.npcs ?? []),
        ...(state.artillery ?? []),
      ].filter((unit) => tacticalLevel(unit) === 0),
      revision: this.#revision,
    };
  }
  commitReinforcementAdmission(session, placements, expectedRevision) {
    if (expectedRevision !== this.#revision)
      throw new DomainRefusal(DomainRefusalCode.RevisionConflict);
    const acceptedRevision = nextRevision(this.#revision);
    const next = structuredClone(this.#snapshot);
    for (const unit of this.#incoming) {
      Object.assign(unit, placements[unit.id], {
        facing: { N: 4, E: 6, S: 0, W: 2 }[unit.entryEdge],
      });
      next.units.push(unit);
      addIssuedGriefParticipant(next, unit);
      addIssuedConductObserver(next, unit);
      if (next.deployment) {
        const squad = this.#request.assaultSquads?.find((group) =>
          group.members.some((id) => String(id) === unit.id),
        );
        next.deployment.units.push({
          id: unit.id,
          edge: unit.entryEdge,
          squadId: squad?.id ?? 'arrival',
          squadName: squad?.name ?? squad?.id ?? 'Escuadra',
        });
        next.deployment.placements[unit.id] = { ...placements[unit.id] };
      }
    }
    writeSectorSession(next, session);
    this.#revision = acceptedRevision;
    next.sectorRevision = acceptedRevision;
    this.#result =
      next.deployment || next.mode === 'combat' ? next : initializeBattlePerception(next);
    this.#snapshot = this.#result;
  }
  get result() {
    if (!this.#result) throw Error('sector-reinforcements-not-committed');
    return this.#result;
  }
}
