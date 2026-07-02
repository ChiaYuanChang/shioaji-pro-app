// src/lib/indicator-defs.ts — indicator registry, instances, persistence.
// Each definition declares its params, output series (with render hints)
// and a compute() over candles; candle-chart renders overlays on the main
// pane and gives every oscillator instance its own sub-pane.

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
    type IndicatorPoint,
} from './indicators';
import type { Candle } from './types/market';

export type OutputKind = 'line' | 'dashed' | 'histogram' | 'points';

export interface ParamDef {
    key: string;
    label: string;
    def: number;
    min: number;
    max: number;
    step?: number;
}

export interface OutputDef {
    key: string;
    label: string;
    kind: OutputKind;
    color: string; // default color
    width?: 1 | 2;
    // histogram only: color positive/negative halves with up/down colors
    signed?: boolean;
}

export interface IndicatorDef {
    type: string;
    label: string; // list label, e.g. "MA 移動平均"
    short: string; // legend label, e.g. "MA"
    category: 'overlay' | 'pane';
    params: ParamDef[];
    outputs: OutputDef[];
    // horizontal reference levels drawn in the sub-pane (e.g. RSI 30/70)
    levels?: number[];
    compute: (
        bars: Candle[],
        p: Record<string, number>,
    ) => Record<string, IndicatorPoint[]>;
}

export const INDICATOR_DEFS: IndicatorDef[] = [
    // ---- 主圖疊加 ----
    {
        type: 'sma',
        label: 'MA 移動平均',
        short: 'MA',
        category: 'overlay',
        params: [{ key: 'period', label: '週期', def: 20, min: 1, max: 500 }],
        outputs: [{ key: 'line', label: 'MA', kind: 'line', color: '#e0a43c' }],
        compute: (b, p) => ({ line: sma(b, p.period!) }),
    },
    {
        type: 'ema',
        label: 'EMA 指數移動平均',
        short: 'EMA',
        category: 'overlay',
        params: [{ key: 'period', label: '週期', def: 12, min: 1, max: 500 }],
        outputs: [{ key: 'line', label: 'EMA', kind: 'line', color: '#19b6c9' }],
        compute: (b, p) => ({ line: ema(b, p.period!) }),
    },
    {
        type: 'wma',
        label: 'WMA 加權移動平均',
        short: 'WMA',
        category: 'overlay',
        params: [{ key: 'period', label: '週期', def: 20, min: 1, max: 500 }],
        outputs: [{ key: 'line', label: 'WMA', kind: 'line', color: '#b06fff' }],
        compute: (b, p) => ({ line: wma(b, p.period!) }),
    },
    {
        type: 'boll',
        label: 'BOLL 布林通道',
        short: 'BOLL',
        category: 'overlay',
        params: [
            { key: 'period', label: '週期', def: 20, min: 2, max: 200 },
            { key: 'mult', label: '標準差倍數', def: 2, min: 0.5, max: 5, step: 0.5 },
        ],
        outputs: [
            { key: 'mid', label: '中軌', kind: 'line', color: '#8b94a7' },
            { key: 'upper', label: '上軌', kind: 'line', color: '#5a89c9' },
            { key: 'lower', label: '下軌', kind: 'line', color: '#5a89c9' },
        ],
        compute: (b, p) => {
            const r = bollinger(b, p.period!, p.mult!);
            return { mid: r.mid, upper: r.upper, lower: r.lower };
        },
    },
    {
        type: 'vwap',
        label: 'VWAP 成交量加權均價',
        short: 'VWAP',
        category: 'overlay',
        params: [],
        outputs: [
            { key: 'line', label: 'VWAP', kind: 'line', color: '#f5f7fa', width: 2 },
        ],
        compute: (b) => ({ line: vwap(b) }),
    },
    {
        type: 'sar',
        label: 'SAR 拋物線',
        short: 'SAR',
        category: 'overlay',
        params: [
            { key: 'step', label: '加速因子', def: 0.02, min: 0.01, max: 0.1, step: 0.01 },
            { key: 'max', label: '上限', def: 0.2, min: 0.1, max: 0.5, step: 0.05 },
        ],
        outputs: [
            { key: 'line', label: 'SAR', kind: 'points', color: '#e0a43c' },
        ],
        compute: (b, p) => ({ line: sar(b, p.step!, p.max!) }),
    },
    {
        type: 'supertrend',
        label: 'SuperTrend 超級趨勢',
        short: 'ST',
        category: 'overlay',
        params: [
            { key: 'period', label: 'ATR 週期', def: 10, min: 1, max: 100 },
            { key: 'mult', label: '倍數', def: 3, min: 0.5, max: 10, step: 0.5 },
        ],
        outputs: [
            { key: 'up', label: '多頭', kind: 'line', color: '#1fd286', width: 2 },
            { key: 'down', label: '空頭', kind: 'line', color: '#ff4d6a', width: 2 },
        ],
        compute: (b, p) => {
            const r = supertrend(b, p.period!, p.mult!);
            return { up: r.up, down: r.down };
        },
    },
    {
        type: 'donchian',
        label: 'Donchian 唐奇安通道',
        short: 'DC',
        category: 'overlay',
        params: [{ key: 'period', label: '週期', def: 20, min: 2, max: 200 }],
        outputs: [
            { key: 'upper', label: '上軌', kind: 'line', color: '#5a89c9' },
            { key: 'mid', label: '中軌', kind: 'dashed', color: '#8b94a7' },
            { key: 'lower', label: '下軌', kind: 'line', color: '#5a89c9' },
        ],
        compute: (b, p) => {
            const r = donchian(b, p.period!);
            return { upper: r.upper, mid: r.mid, lower: r.lower };
        },
    },
    {
        type: 'keltner',
        label: 'Keltner 肯特納通道',
        short: 'KC',
        category: 'overlay',
        params: [
            { key: 'period', label: 'EMA 週期', def: 20, min: 2, max: 200 },
            { key: 'atrPeriod', label: 'ATR 週期', def: 10, min: 1, max: 100 },
            { key: 'mult', label: 'ATR 倍數', def: 2, min: 0.5, max: 5, step: 0.5 },
        ],
        outputs: [
            { key: 'mid', label: '中軌', kind: 'line', color: '#8b94a7' },
            { key: 'upper', label: '上軌', kind: 'line', color: '#c9a25a' },
            { key: 'lower', label: '下軌', kind: 'line', color: '#c9a25a' },
        ],
        compute: (b, p) => {
            const r = keltner(b, p.period!, p.atrPeriod!, p.mult!);
            return { mid: r.mid, upper: r.upper, lower: r.lower };
        },
    },
    // ---- 副圖震盪 ----
    {
        type: 'macd',
        label: 'MACD 指數平滑異同',
        short: 'MACD',
        category: 'pane',
        params: [
            { key: 'fast', label: '快線', def: 12, min: 1, max: 100 },
            { key: 'slow', label: '慢線', def: 26, min: 2, max: 200 },
            { key: 'signal', label: '訊號線', def: 9, min: 1, max: 100 },
        ],
        outputs: [
            { key: 'hist', label: '柱狀', kind: 'histogram', color: '#8b94a7', signed: true },
            { key: 'macd', label: 'DIF', kind: 'line', color: '#3d8bff' },
            { key: 'signal', label: 'DEA', kind: 'line', color: '#e0a43c' },
        ],
        levels: [0],
        compute: (b, p) => {
            const r = macd(b, p.fast!, p.slow!, p.signal!);
            return { macd: r.macd, signal: r.signal, hist: r.hist };
        },
    },
    {
        type: 'rsi',
        label: 'RSI 相對強弱',
        short: 'RSI',
        category: 'pane',
        params: [{ key: 'period', label: '週期', def: 14, min: 2, max: 100 }],
        outputs: [{ key: 'line', label: 'RSI', kind: 'line', color: '#b06fff' }],
        levels: [30, 70],
        compute: (b, p) => ({ line: rsi(b, p.period!) }),
    },
    {
        type: 'kd',
        label: 'KD 隨機指標',
        short: 'KD',
        category: 'pane',
        params: [
            { key: 'period', label: 'RSV 週期', def: 9, min: 1, max: 100 },
            { key: 'k', label: 'K 平滑', def: 3, min: 1, max: 50 },
            { key: 'd', label: 'D 平滑', def: 3, min: 1, max: 50 },
        ],
        outputs: [
            { key: 'k', label: 'K', kind: 'line', color: '#3d8bff' },
            { key: 'd', label: 'D', kind: 'line', color: '#e0a43c' },
        ],
        levels: [20, 80],
        compute: (b, p) => {
            const r = stoch(b, p.period!, p.k!, p.d!);
            return { k: r.k, d: r.d };
        },
    },
    {
        type: 'stochrsi',
        label: 'StochRSI 隨機相對強弱',
        short: 'SRSI',
        category: 'pane',
        params: [
            { key: 'rsiPeriod', label: 'RSI 週期', def: 14, min: 2, max: 100 },
            { key: 'stochPeriod', label: 'Stoch 週期', def: 14, min: 2, max: 100 },
            { key: 'k', label: 'K 平滑', def: 3, min: 1, max: 50 },
            { key: 'd', label: 'D 平滑', def: 3, min: 1, max: 50 },
        ],
        outputs: [
            { key: 'k', label: 'K', kind: 'line', color: '#3d8bff' },
            { key: 'd', label: 'D', kind: 'line', color: '#e0a43c' },
        ],
        levels: [20, 80],
        compute: (b, p) => {
            const r = stochRsi(b, p.rsiPeriod!, p.stochPeriod!, p.k!, p.d!);
            return { k: r.k, d: r.d };
        },
    },
    {
        type: 'cci',
        label: 'CCI 順勢指標',
        short: 'CCI',
        category: 'pane',
        params: [{ key: 'period', label: '週期', def: 20, min: 2, max: 200 }],
        outputs: [{ key: 'line', label: 'CCI', kind: 'line', color: '#19b6c9' }],
        levels: [-100, 100],
        compute: (b, p) => ({ line: cci(b, p.period!) }),
    },
    {
        type: 'atr',
        label: 'ATR 真實波幅',
        short: 'ATR',
        category: 'pane',
        params: [{ key: 'period', label: '週期', def: 14, min: 1, max: 100 }],
        outputs: [{ key: 'line', label: 'ATR', kind: 'line', color: '#e0a43c' }],
        compute: (b, p) => ({ line: atr(b, p.period!) }),
    },
    {
        type: 'obv',
        label: 'OBV 能量潮',
        short: 'OBV',
        category: 'pane',
        params: [],
        outputs: [{ key: 'line', label: 'OBV', kind: 'line', color: '#5a89c9' }],
        compute: (b) => ({ line: obv(b) }),
    },
    {
        type: 'mfi',
        label: 'MFI 資金流量',
        short: 'MFI',
        category: 'pane',
        params: [{ key: 'period', label: '週期', def: 14, min: 2, max: 100 }],
        outputs: [{ key: 'line', label: 'MFI', kind: 'line', color: '#1fd286' }],
        levels: [20, 80],
        compute: (b, p) => ({ line: mfi(b, p.period!) }),
    },
    {
        type: 'willr',
        label: 'W%R 威廉指標',
        short: 'W%R',
        category: 'pane',
        params: [{ key: 'period', label: '週期', def: 14, min: 2, max: 100 }],
        outputs: [{ key: 'line', label: 'W%R', kind: 'line', color: '#ff8a3d' }],
        levels: [-80, -20],
        compute: (b, p) => ({ line: willr(b, p.period!) }),
    },
    {
        type: 'dmi',
        label: 'DMI/ADX 趨向指標',
        short: 'DMI',
        category: 'pane',
        params: [
            { key: 'period', label: 'DI 週期', def: 14, min: 2, max: 100 },
            { key: 'adx', label: 'ADX 平滑', def: 14, min: 2, max: 100 },
        ],
        outputs: [
            { key: 'plus', label: '+DI', kind: 'line', color: '#1fd286' },
            { key: 'minus', label: '-DI', kind: 'line', color: '#ff4d6a' },
            { key: 'adx', label: 'ADX', kind: 'line', color: '#f5f7fa', width: 2 },
        ],
        levels: [25],
        compute: (b, p) => {
            const r = dmi(b, p.period!, p.adx!);
            return { plus: r.plus, minus: r.minus, adx: r.adx };
        },
    },
    {
        type: 'roc',
        label: 'ROC 變動率',
        short: 'ROC',
        category: 'pane',
        params: [{ key: 'period', label: '週期', def: 12, min: 1, max: 200 }],
        outputs: [{ key: 'line', label: 'ROC', kind: 'line', color: '#b06fff' }],
        levels: [0],
        compute: (b, p) => ({ line: roc(b, p.period!) }),
    },
    {
        type: 'bias',
        label: 'BIAS 乖離率',
        short: 'BIAS',
        category: 'pane',
        params: [{ key: 'period', label: 'MA 週期', def: 20, min: 1, max: 200 }],
        outputs: [{ key: 'line', label: 'BIAS', kind: 'line', color: '#19b6c9' }],
        levels: [0],
        compute: (b, p) => ({ line: bias(b, p.period!) }),
    },
];

export const DEF_BY_TYPE = new Map(INDICATOR_DEFS.map((d) => [d.type, d]));

// ---- instances ----

export interface IndicatorInstance {
    id: string;
    type: string;
    params: Record<string, number>;
    // output key -> color override
    colors: Record<string, string>;
}

export function instanceLabel(inst: IndicatorInstance): string {
    const def = DEF_BY_TYPE.get(inst.type);
    if (!def) return inst.type;
    const args = def.params.map((p) => inst.params[p.key] ?? p.def);
    return args.length > 0 ? `${def.short}(${args.join(',')})` : def.short;
}

export function newInstance(type: string): IndicatorInstance {
    const def = DEF_BY_TYPE.get(type);
    const params: Record<string, number> = {};
    for (const p of def?.params ?? []) params[p.key] = p.def;
    return {
        id: `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        params,
        colors: {},
    };
}

// ---- persistence（全域，跨圖表共用；v1 Set 格式自動遷移）----

const STORE_KEY = 'sj-pro-indicators-v2';
const LEGACY_KEY = 'sj-pro-indicators';

function migrateLegacy(): IndicatorInstance[] {
    try {
        const raw = localStorage.getItem(LEGACY_KEY);
        if (!raw) return [];
        const keys = JSON.parse(raw) as string[];
        const out: IndicatorInstance[] = [];
        for (const k of keys) {
            if (k.startsWith('ma')) {
                const inst = newInstance('sma');
                inst.params.period = Number(k.slice(2)) || 20;
                out.push(inst);
            } else if (k === 'ema12') {
                out.push(newInstance('ema'));
            } else if (k === 'bb') {
                out.push(newInstance('boll'));
            } else if (k === 'vwap') {
                out.push(newInstance('vwap'));
            }
        }
        localStorage.removeItem(LEGACY_KEY);
        return out;
    } catch {
        return [];
    }
}

export function loadInstances(): IndicatorInstance[] {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
            const list = JSON.parse(raw) as IndicatorInstance[];
            return list.filter((i) => DEF_BY_TYPE.has(i.type));
        }
    } catch {
        // fresh start below
    }
    const migrated = migrateLegacy();
    if (migrated.length > 0) saveInstances(migrated);
    return migrated;
}

export function saveInstances(list: IndicatorInstance[]) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch {
        // storage full/unavailable — keep in-memory state
    }
}
