import { Squad } from '../../domain/personnel/squad.ts';
import { DomainRefusal, DomainRefusalCode } from '../../domain/shared/domain-refusal.ts';
import { canReassignOperative, operativeLocation } from '../../squads.js';
import { isCharacterDeployed } from '../session/campaign-session-access.js';

export class CampaignFormSquadRepository {
  #campaign;
  #identities;
  #context;
  #closed = false;
  constructor(transaction) {
    this.#campaign = transaction.draft;
    this.#identities = transaction.identities;
  }

  load(request) {
    if (this.#closed || this.#context) {
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    }
    const campaign = this.#campaign;
    const squads = campaign.squads.map((record) =>
      this.#identities.obtain(
        'Squad',
        record.id,
        () =>
          new Squad({
            id: record.id,
            name: record.name,
            locationId: record.location,
            memberIds: record.members.map(String),
            membershipLocked: Boolean(
              record.journey || record.members.some((id) => isCharacterDeployed(campaign, id)),
            ),
          }),
      ),
    );
    const nextId = `squad-${Math.max(0, ...campaign.squads.map((squad) => Number(squad.id.split('-')[1]))) + 1}`;
    const target = request.squadId
      ? squads.find((squad) => squad.id === request.squadId)
      : Squad.form(nextId, request.name ?? '', request.locationId ?? campaign.location);
    if (!target) {
      throw new DomainRefusal(DomainRefusalCode.SquadUnavailable);
    }
    this.#context = {
      squads,
      target,
      candidates: request.characterIds.map((id) => ({
        characterId: id,
        locationId: operativeLocation(campaign, Number(id)),
        available: canReassignOperative(campaign, Number(id)),
      })),
    };
    return this.#context;
  }

  commit(formation) {
    if (this.#closed || formation.target !== this.#context?.target) {
      throw new DomainRefusal(DomainRefusalCode.TransactionClosed);
    }
    const campaign = this.#campaign;
    for (const record of campaign.squads) {
      for (const id of record.members) {
        campaign.operativeState[id].location = record.location;
      }
    }
    campaign.squads = formation.squads.map((squad) => {
      const snapshot = squad.toSnapshot();
      const record = campaign.squads.find((existing) => existing.id === squad.id);
      const projected = {
        ...record,
        id: snapshot.id,
        name: snapshot.name,
        location: snapshot.locationId,
        members: snapshot.memberIds.map(Number),
      };
      if (!projected.members.length) {
        delete projected.journey;
      }
      return projected;
    });
    if (formation.discardedSquadId && campaign.travelNotice) {
      const events = campaign.travelNotice.events.filter(
        (event) => event.squadId !== formation.discardedSquadId,
      );
      campaign.travelNotice = events.length ? { ...campaign.travelNotice, events } : null;
    }
    campaign.activeSquadId = formation.target.id;
    campaign.squad = formation.target.memberIds.map(Number);
    campaign.location = formation.target.locationId;
    this.#closed = true;
  }
}
