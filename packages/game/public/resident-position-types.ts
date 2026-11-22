export type ResidentPosition = Readonly<{ x: number; y: number; level: number }>;

export type ResidentPositionReference = Readonly<{
  characterId: string;
  position: ResidentPosition;
}>;
