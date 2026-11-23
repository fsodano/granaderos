// Spreadsheet-style row names continue past Z on large tactical maps.
/** The only fields the label reads, so a cell that carries more fields is welcome. */
export type TacticalCell = Readonly<{
  x: number;
  y: number;
}>;

// The retained modules pass the two coordinates in order, so the rule keeps that
// positional signature; TacticalCell names the shape those coordinates describe.
export const tacticalGridLabel = (x: number, y: number): string => {
  let row = '';
  let n = y + 1;
  while (n > 0) {
    n--;
    row = String.fromCharCode(65 + (n % 26)) + row;
    n = Math.floor(n / 26);
  }
  return `${row}${x + 1}`;
};
