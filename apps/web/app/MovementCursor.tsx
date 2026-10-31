import type { ActionPreview } from './tactical-ui-types';
import type {
  BattleSnapshot,
  BattleUnit,
} from '../../../packages/game/public/compatibility-types.ts';
import { formatAP } from '../../../packages/game/action-points.js';
import { projectSurface } from '../lib/tactical-elevation';
import './playtest-feedback.css';
export default function MovementCursor({
  state,
  unit,
  preview,
  project,
  scale = 1,
  showCost = true,
}: {
  state: BattleSnapshot;
  unit: BattleUnit;
  preview: ActionPreview | null;
  project: (x: number, y: number) => { x: number; y: number };
  scale?: number;
  showCost?: boolean;
}) {
  const finalCell = preview?.path?.at(-1);
  if (!preview?.movement || !preview.path || !finalCell) {
    return null;
  }
  const mode = unit.movementMode ?? 'walk',
    destination = projectSurface(state, project, finalCell),
    insufficient = state.mode !== 'exploration' && (preview.pa ?? 0) > unit.ap;
  const status = unit.stealthMode ? 'stealth' : insufficient ? 'insufficient' : 'doable';
  const label =
    (
      {
        walk: 'Caminar',
        run: 'Correr',
        crouch: 'Agachado',
        prone: 'Cuerpo a tierra',
      } as Record<string, string>
    )[mode] ?? 'Caminar';
  return (
    <g
      className={`movement-route ${status}`}
      data-movement-preview={mode}
      pointerEvents="none"
      aria-label={`${label}: ${formatAP(preview.pa)} PA${insufficient ? ' · PA insuficientes' : ''}${unit.stealthMode ? ' · Sigilo' : ''}`}
    >
      {preview.path.map((cell, index: number) => {
        const point = projectSurface(state, project, cell);
        return (
          <g key={index} transform={`translate(${point.x} ${point.y})`}>
            <ellipse cx="-5" cy="-1" rx="2.7" ry="4.1" transform="rotate(-40)" />
            <ellipse cx="5" cy="1" rx="2.7" ry="4.1" transform="rotate(-40)" />
          </g>
        );
      })}
      {showCost && (
        <g
          transform={`translate(${destination.x} ${destination.y - 28 * scale}) scale(${scale})`}
          className="movement-cost"
        >
          {mode === 'prone' ? (
            <path d="M-25 2h14l8 5m-12-5l5-5m-18 5h-5" />
          ) : mode === 'crouch' ? (
            <path d="M-23-3l7 5-9 6h10m-7-10l8 2" />
          ) : (
            <path
              d={
                mode === 'run'
                  ? 'M-23-6l-5 8-7-2m10-2l9 5 4-7m-13-1l9-5'
                  : 'M-24-5v9l-6 6m6-6l6 6m-6-13l-6 4m6-4l7 4'
              }
            />
          )}
          <circle
            cx={mode === 'prone' ? -32 : -24}
            cy={mode === 'prone' ? 0 : mode === 'crouch' ? -7 : -10}
            r="3"
          />
          <text x="9" y="5" textAnchor="middle">
            {formatAP(preview.pa)} PA
          </text>
        </g>
      )}
    </g>
  );
}
