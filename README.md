# Project AFK

Browser AFK / idle RPG. Your party fights on its own, clears endless stages, levels up,
and earns rewards even while you're away.

**Stack:** TypeScript + React + Vite · Zustand · Canvas 2D · Vitest · localStorage only.

## Scripts

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run test     # unit tests (Vitest)
npm run build    # type-check + production build
npm run preview  # serve the production build
```

## Milestone 2 (party, recruiting, equipment)

- **Party of up to 4** with front / back lines. A larger bench of recruited heroes; field
  and bench them from the Party tab; combat placement follows the line you pick.
- **Recruiting via fragments**: enemies drop hero fragments; fill the bar and the class
  (priest, then rogue) is recruited automatically and joins the fight.
- **Priest** has a party-wide heal-over-time passive so the healer pulls its weight before
  real skills arrive.
- **Equipment**: 3 slots (weapon / armor / accessory), 4 rarities, 1–3 random affixes.
  Items drop on stage clears (guaranteed + rarer on bosses). Inventory tab to equip / sell;
  a character sheet with the full derived stat block and a per-item stat-delta preview.
- Save schema is **v2**; old v1 saves migrate automatically on load.

## What works right now (Milestone 1)

- Real-time 2D side-view auto-battler on a canvas: a warrior (melee) and a mage (ranged
  projectiles) vs procedurally generated waves. Procedural vector sprites with attack swings,
  hit flashes, walk cycles and death topples; parallax dusk battlefield; particle hits,
  chip-damage HP bars, screen shake, glowing spells, a boss health bar.
- Stage progression: clear all waves → next stage; party wipe → retry the same stage
  (attempt counter feeds the combat seed). Boss (ogre) every 10th stage.
- Character XP and level-ups with per-class stat growth.
- **Rewards come only from defeating enemies.** Every enemy drops gold + XP (scaled by
  stage); there is no passive trickle and no stage-clear bonus. Lifetime kills are tracked.
- Save to `localStorage` (throttled + on tab hide / unload) with schema versioning.
- Offline progress: the game measures the party's kill rate on its best stage by running it
  headlessly, then credits gold/XP for time away (capped at 12h) with a summary modal.
- i18n from the start — Spanish / English, switchable in the header.
- Deterministic simulation (seeded RNG) so combat is reproducible and unit-tested; all the
  animation is render-only on top of that.

## Architecture

The simulation is fully decoupled from React.

| Path | Responsibility |
|------|----------------|
| `src/game/core/` | `types`, seeded `rng`, fixed-timestep `loop`, pure `simulation`, `formulas` |
| `src/game/content/` | data: `classes`, `enemies` (incl. gold/xp bounties), procedural `stages` |
| `src/game/systems/` | `progression` (XP/level-ups), `afk` (headless farm-rate estimate + offline maths) |
| `src/game/state/` | Zustand `store`, `persistence`, `battleController` (loop ⇄ sim ⇄ store glue) |
| `src/ui/` | `CombatCanvas` (own draw rAF), `PartyPanel`, header, offline modal |
| `src/ui/combat/` | the 2D renderer: `palette`, `background`, `sprites`, `effects`, `scene` |
| `src/i18n/` | tiny `t()` + `useT()` over flat JSON locale tables |

The renderer never mutates the sim. `CombatScene` keeps its own animation state (eased
positions, attack/hit timers, particles, death anims, shake) derived each frame from the
read-only `CombatState` snapshot plus wall-clock time.

`battleController` is a singleton: it owns the current `CombatState`, steps it via the
`GameLoop`, and on a terminal outcome reports to the store (rewards, stage advance/retry)
before starting the next battle with refreshed roster stats and a new seed.

## Roadmap (not yet implemented)

- **M3** — Skills: per-class active/passive skills, unlocked by level, cast by the sim on
  cooldown/target rules (heal, AoE, taunt, DoT, shield, buff…); combat log.
- **M4** — Meta skill tree: tree currency, prerequisite nodes with ranks, aggregated
  `MetaBonuses` feeding formulas & stat derivation (+% XP / gold / AFK cap / party stats…),
  respec.
- **M5** — Polish & balance: prestige hook, save export/import, number formatting, settings,
  audio, balance pass.
