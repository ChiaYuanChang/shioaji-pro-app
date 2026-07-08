// scripts/gen-ta-fixtures.ts — BT-TA-004 golden fixture generator.
//
// Calls every REAL indicator export from src/lib/indicators.ts (never
// re-implemented) over one seeded synthetic OHLCV series and writes one
// JSON fixture per indicator to ../backend/tests/fixtures/ta/golden/
// in the sibling Alpha Workbench backend repo. Fixtures are generated once,
// regenerated only when src/lib/indicators.ts changes intentionally, and
// diff-reviewed.
//
// Run from this repo root:  pnpm exec tsx scripts/gen-ta-fixtures.ts
//
// Determinism: the input series comes from mulberry32 with a fixed SEED
// (recorded in every fixture); re-running yields byte-identical files.
//
// Fixture shape (BT-TA-004):
//   { indicator, export, seed, input: {time[], open[], high[], low[],
//     close[], volume[]}, cases: [{params, lines: {name: [{time, value}]}}] }
//
// The input series is embedded so the Python parity test reads it and
// never re-derives it. TS points whose value is `undefined` (whitespace
// gaps, e.g. supertrend's inactive side) are dropped — "no fixture point
// at this bar" is exactly the contract Python must answer with `None`.
//
// Param cases: TS defaults ({} — the Python side must reproduce them from
// its own defaults) plus one non-default set per parameterized export.
// `sma`/`ema`/`wma` take a required period (no TS default), so their first
// case pins the chart-conventional period 20 explicitly. `vwap`/`obv` are
// parameterless: a single case each.
//
// Flat-plateau addendum (`*_flat` fixtures): a second seeded input whose
// long run of identical OHLC bars pins the indicators.ts `rma` recursion
// form `(prev * (period - 1) + v) / period` bit-for-bit — the algebraically
// equal `prev + alpha * (v - prev)` form rounds differently, and stochRsi's
// zero-range normalization amplifies the last-ulp RSI difference to tens of
// K points on the plateau. Covers rsi / stochRsi / dmi.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { IndicatorPoint } from '../src/lib/indicators';
import {
    atr,
    bias,
    bollinger,
    cci,
    dmi,
    donchian,
    ema,
    keltner,
    macd,
    mfi,
    obv,
    roc,
    rsi,
    sar,
    sma,
    stoch,
    stochRsi,
    supertrend,
    vwap,
    willr,
    wma,
} from '../src/lib/indicators';
import type { Candle } from '../src/lib/types/market';

// ---------------------------------------------------------------------------
// Seeded synthetic OHLCV input (~500 bars, TXF-like ranges)
// ---------------------------------------------------------------------------

const SEED = 0x5eedba75; // fixed seed, recorded in every fixture
const BAR_COUNT = 500;
// Bar 250 starts a new floor(time/86400) day -> exercises the vwap reset.
const DAY_BOUNDARY_INDEX = 250;
const T0 = 20_000 * 86_400 - DAY_BOUNDARY_INDEX * 60; // 1m bars, 60 s apart
// 12 identical OHLC bars -> zero-range windows (stoch RSV=50, willr=-50,
// cci md=0, mfi flows 0) for periods <= 12.
const FLAT_START = 300;
const FLAT_END = 311; // inclusive
// Zero-volume bars: day starts (vwap None gap while day volume == 0) + one
// mid-day bar (vwap stays defined there).
const ZERO_VOLUME_INDEXES = [0, 100, DAY_BOUNDARY_INDEX];

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function buildBars(): Candle[] {
    const rand = mulberry32(SEED);
    const bars: Candle[] = [];
    let prevClose = 20_000;
    for (let i = 0; i < BAR_COUNT; i++) {
        const open = prevClose;
        const close = Math.round(open + (rand() - 0.5) * 80);
        const high = Math.max(open, close) + Math.round(rand() * 20);
        const low = Math.min(open, close) - Math.round(rand() * 20);
        const volume = 50 + Math.floor(rand() * 3000);
        bars.push({ time: T0 + i * 60, open, high, low, close, volume });
        prevClose = close;
    }
    const flat = bars[FLAT_START - 1]!.close;
    for (let i = FLAT_START; i <= FLAT_END; i++) {
        bars[i] = { ...bars[i]!, open: flat, high: flat, low: flat, close: flat };
    }
    for (const i of ZERO_VOLUME_INDEXES) {
        bars[i] = { ...bars[i]!, volume: 0 };
    }
    return bars;
}

// ---------------------------------------------------------------------------
// Flat-plateau input for the `*_flat` fixtures: quarter-point prices, then
// an 81-bar run of identical OHLC bars — longer than rsiPeriod + stochPeriod
// + kSmooth + dSmooth for every case below, so the RSI window sits entirely
// on the plateau (avg gain/loss at last-ulp magnitudes, the regime the
// smoother recursion-form parity defect lives in).
// ---------------------------------------------------------------------------

const FLAT_SEED = 0x0f1a75ed; // distinct fixed seed, recorded in *_flat fixtures
const FLAT_BAR_COUNT = 200;
const FLAT_T0 = 20_100 * 86_400; // 1m bars, separate day range from the base input
const FLAT_PLATEAU_START = 60;
const FLAT_PLATEAU_END = 140; // inclusive — 81 identical bars

function buildFlatBars(): Candle[] {
    const rand = mulberry32(FLAT_SEED);
    const bars: Candle[] = [];
    let prevClose = 17_000;
    for (let i = 0; i < FLAT_BAR_COUNT; i++) {
        const open = prevClose;
        const close = Math.round((open + (rand() - 0.5) * 30) * 4) / 4;
        const high = Math.max(open, close) + Math.round(rand() * 8 * 4) / 4;
        const low = Math.min(open, close) - Math.round(rand() * 8 * 4) / 4;
        const volume = 50 + Math.floor(rand() * 3000);
        bars.push({ time: FLAT_T0 + i * 60, open, high, low, close, volume });
        prevClose = close;
    }
    const flat = bars[FLAT_PLATEAU_START - 1]!.close;
    for (let i = FLAT_PLATEAU_START; i <= FLAT_PLATEAU_END; i++) {
        bars[i] = { ...bars[i]!, open: flat, high: flat, low: flat, close: flat };
    }
    return bars;
}

// ---------------------------------------------------------------------------
// Indicator case table (21 indicators; params are the single source of truth
// for each call's arguments)
// ---------------------------------------------------------------------------

type Params = Record<string, number>;
type Lines = Record<string, IndicatorPoint[]>;

interface CaseDef {
    params: Params;
    run: (bars: Candle[], p: Params) => Lines;
}

interface FixtureDef {
    name: string; // fixture file stem (python-side spelling)
    exportName: string; // src/lib/indicators.ts export
    flat?: true; // use the flat-plateau input (and its seed) instead
    cases: CaseDef[];
}

const FIXTURES: FixtureDef[] = [
    {
        name: 'sma',
        exportName: 'sma',
        cases: [
            { params: { period: 20 }, run: (b, p) => ({ value: sma(b, p.period!) }) },
            { params: { period: 7 }, run: (b, p) => ({ value: sma(b, p.period!) }) },
        ],
    },
    {
        name: 'ema',
        exportName: 'ema',
        cases: [
            { params: { period: 20 }, run: (b, p) => ({ value: ema(b, p.period!) }) },
            { params: { period: 9 }, run: (b, p) => ({ value: ema(b, p.period!) }) },
        ],
    },
    {
        name: 'wma',
        exportName: 'wma',
        cases: [
            { params: { period: 20 }, run: (b, p) => ({ value: wma(b, p.period!) }) },
            { params: { period: 5 }, run: (b, p) => ({ value: wma(b, p.period!) }) },
        ],
    },
    {
        name: 'bollinger',
        exportName: 'bollinger',
        cases: [
            { params: {}, run: (b) => ({ ...bollinger(b) }) },
            {
                params: { period: 10, mult: 1.5 },
                run: (b, p) => ({ ...bollinger(b, p.period!, p.mult!) }),
            },
        ],
    },
    {
        name: 'vwap',
        exportName: 'vwap',
        cases: [{ params: {}, run: (b) => ({ value: vwap(b) }) }],
    },
    {
        name: 'sar',
        exportName: 'sar',
        cases: [
            { params: {}, run: (b) => ({ value: sar(b) }) },
            { params: { step: 0.03, max: 0.3 }, run: (b, p) => ({ value: sar(b, p.step!, p.max!) }) },
        ],
    },
    {
        name: 'donchian',
        exportName: 'donchian',
        cases: [
            { params: {}, run: (b) => ({ ...donchian(b) }) },
            { params: { period: 55 }, run: (b, p) => ({ ...donchian(b, p.period!) }) },
        ],
    },
    {
        name: 'atr',
        exportName: 'atr',
        cases: [
            { params: {}, run: (b) => ({ value: atr(b) }) },
            { params: { period: 7 }, run: (b, p) => ({ value: atr(b, p.period!) }) },
        ],
    },
    {
        name: 'keltner',
        exportName: 'keltner',
        cases: [
            { params: {}, run: (b) => ({ ...keltner(b) }) },
            {
                params: { emaPeriod: 10, atrPeriod: 14, mult: 1.5 },
                run: (b, p) => ({ ...keltner(b, p.emaPeriod!, p.atrPeriod!, p.mult!) }),
            },
        ],
    },
    {
        name: 'supertrend',
        exportName: 'supertrend',
        cases: [
            { params: {}, run: (b) => ({ ...supertrend(b) }) },
            {
                params: { period: 14, mult: 2 },
                run: (b, p) => ({ ...supertrend(b, p.period!, p.mult!) }),
            },
        ],
    },
    {
        name: 'rsi',
        exportName: 'rsi',
        cases: [
            { params: {}, run: (b) => ({ value: rsi(b) }) },
            { params: { period: 7 }, run: (b, p) => ({ value: rsi(b, p.period!) }) },
        ],
    },
    {
        name: 'macd',
        exportName: 'macd',
        cases: [
            { params: {}, run: (b) => ({ ...macd(b) }) },
            {
                params: { fast: 5, slow: 13, signalPeriod: 4 },
                run: (b, p) => ({ ...macd(b, p.fast!, p.slow!, p.signalPeriod!) }),
            },
        ],
    },
    {
        name: 'stoch',
        exportName: 'stoch',
        cases: [
            { params: {}, run: (b) => ({ ...stoch(b) }) },
            {
                params: { kPeriod: 14, kSmooth: 5, dPeriod: 5 },
                run: (b, p) => ({ ...stoch(b, p.kPeriod!, p.kSmooth!, p.dPeriod!) }),
            },
        ],
    },
    {
        name: 'stoch_rsi',
        exportName: 'stochRsi',
        cases: [
            { params: {}, run: (b) => ({ ...stochRsi(b) }) },
            {
                params: { rsiPeriod: 7, stochPeriod: 10, kSmooth: 4, dSmooth: 2 },
                run: (b, p) => ({
                    ...stochRsi(b, p.rsiPeriod!, p.stochPeriod!, p.kSmooth!, p.dSmooth!),
                }),
            },
        ],
    },
    {
        name: 'cci',
        exportName: 'cci',
        cases: [
            { params: {}, run: (b) => ({ value: cci(b) }) },
            { params: { period: 14 }, run: (b, p) => ({ value: cci(b, p.period!) }) },
        ],
    },
    {
        name: 'willr',
        exportName: 'willr',
        cases: [
            { params: {}, run: (b) => ({ value: willr(b) }) },
            { params: { period: 7 }, run: (b, p) => ({ value: willr(b, p.period!) }) },
        ],
    },
    {
        name: 'dmi',
        exportName: 'dmi',
        cases: [
            { params: {}, run: (b) => ({ ...dmi(b) }) },
            {
                params: { period: 7, adxPeriod: 5 },
                run: (b, p) => ({ ...dmi(b, p.period!, p.adxPeriod!) }),
            },
        ],
    },
    {
        name: 'roc',
        exportName: 'roc',
        cases: [
            { params: {}, run: (b) => ({ value: roc(b) }) },
            { params: { period: 5 }, run: (b, p) => ({ value: roc(b, p.period!) }) },
        ],
    },
    {
        name: 'bias',
        exportName: 'bias',
        cases: [
            { params: {}, run: (b) => ({ value: bias(b) }) },
            { params: { period: 10 }, run: (b, p) => ({ value: bias(b, p.period!) }) },
        ],
    },
    {
        name: 'obv',
        exportName: 'obv',
        cases: [{ params: {}, run: (b) => ({ value: obv(b) }) }],
    },
    {
        name: 'mfi',
        exportName: 'mfi',
        cases: [
            { params: {}, run: (b) => ({ value: mfi(b) }) },
            { params: { period: 7 }, run: (b, p) => ({ value: mfi(b, p.period!) }) },
        ],
    },
    // Flat-plateau regression fixtures (same exports over the second input):
    // pin the indicators.ts rma recursion form where stochRsi's zero-range
    // normalization amplifies last-ulp smoothing differences.
    {
        name: 'rsi_flat',
        exportName: 'rsi',
        flat: true,
        cases: [
            { params: {}, run: (b) => ({ value: rsi(b) }) },
            { params: { period: 7 }, run: (b, p) => ({ value: rsi(b, p.period!) }) },
        ],
    },
    {
        name: 'stoch_rsi_flat',
        exportName: 'stochRsi',
        flat: true,
        cases: [
            { params: {}, run: (b) => ({ ...stochRsi(b) }) },
            {
                params: { rsiPeriod: 5, stochPeriod: 5, kSmooth: 3, dSmooth: 3 },
                run: (b, p) => ({
                    ...stochRsi(b, p.rsiPeriod!, p.stochPeriod!, p.kSmooth!, p.dSmooth!),
                }),
            },
        ],
    },
    {
        name: 'dmi_flat',
        exportName: 'dmi',
        flat: true,
        cases: [
            { params: {}, run: (b) => ({ ...dmi(b) }) },
            {
                params: { period: 7, adxPeriod: 5 },
                run: (b, p) => ({ ...dmi(b, p.period!, p.adxPeriod!) }),
            },
        ],
    },
];

// ---------------------------------------------------------------------------
// Serialization (stable layout: one JSON line per column / points array)
// ---------------------------------------------------------------------------

function serializePoints(name: string, lineName: string, points: IndicatorPoint[]): string {
    const kept = points.filter((p) => p.value !== undefined);
    for (const p of kept) {
        if (!Number.isFinite(p.value!)) {
            throw new Error(`${name}/${lineName}: non-finite value at time ${p.time}`);
        }
    }
    return `[${kept.map((p) => `{"time":${p.time},"value":${JSON.stringify(p.value)}}`).join(',')}]`;
}

function serializeFixture(def: FixtureDef, bars: Candle[], seed: number): string {
    const columns: Record<string, number[]> = {
        time: bars.map((b) => b.time),
        open: bars.map((b) => b.open),
        high: bars.map((b) => b.high),
        low: bars.map((b) => b.low),
        close: bars.map((b) => b.close),
        volume: bars.map((b) => b.volume),
    };
    const out: string[] = [];
    out.push('{');
    out.push(`  "indicator": ${JSON.stringify(def.name)},`);
    out.push(`  "export": ${JSON.stringify(def.exportName)},`);
    out.push(`  "seed": ${seed},`);
    out.push('  "input": {');
    const colNames = Object.keys(columns);
    colNames.forEach((col, i) => {
        const comma = i < colNames.length - 1 ? ',' : '';
        out.push(`    ${JSON.stringify(col)}: ${JSON.stringify(columns[col])}${comma}`);
    });
    out.push('  },');
    out.push('  "cases": [');
    def.cases.forEach((caseDef, caseIndex) => {
        const lines = caseDef.run(bars, caseDef.params);
        out.push('    {');
        out.push(`      "params": ${JSON.stringify(caseDef.params)},`);
        out.push('      "lines": {');
        const lineNames = Object.keys(lines);
        lineNames.forEach((lineName, i) => {
            const comma = i < lineNames.length - 1 ? ',' : '';
            const pts = serializePoints(def.name, lineName, lines[lineName]!);
            out.push(`        ${JSON.stringify(lineName)}: ${pts}${comma}`);
        });
        out.push('      }');
        out.push(`    }${caseIndex < def.cases.length - 1 ? ',' : ''}`);
    });
    out.push('  ]');
    out.push('}');
    return `${out.join('\n')}\n`;
}

function main(): void {
    const bars = buildBars();
    const flatBars = buildFlatBars();
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const outDir = join(scriptDir, '..', '..', 'backend', 'tests', 'fixtures', 'ta', 'golden');
    mkdirSync(outDir, { recursive: true });
    for (const def of FIXTURES) {
        const outPath = join(outDir, `${def.name}.json`);
        const input = def.flat ? flatBars : bars;
        const seed = def.flat ? FLAT_SEED : SEED;
        writeFileSync(outPath, serializeFixture(def, input, seed));
        console.log(`wrote ${outPath}`);
    }
}

main();
