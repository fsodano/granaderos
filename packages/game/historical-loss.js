import {scenarioFor} from './campaign-scenario.js';
export const historicalRequiredActors=s=>scenarioFor(s).losses.historicalRequiredActors(s);
export const historicalLossReason=s=>scenarioFor(s).losses.historicalLossReason(s);
export const enforceHistoricalLoss=s=>scenarioFor(s).validateHistoricalState(s);
