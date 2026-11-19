/**
 * Minimale OpenRouter-client (server-only). Native fetch, gestructureerde JSON-output.
 * Gratis modellen: 20 verzoeken/minuut en 50/dag (1000/dag na eenmalig $10 tegoed).
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openrouter/free';
/** Vast gratis model als reserve (instelbaar met OPENROUTER_FALLBACK_MODEL). */
const DEFAULT_FALLBACK_MODEL = 'google/gemma-4-31b-it:free';
const TIMEOUT_MS = 50_000;
const MAX_TOKENS = 8_000;

export type ChatMessage = { role: 'system' | 'user'; content: string };

export type JsonSchema = Record<string, unknown>;

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** Haalt de eerste JSON-waarde uit modeltekst (ook als die in ```json ... ``` staat). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(body);
  } catch {
    const start = body.search(/[[{]/);
    const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
    if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1));
    throw new Error('AI-antwoord bevat geen geldige JSON');
  }
}

export async function chatJson(
  messages: ChatMessage[],
  schemaName: string,
  schema: JsonSchema,
): Promise<{ data: unknown; model: string | null }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is niet geconfigureerd');
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const fallback = process.env.OPENROUTER_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;

  // Tweede poging met een vast reservemodel: de gratis router kiest soms een model dat
  // een leeg of afgebroken antwoord geeft.
  let lastError: Error | null = null;
  for (const attemptModel of model === fallback ? [model, model] : [model, fallback]) {
    try {
      return await chatJsonOnce(key, attemptModel, messages, schemaName, schema);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('AI-verzoek mislukt');
      if (/limiet|429|niet geconfigureerd/.test(lastError.message)) break;
    }
  }
  throw lastError ?? new Error('AI-verzoek mislukt');
}

type CompletionBody = {
  model?: string;
  error?: { message?: string };
  choices?: {
    finish_reason?: string;
    message?: { content?: string | null; reasoning?: string | null };
  }[];
};

async function chatJsonOnce(
  key: string,
  model: string,
  messages: ChatMessage[],
  schemaName: string,
  schema: JsonSchema,
): Promise<{ data: unknown; model: string | null }> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Title': 'Conference Tracker',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: MAX_TOKENS,
      // Denkmodellen: weinig nadenken, zodat het antwoord zelf niet afgekapt wordt.
      reasoning: { effort: 'low' },
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: { name: schemaName, strict: true, schema },
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const body = (await res.json().catch(() => null)) as CompletionBody | null;
  if (!res.ok) {
    const reason = body?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 429)
      throw new Error(`AI-limiet bereikt (${reason}); probeer het later opnieuw`);
    throw new Error(`AI-verzoek mislukt: ${reason}`);
  }
  const choice = body?.choices?.[0];
  const used = body?.model ?? model;
  const content = choice?.message?.content?.trim();
  if (content) return { data: extractJson(content), model: used };
  // Sommige denkmodellen zetten de JSON alleen in het reasoning-veld.
  const reasoning = choice?.message?.reasoning;
  if (reasoning) {
    try {
      return { data: extractJson(reasoning), model: used };
    } catch {
      // Geen bruikbare JSON in de redenering.
    }
  }
  throw new Error(
    `Leeg AI-antwoord (model ${used}, finish_reason ${choice?.finish_reason ?? 'onbekend'})`,
  );
}
