import {
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Vector3,
} from 'three';

/** Display the removed wall fabric without adding solid geometry or targets. */
export class WallCutawayOutlines {
  private walls: Vector3[] = [];
  private openings: Vector3[] = [];
  readonly edgeIds: string[] = [];
  add({
    id,
    axis,
    first,
    last,
    cross,
    base,
    low,
    high,
    opening,
  }: {
    id: string;
    axis: 'x' | 'y';
    first: number;
    last: number;
    cross: number;
    base: number;
    low: number;
    high: number;
    opening?: { width: number; bottom: number; top: number };
  }) {
    if (high <= low) {
      return;
    }
    const point = (along: number, height: number) =>
      axis === 'x'
        ? new Vector3(along, base + height, cross)
        : new Vector3(cross, base + height, along);
    const segment = (points: Vector3[], a: number, b: number, c: number, d: number) =>
      points.push(point(a, b), point(c, d));
    segment(this.walls, first, low, first, high);
    segment(this.walls, first, high, last, high);
    segment(this.walls, last, high, last, low);
    this.edgeIds.push(id);
    if (opening) {
      const mid = (first + last) * 0.5,
        left = mid - opening.width * 0.5,
        right = mid + opening.width * 0.5,
        bottom = Math.max(low, opening.bottom);
      if (opening.top > bottom) {
        segment(this.openings, left, bottom, left, opening.top);
        segment(this.openings, left, opening.top, right, opening.top);
        segment(this.openings, right, opening.top, right, bottom);
      }
    }
  }
  finish(id: string) {
    const group = new Group();
    group.name = `wall-cutaway-outlines:${id}`;
    group.userData['edgeIds'] = this.edgeIds;
    for (const [name, points, material] of [
      [
        'walls',
        this.walls,
        () =>
          new LineDashedMaterial({
            color: '#d7c69c',
            transparent: true,
            opacity: 0.68,
            dashSize: 0.14,
            gapSize: 0.1,
            depthWrite: false,
            toneMapped: false,
          }),
      ],
      [
        'openings',
        this.openings,
        () =>
          new LineBasicMaterial({
            color: '#c9b893',
            transparent: true,
            opacity: 0.82,
            depthWrite: false,
            toneMapped: false,
          }),
      ],
    ] as const) {
      if (!points.length) {
        continue;
      }
      const lines = new LineSegments(new BufferGeometry().setFromPoints(points), material());
      lines.name = `wall-cutaway-${name}:${id}`;
      lines.computeLineDistances();
      lines.renderOrder = 1;
      // Selection remains on the real low wall and its existing door control.
      lines.raycast = () => {};
      group.add(lines);
    }
    return group;
  }
}
