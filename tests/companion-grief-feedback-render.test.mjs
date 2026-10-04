import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {totalReserveAmmunition} from '../game/ammunition-types.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const order=(state,action)=>{const next=dispatchCampaign(state,action);assert.equal(next.lastError,null,next.lastError);return next;};
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const popup=tree=>nodes(tree).find(node=>node.props?.className==='tactical-feedback-popup')??null;

function paidLoss(content=defaultContentPackage()){
 // Two real paid hires, the ordinary Retiro visit, and two once-issued pistol
 // charges establish the loss. No health, inventory or receipt is injected.
 let campaign=initialCampaign(42,content);
 for(const id of [107,116])campaign=order(campaign,{type:'recruitCivic',id,term:'week'});
 campaign=order(campaign,{type:'wait',hours:6});campaign=order(campaign,{type:'visitSector'});
 let battle=enterSector(campaign.pendingBattle,campaign.sectorStates.retiro);
 const issued=structuredClone(battle),actions=[];
 const save=()=>{const synced=syncBattleTime(campaign,battle);assert.equal(synced.error,null,synced.error);const pair=decodeSave(encodeSave(synced.campaign,synced.battle));campaign=pair.campaign;battle=pair.battle;return pair;};
 const execute=action=>{actions.push(action);const next=actBattle(battle,action);assert.equal(next.lastError,null,next.lastError);assert.deepEqual(presentedActBattle(battle,action).state,next);battle=next;save();};
 const initial=save();
 const companion=battle.units.find(unit=>unit.id==='116'),fire={type:'firePoint',unitId:'107',x:companion.x,y:companion.y,aim:4};
 execute(fire);assert.ok(battle.units.find(unit=>unit.id==='116').hp>0);
 execute({type:'reload',unitId:'107'});const before=save();execute(fire);
 assert.equal(battle.units.find(unit=>unit.id==='116').hp,0);
 assert.equal((campaign.correspondence??[]).some(message=>message.id.startsWith('companion-loss:')),false,'the pending loss does not deliver a settlement letter');
 const shooter=battle.units.find(unit=>unit.id==='107'),original=issued.units.find(unit=>unit.id==='107');
 assert.equal(shooter.loaded+totalReserveAmmunition(shooter),original.loaded+totalReserveAmmunition(original)-2);
 const after=save();
 // The ordinary reducer replay retains the same admitted result. Official
 // checkpoints above exercise current campaign/battle receipt validation.
 let replay=initial;
 for(const action of actions){const next=actBattle(replay.battle,action),synced=syncBattleTime(replay.campaign,next);assert.equal(synced.error,null,synced.error);replay=decodeSave(encodeSave(synced.campaign,synced.battle));}
 assert.deepEqual(replay,after);
 return {before,after};
}

test('the real Battlefield briefly shows the newly saved named grief loss once without changing the state',async t=>{
 const {before,after}=paidLoss(),speaker=after.battle.units.find(unit=>unit.id==='107'),receipt=speaker.companionGrief.find(entry=>entry.companionId===116);
 assert.ok(receipt.loss>0);const original=structuredClone(after),text=`Inés Aguirre lamenta la muerte de Petrona Lagos. Moral −${receipt.loss}.`;
 const props=battle=>({battle,onChange:next=>next,onFinish(){}});
 const mounted=await mountBattlefield(t,Battlefield,props(before.battle),{virtualTimers:true,renderTree:popup});
 assert.equal(popup(mounted.tree()),null);
 await mounted.render(props(after.battle));assert.equal(document.querySelector('[role="status"]').textContent,text);
 assert.equal(popup(mounted.tree()).props.children,text);assert.equal(await mounted.nextDelay(),4000);
 assert.equal(document.querySelector('[role="status"]'),null);
 const restored=decodeSave(encodeSave(after.campaign,after.battle));await mounted.render(props(restored.battle));
 assert.equal(document.querySelector('[role="status"]'),null,'equal restored receipts do not repeat the notice');
 assert.deepEqual(after,original,'display and expiry do not change morale, RNG, paid service, health or finite gear');
 assert.equal(mounted.jobs().filter(job=>job.job.kind==='action'||job.job.kind==='movement-step').length,0);
});

test('loading an existing receipt does not backfill a notice, and a death without a preference supplies no named grief',async t=>{
 const current=paidLoss(),older=defaultContentPackage();for(const character of older.characters)delete character.preferredCompanions;
 const neutral=paidLoss(older);assert.equal(neutral.after.battle.units.find(unit=>unit.id==='107').companionGrief,undefined);
 const props=battle=>({battle,onChange:next=>next,onFinish(){}});
 const mounted=await mountBattlefield(t,Battlefield,props(current.after.battle),{virtualTimers:true,renderTree:popup});
 assert.equal(document.querySelector('[role="status"]'),null,'an initial saved receipt remains quiet');
 await mounted.render(props(structuredClone(current.after.battle)));assert.equal(popup(mounted.tree()),null);
 await mounted.render(props(neutral.before.battle));await mounted.render(props(neutral.after.battle));
 assert.equal(document.querySelector('[role="status"]'),null,'raw casualty state does not create a grief receipt or notice');
});
