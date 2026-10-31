import { campaignWorld } from './campaign-definition.js';
import type { CampaignContext } from './public/compatibility-types.ts';
import type { CampaignSnapshot } from './public/campaign-types.ts';
import type { IncomeSource } from '../campaign-format/types.ts';

export type TownIncomeSource = IncomeSource & {
  base: number;
  daily: number;
  income: number;
  activated: boolean;
  controlled: boolean;
  uncontrolled: string[];
  statusCode: 'uncontrolled' | 'awaiting-representative' | 'active';
  status: string;
};
export function incomeDefinitions(context?: CampaignContext): IncomeSource[] {
  return campaignWorld(context).incomeSources;
}
export function townIncomeSourceForNPC(
  npcId: string,
  context: CampaignContext = null,
): IncomeSource | null {
  return incomeDefinitions(context).find((source) => source.representative.npcId === npcId) ?? null;
}
export function townIncomeSourceForSector(
  sectorId: string,
  context: CampaignContext = null,
): IncomeSource | null {
  return (
    incomeDefinitions(context).find((source) => source.requiredSectors.includes(sectorId)) ?? null
  );
}
export function townIncomeSources(state: CampaignSnapshot): TownIncomeSource[] {
  return incomeDefinitions(state).map((source) => {
    const uncontrolled = source.requiredSectors.filter(
      (id) => state.sectors[id]?.owner !== 'patriot',
    );
    const controlled = uncontrolled.length === 0;
    const activated = Boolean(state.townIncome?.activations[source.id]);
    const base = state.townIncome?.dailyAmounts?.[source.id] ?? source.dailyAmount;
    const daily = controlled && activated ? base : 0;
    const statusCode = !controlled
      ? 'uncontrolled'
      : !activated
        ? 'awaiting-representative'
        : 'active';
    const status = !controlled
      ? activated
        ? 'Suspendida: falta control total'
        : 'Falta control total'
      : !activated
        ? `Hablá con ${source.representative.name}`
        : 'Activa';
    return {
      ...source,
      requiredSectors: [...source.requiredSectors],
      representative: { ...source.representative },
      base,
      daily,
      income: daily,
      activated,
      controlled,
      uncontrolled,
      statusCode,
      status,
    };
  });
}
export function dailyTownIncome(state: CampaignSnapshot): number {
  return townIncomeSources(state).reduce((total, source) => total + source.daily, 0);
}
export function incomeSummary(state: CampaignSnapshot): {
  daily: number;
  hoursUntilPayment: number;
  secondsUntilPayment: number;
} {
  const secondsUntilPayment = 86400 - (state.hour % 24) * 3600 - (state.secondOfHour ?? 0);
  return {
    daily: dailyTownIncome(state),
    hoursUntilPayment: secondsUntilPayment / 3600,
    secondsUntilPayment,
  };
}
