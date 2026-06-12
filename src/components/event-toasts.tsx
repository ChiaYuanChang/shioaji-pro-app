// src/components/event-toasts.tsx — order/deal/notice toasts.
// Prominent, kind-coded cards (成交/委託/錯誤/訊息) with clean formatted
// content instead of raw event dumps; size follows the 通知大小 setting.

import {
    BadgeCheck,
    CircleAlert,
    Info,
    Receipt,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { playAlert, playDeal, playError, playOrder } from '../lib/sounds';
import { onOrderEvent } from '../lib/stream';
import { useToastScale } from '../lib/toast-prefs';
import { onNotice } from '../lib/trade';
import type { OrderEventData } from '../lib/types/order';
import { fmtInt, fmtPrice } from '../lib/utils/format';
import * as styles from './event-toasts.css';

type ToastKind = 'deal' | 'ok' | 'err' | 'info';

interface ToastItem {
    id: number;
    kind: ToastKind;
    title: string;
    lines: { text: string; dir?: 'up' | 'down' }[];
}

const OP_LABEL: Record<string, string> = {
    New: '委託成功',
    Cancel: '委託已取消',
    UpdatePrice: '委託已改價',
    UpdateQty: '委託已改量',
    Deal: '成交回報',
};

// clean, human-readable order event — never a raw JSON dump
function describe(ev: OrderEventData): {
    kind: ToastKind;
    title: string;
    lines: ToastItem['lines'];
} {
    const code = ev.contract?.code ?? ev.code ?? '';
    const isDeal = ev.price !== undefined && ev.code !== undefined;
    const failed = !!ev.operation?.op_code && ev.operation.op_code !== '00';
    const action = ev.order?.action ?? ev.action;
    const actionText =
        action === 'Buy' ? '買進' : action === 'Sell' ? '賣出' : '';
    const dir = action === 'Buy' ? ('up' as const) : ('down' as const);

    if (failed) {
        return {
            kind: 'err',
            title: '委託被拒',
            lines: [
                { text: `${code} ${actionText}`.trim(), dir },
                { text: ev.operation?.op_msg || '請檢查委託條件' },
            ],
        };
    }
    if (isDeal) {
        return {
            kind: 'deal',
            title: '成交回報',
            lines: [
                {
                    text: `${code} ${actionText} ${fmtInt(Number(ev.quantity) || 0)} @ ${fmtPrice(Number(ev.price))}`,
                    dir,
                },
            ],
        };
    }
    const op = OP_LABEL[ev.operation?.op_type ?? ''] ?? '委託回報';
    const qty = ev.order?.quantity;
    const price = ev.order?.price;
    const detail = [
        code,
        actionText,
        qty !== undefined ? fmtInt(Number(qty)) : '',
        price !== undefined && Number(price) > 0
            ? `@ ${fmtPrice(Number(price))}`
            : '',
    ]
        .filter(Boolean)
        .join(' ');
    return {
        kind: 'ok',
        title: op,
        lines: detail ? [{ text: detail, dir }] : [],
    };
}

const KIND_ICON: Record<ToastKind, React.ReactNode> = {
    deal: <Receipt size={15} />,
    ok: <BadgeCheck size={15} />,
    err: <CircleAlert size={15} />,
    info: <Info size={15} />,
};

export function EventToasts({ onEvent }: { onEvent?: () => void }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const nextId = useRef(1);
    const onEventRef = useRef(onEvent);
    onEventRef.current = onEvent;
    const scale = useToastScale();

    useEffect(() => {
        const push = (
            kind: ToastKind,
            title: string,
            lines: ToastItem['lines'],
        ) => {
            const id = nextId.current++;
            setToasts((prev) => [...prev.slice(-4), { id, kind, title, lines }]);
            setTimeout(
                () => setToasts((prev) => prev.filter((t) => t.id !== id)),
                kind === 'err' ? 9000 : 6000,
            );
        };
        const offOrder = onOrderEvent((ev) => {
            const d = describe(ev);
            push(d.kind, d.title, d.lines);
            if (d.kind === 'deal') playDeal();
            else if (d.kind === 'err') playError();
            else playOrder();
            onEventRef.current?.();
        });
        const offNotice = onNotice((n) => {
            const kind: ToastKind =
                n.kind === 'err' ? 'err' : n.kind === 'ok' ? 'ok' : 'info';
            push(kind, n.title, n.body ? [{ text: n.body }] : []);
            if (n.kind === 'err') playError();
            else if (n.title.includes('警示')) playAlert();
            else if (n.kind === 'ok') playOrder();
            if (n.kind === 'ok') onEventRef.current?.();
        });
        return () => {
            offOrder();
            offNotice();
        };
    }, []);

    return (
        <div
            className={styles.stack}
            style={{
                fontSize: `${scale}rem`,
                width: `${21 * scale}rem`,
            }}
        >
            {toasts.map((t) => (
                <div key={t.id} className={styles.toast[t.kind]}>
                    <span className={styles.icon[t.kind]}>
                        {KIND_ICON[t.kind]}
                    </span>
                    <div className={styles.content}>
                        <div className={styles.title}>{t.title}</div>
                        {t.lines.map((l, i) => (
                            <div
                                key={i}
                                className={
                                    l.dir
                                        ? styles.line[l.dir]
                                        : styles.line.plain
                                }
                            >
                                {l.text}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
