// src/lib/agent/providers.ts — provider adapters. Each session keeps its
// own native message history; the runner only sees normalized turns
// (text blocks + tool calls) and feeds back tool results.

import { isTauri } from '../runtime';
import type { LLMTurn, ToolDef, ToolResult } from './types';

// OpenAI blocks browser CORS — route through the Tauri HTTP plugin on
// desktop; Anthropic allows browsers with the dangerous-access header
async function llmFetch(url: string, init: RequestInit): Promise<Response> {
    if (isTauri) {
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
        return tauriFetch(url, init as Parameters<typeof tauriFetch>[1]);
    }
    return fetch(url, init);
}

export interface ProviderSession {
    sendUser(text: string): void;
    pushToolResults(results: ToolResult[]): void;
    next(): Promise<LLMTurn>; // one model call
}

// ---- Anthropic ----

interface AnthContent {
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
}

export function anthropicSession(
    apiKey: string,
    model: string,
    system: string,
    tools: ToolDef[],
): ProviderSession {
    const messages: { role: string; content: unknown }[] = [];
    return {
        sendUser(text) {
            messages.push({ role: 'user', content: text });
        },
        pushToolResults(results) {
            messages.push({
                role: 'user',
                content: results.map((r) => ({
                    type: 'tool_result',
                    tool_use_id: r.id,
                    content: r.content,
                    ...(r.isError ? { is_error: true } : {}),
                })),
            });
        },
        async next() {
            const res = await llmFetch(
                'https://api.anthropic.com/v1/messages',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true',
                    },
                    body: JSON.stringify({
                        model,
                        max_tokens: 2000,
                        system,
                        tools: tools.map((t) => ({
                            name: t.name,
                            description: t.description,
                            input_schema: t.schema,
                        })),
                        messages,
                    }),
                },
            );
            if (!res.ok) {
                throw new Error(
                    `Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`,
                );
            }
            const data = (await res.json()) as { content: AnthContent[] };
            messages.push({ role: 'assistant', content: data.content });
            return {
                texts: data.content
                    .filter((c) => c.type === 'text' && c.text)
                    .map((c) => c.text!),
                toolCalls: data.content
                    .filter((c) => c.type === 'tool_use' && c.id && c.name)
                    .map((c) => ({
                        id: c.id!,
                        name: c.name!,
                        input: c.input ?? {},
                    })),
            };
        },
    };
}

// ---- OpenAI (chat completions + function calling) ----

interface OaToolCall {
    id: string;
    function: { name: string; arguments: string };
}

export function openaiSession(
    apiKey: string,
    model: string,
    system: string,
    tools: ToolDef[],
): ProviderSession {
    const messages: Record<string, unknown>[] = [
        { role: 'system', content: system },
    ];
    return {
        sendUser(text) {
            messages.push({ role: 'user', content: text });
        },
        pushToolResults(results) {
            for (const r of results) {
                messages.push({
                    role: 'tool',
                    tool_call_id: r.id,
                    content: r.content,
                });
            }
        },
        async next() {
            const res = await llmFetch(
                'https://api.openai.com/v1/chat/completions',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model,
                        messages,
                        tools: tools.map((t) => ({
                            type: 'function',
                            function: {
                                name: t.name,
                                description: t.description,
                                parameters: t.schema,
                            },
                        })),
                    }),
                },
            );
            if (!res.ok) {
                throw new Error(
                    `OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`,
                );
            }
            const data = (await res.json()) as {
                choices: {
                    message: {
                        content: string | null;
                        tool_calls?: OaToolCall[];
                    };
                }[];
            };
            const msg = data.choices[0]?.message;
            if (!msg) throw new Error('OpenAI: empty response');
            messages.push({
                role: 'assistant',
                content: msg.content ?? null,
                ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
            });
            return {
                texts: msg.content ? [msg.content] : [],
                toolCalls: (msg.tool_calls ?? []).map((tc) => {
                    let input: Record<string, unknown> = {};
                    try {
                        input = JSON.parse(tc.function.arguments || '{}');
                    } catch {
                        // malformed arguments — pass empty
                    }
                    return { id: tc.id, name: tc.function.name, input };
                }),
            };
        },
    };
}
