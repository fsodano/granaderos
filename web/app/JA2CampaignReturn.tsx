'use client';
import {campaignReturnModel} from '../../game/ja2-hud.js';

type Props = {battle: any; peacefulVisit?: boolean; busy: boolean; onFinish: () => void};

export default function JA2CampaignReturn({battle, peacefulVisit = false, busy, onFinish}: Props) {
  const model = campaignReturnModel(battle, peacefulVisit);
  if (!model.available) return null;
  return <div className="ja2-campaign-return"><button className="line-button" disabled={busy} onClick={onFinish} title={model.note}>{model.label}</button><small>{model.note}</small></div>;
}
