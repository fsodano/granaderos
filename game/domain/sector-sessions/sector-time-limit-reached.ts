export class SectorTimeLimitReached extends Error {
  readonly limitSecond: number;
  readonly remainingSeconds: number;

  constructor(limitSecond: number, remainingSeconds: number) {
    super('sector-time-limit-reached');
    this.name = 'SectorTimeLimitReached';
    this.limitSecond = limitSecond;
    this.remainingSeconds = remainingSeconds;
  }
}
