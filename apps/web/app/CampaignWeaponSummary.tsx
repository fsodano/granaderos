import type { CampaignOperativeState } from '../../../packages/game/public/campaign-types.ts';
import type { CampaignOperative } from '../../../packages/game/public/campaign-types.ts';
import { weaponSpecification } from '../../../packages/game/weapon-definition.ts';
import { sitePath } from '../lib/site-path.js';

export default function CampaignWeaponSummary({
  operative,
  record,
  showArt = false,
  showCondition = false,
}: {
  operative: CampaignOperative;
  record: CampaignOperativeState;
  showArt?: boolean;
  showCondition?: boolean;
}) {
  if (record?.weaponDropped) {
    return (
      <>
        <strong>Arma abandonada</strong>
        <br />
        Sin arma principal.
      </>
    );
  }
  const weapon = weaponSpecification(operative);
  if (!weapon) {
    return <>Sin arma principal.</>;
  }
  return (
    <>
      {showArt && <img src={sitePath(weapon.art)} alt={weapon.name} />}
      <span>
        {weapon.name}
        {showCondition ? ` · Condición ${record?.condition ?? 100}%` : ''}
      </span>
      {record?.jammed && (
        <>
          <br />
          <strong>Fallo de chispa. No puede disparar.</strong>
        </>
      )}
    </>
  );
}
