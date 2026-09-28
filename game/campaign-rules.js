// Defaults preserve campaigns created before rule authoring was available.
export const DEFAULT_CAMPAIGN_RULES=Object.freeze({startingTreasury:3200,deploymentCartridges:10,enemyCartridges:13,militiaCartridges:6});
export const DEFAULT_CARTRIDGE_PRICE=1;
// Optional in content: do not add a redundant field to older package identities.
export const cartridgePrice=state=>state?.contentCampaign?.package.rules?.cartridgePrice??DEFAULT_CARTRIDGE_PRICE;
export function validateCampaignRules(value){
 if(value===undefined)return [];
 const keys=Object.keys(DEFAULT_CAMPAIGN_RULES);
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)&&key!=='cartridgePrice')||!keys.every(key=>Object.hasOwn(value,key)))return ['Reglas: configurá los fondos iniciales y los tres grupos de cartuchos. El precio del cartucho es opcional.'];
 return Object.keys(value).flatMap(key=>Number.isSafeInteger(value[key])&&value[key]>=0&&value[key]<=(['startingTreasury','cartridgePrice'].includes(key)?1000000:100)?[]:[`Reglas.${key}: valor entero fuera de rango.`]);
}
export const campaignRules=state=>state?.contentCampaign?.package.rules??DEFAULT_CAMPAIGN_RULES;
