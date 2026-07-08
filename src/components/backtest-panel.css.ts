// src/components/backtest-panel.css.ts

import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const controls = style({
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    borderBottom: `1px solid ${vars.color.border}`,
});

export const row = style({
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: vars.space.sm,
    padding: `3px ${vars.space.sm}`,
    borderBottom: `1px solid rgba(34, 43, 55, 0.45)`,
    selectors: { '&:last-child': { borderBottom: 'none' } },
});

export const field = style({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.62rem',
    fontFamily: vars.font.body,
    color: vars.color.mutedForeground,
    whiteSpace: 'nowrap',
});

const inputBase = style({
    fontFamily: vars.font.mono,
    fontSize: '0.68rem',
    color: vars.color.foreground,
    background: vars.color.inset,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.sm,
    padding: '1px 4px',
    outline: 'none',
    ':focus': { borderColor: vars.color.accent },
});

export const input = style([inputBase, { width: '5.2rem', textAlign: 'right' }]);

export const inputWide = style([inputBase, { flex: 1, minWidth: '8rem' }]);

export const select = style([
    inputBase,
    { textAlign: 'left', cursor: 'pointer' },
]);

export const dateInput = style([inputBase, { width: '7.4rem' }]);

export const runBtn = style({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: vars.font.display,
    fontSize: '0.68rem',
    fontWeight: 700,
    color: vars.color.foreground,
    background: vars.color.accentDim,
    border: `1px solid ${vars.color.accent}`,
    borderRadius: vars.radius.sm,
    padding: '2px 12px',
    cursor: 'pointer',
    ':hover': { background: vars.color.muted },
    ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
});

export const iconBtn = style({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontFamily: vars.font.body,
    fontSize: '0.62rem',
    color: vars.color.mutedForeground,
    background: 'transparent',
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.sm,
    padding: '1px 6px',
    cursor: 'pointer',
    ':hover': { color: vars.color.foreground, borderColor: vars.color.borderBright },
    ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
});

export const statusDot = styleVariants({
    ok: { width: 7, height: 7, borderRadius: '50%', background: vars.color.up, flexShrink: 0 },
    down: { width: 7, height: 7, borderRadius: '50%', background: vars.color.down, flexShrink: 0 },
    checking: { width: 7, height: 7, borderRadius: '50%', background: vars.color.flat, flexShrink: 0 },
});

export const hint = style({
    fontSize: '0.62rem',
    fontFamily: vars.font.body,
    color: vars.color.mutedForeground,
});

export const okText = style({ color: vars.color.up, fontSize: '0.62rem' });
export const errText = style({ color: vars.color.down, fontSize: '0.62rem' });

export const offlineBox = style({
    display: 'flex',
    flexDirection: 'column',
    gap: vars.space.xs,
    margin: vars.space.sm,
    padding: vars.space.sm,
    fontSize: '0.66rem',
    fontFamily: vars.font.body,
    color: vars.color.mutedForeground,
    background: vars.color.inset,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.sm,
});

export const cmd = style({
    fontFamily: vars.font.mono,
    color: vars.color.foreground,
    background: vars.color.muted,
    borderRadius: vars.radius.sm,
    padding: '0 4px',
});

export const errorBox = style({
    display: 'flex',
    flexDirection: 'column',
    gap: vars.space.xs,
    margin: vars.space.sm,
    padding: vars.space.sm,
    fontSize: '0.66rem',
    fontFamily: vars.font.body,
    color: vars.color.foreground,
    background: 'rgba(200, 60, 60, 0.08)',
    border: `1px solid ${vars.color.down}`,
    borderRadius: vars.radius.sm,
});

export const errorTitle = style({
    fontWeight: 700,
    color: vars.color.down,
});

export const traceback = style({
    maxHeight: '10rem',
    overflow: 'auto',
    margin: 0,
    padding: vars.space.xs,
    fontFamily: vars.font.mono,
    fontSize: '0.6rem',
    whiteSpace: 'pre-wrap',
    background: vars.color.inset,
    borderRadius: vars.radius.sm,
});

export const warnBox = style({
    margin: `0 ${vars.space.sm}`,
    padding: `2px ${vars.space.sm}`,
    fontSize: '0.62rem',
    fontFamily: vars.font.body,
    color: vars.color.amber,
});

export const sectionTitle = style({
    padding: `4px ${vars.space.sm} 2px`,
    fontFamily: vars.font.display,
    fontSize: '0.62rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: vars.color.mutedForeground,
});

export const metricsGrid = style({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(7.5rem, 1fr))',
    gap: '1px',
    padding: `0 ${vars.space.sm}`,
});

export const metricCell = style({
    display: 'flex',
    flexDirection: 'column',
    padding: `2px 6px`,
    background: vars.color.inset,
    borderRadius: vars.radius.sm,
});

export const metricLabel = style({
    fontSize: '0.58rem',
    fontFamily: vars.font.body,
    color: vars.color.mutedForeground,
    whiteSpace: 'nowrap',
});

export const metricValue = style({
    fontSize: '0.72rem',
    fontFamily: vars.font.mono,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    color: vars.color.foreground,
});

export const equityHost = style({
    height: '11rem',
    margin: `4px ${vars.space.sm}`,
    flexShrink: 0,
});

export const table = style({
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: vars.font.mono,
    fontSize: '0.64rem',
    fontVariantNumeric: 'tabular-nums',
});

export const th = style({
    position: 'sticky',
    top: 0,
    padding: `2px 6px`,
    textAlign: 'right',
    fontFamily: vars.font.body,
    fontWeight: 600,
    fontSize: '0.6rem',
    color: vars.color.mutedForeground,
    background: vars.color.panel,
    borderBottom: `1px solid ${vars.color.border}`,
    whiteSpace: 'nowrap',
    selectors: { '&:first-child': { textAlign: 'left' } },
});

export const td = style({
    padding: `2px 6px`,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    borderBottom: `1px solid rgba(34, 43, 55, 0.45)`,
    color: vars.color.foreground,
    selectors: { '&:first-child': { textAlign: 'left' } },
});

export const tdMuted = style([td, { color: vars.color.mutedForeground }]);

export const clickableRow = style({
    cursor: 'pointer',
    ':hover': { background: vars.color.muted },
});

export const openTag = style({
    marginLeft: '4px',
    padding: '0 4px',
    fontSize: '0.56rem',
    fontFamily: vars.font.body,
    color: vars.color.amber,
    border: `1px solid ${vars.color.amber}`,
    borderRadius: vars.radius.sm,
});
