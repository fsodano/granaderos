import {operativeInTransit} from '../../game/squads.js';

export default function ServiceRefusalNotice({state,refusal,disabled=false,dispatch}:{state:any;refusal:any;disabled?:boolean;dispatch:(action:any)=>void}){
 if(!refusal)return null;
 const moving=operativeInTransit(state,refusal.rivalId),blocked=disabled||moving||refusal.rivalId===1000;
 return <div className="service-refusal" role="status">
  <p>{refusal.reason}</p>
  <p>Podés conservar a {refusal.rivalName} o finalizar su servicio. El rechazo no acorta los contratos ya pagados.</p>
  <button type="button" className="line-button" disabled={blocked} title={moving?'Esperá a que llegue antes de finalizar su servicio.':undefined} onClick={()=>dispatch({type:'dismiss',id:refusal.rivalId})}>Finalizar servicio de {refusal.rivalName}</button>
 </div>;
}
