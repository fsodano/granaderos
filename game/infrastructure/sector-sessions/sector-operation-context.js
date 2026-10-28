import { SectorOperationContext } from '../../domain/sector-sessions/sector-operation-context.ts';

export function sectorOperationContextFor(snapshot, requestId) {
  const sectorSessionId = snapshot?.sectorSession?.id;
  return new SectorOperationContext({
    sessionId: snapshot?.gameSessionId ?? sectorSessionId,
    sectorSessionId,
    revision: snapshot?.gameRevision ?? snapshot?.sectorRevision ?? 0,
    sectorRevision: snapshot?.sectorRevision ?? 0,
    requestId: String(requestId),
  });
}

export function assertSectorOperationContext(snapshot, context) {
  const expected = sectorOperationContextFor(snapshot, context?.requestId);
  expected.assertMatches(context);
  return expected;
}
