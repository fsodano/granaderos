import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {resaleBreakdown} from '../game/equipment.js';

export function sellSurplusEquipment(start,sector,carrierIds,target,{report=()=>{},reserve=5}={}){
 let c=structuredClone(start);
 const order=a=>{const next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+next.lastError);c=next;};
// Sell only surplus recovered guns, after every survivor has equipped. Keep
// the requested replacement reserve and each merchant's real cash and preferences.
const sales=[];
for(let attempt=0;attempt<100&&c.resources.treasury<target;attempt++){
 let sold=false;
 for(const id of carrierIds){
  const model=sectorInventoryModel(c,sector,rosterFor(c),id);
  const guns=model.entries.filter(row=>row.reachable&&JSON.parse(row.expected).weapon>=1800&&JSON.parse(row.expected).weapon<=1808);
  if(guns.reduce((sum,row)=>sum+row.count,0)<=reserve)continue;
  const offered=guns.map(row=>({row,quote:resaleBreakdown({...JSON.parse(row.expected),item:JSON.parse(row.expected).weapon},sector)})).filter(({quote})=>!quote.reason&&quote.total>0&&quote.total<=c.merchants[sector].cash).sort((a,b)=>a.quote.total-b.quote.total)[0];
  if(!offered)continue;
  const beforeKeys=new Set(model.carried.map(row=>row.item)),row=offered.row;
  const picked=dispatchCampaign(c,{type:'sectorInventory',sector:sector,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
  if(picked.lastError)continue;
  c=picked;
  const carried=sectorInventoryModel(c,sector,rosterFor(c),id).carried.find(row=>!beforeKeys.has(row.item)&&row.store?.valid);
  assert.ok(carried,'the recovered gun must remain an identifiable carried item');
  order({type:'sectorInventory',sector:sector,operativeId:id,direction:'store',item:carried.item,count:1,expected:carried.store.expected});
  const stored=c.armoryItems.at(-1),cash=c.resources.treasury;
  order({type:'sellEquipment',instanceId:stored.id});
  sales.push({instanceId:stored.id,item:stored.item,price:c.resources.treasury-cash});sold=true;break;
 }
 if(!sold)break;
}
report({stage:'surplus-equipment-sales',sales,treasury:c.resources.treasury});
 return c;
}
