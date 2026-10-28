import { validateStartingTerritory as validateSchema } from '../campaign-format/campaign-location-schema.js';
export function validateStartingTerritory(value, headquarters, context = null) {
  return validateSchema(value, headquarters, { world: campaignWorld(context) });
}
import { headquartersFor, headquartersName } from './campaign-headquarters.js';
import { campaignSectors, campaignWorld } from './campaign-definition.js';

export const defaultStartingTerritory = (headquarters, context = null) => {
  headquarters ??= campaignWorld(context).defaultHeadquarters;
  return Object.fromEntries(
    campaignSectors(context).map((s) => [
      s.id,
      {
        owner: s.id === headquarters ? 'patriot' : 'royalist',
        loyalty: s.id === headquarters ? 65 : 25,
      },
    ]),
  );
};
export const startingTerritoryFor = (state) =>
  state?.contentCampaign?.package.startingTerritory ??
  defaultStartingTerritory(headquartersFor(state), state);

export function startingTerritoryDescription(state) {
  const territory = startingTerritoryFor(state),
    names = campaignSectors(state)
      .filter((s) => territory[s.id].owner === 'patriot')
      .map((s) => s.name);
  return names.length === 1
    ? `Empezás con ${headquartersName(state)} como único sector controlado.`
    : `Control inicial: ${names.join('; ')}.`;
}
export function applyStartingTerritory(state) {
  const territory = startingTerritoryFor(state),
    headquarters = headquartersFor(state);
  state.location = headquarters;
  state.squads[0].location = headquarters;
  for (const sector of campaignSectors(state))
    Object.assign(state.sectors[sector.id], territory[sector.id]);
  // No capture, quest, force issue or reward occurs when composing a new campaign.
  const defaultHeadquarters = campaignWorld(state).defaultHeadquarters;
  if (
    !state.contentCampaign?.package.campaignOrigin &&
    (headquarters !== defaultHeadquarters ||
      campaignSectors(state).some(
        (s) => s.id !== defaultHeadquarters && territory[s.id].owner === 'patriot',
      ))
  )
    state.log[0].text = `${headquartersName(state)}. ${startingTerritoryDescription(state)} Contratá combatientes, creá tu personaje o combiná ambas opciones para partir.`;
}
