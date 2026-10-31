import type {
  CampaignAction,
  CampaignEncounter,
  CampaignSnapshot,
  StrategicRoutePreview,
} from '../packages/game/public/campaign-types.ts';
import type { ContractQuote } from '../packages/game/public/personnel-query-types.ts';
import type { JourneyModeValue } from '../packages/game/domain/journeys/journey.ts';
export type FieldAidReadiness = {
  medicId: number;
  target: number;
  initialDressings: number;
  collected: number;
  courierId: number | null;
  elapsedSeconds: number;
};
type Clock = { hour: number; secondOfHour: number };
type RouteQuote = { path: string[]; hours: number; reason: string | null } | StrategicRoutePreview;
export type MedicalCourierEvent =
  | ({
      event: 'medicalCourierRenewal';
      id: number;
      cost: number;
      phase: string;
      action: CampaignAction;
      quote: ContractQuote;
    } & Clock)
  | ({
      event: 'medicalCourierEncounter';
      operativeId: number;
      clinic: string;
      destination: string;
      phase: string;
      encounter: CampaignEncounter;
    } & Clock)
  | { event: 'medicalCourierRestStarted'; operativeId: number; campaign: CampaignSnapshot }
  | ({ event: 'medicalCourierRestOrder'; action: CampaignAction; elapsedSeconds?: number } & Clock)
  | {
      event: 'medicalCourierReady';
      operativeId: number;
      restHours: number;
      elapsedSeconds: number;
      campaign: CampaignSnapshot;
    }
  | {
      event: 'finiteMedicalCourier';
      operativeId: number;
      clinic: string;
      source: string;
      quantity: number;
      mode: JourneyModeValue;
      outward: RouteQuote;
      returning: RouteQuote;
      elapsedSeconds: number;
    }
  | {
      event: 'medicalCourierStopped';
      operativeId: number;
      reason: string;
      campaign: CampaignSnapshot;
    }
  | ({ event: 'coastalFieldAidOrder'; action: CampaignAction } & Clock)
  | ({ event: 'coastalFieldAidReady'; clinic: string } & FieldAidReadiness);
export type MedicalCourierReporter = (event: MedicalCourierEvent) => void;
