// src/components/indicator-dialog.css.ts — TradingView-style indicator
// picker dialog + per-instance settings modal.

import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const overlay = style({
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    background: 'rgba(0, 0, 0, 0.45)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '10vh',
});

export const dialog = style({
    display: 'flex',
    flexDirection: 'column',
    width: 'min(42rem, 92vw)',
    maxHeight: 'min(34rem, 78vh)',
    background: vars.color.panelRaised,
    border: `1px solid ${vars.color.borderBright}`,
    borderRadius: vars.radius.lg,
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
});

export const header = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${vars.space.md} ${vars.space.lg}`,
    fontFamily: vars.font.display,
    fontSize: '0.9rem',
    fontWeight: 600,
    color: vars.color.foreground,
});

export const closeBtn = style({
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    color: vars.color.mutedForeground,
    padding: '4px',
    borderRadius: vars.radius.sm,
    ':hover': { color: vars.color.foreground, background: vars.color.muted },
});

export const searchWrap = style({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: `0 ${vars.space.lg} ${vars.space.md}`,
    padding: `0 ${vars.space.md}`,
    background: vars.color.inset,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.md,
    color: vars.color.mutedForeground,
    ':focus-within': { borderColor: vars.color.accent },
});

export const searchInput = style({
    flex: 1,
    fontFamily: vars.font.body,
    fontSize: '0.82rem',
    color: vars.color.foreground,
    background: 'transparent',
    border: 'none',
    padding: '8px 0',
    outline: 'none',
    '::placeholder': { color: vars.color.mutedForeground },
});

export const body = style({
    display: 'flex',
    flex: 1,
    minHeight: 0,
    borderTop: `1px solid ${vars.color.border}`,
});

export const sidebar = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    width: '11rem',
    flexShrink: 0,
    padding: vars.space.md,
    borderRight: `1px solid ${vars.color.border}`,
    overflowY: 'auto',
});

export const sideTitle = style({
    fontFamily: vars.font.display,
    fontSize: '0.6rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: vars.color.mutedForeground,
    padding: '8px 8px 3px',
    userSelect: 'none',
});

const sideItemBase = style({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: vars.font.body,
    fontSize: '0.76rem',
    textAlign: 'left',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    borderRadius: vars.radius.sm,
    color: vars.color.foreground,
    padding: '6px 8px',
    ':hover': { background: vars.color.muted },
});

export const sideItem = styleVariants({
    normal: [sideItemBase],
    active: [
        sideItemBase,
        { background: vars.color.muted, fontWeight: 600 },
    ],
});

export const list = style({
    flex: 1,
    minWidth: 0,
    overflowY: 'auto',
    padding: `${vars.space.sm} 0`,
});

export const listHeader = style({
    fontFamily: vars.font.display,
    fontSize: '0.6rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: vars.color.mutedForeground,
    padding: `4px ${vars.space.lg}`,
    userSelect: 'none',
});

export const row = style({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    padding: `7px ${vars.space.lg}`,
    ':hover': { background: vars.color.muted },
});

export const rowSwatch = style({
    width: '10px',
    height: '10px',
    borderRadius: '3px',
    flexShrink: 0,
});

export const rowMain = style({
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
});

export const rowName = style({
    fontFamily: vars.font.body,
    fontSize: '0.8rem',
    fontWeight: 500,
    color: vars.color.foreground,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
});

export const rowDesc = style({
    fontFamily: vars.font.body,
    fontSize: '0.66rem',
    color: vars.color.mutedForeground,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
});

export const rowAdded = style({
    fontFamily: vars.font.mono,
    fontSize: '0.62rem',
    fontWeight: 600,
    color: vars.color.accent,
    flexShrink: 0,
});

export const starBtn = styleVariants({
    normal: [
        {
            display: 'inline-flex',
            alignItems: 'center',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: vars.color.mutedForeground,
            padding: '3px',
            borderRadius: vars.radius.sm,
            opacity: 0.35,
            flexShrink: 0,
            selectors: {
                [`${row}:hover &`]: { opacity: 1 },
            },
            ':hover': { color: vars.color.amber },
        },
    ],
    active: [
        {
            display: 'inline-flex',
            alignItems: 'center',
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: vars.color.amber,
            padding: '3px',
            borderRadius: vars.radius.sm,
            flexShrink: 0,
        },
    ],
});

export const empty = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '8rem',
    fontFamily: vars.font.body,
    fontSize: '0.76rem',
    color: vars.color.mutedForeground,
});

export const footer = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${vars.space.sm} ${vars.space.lg}`,
    borderTop: `1px solid ${vars.color.border}`,
    fontFamily: vars.font.body,
    fontSize: '0.66rem',
    color: vars.color.mutedForeground,
});

// ---- settings modal ----

export const settingsDialog = style({
    display: 'flex',
    flexDirection: 'column',
    width: 'min(24rem, 92vw)',
    maxHeight: 'min(30rem, 80vh)',
    background: vars.color.panelRaised,
    border: `1px solid ${vars.color.borderBright}`,
    borderRadius: vars.radius.lg,
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
});

export const tabs = style({
    display: 'flex',
    gap: '2px',
    padding: `0 ${vars.space.lg}`,
    borderBottom: `1px solid ${vars.color.border}`,
});

const tabBase = style({
    fontFamily: vars.font.body,
    fontSize: '0.74rem',
    fontWeight: 500,
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: vars.color.mutedForeground,
    padding: '7px 12px',
    ':hover': { color: vars.color.foreground },
});

export const tab = styleVariants({
    normal: [tabBase],
    active: [
        tabBase,
        {
            color: vars.color.foreground,
            fontWeight: 600,
            borderBottomColor: vars.color.accent,
        },
    ],
});

export const settingsBody = style({
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: vars.space.lg,
});

export const fieldRow = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    fontFamily: vars.font.body,
    fontSize: '0.74rem',
    color: vars.color.foreground,
});

export const fieldInput = style({
    width: '5rem',
    fontFamily: vars.font.mono,
    fontSize: '0.76rem',
    textAlign: 'right',
    color: vars.color.foreground,
    background: vars.color.inset,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.sm,
    padding: '4px 8px',
    outline: 'none',
    ':focus': { borderColor: vars.color.accent },
});

export const styleSection = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    paddingBottom: '8px',
    borderBottom: `1px solid ${vars.color.border}`,
    selectors: { '&:last-child': { borderBottom: 'none' } },
});

export const styleHead = style({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: vars.font.body,
    fontSize: '0.74rem',
    fontWeight: 600,
    color: vars.color.foreground,
});

export const styleControls = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
});

export const swatchRow = style({
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
});

const swatchBase = style({
    width: '14px',
    height: '14px',
    borderRadius: '3px',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.12)',
    padding: 0,
});

export const swatch = styleVariants({
    normal: [swatchBase],
    active: [
        swatchBase,
        {
            outline: `2px solid ${vars.color.foreground}`,
            outlineOffset: '1px',
        },
    ],
});

const widthBtnBase = style({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '20px',
    cursor: 'pointer',
    background: 'transparent',
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.sm,
    padding: 0,
    ':hover': { borderColor: vars.color.borderBright },
});

export const widthBtn = styleVariants({
    normal: [widthBtnBase],
    active: [widthBtnBase, { borderColor: vars.color.accent }],
});

export const widthLine = style({
    width: '14px',
    borderRadius: '1px',
    background: vars.color.foreground,
});

export const settingsFooter = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: `${vars.space.md} ${vars.space.lg}`,
    borderTop: `1px solid ${vars.color.border}`,
});

export const dangerBtn = style({
    fontFamily: vars.font.body,
    fontSize: '0.72rem',
    fontWeight: 500,
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    color: vars.color.danger,
    padding: '5px 8px',
    borderRadius: vars.radius.sm,
    ':hover': { background: vars.color.muted },
});

export const footerActions = style({
    display: 'flex',
    gap: '8px',
});

const actionBase = style({
    fontFamily: vars.font.body,
    fontSize: '0.74rem',
    fontWeight: 600,
    cursor: 'pointer',
    borderRadius: vars.radius.sm,
    padding: '5px 16px',
});

export const cancelBtn = style([
    actionBase,
    {
        background: 'transparent',
        border: `1px solid ${vars.color.border}`,
        color: vars.color.foreground,
        ':hover': { borderColor: vars.color.borderBright },
    },
]);

export const okBtn = style([
    actionBase,
    {
        background: vars.color.accent,
        border: `1px solid ${vars.color.accent}`,
        color: '#0b0e14',
        ':hover': { opacity: 0.9 },
    },
]);

export const checkbox = style({
    accentColor: vars.color.accent,
    cursor: 'pointer',
});
