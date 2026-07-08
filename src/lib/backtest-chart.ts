// src/lib/backtest-chart.ts — chart integration adapter for backtest runs
// (BT-FE-001). Converts F9 wire fragments into the shapes the existing
// lightweight-charts candlestick chart consumes, and holds the "currently
// displayed run" context so any chart showing the same symbol can draw the
// entry/exit markers.
//
// Time convention: wire `time` fields are already in the chart's
// Candle.time encoding (Taiwan wall clock as-if-UTC unix seconds) — the
// adapters below are pure pass-throughs, any +/- offset here is a defect.

import { useSyncExternalStore } from 'react';
import type { SeriesMarker, UTCTimestamp } from 'lightweight-charts';
import type {
    BtEquityPoint,
    BtMarker,
    BtRunResponse,
    BtTimeframe,
} from './backtest';
import { fmtPrice } from './utils/format';

// fill markers -> lightweight-charts series markers (createSeriesMarkers)
export function markersToSeriesMarkers(
    markers: BtMarker[],
    colors: { buy: string; sell: string },
): SeriesMarker<UTCTimestamp>[] {
    return markers.map((m) => ({
        time: m.time as UTCTimestamp, // wire encoding === Candle.time
        position: m.side === 'buy' ? 'belowBar' : 'aboveBar',
        shape: m.side === 'buy' ? 'arrowUp' : 'arrowDown',
        color: m.side === 'buy' ? colors.buy : colors.sell,
        text: `${m.side === 'buy' ? 'B' : 'S'} ${fmtPrice(m.price)}`,
    }));
}

// Snap marker times onto the chart's actual candle grid. Backend intraday
// buckets are session-anchored (TAIFEX 60m day session labels 08:45,
// 09:45, …) while chart candles are wall-clock floored (utils/kbars.ts
// aggregate(): 08:00, 09:00, …), so a run marker time may sit between two
// chart bars — lightweight-charts would then draw it on the wrong candle
// or drop it. Attach each marker to its containing candle: the largest bar
// time <= the marker time. Exact matches pass through unchanged; markers
// before the first bar have no containing candle and are dropped.
// `barTimes` must be ascending (chart bars always are); the snap is
// monotonic, so marker order is preserved.
export function snapMarkersToBars(
    markers: readonly SeriesMarker<UTCTimestamp>[],
    barTimes: readonly number[],
): SeriesMarker<UTCTimestamp>[] {
    if (barTimes.length === 0) return [];
    const out: SeriesMarker<UTCTimestamp>[] = [];
    for (const m of markers) {
        // binary search: last index with barTimes[i] <= m.time
        let lo = 0;
        let hi = barTimes.length - 1;
        let hit = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if ((barTimes[mid] ?? Infinity) <= m.time) {
                hit = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        if (hit < 0) continue; // before the first candle — drop
        const t = barTimes[hit] as UTCTimestamp;
        out.push(m.time === t ? m : { ...m, time: t });
    }
    return out;
}

// equity curve -> Line series data
export function equityToLineData(
    curve: BtEquityPoint[],
): { time: UTCTimestamp; value: number }[] {
    return curve.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.equity,
    }));
}

// ---- selected-run context store --------------------------------------------
// The backtest panel publishes its latest successful single-instrument run
// here; candle charts linked to the same code subscribe and overlay the
// markers (同 K 線圖畫進出場標記).

export interface BacktestRunContext {
    code: string; // contract the run was executed against
    strategy: string;
    timeframe: BtTimeframe;
    run: BtRunResponse; // status === 'done'
}

let current: BacktestRunContext | null = null;
const listeners = new Set<() => void>();

function subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
}

export function getBacktestRun(): BacktestRunContext | null {
    return current;
}

export function setBacktestRun(ctx: BacktestRunContext | null) {
    current = ctx;
    listeners.forEach((l) => l());
}

export function useBacktestRun(): BacktestRunContext | null {
    return useSyncExternalStore(subscribe, getBacktestRun, getBacktestRun);
}
