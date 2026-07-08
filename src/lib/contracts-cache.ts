// src/lib/contracts-cache.ts — global contract cache for pinned panels.
// Resolves a code to ContractInfo (STK first, FUT fallback), subscribes
// its quote streams once, and exposes a useSyncExternalStore hook.
// resolveContract() is the metadata-only variant (no quote subscriptions)
// for offline consumers like backtest runs.

import { useSyncExternalStore } from 'react';
import { fetchContract, subscribeQuote } from './shioaji';
import { registerCodeAlias } from './stream';
import type { ContractInfo, SecurityType } from './types/contract';

const cache = new Map<string, ContractInfo>();
const pending = new Map<string, Promise<ContractInfo>>();
const subscribed = new Set<string>();
const listeners = new Set<() => void>();

// effect seam — node:test swaps these (the real transport reads Vite's
// import.meta.env inside getApiBase(), which does not exist under
// node --import tsx, so unit tests inject fakes here instead)
const io = { fetchContract, subscribeQuote };

function emit() {
    listeners.forEach((l) => l());
}

export function getCachedContract(code: string): ContractInfo | undefined {
    return cache.get(code);
}

export function primeContract(contract: ContractInfo) {
    if (!cache.has(contract.code)) {
        cache.set(contract.code, contract);
        emit();
    }
    subscribed.add(contract.code); // watchlist already subscribed it
}

// Metadata-only resolution: fetch + cache + alias registration, but NEVER
// subscribes quote streams. Backtests need only static contract fields —
// shioaji's per-session subscription quota must not be spent on codes
// merely typed into the 多商品 field.
export async function resolveContract(
    code: string,
    type?: SecurityType,
): Promise<ContractInfo> {
    const hit = cache.get(code);
    if (hit) return hit;
    const inflight = pending.get(code);
    if (inflight) return inflight;

    const task = (async () => {
        let contract: ContractInfo;
        if (type) {
            contract = await io.fetchContract(code, type);
        } else {
            // auto-detect: stock → futures → options → index
            // (option codes like TX417000C6 resolved nothing before, so
            // clicking the option chain couldn't link a contract — issue #2)
            try {
                contract = await io.fetchContract(code, 'STK');
            } catch {
                try {
                    contract = await io.fetchContract(code, 'FUT');
                } catch {
                    try {
                        contract = await io.fetchContract(code, 'OPT');
                    } catch {
                        contract = await io.fetchContract(code, 'IND');
                    }
                }
            }
        }
        cache.set(code, contract);
        if (contract.target_code) {
            registerCodeAlias(contract.target_code, contract.code);
        }
        emit();
        return contract;
    })();
    pending.set(code, task);
    try {
        return await task;
    } finally {
        pending.delete(code);
    }
}

// Resolve + subscribe the quote streams once (live consumers: watchlist,
// charts, tickets, triggers). A contract first seen via resolveContract
// still gets its streams on its first ensure, so live-panel behavior is
// identical to before the metadata-only path existed.
export async function ensureContract(
    code: string,
    type?: SecurityType,
): Promise<ContractInfo> {
    const contract = await resolveContract(code, type);
    if (!subscribed.has(contract.code)) {
        subscribed.add(contract.code);
        await Promise.allSettled([
            io.subscribeQuote(contract, 'Tick'),
            io.subscribeQuote(contract, 'BidAsk'),
        ]);
    }
    return contract;
}

// test-only: swap the IO seam and clear module state between node:test
// cases; production code never calls this
export function __resetContractsCacheForTest(overrides?: {
    fetchContract?: typeof fetchContract;
    subscribeQuote?: typeof subscribeQuote;
}): void {
    cache.clear();
    pending.clear();
    subscribed.clear();
    listeners.clear();
    io.fetchContract = overrides?.fetchContract ?? fetchContract;
    io.subscribeQuote = overrides?.subscribeQuote ?? subscribeQuote;
}

export function useContract(code: string | null): ContractInfo | undefined {
    return useSyncExternalStore(
        (l) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        () => (code ? cache.get(code) : undefined),
    );
}
