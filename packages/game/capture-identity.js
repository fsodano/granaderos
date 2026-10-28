// Keep first-capture IDs loadable. Later capture cycles are distinct even when
// strategic time has not crossed an hour boundary.
export const captureSequence=record=>record?.captureSequence??1;
export const detentionId=(operativeId,record)=>`captive:${operativeId}:${record.capturedAt}${captureSequence(record)>1?`:${captureSequence(record)}`:''}`;
export const sameCaptivity=(record,detention)=>Boolean(record?.captured&&detention&&record.capturedAt===detention.capturedAt&&record.capturedSector===detention.sector&&captureSequence(record)===captureSequence(detention));
