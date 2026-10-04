import {weaponSpecification} from './weapon-definition.js';
import {WEAPONS} from './data.js';
import {repairMaterialPoints,isRepairKit} from './repair-materials.js';
import {extractItemQuantity} from './tactical-inventory.js';
import {BODY_SLOTS,OUTFITS,validateOutfit} from './outfits.js';

export function spendRepairMaterials(record,points){
 if(!Number.isSafeInteger(points)||points<0||points>repairMaterialPoints(record))throw Error('No quedan esos materiales de reparación.');
 const reserve=Math.min(record.toolkitPoints??0,points);record.toolkitPoints=(record.toolkitPoints??0)-reserve;points-=reserve;
 for(const key of Object.keys(record.inventory??{}).sort()){
  if(!points)break;
  const kit=record.inventory[key];if(!isRepairKit(kit)||kit.count<=0)continue;
  const spent=Math.min(points,kit.repairPoints);points-=spent;
  if(spent===kit.repairPoints){const next=extractItemQuantity(record,`inventory:${key}`,1).unit;for(const field of Object.keys(record))delete record[field];Object.assign(record,next);}
  else kit.repairPoints-=spent;
 }
}

const tools={lockpick:'Ganzúas',crowbar:'Barreta',pliers:'Alicates'};
const handheld=id=>Number.isInteger(id)&&id>=1800&&id<=1813&&Object.hasOwn(WEAPONS,id);
const gun=id=>(WEAPONS[id]?.capacity??0)>0;

// References are private to the working hour. Public previews contain values
// only. A continuing equipment job follows its owner's current belongings.
function entries(record,op){
  const result=[];
  const add=(key,label,value,conditionKey='condition',count=1,firearm=false,packKey=null)=>{
    const condition=value[conditionKey]??100,jammed=firearm&&value.jammed===true;
    if(count>0&&(condition<100||jammed))result.push({key,label,value,conditionKey,condition,count,jammed,packKey});
  };
  const fitting=(key,value)=>{if(value?.bayonet)add(`${key}:bayonet`,'Bayoneta montada',value.bayonet);};
  if(handheld(op.blade))add('blade',weaponSpecification({...op,...record},'blade').name,record,'bladeCondition');
  if(handheld(op.weapon)&&!record.weaponDropped){
    add('primary',weaponSpecification({...op,...record}).name,record,'condition',1,gun(op.weapon));
    fitting('primary',record.weaponFittings);
  }
  if(record.offHand){add('offhand',weaponSpecification(record.offHand)?.name??'Arma secundaria',record.offHand,'condition',1,gun(record.offHand.weapon));fitting('offhand',record.offHand.fittings);}
  // Finish individual pack items before opening another legacy bulk stack.
  const inventory=Object.entries(record.inventory??{}).filter(([,value])=>value&&typeof value==='object'&&value.count>0)
    .sort(([a,left],[b,right])=>(left.count>1)-(right.count>1)||a.localeCompare(b));
  for(const [key,value]of inventory){
    if(handheld(value.weapon)){
      add(`inventory:${key}`,weaponSpecification(value).name,value,'condition',value.count,gun(value.weapon),key);
      fitting(`inventory:${key}`,value.fittings);
    }else if((value.itemType==='tool'||value.kind==='tool')&&Object.hasOwn(tools,value.toolKey)){
      add(`inventory:${key}`,tools[value.toolKey],value,'condition',value.count,false,key);
    }
  }
  // Clothing follows the existing weapon, fitting and tool work. An empty
  // body slot stays empty; repairing a ruined garment never reissues it.
  for(const slot of BODY_SLOTS){
    const value=record[slot];if(value==null)continue;
    validateOutfit(value,{worn:true,slot});add(slot,OUTFITS[value.outfit].name,value);
  }
  for(const [key,value]of inventory){
    if(value.kind!=='outfit')continue;
    validateOutfit(value);add(`inventory:${key}`,OUTFITS[value.outfit].name,value,'condition',value.count,false,key);
  }
  return result;
}

export function repairEquipmentQueue(record,op){
  return entries(record,op).map(({key,label,condition,count,jammed})=>({key,label,condition,count,jammed}));
}

export function repairEquipmentBlocked(record,op){
  return (entries(record,op)[0]?.count??0)>1&&Object.keys(record.inventory??{}).length>=1000;
}

function singleItem(record,entry){
  if(entry.count===1)return entry.value;
  // Weapons, tools and garments occupy one pocket allocation per unit. Splitting
  // a legacy stack changes neither quantity nor occupied inventory space.
  const base=entry.packKey.slice(0,80);
  let index=1,key;
  do{key=`${base}:repair-${index++}`;}while(Object.hasOwn(record.inventory,key));
  const value=structuredClone(entry.value);value.count=1;
  entry.value.count--;
  record.inventory[key]=value;
  return value;
}

export function repairEquipment(record,op,budget){
  if(!Number.isInteger(budget)||budget<0)throw Error('Los puntos de reparación no son válidos.');
  let remaining=budget;
  while(remaining>0){
    const entry=entries(record,op)[0];if(!entry)break;
    if(entry.count>1&&Object.keys(record.inventory??{}).length>=1000)break;
    const value=singleItem(record,entry);
    // Clearing a jam consumes a point before condition work. It neither loads
    // the gun nor creates cartridges, flints, or priming powder.
    if(entry.jammed){value.jammed=false;remaining--;if(!remaining)break;}
    const points=Math.min(remaining,Math.ceil(100-(value[entry.conditionKey]??100)));
    if(points>0){value[entry.conditionKey]=Math.min(100,(value[entry.conditionKey]??100)+points);remaining-=points;}
  }
  return budget-remaining;
}
