import { NativePatientContactFit } from './heal-patient-contact-fit';
import { restoreActor, type ActorSnapshot } from './melee-worker-snapshot';
import type { ActorCue } from './presentation';
export type PatientFitJob = {
    id: number;
    own: ActorSnapshot;
    target: ActorSnapshot;
    calibration: any;
    cue: ActorCue;
    hip: string;
};
export function runPatientFitJob(job: PatientFitJob) {
    const at = performance.now(), own = restoreActor(job.own), other = restoreActor(job.target), fit = new NativePatientContactFit(own.model, own.root);
    fit.useCalibration(job.calibration);
    const plan = fit.prepare(job.cue, other);
    let lift: number | undefined;
    if (plan && own.weapon) {
        const hip = own.model.getObjectByProperty('uuid', job.hip);
        if (hip) {
            hip.add(own.weapon);
            own.root.updateMatrixWorld(true);
            fit.suppliesStowed = true;
            fit.stowSupply(own.weapon);
            lift = (fit as any).supplyOffsets.get(own.weapon)?.lift;
        }
    }
    const result = { id: job.id, plan: plan ?? null, lift, workerMs: performance.now() - at };
    fit.dispose();
    return result;
}
if (typeof self !== 'undefined')
    self.onmessage = (event: MessageEvent<PatientFitJob>) => {
        try {
            self.postMessage(runPatientFitJob(event.data));
        }
        catch (error) {
            self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : String(error) });
        }
    };
