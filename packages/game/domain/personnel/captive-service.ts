// Capture pauses the unused portion of a contract. Neither the status panel
// nor release may charge for, or grant service during, detention.
export type CapturedContract = Readonly<{
  expiresAt?: number | null;
  expiresSecond?: number;
  departurePending?: unknown;
  [field: string]: unknown;
}>;

export type CaptiveRecord = Readonly<{
  captured?: boolean;
  capturedAt: number;
  capturedAtSecond?: number;
  capturedContract?: CapturedContract | null;
}>;

export type RebuiltCaptiveContract = {
  expiresAt?: number | null;
  expiresSecond?: number;
  departurePending?: unknown;
  [field: string]: unknown;
};

// A saved contract stores its expiry as whole hours plus the seconds into that
// hour, so its instant in seconds is read from those two fields.
function capturedContractExpirySeconds(contract: CapturedContract): number | null {
  const expiresAt = contract.expiresAt;
  if (expiresAt === null || expiresAt === undefined) {
    return null;
  }
  return expiresAt * 3600 + (contract.expiresSecond ?? 0);
}

export function captiveServiceHours(
  record: CaptiveRecord | null | undefined,
): number | null | undefined {
  if (!record?.captured || !record.capturedContract) {
    return undefined;
  }
  const expiry = capturedContractExpirySeconds(record.capturedContract);
  return expiry === null
    ? null
    : Math.max(0, expiry - record.capturedAt * 3600 - (record.capturedAtSecond ?? 0)) / 3600;
}

export function restoredCaptiveContract(
  record: CaptiveRecord | null | undefined,
  hour: number,
  secondOfHour = 0,
): RebuiltCaptiveContract | null {
  const remaining = captiveServiceHours(record);
  if (remaining === undefined || !record?.capturedContract) {
    throw Error('El combatiente no tiene un contrato en cautiverio.');
  }
  if (remaining === 0) {
    return null;
  }
  const contract: RebuiltCaptiveContract = { ...structuredClone(record.capturedContract) };
  delete contract.departurePending;
  if (remaining !== null) {
    const expiry = hour * 3600 + secondOfHour + Math.round(remaining * 3600);
    contract.expiresAt = Math.floor(expiry / 3600);
    if (expiry % 3600 || contract.expiresSecond !== undefined) {
      contract.expiresSecond = expiry % 3600;
    }
  }
  return contract;
}
