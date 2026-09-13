import {TRAINABLE_SKILLS} from './skill-training.js';

// The guide describes progressively slower practice at high skill and faster
// learning with a better teacher. Credit uses integers to survive save/reload.
export function studyRate(op,skill,instructor=null){
  const value=op[skill]??0;
  const hours=value<=45?24:value<=60?48:value<=75?240:360;
  const wisdom=.6+(op.wisdom??50)/125;
  const teaching=instructor?(value<=60?1.5:2+Math.min(3,Math.max(0,((instructor[skill]??0)-value)/10)))+(instructor.traits?.includes('teacher')?.5:0):1;
  return Math.max(1,Math.round(40000/hours*wisdom*teaching));
}
// Productive hours at the current rate, excluding sleep, interruptions and
// travel. Changing the selected skill cannot spend another skill's hour credit.
export function studyForecast(record,op,skill,instructor=null){
 if(!TRAINABLE_SKILLS.includes(skill))return null;
 const value=op[skill]??0,earned=record.trainedStats?.[skill]??0,zero=value<=0;
 const remainingGains=Math.max(0,Math.min(10-earned,Math.ceil(100-value))),capped=remainingGains===0;
 const rate=studyRate(op,skill,instructor),credit=record.trainingSkill===skill?(record.trainingCredit??0):0;
 const hoursToNext=zero||capped?null:Math.max(1,Math.ceil(((40-(record.skillPractice?.[skill]??0))*1000-credit)/rate));
 return {skill,value,earned,remainingGains,zero,capped,hoursToNext,rate};
}
