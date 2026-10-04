// A successful local care stroke can steady an explicitly authored caregiver.
// This is shock relief, not extra treatment work or a saved reward receipt.
export const CARE_COMPOSURE_RELIEF=2;
export function careComposureRelief(doctor,patient,treatment,{targetKind='unit',observed=false}={}){
 if(!Array.isArray(doctor?.abilities)||!doctor.abilities.includes('care_composure')||!observed||!patient||!(patient.hp>0)||
    !['unit','npc'].includes(targetKind)||targetKind==='unit'&&(String(doctor.id)===String(patient.id)||doctor.side!==patient.side)||
    !treatment?.valid||!(treatment.dressingsUsed>0)||
    !Number.isFinite(doctor.shock)||doctor.shock<=0||doctor.shock>20)return 0;
 const effective=treatment.hpAfter>patient.hp||treatment.bleedingAfter<(patient.bleeding??0)||
  treatment.bandagedAfter>(patient.bandaged??0);
 return effective?Math.min(CARE_COMPOSURE_RELIEF,doctor.shock):0;
}
