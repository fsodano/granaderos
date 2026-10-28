import type {ComponentType} from 'react';
import {scenarioIdFor} from '../../../packages/game/campaign-scenario.js';
import {granaderosUI} from '../../../content/campaigns/granaderos/ui/panels';
export type StatePanelProps={state:any;dispatch:(action:any)=>void};
export type SectorPanelProps=StatePanelProps&{selected:string;owner:string|null;careBusy:boolean;moving:boolean};
export type MissionFinishProps={state:any;mission:any;busy:boolean;onFinish?:()=>void};
export type PreparationOrder={type:string;kind?:string;label:string;price:number;reason?:string|null};
export type CampaignUI={
 DeskBriefing?:ComponentType<StatePanelProps>;DeskObjective?:ComponentType<StatePanelProps>;SectorBriefing?:ComponentType<SectorPanelProps>;
 Diplomacy?:ComponentType<StatePanelProps>;JournalReference?:ComponentType<StatePanelProps>;MissionFinish?:ComponentType<MissionFinishProps>;FundingProgress?:ComponentType<StatePanelProps>;
 preparationOrders?:(state:any,sector:string)=>PreparationOrder[];journalLabel?:string;victoryText?:string;battleVictory?:{title:string;text:string};
};
// Only bundled, trusted scenario panels can be registered. Package JSON does
// not load scripts or select arbitrary component paths.
const panels:Record<string,CampaignUI>={'granaderos-historical-v1':granaderosUI};
const generic:CampaignUI=Object.freeze({});
export const campaignUI=(context:any):CampaignUI=>panels[scenarioIdFor(context)]??generic;
