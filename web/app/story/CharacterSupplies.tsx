import {CHARACTER_SUPPLY_LIMIT,CHARACTER_SUPPLY_LABELS,startingCharacterSupplies} from '../../../game/character-supplies.js';

export default function CharacterSupplies({character,onChange}:{character:any,onChange:(patch:any)=>void}){
  const supplies=startingCharacterSupplies(character);
  return <fieldset aria-label="Suministros iniciales">
    <legend>Suministros iniciales</legend>
    <p>Se asignan una sola vez por campaña. Los habitantes las llevan al aparecer y conservan lo que queda al incorporarse. Renovar o volver a contratar no repone lo consumido ni lo recogido por otra persona.</p>
    <div className="fields">{Object.entries(CHARACTER_SUPPLY_LABELS).map(([key,label])=><label key={key}>{label}
      <input type="number" min={0} max={CHARACTER_SUPPLY_LIMIT} step={1} value={supplies[key]} onChange={e=>onChange({startingSupplies:{...supplies,[key]:e.target.valueAsNumber}})}/>
    </label>)}</div>
    <button disabled={character.startingSupplies===undefined} onClick={()=>onChange({startingSupplies:undefined})}>Restablecer suministros originales</button>
    <small>La munición inicial se configura en Reglas. El taller mantiene sus cantidades y precios de reposición.</small>
  </fieldset>;
}
