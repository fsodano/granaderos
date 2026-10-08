import {rosterFor} from '../../game/campaign.js';
import {guaranteeDepartureReason} from '../../game/service-guarantees.js';
import {operativeInTransit} from '../../game/squads.js';

export default function ServiceRefusalNotice({state,refusal,disabled=false,dispatch}:{state:any;refusal:any;disabled?:boolean;dispatch:(action:any)=>void}){
 if(!refusal)return null;
 const moving=operativeInTransit(state,refusal.rivalId),refundReason=guaranteeDepartureReason(state,state.contracts?.[refusal.rivalId],rosterFor(state).find(o=>o.id===refusal.rivalId)),blocked=disabled||moving||refusal.rivalId===1000||Boolean(refundReason);
 return <div className="service-refusal" role="status">
  <p>{refusal.reason}</p>
  <p>Podés conservar a {refusal.rivalName} o finalizar su servicio. El rechazo no acorta los contratos ya pagados.</p>
  {refundReason&&!moving&&<p>{refundReason}</p>}
  <button type="button" className="line-button" disabled={blocked} title={moving?'Esperá a que llegue antes de finalizar su servicio.':refundReason||undefined} onClick={()=>dispatch({type:'dismiss',id:refusal.rivalId,...(state.contracts?.[refusal.rivalId]?.guaranteeId?{expectedGuaranteeId:state.contracts[refusal.rivalId].guaranteeId}:{})})}>Finalizar servicio de {refusal.rivalName}</button>
 </div>;
}
