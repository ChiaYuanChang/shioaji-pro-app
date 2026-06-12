// src/lib/agent/sessions.ts — chat session persistence: every conversation
// autosaves; sessions can be resumed, forked (whole or from a message), and
// deleted — Claude Code / Codex style. Provider-agnostic: a session started
// on Claude can resume on Codex; tool results are NOT replayed (market data
// goes stale — the agent re-queries live instead).

import type { AgentBlock, AgentProvider } from './types';

export interface ChatTurn {
    role: 'user' | 'assistant';
    blocks: AgentBlock[];
}

export interface ChatSession {
    id: string;
    title: string;
    provider: AgentProvider;
    model: string;
    createdAt: number;
    updatedAt: number;
    turns: ChatTurn[];
}

const KEY = 'sj-agent-sessions-v1';
const CURRENT_KEY = 'sj-agent-current-session';
const MAX_SESSIONS = 60;
const MAX_TURNS = 300;

let cache: ChatSession[] | null = null;
const listeners = new Set<() => void>();

function load(): ChatSession[] {
    if (cache) return cache;
    try {
        const raw = localStorage.getItem(KEY);
        const arr = raw ? (JSON.parse(raw) as ChatSession[]) : [];
        cache = Array.isArray(arr)
            ? arr.filter((s) => s && typeof s.id === 'string' && Array.isArray(s.turns))
            : [];
    } catch {
        cache = [];
    }
    return cache;
}

function persist() {
    if (!cache) return;
    // newest first, capped — drop oldest when over quota; retry smaller on
    // localStorage overflow
    cache.sort((a, b) => b.updatedAt - a.updatedAt);
    cache = cache.slice(0, MAX_SESSIONS);
    for (let keep = cache.length; keep >= 1; keep = Math.floor(keep / 2)) {
        try {
            localStorage.setItem(KEY, JSON.stringify(cache.slice(0, keep)));
            break;
        } catch {
            // quota — halve and retry
        }
    }
    listeners.forEach((l) => l());
}

export function subscribeSessions(l: () => void): () => void {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
}

export function listSessions(): ChatSession[] {
    return [...load()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSession(id: string): ChatSession | null {
    return load().find((s) => s.id === id) ?? null;
}

export function newSessionId(): string {
    return `cs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function titleFrom(turns: ChatTurn[]): string {
    for (const t of turns) {
        if (t.role !== 'user') continue;
        const text = t.blocks
            .map((b) => (b.type === 'text' ? b.text : ''))
            .join(' ')
            .trim();
        if (text) return text.length > 26 ? `${text.slice(0, 26)}…` : text;
    }
    return '新對話';
}

export function saveSession(
    s: Omit<ChatSession, 'title' | 'updatedAt'> & { title?: string },
) {
    const all = load();
    const turns = s.turns.slice(-MAX_TURNS);
    const existing = all.find((x) => x.id === s.id);
    const next: ChatSession = {
        ...s,
        turns,
        title: s.title || existing?.title || titleFrom(turns),
        updatedAt: Date.now(),
        createdAt: existing?.createdAt ?? s.createdAt,
    };
    if (existing) Object.assign(existing, next);
    else all.push(next);
    persist();
}

export function deleteSession(id: string) {
    cache = load().filter((s) => s.id !== id);
    if (getCurrentSessionId() === id) setCurrentSessionId('');
    persist();
}

// fork: duplicate a session (optionally only up to turn index, exclusive)
export function forkSession(id: string, uptoTurn?: number): ChatSession | null {
    const src = getSession(id);
    if (!src) return null;
    const turns =
        uptoTurn === undefined
            ? structuredClone(src.turns)
            : structuredClone(src.turns.slice(0, uptoTurn));
    const fork: ChatSession = {
        ...src,
        id: newSessionId(),
        title: `${(src.title || titleFrom(src.turns)).replace(/（分岔）$/, '')}（分岔）`,
        turns,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    load().push(fork);
    persist();
    return fork;
}

export function getCurrentSessionId(): string {
    try {
        return localStorage.getItem(CURRENT_KEY) ?? '';
    } catch {
        return '';
    }
}

export function setCurrentSessionId(id: string) {
    try {
        if (id) localStorage.setItem(CURRENT_KEY, id);
        else localStorage.removeItem(CURRENT_KEY);
    } catch {
        // session only
    }
}

// flatten saved turns into provider-agnostic replay history; tool calls are
// noted by name only — results are stale market data the agent re-queries
export function historyForPreload(
    turns: ChatTurn[],
): { role: 'user' | 'assistant'; text: string }[] {
    const out: { role: 'user' | 'assistant'; text: string }[] = [];
    for (const t of turns) {
        const parts: string[] = [];
        for (const b of t.blocks) {
            if (b.type === 'text' && b.text.trim()) parts.push(b.text.trim());
            else if (b.type === 'tool') parts.push(`（呼叫了 ${b.name}）`);
            else if (b.type === 'proposal')
                parts.push(
                    `（提案：${b.proposal.action === 'Buy' ? '買' : '賣'} ${b.proposal.code} × ${b.proposal.quantity}）`,
                );
        }
        const text = parts.join('\n');
        if (!text) continue;
        const last = out[out.length - 1];
        if (last && last.role === t.role) last.text += `\n${text}`;
        else out.push({ role: t.role, text });
    }
    return out;
}
