# Authored mission interface

The desk overview and Tucumán strategic orders show the Yatasto briefing after
phase two begins. Entry requires the active squad at patriotic Tucumán and no
pending tactical scene. The entry dispatch is `visitMission` with mission
`yatasto`; backend eligibility remains authoritative.

Battlefield receives `missionStatus` through the page adapter. Its objective
panel displays the persistent reports, assessment and frontier decisions, and
allows `onMissionFinish` only when all objectives are done. Mission-marked NPCs
show a dedicated conversation action, using the existing adjacency checks and
approach `mission`. Ordinary exit preserves an unfinished scene through the
campaign scene lifecycle; explicit conclusion uses `finishMission`.

San Lorenzo's mission ally is shown in a separate temporary-officer panel and
excluded from the hired squad strip and its number-key slots. The commander
remains an allied unit for visibility, movement selection and battlefield rules.
This presentation does not add a contract or recruit the historical commander.

Source verification: web TypeScript check passes. Backend scene completion,
conversation conditions and ally persistence are owned by the campaign mission
implementation and its tests. Browser completion is not claimed here.
