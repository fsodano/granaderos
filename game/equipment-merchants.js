import {CAMPAIGN_SECTORS} from './data.js';
import {equipmentCatalog,isImportedEquipment} from './equipment-catalog.js';
import {importRulesFor} from './campaign-imports.js';
import {headquartersFor} from './campaign-headquarters.js';
import {foundryFor} from './campaign-foundry.js';
import {artilleryTradingRules} from './artillery-trading-rules.js';
import {PONCHO_STOCK_CAP} from './outfits.js';

const need=(ok,message)=>{if(!ok)throw Error(message);};
const validCash=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9;
export const equipmentWorkshopSectors=s=>[...new Set(['retiro','cordoba','mendoza',headquartersFor(s),foundryFor(s).sector])];
export const equipmentMerchantSectors=s=>[...new Set([...equipmentWorkshopSectors(s),...(importRulesFor(s).port?[importRulesFor(s).port]:[]),...Object.keys(s.merchants??{})])];
export const equipmentStockCap=item=>item.category==='artillery'?1:item.category==='blade'?6:3;
export const merchantEquipmentCatalog=(s,at)=>equipmentCatalog(s).filter(item=>isImportedEquipment(item)?at===importRulesFor(s).port:equipmentWorkshopSectors(s).includes(at));
export const initialEquipmentMerchant=(s,at)=>({usedItems:[],stock:Object.fromEntries(merchantEquipmentCatalog(s,at).map(item=>[item.stockKey??item.item,equipmentStockCap(item)])),supplies:{medkits:equipmentWorkshopSectors(s).includes(at)?40:0,...(s.clothingSupplyVersion===1?{ponchos:equipmentWorkshopSectors(s).includes(at)?PONCHO_STOCK_CAP:0}:{})},restockHours:0,cash:equipmentWorkshopSectors(s).includes(at)?artilleryTradingRules(s).initialCash:0,...(s.grenadeSupplyVersion===1?{grenades:{arsenal:at==='mendoza'?6:0}}:{})});

// A workshop has one cash drawer for weapons and artillery. The old published
// artillery drawer migrates only when no other drawer already claims it.
export function migrateMerchantWallets(s){
 if(s.merchantWalletVersion!==undefined){
  need(s.merchantWalletVersion===1&&!Object.values(s.artilleryMerchants??{}).some(shop=>Object.hasOwn(shop,'cash')),'El comerciante conserva dos cajas de distintas versiones.');return s;
 }
 const merchants=structuredClone(s.merchants??{}),shops=structuredClone(s.artilleryMerchants??{});
 for(const [at,shop]of Object.entries(shops))if(Object.hasOwn(shop,'cash')){
  need(CAMPAIGN_SECTORS.some(p=>p.id===at)&&validCash(shop.cash)&&merchants[at]===undefined,'Las cajas antiguas del comerciante son ambiguas o inválidas.');
  merchants[at]={...initialEquipmentMerchant(s,at),cash:shop.cash};delete shop.cash;
 }
 s.merchantWalletVersion=1;
 if(Object.keys(merchants).length||s.merchants!==undefined)s.merchants=merchants;
 if(s.artilleryMerchants!==undefined)s.artilleryMerchants=shops;
 return s;
}
export const merchantCash=(s,at=s.location)=>s.merchants?.[at]?.cash??s.artilleryMerchants?.[at]?.cash??artilleryTradingRules(s).initialCash;
export function changeMerchantCash(s,at,amount){
 const next=merchantCash(s,at)+amount;need(validCash(next),'La caja del comerciante no admite ese pago.');
 migrateMerchantWallets(s);s.merchants??={};s.merchants[at]??=initialEquipmentMerchant(s,at);s.merchants[at].cash=next;
}
