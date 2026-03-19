/**
 * AI Provider abstraction — swap between Ollama (local), Claude API, and OpenRouter
 * via the AI_PROVIDER environment variable.
 *
 * AI_PROVIDER=ollama      → uses local Ollama instance
 * AI_PROVIDER=claude      → uses Anthropic Claude API
 * AI_PROVIDER=openrouter  → uses OpenRouter (OpenAI-compatible API)
 *
 * This module is server-only (imported only from API routes / server actions).
 */

const PROVIDER = (process.env.AI_PROVIDER || "ollama") as "ollama" | "claude" | "openrouter";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  text: string;
  model: string;
  provider: "ollama" | "claude" | "openrouter";
}

async function callOllama(messages: AIMessage[], maxTokens?: number): Promise<AIResponse> {
  const resp = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      ...(maxTokens ? { options: { num_predict: maxTokens } } : {}),
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Ollama error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return {
    text: data.message?.content || "",
    model: OLLAMA_MODEL,
    provider: "ollama",
  };
}

async function callClaude(messages: AIMessage[], maxTokens?: number): Promise<AIResponse> {
  const system = messages.find((m) => m.role === "system")?.content;
  const conversation = messages.filter((m) => m.role !== "system");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens ?? 1024,
      ...(system ? { system } : {}),
      messages: conversation.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Claude error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return {
    text: data.content?.[0]?.text || "",
    model: CLAUDE_MODEL,
    provider: "claude",
  };
}

async function callOpenRouter(messages: AIMessage[], maxTokens?: number): Promise<AIResponse> {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenRouter error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return {
    text: data.choices?.[0]?.message?.content || "",
    model: OPENROUTER_MODEL,
    provider: "openrouter",
  };
}

/** Send a list of messages to the configured AI provider */
export async function chat(messages: AIMessage[], options?: { maxTokens?: number }): Promise<AIResponse> {
  if (PROVIDER === "claude") return callClaude(messages, options?.maxTokens);
  if (PROVIDER === "openrouter") return callOpenRouter(messages, options?.maxTokens);
  return callOllama(messages, options?.maxTokens);
}

/** Check if the configured provider is reachable */
export async function healthCheck(): Promise<{ ok: boolean; provider: string; model: string; error?: string }> {
  try {
    if (PROVIDER === "ollama") {
      const resp = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return { ok: true, provider: "ollama", model: OLLAMA_MODEL };
    } else if (PROVIDER === "openrouter") {
      if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");
      return { ok: true, provider: "openrouter", model: OPENROUTER_MODEL };
    } else {
      if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
      return { ok: true, provider: "claude", model: CLAUDE_MODEL };
    }
  } catch (err) {
    return {
      ok: false,
      provider: PROVIDER,
      model: PROVIDER === "ollama" ? OLLAMA_MODEL : PROVIDER === "openrouter" ? OPENROUTER_MODEL : CLAUDE_MODEL,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
