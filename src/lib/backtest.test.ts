// src/lib/backtest.test.ts — mocked tests for the backtest API client
// (BT-FE-001). Run with: npm test (node --import tsx --test).

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    contractToWire,
    DEFAULT_BACKTEST_BASE,
    fetchStrategies,
    fmtWallClock,
    getBacktestBase,
    runBacktest,
    validateStrategy,
    type BtContract,
    type BtRunRequest,
    type BtRunResponse,
} from './backtest';
import type { ContractInfo } from './types/contract';
import {
    __resetContractsCacheForTest,
    ensureContract,
    getCachedContract,
    resolveContract,
} from './contracts-cache';
import type { fetchContract, subscribeQuote } from './shioaji';

// ---- fetch mock -------------------------------------------------------------

interface FetchCall {
    url: string;
    init?: RequestInit;
}

function installFetch(
    handler: (
        url: string,
        init?: RequestInit,
    ) => { status?: number; body: unknown },
): FetchCall[] {
    const calls: FetchCall[] = [];
    globalThis.fetch = (async (
        input: RequestInfo | URL,
        init?: RequestInit,
    ) => {
        const url =
            typeof input === 'string'
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url;
        calls.push({ url, init });
        const { status = 200, body } = handler(url, init);
        return new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
        });
    }) as typeof fetch;
    return calls;
}

const realFetch = globalThis.fetch;

// ---- fixtures ----------------------------------------------------------------

const contractInfo: ContractInfo = {
    exchange: 'TSE',
    code: '2330',
    security_type: 'STK',
    target_code: null,
    name: '台積電',
    currency: 'TWD',
    limit_up: 1100,
    limit_down: 900,
    reference: 1000,
    day_trade: 'Yes',
    update_date: '2024/03/01',
    category: '24',
    margin_trading_balance: 0,
    short_selling_balance: 0,
    underlying_code: '',
    underlying_kind: '',
};

// wire times: Taiwan wall clock encoded as-if-UTC — 2024-03-01 09:15 and
// 2024-03-01 13:30
const T_ENTRY = Date.UTC(2024, 2, 1, 9, 15, 0) / 1000;
const T_EXIT = Date.UTC(2024, 2, 1, 13, 30, 0) / 1000;

const doneEnvelope: BtRunResponse = {
    run_id: 'run-1',
    status: 'done',
    error: null,
    message: null,
    retry_hint: null,
    traceback: null,
    markers: [
        { time: T_ENTRY, price: 725, side: 'buy' },
        { time: T_EXIT, price: 731, side: 'sell' },
    ],
    equity_curve: [
        { time: T_ENTRY, equity: 1_000_000 },
        { time: T_EXIT, equity: 1_005_100 },
    ],
    metrics: {
        net: {
            total_return: 0.0051,
            annualized_return: null,
            win_rate: 1,
            profit_factor: null,
            profit_factor_reason: 'no_losses',
            avg_win: 5100,
            avg_loss: null,
        },
        gross: {
            total_return: 0.006,
            annualized_return: null,
            win_rate: 1,
            profit_factor: null,
            profit_factor_reason: 'no_losses',
            avg_win: 6000,
            avg_loss: null,
        },
        sharpe: null,
        max_drawdown: null,
        trade_count: 1,
        has_open_trade: false,
        exposure: 0.4,
        total_costs: { commission: 620, tax: 280, slippage: 0 },
        bars_per_year: 66000,
    },
    trades: [
        {
            entry_time: T_ENTRY,
            entry_price: 725,
            exit_time: T_EXIT,
            exit_price: 731,
            side: 'long',
            size: 1,
            gross_pnl: 6000,
            net_pnl: 5100,
            costs: { commission: 620, tax: 280, slippage: 0 },
            open: false,
        },
    ],
    pending_signal: null,
    warnings: [],
};

const runRequest = (): BtRunRequest => {
    const wire = contractToWire(contractInfo);
    assert.ok(wire, 'fixture contract must be wire-convertible');
    return {
        strategy: 'sma_cross',
        params: { fast: 5, slow: 20 },
        contract: wire,
        timeframe: '15m',
        start: '2024-03-01',
        end: '2024-03-11',
        config: { sessions: 'all', initial_capital: 1_000_000 },
    };
};

// ---- tests --------------------------------------------------------------------

test('getBacktestBase defaults to the service port without storage', () => {
    assert.equal(getBacktestBase(), DEFAULT_BACKTEST_BASE);
    assert.equal(DEFAULT_BACKTEST_BASE, 'http://127.0.0.1:8787');
});

test('fetchStrategies GETs /api/v1/strategies and returns the listing', async (t) => {
    t.after(() => {
        globalThis.fetch = realFetch;
    });
    const calls = installFetch(() => ({
        body: {
            strategies: [
                {
                    name: 'sma_cross',
                    path: '/tmp/strategies/sma_cross.py',
                    params: { fast: 5, slow: 20 },
                    valid: true,
                    error_code: null,
                    error: null,
                },
            ],
        },
    }));
    const res = await fetchStrategies();
    assert.equal(calls[0]?.url, `${DEFAULT_BACKTEST_BASE}/api/v1/strategies`);
    assert.equal(res.strategies.length, 1);
    assert.equal(res.strategies[0]?.name, 'sma_cross');
    assert.deepEqual(res.strategies[0]?.params, { fast: 5, slow: 20 });
});

test('runBacktest sends the FULL contract metadata and passes times through unshifted', async (t) => {
    t.after(() => {
        globalThis.fetch = realFetch;
    });
    const calls = installFetch(() => ({ body: doneEnvelope }));
    const res = await runBacktest(runRequest());

    assert.equal(
        calls[0]?.url,
        `${DEFAULT_BACKTEST_BASE}/api/v1/backtests/run`,
    );
    assert.equal(calls[0]?.init?.method, 'POST');
    const sent = JSON.parse(String(calls[0]?.init?.body)) as {
        contract: BtContract;
        strategy: string;
    };
    // DoD: not only {security_type, exchange, code} — every priced field
    assert.deepEqual(sent.contract, {
        security_type: 'STK',
        exchange: 'TSE',
        code: '2330',
        category: '24',
        multiplier: null,
        underlying_code: '',
        underlying_kind: '',
        name: '台積電',
    });

    // success envelope parsed; wire times land bit-identical (no ±28800)
    assert.equal(res.status, 'done');
    assert.equal(res.markers[0]?.time, T_ENTRY);
    assert.equal(res.markers[1]?.time, T_EXIT);
    assert.equal(res.equity_curve[1]?.equity, 1_005_100);
    assert.equal(res.trades[0]?.entry_time, T_ENTRY);
    assert.equal(res.metrics?.trade_count, 1);
});

test('run-level failure: HTTP 200 status:"error" envelope resolves (never throws)', async (t) => {
    t.after(() => {
        globalThis.fetch = realFetch;
    });
    installFetch(() => ({
        body: {
            ...doneEnvelope,
            status: 'error',
            error: 'sidecar_down',
            message: 'sidecar unreachable at http://127.0.0.1:8080',
            markers: [],
            equity_curve: [],
            metrics: null,
            trades: [],
        },
    }));
    const res = await runBacktest(runRequest());
    assert.equal(res.status, 'error');
    assert.equal(res.error, 'sidecar_down');
    assert.equal(res.metrics, null);
    assert.deepEqual(res.markers, []);
});

test('transport/validation failure: non-2xx throws with the FastAPI detail', async (t) => {
    t.after(() => {
        globalThis.fetch = realFetch;
    });
    installFetch(() => ({
        status: 422,
        body: {
            detail: [
                {
                    loc: ['body', 'timeframe'],
                    msg: "Input should be '1m', '5m', '15m', '60m' or '1D'",
                    type: 'literal_error',
                },
            ],
        },
    }));
    await assert.rejects(
        () => runBacktest(runRequest()),
        (e: unknown) => {
            assert.ok(e instanceof Error);
            assert.match(e.message, /^422 /);
            assert.match(e.message, /timeframe/);
            return true;
        },
    );
});

test('validateStrategy POSTs the path and surfaces the F4 error codes', async (t) => {
    t.after(() => {
        globalThis.fetch = realFetch;
    });
    const calls = installFetch(() => ({
        body: {
            valid: false,
            error_code: 'missing_strategy',
            message: 'no strategy() function',
        },
    }));
    const res = await validateStrategy('/tmp/strategies/broken.py');
    assert.equal(
        calls[0]?.url,
        `${DEFAULT_BACKTEST_BASE}/api/v1/strategies/validate`,
    );
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
        path: '/tmp/strategies/broken.py',
    });
    assert.equal(res.valid, false);
    assert.equal(res.error_code, 'missing_strategy');
});

test('contractToWire forwards priced metadata and rejects unsupported kinds', () => {
    const fut: ContractInfo = {
        ...contractInfo,
        code: 'TXFD4',
        security_type: 'FUT',
        exchange: 'TAIFEX',
        category: 'TXF',
        multiplier: 200,
        underlying_code: 'TXF',
        underlying_kind: 'I',
        name: '台指期',
    };
    assert.deepEqual(contractToWire(fut), {
        security_type: 'FUT',
        exchange: 'TAIFEX',
        code: 'TXFD4',
        category: 'TXF',
        multiplier: 200,
        underlying_code: 'TXF',
        underlying_kind: 'I',
        name: '台指期',
    });
    // 0/negative multipliers normalize to null (backend boundary invariant)
    assert.equal(contractToWire({ ...fut, multiplier: 0 })?.multiplier, null);
    // IND (and null security_type) is not backtestable
    assert.equal(contractToWire({ ...contractInfo, security_type: 'IND' }), null);
    assert.equal(contractToWire({ ...contractInfo, security_type: null }), null);
    assert.equal(contractToWire({ ...contractInfo, exchange: null }), null);
});

// ---- resolveContract: metadata-only path -------------------------------------
// The portfolio run resolves every typed code; that must NEVER spend
// shioaji's per-session subscription quota on Tick/BidAsk streams.

function installContractIO() {
    const fetched: string[] = [];
    const subs: string[] = [];
    __resetContractsCacheForTest({
        fetchContract: (async (code, type = 'STK') => {
            fetched.push(`${code}:${type}`);
            if (code.startsWith('TXF') && type !== 'FUT') {
                throw new Error('404 not found');
            }
            return {
                ...contractInfo,
                code,
                security_type: code.startsWith('TXF') ? 'FUT' : 'STK',
            };
        }) as typeof fetchContract,
        subscribeQuote: (async (c, quoteType) => {
            subs.push(`${c.code}:${quoteType}`);
            return { success: true };
        }) as typeof subscribeQuote,
    });
    return { fetched, subs };
}

test('resolveContract caches metadata without any quote subscription', async (t) => {
    t.after(() => __resetContractsCacheForTest());
    const { fetched, subs } = installContractIO();

    const c = await resolveContract('2330');
    assert.equal(c.code, '2330');
    assert.deepEqual(fetched, ['2330:STK']);
    assert.deepEqual(subs, []); // the finding: no Tick/BidAsk side effect

    // FUT fallback still resolves — and still subscribes nothing
    const fut = await resolveContract('TXFR1');
    assert.equal(fut.code, 'TXFR1');
    assert.deepEqual(fetched, ['2330:STK', 'TXFR1:STK', 'TXFR1:FUT']);
    assert.deepEqual(subs, []);

    // cached: repeat resolve = no new fetches, still no subscriptions
    await resolveContract('2330');
    assert.equal(getCachedContract('2330')?.code, '2330');
    assert.deepEqual(fetched, ['2330:STK', 'TXFR1:STK', 'TXFR1:FUT']);
    assert.deepEqual(subs, []);
});

test('ensureContract still subscribes Tick+BidAsk once, even after a metadata-only resolve', async (t) => {
    t.after(() => __resetContractsCacheForTest());
    const { fetched, subs } = installContractIO();

    // backtest resolved it first — no streams yet
    await resolveContract('2330');
    assert.deepEqual(subs, []);

    // a live consumer ensures the same code — streams attach exactly as
    // they did before the metadata-only path existed, without refetching
    await ensureContract('2330');
    assert.deepEqual(fetched, ['2330:STK']);
    assert.deepEqual(subs, ['2330:Tick', '2330:BidAsk']);

    // idempotent: further ensures never double-subscribe
    await ensureContract('2330');
    assert.deepEqual(subs, ['2330:Tick', '2330:BidAsk']);
});

test('fmtWallClock renders wire times via UTC getters (no viewer-tz shift)', () => {
    // 2024-03-01 08:45 Taiwan wall clock, wallClockToUtc-encoded
    const t845 = Date.UTC(2024, 2, 1, 8, 45, 0) / 1000;
    assert.equal(fmtWallClock(t845), '2024/03/01 08:45');
    assert.equal(fmtWallClock(t845, true), '2024/03/01 08:45:00');
});
