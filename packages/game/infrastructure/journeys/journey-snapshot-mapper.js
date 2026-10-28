import {
  Journey,
  JourneyDirection,
  JourneyPurpose,
  JourneyStatus,
  SecondsPerTravelHour,
} from '../../domain/journeys/journey.ts';
import { ArrivalDecisionStatus } from '../../domain/journeys/arrival-decision.ts';

const legacyStatus = Object.freeze({
  moving: JourneyStatus.Travelling,
  paused: JourneyStatus.Paused,
  ready: JourneyStatus.AwaitingArrivalDecision,
  completed: JourneyStatus.Completed,
});

export class JourneySnapshotMapper {
  restore(squad, campaignTimeSeconds) {
    const record = squad.journey;
    const positionSeconds = record.elapsed * SecondsPerTravelHour + (record.elapsedSecond ?? 0);
    const startedAtSeconds = record.startedAt * SecondsPerTravelHour + (record.startedSecond ?? 0);
    const id = record.id ?? `${squad.id}:journey:${startedAtSeconds}:${record.path.join(':')}`;
    const arrivalSequence = record.arrivalSequence ?? (record.status === 'ready' ? 1 : 0);
    const arrivalDecision =
      record.arrivalDecision ??
      (record.status === 'ready'
        ? {
            id: `${id}:arrival:${arrivalSequence}`,
            sectorId: record.path[1],
            arrivedAtSeconds: Math.min(campaignTimeSeconds, startedAtSeconds + positionSeconds),
            status: ArrivalDecisionStatus.Pending,
          }
        : undefined);
    return Journey.restore({
      id,
      route: record.path,
      ...(record.returnPath ? { returnRoute: record.returnPath } : {}),
      mode: record.mode,
      purpose:
        record.purpose ??
        (record.intent === 'attack'
          ? record.returning
            ? JourneyPurpose.Withdrawal
            : JourneyPurpose.HostileApproach
          : JourneyPurpose.Travel),
      status: legacyStatus[record.status],
      startedAtSeconds,
      legDurationSeconds: record.legHours * SecondsPerTravelHour,
      positionSeconds,
      direction: record.returning ? JourneyDirection.Backward : JourneyDirection.Forward,
      travelledSeconds: record.travelledSeconds ?? positionSeconds,
      workSeconds: record.pendingSeconds ?? positionSeconds % SecondsPerTravelHour,
      legPaid: record.legPaid ?? positionSeconds > 0,
      arrivalSequence,
      ...(arrivalDecision ? { arrivalDecision } : {}),
      ...(record.reason && record.reason !== 'assault' ? { pauseReason: record.reason } : {}),
    });
  }

  serialize(journey) {
    const snapshot = journey.snapshot();
    const status = Object.keys(legacyStatus).find((key) => legacyStatus[key] === snapshot.status);
    const startedSecond = snapshot.startedAtSeconds % SecondsPerTravelHour;
    const elapsedSecond = snapshot.positionSeconds % SecondsPerTravelHour;
    return {
      version: 1,
      id: snapshot.id,
      path: [...snapshot.route],
      ...(snapshot.returnRoute ? { returnPath: [...snapshot.returnRoute] } : {}),
      mode: snapshot.mode,
      startedAt: Math.floor(snapshot.startedAtSeconds / SecondsPerTravelHour),
      ...(startedSecond ? { startedSecond } : {}),
      legHours: snapshot.legDurationSeconds / SecondsPerTravelHour,
      elapsed: Math.floor(snapshot.positionSeconds / SecondsPerTravelHour),
      ...(elapsedSecond ? { elapsedSecond } : {}),
      status,
      returning: snapshot.direction === JourneyDirection.Backward,
      reason: journey.awaitingArrivalDecision ? 'assault' : (snapshot.pauseReason ?? null),
      ...(snapshot.purpose !== JourneyPurpose.Travel ? { intent: 'attack' } : {}),
      purpose: snapshot.purpose,
      travelledSeconds: snapshot.travelledSeconds,
      ...(snapshot.workSeconds ? { pendingSeconds: snapshot.workSeconds } : {}),
      legPaid: snapshot.legPaid,
      arrivalSequence: snapshot.arrivalSequence,
      ...(snapshot.arrivalDecision ? { arrivalDecision: snapshot.arrivalDecision } : {}),
    };
  }
}
