'use client';
export default function DialogueEffects({effects=[],onChange}:{effects?:any[];onChange:(effects:any[])=>void}){
 const effect=effects[0];
 return <fieldset aria-label="Pago o recompensa"><legend>Pago o recompensa</legend>
  <label><input type="checkbox" checked={Boolean(effect)} onChange={e=>onChange(e.target.checked?[{type:'treasury',operation:'receive',amount:100}]:[])}/>Cambiar los pesos al elegir esta opción</label>
  {effect&&<>
   <label>Operación de pesos<select value={effect.operation} onChange={e=>onChange([{...effect,operation:e.target.value}])}><option value="receive">El jugador recibe</option><option value="pay">El jugador paga</option></select></label>
   <label>Importe en pesos<input type="number" min={1} max={1000000} value={effect.amount} onChange={e=>onChange([{...effect,amount:e.target.valueAsNumber}])}/></label>
   <p>Se aplica una sola vez por personaje y opción. Volver a elegirla no repite la operación. Si el jugador no tiene pesos suficientes, no puede elegirla.</p>
  </>}
 </fieldset>;
}
