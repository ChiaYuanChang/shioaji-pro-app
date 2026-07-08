// src/lib/backtest-gate.ts — the explicit product-gate decision for the
// backtest workspace block (BT-FE-001).
//
// DECISION: the closed desktop module, when present, keeps its VIP
// <FeatureGate> exactly as before. When it is absent (open-source builds:
// closedModules = {}) the block renders the OPEN panel — ungated — backed
// by the user-run open backtest service under backend/. Open builds must
// never fall back to the accidental "desktop-only" lock screen for this
// block.

import type { ComponentType } from 'react';
import type { ContractInfo } from './types/contract';

export interface BacktestPanelProps {
    contract: ContractInfo | null;
    onPick: (code: string) => void;
}

export interface ResolvedBacktestPanel {
    Panel: ComponentType<BacktestPanelProps>;
    // true -> wrap in <FeatureGate feature='backtest'> (closed module path)
    gated: boolean;
}

export function resolveBacktestPanel(
    closed: { Panel: ComponentType<BacktestPanelProps> } | undefined,
    open: ComponentType<BacktestPanelProps>,
): ResolvedBacktestPanel {
    return closed
        ? { Panel: closed.Panel, gated: true }
        : { Panel: open, gated: false };
}
