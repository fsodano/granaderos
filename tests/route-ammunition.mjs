import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,isSupplied} from '../game/campaign.js';
import {carriedAmmunition,ammunitionOrderQuote,AMMUNITION_ORDER_LIMIT} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';

// Refill the actual selected load of each present soldier. Sector reserves are
// finite; any shortage is bought locally and goes directly into that soldier's pockets.
export function supplyRouteAmmunition(start,ids,{target=10,report=()=>{}}={}){
 let campaign=structuredClone(start);const transactions=[];
 for(const id of ids){
  const op=rosterFor(campaign).find(unit=>unit.id===id);
  const carried=()=>carriedAmmunition(op,campaign.operativeState[id]);
  const unit=carried(),family=ammoTypeFor({...unit,activeSlot:'primary'});
  if(!family||unit.weaponDropped)continue;
  let remaining=Math.max(0,target-unit.loaded-ammoCount(unit,family));
  while(remaining){
   const stored=campaign.ammunitionStores[campaign.location]?.[family]??0;
   const direction=stored?'take':'buy',quantity=Math.min(remaining,AMMUNITION_ORDER_LIMIT,stored||Infinity);
   const quote=ammunitionOrderQuote(campaign,op,family,quantity,direction,isSupplied(campaign,campaign.location));
   assert.equal(quote.available,true,`ammunition for ${id} at ${campaign.location}: ${quote.reason}`);
   const before=campaign.resources.treasury,action={type:'ammunition',operativeId:id,family,quantity,direction};
   campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,campaign.lastError);
   assert.equal(campaign.resources.treasury,before-quote.cost);
   assert.equal(ammoCount(carried(),family),quote.carried+quantity);
   assert.equal(campaign.ammunitionStores[campaign.location]?.[family]??0,quote.stored-(direction==='take'?quantity:0));
   if(direction==='buy')assert.equal(campaign.ammunitionShops[campaign.location].stock[family],quote.stock-quantity);
   const transaction={action,sector:campaign.location,hour:campaign.hour,cost:quote.cost,unitPrice:quote.unitPrice};
   transactions.push(transaction);report(transaction);remaining-=quantity;
  }
  assert.ok(carried().loaded+ammoCount(carried(),family)>=target);
 }
 return {campaign,transactions};
}
