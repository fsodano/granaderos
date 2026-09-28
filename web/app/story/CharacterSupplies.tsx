import {CHARACTER_SUPPLY_LIMIT,startingCharacterSupplies} from '../../../game/character-supplies.js';

const labels={priming:'Cargas de cebo',flints:'Pedernales',rations:'Raciones',torches:'Antorchas',medkits:'Vendas',boleadoras:'Boleadoras'};
export default function CharacterSupplies({character,onChange}:{character:any,onChange:(patch:any)=>void}){
  const supplies=startingCharacterSupplies(character);
  return <fieldset aria-label="Suministros iniciales">
    <legend>Suministros iniciales</legend>
    <p>Cantidades que tendrá al incorporarse. Se asignan una sola vez por campaña. Renovar o volver a contratar no repone lo consumido.</p>
    <div className="fields">{Object.entries(labels).map(([key,label])=><label key={key}>{label}
      <input type="number" min={0} max={CHARACTER_SUPPLY_LIMIT} step={1} value={supplies[key]} onChange={e=>onChange({startingSupplies:{...supplies,[key]:e.target.valueAsNumber}})}/>
    </label>)}</div>
    <button disabled={character.startingSupplies===undefined} onClick={()=>onChange({startingSupplies:undefined})}>Restablecer suministros originales</button>
    <small>La munición inicial se configura en Reglas. El taller mantiene sus cantidades y precios de reposición.</small>
  </fieldset>;
}
