import './sector-income.css';
import {CAMPAIGN_SECTORS} from '../../game/campaign.js';
import {townIncomeSources} from '../../game/town-income.js';
import {incomeSummary} from '../../game/economy.js';

const placeName=(id:string)=>CAMPAIGN_SECTORS.find(sector=>sector.id===id)?.name??id;
export default function SectorIncome({state,definition}:{state:any;definition:any}){
 const source=townIncomeSources(state).find(row=>row.requiredSectors.includes(definition.id));
 if(!source)return <section className="sector-income" aria-label="Ingresos del sector"><h3>Aporte diario</h3><p>Esta localidad no genera ingresos diarios.</p></section>;
 return <section className="sector-income" aria-label="Ingresos del sector"><h3>{source.source}</h3><p><strong>{source.daily.toLocaleString('es-AR')} pesos por día</strong> · acuerdo de {source.base.toLocaleString('es-AR')} pesos</p><p>{source.status}</p><small>Representante: {source.representative.name} en {placeName(source.representative.sectorId)}.</small>{source.uncontrolled.length>0&&<small>Falta controlar: {source.uncontrolled.map(placeName).join(' y ')}.</small>}{!source.activated&&<small>Con toda la localidad bajo control, entrá al sector y hablá con el representante de forma amable o directa.</small>}<small>El acuerdo paga a medianoche mientras conserves el control de toda la localidad.</small>{definition.id!==source.sectorId&&<small>Este sector comparte el acuerdo de {source.name}; no genera otro cobro.</small>}</section>;
}

export function SectorIncomeTable({state,onSelect}:{state:any;onSelect:(id:string)=>void}){
 const sources=townIncomeSources(state);
 return <div className="atlas-table"><table><caption>Ingresos diarios actuales · pesos</caption><thead><tr><th>Localidad</th><th>Fuente y representante</th><th>Acuerdo diario</th><th>Aporte actual</th><th>Estado</th></tr></thead><tbody>{sources.map(source=><tr key={source.id}><td><button onClick={()=>onSelect(source.sectorId)}>{source.name}</button></td><td>{source.source}<small>{source.representative.name}</small></td><td>{source.base}</td><td>{source.daily}</td><td>{source.status}</td></tr>)}</tbody><tfoot><tr><th scope="row" colSpan={3}>Total actual</th><td>{incomeSummary(state).daily}</td><td>Cobro a medianoche</td></tr></tfoot></table><p>Controlá toda la localidad y hablá en persona con su representante de forma amable o directa. Cada acuerdo paga una sola vez por día, a medianoche. Las demás localidades no generan ingresos diarios.</p></div>;
}
