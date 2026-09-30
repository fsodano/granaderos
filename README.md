# Granaderos

**Raise an army. Keep it supplied. Lead it into battle.**

![Granaderos title artwork: mounted soldiers overlooking the Paraná and San Carlos convent at sunset](web/public/art/main-menu.webp)

Granaderos is a browser strategy and turn-based tactical game set during the Argentine War of Independence. Recruit a force, manage supplies and alliances, and command individual soldiers in battle. The game draws on **Jagged Alliance 2 v1.13** and adapts its systems to the weapons and conditions of the period.

The game interface is **Spanish**. Code and documentation are English.

**Playable and in development.** A complete campaign from a fresh start has not yet passed acceptance. Full JA2 parity, campaign balance, character animation coverage and performance across all scenes remain open. Read the [campaign acceptance record](docs/verification/gameplay-completion.md) and [JA2 parity audit](docs/verification/ja2-parity-audit.md) for the evidence and remaining work.

[Run locally](#run-locally) · [Gameplay](#gameplay) · [Development](#development) · [Documentation](docs/README.md)

## Run locally

Install **Node.js 22.13.0 or newer** and npm. Then run:

```sh
git clone https://github.com/fsodano/granaderos.git
cd granaderos
npm ci --prefix web
npm run dev
```

Open [localhost:3000](http://localhost:3000), or the address shown by the development server.

Choose **Nueva campaña** to start at Retiro. Hire a combatant or create your own character to begin. Hiring uses the quoted contract price; the current character-creation path is free. You can also choose **Combate de San Lorenzo** for a separate battle.

The game saves campaign progress in browser storage. Use **Guardar** to export a portable save file and **Importar partida** to load one.

The browser game uses JavaScript and React. It does not require the engine submodule or an original JA2 installation.

## Gameplay

The campaign connects strategic decisions to persistent tactical encounters. Soldiers retain their wounds and equipment. Deaths, prisoners and spent supplies affect later decisions.

| On the campaign map | On the battlefield |
| --- | --- |
| Hire combatants, form squads and pay contracts. | Explore sectors and enter turn-based combat on contact. |
| Control routes, move supplies and prepare production. | Manage action points, ammunition, reloads and weapon condition. |
| Train militia, repair equipment and treat wounded soldiers. | Use terrain, sight, smoke, posture and interrupts. |
| Negotiate alliances and defend captured sectors. | Fight with firearms, blades, cavalry and crew-served artillery. |

The campaign begins with Retiro under your control. Its chapters follow San Lorenzo, the northern campaign and Yatasto, El Plumerillo, and preparations for the Army of the Andes. Maps and events are historical interpretations adapted for play.

Use the in-game **Manual de campaña** for an introduction. See the [tactical controls](docs/gameplay/tactical/TACTICAL-HOTKEYS.md) for keyboard and mouse commands, and the [documentation index](docs/README.md) for system guides and verification records.

## Faces of the campaign

<table>
  <tr>
    <td align="center"><img src="web/public/art/portrait-0.webp" width="180" alt="Painted in-game portrait of Martín Miguel de Güemes"><br><strong>Martín Miguel de Güemes</strong></td>
    <td align="center"><img src="web/public/art/portrait-3.webp" width="180" alt="Painted in-game portrait of Juan Bautista Cabral"><br><strong>Juan Bautista Cabral</strong></td>
    <td align="center"><img src="web/public/art/portrait-1.webp" width="180" alt="Painted in-game portrait of Juana Azurduy"><br><strong>Juana Azurduy</strong></td>
  </tr>
</table>

Historical figures serve alongside fictional paid volunteers and a custom character. Their attributes, equipment and recruitment conditions differ.

The images above are **game artwork, not gameplay screenshots**. AI-generated paintings and portraits have retained prompts and source files. Likenesses and uniform details are artistic interpretations. See the [artwork documentation](assets/README.md) and [portrait references](assets/portrait-references.md) for provenance and limitations.

## Development

Run these commands from the repository root after installing the web dependencies:

```sh
npm test             # Rules and integration checks
npm run typecheck    # TypeScript validation
npm run build        # Build and validate the static export in dist/
```

See the [verification records](docs/verification/README.md) for known failures and tested scope. Automated checks and recorded route tests cover specific scenarios. Complete campaign acceptance also requires gameplay evidence.

| Path | Contents |
| --- | --- |
| [web/](web/) | Browser interface, browser workers and installed artwork |
| [game/](game/) | Tactical rules, campaign systems, maps and save validation |
| [assets/](assets/) | Artwork sources, prompts, references and exports |
| [tests/](tests/) | Rules and integration checks |
| [tools/](tools/) | Build, asset and verification tools |
| [docs/](docs/README.md) | Guides, design documents and verification records |
| `engine/`, `native/`, `patches/`, `mod/` | Upstream source and earlier native conversion work |

Read the [development guide](docs/development/getting-started.md) for setup, build outputs and verification guidance. The browser implementation is the primary game; the earlier native conversion has separate build and runtime requirements.

For contributions, identify the relevant acceptance criteria in the [parity audit](docs/verification/ja2-parity-audit.md) or [documentation index](docs/README.md). Submit a focused pull request with verification evidence. Keep generated assets reproducible from their source inputs and state which behavior was checked in the browser.

[VERSION](VERSION) records the development version. A 1.0.0 release requires the supplied specification to pass its completion audit.
