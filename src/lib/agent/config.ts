// src/lib/agent/config.ts — provider/model/key/policy settings (local).

import type { AgentPolicy, AgentProvider } from './types';

const K = {
    provider: 'sj-agent-provider',
    policy: 'sj-agent-policy',
    keyAnthropic: 'sj-agent-key-anthropic',
    keyOpenai: 'sj-agent-key-openai',
    modelAnthropic: 'sj-agent-model-anthropic',
    modelOpenai: 'sj-agent-model-openai',
};

const DEFAULT_MODEL: Record<AgentProvider, string> = {
    anthropic: 'claude-sonnet-4-6',
    openai: 'gpt-5.1',
};

function get(key: string): string {
    try {
        return localStorage.getItem(key) ?? '';
    } catch {
        return '';
    }
}

function set(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // session only
    }
}

export interface AgentConfig {
    provider: AgentProvider;
    model: string;
    apiKey: string;
    policy: AgentPolicy;
}

export function getAgentProvider(): AgentProvider {
    return get(K.provider) === 'openai' ? 'openai' : 'anthropic';
}

export function setAgentProvider(p: AgentProvider) {
    set(K.provider, p);
}

export function getAgentKey(provider: AgentProvider): string {
    if (provider === 'anthropic') {
        // migrate from the old assistant key
        return get(K.keyAnthropic) || get('sj-pro-anthropic-key');
    }
    return get(K.keyOpenai);
}

export function setAgentKey(provider: AgentProvider, key: string) {
    set(provider === 'anthropic' ? K.keyAnthropic : K.keyOpenai, key);
}

export function getAgentModel(provider: AgentProvider): string {
    const v = get(
        provider === 'anthropic' ? K.modelAnthropic : K.modelOpenai,
    );
    return v || DEFAULT_MODEL[provider];
}

export function setAgentModel(provider: AgentProvider, model: string) {
    set(provider === 'anthropic' ? K.modelAnthropic : K.modelOpenai, model);
}

export function getAgentPolicy(): AgentPolicy {
    const v = get(K.policy);
    return v === 'readonly' || v === 'auto' ? v : 'confirm';
}

export function setAgentPolicy(p: AgentPolicy) {
    set(K.policy, p);
}

export function getAgentConfig(): AgentConfig {
    const provider = getAgentProvider();
    return {
        provider,
        model: getAgentModel(provider),
        apiKey: getAgentKey(provider),
        policy: getAgentPolicy(),
    };
}
