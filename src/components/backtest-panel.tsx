// src/components/backtest-panel.tsx — open backtest panel (BT-FE-001).
// Talks to the user-run open backtest service (backend/, FastAPI :8787):
// strategy list/validate, single-instrument run, watchlist portfolio run.
// Successful single runs are published to the backtest-chart store so the
// K 線圖 linked to the same symbol overlays the entry/exit markers.

import {
    ColorType,
    createChart,
    createSeriesMarkers,
    LineSeries,
} from 'lightweight-charts';
import { Play, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    BT_TIMEFRAMES,
    contractToWire,
    fetchBacktestHealth,
    fetchStrategies,
    fmtWallClock,
    getBacktestBase,
    runBacktest,
    runPortfolioBacktest,
    setBacktestBase,
    validateStrategy,
    type BtContract,
    type BtMetrics,
    type BtPortfolioResponse,
    type BtRunConfig,
    type BtRunResponse,
    type BtStrategyItem,
    type BtTimeframe,
    type BtValidateResponse,
} from '../lib/backtest';
import {
    equityToLineData,
    markersToSeriesMarkers,
    setBacktestRun,
} from '../lib/backtest-chart';
import type { BacktestPanelProps } from '../lib/backtest-gate';
import { resolveContract } from '../lib/contracts-cache';
import { getChartColors, useThemeSettings } from '../lib/theme-store';
import { todayStr } from '../lib/utils/date';
import { dateStrOffset } from '../lib/utils/kbars';
import { fmtMoney, fmtPct, fmtPrice } from '../lib/utils/format';
import * as panel from './panel.css';
import * as styles from './backtest-panel.css';

const ERROR_LABELS: Record<string, string> = {
    timeout: '回測逾時',
    strategy_exception: '策略執行錯誤',
    sidecar_down: '行情伺服器 (sidecar) 未連線',
    no_data: '區間內無 K 線資料',
};

function errMsg(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

// numeric input -> sanitized number (fallback to default when unusable)
function numOr(s: string, def: number, opts?: { min?: number; max?: number }): number {
    const v = Number(s);
    if (!Number.isFinite(v)) return def;
    if (opts?.min !== undefined && v < opts.min) return def;
    if (opts?.max !== undefined && v > opts.max) return def;
    return v;
}

const fmtPctNull = (v: number | null) => (v === null ? '—' : fmtPct(v * 100));
const fmtNumNull = (v: number | null, d = 2) =>
    v === null ? '—' : v.toFixed(d);

export function BacktestPanel({ contract, onPick }: BacktestPanelProps) {
    // ---- service health -----------------------------------------------------
    const [health, setHealth] = useState<'checking' | 'ok' | 'down'>(
        'checking',
    );
    const [healthSeq, setHealthSeq] = useState(0);
    const [baseUrl, setBaseUrl] = useState(getBacktestBase);
    useEffect(() => {
        let cancelled = false;
        setHealth('checking');
        fetchBacktestHealth().then(
            (ok) => !cancelled && setHealth(ok ? 'ok' : 'down'),
        );
        return () => {
            cancelled = true;
        };
    }, [healthSeq]);

    // ---- strategies ----------------------------------------------------------
    const [strategies, setStrategies] = useState<BtStrategyItem[] | null>(
        null,
    );
    const [stratError, setStratError] = useState<string | null>(null);
    const [stratSeq, setStratSeq] = useState(0);
    const [strategyName, setStrategyName] = useState('');
    useEffect(() => {
        let cancelled = false;
        setStratError(null);
        fetchStrategies()
            .then((r) => {
                if (cancelled) return;
                setStrategies(r.strategies);
                setStrategyName((cur) =>
                    cur && r.strategies.some((s) => s.name === cur)
                        ? cur
                        : (r.strategies.find((s) => s.valid)?.name ??
                          r.strategies[0]?.name ??
                          ''),
                );
            })
            .catch((e) => {
                if (cancelled) return;
                setStrategies(null);
                setStratError(errMsg(e));
            });
        return () => {
            cancelled = true;
        };
    }, [stratSeq]);
    const strategy =
        strategies?.find((s) => s.name === strategyName) ?? null;

    // ---- params (structured key/value editor over the file PARAMS defaults;
    // values are JSON scalars — parsed on run, unparsable text sent as string)
    const [paramText, setParamText] = useState<Record<string, string>>({});
    useEffect(() => {
        if (!strategy) {
            setParamText({});
            return;
        }
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(strategy.params)) {
            next[k] = JSON.stringify(v);
        }
        setParamText(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [strategy?.name, strategy?.path]);

    // ---- validate -------------------------------------------------------------
    const [validating, setValidating] = useState(false);
    const [validation, setValidation] = useState<BtValidateResponse | null>(
        null,
    );
    // stale-response guard: every new request (and every strategy switch)
    // bumps the token, so a late verdict for strategy A can never render
    // while strategy B is selected
    const validateSeqRef = useRef(0);
    useEffect(() => {
        validateSeqRef.current += 1; // invalidate any in-flight validate
        setValidation(null);
        setValidating(false);
    }, [strategyName]);
    const doValidate = () => {
        if (!strategy) return;
        const seq = ++validateSeqRef.current;
        setValidating(true);
        setValidation(null);
        validateStrategy(strategy.path)
            .then((r) => {
                if (validateSeqRef.current === seq) setValidation(r);
            })
            .catch((e) => {
                if (validateSeqRef.current === seq) {
                    setValidation({
                        valid: false,
                        error_code: null,
                        message: errMsg(e),
                    });
                }
            })
            .finally(() => {
                if (validateSeqRef.current === seq) setValidating(false);
            });
    };

    // ---- run controls ----------------------------------------------------------
    const [timeframe, setTimeframe] = useState<BtTimeframe>('15m');
    const [start, setStart] = useState(() => dateStrOffset(60));
    const [end, setEnd] = useState(() => todayStr());
    const [sessions, setSessions] = useState<'all' | 'day-only'>('all');
    const [sizeTxt, setSizeTxt] = useState('1');
    const [capitalTxt, setCapitalTxt] = useState('1000000');
    const [discountTxt, setDiscountTxt] = useState('1');
    const [futFeeTxt, setFutFeeTxt] = useState('45');
    const [slipMode, setSlipMode] = useState<'ticks' | 'fraction'>('ticks');
    const [slipValueTxt, setSlipValueTxt] = useState('0');
    const [codesTxt, setCodesTxt] = useState('');

    const [running, setRunning] = useState(false);
    const [transportError, setTransportError] = useState<string | null>(null);
    const [resolveNote, setResolveNote] = useState<string | null>(null);
    const [result, setResult] = useState<BtRunResponse | null>(null);
    const [portfolio, setPortfolio] = useState<BtPortfolioResponse | null>(
        null,
    );

    const wire = contract ? contractToWire(contract) : null;

    const buildConfig = (): BtRunConfig => ({
        sessions,
        size: numOr(sizeTxt, 1, { min: 1e-9 }),
        initial_capital: numOr(capitalTxt, 1_000_000, { min: 1 }),
        commission: {
            discount: numOr(discountTxt, 1, { min: 1e-9, max: 1 }),
            futures_fee_per_contract: numOr(futFeeTxt, 45, { min: 0 }),
        },
        slippage: {
            mode: slipMode,
            value: numOr(slipValueTxt, 0, { min: 0 }),
        },
    });

    const buildParams = (): Record<string, unknown> => {
        const out: Record<string, unknown> = {};
        for (const [k, txt] of Object.entries(paramText)) {
            const t = txt.trim();
            if (!t) continue;
            try {
                out[k] = JSON.parse(t);
            } catch {
                out[k] = t; // unquoted text -> string param
            }
        }
        return out;
    };

    const doRun = async () => {
        if (!wire || !strategyName || running) return;
        setRunning(true);
        setTransportError(null);
        setResolveNote(null);
        setPortfolio(null);
        setResult(null);
        setBacktestRun(null);
        try {
            const res = await runBacktest({
                strategy: strategyName,
                params: buildParams(),
                contract: wire,
                timeframe,
                start,
                end,
                config: buildConfig(),
            });
            setResult(res);
            if (res.status === 'done') {
                // publish run context — linked K 線圖 draws the markers
                setBacktestRun({
                    code: wire.code,
                    strategy: strategyName,
                    timeframe,
                    run: res,
                });
            }
        } catch (e) {
            setTransportError(errMsg(e));
        } finally {
            setRunning(false);
        }
    };

    const doPortfolioRun = async () => {
        if (!strategyName || running) return;
        const codes = [
            ...new Set(
                codesTxt
                    .split(/[\s,，、]+/)
                    .map((s) => s.trim())
                    .filter(Boolean),
            ),
        ];
        if (codes.length === 0) return;
        setRunning(true);
        setTransportError(null);
        setResolveNote(null);
        setResult(null);
        setPortfolio(null);
        setBacktestRun(null);
        try {
            const contracts: BtContract[] = [];
            const bad: string[] = [];
            for (const code of codes) {
                try {
                    // metadata-only resolve — a backtest must not spend
                    // shioaji's subscription quota on Tick/BidAsk streams
                    // for codes merely typed into this field
                    const w = contractToWire(await resolveContract(code));
                    if (w) contracts.push(w);
                    else bad.push(code);
                } catch {
                    bad.push(code);
                }
            }
            if (bad.length > 0) {
                setResolveNote(`已略過無法回測的代碼：${bad.join('、')}`);
            }
            if (contracts.length === 0) {
                setTransportError('沒有可回測的商品代碼');
                return;
            }
            const res = await runPortfolioBacktest({
                strategy: strategyName,
                params: buildParams(),
                contracts,
                timeframe,
                start,
                end,
                config: buildConfig(),
            });
            setPortfolio(res);
        } catch (e) {
            setTransportError(errMsg(e));
        } finally {
            setRunning(false);
        }
    };

    // ---- equity curve mini-chart -----------------------------------------------
    const themeSettings = useThemeSettings();
    const themeKey = `${themeSettings.mode}-${themeSettings.convention}`;
    const equityHostRef = useRef<HTMLDivElement>(null);
    const doneSingle = result !== null && result.status === 'done';
    const donePortfolio = portfolio !== null && portfolio.status === 'done';
    const curve = doneSingle
        ? result.equity_curve
        : donePortfolio
          ? portfolio.merged_equity_curve
          : [];
    const curveKey = doneSingle
        ? result.run_id
        : donePortfolio
          ? portfolio.run_id
          : '';
    useEffect(() => {
        const host = equityHostRef.current;
        if (!host || curve.length === 0) return;
        const colors = getChartColors(themeSettings);
        const chart = createChart(host, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: colors.text,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                attributionLogo: false,
            },
            grid: {
                vertLines: { color: colors.grid },
                horzLines: { color: colors.grid },
            },
            rightPriceScale: { borderColor: colors.border },
            timeScale: {
                borderColor: colors.border,
                timeVisible: true,
                secondsVisible: false,
            },
            autoSize: true,
        });
        const line = chart.addSeries(LineSeries, {
            color: colors.crosshair,
            lineWidth: 2,
            priceLineVisible: false,
        });
        // wire times === chart encoding — set as-is, no timezone conversion
        line.setData(equityToLineData(curve));
        if (doneSingle && result.markers.length > 0) {
            createSeriesMarkers(
                line,
                markersToSeriesMarkers(result.markers, {
                    buy: colors.up,
                    sell: colors.down,
                }),
            );
        }
        chart.timeScale().fitContent();
        return () => chart.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [curveKey, themeKey]);

    // ---- render helpers ----------------------------------------------------------

    const metricsCells = (m: BtMetrics): { label: string; value: string }[] => [
        { label: '淨報酬', value: fmtPctNull(m.net.total_return) },
        { label: '毛報酬', value: fmtPctNull(m.gross.total_return) },
        { label: '年化報酬(淨)', value: fmtPctNull(m.net.annualized_return) },
        { label: '勝率(淨)', value: fmtPctNull(m.net.win_rate) },
        { label: '獲利因子(淨)', value: fmtNumNull(m.net.profit_factor) },
        { label: 'Sharpe', value: fmtNumNull(m.sharpe) },
        {
            label: '最大回撤',
            value: m.max_drawdown
                ? `${fmtPct(m.max_drawdown.fraction * 100)}`
                : '—',
        },
        { label: '交易次數', value: String(m.trade_count) },
        { label: '曝險', value: fmtPctNull(m.exposure) },
        {
            label: '總成本',
            value: fmtMoney(
                m.total_costs.commission +
                    m.total_costs.tax +
                    m.total_costs.slippage,
            ),
        },
        { label: '平均獲利', value: m.net.avg_win === null ? '—' : fmtMoney(m.net.avg_win) },
        { label: '平均虧損', value: m.net.avg_loss === null ? '—' : fmtMoney(m.net.avg_loss) },
    ];

    const envelope = result ?? portfolio;
    const envelopeError =
        envelope && envelope.status === 'error' ? envelope : null;

    return (
        <>
            <div className={styles.controls}>
                <div className={styles.row}>
                    <span
                        className={styles.statusDot[health]}
                        title={`回測服務 ${baseUrl}`}
                    />
                    <label className={styles.field}>
                        策略
                        <select
                            className={styles.select}
                            value={strategyName}
                            onChange={(e) => setStrategyName(e.target.value)}
                        >
                            {(strategies ?? []).map((s) => (
                                <option key={s.name} value={s.name}>
                                    {s.name}
                                    {s.valid ? '' : '（無效）'}
                                </option>
                            ))}
                            {(strategies ?? []).length === 0 && (
                                <option value=''>（無策略）</option>
                            )}
                        </select>
                    </label>
                    <button
                        className={styles.iconBtn}
                        title='重新載入策略清單'
                        onClick={() => {
                            setStratSeq((s) => s + 1);
                            setHealthSeq((s) => s + 1);
                        }}
                    >
                        <RefreshCw size={10} />
                    </button>
                    <button
                        className={styles.iconBtn}
                        disabled={!strategy || validating}
                        onClick={doValidate}
                    >
                        驗證
                    </button>
                    {validation &&
                        (validation.valid ? (
                            <span className={styles.okText}>策略有效</span>
                        ) : (
                            <span className={styles.errText}>
                                {validation.error_code
                                    ? `${validation.error_code}: `
                                    : ''}
                                {validation.message ?? '策略無效'}
                            </span>
                        ))}
                    {!validation && strategy && !strategy.valid && (
                        <span className={styles.errText}>
                            {strategy.error_code}: {strategy.error ?? ''}
                        </span>
                    )}
                </div>
                {strategy && Object.keys(paramText).length > 0 && (
                    <div className={styles.row}>
                        <span className={styles.hint}>參數</span>
                        {Object.entries(paramText).map(([k, v]) => (
                            <label key={k} className={styles.field}>
                                {k}
                                <input
                                    className={styles.input}
                                    value={v}
                                    onChange={(e) =>
                                        setParamText((cur) => ({
                                            ...cur,
                                            [k]: e.target.value,
                                        }))
                                    }
                                />
                            </label>
                        ))}
                    </div>
                )}
                <div className={styles.row}>
                    <label className={styles.field}>
                        時框
                        <select
                            className={styles.select}
                            value={timeframe}
                            onChange={(e) =>
                                setTimeframe(e.target.value as BtTimeframe)
                            }
                        >
                            {BT_TIMEFRAMES.map((tf) => (
                                <option key={tf} value={tf}>
                                    {tf}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.field}>
                        自
                        <input
                            type='date'
                            className={styles.dateInput}
                            value={start}
                            onChange={(e) => setStart(e.target.value)}
                        />
                    </label>
                    <label className={styles.field}>
                        至
                        <input
                            type='date'
                            className={styles.dateInput}
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                        />
                    </label>
                    <label className={styles.field}>
                        時段
                        <select
                            className={styles.select}
                            value={sessions}
                            onChange={(e) =>
                                setSessions(
                                    e.target.value as 'all' | 'day-only',
                                )
                            }
                        >
                            <option value='all'>全部</option>
                            <option value='day-only'>僅日盤</option>
                        </select>
                    </label>
                </div>
                <div className={styles.row}>
                    <label className={styles.field}>
                        數量
                        <input
                            className={styles.input}
                            value={sizeTxt}
                            inputMode='decimal'
                            onChange={(e) => setSizeTxt(e.target.value)}
                        />
                    </label>
                    <label className={styles.field}>
                        初始資金
                        <input
                            className={styles.input}
                            value={capitalTxt}
                            inputMode='numeric'
                            onChange={(e) => setCapitalTxt(e.target.value)}
                        />
                    </label>
                    <label className={styles.field}>
                        手續費折數
                        <input
                            className={styles.input}
                            value={discountTxt}
                            inputMode='decimal'
                            onChange={(e) => setDiscountTxt(e.target.value)}
                        />
                    </label>
                    <label className={styles.field}>
                        期貨費/口
                        <input
                            className={styles.input}
                            value={futFeeTxt}
                            inputMode='decimal'
                            onChange={(e) => setFutFeeTxt(e.target.value)}
                        />
                    </label>
                    <label className={styles.field}>
                        滑價
                        <select
                            className={styles.select}
                            value={slipMode}
                            onChange={(e) =>
                                setSlipMode(
                                    e.target.value as 'ticks' | 'fraction',
                                )
                            }
                        >
                            <option value='ticks'>檔數</option>
                            <option value='fraction'>比例</option>
                        </select>
                        <input
                            className={styles.input}
                            value={slipValueTxt}
                            inputMode='decimal'
                            onChange={(e) => setSlipValueTxt(e.target.value)}
                        />
                    </label>
                </div>
                <div className={styles.row}>
                    <button
                        className={styles.runBtn}
                        disabled={running || !strategyName || !wire}
                        onClick={() => void doRun()}
                    >
                        <Play size={10} />
                        {running
                            ? '回測中…'
                            : `回測 ${wire ? wire.code : ''}`}
                    </button>
                    {contract && !wire && (
                        <span className={styles.hint}>
                            此商品類型不支援回測（僅股票/期貨/選擇權）
                        </span>
                    )}
                    {!contract && (
                        <span className={styles.hint}>等待商品…</span>
                    )}
                    <label className={styles.field} style={{ flex: 1 }}>
                        多商品
                        <input
                            className={styles.inputWide}
                            placeholder='代碼以逗號分隔，如 2330, 2454, TXFR1'
                            value={codesTxt}
                            onChange={(e) => setCodesTxt(e.target.value)}
                        />
                    </label>
                    <button
                        className={styles.iconBtn}
                        disabled={
                            running || !strategyName || !codesTxt.trim()
                        }
                        onClick={() => void doPortfolioRun()}
                    >
                        整合回測
                    </button>
                </div>
            </div>

            <div className={panel.panelBody}>
                {health === 'down' && (
                    <div className={styles.offlineBox}>
                        <span>
                            回測服務未連線 — 請在 <span className={styles.cmd}>backend/</span> 目錄執行{' '}
                            <span className={styles.cmd}>
                                uv run python -m backtest
                            </span>
                        </span>
                        <label className={styles.field}>
                            服務位址
                            <input
                                className={styles.inputWide}
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                                onBlur={() => {
                                    setBacktestBase(baseUrl);
                                    setBaseUrl(getBacktestBase());
                                    setHealthSeq((s) => s + 1);
                                    setStratSeq((s) => s + 1);
                                }}
                            />
                            <button
                                className={styles.iconBtn}
                                onClick={() => {
                                    setHealthSeq((s) => s + 1);
                                    setStratSeq((s) => s + 1);
                                }}
                            >
                                重試
                            </button>
                        </label>
                    </div>
                )}
                {stratError && health !== 'down' && (
                    <div className={styles.errorBox}>
                        <span className={styles.errorTitle}>
                            策略清單載入失敗
                        </span>
                        <span>{stratError}</span>
                    </div>
                )}
                {transportError && (
                    <div className={styles.errorBox}>
                        <span className={styles.errorTitle}>請求失敗</span>
                        <span>{transportError}</span>
                    </div>
                )}
                {resolveNote && (
                    <div className={styles.warnBox}>{resolveNote}</div>
                )}

                {/* F9 status envelope: run-level failures are HTTP 200 with
                    status:"error" — render, never crash */}
                {envelopeError && (
                    <div className={styles.errorBox}>
                        <span className={styles.errorTitle}>
                            {(envelopeError.error &&
                                ERROR_LABELS[envelopeError.error]) ??
                                envelopeError.error ??
                                '回測失敗'}
                        </span>
                        {envelopeError.message && (
                            <span>{envelopeError.message}</span>
                        )}
                        {envelopeError.retry_hint && (
                            <span className={styles.hint}>
                                {envelopeError.retry_hint}
                            </span>
                        )}
                        {result?.status === 'error' && result.traceback && (
                            <details>
                                <summary className={styles.hint}>
                                    traceback
                                </summary>
                                <pre className={styles.traceback}>
                                    {result.traceback}
                                </pre>
                            </details>
                        )}
                    </div>
                )}

                {doneSingle &&
                    result.warnings.map((w) => (
                        <div key={w.code} className={styles.warnBox}>
                            ⚠ {w.message}
                        </div>
                    ))}
                {doneSingle && result.pending_signal && (
                    <div className={styles.warnBox}>
                        最後一根 K 棒出現
                        {result.pending_signal.stance === 'long'
                            ? '多方'
                            : result.pending_signal.stance === 'short'
                              ? '空方'
                              : '平倉'}
                        訊號（{fmtWallClock(result.pending_signal.time)}
                        ），無次根開盤可成交
                    </div>
                )}

                {doneSingle && result.metrics && (
                    <>
                        <div className={styles.sectionTitle}>績效摘要</div>
                        <div className={styles.metricsGrid}>
                            {metricsCells(result.metrics).map((c) => (
                                <div
                                    key={c.label}
                                    className={styles.metricCell}
                                >
                                    <span className={styles.metricLabel}>
                                        {c.label}
                                    </span>
                                    <span className={styles.metricValue}>
                                        {c.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {curve.length > 0 && (
                    <>
                        <div className={styles.sectionTitle}>權益曲線</div>
                        <div
                            ref={equityHostRef}
                            className={styles.equityHost}
                        />
                    </>
                )}

                {doneSingle && result.trades.length > 0 && (
                    <>
                        <div className={styles.sectionTitle}>
                            交易明細（{result.trades.length}）
                        </div>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.th}>方向</th>
                                    <th className={styles.th}>進場時間</th>
                                    <th className={styles.th}>進場價</th>
                                    <th className={styles.th}>出場時間</th>
                                    <th className={styles.th}>出場價</th>
                                    <th className={styles.th}>量</th>
                                    <th className={styles.th}>毛損益</th>
                                    <th className={styles.th}>淨損益</th>
                                    <th className={styles.th}>成本</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.trades.map((t, i) => (
                                    <tr key={i}>
                                        <td
                                            className={`${styles.td} ${
                                                panel.dirText[
                                                    t.side === 'long'
                                                        ? 'up'
                                                        : 'down'
                                                ]
                                            }`}
                                        >
                                            {t.side === 'long'
                                                ? '多'
                                                : '空'}
                                            {t.open && (
                                                <span
                                                    className={
                                                        styles.openTag
                                                    }
                                                >
                                                    未平倉
                                                </span>
                                            )}
                                        </td>
                                        <td className={styles.tdMuted}>
                                            {fmtWallClock(t.entry_time)}
                                        </td>
                                        <td className={styles.td}>
                                            {fmtPrice(t.entry_price)}
                                        </td>
                                        <td className={styles.tdMuted}>
                                            {fmtWallClock(t.exit_time)}
                                        </td>
                                        <td className={styles.td}>
                                            {fmtPrice(t.exit_price)}
                                        </td>
                                        <td className={styles.td}>
                                            {t.size}
                                        </td>
                                        <td
                                            className={`${styles.td} ${
                                                panel.dirText[
                                                    t.gross_pnl > 0
                                                        ? 'up'
                                                        : t.gross_pnl < 0
                                                          ? 'down'
                                                          : 'flat'
                                                ]
                                            }`}
                                        >
                                            {fmtMoney(t.gross_pnl)}
                                        </td>
                                        <td
                                            className={`${styles.td} ${
                                                panel.dirText[
                                                    t.net_pnl > 0
                                                        ? 'up'
                                                        : t.net_pnl < 0
                                                          ? 'down'
                                                          : 'flat'
                                                ]
                                            }`}
                                        >
                                            {fmtMoney(t.net_pnl)}
                                        </td>
                                        <td className={styles.tdMuted}>
                                            {fmtMoney(
                                                t.costs.commission +
                                                    t.costs.tax +
                                                    t.costs.slippage,
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}

                {donePortfolio && (
                    <>
                        {portfolio.partial && (
                            <div className={styles.warnBox}>
                                部分商品回測失敗（僅成功商品計入合併權益曲線）
                            </div>
                        )}
                        <div className={styles.sectionTitle}>
                            多商品整合績效
                            {portfolio.initial_capital_total !== null &&
                                ` · 總初始資金 ${fmtMoney(portfolio.initial_capital_total)}`}
                        </div>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.th}>商品</th>
                                    <th className={styles.th}>交易數</th>
                                    <th className={styles.th}>淨報酬</th>
                                    <th className={styles.th}>毛報酬</th>
                                    <th className={styles.th}>淨損益</th>
                                    <th className={styles.th}>勝率</th>
                                    <th className={styles.th}>獲利因子</th>
                                    <th className={styles.th}>最大回撤</th>
                                    <th className={styles.th}>成本</th>
                                </tr>
                            </thead>
                            <tbody>
                                {portfolio.per_instrument.map((r) => (
                                    <tr
                                        key={r.code}
                                        className={styles.clickableRow}
                                        title='點擊連動終端商品'
                                        onClick={() => onPick(r.code)}
                                    >
                                        <td className={styles.td}>
                                            {r.code}{' '}
                                            <span className={styles.hint}>
                                                {r.name}
                                            </span>
                                        </td>
                                        {r.error !== null ? (
                                            <td
                                                className={styles.tdMuted}
                                                colSpan={8}
                                            >
                                                {r.error}
                                            </td>
                                        ) : (
                                            <>
                                                <td className={styles.td}>
                                                    {r.trade_count ?? '—'}
                                                </td>
                                                <td
                                                    className={`${styles.td} ${
                                                        panel.dirText[
                                                            (r.net_return ??
                                                                0) > 0
                                                                ? 'up'
                                                                : (r.net_return ??
                                                                        0) <
                                                                    0
                                                                  ? 'down'
                                                                  : 'flat'
                                                        ]
                                                    }`}
                                                >
                                                    {fmtPctNull(
                                                        r.net_return,
                                                    )}
                                                </td>
                                                <td className={styles.td}>
                                                    {fmtPctNull(
                                                        r.gross_return,
                                                    )}
                                                </td>
                                                <td className={styles.td}>
                                                    {r.net_pnl === null
                                                        ? '—'
                                                        : fmtMoney(
                                                              r.net_pnl,
                                                          )}
                                                </td>
                                                <td className={styles.td}>
                                                    {fmtPctNull(r.win_rate)}
                                                </td>
                                                <td className={styles.td}>
                                                    {fmtNumNull(
                                                        r.profit_factor,
                                                    )}
                                                </td>
                                                <td className={styles.td}>
                                                    {fmtPctNull(
                                                        r.max_drawdown,
                                                    )}
                                                </td>
                                                <td
                                                    className={
                                                        styles.tdMuted
                                                    }
                                                >
                                                    {r.total_costs === null
                                                        ? '—'
                                                        : fmtMoney(
                                                              r.total_costs,
                                                          )}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}

                {doneSingle && result.trades.length === 0 && (
                    <div className={styles.warnBox}>
                        區間內沒有任何交易
                    </div>
                )}
            </div>
        </>
    );
}
