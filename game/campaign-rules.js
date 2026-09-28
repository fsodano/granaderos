// Defaults preserve campaigns created before rule authoring was available.
export const DEFAULT_CAMPAIGN_RULES=Object.freeze({startingTreasury:3200,deploymentCartridges:10,enemyCartridges:13,militiaCartridges:6});
export function validateCampaignRules(value){
 if(value===undefined)return [];
 const keys=Object.keys(DEFAULT_CAMPAIGN_RULES);
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||!keys.every(key=>Object.hasOwn(value,key)))return ['Reglas: configurá los fondos iniciales y los tres grupos de cartuchos.'];
 return keys.flatMap(key=>Number.isSafeInteger(value[key])&&value[key]>=0&&value[key]<=(key==='startingTreasury'?1000000:100)?[]:[`Reglas.${key}: valor entero fuera de rango.`]);
}
export const campaignRules=state=>state?.contentCampaign?.package.rules??DEFAULT_CAMPAIGN_RULES;
