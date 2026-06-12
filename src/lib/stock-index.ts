// src/lib/stock-index.ts — all stock contracts loaded once for name
// search (找代碼不用背) and category/sector grouping.

import { apiPost } from './api';

export interface StockMeta {
    code: string;
    name: string;
    category: string;
    exchange: string;
    day_trade?: string;
}

let cache: StockMeta[] | null = null;
let loading: Promise<StockMeta[]> | null = null;

export function loadStockIndex(): Promise<StockMeta[]> {
    if (cache) return Promise.resolve(cache);
    if (loading) return loading;
    loading = apiPost<{ contracts: StockMeta[] }>('/api/v1/data/contracts', {
        security_type: 'STK',
        page: -1,
    })
        .then((res) => {
            cache = res.contracts.filter((c) => c.code && c.name);
            return cache;
        })
        .catch((e) => {
            loading = null; // allow retry
            throw e;
        });
    return loading;
}

// substring match on name, prefix match on code — ranked so the actual
// stock beats its thousands of warrants (台積電 before 台積電XX購YY)
export function searchStocks(
    index: StockMeta[],
    query: string,
    limit = 8,
): StockMeta[] {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    const scored: { s: StockMeta; score: number }[] = [];
    for (const s of index) {
        const name = s.name.toUpperCase();
        const codeHit = s.code.startsWith(q);
        const nameHit = name.includes(q);
        if (!codeHit && !nameHit) continue;
        let score = 0;
        if (s.code === q || name === q) score -= 100; // exact
        if (codeHit) score -= 10;
        else if (name.startsWith(q)) score -= 5;
        // plain 4-digit equities rank above warrants/ETNs (6-char codes)
        score += s.code.length === 4 ? 0 : 50;
        score += s.name.length; // shorter names first
        scored.push({ s, score });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, limit).map((x) => x.s);
}

// distinct categories with member counts (for 類股/heatmap)
export function categoriesOf(
    index: StockMeta[],
): { category: string; count: number }[] {
    const m = new Map<string, number>();
    for (const s of index) {
        if (!s.category) continue;
        m.set(s.category, (m.get(s.category) ?? 0) + 1);
    }
    return [...m.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
}

// TWSE category code → readable label (shared by heatmap + leaderboard)
export const SECTOR_LABELS: Record<string, string> = {
    '24': '半導體',
    '25': '電腦週邊',
    '26': '光電',
    '27': '通信網路',
    '28': '電子零組件',
    '29': '電子通路',
    '30': '資訊服務',
    '31': '其他電子',
    '01': '水泥',
    '02': '食品',
    '03': '塑膠',
    '04': '紡織',
    '05': '電機',
    '06': '電器電纜',
    '08': '玻璃陶瓷',
    '09': '造紙',
    '10': '鋼鐵',
    '11': '橡膠',
    '12': '汽車',
    '14': '建材營造',
    '15': '航運',
    '16': '觀光',
    '17': '金融保險',
    '18': '貿易百貨',
    '20': '其他',
    '21': '化學',
    '22': '生技醫療',
    '23': '油電燃氣',
};

export function sectorLabel(category: string): string {
    return SECTOR_LABELS[category] ?? category;
}

// the category code for a single stock code (for showing/jumping by sector)
export function categoryOf(
    index: StockMeta[],
    code: string,
): string | null {
    return index.find((s) => s.code === code)?.category ?? null;
}
