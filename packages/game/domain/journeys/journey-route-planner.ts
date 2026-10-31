import { Journey, JourneyLimits, JourneyPurpose } from './journey.ts';
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
    this.#validateWaypointLimit(waypoints);
    const snapshot = journey.snapshot();
    if (this.#network.isHostile(destination)) {
      if (
        destination !== snapshot.route[1] ||
        waypoints.length > 0 ||
        !this.#network.permitsHostileApproach(journey.origin, destination)
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
      if (
        !route ||
        route.length >= JourneyLimits.MaximumRouteLocations ||
        !this.#network.permitsRoute(route, snapshot.mode)
      )
        continue;
      const currentSegmentSeconds =
        endpoint === snapshot.route[0]
          ? snapshot.positionSeconds
          : snapshot.legDurationSeconds - snapshot.positionSeconds;
      let laterSeconds = 0;
      let previousSector = endpoint;
      for (const sectorId of route.slice(1)) {
        laterSeconds += this.#network.legDurationSeconds(previousSector, sectorId, snapshot.mode);
        previousSector = sectorId;
      }
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
    const selected = candidates[0];
    if (!selected) throw new JourneyRefusal(JourneyRefusalCode.JourneyRouteUnavailable);
    const { through, route, purpose } = selected;
    return { through, route, purpose };
  }

  #validateWaypointLimit(waypoints: unknown): void {
    if (!Array.isArray(waypoints) || waypoints.length > JourneyLimits.MaximumWaypoints) {
      throw new JourneyRefusal(JourneyRefusalCode.TooManyJourneyWaypoints);
    }
  }

  #routeThroughStops(
    origin: string,
    stops: readonly string[],
    mode: JourneyModeValue,
  ): string[] | null {
    const route = [origin];
    let previousSector = origin;
    for (const destination of stops) {
      if (!this.#network.locationExists(destination) || this.#network.isHostile(destination))
        return null;
      const leg = this.#network.findRoute(previousSector, destination, mode);
      if (!leg?.length) return null;
      route.push(...leg.slice(1));
      previousSector = route.at(-1) ?? previousSector;
    }
    return route;
  }
}
