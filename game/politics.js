import {scenarioFor} from './campaign-scenario.js';
export const tradeQuote=(s,price)=>scenarioFor(s).politics.tradeQuote(s,price);
export const policyStatus=s=>scenarioFor(s).politics.policyStatus(s);
export const applyPolicy=(s,kind)=>scenarioFor(s).politics.applyPolicy(s,kind);
export const dailyPolitics=s=>scenarioFor(s).dailyEvents(s);
export const validatePolitics=s=>scenarioFor(s).validateDailyState(s);
