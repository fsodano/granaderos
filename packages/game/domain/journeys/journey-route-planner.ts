import { Journey, JourneyPurpose } from './journey.ts';
import type { JourneyModeValue, RedirectJourneyPlan } from './journey.ts';
import { JourneyRefusal, JourneyRefusalCode } from './arrival-decision.ts';

export interface JourneyRouteNetwork {
  locationExists(sectorId: string): boolean;
  isHostile(sectorId: string): boolean;
  permitsHostileApproach(origin: string, destination: string): boolean;
  findRoute(origin: string, destination: string, mode: JourneyModeValue): readonly string[] | null;
  permitsRoute(route: readonly string[], mode: JourneyModeValue): boolean;
  legDurationSeconds(origin: string, destination: string, mode: JourneyModeValue): number;
}

export class JourneyRoutePlanner {
  readonly #network: JourneyRouteNetwork;

  constructor(network: JourneyRouteNetwork) {
    this.#network = network;
  }

  planRedirection(
    journey: Journey,
    destination: string,
    waypoints: readonly string[],
  ): RedirectJourneyPlan {
    if (!this.#network.locationExists(destination))
      throw new JourneyRefusal(JourneyRefusalCode.JourneyDestinationNotFound);
    if (!Array.isArray(waypoints) || waypoints.length > 8)
      throw new JourneyRefusal(JourneyRefusalCode.TooManyJourneyWaypoints);
    const snapshot = journey.snapshot();
    if (this.#network.isHostile(destination)) {
      if (
        destination !== snapshot.route[1] ||
        waypoints.length > 0 ||
        !this.#network.permitsHostileApproach(snapshot.route[0], destination)
      ) {
        throw new JourneyRefusal(JourneyRefusalCode.HostileRedirectionOutsideCurrentSegment);
      }
      return {
        through: destination,
        route: [destination],
        purpose: JourneyPurpose.HostileApproach,
      };
    }
    const candidates: Array<RedirectJourneyPlan & { seconds: number }> = [];
    for (const endpoint of snapshot.route.slice(0, 2)) {
      if (this.#network.isHostile(endpoint)) continue;
      const route = this.#routeThroughStops(endpoint, [...waypoints, destination], snapshot.mode);
      if (!route || route.length > 64 || !this.#network.permitsRoute(route, snapshot.mode))
        continue;
      const currentSegmentSeconds =
        endpoint === snapshot.route[0]
          ? snapshot.positionSeconds
          : snapshot.legDurationSeconds - snapshot.positionSeconds;
      const laterSeconds = route
        .slice(1)
        .reduce(
          (seconds, sectorId, index) =>
            seconds + this.#network.legDurationSeconds(route[index], sectorId, snapshot.mode),
          0,
        );
      candidates.push({
        through: endpoint,
        route,
        purpose: JourneyPurpose.Travel,
        seconds: currentSegmentSeconds + laterSeconds,
      });
    }
    candidates.sort(
      (left, right) => left.seconds - right.seconds || left.through.localeCompare(right.through),
    );
    if (!candidates.length) throw new JourneyRefusal(JourneyRefusalCode.JourneyRouteUnavailable);
    const { through, route, purpose } = candidates[0];
    return { through, route, purpose };
  }

  #routeThroughStops(
    origin: string,
    stops: readonly string[],
    mode: JourneyModeValue,
  ): string[] | null {
    const route = [origin];
    for (const destination of stops) {
      if (!this.#network.locationExists(destination) || this.#network.isHostile(destination))
        return null;
      const leg = this.#network.findRoute(route.at(-1)!, destination, mode);
      if (!leg?.length) return null;
      route.push(...leg.slice(1));
    }
    return route;
  }
}
