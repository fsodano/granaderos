# Deployment start time

At the handoff from the strategic campaign clock to a tactical sector visit, ordinary attacks and peaceful visits store the campaign hour and seconds in the deployment request. Joint assaults and sector defenses already carried these fields. Mission visits inherit the ordinary visit clock.

The browser passes the campaign clock when opening a battle. A caller that used the deployment request directly would otherwise default ordinary attacks to noon and night visits to midnight. The shared request gives direct simulation and the browser the same start time. The browser handoff prefers this captured time; a later caller clock cannot rebase an existing request. Resuming an automatic battle returns its exact saved snapshot.

Saved requests reject negative, fractional or null hours and seconds outside 0–3599. A saved battle must retain the start time recorded by its deployment. Tactical elapsed time continues to synchronize once through the existing time bridge. No obsolete-save migration is added.
