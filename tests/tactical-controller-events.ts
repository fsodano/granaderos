import type {BattleArtillery, BattleSnapshot, BattleUnit, TacticalAction} from '../packages/game/public/compatibility-types.ts';
import type {ArtilleryCrewPlan, ReachableCell} from '../packages/game/public/tactical-query-types.ts';
import type {ExitPreview} from '../packages/game/public/hud-types.ts';

export interface ControllerMovementEvent {
  event: 'actualZeroCriticalAidApproach' | 'actualRaidQuietAidRegroup' | 'actualRaidKnownQuietSearch' | 'actualRearCorridorMove' | 'actualMedicalRegroup';
  action: TacticalAction;
  path: ReachableCell;
  turn: number;
  elapsed: number;
  patientHP?: number;
  buddy?: string;
  buddyId?: string;
  lastVisible?: number;
}
export interface CrewResources {id: string; ap: number; energy: number}
export type CrewPreparationMove = {
  action: TacticalAction;
  mode: BattleSnapshot['mode'];
  cost: number;
  crew: string[];
  before: CrewResources[];
  after: CrewResources[];
  elapsed: number;
} | {
  action: TacticalAction;
  path: ReachableCell;
  before: {ap:number; energy:number; elapsed:number};
  after: {ap:number; energy:number; elapsed:number};
};
export interface CrewPreparationPlan {gun: string; operator:string; plan:ArtilleryCrewPlan;fireCost:number}
export interface CrewFireLane {gun: string; orders:{id:string;action:TacticalAction|null}[]}
export interface CrewPreparationReceipt {
  before: {guns:BattleArtillery[];units:BattleUnit[];elapsed:number};
  moves:CrewPreparationMove[];
  plans:CrewPreparationPlan[];
  lanes:CrewFireLane[];
  visibleTargetCount:number;
  after:{elapsed:number;units:{id:string;x:number;y:number;hp:number;energy:number;ap:number}[]};
}
export interface LightGunPreparation {
  action:TacticalAction;
  path:ReachableCell;
  elapsed:number;
  operator:{x:number;y:number;hp:number;energy:number;ap:number};
  gun:BattleArtillery;
  lane?: {action:TacticalAction;path:ReachableCell|null|undefined;elapsed:number}[];
}
export type TacticalControllerEvent = ControllerMovementEvent
 | {event:'actualQuietEvacuationStart';turn:number;elapsed:number;hp:number}
 | {event:'actualEvacuationExit';action:TacticalAction;preview:ExitPreview;hp:number}
 | {event:'paidDistinctCrewLanePrep';moves:CrewPreparationMove[];plans:CrewPreparationPlan[];lanes:CrewFireLane[];visibleTargetCount:number;elapsed:number;receipt:CrewPreparationReceipt}
 | {event:'actualThirdSwivelContact';preparation:LightGunPreparation}
 | {event:'paidCoordinatedLightLane';orders:number;elapsed:number};
export interface ControllerReportOptions {report?: (event:TacticalControllerEvent)=>void}
