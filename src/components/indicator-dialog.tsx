// src/components/indicator-dialog.tsx — TradingView-style indicator picker
// (search / category sidebar / favorites / add-in-place) and the
// per-instance settings modal（輸入 / 樣式 分頁、確定/取消）.

import { LineChart, Search, Star, Waves, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    DEF_BY_TYPE,
    INDICATOR_DEFS,
    loadFavorites,
    outputStyle,
    saveFavorites,
    type IndicatorDef,
    type IndicatorInstance,
    type OutputStyle,
} from '../lib/indicator-defs';
import * as styles from './indicator-dialog.css';

const WIDTHS: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];

type Category = 'all' | 'fav' | 'overlay' | 'pane';

const CATEGORIES: { key: Category; label: string }[] = [
    { key: 'all', label: '全部指標' },
    { key: 'fav', label: '我的最愛' },
    { key: 'overlay', label: '主圖疊加' },
    { key: 'pane', label: '副圖指標' },
];

export function IndicatorDialog({
    instances,
    palette,
    onAdd,
    onClose,
}: {
    instances: IndicatorInstance[];
    palette: string[];
    onAdd: (type: string) => void;
    onClose: () => void;
}) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<Category>('all');
    const [favs, setFavs] = useState<Set<string>>(loadFavorites);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleFav = (type: string) => {
        setFavs((prev) => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            saveFavorites(next);
            return next;
        });
    };

    const counts = useMemo(() => {
        const m = new Map<string, number>();
        for (const i of instances) m.set(i.type, (m.get(i.type) ?? 0) + 1);
        return m;
    }, [instances]);

    const q = query.trim().toLowerCase();
    const matches = (d: IndicatorDef) =>
        !q ||
        d.label.toLowerCase().includes(q) ||
        d.short.toLowerCase().includes(q) ||
        d.desc.toLowerCase().includes(q) ||
        d.aliases.some((a) => a.toLowerCase().includes(q));

    const inCategory = (d: IndicatorDef) =>
        category === 'all' ||
        (category === 'fav' && favs.has(d.type)) ||
        d.category === category;

    const filtered = INDICATOR_DEFS.filter(
        (d) => matches(d) && inCategory(d),
    );
    const overlays = filtered.filter((d) => d.category === 'overlay');
    const panes = filtered.filter((d) => d.category === 'pane');

    void palette; // reserved: future custom-color default per add

    const renderRow = (d: IndicatorDef) => {
        const added = counts.get(d.type) ?? 0;
        return (
            <button
                key={d.type}
                className={styles.row}
                onClick={() => onAdd(d.type)}
            >
                <span
                    className={styles.rowSwatch}
                    style={{ background: d.outputs[0]!.color }}
                />
                <span className={styles.rowMain}>
                    <span className={styles.rowName}>{d.label}</span>
                    <span className={styles.rowDesc}>{d.desc}</span>
                </span>
                {added > 0 && (
                    <span className={styles.rowAdded}>已加入 {added}</span>
                )}
                <span
                    role='button'
                    tabIndex={0}
                    className={
                        styles.starBtn[favs.has(d.type) ? 'active' : 'normal']
                    }
                    title='加入我的最愛'
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFav(d.type);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            toggleFav(d.type);
                        }
                    }}
                >
                    <Star
                        size={13}
                        fill={favs.has(d.type) ? 'currentColor' : 'none'}
                    />
                </span>
            </button>
        );
    };

    return (
        <div
            className={styles.overlay}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={styles.dialog}>
                <div className={styles.header}>
                    技術指標
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>
                <div className={styles.searchWrap}>
                    <Search size={14} />
                    <input
                        ref={inputRef}
                        className={styles.searchInput}
                        placeholder='搜尋指標（名稱、縮寫、中英文都可以）'
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                        <button
                            className={styles.closeBtn}
                            onClick={() => setQuery('')}
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>
                <div className={styles.body}>
                    <div className={styles.sidebar}>
                        <div className={styles.sideTitle}>分類</div>
                        {CATEGORIES.map((c) => (
                            <button
                                key={c.key}
                                className={
                                    styles.sideItem[
                                        category === c.key
                                            ? 'active'
                                            : 'normal'
                                    ]
                                }
                                onClick={() => setCategory(c.key)}
                            >
                                {c.key === 'fav' ? (
                                    <Star size={13} />
                                ) : c.key === 'overlay' ? (
                                    <LineChart size={13} />
                                ) : c.key === 'pane' ? (
                                    <Waves size={13} />
                                ) : (
                                    <Search size={13} />
                                )}
                                {c.label}
                            </button>
                        ))}
                    </div>
                    <div className={styles.list}>
                        {filtered.length === 0 && (
                            <div className={styles.empty}>
                                沒有符合「{query}」的指標
                            </div>
                        )}
                        {overlays.length > 0 && (
                            <>
                                <div className={styles.listHeader}>
                                    主圖疊加
                                </div>
                                {overlays.map(renderRow)}
                            </>
                        )}
                        {panes.length > 0 && (
                            <>
                                <div className={styles.listHeader}>
                                    副圖指標
                                </div>
                                {panes.map(renderRow)}
                            </>
                        )}
                    </div>
                </div>
                <div className={styles.footer}>
                    <span>點擊即加入圖表，可重複加入同型指標（不同參數）</span>
                    <span>已啟用 {instances.length} 個</span>
                </div>
            </div>
        </div>
    );
}

// ---- per-instance settings（輸入 / 樣式）----

export function IndicatorSettingsModal({
    inst,
    palette,
    onPatch,
    onRemove,
    onCommit,
    onCancel,
}: {
    inst: IndicatorInstance;
    palette: string[];
    onPatch: (patch: Partial<IndicatorInstance>) => void;
    onRemove: () => void;
    onCommit: () => void;
    onCancel: () => void;
}) {
    const def = DEF_BY_TYPE.get(inst.type);
    const [tab, setTab] = useState<'inputs' | 'style'>(
        def && def.params.length > 0 ? 'inputs' : 'style',
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter') onCommit();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!def) return null;

    const patchStyle = (key: string, patch: OutputStyle) => {
        onPatch({
            styles: {
                ...inst.styles,
                [key]: { ...inst.styles?.[key], ...patch },
            },
        });
    };

    return (
        <div
            className={styles.overlay}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onCancel();
            }}
        >
            <div className={styles.settingsDialog}>
                <div className={styles.header}>
                    {def.label}
                    <button className={styles.closeBtn} onClick={onCancel}>
                        <X size={16} />
                    </button>
                </div>
                <div className={styles.tabs}>
                    {def.params.length > 0 && (
                        <button
                            className={
                                styles.tab[tab === 'inputs' ? 'active' : 'normal']
                            }
                            onClick={() => setTab('inputs')}
                        >
                            輸入
                        </button>
                    )}
                    <button
                        className={
                            styles.tab[tab === 'style' ? 'active' : 'normal']
                        }
                        onClick={() => setTab('style')}
                    >
                        樣式
                    </button>
                </div>
                <div className={styles.settingsBody}>
                    {tab === 'inputs' &&
                        def.params.map((p) => (
                            <label key={p.key} className={styles.fieldRow}>
                                <span>{p.label}</span>
                                <input
                                    type='number'
                                    className={styles.fieldInput}
                                    min={p.min}
                                    max={p.max}
                                    step={p.step ?? 1}
                                    value={inst.params[p.key] ?? p.def}
                                    onChange={(e) => {
                                        const v = Number(e.target.value);
                                        if (!Number.isFinite(v)) return;
                                        onPatch({
                                            params: {
                                                ...inst.params,
                                                [p.key]: Math.min(
                                                    p.max,
                                                    Math.max(p.min, v),
                                                ),
                                            },
                                        });
                                    }}
                                />
                            </label>
                        ))}
                    {tab === 'style' &&
                        def.outputs.map((o) => {
                            const s = outputStyle(inst, def, o.key);
                            return (
                                <div
                                    key={o.key}
                                    className={styles.styleSection}
                                >
                                    <label className={styles.styleHead}>
                                        <input
                                            type='checkbox'
                                            className={styles.checkbox}
                                            checked={s.visible}
                                            onChange={(e) =>
                                                patchStyle(o.key, {
                                                    visible: e.target.checked,
                                                })
                                            }
                                        />
                                        {o.label}
                                    </label>
                                    <div className={styles.styleControls}>
                                        <div className={styles.swatchRow}>
                                            {palette.map((c) => (
                                                <button
                                                    key={c}
                                                    className={
                                                        styles.swatch[
                                                            s.color === c
                                                                ? 'active'
                                                                : 'normal'
                                                        ]
                                                    }
                                                    style={{ background: c }}
                                                    onClick={() =>
                                                        patchStyle(o.key, {
                                                            color: c,
                                                        })
                                                    }
                                                />
                                            ))}
                                        </div>
                                        {o.kind !== 'histogram' && (
                                            <div
                                                className={styles.footerActions}
                                            >
                                                {WIDTHS.map((w) => (
                                                    <button
                                                        key={w}
                                                        className={
                                                            styles.widthBtn[
                                                                s.width === w
                                                                    ? 'active'
                                                                    : 'normal'
                                                            ]
                                                        }
                                                        title={`${w}px`}
                                                        onClick={() =>
                                                            patchStyle(o.key, {
                                                                width: w,
                                                            })
                                                        }
                                                    >
                                                        <span
                                                            className={
                                                                styles.widthLine
                                                            }
                                                            style={{
                                                                height: `${w}px`,
                                                            }}
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
                <div className={styles.settingsFooter}>
                    <button className={styles.dangerBtn} onClick={onRemove}>
                        移除指標
                    </button>
                    <div className={styles.footerActions}>
                        <button
                            className={styles.cancelBtn}
                            onClick={onCancel}
                        >
                            取消
                        </button>
                        <button className={styles.okBtn} onClick={onCommit}>
                            確定
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
