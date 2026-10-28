import { SectorOperationKind } from '../../domain/sector-sessions/sector-operation.ts';
import { SectorSession } from '../../domain/sector-sessions/sector-session.ts';
import { REST_SECONDS } from '../../time.js';

const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value) => typeof value === 'string' && value.length > 0 && value.length <= 200;
const requireValid = (condition, field) => {
  if (!condition) throw new Error(`Invalid sector operation ${field}.`);
};

export function validateSectorOperationSnapshot(snapshot) {
  for (const field of ['sectorRevision', 'gameRevision', 'worldTimeLimitSecond']) {
    if (snapshot?.[field] !== undefined) requireValid(nonnegativeInteger(snapshot[field]), field);
  }
  if (snapshot?.gameSessionId !== undefined)
    requireValid(identifier(snapshot.gameSessionId), 'game session identity');
  if (snapshot?.sectorSession) SectorSession.restore(snapshot.sectorSession);
  const pending = snapshot?.pendingSectorOperation;
  if (pending === undefined) return;
  requireValid(object(pending), 'continuation');
  const currentSecond = (snapshot.startSeconds ?? 0) + (snapshot.elapsedSeconds ?? 0);
  requireValid(
    nonnegativeInteger(pending.interruptedAtSecond) && pending.interruptedAtSecond <= currentSecond,
    'interruption time',
  );
  requireValid(
    [...Object.values(SectorOperationKind), 'groupMovement'].includes(pending.kind),
    'kind',
  );
  if (pending.remainingRestSeconds !== undefined)
    requireValid(
      pending.kind === SectorOperationKind.EndTurn &&
        nonnegativeInteger(pending.remainingRestSeconds) &&
        pending.remainingRestSeconds <= REST_SECONDS,
      'remaining rest',
    );
  if (pending.kind === SectorOperationKind.Order) {
    requireValid(object(pending.order) && identifier(pending.order.type), 'order');
    if (pending.order.unitId !== undefined)
      requireValid(
        (snapshot.units ?? []).some((unit) => String(unit.id) === String(pending.order.unitId)),
        'order participant',
      );
  }
  if (pending.kind !== 'groupMovement') return;
  const request = pending.request;
  const continuation = pending.continuation;
  requireValid(object(request) && object(continuation), 'group continuation');
  const ids = request.unitIds?.map(String);
  requireValid(
    Array.isArray(ids) &&
      ids.length > 0 &&
      ids.length <= 200 &&
      new Set(ids).size === ids.length &&
      ids.every((id) =>
        (snapshot.units ?? []).some(
          (unit) => unit.side === 'player' && !unit.militia && String(unit.id) === id,
        ),
      ),
    'group participants',
  );
  requireValid(ids.includes(String(request.anchorId)), 'group anchor');
  const coordinate = (point) =>
    object(point) &&
    nonnegativeInteger(point.x) &&
    point.x < snapshot.width &&
    nonnegativeInteger(point.y) &&
    point.y < snapshot.height;
  requireValid(coordinate(request), 'group destination');
  requireValid(
    object(continuation.request) &&
      Array.isArray(continuation.request.unitIds) &&
      JSON.stringify(continuation.request.unitIds.map(String)) === JSON.stringify(ids) &&
      String(continuation.request.anchorId) === String(request.anchorId) &&
      ['x', 'y', 'movement'].every((key) => continuation.request[key] === request[key]),
    'group intention',
  );
  requireValid(
    Array.isArray(continuation.members) && continuation.members.length === ids.length,
    'formation members',
  );
  requireValid(
    nonnegativeInteger(continuation.index) &&
      continuation.index <= ids.length &&
      nonnegativeInteger(continuation.startSeconds) &&
      continuation.startSeconds <= (snapshot.elapsedSeconds ?? 0),
    'formation progress',
  );
  const orderedIds = [
    String(request.anchorId),
    ...ids.filter((id) => id !== String(request.anchorId)),
  ];
  for (const [index, member] of continuation.members.entries())
    requireValid(
      object(member) &&
        member.unitId === orderedIds[index] &&
        coordinate(member.from) &&
        (!member.destination || coordinate(member.destination)),
      'formation placement',
    );
  requireValid(
    continuation.route === null ||
      (Array.isArray(continuation.route) &&
        continuation.route.length <= snapshot.width * snapshot.height * 4 &&
        continuation.route.every(coordinate)),
    'formation route',
  );
  requireValid(
    Array.isArray(continuation.orders) &&
      continuation.orders.length <= snapshot.width * snapshot.height * 200 &&
      continuation.orders.every(
        (order) =>
          object(order) &&
          order.type === 'move' &&
          ids.includes(String(order.unitId)) &&
          coordinate(order),
      ),
    'formation receipts',
  );
}
