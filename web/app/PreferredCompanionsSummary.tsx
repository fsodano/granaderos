import {preferredCompanions,PREFERRED_COMPANION_MORALE} from '../../game/service-relationships.js';
import {COMPANION_GRIEF_MORALE} from '../../game/companion-grief.js';

export const PREFERRED_COMPANION_EXPLANATION=`Al iniciar un despliegue con uno de estos compañeros en condiciones de combatir, recibe hasta +${PREFERRED_COMPANION_MORALE} de moral. El apoyo total con compañerismo no supera +5. No cambia la paga ni el contrato. Si ve morir a un compañero preferido que participa en el despliegue, pierde hasta ${COMPANION_GRIEF_MORALE} puntos de moral adicionales.`;
type CompanionPreference={character:string;reason:string;companionId:number|undefined;companionName:string};

export default function PreferredCompanionsSummary({state,operative,details=false}:{state?:any;operative:any;details?:boolean}){
 const preferences:CompanionPreference[]=preferredCompanions(state,operative);
 if(!preferences.length)return null;
 const issued=state?.pendingBattle?.squad?.find((u:any)=>Number(u.id)===Number(operative.id));
 const source=issued&&preferences.find(preference=>preference.companionId===issued.companionId);
 return <div className="companion-preferences" aria-label={`Compañeros preferidos de ${operative.name}`}>
  {details?<><h3>Compañeros preferidos</h3><ul>{preferences.map(preference=><li key={preference.character}>{preference.companionName}: {preference.reason}</li>)}</ul></>:<p><strong>Compañeros preferidos:</strong> {preferences.map(preference=>preference.companionName).join(', ')}.</p>}
  <small>{PREFERRED_COMPANION_EXPLANATION}</small>
  {source&&issued.companionBonus>0&&<p>Apoyo de {source.companionName} al inicio del despliegue: +{issued.companionBonus} de moral.</p>}
 </div>;
}
