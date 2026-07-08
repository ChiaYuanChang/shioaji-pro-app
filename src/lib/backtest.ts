// src/lib/backtest.ts — typed client for the open backtest service
// (backend/, FastAPI on 127.0.0.1:8787; BT-FE-001).
//
// Wire types mirror backend/src/backtest/api/schemas.py 1:1. Every `time`
// field on the wire is a Taiwan wall-clock datetime encoded **as-if-UTC**
// (`wallClockToUtc`, the same convention as the chart's Candle.time) —
// values pass straight through to lightweight-charts, NEVER add/subtract
// a timezone offset anywhere in this file or its consumers.

import type { ContractInfo } from './types/contract';

// ---- base URL --------------------------------------------------------------

// The backtest service is user-managed (00-context Fixed Decision 6): the
// user starts `uv run python -m backtest` themselves, default port 8787.
const BASE_KEY = 'sj-backtest-url';
export const DEFAULT_BACKTEST_BASE = 'http://127.0.0.1:8787';

export function getBacktestBase(): string {
    try {
        const v = localStorage.getItem(BASE_KEY);
        if (v) return v.replace(/\/+$/, '');
    } catch {
        // storage unavailable — default
    }
    return DEFAULT_BACKTEST_BASE;
}

export function setBacktestBase(url: string) {
    try {
        const clean = url.trim().replace(/\/+$/, '');
        if (clean) localStorage.setItem(BASE_KEY, clean);
        else localStorage.removeItem(BASE_KEY);
    } catch {
        // storage unavailable — session only
    }
}

// ---- request wire types (schemas.py request models) ------------------------

export type BtTimeframe = '1m' | '5m' | '15m' | '60m' | '1D';
export const BT_TIMEFRAMES: BtTimeframe[] = ['1m', '5m', '15m', '60m', '1D'];

// sidecar-shape contract JSON (ContractModel); the service prices costs from
// the full metadata, so the caller must pass everything it has (Open
// Question 7), not just {security_type, exchange, code}
export interface BtContract {
    security_type: 'STK' | 'FUT' | 'OPT';
    exchange: string;
    code: string;
    category: string;
    multiplier: number | null;
    underlying_code: string;
    underlying_kind: string;
    name: string;
}

export interface BtCommission {
    stock_rate: number;
    discount: number;
    futures_fee_per_contract: number;
}

export interface BtSlippage {
    mode: 'ticks' | 'fraction';
    value: number;
    tick_size_override: number | null;
}

// optional `config` body object — every omitted field takes the documented
// backend default (RunOptionsModel)
export interface BtRunConfig {
    sessions?: 'all' | 'day-only';
    size?: number;
    initial_capital?: number;
    commission?: Partial<BtCommission>;
    slippage?: Partial<BtSlippage>;
    min_fee_board_lot?: number;
    min_fee_odd_lot?: number;
    risk_free_rate?: number;
}

interface BtRunRequestBase {
    strategy: string; // name (file stem) or path
    params?: Record<string, unknown> | null;
    timeframe: BtTimeframe;
    start: string; // ISO YYYY-MM-DD, inclusive
    end: string; // ISO YYYY-MM-DD, inclusive
    config?: BtRunConfig | null;
}

export interface BtRunRequest extends BtRunRequestBase {
    contract: BtContract;
}

export interface BtPortfolioRunRequest extends BtRunRequestBase {
    contracts: BtContract[];
}

// ---- response wire types (schemas.py response models) ----------------------

export interface BtValidateResponse {
    valid: boolean;
    error_code: string | null;
    message: string | null;
}

export interface BtStrategyItem {
    name: string;
    path: string;
    params: Record<string, unknown>; // file PARAMS defaults
    valid: boolean;
    error_code: string | null;
    error: string | null;
}

export interface BtStrategiesResponse {
    strategies: BtStrategyItem[];
}

export interface BtMarker {
    time: number; // wallClockToUtc-encoded fill time
    price: number;
    side: 'buy' | 'sell';
}

export interface BtEquityPoint {
    time: number;
    equity: number;
}

export interface BtCostBreakdown {
    commission: number;
    tax: number;
    slippage: number;
}

export interface BtTrade {
    entry_time: number;
    entry_price: number;
    exit_time: number;
    exit_price: number;
    side: 'long' | 'short';
    size: number;
    gross_pnl: number;
    net_pnl: number;
    costs: BtCostBreakdown;
    open: boolean; // trailing open trade marked to last close
}

export interface BtPendingSignal {
    time: number;
    stance: 'long' | 'short' | 'flat';
    size: number | null;
}

export interface BtWarning {
    code: string;
    message: string;
}

export interface BtDrawdown {
    fraction: number;
    absolute: number;
    peak_time: number;
    trough_time: number;
}

export interface BtMetricsBasis {
    total_return: number | null;
    annualized_return: number | null;
    win_rate: number | null;
    profit_factor: number | null;
    profit_factor_reason: string | null;
    avg_win: number | null;
    avg_loss: number | null;
}

export interface BtMetrics {
    net: BtMetricsBasis;
    gross: BtMetricsBasis;
    sharpe: number | null;
    max_drawdown: BtDrawdown | null;
    trade_count: number;
    has_open_trade: boolean;
    exposure: number;
    total_costs: BtCostBreakdown;
    bars_per_year: number | null;
}

export type BtRunStatus = 'queued' | 'running' | 'done' | 'error';
// run-level failure classes (F9 envelope) — non-2xx is reserved for
// transport/validation, so clients branch on exactly this field
export type BtErrorClass =
    | 'timeout'
    | 'strategy_exception'
    | 'sidecar_down'
    | 'no_data';

export interface BtRunResponse {
    run_id: string;
    status: BtRunStatus;
    error: string | null;
    message: string | null;
    retry_hint: string | null;
    traceback: string | null;
    markers: BtMarker[];
    equity_curve: BtEquityPoint[];
    metrics: BtMetrics | null;
    trades: BtTrade[];
    pending_signal: BtPendingSignal | null;
    warnings: BtWarning[];
}

export interface BtInstrumentRow {
    code: string;
    name: string;
    trade_count: number | null;
    net_return: number | null;
    gross_return: number | null;
    net_pnl: number | null;
    win_rate: number | null;
    profit_factor: number | null;
    max_drawdown: number | null;
    total_costs: number | null;
    error: string | null; // per-instrument failure (F8-AC4)
}

export interface BtPortfolioResponse {
    run_id: string;
    status: BtRunStatus;
    error: string | null;
    message: string | null;
    retry_hint: string | null;
    merged_equity_curve: BtEquityPoint[];
    per_instrument: BtInstrumentRow[];
    initial_capital_total: number | null;
    partial: boolean;
}

// ---- fetch helpers ----------------------------------------------------------

// FastAPI transport/validation errors: {"detail": string | [{loc, msg}, ...]}
async function throwBtError(res: Response): Promise<never> {
    let detail = '';
    try {
        const data = (await res.json()) as { detail?: unknown };
        if (typeof data.detail === 'string') {
            detail = data.detail;
        } else if (Array.isArray(data.detail)) {
            detail = data.detail
                .map((d) => {
                    const it = d as { loc?: unknown[]; msg?: string };
                    const loc = Array.isArray(it.loc)
                        ? it.loc.filter((x) => x !== 'body').join('.')
                        : '';
                    return loc ? `${loc}: ${it.msg ?? ''}` : (it.msg ?? '');
                })
                .filter(Boolean)
                .join('; ');
        }
    } catch {
        // non-JSON body — fall back to status text
    }
    throw new Error(`${res.status} ${detail || res.statusText}`.trim());
}

// the service answers CORS preflight (unlike the shioaji sidecar) and its
// allow-list covers the app origins, so plain fetch works in web and Tauri
async function btGet<T>(path: string): Promise<T> {
    const res = await fetch(getBacktestBase() + path);
    if (!res.ok) await throwBtError(res);
    return res.json() as Promise<T>;
}

async function btPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(getBacktestBase() + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) await throwBtError(res);
    return res.json() as Promise<T>;
}

// ---- the five F9 endpoints + health ----------------------------------------

export async function fetchBacktestHealth(): Promise<boolean> {
    try {
        const res = await fetch(`${getBacktestBase()}/health`);
        return res.ok;
    } catch {
        return false;
    }
}

export function fetchStrategies(): Promise<BtStrategiesResponse> {
    return btGet<BtStrategiesResponse>('/api/v1/strategies');
}

export function validateStrategy(path: string): Promise<BtValidateResponse> {
    return btPost<BtValidateResponse>('/api/v1/strategies/validate', { path });
}

export function runBacktest(req: BtRunRequest): Promise<BtRunResponse> {
    return btPost<BtRunResponse>('/api/v1/backtests/run', req);
}

export function runPortfolioBacktest(
    req: BtPortfolioRunRequest,
): Promise<BtPortfolioResponse> {
    return btPost<BtPortfolioResponse>('/api/v1/backtests/run-portfolio', req);
}

export function fetchBacktestRun(
    runId: string,
): Promise<BtRunResponse | BtPortfolioResponse> {
    return btGet<BtRunResponse | BtPortfolioResponse>(
        `/api/v1/backtests/${encodeURIComponent(runId)}`,
    );
}

// ---- converters -------------------------------------------------------------

// full ContractInfo -> wire contract. The service prices costs (multiplier,
// ETF tax rate, session table…) from this metadata, so every priced field
// is forwarded — not only {security_type, exchange, code}. Returns null for
// contract kinds the engine rejects (IND / missing exchange -> 422 anyway).
export function contractToWire(c: ContractInfo): BtContract | null {
    if (
        c.security_type !== 'STK' &&
        c.security_type !== 'FUT' &&
        c.security_type !== 'OPT'
    ) {
        return null;
    }
    if (!c.exchange || !c.code) return null;
    return {
        security_type: c.security_type,
        exchange: c.exchange,
        code: c.code,
        category: c.category ?? '',
        multiplier:
            typeof c.multiplier === 'number' && c.multiplier > 0
                ? c.multiplier
                : null,
        underlying_code: c.underlying_code ?? '',
        underlying_kind: c.underlying_kind ?? '',
        name: c.name ?? '',
    };
}

// format a wire time for display. The value is Taiwan wall clock encoded
// as-if-UTC, so formatting MUST use the UTC getters — local-time getters
// would re-introduce the viewer-timezone shift the encoding exists to avoid.
export function fmtWallClock(t: number, withSeconds = false): string {
    const d = new Date(t * 1000);
    const p = (n: number) => String(n).padStart(2, '0');
    const base = `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(
        d.getUTCDate(),
    )} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
    return withSeconds ? `${base}:${p(d.getUTCSeconds())}` : base;
}
