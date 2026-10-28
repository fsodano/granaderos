export class PhysicalSectorProjection {
  #snapshot;
  #field;
  #archivedUnits;

  constructor(snapshot, includesParticipant) {
    this.#snapshot = snapshot;
    const units = snapshot.units ?? [];
    this.#archivedUnits = new Set(units.filter((unit) => !includesParticipant(unit)));
    this.#field = {
      ...snapshot,
      units: units.filter((unit) => !this.#archivedUnits.has(unit)),
    };
  }

  get field() {
    return this.#field;
  }

  apply() {
    const currentUnits = new Set(this.#field.units);
    const priorUnits = new Set(this.#snapshot.units ?? []);
    const units = [
      ...(this.#snapshot.units ?? []).filter(
        (unit) => this.#archivedUnits.has(unit) || currentUnits.has(unit),
      ),
      ...this.#field.units.filter((unit) => !priorUnits.has(unit)),
    ];
    Object.assign(this.#snapshot, this.#field, { units });
  }
}
