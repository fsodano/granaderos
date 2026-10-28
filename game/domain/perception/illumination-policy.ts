export type VisibleLightSource = Readonly<{ distance: number; radius: number; intensity: number }>;

export const IlluminationRules = Object.freeze({
  daylight: 1,
  nightAmbient: 0.08,
  brightTargetThreshold: 0.25,
});

export class IlluminationPolicy {
  daylight(): number {
    return IlluminationRules.daylight;
  }

  night(sources: Iterable<VisibleLightSource>): number {
    let illumination: number = IlluminationRules.nightAmbient;
    for (const source of sources) {
      if (source.distance > source.radius) continue;
      const received = source.intensity * (1 - source.distance / (source.radius + 1));
      illumination = Math.max(illumination, received);
    }
    return Math.max(0, Math.min(IlluminationRules.daylight, illumination));
  }
}
