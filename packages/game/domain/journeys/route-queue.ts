// Stable minimum-cost queue. Equal-cost points keep insertion order so replacing
// the former stable array sort cannot change route or replay decisions.
export type RouteQueuePoint = {
  readonly cost: number;
};

type QueueEntry<Point extends RouteQueuePoint> = {
  readonly point: Point;
  readonly order: number;
};

export class RouteQueue<Point extends RouteQueuePoint = RouteQueuePoint> {
  readonly #heap: QueueEntry<Point>[] = [];
  #sequence = 0;

  constructor(first?: Point) {
    if (first) {
      this.push(first);
    }
  }

  get length(): number {
    return this.#heap.length;
  }

  before(a: QueueEntry<Point>, b: QueueEntry<Point>): boolean {
    return a.point.cost < b.point.cost || (a.point.cost === b.point.cost && a.order < b.order);
  }

  push(point: Point): void {
    const entry = { point, order: this.#sequence++ },
      heap = this.#heap;
    let index = heap.length;
    heap.push(entry);
    while (index) {
      const parent = (index - 1) >> 1,
        parentEntry = heap[parent];
      if (!parentEntry || !this.before(entry, parentEntry)) {
        break;
      }
      heap[index] = parentEntry;
      index = parent;
    }
    heap[index] = entry;
  }

  shift(): Point | undefined {
    const heap = this.#heap,
      first = heap[0];
    if (!first) {
      return undefined;
    }
    const last = heap.pop();
    if (!last) {
      return first.point;
    }
    if (heap.length) {
      let index = 0;
      while (index * 2 + 1 < heap.length) {
        let child = index * 2 + 1;
        const left = heap[child],
          right = heap[child + 1];
        if (!left) {
          break;
        }
        if (right !== undefined && this.before(right, left)) {
          child++;
        }
        const candidate = heap[child];
        if (!candidate || !this.before(candidate, last)) {
          break;
        }
        heap[index] = candidate;
        index = child;
      }
      heap[index] = last;
    }
    return first.point;
  }
}
