export class CampaignBuildingTemplates {
  #templates;

  constructor(templates = []) {
    this.#templates = structuredClone(templates);
  }
  snapshot() {
    return structuredClone(this.#templates);
  }

  save(template) {
    const name = template.name ?? 'Edificio';
    const index = this.#templates.findIndex((candidate) => candidate.name === name);
    const owned = structuredClone({ ...template, name });
    if (index < 0) this.#templates.push(owned);
    else this.#templates[index] = owned;
  }
}
