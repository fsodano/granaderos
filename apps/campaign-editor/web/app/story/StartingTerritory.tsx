'use client';
import type { CampaignContent } from '../../../../../packages/campaign-format/types.ts';
import { headquartersOptions } from '../../../../../packages/game/public/campaign-editor-api.ts';
import {
  campaignSectors,
  campaignWorld,
} from '../../../../../packages/game/public/campaign-editor-api.ts';
import { defaultStartingTerritory } from '../../../../../packages/game/public/campaign-editor-api.ts';
import { campaignFactionName } from '../../../../../packages/game/public/campaign-editor-api.ts';
export default function StartingTerritory({
  draft,
  onChange,
}: {
  draft: CampaignContent;
  onChange: (value: CampaignContent) => void;
}) {
  const sectors = campaignSectors(draft),
    originalHeadquarters = campaignWorld(draft).defaultHeadquarters ?? sectors[0]?.id,
    headquarters = draft.headquarters ?? originalHeadquarters,
    territory = draft.startingTerritory ?? defaultStartingTerritory(headquarters, draft);
  function chooseHeadquarters(id: string) {
    onChange({
      ...draft,
      headquarters: id,
      startingTerritory: {
        ...territory,
        [id]: { loyalty: territory[id]?.loyalty ?? 65, owner: 'patriot' },
      },
    });
  }
  function change(id: string, field: string, value: string | number) {
    const current = territory[id];
    if (!current) {
      return;
    }
    onChange({
      ...draft,
      startingTerritory: { ...territory, [id]: { ...current, [field]: value } },
    });
  }
  return (
    <section aria-label="Territorio inicial" className="test-panel">
      <h2>Territorio al iniciar la campaña</h2>
      <p>
        Elegí quién controla cada localidad y su lealtad inicial. Sus barrios comparten el control;
        el terreno abierto conserva su estado neutral. Las apariciones de personajes se eligen por
        celda en su ficha.
      </p>
      <label>
        Cuartel general
        <select value={headquarters} onChange={(e) => chooseHeadquarters(e.target.value)}>
          {headquartersOptions(draft).map((s: { id: string; name: string }) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <p>
        La primera escuadra comienza en el cuartel. Allí funciona la sala de armas de la campaña.
        Debe comenzar bajo tu control; perderlo termina la campaña. Al elegirlo, esa localidad pasa
        a tu control. Revisá también sus puntos de recepción en Llegadas.
      </p>
      <p>
        El control inicial no modifica los capítulos ni los personajes del paquete seleccionado. El
        puerto de importaciones se configura a continuación.
      </p>
      <p>
        Estas opciones se aplican una sola vez. El juego conserva las conquistas, pérdidas y cambios
        de lealtad al guardar. El control inicial no concede recompensas de combate ni completa
        misiones.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Localidad</th>
              <th>Control inicial</th>
              <th>Lealtad inicial (%)</th>
            </tr>
          </thead>
          <tbody>
            {sectors.map((s: { id: string; name: string }) => (
              <tr key={s.id}>
                <th scope="row">{s.name}</th>
                <td>
                  <select
                    aria-label={`Control inicial de ${s.name}`}
                    value={territory[s.id]?.owner ?? 'royalist'}
                    disabled={s.id === headquarters}
                    onChange={(e) => change(s.id, 'owner', e.target.value)}
                  >
                    <option value="patriot">{campaignFactionName(draft, 'patriot')}</option>
                    <option value="royalist">{campaignFactionName(draft, 'royalist')}</option>
                  </select>
                </td>
                <td>
                  <input
                    aria-label={`Lealtad inicial de ${s.name}`}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={
                      Number.isFinite(territory[s.id]?.loyalty) ? territory[s.id]?.loyalty : ''
                    }
                    onChange={(e) => change(s.id, 'loyalty', e.target.valueAsNumber)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={() =>
          onChange({
            ...draft,
            headquarters: originalHeadquarters,
            startingTerritory: defaultStartingTerritory(originalHeadquarters, draft),
          })
        }
      >
        Restaurar territorio original
      </button>
    </section>
  );
}
