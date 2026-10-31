import type {
  CampaignAction,
  CampaignHiringArrival,
  CampaignPendingBattle,
  CampaignSnapshot,
} from '../packages/game/public/campaign-types.ts';
import type {
  BattleSnapshot,
  BattleUnit,
  TacticalAction,
} from '../packages/game/public/compatibility-types.ts';
import type { AutoBandageResult } from '../packages/game/public/scene-query-types.ts';
import type { BattleController, BattleOrder, FightOptions, FightResult } from './opening-driver.ts';
import type { FieldAidReadiness, MedicalCourierEvent } from './medical-courier-types.ts';
import type { OpeningCare } from './local-opening-care-fixture.ts';
import type { RouteHire } from './paid-route-hiring.ts';
import type { AmmunitionTransaction, RouteAmmunitionEvent } from './route-ammunition.ts';
import type { PreMarchReloadEvent } from './pre-march-reload.ts';
import type { stockPortOpening } from './stock-port-opening.ts';
import type { ActiveGame } from './local-contract-fixture.ts';

export type CoastalRouteKind = 'stock' | 'local' | 'created' | 'hired';
export type CoastalFightOptions = FightOptions & {
  scoutCostWeight?: number;
  avoidCivilians?: boolean;
  fallbackOrders?: boolean;
  holdPosition?: readonly string[];
  controller?: BattleController;
};
export type CoastalFight = (
  request: CampaignPendingBattle,
  previous: BattleSnapshot | null | undefined,
  options?: CoastalFightOptions,
) => FightResult;
export type StockOpeningNote = ReturnType<typeof stockPortOpening>['notes'][number];
export type CoastalRecoveryNote = {
  stage: 'stock-opening-recovery' | 'local-recovery' | 'local-final-recovery';
  hour: number;
  second: number;
  funds: number;
  squad: number[];
} & OpeningCare;
export type CoastalBattleNote = {
  sector: string;
  status: BattleSnapshot['status'];
  actions: number;
  turns: number;
  hour: number;
  second: number;
  funds: number;
  units: Pick<BattleUnit, 'id' | 'hp' | 'bleeding' | 'medkits' | 'routed'>[];
  settledFunds: number;
  phase: number;
  deaths: number[];
};
export type CoastalRouteNote =
  | StockOpeningNote
  | CoastalRecoveryNote
  | CoastalBattleNote
  | {
      stage: 'ready';
      hour: number;
      funds: number;
      squad: number[];
      hires: RouteHire[];
      waitHours: number;
    }
  | {
      stage: 'finite-ammunition-depot-trip';
      destination: string;
      origin: string;
      depot: string;
      hour: number;
      second: number;
      funds: number;
      elapsedSeconds: number;
      contractCost: number;
      shortage: string;
    }
  | {
      stage: 'finite-coastal-ammunition';
      destination: string;
      hour: number;
      second: number;
      funds: number;
      transactions: AmmunitionTransaction[];
    }
  | ({
      stage: 'paid-clinic-recovery';
      clinic: string;
      hour: number;
      second: number;
      funds: number;
      field: number[];
      caregiverIds: number[];
      hires: number[];
      arrivals: CampaignHiringArrival[];
      hireCost: number;
      fieldAid?: FieldAidReadiness;
    } & OpeningCare);
export type CoastalHireEvent = {
  event: 'coastalOpeningHireOrder';
  action: CampaignAction;
  hour: number;
  second: number;
  elapsedSeconds: number;
  treasury: number;
  campaign: CampaignSnapshot;
};
export type CoastalRouteEvent =
  | MedicalCourierEvent
  | PreMarchReloadEvent
  | RouteAmmunitionEvent
  | CoastalHireEvent
  | ({ event: 'stockOpeningCheckpoint' } & StockOpeningNote)
  | ({ event: 'stockOpeningRecovered' } & CoastalRecoveryNote)
  | { event: 'coastalLocalAmmoShortage'; destination: string; sector: string; reason: string }
  | {
      event: 'coastalFieldDressingRecovered';
      doctorId: string;
      sourceId: string;
      sourceSide: BattleUnit['side'];
      dressings: number;
      steps: TacticalAction[];
    }
  | {
      event: 'coastalFieldAid';
      sector: string;
      treated: AutoBandageResult['treatedIds'];
      untreated: AutoBandageResult['untreated'];
      stoppedReason: AutoBandageResult['stoppedReason'];
      steps: TacticalAction[];
    }
  | ({ event: 'coastalBattleSettled' } & CoastalBattleNote);
export type FreshCoastalOptions = {
  onCheckpoint?: (stage: string, campaign: CampaignSnapshot, notes: CoastalRouteNote[]) => void;
  onReplayFailure?: (event: {
    sector: string;
    index: number;
    action: BattleOrder;
    before: ActiveGame;
  }) => void;
  onBeforeBattle?: (event: {
    sector: string;
    campaign: CampaignSnapshot;
    request: CampaignPendingBattle;
    previous: BattleSnapshot | undefined;
  }) => void;
  onBattleFinished?: (event: { sector: string } & FightResult) => void;
  fightOpening?: CoastalFight;
  fightFinal?: CoastalFight;
  report?: (event: CoastalRouteEvent) => void;
  openingCheckpoint?: { campaign: CampaignSnapshot; notes: StockOpeningNote[] };
};
