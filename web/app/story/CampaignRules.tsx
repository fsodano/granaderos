'use client';
import MilitiaRules from './MilitiaRules';
import ArtillerySupplyRules from './ArtillerySupplyRules';
import MilitiaPatrolRules from './MilitiaPatrolRules';
import CareRules from './CareRules';
import FoundryRules from './FoundryRules';
import CampaignRoles from './CampaignRoles';
import CampaignStory from './CampaignStory';
import StartingTerritory from './StartingTerritory';
import ImportRules from './ImportRules';
import {DEFAULT_CAMPAIGN_RULES,DEFAULT_CARTRIDGE_PRICE} from '../../../game/campaign-rules.js';
const fields=[
 ['startingTreasury','Fondos iniciales (pesos)'],
 ['deploymentCartridges','Cartuchos por combatiente de la escuadra'],
 ['enemyCartridges','Cartuchos por enemigo nuevo'],
 ['militiaCartridges','Cartuchos por miliciano nuevo'],
] as const;
export default function CampaignRules({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const rules=draft.rules??DEFAULT_CAMPAIGN_RULES,price=rules.cartridgePrice===undefined?DEFAULT_CARTRIDGE_PRICE:rules.cartridgePrice;
 return <><section aria-label="Reglas de campaña">
  <h2>Fondos y abastecimiento</h2>
  <p>Los fondos se entregan una vez, al iniciar la campaña. Cambiar el borrador no modifica una partida en curso.</p>
  <div className="fields">{fields.map(([key,label])=><label key={key}>{label}<input type="number" min={0} max={key==='startingTreasury'?1000000:100} step={1} value={Number.isFinite(rules[key])?rules[key]:''} onChange={e=>onChange({...draft,rules:{...rules,[key]:e.target.valueAsNumber}})}/></label>)}</div>
  <label>Precio del cartucho (pesos)<input type="number" min={0} max={1000000} step={1} value={Number.isFinite(price)?price:''} onChange={e=>onChange({...draft,rules:{...rules,cartridgePrice:e.target.valueAsNumber}})}/></label>
  <p>La escuadra compra esta cantidad por arma de fuego al entrar o atacar un sector, al precio configurado. Al salir se devuelve el valor de los cartuchos restantes. La carga inicial nunca supera la capacidad del arma; el resto queda en reserva.</p>
  <p>Las tropas ya presentes conservan su munición. Un arma principal blanca no recibe cartuchos. Cero deja el arma descargada y sin reserva. Estas cantidades no cambian las provisiones de los aliados temporales de las misiones.</p>
  <button onClick={()=>onChange({...draft,rules:{...DEFAULT_CAMPAIGN_RULES}})}>Restaurar fondos y cartuchos originales</button>
 </section><ArtillerySupplyRules draft={draft} onChange={onChange}/><MilitiaRules draft={draft} onChange={onChange}/><MilitiaPatrolRules draft={draft} onChange={onChange}/><CareRules draft={draft} onChange={onChange}/><CampaignStory draft={draft} onChange={onChange}/><CampaignRoles draft={draft} onChange={onChange}/><FoundryRules draft={draft} onChange={onChange}/><StartingTerritory draft={draft} onChange={onChange}/><ImportRules draft={draft} onChange={onChange}/></>;
}
