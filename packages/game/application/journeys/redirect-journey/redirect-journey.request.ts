export type RedirectJourneyRequest = Readonly<{
  squadId: string;
  destination: string;
  waypoints?: readonly string[];
}>;
