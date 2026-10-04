// A declared acceptance strategy for the created officer's coastal opening.
// Every move, shot, treatment and reload uses ordinary reducer orders.
import {fight as recordedFight} from './opening-driver.mjs';
import {hiredAssaultOrder} from './hired-assault-driver.mjs';

export function fight(request,previous=null){
 return recordedFight(request,previous,{controller:(battle,unit)=>hiredAssaultOrder(battle,unit,{reconBudget:16})});
}
