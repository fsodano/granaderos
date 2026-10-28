# EditCampaignProject

Edit an existing project at an expected revision. The request selects one domain
operation: rename the project, replace its content, replace its draft, or remove
a resource.

`EditCampaignProjectRepository` loads a `CampaignProject` and its revision. The
use case rejects a stale request before mutation. The domain object validates
the edit and preserves project identity. The repository checks the revision again
at commit and advances it once. A refusal leaves the accepted project unchanged.

The response contains the accepted project snapshot and its new revision.
Authored content can be incomplete. Publication validation is a separate read.

The campaign studio uses this contract for live draft changes and renames. Its
in-memory editing repository commits synchronously, so the next input receives
the accepted revision. Browser persistence runs after admission. Undo and redo
have separate narrow repositories over the same history. Opening or closing a
project advances the editing session revision and invalidates old callbacks.

Expected project, identity and revision refusals throw `CampaignEditorRefusal`
with a stable code and structured details. Editor UI adapters translate these
codes into Spanish. The domain does not own translated messages. Structural
schema diagnostics remain explicit validation reports.
