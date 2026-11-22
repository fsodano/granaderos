import { TRAINABLE_SKILLS, MINIMUM_LEARNABLE_SKILL } from './skill-training.js';
import { studyRate } from './domain/personnel/study-rate.ts';

export { studyRate };

// Productive hours at the current rate, excluding sleep, interruptions and
// travel. Changing the selected skill cannot spend another skill's hour credit.
/**
 * @param {import('./public/campaign-types.ts').CampaignOperativeState} record
 * @param {import('./public/campaign-types.ts').CampaignOperative} op
 * @param {string} skill
 * @param {import('./public/campaign-types.ts').CampaignOperative|null} [instructor]
 * @returns {{skill:string,value:number,earned:number,remainingGains:number,zero:boolean,ineligible:boolean,capped:boolean,hoursToNext:number|null,rate:number}|null}
 */
export function studyForecast(record, op, skill, instructor = null) {
  if (!TRAINABLE_SKILLS.includes(skill)) {
    return null;
  }
  const value = op[skill] ?? 0,
    earned = record.trainedStats?.[skill] ?? 0,
    zero = value <= 0,
    ineligible = value < MINIMUM_LEARNABLE_SKILL;
  const remainingGains = Math.max(0, Math.min(10 - earned, Math.ceil(100 - value))),
    capped = remainingGains === 0;
  const rate = studyRate(op, skill, instructor),
    credit = record.trainingSkill === skill ? (record.trainingCredit ?? 0) : 0;
  const hoursToNext =
    ineligible || capped
      ? null
      : Math.max(
          1,
          Math.ceil(((40 - (record.skillPractice?.[skill] ?? 0)) * 1000 - credit) / rate),
        );
  return { skill, value, earned, remainingGains, zero, ineligible, capped, hoursToNext, rate };
}
