export default function ServiceObjectionNotice({ reason }: { reason?: string | null }) {
  if (!reason) {
    return null;
  }
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="service-refusal"

      aria-label="Objeción de servicio"
    >
      <p>{reason}</p>
    </div>
  );
}
