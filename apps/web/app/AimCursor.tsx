import type { ActionPreview, TacticalPointer } from './tactical-ui-types';
import { formatAP } from '../../../packages/game/action-points.js';
import { canChooseShotLocation } from '../../../packages/game/targeted-combat.js';
import './aim-cursor.css';
export default function AimCursor({
  point,
  aim,
  preview,
  target,
  scale = 1,
  bounds,
  exploring = false,
}: {
  point: { x: number; y: number };
  aim: number;
  preview: ActionPreview | null;
  target: TacticalPointer | null;
  scale?: number;
  exploring?: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
}) {
  const reloading = preview?.attackType === 'reload';
  const grenade = preview?.attackType === 'throwGrenade',
    throwing = preview?.attackType === 'throwKnife' || grenade;
  const region = preview?.hitLocation
    ? canChooseShotLocation(target)
      ? preview.hitLocation
      : 'Cuerpo'
    : 'Casilla';
  const blocked = grenade && preview.blocked;
  const label = reloading
    ? preview.actionLabel
    : grenade
      ? `Granada · ${blocked ? 'Obstáculo' : 'Área'}`
      : throwing
        ? `Facón · ${region}`
        : region;
  const cost = preview?.pa;
  const margin = bounds ? Math.min(bounds.width / 2, 56 * scale) : 0;
  const labelX = bounds
    ? (Math.max(bounds.x + margin, Math.min(bounds.x + bounds.width - margin, point.x)) - point.x) /
      scale
    : 0;
  const labelY = bounds && point.y + 60 * scale > bounds.y + bounds.height ? -25 : 25;
  const text = `${label}${!exploring && cost !== undefined && preview?.cursor !== 'empty' ? ` · ${formatAP(cost)} PA` : ''}`;
  const detail = blocked
    ? `Caída ${preview.landingLabel ?? 'antes del objetivo'} · Radio ${preview.blastRadius ?? 0}`
    : grenade
      ? `Radio ${preview.blastRadius ?? 0} casillas${exploring ? '' : ` · ${formatAP(preview?.remaining)} PA restantes`}`
      : throwing
        ? `${preview.energy} EN${exploring ? '' : ` · ${formatAP(preview?.remaining)} PA restantes`}`
        : preview?.cursor === 'empty'
          ? 'No quedan cartuchos'
          : !exploring && cost !== undefined
            ? preview?.partial
              ? `Faltan ${formatAP(preview.remainingReloadPA)} PA de recarga`
              : `${formatAP(preview?.remaining)} PA restantes`
            : (preview?.reason ?? 'Elegí un objetivo');
  return (
    <g
      className={`aim-cursor ${preview?.valid && !blocked ? 'valid' : 'invalid'}`}
      transform={`translate(${point.x} ${point.y}) scale(${scale})`}
      pointerEvents="none"
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Native SVG geometry requires its accessible role.
      role="img"
      aria-label={`Mira: ${text}. ${detail}. ${blocked ? `Caída prevista: ${preview.landingLabel ?? 'antes del objetivo'}. ` : ''}${reloading || grenade ? '' : `Puntería ${aim} de 4.`}${preview?.reason ? ` ${preview.reason}` : ''}`}
    >
      <circle r="9" className="aim-outer" />
      {preview?.cursor === 'empty' ? (
        <path className="aim-empty" d="M-6-6L6 6M6-6L-6 6" />
      ) : reloading ? (
        <path className="aim-reload" d="M6-3A7 7 0 1 0 6 4M6-9V-3H0" />
      ) : (
        <>
          <circle r="2" />
          <path d="M-13 0h6M7 0h6M0-13v6M0 7v6" />
        </>
      )}
      {!reloading &&
        !grenade &&
        [0, 1, 2, 3].map((i) => (
          <path
            key={i}
            className={i < aim ? 'aim-step filled' : 'aim-step'}
            transform={`rotate(${i * 90})`}
            d="M-3-16h6"
          />
        ))}
      <text x={labelX} y={labelY} textAnchor="middle">
        {text}
      </text>
      {(grenade || !preview?.valid || preview?.cursor === 'empty') && (
        <text x={labelX} y={labelY + 13} textAnchor="middle" className="aim-detail">
          {grenade || preview?.cursor === 'empty' ? detail : preview?.reason}
        </text>
      )}
    </g>
  );
}
