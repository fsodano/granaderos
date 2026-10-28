# GetSaveStatus

`GetSaveStatusUseCase` reads storage progress through `GetSaveStatusRepository`.
It reports the latest accepted identity, the last persisted identity, and one
state: unsaved, saving, saved, blocked, or failed. A blocked or failed save has a
readable reason. The query changes neither campaign time nor game state.

Accepted progress and persisted progress can differ. The browser retains the
accepted game and manual export when automatic storage fails.

The game header displays this status beside the save-file export button. It only
shows a saved result for the current game identity and revision. A pending write,
storage refusal, or storage failure remains visible until the current progress
has been saved.
