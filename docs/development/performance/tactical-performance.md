# Night movement and exploration controls

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

The floating exploration pause notice has been removed. Exploration still advances between orders and stops for conversations, inventory, loot and sector-exit panels, during movement, and when the browser tab is hidden.

Walking sprites use fractional map positions. Night lighting passed those positions to an integer line-of-sight trace. When a sprite entered a lamp's radius, the trace could never reach its fractional endpoint and appended points until the browser exhausted memory. The trace now rounds both endpoints to map cells. Light attenuation still uses the smooth visual position, and intervening walls still block illumination.

The tactical screen now retains visibility, exit previews, building scenery and ground illumination while the battle state is unchanged. It computes the selected soldier's sight overlay only when that overlay is enabled. Animation and pointer updates do not need to repeat these state calculations. These changes reduce repeated work; they are not a complete performance audit of large maps.

`tests/torch-motion-render.test.mjs` renders 40 walking frames near a night light in a child process limited to 128 MB, with a 15-second timeout. It checks fractional sight lines in all directions, wall occlusion and the absence of the removed pause control. A separate process is necessary because an infinite synchronous loop cannot be interrupted by an in-process test timeout.

Live verification: a fresh hired-only campaign entered Retiro at night, threw one torch, and walked beside it without a crash. The soldier used energy and no movement AP. The new-campaign confirmation also opened the empty Retiro campaign successfully.

Preview note: the temporary full-game preview on port 3021 initially omitted the Tailwind PostCSS processor. This left the confirmation popup outside its intended position and prevented the start click from reaching it. Its preview configuration now uses the same processor as `web/vite.config.ts`. The production configuration already included it. Future full-game previews must use the normal web development server or retain that CSS configuration.
