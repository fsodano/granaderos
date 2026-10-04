'use client';

type Props = {
  targets: any[]; selected: string; target: any; preview: any; verbs: any[]; verb: string; busy: boolean;
  contents: any[]; contentIndex: number; count: number; loot: any;
  onTarget: (key: string) => void; onVerb: (verb: string) => void; onUse: () => void;
  onContent: (index: number) => void; onCount: (count: number) => void; onLoot: () => void;
};

// This panel only accepts the public target summary and revealed contents.
export default function JA2EnvironmentPanel({targets, selected, target, preview, verbs, verb, busy, contents, contentIndex, count, loot, onTarget, onVerb, onUse, onContent, onCount, onLoot}: Props) {
  const item = contents.find(entry => entry.index === contentIndex);
  return <details className="ja2-nearby-loot ja2-environment-panel">
    <summary>Puertas y cofres cercanos · {targets.length}</summary>
    {target ? <>
      <div className="ja2-item-handling">
        <label>Objetivo<select aria-label="Puerta o cofre cercano" value={selected} disabled={busy} onChange={event => onTarget(event.target.value)}>{targets.map(entry => <option key={entry.key} value={entry.key}>{entry.label}</option>)}</select></label>
        <label>Acción<select aria-label="Acción con el objeto equipado" value={verb} disabled={busy} onChange={event => onVerb(event.target.value)}><option value="">Usar objeto equipado</option>{verbs.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
        <button className="line-button" disabled={busy || !preview?.valid} title={preview?.reason || undefined} onClick={onUse}>{preview?.label || 'Usar'}{preview?.pa !== undefined ? ` · ${preview.pa} PA` : ''}</button>
      </div>
      <p className="ja2-item-feedback" aria-live="polite">{target.open ? 'Abierto. ' : 'Cerrado. '}{target.locked && 'Con cerradura. '}{target.trapKnown && (target.trapArmed === false ? 'Trampa desarmada. ' : 'Trampa detectada. ')}{preview?.chance !== null && preview?.chance !== undefined && `${preview.chance}% de éxito. `}{preview?.reason}</p>
      {target.arsenalHint&&<p className="ja2-item-feedback" role="status">{target.arsenalHint}</p>}
      {target.kind === 'container' && (target.open ? contents.length ? <>
        <div className="ja2-item-handling">
          <label>Contenido<select aria-label="Objeto del cofre" value={contentIndex} disabled={busy} onChange={event => onContent(Number(event.target.value))}>{contents.map(entry => <option key={entry.index} value={entry.index}>{entry.label} · {entry.count}</option>)}</select></label>
          <label>Cantidad<input aria-label="Cantidad del cofre" type="number" min="1" step="1" max={item?.count || 1} value={count} disabled={busy || !item} onChange={event => onCount(Number(event.target.value))} /></label>
          <button className="line-button" disabled={busy || !loot?.valid} title={loot?.reason || undefined} onClick={onLoot}>Recoger{loot?.pa !== undefined ? ` · ${loot.pa} PA` : ''}</button>
        </div>
        <p className="ja2-item-feedback">{item?.condition !== undefined && `Estado ${item.condition}%. `}{item?.loaded !== undefined && `${item.loaded} carga(s). `}{loot?.reason}</p>
      </> : <p>El cofre está vacío.</p> : <p>El contenido permanece oculto hasta abrir el cofre.</p>)}
    </> : <p>Acercate a una puerta o a un cofre visible.</p>}
  </details>;
}
