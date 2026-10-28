# ValidateCampaignProject

Inspect a campaign project for publication. `ValidateCampaignProjectRepository`
loads one project revision. `CampaignProjectValidator` checks published file
contracts, references, resources, and game playability.

The result contains validity, located issues, and the inspected revision.
The use case does not commit state or advance game time. An incomplete project
remains editable and saveable. Archive export requires a valid result.
