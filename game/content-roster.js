// First campaign adapter: stable authored IDs map to existing historical slots.
// Roles, abilities and recruitment gates stay attached to those slots for now.
export function authoredOperative(state, operative) {
  const definition = state.contentCampaign?.package.characters.find(
    (c) => c.id === `person-${operative.id}`,
  );
  if (!definition) return operative;
  return {
    ...operative,
    ...definition.attributes,
    hp: definition.attributes.maxHp,
    name: definition.name,
    nickname: definition.nickname,
    role: definition.role,
    biography: definition.biography,
    monthlyPay: definition.monthlyPay,
    weeklyPay: Math.ceil((definition.monthlyPay * 7) / 30),
    portraitId: definition.portrait,
    portrait: definition.portrait,
    contentId: definition.id,
  };
}
