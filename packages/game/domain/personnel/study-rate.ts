// The guide describes progress that slows as a skill improves and speeds up
// with a better teacher. Credit stays an integer so save and reload agree.

// A combatant's ratings live beside their wisdom on one flat record. The domain
// reads only those two fields, so it declares no dependency on the save format.
export type StudyLearner = Readonly<{
  wisdom?: number;
  [rating: string]: number | undefined;
}>;

// An instructor carries the same ratings and may also list traits.
export type StudyInstructor = Readonly<{
  traits?: readonly string[];
  [ratingOrTrait: string]: number | readonly string[] | undefined;
}>;

export const StudyRateRules = Object.freeze({
  CreditPerPracticeHour: 40000,
  MinimumCredit: 1,
  NeutralWisdom: 50,
  WisdomWeight: 0.6,
  WisdomDivisor: 125,
  TeachingTrait: 'teacher',
  TeachingTraitBonus: 0.5,
  TeachingSkillIgnoredThrough: 60,
  BasicTeachingMultiplier: 1.5,
  SkilledTeachingMultiplier: 2,
  TeachingStepSkillGap: 10,
  MaximumTeachingSkillBonus: 3,
});

// Hours of practice owed for one credit at the learner's current skill. The
// final band continues above its last threshold.
const PracticeHours = Object.freeze([
  Object.freeze({ throughSkill: 45, hours: 24 }),
  Object.freeze({ throughSkill: 60, hours: 48 }),
  Object.freeze({ throughSkill: 75, hours: 240 }),
]);
const SlowestPracticeHours = 360;

function practiceHours(skillValue: number): number {
  return (
    PracticeHours.find((band) => skillValue <= band.throughSkill)?.hours ?? SlowestPracticeHours
  );
}

function instructorSkill(instructor: StudyInstructor, skill: string): number {
  const value = instructor[skill];
  return typeof value === 'number' ? value : 0;
}

function teachingMultiplier(
  learnerSkill: number,
  skill: string,
  instructor: StudyInstructor | null,
): number {
  if (instructor === null) {
    return 1;
  }
  const teaching =
    learnerSkill <= StudyRateRules.TeachingSkillIgnoredThrough
      ? StudyRateRules.BasicTeachingMultiplier
      : StudyRateRules.SkilledTeachingMultiplier +
        Math.min(
          StudyRateRules.MaximumTeachingSkillBonus,
          Math.max(
            0,
            (instructorSkill(instructor, skill) - learnerSkill) /
              StudyRateRules.TeachingStepSkillGap,
          ),
        );
  const traitBonus = instructor.traits?.includes(StudyRateRules.TeachingTrait)
    ? StudyRateRules.TeachingTraitBonus
    : 0;
  return teaching + traitBonus;
}

export function studyRate(
  learner: StudyLearner,
  skill: string,
  instructor: StudyInstructor | null = null,
): number {
  const skillValue = learner[skill] ?? 0;
  const wisdom =
    StudyRateRules.WisdomWeight +
    (learner.wisdom ?? StudyRateRules.NeutralWisdom) / StudyRateRules.WisdomDivisor;
  const credit =
    (StudyRateRules.CreditPerPracticeHour / practiceHours(skillValue)) *
    wisdom *
    teachingMultiplier(skillValue, skill, instructor);
  return Math.max(StudyRateRules.MinimumCredit, Math.round(credit));
}
