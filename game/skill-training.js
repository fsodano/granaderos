// Runtime practice never changes authored historical profiles.
export const TRAINING_LABELS=Object.freeze({maxHp:'Salud',strength:'Fuerza',dexterity:'Destreza',agility:'Agilidad',leadership:'Liderazgo',marksmanship:'Puntería',medical:'Medicina',mechanical:'Mecánica',explosives:'Pólvora y artillería',stealth:'Sigilo',ridingSkill:'Equitación'});
export const TRAINABLE_SKILLS=Object.freeze(Object.keys(TRAINING_LABELS));
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
 if(!TRAINABLE_SKILLS.includes(skill)||!Number.isSafeInteger(amount)||amount<0)throw Error('La práctica solicitada es inválida.');
 const value=unit[skill]??0,earned=unit.trainedStats?.[skill]??0;
 // Zero aptitude remains zero. Invalid or completed work must not create even
 // an empty practice record, and a dead actor cannot gain health or abilities.
 if(unit.side!=='player'||unit.hp===0||amount===0||value<=0||value>=100||earned>=10)return 0;
 const points=(unit.skillPractice?.[skill]??0)+amount;
 if(!Number.isSafeInteger(points))throw Error('La práctica solicitada es inválida.');
 const gain=Math.min(Math.floor(points/PRACTICE_THRESHOLD),10-earned,Math.ceil(100-value));
 unit.skillPractice??={};unit.trainedStats??={};
 unit.skillPractice[skill]=points%PRACTICE_THRESHOLD;
 if(gain){
  unit.trainedStats[skill]=earned+gain;unit[skill]=Math.min(100,value+gain);
  // A larger health attribute preserves the existing wound deficit. It does
  // not remove bleeding or bandages and cannot revive a dead soldier.
  if(skill==='maxHp'&&unit.hp>0)unit.hp=Math.min(unit.maxHp,unit.hp+unit.maxHp-value);
 }
 return gain;
}

export function trainingProgress(unit){return TRAINABLE_SKILLS.map(skill=>({skill,value:unit[skill]??0,earned:unit.trainedStats?.[skill]??0,practice:unit.skillPractice?.[skill]??0,threshold:PRACTICE_THRESHOLD,zero:(unit[skill]??0)<=0,capped:(unit.trainedStats?.[skill]??0)>=10||(unit[skill]??0)>=100}));}
