import {characterForOperative} from './content-character-ids.js';
import {conductObserverDefinition} from './service-objections.js';

export const LOW_MORALE_REFUSAL='low_morale_refusal';
// Granaderos tuning. This is not JA2's per-profile renewal threshold.
export const LOW_MORALE_RENEWAL_THRESHOLD=30;

// Personal campaign morale is authoritative. Issued cohesion/companion support
// and temporary tactical morale must never replace this value in a quotation.
export function lowMoraleRenewalStatus(state,operative){
 const id=Number(operative?.id),record=state?.operativeState?.[id],definition=state&&operative&&characterForOperative(state,id);
 const eligible=Boolean(operative&&Array.isArray(definition?.abilities)&&definition.abilities.includes(LOW_MORALE_REFUSAL)&&
  conductObserverDefinition(definition)&&state?.recruited?.includes(id)&&
  state?.contracts?.[id]?.kind==='paid'&&record?.alive!==false);
 const morale=record?.morale??null,blocked=eligible&&Number.isFinite(morale)&&morale<LOW_MORALE_RENEWAL_THRESHOLD;
 const reason=blocked?`${operative.name} no renueva con moral personal menor que ${LOW_MORALE_RENEWAL_THRESHOLD}. Recuperar esa moral a ${LOW_MORALE_RENEWAL_THRESHOLD} o más elimina este rechazo. Conserva todo el plazo pagado.`:null;
 return {eligible,blocked,morale,threshold:LOW_MORALE_RENEWAL_THRESHOLD,reason};
}
export const lowMoraleRenewalReason=(state,operative)=>lowMoraleRenewalStatus(state,operative).reason;
