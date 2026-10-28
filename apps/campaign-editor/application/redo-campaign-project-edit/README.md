# RedoCampaignProjectEdit

The editor restores the next edit in the project history. The request identifies the open project and its expected revision. The repository owns the complete project history and rejects a stale request before changing it. An available history step produces one new revision; an empty history leaves the revision unchanged. Identity changes and resource bytes follow the restored project snapshot together.

The campaign studio toolbar and keyboard shortcut use this application contract. Browser storage persists the resulting project separately. The use case has no browser dependency.
