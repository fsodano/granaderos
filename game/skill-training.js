// Runtime practice never changes authored historical profiles.
export const TRAINABLE_SKILLS=['agility','stealth','marksmanship','medical','mechanical','ridingSkill'];
export const PRACTICE_THRESHOLD=40;
export function validateTraining(record){
 for(const field of ['skillPractice','trainedStats']){
  const values=record[field];if(values===undefined)continue;
  if(!values||typeof values!=='object'||Array.isArray(values))throw Error('El registro de práctica es inválido.');
  for(const [skill,value] of Object.entries(values))if(!TRAINABLE_SKILLS.includes(skill)||!Number.isInteger(value)||value<0||value>(field==='skillPractice'?39:10))throw Error('El registro de práctica es inválido.');
 }
 for(const field of ['practiceTiles','ridingPracticeTiles'])if(record[field]!==undefined&&(!Array.isArray(record[field])||record[field].length>10000||!record[field].every(v=>typeof v==='string'&&/^\d+,\d+$/.test(v))))throw Error('El registro de desplazamiento es inválido.');
 if(record.practiceTiles!==undefined&&(!Array.isArray(record.practiceTiles)||record.practiceTiles.length>10000||!record.practiceTiles.every(v=>typeof v==='string'&&/^\d+,\d+$/.test(v))))throw Error('El registro de desplazamiento es inválido.');
 return record;
}
export function practice(unit,skill,amount=1){
 if(unit.side!=='player')return;
 unit.skillPractice??={};unit.trainedStats??={};
 if((unit.trainedStats[skill]||0)>=10||(unit[skill]??0)>=100)return;
 const points=(unit.skillPractice[skill]||0)+amount;
 unit.skillPractice[skill]=points%PRACTICE_THRESHOLD;
 if(points>=PRACTICE_THRESHOLD){unit.trainedStats[skill]=(unit.trainedStats[skill]||0)+1;unit[skill]=Math.min(100,(unit[skill]??0)+1);}
}

export function trainingProgress(unit){return TRAINABLE_SKILLS.map(skill=>({skill,value:unit[skill]??0,earned:unit.trainedStats?.[skill]??0,practice:unit.skillPractice?.[skill]??0,threshold:PRACTICE_THRESHOLD,capped:(unit.trainedStats?.[skill]??0)>=10||(unit[skill]??0)>=100}));}
