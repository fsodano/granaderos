import {transportOptionsFor} from '../../game/logistics.js';
export {campaignFactionName} from '../../game/campaign-faction-presentation.js';

export function campaignTransportName(context:any,id:string){
 return transportOptionsFor(context).find(mode=>mode.id===id)?.name??(id==='march'?'Marcha a pie':id==='horse'?'A caballo':id);
}
