export type MaterialInterval = Readonly<{
  entry: number;
  exit: number;
}>;

export type MaterialSpan<Interval extends MaterialInterval = MaterialInterval> = Readonly<
  Interval & MaterialInterval
>;

export type MaterialSpanEvent<Interval extends MaterialInterval = MaterialInterval> = Readonly<{
  fraction: number;
  priority: number;
  key: string;
  type: 'enter' | 'exit';
  span: MaterialSpan<Interval>;
}>;

// One wide prop spans several cells. Their intervals meet at the narrow boundary
// between cells, and the division that locates that boundary can differ in the
// last bits, so two touching intervals must merge within this tolerance. Without
// it the same material is charged twice at a shared face and a shot stops one
// cell too early.
export const MATERIAL_INTERVAL_TOUCH_TOLERANCE = 1e-10;

// The flight orders its events by fraction and then by priority. Entering cover
// is paid before a body at the same point, and leaving it is settled after that
// body, between the solid-cover events at 1 and the body events at 3.
export const MATERIAL_ENTER_EVENT_PRIORITY = 2;
export const MATERIAL_EXIT_EVENT_PRIORITY = 4;

// The clipped intervals of one object are swept in flight order: intervals that
// overlap or touch become one span, and a span reaches the furthest exit of its
// intervals. A merged span keeps the payload of the interval that opened it,
// because the flight reports the cell and the volume it entered.
export function mergeMaterialIntervals<Interval extends MaterialInterval>(
  intervals: readonly Interval[],
): MaterialSpan<Interval>[] {
  const spans: { source: Interval; entry: number; exit: number }[] = [];
  for (const interval of [...intervals].sort((a, b) => a.entry - b.entry || a.exit - b.exit)) {
    const previous = spans.at(-1);
    if (previous && interval.entry <= previous.exit + MATERIAL_INTERVAL_TOUCH_TOLERANCE) {
      previous.exit = Math.max(previous.exit, interval.exit);
      continue;
    }
    spans.push({ source: interval, entry: interval.entry, exit: interval.exit });
  }
  return spans.map(({ source, entry, exit }) => ({ ...source, entry, exit }));
}

export function materialSpanEvents<Interval extends MaterialInterval>(
  key: string,
  spans: readonly MaterialSpan<Interval>[],
): MaterialSpanEvent<Interval>[] {
  return spans.flatMap((span) => [
    {
      fraction: span.entry,
      priority: MATERIAL_ENTER_EVENT_PRIORITY,
      key,
      type: 'enter' as const,
      span,
    },
    {
      fraction: span.exit,
      priority: MATERIAL_EXIT_EVENT_PRIORITY,
      key,
      type: 'exit' as const,
      span,
    },
  ]);
}
