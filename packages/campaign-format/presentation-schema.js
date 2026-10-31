import { isContentImageReference } from './campaign-assets.js';
import { validateOfficerCreation } from './officer-creation-schema.js';
import { validateCampaignData } from './campaign-data-validation.ts';

const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max = 1000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const finite = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const unique = (values) => new Set(values).size === values.length;
const point = (v) => object(v) && finite(v.x, -2000, 2000) && finite(v.y, -2000, 2000);
const path = (v) => text(v, 50000) && /^[MmLlHhVvCcSsQqTtAaZzEe0-9+.,\s-]+$/.test(v);
const transform = (v) =>
  v === undefined ||
  (text(v, 200) && /^(?:(?:rotate|translate|scale|matrix)\([0-9+.,\s-]+\)\s*)+$/.test(v));
const label = (v) =>
  point(v) &&
  text(v.text, 200) &&
  transform(v.transform) &&
  (v.className === undefined ||
    (typeof v.className === 'string' && /^[a-zA-Z0-9_ -]{1,100}$/.test(v.className)));
export function validateCampaignPresentation(value, content) {
  if (value === undefined) {
    return [];
  }
  try {
    const errors = validateCampaignData(value);
    return errors.length
      ? errors.map((e) => `Presentación de campaña: ${e}`)
      : validatePresentationRecords(value, content);
  } catch {
    return ['Presentación de campaña: los datos contienen una estructura inválida.'];
  }
}
function validatePresentationRecords(value, content) {
  if (!object(value)) {
    return ['Presentación de campaña: definición inválida.'];
  }
  const errors = [],
    check = (ok, message) => {
      if (!ok) {
        errors.push(`Presentación de campaña: ${message}`);
      }
    };
  check(value.version === 1 && text(value.title, 200), 'versión o título inválido.');
  for (const key of [
    'subtitle',
    'edition',
    'eyebrow',
    'period',
    'menuArtAlt',
    'caption',
    'footer',
    'deskSeal',
  ]) {
    if (value[key] !== undefined) {
      check(text(value[key]), `${key}: texto inválido.`);
    }
  }
  const image = (v) => isContentImageReference(v) && (!v.startsWith('data:') || v.length < 350000);
  if (value.menuArt !== undefined) {
    check(image(value.menuArt), 'imagen de inicio inválida.');
  }
  if (value.calendar !== undefined) {
    const d = value.calendar;
    check(
      object(d) &&
        integer(d.year, 1, 10000) &&
        integer(d.month, 1, 12) &&
        integer(d.day, 1, 30) &&
        Object.keys(d).every((k) => ['year', 'month', 'day'].includes(k)),
      'calendario inválido.',
    );
  }
  if (value.characterPortraits !== undefined) {
    if (!Array.isArray(value.characterPortraits) || value.characterPortraits.length > 500) {
      check(false, 'catálogo de rostros inválido.');
    } else {
      const ids = new Set();
      for (const portrait of value.characterPortraits) {
        const valid =
          object(portrait) &&
          typeof portrait.id === 'string' &&
          /^[a-zA-Z0-9_-]{1,80}$/.test(portrait.id) &&
          !['constructor', 'prototype', '__proto__'].includes(portrait.id) &&
          !ids.has(portrait.id) &&
          text(portrait.name, 200) &&
          ['woman', 'man'].includes(portrait.gender) &&
          ['soldier', 'officer', 'scout', 'gaucho', 'artisan', 'medic'].includes(portrait.role) &&
          ['light', 'brown', 'dark'].includes(portrait.skinTone) &&
          (portrait.spriteAppearance === undefined ||
            (typeof portrait.spriteAppearance === 'string' &&
              /^[a-z][a-z0-9-]{0,79}$/.test(portrait.spriteAppearance))) &&
          image(portrait.src) &&
          (portrait.spriteSkinTone === undefined ||
            ['light', 'brown', 'dark'].includes(portrait.spriteSkinTone)) &&
          (portrait.selectable === undefined || typeof portrait.selectable === 'boolean');
        check(valid, `rostro inválido o repetido: ${portrait?.id ?? '?'}.`);
        ids.add(portrait?.id);
      }
    }
  }
  const intro = value.introduction;
  if (intro !== undefined) {
    check(
      object(intro) &&
        Array.isArray(intro.scenes) &&
        intro.scenes.length > 0 &&
        intro.scenes.length <= 64,
      'introducción inválida.',
    );
    if (object(intro)) {
      if (intro.version !== undefined) {
        check(intro.version === 1, 'versión de introducción inválida.');
      }
      for (const key of ['id', 'title', 'wordmark', 'period', 'createLabel']) {
        if (intro[key] !== undefined) {
          check(text(intro[key], 200), `${key}: introducción inválida.`);
        }
      }
      if (intro.chart !== undefined) {
        const c = intro.chart;
        check(object(c), 'carta de introducción inválida.');
        if (object(c)) {
          for (const key of ['land', 'river', 'mountains', 'route']) {
            if (c[key] !== undefined) {
              check(path(c[key]), `${key}: trazado inválido.`);
            }
          }
          if (c.labels !== undefined) {
            check(
              Array.isArray(c.labels) && c.labels.length <= 200 && c.labels.every(label),
              'etiquetas de introducción inválidas.',
            );
          }
          if (c.towns !== undefined) {
            check(
              Array.isArray(c.towns) &&
                c.towns.length <= 200 &&
                c.towns.every(
                  (t) =>
                    point(t) &&
                    text(t.text, 200) &&
                    (t.r === undefined || finite(t.r, 0, 200)) &&
                    (t.textX === undefined || finite(t.textX, -2000, 2000)) &&
                    (t.textY === undefined || finite(t.textY, -2000, 2000)),
                ),
              'localidades de introducción inválidas.',
            );
          }
          if (c.beacon !== undefined) {
            check(point(c.beacon), 'marca de introducción inválida.');
          }
        }
      }
    }
    if (Array.isArray(intro?.scenes)) {
      const ids = new Set();
      for (const scene of intro.scenes) {
        check(
          object(scene) &&
            text(scene.id, 80) &&
            !ids.has(scene.id) &&
            text(scene.title, 200) &&
            text(scene.text, 4000) &&
            ['map', 'letter', 'route', 'muster'].includes(scene.visual) &&
            integer(scene.durationMs, 0, 60000) &&
            (scene.portrait === undefined || image(scene.portrait)) &&
            ['eyebrow', 'portraitAlt', 'portraitName', 'portraitCaption'].every(
              (k) => scene[k] === undefined || text(scene[k], 200),
            ) &&
            (scene.seal === undefined ||
              (object(scene.seal) && text(scene.seal.letter, 20) && text(scene.seal.label, 200))),
          'escena de introducción inválida.',
        );
        ids.add(scene?.id);
      }
    }
  }
  errors.push(...validateOfficerCreation(value.officerCreation, content));
  const defaultPortrait = value.officerCreation?.defaults?.portraitId;
  if (defaultPortrait !== undefined && defaultPortrait !== null) {
    const portraits =
      value.characterPortraits ??
      (content?.scenario === 'generic-v1' || content?.campaignStory
        ? (content?.characters ?? []).map((c) => ({ id: `portrait-${c.id}`, selectable: true }))
        : undefined);
    if (portraits !== undefined) {
      check(
        Array.isArray(portraits) &&
          portraits.some((p) => p?.id === defaultPortrait && p.selectable !== false),
        'el rostro inicial no está disponible en esta campaña.',
      );
    }
  }
  if (value.manual !== undefined) {
    check(
      object(value.manual) &&
        Object.keys(value.manual).every((k) => ['campaign', 'goals', 'note'].includes(k)) &&
        Object.values(value.manual).every((v) => text(v, 4000)),
      'manual inválido.',
    );
  }
  const world = content?.world,
    sectors = new Set((Array.isArray(world?.sectors) ? world.sectors : []).map((s) => s?.id));
  const atlas = value.atlas;
  if (atlas !== undefined) {
    check(object(atlas), 'atlas inválido.');
    if (object(atlas)) {
      for (const key of [
        'title',
        'label',
        'referenceLabel',
        'scale',
        'legend',
        'enemyLabel',
        'friendlyLabel',
      ]) {
        if (atlas[key] !== undefined) {
          check(text(atlas[key], 200), `${key}: atlas inválido.`);
        }
      }
      for (const [key, min, max] of [
        ['longitudes', -180, 180],
        ['latitudes', -90, 90],
      ]) {
        if (atlas[key] !== undefined) {
          check(
            Array.isArray(atlas[key]) &&
              atlas[key].length <= 100 &&
              unique(atlas[key]) &&
              atlas[key].every((n) => finite(n, min, max)),
            `${key}: coordenadas inválidas.`,
          );
        }
      }
      if (atlas.labels !== undefined) {
        check(
          Array.isArray(atlas.labels) && atlas.labels.length <= 200 && atlas.labels.every(label),
          'etiquetas del atlas inválidas.',
        );
      }
      if (atlas.sites !== undefined) {
        check(
          Array.isArray(atlas.sites) &&
            atlas.sites.length <= 200 &&
            unique(atlas.sites.map((s) => s?.id)) &&
            atlas.sites.every(
              (s) =>
                object(s) &&
                typeof s.id === 'string' &&
                (!world || sectors.has(s.id)) &&
                text(s.label, 200) &&
                finite(s.lon, -180, 180) &&
                finite(s.lat, -90, 90),
            ),
          'sitios del atlas inválidos.',
        );
      }
      if (atlas.mountains !== undefined) {
        check(path(atlas.mountains), 'trazado del atlas inválido.');
      }
      if (atlas.labelPositions !== undefined) {
        check(
          object(atlas.labelPositions) &&
            Object.entries(atlas.labelPositions).every(
              ([id, p]) =>
                (!world || sectors.has(id)) &&
                object(p) &&
                Object.keys(p).every((k) => ['edge', 'offset'].includes(k)) &&
                (p.edge === undefined || ['top', 'bottom', 'left', 'right'].includes(p.edge)) &&
                (p.offset === undefined || finite(p.offset, -2000, 2000)),
            ),
          'posición de etiquetas inválida.',
        );
      }
    }
  }
  const skirmish = value.skirmish;
  if (skirmish !== undefined) {
    const r = skirmish?.request;
    check(
      object(skirmish) &&
        text(skirmish.label, 200) &&
        Array.isArray(skirmish.operativeIds) &&
        skirmish.operativeIds.length > 0 &&
        skirmish.operativeIds.length <= 48 &&
        unique(skirmish.operativeIds) &&
        skirmish.operativeIds.every((id) => integer(id, 0, 100000)) &&
        typeof skirmish.horse === 'boolean' &&
        object(r) &&
        typeof r.id === 'string' &&
        (!content?.maps || Object.hasOwn(content.maps, r.id)) &&
        text(r.name, 200) &&
        [
          'mountain',
          'plains',
          'wetland',
          'foothills',
          'forest',
          'scrub',
          'river',
          'urban',
        ].includes(r.biome) &&
        integer(r.seed, 0, 0xffffffff) &&
        integer(r.enemyCount, 1, 48),
      'combate de muestra inválido.',
    );
  }
  return errors;
}
