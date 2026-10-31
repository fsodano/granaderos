import type { CampaignContext } from '../../../packages/game/public/compatibility-types.ts';
import {
  regionalClimate,
  regionalWeatherAt,
  regionalWeatherLabel,
  campaignSeason,
} from '../../../packages/game/regional-weather.js';
import './sector-environment.css';

export default function SectorEnvironment({
  sector,
  hour,
  local,
  state,
}: {
  sector: string;
  hour: number;
  local: boolean;
  state?: CampaignContext;
}) {
  const climate = regionalClimate(sector, state);
  if (!climate) {
    return null;
  }
  const weather = regionalWeatherAt(sector, hour, state);
  return (
    <details className="sector-environment">
      <summary>Terreno y clima</summary>
      <p>
        {climate.name} · {campaignSeason(hour, state).name}
      </p>
      <p>{climate.terrain}</p>
      {local && (
        <p>
          Tiempo actual: <strong>{regionalWeatherLabel(weather)}</strong>
        </p>
      )}
      <small>
        La humedad y la lluvia dificultan el encendido de la pólvora. El poncho protege del mal
        tiempo.
      </small>
      {climate.id === 'andes' && (
        <small>
          La altura reduce los PA disponibles en combate. Los pasos cierran en invierno.
        </small>
      )}
    </details>
  );
}
