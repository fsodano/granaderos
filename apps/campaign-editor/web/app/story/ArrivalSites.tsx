'use client';
import type { CampaignContent } from '../../../../../packages/campaign-format/types.ts';
import { campaignSectors } from '../../../../../packages/game/public/campaign-editor-api.ts';
import {
  ARRIVAL_FACILITIES,
  arrivalFacilityOptions,
} from '../../../../../packages/game/public/campaign-editor-api.ts';
export default function ArrivalSites({
  draft,
  onChange,
}: {
  draft: CampaignContent;
  onChange: (next: CampaignContent) => void;
}) {
  const original = draft.arrivalSites ?? [],
    sites = original;
  function toggle(sector: string, facility: string) {
    const current = sites.find((s) => s.sector === sector)?.facilities ?? [];
    const facilities = current.includes(facility)
      ? current.filter((f: string) => f !== facility)
      : [...current, facility];
    onChange({
      ...draft,
      arrivalSites: [
        ...sites.filter((s) => s.sector !== sector),
        ...(facilities.length ? [{ sector, facilities }] : []),
      ],
    });
  }
  return (
    <section className="test-panel" aria-label="Llegadas de contratados">
      <h2>Puntos de llegada de contratados</h2>
      <p>
        Marcá los lugares que pueden recibir contratados. Al jugar, el destino debe estar bajo tu
        control y sin enemigos. Un bloqueo impide llegar a un lugar que solo tiene acceso por agua.
      </p>
      <p>
        Una celda de río no es un embarcadero. Los pasos cordilleranos tampoco son puntos de
        recepción. El tiempo de viaje se configura en la ficha de cada contratado.
      </p>
      <button
        onClick={() =>
          onChange({
            ...draft,
            arrivalSites: campaignSectors(draft).flatMap((s: { id: string }) => {
              const facilities = arrivalFacilityOptions(s.id, draft);
              return facilities.length ? [{ sector: s.id, facilities }] : [];
            }),
          })
        }
      >
        Restaurar puntos de llegada
      </button>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Localidad</th>
              {Object.entries(ARRIVAL_FACILITIES).map(([id, label]) => (
                <th key={id}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {campaignSectors(draft).map((sector: { id: string; name: string }) => (
              <tr key={sector.id}>
                <th scope="row">{sector.name}</th>
                {Object.entries(ARRIVAL_FACILITIES).map(([id, label]) => (
                  <td key={id}>
                    {arrivalFacilityOptions(sector.id, draft).includes(id) ? (
                      <input
                        type="checkbox"
                        aria-label={`${label} en ${sector.name}`}
                        checked={sites.some(
                          (s) => s.sector === sector.id && s.facilities.includes(id),
                        )}
                        onChange={() => toggle(sector.id, id)}
                      />
                    ) : (
                      <span aria-label="Sin acceso compatible">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!sites.length && (
        <output>No hay puntos habilitados. Esta campaña no podrá recibir contratados.</output>
      )}
    </section>
  );
}
