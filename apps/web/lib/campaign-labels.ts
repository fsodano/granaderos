import {transportOptionsFor} from '../../../packages/game/logistics.js';
export {campaignFactionName} from '../../../packages/game/campaign-faction-presentation.js';

export function campaignTransportName(context:any,id:string){
 return transportOptionsFor(context).find(mode=>mode.id===id)?.name??(id==='march'?'Marcha a pie':id==='horse'?'A caballo':id);
}
