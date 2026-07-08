// src/lib/backtest-chart.test.ts — chart adapter + run-context store tests
// (BT-FE-001). Run with: npm test (node --import tsx --test).

import assert from 'node:assert/strict';
import test from 'node:test';
import type { UTCTimestamp } from 'lightweight-charts';
import {
    equityToLineData,
    getBacktestRun,
    markersToSeriesMarkers,
    setBacktestRun,
    snapMarkersToBars,
    type BacktestRunContext,
} from './backtest-chart';
import type { BtMarker, BtRunResponse } from './backtest';

const COLORS = { buy: '#f04a4a', sell: '#2fbf71' };

test('markersToSeriesMarkers maps sides and passes wire times through untouched', () => {
    const markers: BtMarker[] = [
        { time: 1709257500, price: 725, side: 'buy' },
        { time: 1709272800, price: 731.5, side: 'sell' },
    ];
    const out = markersToSeriesMarkers(markers, COLORS);
    assert.equal(out.length, 2);

    // buy -> arrowUp below the bar, buy color, exact time (no ±28800)
    assert.equal(out[0]?.time, 1709257500);
    assert.equal(out[0]?.position, 'belowBar');
    assert.equal(out[0]?.shape, 'arrowUp');
    assert.equal(out[0]?.color, COLORS.buy);
    assert.match(out[0]?.text ?? '', /^B /);

    // sell -> arrowDown above the bar
    assert.equal(out[1]?.time, 1709272800);
    assert.equal(out[1]?.position, 'aboveBar');
    assert.equal(out[1]?.shape, 'arrowDown');
    assert.equal(out[1]?.color, COLORS.sell);
    assert.match(out[1]?.text ?? '', /^S /);
});

// ---- snapMarkersToBars -------------------------------------------------------
// Backend 60m TAIFEX day-session buckets are session-anchored (08:45,
// 09:45, …) while the chart's aggregate() floors to the hour (08:00,
// 09:00, …) — markers must land on the containing chart candle.

const wall = (h: number, m: number) =>
    (Date.UTC(2024, 2, 1, h, m, 0) / 1000) as UTCTimestamp;
const mk = (time: UTCTimestamp) =>
    markersToSeriesMarkers([{ time, price: 100, side: 'buy' }], COLORS)[0]!;

test('snapMarkersToBars: session-anchored 60m fills snap to hour-floored candles', () => {
    // chart candles: 09:00 10:00 11:00 (hour-floored 60m grid)
    const bars = [wall(9, 0), wall(10, 0), wall(11, 0)];
    // backend fills carry the 08:45-anchored bucket labels 09:45 / 10:45
    const out = snapMarkersToBars([mk(wall(9, 45)), mk(wall(10, 45))], bars);
    assert.equal(out.length, 2);
    assert.equal(out[0]?.time, wall(9, 0)); // containing candle, not 10:00
    assert.equal(out[1]?.time, wall(10, 0));
    // everything but the time is preserved
    assert.equal(out[0]?.shape, 'arrowUp');
    assert.equal(out[0]?.color, COLORS.buy);
});

test('snapMarkersToBars: markers before the first candle are dropped', () => {
    const bars = [wall(9, 0), wall(10, 0)];
    const out = snapMarkersToBars(
        [mk(wall(8, 45)), mk(wall(9, 45))],
        bars,
    );
    assert.equal(out.length, 1); // 08:45 has no containing candle
    assert.equal(out[0]?.time, wall(9, 0));
});

test('snapMarkersToBars: exact matches pass through unchanged', () => {
    const bars = [wall(9, 0), wall(10, 0), wall(11, 0)];
    const m = mk(wall(10, 0));
    const out = snapMarkersToBars([m], bars);
    assert.equal(out.length, 1);
    assert.equal(out[0], m); // same object — no rewrite on the grid match
    assert.equal(out[0]?.time, wall(10, 0));
});

test('snapMarkersToBars: after-last-bar clamps to the last candle; no bars -> none', () => {
    const bars = [wall(9, 0), wall(10, 0)];
    const out = snapMarkersToBars([mk(wall(13, 30))], bars);
    assert.equal(out[0]?.time, wall(10, 0));
    assert.deepEqual(snapMarkersToBars([mk(wall(9, 45))], []), []);
});

test('equityToLineData is a pure time/value passthrough', () => {
    const out = equityToLineData([
        { time: 1709257500, equity: 1_000_000 },
        { time: 1709257560, equity: 999_850.5 },
    ]);
    assert.deepEqual(out, [
        { time: 1709257500, value: 1_000_000 },
        { time: 1709257560, value: 999_850.5 },
    ]);
});

test('run-context store publishes the selected run to subscribers', () => {
    const run = {
        run_id: 'r-9',
        status: 'done',
        error: null,
        message: null,
        retry_hint: null,
        traceback: null,
        markers: [{ time: 1709257500, price: 725, side: 'buy' }],
        equity_curve: [],
        metrics: null,
        trades: [],
        pending_signal: null,
        warnings: [],
    } as BtRunResponse;
    const ctx: BacktestRunContext = {
        code: '2330',
        strategy: 'sma_cross',
        timeframe: '15m',
        run,
    };

    assert.equal(getBacktestRun(), null);
    setBacktestRun(ctx);
    assert.equal(getBacktestRun(), ctx);
    assert.equal(getBacktestRun()?.run.markers[0]?.time, 1709257500);
    setBacktestRun(null);
    assert.equal(getBacktestRun(), null);
});
