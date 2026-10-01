import {isSupplied} from '../../game/campaign.js';
import {usedEquipmentOffers,equipmentLabel} from '../../game/equipment.js';
import {FittingReadout} from './JA2Bayonet';
export default function UsedEquipment({state,dispatch}:{state:any;dispatch:(action:any)=>void}){
 const offers=usedEquipmentOffers(state,isSupplied);
 return <details className="armory-resale" open={offers.length>0}>
  <summary>Armas usadas del comerciante · {offers.length} ejemplares</summary>
  <p>Las armas vendidas quedan en esta maestranza. El precio de compra es el 80% del valor nuevo, ajustado por el estado de cada pieza. Se entregan en su estado actual, sin reparación ni cartuchos adicionales.</p>
  {!offers.length&&<p>No hay armas usadas disponibles en esta localidad.</p>}
  {offers.map(({instance,quote,reason,available,action}:any)=><article key={instance.id}>
   <div><strong>{equipmentLabel(instance)}</strong><small>Estado {instance.condition}%{instance.jammed?' · Fallo de chispa':''}</small>
    <FittingReadout fitting={instance.fittings?.bayonet}/>
    {quote.items.length>1&&<ul aria-label="Desglose de compra">{quote.items.map((part:any,index:number)=><li key={index}>{part.name} · estado {part.condition}% · {part.price} pesos</li>)}</ul>}
    {reason&&<small>{reason}</small>}
   </div>
   <button className="line-button" disabled={!available} aria-label={`Comprar usado: ${equipmentLabel(instance)} · estado ${instance.condition}% · ${quote.total} pesos`} onClick={()=>dispatch(action)}>Comprar usado · {quote.total} pesos</button>
  </article>)}
 </details>;
}
