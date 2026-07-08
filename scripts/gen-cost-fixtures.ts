// scripts/gen-cost-fixtures.ts — BT-COST-001 golden fixture generator.
//
// Calls the REAL contractMultiplier / futuresTaxRate / stockTaxRate from
// src/lib/utils/contract-cost.ts (never re-implemented) over a
// branch-covering contract set and writes the results to
// ../backend/tests/fixtures/costs/golden.json in the sibling Alpha Workbench
// backend repo.
//
// Run from this repo root:  pnpm exec tsx scripts/gen-cost-fixtures.ts
//
// Option premium-tax fixtures are deliberately absent: contract-cost.ts
// cannot generate them (the 0.001 options branch is order-ticket
// semantics, F6-AC1); they are hand-derived inline cases in
// ../backend/tests/core/test_costs.py.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ContractInfo } from '../src/lib/types/contract';
import {
    contractMultiplier,
    futuresTaxRate,
    stockTaxRate,
} from '../src/lib/utils/contract-cost';

// The subset of ContractInfo the Python `Contract` mirror consumes.
interface ContractSubset {
    security_type: string;
    code: string;
    category: string;
    multiplier: number | null;
    underlying_code: string;
    underlying_kind: string;
}

function toContractInfo(subset: ContractSubset): ContractInfo {
    return {
        exchange: subset.security_type === 'STK' ? 'TSE' : 'TAIFEX',
        code: subset.code,
        security_type: subset.security_type as ContractInfo['security_type'],
        target_code: null,
        name: '',
        currency: 'TWD',
        limit_up: 0,
        limit_down: 0,
        reference: 0,
        day_trade: '',
        update_date: '',
        category: subset.category,
        margin_trading_balance: 0,
        short_selling_balance: 0,
        multiplier: subset.multiplier ?? undefined,
        underlying_code: subset.underlying_code,
        underlying_kind: subset.underlying_kind,
    };
}

const fut = (partial: Partial<ContractSubset>): ContractSubset => ({
    security_type: 'FUT',
    code: '',
    category: '',
    multiplier: null,
    underlying_code: '',
    underlying_kind: '',
    ...partial,
});

const stk = (partial: Partial<ContractSubset>): ContractSubset => ({
    security_type: 'STK',
    code: '',
    category: '',
    multiplier: null,
    underlying_code: '',
    underlying_kind: '',
    ...partial,
});

// Every contractMultiplier branch (BT-COST-001 Implementation Notes):
// explicit multiplier; explicit-zero falls through; each of the 5 category
// rows; ETF futures by kind 'E' and separately by '00' prefix; single-stock
// by kind 'S' and separately by non-empty underlying with empty kind; the
// bare default (all discriminators empty).
const MULTIPLIER_CONTRACTS: ContractSubset[] = [
    fut({ code: 'EXPLICIT', category: 'TXF', multiplier: 333 }), // explicit wins over category
    fut({ code: 'ZEROMULT', category: 'TXF', multiplier: 0 }), // 0 is not explicit -> category
    fut({ code: 'TXFG6', category: 'TXF' }),
    fut({ code: 'MXFG6', category: 'MXF' }),
    fut({ code: 'TMFG6', category: 'TMF' }),
    fut({ code: 'EXFG6', category: 'EXF' }),
    fut({ code: 'FXFG6', category: 'FXF' }),
    fut({ code: 'ETFKIND', category: 'NYF', underlying_kind: 'E' }), // ETF by kind only
    fut({ code: 'ETFCODE', category: 'NZF', underlying_code: '0050' }), // ETF by 00-prefix only
    fut({ code: 'STKKIND', category: 'CDF', underlying_kind: 'S' }), // single-stock by kind only
    fut({ code: 'STKCODE', category: 'CEF', underlying_code: '2330' }), // single-stock by underlying
    fut({ code: 'BARE' }), // default 50 (index products)
    fut({ code: 'TXO12000G6', security_type: 'OPT', category: 'TXO' }), // index option -> default 50
    fut({ code: 'UNKNOWN', category: 'ZZZ' }), // unknown category -> default 50 (F6-AC6)
];

// futuresTaxRate branches: gold (GDF/TGF), interest-rate (GBF), equity-type
// (TXF), unknown, and empty -> default.
const FUTURES_TAX_CATEGORIES: string[] = ['GDF', 'TGF', 'GBF', 'TXF', 'MXF', 'ZZZ', ''];

// stockTaxRate branches: common stock, ETF by 00-prefix, ETF by kind 'E'
// with a non-00 code, and the empty-code edge (-> common).
const STOCK_TAX_CONTRACTS: ContractSubset[] = [
    stk({ code: '2330' }),
    stk({ code: '0050' }),
    stk({ code: '006208' }),
    stk({ code: 'T50', underlying_kind: 'E' }),
    stk({ code: '' }),
];

function main(): void {
    const golden = {
        multiplier_cases: MULTIPLIER_CONTRACTS.map((contract) => ({
            contract,
            expected: contractMultiplier(toContractInfo(contract)),
        })),
        futures_tax_cases: FUTURES_TAX_CATEGORIES.map((category) => ({
            category,
            expected: futuresTaxRate(category),
        })),
        stock_tax_cases: STOCK_TAX_CONTRACTS.map((contract) => ({
            contract,
            expected: stockTaxRate(toContractInfo(contract)),
        })),
    };

    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const outPath = join(scriptDir, '..', '..', 'backend', 'tests', 'fixtures', 'costs', 'golden.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(golden, null, 2)}\n`);
    console.log(`wrote ${outPath}`);
}

main();
