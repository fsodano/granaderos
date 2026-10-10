import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {carriedAmmunition,ammunitionOrderQuote,AMMUNITION_ORDER_LIMIT} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {AMMUNITION_FAMILIES} from '../game/ammunition-families.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {applyItemQuantity} from '../game/tactical-inventory.js';
import {FINITE_SECTOR_CACHES} from '../game/finite-sector-caches.js';
import {discoverRouteCache} from './finite-route-equipment.mjs';

let diagnosticSequence=0;
// Opt-in raw observation only. Never normalize a save or apply another order.
export function recordRouteAmmunitionDiagnostic(stage,campaign,context={}){
 const root=process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;if(!root)return null;
 try{
  const directory=join(root,'ammunition-preparation');mkdirSync(directory,{recursive:true});
  const label=stage.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100);
  const path=join(directory,`${process.pid}-${++diagnosticSequence}-${label}.json`);
  writeFileSync(path,JSON.stringify({version:1,stage,sourceSnapshot:process.env.GRANADEROS_CAMPAIGN_SOURCE_SNAPSHOT??null,
   scope:'Raw passive checkpoint. No extra dispatch, synchronization or save normalization.',context,campaign})+'\n',{flag:'wx'});
  return path;
 }catch(error){
  process.stderr.write(JSON.stringify({event:'ammunitionDiagnosticWriteFailed',stage,message:error.message})+'\n');return null;
 }
}

// Refill the actual selected load from finite depot and reachable known loot.
// Discover the authored cache only after known physical stocks run out.
export function supplyRouteAmmunition(start,ids,{target=10,report=()=>{},onDiagnosticCheckpoint=null}={}){
 assert.ok(Number.isSafeInteger(target)&&target>=0&&target<=1_000_000,'Use a finite integer ammunition target.');
 let campaign=structuredClone(start);const transactions=[];
 for(const id of ids){
  const op=rosterFor(campaign).find(unit=>unit.id===id);
  assert.ok(op&&campaign.recruited.includes(id)&&campaign.operativeState[id]?.alive&&!campaign.operativeState[id]?.captured,`El combatiente no está disponible: ${id}.`);
  const carried=()=>carriedAmmunition(op,campaign.operativeState[id]);
  const unit=carried(),family=ammoTypeFor({...unit,activeSlot:'primary'});
  if(!family||unit.weaponDropped)continue;
  let remaining=Math.max(0,target-unit.loaded-ammoCount(unit,family)),checkedCache=false;
  while(remaining){
   const access=ammunitionOrderQuote(campaign,op,family,1,'take',true);
   assert.ok(access.available||access.reason==='El depósito no tiene suficientes cartuchos.',`ammunition for ${id} at ${campaign.location}: ${access.reason}`);
   const stored=campaign.ammunitionStores[campaign.location]?.[family]??0;
   let action,quantity,sourceKind;
   if(stored){
    quantity=Math.min(remaining,AMMUNITION_ORDER_LIMIT,stored);
    while(quantity>0&&!ammunitionOrderQuote(campaign,op,family,quantity,'take',true).available)quantity--;
    assert.ok(quantity>0,`No queda espacio en los bolsillos para los cartuchos de ${id}.`);
    action={type:'ammunition',operativeId:id,family,quantity,direction:'take'};sourceKind='depot';
   }else{
    const model=sectorInventoryModel(campaign,campaign.location,rosterFor(campaign),id);
    assert.equal(model.operativeId,id,'The requested carrier must be present.');
    const row=model.entries.find(row=>row.reachable&&row.count>0&&JSON.parse(row.expected).kind==='ammunition'&&JSON.parse(row.expected).ammoType===AMMUNITION_FAMILIES[family].type);
    if(!row&&!checkedCache){
     checkedCache=true;const cacheId=FINITE_SECTOR_CACHES[campaign.location]?.chest;
     const chest=campaign.sectorStates[campaign.location]?.props?.find(prop=>prop.id===cacheId);
     if(cacheId&&(!chest?.open||!chest.knownToPlayer)){
      campaign=discoverRouteCache(campaign,id);
      report({event:'ammunitionCacheDiscovered',sector:campaign.location,cacheId,hour:campaign.hour,secondOfHour:campaign.secondOfHour??0});continue;
     }
    }
    if(!row){
     report({event:'ammunitionShortage',operativeId:id,sector:campaign.location,family,target,remaining,carried:carried().loaded+ammoCount(carried(),family)});
     const error=Error(`Finite ammunition shortage for ${id} at ${campaign.location}: ${remaining} ${family} rounds are missing.`);
     if(process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR){
      recordRouteAmmunitionDiagnostic('finite-ammunition-refusal',campaign,{operativeId:id,ids,target,family,remaining,
       acceptedAmmunitionTransactions:transactions,cacheExplorationOrdersIncluded:false,
       checkpointKind:'actual-partial-campaign-after-existing-accepted-orders'});
      if(typeof onDiagnosticCheckpoint==='function')try{onDiagnosticCheckpoint(structuredClone(campaign));}
      catch(diagnosticError){process.stderr.write(JSON.stringify({event:'ammunitionDiagnosticCallbackFailed',message:diagnosticError.message})+'\n');}
     }
     throw error;
    }
    const stack=JSON.parse(row.expected);quantity=Math.min(remaining,row.count);
    while(quantity>0){try{applyItemQuantity(model.personal,{...stack,count:quantity});break;}catch{quantity--;}}
    assert.ok(quantity>0,`No queda espacio en los bolsillos para los cartuchos de ${id}.`);
    action={type:'sectorInventory',sector:campaign.location,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:quantity};sourceKind=row.kind;
   }
   const before=campaign.resources.treasury,stock=ammoCount(carried(),family);
   campaign=dispatchCampaign(campaign,action);assert.equal(campaign.lastError,null,campaign.lastError);
   assert.equal(campaign.resources.treasury,before);assert.equal(ammoCount(carried(),family),stock+quantity);
   if(sourceKind==='depot')assert.equal(campaign.ammunitionStores[campaign.location]?.[family]??0,stored-quantity);
   const transaction={action,sector:campaign.location,hour:campaign.hour,secondOfHour:campaign.secondOfHour??0,cost:0,quantity,family,sourceKind};
   transactions.push(transaction);report(transaction);remaining-=quantity;
  }
  assert.ok(carried().loaded+ammoCount(carried(),family)>=target);
 }
 return {campaign,transactions};
}
