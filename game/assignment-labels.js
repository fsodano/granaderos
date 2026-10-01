// Data-only labels shared by care, work and assignment notices. Keep this
// module independent of campaign and battle validation.
export const CARE_ASSIGNMENTS={active:'En servicio',doctor:'Médico',militia_doctor:'Médico de milicias',patient:'Paciente',rest:'Descanso'};
export const WORK_ASSIGNMENTS={practice:'Práctica individual',instructor:'Instructor',student:'Alumno',repair:'Reparación'};
export const ALL_ASSIGNMENTS={...CARE_ASSIGNMENTS,...WORK_ASSIGNMENTS};
