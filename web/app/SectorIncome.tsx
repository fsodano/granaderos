import './sector-income.css';
import {CAMPAIGN_SECTORS,isSupplied} from '../../game/campaign.js';
import {MAP_PLACES} from '../../game/strategic-map.js';
import {sectorIncomeDetails,totalSectorIncome} from '../../game/sector-income.js';

export default function SectorIncome({state,definition}:{state:any;definition:any}){
 const income=sectorIncomeDetails(state,definition,isSupplied);
 return <section className="sector-income" aria-label="Ingresos del sector"><h3>Aporte diario</h3><p><strong>{income.daily} pesos</strong> · base {income.base}</p><p>Lealtad local: {income.loyalty}%</p>{income.limits.filter((limit:string)=>!limit.startsWith('Lealtad')).map((limit:string)=><small key={limit}>{limit}</small>)}<small>Más lealtad aumenta el aporte. Se cobra a medianoche según las condiciones del sector en ese momento.</small></section>;
}

export function SectorIncomeTable({state,onSelect}:{state:any;onSelect:(id:string)=>void}){
 return <div className="atlas-table"><table><caption>Ingresos diarios actuales · pesos</caption><thead><tr><th>Localidad</th><th>Base</th><th>Lealtad local</th><th>Aporte</th><th>Reducciones</th></tr></thead><tbody>{CAMPAIGN_SECTORS.map(definition=>{const income=sectorIncomeDetails(state,definition,isSupplied);return <tr key={definition.id}><td><button onClick={()=>onSelect(definition.id)}>{MAP_PLACES[definition.id as keyof typeof MAP_PLACES].label}</button></td><td>{income.base}</td><td>{income.loyalty}%</td><td>{income.daily}</td><td>{income.limits.join(' · ')||'Sin reducciones'}</td></tr>;})}</tbody><tfoot><tr><th scope="row" colSpan={3}>Total actual</th><td>{totalSectorIncome(state,isSupplied)}</td><td>Antes de gastos</td></tr></tfoot></table><p>La lealtad local determina qué parte de la base se aporta. Daños, bloqueo y falta de abastecimiento reducen ese resultado de forma acumulada. El cobro se calcula a medianoche; puede cambiar antes de esa hora.</p></div>;
}
