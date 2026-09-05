// Training cohorts reserve existing soldiers on promotion; no rank multiplication.
export const MILITIA_NAMES=['Cívicos','Montoneras','Granaderos y línea'];
export const MILITIA_COHORT=3;
export const MILITIA_LIMIT=60;
export function militiaCourse(trainer,rank){
 const specialist=[11,57].includes(Number(trainer.id))||(trainer.traits??[]).some(t=>['line_marksman','guerrilla_tactician'].includes(t));
 const leadership=Math.max(0,Math.min(100,trainer.leadership||0));
 return {hours:Math.ceil((48+rank*24)*(1-leadership*.005)*(specialist?.75:1)),specialist,cost:{treasury:60*(rank+1),muskets:rank===1?0:5,horses:rank===1?3:0},count:MILITIA_COHORT};
}
export function militiaAssignment(state,id){return(state.militiaTraining??[]).find(t=>t.trainerId===id)??null;}
