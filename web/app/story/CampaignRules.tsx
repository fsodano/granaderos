'use client';
import ContractRules from './ContractRules';
import MilitiaRules from './MilitiaRules';
import ArtilleryTransportRules from './ArtilleryTransportRules';
import MilitiaPatrolRules from './MilitiaPatrolRules';
import CareRules from './CareRules';
import FoundryRules from './FoundryRules';
import CampaignRoles from './CampaignRoles';
import CampaignStory from './CampaignStory';
import StartingTerritory from './StartingTerritory';
import {DEFAULT_CAMPAIGN_RULES} from '../../../game/campaign-rules.js';
const fields=[
 ['startingTreasury','Fondos iniciales (pesos)'],
 ['deploymentCartridges','Cartuchos iniciales por combatiente'],
 ['enemyCartridges','Cartuchos por enemigo nuevo'],
 ['militiaCartridges','Cartuchos por miliciano nuevo'],
] as const;
export default function CampaignRules({draft,onChange}:{draft:any;onChange:(value:any)=>void}){
 const rules=draft.rules??DEFAULT_CAMPAIGN_RULES;
 return <><section aria-label="Reglas de campaña">
  <h2>Fondos y munición inicial</h2>
  <p>Los fondos se entregan una vez, al iniciar la campaña. Cambiar el borrador no modifica una partida en curso.</p>
  <div className="fields">{fields.map(([key,label])=><label key={key}>{label}<input type="number" min={0} max={key==='startingTreasury'?1000000:100} step={1} value={Number.isFinite(rules[key])?rules[key]:''} onChange={e=>onChange({...draft,rules:{...rules,[key]:e.target.valueAsNumber}})}/></label>)}</div>
  <p>Quien recibe equipo inicial obtiene estos cartuchos compatibles con su arma de fuego al incorporarse por primera vez, dentro del espacio disponible. La entrega se hace una sola vez. Entrar a un sector, renovar o volver a contratar no repone cartuchos. Quien llega con equipo propio conserva sus provisiones.</p>
  <p>Las cargas y los cartuchos restantes conservan su dueño entre sectores. Un arma blanca no recibe cartuchos. Cero desactiva la entrega inicial. Los enemigos y milicianos reciben su cantidad al aparecer por primera vez. Estas cantidades no cambian las provisiones de los aliados temporales de las misiones.</p>
  <p>El equipo es limitado: recogé objetos, compartí lo que llevás y conservá tus provisiones. No hay compras ni reposición automática.</p>
  <button onClick={()=>onChange({...draft,rules:{...rules,...DEFAULT_CAMPAIGN_RULES}})}>Restaurar fondos y cartuchos originales</button>
 </section><ContractRules draft={draft} onChange={onChange}/><ArtilleryTransportRules draft={draft} onChange={onChange}/><MilitiaRules draft={draft} onChange={onChange}/><MilitiaPatrolRules draft={draft} onChange={onChange}/><CareRules draft={draft} onChange={onChange}/><CampaignStory draft={draft} onChange={onChange}/><CampaignRoles draft={draft} onChange={onChange}/><FoundryRules draft={draft} onChange={onChange}/><StartingTerritory draft={draft} onChange={onChange}/></>;
}
