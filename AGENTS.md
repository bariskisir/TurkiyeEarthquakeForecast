# AGENTS.md

## Project

Türkiye Earthquake Forecast — an experimental Next.js dashboard that ranks regional
seismic activity across Türkiye and nearby areas. It merges a bundled Sismik Harita catalog
with daily UTC+3 append-only updates, computes M5+ through M7+ regional signals, and renders them on a
Leaflet map. Scores are **relative regional rankings, not occurrence probabilities**.

## Commands

- `npm run dev` — start the dev server at http://localhost:3000
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (`eslint-config-next`)
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — deterministic Vitest unit, integration, UI, and golden-regression tests

Always run `npm run lint`, `npm run typecheck`, and `npm test` after changes.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Bootstrap 5 + Sass/SCSS (`src/app/globals.scss` and `src/app/styles/`)
- Leaflet + react-leaflet (client-only, dynamically imported)
- Deployed on Vercel (serverless functions + CDN caching)

## Layout

- `src/app/page.tsx` — renders `Dashboard`
- `src/app/api/forecast/route.ts` — `GET /api/forecast`; Node runtime, `force-dynamic`,
  daily bundle cached in memory + tmp file with a lock; sets CDN cache TTL until next UTC+3 day
- `src/lib/catalog-domain.ts`, `catalog-service.ts`, `sismik-client.ts`, `catalog.ts` — pure catalogue rules, daily orchestration, provider client, and persistence adapter
- `src/lib/forecast-service.ts`, `forecast-cache.ts`, `forecast-bundle.ts` — daily forecast orchestration, memory/tmp/B2 cache, runtime validation
- `src/lib/forecast/` — modular ETAS forecast engine (config, geometry, numeric, catalog-prep,
  completeness, gutenberg-richter, declustering, etas-kernels, background-intensity,
  triggered-intensity, energy, seismicity-indicators, nowcasting, recurrence, scoring,
  selection, diagnostics, field-builder, types, index)
- `src/lib/types.ts` — `CatalogEarthquake`, `ForecastPoint`, `ForecastResponse`, `MagnitudeThreshold`
- `src/lib/i18n.ts` — `copy` object for `en`/`tr` locales
- `src/components/Dashboard.tsx`, `useDashboard.ts`, `dashboard-state.ts` — client composition, preferences/fetch hooks, and selection reducer
- `src/components/ForecastMap.tsx` — Leaflet map (`ssr: false`)
- `data/*.json` — bundled Sismik Harita shards (immutable source of truth)

## Data Flow

1. `getCatalog()` reads all `data/*.json` bundles plus tmp update shards, dedups by
   `eventKey`, and sorts newest-first.
2. Once per UTC+3 calendar day it fetches new or revised events from the Sismik Harita earthquake
   list API with a 48h overlap, splits stale ranges into at most 28-day windows, and appends
   a new tmp shard. Failures degrade gracefully.
3. `calculateForecasts(events, threshold, now)` bins events into 0.5° cells (lat 34–43,
    lon 24–46), declusters via Gardner-Knopoff, computes background μ(x,y) via Gaussian
    kernel smoothing and triggered λ_trig via full ETAS spatio-temporal kernels, derives
    per-cell seismicity indicators (b-value anomaly, energy rate, natural-time EPS, CV,
    rate-change z), blends them into a threshold-dependent composite hazard score, filters
    by observed maximum magnitude, selects candidates via greedy spatial de-duplication,
    and returns the top signals as `ForecastPoint`s. Default count is 50.
4. The API assembles `ForecastResponse` with metadata and cache/status info.

## Conventions

- Add an English file-level explanation to code files and detailed English JSDoc above named functions and components.
- Use the `@/` import alias for `src` (see `tsconfig.json`).
- Bundled `data/*.json` files are immutable; new/revised events go into tmp append shards.
- Keep code concise and match the existing dense functional style.
- All user-facing strings must be added to both `en` and `tr` in `src/lib/i18n.ts`.
- Times are handled and displayed in UTC.
- The disclaimer messaging (not a forecast/warning) must be preserved.
