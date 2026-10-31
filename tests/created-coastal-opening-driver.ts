import type { CampaignPendingBattle } from '../packages/game/public/campaign-types.ts';
import type { BattleSnapshot } from '../packages/game/public/compatibility-types.ts';
import type { FightResult } from './opening-driver.ts';
// A declared acceptance strategy for the created officer's coastal opening.
// Every move, shot, treatment and reload uses ordinary reducer orders.
import { fight as recordedFight } from './opening-driver.ts';
import { hiredAssaultOrder } from './hired-assault-driver.ts';

export function fight(
  request: CampaignPendingBattle,
  previous: BattleSnapshot | null = null,
): FightResult {
  return recordedFight(request, previous, { controller: hiredAssaultOrder });
}
