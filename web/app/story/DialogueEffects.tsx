'use client';
export default function DialogueEffects({effects=[],quests,onChange}:{effects?:any[];quests:any[];onChange:(effects:any[])=>void}){
 const effect=effects.find(e=>e.type==='treasury'),quest=effects.find(e=>e.type==='quest');
 const change=(type:string,value:any)=>onChange([...effects.filter(e=>e.type!==type),...(value?[value]:[])]);
 return <><fieldset aria-label="Pago o recompensa"><legend>Pago o recompensa</legend>
  <label><input type="checkbox" checked={Boolean(effect)} onChange={e=>change('treasury',e.target.checked?{type:'treasury',operation:'receive',amount:100}:null)}/>Cambiar los pesos al elegir esta opción</label>
  {effect&&<>
   <label>Operación de pesos<select value={effect.operation} onChange={e=>change('treasury',{...effect,operation:e.target.value})}><option value="receive">El jugador recibe</option><option value="pay">El jugador paga</option></select></label>
   <label>Importe en pesos<input type="number" min={1} max={1000000} value={effect.amount} onChange={e=>change('treasury',{...effect,amount:e.target.valueAsNumber})}/></label>
   <p>Se aplica una sola vez por personaje y opción. Volver a elegirla no repite la operación. Si el jugador no tiene pesos suficientes, no puede elegirla.</p>
  </>}
 </fieldset><fieldset aria-label="Resultado del encargo"><legend>Resultado del encargo</legend>
  <label><input type="checkbox" disabled={!quests.length} checked={Boolean(quest)} onChange={e=>change('quest',e.target.checked?{type:'quest',quest:quests[0].id,status:'active'}:null)}/>Cambiar un encargo al elegir esta opción</label>
  {!quests.length&&<small>Creá primero un encargo en la sección Encargos.</small>}
  {quest&&<>
   <label>Encargo que cambia<select value={quest.quest} onChange={e=>change('quest',{...quest,quest:e.target.value})}>{quests.map(q=><option key={q.id} value={q.id}>{q.title}</option>)}</select></label>
   <label>Resultado del encargo<select value={quest.status} onChange={e=>change('quest',{...quest,status:e.target.value})}><option value="active">Iniciar</option><option value="completed">Completar</option><option value="failed">Fallar</option></select></label>
   <p>Iniciar requiere un encargo sin iniciar. Completar o fallar requiere que esté en curso. El cambio y el pago de esta opción se aplican juntos, una sola vez.</p>
  </>}
 </fieldset></>;
}
