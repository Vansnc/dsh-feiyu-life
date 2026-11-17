# src/life/life.js dependency inventory (phase 4)

Read-only audit of the current `src/life/life.js` (829 lines). This is the migration map, not a claim that every boundary is already safe to move.

## Imports

```text
src/life/life.js
├── plan.js        dayType, dailyPlan, readPlan, normalizeRoutine, normalizeWardrobe, timelineCoverage
├── state.js       readFacts, buildTimeline, segmentAt, recentSegments
├── world.js       addWorldToTimeline, buildReplayFrames, defaultWorldConfig, normalizeWorldConfig, worldStateAt
├── moments.js     ensureMoments, momentContext
├── storage.js     atomicWriteJson, quarantine, readJsonBounded, withLock
├── sharing.js     defaultSharingConfig, normalizeSharingConfig
└── src/life/time.js  time/calendar/body/sleep helpers
```

`src/life/time.js` imports `readPlan` and `normalizeRoutine` from `plan.js`; it does not import plugin/UI/media. `src/life/context.js` imports nothing and is a pure view builder.

## Function groups and callers

### Config schema / migration / normalization / persistence

| Function | Responsibility | External callers |
|---|---|---|
| `defaultConfig` | defaults / schema | tests, `normalizeConfig`, `migrateConfig` |
| `normalizeConfig` | bounded normalization + validation issues | tests, `readConfig`, `saveConfig`, `replaceConfig` |
| `validateConfig` | external save validation | `index.js`, `plan.js`, `backup.js`, tests |
| `migrateConfig` | version upgrade | `readConfig`, `backup.js`, tests |
| `configPath` / `CONFIG_PATH` | file location | `index.js`, `client.js`, `src/media/image.js`, tests |
| `readConfig` | bounded read, migrate, cache, quarantine | `index.js`, `src/plugin/initiative.js`, tests |
| `saveConfig` / `replaceConfig` | atomic write + merge/replace | `index.js`, `src/plugin/routes/backup.js`, tests |
| `writeConfigFile` | atomic persistence helper | internal only |

Risk: config normalization, migration, save and generation share defaults/helpers. Moving reads/writes before a full contract layer would change migration behavior. Phase 4 therefore **does not move config**.

### Time / calendar / body / sleep

Moved to `src/life/time.js` in phase 1:

- `zonedNow`, `zonedDateTimeMs`, `zonedDayStartMs`, `addZonedDays`
- `todayCalendar`, `todayDeviation`, `menstrualDay`, `coldEpisode`
- `lastNightSleep`, `spokenClock`, `minuteLabel`, `pad2`, `hashSeed`, `rng`, `dayDiff`, `shiftDay`, `inRange`

Callers: `src/life/life.js` generate/config validation, tests. Dependency direction is one-way (`life -> time -> plan`).

### Generation / timeline

| Function | Responsibility | Callers |
|---|---|---|
| `generate` | build current timeline/context from cfg + clock + state | `index.js`, `src/plugin/initiative.js`, `src/media/life-snapshot.js`, tests |
| `replyReadiness` | phone/activity/reply coherence | tests, generation internals |
| `vitalityFor` | energy from sleep/body/activity | tests, generation internals |
| `placeCategory` | location category | `index.js`, `src/plugin/initiative.js` |
| `segmentTexture` | deterministic texture pools | generation internals |
| `nearestSegment`, `weekdayName`, `calendarEvidence` | timeline/context helpers | generation internals |

`generate` still owns the read-only life view. It is not safe to split its timeline loop until context/view contracts cover every field (see `src/life/context.js`).

### Context/view

- `generate().text` is the prompt-facing context; its text contract is consumed by `index.js`.
- `src/life/context.js` is the new narrow, read-only snapshot for cross-domain consumers:
  - current what/phone/outfit/location/behavior/time range
  - world location/destination/moving
  - vitality/body/mood/needs
  - bounded relationships, concerns, memories (sensitive filtered)
  - focus
- It accepts already-computed views and owns no state; media uses it through `src/media/life-snapshot.js`.
- `mediaLifeSnapshot()` returns `{ state, zoned }` only; it does not expose full config or the raw life object.

### Config data ownership

`src/life/life.js` remains the sole owner of config read/write in this phase. `src/life/config.js` was intentionally not created: doing so now would require copying defaults or moving interleaved migration/normalization code, creating a duplicate source of truth. The contract tests lock defaults, versions, migration, issue reporting, paths and atomic read/save/replace before any later move.

## Next safe migration order

1. Extract pure config schema/validation functions only, with `defaultConfig` as the single imported source.
2. Extract `generate` context/view only after `src/life/context.js` covers all consumers.
3. Keep read/write in `src/life/life.js` until injected path/storage interfaces and migration parity are tested.
