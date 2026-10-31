'use client';

import type { CampaignOperativeState } from '../../../packages/game/public/campaign-types.ts';
import type {
  CampaignSnapshot,
  CampaignOperative,
  OfficerAttribute,
} from '../../../packages/game/public/campaign-types.ts';
import { sitePath } from '../lib/site-path.js';
import { weaponSpecification } from '../../../packages/game/weapon-definition.ts';
import TrainingProgress from './TrainingProgress';
import { portraitFor } from '../lib/portraits';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  ATTRIBUTE_LABELS,
  characterProfile,
  characterAbilityDescriptions,
} from '../../../packages/game/characters.js';
import { contractQuote } from '../../../packages/game/contracts.js';
import { serviceRelationships } from '../../../packages/game/service-relationships.js';
import PreferredCompanionsSummary from './PreferredCompanionsSummary';
import { serviceObjectionReason } from '../../../packages/game/service-objections.js';
import ServiceObjectionNotice from './ServiceObjectionNotice';
import { lowMoraleRenewalStatus } from '../../../packages/game/morale-renewal.js';
import ContractMoraleNotice from './ContractMoraleNotice';
import { campaignOfficerCreation } from '../../../packages/game/campaign-officer-creation.ts';
import CampaignWeaponSummary from './CampaignWeaponSummary';
export function DossierEquipment({
  operative: o,
  record,
}: {
  operative: CampaignOperative;
  record: CampaignOperativeState;
}) {
  const blade = weaponSpecification(o, 'blade');
  return (
    <div className="dossier-equipment">
      <div data-equipment-slot="primary">
        <CampaignWeaponSummary operative={o} record={record} showArt />
      </div>
      {blade && (
        <div key={blade.id} data-equipment-slot="blade">
          <img src={sitePath(blade.art)} alt={blade.name} />
          <span>{blade.name}</span>
        </div>
      )}
    </div>
  );
}

export default function CharacterDossier({
  operative: o,
  record,
  state,
  onClose,
}: {
  operative: CampaignOperative;
  record: CampaignOperativeState;
  state?: CampaignSnapshot;
  onClose: () => void;
}) {
  const creation = campaignOfficerCreation(state),
    classes = creation.classes,
    traits = creation.traits;
  const portrait = portraitFor(o.portrait ?? o.portraitId ?? o.id, state);
  const attributes: readonly OfficerAttribute[] = [
    'maxHp',
    'agility',
    'dexterity',
    'strength',
    'leadership',
    'wisdom',
    'marksmanship',
    'mechanical',
    'explosives',
    'medical',
  ];
  const profile = o ? characterProfile(o) : null;
  const quote = o
    ? contractQuote(
        state ?? { hour: 0, contracts: {}, operativeState: { [o.id]: record } },
        o,
        'day',
      )
    : null;
  const relationships = o ? serviceRelationships(state, o) : [];
  const moraleStatus = state && o ? lowMoraleRenewalStatus(state, o) : null;
  return (
    <Dialog open={Boolean(o)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="dossier-modal" showCloseButton={false}>
        {o && profile && (
          <>
            <p className="eyebrow">{profile.registry}</p>
            <div className="dossier-heading">
              {portrait ? (
                <img src={sitePath(portrait)} alt={o.name} />
              ) : (
                <div className="dossier-initials">
                  {(o.nickname ?? o.name).slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <DialogTitle>{o.name}</DialogTitle>
                <DialogDescription>{o.role}</DialogDescription>
                <p>
                  {quote?.permanent
                    ? 'Servicio permanente'
                    : `${quote?.daily ?? quote?.price} pesos por día`}
                </p>
                {o.classId && <p>Clase: {classes.find((c) => c.id === o.classId)?.name}</p>}
                <p>
                  Grado {o.level || 1} · {o.xp || 0} experiencia
                </p>
              </div>
            </div>
            <div className="dossier-stats">
              {attributes.map((key) => (
                <div key={key}>
                  <span>{ATTRIBUTE_LABELS[key]}</span>
                  <strong>
                    {key === 'maxHp' ? `${Math.round(record?.hp ?? o.maxHp)} / ${o.maxHp}` : o[key]}
                  </strong>
                  <meter
                    min="0"
                    max="100"
                    value={key === 'maxHp' ? (record?.hp ?? o.maxHp) : o[key]}
                    aria-label={ATTRIBUTE_LABELS[key]}
                  />
                </div>
              ))}
            </div>
            <p className="dossier-stat-note">
              Pólvora y artillería: manejo de municiones y servicio de las piezas de campaña.
            </p>
            <TrainingProgress
              unit={{
                ...o,
                ...(record.skillPractice ? { skillPractice: record.skillPractice } : {}),
                ...(record.trainedStats ? { trainedStats: record.trainedStats } : {}),
              }}
            />
            <h3>Especialidades</h3>
            <div className="dossier-skills">
              {profile.skills.map((skill: string) => (
                <span key={skill}>{traits.find((t) => t.id === skill)?.name || skill}</span>
              ))}
            </div>
            {characterAbilityDescriptions(o).map((ability: { id: string; description: string }) => (
              <p key={ability.id}>{ability.description}</p>
            ))}
            <h3>Equipo personal</h3>
            <DossierEquipment operative={o} record={record} />
            <h3>Hoja de servicio</h3>
            <p>{o.biography}</p>
            <h3>Carácter</h3>
            <p>{profile.personality}</p>
            {relationships.length > 0 && (
              <>
                <h3>Condiciones de servicio</h3>
                <ul>
                  {relationships.map((relationship) => (
                    <li key={relationship.character}>
                      No acepta contratarse ni renovar mientras {relationship.rivalName} siga en
                      servicio. {relationship.reason}
                    </li>
                  ))}
                </ul>
                <p>El rechazo no acorta los contratos ya pagados.</p>
              </>
            )}
            <ServiceObjectionNotice
              reason={serviceObjectionReason(state ?? { operativeState: {} }, o)}
            />
            <ContractMoraleNotice status={moraleStatus} />
            <PreferredCompanionsSummary {...(state ? { state } : {})} operative={o} details />
            <blockquote>«{profile.speech['hired']}»</blockquote>
            <small>Personalidad y diálogo dramatizados para el juego.</small>
            <button className="gold-button" onClick={onClose}>
              Cerrar hoja de servicio
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
