import { detentionId } from './capture-identity.js';
import {
  captiveServiceHours,
  restoredCaptiveContract,
} from './domain/personnel/captive-service.ts';

export { captiveServiceHours, restoredCaptiveContract };

/** @returns {{id:number,name:string,sector:string,hp:number,maxHp:number,capturedAt:number,capturedAtSecond:number,heldHours:number,serviceHours:number|null|undefined,careDressings:number,lastCareHour:number|null,needsCare:boolean,critical:boolean}|null} */
export function prisonerStatus(state, operative) {
  const record = state.characters[operative.id];
  if (!record?.captured) {
    return null;
  }
  const care = state.detentionRecords?.[detentionId(operative.id, record)]?.care ?? [];
  return {
    id: operative.id,
    name: operative.name,
    sector: record.capturedSector,
    hp: record.hp,
    maxHp: record.maxHp ?? operative.maxHp,
    capturedAt: record.capturedAt,
    capturedAtSecond: record.capturedAtSecond ?? 0,
    heldHours:
      Math.max(
        0,
        state.hour * 3600 +
          (state.secondOfHour ?? 0) -
          record.capturedAt * 3600 -
          (record.capturedAtSecond ?? 0),
      ) / 3600,
    serviceHours: captiveServiceHours(record),
    careDressings: care.reduce((sum, event) => sum + event.dressings, 0),
    lastCareHour: care.at(-1)?.hour ?? null,
    needsCare: record.hp < (record.maxHp ?? operative.maxHp) || Boolean(record.bleeding),
    critical: record.hp < 15,
  };
}
