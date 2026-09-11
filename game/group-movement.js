import {actBattle,getReachable,teamCanSee} from './tactical.js';
import {movementStance} from './tactical-condition.js';

export const GROUP_FALLBACK_RADIUS=2;
const point=u=>({x:u.x,y:u.y});
const key=p=>`${p.x},${p.y}`;
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const safe=s=>s.status==='active'&&s.mode==='exploration'&&s.phase==='player'&&!s.interrupt&&!s.enemyTurn&&!s.reactionStack?.length;
const invalid=reason=>({ok:false,reason,request:null,members:[]});
function unableReason(u,movement){
 if(u.hp<=0)return 'El combatiente ha caído.';
 if(u.hp<15||u.unconscious)return 'El combatiente está inconsciente.';
 if(u.energy<=0)return 'El combatiente está agotado.';
 if(u.departure)return 'El combatiente ya salió del sector.';
 if(u.routed||u.surrendered)return 'El combatiente se ha retirado.';
 if(u.knockedDown)return 'Debe ponerse de pie antes de marchar.';
 if(u.entangled)return 'Debe liberarse de las boleadoras antes de marchar.';
 if(u.mounted&&['crouch','prone'].includes(movement))return 'Debe desmontar antes de agacharse.';
 return '';
}

function movementView(state,unit,movement){
 // Hostile positions that the squad cannot see do not influence formation
 // destinations or preview paths. The real reducer remains authoritative.
 const units=state.units.filter(u=>!u.departure&&(u.side==='player'||teamCanSee(state,'player',u)));
 const record=movement?{...unit,movementMode:movement,stance:movementStance(movement)}:unit;
 const bodies=units.filter(u=>!u.departure&&u.id!==unit.id&&(u.unconscious||u.hp<=0||u.routed)).map(u=>({id:`formation-body-${u.id}`,x:u.x,y:u.y}));
 return {...state,units:units.map(u=>u.id===unit.id?record:u),npcs:[...(state.npcs??[]),...bodies]};
}
function destinationFor(state,unit,desired,reserved,movement){
 const view=movementView(state,unit,movement),occupied=new Set(view.units.filter(u=>u.id!==unit.id).map(key));
 const center={x:Math.max(0,Math.min(state.width-1,desired.x)),y:Math.max(0,Math.min(state.height-1,desired.y))};
 const options=getReachable(view,String(unit.id)).filter(p=>distance(p,center)<=GROUP_FALLBACK_RADIUS&&!reserved.has(key(p))&&!occupied.has(key(p)));
 options.sort((a,b)=>distance(a,desired)-distance(b,desired)||a.cost-b.cost||a.y-b.y||a.x-b.x);
 return options[0]??null;
}

/** Pure preview. The anchor is first; the other members keep selection order.
 * Invalid input rejects the entire command. Unable members remain in the result
 * as skipped entries. A blocked formation slot searches within two map tiles.
 */
export function planGroupMove(state,request){
 if(!state||!Array.isArray(state.units)||!Array.isArray(state.tiles))return invalid('El estado táctico no es válido.');
 if(!safe(state))return invalid('El movimiento en grupo requiere exploración sin combate ni interrupciones.');
 if(!request||!Array.isArray(request.unitIds)||!request.unitIds.length||request.unitIds.length>200)return invalid('Seleccioná uno o más combatientes.');
 if(!request.unitIds.every(id=>(typeof id==='string'&&id.length>0&&id.length<=100)||(typeof id==='number'&&Number.isSafeInteger(id))))return invalid('La selección contiene un identificador inválido.');
 if(!((typeof request.anchorId==='string'&&request.anchorId.length>0&&request.anchorId.length<=100)||(typeof request.anchorId==='number'&&Number.isSafeInteger(request.anchorId))))return invalid('Elegí un combatiente de referencia válido.');
 const ids=request.unitIds.map(String),anchorId=String(request.anchorId),units=ids.map(id=>state.units.find(u=>String(u.id)===id));
 if(new Set(ids).size!==ids.length||units.some(u=>!u||u.side!=='player')||!ids.includes(anchorId))return invalid('La selección o el combatiente de referencia no es válido.');
 if(!Number.isInteger(request.x)||!Number.isInteger(request.y)||request.x<0||request.y<0||request.x>=state.width||request.y>=state.height||!state.tiles.some(t=>t.x===request.x&&t.y===request.y))return invalid('El destino está fuera del sector.');
 if(request.movement!==undefined&&!['walk','run','crouch','prone'].includes(request.movement))return invalid('La forma de desplazamiento no es válida.');
 if(request.movementIntent!==undefined&&request.movementIntent!=='forward')return invalid('Retroceder o avanzar de costado requiere una orden individual.');
 const anchor=units.find(u=>String(u.id)===anchorId),anchorReason=unableReason(anchor,request.movement);if(anchorReason)return invalid(`El combatiente de referencia no puede marchar. ${anchorReason}`);
 const normalized={unitIds:ids,anchorId,x:request.x,y:request.y,...(request.movement!==undefined?{movement:request.movement}:{})};
 const ordered=[anchor,...units.filter(u=>String(u.id)!==anchorId)],reserved=new Set(),members=[];
 for(const unit of ordered){
  const from=point(unit),desired={x:request.x+unit.x-anchor.x,y:request.y+unit.y-anchor.y},reason=unableReason(unit,request.movement);
  const base={unitId:String(unit.id),from,desired,destination:null,path:[],cost:0,status:'skipped',reason};
  if(reason){members.push(base);continue;}
  const selected=destinationFor(state,unit,desired,reserved,request.movement);
  if(!selected){members.push({...base,status:'blocked',reason:'No hay una casilla accesible cerca de su puesto en la formación.'});continue;}
  reserved.add(key(selected));members.push({...base,destination:point(selected),path:selected.path.map(point),cost:selected.cost,status:selected.path.length?'ready':'arrived',reason:distance(selected,desired)?'Puesto ajustado a una casilla accesible.':''});
 }
 return {ok:true,reason:'',request:normalized,members};
}

/** Members move sequentially through ordinary reducer orders. Elapsed time is
 * the sum of those legal orders; this does not simulate simultaneous movement.
 * Never accept a cached preview as authority: the executor plans again.
 */
export function executeGroupMove(state,request){
 const plan=planGroupMove(state,request);
 if(!plan.ok)return {state,plan,members:[],status:'invalid',reason:plan.reason,elapsedSeconds:0,actions:0,orders:[]};
 let next=state,stopped=false,contact=false,stopReason='';const members=[],orders=[];
 for(const entry of plan.members){
  const unit=next.units.find(u=>String(u.id)===entry.unitId),base={...entry,to:point(unit),moved:false,energyBefore:unit.energy,energyAfter:unit.energy,elapsedSeconds:0};
  if(stopped){members.push({...base,status:'stopped',reason:stopReason});continue;}
  const reason=unableReason(unit,plan.request.movement);if(reason){members.push({...base,status:'skipped',reason});continue;}
  // Earlier members may have changed access. Recheck only known occupancy and
  // preserve each other member's assigned destination.
  const reserved=new Set(plan.members.filter(m=>m.unitId!==entry.unitId&&m.destination).map(m=>key(m.destination)));
  const destination=destinationFor(next,unit,entry.desired,reserved,plan.request.movement);
  if(!destination){members.push({...base,status:'blocked',reason:'La ruta hacia su puesto está bloqueada.'});continue;}
  if(!destination.path.length){members.push({...base,destination:point(destination),status:'arrived'});continue;}
  const action={type:'move',unitId:entry.unitId,x:destination.x,y:destination.y,...(plan.request.movement!==undefined?{movement:plan.request.movement}:{})};
  const moved=actBattle(next,action);
  if(moved.lastError){members.push({...base,destination:point(destination),status:'blocked',reason:moved.lastError});continue;}
  const actual=moved.units.find(u=>String(u.id)===entry.unitId),arrived=actual.x===destination.x&&actual.y===destination.y,elapsedSeconds=(moved.elapsedSeconds??0)-(next.elapsedSeconds??0);
  next=moved;orders.push(action);stopped=!safe(next);contact=stopped&&(next.mode!=='exploration'||next.phase!=='player'||Boolean(next.interrupt||next.enemyTurn||next.reactionStack?.length));stopReason=contact?'Contacto enemigo: el movimiento del grupo se detuvo.':'La exploración terminó: el movimiento del grupo se detuvo.';
  members.push({...base,destination:point(destination),to:point(actual),moved:distance(base.from,actual)>0,energyAfter:actual.energy,elapsedSeconds,status:stopped?'stopped':arrived?'arrived':'partial',reason:stopped?stopReason:arrived?(distance(destination,entry.desired)?'Puesto ajustado a una casilla accesible.':''):unableReason(actual,plan.request.movement)||'El combatiente no pudo completar la ruta.'});
 }
 const status=contact?'contact':members.every(m=>m.status==='arrived')?'completed':'partial';
 return {state:next,plan,members,status,reason:stopped?stopReason:status==='partial'?'Parte del grupo no pudo alcanzar su puesto.':'',elapsedSeconds:(next.elapsedSeconds??0)-(state.elapsedSeconds??0),actions:orders.length,orders};
}
