import {studyForecast} from '../../game/study-training.js';
import {TRAINING_LABELS} from '../../game/skill-training.js';
export default function StudyForecast({record,op,skill,instructor}:{record:any;op:any;skill:string;instructor?:any}){
 const solo=studyForecast(record,op,skill),paired=instructor?studyForecast(record,op,skill,instructor):null;if(!solo)return null;
 return <p className="care-condition" aria-label={`Previsión de estudio de ${op.nickname}`}>
  <strong>{(TRAINING_LABELS as Record<string,string>)[skill]} · {solo.value}</strong><br/>
  {solo.ineligible?'Sin aptitud para mejorar: esta habilidad necesita un valor de al menos 35.':solo.capped?'Límite de práctica alcanzado.':<>
   Estimación de mejora: {solo.hoursToNext} h de práctica individual.{paired&&<> Con {instructor.nickname}: {paired.hoursToNext} h.</>}<br/>
   {solo.earned}/10 mejoras por práctica · quedan {solo.remainingGains}. Las horas cuentan solo mientras trabaja; las pausas y el descanso alargan el plazo.
  </>}
 </p>;
}
