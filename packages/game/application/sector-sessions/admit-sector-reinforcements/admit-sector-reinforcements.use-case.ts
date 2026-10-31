import type { AdmitSectorReinforcementsRepository } from './admit-sector-reinforcements.repository.ts';
export class AdmitSectorReinforcementsUseCase {
  readonly #repository: AdmitSectorReinforcementsRepository;
  constructor(repository: AdmitSectorReinforcementsRepository) {
    this.#repository = repository;
  }
  execute(): void {
    const admission = this.#repository.loadReinforcementAdmission();
    admission.session.admitParticipants(
      admission.preferences.map((preference) => preference.characterId),
    );
    for (const preference of admission.preferences) {
      admission.deployment.placeNear([preference.characterId], preference.point);
    }
    const placements = admission.deployment.confirm(admission.occupiedPoints);
    this.#repository.commitReinforcementAdmission(
      admission.session,
      placements,
      admission.revision,
    );
  }
}
