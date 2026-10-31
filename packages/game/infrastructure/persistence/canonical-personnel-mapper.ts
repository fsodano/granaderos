import { Squad } from '../../domain/personnel/squad.ts';
import {
  isCharacterDeployed,
  type CampaignSessionAccessSnapshot,
} from '../session/campaign-session-access.js';
import { Character } from '../../domain/personnel/character.ts';
import { ForceRoster } from '../../domain/personnel/force-roster.ts';
import { ServiceContract } from '../../domain/personnel/service-contract.ts';
import { Treasury } from '../../domain/finance/treasury.ts';
import { Money } from '../../domain/finance/money.ts';
import { DomainIdentityMap } from './domain-identity-map.ts';
import {
  CampaignCharacterAbilitiesMapper,
  type CharacterAbilityDefinition,
} from '../personnel/campaign-character-abilities-mapper.js';
import type { CharacterRatingName } from '../../domain/personnel/character-abilities.ts';

export const PersonnelIdentity = Object.freeze({
  character: 'Character',
  treasury: 'Treasury',
  roster: 'ForceRoster',
  squad: 'Squad',
});
const SecondsPerHour = 3600;
const MaximumSquadSize = 6;

type PersonnelRecord = {
  hp: number;
  alive: boolean;
  bleeding?: number;
  bandaged?: number;
  captured?: boolean;
  location?: string | null;
  residentSector?: string | null;
};
type ContractRecord = {
  kind: string;
  term: string;
  started: number;
  startedSecond?: number;
  expiresAt: number | null;
  expiresSecond?: number;
  paid: number;
  departurePending?: boolean;
};
export type PersonnelDefinition = CharacterAbilityDefinition & Readonly<{ maxHp: number }>;
export type CampaignPersonnelSnapshot = CampaignSessionAccessSnapshot & {
  operativeState: Record<string, PersonnelRecord>;
  contracts: Record<string, ContractRecord>;
  resources: { treasury: number };
  recruited: number[];
  squad: number[];
  location: string;
  activeSquadId?: string;
  squads?: Array<{
    id: string;
    name: string;
    location: string;
    members: number[];
    journey?: unknown;
  }>;
};

export class CanonicalPersonnelMapper {
  readonly #campaign: CampaignPersonnelSnapshot;
  readonly #identities: DomainIdentityMap;
  readonly #abilities: CampaignCharacterAbilitiesMapper;
  readonly #characters = new Map<string, Character>();
  readonly #squads = new Map<string, Squad>();
  readonly #originalSquads = new Map<string, string>();
  readonly #originalCharacters = new Map<string, string>();
  readonly treasury: Treasury;
  readonly roster: ForceRoster;

  constructor(campaign: CampaignPersonnelSnapshot, identities: DomainIdentityMap) {
    this.#campaign = campaign;
    this.#identities = identities;
    this.#abilities = new CampaignCharacterAbilitiesMapper(campaign);
    for (const record of campaign.squads ?? []) {
      const squad = identities.obtain(
        PersonnelIdentity.squad,
        record.id,
        () =>
          new Squad({
            id: record.id,
            name: record.name,
            locationId: record.location,
            memberIds: record.members.map(String),
            membershipLocked: Boolean(
              record.journey || record.members.some((id) => isCharacterDeployed(campaign, id)),
            ),
          }),
      );
      this.#squads.set(record.id, squad);
      this.#originalSquads.set(record.id, JSON.stringify(squad.toSnapshot()));
    }
    const activeSquad = campaign.activeSquadId
      ? this.#squads.get(campaign.activeSquadId)
      : undefined;
    this.treasury = identities.obtain(
      PersonnelIdentity.treasury,
      'player',
      () => new Treasury(Money.pesos(campaign.resources.treasury)),
    );
    this.roster = identities.obtain(
      PersonnelIdentity.roster,
      'player',
      () =>
        new ForceRoster(
          campaign.recruited.map(String),
          campaign.squad.map(String),
          campaign.location,
          MaximumSquadSize,
          activeSquad,
        ),
    );
  }

  restoreCharacter(
    definition: PersonnelDefinition,
    activeCondition?: { hp: number; maxHp: number; bleeding?: number; bandaged?: number } & Partial<
      Record<CharacterRatingName, number>
    >,
  ): Character {
    const id = String(definition.id);
    const record = this.#campaign.operativeState[id];
    if (!record) throw new Error(`Falta el estado del personaje ${id}.`);
    const contract = this.#campaign.contracts[id];
    const bleeding = activeCondition ? activeCondition.bleeding : record.bleeding;
    const bandaged = activeCondition ? activeCondition.bandaged : record.bandaged;
    const character = this.#identities.obtain(PersonnelIdentity.character, id, () =>
      Character.restore(
        {
          id,
          health: activeCondition?.hp ?? record.hp,
          maximumHealth: activeCondition?.maxHp ?? definition.maxHp,
          alive: activeCondition ? activeCondition.hp > 0 : record.alive,
          ...(bleeding === undefined ? {} : { bleeding }),
          ...(bandaged === undefined ? {} : { bandaged }),
          captured: Boolean(record.captured),
          locationId: record.location ?? record.residentSector ?? null,
          abilities: this.#abilities.read(definition, activeCondition).toSnapshot(),
        },
        contract
          ? ServiceContract.restore({
              characterId: id,
              term: contract.term,
              startedAtSeconds: contract.started * SecondsPerHour + (contract.startedSecond ?? 0),
              expiresAtSeconds:
                contract.expiresAt === null
                  ? null
                  : contract.expiresAt * SecondsPerHour + (contract.expiresSecond ?? 0),
              paidPesos: contract.paid,
            })
          : null,
      ),
    );
    this.#characters.set(id, character);
    if (!this.#originalCharacters.has(id))
      this.#originalCharacters.set(id, this.#characterState(character));
    return character;
  }

  character(id: string): Character {
    const character = this.#characters.get(id);
    if (!character) throw new Error(`El personaje ${id} no pertenece al contexto cargado.`);
    return character;
  }

  squad(id: string): Squad {
    const squad = this.#squads.get(id);
    if (!squad) throw new Error(`La escuadra ${id} no pertenece al contexto cargado.`);
    return squad;
  }

  apply(target: CampaignPersonnelSnapshot): void {
    const controlled = new Set(this.roster.members);
    const assigned = new Set<string>();
    for (const squad of this.#squads.values()) {
      for (const id of squad.memberIds) {
        if (!controlled.has(id)) squad.releaseMember(id);
        else if (assigned.has(id)) throw new Error(`El personaje ${id} pertenece a dos escuadras.`);
        else assigned.add(id);
      }
    }
    for (const record of target.squads ?? []) {
      const squad = this.#squads.get(record.id);
      if (!squad || JSON.stringify(squad.toSnapshot()) === this.#originalSquads.get(record.id))
        continue;
      for (const id of [...record.members.map(String), ...squad.memberIds]) {
        if (target.operativeState[id]) target.operativeState[id].location = squad.locationId;
      }
      record.members = squad.memberIds.map(Number);
      if (!record.members.length) delete record.journey;
    }
    target.resources.treasury = this.treasury.balance.pesos;
    target.recruited = this.roster.members.map(Number);
    target.squad = this.roster.squadMembers.map(Number);
    for (const [id, character] of this.#characters) {
      if (this.#characterState(character) === this.#originalCharacters.get(id)) continue;
      const snapshot = character.snapshot();
      const health = character.health.toSnapshot();
      const record = target.operativeState[id];
      if (!record) throw new Error(`Falta el estado del personaje ${id}.`);
      record.hp = snapshot.health;
      record.alive = snapshot.alive;
      record.bleeding = health.bleeding;
      record.bandaged = health.bandaged;
      record.captured = snapshot.captured;
      record.location = snapshot.locationId;
      const contract = character.service;
      if (contract) {
        const metadata = { ...target.contracts[id] };
        delete metadata.startedSecond;
        delete metadata.expiresSecond;
        delete metadata.departurePending;
        target.contracts[id] = {
          ...metadata,
          kind: contract.permanent ? 'patriot' : 'paid',
          term: contract.term,
          started: contract.startedAt.hour,
          ...(contract.startedAt.secondOfHour
            ? { startedSecond: contract.startedAt.secondOfHour }
            : {}),
          expiresAt: contract.expiresAt?.hour ?? null,
          ...(contract.expiresAt?.secondOfHour
            ? { expiresSecond: contract.expiresAt.secondOfHour }
            : {}),
          paid: contract.payment.pesos,
        };
      } else {
        delete target.contracts[id];
      }
    }
  }

  #characterState(character: Character): string {
    return JSON.stringify({
      character: character.snapshot(),
      service: character.service?.snapshot() ?? null,
    });
  }
}
