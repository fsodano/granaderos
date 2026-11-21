# ValidateCampaignProject

This read-only use case inspects an editable campaign project for publication
validity and reports located structural and playability issues without modifying
project state or advancing game time.

`ValidateCampaignProjectRepository`
loads one project revision. `CampaignProjectValidator` checks published file
contracts, references, resources, and game playability.

The result contains validity, located issues, and the inspected revision.
The use case does not commit state or advance game time. An incomplete project
remains editable and saveable. Archive export requires a valid result.
