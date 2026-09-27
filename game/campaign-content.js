import {contentIdentity,canonicalContent} from "./content-identity.js";
import { defaultContentPackage, resolveContent } from "./content-package.js";
import { contentCellIds } from "./content-map.js";
export function campaignContentReport(content) {
  const value = resolveContent(content),
    baseline = defaultContentPackage(),
    blocked = [],
    pending = [];
  const supported=new Set(['format','version','id','name','characters','weapons','placements']);
  const characterFields=new Set(['id','name','nickname','role','biography','portrait','monthlyPay','weapon','attributes']);
  if(Object.keys(value).some(key=>!supported.has(key))||value.characters.some(c=>Object.keys(c).some(key=>!characterFields.has(key))))
    blocked.push('Este paquete incluye opciones de historia que esta versión todavía no puede aplicar.');
  if(value.characters.some(c=>Number(c.id.slice(7))<100&&c.monthlyPay!==baseline.characters.find(b=>b.id===c.id)?.monthlyPay))
    blocked.push('Los personajes históricos conservan su servicio permanente; su paga todavía no se puede cambiar.');
  const ids = new Set(value.characters.map((c) => c.id));
  if (
    value.characters.length !== baseline.characters.length ||
    baseline.characters.some((c) => !ids.has(c.id))
  )
    blocked.push(
      "La campaña aún necesita los personajes originales. Agregar o eliminar personajes requiere integrar los roles de historia.",
    );
  if (
    canonicalContent(value.weapons) !== canonicalContent(baseline.weapons) ||
    value.characters.some(
      (c) => c.weapon !== baseline.characters.find((b) => b.id === c.id)?.weapon,
    )
  )
    blocked.push("Las armas editadas todavía no se pueden usar en campaña. Restablecé sus valores para jugar con estas fichas.");
  const locations = (list) => list.map((p) => ({ ...p, sectors: contentCellIds(p.sectors) }));
  if (
    canonicalContent(locations(value.placements)) !== canonicalContent(locations(baseline.placements))
  )
    blocked.push("Las apariciones editadas todavía no se pueden usar en campaña. Restablecé sus ubicaciones para jugar con estas fichas.");
  pending.push(
    "Las habilidades, los requisitos de reclutamiento y el servicio permanente de los personajes históricos conservan sus reglas originales.",
  );
  return { blocked, pending };
}
export function attachCampaignContent(state, content) {
  const definitions = resolveContent(content),
    report = campaignContentReport(definitions);
  if (report.blocked.length) throw Error(report.blocked.join("\n"));
  state.contentCampaign = { version: 2, adapter: "character-sheets-v1", identity: contentIdentity(definitions), package: definitions };
  for (const c of definitions.characters) {
    const id = Number(c.id.slice("person-".length)),
      record = state.operativeState[id];
    record.hp = c.attributes.maxHp;
    record.maxHp = c.attributes.maxHp;
    record.bandaged = 0;
    // The saved legacy strength floor must use the authored starting attribute.
    if (record.strength !== undefined) record.strength = c.attributes.strength;
  }
  return state;
}
export function validateCampaignContent(state) {
  if (state?.contentCampaign === undefined) return;
  const context = state.contentCampaign;
  if (!context || context.version !== 2 || context.adapter !== "character-sheets-v1")
    throw Error("La versión del contenido de campaña no es compatible.");
  const definitions = resolveContent(context.package),
    report = campaignContentReport(definitions);
  if (report.blocked.length) throw Error(report.blocked.join("\n"));
  if(canonicalContent(context.identity)!==canonicalContent(contentIdentity(definitions)))throw Error("El contenido de campaña no coincide con su identidad guardada.");
  state.contentCampaign = { version: 2, adapter: "character-sheets-v1", identity: contentIdentity(definitions), package: definitions };
}
