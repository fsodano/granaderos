# GetRecruitmentCandidates

Read the recruitment catalogue by name, nickname, role, specialty, availability,
and order. The repository exposes only `loadCatalogue`; it has no commit method.
`RecruitmentCandidate` applies text and specialty rules. `RecruitmentCatalogue`
filters and orders the result. The response contains canonical character IDs.
Each candidate references its restored `CharacterAbilities` value. Rating
thresholds and trait membership use that value; the catalogue does not maintain
another skill or trait record. The roster and canonical character mapper apply
the same earned-training projection.

Available candidates pass the same personal eligibility and service-quote checks
as recruitment, including relationship refusals and outstanding equipment-return
obligations. The final request also checks payment and the chosen recruitment
site. Fallen, captured, serving, prepaid, and unavailable candidates remain
inspectable through their corresponding catalogue states.

Queries preserve the campaign clock, funds, service, and revision. The result is
public recruitment information. A quote can change before a recruitment request;
`RecruitCombatant` checks the current terms again in its transaction.
