import { FieldOfView } from '../../domain/perception/field-of-view.ts';
import { VisionObserver } from '../../domain/perception/vision-observer.ts';
import { VisibilityPolicy } from '../../domain/perception/visibility-policy.ts';
import { IlluminationPolicy } from '../../domain/perception/illumination-policy.ts';
import { KnownSectorPolicy } from '../../domain/perception/known-sector-policy.ts';
import { hasCharacterAbility } from '../../character-abilities.js';
import { tacticalLevel, surfaceHeight } from '../../tactical-space.js';
import { concealmentSightPenalty } from '../../projectile-cover.js';
import { isInteriorVisible } from '../../tactical-visibility.js';
import { wallEdgeBlocksMovement } from '../../wall-geometry.js';

const visibility = new VisibilityPolicy();
const illumination = new IlluminationPolicy();
const knownSector = new KnownSectorPolicy();

export function observerNightSightBonus(observer) {
  const traits = observer.traits ?? [];
  return traits.includes('night_vision') || hasCharacterAbility(observer, 'night_scout')
    ? 2
    : traits.includes('night_vision_basic')
      ? 1
      : 0;
}

export class SectorPerception {
  #state;
  #geometry;

  constructor(state, geometry) {
    this.#state = state;
    this.#geometry = geometry;
  }

  illuminationAt(x, y, level = 0) {
    const state = this.#state;
    if (!state.night) return illumination.daylight();
    const target = { x, y, tacticalLevel: level };
    const sources = [];
    for (const source of state.lights ?? []) {
      if (source.turns === 0 || source.extinguished) continue;
      const distance = Math.hypot(
        source.x - x,
        source.y - y,
        (surfaceHeight(state, source) ?? 0) - (surfaceHeight(state, target) ?? 0),
      );
      if (distance > source.radius || !this.#geometry.hasLineOfSight(state, source, target))
        continue;
      sources.push({ distance, radius: source.radius, intensity: source.intensity ?? 1 });
    }
    return illumination.night(sources);
  }

  visibleDistance(observer, target) {
    const nightSightBonus = observerNightSightBonus(observer);
    return visibility.range({
      night: Boolean(this.#state.night),
      nightSightBonus,
      targetIllumination: this.illuminationAt(target.x, target.y, tacticalLevel(target)),
      coverPenalty: concealmentSightPenalty(this.#state, target),
      stealthTraining: target.trainedStats?.stealth || 0,
      concealedMovement: target.movementMode === 'crouch' || target.movementMode === 'prone',
      mounted: Boolean(target.mounted),
    });
  }

  canObserve(observer, rawTarget) {
    const state = this.#state;
    const target = this.#geometry.edgePoint(rawTarget, state);
    if (state.deployment || !this.#geometry.observerAvailable(observer) || target.departure)
      return false;
    const facing =
      observer.facing ?? (observer.side === 'enemy' ? 6 : observer.side === 'player' ? 2 : 0);
    const vision = new VisionObserver(observer, true, new FieldOfView(facing), visibility);
    return vision.canObserve(
      { ...target, departed: Boolean(target.departure) },
      {
        range: () => this.visibleDistance(observer, target),
        lineOfSightClear: () => this.#geometry.hasLineOfSight(state, observer, target),
        smokeCells: () => this.#geometry.smokeBetween(state, observer, target),
      },
    );
  }

  teamCanObserve(side, target) {
    return this.#state.units.some(
      (observer) => observer.side === side && this.canObserve(observer, target),
    );
  }

  knows(observer, target) {
    return observer.side === 'player'
      ? this.teamCanObserve('player', target)
      : this.canObserve(observer, target);
  }

  knownTerrain(observer = { side: 'player' }) {
    const state = this.#state;
    const rooms = new Set(state.revealedRooms ?? []);
    const surface = (point) => {
      const stoneObstacle =
        point?.material === 'stone' &&
        (point.axis ? wallEdgeBlocksMovement(point) : point.blocked) &&
        ['wall', 'stone', 'cliff'].includes(point.type);
      return knownSector.retainsReflectingCover(
        Boolean(stoneObstacle),
        !stoneObstacle || this.knows(observer, point),
      )
        ? point
        : { ...point, obstacleHeight: 0, projectileResistance: 0, cover: 0 };
    };
    return {
      wallEdges: (state.wallEdges ?? []).map(surface),
      tiles: state.tiles.map(surface),
      ...(state.upperSurfaces ? { upperSurfaces: state.upperSurfaces.map(surface) } : {}),
      props: (state.props ?? []).filter((prop) =>
        knownSector.admitsProp(
          this.knows(observer, prop),
          observer.side !== 'player' || isInteriorVisible(state, prop, rooms),
        ),
      ),
    };
  }

  knownCharacters(observer, characters) {
    const rooms = new Set(this.#state.revealedRooms ?? []);
    return characters.filter(
      (character) =>
        character.side === observer.side ||
        knownSector.admitsCharacter({
          friendly: false,
          visible: this.knows(observer, character),
          interiorKnown:
            observer.side !== 'player' || isInteriorVisible(this.#state, character, rooms),
        }),
    );
  }
}
