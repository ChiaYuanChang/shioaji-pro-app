// src/lib/backtest-gate.test.ts — absent-closed-module fallback (BT-FE-001
// DoD: open builds render the open panel, not the desktop-only lock).
// Run with: npm test (node --import tsx --test).

import assert from 'node:assert/strict';
import test from 'node:test';
import type { ComponentType } from 'react';
import { closedModules } from '../modules-stub/index';
import {
    resolveBacktestPanel,
    type BacktestPanelProps,
} from './backtest-gate';

const OpenPanel: ComponentType<BacktestPanelProps> = () => null;
const ClosedPanel: ComponentType<BacktestPanelProps> = () => null;

test('open-source build (closedModules = {}): open panel, ungated', () => {
    // the real open-build manifest — backtest module is absent
    assert.equal(closedModules.backtest, undefined);
    const resolved = resolveBacktestPanel(closedModules.backtest, OpenPanel);
    assert.equal(resolved.Panel, OpenPanel);
    assert.equal(resolved.gated, false); // never the desktop-only lock
});

test('closed module present: closed panel stays behind the FeatureGate', () => {
    const resolved = resolveBacktestPanel(
        { Panel: ClosedPanel },
        OpenPanel,
    );
    assert.equal(resolved.Panel, ClosedPanel);
    assert.equal(resolved.gated, true);
});
