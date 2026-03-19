/**
 * AI Provider abstraction
 *
 * AI_PROVIDER=groq        → Groq (fast, free tier, recommended)
 * AI_PROVIDER=gemini      → Google AI Studio (Gemini 2.0 Flash, free tier)
 * AI_PROVIDER=openrouter  → OpenRouter multi-model with automatic fallback chain
 * AI_PROVIDER=ollama      → local Ollama instance
 * AI_PROVIDER=claude      → Anthropic Claude API
 *
 * Auto-detection priority: groq → gemini → openrouter → ollama
 */

const PROVIDER = (process.env.AI_PROVIDER || (
  process.env.GROQ_API_KEY ? "groq" :
  process.env.GEMINI_API_KEY ? "gemini" :
  process.env.OPENROUTER_API_KEY ? "openrouter" : "ollama"
)) as "ollama" | "claude" | "openrouter" | "gemini" | "groq";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/auto";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// OpenRouter fallback chain if primary model is rate-limited or unavailable
const OPENROUTER_FALLBACKS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "openrouter/auto",
];

export interface AIMessage {  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  text: string;
  model: string;
  provider: "ollama" | "claude" | "openrouter" | "gemini" | "groq";
}

async function callGroq(messages: AIMessage[], maxTokens?: number): Promise<AIResponse> {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }),
  });

  if (!resp.ok) {
    const raw = await resp.text();
    console.error(`[Groq] Error ${resp.status}:`, raw);
    const err = new Error(`Groq error ${resp.status}: ${raw}`) as Error & { status: number };
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();
  return {
    text: data.choices?.[0]?.message?.content || "",
    model: GROQ_MODEL,
    provider: "groq",
  };
}

async function callGemini(messages: AIMessage[], maxTokens?: number): Promise<AIResponse> {
  // Convert OpenAI-style messages to Gemini native format
  const systemMsg = messages.find((m) => m.role === "system");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = { contents };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  if (maxTokens) body.generationConfig = { maxOutputTokens: maxTokens };

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!resp.ok) {
    const raw = await resp.text();
    console.error(`[Gemini] Error ${resp.status}:`, raw);
    const err = new Error(`Gemini error ${resp.status}: ${raw}`) as Error & { status: number };
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
    model: GEMINI_MODEL,
    provider: "gemini",
  };
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

async function callOpenRouterModel(model: string, messages: AIMessage[], maxTokens?: number): Promise<AIResponse> {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    }),
  });

  if (!resp.ok) {
    const raw = await resp.text();
    const err = new Error(`OpenRouter error ${resp.status}: ${raw}`) as Error & { status: number };
    err.status = resp.status;
    throw err;
  }

  const data = await resp.json();
  return {
    text: data.choices?.[0]?.message?.content || "",
    model,
    provider: "openrouter",
  };
}

async function callOpenRouter(messages: AIMessage[], maxTokens?: number): Promise<AIResponse> {
  const candidates = [OPENROUTER_MODEL, ...OPENROUTER_FALLBACKS];
  let lastErr: Error | undefined;

  for (const model of candidates) {
    try {
      return await callOpenRouterModel(model, messages, maxTokens);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 429 || e.status === 503 || e.status === 404) {
        console.warn(`[OpenRouter] ${model} unavailable, trying next fallback...`);
        lastErr = e;
        continue;
      }
      throw err;
    }
  }

  throw lastErr ?? new Error("All OpenRouter models exhausted");
}

/** Send a list of messages to the configured AI provider.
 *  Groq and Gemini fall back to OpenRouter automatically on quota/rate-limit errors. */
export async function chat(messages: AIMessage[], options?: { maxTokens?: number }): Promise<AIResponse> {
  if (PROVIDER === "claude") return callClaude(messages, options?.maxTokens);
  if (PROVIDER === "ollama") return callOllama(messages, options?.maxTokens);

  if (PROVIDER === "groq") {
    try {
      return await callGroq(messages, options?.maxTokens);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 429 || e.status === 503) {
        console.warn("[Groq] rate-limit hit, falling back to OpenRouter...");
        return callOpenRouter(messages, options?.maxTokens);
      }
      throw err;
    }
  }

  if (PROVIDER === "gemini") {
    try {
      return await callGemini(messages, options?.maxTokens);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 429 || e.status === 503 || e.status === 404 || e.message.includes("quota")) {
        console.warn("[Gemini] quota/rate-limit hit, falling back to OpenRouter...");
        return callOpenRouter(messages, options?.maxTokens);
      }
      throw err;
    }
  }

  return callOpenRouter(messages, options?.maxTokens);
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
    } else if (PROVIDER === "groq") {
      if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");
      return { ok: true, provider: "groq", model: GROQ_MODEL };
    } else if (PROVIDER === "gemini") {
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");
      return { ok: true, provider: "gemini", model: GEMINI_MODEL };
    } else {
      if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
      return { ok: true, provider: "claude", model: CLAUDE_MODEL };
    }
  } catch (err) {
    return {
      ok: false,
      provider: PROVIDER,
      model: GEMINI_MODEL,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
