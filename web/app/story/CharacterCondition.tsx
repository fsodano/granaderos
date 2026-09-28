import {startingCharacterCondition} from '../../../game/character-condition.js';

export default function CharacterCondition({character,onChange}:{character:any,onChange:(patch:any)=>void}){
  const condition=startingCharacterCondition(character);
  const fields=[['hp','Salud inicial',1,character.attributes.maxHp],['energy','Energía inicial',0,100],['fatigue','Fatiga inicial',0,100],['bleeding','Sangrado inicial',0,10],['bandaged','Heridas vendadas iniciales',0,Math.max(0,character.attributes.maxHp-condition.hp)]] as const;
  return <fieldset aria-label="Estado inicial">
    <legend>Estado inicial</legend>
    <p>Se asigna una sola vez al crear la campaña. El atributo Salud define el máximo. Cargar la partida o volver a contratar conserva el estado alcanzado.</p>
    <div className="fields">{fields.map(([key,label,min,max])=><label key={key}>{label}
      <input type="number" min={min} max={max} step={1} value={condition[key]} onChange={e=>onChange({startingCondition:{...condition,[key]:e.target.valueAsNumber}})}/>
    </label>)}</div>
    <button disabled={character.startingCondition===undefined} onClick={()=>onChange({startingCondition:undefined})}>Restablecer estado sano</button>
    <small>Un habitante con menos de 15 de salud o sin energía no puede conversar. Las vendas estabilizan las heridas; la recuperación completa necesita atención o descanso. El sangrado avanza mientras el sector está abierto. Los candidatos del boletín siguen fuera del mapa hasta su llegada.</small>
    {condition.energy===0&&<p>Para un habitante que deba conversar, usá energía mayor que 0.</p>}
  </fieldset>;
}
