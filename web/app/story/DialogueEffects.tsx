'use client';
import {isWorldCharacter} from '../../../game/content-character-ids.js';
export default function DialogueEffects({effects=[],quests,characters,ownerId,onChange}:{effects?:any[];quests:any[];characters:any[];ownerId:string;onChange:(effects:any[])=>void}){
 const residents=characters.filter(isWorldCharacter),others=residents.filter(c=>c.id!==ownerId),movement=effects.find(e=>e.type==='movement'),candidates=movement?.destination==='routine'?residents:others;
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
 </fieldset><fieldset aria-label="Movimiento en el sector"><legend>Movimiento en el sector</legend>
  <label><input type="checkbox" disabled={!residents.length} checked={Boolean(movement)} onChange={e=>change('movement',e.target.checked?{type:'movement',character:others[0]?.id??ownerId,destination:others.length?'speaker':'routine'}:null)}/>Dar una orden de movimiento al elegir esta opción</label>
  {movement&&<><label>Orden del personaje<select value={movement.destination} onChange={e=>change('movement',{...movement,destination:e.target.value,character:e.target.value==='speaker'&&movement.character===ownerId?others[0].id:movement.character})}><option value="speaker" disabled={!others.length}>Venir a este lugar</option><option value="routine">Retomar su rutina</option></select></label><label>{movement.destination==='routine'?'Personaje que retoma su rutina':'Personaje que viene'}<select value={movement.character} onChange={e=>change('movement',{...movement,character:e.target.value})}>{candidates.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><p>{movement.destination==='routine'?'Debe estar consciente en el sector y tener un encuentro pendiente. La orden libera su destino y puede continuar con su rutina cuando esté a salvo.':'Debe estar consciente en el mismo sector y tener un camino libre. Camina hasta una casilla junto al interlocutor y espera allí. El peligro interrumpe la marcha.'} La orden se aplica una sola vez. Otro diálogo puede darle un nuevo destino.</p></>}
 </fieldset></>;
}
