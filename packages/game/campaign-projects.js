export const CAMPAIGN_PROJECT_LABELS=Object.freeze({foundry:'Organización de la fundición',army:'Financiación del ejército'});
const flags={foundry:'foundry',army:'armyFunded'};
export const campaignProjectComplete=(state,project)=>Object.hasOwn(flags,project)&&state.flags[flags[project]]===true;
