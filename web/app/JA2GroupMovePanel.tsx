'use client';

type Props = {members: any[]; anchorId?: string; preview?: any; previewOpen?:boolean; previewWorking?:boolean; onPreviewOpenChange?:(open:boolean)=>void; report?: any; busy: boolean; onRemove: (id: string) => void; onClear: () => void};
const cell = (point: any) => point ? `${String.fromCharCode(65 + point.y)}${point.x + 1}` : 'sin destino';

export default function JA2GroupMovePanel({members, anchorId, preview, previewOpen,previewWorking=false,onPreviewOpenChange, report, busy, onRemove, onClear}: Props) {
  if (!members.length && !report) return null;
  const name = (id: string) => members.find(member => member.id === id)?.name || report?.names?.[id] || id;
  return <section className="ja2-group-move" aria-label="Movimiento del grupo">
    {members.length > 0 && <><strong>Grupo · {members.length}</strong><span>Mayús+clic agrega o quita combatientes. Una casilla libre mueve el grupo.</span><div className="ja2-group-members">{members.map(member => <button key={member.id} className="line-button" disabled={busy} aria-label={`Quitar a ${member.name} del grupo`} onClick={() => onRemove(member.id)}>{member.name}{member.id === anchorId ? ' · referencia' : ''} ×</button>)}</div></>}
    {members.length > 0 && <details className="ja2-group-preview" aria-label="Ruta del grupo" open={previewOpen} onToggle={event=>onPreviewOpenChange?.(event.currentTarget.open)}><summary>Ruta del grupo</summary>{previewWorking ? <p role="status">Calculando rutas…</p> : !preview ? <p>Señalá una casilla libre para ver la ruta.</p> : !preview.ok ? <p>{preview.reason}</p> : <ul>{preview.members.map((member: any) => <li key={member.unitId}>{name(member.unitId)}: {member.destination ? `${cell(member.destination)} · ${member.path.length} pasos` : member.reason}{member.destination && member.reason ? ` · ${member.reason}` : ''}</li>)}</ul>}</details>}
    {report && <div role="status"><p>{report.reason || 'El grupo alcanzó sus puestos.'} · {report.elapsedSeconds} s.</p>{report.members.some((member: any) => member.status !== 'arrived') && <ul>{report.members.filter((member: any) => member.status !== 'arrived').map((member: any) => <li key={member.unitId}>{name(member.unitId)}: {member.reason}</li>)}</ul>}</div>}
    <button className="line-button" disabled={busy} onClick={onClear}>{members.length ? 'Volver a órdenes individuales' : 'Cerrar parte de marcha'}</button>
  </section>;
}
