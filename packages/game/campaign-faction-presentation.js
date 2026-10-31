import { campaignFactions } from './campaign-definition.js';

/** Display names for the stable engine ownership keys. @param {*} context */
export function campaignFactionName(context, owner) {
  const ids =
    owner === 'royalist'
      ? ['royalist', 'royalists']
      : owner === 'patriot'
        ? ['patriot', 'directory']
        : [owner];
  return (
    campaignFactions(context).find((faction) => ids.includes(faction.id))?.name ??
    (owner === 'patriot' ? 'Tus fuerzas' : 'Enemigo')
  );
}
