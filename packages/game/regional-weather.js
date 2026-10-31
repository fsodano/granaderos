import { worldCell } from './world-cells.ts';
import { campaignWorld, campaignDefinitions } from './campaign-definition.js';
import { scenarioFor } from './campaign-scenario.js';
import { DEFAULT_WORLD } from '../../content/campaigns/default.js';
import { canonicalContent } from './content-identity.js';

// Weather remains a shared deterministic mechanic. Geography and tuning are data.
export const REGIONAL_CLIMATES = DEFAULT_WORLD.weather.climates;
export const WEATHER_INTERVAL_HOURS = 6;
const neutral = {
  id: 'temperate',
  name: 'Clima templado',
  terrain: 'Terreno de la campaña',
  humidity: [5, 5, 5, 5],
  rain: [20, 20, 20, 20],
};
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const need = (valid, message) => {
  if (!valid) {
    throw Error(message);
  }
};
/** @param {*} context */
/** @param {string} sector
 * @param {import('./public/compatibility-types.ts').CampaignContext} [context]
 * @returns {{id:string,name:string,terrain:string,humidity:number[],rain:number[]}|null} */
export function regionalClimate(sector, context = null) {
  const source = context?.regionalWeatherDefinition;
  if (source) {
    return source.sector === sector ? source.climate : null;
  }
  const cell = worldCell(sector, context),
    weather = campaignWorld(context).weather;
  if (!weather) {
    return cell?.land ? { ...neutral } : null;
  }
  const fallback = weather.fallbacks,
    id =
      weather.regions[sector] ??
      (cell?.land
        ? (weather.regions[cell.locality] ??
          fallback.biomes[cell.biome] ??
          fallback.theaters[cell.theater] ??
          fallback.default)
        : null);
  return id && weather.climates[id] ? { id, ...weather.climates[id] } : null;
}
function initialCalendar(context) {
  return scenarioFor(context).calendar({
    hour: 0,
    contentCampaign: { package: campaignDefinitions(context) },
  });
}
export function regionalWeatherSource(sector, context = null) {
  const climate = regionalClimate(sector, context);
  need(climate, 'La región climática no existe.');
  const { year, month, day } = initialCalendar(context);
  return {
    version: 1,
    sector,
    climate,
    calendar: { year, month, day },
    seed: campaignWorld(context).weather?.seed ?? 0,
  };
}
/** @param {*} context */
export function campaignSeason(hour = 0, context = null) {
  need(Number.isFinite(hour) && hour >= 0, 'La hora del clima no es válida.');
  const date = context?.regionalWeatherDefinition?.calendar ?? initialCalendar(context),
    month = ((date.month - 1 + Math.floor((date.day - 1 + Math.floor(hour / 24)) / 30)) % 12) + 1;
  const index = month === 12 || month <= 2 ? 0 : month <= 5 ? 1 : month <= 8 ? 2 : 3;
  return { index, month, name: ['Verano', 'Otoño', 'Invierno', 'Primavera'][index] };
}
function weatherRoll(region, block, seed) {
  let h = 2166136261;
  for (const c of `${region}:${block}:${seed}`) {
    h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  return (h >>> 0) % 100;
}
/** @param {*} context */
export function regionalWeatherAt(sector, hour = 0, context = null) {
  const climate = regionalClimate(sector, context);
  need(climate, 'La región climática no existe.');
  need(Number.isFinite(hour) && hour >= 0, 'La hora del clima no es válida.');
  const season = campaignSeason(hour, context).index,
    block = Math.floor(hour / WEATHER_INTERVAL_HOURS),
    roll = weatherRoll(
      climate.id,
      block,
      context?.regionalWeatherDefinition?.seed ?? campaignWorld(context).weather?.seed ?? 0,
    ),
    wet = roll < climate.rain[season];
  return {
    rain: wet ? (roll % 3 === 0 ? 60 : roll % 3 === 1 ? 25 : 40) : 0,
    humidity: climate.humidity[season] + (wet ? 1 : 0),
  };
}
export function regionalConditions(sector, hour, context = null) {
  return {
    regionalWeather: true,
    regionalWeatherDefinition: regionalWeatherSource(sector, context),
    weather: regionalWeatherAt(sector, hour, context),
  };
}
export function validateRegionalWeather(s, context = s) {
  if (s.regionalWeather !== undefined && typeof s.regionalWeather !== 'boolean') {
    throw Error('El origen del clima no es válido.');
  }
  if (
    s.regionalWeather &&
    s.regionalWeatherDefinition === undefined &&
    campaignDefinitions(context)?.world
  ) {
    s.regionalWeatherDefinition = regionalWeatherSource(
      s.sectorId ?? s.sector,
      campaignDefinitions(context),
    );
  }
  const source = s.regionalWeatherDefinition;
  if (source !== undefined) {
    need(
      object(source) &&
        source.version === 1 &&
        Object.keys(source).length === 5 &&
        source.sector === (s.sectorId ?? s.sector) &&
        Number.isSafeInteger(source.seed) &&
        source.seed >= 0 &&
        source.seed <= 0xffffffff,
      'La definición del clima no es válida.',
    );
    const c = source.climate,
      date = source.calendar;
    need(
      object(c) &&
        typeof c.id === 'string' &&
        typeof c.name === 'string' &&
        typeof c.terrain === 'string' &&
        ['humidity', 'rain'].every(
          (key) =>
            Array.isArray(c[key]) &&
            c[key].length === 4 &&
            c[key].every((n) => Number.isFinite(n) && n >= 0 && n <= 99),
        ) &&
        object(date) &&
        Number.isSafeInteger(date.year) &&
        date.year >= 1 &&
        date.year <= 10000 &&
        Number.isInteger(date.month) &&
        date.month >= 1 &&
        date.month <= 12 &&
        Number.isInteger(date.day) &&
        date.day >= 1 &&
        date.day <= 30,
      'La definición del clima no es válida.',
    );
    if (campaignDefinitions(context)?.world) {
      need(
        canonicalContent(source) ===
          canonicalContent(regionalWeatherSource(source.sector, campaignDefinitions(context))),
        'El clima no corresponde a la campaña.',
      );
    }
  }
  if (s.regionalWeather) {
    need(
      regionalClimate(s.sectorId ?? s.sector, source ? s : context),
      'La región climática no existe.',
    );
    need(
      s.weather &&
        ['rain', 'humidity'].every(
          (key) => Number.isFinite(s.weather[key]) && s.weather[key] >= 0 && s.weather[key] <= 100,
        ),
      'El clima regional no es válido.',
    );
  }
}
export function validateCampaignWeather(state) {
  for (const scene of [
    ...Object.values(state.sectorStates ?? {}),
    ...Object.values(state.sceneStates ?? {}),
    state.pendingBattle,
    state.pendingBattle?.resumeSnapshot,
  ].filter(Boolean)) {
    validateRegionalWeather(scene, state);
  }
}
export function regionalWeatherLabel(weather) {
  return weather.rain >= 50 ? 'Lluvia intensa' : weather.rain > 0 ? 'Lluvia' : 'Sin lluvia';
}
