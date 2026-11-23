import test from 'node:test';
import assert from 'node:assert/strict';
import type { CampaignAction, CampaignSnapshot } from '../packages/game/public/campaign-types.ts';
import { dispatchCampaign } from '../packages/game/campaign.js';
import {
  projectGameSession,
  restoreGameSession,
} from '../packages/game/infrastructure/session/campaign-game-session-mapper.js';
import { initialCampaign } from './legacy-campaign-fixture.ts';
import { present } from './assert-present.ts';

const seconds = (campaign: CampaignSnapshot): number =>
  campaign.hour * 3600 + (campaign.secondOfHour ?? 0);
const order = (campaign: CampaignSnapshot, command: CampaignAction): CampaignSnapshot => {
  const next = dispatchCampaign(campaign, command);
  assert.equal(next.lastError, null, `${command.type}: ${next.lastError}`);
  return next;
};
const timelineSecond = (campaign: CampaignSnapshot): number =>
  restoreGameSession(campaign).timeline.currentSecond;

void test('advancing whole hours moves the campaign clock and the session timeline together', () => {
  let campaign = initialCampaign();
  const startedAt = seconds(campaign);
  for (const hours of [1, 2, 3]) {
    campaign = order(campaign, { type: 'wait', hours: 1 });
    assert.equal(seconds(campaign), startedAt + hours * 3600);
    assert.equal(campaign.hour, hours);
    assert.equal(campaign.secondOfHour, 0);
    assert.equal(timelineSecond(campaign), seconds(campaign));
  }
});

void test('a travel boundary stops the clock at the same hour it did before the timeline owned it', () => {
  let campaign = initialCampaign();
  present(campaign.sectors['buenos_aires']).owner = 'royalist';
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  campaign = order(campaign, { type: 'wait', hours: 24 });
  assert.equal(seconds(campaign), 7200);
  assert.equal(campaign.hour, 2);
  assert.equal(campaign.secondOfHour, 0);
  assert.equal(present(present(campaign.squads[0]).journey).status, 'ready');
  assert.equal(timelineSecond(campaign), 7200);
});

void test('a contract expiry stops the clock inside the hour and the campaign follows the timeline', () => {
  const campaign = initialCampaign();
  present(campaign.contracts[3]).expiresAt = 1;
  present(campaign.contracts[3]).expiresSecond = 1200;
  campaign.contractAttention.reported[3] = { expiresAt: 1, expiresSecond: 1200, code: 'expiring' };
  const next = order(campaign, { type: 'wait', hours: 3 });
  assert.equal(seconds(next), 3600 + 1200);
  assert.equal(next.hour, 1);
  assert.equal(next.secondOfHour, 1200);
  assert.equal(present(present(next.contractAttention.notice).events[0]).code, 'expired');
  assert.equal(timelineSecond(next), 3600 + 1200);
});

void test('projecting the session keeps the campaign clock on the accepted second', () => {
  const campaign = initialCampaign();
  const session = restoreGameSession(campaign);
  assert.equal(session.timeline.currentSecond, seconds(campaign));
  session.timeline.advanceTo(2 * 3600 + 75, () => 'continue');
  projectGameSession(campaign, session);
  assert.equal(campaign.hour, 2);
  assert.equal(campaign.secondOfHour, 75);
  assert.equal(seconds(campaign), 2 * 3600 + 75);
  assert.equal(restoreGameSession(campaign).timeline.currentSecond, session.timeline.currentSecond);
});

void test('the strategic clock advances the session timeline through a whole hour', () => {
  let campaign = initialCampaign();
  const startedAt = seconds(campaign);
  campaign = order(campaign, { type: 'advanceStrategicTime', seconds: 3600 });
  assert.equal(campaign.hour, 1);
  assert.equal(campaign.secondOfHour ?? 0, 0);
  assert.equal(seconds(campaign), startedAt + 3600);
  assert.equal(timelineSecond(campaign), seconds(campaign));
});

void test('the strategic clock keeps a fractional second on the session timeline', () => {
  const campaign = order(initialCampaign(), { type: 'advanceStrategicTime', seconds: 900 });
  assert.equal(campaign.hour, 0);
  assert.equal(campaign.secondOfHour, 900);
  assert.equal(timelineSecond(campaign), 900);
});

void test('a contract warning stops the strategic clock at the same second it did before', () => {
  const campaign = initialCampaign();
  present(campaign.contracts[3]).expiresAt = 2;
  present(campaign.contracts[3]).expiresSecond = 1800;
  const next = order(campaign, { type: 'advanceStrategicTime', seconds: 3600 });
  assert.equal(next.hour, 0);
  assert.equal(next.secondOfHour, 1800);
  assert.equal(timelineSecond(next), 1800);
  const notice = present(next.contractAttention.notice);
  assert.equal(notice.hour, 0);
  assert.equal(notice.secondOfHour, 1800);
  assert.equal(notice.advancedHours, 0);
  assert.equal(present(notice.events[0]).code, 'expiring');
});

void test('the strategic clock stops at the travel boundary it stopped at before', () => {
  let campaign = initialCampaign();
  present(campaign.sectors['buenos_aires']).owner = 'royalist';
  campaign = order(campaign, { type: 'attack', sector: 'buenos_aires', queue: true });
  campaign = order(campaign, { type: 'advanceStrategicTime', seconds: 3600 });
  campaign = order(campaign, { type: 'advanceStrategicTime', seconds: 3600 });
  assert.equal(campaign.hour, 2);
  assert.equal(campaign.secondOfHour ?? 0, 0);
  assert.equal(timelineSecond(campaign), 7200);
  assert.equal(present(present(campaign.squads[0]).journey).status, 'ready');
  const travelNotice = present(campaign.travelNotice);
  assert.equal(travelNotice.hour, 2);
  assert.equal(present(travelNotice.events[0]).squadId, 'squad-1');
});
