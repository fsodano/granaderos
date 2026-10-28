# TalkToCharacter

Resolve a controlled participant's conversation with a resident in the active
sector session. The request identifies the resident, speaker, approach, service
term, and any selected dialogue or quest outcome.

The use case resolves the conversation, projects admitted participant changes,
and publishes the campaign and sector session together. The repository refuses
a stale source revision. It publishes no result if a rule or participant
projection fails. The campaign command owns the single revision increment.

Recruitment preserves the resident's location, level, facing, and posture. The
resident reference is removed and one controlled participant is admitted with
the authorized persistent character record. Quest escort, withdrawal, and
dialogue movement use the same projection for live play and editor playtests.

The compatibility repository maps `characterId` to `npcId`, `speakerId` to
`unitId`, and the canonical recruitment quest choice to the saved `civic` value.
These mappings are external representation details.

Expected retained conversation rules use the infrastructure `CampaignRuleRefusal`
adapter with `ConversationUnavailable`. The live and editor UI translate it
through the same message adapter.
