# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository boundary

This repo is an **independent git clone** nested inside the `alpha-workbench` repo (which ignores it). Run all git commands from this directory; never commit it from the root repo. The sibling `../backend` (Python backtest service) belongs to the workbench repo — but the `scripts/gen-*` generators here write into `../backend/tests/fixtures/`, so a frontend change can dirty the sibling repo's tree.

Open-source boundary: the Tauri desktop shell, AI Agent, and other closed modules live in a private repo. There is **no `src-tauri/` here** (only the `src/lib/tauri.ts` bridge). Closed code integrates via the `@modules` alias — `vite.config.ts` resolves it to `./modules/index.ts` if that private checkout exists, else `src/modules-stub/index.ts` (`closedModules = {}`). CI asserts the build succeeds with the stub; don't break the stub path.

## Commands

pnpm + Node (CI pins pnpm 10 / Node 22, installs with `--frozen-lockfile`). `pnpm-workspace.yaml` is not a workspace — it only allowlists esbuild's build script.

```bash
pnpm install
pnpm dev                  # Vite on 5173; proxies /api → dev sidecar 127.0.0.1:21322
VITE_API_TARGET=http://127.0.0.1:8080 pnpm dev   # target a user-run `shioaji server` instead
pnpm build                # tsc -b && vite build — this IS the typecheck; no lint/format tooling exists
pnpm test                 # node --import tsx --test <three explicitly listed files>
node --import tsx --test src/lib/backtest.test.ts                                      # one file
node --import tsx --test --test-name-pattern "fmtWallClock" src/lib/backtest.test.ts   # one test
./scripts/dev-api.sh      # run the bundled sidecar binary (gitignored under src-tauri/binaries/) on 21322
cd ../backend && uv run python -m backtest       # backtest service on 8787 (sibling repo)
```

- Tests use Node's built-in runner via tsx (no vitest/jest). The `test` script is an **explicit file list** — a new `*.test.ts` runs nowhere until appended to it in `package.json`. Tests are plain Node (no DOM/React rendering); mock `globalThis.fetch` by assignment and use exported DI seams (e.g. `__resetContractsCacheForTest`) instead of module mocking.
- CI (`.github/workflows/web-build.yml`): `pnpm test` → `pnpm build` → assert the modules stub was used.
- Credentials go in `.env` (`SJ_API_KEY`/`SJ_SEC_KEY`, see `.env.example`) — gitignored, never commit.
- `SHIOAJI_VERSION` (repo root) pins the bundled sidecar version: baked in as `__SHIOAJI_SERVER_VERSION__` for the boot-time version handshake, enforced by `dev-api.sh`, and used by CI to download the matching binary.

## Architecture

React 19 + TypeScript (strict **+ `noUncheckedIndexedAccess`**) + Vite 8. No router, no context providers, no state library. Aliases: `@/*` → `src/*`, `@modules` → stub-or-private (above).

### Hub and panels

`src/App.tsx` (~850 lines) is the hub — grid layout, symbol selection, trading-data polling, popouts, and the `BlockBody` switch that dispatches panel types. The panel/layout data model is `src/lib/workspace.ts`: `BlockType` union + `BLOCK_META` (label, pinnable, singleton, defaultSize), persisted to localStorage with named profiles. **To add a panel**: extend `BlockType` + `BLOCK_META` in `workspace.ts`, add a `case` in `BlockBody`; drag works only via elements carrying the `.drag-handle` class (PanelChrome's title bar). A block's `pin` is `null` (follows global selection) or a fixed contract code. Popouts are separate windows via `?popout=<type>` query.

### State patterns (in order of preference)

1. Lifted state in `App.tsx` passed as props.
2. The house pattern for cross-cutting state: **module-level store + `useSyncExternalStore`** (`lib/stream.ts`, `theme-store.ts`, `features.ts`, `contracts-cache.ts`, `account-store.ts`, …), exposed via hooks co-located in the store module or in `src/hooks/`.
3. Polling via `usePoll(fetcher, ms)` for non-streamed data (positions, balance, server status).

### Data layer (three ports)

- **21322** — the app's shioaji sidecar (`DEFAULT_PORT`, 0x534A = "SJ"); **8080** — a user-installed `shioaji server` CLI, probe/attach candidate only; **8787** — the sibling backtest service.
- REST: `lib/api.ts` → typed endpoints in `lib/shioaji.ts`. Base URL from `lib/runtime.ts` `getApiBase()`, resolved **per request, never captured at module load** (the port can move at runtime; capturing it caused a boot-hang bug). In Tauri, requests route through `@tauri-apps/plugin-http` because the shioaji server 405s CORS preflight; the backtest client (`lib/backtest.ts`) uses plain `fetch` because that service answers preflight.
- Streaming: **one combined SSE connection** (`lib/stream.ts`, `GET /api/v1/stream/data`) feeding a module-level quote map. Subscriptions are mirrored in a registry and replayed on reconnect; a 60s health poll watches `last_maintenance` to catch the server's ~08:22 silent upstream drop. `flashSeq` bumps only on real trades — simtrade (試撮) must never flash.
- `contracts-cache.ts`: `ensureContract()` resolves metadata **and subscribes quote streams** (quota-limited per session); `resolveContract()` is metadata-only — the backtest/offline path. Don't mix them up.
- Sidecar lifecycle (desktop): `lib/tauri.ts` spawns `server start` as a never-exiting foreground child (never await `execute()`); attach/reuse requires health + sim-prod mode + exact `SHIOAJI_VERSION` match + active CA when production trading is requested. External servers are never killed automatically.
- Order gotchas in `lib/shioaji.ts`: continuous-month aliases (`TXFR1`) are data-only — orders must use `target_code`; `place_order` can return HTTP 200 with `status: "Failed"` (`ensureAccepted` throws on it).

### Backtest panel and cross-repo parity

The frontend runs no backtests — `components/backtest-panel.tsx` is a thin client over the sibling service, via adapters in `lib/backtest.ts` whose wire types mirror `backend/src/backtest/api/schemas.py` 1:1. Run-level failures arrive as **HTTP 200 with `status: "error"`** and resolve (never throw); non-2xx is transport/validation only. `lib/backtest-gate.ts`: with the closed module present the panel is VIP-gated; in open builds the open panel renders **ungated** — never the desktop-only lock.

The backend pins parity against this repo's source:

- `src/lib/indicators.ts` (21 indicators, math only — rendering/registry is `indicator-defs.ts`) must match `backend/core/ta` within 1e-9. Exact numeric forms matter (e.g. `rma`'s recursion form is pinned by `*_flat` fixtures).
- `src/lib/utils/contract-cost.ts` mirrors the backend cost model.
- Editing either is a **cross-repo semantic change**: backend golden tests break until fixtures are intentionally regenerated (`pnpm exec tsx scripts/gen-ta-fixtures.ts`, `gen-cost-fixtures.ts`; e2e goldens via `cd ../backend && uv run python ../shioaji-pro-app/scripts/gen-e2e-goldens.py`). Regeneration is an explicit, diff-reviewed human act tied to a ticket — never regenerate to make a test pass.

### Time convention (bites everyone)

All kbar/backtest wire times are Taiwan wall clock encoded **as-if-UTC** unix seconds (`wallClockToUtc` in `src/lib/utils/kbars.ts`), bit-identical to the backend's `WallTime`. Never add/subtract a timezone offset (the classic bug is ±28,800s); adapters pass times through untouched; display formatting must use **UTC getters** (`fmtWallClock`), never local-time getters.

### Theming and UI conventions

- vanilla-extract, zero-runtime: components pair `foo.tsx` + `foo.css.ts` (import as `./foo.css`); tokens in `src/theme.css.ts`. 3 modes × 2 price-color conventions (tw: red=up / intl: green=up) = 6 root classes — always use semantic `vars.color.up/down`. All sizes rem-based (user fontScale scales the root). Canvas charts can't read CSS vars — use `getChartColors()`.
- All UI strings are zh-TW.
- Feature gating is homegrown (`lib/features.ts`, not raw Statsig): add a `FeatureDef` to `FEATURES` and wrap the UI in `<FeatureGate feature="key">`.
- `src/main.tsx`: `import './lib/polyfills'` must stay the first import.

### Build constraints (deliberate — don't "fix")

- `build.target: ['es2020', 'safari13']` and the hand-written ES5 boot-error script in `index.html` exist for old Intel-Mac WKWebViews (white-screen issue #4). Don't raise them.
- `assetsDir: ''` (flat bundle) because the shioaji custom-app upload flattens nested paths.
