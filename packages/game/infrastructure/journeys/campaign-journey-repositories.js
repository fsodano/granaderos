import { JourneyRefusal, JourneyRefusalCode } from '../../domain/journeys/arrival-decision.ts';
import { JourneySnapshotMapper } from './journey-snapshot-mapper.js';
import { advanceRevision, journeyRevisionDomain } from '../shared/revision-policy.ts';

export class CampaignJourneyTransaction {
  #campaign;
  #mapper = new JourneySnapshotMapper();

  constructor(campaign) {
    this.#campaign = campaign;
  }

  loadJourney(squadId) {
    const squad = this.#campaign.squads.find((candidate) => candidate.id === squadId);
    if (!squad?.journey) {
      throw new JourneyRefusal(JourneyRefusalCode.JourneyNotFound);
    }
    const revision = journeyRevisionDomain.read(squad);
    advanceRevision(revision);
    const nowSeconds = this.#campaign.hour * 3600 + (this.#campaign.secondOfHour ?? 0);
    return {
      journey: this.#mapper.restore(squad, nowSeconds),
      revision,
      nowSeconds,
    };
  }

  commitJourney(squadId, journey, expectedRevision) {
    const squad = this.#campaign.squads.find((candidate) => candidate.id === squadId);
    if (!squad?.journey || journeyRevisionDomain.read(squad) !== expectedRevision) {
      throw new JourneyRefusal(JourneyRefusalCode.JourneyRevisionConflict);
    }
    const acceptedRevision = advanceRevision(expectedRevision);
    squad.journey = this.#mapper.serialize(journey);
    journeyRevisionDomain.write(squad, acceptedRevision);
  }
}

export class CampaignFightOnArrivalRepository {
  #transaction;
  constructor(transaction) {
    this.#transaction = transaction;
  }
  loadJourney(squadId) {
    return this.#transaction.loadJourney(squadId);
  }
  commitJourney(squadId, journey, revision) {
    this.#transaction.commitJourney(squadId, journey, revision);
  }
}

export class CampaignWithdrawOnArrivalRepository {
  #transaction;
  constructor(transaction) {
    this.#transaction = transaction;
  }
  loadJourney(squadId) {
    return this.#transaction.loadJourney(squadId);
  }
  commitJourney(squadId, journey, revision) {
    this.#transaction.commitJourney(squadId, journey, revision);
  }
}

export class CampaignRedirectJourneyRepository {
  #transaction;
  #planRoute;
  constructor(transaction, planRoute) {
    this.#transaction = transaction;
    this.#planRoute = planRoute;
  }
  loadJourney(squadId) {
    return this.#transaction.loadJourney(squadId);
  }
  planRoute(journey, destination, waypoints) {
    return this.#planRoute(journey, destination, waypoints);
  }
  commitJourney(squadId, journey, revision) {
    this.#transaction.commitJourney(squadId, journey, revision);
  }
}
