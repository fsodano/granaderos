/** Wall time only. Clip intervals, action points and simulation time keep
 * their original values. Call once after native presentation delays resolve. */
export const ACTION_PRESENTATION_DURATION_SCALE=.70;
export function actionPresentationDuration(duration:number){return duration*ACTION_PRESENTATION_DURATION_SCALE;}
