import type { CampaignAction, CampaignServiceContract, CampaignSquad } from './campaign-types.ts';

export interface ContractTerm {
  name: string;
  hours: number;
  days: number;
}
export interface ServiceRefusal {
  character: string;
  reason: string;
  rivalId: number;
  rivalName: string;
}
export interface ContractQuote {
  guarantee: number;
  total: number;
  heldGuarantee: number;
  expiresAt: number | null;
  expiresSecond: number | null;
  available: boolean;
  reason: string | null;
  serviceRefusal?: ServiceRefusal | undefined;
  topTier: boolean;
  permanent: boolean;
  term: string;
  hours: number | null;
  price: number;
  daily: number;
}
export interface ContractStatus extends CampaignServiceContract {
  remaining: number | null;
  active: boolean;
}
export interface ServiceGuaranteeFunding {
  operativeId: number;
  amount: number;
  fundedAt: number;
  fundedSecond: number;
}
export type ServiceGuarantee = ServiceGuaranteeFunding &
  (
    | { state: 'held' }
    | {
        state: 'departed' | 'cancelled' | 'forfeited';
        settledAt: number;
        settledSecond: number;
        refund: number;
        creditedRefund?: number;
        creditedAt?: number;
        creditedSecond?: number;
        hp?: number;
        maxHp?: number;
      }
  );
export interface SquadSlot {
  number: number | null;
  label: string;
  squad: CampaignSquad | null;
}
export type SquadAssignment = { number: number | null; label: string; reason: string | null } & (
  | { squad: CampaignSquad; action: Extract<CampaignAction, { type: 'assignToSquad' }> }
  | { squad: null; action: Extract<CampaignAction, { type: 'createSquad' }> }
);
export interface AssignmentProgress {
  state: 'blocked' | 'waiting' | 'complete' | 'working';
  code: string | null;
}
