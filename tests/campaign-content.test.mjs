import test from "node:test";
import assert from "node:assert/strict";
import { defaultContentPackage } from "../game/content-package.js";
import { campaignContentReport } from "../game/campaign-content.js";
import { initialCampaign, dispatchCampaign, rosterFor } from "../game/campaign.js";
import { encodeSave, decodeSave } from "../game/save.js";
import { contractQuote } from "../game/contracts.js";
import { encountersFor } from "../game/encounters.js";
import {enterSector} from "../game/world.js";
const authored = () => {
  const d = defaultContentPackage(),
    c = d.characters.find((c) => c.id === "person-100");
  Object.assign(c, {
    name: "Clara del Río",
    nickname: "Clara",
    role: "Exploradora",
    biography: "Una nueva historia.",
    monthlyPay: 900,
    portrait: "/art/avatar-woman-scout.webp",
  });
  Object.assign(c.attributes, { maxHp: 55, marksmanship: 76, medical: 80, strength: 44 });
  return d;
};
test("new campaign applies authored sheets without changing the ordinary campaign", () => {
  const d = authored(),
    s = initialCampaign(81, d),
    op = rosterFor(s).find((o) => o.id === 100);
  assert.equal(op.name, "Clara del Río");
  assert.equal(op.biography, "Una nueva historia.");
  assert.equal(op.portraitId, "/art/avatar-woman-scout.webp");
  assert.equal(op.marksmanship, 76);
  assert.equal(op.strength, 44);
  assert.equal(s.operativeState[100].hp, 55);
  assert.equal(s.operativeState[100].maxHp, 55);
  assert.equal(contractQuote(s, op, "day").price, 30);
  d.characters.find((c) => c.id === "person-100").name = "Otro borrador";
  assert.equal(rosterFor(s).find((o) => o.id === 100).name, "Clara del Río");
  assert.notEqual(rosterFor(initialCampaign()).find((o) => o.id === 100).name, op.name);
  const contactDefinition=d.characters.find(c=>c.id==='person-3');
  contactDefinition.name='Contacto del cuartel';contactDefinition.portrait='/art/avatar-man-soldier.webp';
  const contactCampaign=initialCampaign(81,d),npc=encountersFor(contactCampaign,'retiro').find(n=>n.operativeId===3);
  assert.equal(npc.name,contactDefinition.name);assert.equal(npc.portraitId,contactDefinition.portrait);
});
test("authored campaign can hire, deploy, save and restore with exact identity and health", () => {
  let s = initialCampaign(81, authored());
  s = dispatchCampaign(s, { type: "recruitCivic", id: 100, term: "day" });
  assert.equal(s.lastError, null);
  assert.equal(s.resources.treasury, 3170);
  assert.equal(s.recruited.includes(100), false);
  s=dispatchCampaign(s,{type:"wait",hours:6});assert.equal(s.lastError,null);
  s = dispatchCampaign(s, { type: "visitSector" });
  assert.equal(s.lastError, null);
  const pair = {campaign:s,battle:enterSector(s.pendingBattle,s.sectorStates[s.location])};
  assert.ok(pair.battle);
  const unit = pair.battle.units.find((u) => u.id === "100");
  assert.equal(unit.name, "Clara del Río");
  assert.equal(unit.hp, 55);
  assert.equal(unit.maxHp, 55);
  assert.equal(unit.portraitId, "/art/avatar-woman-scout.webp");
  const restored = decodeSave(encodeSave(pair.campaign, pair.battle));
  assert.deepEqual(restored.campaign.contentCampaign, pair.campaign.contentCampaign);
  assert.equal(rosterFor(restored.campaign).find((o) => o.id === 100).marksmanship, 76);
  assert.equal(restored.battle.units.find((u) => u.id === "100").hp, 55);
});
test("save admission rejects incompatible or malformed authored context", () => {
  const s = initialCampaign(81, authored());
  for (const mutate of [
    (v) => (v.campaign.contentCampaign.adapter = "future"),
    (v) => (v.campaign.contentCampaign.package.characters[0].attributes.maxHp = -1),
    (v) => v.campaign.contentCampaign.package.characters.pop(),
  ]) {
    const v = JSON.parse(encodeSave(s));
    mutate(v);
    assert.throws(() => decodeSave(JSON.stringify(v)));
  }
  const ordinary = decodeSave(encodeSave(initialCampaign()));
  assert.equal(ordinary.campaign.contentCampaign, undefined);
});
test("integration report explicitly identifies pending behavior instead of silently applying it", () => {
  const d = authored();
  d.weapons[0].damage = 99;
  d.placements[0].sectors = ["cell-0-0"];
  let report = campaignContentReport(d);
  assert.equal(report.blocked.length, 2);
  assert.ok(report.blocked.some((t) => t.includes("armas")));
  assert.ok(report.blocked.some((t) => t.includes("apariciones")));
  assert.throws(()=>initialCampaign(1,d));
  d.characters.pop();
  assert.ok(campaignContentReport(d).blocked.length);
  assert.throws(() => initialCampaign(1, d));
});

test("authored attributes at 100 are not silently capped by legacy recruit growth", () => {
  const d = authored(),
    c = d.characters.find((c) => c.id === "person-100");
  c.attributes.maxHp = 100;
  c.attributes.marksmanship = 100;
  const s = initialCampaign(1, d),
    restored = decodeSave(encodeSave(s)).campaign;
  assert.equal(rosterFor(restored).find((o) => o.id === 100).maxHp, 100);
  assert.equal(rosterFor(restored).find((o) => o.id === 100).marksmanship, 100);
  assert.equal(restored.operativeState[100].hp, 100);
});


test('content identity matches SHA-256 and rejects a changed embedded story',async()=>{
 const {createHash}=await import('node:crypto');
 const {canonicalContent,contentIdentity}=await import('../game/content-identity.js');
 const definition=authored(),identity=contentIdentity(definition);
 assert.equal(identity.hash,'sha256:'+createHash('sha256').update(canonicalContent(definition)).digest('hex'));
 assert.deepEqual(identity,contentIdentity(Object.fromEntries(Object.entries(definition).reverse())));
 const state=initialCampaign(81,definition),save=JSON.parse(encodeSave(state));
 save.campaign.contentCampaign.package.characters[0].name='Changed';
 assert.throws(()=>decodeSave(JSON.stringify(save)),/identidad/);
 assert.ok(Object.isFrozen(state.contentCampaign.package));
 assert.equal(state.economyVersion,2);assert.deepEqual(state.resources,{treasury:3200});
 const elite=rosterFor(state).find(op=>op.tier==='elite');assert.ok(elite);
 assert.equal(contractQuote(state,elite,'month').available,true);
});

test('unknown story settings cannot launch with silently ignored rules',()=>{
 for(const mutate of [d=>d.ruleset={combat:{}},d=>d.quests=[],d=>d.characters[0].service='contract',d=>d.characters[0].monthlyPay++]){
  const definition=authored();mutate(definition);
  assert.ok(campaignContentReport(definition).blocked.length);assert.throws(()=>initialCampaign(1,definition));
 }
});

test('authored campaign storage never replaces the ordinary or QA save slot',async()=>{
 const {CONTENT_SAVE_KEY,campaignStorageKey}=await import('../game/content-launch.js');
 const state=initialCampaign(81,authored());
 assert.equal(campaignStorageKey(state,''),CONTENT_SAVE_KEY);
 assert.equal(campaignStorageKey(state,'?qa=1'),CONTENT_SAVE_KEY);
 assert.equal(campaignStorageKey(initialCampaign(),'?content=1'),'granaderos.campaign.v1');
 assert.equal(campaignStorageKey(null,'?content=1'),CONTENT_SAVE_KEY);
 assert.equal(campaignStorageKey(null,'?qa=1'),'granaderos.campaign.v1.qa');
});


test('contract candidates remain off-map before hiring in ordinary and authored campaigns',()=>{
 for(let state of [initialCampaign(),initialCampaign(81,authored())]){
  const before=rosterFor(state).filter(op=>op.id>=100&&op.id<1000);
  for(const sector of Object.keys(state.sectors))for(const npc of encountersFor(state,sector))assert.ok(!before.some(op=>op.id===npc.operativeId));
  state=dispatchCampaign(state,{type:'recruitCivic',id:100,term:'week'});assert.equal(state.lastError,null);
  if(state.hiringArrivals?.length)state=dispatchCampaign(state,{type:"wait",hours:6});
  assert.ok(state.recruited.includes(100));
  for(const sector of Object.keys(state.sectors))assert.ok(!encountersFor(state,sector).some(n=>n.operativeId===100));
 }
});


test('attribute records cannot inject identifiers, weapons or combat rules',()=>{
 for(const key of ['id','weapon','traits','side','constructor']){
  const definition=authored();definition.characters[0].attributes[key]='override';
  assert.throws(()=>initialCampaign(1,definition),/atributos/);
 }
});


test('the mission commander also uses the authored sheet and retains existing wounds',async()=>{
 const {sanLorenzoAlly}=await import('../game/missions.js');
 const {createBattle}=await import('../game/tactical.js');
 const definition=authored(),commander=definition.characters.find(c=>c.id==='person-57');
 commander.name='Comandante de prueba';commander.attributes.maxHp=60;commander.attributes.marksmanship=72;commander.portrait='/art/avatar-man-soldier.webp';
 const state=decodeSave(encodeSave(initialCampaign(81,definition))).campaign;
 const ally=sanLorenzoAlly(state),battle=createBattle([ally],{enemies:[],exploration:true});
 assert.equal(battle.units[0].name,'Comandante de prueba · Comandante aliado');assert.equal(battle.units[0].hp,60);assert.equal(battle.units[0].marksmanship,72);assert.equal(battle.units[0].portrait,commander.portrait);
 state.missionAllies.san_lorenzo={...ally,hp:32};assert.equal(sanLorenzoAlly(state).hp,32);
});
