# Find your way through the repository

[Development guide](README.md) · [Architecture overview](../architecture/overview.md) · [Accepted architecture](../plans/accepted/domain-architecture.md)

Open the **Granaderos repository root** in your IDE. It contains two browser
applications, the game rules they share, campaign content, and development tools.
The directory groups tell you which responsibility owns a file.

```text
apps/
  web/                    Player application and browser adapters
  campaign-editor/        Independent campaign editor and its own domain model
packages/
  game/                   Game rules, use cases, adapters, and public APIs
  campaign-format/        Published campaign schemas and immutable definitions
content/
  campaigns/              Campaign packages, media, and trusted scenario code
  assets/                 Art sources, prompts, rigs, previews, and production recipes
docs/
  architecture/           System explanations and C4 diagrams
  plans/accepted/         Accepted architecture and ubiquitous language
  evidence/               Retained measurements, images, and reports
tests/                    Game integration tests and fixtures
tools/
  playgrounds/            Independent visual review applications
reference/
  native/                 Separate Windows engine and conversion build
.output/                  Local builds, caches, and new diagnostic output
```

## Choose a starting point

| Work | Open first | Follow next |
| --- | --- | --- |
| Understand the whole game | [Progressive overview](../architecture/overview.md) | [C4 views](../architecture/c4.md), then [runtime flows](../architecture/runtime-flows.md) |
| Change a game rule | [`packages/game/domain`](../../packages/game/domain/) | Its use case in [`application`](../../packages/game/application/) and adapter in [`infrastructure`](../../packages/game/infrastructure/) |
| Trace a player command | [`apps/web/app/page.tsx`](../../apps/web/app/page.tsx) | A public API or compatibility dispatcher, then the named use case |
| Change the player interface | [`apps/web/app`](../../apps/web/app/) | Browser adapters in [`apps/web/lib`](../../apps/web/lib/) |
| Change the campaign editor | [`apps/campaign-editor`](../../apps/campaign-editor/README.md) | Its domain, application, infrastructure, and web directories |
| Change a published file contract | [`packages/campaign-format`](../../packages/campaign-format/README.md) | Shared schema tests and the public game validation adapter |
| Edit a campaign or its media | [`content/campaigns`](../../content/campaigns/) | [Campaign authoring guide](campaign-authoring.md) |
| Produce art or review a character | [`content/assets`](../../content/assets/README.md) | [`tools/playgrounds/granadero-3d`](../../tools/playgrounds/granadero-3d/README.md) and art production tools |
| Build or test the game | [Development setup](getting-started.md) | Root [`package.json`](../../package.json) and [`tools`](../../tools/) |
| Work on the native conversion | [Native build guide](../reference/native-build.md) | [`reference/native`](../../reference/native/) |

## Follow one intention through the code

For recruitment, read these files in order:

1. [`RecruitCombatantUseCase`](../../packages/game/application/personnel/recruit-combatant/recruit-combatant.use-case.ts) defines the application operation.
2. [`RecruitmentService`](../../packages/game/domain/personnel/recruitment-service.ts) coordinates the character, service terms, money, force membership, and placement.
3. [`CampaignRecruitCombatantRepository`](../../packages/game/infrastructure/personnel/campaign-recruit-combatant.repository.js) restores the required objects and projects accepted changes through the shared transaction.
4. [`GameSnapshotMapper`](../../packages/game/infrastructure/persistence/game-snapshot-mapper.js) restores domain behavior and shared identities for saved progress.

The same reading order applies to journeys, sector visits, combat, inventory,
and world lifecycles. Begin with the intention. Follow its repository contract
and domain collaborators. The [source map](../architecture/system-map.md) lists
more entry points.

The game package also retains root modules such as `campaign.js`, `tactical.js`,
`world.js`, and `save.js`. They connect migrated use cases to existing simulation
rules and supported save formats. Domain objects own the migrated invariants;
the remaining modules are still part of the running game.

## Keep source, served media, and generated output distinct

`content/assets` contains reproducible art inputs. These include source paintings,
model and animation recipes, rigs, prompts, and review material. Art tools read
these files to produce prepared browser media. Keep them with the project.

The browser serves shared prepared media from `apps/web/public` and packaged
media from `content/campaigns/<id>/assets`. A campaign manifest still uses paths
relative to its package. Browser URLs remain `/campaigns/`, `/campaign-editor/`,
`/art/`, and `/models/`, subject to the configured deployment prefix. They are
not filesystem paths.

The root production build stages the game and editor in `.output/dist`.
`.output/build`, `.output/cache`, and `.output/artifacts` hold local generated
material. Retained verification records belong in `docs/evidence`; the
[`artifacts`](../evidence/artifacts/) subdirectory contains tracked reports from
previous work. Check a record's date and source before using it as current proof.

The native engine under `reference/native/engine` is a pinned Git submodule.
Its `overlay`, `mod`, and `patches` siblings form a separate native conversion
with its own build scripts. The browser build does not compile or package that
engine. The 3D playground reads the game's palette module and prepared character
models; the game does not import the playground.

Hidden tool and IDE configuration, such as `.github`, `.idea`, and `.openai`, has
its own purpose. Keep configuration distinct from generated output. A hidden
folder is not evidence that its contents can be deleted.

## Keep the IDE project view focused

The current local WebStorm project excludes generated output, installed
dependencies, tool metadata, and the pinned native engine from its normal source
view. The Project tool window has **Show Excluded Files** turned off. The visible
source groups are `apps`, `content`, `docs`, `packages`, `reference`, `tests`, and
`tools`, alongside required repository configuration such as `.github` and
`.openai`.

To reproduce this setup in another checkout:

1. Open the repository root as the WebStorm project.
2. Mark `.output`, `.idea`, `.omo`, dependency directories, application build
   directories, and `reference/native/engine` as excluded in the IDE.
3. Turn off **Show Excluded Files** in the Project tool window options.

These exclusions change indexing and the project view. They do not remove files
or change build inputs. Keep `content/assets` and the native overlay, mod, and
patch sources available. The local `.idea` configuration is ignored by Git;
other checkouts can apply the same settings without sharing IDE state.

## Place new work

Use the existing application or package that owns the behavior. Keep game
`domain`, `application`, and `infrastructure` inside `packages/game`. Keep editor
behavior inside `apps/campaign-editor`. Put shared published file contracts in
`packages/campaign-format`.

Add plans under `docs/plans`, retained evidence under `docs/evidence`, and new
local outputs under `.output`. Update the relevant index and use-case README.
Read [AGENTS.md](../../AGENTS.md), the accepted plan, and the glossary before
changing architecture or domain terms.
