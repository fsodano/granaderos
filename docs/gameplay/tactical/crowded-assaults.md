# Crowded assault entrances

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

An assault now checks the actual tactical arrival layout before the campaign commits its request. If the entrance cannot fit the force or its guns, the order returns the existing entry error and retains the previous campaign state. Ready squads stay staged; resources, cannon stock, personnel and the clock remain unchanged.

The player can save that staging state, withdraw one squad through normal travel controls, and start a smaller assault. The remaining force enters through its actual edge. A purchased cannon stays in reserve after rejection and is issued only when entry succeeds. No interior positions or extra boundary cells are granted.

## Verification

Twenty coordinated-assault and arrival checks pass. The crowded mountain regression covers twelve staged soldiers, a purchased cannon, complete rejection-state equality, saved continuation, withdrawal and six-person entry. Thirty-nine related deployment, travel and campaign medical checks pass. Type checking, the production build and diff checks pass; all 49 unrelated preservation files match.

This change prevents a committed assault that cannot open. It does not implement deployment in waves, later arrivals during a battle, or the complete campaign. The separate uncommitted artillery-posture correction still requires a viable Uspallata route and full integration validation.
